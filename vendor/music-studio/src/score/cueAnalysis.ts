import { analyzeLoudness } from '../dsp/loudnessAnalyzer';
import { bandShares, loudnessSeries, spectrumSummary } from '../analysis/features';
import { scoreMood, type MoodMetrics } from '../analysis/mood';
import type { PlotMarker } from '../analysis/markers';
import { averagePower } from '../analysis/features';
import { CUE_BEHAVIOR, expectedMoodForCue } from './mapping';
import type { ScorePlan } from './plan';
import { measuredOnsetErrorMs, type SyncReport } from './sync';
import {
  CALM_DENSITY_MAX,
  CALM_LEVEL_BELOW_LOUDEST_DB,
  CUE_WINDOW_MAX_S,
  DEATH_GAP_RMS_DB,
  DEATH_TEMPO_RATIO,
  BRIGHTNESS_FLOOR_HZ,
  FUNNY_BRIGHTNESS_MIN_HZ,
  HIGH_BAND_SHARE_MIN,
  HIT_LEVEL_STEP_DB,
  KILL_STING_RISE_DB,
  HIT_TIME_MS,
  HYPE_BRIGHTNESS_MIN_HZ,
  HYPE_DENSITY_MIN,
  HYPE_LEVEL_ABOVE_CALM_DB,
  OUTRO_LAST_SAMPLE,
  OUTRO_TAIL_S,
  SAD_BRIGHTNESS_MAX_HZ,
  SAD_DENSITY_MAX,
  SAD_TEMPO_MAX,
  TALKING_BELOW_PREVIOUS_DB,
  TALKING_SPEECH_SHARE_MAX,
} from './targets';

export interface CueVerdict {
  index: number;
  type: string;
  t: number;
  duration: number;
  verdict: 'pass' | 'warn' | 'fail';
  suggestion: string;
  numbers: Record<string, number | string>;
}

export interface MoodByCue {
  cueIndex: number;
  type: string;
  expectedMood: 'hype' | 'playful' | 'lowkey';
  best: string;
  scores: { hype: number; playful: number; lowkey: number };
  pass: boolean | null;
  suggestions: string[];
}

export interface ScoreListenReport {
  meta: { name: string; seed: number; seconds: number; sampleRate: number; appVersion: string; timing?: TimingReport };
  plan: { sections: number; keys: string[]; tempoMap: Array<{ startSec: number; endSec: number; bpm: number }> };
  loudness: CompactLoudness;
  perCue: CueVerdict[];
  moodByCue: MoodByCue[];
  sync: SyncReport['summary'];
  englishParagraph: string;
  markers: PlotMarker[];
}

export interface TimingReport {
  planMs: number;
  renderMs: number;
  mixMs: number;
  analysisMs: number;
  picturesMs: number;
  encodeMs: number;
  saveMs: number;
  totalMs: number;
  sentence: string;
}

export interface CompactLoudness {
  integratedLufs: number | null;
  truePeakDbtp: number | null;
  shortTermMax: number | null;
  musicLufs: number | null;
  stemsGainDb: number | null;
  note: string;
  warnings: string[];
  series: Array<{ t: number; lufs: number | null }>;
  sectionLufs: Array<{ start: number; end: number; lufs: number | null }>;
}

const SENTENCE = 'These are measurements, not a judgment of how it sounds.';

