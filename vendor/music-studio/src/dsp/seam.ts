import { analyzeSeam, type SeamAnalysis, type SeamWindow } from '../analysis/seamCheck';

export interface SeamReport extends SeamAnalysis {
  joinStep: number;
  p999Step: number;
  /** Absolute 50 ms first-vs-last RMS difference, in dB. Informational. */
  rmsDiffDb: number;
  pass: boolean;
  windows: SeamWindow[];
}

function percentile999(values: number[]): number {
  if (values.length === 0) return 0;
  const s = values.slice().sort((a, b) => a - b);
  if (s.length === 1) return s[0];
  const rank = 0.999 * (s.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.min(s.length - 1, lo + 1);
  const f = rank - lo;
  return s[lo] * (1 - f) + s[hi] * f;
}

function rmsWindow(left: Float32Array, right: Float32Array, start: number, end: number): number {
  let s = 0;
  let n = 0;
  for (let i = start; i < end; i++) {
    s += left[i] * left[i] + right[i] * right[i];
    n++;
  }
  if (n === 0) return 0;
  return Math.sqrt(s / n);
}

export function seamReport(left: Float32Array, right: Float32Array, sampleRate: number): SeamReport {
  const n = Math.min(left.length, right.length);
  let joinStep = 0;
  if (n > 0) {
    joinStep = Math.max(Math.abs(left[0] - left[n - 1]), Math.abs(right[0] - right[n - 1]));
  }
  const diffs: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    diffs.push(Math.abs(left[i + 1] - left[i]));
    diffs.push(Math.abs(right[i + 1] - right[i]));
  }
  const p999Step = percentile999(diffs);
  const win = Math.max(1, Math.round(0.05 * sampleRate));
  const first = rmsWindow(left, right, 0, Math.min(win, n));
  const last = rmsWindow(left, right, Math.max(0, n - win), n);
  const rmsDiffDb = Math.abs(20 * Math.log10(Math.max(last, 1e-9) / Math.max(first, 1e-9)));
  const analysis = analyzeSeam(left, right, sampleRate);
  return {
    joinStep,
    p999Step,
    rmsDiffDb,
    pass: analysis.status === 'ok',
    ...analysis,
  };
}
