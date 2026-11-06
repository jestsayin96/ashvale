import type { NormalizeReport } from '../dsp/normalize';
import type { SeamReport } from '../dsp/seam';
import { safeName } from '../io/download';
import type { Project, SamplerParams } from '../model/types';
import { noteName } from '../model/scales';
import { loopSeconds } from '../model/video';
import { getCachedLibrary } from '../samples/library';
import { APP_VERSION } from '../version';
import { loudnessSeries, rmsPerSecond, spectrumSummary, stereoSummary } from './features';
import { scoreMood, type MoodScore } from './mood';
import { musicalStats, type MusicalStats } from './notes';
import { formatSeamText } from './seamCheck';
import { speechRoomCheck, type SpeechRoom } from './speech';
import {
  BRIGHTNESS_BALANCED_MAX_HZ,
  BRIGHTNESS_DARK_MAX_HZ,
  DENSITY_MODERATE_MAX,
  DENSITY_SPARSE_MAX,
  MOVEMENT_MOVING_MAX_DB,
  MOVEMENT_STEADY_MAX_DB,
  TEMPO_MEDIUM_MAX,
  TEMPO_SLOW_MAX,
} from './targets';

export interface LayerTrackReport {
  name: string;
  group: string | null;
  kind: string;
  sampleId: string | null;
  missing: boolean;
  sectionsActive: string[];
  onsetsPerBar: number;
  gainDb: number;
}

export interface LayerSectionReport {
  name: string;
  bars: number;
  activeLayers: string[];
  entered: string[];
  dropped: string[];
  shortTermLufs: number | null;
  brightnessHz: number | null;
}

export interface LayersBlock {
  tracks: LayerTrackReport[];
  sections: LayerSectionReport[];
  buildDrop: string[];
  samples: { used: string[]; missing: string[]; licenses: string[] };
}

export interface ListenReport {
  meta: {
    name: string;
    role: string | null;
    requestedMood: string | null;
    seed: number;
    bpm: number;
    bars: number;
    loopSeconds: number;
    sampleRate: number;
    appVersion: string;
    timestamp: string;
  };
  musical: MusicalStats;
  loudness: {
    integratedLufs: number;
    truePeakDbtp: number;
    samplePeakDbfs: number;
    shortTerm: Array<{ t: number; lufs: number }>;
    shortTermMin: number;
    shortTermMax: number;
    shortTermMedian: number;
    loudnessMovement: number;
    crestDb: number;
    dynamicRangeDb: number;
    rmsPerSecond: Array<{ t: number; db: number }>;
    windowSeconds: number;
    hopSeconds: number;
  };
  brightness: ReturnType<typeof spectrumSummary>;
  stereo: ReturnType<typeof stereoSummary>;
  speechRoom: SpeechRoom;
  mood: MoodScore;
  seam: SeamReport;
  layers?: LayersBlock;
  summary: { paragraph: string; facts: string[] };
}

export interface ListenOptions {
  timestamp?: string;
}

function finite(n: number): number | null {
  return Number.isFinite(n) ? n : null;
}

function tempoWord(bpm: number): string {
  if (bpm < TEMPO_SLOW_MAX) return 'slow';
  if (bpm <= TEMPO_MEDIUM_MAX) return 'medium';
  return 'fast';
}

function densityWord(onsets: number): string {
  if (onsets < DENSITY_SPARSE_MAX) return 'sparse';
  if (onsets < DENSITY_MODERATE_MAX) return 'moderate';
  return 'busy';
}

function brightnessWord(hz: number): string {
  if (hz < BRIGHTNESS_DARK_MAX_HZ) return 'dark';
  if (hz <= BRIGHTNESS_BALANCED_MAX_HZ) return 'balanced';
  return 'bright';
}

function movementWord(db: number): string {
  if (db < MOVEMENT_STEADY_MAX_DB) return 'steady';
  if (db < MOVEMENT_MOVING_MAX_DB) return 'moving';
  return 'dynamic';
}

