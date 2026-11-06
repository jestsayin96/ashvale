import { dbToLin, linToDb } from '../audio/units';
import { feedbackDelay } from '../audio/fx/delay';
import { reverb } from '../audio/fx/reverb';
import { saturateBuffer } from '../audio/fx/saturation';
import { applyGainCurve, sidechainEnvelope } from '../audio/fx/sidechain';
import { limitTruePeak } from '../dsp/limiter';
import { analyzeLoudness } from '../dsp/loudnessAnalyzer';
import { measureLufs } from '../dsp/lufs';
import { measurePeaks } from '../dsp/truepeak';
import { highpassCoeffs, lowpassCoeffs, processBiquad } from '../dsp/biquad';
import { applySpeechPocket } from '../dsp/speechPocket';
import type { ScoreEvent, ScorePlan, StemMap } from './plan';
import { yieldToUi } from './yield';
import {
  DEFAULT_BUS_MIX,
  DEFAULT_CEILING_DBTP,
  DEFAULT_MUSIC_LUFS,
  DEFAULT_SPEECH_DIP_DB,
  DEFAULT_TARGET_LUFS,
  SECTION_BOOST_MAX_DB,
  SHORT_TERM_MAX_LUFS,
  SECTION_FADE_MS,
  SECTION_TARGET_LUFS,
  SFX_RELATIVE_DB,
  SIDECHAIN_DEPTH_DB,
  SIDECHAIN_RELEASE_MS,
  SPEECH_BLEND_MS,
} from './targets';

export interface DuckSpec {
  start: number;
  end: number;
  depthDb: number;
  attackMs: number;
  releaseMs: number;
}

export interface BusMix {
  gainDb: number;
  pan: number;
  reverbSend: number;
  delaySend: number;
  saturation: number;
}

export interface MixOptions {
  masterGainDb?: number;
  musicLufs?: number;
  targetLufs?: number;
  ceilingDbtp?: number;
  speechDipDb?: number;
  buses?: Partial<Record<'drums' | 'bass' | 'harmony' | 'melody' | 'sfx', Partial<BusMix>>>;
}

export interface MixResult {
  music: { left: Float32Array; right: Float32Array };
  sfx: { left: Float32Array; right: Float32Array };
  mix: { left: Float32Array; right: Float32Array };
  sampleRate: number;
  samples: number;
  integratedLufs: number;
  truePeakDbtp: number;
  shortTermMax: number;
  musicLufs: number;
  stemsGainDb: number;
  note: string;
  warnings: string[];
  /** Mix before the limiter. Used by tests. Not written into listen.json. */
  preLimiter: { left: Float32Array; right: Float32Array };
}

/** Look-ahead attack starts attackMs before the region. Overlaps keep the deeper duck. */
export function duckEnvelope(length: number, sampleRate: number, regions: DuckSpec[]): Float32Array {
  const gain = new Float32Array(length);
  gain.fill(1);
  for (const region of regions) {
    const depth = dbToLin(region.depthDb);
    const attack = Math.max(0, Math.round((region.attackMs / 1000) * sampleRate));
    const release = Math.max(0, Math.round((region.releaseMs / 1000) * sampleRate));
    const start = Math.round(region.start * sampleRate);
    const end = Math.round(region.end * sampleRate);
    const a0 = start - attack;
    for (let i = 0; i < attack; i++) {
      const idx = a0 + i;
      if (idx < 0 || idx >= length) continue;
      const g = 1 + (depth - 1) * ((i + 1) / attack);
      if (g < gain[idx]) gain[idx] = g;
    }
    for (let i = Math.max(0, start); i < Math.min(length, end); i++) {
      if (depth < gain[i]) gain[i] = depth;
    }
    for (let i = 0; i <= release; i++) {
      const idx = end + i;
      if (idx < 0 || idx >= length) continue;
      const g = release === 0 ? 1 : depth + (1 - depth) * (i / release);
      if (g < gain[idx]) gain[idx] = g;
    }
  }
  return gain;
}

