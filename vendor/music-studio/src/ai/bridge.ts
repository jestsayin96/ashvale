import { buildListenReport, renderListenMarkdown, type ListenReport } from '../analysis/listen';
import { canvasToPngBytes, drawLoudness, drawSpectrogram, drawWaveform } from '../analysis/png';
import { loudnessPlot, spectrogramMatrix, waveformEnvelope } from '../analysis/plots';
import { encodeWav } from '../audio/render/wav';
import { downloadBytes, downloadSequence, safeName } from '../io/download';
import { buildReport, renderAndNormalize } from '../io/exportProject';
import { prepareStemFiles } from '../io/stems';
import { addRating, browserStorage, isRatingValue, loadRatings, type Rating, type RatingBrief, type RatingMetrics } from '../io/ratings';
import type { Project, VideoRole } from '../model/types';
import { describeProject, loopSeconds, type VideoBrief } from '../model/video';
import { NOTE_NAMES } from '../model/scales';
import { APP_VERSION } from '../version';
import type { LoopOptions } from '../ui/loopPanel';
import type { Shell } from '../ui/transport';
import { parseCues, previewCue, scoreSfx, scoreVideo, selfTestScore, type ScoreVideoOptions } from '../score/api';
import type { CueSheet } from '../score/cues';
import { AI_HELP, applyCommand, applyCommandAsync, type CommandResult } from './commands';
import { runBatch, cancelBatch, type BatchItem, type BatchOptions, type BatchManifest } from '../style/batch';
import { catalog } from '../style/catalog';
import { profileFromLibraryRow, runMatch, type MatchProfile, type MatchRunOptions } from '../style/match';
import { aggregatePreferences } from '../style/preferences';
import { fingerprintOf, importFingerprints, loadFingerprints, logFingerprint } from '../style/fingerprint';
import { styledBaseName } from '../style/naming';
import type { ComposeBrief } from '../style/compose';
import { getCachedLibrary, listSamples, loadSampleLibrary, setCachedLibrary } from '../samples/library';

export interface MusicStudioApi {
  version: string;
  help(): string;
  getProject(): Project;
  compose(brief: ComposeBrief): CommandResult;
  run(command: unknown): CommandResult | Promise<CommandResult>;
  loadSamples(url?: string): Promise<{ ok: true; count: number; warnings: string[] } | { ok: false; error: string }>;
  listSamples(): ReturnType<typeof listSamples>;
  exportWav(options?: { bitDepth?: 16 | 24; pictures?: boolean }): Promise<
    | { ok: true; wavName: string; reportName: string; summary: string; listenName?: string; listenMdName?: string }
    | { ok: false; error: string }
  >;
  describe(): Promise<{ ok: true; report: ListenReport } | { ok: false; error: string }>;
  exportAll(options?: { bitDepth?: 16 | 24; stems?: boolean }): Promise<
    | { ok: true; files: string[]; report: ListenReport; summary: string }
    | { ok: false; error: string }
  >;
  exportStems(options?: { bitDepth?: 16 | 24; sheet?: CueSheet | string; seed?: number }): Promise<
    | { ok: true; files: string[]; report: import('../io/stems').StemExportReport; summary: string }
    | { ok: false; error: string }
  >;
  rate(input: { rating: string; note?: string; seed?: number; brief?: RatingBrief | null }): Promise<
    | { ok: true; entry: Rating }
    | { ok: false; error: string }
  >;
  getRatings(): Rating[];
  downloadRatings(): string;
  parseCues(text: unknown): ReturnType<typeof parseCues>;
  scoreVideo(cueSheet: CueSheet | string, options?: ScoreVideoOptions): ReturnType<typeof scoreVideo>;
  previewCue(type: string, intensity?: number): ReturnType<typeof previewCue>;
  sfx(type: string, params?: { intensity?: number; pitch?: number; duration?: number; seed?: number; download?: boolean }): ReturnType<typeof scoreSfx>;
  selfTestScore(): ReturnType<typeof selfTestScore>;
  batch(plan: BatchItem[] | { name?: string; items: BatchItem[] } | string, options?: BatchOptions): Promise<BatchManifest | { ok: false; error: string }>;
  cancelBatch(): void;
  catalog(): ReturnType<typeof catalog>;
  getFingerprints(): ReturnType<typeof loadFingerprints>;
  importFingerprints(json: unknown): ReturnType<typeof importFingerprints>;
  exportFingerprints(): string;
  logFingerprint(): { ok: true; id: string } | { ok: false; error: string };
  match(profile: MatchProfile, options?: MatchRunOptions): ReturnType<typeof runMatch>;
  profileFromLibraryRow(text: string): ReturnType<typeof profileFromLibraryRow>;
  preferences(): ReturnType<typeof aggregatePreferences>;
}