export function describeInEnglish(report: ListenReport): string {
  const m = report.musical;
  const voices = m.instruments.map((t) => t.voice).join(', ') || 'no audible tracks';
  const scale = m.key.scale;
  const pent = scale.includes('Pent') || scale.includes('pent') ? 'pentatonic ' : '';
  const pad = m.instruments.some((t) => t.voice === 'pad') ? 'pad' : 'arrangement';
  const layerSentence = report.layers && report.layers.sections.length
    ? ` Layering measured ${report.layers.sections.map((section) => `${section.name}:${section.activeLayers.length}`).join(', ')} active layers per section.`
    : '';
  const text = [
    `${densityWord(m.rhythmicDensity)}, ${m.pitchRange.register}-register ${pad}`,
    `at a ${tempoWord(report.meta.bpm)} ${pent}${scale} setting`,
    `(measured: ${report.meta.bpm} BPM, ${m.rhythmicDensity.toFixed(2)} onsets/s,`,
    `median pitch ${noteName(m.pitchRange.medianMidi)},`,
    `centroid ${report.brightness.centroidMedianHz.toFixed(0)} Hz).`,
    `Brightness reads ${brightnessWord(report.brightness.centroidMedianHz)}.`,
    `Loudness movement reads ${movementWord(report.loudness.loudnessMovement)} (${report.loudness.loudnessMovement.toFixed(2)} dB).`,
    `Stereo reads ${report.stereo.label}.`,
    `Voices used: ${voices}.${layerSentence}`,
    'These are measurements, not a judgment of how it sounds.',
  ];
  return text.join(' ');
}

function facts(report: ListenReport): string[] {
  const m = report.musical;
  return [
    `Tempo reads ${report.meta.bpm} BPM (${tempoWord(report.meta.bpm)}).`,
    `Density reads ${m.rhythmicDensity.toFixed(2)} onsets/s (${densityWord(m.rhythmicDensity)}).`,
    `Register reads ${m.pitchRange.register}, median MIDI ${m.pitchRange.medianMidi.toFixed(1)}, span ${m.pitchRange.spanSemitones} semitones.`,
    `Centroid median reads ${report.brightness.centroidMedianHz.toFixed(0)} Hz (${brightnessWord(report.brightness.centroidMedianHz)}).`,
    `Integrated loudness reads ${report.loudness.integratedLufs.toFixed(2)} LUFS, true peak ${report.loudness.truePeakDbtp.toFixed(2)} dBTP.`,
    `Seam status reads ${report.seam.status}. Speech-room verdict reads ${report.speechRoom.verdict}.`,
  ];
}

export function buildListenReport(
  project: Project,
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  norm: NormalizeReport,
  seam: SeamReport,
  opts: ListenOptions = {},
): ListenReport {
  const musical = musicalStats(project);
  const loud = loudnessSeries(left, right, sampleRate);
  const brightness = spectrumSummary(left, right, sampleRate);
  const stereo = stereoSummary(left, right);
  const role = project.origin?.role ?? null;
  const speechRoom = speechRoomCheck(left, right, sampleRate, role);
  const crest = norm.after.truePeak - norm.after.lufs;
  const report: ListenReport = {
    meta: {
      name: project.name,
      role,
      requestedMood: project.mood ?? null,
      seed: project.seed,
      bpm: project.bpm,
      bars: project.bars,
      loopSeconds: loopSeconds(project.bars, project.bpm),
      sampleRate,
      appVersion: APP_VERSION,
      timestamp: opts.timestamp ?? new Date().toISOString(),
    },
    musical,
    loudness: {
      integratedLufs: finite(norm.after.lufs) ?? -120,
      truePeakDbtp: finite(norm.after.truePeak) ?? 0,
      samplePeakDbfs: finite(norm.after.samplePeak) ?? 0,
      shortTerm: loud.series.map((p) => ({ t: p.t, lufs: finite(p.lufs) ?? -120 })),
      shortTermMin: finite(loud.min) ?? -120,
      shortTermMax: finite(loud.max) ?? -120,
      shortTermMedian: finite(loud.median) ?? -120,
      loudnessMovement: finite(loud.movement) ?? 0,
      crestDb: Number.isFinite(crest) ? crest : 0,
      dynamicRangeDb: Number.isFinite(crest) ? crest : 0,
      rmsPerSecond: rmsPerSecond(left, right, sampleRate),
      windowSeconds: loud.windowSeconds,
      hopSeconds: loud.hopSeconds,
    },
    brightness,
    stereo,
    speechRoom,
    mood: scoreMood(
      {
        bpm: project.bpm,
        synthNotesPerBar: musical.notesPerBarMean,
        rhythmicDensity: musical.rhythmicDensity,
        centroidMedianHz: brightness.centroidMedianHz,
        loudnessMovement: finite(loud.movement) ?? 0,
        rhythmRegularity: musical.rhythmRegularity,
      },
      project.mood ?? null,
      role,
    ),
    seam,
    summary: { paragraph: '', facts: [] },
  };
  report.layers = buildLayersBlock(project, report);
  report.summary = { paragraph: describeInEnglish(report), facts: facts(report) };
  return report;
}