export function mixdown(stems: StemMap, plan: ScorePlan, options: MixOptions = {}): MixResult {
  const sampleRate = plan.sampleRate;
  const length = stems.drums.left.length;
  const musicLufsTarget = options.musicLufs ?? DEFAULT_MUSIC_LUFS;
  const targetLufs = options.targetLufs ?? DEFAULT_TARGET_LUFS;
  const ceiling = options.ceilingDbtp ?? DEFAULT_CEILING_DBTP;
  const warnings: string[] = [];
  const buses = {
    drums: copyPair(stems.drums),
    bass: copyPair(stems.bass),
    harmony: copyPair(stems.harmony),
    melody: copyPair(stems.melody),
    sfx: copyPair(stems.sfx),
  };
  const hits = kickHits(plan.events, sampleRate);
  const sc = sidechainEnvelope(length, sampleRate, hits, SIDECHAIN_RELEASE_MS);
  applyGainCurve(buses.bass.left, sc);
  applyGainCurve(buses.bass.right, sc);
  applyGainCurve(buses.harmony.left, sc);
  applyGainCurve(buses.harmony.right, sc);

  const mixSettings = resolvedMix(options);
  (Object.keys(buses) as Array<keyof typeof buses>).forEach((name) => {
    const settings = mixSettings[name];
    const gain = dbToLin(settings.gainDb + (options.masterGainDb ?? 0));
    buses[name].left = saturateBuffer(scale(buses[name].left, gain), settings.saturation);
    buses[name].right = saturateBuffer(scale(buses[name].right, gain), settings.saturation);
  });

  const musicSendL = new Float32Array(length);
  const musicSendR = new Float32Array(length);
  const sfxSendL = new Float32Array(length);
  const sfxSendR = new Float32Array(length);
  const musicDelayL = new Float32Array(length);
  const musicDelayR = new Float32Array(length);
  const sfxDelayL = new Float32Array(length);
  const sfxDelayR = new Float32Array(length);
  for (const name of ['drums', 'bass', 'harmony', 'melody'] as const) {
    const settings = mixSettings[name];
    addScaled(musicSendL, buses[name].left, settings.reverbSend);
    addScaled(musicSendR, buses[name].right, settings.reverbSend);
    addScaled(musicDelayL, buses[name].left, settings.delaySend);
    addScaled(musicDelayR, buses[name].right, settings.delaySend);
  }
  addScaled(sfxSendL, buses.sfx.left, mixSettings.sfx.reverbSend);
  addScaled(sfxSendR, buses.sfx.right, mixSettings.sfx.reverbSend);
  addScaled(sfxDelayL, buses.sfx.left, mixSettings.sfx.delaySend);
  addScaled(sfxDelayR, buses.sfx.right, mixSettings.sfx.delaySend);
  const bpm = averageBpm(plan) || 120;
  const musicWet = reverb(musicSendL, musicSendR, sampleRate);
  const sfxWet = reverb(sfxSendL, sfxSendR, sampleRate);
  const musicEcho = feedbackDelay(musicDelayL, musicDelayR, sampleRate, bpm);
  const sfxEcho = feedbackDelay(sfxDelayL, sfxDelayR, sampleRate, bpm);

  const music = { left: new Float32Array(length), right: new Float32Array(length) };
  const sfx = { left: buses.sfx.left.slice(), right: buses.sfx.right.slice() };
  for (const name of ['drums', 'bass', 'harmony', 'melody'] as const) {
    addPan(music.left, music.right, buses[name].left, buses[name].right, mixSettings[name].pan);
  }
  addScaled(music.left, musicWet.left, 0.35);
  addScaled(music.right, musicWet.right, 0.35);
  addScaled(music.left, musicEcho.left, 0.2);
  addScaled(music.right, musicEcho.right, 0.2);
  addScaled(sfx.left, sfxWet.left, 0.35);
  addScaled(sfx.right, sfxWet.right, 0.35);
  addScaled(sfx.left, sfxEcho.left, 0.2);
  addScaled(sfx.right, sfxEcho.right, 0.2);
  const duck = duckEnvelope(length, sampleRate, plan.duckRegions.filter((region) => region.kind !== 'stop'));
  applyGainCurve(music.left, duck);
  applyGainCurve(music.right, duck);
  blendSpeech(music.left, music.right, sampleRate, plan, options.speechDipDb ?? plan.speechDipDb ?? DEFAULT_SPEECH_DIP_DB);
  parkTalking(music.left, music.right, sampleRate, plan);
  applyMutes(music.left, music.right, sampleRate, plan);
  stageSections(music.left, music.right, sampleRate, plan);

  if (plan.outroFadeSec > 0) {
    fadeTail(music.left, music.right, sampleRate, plan.outroFadeSec);
    fadeTail(sfx.left, sfx.right, sampleRate, plan.outroFadeSec);
  }
  const end = Math.max(1, Math.round((plan.endFadeMs / 1000) * sampleRate));
  fadeTail(music.left, music.right, sampleRate, end / sampleRate);
  fadeTail(sfx.left, sfx.right, sampleRate, end / sampleRate);

  const musicHeard = analyzeLoudness(music.left, music.right, sampleRate);
  const musicGainDb = clampDb(musicLufsTarget - (Number.isFinite(musicHeard.integrated()) ? musicHeard.integrated() : musicLufsTarget));
  const musicGain = dbToLin(musicGainDb);
  scaleInPlace(music.left, musicGain);
  scaleInPlace(music.right, musicGain);
  const sfxHeard = analyzeLoudness(sfx.left, sfx.right, sampleRate);
  const sfxGain = dbToLin(clampDb(musicLufsTarget + SFX_RELATIVE_DB - (Number.isFinite(sfxHeard.integrated()) ? sfxHeard.integrated() : musicLufsTarget)));
  scaleInPlace(sfx.left, sfxGain);
  scaleInPlace(sfx.right, sfxGain);

  const mixL = new Float32Array(length);
  const mixR = new Float32Array(length);
  addScaled(mixL, music.left, 1);
  addScaled(mixR, music.right, 1);
  addScaled(mixL, sfx.left, 1);
  addScaled(mixR, sfx.right, 1);

  const pre = analyzeLoudness(mixL, mixR, sampleRate);
  const preIntegrated = pre.integrated();
  let stemsGainDb = 0;
  if (Number.isFinite(preIntegrated)) {
    stemsGainDb = clampDb(targetLufs - preIntegrated);
    const g = dbToLin(stemsGainDb);
    scaleInPlace(mixL, g);
    scaleInPlace(mixR, g);
    scaleInPlace(music.left, g);
    scaleInPlace(music.right, g);
    scaleInPlace(sfx.left, g);
    scaleInPlace(sfx.right, g);
  }
  const preLimiter = { left: mixL.slice(), right: mixR.slice() };
  const limited = limitTruePeak(mixL, mixR, sampleRate, ceiling - 0.3);
  let outL = limited.left;
  let outR = limited.right;
  let after = measureLoud(outL, outR, sampleRate);
  let note = '';
  if (after.truePeak > ceiling) {
    const extra = after.truePeak - ceiling + 0.05;
    outL = scale(outL, dbToLin(-extra));
    outR = scale(outR, dbToLin(-extra));
    after = { ...after, truePeak: after.truePeak - extra, lufs: after.lufs - extra, shortTermMax: after.shortTermMax - extra };
  }
  const miss = targetLufs - after.lufs;
  if (Number.isFinite(after.lufs) && Math.abs(miss) > 0.5 && Math.abs(miss) <= 6 && after.truePeak + miss <= ceiling) {
    const g = dbToLin(miss);
    scaleInPlace(outL, g);
    scaleInPlace(outR, g);
    scaleInPlace(music.left, g);
    scaleInPlace(music.right, g);
    scaleInPlace(sfx.left, g);
    scaleInPlace(sfx.right, g);
    stemsGainDb += miss;
    after = { lufs: after.lufs + miss, truePeak: after.truePeak + miss, shortTermMax: after.shortTermMax + miss };
  }
  if (Math.abs(after.lufs - targetLufs) > 0.5) note = 'limited by ceiling';
  for (let pass = 0; pass < 2 && after.shortTermMax > SHORT_TERM_MAX_LUFS; pass++) {
    duckHotShortTerm(outL, outR, sampleRate);
    after = measureLoud(outL, outR, sampleRate);
  }
  if (after.shortTermMax > SHORT_TERM_MAX_LUFS) warnings.push(`short-term max ${after.shortTermMax.toFixed(2)} LUFS is above ${SHORT_TERM_MAX_LUFS}`);
  forceZeroTail(outL, outR, end);
  const musicLufs = Number.isFinite(musicHeard.integrated()) ? musicHeard.integrated() + musicGainDb + stemsGainDb : -120;
  return {
    music,
    sfx,
    mix: { left: outL, right: outR },
    sampleRate,
    samples: length,
    integratedLufs: after.lufs,
    truePeakDbtp: after.truePeak,
    shortTermMax: after.shortTermMax,
    musicLufs,
    stemsGainDb,
    note,
    warnings,
    preLimiter,
  };
}

