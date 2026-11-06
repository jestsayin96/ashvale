import { CUE_BEHAVIOR } from './mapping';
import type { ScorePlan } from './plan';
import { IMPACT_VOICES, MEASURED_ONSET_MAX_MS, MUSIC_SNAP_MAX_MS, ONSET_FRONT_MS, ONSET_SEARCH_MS, SYNC_MAX_ERROR_SAMPLES } from './targets';

const IMPACT = new Set<string>(IMPACT_VOICES);

export interface SfxSync {
  name: string;
  scheduledStartSample: number;
  impactOffsetSamples: number;
  impactSample: number;
  intendedSample: number;
  errorSamples: number;
  errorMs: number;
  measuredOnsetErrorMs: number | null;
  peakOffsetMs: number | null;
}

export interface CueSync {
  index: number;
  type: string;
  label: string;
  intensity: number;
  intendedSec: number;
  intendedSample: number;
  boundary: { actualSample: number; errorSamples: number; errorMs: number } | null;
  sfx: SfxSync[];
  musicAccent: { snappedSec: number; errorMs: number; status: 'ok' | 'skipped' } | null;
  preRollShortened?: boolean;
}

export interface SyncReport {
  videoLengthSeconds: number;
  fps: number;
  expectedSamples: number;
  actualSamples: number;
  lengthOk: boolean;
  tempoMap: Array<{ startSec: number; endSec: number; bpm: number; beats: number; key: string }>;
  cues: CueSync[];
  summary: {
    maxSfxErrorMs: number;
    maxBoundaryErrorMs: number;
    maxMusicSnapErrorMs: number;
    measuredOnsetMaxErrorMs: number;
    pass: boolean;
  };
}

export function buildSyncReport(
  plan: ScorePlan,
  sfxStem: { left: Float32Array; right: Float32Array },
  sampleRate: number,
): SyncReport {
  const expectedSamples = Math.round(plan.videoLengthSeconds * sampleRate);
  const actualSamples = Math.min(sfxStem.left.length, sfxStem.right.length);
  const cues: CueSync[] = plan.cues.map((cue, index) => {
    const behavior = CUE_BEHAVIOR[cue.type];
    const intendedSec = cue.t;
    const intendedSample = Math.round(intendedSec * sampleRate);
    let boundary: CueSync['boundary'] = null;
    if (behavior.cueClass === 'hard' || behavior.boundaryAtEnd) {
      const boundarySec = behavior.boundaryAtEnd ? Math.min(plan.videoLengthSeconds, cue.t + (cue.duration ?? 2)) : cue.t;
      const boundarySample = Math.round(boundarySec * sampleRate);
      const section = plan.sections.find((item) => Math.abs(item.startSec - boundarySec) <= 0.001);
      const actualSample = section ? Math.round(section.startSec * sampleRate) : boundarySample;
      const errorSamples = actualSample - boundarySample;
      boundary = { actualSample, errorSamples, errorMs: (errorSamples / sampleRate) * 1000 };
    }
    const sfx = plan.events
      .filter((event) => event.bus === 'sfx' && event.cueIndex === index)
      .map((event) => {
        const scheduledStartSample = Math.round(event.time * sampleRate);
        const impactOffsetSamples = Math.round((event.impactOffset ?? 0) * sampleRate);
        const impactSample = scheduledStartSample + impactOffsetSamples;
        const target = Math.round((event.params.impactSec ?? intendedSec) * sampleRate);
        const errorSamples = impactSample - target;
        const measured = IMPACT.has(event.voice) ? measuredOnsetErrorMs(sfxStem.left, sfxStem.right, sampleRate, target) : null;
        const peakOffset = IMPACT.has(event.voice) ? measuredPeakOffsetMs(sfxStem.left, sfxStem.right, sampleRate, target) : null;
        return {
          name: event.voice,
          scheduledStartSample,
          impactOffsetSamples,
          impactSample,
          intendedSample: target,
          errorSamples,
          errorMs: (errorSamples / sampleRate) * 1000,
          measuredOnsetErrorMs: measured,
          peakOffsetMs: peakOffset,
        };
      });
    const accent = plan.accents.find((item) => item.cueIndex === index) ?? null;
    const row: CueSync = {
      index,
      type: cue.type,
      label: cue.label ?? '',
      intensity: cue.intensity,
      intendedSec,
      intendedSample,
      boundary,
      sfx,
      musicAccent: accent ? { snappedSec: accent.snappedSec, errorMs: accent.errorMs, status: accent.status } : null,
    };
    if (sfx.some((item) => plan.events.some((event) => event.cueIndex === index && event.preRollShortened))) row.preRollShortened = true;
    return row;
  });

  const sfxErrors = cues.flatMap((cue) => cue.sfx.map((item) => Math.abs(item.errorMs)));
  const boundaryErrors = cues.flatMap((cue) => (cue.boundary ? [Math.abs(cue.boundary.errorMs)] : []));
  const snapErrors = cues.flatMap((cue) => (cue.musicAccent && cue.musicAccent.status === 'ok' ? [Math.abs(cue.musicAccent.errorMs)] : []));
  const onsetErrors = cues.flatMap((cue) => cue.sfx.map((item) => item.measuredOnsetErrorMs).filter((value): value is number => value !== null).map((value) => Math.abs(value)));
  const maxSfxErrorMs = maxOrZero(sfxErrors);
  const maxBoundaryErrorMs = maxOrZero(boundaryErrors);
  const maxMusicSnapErrorMs = maxOrZero(snapErrors);
  const measuredOnsetMaxErrorMs = maxOrZero(onsetErrors);
  const sampleMs = (1000 / sampleRate) * SYNC_MAX_ERROR_SAMPLES;
  const lengthOk = actualSamples === expectedSamples;
  const pass = maxSfxErrorMs <= sampleMs + 1e-6
    && maxBoundaryErrorMs <= sampleMs + 1e-6
    && measuredOnsetMaxErrorMs <= MEASURED_ONSET_MAX_MS
    && maxMusicSnapErrorMs <= MUSIC_SNAP_MAX_MS
    && lengthOk;
  return {
    videoLengthSeconds: plan.videoLengthSeconds,
    fps: plan.fps,
    expectedSamples,
    actualSamples,
    lengthOk,
    tempoMap: plan.sections.map((section) => ({
      startSec: section.startSec,
      endSec: section.endSec,
      bpm: section.bpm,
      beats: section.beats,
      key: `${section.key.root}:${section.key.scale}`,
    })),
    cues,
    summary: { maxSfxErrorMs, maxBoundaryErrorMs, maxMusicSnapErrorMs, measuredOnsetMaxErrorMs, pass },
  };
}

