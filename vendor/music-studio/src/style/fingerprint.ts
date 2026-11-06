import { buildEvents } from '../audio/events';
import type { Project } from '../model/types';
import { loopSeconds } from '../model/video';
import { moodCell } from './matrix';
import { FINGERPRINT_KEY, VARIETY_LOG_CAP, VARIETY_MIN_DISTANCE } from './targets';
import { styleById, tagSeed } from './styles';

export interface Fingerprint {
  v: 1;
  id: string;
  name: string;
  style: string;
  mood: string;
  role: string;
  key: { root: number; scale: string };
  bpm: number;
  progressionId: string;
  drumId: string;
  bassId: string;
  motifId: string;
  intervalHist: number[];
  instruments: string[];
  brightness: number;
  density: number;
  seed: number;
  created: string;
}

export interface Similarity {
  nearestDistance: number;
  nearestId: string;
  nearestName: string;
  threshold: number;
  requestedSeed: number;
  usedSeed: number;
  reseeds: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const memory = new Map<string, string>();
const FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

function bin(interval: number): number {
  const n = Math.abs(interval);
  if (n === 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  if (n <= 4) return 3;
  if (n === 5) return 4;
  if (n === 7) return 5;
  if (n <= 12) return 6;
  return 7;
}

export function intervalHist(notes: number[]): number[] {
  const hist = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 1; i < notes.length; i++) hist[bin(notes[i] - notes[i - 1])] += 1;
  const sum = hist.reduce((a, b) => a + b, 0) || 1;
  return hist.map((value) => value / sum);
}

export function fingerprintOf(project: Project, created = ''): Fingerprint {
  const style = project.style;
  const events = buildEvents(project, project.exact?.bars ?? project.bars);
  const seconds = project.exact?.seconds ?? project.origin?.loopSeconds ?? loopSeconds(project.bars, project.bpm);
  const lead = events.filter((event) => event.trackId === 'lead' && event.note !== undefined);
  const notes = lead.map((event) => event.note ?? 0);
  const def = styleById(style?.id ?? '');
  const mood = (style?.mood === 'hype' || style?.mood === 'playful' || style?.mood === 'lowkey') ? style.mood : 'playful';
  let brightness = def ? def.brightness + moodCell(def.id, mood).brightnessShift : 0;
  if (project.origin?.role === 'bed') brightness -= 0.1;
  brightness = Math.max(0, Math.min(1, brightness));
  const instruments = [...new Set(project.tracks.map((track) => {
    const wave = track.kind === 'synth' ? (track.params as { wave?: string }).wave : '';
    return wave ? `${track.voice}:${wave}` : track.voice;
  }))].sort();
  const id = `fp${tagSeed(project.seed, `${style?.id}|${style?.progressionId}|${style?.drumId}|${style?.bassId}|${style?.motifId}|${project.bpm}`).toString(36)}`;
  return {
    v: 1,
    id: style?.fingerprint || id,
    name: project.name,
    style: style?.id ?? '',
    mood: style?.mood ?? project.mood ?? '',
    role: project.origin?.role ?? 'music',
    key: { root: project.key.root, scale: project.key.scale },
    bpm: project.bpm,
    progressionId: style?.progressionId ?? '',
    drumId: style?.drumId ?? '',
    bassId: style?.bassId ?? '',
    motifId: style?.motifId ?? '',
    intervalHist: intervalHist(notes),
    instruments,
    brightness,
    density: events.length / Math.max(0.001, seconds),
    seed: project.seed,
    created,
  };
}

function circle(root: number): number {
  const pc = ((root % 12) + 12) % 12;
  const index = FIFTHS.indexOf(pc);
  return index < 0 ? 0 : index;
}

export function distance(a: Fingerprint, b: Fingerprint): number {
  const keySteps = Math.min(Math.abs(circle(a.key.root) - circle(b.key.root)), 12 - Math.abs(circle(a.key.root) - circle(b.key.root)));
  const key = (keySteps / 6) * 0.1;
  const scale = a.key.scale === b.key.scale ? 0 : 0.05;
  const tempo = Math.min(0.15, Math.abs(a.bpm - b.bpm) / 60);
  const progression = a.progressionId === b.progressionId ? 0 : 0.15;
  const drum = a.drumId === b.drumId ? 0 : 0.075;
  const bass = a.bassId === b.bassId ? 0 : 0.075;
  let l1 = 0;
  for (let i = 0; i < 8; i++) l1 += Math.abs((a.intervalHist[i] ?? 0) - (b.intervalHist[i] ?? 0));
  const intervals = (l1 / 2) * 0.2;
  const setA = new Set(a.instruments);
  const setB = new Set(b.instruments);
  let inter = 0;
  for (const item of setA) if (setB.has(item)) inter += 1;
  const union = new Set([...setA, ...setB]).size || 1;
  const jaccard = (1 - inter / union) * 0.1;
  const tone = (Math.abs(a.brightness - b.brightness) + Math.min(1, Math.abs(a.density - b.density) / 30)) / 2;
  const color = tone * 0.1;
  return Math.max(0, Math.min(1, key + scale + tempo + progression + drum + bass + intervals + jaccard + color));
}

export function nearest(fp: Fingerprint, pool: Fingerprint[]): { distance: number; entry: Fingerprint | null } {
  let best = 1;
  let entry: Fingerprint | null = null;
  for (const other of pool) {
    if (other.id === fp.id && other.seed === fp.seed) continue;
    const value = distance(fp, other);
    if (value < best) {
      best = value;
      entry = other;
    }
  }
  return { distance: entry ? best : 1, entry };
}

function storageOf(storage: StorageLike | null): StorageLike {
  return {
    getItem: (key) => {
      if (storage) {
        try { return storage.getItem(key); } catch { return memory.get(key) ?? null; }
      }
      return memory.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (storage) {
        try { storage.setItem(key, value); return; } catch { memory.set(key, value); return; }
      }
      memory.set(key, value);
    },
  };
}

export function loadFingerprints(storage: StorageLike | null): Fingerprint[] {
  const raw = storageOf(storage).getItem(FINGERPRINT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row === 'object' && (row as Fingerprint).v === 1) as Fingerprint[];
  } catch {
    return [];
  }
}

