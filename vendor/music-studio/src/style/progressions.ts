export interface Progression {
  id: string;
  /** Scale-degree roots, one per chord. */
  degrees: number[];
  quality: 'triad' | '7th';
  barsPerChord: number;
}

export const PROGRESSIONS: Progression[] = [
  { id: 'I-V-vi-IV', degrees: [0, 4, 5, 3], quality: 'triad', barsPerChord: 1 },
  { id: 'I-IV-V-IV', degrees: [0, 3, 4, 3], quality: 'triad', barsPerChord: 1 },
  { id: 'I-bVII-IV-I', degrees: [0, 6, 3, 0], quality: 'triad', barsPerChord: 1 },
  { id: 'vi-IV-I-V', degrees: [5, 3, 0, 4], quality: 'triad', barsPerChord: 1 },
  { id: 'i-VI-III-VII', degrees: [0, 5, 2, 6], quality: 'triad', barsPerChord: 1 },
  { id: 'i-iv-VI-V', degrees: [0, 3, 5, 4], quality: 'triad', barsPerChord: 1 },
  { id: 'i-VII-VI-VII', degrees: [0, 6, 5, 6], quality: 'triad', barsPerChord: 1 },
  { id: 'i7-IV7', degrees: [0, 3], quality: '7th', barsPerChord: 2 },
  { id: 'ii7-V7-I', degrees: [1, 4, 0], quality: '7th', barsPerChord: 1 },
  { id: 'ii7-V7-Imaj7-vi7', degrees: [1, 4, 0, 5], quality: '7th', barsPerChord: 1 },
  { id: 'i-bVII-IV', degrees: [0, 6, 3], quality: 'triad', barsPerChord: 1 },
  { id: 'I-V', degrees: [0, 4], quality: 'triad', barsPerChord: 2 },
  { id: 'I-IV', degrees: [0, 3], quality: 'triad', barsPerChord: 2 },
  { id: 'vi-IV', degrees: [5, 3], quality: 'triad', barsPerChord: 2 },
  { id: 'VI-VII-i', degrees: [5, 6, 0], quality: 'triad', barsPerChord: 1 },
  { id: 'I-vi-IV-V', degrees: [0, 5, 3, 4], quality: 'triad', barsPerChord: 1 },
  { id: 'I-IV-I-V', degrees: [0, 3, 0, 4], quality: 'triad', barsPerChord: 1 },
  { id: 'I-iii-IV-V', degrees: [0, 2, 3, 4], quality: 'triad', barsPerChord: 1 },
];

export function progressionById(id: string): Progression {
  return PROGRESSIONS.find((row) => row.id === id) ?? PROGRESSIONS[0];
}