function rmsAt(left: Float32Array, right: Float32Array, index: number, win: number): number {
  let sum = 0;
  const end = Math.min(left.length, right.length, index + win);
  const count = Math.max(1, end - index);
  for (let k = index; k < end; k++) sum += left[k] * left[k] + right[k] * right[k];
  return Math.sqrt(sum / count);
}

/** Largest |sample| in the search window. A 30 Hz sine crest is about 8 ms after the start. */
export function measuredPeakOffsetMs(left: Float32Array, right: Float32Array, sampleRate: number, intendedSample: number): number {
  const search = Math.round((ONSET_SEARCH_MS / 1000) * sampleRate);
  const n = Math.min(left.length, right.length);
  let best = -1;
  let bestAt = intendedSample;
  for (let i = Math.max(0, intendedSample - search); i <= Math.min(n - 1, intendedSample + search); i++) {
    const mag = Math.max(Math.abs(left[i] ?? 0), Math.abs(right[i] ?? 0));
    if (mag > best) {
      best = mag;
      bestAt = i;
    }
  }
  return ((bestAt - intendedSample) / sampleRate) * 1000;
}

/** First sample whose 1 ms RMS reaches half the window maximum. */
export function measuredOnsetErrorMs(left: Float32Array, right: Float32Array, sampleRate: number, intendedSample: number): number {
  const win = Math.max(1, Math.round((ONSET_FRONT_MS / 1000) * sampleRate));
  const search = Math.round((ONSET_SEARCH_MS / 1000) * sampleRate);
  const n = Math.min(left.length, right.length);
  const from = Math.max(0, intendedSample - search);
  const to = Math.min(n - 1, intendedSample + search);
  let max = 0;
  for (let i = from; i <= to; i++) max = Math.max(max, rmsAt(left, right, i, win));
  const gate = max * 0.5;
  for (let i = from; i <= to; i++) {
    if (rmsAt(left, right, i, win) >= gate && gate > 0) return ((i - intendedSample) / sampleRate) * 1000;
  }
  return 0;
}

