import { applyMood } from '../model/moods';
import { emptyStep, makePattern, samplerParams } from '../model/defaults';
import { validateProject } from '../model/schema';
import type { Bars, Pattern, Project, SamplerParams, Scale, Step, StyleSection, Track, VideoRole } from '../model/types';
import { BAR_VALUES } from '../model/types';
import { composeForVideo, describeProject, type VideoBrief } from '../model/video';
import { getCachedLibrary, getCachedWarnings, listSamples } from '../samples/library';
import { TRACK_LIMIT } from '../style/targets';
import { composeProject, type ComposeBrief } from '../style/compose';
import type { LayerReport } from '../style/incredibox';
import { composeMatched, type MatchProfile } from '../style/match';
import { STYLE_IDS } from '../style/styles';
import { extractScoreRequest } from '../score/api';

export const AI_HELP = [
  'window.musicStudio controls Music Studio. Call these from the page. No clicks.',
  '',
  'compose({ role, mood, seconds, seed, name })',
  '  role: "bed" (under talking), "music" (no voice), "intro", "outro"',
  '  mood: "hype" | "playful" | "lowkey"',
  '  seconds: how long the loop should be',
  '  seed: same number always makes the same piece',
  '  style: "incredibox" builds layered loops (beat/voice/melody/effects enter and drop)',
  'getProject()',
  'exportWav({ bitDepth, pictures })  bitDepth is 16 or 24. Downloads a WAV, report JSON, listen.json, and listen.md. pictures:true also downloads the three PNGs.',
  'describe()  renders the current project and returns the listening report. No downloads.',
  'exportAll({ bitDepth })  downloads WAV, report JSON, listen.json, listen.md, spectrogram, loudness, and waveform PNGs.',
  'rate({ rating, note, seed, brief })  rating is love, too_busy, too_empty, too_bright, too_dark, or not_for_mood.',
  'getRatings()  copy of the saved ratings.',
  'downloadRatings()  downloads music-studio.ratings.json.',
  'await loadSamples(url?)  loads /samples/manifest.json (+ optional manifest.local.json)',
  'listSamples()  ids, types, and groups from the cached library',
  'run({op:"loadSamples", url?})  async; use applyCommandAsync or await musicStudio.run',
  'run(json)  one object, or a JSON string, with op set to compose | mood | set | get | help | export | describe | score | samples | loadSamples | addSampleTrack | setSample | setSlot | arrange | sections',
  'help()',
  'parseCues(text)  JSON or cue-sheet text. Returns {ok, sheet, warnings, errors}.',
  'scoreVideo(sheet, options)  one cue-timed score. download:false returns reports and skips the file saves.',
  'previewCue(type, intensity)  plays a 7 second demo of that cue.',
  'sfx(name, params)  renders one synthesized effect. download:true saves name_seed.wav.',
  'selfTestScore()  renders the three example sheets with the Web Audio voices and checks length, sync, true peak, and LUFS.',
  '',
  'catalog()  styles, moods, roles, presets, and limits.',
  'batch(plan)  plan is fill-library-20, styles-sampler-8, or a list of items. Never throws.',
  'cancelBatch()  stops the batch after the current item.',
  'getFingerprints()  copy of the variety log. importFingerprints(json) merges it. exportFingerprints() downloads library_fingerprints.json.',
  'logFingerprint()  stores the current styled project. compose alone does not.',
  'match(profile, options)  composes several originals from profile numbers and keeps the closest. origin is synthesized, samples false.',
  'profileFromLibraryRow(text)  reads one 17-column LIBRARY.md row into a profile. It does not copy a melody.',
  'preferences()  aggregates saved ratings into scores, bias, loved, and avoid.',
  'useRatings:true on compose, match, or batch applies that snapshot. Zero ratings leave the piece unchanged.',
  '',
  'Quick style loop:',
  'musicStudio.compose({ role: "music", mood: "playful", seconds: 30, seed: 4, style: "chiptune_bounce", lengthMode: "exact" })',
  'musicStudio.logFingerprint()',
  'const made = await musicStudio.batch("styles-sampler-8", { download: false })',
  'made.totals',
  'musicStudio.getFingerprints().length',
  'musicStudio.catalog().styles.map((style) => style.id)',
  '',
  'Quick score loop:',
  'const parsed = musicStudio.parseCues(text)',
  'const heard = await musicStudio.scoreVideo(parsed.sheet, { download: false })',
  'heard.syncReport.summary.pass',
  'heard.listenReport.perCue  // brightnessHz, speechShare, density, levelDb',
  'heard.listenReport.meta.timing.sentence',
  'await musicStudio.scoreVideo(parsed.sheet, { download: true })',
  '',
  'scoreVideo also accepts {"op":"score","sheet":{...},"options":{seed,bitDepth,stems,pictures,sfxFiles,download}}.',
  'Text headers: seed 7, bitdepth 24, stems on, pictures off, sfxfiles on.',
  'A line like "0:02 whoosh_up" or "0:05 kill sting" sets cue.sfx. Unknown names list the allowed set.',
  '',
  'bed targets about -20 LUFS and pulls down the speech range.',
  'music targets about -16 LUFS and leaves the speech range alone.',
  'The loop is seamless, so a longer video can repeat it.',
  'Seam OK means no click and no long-window level mismatch. Seam CHECK means one of those failed.',
  '',
  'Quick loop:',
  'await musicStudio.compose({ role: "bed", mood: "lowkey", seconds: 45, seed: 12 })',
  'const heard = await musicStudio.describe()',
  'heard.report.mood.pass',
  'heard.report.speechRoom.verdict',
  'heard.report.seam.status',
  'await musicStudio.exportAll()',
  '',
  'Layered loops:',
  'await musicStudio.loadSamples()',
  'musicStudio.compose({ role: "music", mood: "lowkey", seconds: 60, seed: 7, style: "incredibox" })',
  'musicStudio.run({ op: "samples" })',
  'musicStudio.run({ op: "setSlot", track: "layer_kick", slot: "B", steps: "x...x...x...x..." })',
  'musicStudio.run({ op: "arrange", track: "layer_kick", sections: { intro: "A", drop: null, full: "B" } })',
].join('\n');

