/**
 * Pitch tonal voice/melody samples toward the project key.
 * Samples without a tonal `root` are left untouched.
 */

import { isInScale } from '../model/scales';
import type { Scale } from '../model/types';

const NOTE_RE = /^([A-Ga-g])([#b]?)(-?\d+)$/;

const NAME_TO_PC: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

/** Parse "A3", "C#4", or a MIDI number into MIDI. */
export function parseRootToMidi(root: string | number): number | null {
  if (typeof root === 'number') {
    if (!Number.isFinite(root)) return null;
    return Math.round(root);
  }
  const text = String(root).trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  const m = text.match(NOTE_RE);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const acc = m[2];
  const octave = Number(m[3]);
  const key = `${letter}${acc}`;
  const pc = NAME_TO_PC[key];
  if (pc === undefined || !Number.isFinite(octave)) return null;
  return (octave + 1) * 12 + pc;
}

/**
 * Semitone shift so the sample's sounding pitch lands on the nearest in-scale
 * pitch within ±6 semis of the sample root. Returns 0 when none / already in key.
 */
export function pitchSemisToKey(sampleRootMidi: number, keyRoot: number, scale: Scale): number {
  const target = Math.round(sampleRootMidi);
  if (isInScale(target, keyRoot, scale)) return 0;
  let bestShift = 0;
  let bestDist = 99;
  for (let shift = -6; shift <= 6; shift++) {
    const midi = target + shift;
    if (!isInScale(midi, keyRoot, scale)) continue;
    const dist = Math.abs(shift);
    if (dist < bestDist || (dist === bestDist && Math.abs(shift) < Math.abs(bestShift))) {
      bestDist = dist;
      bestShift = shift;
    }
  }
  return bestShift === 0 && bestDist === 99 ? 0 : bestShift;
}

/** Playback rate for a given semitone shift. */
export function rateForSemis(semis: number): number {
  return 2 ** (semis / 12);
}
