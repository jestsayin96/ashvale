import type { Scale } from './types';

export const SCALE_INTERVALS: Record<Scale, readonly number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  minorPent: [0, 3, 5, 7, 10],
  majorPent: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export const SCALE_LABELS: Record<Scale, string> = {
  minor: 'Minor',
  major: 'Major',
  minorPent: 'Minor pentatonic',
  majorPent: 'Major pentatonic',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  mixolydian: 'Mixolydian',
  lydian: 'Lydian',
  harmonicMinor: 'Harmonic minor',
};

export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function isInScale(midi: number, root: number, scale: Scale): boolean {
  const rel = mod12(Math.round(midi) - mod12(root));
  return SCALE_INTERVALS[scale].includes(rel);
}

export function snapToScale(midi: number, root: number, scale: Scale): number {
  const target = Math.round(midi);
  let best = target;
  let bestDist = 99;
  for (let m = target - 12; m <= target + 12; m++) {
    if (!isInScale(m, root, scale)) continue;
    const d = Math.abs(m - target);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}

export function noteName(midi: number): string {
  const m = Math.round(midi);
  const oct = Math.floor(m / 12) - 1;
  return `${NOTE_NAMES[mod12(m)]}${oct}`;
}

export function scaleNotesBetween(root: number, scale: Scale, from: number, to: number): number[] {
  const notes: number[] = [];
  for (let m = from; m <= to; m++) {
    if (isInScale(m, root, scale)) notes.push(m);
  }
  return notes;
}
