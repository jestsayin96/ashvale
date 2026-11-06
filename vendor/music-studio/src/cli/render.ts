/**
 * Headless cue-sheet renderer. Pure planning/synthesis via pureBackend.
 * Entry: cli/render.ts → npm run render -- <sheet> --out <dir>
 */

import { encodeWav } from '../audio/render/wav';
import { measureLufs } from '../dsp/lufs';
import { measurePeaks } from '../dsp/truepeak';
import { safeName } from '../io/download';
import { newProject } from '../model/defaults';
import { loadSampleLibraryFromDir, setCachedLibrary, type LoadResult } from '../samples/library';
import { extractScoreRequest } from '../score/parseRequest';
import { planScore } from '../score/arranger';
import { analyzeCues, buildScoreListenReport, compactLoudness, renderScoreListenMarkdown, serializeListenReport } from '../score/cueAnalysis';
import { renderScore } from '../score/render';
import { countSamplesUsed, sampleScoreEventsFromProject } from '../score/sampleEvents';
import { buildSyncReport, cuesCsv, edlText, syncMarkdown } from '../score/sync';
import { pureBackend } from '../score/pureBackend';
import {
  DEFAULT_CEILING_DBTP,
  DEFAULT_DUCK_DB,
  DEFAULT_END_FADE_MS,
  DEFAULT_MUSIC_LUFS,
  DEFAULT_SPEECH_DIP_DB,
  DEFAULT_TARGET_LUFS,
  SAMPLE_RATE,
} from '../score/targets';
import { prepareStemFiles } from '../io/stems';
import { getCachedLibrary } from '../samples/library';
import {
  DEFAULT_VOCAL_UNDER_BED_DB,
  mixBedAndVocals,
  parseLayersJson,
  renderLayersBus,
  type LayersFile,
} from '../score/layers';
import { composeProject } from '../style/compose';
import { APP_VERSION } from '../version';

export const RENDER_USAGE =
  'Usage: npm run render -- <cue-sheet> --out <dir> [--seed N] [--style id] [--mood hype|playful|lowkey] [--samples <dir>] [--no-samples] [--layers <json>] [--vocal-db <n>] [--stems] [--sample-rate 44100|48000] [--bit-depth 16|24]';

export interface RenderCliArgs {
  input?: string;
  out?: string;
  seed?: number;
  style?: string;
  mood?: 'hype' | 'playful' | 'lowkey';
  samples?: string;
  noSamples?: boolean;
  stems?: boolean;
  layers?: string;
  vocalDb?: number;
  sampleRate?: 44100 | 48000;
  bitDepth?: 16 | 24;
  help?: boolean;
}

export interface RenderSummary {
  ok: boolean;
  files: string[];
  seconds: number;
  lufs: number;
  truePeakDbtp: number;
  samplesLoaded: number;
  samplesUsed?: Record<string, number>;
  exitCode: number;
  error?: string;
  warnings?: string[];
}

export function parseRenderArgs(argv: string[]): RenderCliArgs | { error: string } {
  const args: RenderCliArgs = { stems: false, bitDepth: 16, sampleRate: 44100 };
  const rest = [...argv];
  while (rest.length) {
    const token = rest.shift()!;
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token === '--out') {
      args.out = rest.shift();
      if (!args.out) return { error: '--out needs a directory' };
      continue;
    }
    if (token === '--seed') {
      const raw = rest.shift();
      const n = Number(raw);
      if (!Number.isFinite(n)) return { error: '--seed must be a number' };
      args.seed = n >>> 0;
      continue;
    }
    if (token === '--style') {
      args.style = rest.shift();
      if (!args.style) return { error: '--style needs an id' };
      continue;
    }
    if (token === '--mood') {
      const mood = rest.shift();
      if (mood !== 'hype' && mood !== 'playful' && mood !== 'lowkey') return { error: '--mood must be hype, playful, or lowkey' };
      args.mood = mood;
      continue;
    }
    if (token === '--samples') {
      args.samples = rest.shift();
      if (!args.samples) return { error: '--samples needs a directory' };
      continue;
    }
    if (token === '--no-samples') {
      args.noSamples = true;
      continue;
    }
    if (token === '--stems') {
      args.stems = true;
      continue;
    }
    if (token === '--sample-rate') {
      const n = Number(rest.shift());
      if (n !== 44100 && n !== 48000) return { error: '--sample-rate must be 44100 or 48000' };
      args.sampleRate = n;
      continue;
    }
    if (token === '--bit-depth') {
      const n = Number(rest.shift());
      if (n !== 16 && n !== 24) return { error: '--bit-depth must be 16 or 24' };
      args.bitDepth = n;
      continue;
    }
    if (token === '--layers') {
      args.layers = rest.shift();
      if (!args.layers) return { error: '--layers needs a JSON path' };
      continue;
    }
    if (token === '--vocal-db') {
      const n = Number(rest.shift());
      if (!Number.isFinite(n)) return { error: '--vocal-db must be a number (LUFS delta vs bed; default -3.5)' };
      args.vocalDb = n;
      continue;
    }
    if (token.startsWith('-')) return { error: `Unknown flag: ${token}` };
    if (args.input) return { error: `Unexpected argument: ${token}` };
    args.input = token;
  }
  return args;
}

