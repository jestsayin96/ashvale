import type { Rating } from '../io/ratings';
import { mulberry32 } from '../model/rng';
import { STYLE_IDS, styleById } from './styles';
import { tagSeed } from './styles';
import { moodCell, tempoFromCell, type StyleMood } from './matrix';

export interface PreferenceBucket {
  n: number;
  love: number;
  too_busy: number;
  too_empty: number;
  too_bright: number;
  too_dark: number;
  not_for_mood: number;
  score: number;
}

export interface Preferences {
  ok: true;
  total: number;
  styled: number;
  byStyle: Record<string, PreferenceBucket>;
  byMood: Record<string, PreferenceBucket>;
  byRole: Record<string, PreferenceBucket>;
  byPair: Record<string, PreferenceBucket>;
  bias: { density: number; brightness: number };
  loved: Array<{ style: string; mood: string; bpmMean: number; brightnessMean: number; densityMean: number; n: number }>;
  avoid: Array<{ style: string; mood: string; reason: string; n: number }>;
  hash: string;
}

function emptyBucket(): PreferenceBucket & { bpm: number; bright: number; density: number; loves: number } {
  return { n: 0, love: 0, too_busy: 0, too_empty: 0, too_bright: 0, too_dark: 0, not_for_mood: 0, score: 0, bpm: 0, bright: 0, density: 0, loves: 0 };
}

function scoreOf(row: PreferenceBucket): number {
  return (row.love - 0.5 * (row.too_busy + row.too_empty + row.too_bright + row.too_dark) - row.not_for_mood) / (row.n + 2);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function hashText(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function styleOf(row: Rating): string {
  return row.styleInfo?.style || row.brief?.style || '';
}

export function aggregatePreferences(ratings: Rating[]): Preferences {
  const byStyle: Record<string, ReturnType<typeof emptyBucket>> = {};
  const byMood: Record<string, ReturnType<typeof emptyBucket>> = {};
  const byRole: Record<string, ReturnType<typeof emptyBucket>> = {};
  const pairs: Record<string, ReturnType<typeof emptyBucket>> = {};
  let busy = 0;
  let empty = 0;
  let bright = 0;
  let dark = 0;
  let styled = 0;
  for (const row of ratings) {
    const style = styleOf(row);
    if (style) styled += 1;
    const mood = row.brief?.mood || 'unknown';
    const role = row.brief?.role || 'unknown';
    const pairKey = `${style}|${mood}`;
    for (const [key, bag] of [[style || 'unknown', byStyle], [mood, byMood], [role, byRole], [pairKey, pairs]] as const) {
      const bucket = bag[key] ?? emptyBucket();
      bag[key] = bucket;
      bucket.n += 1;
      bucket[row.rating] += 1;
      if (row.rating === 'love') {
        bucket.loves += 1;
        bucket.bpm += row.metrics?.bpm ?? row.bpm ?? 0;
        bucket.bright += row.metrics?.centroidMedianHz ?? 0;
        bucket.density += row.metrics?.onsetsPerSecond ?? 0;
      }
    }
    if (row.rating === 'too_busy') busy += 1;
    if (row.rating === 'too_empty') empty += 1;
    if (row.rating === 'too_bright') bright += 1;
    if (row.rating === 'too_dark') dark += 1;
  }
  const publish = (bag: Record<string, ReturnType<typeof emptyBucket>>): Record<string, PreferenceBucket> => {
    const out: Record<string, PreferenceBucket> = {};
    for (const key of Object.keys(bag).sort()) {
      const row = bag[key];
      row.score = scoreOf(row);
      out[key] = { n: row.n, love: row.love, too_busy: row.too_busy, too_empty: row.too_empty, too_bright: row.too_bright, too_dark: row.too_dark, not_for_mood: row.not_for_mood, score: row.score };
    }
    return out;
  };
  const loved = Object.entries(pairs)
    .filter(([, row]) => row.loves > 0 && row.n > 0)
    .map(([key, row]) => {
      const [style, mood] = key.split('|');
      return {
        style,
        mood,
        bpmMean: row.bpm / row.loves,
        brightnessMean: row.bright / row.loves,
        densityMean: row.density / row.loves,
        n: row.loves,
      };
    })
    .sort((a, b) => a.style.localeCompare(b.style) || a.mood.localeCompare(b.mood));
  const avoid = Object.entries(pairs)
    .map(([key, row]) => ({ key, score: scoreOf(row), n: row.n }))
    .filter((row) => row.score < -0.3 && row.key.split('|')[0])
    .map((row) => {
      const [style, mood] = row.key.split('|');
      return { style, mood, reason: 'score below -0.3', n: row.n };
    })
    .sort((a, b) => a.style.localeCompare(b.style) || a.mood.localeCompare(b.mood));
  const total = ratings.length;
  const bias = {
    density: clamp((empty - busy) / (total + 2), -1, 1),
    brightness: clamp((dark - bright) / (total + 2), -1, 1),
  };
  const body = { total, styled, byStyle: publish(byStyle), byMood: publish(byMood), byRole: publish(byRole), byPair: publish(pairs), bias, loved, avoid };
  return { ok: true, ...body, hash: hashText(JSON.stringify(body)) };
}

export function pairScore(prefs: Preferences, style: string, mood: string): number {
  return prefs.byPair[`${style}|${mood}`]?.score ?? prefs.byStyle[style]?.score ?? 0;
}

export function weightedStyle(prefs: Preferences, mood: StyleMood, seed: number): string {
  const rng = mulberry32(tagSeed(seed, 'ratings-style'));
  const weights = STYLE_IDS.map((id) => clamp(1 + 2 * pairScore(prefs, id, mood), 0.2, 3));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let cursor = rng() * total;
  for (let i = 0; i < STYLE_IDS.length; i++) {
    cursor -= weights[i];
    if (cursor <= 0) return STYLE_IDS[i];
  }
  return STYLE_IDS[STYLE_IDS.length - 1];
}

export function ratingTempo(styleId: string, mood: StyleMood, lovedBpm: number | undefined): number | undefined {
  if (lovedBpm === undefined) return undefined;
  const style = styleById(styleId);
  if (!style) return undefined;
  const base = tempoFromCell(style.tempo, moodCell(styleId, mood));
  return base + 0.3 * (lovedBpm - base);
}
