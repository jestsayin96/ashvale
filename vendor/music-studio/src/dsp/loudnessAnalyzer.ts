import { processBiquad, type BiquadCoeffs } from './biquad';

/** Counts full-buffer K-weight passes. Tests use this as a deterministic speed guard. */
export const perfCounters = { fullKWeight: 0 };

export function resetLoudnessCounters(): void {
  perfCounters.fullKWeight = 0;
}

const OFFSET = -0.691;
const FULL_SECONDS = 8;

export interface LoudnessPoint {
  t: number;
  lufs: number | null;
}

export interface LoudnessAnalyzer {
  integrated(): number;
  shortTermMax(): number;
  windowLufs(startSample: number, endSample: number): number;
  series(windowSec: number, hopSec: number): LoudnessPoint[];
}

/** BS.1770 high-shelf plus RLB high-pass, bilinear at `sampleRate`. */
export function kWeightCoeffs(sampleRate: number): { stage1: BiquadCoeffs; stage2: BiquadCoeffs } {
  const shelfF = 1681.974450955533;
  const gain = 3.999843853973347;
  const shelfQ = 0.7071752369554196;
  const k = Math.tan((Math.PI * shelfF) / sampleRate);
  const vh = 10 ** (gain / 20);
  const vb = vh ** 0.4996667741545416;
  const a0 = 1 + k / shelfQ + k * k;
  const stage1: BiquadCoeffs = {
    b0: (vh + (vb * k) / shelfQ + k * k) / a0,
    b1: (2 * (k * k - vh)) / a0,
    b2: (vh - (vb * k) / shelfQ + k * k) / a0,
    a1: (2 * (k * k - 1)) / a0,
    a2: (1 - k / shelfQ + k * k) / a0,
  };
  const hpF = 38.13547087602444;
  const hpQ = 0.5003270373238773;
  const hk = Math.tan((Math.PI * hpF) / sampleRate);
  const hp0 = 1 + hk / hpQ + hk * hk;
  const stage2: BiquadCoeffs = {
    b0: 1 / hp0,
    b1: -2 / hp0,
    b2: 1 / hp0,
    a1: (2 * (hk * hk - 1)) / hp0,
    a2: (1 - hk / hpQ + hk * hk) / hp0,
  };
  return { stage1, stage2 };
}

function loudnessFromZ(z: number): number {
  if (!(z > 0)) return Number.NEGATIVE_INFINITY;
  return OFFSET + 10 * Math.log10(z);
}

export function analyzeLoudness(left: Float32Array, right: Float32Array, sampleRate: number): LoudnessAnalyzer {
  const n = Math.min(left.length, right.length);
  if (n / sampleRate >= FULL_SECONDS) perfCounters.fullKWeight += 1;
  const { stage1, stage2 } = kWeightCoeffs(sampleRate);
  const kl = processBiquad(processBiquad(left.subarray(0, n), stage1), stage2);
  const kr = processBiquad(processBiquad(right.subarray(0, n), stage1), stage2);
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + kl[i] * kl[i] + kr[i] * kr[i];

  const zOf = (a: number, b: number) => {
    const start = Math.max(0, Math.min(n, a));
    const end = Math.max(start, Math.min(n, b));
    const count = end - start;
    if (count <= 0) return 0;
    return (prefix[end] - prefix[start]) / count;
  };

  const integrated = () => {
    const block = Math.max(1, Math.round(0.4 * sampleRate));
    const hop = Math.max(1, Math.round(0.1 * sampleRate));
    const zs: number[] = [];
    if (n < block) {
      if (n > 0) zs.push(zOf(0, n));
    } else {
      for (let i = 0; i + block <= n; i += hop) zs.push(zOf(i, i + block));
    }
    if (zs.length === 0) return Number.NEGATIVE_INFINITY;
    const absCut = 10 ** ((-70 - OFFSET) / 10);
    let sum = 0;
    let count = 0;
    for (const z of zs) {
      if (z > absCut) {
        sum += z;
        count += 1;
      }
    }
    if (count === 0) return Number.NEGATIVE_INFINITY;
    const relCut = 10 ** ((loudnessFromZ(sum / count) - 10 - OFFSET) / 10);
    let sum2 = 0;
    let count2 = 0;
    for (const z of zs) {
      if (z > absCut && z > relCut) {
        sum2 += z;
        count2 += 1;
      }
    }
    if (count2 === 0) return Number.NEGATIVE_INFINITY;
    return loudnessFromZ(sum2 / count2);
  };

  const shortTermMax = () => {
    const win = Math.max(1, Math.round(3 * sampleRate));
    const hop = Math.max(1, Math.round(sampleRate));
    if (n === 0) return Number.NEGATIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    const windows = n < win ? [[0, n]] : [];
    if (n >= win) {
      for (let i = 0; i + win <= n; i += hop) windows.push([i, i + win]);
    }
    for (const [a, b] of windows) {
      const value = loudnessFromZ(zOf(a, b));
      if (value > max) max = value;
    }
    return max;
  };

  return {
    integrated,
    shortTermMax,
    windowLufs(startSample, endSample) {
      return loudnessFromZ(zOf(Math.round(startSample), Math.round(endSample)));
    },
    series(windowSec, hopSec) {
      const win = Math.max(1, Math.round(windowSec * sampleRate));
      let hop = Math.max(1, Math.round(hopSec * sampleRate));
      const span = Math.max(1, n - win);
      if (span / hop > 600) hop = Math.ceil(span / 600);
      const points: LoudnessPoint[] = [];
      if (n === 0) return [{ t: 0, lufs: null }];
      if (n < win) {
        const value = loudnessFromZ(zOf(0, n));
        return [{ t: 0, lufs: Number.isFinite(value) ? value : null }];
      }
      for (let i = 0; i + win <= n; i += hop) {
        const value = loudnessFromZ(zOf(i, i + win));
        points.push({ t: i / sampleRate, lufs: Number.isFinite(value) ? value : null });
      }
      return points;
    },
  };
}