/** Pull every 3 second span that is over the short-term gate down to the gate. Integrated loudness moves only where the file was hot. */
function duckHotShortTerm(left: Float32Array, right: Float32Array, sampleRate: number): void {
  const heard = analyzeLoudness(left, right, sampleRate);
  const n = Math.min(left.length, right.length);
  const win = Math.max(1, Math.round(3 * sampleRate));
  const hop = Math.max(1, Math.round(sampleRate));
  const gain = new Float32Array(n);
  gain.fill(1);
  const steps = n <= win ? 1 : Math.floor((n - win) / hop) + 1;
  for (let step = 0; step < steps; step++) {
    const a = Math.min(Math.max(0, n - win), step * hop);
    const b = Math.min(n, a + win);
    const lufs = heard.windowLufs(a, b);
    if (!(lufs > SHORT_TERM_MAX_LUFS)) continue;
    const mul = dbToLin(-(lufs - SHORT_TERM_MAX_LUFS + 0.2));
    for (let i = a; i < b; i++) if (mul < gain[i]) gain[i] = mul;
  }
  for (let i = 0; i < n; i++) {
    left[i] *= gain[i];
    right[i] *= gain[i];
  }
}

function measureLoud(left: Float32Array, right: Float32Array, sampleRate: number): { lufs: number; truePeak: number; shortTermMax: number } {
  const lufs = measureLufs(left, right, sampleRate);
  const peaks = measurePeaks(left, right);
  return {
    lufs: Number.isFinite(lufs.integrated) ? lufs.integrated : -120,
    truePeak: peaks.truePeak,
    shortTermMax: Number.isFinite(lufs.shortTermMax) ? lufs.shortTermMax : -120,
  };
}

