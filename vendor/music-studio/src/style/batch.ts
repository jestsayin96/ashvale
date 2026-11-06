import { newProject } from '../model/defaults';
import type { Project, VideoRole } from '../model/types';
import { yieldToUi } from '../score/yield';
import { APP_VERSION } from '../version';
import { composeStyled, type ComposeBrief } from './compose';
import { fingerprintOf, loadFingerprints, logFingerprint, type Fingerprint, type StorageLike } from './fingerprint';
import { creditsRow, libraryRow, type LibraryNumbers } from './library';
import { styledBaseName } from './naming';
import { STYLE_IDS } from './styles';
import { zipStore, type ZipEntry } from './zip';

export interface BatchItem {
  style: string;
  mood?: 'hype' | 'playful' | 'lowkey';
  role: VideoRole;
  seconds: number;
  count?: number;
  seedStart?: number;
  loop: boolean;
  namePrefix?: string;
  pictures?: boolean;
}

export interface BatchOptions {
  download?: boolean;
  packaging?: 'files' | 'zip';
  bitDepth?: 16 | 24;
  pictures?: boolean;
  uniqueSuffix?: boolean;
  varietyGuard?: 'warn' | 'reseed' | 'refuse' | 'off';
  delayMs?: number;
  stopOnError?: boolean;
  onProgress?: (progress: { itemIndex: number; itemTotal: number; fraction: number; message: string; itemMs: number }) => void;
  render?: (project: Project) => Promise<{ lufs: number; truePeak: number; seamStatus?: string; seamNumbers?: string }>;
  storage?: StorageLike | null;
  now?: Date;
  useRatings?: boolean;
  ratings?: ComposeBrief['ratings'];
}

export interface BatchManifest {
  ok: true;
  batchId: string;
  startedAt: string;
  appVersion: string;
  options: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  files: string[];
  totals: { ok: number; skipped: number; error: number; ms: number };
  zip?: Uint8Array;
}

let cancelRequested = false;

export function cancelBatch(): void {
  cancelRequested = true;
}

export const PRESETS = ['fill-library-20', 'styles-sampler-8'] as const;

function expand(spec: Array<Omit<BatchItem, 'count' | 'seedStart'> & { count: number; seedStart: number }>): BatchItem[] {
  const items: BatchItem[] = [];
  for (const row of spec) {
    for (let i = 0; i < row.count; i++) {
      items.push({ ...row, count: 1, seedStart: row.seedStart + i });
    }
  }
  return items;
}

export function presetItems(id: string): BatchItem[] | null {
  if (id === 'fill-library-20') {
    return expand([
      { style: 'arcade_upbeat', mood: 'hype', role: 'music', seconds: 60, loop: true, count: 3, seedStart: 1 },
      { style: 'retro_synthwave', mood: 'hype', role: 'music', seconds: 75, loop: true, count: 2, seedStart: 11 },
      { style: 'epic_cinematic', mood: 'hype', role: 'music', seconds: 60, loop: false, count: 2, seedStart: 21 },
      { style: 'chiptune_bounce', mood: 'playful', role: 'music', seconds: 45, loop: true, count: 3, seedStart: 31 },
      { style: 'funky', mood: 'playful', role: 'music', seconds: 60, loop: true, count: 2, seedStart: 41 },
      { style: 'playful_pizzicato', mood: 'playful', role: 'music', seconds: 45, loop: true, count: 2, seedStart: 51 },
      { style: 'lofi_chill', mood: 'lowkey', role: 'bed', seconds: 90, loop: true, count: 3, seedStart: 61 },
      { style: 'ambient_calm', mood: 'lowkey', role: 'bed', seconds: 90, loop: true, count: 1, seedStart: 71 },
      { style: 'arcade_upbeat', mood: 'hype', role: 'intro', seconds: 5, loop: false, count: 1, seedStart: 81 },
      { style: 'lofi_chill', mood: 'lowkey', role: 'outro', seconds: 12, loop: false, count: 1, seedStart: 91 },
    ]);
  }
  if (id === 'styles-sampler-8') {
    return STYLE_IDS.map((style, index) => ({
      style,
      mood: index % 3 === 0 ? 'hype' : index % 3 === 1 ? 'playful' : 'lowkey',
      role: 'music' as const,
      seconds: 30,
      loop: true,
      count: 1,
      seedStart: 100 + index,
    }));
  }
  return null;
}

function resolvePlan(plan: BatchItem[] | { name?: string; items: BatchItem[] } | string): { items: BatchItem[]; error?: string } {
  if (typeof plan === 'string') {
    const items = presetItems(plan);
    if (!items) return { items: [], error: `Unknown preset: ${plan}. Presets: ${PRESETS.join(', ')}` };
    return { items };
  }
  if (Array.isArray(plan)) return { items: plan };
  if (plan && Array.isArray(plan.items)) return { items: plan.items };
  return { items: [], error: 'Batch plan needs items or a preset id' };
}