function unwrapMarkdownFence(text: string): string {
  const fenced = text.match(/```(?:json|text|cue)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : text.trim();
}

export async function runRender(
  argv: string[],
  io?: {
    readText?: (path: string) => Promise<string>;
    writeFile?: (path: string, data: Uint8Array | string) => Promise<void>;
    mkdir?: (path: string) => Promise<void>;
    loadSamples?: (dir: string, rate: number) => Promise<LoadResult>;
  },
): Promise<RenderSummary> {
  const parsed = parseRenderArgs(argv);
  if ('error' in parsed) {
    return fail(2, parsed.error);
  }
  if (parsed.help) {
    console.log(RENDER_USAGE);
    console.log('  --layers <json>   sample layer schedule (see examples/layers_example.json)');
    console.log(`  --vocal-db <n>    vocals LUFS relative to bed (default -${DEFAULT_VOCAL_UNDER_BED_DB})`);
    console.log('  --stems           write mix/music/sfx(/vocals) WAVs with LUFS + true-peak trim');
    console.log('  --help, -h        print this help and exit 0');
    return {
      ok: true,
      files: [],
      seconds: 0,
      lufs: 0,
      truePeakDbtp: 0,
      samplesLoaded: 0,
      samplesUsed: {},
      exitCode: 0,
      warnings: ['help'],
    };
  }
  if (!parsed.input || !parsed.out) {
    return fail(2, RENDER_USAGE);
  }

  const readText = io?.readText ?? defaultReadText;
  const writeFile = io?.writeFile ?? defaultWriteFile;
  const mkdir = io?.mkdir ?? defaultMkdir;
  const loadSamples = io?.loadSamples ?? ((dir: string, rate: number) => loadSampleLibraryFromDir(dir, rate));

  let text: string;
  try {
    text = unwrapMarkdownFence(await readText(parsed.input));
  } catch (err) {
    return fail(2, err instanceof Error ? err.message : `Could not read ${parsed.input}`);
  }

  const extracted = extractScoreRequest(text);
  if (!extracted.ok || !extracted.input || extracted.input.cues.length < 1) {
    const message = extracted.errors.map((row) => `line ${row.line}: ${row.message}`).join('; ')
      || extracted.warnings[0]
      || 'Cue sheet was not accepted';
    return fail(2, message);
  }

  const sheet = extracted.input;
  if (parsed.style) {
    sheet.video = { ...sheet.video, style: parsed.style };
  }

  const sampleRate = parsed.sampleRate ?? SAMPLE_RATE;
  const warnings: string[] = [...extracted.warnings];
  let samplesLoaded = 0;
  if (!parsed.noSamples) {
    const sampleDir = parsed.samples ?? 'public/samples';
    try {
      const loaded = await loadSamples(sampleDir, sampleRate);
      samplesLoaded = loaded.count;
      warnings.push(...loaded.warnings);
      for (const w of loaded.warnings) console.warn(w);
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : 'sample load failed');
    }
  } else {
    setCachedLibrary(new Map(), []);
  }

  try {
    const seed = parsed.seed ?? 1;
    const styleId = parsed.style ?? sheet.video?.style;
    const plan = planScore(sheet, {
      seed,
      endFadeMs: DEFAULT_END_FADE_MS,
      duckDb: DEFAULT_DUCK_DB,
      speechDipDb: DEFAULT_SPEECH_DIP_DB,
      style: styleId,
      ...(sampleRate !== SAMPLE_RATE ? { sampleRate } : {}),
    });

    // incredibox + loaded samples: schedule beat/voice layer hits into the score plan.
    if (styleId === 'incredibox' && samplesLoaded > 0 && !parsed.noSamples) {
      const mood = parsed.mood ?? 'lowkey';
      const made = composeProject(newProject(), {
        role: 'music',
        mood,
        seconds: Math.max(2, plan.videoLengthSeconds),
        seed,
        style: 'incredibox',
        lengthMode: 'exact',
      });
      warnings.push(...made.warnings);
      const sampleEvents = sampleScoreEventsFromProject(made.project, plan.videoLengthSeconds + 1);
      plan.events.push(...sampleEvents);
    }

    const samplesUsed = countSamplesUsed(plan.events);
    const rendered = await renderScore(plan, pureBackend, {
      mix: {
        musicLufs: DEFAULT_MUSIC_LUFS,
        targetLufs: DEFAULT_TARGET_LUFS,
        ceilingDbtp: DEFAULT_CEILING_DBTP,
        speechDipDb: DEFAULT_SPEECH_DIP_DB,
      },
    });
    if (!rendered.ok) return fail(1, rendered.error);

    let mix = rendered.mix;
    let music = rendered.music;
    const sfx = rendered.sfx;
    let vocalsBus: { left: Float32Array; right: Float32Array } | undefined;
    let vocalUnderBedDb: number | undefined;

    const layersFromCli = parsed.layers;
    const layersFromSheet = typeof sheet.options?.layers === 'string' ? sheet.options.layers : undefined;
    const layersPath = layersFromCli ?? layersFromSheet;
    if (layersPath) {
      // CLI --layers is cwd-relative; cue-sheet `layers:` is relative to the sheet file.
      const resolvedLayers = layersFromCli
        ? layersPath
        : resolveBeside(parsed.input!, layersPath);
      let layersRaw: unknown;
      try {
        layersRaw = JSON.parse(await readText(resolvedLayers));
      } catch (err) {
        return fail(2, err instanceof Error ? `layers: ${err.message}` : 'Could not read layers JSON');
      }
      const parsedLayers = parseLayersJson(layersRaw, {
        bpm: sheet.video.bpm ?? plan.sections[0]?.bpm,
        bars: Math.max(1, Math.ceil((plan.videoLengthSeconds * (sheet.video.bpm ?? 100)) / 240)),
      });
      if (!parsedLayers.ok || !parsedLayers.layers) {
        return fail(2, parsedLayers.errors.join('; ') || 'Invalid layers file');
      }
      const layerFile: LayersFile = parsedLayers.layers;
      const layerRender = renderLayersBus(layerFile, getCachedLibrary(), rendered.sampleRate, {
        lengthSeconds: mix.left.length / rendered.sampleRate,
      });
      warnings.push(...layerRender.warnings);
      for (const [id, count] of Object.entries(layerRender.samplesUsed)) {
        samplesUsed[id] = (samplesUsed[id] ?? 0) + count;
      }
      const vocalDb = parsed.vocalDb ?? -DEFAULT_VOCAL_UNDER_BED_DB;
      const mixed = mixBedAndVocals(mix, layerRender, rendered.sampleRate, vocalDb);
      mix = mixed.mix;
      music = mixed.bedScaled;
      vocalsBus = mixed.vocals;
      vocalUnderBedDb = mixed.underBedDb;
    }

    const syncReport = buildSyncReport(plan, sfx, rendered.sampleRate);
    const heard = analyzeCues(plan, mix, music, sfx, rendered.sampleRate);
    const loudness = compactLoudness(mix, rendered.sampleRate, plan, rendered.mixReport);
    const listenReport = buildScoreListenReport(plan, loudness, heard.perCue, heard.moodByCue, syncReport.summary, APP_VERSION);
    const bitDepth = parsed.bitDepth ?? 16;
    const base = safeName(plan.name || 'score');
    const wantStems = parsed.stems === true;
    await mkdir(parsed.out);
    const written: string[] = [];
    const write = async (filename: string, data: Uint8Array | string) => {
      const dest = joinPath(parsed.out!, filename);
      await writeFile(dest, data);
      written.push(filename);
    };

    await write(`${base}.score.wav`, encodeWav(mix.left, mix.right, rendered.sampleRate, bitDepth, seed));
    let stemReport: ReturnType<typeof prepareStemFiles>['report'] | undefined;
    if (wantStems) {
      await write(`${base}.music.wav`, encodeWav(music.left, music.right, rendered.sampleRate, bitDepth, seed));
      await write(`${base}.sfx.wav`, encodeWav(sfx.left, sfx.right, rendered.sampleRate, bitDepth, seed));
      const prepared = prepareStemFiles(base, rendered.sampleRate, bitDepth, seed, {
        mix,
        music,
        sfx,
        ...(vocalsBus ? { vocals: vocalsBus } : {}),
      }, { warnings, plan, listen: listenReport });
      stemReport = prepared.report;
      for (const file of prepared.files) await write(file.filename, file.data);
      await write('stems.report.json', JSON.stringify(prepared.report, null, 2));
    }

    const lufs = measureLufs(mix.left, mix.right, rendered.sampleRate).integrated;
    const peaks = measurePeaks(mix.left, mix.right);
    const report = {
      version: APP_VERSION,
      appVersion: APP_VERSION,
      name: plan.name,
      seed,
      sampleRate: rendered.sampleRate,
      samples: rendered.samples,
      seconds: mix.left.length / rendered.sampleRate,
      loudness: { integratedLufs: lufs, truePeakDbtp: peaks.truePeak, samplePeakDbfs: peaks.samplePeak },
      listenReport,
      syncReport,
      warnings,
      samplesLoaded,
      samplesUsed,
      ...(vocalUnderBedDb !== undefined ? { vocalUnderBedDb } : {}),
      files: written,
      ...(stemReport ? { filesDetail: stemReport.files } : {}),
    };
    await write('report.json', JSON.stringify(report, null, 2));
    await write('listen.md', renderScoreListenMarkdown(listenReport));
    await write(`${base}.sync.json`, JSON.stringify(syncReport, null, 2));
    await write(`${base}.sync.md`, syncMarkdown(syncReport));
    await write(`${base}.cues.csv`, cuesCsv(syncReport));
    await write(`${base}.edl.txt`, edlText(syncReport, plan.name || 'SCORE'));
    await write(`${base}.score.listen.json`, serializeListenReport(listenReport));
    await write(`${base}.score.listen.md`, renderScoreListenMarkdown(listenReport));
    await write(`${base}.cuesheet.json`, JSON.stringify(sheet, null, 2));

    const summary: RenderSummary = {
      ok: true,
      files: written,
      seconds: report.seconds,
      lufs,
      truePeakDbtp: peaks.truePeak,
      samplesLoaded,
      samplesUsed,
      exitCode: 0,
      warnings,
    };
    return summary;
  } catch (err) {
    return fail(1, err instanceof Error ? err.message : 'Render failed');
  }
}

function fail(exitCode: number, error: string): RenderSummary {
  return {
    ok: false,
    files: [],
    seconds: 0,
    lufs: 0,
    truePeakDbtp: 0,
    samplesLoaded: 0,
    exitCode,
    error,
  };
}

function joinPath(dir: string, file: string): string {
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
  return `${dir.replace(/[/\\]+$/, '')}${sep}${file}`;
}

/** Resolve a path relative to the cue sheet when it is not absolute. */
function resolveBeside(sheetPath: string, maybeRelative: string): string {
  if (/^[a-zA-Z]:[\\/]/.test(maybeRelative) || maybeRelative.startsWith('/') || maybeRelative.startsWith('\\')) {
    return maybeRelative;
  }
  const sep = sheetPath.includes('\\') && !sheetPath.includes('/') ? '\\' : '/';
  const parts = sheetPath.replace(/[/\\]+$/, '').split(/[/\\]/);
  parts.pop();
  return `${parts.join(sep)}${sep}${maybeRelative}`;
}

async function defaultReadText(filePath: string): Promise<string> {
  const fs = await import('node:fs/promises');
  return fs.readFile(filePath, 'utf8');
}

async function defaultWriteFile(filePath: string, data: Uint8Array | string): Promise<void> {
  const fs = await import('node:fs/promises');
  if (typeof data === 'string') await fs.writeFile(filePath, data, 'utf8');
  else await fs.writeFile(filePath, data);
}

async function defaultMkdir(dir: string): Promise<void> {
  const fs = await import('node:fs/promises');
  await fs.mkdir(dir, { recursive: true });
}

export function formatSummaryLine(summary: RenderSummary): string {
  return JSON.stringify({
    ok: summary.ok,
    files: summary.files,
    seconds: summary.seconds,
    lufs: summary.lufs,
    truePeakDbtp: summary.truePeakDbtp,
    samplesLoaded: summary.samplesLoaded,
    samplesUsed: summary.samplesUsed ?? {},
    ...(summary.error ? { error: summary.error } : {}),
  });
}