function rmsLufs(left: Float32Array, right: Float32Array): number {
  let sum = 0;
  const n = Math.min(left.length, right.length);
  for (let i = 0; i < n; i++) sum += left[i] * left[i] + right[i] * right[i];
  const mean = n > 0 ? sum / (2 * n) : 0;
  if (!(mean > 0)) return -120;
  return 10 * Math.log10(2 * mean);
}

function gainForRms(left: Float32Array, right: Float32Array, target: number): number {
  return dbToLin(clampDb(target - rmsLufs(left, right)));
}

function gainForLufs(left: Float32Array, right: Float32Array, sampleRate: number, target: number): number {
  const measured = measureLufs(left, right, sampleRate).integrated;
  if (!Number.isFinite(measured)) return 1;
  return dbToLin(clampDb(target - measured));
}

function clampDb(db: number): number {
  if (db > 24) return 24;
  if (db < -24) return -24;
  return db;
}

function blendSpeech(left: Float32Array, right: Float32Array, sampleRate: number, plan: ScorePlan, dipDb: number): void {
  const regions = plan.duckRegions.filter((region) => region.kind === 'talking');
  if (regions.length === 0) return;
  const dippedL = left.slice();
  const dippedR = right.slice();
  applySpeechPocket(dippedL, dippedR, sampleRate, dipDb);
  const blend = duckEnvelope(left.length, sampleRate, regions.map((region) => ({
    start: region.start,
    end: region.end,
    depthDb: -80,
    attackMs: SPEECH_BLEND_MS,
    releaseMs: SPEECH_BLEND_MS,
  })));
  for (let i = 0; i < left.length; i++) {
    const wet = 1 - blend[i];
    left[i] = left[i] * (1 - wet) + dippedL[i] * wet;
    right[i] = right[i] * (1 - wet) + dippedR[i] * wet;
  }
}