function buildLayersBlock(project: Project, report: ListenReport): LayersBlock {
  const sections = project.sections ?? project.style?.structure ?? [];
  const library = getCachedLibrary();
  const used: string[] = [];
  const missing: string[] = [];
  const licenses = new Set<string>();
  const trackRows: LayerTrackReport[] = project.tracks.map((track) => {
    const sampleId = track.kind === 'sample' ? (track.params as SamplerParams).sampleId : null;
    const missingSample = !!sampleId && !library.has(sampleId);
    if (sampleId) {
      used.push(sampleId);
      if (missingSample) missing.push(sampleId);
      else licenses.add(library.get(sampleId)?.meta.license ?? 'unknown');
    }
    const sectionsActive = sections
      .filter((section) => {
        if (track.mute) return false;
        const cell = track.arrangement?.find((row) => row.section === section.name);
        if (!cell) return !track.arrangement;
        return cell.slot !== null;
      })
      .map((section) => section.name);
    const onsets = report.musical.instruments.find((row) => row.trackName === track.name)?.notes ?? 0;
    return {
      name: track.name,
      group: track.kind === 'sample' ? ((track.params as SamplerParams).group ?? null) : null,
      kind: track.kind,
      sampleId,
      missing: missingSample,
      sectionsActive,
      onsetsPerBar: project.bars > 0 ? onsets / project.bars : 0,
      gainDb: track.gainDb,
    };
  });

  let barCursor = 0;
  const secondsPerBar = (4 * 60) / Math.max(1, project.bpm);
  const sectionRows: LayerSectionReport[] = sections.map((section, index) => {
    const prev = index > 0 ? sections[index - 1] : null;
    const activeLayers = trackRows.filter((track) => track.sectionsActive.includes(section.name)).map((track) => track.name);
    const prevActive = prev ? new Set(trackRows.filter((track) => track.sectionsActive.includes(prev.name)).map((track) => track.name)) : new Set<string>();
    const entered = activeLayers.filter((name) => !prevActive.has(name));
    const dropped = [...prevActive].filter((name) => !activeLayers.includes(name));
    const t0 = barCursor * secondsPerBar;
    const t1 = (barCursor + section.bars) * secondsPerBar;
    barCursor += section.bars;
    const windows = report.loudness.shortTerm.filter((row) => row.t >= t0 && row.t < t1);
    const shortTermLufs = windows.length
      ? windows.reduce((sum, row) => sum + row.lufs, 0) / windows.length
      : null;
    return {
      name: section.name,
      bars: section.bars,
      activeLayers,
      entered,
      dropped,
      shortTermLufs,
      brightnessHz: report.brightness.centroidMedianHz,
    };
  });

  const buildDrop: string[] = [];
  let bar = 0;
  for (let i = 0; i < sectionRows.length; i++) {
    const section = sectionRows[i];
    if (i > 0 && section.dropped.length) {
      const before = sectionRows[i - 1].shortTermLufs;
      const after = section.shortTermLufs;
      const delta = before !== null && after !== null ? after - before : null;
      buildDrop.push(
        `drop at bar ${bar + 1}: ${section.dropped.length} layers out${delta === null ? '' : `, loudness ${delta.toFixed(1)} LU`}`,
      );
    }
    bar += section.bars;
  }

  return {
    tracks: trackRows,
    sections: sectionRows,
    buildDrop,
    samples: { used: [...new Set(used)], missing: [...new Set(missing)], licenses: [...licenses] },
  };
}