export function analyzeCues(
  plan: ScorePlan,
  mix: { left: Float32Array; right: Float32Array },
  music: { left: Float32Array; right: Float32Array },
  sfx: { left: Float32Array; right: Float32Array },
  sampleRate: number,
): { perCue: CueVerdict[]; moodByCue: MoodByCue[] } {
  const sectionLevel = plan.sections.map((section) => rmsDb(mix.left, mix.right, section.startSec, section.endSec, sampleRate));
  const loudest = sectionLevel.reduce((m, value) => Math.max(m, value), -120);
  const perCue: CueVerdict[] = [];
  const moodByCue: MoodByCue[] = [];
  plan.cues.forEach((cue, index) => {
    const duration = windowDuration(plan, index);
    const rawEnd = Math.min(plan.videoLengthSeconds, cue.t + duration);
    const section = plan.sections.find((item) => cue.t >= item.startSec - 1e-4 && cue.t < item.endSec) ?? plan.sections[0];
    const metricStart = cue.t + 0.1;
    const metricEnd = Math.min(rawEnd, section?.endSec ?? rawEnd);
    const heardStart = metricEnd > metricStart ? metricStart : cue.t;
    const heardEnd = metricEnd > metricStart ? metricEnd : rawEnd;
    const end = rawEnd;
    const density = musicDensity(plan, cue.t, end);
    const musicSpec = spectrumSummary(slice(music.left, heardStart, heardEnd, sampleRate), slice(music.right, heardStart, heardEnd, sampleRate), sampleRate);
    const centroid = musicSpec.centroidMedianHz;
    const brightness = musicSpec.brightnessMedianHz;
    const highShare = musicSpec.highShare;
    const level = rmsDb(mix.left, mix.right, cue.t, end, sampleRate);
    const previous = previousMetered(plan, section?.startSec ?? cue.t);
    const prevLevel = cue.type === 'talking'
      ? rmsDb(mix.left, mix.right, Math.max(0, cue.t - Math.max(0.5, duration)), cue.t, sampleRate)
      : previous
        ? rmsDb(mix.left, mix.right, previous.startSec, previous.endSec, sampleRate)
        : level;
    const scale = section?.key.scale ?? 'minor';
    const mode = scale === 'major' || scale === 'majorPent' ? 'major' : scale === 'minor' || scale === 'minorPent' ? 'minor' : 'other';
    const bpm = section?.bpm ?? 0;
    const stings = plan.events.filter((event) => event.voice === 'kill_sting' && event.cueIndex === index);
    const stingPeaks = stings.map((event, i) => {
      const impact = event.params.impactSec ?? event.time;
      const next = stings[i + 1];
      const gap = next ? (next.params.impactSec ?? next.time) - impact : 0.24;
      const start = impact - 0.001;
      const end = impact + Math.min(gap / 2, 0.12);
      return peakAbs(sfx.left, sfx.right, (start + end) / 2, (end - start) / 2, sampleRate);
    });
    const numbers: Record<string, number | string> = {
      density: round(density),
      centroidHz: round(centroid),
      brightnessHz: round(brightness),
      highShare: round(highShare),
      levelDb: round(level),
      bpm: round(bpm),
      mode,
    };
    let verdict: CueVerdict['verdict'] = 'pass';
    let suggestion = '';
    const fail = (text: string) => {
      verdict = 'fail';
      suggestion = text;
    };
    if (cue.type === 'sad' || cue.type === 'death') {
      const musicGap = cue.type === 'death' ? rmsDb(music.left, music.right, cue.t - 0.15, cue.t, sampleRate) : -120;
      const owned = plan.sections.find((item) => Math.abs(item.startSec - cue.t) < 1e-3) ?? section;
      const tempo = owned?.bpm ?? bpm;
      const half = previous ? tempo <= previous.bpm * DEATH_TEMPO_RATIO + 1e-6 : tempo <= SAD_TEMPO_MAX;
      numbers.bpm = round(tempo);
      numbers.musicGapDb = round(musicGap);
      const scaleName = owned?.key.scale ?? scale;
      if (mode !== 'minor' && scaleName !== 'minor') fail(`Section scale reads ${scaleName}, sad/death expects minor.`);
      else if (tempo > SAD_TEMPO_MAX && !half) fail(`Tempo reads ${tempo.toFixed(1)} bpm, sad expects <= ${SAD_TEMPO_MAX} or half of the previous section.`);
      else if (density > SAD_DENSITY_MAX) fail(`Density reads ${density.toFixed(2)} onsets/s, sad expects <= ${SAD_DENSITY_MAX}.`);
      else if (brightness > SAD_BRIGHTNESS_MAX_HZ) fail(`Brightness reads ${brightness.toFixed(0)} Hz, sad expects <= ${SAD_BRIGHTNESS_MAX_HZ}.`);
      else if (cue.type === 'death' && musicGap > DEATH_GAP_RMS_DB) fail(`Music RMS in the stop-time gap reads ${musicGap.toFixed(1)} dBFS, expected below ${DEATH_GAP_RMS_DB}.`);
      else if (cue.type === 'death' && peakAbs(sfx.left, sfx.right, cue.t, 0.02, sampleRate) < 0.01) fail('No measured SFX peak at the death cue.');
      else if (cue.type === 'death' && previous && !half) fail(`Following tempo ${tempo.toFixed(1)} is above ${DEATH_TEMPO_RATIO} of the previous ${previous.bpm.toFixed(1)}.`);
    } else if (cue.type === 'calm' || cue.type === 'talking') {
      if (density > CALM_DENSITY_MAX) fail(`Density reads ${density.toFixed(2)} onsets/s, calm expects <= ${CALM_DENSITY_MAX}.`);
      else if (level > loudest - CALM_LEVEL_BELOW_LOUDEST_DB) fail(`Level ${level.toFixed(1)} dB is not ${CALM_LEVEL_BELOW_LOUDEST_DB} dB under the loudest section ${loudest.toFixed(1)} dB.`);
      if (verdict === 'pass' && cue.type === 'talking') {
        const share = speechShare(slice(music.left, heardStart, heardEnd, sampleRate), slice(music.right, heardStart, heardEnd, sampleRate), sampleRate);
        numbers.speechShare = round(share);
        if (level > prevLevel - TALKING_BELOW_PREVIOUS_DB) fail(`Talking level ${level.toFixed(1)} dB is not ${TALKING_BELOW_PREVIOUS_DB} dB under the previous section ${prevLevel.toFixed(1)} dB.`);
        else if (share > TALKING_SPEECH_SHARE_MAX) fail(`Speech share reads ${share.toFixed(2)}, talking expects <= ${TALKING_SPEECH_SHARE_MAX}.`);
      }
    } else if (cue.type === 'hype' || cue.type === 'victory' || cue.type === 'clutch') {
      if (density < HYPE_DENSITY_MIN) fail(`Density reads ${density.toFixed(2)} onsets/s, hype expects >= ${HYPE_DENSITY_MIN}.`);
      else if (brightness < HYPE_BRIGHTNESS_MIN_HZ) fail(`Brightness reads ${brightness.toFixed(0)} Hz, hype expects >= ${HYPE_BRIGHTNESS_MIN_HZ}.`);
      else if (highShare < HIGH_BAND_SHARE_MIN) fail(`Power above 2 kHz reads ${highShare.toFixed(3)}, hype expects >= ${HIGH_BAND_SHARE_MIN}.`);
      else if (previous && previous.mood === 'lowkey' && level < prevLevel + HYPE_LEVEL_ABOVE_CALM_DB) {
        fail(`Level ${level.toFixed(1)} dB is under +${HYPE_LEVEL_ABOVE_CALM_DB} dB versus the previous calm ${prevLevel.toFixed(1)} dB.`);
      }
      if (verdict === 'pass' && cue.type === 'clutch') {
        const onset = nearestPeakMs(sfx.left, sfx.right, cue.t, sampleRate);
        const before = rmsDb(mix.left, mix.right, Math.max(0, cue.t - 1), cue.t, sampleRate);
        const hit = peakDb(mix.left, mix.right, cue.t, 0.05, sampleRate);
        if (Math.abs(onset) > HIT_TIME_MS) fail(`Measured peak is ${onset.toFixed(2)} ms from the cue, limit is ${HIT_TIME_MS} ms.`);
        else if (hit - before < HIT_LEVEL_STEP_DB) fail(`Level step reads ${(hit - before).toFixed(1)} dB, expected >= ${HIT_LEVEL_STEP_DB}.`);
      }
    } else if (cue.type === 'multikill') {
      const pitches = stings.map((event) => event.note ?? 0);
      numbers.stings = stings.length;
      if (stings.length !== (cue.count ?? 0)) fail(`Kill sting count reads ${stings.length}, sheet count is ${cue.count}.`);
      else if (pitches.some((note, i) => i > 0 && note <= pitches[i - 1])) fail('Kill sting pitches are not strictly ascending.');
      else if (stingPeaks.some((peak, i) => i > 0 && 20 * Math.log10(Math.max(peak, 1e-8)) < 20 * Math.log10(Math.max(stingPeaks[i - 1], 1e-8)) + KILL_STING_RISE_DB)) {
        const db = stingPeaks.map((peak) => (20 * Math.log10(Math.max(peak, 1e-8))).toFixed(2)).join(', ');
        fail(`Measured kill-sting peaks are not rising by ${KILL_STING_RISE_DB} dB (${db} dB).`);
      }
    } else if (cue.type === 'funny' || cue.type === 'fail') {
      const fall = plan.events.some((event) => event.cueIndex === index && (event.voice === 'sad_trombone' || event.voice === 'death_fall'));
      if (!(mode === 'major' || scale === 'majorPent' || fall)) fail(`Scale reads ${scale}. Funny/fail expects major, pentatonic, or a descending fall.`);
      else if (brightness < FUNNY_BRIGHTNESS_MIN_HZ) fail(`Brightness reads ${brightness.toFixed(0)} Hz, funny/fail expects >= ${FUNNY_BRIGHTNESS_MIN_HZ}.`);
      else if (highShare < HIGH_BAND_SHARE_MIN) fail(`Power above 2 kHz reads ${highShare.toFixed(3)}, funny/fail expects >= ${HIGH_BAND_SHARE_MIN}.`);
    } else if (cue.type === 'jumpscare' || cue.type === 'reveal') {
      const onset = nearestPeakMs(sfx.left, sfx.right, cue.t, sampleRate);
      const before = rmsDb(mix.left, mix.right, Math.max(0, cue.t - 1), cue.t, sampleRate);
      const hit = peakDb(mix.left, mix.right, cue.t, 0.05, sampleRate);
      numbers.onsetMs = round(onset);
      numbers.levelStepDb = round(hit - before);
      if (Math.abs(onset) > HIT_TIME_MS) fail(`Measured peak is ${onset.toFixed(2)} ms from the cue, limit is ${HIT_TIME_MS} ms.`);
      else if (hit - before < HIT_LEVEL_STEP_DB) fail(`Level step reads ${(hit - before).toFixed(1)} dB, expected >= ${HIT_LEVEL_STEP_DB}.`);
    } else if (cue.type === 'outro') {
      const late = rmsDb(mix.left, mix.right, Math.max(0, plan.videoLengthSeconds - OUTRO_TAIL_S), plan.videoLengthSeconds - OUTRO_TAIL_S / 2, sampleRate);
      const last = rmsDb(mix.left, mix.right, plan.videoLengthSeconds - OUTRO_TAIL_S / 2, plan.videoLengthSeconds, sampleRate);
      const sample = Math.abs(mix.left[mix.left.length - 1] ?? 0);
      if (!(last < late)) fail(`Last ${OUTRO_TAIL_S}s RMS is not decreasing (${late.toFixed(1)} then ${last.toFixed(1)} dB).`);
      else if (sample >= OUTRO_LAST_SAMPLE) fail(`Last sample magnitude reads ${sample.toExponential(2)}.`);
    }
    perCue.push({ index, type: cue.type, t: cue.t, duration, verdict, suggestion, numbers });
    const metrics = moodMetrics(plan, music, sampleRate, heardStart, heardEnd, bpm || 80, density, brightness || centroid || 1000);
    const expected = expectedMoodForCue(cue.type);
    const scored = scoreMood(metrics, expected, cue.type);
    moodByCue.push({
      cueIndex: index,
      type: cue.type,
      expectedMood: expected,
      best: scored.best,
      scores: scored.scores,
      pass: scored.pass,
      suggestions: scored.suggestions,
    });
  });
  return { perCue, moodByCue };
}