function parkTalking(left: Float32Array, right: Float32Array, sampleRate: number, plan: ScorePlan): void {
  const regions = plan.duckRegions.filter((region) => region.kind === 'talking');
  if (regions.length === 0) return;
  const low = lowpassCoeffs(250, 0.7, sampleRate);
  const high = highpassCoeffs(3500, 0.7, sampleRate);
  const lowL = processBiquad(left, low);
  const lowR = processBiquad(right, low);
  const highL = processBiquad(left, high);
  const highR = processBiquad(right, high);
  const blend = duckEnvelope(left.length, sampleRate, regions.map((region) => ({
    start: region.start,
    end: region.end,
    depthDb: -80,
    attackMs: 40,
    releaseMs: 80,
  })));
  for (let i = 0; i < left.length; i++) {
    const wet = 1 - blend[i];
    if (wet <= 0) continue;
    left[i] = left[i] * (1 - wet) + (lowL[i] + highL[i]) * wet;
    right[i] = right[i] * (1 - wet) + (lowR[i] + highR[i]) * wet;
  }
}

function stageSections(left: Float32Array, right: Float32Array, sampleRate: number, plan: ScorePlan): void {
  const pieces = sectionPieces(plan, left.length, sampleRate);
  if (pieces.length === 0) return;
  const fade = Math.max(1, Math.round((SECTION_FADE_MS / 1000) * sampleRate));
  const gains = new Float32Array(left.length);
  gains.fill(1);
  const held: Array<{ a: number; b: number; achieved: number }> = [];
  let previous: number = SECTION_TARGET_LUFS.calm;
  for (const piece of pieces) {
    const db = rangeRms(left, right, piece.a, piece.b);
    const aim = piece.talk ? Math.min(previous - 8, Math.max(previous - 20, previous - 12)) : sectionAim(piece.type, piece.mood);
    let gainDb = aim - db;
    const cap = piece.talk ? 10 : SECTION_BOOST_MAX_DB;
    if (gainDb > cap) gainDb = cap;
    if (gainDb < -24) gainDb = -24;
    const achieved = db + gainDb;
    if (!piece.talk) {
      held.push({ a: piece.a, b: piece.b, achieved });
      previous = achieved;
    }
    const lin = dbToLin(gainDb);
    const from = Math.max(0, piece.a);
    const to = Math.min(left.length, piece.b);
    for (let i = from; i < to; i++) {
      const edge = Math.min(i - from, to - 1 - i, fade);
      const blend = fade <= 1 ? 1 : Math.min(1, (edge + 1) / fade);
      gains[i] = 1 + (lin - 1) * blend;
    }
  }
  if (held.length >= 2) {
    const hi = Math.max(...held.map((piece) => piece.achieved));
    const lo = Math.min(...held.map((piece) => piece.achieved));
    if (hi - lo > 10) {
      const ceiling = lo + 10;
      for (const piece of held) {
        if (piece.achieved <= ceiling) continue;
        const extra = dbToLin(-(piece.achieved - ceiling));
        for (let i = piece.a; i < piece.b && i < gains.length; i++) gains[i] *= extra;
      }
    }
  }
  applyGainCurve(left, gains);
  applyGainCurve(right, gains);
}

