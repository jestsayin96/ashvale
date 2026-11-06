import type { CueSheet } from './cues';
import { CUE_BEHAVIOR } from './mapping';
import type { ScoreSection } from './plan';
import {
  MIN_BEATS,
  MOOD_BASE_BPM,
  SAMPLE_RATE,
  SNAP_DIVISION,
  TEMPO_FACTOR_HI,
  TEMPO_FACTOR_LO,
} from './targets';

export interface Meter {
  bpm: number;
  beats: number;
  freeTime: boolean;
}

/** Integer beat count so bpm = 60*N/duration stays near baseBpm. */
export function chooseMeter(duration: number, baseBpm: number, capBpm?: number): Meter {
  if (!(duration > 0) || !(baseBpm > 0)) return { bpm: 0, beats: 0, freeTime: true };
  const lo = TEMPO_FACTOR_LO * baseBpm;
  const hi = Math.min(TEMPO_FACTOR_HI * baseBpm, capBpm ?? Number.POSITIVE_INFINITY);
  if (!(hi >= lo)) return { bpm: 0, beats: 0, freeTime: true };
  const twoBeatsAtMin = (MIN_BEATS * 60) / lo;
  if (duration < twoBeatsAtMin - 1e-9) return { bpm: 0, beats: 0, freeTime: true };
  const nLo = Math.max(MIN_BEATS, Math.ceil((duration * lo) / 60 - 1e-9));
  const nHi = Math.floor((duration * hi) / 60 + 1e-9);
  if (nHi < nLo) return { bpm: 0, beats: 0, freeTime: true };
  const ideal = (duration * baseBpm) / 60;
  let beats = Math.round(ideal);
  if (beats < nLo) beats = nLo;
  if (beats > nHi) beats = nHi;
  return { bpm: (60 * beats) / duration, beats, freeTime: false };
}

export function eighthStep(bpm: number): number {
  return (60 / bpm) * (4 / SNAP_DIVISION);
}

/**
 * Nearest 1/8-beat. An exact midpoint moves one sample earlier so the
 * error stays under half a subdivision (under 1/16 of a beat).
 */
export function snapTime(time: number, bpm: number, sampleRate = SAMPLE_RATE): { time: number; errorMs: number } {
  if (!(bpm > 0)) return { time, errorMs: 0 };
  const step = eighthStep(bpm);
  const stepSamples = Math.max(1, Math.round(step * sampleRate));
  const tSample = Math.round(time * sampleRate);
  let q = Math.round(tSample / stepSamples);
  let nearest = q * stepSamples;
  let error = Math.abs(nearest - tSample);
  if (error * 2 === stepSamples) {
    nearest -= 1;
    error = Math.abs(nearest - tSample);
  }
  if (nearest < 0) nearest = 0;
  return { time: nearest / sampleRate, errorMs: (error / sampleRate) * 1000 };
}

export function beatSample(section: Pick<ScoreSection, 'startSec' | 'endSec' | 'beats' | 'freeTime'>, beatIndex: number, sampleRate = SAMPLE_RATE): number {
  const s0 = Math.round(section.startSec * sampleRate);
  const s1 = Math.round(section.endSec * sampleRate);
  if (section.freeTime || section.beats <= 0) return s0;
  return s0 + Math.round((beatIndex * (s1 - s0)) / section.beats);
}

export function boundaryErrorSamples(section: Pick<ScoreSection, 'startSec' | 'endSec' | 'beats' | 'freeTime'>, sampleRate = SAMPLE_RATE): number {
  if (section.freeTime || section.beats <= 0) return 0;
  const s1 = Math.round(section.endSec * sampleRate);
  return Math.abs(beatSample(section, section.beats, sampleRate) - s1);
}

export function baseBpmFor(mood: string, previousBpm: number | null): { base: number; cap?: number } {
  if (mood === 'sad') {
    const prev = previousBpm && previousBpm > 0 ? previousBpm : MOOD_BASE_BPM.lowkey;
    return { base: prev * 0.5, cap: prev * 0.6 };
  }
  if (mood === 'hype') return { base: MOOD_BASE_BPM.hype };
  if (mood === 'playful') return { base: MOOD_BASE_BPM.playful };
  if (mood === 'tension') return { base: MOOD_BASE_BPM.tension };
  if (mood === 'victory') return { base: MOOD_BASE_BPM.victory };
  return { base: MOOD_BASE_BPM.lowkey };
}

/** Hard-cue times plus the end of each build, the start, and the video end. */
export function boundaryTimes(sheet: CueSheet): number[] {
  const length = sheet.video.lengthSeconds;
  const raw = [0, length];
  sheet.cues.forEach((cue) => {
    const behavior = CUE_BEHAVIOR[cue.type];
    if (behavior.cueClass === 'hard') raw.push(Math.max(0, Math.min(length, cue.t)));
    if (behavior.boundaryAtEnd) {
      const end = cue.t + (cue.duration ?? 2);
      raw.push(Math.max(0, Math.min(length, end)));
    }
  });
  raw.sort((a, b) => a - b);
  const unique: number[] = [];
  for (const time of raw) {
    if (unique.length === 0 || Math.abs(time - unique[unique.length - 1]) > 1e-4) unique.push(time);
  }
  return unique;
}
