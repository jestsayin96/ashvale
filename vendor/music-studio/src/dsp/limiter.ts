import { truePeakSample } from './resample';

function slidingMin(g: Float32Array, radius: number): Float32Array {
  const n = g.length;
  const out = new Float32Array(n);
  const w = radius * 2 + 1;
  const dq: number[] = [];
  for (let i = 0; i < n; i++) {
    while (dq.length && dq[0] <= i - w) dq.shift();
    while (dq.length && g[dq[dq.length - 1]] >= g[i]) dq.pop();
    dq.push(i);
    if (i >= w - 1) {
      const center = i - radius;
      if (center >= 0 && center < n) out[center] = g[dq[0]];
    }
  }
  const edge = Math.min(radius, n);
  for (let i = 0; i < edge; i++) {
    let m = Infinity;
    const b = Math.min(n - 1, i + radius);
    for (let j = 0; j <= b; j++) if (g[j] < m) m = g[j];
    out[i] = m;
  }
  for (let i = Math.max(edge, n - radius); i < n; i++) {
    let m = Infinity;
    const a = Math.max(0, i - radius);
    for (let j = a; j < n; j++) if (g[j] < m) m = g[j];
    out[i] = m;
  }
  return out;
}

function movingAverage(g: Float32Array, radius: number): Float32Array {
  const n = g.length;
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + g[i];
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - radius);
    const b = Math.min(n - 1, i + radius);
    out[i] = (prefix[b + 1] - prefix[a]) / (b - a + 1);
  }
  return out;
}

export interface LimitedAudio {
  left: Float32Array;
  right: Float32Array;
}

/**
 * Offline look-ahead true-peak limiter.
 * Gain is a sliding minimum of the required gain, then a moving average
 * (so it stays at or under the requirement), then a release smoother.
 */
export function limitTruePeak(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  ceilingDb: number,
): LimitedAudio {
  const n = Math.min(left.length, right.length);
  const L = left.subarray(0, n);
  const R = right.subarray(0, n);
  const ceilLin = Math.pow(10, ceilingDb / 20);
  const gate = ceilLin * 10 ** (-6 / 20);
  const env = new Float32Array(n);
  const channels = [L, R];
  let truePeakLin = 0;
  for (let i = 0; i < n; i++) {
    const a = L[i] < 0 ? -L[i] : L[i];
    const b = R[i] < 0 ? -R[i] : R[i];
    const sample = a > b ? a : b;
    const peak = sample + 1e-12 >= gate ? truePeakSample(channels, i) : sample;
    env[i] = peak;
    if (peak > truePeakLin) truePeakLin = peak;
  }
  if (!(truePeakLin > ceilLin)) {
    return { left: new Float32Array(L), right: new Float32Array(R) };
  }
  const gReq = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const e = env[i];
    gReq[i] = e > 1e-12 ? Math.min(1, ceilLin / e) : 1;
  }
  const radius = Math.max(1, Math.round(0.0015 * sampleRate));
  const averaged = movingAverage(slidingMin(gReq, radius), radius);
  const outG = new Float32Array(n);
  const alpha = 1 - Math.exp(-1 / (0.08 * sampleRate));
  let y = averaged[0] ?? 1;
  for (let i = 0; i < n; i++) {
    const target = averaged[i];
    if (target > y) y += alpha * (target - y);
    else y = target;
    outG[i] = y;
  }
  const oL = new Float32Array(n);
  const oR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    oL[i] = L[i] * outG[i];
    oR[i] = R[i] * outG[i];
  }
  return { left: oL, right: oR };
}