function sectionAim(type: string, mood: string): number {
  const table = SECTION_TARGET_LUFS as Record<string, number>;
  return table[type] ?? table[mood] ?? SECTION_TARGET_LUFS.default;
}

function sectionPieces(plan: ScorePlan, length: number, sampleRate: number): Array<{ a: number; b: number; talk: boolean; type: string; mood: string }> {
  const talking = plan.duckRegions.filter((region) => region.kind === 'talking');
  const pieces: Array<{ a: number; b: number; talk: boolean; type: string; mood: string }> = [];
  const push = (start: number, end: number, talk: boolean, type: string, mood: string) => {
    const a = Math.max(0, Math.round(start * sampleRate));
    const b = Math.min(length, Math.round(end * sampleRate));
    if (b - a < Math.round(0.05 * sampleRate)) return;
    pieces.push({ a, b, talk, type, mood });
  };
  for (const section of plan.sections) {
    let cursor = section.startSec;
    const talks = talking
      .filter((region) => region.end > section.startSec && region.start < section.endSec)
      .map((region) => ({ start: Math.max(section.startSec, region.start), end: Math.min(section.endSec, region.end) }))
      .sort((a, b) => a.start - b.start);
    for (const talk of talks) {
      if (talk.start > cursor) push(cursor, talk.start, false, section.cueType ?? section.mood, section.mood);
      push(talk.start, talk.end, true, 'talking', section.mood);
      cursor = talk.end;
    }
    if (section.endSec > cursor) push(cursor, section.endSec, false, section.cueType ?? section.mood, section.mood);
  }
  return pieces;
}

function rangeRms(left: Float32Array, right: Float32Array, a: number, b: number): number {
  let sum = 0;
  let n = 0;
  for (let i = a; i < b; i++) {
    sum += left[i] * left[i] + right[i] * right[i];
    n++;
  }
  if (!(n > 0) || !(sum > 0)) return -80;
  return 10 * Math.log10((sum / n) * 2);
}

function kickHits(events: ScoreEvent[], sampleRate: number): Array<{ sample: number; depthDb: number }> {
  return events
    .filter((event) => event.voice === 'kick' || event.params.role === 'kick' || event.params.role === 'heartbeat')
    .map((event) => ({ sample: Math.round(event.time * sampleRate), depthDb: SIDECHAIN_DEPTH_DB }));
}

function averageBpm(plan: ScorePlan): number {
  const metered = plan.sections.filter((section) => section.bpm > 0);
  if (metered.length === 0) return plan.lockedBpm ?? 120;
  return metered.reduce((sum, section) => sum + section.bpm, 0) / metered.length;
}

function resolvedMix(options: MixOptions): Record<'drums' | 'bass' | 'harmony' | 'melody' | 'sfx', BusMix> {
  const names = ['drums', 'bass', 'harmony', 'melody', 'sfx'] as const;
  const out = {} as Record<(typeof names)[number], BusMix>;
  for (const name of names) {
    out[name] = { ...DEFAULT_BUS_MIX[name], ...(options.buses?.[name] ?? {}) };
  }
  return out;
}

function copyPair(pair: { left: Float32Array; right: Float32Array }): { left: Float32Array; right: Float32Array } {
  return { left: pair.left.slice(), right: pair.right.slice() };
}

function scale(input: Float32Array, gain: number): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i] * gain;
  return out;
}

function scaleInPlace(buffer: Float32Array, gain: number): void {
  for (let i = 0; i < buffer.length; i++) buffer[i] *= gain;
}

