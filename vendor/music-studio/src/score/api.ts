import { canvasToPngBytes, drawLoudness, drawSpectrogram, drawWaveform } from '../analysis/png';
import { loudnessPlot, spectrogramMatrix, waveformEnvelope } from '../analysis/plots';
import { measureLufs } from '../dsp/lufs';
import { measurePeaks } from '../dsp/truepeak';
import { encodeWav } from '../audio/render/wav';
import { downloadSequence, safeName } from '../io/download';
import { APP_VERSION } from '../version';
import { impactOffsetFor, planScore } from './arranger';
import { analyzeCues, buildScoreListenReport, compactLoudness, renderScoreListenMarkdown, scoreMarkers, serializeListenReport } from './cueAnalysis';
import { CUE_TYPES, SFX_NAMES, type CueSheet, type CueType, type SfxName } from './cues';
import { pureBackend } from './pureBackend';
import { renderScore, type RenderProgress } from './render';
import { buildSyncReport, cuesCsv, edlText, syncMarkdown, type SyncReport } from './sync';
import type { MixOptions } from './mixdown';
import type { ScoreEvent } from './plan';
import type { SynthBackend } from './backend';
import { webBackend } from './webBackend';
import { extractScoreRequest, parseCues } from './parseRequest';
import {
  DEFAULT_CEILING_DBTP,
  DEFAULT_DUCK_DB,
  DEFAULT_END_FADE_MS,
  DEFAULT_MUSIC_LUFS,
  DEFAULT_SPEECH_DIP_DB,
  DEFAULT_TARGET_LUFS,
  SAMPLE_RATE,
} from './targets';
import shortExample from '../../examples/short_multikill_death.cues.json';
import longExample from '../../examples/longform_10min.cues.json';
import funnyExample from '../../examples/funny_fail.cues.txt?raw';

export { extractScoreRequest, parseCues } from './parseRequest';

export interface ScoreVideoOptions {
  seed?: number;
  bitDepth?: 16 | 24;
  stems?: boolean;
  pictures?: boolean;
  sfxFiles?: boolean;
  tailSeconds?: number;
  endFadeMs?: number;
  musicLufs?: number;
  targetLufs?: number;
  ceilingDbtp?: number;
  duckDb?: number;
  speechDipDb?: number;
  mix?: MixOptions;
  download?: boolean;
  onProgress?: (progress: RenderProgress) => void;
  backend?: SynthBackend;
}

export interface ResolvedScoreOptions {
  seed: number;
  bitDepth: 16 | 24;
  stems: boolean;
  pictures: boolean;
  sfxFiles: boolean;
  tailSeconds: number;
  endFadeMs: number;
  musicLufs: number;
  targetLufs: number;
  ceilingDbtp: number;
  duckDb: number;
  speechDipDb: number;
  mix?: MixOptions;
  download: boolean;
  onProgress?: (progress: RenderProgress) => void;
  backend: SynthBackend;
}

export interface ScoreSuccess {
  ok: true;
  files: string[];
  syncReport: SyncReport;
  listenReport: ReturnType<typeof buildScoreListenReport>;
  moodByCue: ReturnType<typeof analyzeCues>['moodByCue'];
  summary: string;
  warnings: string[];
  playback: { left: Float32Array; right: Float32Array; sampleRate: number; seconds: number };
}

export interface ScoreFailure {
  ok: false;
  error: string;
}

export function defaultScoreBackend(): SynthBackend {
  if (typeof OfflineAudioContext !== 'undefined') return webBackend;
  return pureBackend;
}