declare global {
  interface Window {
    musicStudio: MusicStudioApi;
  }
}

let lastBrief: VideoBrief | null = null;
let cacheKey = '';
let cacheReport: ListenReport | null = null;

function projectHash(project: Project): string {
  const text = JSON.stringify(project);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function rememberBrief(project: Project): void {
  const mood = project.mood;
  const origin = project.origin;
  if (!origin) return;
  if (mood !== 'hype' && mood !== 'playful' && mood !== 'lowkey') return;
  lastBrief = {
    role: origin.role,
    mood,
    seconds: origin.requestedSeconds,
    seed: project.seed,
    name: project.name,
  };
}

function briefFor(project: Project, given?: RatingBrief | null): RatingBrief | null {
  if (given) return given;
  if (lastBrief) {
    return {
      role: lastBrief.role,
      mood: lastBrief.mood,
      seconds: lastBrief.seconds,
      name: lastBrief.name,
      seed: lastBrief.seed,
    };
  }
  if (!project.origin) return null;
  return {
    role: project.origin.role,
    mood: project.mood ?? 'custom',
    seconds: project.origin.loopSeconds,
    name: project.name,
    seed: project.seed,
  };
}

function metricsOf(report: ListenReport): RatingMetrics {
  return {
    bpm: report.meta.bpm,
    onsetsPerSecond: report.musical.rhythmicDensity,
    synthNotesPerBar: report.musical.notesPerBarMean,
    centroidMedianHz: report.brightness.centroidMedianHz,
    loudnessMovement: report.loudness.loudnessMovement,
    integratedLufs: report.loudness.integratedLufs,
    truePeak: report.loudness.truePeakDbtp,
    speechShare: report.speechRoom.speechShare,
    moodScores: report.mood.scores,
    seamStatus: report.seam.status,
  };
}

function keyLabel(project: Project): string {
  const root = NOTE_NAMES[((project.key.root % 12) + 12) % 12];
  return `${root} ${project.key.scale}`;
}

async function pictureBytes(project: Project, left: Float32Array, right: Float32Array, sampleRate: number): Promise<Array<{ data: Uint8Array; filename: string; mime: string }>> {
  const base = safeName(project.name);
  const title = `${project.name}  ${Math.round(project.bpm)} BPM  ${keyLabel(project)}`;
  const spec = drawSpectrogram(null, spectrogramMatrix(left, right, sampleRate), title);
  const loud = drawLoudness(null, loudnessPlot(left, right, sampleRate, project.master.targetLufs), title);
  const seconds = loopSeconds(project.bars, project.bpm);
  const wave = drawWaveform(
    null,
    waveformEnvelope(left, right, sampleRate, 600, (4 * 60) / project.bpm),
    title,
    seconds,
  );
  return [
    { data: await canvasToPngBytes(spec), filename: `${base}.spectrogram.png`, mime: 'image/png' },
    { data: await canvasToPngBytes(loud), filename: `${base}.loudness.png`, mime: 'image/png' },
    { data: await canvasToPngBytes(wave), filename: `${base}.waveform.png`, mime: 'image/png' },
  ];
}

export function installMusicStudio(shell: Shell, loopOptions: LoopOptions): MusicStudioApi {
  function loopOpts(): { snap: boolean; crossfadeMs: number } {
    return { snap: loopOptions.snap, crossfadeMs: loopOptions.crossfade ? loopOptions.crossfadeMs : 0 };
  }

  async function describeProjectAudio(project: Project): Promise<{ ok: true; report: ListenReport; left: Float32Array; right: Float32Array; sampleRate: number; seam: import('../dsp/seam').SeamReport; norm: import('../dsp/normalize').NormalizeResult } | { ok: false; error: string }> {
    const key = projectHash(project);
    try {
      const rendered = await renderAndNormalize(project, loopOpts());
      const report = buildListenReport(project, rendered.norm.left, rendered.norm.right, rendered.loop.sampleRate, rendered.norm.report, rendered.seam);
      cacheKey = key;
      cacheReport = report;
      return { ok: true, report, left: rendered.norm.left, right: rendered.norm.right, sampleRate: rendered.loop.sampleRate, seam: rendered.seam, norm: rendered.norm };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Describe failed' };
    }
  }

  function take(result: CommandResult): CommandResult {
    if (result.ok && result.project && result.op !== 'get' && result.op !== 'export' && result.op !== 'describe') {
      shell.replaceProject(result.project);
      shell.status(result.summary);
      if (result.op === 'compose') rememberBrief(result.project);
    }
    return result;
  }

  const api: MusicStudioApi = {
    version: APP_VERSION,
    help: () => AI_HELP,
    getProject: () => structuredClone(shell.project),
    compose: (brief) => {
      lastBrief = brief;
      const ratings = brief.useRatings ? loadRatings(browserStorage()) : undefined;
      return take(applyCommand(shell.project, { op: 'compose', ...brief, ...(ratings ? { ratings } : {}) }));
    },
    run: (command) => {
      let raw: unknown = command;
      if (typeof command === 'string') {
        try { raw = JSON.parse(command); } catch { /* applyCommandAsync/applyCommand report parse errors */ }
      }
      const op = raw && typeof raw === 'object' && raw !== null && 'op' in raw ? String((raw as { op: unknown }).op) : '';
      if (op === 'loadSamples') {
        return applyCommandAsync(shell.project, command, (url) => api.loadSamples(url)).then(take);
      }
      return take(applyCommand(shell.project, command));
    },
    loadSamples: async (url) => {
      try {
        const result = await loadSampleLibrary(fetch.bind(globalThis), url ?? '/samples/');
        setCachedLibrary(result.library, result.warnings);
        shell.status(result.count ? `Loaded ${result.count} samples` : `No samples loaded. ${result.warnings.join('; ')}`);
        return { ok: true, count: result.count, warnings: result.warnings };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'loadSamples failed' };
      }
    },
    listSamples: () => listSamples(getCachedLibrary()),
    describe: async () => {
      const key = projectHash(shell.project);
      if (cacheReport && cacheKey === key) return { ok: true, report: cacheReport };
      const result = await describeProjectAudio(shell.project);
      if (!result.ok) return result;
      return { ok: true, report: result.report };
    },
    exportWav: async (options) => {
      try {
        await shell.engine.startAudio();
        shell.status('Rendering, normalizing, and exporting…');
        const bitDepth = options?.bitDepth === 24 ? 24 : 16;
        const rendered = await describeProjectAudio(shell.project);
        if (!rendered.ok) return rendered;
        const names = exportNames(shell.project);
        const wavName = names.wavName;
        const reportName = names.reportName;
        const listenName = names.listenName;
        const listenMdName = names.listenMdName;
        const wav = encodeWav(rendered.left, rendered.right, rendered.sampleRate, bitDepth, shell.project.seed || 1);
        const report = buildReport(shell.project, rendered.norm.report, rendered.seam, bitDepth, rendered.sampleRate, rendered.left.length);
        if (shell.project.style) logFingerprint(browserStorage(), fingerprintOf(shell.project, new Date().toISOString()));
        const items: Array<{ data: Uint8Array | string; filename: string; mime: string }> = [
          { data: wav, filename: wavName, mime: 'audio/wav' },
          { data: JSON.stringify(report, null, 2), filename: reportName, mime: 'application/json' },
          { data: JSON.stringify(rendered.report, null, 2), filename: listenName, mime: 'application/json' },
          { data: renderListenMarkdown(rendered.report), filename: listenMdName, mime: 'text/markdown' },
        ];
        if (options?.pictures) items.push(...await pictureBytes(shell.project, rendered.left, rendered.right, rendered.sampleRate));
        await downloadSequence(items);
        const summary = `Exported ${wavName}. ${describeProject(shell.project)}`;
        shell.status(summary);
        return { ok: true, wavName, reportName, summary, listenName, listenMdName };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Export failed';
        shell.status(error);
        return { ok: false, error };
      }
    },
    exportAll: async (options) => {
      try {
        await shell.engine.startAudio();
        shell.status('Rendering the listening bundle…');
        const bitDepth = options?.bitDepth === 24 ? 24 : 16;
        const rendered = await describeProjectAudio(shell.project);
        if (!rendered.ok) return rendered;
        const names = exportNames(shell.project);
        const wavName = names.wavName;
        const reportName = names.reportName;
        const listenName = names.listenName;
        const listenMdName = names.listenMdName;
        const wav = encodeWav(rendered.left, rendered.right, rendered.sampleRate, bitDepth, shell.project.seed || 1);
        const reportJson = buildReport(shell.project, rendered.norm.report, rendered.seam, bitDepth, rendered.sampleRate, rendered.left.length);
        if (shell.project.style) logFingerprint(browserStorage(), fingerprintOf(shell.project, new Date().toISOString()));
        const pictures = await pictureBytes(shell.project, rendered.left, rendered.right, rendered.sampleRate);
        const items: Array<{ data: Uint8Array | string; filename: string; mime: string }> = [
          { data: wav, filename: wavName, mime: 'audio/wav' },
          { data: JSON.stringify(reportJson, null, 2), filename: reportName, mime: 'application/json' },
          { data: JSON.stringify(rendered.report, null, 2), filename: listenName, mime: 'application/json' },
          { data: renderListenMarkdown(rendered.report), filename: listenMdName, mime: 'text/markdown' },
          ...pictures,
        ];
        if (options?.stems) {
          const base = safeName(shell.project.name);
          const silent = { left: new Float32Array(rendered.left.length), right: new Float32Array(rendered.right.length) };
          const prepared = prepareStemFiles(base, rendered.sampleRate, bitDepth, shell.project.seed || 1, {
            mix: { left: rendered.left, right: rendered.right },
            music: { left: rendered.left, right: rendered.right },
            sfx: silent,
          }, { warnings: ['Project export: SFX stem is silent (no cue-sheet SFX).'], listen: rendered.report });
          items.push(...prepared.files.map((file) => ({ data: file.data, filename: file.filename, mime: file.mime })));
          items.push({ data: JSON.stringify(prepared.report, null, 2), filename: `${base}.stems.report.json`, mime: 'application/json' });
        }
        await downloadSequence(items);
        const files = items.map((item) => item.filename);
        const summary = `Exported ${files.length} files. ${describeProject(shell.project)} ${rendered.report.summary.paragraph}`;
        shell.status(summary);
        return { ok: true, files, report: rendered.report, summary };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Export failed';
        shell.status(error);
        return { ok: false, error };
      }
    },
    exportStems: async (options) => {
      try {
        await shell.engine.startAudio();
        const bitDepth = options?.bitDepth === 24 ? 24 : 16;
        if (options?.sheet) {
          const scored = await scoreVideo(options.sheet, {
            download: false,
            pictures: false,
            stems: true,
            seed: options.seed,
            bitDepth,
          });
          if (!scored.ok) return scored;
          // scoreVideo with download:false does not return stem buffers; re-render via plan for stems.
          const extracted = (await import('../score/parseRequest')).extractScoreRequest(options.sheet);
          if (!extracted.ok || !extracted.input) return { ok: false, error: 'Cue sheet was not accepted' };
          const { planScore } = await import('../score/arranger');
          const { renderScore } = await import('../score/render');
          const { pureBackend } = await import('../score/pureBackend');
          const plan = planScore(extracted.input, { seed: options.seed ?? 1 });
          const rendered = await renderScore(plan, pureBackend, {});
          if (!rendered.ok) return rendered;
          const base = safeName(plan.name || 'score');
          const prepared = prepareStemFiles(base, rendered.sampleRate, bitDepth, plan.seed || 1, {
            mix: rendered.mix,
            music: rendered.music,
            sfx: rendered.sfx,
          }, { listen: scored.listenReport, plan });
          await downloadSequence([
            ...prepared.files.map((file) => ({ data: file.data, filename: file.filename, mime: file.mime })),
            { data: JSON.stringify(prepared.report, null, 2), filename: `${base}.stems.report.json`, mime: 'application/json' },
          ]);
          const files = [...prepared.files.map((file) => file.filename), `${base}.stems.report.json`];
          const summary = `Exported stems ${files.join(', ')}`;
          shell.status(summary);
          return { ok: true, files, report: prepared.report, summary };
        }
        const rendered = await describeProjectAudio(shell.project);
        if (!rendered.ok) return rendered;
        const base = safeName(shell.project.name);
        const silent = { left: new Float32Array(rendered.left.length), right: new Float32Array(rendered.right.length) };
        const prepared = prepareStemFiles(base, rendered.sampleRate, bitDepth, shell.project.seed || 1, {
          mix: { left: rendered.left, right: rendered.right },
          music: { left: rendered.left, right: rendered.right },
          sfx: silent,
        }, { warnings: ['Project export: SFX stem is silent (no cue-sheet SFX).'], listen: rendered.report });
        await downloadSequence([
          ...prepared.files.map((file) => ({ data: file.data, filename: file.filename, mime: file.mime })),
          { data: JSON.stringify(prepared.report, null, 2), filename: `${base}.stems.report.json`, mime: 'application/json' },
        ]);
        const files = [...prepared.files.map((file) => file.filename), `${base}.stems.report.json`];
        const summary = `Exported stems ${files.join(', ')}`;
        shell.status(summary);
        return { ok: true, files, report: prepared.report, summary };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'exportStems failed' };
      }
    },
    rate: async (input) => {
      if (!isRatingValue(input.rating)) return { ok: false, error: `Unknown rating: ${input.rating}` };
      const described = await api.describe();
      if (!described.ok) return described;
      const project = shell.project;
      const saved = addRating(browserStorage(), {
        rating: input.rating,
        note: input.note,
        seed: input.seed ?? project.seed,
        brief: (() => {
          const brief = briefFor(project, input.brief);
          if (!brief || !project.style) return brief;
          return { ...brief, style: brief.style ?? project.style.id };
        })(),
        styleInfo: project.style ? {
          style: project.style.id,
          progressionId: project.style.progressionId,
          drumId: project.style.drumId,
          bassId: project.style.bassId,
          motifId: project.style.motifId,
          lengthMode: project.style.lengthMode,
        } : undefined,
        projectName: project.name,
        bpm: project.bpm,
        bars: project.bars,
        key: keyLabel(project),
        metrics: metricsOf(described.report),
      });
      if (!saved.ok) return saved;
      shell.status(`Saved rating ${saved.entry.rating}`);
      return saved;
    },
    getRatings: () => loadRatings(browserStorage()).map((row) => ({ ...row, metrics: { ...row.metrics } })),
    downloadRatings: () => {
      const name = 'music-studio.ratings.json';
      downloadBytes(JSON.stringify(loadRatings(browserStorage()), null, 2), name, 'application/json');
      return name;
    },
    parseCues: (text) => parseCues(text),
    scoreVideo: (cueSheet, options) => scoreVideo(cueSheet, options),
    previewCue: (type, intensity) => previewCue(type, intensity ?? 0.6, {
      startAudio: () => shell.engine.startAudio(),
      play: (left, right, sampleRate) => shell.engine.playBuffer(left, right, sampleRate, 1),
    }),
    sfx: (type, params) => scoreSfx(type, params),
    selfTestScore: () => selfTestScore((progress) => shell.status(`${Math.round(progress.fraction * 100)}% ${progress.message}`)),
    batch: (plan, options) => runBatch(plan, {
      download: false,
      storage: browserStorage(),
      ...options,
      ...(options?.useRatings ? { ratings: options.ratings ?? loadRatings(browserStorage()) } : {}),
    }),
    cancelBatch: () => cancelBatch(),
    catalog: () => catalog(),
    getFingerprints: () => loadFingerprints(browserStorage()).map((row) => ({ ...row })),
    importFingerprints: (json) => importFingerprints(browserStorage(), json),
    exportFingerprints: () => {
      const name = 'library_fingerprints.json';
      downloadBytes(JSON.stringify({ version: 1, appVersion: APP_VERSION, exported: new Date().toISOString(), entries: loadFingerprints(browserStorage()) }, null, 2), name, 'application/json');
      return name;
    },
    match: async (profile, options) => {
      const result = await runMatch(profile, {
        ...options,
        render: options?.render ?? (async (project) => {
          const described = await describeProjectAudio(project);
          if (!described.ok) return { bpm: project.bpm };
          return {
            bpm: project.bpm,
            brightnessHz: described.report.brightness.centroidMedianHz,
            lufs: described.report.loudness.integratedLufs,
            speechShare: described.report.speechRoom.speechShare,
          };
        }),
      });
      if (result.ok) {
        shell.replaceProject(result.project);
        shell.status(`Matched ${result.chosen.style}. Origin synthesized. Samples false.`);
      }
      return result;
    },
    profileFromLibraryRow: (text) => profileFromLibraryRow(text),
    preferences: () => aggregatePreferences(loadRatings(browserStorage())),
    logFingerprint: () => {
      if (!shell.project.style) return { ok: false, error: 'The current project has no style to log' };
      const entry = fingerprintOf(shell.project, new Date().toISOString());
      logFingerprint(browserStorage(), entry);
      return { ok: true, id: entry.id };
    },
  };

  window.musicStudio = api;
  return api;
}

function exportNames(project: Project): { wavName: string; reportName: string; listenName: string; listenMdName: string } {
  if (!project.style) {
    const base = safeName(project.name);
    return {
      wavName: `${base}_${Math.round(project.bpm)}bpm_${project.bars}bars.wav`,
      reportName: `${base}.report.json`,
      listenName: `${base}.listen.json`,
      listenMdName: `${base}.listen.md`,
    };
  }
  const base = styledBaseName(project, true);
  return {
    wavName: `${base}.wav`,
    reportName: `${base}.report.json`,
    listenName: `${base}.listen.json`,
    listenMdName: `${base}.listen.md`,
  };
}

export type { VideoRole };
