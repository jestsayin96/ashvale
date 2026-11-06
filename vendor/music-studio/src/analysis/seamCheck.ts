import {
  CLICK_PERCENTILE_FLOOR,
  CLICK_SCORE_LIMIT,
  RMS_FLOOR,
  SEAM_BASELINE_MARGIN_DB,
  SEAM_BASELINE_PERCENTILE,
  SEAM_BASELINE_WINDOW_MS,
  SEAM_LEVEL_DB,
  SEAM_MIN_SECONDS,
  SEAM_WINDOWS_MS,
  SEAM_WRAP_MS,
  SILENCE_RMS,
} from './targets';

export interface SeamWindow {
  ms: 50 | 100 | 250 | 500;
  lastRmsDb: number;
  firstRmsDb: number;
  diffDb: number;
}

export interface SeamAnalysis {
  windows: SeamWindow[];
  clickScore: number;
  clickDetected: boolean;
  levelMismatch: boolean;
  baselineDiffDb: number;
  status: 'ok' | 'check';
  reasons: string[];
  summary: string;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = values.slice().sort((a, b) => a - b);
  if (s.length === 1) return s[0];
  const rank = p * (s.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.min(s.length - 1, lo + 1);
  const f = rank - lo;
  return s[lo] * (1 - f) + s[hi] * f;
}

function rms(left: Float32Array, right: Float32Array, start: number, end: number): number {
  let s = 0;
  let n = 0;
  const last = Math.min(end, left.length, right.length);
  for (let i = Math.max(0, start); i < last; i++) {
    s += left[i] * left[i] + right[i] * right[i];
    n++;
  }
  if (n === 0) return 0;
  return Math.sqrt(s / n);
}

function toDb(linear: number): number {
  return 20 * Math.log10(Math.max(linear, RMS_FLOOR));
}

function windowPair(left: Float32Array, right: Float32Array, sampleRate: number, ms: number): SeamWindow {
  const n = Math.min(left.length, right.length);
  const win = Math.max(1, Math.round((ms / 1000) * sampleRate));
  const first = rms(left, right, 0, Math.min(win, n));
  const last = rms(left, right, Math.max(0, n - win), n);
  const firstRmsDb = toDb(first);
  const lastRmsDb = toDb(last);
  return {
    ms: ms as SeamWindow['ms'],
    firstRmsDb,
    lastRmsDb,
    diffDb: Math.abs(lastRmsDb - firstRmsDb),
  };
}

function secondDiffMax(channel: Float32Array, from: number, to: number): number {
  let max = 0;
  const start = Math.max(2, from);
  const end = Math.min(channel.length - 1, to);
  for (let i = start; i <= end; i++) {
    const d2 = Math.abs(channel[i] - 2 * channel[i - 1] + channel[i - 2]);
    if (d2 > max) max = d2;
  }
  return max;
}

function clickAtJoin(left: Float32Array, right: Float32Array, sampleRate: number): { score: number; detected: boolean } {
  const n = Math.min(left.length, right.length);
  const w = Math.max(4, Math.round((SEAM_WRAP_MS / 1000) * sampleRate));
  if (n < w + 4) return { score: 0, detected: false };
  const diffs: number[] = [];
  for (const ch of [left, right]) {
    for (let i = 2; i < n; i++) diffs.push(Math.abs(ch[i] - 2 * ch[i - 1] + ch[i - 2]));
  }
  const baseline = Math.max(percentile(diffs, 0.999), CLICK_PERCENTILE_FLOOR);
  let peak = 0;
  for (const ch of [left, right]) {
    const wrapped = new Float32Array(w * 2);
    for (let i = 0; i < w; i++) wrapped[i] = ch[n - w + i];
    for (let i = 0; i < w; i++) wrapped[w + i] = ch[i];
    peak = Math.max(peak, secondDiffMax(wrapped, w - 1, w + 2));
  }
  const score = peak / baseline;
  return { score, detected: score > CLICK_SCORE_LIMIT };
}

function baselineDiff(left: Float32Array, right: Float32Array, sampleRate: number): number {
  const n = Math.min(left.length, right.length);
  const win = Math.max(1, Math.round((SEAM_BASELINE_WINDOW_MS / 1000) * sampleRate));
  const levels: number[] = [];
  for (let i = 0; i + win <= n; i += win) levels.push(toDb(rms(left, right, i, i + win)));
  const diffs: number[] = [];
  for (let i = 0; i < levels.length - 1; i++) diffs.push(Math.abs(levels[i + 1] - levels[i]));
  return percentile(diffs, SEAM_BASELINE_PERCENTILE);
}

export function analyzeSeam(left: Float32Array, right: Float32Array, sampleRate: number): SeamAnalysis {
  const n = Math.min(left.length, right.length);
  const windows = SEAM_WINDOWS_MS.map((ms) => windowPair(left, right, sampleRate, ms));
  const byMs = (ms: number) => windows.find((w) => w.ms === ms)?.diffDb ?? 0;
  const whole = rms(left, right, 0, n);
  const click = n > 0 ? clickAtJoin(left, right, sampleRate) : { score: 0, detected: false };
  const baselineDiffDb = n > 0 ? baselineDiff(left, right, sampleRate) : 0;
  const levelLimit = Math.max(SEAM_LEVEL_DB, baselineDiffDb + SEAM_BASELINE_MARGIN_DB);
  const levelMismatch = byMs(250) > levelLimit && byMs(500) > levelLimit;
  const seconds = n / sampleRate;
  const reasons: string[] = [];
  let status: 'ok' | 'check' = 'ok';

  if (n === 0 || whole < SILENCE_RMS) {
    status = 'check';
    reasons.push('too short/silent to judge');
  } else if (seconds < SEAM_MIN_SECONDS) {
    const win = Math.max(1, Math.round(0.05 * sampleRate));
    const first = rms(left, right, 0, Math.min(win, n));
    const last = rms(left, right, Math.max(0, n - win), n);
    const rmsDiffDb = Math.abs(20 * Math.log10(Math.max(last, RMS_FLOOR) / Math.max(first, RMS_FLOOR)));
    let joinStep = 0;
    joinStep = Math.max(Math.abs(left[0] - left[n - 1]), Math.abs(right[0] - right[n - 1]));
    const steps: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      steps.push(Math.abs(left[i + 1] - left[i]));
      steps.push(Math.abs(right[i + 1] - right[i]));
    }
    const p999 = percentile(steps, 0.999);
    if (!(joinStep <= p999 && rmsDiffDb <= 3)) {
      status = 'check';
      reasons.push(`too short to judge with long windows; 50 ms rmsΔ ${rmsDiffDb.toFixed(2)} dB`);
    }
  } else {
    if (click.detected) {
      status = 'check';
      reasons.push(`Click at the join: score ${click.score.toFixed(2)} (limit ${CLICK_SCORE_LIMIT}).`);
    }
    if (levelMismatch) {
      status = 'check';
      reasons.push(
        `Level mismatch: 250 ms diff ${byMs(250).toFixed(2)} dB and 500 ms diff ${byMs(500).toFixed(2)} dB, above ${levelLimit.toFixed(2)} dB.`,
      );
    }
  }

  const summary = status === 'ok'
    ? `Seam OK. 50 ms ${byMs(50).toFixed(2)} dB, 500 ms ${byMs(500).toFixed(2)} dB, click score ${click.score.toFixed(2)}.`
    : `Seam CHECK. ${reasons.join(' ')}`;

  return {
    windows,
    clickScore: click.score,
    clickDetected: click.detected,
    levelMismatch,
    baselineDiffDb,
    status,
    reasons,
    summary,
  };
}

export function formatSeamText(analysis: SeamAnalysis & { pass?: boolean }): string {
  const head = analysis.status === 'ok' ? 'Seam OK' : 'Seam CHECK';
  const windows = analysis.windows.map((w) => `${w.ms} ms ${w.diffDb.toFixed(2)} dB`).join(', ');
  const why = analysis.reasons.length ? ` ${analysis.reasons.join(' ')}` : '';
  return `${head}.${why} ${windows}.`.replace(/\s+/g, ' ').trim();
}
