import { resample } from '../dsp/resample';
import { guessMetaFromName, mergeManifests, validateManifestDetailed, type SampleManifest, type SampleMeta, type SampleType, type SampleGroup } from './manifest';
import { decodeWav } from './wavDecode';

export interface SampleBuffer {
  sampleRate: number;
  channels: Float32Array[];
}

export interface LoadedSample {
  meta: SampleMeta;
  buffer: SampleBuffer;
}

export type SampleLibrary = Map<string, LoadedSample>;

export interface LoadResult {
  library: SampleLibrary;
  warnings: string[];
  count: number;
}

export type FetchFn = (url: string) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer>; text(): Promise<string> }>;

function joinUrl(base: string, file: string): string {
  const root = base.endsWith('/') ? base : `${base}/`;
  return `${root}${file.replace(/^\//, '')}`;
}

async function fetchJson(fetchFn: FetchFn, url: string): Promise<unknown | null> {
  try {
    const res = await fetchFn(url);
    if (!res.ok) return null;
    return JSON.parse(await res.text()) as unknown;
  } catch {
    return null;
  }
}

export function resampleBuffer(buffer: SampleBuffer, targetRate: number): SampleBuffer {
  if (buffer.sampleRate === targetRate) {
    return { sampleRate: targetRate, channels: buffer.channels.map((ch) => new Float32Array(ch)) };
  }
  return {
    sampleRate: targetRate,
    channels: buffer.channels.map((ch) => resample(ch, buffer.sampleRate, targetRate)),
  };
}

export async function loadSampleLibrary(
  fetchFn: FetchFn,
  baseUrl = '/samples/',
  targetRate = 44100,
): Promise<LoadResult> {
  const warnings: string[] = [];
  const library: SampleLibrary = new Map();
  const baseRaw = await fetchJson(fetchFn, joinUrl(baseUrl, 'manifest.json'));
  if (!baseRaw) {
    warnings.push('manifest.json was not found');
    return { library, warnings, count: 0 };
  }
  let base: SampleManifest;
  try {
    const detailed = validateManifestDetailed(baseRaw);
    base = detailed.manifest;
    warnings.push(...detailed.warnings);
  } catch (err) {
    warnings.push(err instanceof Error ? err.message : 'manifest.json is invalid');
    return { library, warnings, count: 0 };
  }
  const localRaw = await fetchJson(fetchFn, joinUrl(baseUrl, 'manifest.local.json'));
  let local: SampleManifest | null = null;
  if (localRaw) {
    try {
      const detailed = validateManifestDetailed(localRaw);
      local = detailed.manifest;
      warnings.push(...detailed.warnings.map((w) => `manifest.local.json: ${w}`));
    } catch (err) {
      warnings.push(err instanceof Error ? `manifest.local.json: ${err.message}` : 'manifest.local.json is invalid');
    }
  }
  const manifest = mergeManifests(base, local);
  for (const meta of manifest.samples) {
    try {
      const res = await fetchFn(joinUrl(baseUrl, meta.file));
      if (!res.ok) {
        warnings.push(`missing sample ${meta.id}: ${meta.file} (${res.status})`);
        continue;
      }
      const bytes = await res.arrayBuffer();
      const decoded = decodeWav(bytes);
      library.set(meta.id, { meta, buffer: resampleBuffer(decoded, targetRate) });
    } catch (err) {
      warnings.push(`bad sample ${meta.id}: ${err instanceof Error ? err.message : 'decode failed'}`);
    }
  }
  return { library, warnings, count: library.size };
}

export function addSampleFromBytes(
  library: SampleLibrary,
  id: string,
  bytes: ArrayBuffer | Uint8Array,
  meta: Partial<SampleMeta> & { file?: string },
  targetRate = 44100,
): { ok: true; id: string } | { ok: false; error: string } {
  try {
    const decoded = decodeWav(bytes);
    const guessed = guessMetaFromName(meta.file ?? id);
    const full: SampleMeta = {
      id,
      file: meta.file ?? `${id}.wav`,
      type: (meta.type as SampleType) ?? guessed.type,
      group: (meta.group as SampleGroup) ?? guessed.group,
      rootMidi: meta.rootMidi ?? 60,
      loop: meta.loop === true,
      license: meta.license ?? 'CC0',
      source: meta.source ?? 'user',
      author: meta.author ?? 'user',
      ...(meta.loopStart !== undefined ? { loopStart: meta.loopStart } : {}),
      ...(meta.loopEnd !== undefined ? { loopEnd: meta.loopEnd } : {}),
      ...(meta.bpm !== undefined ? { bpm: meta.bpm } : {}),
      ...(meta.gainDb !== undefined ? { gainDb: meta.gainDb } : {}),
    };
    library.set(id, { meta: full, buffer: resampleBuffer(decoded, targetRate) });
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not add sample' };
  }
}

let cached: SampleLibrary | null = null;
let cachedWarnings: string[] = [];

export function getCachedLibrary(): SampleLibrary {
  if (!cached) cached = new Map();
  return cached;
}

export function getCachedWarnings(): string[] {
  return [...cachedWarnings];
}

export function setCachedLibrary(library: SampleLibrary, warnings: string[] = []): void {
  cached = library;
  cachedWarnings = [...warnings];
}

export function listSamples(library: SampleLibrary = getCachedLibrary()): Array<{ id: string; type: SampleType; group: SampleGroup; file: string; license: string }> {
  return [...library.values()].map((row) => ({
    id: row.meta.id,
    type: row.meta.type,
    group: row.meta.group,
    file: row.meta.file,
    license: row.meta.license,
  }));
}

/** Node/fs-backed sample loader. Reuses loadSampleLibrary via a directory fetchFn. */
export async function loadSampleLibraryFromDir(
  dir = 'public/samples',
  targetRate = 44100,
): Promise<LoadResult> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const root = path.resolve(dir);
  const baseUrl = `${root.replace(/\\/g, '/')}/`;
  const fetchFn: FetchFn = async (url) => {
    const normalized = url.replace(/\\/g, '/');
    const filePath = path.resolve(normalized);
    const rootNorm = path.resolve(root);
    if (!filePath.startsWith(rootNorm)) {
      return { ok: false, status: 403, arrayBuffer: async () => new ArrayBuffer(0), text: async () => '' };
    }
    try {
      const bytes = await fs.readFile(filePath);
      const copy = Uint8Array.from(bytes);
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength),
        text: async () => new TextDecoder().decode(bytes),
      };
    } catch {
      return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0), text: async () => '' };
    }
  };
  const result = await loadSampleLibrary(fetchFn, baseUrl, targetRate);
  setCachedLibrary(result.library, result.warnings);
  return result;
}