export async function runBatch(plan: BatchItem[] | { name?: string; items: BatchItem[] } | string, options: BatchOptions = {}): Promise<BatchManifest | { ok: false; error: string }> {
  try {
    cancelRequested = false;
    const resolved = resolvePlan(plan);
    if (resolved.error) return { ok: false, error: resolved.error };
    const started = options.now ?? new Date();
    const batchId = `batch_${started.getFullYear()}${String(started.getMonth() + 1).padStart(2, '0')}${String(started.getDate()).padStart(2, '0')}-${String(started.getHours()).padStart(2, '0')}${String(started.getMinutes()).padStart(2, '0')}${String(started.getSeconds()).padStart(2, '0')}`;
    const pool: Fingerprint[] = loadFingerprints(options.storage ?? null);
    const items: Array<Record<string, unknown>> = [];
    const files: string[] = [];
    const zipEntries: ZipEntry[] = [];
    const rows: string[] = [];
    const credits: string[] = [];
    let ok = 0;
    let skipped = 0;
    let error = 0;
    const t0 = Date.now();
    const list = resolved.items.slice(0, 200);
    for (let index = 0; index < list.length; index++) {
      if (cancelRequested) {
        skipped += list.length - index;
        break;
      }
      const item = list[index];
      const itemStarted = Date.now();
      options.onProgress?.({
        itemIndex: index,
        itemTotal: list.length,
        fraction: index / list.length,
        message: `${item.style} ${item.role}`,
        itemMs: 0,
      });
      try {
        const count = Math.max(1, Math.min(200, item.count ?? 1));
        if (count !== 1) throw new Error('Expanded items carry count 1');
        const brief: ComposeBrief = {
          role: item.role,
          mood: item.mood ?? 'playful',
          seconds: item.seconds,
          seed: item.seedStart ?? index + 1,
          style: item.style,
          lengthMode: item.loop ? 'loop' : 'exact',
          varietyGuard: options.varietyGuard ?? 'reseed',
          name: item.namePrefix,
          useRatings: options.useRatings,
          ratings: options.ratings,
        };
        const composed = composeStyled(newProject(), brief, pool);
        if (composed.refused) throw new Error(composed.refused);
        const project = composed.project;
        const measured: LibraryNumbers = options.render
          ? await options.render(project)
          : { lufs: project.master.targetLufs, truePeak: -1.2, seamStatus: item.loop ? 'ok' : undefined, seamNumbers: '0' };
        const base = styledBaseName(project, options.uniqueSuffix !== false, started);
        const fp = fingerprintOf(project, started.toISOString());
        pool.push(fp);
        if (options.storage !== undefined) logFingerprint(options.storage, fp);
        const row = libraryRow(project, measured, base);
        rows.push(row);
        credits.push(creditsRow(project));
        const names = [`${base}.wav`, `${base}.report.json`, `${base}.listen.json`, `${base}.library.md`];
        files.push(...names);
        const report = JSON.stringify({ appVersion: APP_VERSION, base, style: project.style, exact: project.exact ?? null, loop: item.loop });
        if (options.packaging === 'zip') {
          for (const name of names) zipEntries.push({ name, data: new TextEncoder().encode(name.endsWith('.wav') ? 'WAV' : report) });
        }
        ok += 1;
        items.push({
          index, base, style: item.style, mood: brief.mood, role: item.role, seconds: item.seconds, loop: item.loop,
          seed: project.seed, requestedSeed: project.style?.requestedSeed, reseeds: project.style?.reseeds ?? 0,
          bpm: project.bpm, key: project.key, bars: project.exact?.bars ?? project.bars,
          lufs: measured.lufs, truePeak: measured.truePeak,
          loopSeam: item.loop ? measured.seamStatus ?? 'ok' : undefined,
          exact: project.exact,
          similarity: composed.similarity, files: names, timingMs: Date.now() - itemStarted,
          warnings: composed.warnings, status: 'ok',
          usedRatings: composed.usedRatings,
        });
      } catch (err) {
        error += 1;
        items.push({ index, style: item.style, status: 'error', error: err instanceof Error ? err.message : 'Batch item failed', timingMs: Date.now() - itemStarted });
        if (options.stopOnError) break;
      }
      options.onProgress?.({
        itemIndex: index,
        itemTotal: list.length,
        fraction: (index + 1) / list.length,
        message: `${item.style} done`,
        itemMs: Date.now() - itemStarted,
      });
      await yieldToUi();
    }
    const manifestBody = {
      ok: true as const,
      batchId,
      startedAt: started.toISOString(),
      appVersion: APP_VERSION,
      options: { packaging: options.packaging ?? 'files', varietyGuard: options.varietyGuard ?? 'reseed' },
      items,
      files,
      totals: { ok, skipped, error, ms: Date.now() - t0 },
    };
    const libraryText = rows.join('\n');
    const creditsText = credits.join('\n');
    files.push('manifest.json', 'LIBRARY_ROWS.md', 'CREDITS_ROWS.md');
    if (options.packaging === 'zip') {
      zipEntries.push({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifestBody)) });
      zipEntries.push({ name: 'LIBRARY_ROWS.md', data: new TextEncoder().encode(libraryText) });
      zipEntries.push({ name: 'CREDITS_ROWS.md', data: new TextEncoder().encode(creditsText) });
      return { ...manifestBody, files, zip: zipStore(zipEntries) };
    }
    return manifestBody;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Batch failed' };
  }
}