export type CommandResult =
  | { ok: true; op: string; summary: string; project?: Project; export?: boolean; fitWarning?: string; similarity?: unknown; warnings?: string[]; matchReport?: unknown; usedRatings?: unknown; layers?: LayerReport[]; samples?: ReturnType<typeof listSamples>; count?: number }
  | { ok: false; op: string; error: string };

export type SampleLoader = (url?: string) => Promise<{ ok: true; count: number; warnings: string[] } | { ok: false; error: string }>;

export function loadLibraryLabel(result: { ok: true; count: number; warnings: string[] } | { ok: false; error: string }): string {
  if (!result.ok) return `Load library failed: ${result.error}`;
  const warn = result.warnings.length ? ` (${result.warnings.length} warnings)` : '';
  return `Loaded ${result.count} samples${warn}`;
}

const MOODS = ['hype', 'playful', 'lowkey'] as const;
const ROLES: VideoRole[] = ['bed', 'music', 'intro', 'outro'];
const SCALES: Scale[] = ['minor', 'major', 'minorPent', 'majorPent', 'dorian', 'phrygian', 'mixolydian', 'lydian', 'harmonicMinor'];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function briefFrom(raw: Record<string, unknown>): ComposeBrief {
  const role = String(raw.role ?? (isObj(raw.matchProfile) ? raw.matchProfile.role : '') ?? '');
  const mood = String(raw.mood ?? (isObj(raw.matchProfile) ? raw.matchProfile.mood : '') ?? 'hype');
  if (!ROLES.includes(role as VideoRole)) throw new Error('role must be bed, music, intro, or outro');
  if (!MOODS.includes(mood as VideoBrief['mood'])) throw new Error('mood must be hype, playful, or lowkey');
  const seconds = Number(raw.seconds ?? (isObj(raw.matchProfile) ? raw.matchProfile.seconds : undefined));
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('seconds must be a positive number');
  const brief: ComposeBrief = { role: role as VideoRole, mood: mood as VideoBrief['mood'], seconds };
  if (raw.seed !== undefined) {
    const seed = Number(raw.seed);
    if (!Number.isFinite(seed)) throw new Error('seed must be a number');
    brief.seed = seed >>> 0;
  }
  if (typeof raw.name === 'string') brief.name = raw.name;
  if (raw.style !== undefined) {
    const style = String(raw.style);
    if (!(STYLE_IDS as readonly string[]).includes(style)) throw new Error(`Unknown style: ${style}. Styles: ${STYLE_IDS.join(', ')}`);
    brief.style = style;
  }
  if (raw.lengthMode !== undefined) {
    const lengthMode = String(raw.lengthMode);
    if (lengthMode !== 'loop' && lengthMode !== 'exact') throw new Error('lengthMode must be loop or exact');
    brief.lengthMode = lengthMode;
  }
  if (raw.varietyGuard !== undefined) {
    const varietyGuard = String(raw.varietyGuard);
    if (varietyGuard !== 'warn' && varietyGuard !== 'reseed' && varietyGuard !== 'refuse' && varietyGuard !== 'off') {
      throw new Error('varietyGuard must be warn, reseed, refuse, or off');
    }
    brief.varietyGuard = varietyGuard;
  }
  if (raw.useRatings === true) brief.useRatings = true;
  if (Array.isArray(raw.ratings)) brief.ratings = raw.ratings as ComposeBrief['ratings'];
  if (typeof raw.targetBpm === 'number' && Number.isFinite(raw.targetBpm)) brief.targetBpm = raw.targetBpm;
  return brief;
}