export function compactLoudness(
  mix: { left: Float32Array; right: Float32Array },
  sampleRate: number,
  plan: ScorePlan,
  fields: { integratedLufs: number; truePeakDbtp: number; shortTermMax: number; musicLufs: number; stemsGainDb: number; note: string; warnings: string[] },
): CompactLoudness {
  const heard = analyzeLoudness(mix.left, mix.right, sampleRate);
  const finite = (value: number) => (Number.isFinite(value) ? value : null);
  return {
    integratedLufs: finite(fields.integratedLufs),
    truePeakDbtp: finite(fields.truePeakDbtp),
    shortTermMax: finite(fields.shortTermMax),
    musicLufs: finite(fields.musicLufs),
    stemsGainDb: finite(fields.stemsGainDb),
    note: fields.note,
    warnings: fields.warnings,
    series: heard.series(3, 0.5).slice(0, 600),
    sectionLufs: plan.sections.map((section) => ({
      start: section.startSec,
      end: section.endSec,
      lufs: finite(heard.windowLufs(section.startSec * sampleRate, section.endSec * sampleRate)),
    })),
  };
}

export function serializeListenReport(report: ScoreListenReport): string {
  return JSON.stringify(jsonSafe(report));
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (ArrayBuffer.isView(value)) return null;
  if (Array.isArray(value)) return value.map((item) => jsonSafe(item));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) out[key] = jsonSafe((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

function moodMetrics(
  plan: ScorePlan,
  music: { left: Float32Array; right: Float32Array },
  sampleRate: number,
  start: number,
  end: number,
  bpm: number,
  density: number,
  centroid: number,
): MoodMetrics {
  const span = Math.max(0.05, end - start);
  const onsets = plan.events
    .filter((event) => event.bus !== 'sfx' && event.time >= start && event.time < end)
    .map((event) => event.time)
    .sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < onsets.length; i++) gaps.push(onsets[i] - onsets[i - 1]);
  const mean = gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 0;
  const variance = mean > 0 ? gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length : 0;
  const regularity = mean > 0 ? Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / mean)) : 0;
  const bars = (span * bpm) / 240;
  const notes = plan.events.filter((event) => event.bus !== 'sfx' && event.bus !== 'drums' && event.note !== undefined && event.time >= start && event.time < end).length;
  const movement = loudnessSeries(slice(music.left, start, end, sampleRate), slice(music.right, start, end, sampleRate), sampleRate).movement;
  return {
    bpm,
    synthNotesPerBar: bars > 0 ? notes / bars : notes,
    rhythmicDensity: density,
    centroidMedianHz: centroid,
    loudnessMovement: Number.isFinite(movement) ? movement : 0,
    rhythmRegularity: regularity,
  };
}