function addScaled(dest: Float32Array, src: Float32Array, gain: number): void {
  const n = Math.min(dest.length, src.length);
  for (let i = 0; i < n; i++) dest[i] += src[i] * gain;
}

function addPan(left: Float32Array, right: Float32Array, srcL: Float32Array, srcR: Float32Array, pan: number): void {
  const angle = ((pan + 1) / 2) * (Math.PI / 2);
  const l = Math.cos(angle);
  const r = Math.sin(angle);
  for (let i = 0; i < left.length; i++) {
    left[i] += srcL[i] * l;
    right[i] += srcR[i] * r;
  }
}

function applyMutes(left: Float32Array, right: Float32Array, _sampleRate: number, plan: ScorePlan): void {
  for (const region of plan.muteRegions) {
    const a = Math.max(0, Math.round(region.start * _sampleRate));
    const b = Math.min(left.length, Math.round(region.end * _sampleRate));
    left.fill(0, a, b);
    right.fill(0, a, b);
  }
}

function fadeTail(left: Float32Array, right: Float32Array, sampleRate: number, seconds: number): void {
  const n = Math.min(left.length, Math.max(1, Math.round(seconds * sampleRate)));
  const start = left.length - n;
  for (let i = 0; i < n; i++) {
    const g = 1 - (i + 1) / n;
    left[start + i] *= g;
    right[start + i] *= g;
  }
}

function guardSamplePeak(left: Float32Array, right: Float32Array, ceilingDb: number): { left: Float32Array; right: Float32Array; peakIndex: number } {
  let peak = 0;
  let peakIndex = 0;
  for (let i = 0; i < left.length; i++) {
    const a = left[i] < 0 ? -left[i] : left[i];
    const b = right[i] < 0 ? -right[i] : right[i];
    if (a > peak) {
      peak = a;
      peakIndex = i;
    }
    if (b > peak) {
      peak = b;
      peakIndex = i;
    }
  }
  const limit = dbToLin(ceilingDb);
  if (!(peak > limit) || !(peak > 0)) return { left, right, peakIndex };
  const gain = limit / peak;
  scaleInPlace(left, gain);
  scaleInPlace(right, gain);
  return { left, right, peakIndex };
}

function measureLoudWindow(left: Float32Array, right: Float32Array, sampleRate: number, peakIndex: number): { lufs: number; truePeak: number; shortTermMax: number } {
  const lufs = measureLufs(left, right, sampleRate);
  const radius = 2048;
  const a = Math.max(0, peakIndex - radius);
  const b = Math.min(left.length, peakIndex + radius);
  const peaks = measurePeaks(left.subarray(a, b), right.subarray(a, b));
  return {
    lufs: Number.isFinite(lufs.integrated) ? lufs.integrated : -120,
    truePeak: peaks.truePeak,
    shortTermMax: Number.isFinite(lufs.shortTermMax) ? lufs.shortTermMax : -120,
  };
}

function forceZeroTail(left: Float32Array, right: Float32Array, samples: number): void {
  const n = Math.min(samples, left.length);
  for (let i = left.length - n; i < left.length; i++) {
    const g = (left.length - 1 - i) / n;
    left[i] *= g;
    right[i] *= g;
  }
  if (left.length > 0) {
    left[left.length - 1] = 0;
    right[right.length - 1] = 0;
  }
}

export async function mixdownAsync(
  stems: StemMap,
  plan: ScorePlan,
  options: MixOptions = {},
  onStage?: (name: string) => void,
): Promise<MixResult> {
  onStage?.('sidechain');
  await yieldToUi();
  onStage?.('returns');
  await yieldToUi();
  const mixed = mixdown(stems, plan, options);
  onStage?.('loudness');
  await yieldToUi();
  return mixed;
}

export function stemsGainLabel(db: number): string {
  return `stemsGainDb ${linToDb(dbToLin(db)).toFixed(2)}`;
}