export function resolveScoreOptions(options: ScoreVideoOptions = {}): ResolvedScoreOptions {
  return {
    seed: options.seed === undefined ? 1 : options.seed >>> 0,
    bitDepth: options.bitDepth === 24 ? 24 : 16,
    stems: options.stems !== false,
    pictures: options.pictures !== false,
    sfxFiles: options.sfxFiles === true,
    tailSeconds: options.tailSeconds ?? 0,
    endFadeMs: options.endFadeMs ?? DEFAULT_END_FADE_MS,
    musicLufs: options.musicLufs ?? DEFAULT_MUSIC_LUFS,
    targetLufs: options.targetLufs ?? DEFAULT_TARGET_LUFS,
    ceilingDbtp: options.ceilingDbtp ?? DEFAULT_CEILING_DBTP,
    duckDb: options.duckDb ?? DEFAULT_DUCK_DB,
    speechDipDb: options.speechDipDb ?? DEFAULT_SPEECH_DIP_DB,
    mix: options.mix,
    download: options.download !== false,
    onProgress: options.onProgress,
    backend: options.backend ?? defaultScoreBackend(),
  };
}

export function scoreFileNames(
  videoName: string | undefined,
  options: { stems: boolean; pictures: boolean; tailSeconds: number; sfxEvents?: Array<{ index: number; voice: string }> },
): string[] {
  const base = safeName(videoName || 'score');
  const tail = options.tailSeconds > 0 ? '_tail' : '';
  const names = [`${base}.score${tail}.wav`];
  if (options.stems) names.push(`${base}.music${tail}.wav`, `${base}.sfx${tail}.wav`);
  names.push(
    `${base}.sync.json`,
    `${base}.sync.md`,
    `${base}.cues.csv`,
    `${base}.edl.txt`,
    `${base}.score.listen.json`,
    `${base}.score.listen.md`,
  );
  if (options.pictures) {
    names.push(`${base}.score.spectrogram.png`, `${base}.score.loudness.png`, `${base}.score.waveform.png`);
  }
  names.push(`${base}.cuesheet.json`);
  for (const event of options.sfxEvents ?? []) {
    names.push(`${base}.sfx_${event.index}_${safeName(event.voice)}.wav`);
  }
  return names;
}

export function looksLikeScoreInput(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const raw = JSON.parse(trimmed) as unknown;
      if (!raw || typeof raw !== 'object') return false;
      const obj = raw as Record<string, unknown>;
      if (obj.op === 'score') return true;
      if (Array.isArray(obj.cues)) return true;
      const sheet = obj.sheet;
      return !!sheet && typeof sheet === 'object' && Array.isArray((sheet as { cues?: unknown }).cues);
    } catch {
      return false;
    }
  }
  const parsed = parseCues(trimmed);
  return parsed.ok && (parsed.sheet?.cues.length ?? 0) >= 1;
}