export function buildScoreListenReport(
  plan: ScorePlan,
  mixReport: CompactLoudness,
  perCue: CueVerdict[],
  moodByCue: MoodByCue[],
  sync: SyncReport['summary'],
  appVersion: string,
): ScoreListenReport {
  const markers = scoreMarkers(plan);
  const paragraph = [
    `${plan.name} is ${plan.videoLengthSeconds.toFixed(1)} s with ${plan.sections.length} sections and ${plan.cues.length} cues.`,
    `Integrated loudness reads ${(mixReport.integratedLufs ?? 0).toFixed(2)} LUFS, true peak ${(mixReport.truePeakDbtp ?? 0).toFixed(2)} dBTP, short-term max ${(mixReport.shortTermMax ?? 0).toFixed(2)} LUFS.`,
    `Sync pass reads ${sync.pass}. Max SFX error ${sync.maxSfxErrorMs.toFixed(3)} ms, boundary ${sync.maxBoundaryErrorMs.toFixed(3)} ms, onset ${sync.measuredOnsetMaxErrorMs.toFixed(3)} ms.`,
    `Cue verdicts: ${perCue.filter((cue) => cue.verdict === 'pass').length} pass, ${perCue.filter((cue) => cue.verdict === 'warn').length} warn, ${perCue.filter((cue) => cue.verdict === 'fail').length} fail.`,
    SENTENCE,
  ].join(' ');
  return {
    meta: { name: plan.name, seed: plan.seed, seconds: plan.videoLengthSeconds, sampleRate: plan.sampleRate, appVersion },
    plan: {
      sections: plan.sections.length,
      keys: plan.sections.map((section) => `${section.key.root}:${section.key.scale}`),
      tempoMap: plan.sections.map((section) => ({ startSec: section.startSec, endSec: section.endSec, bpm: section.bpm })),
    },
    loudness: mixReport,
    perCue,
    moodByCue,
    sync,
    englishParagraph: paragraph,
    markers,
  };
}