/** Apply one AI command to a project. Export is flagged for the browser bridge to render. */
export function applyCommand(project: Project, command: unknown): CommandResult {
  let raw: unknown = command;
  if (typeof command === 'string') {
    try {
      raw = JSON.parse(command);
    } catch {
      return { ok: false, op: 'parse', error: 'Command is not valid JSON' };
    }
  }
  if (!isObj(raw) || typeof raw.op !== 'string') {
    return { ok: false, op: 'parse', error: 'Command needs an op field' };
  }
  const op = raw.op;
  try {
    if (op === 'loadSamples') {
      return { ok: false, op, error: 'loadSamples is async; use applyCommandAsync / musicStudio.run' };
    }
    if (op === 'help') return { ok: true, op, summary: AI_HELP };
    if (op === 'get') return { ok: true, op, summary: describeProject(project), project };
    if (op === 'export') return { ok: true, op, summary: `Export ${describeProject(project)}`, project, export: true };
    if (op === 'describe') {
      return { ok: true, op, summary: 'Call musicStudio.describe() for the listening report. run() stays synchronous and does not render audio.' };
    }
    if (op === 'score') {
      const extracted = extractScoreRequest(raw);
      return {
        ok: true,
        op,
        summary: `Call musicStudio.scoreVideo for a cue-timed score. run() stays synchronous and does not render audio. Options ${JSON.stringify(extracted.options)}. ${extracted.warnings.join(' ')}`.trim(),
      };
    }
    if (op === 'compose') {
      const brief = briefFrom(raw);
      if (isObj(raw.matchProfile)) {
        const outcome = composeMatched(project, brief, raw.matchProfile as MatchProfile);
        if (outcome.refused) return { ok: false, op, error: outcome.refused };
        return {
          ok: true,
          op,
          summary: `${describeProject(outcome.project)} Origin synthesized. Samples false.`,
          project: outcome.project,
          matchReport: outcome.matchReport,
          ...(outcome.fitWarning ? { fitWarning: outcome.fitWarning } : {}),
          ...(outcome.similarity ? { similarity: outcome.similarity } : {}),
          ...(outcome.warnings.length ? { warnings: outcome.warnings } : {}),
        };
      }
      if (!brief.style) {
        const next = composeForVideo(project, brief);
        return { ok: true, op, summary: describeProject(next), project: next };
      }
      const outcome = composeProject(project, brief);
      if (outcome.refused) return { ok: false, op, error: outcome.refused };
      const layerSummary = outcome.layers ? ` Layers: ${summarizeLayers(outcome.layers)}.` : '';
      const sampleNote = outcome.project.origin?.samples
        ? ` Uses CC0 samples: ${(outcome.project.origin.sampleIds ?? []).join(', ') || 'yes'}.`
        : '';
      return {
        ok: true,
        op,
        summary: `${describeProject(outcome.project)}.${sampleNote}${layerSummary}`,
        project: outcome.project,
        ...(outcome.fitWarning ? { fitWarning: outcome.fitWarning } : {}),
        ...(outcome.similarity ? { similarity: outcome.similarity } : {}),
        ...(outcome.warnings.length ? { warnings: outcome.warnings } : {}),
        ...(outcome.usedRatings ? { usedRatings: outcome.usedRatings } : {}),
        ...(outcome.layers ? { layers: outcome.layers } : {}),
      };
    }
    if (op === 'samples') {
      const samples = listSamples(getCachedLibrary());
      const warnings = getCachedWarnings();
      return {
        ok: true,
        op,
        summary: samples.length ? `Loaded ${samples.length} samples: ${samples.map((row) => `${row.id}(${row.group}/${row.type})`).join(', ')}` : 'No samples loaded',
        samples,
        ...(warnings.length ? { warnings } : {}),
      };
    }
    if (op === 'addSampleTrack') {
      if (project.tracks.length >= TRACK_LIMIT) throw new Error(`Project has more than ${TRACK_LIMIT} tracks`);
      const sampleId = String(raw.sampleId ?? '');
      if (!sampleId) throw new Error('sampleId is required');
      const name = typeof raw.name === 'string' ? raw.name : sampleId;
      const pattern = stepsFrom(raw.steps);
      const params = samplerParams({
        sampleId,
        pitchSemis: numberOr(raw.pitchSemis, 0),
        gainDb: numberOr(raw.gainDb, 0),
        start: numberOr(raw.start, 0),
        end: raw.end === null || raw.end === undefined ? null : Number(raw.end),
        loop: raw.loop === true,
        group: typeof raw.group === 'string' && ['beat', 'voice', 'melody', 'effects'].includes(raw.group)
          ? raw.group as SamplerParams['group']
          : undefined,
        ...(isObj(raw.adsr) ? {
          adsr: {
            a: numberOr(raw.adsr.a, 0.005),
            d: numberOr(raw.adsr.d, 0.08),
            s: numberOr(raw.adsr.s, 0.7),
            r: numberOr(raw.adsr.r, 0.08),
          },
        } : {}),
      });
      const id = `sample-${name.replace(/\s+/g, '_').toLowerCase()}-${project.tracks.length + 1}`;
      const track: Track = {
        id,
        name,
        kind: 'sample',
        voice: 'sampler',
        params,
        gainDb: numberOr(raw.gainDb, -6),
        pan: 0,
        mute: false,
        solo: false,
        pattern,
        slots: [
          { id: 'A', name: 'A', pattern },
          { id: 'B', name: 'B', pattern: makePattern(pattern.length) },
        ],
        arrangement: (project.sections ?? project.style?.structure ?? []).map((section) => ({ section: section.name, slot: 'A' as string | null })),
      };
      const next = { ...project, tracks: [...project.tracks, track] };
      const checked = validateProject(next);
      return { ok: true, op, summary: `Added sample track ${name} (${sampleId}). ${layerSummaryFromProject(checked)}`, project: checked };
    }
    if (op === 'setSample') {
      const track = findTrack(project, raw.track);
      if (!track) throw new Error('track not found');
      if (track.kind !== 'sample') throw new Error('track is not a sample track');
      const params = { ...(track.params as SamplerParams) };
      if (raw.sampleId !== undefined) params.sampleId = String(raw.sampleId);
      if (raw.rootMidi !== undefined) params.rootMidi = Number(raw.rootMidi);
      if (raw.pitchSemis !== undefined) params.pitchSemis = Number(raw.pitchSemis);
      if (raw.fineCents !== undefined) params.fineCents = Number(raw.fineCents);
      if (raw.start !== undefined) params.start = Number(raw.start);
      if (raw.end !== undefined) params.end = raw.end === null ? null : Number(raw.end);
      if (raw.gainDb !== undefined) params.gainDb = Number(raw.gainDb);
      if (raw.loop !== undefined) params.loop = raw.loop === true;
      if (raw.loopStart !== undefined) params.loopStart = Number(raw.loopStart);
      if (raw.loopEnd !== undefined) params.loopEnd = Number(raw.loopEnd);
      if (raw.chokeGroup !== undefined) params.chokeGroup = String(raw.chokeGroup);
      if (typeof raw.group === 'string' && ['beat', 'voice', 'melody', 'effects'].includes(raw.group)) {
        params.group = raw.group as SamplerParams['group'];
      }
      if (isObj(raw.adsr)) {
        params.adsr = {
          a: numberOr(raw.adsr.a, params.adsr.a),
          d: numberOr(raw.adsr.d, params.adsr.d),
          s: numberOr(raw.adsr.s, params.adsr.s),
          r: numberOr(raw.adsr.r, params.adsr.r),
        };
      }
      const next = {
        ...project,
        tracks: project.tracks.map((row) => (row.id === track.id ? { ...row, params } : row)),
      };
      const checked = validateProject(next);
      return { ok: true, op, summary: `Updated sampler on ${track.name}. ${layerSummaryFromProject(checked)}`, project: checked };
    }
    if (op === 'setSlot') {
      const track = findTrack(project, raw.track);
      if (!track) throw new Error('track not found');
      const slotId = String(raw.slot ?? 'A');
      const pattern = stepsFrom(raw.steps);
      const slots = [...(track.slots ?? [{ id: 'A', name: 'A', pattern: track.pattern }])];
      const index = slots.findIndex((slot) => slot.id === slotId || slot.name === slotId);
      if (index >= 0) slots[index] = { ...slots[index], pattern };
      else slots.push({ id: slotId, name: slotId, pattern });
      const nextTrack: Track = {
        ...track,
        slots,
        pattern: slotId === 'A' ? pattern : track.pattern,
      };
      const next = { ...project, tracks: project.tracks.map((row) => (row.id === track.id ? nextTrack : row)) };
      const checked = validateProject(next);
      return { ok: true, op, summary: `Set slot ${slotId} on ${track.name}. ${layerSummaryFromProject(checked)}`, project: checked };
    }
    if (op === 'arrange') {
      const track = findTrack(project, raw.track);
      if (!track) throw new Error('track not found');
      if (!isObj(raw.sections)) throw new Error('sections must be an object of section -> slot|null');
      const arrangement = Object.entries(raw.sections).map(([section, slot]) => ({
        section,
        slot: slot === null || slot === undefined ? null : String(slot),
      }));
      const next = {
        ...project,
        tracks: project.tracks.map((row) => (row.id === track.id ? { ...row, arrangement } : row)),
      };
      const checked = validateProject(next);
      return { ok: true, op, summary: `Arranged ${track.name}. ${layerSummaryFromProject(checked)}`, project: checked };
    }
    if (op === 'sections') {
      if (!Array.isArray(raw.sections)) throw new Error('sections must be an array of {name,bars}');
      const sections: StyleSection[] = raw.sections.map((row, index) => {
        if (!isObj(row)) throw new Error(`sections[${index}] must be an object`);
        const name = String(row.name ?? '');
        const bars = Number(row.bars);
        if (!name) throw new Error(`sections[${index}].name is required`);
        if (!Number.isFinite(bars) || bars <= 0) throw new Error(`sections[${index}].bars must be a positive number`);
        return { name, bars };
      });
      const next = { ...project, sections };
      const checked = validateProject(next);
      return { ok: true, op, summary: `Set ${sections.length} sections. ${layerSummaryFromProject(checked)}`, project: checked };
    }
    if (op === 'mood') {
      const name = String(raw.name ?? raw.mood ?? '');
      if (!MOODS.includes(name as (typeof MOODS)[number])) throw new Error('mood name must be hype, playful, or lowkey');
      const seed = raw.seed === undefined ? project.seed : Number(raw.seed);
      if (!Number.isFinite(seed)) throw new Error('seed must be a number');
      const next = applyMood(project, name as (typeof MOODS)[number], seed >>> 0);
      return { ok: true, op, summary: describeProject(next), project: next };
    }
    if (op === 'set') {
      const next: Project = {
        ...project,
        master: { ...project.master },
        key: { ...project.key },
      };
      if (raw.bpm !== undefined) next.bpm = Number(raw.bpm);
      if (raw.swing !== undefined) next.swing = Number(raw.swing);
      if (raw.bars !== undefined) next.bars = Number(raw.bars) as Bars;
      if (raw.root !== undefined) next.key.root = Number(raw.root);
      if (raw.scale !== undefined) {
        const scale = String(raw.scale);
        if (!SCALES.includes(scale as Scale)) throw new Error(`Unknown scale: ${scale}`);
        next.key.scale = scale as Scale;
      }
      if (typeof raw.name === 'string') next.name = raw.name;
      if (raw.speechPocket !== undefined) next.master.speechPocket = raw.speechPocket === true;
      if (raw.speechDipDb !== undefined) next.master.speechDipDb = Number(raw.speechDipDb);
      if (raw.targetLufs !== undefined) next.master.targetLufs = Number(raw.targetLufs);
      if (raw.ceilingDbtp !== undefined) next.master.ceilingDbtp = Number(raw.ceilingDbtp);
      if (raw.bars !== undefined && !(BAR_VALUES as readonly number[]).includes(next.bars)) {
        throw new Error(`Bars must be ${BAR_VALUES.join(', ')}`);
      }
      const checked = validateProject(next);
      return { ok: true, op, summary: describeProject(checked), project: checked };
    }
    return { ok: false, op, error: `Unknown op: ${op}` };
  } catch (err) {
    return { ok: false, op, error: err instanceof Error ? err.message : 'Command failed' };
  }
}