export function syncMarkdown(report: SyncReport): string {
  const lines = [
    '# Sync report',
    '',
    `Length ${report.videoLengthSeconds}s, expected ${report.expectedSamples} samples, actual ${report.actualSamples}, length ${report.lengthOk ? 'matches' : 'differs'}.`,
    '',
    '| cue | type | time s | boundary ms | sfx max ms | onset ms | accent |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const cue of report.cues) {
    const sfxMax = cue.sfx.reduce((m, item) => Math.max(m, Math.abs(item.errorMs)), 0);
    const onset = cue.sfx.reduce((m, item) => Math.max(m, Math.abs(item.measuredOnsetErrorMs ?? 0)), 0);
    lines.push(`| ${cue.index} | ${cue.type} | ${cue.intendedSec.toFixed(3)} | ${cue.boundary ? cue.boundary.errorMs.toFixed(3) : ''} | ${sfxMax.toFixed(3)} | ${onset.toFixed(3)} | ${cue.musicAccent ? cue.musicAccent.status : ''} |`);
  }
  lines.push('', `pass ${report.summary.pass}`, `max SFX error ${report.summary.maxSfxErrorMs.toFixed(3)} ms`, `max boundary error ${report.summary.maxBoundaryErrorMs.toFixed(3)} ms`, `max measured onset ${report.summary.measuredOnsetMaxErrorMs.toFixed(3)} ms`, `max music snap ${report.summary.maxMusicSnapErrorMs.toFixed(3)} ms`);
  return lines.join('\n');
}

export function cuesCsv(report: SyncReport): string {
  const header = 'index,time_s,time_ms,sample,frame_if_fps,type,label,intensity,actual_ms,error_ms';
  const rows = report.cues.map((cue, index) => {
    const frame = Math.round(cue.intendedSec * report.fps);
    const rate = report.expectedSamples / report.videoLengthSeconds;
    const actualMs = cue.boundary ? (cue.boundary.actualSample / rate) * 1000 : cue.intendedSec * 1000;
    const error = cue.boundary ? cue.boundary.errorMs : maxOrZero(cue.sfx.map((item) => item.errorMs));
    return [
      index,
      cue.intendedSec.toFixed(4),
      Math.round(cue.intendedSec * 1000),
      cue.intendedSample,
      frame,
      cue.type,
      csvCell(cue.label),
      cue.intensity.toFixed(3),
      actualMs.toFixed(3),
      error.toFixed(3),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

export function edlText(report: SyncReport, title = 'SCORE'): string {
  const lines = [`TITLE: ${title}`, 'FCM: NON-DROP FRAME', ''];
  report.cues.forEach((cue, index) => {
    const tc = timecode(cue.intendedSec, report.fps);
    const id = String(index + 1).padStart(3, '0');
    lines.push(`${id}  AX       V     C        ${tc} ${tc} ${tc} ${tc}`);
    lines.push(`* LOC: ${tc} ${edlColor(cue.type)} ${cue.type}${cue.label ? ` ${cue.label}` : ''}`);
  });
  lines.push('', 'This is a marker list. It is not guaranteed to import in every editor.');
  return lines.join('\n');
}

export function timecode(seconds: number, fps: number): string {
  const rate = Math.max(1, Math.round(fps));
  const framesTotal = Math.max(0, Math.round(seconds * rate));
  const frames = framesTotal % rate;
  const whole = Math.floor(framesTotal / rate);
  const ss = whole % 60;
  const mm = Math.floor(whole / 60) % 60;
  const hh = Math.floor(whole / 3600);
  return [hh, mm, ss, frames].map((part) => String(part).padStart(2, '0')).join(':');
}

function edlColor(type: string): string {
  if (type === 'talking') return 'GREEN';
  if (type === 'kill' || type === 'sfx') return 'YELLOW';
  if (type === 'death' || type === 'jumpscare') return 'RED';
  return 'CYAN';
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function maxOrZero(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((m, value) => Math.max(m, value), 0);
}
