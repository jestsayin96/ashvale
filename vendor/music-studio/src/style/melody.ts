import { mulberry32 } from '../model/rng';
import { SCALE_INTERVALS, snapToScale } from '../model/scales';
import type { Scale } from '../model/types';
import { MOTIF_MAX_NOTES } from './targets';
import { tagSeed } from './styles';

/** Contours only. No stored motif is longer than 4 notes. */
export const MOTIFS: number[][] = [
  [0, 2, 4, 2],
  [0, 1, 0, -1],
  [0, 3, 1, 4],
  [0, -1, 2, 0],
  [0, 2, 3, 5],
  [0, 4, 2, 1],
  [0, 1, 3, 2],
  [0, -2, 1, 3],
  [0, 2, 1],
  [0, -1, 1],
  [0, 3, 5, 3],
  [0, 1, 4, 2],
];

export const RHYTHM_CELLS: number[][] = [
  [0, 4, 8, 12],
  [0, 3, 6, 10],
  [0, 2, 8, 10],
  [0, 6, 8, 14],
  [0, 4, 7, 12],
  [2, 6, 10, 14],
  [0, 8],
  [0, 5, 8, 13],
];

export const FORMS = ['AABA', 'ABAC', 'AAAB'] as const;
export type FormName = (typeof FORMS)[number];

export function assertMotifs(): void {
  for (const motif of MOTIFS) {
    if (motif.length > MOTIF_MAX_NOTES) throw new Error(`motif longer than ${MOTIF_MAX_NOTES}`);
  }
}

function pick<T>(rows: T[], rng: () => number): T {
  return rows[Math.floor(rng() * rows.length) % rows.length];
}

export function degreeMidi(root: number, scale: Scale, degree: number, center: number): number {
  const iv = SCALE_INTERVALS[scale];
  const len = iv.length;
  const norm = ((degree % len) + len) % len;
  const oct = Math.floor(degree / len);
  let midi = root + iv[norm] + oct * 12;
  while (midi < center - 6) midi += 12;
  while (midi > center + 6) midi -= 12;
  if (midi < 0) midi += 12;
  if (midi > 127) midi -= 12;
  return midi;
}

export interface MelodyPlan {
  motifId: string;
  form: FormName;
  rhythmId: string;
  /** MIDI notes, one entry per placed step across `bars` bars. Empty slots are rests. */
  notes: Array<number | null>;
}

function transform(motif: number[], formStep: string, bar: number): number[] {
  if (formStep === 'A') return motif.map((n) => n + (bar % 2 === 0 ? 0 : 2));
  if (formStep === 'B') return motif.map((n) => -n + 4);
  return motif.map((n) => n + 4);
}

/** Rule-built line. The stored cell is the motif; the rest is sequence, inversion, and rhythm. */
export function planMelody(styleId: string, seed: number, bars: number, root: number, scale: Scale, register: [number, number], maxLeap: number): MelodyPlan {
  const rng = mulberry32(tagSeed(seed, `melody:${styleId}`));
  const motif = pick(MOTIFS, rng);
  const rhythm = pick(RHYTHM_CELLS, rng);
  const form = pick([...FORMS], rng);
  const start = (seed % 13) + Math.floor(rng() * 3);
  const center = Math.round((register[0] + register[1]) / 2);
  const notes: Array<number | null> = Array.from({ length: Math.max(1, bars) * 16 }, () => null);
  let previous = center;
  for (let bar = 0; bar < Math.max(1, bars); bar++) {
    const letter = form[bar % form.length];
    const shaped = transform(motif, letter, bar).map((degree) => start + degree);
    rhythm.forEach((step, index) => {
      const raw = shaped[index % shaped.length] + Math.floor(rng() * 3) - 1;
      let midi = degreeMidi(root, scale, raw, center);
      while (midi - previous > maxLeap) midi -= 12;
      while (previous - midi > maxLeap) midi += 12;
      midi = snapToScale(Math.max(register[0], Math.min(register[1], midi)), root, scale);
      previous = midi;
      notes[bar * 16 + step] = midi;
    });
  }
  return {
    motifId: `m${MOTIFS.indexOf(motif)}-${RHYTHM_CELLS.indexOf(rhythm)}-${form}`,
    form,
    rhythmId: `r${RHYTHM_CELLS.indexOf(rhythm)}`,
    notes,
  };
}

export function melodySignature(styleId: string, seed: number): string {
  const plan = planMelody(styleId, seed, 8, 0, 'major', [60, 84], 12);
  return plan.notes.filter((note): note is number => note !== null).join('.');
}
