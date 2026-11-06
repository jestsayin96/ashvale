import { parseRootToMidi } from './pitch';

export const SAMPLE_TYPES = [
  'kick', 'snare', 'hat', 'openhat', 'rim', 'bass', 'fx', 'chant', 'hum', 'pad', 'vocal', 'synth',
] as const;
export type SampleType = (typeof SAMPLE_TYPES)[number];

export const SAMPLE_GROUPS = ['beat', 'voice', 'melody', 'effects'] as const;
export type SampleGroup = (typeof SAMPLE_GROUPS)[number];

export interface SampleMeta {
  id: string;
  file: string;
  type: SampleType;
  group: SampleGroup;
  rootMidi: number;
  /** Optional tonal root ("A3" or MIDI). When set, headless render may pitch to key. */
  root?: string | number;
  loop: boolean;
  loopStart?: number;
  loopEnd?: number;
  bpm?: number;
  gainDb?: number;
  license: string;
  source: string;
  author: string;
}

export interface SampleManifest {
  version: 1;
  samples: SampleMeta[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function fail(message: string): never {
  throw new Error(message);
}

/** Relative .wav path only: no "..", no absolute, no scheme. */
export function isSafeSamplePath(file: string): boolean {
  if (typeof file !== 'string' || !file) return false;
  if (file.includes('..')) return false;
  if (file.startsWith('/') || file.startsWith('\\')) return false;
  if (/^[a-zA-Z]:[\\/]/.test(file)) return false;
  if (/^[a-z]+:\/\//i.test(file)) return false;
  if (!file.toLowerCase().endsWith('.wav')) return false;
  return true;
}

function readMeta(raw: unknown, index: number): SampleMeta {
  if (!isObj(raw)) fail(`Sample ${index} must be an object`);
  const id = String(raw.id ?? '');
  if (!id) fail(`Sample ${index} is missing id`);
  const file = String(raw.file ?? '');
  if (!isSafeSamplePath(file)) fail(`Sample ${id} has an unsafe path: ${file}`);
  const type = String(raw.type);
  if (!(SAMPLE_TYPES as readonly string[]).includes(type)) fail(`Sample ${id} has unknown type: ${type}`);
  const group = String(raw.group);
  if (!(SAMPLE_GROUPS as readonly string[]).includes(group)) fail(`Sample ${id} has unknown group: ${group}`);
  const rootMidi = Number(raw.rootMidi);
  if (!Number.isFinite(rootMidi)) fail(`Sample ${id} rootMidi must be finite`);
  const loop = raw.loop === true;
  const meta: SampleMeta = {
    id,
    file: file.replace(/\\/g, '/'),
    type: type as SampleType,
    group: group as SampleGroup,
    rootMidi,
    loop,
    license: String(raw.license ?? 'CC0'),
    source: String(raw.source ?? ''),
    author: String(raw.author ?? ''),
  };
  if (raw.loopStart !== undefined) {
    const n = Number(raw.loopStart);
    if (!Number.isFinite(n)) fail(`Sample ${id} loopStart must be finite`);
    meta.loopStart = n;
  }
  if (raw.loopEnd !== undefined) {
    const n = Number(raw.loopEnd);
    if (!Number.isFinite(n)) fail(`Sample ${id} loopEnd must be finite`);
    meta.loopEnd = n;
  }
  if (raw.bpm !== undefined) {
    const n = Number(raw.bpm);
    if (!Number.isFinite(n)) fail(`Sample ${id} bpm must be finite`);
    meta.bpm = n;
  }
  if (raw.gainDb !== undefined) {
    const n = Number(raw.gainDb);
    if (!Number.isFinite(n)) fail(`Sample ${id} gainDb must be finite`);
    meta.gainDb = n;
  }
  if (raw.root !== undefined) {
    const midi = parseRootToMidi(raw.root as string | number);
    if (midi === null) fail(`Sample ${id} root must be a note name like A3 or a MIDI number`);
    meta.root = typeof raw.root === 'number' ? raw.root : String(raw.root);
    meta.rootMidi = midi;
  }
  return meta;
}

export interface ManifestValidateResult {
  manifest: SampleManifest;
  warnings: string[];
}

export function validateManifest(raw: unknown): SampleManifest {
  return validateManifestDetailed(raw).manifest;
}

export function validateManifestDetailed(raw: unknown): ManifestValidateResult {
  if (!isObj(raw)) fail('Manifest must be an object');
  const warnings: string[] = [];
  let version = raw.version;
  if (version === undefined) {
    warnings.push('Manifest version missing; assuming 1');
    version = 1;
  } else if (version !== 1) {
    fail('Manifest version must be 1');
  }
  if (!Array.isArray(raw.samples)) fail('Manifest samples must be an array');
  const samples = raw.samples.map((row, i) => readMeta(row, i));
  const seen = new Set<string>();
  for (const sample of samples) {
    if (seen.has(sample.id)) fail(`Duplicate sample id: ${sample.id}`);
    seen.add(sample.id);
  }
  return { manifest: { version: 1, samples }, warnings };
}

/** Merge base + local. Local ids replace base ids of the same name. */
export function mergeManifests(base: SampleManifest, local: SampleManifest | null): SampleManifest {
  if (!local) return base;
  const map = new Map<string, SampleMeta>();
  for (const sample of base.samples) map.set(sample.id, sample);
  for (const sample of local.samples) map.set(sample.id, sample);
  return { version: 1, samples: [...map.values()] };
}

export function guessMetaFromName(fileName: string): Partial<SampleMeta> & { type: SampleType; group: SampleGroup } {
  const name = fileName.toLowerCase();
  if (name.includes('bb_kick') || name.startsWith('kick')) return { type: 'kick', group: 'beat' };
  if (name.includes('bb_snare') || name.startsWith('snare')) return { type: 'snare', group: 'beat' };
  if (name.includes('bb_hat') || name.includes('openhat') || name.startsWith('hat')) {
    return { type: name.includes('open') ? 'openhat' : 'hat', group: 'beat' };
  }
  if (name.includes('bb_bass') || name.startsWith('bass')) return { type: 'bass', group: 'beat' };
  if (name.startsWith('ch_') || name.includes('chant')) return { type: 'chant', group: 'voice' };
  if (name.startsWith('hm_') || name.includes('hum')) return { type: 'hum', group: 'voice' };
  if (name.startsWith('pad_') || name.includes('pad')) return { type: 'pad', group: 'melody' };
  if (name.includes('fx') || name.includes('sweep')) return { type: 'fx', group: 'effects' };
  return { type: 'fx', group: 'effects' };
}