export function renderScoreListenMarkdown(report: ScoreListenReport): string {
  const lines = ['# Score listening report', '', report.englishParagraph, '', '## Cues', '', '| time | type | verdict | suggestion |', '| --- | --- | --- | --- |'];
  for (const cue of report.perCue) lines.push(`| ${cue.t.toFixed(2)} | ${cue.type} | ${cue.verdict} | ${cue.suggestion.replace(/\|/g, '/')} |`);
  lines.push('', '## Pictures', '', `${report.meta.name}.score.spectrogram.png`, `${report.meta.name}.score.loudness.png`, `${report.meta.name}.score.waveform.png`);
  return lines.join('\n');
}

export function scoreMarkers(plan: ScorePlan): PlotMarker[] {
  return plan.cues.map((cue) => ({
    t: cue.t,
    label: cue.label || cue.type,
    type: cue.type,
  }));
}

function windowDuration(plan: ScorePlan, index: number): number {
  const cue = plan.cues[index];
  if (cue.duration && cue.duration > 0) return Math.min(CUE_WINDOW_MAX_S, cue.duration);
  const behavior = CUE_BEHAVIOR[cue.type];
  let end = plan.videoLengthSeconds;
  if (behavior.cueClass === 'hard') {
    const next = plan.sections.find((section) => section.startSec > cue.t + 1e-4);
    if (next) end = next.startSec;
  }
  return Math.min(CUE_WINDOW_MAX_S, Math.max(0.2, end - cue.t));
}

