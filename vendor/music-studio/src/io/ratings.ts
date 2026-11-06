export const RATINGS_KEY = 'musicStudio.ratings.v1';

export const RATING_VALUES = ['love', 'too_busy', 'too_empty', 'too_bright', 'too_dark', 'not_for_mood'] as const;
export type RatingValue = (typeof RATING_VALUES)[number];

export interface RatingBrief {
  role: string;
  mood: string;
  seconds: number;
  name?: string;
  seed?: number;
  style?: string;
  matchProfile?: { bpm?: number | null; mood?: string; styleHint?: string };
}

export interface RatingStyleInfo {
  style: string;
  progressionId: string;
  drumId: string;
  bassId: string;
  motifId: string;
  lengthMode: 'loop' | 'exact';
}

export interface RatingMetrics {
  bpm: number;
  onsetsPerSecond: number;
  synthNotesPerBar: number;
  centroidMedianHz: number;
  loudnessMovement: number;
  integratedLufs: number;
  truePeak: number;
  speechShare: number;
  moodScores: { hype: number; playful: number; lowkey: number };
  seamStatus: 'ok' | 'check';
}

export interface Rating {
  id: string;
  timestamp: string;
  rating: RatingValue;
  note?: string;
  seed: number;
  brief: RatingBrief | null;
  projectName: string;
  bpm: number;
  bars: number;
  key: string;
  metrics: RatingMetrics;
  styleInfo?: RatingStyleInfo;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const memory = new Map<string, string>();
let sequence = 0;

export function isRatingValue(value: string): value is RatingValue {
  return (RATING_VALUES as readonly string[]).includes(value);
}

function readRaw(storage: StorageLike | null): string | null {
  if (storage) {
    try {
      return storage.getItem(RATINGS_KEY);
    } catch {
      return memory.get(RATINGS_KEY) ?? null;
    }
  }
  return memory.get(RATINGS_KEY) ?? null;
}

function writeRaw(storage: StorageLike | null, value: string): void {
  if (storage) {
    try {
      storage.setItem(RATINGS_KEY, value);
      return;
    } catch {
      memory.set(RATINGS_KEY, value);
      return;
    }
  }
  memory.set(RATINGS_KEY, value);
}

export function loadRatings(storage: StorageLike | null): Rating[] {
  const raw = readRaw(storage);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row === 'object' && isRatingValue(String((row as Rating).rating))) as Rating[];
  } catch {
    return [];
  }
}

export function saveRatings(storage: StorageLike | null, ratings: Rating[]): void {
  writeRaw(storage, JSON.stringify(ratings));
}

export function addRating(storage: StorageLike | null, entry: Omit<Rating, 'id' | 'timestamp'> & { timestamp?: string }): { ok: true; entry: Rating } | { ok: false; error: string } {
  if (!isRatingValue(entry.rating)) return { ok: false, error: `Unknown rating: ${String(entry.rating)}` };
  sequence += 1;
  const saved: Rating = {
    ...entry,
    id: `r${sequence.toString(36)}-${Date.now().toString(36)}`,
    timestamp: entry.timestamp ?? new Date().toISOString(),
  };
  const all = loadRatings(storage);
  all.push(saved);
  saveRatings(storage, all);
  return { ok: true, entry: saved };
}

export function browserStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}