export async function scoreVideo(input: unknown, options: ScoreVideoOptions = {}): Promise<ScoreSuccess | ScoreFailure> {
  const started = performance.now();
  try {
    const extracted = extractScoreRequest(input);
    if (!extracted.ok || !extracted.input || extracted.input.cues.length < 1) {
      return { ok: false, error: extracted.errors[0]?.message || extracted.warnings[0] || 'Cue sheet was not accepted' };
    }
    const merged: ScoreVideoOptions = { ...extracted.options };
    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined) (merged as Record<string, unknown>)[key] = value;
    }
    const opts = resolveScoreOptions(merged);
    const planStarted = performance.now();
    opts.onProgress?.({ fraction: 0.02, message: 'plan' });
    const plan = planScore(extracted.input, {
      seed: opts.seed,
      endFadeMs: opts.endFadeMs,
      duckDb: opts.duckDb,
      speechDipDb: opts.speechDipDb,
    });
    const planMs = performance.now() - planStarted;
    const renderStarted = performance.now();
    opts.onProgress?.({ fraction: 0.08, message: 'render' });
    const rendered = await renderScore(plan, opts.backend, {
      onProgress: opts.onProgress,
      tailSeconds: opts.tailSeconds,
      mix: {
        ...opts.mix,
        musicLufs: opts.musicLufs,
        targetLufs: opts.targetLufs,
        ceilingDbtp: opts.ceilingDbtp,
        speechDipDb: opts.speechDipDb,
      },
    });
    if (!rendered.ok) return rendered;
    const renderMs = Math.max(0, performance.now() - renderStarted - rendered.mixMs);
    const mixMs = rendered.mixMs;
    opts.onProgress?.({ fraction: 0.72, message: 'analysis' });
    const analysisStarted = performance.now();
    const syncReport = buildSyncReport(plan, rendered.sfx, rendered.sampleRate);
    const heard = analyzeCues(plan, rendered.mix, rendered.music, rendered.sfx, rendered.sampleRate);
    const analysisMs = performance.now() - analysisStarted;
    const loudness = compactLoudness(rendered.mix, rendered.sampleRate, plan, rendered.mixReport);
    const listenReport = buildScoreListenReport(plan, loudness, heard.perCue, heard.moodByCue, syncReport.summary, APP_VERSION);
    const sfxEvents = opts.sfxFiles
      ? plan.events.filter((event) => event.bus === 'sfx').map((event, index) => ({ index, voice: event.voice, event }))
      : [];
    let pictures = opts.pictures;
    const pictureItems: Array<{ data: Uint8Array; filename: string; mime: string }> = [];
    const picturesStarted = performance.now();
    opts.onProgress?.({ fraction: 0.84, message: 'pictures' });
    if (pictures) {
      try {
        const title = `${plan.name}  ${plan.videoLengthSeconds.toFixed(1)} s`;
        const markers = scoreMarkers(plan);
        const spec = drawSpectrogram(null, spectrogramMatrix(rendered.mix.left, rendered.mix.right, rendered.sampleRate), title, markers);
        const loud = drawLoudness(null, loudnessPlot(rendered.mix.left, rendered.mix.right, rendered.sampleRate, opts.targetLufs), title, markers);
        const wave = drawWaveform(
          null,
          waveformEnvelope(rendered.mix.left, rendered.mix.right, rendered.sampleRate),
          title,
          rendered.mix.left.length / rendered.sampleRate,
          markers,
        );
        const base = safeName(plan.name || 'score');
        pictureItems.push(
          { data: await canvasToPngBytes(spec), filename: `${base}.score.spectrogram.png`, mime: 'image/png' },
          { data: await canvasToPngBytes(loud), filename: `${base}.score.loudness.png`, mime: 'image/png' },
          { data: await canvasToPngBytes(wave), filename: `${base}.score.waveform.png`, mime: 'image/png' },
        );
      } catch {
        pictures = false;
      }
    }
    const picturesMs = performance.now() - picturesStarted;
    const encodeStarted = performance.now();
    opts.onProgress?.({ fraction: 0.92, message: 'encoding' });
    const names = scoreFileNames(plan.name, {
      stems: opts.stems,
      pictures,
      tailSeconds: opts.tailSeconds,
      sfxEvents: sfxEvents.map((event) => ({ index: event.index, voice: event.voice })),
    });
    const bitDepth = opts.bitDepth;
    const seed = plan.seed || 1;
    const byName = new Map<string, { data: Uint8Array | string; filename: string; mime: string }>();
    const base = safeName(plan.name || 'score');
    const tail = opts.tailSeconds > 0 ? '_tail' : '';
    byName.set(`${base}.score${tail}.wav`, { data: encodeWav(rendered.mix.left, rendered.mix.right, rendered.sampleRate, bitDepth, seed), filename: `${base}.score${tail}.wav`, mime: 'audio/wav' });
    if (opts.stems) {
      byName.set(`${base}.music${tail}.wav`, { data: encodeWav(rendered.music.left, rendered.music.right, rendered.sampleRate, bitDepth, seed), filename: `${base}.music${tail}.wav`, mime: 'audio/wav' });
      byName.set(`${base}.sfx${tail}.wav`, { data: encodeWav(rendered.sfx.left, rendered.sfx.right, rendered.sampleRate, bitDepth, seed), filename: `${base}.sfx${tail}.wav`, mime: 'audio/wav' });
    }
    byName.set(`${base}.sync.json`, { data: JSON.stringify(syncReport, null, 2), filename: `${base}.sync.json`, mime: 'application/json' });
    byName.set(`${base}.sync.md`, { data: syncMarkdown(syncReport), filename: `${base}.sync.md`, mime: 'text/markdown' });
    byName.set(`${base}.cues.csv`, { data: cuesCsv(syncReport), filename: `${base}.cues.csv`, mime: 'text/csv' });
    byName.set(`${base}.edl.txt`, { data: edlText(syncReport, plan.name || 'SCORE'), filename: `${base}.edl.txt`, mime: 'text/plain' });
    const stagedMs = planMs + renderMs + mixMs + analysisMs + picturesMs;
    const timing = {
      planMs, renderMs, mixMs, analysisMs, picturesMs,
      encodeMs: 0,
      saveMs: 0,
      totalMs: stagedMs,
      sentence: `Timing: total ${(stagedMs / 1000).toFixed(2)} s (render ${(renderMs / 1000).toFixed(2)}, mix ${(mixMs / 1000).toFixed(2)}, analysis ${(analysisMs / 1000).toFixed(2)}, pictures ${(picturesMs / 1000).toFixed(2)})`,
    };
    listenReport.meta.timing = timing;
    byName.set(`${base}.score.listen.json`, { data: serializeListenReport(listenReport), filename: `${base}.score.listen.json`, mime: 'application/json' });
    byName.set(`${base}.score.listen.md`, { data: renderScoreListenMarkdown(listenReport), filename: `${base}.score.listen.md`, mime: 'text/markdown' });
    for (const picture of pictureItems) byName.set(picture.filename, picture);
    byName.set(`${base}.cuesheet.json`, { data: JSON.stringify(extracted.input, null, 2), filename: `${base}.cuesheet.json`, mime: 'application/json' });
    for (const event of sfxEvents) {
      const filename = `${base}.sfx_${event.index}_${safeName(event.voice)}.wav`;
      const alone = await renderOneEvent(event.event, opts.backend, rendered.sampleRate);
      byName.set(filename, { data: encodeWav(alone.left, alone.right, rendered.sampleRate, bitDepth, seed), filename, mime: 'audio/wav' });
    }
    timing.encodeMs = performance.now() - encodeStarted;
    let items = names.map((filename) => byName.get(filename)).filter((item): item is { data: Uint8Array | string; filename: string; mime: string } => !!item);
    const saveStarted = performance.now();
    opts.onProgress?.({ fraction: 0.97, message: 'saving' });
    if (opts.download) await downloadSequence(items, 500);
    timing.saveMs = performance.now() - saveStarted;
    timing.totalMs = performance.now() - started;
    timing.sentence = `Timing: total ${(timing.totalMs / 1000).toFixed(2)} s (render ${(timing.renderMs / 1000).toFixed(2)}, mix ${(timing.mixMs / 1000).toFixed(2)}, analysis ${(timing.analysisMs / 1000).toFixed(2)}, pictures ${(timing.picturesMs / 1000).toFixed(2)})`;
    listenReport.meta.timing = timing;
    const listenName = `${base}.score.listen.json`;
    const listenItem = { data: serializeListenReport(listenReport), filename: listenName, mime: 'application/json' };
    byName.set(listenName, listenItem);
    items = items.map((item) => (item.filename === listenName ? listenItem : item));
    const summary = [
      `Rendered ${rendered.samples} samples at ${rendered.sampleRate} Hz.`,
      `Integrated loudness reads ${rendered.mixReport.integratedLufs.toFixed(2)} LUFS.`,
      `True peak reads ${rendered.mixReport.truePeakDbtp.toFixed(2)} dBTP.`,
      `Sync pass reads ${syncReport.summary.pass}.`,
      timing.sentence,
      pictures ? '' : opts.pictures ? 'Pictures were skipped because canvas is unavailable.' : '',
      extracted.warnings.length ? `Warnings: ${extracted.warnings.join(' ')}` : '',
    ].filter(Boolean).join(' ');
    const result: ScoreSuccess = {
      ok: true,
      files: items.map((item) => item.filename),
      syncReport,
      listenReport,
      moodByCue: heard.moodByCue,
      summary,
      warnings: extracted.warnings,
      playback: {
        left: rendered.mix.left,
        right: rendered.mix.right,
        sampleRate: rendered.sampleRate,
        seconds: rendered.mix.left.length / rendered.sampleRate,
      },
    };
    Object.defineProperty(result, 'playback', { enumerable: false });
    opts.onProgress?.({ fraction: 1, message: 'done' });
    return result;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Score failed' };
  }
}