function musicDensity(plan: ScorePlan, start: number, end: number): number {
  const span = Math.max(1e-6, end - start);
  const count = plan.events.filter((event) => event.bus !== 'sfx' && event.time >= start && event.time < end).length;
  return count / span;
}

function previousMetered(plan: ScorePlan, start: number) {
  const prior = plan.sections.filter((section) => section.endSec <= start + 1e-4 && !section.freeTime && section.bpm > 0);
  return prior.length ? prior[prior.length - 1] : null;
}

function slice(buffer: Float32Array, start: number, end: number, sampleRate: number): Float32Array {
  const a = Math.max(0, Math.round(start * sampleRate));
  const b = Math.min(buffer.length, Math.max(a + 1, Math.round(end * sampleRate)));
  return buffer.subarray(a, b);
}

function rmsDb(left: Float32Array, right: Float32Array, start: number, end: number, sampleRate: number): number {
  const a = Math.max(0, Math.round(start * sampleRate));
  const b = Math.min(left.length, Math.round(end * sampleRate));
  if (b <= a) return -120;
  let sum = 0;
  for (let i = a; i < b; i++) sum += left[i] * left[i] + right[i] * right[i];
  const mean = sum / (b - a);
  if (!(mean > 0)) return -120;
  return 10 * Math.log10(mean);
}

function peakAbs(left: Float32Array, right: Float32Array, time: number, radius: number, sampleRate: number): number {
  const a = Math.max(0, Math.round((time - radius) * sampleRate));
  const b = Math.min(left.length, Math.round((time + radius) * sampleRate));
  let peak = 0;
  for (let i = a; i < b; i++) {
    const l = left[i] < 0 ? -left[i] : left[i];
    const r = right[i] < 0 ? -right[i] : right[i];
    if (l > peak) peak = l;
    if (r > peak) peak = r;
  }
  return peak;
}

function peakDb(left: Float32Array, right: Float32Array, time: number, radius: number, sampleRate: number): number {
  const peak = peakAbs(left, right, time, radius, sampleRate);
  if (!(peak > 0)) return -120;
  return 20 * Math.log10(peak);
}

function nearestPeakMs(left: Float32Array, right: Float32Array, time: number, sampleRate: number): number {
  return measuredOnsetErrorMs(left, right, sampleRate, Math.round(time * sampleRate));
}

function speechShare(left: Float32Array, right: Float32Array, sampleRate: number): number {
  if (left.length < 32) return 0;
  const power = averagePower(left, right, sampleRate);
  return bandShares(power, sampleRate).speech.fraction;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
