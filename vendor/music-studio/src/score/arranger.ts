import { mulberry32 } from '../model/rng';
import { SCALE_INTERVALS, mod12, snapToScale } from '../model/scales';
import type { Scale } from '../model/types';
import type { Cue, CueSheet, CueType, SfxName } from './cues';
import { validateCueSheet } from './cues';
import { CHORD_DEGREES, CUE_BEHAVIOR, chordKindFor, type SectionMood } from './mapping';
import type { AccentPlan, DuckRegion, MuteRegion, ScoreEvent, ScoreParams, ScorePlan, ScoreSection } from './plan';
import { killStingAmp, peakOffsetSeconds } from '../audio/sfx/peakTable';
import { baseBpmFor, boundaryTimes, chooseMeter, eighthStep, snapTime } from './tempo';
import {
  CLUTCH_STOP_S,
  DEATH_MUTE_LEAD_S,
  DEFAULT_DUCK_DB,
  DEFAULT_END_FADE_MS,
  DEFAULT_KEY_ROOT,
  DEFAULT_SPEECH_DIP_DB,
  JUMPSCARE_SILENCE_S,
  LEVEL_OFFSET_DB,
  MULTIKILL_DEFAULT_GAP_S,
  MULTIKILL_MIN_GAP_S,
  SAMPLE_RATE,
  SFX_DUCK_ATTACK_MS,
  SFX_DUCK_RELEASE_MS,
  TALKING_ATTACK_MS,
  TALKING_RELEASE_MS,
} from './targets';

/** Cue "layer" hints that switch sample-track slots are not supported yet. */
export interface PlanOptions {
  seed?: number;
  sampleRate?: number;
  endFadeMs?: number;
  duckDb?: number;
  speechDipDb?: number;
  style?: string;
}

export function impactOffsetFor(name: SfxName, duration: number): number {
  return peakOffsetSeconds(name, duration);
}

function hashStyle(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i) * (i + 1)) | 0;
  return hash;
}

function styleLeadVoice(id: string): string {
  if (id === 'chiptune_bounce') return 'pulse';
  if (id === 'epic_cinematic') return 'strings';
  if (id === 'funky') return 'brass';
  if (id === 'ambient_calm') return 'bell';
  if (id === 'lofi_chill' || id === 'playful_pizzicato') return 'pizz';
  if (id === 'retro_synthwave') return 'pluck';
  return 'lead';
}

function midiAt(root: number, scale: Scale, degree: number, octave: number): number {
  const steps = SCALE_INTERVALS[scale];
  const width = steps.length;
  const wrapped = ((degree % width) + width) % width;
  const octaves = Math.floor(degree / width);
  const midi = octave * 12 + mod12(root) + steps[wrapped] + octaves * 12;
  return snapToScale(midi, root, scale);
}

function levelDbFor(type: CueType | null, intensity: number): number {
  const calmish = type === 'calm' || type === 'talking' || type === 'outro' || type === 'sad' || type === 'death';
  const hot = type === 'hype' || type === 'victory' || type === 'multikill' || type === 'clutch' || type === 'jumpscare' || type === 'reveal';
  const span = calmish ? LEVEL_OFFSET_DB.calm : hot ? LEVEL_OFFSET_DB.hype : null;
  if (!span) return 0;
  return span[0] + intensity * (span[1] - span[0]);
}

function sheetOrThrow(input: CueSheet): CueSheet {
  const validated = validateCueSheet(input);
  if (!validated.ok || !validated.sheet) {
    throw new Error(validated.warnings[0] ?? 'Invalid cue sheet');
  }
  return validated.sheet;
}