export async function previewCue(
  type: string,
  intensity = 0.6,
  hooks?: { startAudio?: () => Promise<void>; play?: (left: Float32Array, right: Float32Array, sampleRate: number) => void },
): Promise<{ ok: true; seconds: number } | ScoreFailure> {
  try {
    const name = String(type || '').toLowerCase();
    if (!(CUE_TYPES as readonly string[]).includes(name)) return { ok: false, error: `Unknown cue type: ${type}` };
    const seconds = 7;
    const cue: CueSheet['cues'][number] = {
      t: 0.4,
      duration: 6,
      type: name as CueType,
      intensity: Math.max(0, Math.min(1, intensity)),
    };
    if (name === 'multikill') cue.count = 3;
    if (name === 'sfx') cue.sfx = 'impact';
    const sheet: CueSheet = { version: 1, video: { lengthSeconds: seconds, name: name }, cues: [cue] };
    const scored = await scoreVideo(sheet, { download: false, pictures: false, stems: false, seed: 1 });
    if (!scored.ok) return scored;
    if (hooks?.startAudio) await hooks.startAudio();
    hooks?.play?.(scored.playback.left, scored.playback.right, scored.playback.sampleRate);
    return { ok: true, seconds };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Preview failed' };
  }
}

export async function scoreSfx(
  type: string,
  params: { intensity?: number; pitch?: number; duration?: number; seed?: number; download?: boolean } = {},
): Promise<
  | { ok: true; name: string; sampleRate: number; samples: number; durationSeconds: number; impactSeconds: number; measurements: { peakDb: number; truePeakDbtp: number; lufs: number } }
  | ScoreFailure