export function renderListenMarkdown(report: ListenReport): string {
  const base = safeName(report.meta.name);
  const m = report.musical;
  const rows = [
    ['BPM', String(report.meta.bpm)],
    ['Bars', String(report.meta.bars)],
    ['Loop seconds', report.meta.loopSeconds.toFixed(2)],
    ['Onsets/s', m.rhythmicDensity.toFixed(3)],
    ['Synth notes/bar', m.notesPerBarMean.toFixed(2)],
    ['Centroid Hz', report.brightness.centroidMedianHz.toFixed(1)],
    ['Integrated LUFS', report.loudness.integratedLufs.toFixed(2)],
    ['True peak dBTP', report.loudness.truePeakDbtp.toFixed(2)],
    ['Loudness movement dB', report.loudness.loudnessMovement.toFixed(2)],
    ['Speech share', report.speechRoom.speechShare.toFixed(3)],
    ['Stereo', report.stereo.label],
    ['Seam', report.seam.status],
  ];
  const table = ['| Metric | Value |', '| --- | --- |', ...rows.map(([k, v]) => `| ${k} | ${v} |`)].join('\n');
  const windows = report.seam.windows
    .map((w) => `- ${w.ms} ms: first ${w.firstRmsDb.toFixed(2)} dB, last ${w.lastRmsDb.toFixed(2)} dB, diff ${w.diffDb.toFixed(2)} dB`)
    .join('\n');
  return [
    `# Listening report`,
    '',
    `## Summary`,
    '',
    report.summary.paragraph,
    '',
    ...report.summary.facts.map((f) => `- ${f}`),
    '',
    `## Metrics`,
    '',
    table,
    '',
    `## Mood`,
    '',
    `Requested: ${report.mood.requested ?? 'none'}. Best: ${report.mood.best}. Pass: ${String(report.mood.pass)}.`,
    `Scores: hype ${report.mood.scores.hype.toFixed(2)}, playful ${report.mood.scores.playful.toFixed(2)}, lowkey ${report.mood.scores.lowkey.toFixed(2)}.`,
    ...report.mood.suggestions.map((s) => `- ${s}`),
    '',
    `## Speech room`,
    '',
    `${report.speechRoom.verdict}. ${report.speechRoom.message}`,
    '',
    `## Seam`,
    '',
    formatSeamText(report.seam),
    '',
    windows,
    '',
    ...(report.layers ? [
      `## Layers`,
      '',
      `| Section | Active layers | Entered | Dropped | Short-term LUFS |`,
      `| --- | --- | --- | --- | --- |`,
      ...report.layers.sections.map((section) => `| ${section.name} | ${section.activeLayers.join(', ') || '-'} | ${section.entered.join(', ') || '-'} | ${section.dropped.join(', ') || '-'} | ${section.shortTermLufs === null ? '-' : section.shortTermLufs.toFixed(2)} |`),
      '',
      ...report.layers.buildDrop.map((line) => `- ${line}`),
      '',
      `Samples used: ${report.layers.samples.used.join(', ') || 'none'}. Missing: ${report.layers.samples.missing.join(', ') || 'none'}.`,
      '',
    ] : []),
    `## Pictures`,
    '',
    `- ${base}.spectrogram.png`,
    `- ${base}.loudness.png`,
    `- ${base}.waveform.png`,
    '',
  ].join('\n');
}