export function planScore(input: CueSheet, options: PlanOptions = {}): ScorePlan {
  const sheet = sheetOrThrow(input);
  const seed = (options.seed ?? 1) >>> 0;
  const styleId = options.style || sheet.video.style || (typeof sheet.options?.style === 'string' ? sheet.options.style : '');
  const styleShift = styleId ? Math.max(1, Math.abs(hashStyle(styleId)) % 5) : 0;
  const styleLead = styleLeadVoice(styleId);
  const sampleRate = options.sampleRate ?? SAMPLE_RATE;
  const rng = mulberry32(seed === 0 ? 1 : seed);
  const length = sheet.video.lengthSeconds;
  const locked = sheet.video.bpm && sheet.video.bpm > 0 ? sheet.video.bpm : null;
  const duckDb = options.duckDb ?? DEFAULT_DUCK_DB;
  const events: ScoreEvent[] = [];
  const accents: AccentPlan[] = [];
  const duckRegions: DuckRegion[] = [];
  const muteRegions: MuteRegion[] = [];
  let serial = 1;

  const nextId = () => `e${serial++}`;

  const boundaries = boundaryTimes(sheet);
  const sections: ScoreSection[] = [];
  let root = DEFAULT_KEY_ROOT;
  let scale: Scale = 'minor';
  let previousBpm: number | null = null;

  for (let i = 0; i < boundaries.length - 1; i++) {
    const startSec = boundaries[i];
    const endSec = boundaries[i + 1];
    if (endSec - startSec < 1e-4) continue;
    const cueIndex = latestHardCue(sheet, startSec);
    const cue = cueIndex === null ? null : sheet.cues[cueIndex];
    const behavior = cue ? CUE_BEHAVIOR[cue.type] : CUE_BEHAVIOR.calm;
    const mood: SectionMood = behavior.mood;
    if (behavior.scale === 'dorian') scale = seed % 2 === 0 ? 'dorian' : 'minorPent';
    else if (behavior.scale === 'phrygian') scale = 'phrygian';
    else if (behavior.scale === 'minor') scale = 'minor';
    else if (behavior.scale === 'major') scale = 'major';
    else if (behavior.scale === 'majorPent') scale = 'majorPent';
    else if (behavior.scale === 'down2') {
      root = mod12(root - 2);
      scale = 'minor';
    } else if (behavior.scale === 'relativeMajor') {
      root = mod12(root + 3);
      scale = 'major';
    } else if (behavior.scale === 'home') {
      root = DEFAULT_KEY_ROOT;
      scale = 'minor';
    }
    const tempoBase = baseBpmFor(mood, previousBpm);
    const duration = endSec - startSec;
    const meter = locked
      ? {
          bpm: locked,
          beats: (duration * locked) / 60,
          freeTime: duration < (2 * 60) / locked,
        }
      : chooseMeter(duration, tempoBase.base, tempoBase.cap);
    const section: ScoreSection = {
      index: sections.length,
      startSec,
      endSec,
      bpm: meter.bpm,
      beats: meter.beats,
      baseBpm: tempoBase.base,
      freeTime: meter.freeTime,
      key: { root, scale },
      mood,
      cueIndex,
      cueType: cue?.type ?? null,
      levelDb: levelDbFor(cue?.type ?? 'calm', cue?.intensity ?? 0.4),
      swing: behavior.swing ?? 0,
      ...(styleId ? { styleId } : {}),
    };
    sections.push(section);
    if (!section.freeTime && section.bpm > 0) previousBpm = section.bpm;
  }

  for (const cue of sheet.cues) {
    if (cue.type === 'death') muteRegions.push({ start: cue.t - DEATH_MUTE_LEAD_S, end: cue.t, reason: 'death' });
    if (cue.type === 'jumpscare') muteRegions.push({ start: cue.t - JUMPSCARE_SILENCE_S, end: cue.t, reason: 'jumpscare' });
    if (cue.type === 'clutch') muteRegions.push({ start: cue.t - CLUTCH_STOP_S, end: cue.t, reason: 'clutch' });
    if (cue.type === 'build') {
      const landing = Math.min(length, cue.t + (cue.duration ?? 2));
      const section = sectionAt(sections, landing - 0.001);
      const bpm = section && section.bpm > 0 ? section.bpm : 120;
      const sixteenth = 60 / bpm / 4;
      muteRegions.push({ start: landing - sixteenth, end: landing, reason: 'build' });
    }
    if (cue.type === 'talking') {
      const end = Math.min(length, cue.t + (cue.duration ?? 0));
      if (end > cue.t) {
        duckRegions.push({
          start: cue.t,
          end,
          depthDb: duckDb,
          attackMs: TALKING_ATTACK_MS,
          releaseMs: TALKING_RELEASE_MS,
          kind: 'talking',
        });
      }
    }
  }

  const talkingAt = (time: number) => duckRegions.some((region) => region.kind === 'talking' && time >= region.start && time < region.end);
  const blocked = (time: number) => muteRegions.some((region) => time >= region.start && time < region.end);

  function pushMusic(partial: Omit<ScoreEvent, 'id' | 'params' | 'vel'> & { vel?: number; params?: ScoreParams; note?: number }): void {
    if (partial.time < -1e-6 || partial.time >= length) return;
    if (blocked(partial.time)) return;
    const section = sectionAt(sections, partial.time);
    const levelDb = section?.levelDb ?? 0;
    events.push({
      ...partial,
      id: nextId(),
      vel: partial.vel ?? 0.6,
      duration: Math.max(0.02, partial.duration),
      params: { levelDb, ...(partial.params ?? {}) },
    });
  }

  function placeSfx(cue: Cue, cueIndex: number, name: SfxName, impactSec: number, duration: number, vel: number, note?: number, extra?: ScoreParams): void {
    const offset = impactOffsetFor(name, duration);
    const impactSample = Math.max(0, Math.round(Math.min(length, impactSec) * sampleRate));
    let offsetSamples = Math.round(offset * sampleRate);
    let startSample = impactSample - offsetSamples;
    let preRollShortened = false;
    if (startSample < 0) {
      preRollShortened = true;
      startSample = 0;
      offsetSamples = impactSample;
    }
    const host = sectionAt(sections, Math.min(length - 0.001, startSample / sampleRate));
    const pitched = note !== undefined && host ? snapToScale(note, host.key.root, host.key.scale) : note;
    const event: ScoreEvent = {
      id: nextId(),
      bus: 'sfx',
      voice: name,
      time: startSample / sampleRate,
      duration: Math.max(0.02, offsetSamples > 0 && preRollShortened ? offsetSamples / sampleRate : duration),
      vel,
      note: pitched,
      params: {
        impactSec: impactSample / sampleRate,
        brightness: cue.intensity,
        role: name,
        ...(extra ?? {}),
      },
      cueIndex,
      impactOffset: offsetSamples / sampleRate,
      preRollShortened,
    };
    events.push(event);
    if (name === 'impact' || name === 'kill_sting' || name === 'jumpscare_hit' || name === 'sub_drop' || name.startsWith('stinger')) {
      const depth = -3 - cue.intensity * 5;
      duckRegions.push({
        start: event.params.impactSec ?? impactSec,
        end: (event.params.impactSec ?? impactSec) + 0.12,
        depthDb: Math.max(-8, Math.min(-3, depth)),
        attackMs: SFX_DUCK_ATTACK_MS,
        releaseMs: SFX_DUCK_RELEASE_MS,
        kind: 'sfx',
      });
    }
  }

  for (const section of sections) {
    const key = section.key;
    const kind = chordKindFor(key.scale, section.mood);
    const degrees = CHORD_DEGREES[kind];
    if (section.freeTime || !(section.bpm > 0)) {
      pushMusic({
        bus: 'harmony',
        voice: 'pad',
        time: section.startSec,
        duration: Math.max(0.2, section.endSec - section.startSec),
        note: midiAt(key.root, key.scale, 0, 4),
        vel: 0.35,
        cueIndex: section.cueIndex ?? undefined,
        params: { role: 'freetime-pad', brightness: 0.2 },
      });
      placeHeldStinger(section);
      continue;
    }
    const step = eighthStep(section.bpm);
    const origin = locked ? 0 : section.startSec;
    const times = gridTimes(section.startSec, section.endSec, step, origin);
    const barBeats = 4;
    times.forEach((time, index) => {
      const local = (time - (locked ? 0 : section.startSec)) / step;
      const eighth = Math.round(local);
      const swung = section.swing > 0 && eighth % 2 === 1 ? Math.min(section.endSec - 0.03, time + section.swing * step * 0.5) : time;
      const beat = eighth / 2;
      const inTalk = talkingAt(swung);
      const bright = section.mood === 'hype' || section.mood === 'victory' ? 0.95 : section.mood === 'playful' ? 0.85 : 0.25;
      if (inTalk) {
        if (eighth % 8 === 0) {
          pushMusic({ bus: 'harmony', voice: 'pad', time: swung, duration: step * 8, note: midiAt(key.root, key.scale, 0, 2), vel: 0.22, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.04, role: 'talk-drone' } });
          pushMusic({ bus: 'harmony', voice: 'pad', time: swung, duration: step * 8, note: midiAt(key.root, key.scale, 4, 2), vel: 0.16, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.04, role: 'talk-fifth' } });
          pushMusic({ bus: 'melody', voice: 'bell', time: swung, duration: step * 2, note: midiAt(key.root, key.scale, 0, 8), vel: 0.04, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.9, role: 'talk-air' } });
        }
      } else if (section.mood === 'hype' || section.mood === 'victory' || section.cueType === 'multikill' || section.cueType === 'clutch') {
        if (Math.abs(swung - section.startSec) < step * 0.6 && eighth % 2 === 0) {
          pushMusic({ bus: 'drums', voice: 'crash', time: section.startSec, duration: 0.4, vel: 0.4, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.95, role: 'crash' } });
        }
        if (Math.abs(beat - Math.round(beat)) < 1e-6) {
          pushMusic({ bus: 'drums', voice: 'kick', time: swung, duration: 0.12, vel: 0.28, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.25, role: 'kick' } });
          pushMusic({ bus: 'bass', voice: 'bass808', time: swung, duration: step * 1.4, note: midiAt(key.root, key.scale, 0, 3), vel: 0.16, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.55 } });
          pushMusic({ bus: 'harmony', voice: 'brass', time: swung, duration: step * 0.5, note: midiAt(key.root, key.scale, degrees[Math.floor(beat) % degrees.length], 5), vel: 0.34, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.9 } });
        }
        if (eighth % 4 === 2) {
          pushMusic({ bus: 'drums', voice: 'clap', time: swung, duration: 0.12, vel: 0.4, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.8 } });
        }
        pushMusic({ bus: 'drums', voice: 'hat', time: swung, duration: 0.04, vel: 0.55, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.95, role: 'hat' } });
        if (!locked) {
          pushMusic({ bus: 'drums', voice: 'hat', time: Math.min(section.endSec - 0.02, swung + step * 0.5), duration: 0.03, vel: 0.22, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.95, role: 'hat' } });
        }
        const degree = degrees[Math.floor(eighth) % degrees.length] + (Math.floor(rng() * 3) - 1) + (section.cueType === 'sad' || section.cueType === 'death' ? 0 : styleShift);
        pushMusic({ bus: 'melody', voice: section.cueType === 'sad' || section.cueType === 'death' ? 'lead' : styleLead, time: swung, duration: step * 0.45, note: midiAt(key.root, key.scale, degree, eighth % 4 < 2 ? 6 : 5), vel: 0.42, cueIndex: section.cueIndex ?? undefined, params: { brightness: bright } });
      } else if (section.mood === 'tension') {
        if (eighth % 8 === 0) {
          pushMusic({ bus: 'drums', voice: 'kick', time: swung, duration: 0.2, vel: 0.4, cueIndex: section.cueIndex ?? undefined, params: { role: 'heartbeat', brightness: 0.15 } });
        }
        if (eighth % 4 === 0) {
          pushMusic({ bus: 'bass', voice: 'bass', time: swung, duration: step * 3, note: midiAt(key.root, key.scale, eighth % 8 === 0 ? 0 : 1, 2), vel: 0.4, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.1 } });
        }
      } else if (section.mood === 'sad' || section.cueType === 'death') {
        if (eighth % 8 === 0) {
          pushMusic({ bus: 'harmony', voice: 'pad', time: swung, duration: step * 8, note: midiAt(key.root, key.scale, degrees[Math.floor(beat / barBeats) % degrees.length], 3), vel: 0.32, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.12 } });
          pushMusic({ bus: 'melody', voice: 'bell', time: swung, duration: step * 4, note: midiAt(key.root, key.scale, 0, 4), vel: 0.22, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.2 } });
        }
      } else if (section.mood === 'playful') {
        if (eighth % 4 === 0) {
          pushMusic({ bus: 'bass', voice: 'pickBass', time: swung, duration: step * 1.2, note: midiAt(key.root, key.scale, 0, 3), vel: 0.28, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.6 } });
        }
        if (eighth % 2 === 0) {
          const choice = [0, 2, 4][Math.floor(rng() * 3)] + styleShift;
          pushMusic({ bus: 'melody', voice: 'pluck', time: swung, duration: step * 0.6, note: midiAt(key.root, key.scale, choice, 6), vel: 0.4, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.95 } });
          pushMusic({ bus: 'melody', voice: 'lead', time: swung, duration: step * 0.25, note: midiAt(key.root, key.scale, choice, 7), vel: 0.22, cueIndex: section.cueIndex ?? undefined, params: { brightness: 1, role: 'bleep' } });
        }
        if (eighth % 4 === 2) {
          pushMusic({ bus: 'drums', voice: 'hat', time: swung, duration: 0.04, vel: 0.18, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.9, role: 'hat' } });
        }
      } else {
        if (eighth % 8 === 0 && !inTalk) {
          pushMusic({ bus: 'drums', voice: 'kick', time: swung, duration: 0.16, vel: 0.28, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.1, role: 'kick' } });
        }
        if (eighth % 4 === 0) {
          const degree = degrees[Math.floor(eighth / 4) % degrees.length];
          pushMusic({ bus: 'harmony', voice: 'pad', time: swung, duration: step * 4, note: midiAt(key.root, key.scale, degree, section.cueType === 'outro' ? 3 : 4), vel: 0.3, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.18 } });
        }
        if (eighth % 4 === 2 && !inTalk) {
          const choice = [0, 2, 4][Math.floor(rng() * 3)];
          pushMusic({ bus: 'melody', voice: 'pluck', time: swung, duration: step * 1.5, note: midiAt(key.root, key.scale, choice, 5), vel: 0.26, cueIndex: section.cueIndex ?? undefined, params: { brightness: 0.35 } });
        }
      }
      void index;
    });

    if (section.cueType === 'outro') {
      events.forEach((event) => {
        if (event.bus === 'sfx' || event.time < section.startSec || event.time >= section.endSec) return;
        const end = event.time + event.duration;
        if (end > section.endSec) event.duration = Math.max(0.02, section.endSec - event.time);
      });
      pushMusic({
        bus: 'harmony',
        voice: 'pad',
        time: section.startSec,
        duration: section.endSec - section.startSec,
        note: midiAt(key.root, key.scale, 0, 3),
        vel: 0.34,
        cueIndex: section.cueIndex ?? undefined,
        params: { role: 'final-chord', brightness: 0.15 },
      });
    }
  }

  sheet.cues.forEach((cue, cueIndex) => {
    const behavior = CUE_BEHAVIOR[cue.type];
    const section = sectionAt(sections, Math.min(length - 0.001, cue.t));
    const key = section?.key ?? { root: DEFAULT_KEY_ROOT, scale: 'minor' as Scale };
    if (cue.type === 'multikill') {
      const count = cue.count ?? 3;
      let gap = cue.duration && count > 1 ? cue.duration / (count - 1) : MULTIKILL_DEFAULT_GAP_S;
      if (gap < MULTIKILL_MIN_GAP_S) gap = MULTIKILL_MIN_GAP_S;
      let degree = 2;
      for (let i = 0; i < count; i++) {
        const when = Math.min(length, cue.t + i * gap);
        const note = midiAt(key.root, key.scale, degree, 5);
        degree += 2;
        const stingAmp = killStingAmp(i, count, cue.intensity);
        placeSfx(cue, cueIndex, 'kill_sting', when, 0.16, stingAmp, note, { index: i, pitch: note });
        placeSfx(cue, cueIndex, 'combo_tick', when + 0.015, 0.08, stingAmp * 0.3, note + 12, { index: i });
        if (i === count - 1) {
          placeSfx(cue, cueIndex, 'impact', when, 0.4, 0.9, midiAt(key.root, key.scale, 0, 2), { role: 'boom', index: i });
          pushMusic({ bus: 'drums', voice: 'crash', time: when, duration: 0.7, vel: 0.7, cueIndex, params: { role: 'crash', brightness: 0.8 } });
        }
      }
    }
    if (cue.type === 'kill' && section && section.bpm > 0) {
      const snapped = snapTime(cue.t, section.bpm, sampleRate);
      const status = snapped.errorMs > 20 ? 'skipped' : 'ok';
      accents.push({ cueIndex, snappedSec: snapped.time, errorMs: snapped.errorMs, status });
      if (status === 'ok') {
        pushMusic({
          bus: 'melody',
          voice: 'brass',
          time: snapped.time,
          duration: 0.18,
          note: midiAt(key.root, key.scale, 4, 5),
          vel: 0.7,
          cueIndex,
          params: { role: 'accent', brightness: 0.6 },
        });
      }
    }
    if (cue.type === 'sfx' && cue.sfx) {
      placeSfx(cue, cueIndex, cue.sfx, cue.t, 0.5, 0.5 + cue.intensity * 0.4);
    }
    if (cue.type === 'transition') {
      const previous = sheet.cues[cueIndex - 1];
      const up = !previous || cue.intensity >= previous.intensity;
      const name: SfxName = up ? 'whoosh_up' : 'whoosh_down';
      placeSfx(cue, cueIndex, name, cue.t, 0.55, 0.45 + cue.intensity * 0.3);
    }
    for (const recipe of behavior.sfx) {
      const duration = recipe.duration ?? 0.4;
      const impact = recipe.at === 'end' ? Math.min(length, cue.t + (cue.duration ?? duration)) : cue.t;
      placeSfx(cue, cueIndex, recipe.name, impact, duration, 0.45 + cue.intensity * 0.4, recipe.pitch);
    }
    if (section && sections[section.index - 1] && section.key.root !== sections[section.index - 1].key.root) {
      const prev = sections[section.index - 1];
      if (prev.bpm > 0) {
        const beat = 60 / prev.bpm;
        pushMusic({
          bus: 'harmony',
          voice: 'pad',
          time: Math.max(prev.startSec, section.startSec - beat),
          duration: Math.min(beat, section.startSec - prev.startSec),
          note: midiAt(prev.key.root, prev.key.scale, 4, 4),
          vel: 0.3,
          cueIndex: section.cueIndex ?? undefined,
          params: { role: 'dominant', brightness: 0.4 },
        });
      }
    }
  });

  const jump = (left: ScoreSection, right: ScoreSection) => {
    if (!(left.bpm > 0) || !(right.bpm > 0)) return false;
    const ratio = right.bpm / left.bpm;
    return ratio > 1.35 || ratio < 1 / 1.35;
  };
  for (let i = 1; i < sections.length; i++) {
    if (!jump(sections[i - 1], sections[i])) continue;
    const beat = sections[i - 1].bpm > 0 ? 60 / sections[i - 1].bpm : 0.4;
    const start = Math.max(sections[i - 1].startSec, sections[i].startSec - beat);
    const peakAt = Math.max(sections[i - 1].startSec, sections[i].startSec - 0.2);
    placeSfx(
      { t: peakAt, type: 'transition', intensity: 0.6 },
      sections[i].cueIndex ?? 0,
      'riser',
      peakAt,
      Math.max(0.2, peakAt - start),
      0.4,
    );
  }

  function placeHeldStinger(section: ScoreSection): void {
    const cue = section.cueIndex === null ? null : sheet.cues[section.cueIndex];
    if (!cue) return;
    placeSfx(cue, section.cueIndex ?? 0, 'stinger_a', section.startSec, 0.4, 0.5, midiAt(section.key.root, section.key.scale, 0, 5));
  }

  const outro = [...sections].reverse().find((section) => section.cueType === 'outro');
  let musicSnapMaxMs = 0;
  if (locked) {
    for (const event of events) {
      if (event.bus === 'sfx') continue;
      const snapped = snapTime(event.time, locked, sampleRate);
      const errorMs = Math.abs(snapped.time - event.time) * 1000;
      if (errorMs > musicSnapMaxMs) musicSnapMaxMs = errorMs;
    }
  }
  return {
    seed,
    sampleRate,
    videoLengthSeconds: length,
    fps: sheet.video.fps ?? 30,
    name: sheet.video.name ?? 'score',
    lockedBpm: locked,
    endFadeMs: options.endFadeMs ?? DEFAULT_END_FADE_MS,
    duckDb,
    speechDipDb: options.speechDipDb ?? DEFAULT_SPEECH_DIP_DB,
    outroFadeSec: outro ? 2 : 0,
    sections,
    events,
    duckRegions,
    muteRegions,
    accents,
    cues: sheet.cues,
    sheet,
    musicSnapMaxMs,
  };
}

function latestHardCue(sheet: CueSheet, time: number): number | null {
  let found: number | null = null;
  sheet.cues.forEach((cue, index) => {
    if (CUE_BEHAVIOR[cue.type].cueClass !== 'hard') return;
    if (cue.t <= time + 1e-4) found = index;
  });
  return found;
}

function sectionAt(sections: ScoreSection[], time: number): ScoreSection | null {
  for (const section of sections) {
    if (time >= section.startSec - 1e-6 && time < section.endSec - 1e-9) return section;
  }
  return sections.length ? sections[sections.length - 1] : null;
}

function gridTimes(start: number, end: number, step: number, origin: number): number[] {
  if (!(step > 0)) return [];
  const times: number[] = [];
  let k = Math.ceil((start - origin) / step - 1e-9);
  for (let guard = 0; guard < 100000; guard++) {
    const time = origin + k * step;
    if (time >= end - 1e-4) break;
    if (time >= start - 1e-6) times.push(time);
    k += 1;
  }
  return times;
}