> {
  try {
    const name = String(type || '').toLowerCase();
    if (!(SFX_NAMES as readonly string[]).includes(name)) return { ok: false, error: `Unknown SFX: ${type}` };
    const duration = params.duration ?? 0.45;
    const seed = (params.seed ?? 1) >>> 0;
    const event: ScoreEvent = {
      id: 'sfx-preview',
      bus: 'sfx',
      voice: name,
      time: 0.02,
      duration,
      vel: params.intensity ?? 0.8,
      note: params.pitch ?? 60,
      impactOffset: impactOffsetFor(name as SfxName, duration),
      params: { levelDb: 0, pitch: params.pitch ?? 60 },
    };
    const backend = defaultScoreBackend();
    const audio = await renderOneEvent(event, backend, SAMPLE_RATE);
    const peaks = measurePeaks(audio.left, audio.right);
    const loud = measureLufs(audio.left, audio.right, SAMPLE_RATE);
    if (params.download) {
      const filename = `${safeName(name)}_${seed}.wav`;
      await downloadSequence([{ data: encodeWav(audio.left, audio.right, SAMPLE_RATE, 16, seed || 1), filename, mime: 'audio/wav' }], 0);
    }
    return {
      ok: true,
      name,
      sampleRate: SAMPLE_RATE,
      samples: audio.left.length,
      durationSeconds: audio.left.length / SAMPLE_RATE,
      impactSeconds: event.impactOffset ?? 0,
      measurements: { peakDb: peaks.samplePeak, truePeakDbtp: peaks.truePeak, lufs: loud.integrated },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'SFX render failed' };
  }
}