export function saveFingerprints(storage: StorageLike | null, entries: Fingerprint[]): void {
  storageOf(storage).setItem(FINGERPRINT_KEY, JSON.stringify(entries.slice(-VARIETY_LOG_CAP)));
}

export function logFingerprint(storage: StorageLike | null, entry: Fingerprint): Fingerprint[] {
  const current = loadFingerprints(storage).filter((row) => row.id !== entry.id);
  current.push(entry);
  saveFingerprints(storage, current);
  return current.slice(-VARIETY_LOG_CAP);
}

export function importFingerprints(storage: StorageLike | null, json: unknown): { ok: true; added: number; skipped: number; invalid: number } | { ok: false; error: string } {
  let value = json;
  if (typeof json === 'string') {
    try { value = JSON.parse(json); } catch { return { ok: false, error: 'Fingerprints are not valid JSON' }; }
  }
  const rows = Array.isArray(value) ? value : (value && typeof value === 'object' && Array.isArray((value as { entries?: unknown }).entries) ? (value as { entries: unknown[] }).entries : null);
  if (!rows) return { ok: false, error: 'Fingerprints need an entries array' };
  const current = loadFingerprints(storage);
  const seen = new Set(current.map((row) => row.id));
  let added = 0;
  let skipped = 0;
  let invalid = 0;
  for (const row of rows) {
    if (!row || typeof row !== 'object' || (row as Fingerprint).v !== 1 || typeof (row as Fingerprint).id !== 'string') {
      invalid += 1;
      continue;
    }
    const fp = row as Fingerprint;
    if (seen.has(fp.id)) {
      skipped += 1;
      continue;
    }
    seen.add(fp.id);
    current.push(fp);
    added += 1;
  }
  saveFingerprints(storage, current);
  return { ok: true, added, skipped, invalid };
}

export function reseedCandidate(seed: number, attempt: number): number {
  return tagSeed(seed, `reseed:${attempt}`);
}

export function tooSimilar(value: number): boolean {
  return value < VARIETY_MIN_DISTANCE;
}
