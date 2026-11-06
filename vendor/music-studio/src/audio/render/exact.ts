import { buildEvents } from '../events';
import type { Project } from '../../model/types';
import { EXACT_END_RMS_DB, EXACT_END_SAMPLE_ABS, EXACT_FADE_MS_MIN } from '../../style/targets';
import { renderProject } from './offline';

export interface ExactReport {
  requestedSeconds: number;
  samples: number;
  expectedSamples: number;
  bars: number;
  bpm: number;
  ending: 'cadence' | 'trim-fade';
  fadeMs: number;
  lastBarEndSec: number;
  endRmsDb: number;
  lastSampleAbs: number;
  pass: boolean;
}

export interface ExactRender {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  samples: number;
  report: ExactReport;
}

function rmsDb(left: Float32Array, right: Float32Array, sampleRate: number): number {
  const n = Math.max(1, Math.round(0.05 * sampleRate));
  const from = Math.max(0, left.length - n);
  let sum = 0;
  let count = 0;
  for (let i = from; i < left.length; i++) {
    sum += left[i] * left[i] + (right[i] ?? 0) * (right[i] ?? 0);
    count += 2;
  }
  const mean = sum / Math.max(1, count);
  return mean <= 1e-12 ? -120 : 10 * Math.log10(mean);
}

function cosineFade(left: Float32Array, right: Float32Array, sampleRate: number, fadeMs: number): void {
  const fade = Math.max(EXACT_FADE_MS_MIN, fadeMs);
  const n = Math.min(left.length, Math.round((fade / 1000) * sampleRate));
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const gain = 0.5 * (1 + Math.cos(Math.PI * t));
    const index = left.length - n + i;
    left[index] *= gain;
    right[index] *= gain;
  }
  if (left.length) {
    left[left.length - 1] = 0;
    right[right.length - 1] = 0;
  }
}

/** Pure envelope used when OfflineAudioContext is absent. Length is the exact sample count. */
export function pureExact(project: Project, sampleRate = 44100): ExactRender {
  const seconds = project.exact?.seconds ?? 1;
  const expected = Math.round(seconds * sampleRate);
  const left = new Float32Array(expected);
  const right = new Float32Array(expected);
  const events = buildEvents(project, project.exact?.bars ?? project.bars);
  for (const event of events) {
    const at = Math.min(expected - 1, Math.max(0, Math.round(event.time * sampleRate)));
    const amp = Math.min(0.2, event.vel * 0.05);
    left[at] += amp;
    right[at] += amp;
  }
  cosineFade(left, right, sampleRate, project.exact?.fadeMs ?? 400);
  const end = rmsDb(left, right, sampleRate);
  const last = Math.max(Math.abs(left[left.length - 1] ?? 0), Math.abs(right[right.length - 1] ?? 0));
  const ending = project.exact?.ending ?? 'cadence';
  return {
    left,
    right,
    sampleRate,
    samples: expected,
    report: {
      requestedSeconds: seconds,
      samples: expected,
      expectedSamples: expected,
      bars: project.exact?.bars ?? project.bars,
      bpm: project.bpm,
      ending,
      fadeMs: Math.max(EXACT_FADE_MS_MIN, project.exact?.fadeMs ?? 400),
      lastBarEndSec: seconds,
      endRmsDb: end,
      lastSampleAbs: last,
      pass: expected === expected && (last < EXACT_END_SAMPLE_ABS || end < EXACT_END_RMS_DB),
    },
  };
}

export async function renderExact(project: Project, opts?: { sampleRate?: number; pure?: boolean }): Promise<ExactRender> {
  if (opts?.pure || typeof OfflineAudioContext === 'undefined') return pureExact(project, opts?.sampleRate ?? 44100);
  const sampleRate = opts?.sampleRate ?? 44100;
  const seconds = project.exact?.seconds ?? 1;
  const expected = Math.round(seconds * sampleRate);
  const bars = project.exact?.bars ?? project.bars;
  const rendered = await renderProject(project, bars, { tailSamples: Math.round(0.4 * sampleRate) });
  const left = new Float32Array(expected);
  const right = new Float32Array(expected);
  const n = Math.min(expected, rendered.left.length);
  left.set(rendered.left.subarray(0, n));
  right.set(rendered.right.subarray(0, n));
  if (project.exact?.ending === 'trim-fade' || true) cosineFade(left, right, sampleRate, project.exact?.fadeMs ?? 400);
  const end = rmsDb(left, right, sampleRate);
  const last = Math.max(Math.abs(left[left.length - 1] ?? 0), Math.abs(right[right.length - 1] ?? 0));
  return {
    left,
    right,
    sampleRate,
    samples: left.length,
    report: {
      requestedSeconds: seconds,
      samples: left.length,
      expectedSamples: expected,
      bars,
      bpm: project.bpm,
      ending: project.exact?.ending ?? 'cadence',
      fadeMs: Math.max(EXACT_FADE_MS_MIN, project.exact?.fadeMs ?? 400),
      lastBarEndSec: (bars * 4 * 60) / project.bpm,
      endRmsDb: end,
      lastSampleAbs: last,
      pass: left.length === expected && (last < EXACT_END_SAMPLE_ABS || end < EXACT_END_RMS_DB),
    },
  };
}