export async function selfTestScore(onProgress?: (progress: RenderProgress) => void): Promise<{ ok: boolean; lines: string[] }> {
  try {
    if (typeof OfflineAudioContext === 'undefined') {
      return { ok: false, lines: [`APP_VERSION ${APP_VERSION}`, 'FAIL  web audio: OfflineAudioContext is missing, so the real voices were not rendered.'] };
    }
    const examples: Array<{ name: string; input: unknown }> = [
      { name: 'short', input: shortExample },
      { name: 'funny', input: funnyExample },
      { name: 'long', input: longExample },
    ];
    const lines: string[] = [`APP_VERSION ${APP_VERSION}`];
    let ok = true;
    for (const example of examples) {
      onProgress?.({ fraction: 0, message: `Score self-test ${example.name}` });
      const scored = await scoreVideo(example.input, {
        download: false,
        pictures: false,
        stems: false,
        backend: webBackend,
        onProgress,
      });
      if (!scored.ok) {
        ok = false;
        lines.push(`FAIL  ${example.name}: ${scored.error}`);
        continue;
      }
      const lengthOk = scored.syncReport.lengthOk;
      const syncOk = scored.syncReport.summary.pass;
      const peak = scored.listenReport.loudness.truePeakDbtp ?? 0;
      const lufs = scored.listenReport.loudness.integratedLufs ?? -120;
      const peakOk = peak <= -1;
      const lufsOk = Math.abs(lufs - DEFAULT_TARGET_LUFS) <= 1;
      const onsets = scored.syncReport.cues.flatMap((cue) => cue.sfx.map((item) => item.measuredOnsetErrorMs).filter((value): value is number => value !== null));
      const onsetOk = onsets.every((value) => Math.abs(value) <= 5);
      if (!lengthOk || !syncOk || !peakOk || !lufsOk || !onsetOk) ok = false;
      lines.push(`${lengthOk ? 'PASS' : 'FAIL'}  ${example.name} length: ${scored.syncReport.actualSamples} samples`);
      lines.push(`${syncOk ? 'PASS' : 'FAIL'}  ${example.name} sync: sfx ${scored.syncReport.summary.maxSfxErrorMs.toFixed(3)} ms, boundary ${scored.syncReport.summary.maxBoundaryErrorMs.toFixed(3)} ms`);
      lines.push(`${peakOk ? 'PASS' : 'FAIL'}  ${example.name} true peak: ${peak.toFixed(2)} dBTP`);
      lines.push(`${lufsOk ? 'PASS' : 'FAIL'}  ${example.name} LUFS: ${lufs.toFixed(2)} (target ${DEFAULT_TARGET_LUFS})`);
      const peaks = scored.syncReport.cues.flatMap((cue) => cue.sfx.map((item) => item.peakOffsetMs).filter((value): value is number => value !== null));
      lines.push(`${onsetOk ? 'PASS' : 'FAIL'}  ${example.name} measured onsets: ${onsets.map((value) => value.toFixed(3)).join(', ') || 'none'}`);
      lines.push(`INFO  ${example.name} peak offsets: ${peaks.map((value) => value.toFixed(3)).join(', ') || 'none'}`);
      for (const cue of scored.listenReport.perCue) {
        lines.push(`${cue.verdict.toUpperCase()}  ${example.name} ${cue.type}@${cue.t}: ${JSON.stringify(cue.numbers)}${cue.suggestion ? ` ${cue.suggestion}` : ''}`);
      }
      if (scored.listenReport.meta.timing) lines.push(scored.listenReport.meta.timing.sentence);
    }
    return { ok, lines };
  } catch (err) {
    return { ok: false, lines: [err instanceof Error ? err.message : 'Score self-test failed'] };
  }
}

async function renderOneEvent(event: ScoreEvent, backend: SynthBackend, sampleRate: number): Promise<{ left: Float32Array; right: Float32Array }> {
  const seconds = Math.max(0.2, event.time + event.duration + (event.impactOffset ?? 0) + 0.2);
  const length = Math.round(seconds * sampleRate);
  const stems = await backend.render([event], 0, length, sampleRate);
  return stems.sfx ?? stems.melody;
}