/** Async commands (loadSamples). Sync ops delegate to applyCommand. */
export async function applyCommandAsync(
  project: Project,
  command: unknown,
  loader?: SampleLoader,
): Promise<CommandResult> {
  let raw: unknown = command;
  if (typeof command === 'string') {
    try {
      raw = JSON.parse(command);
    } catch {
      return { ok: false, op: 'parse', error: 'Command is not valid JSON' };
    }
  }
  if (!isObj(raw) || typeof raw.op !== 'string') {
    return { ok: false, op: 'parse', error: 'Command needs an op field' };
  }
  if (raw.op === 'loadSamples') {
    const load = loader ?? (async (url?: string) => {
      const { loadSampleLibrary, setCachedLibrary } = await import('../samples/library');
      try {
        const result = await loadSampleLibrary(fetch.bind(globalThis), url ?? '/samples/');
        setCachedLibrary(result.library, result.warnings);
        return { ok: true as const, count: result.count, warnings: result.warnings };
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : 'loadSamples failed' };
      }
    });
    const url = typeof raw.url === 'string' ? raw.url : undefined;
    const loaded = await load(url);
    if (!loaded.ok) return { ok: false, op: 'loadSamples', error: loaded.error };
    return {
      ok: true,
      op: 'loadSamples',
      summary: loadLibraryLabel(loaded),
      count: loaded.count,
      warnings: loaded.warnings,
    };
  }
  return applyCommand(project, command);
}

function numberOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function findTrack(project: Project, raw: unknown): Track | undefined {
  const key = String(raw ?? '');
  return project.tracks.find((track) => track.id === key || track.name === key);
}

function stepsFrom(raw: unknown): Pattern {
  if (typeof raw === 'string') {
    const chars = raw.replace(/\s/g, '');
    const length = Math.max(16, Math.ceil(Math.max(chars.length, 1) / 16) * 16);
    const hits: Array<{ i: number; vel: number }> = [];
    for (let i = 0; i < chars.length; i++) if (chars[i] === 'x' || chars[i] === 'X') hits.push({ i, vel: 0.8 });
    return makePattern(length, hits);
  }
  if (Array.isArray(raw)) {
    const steps = raw.map((row) => {
      if (!isObj(row)) return emptyStep();
      return {
        on: row.on === true,
        vel: numberOr(row.vel, 0.8),
        len: Math.max(1, Math.round(numberOr(row.len, 1))),
        ...(row.note !== undefined ? { note: Number(row.note) } : {}),
        ...(row.prob !== undefined ? { prob: Number(row.prob) } : {}),
      } satisfies Step;
    });
    const length = Math.max(16, Math.ceil(Math.max(steps.length, 1) / 16) * 16);
    while (steps.length < length) steps.push(emptyStep());
    return { length, steps };
  }
  return makePattern(16);
}

function summarizeLayers(layers: LayerReport[]): string {
  return layers.map((layer) => `${layer.track}[${layer.group}] enters ${layer.enters.join('/') || '-'} drops ${layer.drops.join('/') || '-'}`).join('; ');
}

function layerSummaryFromProject(project: Project): string {
  const sections = project.sections ?? project.style?.structure ?? [];
  if (sections.length === 0) return 'No sections.';
  const parts = sections.map((section) => {
    const active = project.tracks.filter((track) => {
      if (track.mute) return false;
      const cell = track.arrangement?.find((row) => row.section === section.name);
      return cell ? cell.slot !== null : true;
    }).map((track) => track.name);
    return `${section.name}: ${active.join(', ') || 'silent'}`;
  });
  return parts.join(' | ');
}
