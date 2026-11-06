export interface DrumPattern {
  id: string;
  role: 'kick' | 'snare' | 'hat' | 'perc';
  steps: number[];
}

export interface BassPattern {
  id: string;
  /** Scale degrees relative to the chord. -1 is a rest. */
  degrees: number[];
}

function steps(hits: Array<[number, number]>): number[] {
  const row = Array.from({ length: 16 }, () => 0);
  for (const [index, vel] of hits) row[index] = vel;
  return row;
}

export const DRUM_PATTERNS: DrumPattern[] = [
  { id: 'kick-4', role: 'kick', steps: steps([[0, 0.8], [4, 0.75], [8, 0.8], [12, 0.75]]) },
  { id: 'kick-soft-4', role: 'kick', steps: steps([[0, 0.55], [4, 0.4], [8, 0.55], [12, 0.4]]) },
  { id: 'kick-off-8', role: 'kick', steps: steps([[0, 0.7], [6, 0.45], [8, 0.7], [14, 0.4]]) },
  { id: 'kick-push', role: 'kick', steps: steps([[0, 0.8], [3, 0.35], [8, 0.75], [11, 0.4]]) },
  { id: 'kick-sparse', role: 'kick', steps: steps([[0, 0.5], [8, 0.45]]) },
  { id: 'kick-half', role: 'kick', steps: steps([[0, 0.7], [8, 0.55]]) },
  { id: 'kick-sync', role: 'kick', steps: steps([[0, 0.75], [3, 0.4], [7, 0.55], [10, 0.45], [14, 0.35]]) },
  { id: 'kick808-ost', role: 'kick', steps: steps([[0, 0.8], [6, 0.5], [8, 0.7], [14, 0.45]]) },
  { id: 'snare-24', role: 'snare', steps: steps([[4, 0.75], [12, 0.75]]) },
  { id: 'snare-back', role: 'snare', steps: steps([[4, 0.8], [12, 0.7]]) },
  { id: 'snare-ghost', role: 'snare', steps: steps([[3, 0.2], [4, 0.75], [11, 0.18], [12, 0.7]]) },
  { id: 'snare-late', role: 'snare', steps: steps([[4, 0.7], [12, 0.65], [15, 0.25]]) },
  { id: 'snare-tight-24', role: 'snare', steps: steps([[4, 0.6], [12, 0.6]]) },
  { id: 'clap-24', role: 'snare', steps: steps([[4, 0.7], [12, 0.7]]) },
  { id: 'rim-24', role: 'snare', steps: steps([[4, 0.4], [12, 0.35]]) },
  { id: 'tom-ost', role: 'snare', steps: steps([[0, 0.35], [4, 0.4], [8, 0.35], [12, 0.45]]) },
  { id: 'hat-8', role: 'hat', steps: steps([[0, 0.35], [2, 0.25], [4, 0.35], [6, 0.25], [8, 0.35], [10, 0.25], [12, 0.35], [14, 0.25]]) },
  { id: 'hat-off', role: 'hat', steps: steps([[2, 0.3], [6, 0.35], [10, 0.3], [14, 0.4]]) },
  { id: 'hat-16-light', role: 'hat', steps: steps([[0, 0.3], [1, 0.12], [2, 0.22], [3, 0.1], [4, 0.3], [6, 0.2], [8, 0.3], [10, 0.18], [12, 0.3], [14, 0.2]]) },
  { id: 'hat-16-ghost', role: 'hat', steps: steps([[0, 0.28], [1, 0.1], [2, 0.2], [3, 0.08], [4, 0.26], [5, 0.1], [6, 0.2], [8, 0.28], [10, 0.16], [12, 0.26], [13, 0.1], [14, 0.2]]) },
  { id: 'hat-open-off', role: 'hat', steps: steps([[2, 0.4], [6, 0.45], [10, 0.4], [14, 0.5]]) },
  { id: 'hat-sparse', role: 'hat', steps: steps([[4, 0.2], [12, 0.18]]) },
  { id: 'shaker-8', role: 'hat', steps: steps([[0, 0.22], [2, 0.16], [4, 0.2], [6, 0.14], [8, 0.22], [10, 0.15], [12, 0.2], [14, 0.14]]) },
  { id: 'shaker-sparse', role: 'hat', steps: steps([[2, 0.12], [10, 0.1]]) },
  { id: 'perc-off', role: 'perc', steps: steps([]) },
  { id: 'perc-clap-2', role: 'perc', steps: steps([[4, 0.3], [12, 0.25]]) },
  { id: 'perc-tick', role: 'perc', steps: steps([[0, 0.15], [8, 0.12]]) },
  { id: 'perc-fill', role: 'perc', steps: steps([[12, 0.2], [13, 0.25], [14, 0.3], [15, 0.35]]) },
  { id: 'perc-crash', role: 'perc', steps: steps([[0, 0.45]]) },
];

export const BASS_PATTERNS: BassPattern[] = [
  { id: 'walk-8', degrees: [0, -1, 4, -1, 7, -1, 4, -1, 0, -1, 4, -1, 7, -1, 4, -1] },
  { id: 'root-5', degrees: [0, -1, -1, -1, 4, -1, -1, -1, 0, -1, -1, -1, 4, -1, -1, -1] },
  { id: 'octave-hop', degrees: [0, -1, 7, -1, 0, -1, 7, -1, 0, -1, 7, -1, 4, -1, 7, -1] },
  { id: 'pump-8', degrees: [0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 7, -1] },
  { id: 'sync-16', degrees: [0, -1, 0, 4, -1, 7, -1, 0, 0, -1, 4, -1, 0, 7, -1, 4] },
  { id: 'sub-hits', degrees: [0, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1, -1, -1, -1, -1] },
  { id: 'drone', degrees: [0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1] },
];

export function drumById(id: string): DrumPattern {
  return DRUM_PATTERNS.find((row) => row.id === id) ?? DRUM_PATTERNS[0];
}

export function bassById(id: string): BassPattern {
  return BASS_PATTERNS.find((row) => row.id === id) ?? BASS_PATTERNS[0];
}
