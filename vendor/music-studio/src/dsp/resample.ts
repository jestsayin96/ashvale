/** Windowed-sinc helpers. Used for 48 kHz loudness and 4x true-peak upsampling. */

function sinc(x: number): number {
  if (Math.abs(x) < 1e-12) return 1;
  const p = Math.PI * x;
  return Math.sin(p) / p;
}

function blackman(k: number, n: number): number {
  const q = k / (n - 1);
  return 0.42 - 0.5 * Math.cos(2 * Math.PI * q) + 0.08 * Math.cos(4 * Math.PI * q);
}

const TAPS = 63;
const HALF = (TAPS - 1) >> 1;

function designPhase(phase: number): Float32Array {
  const h = new Float32Array(TAPS);
  const frac = phase / 4;
  let sum = 0;
  for (let k = 0; k < TAPS; k++) {
    const x = k - HALF - frac;
    const c = sinc(x) * blackman(k, TAPS);
    h[k] = c;
    sum += c;
  }
  if (phase !== 0 && Math.abs(sum) > 1e-12) {
    for (let k = 0; k < TAPS; k++) h[k] /= sum;
  }
  return h;
}

const PHASES: Float32Array[] = [0, 1, 2, 3].map((p) => designPhase(p));

export interface Oversample4 {
  env: Float32Array;
  truePeakLin: number;
}

/** True-peak magnitude at one sample, using the same 4x phases as the full envelope. */
export function truePeakSample(channels: Float32Array[], index: number): number {
  const n = channels[0]?.length ?? 0;
  let peak = 0;
  for (let p = 0; p < 4; p++) {
    const h = PHASES[p];
    for (let c = 0; c < channels.length; c++) {
      const ch = channels[c];
      let acc = 0;
      const i0 = index - HALF;
      for (let k = 0; k < TAPS; k++) {
        const idx = i0 + k;
        if (idx >= 0 && idx < n) acc += ch[idx] * h[k];
      }
      const mag = acc < 0 ? -acc : acc;
      if (mag > peak) peak = mag;
    }
  }
  return peak;
}

/** Per-sample max of the 4 oversampled phases, across channels, plus the global peak. */
export function oversample4Envelope(channels: Float32Array[]): Oversample4 {
  const n = channels[0]?.length ?? 0;
  const env = new Float32Array(n);
  let truePeakLin = 0;
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let p = 0; p < 4; p++) {
      const h = PHASES[p];
      for (let c = 0; c < channels.length; c++) {
        const ch = channels[c];
        let acc = 0;
        const i0 = i - HALF;
        for (let k = 0; k < TAPS; k++) {
          const idx = i0 + k;
          if (idx >= 0 && idx < n) acc += ch[idx] * h[k];
        }
        const a = acc < 0 ? -acc : acc;
        if (a > m) m = a;
      }
    }
    env[i] = m;
    if (m > truePeakLin) truePeakLin = m;
  }
  return { env, truePeakLin };
}

export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (input.length === 0) return new Float32Array(0);
  if (fromRate === toRate) return new Float32Array(input);
  const ratio = toRate / fromRate;
  const outLen = Math.max(1, Math.round((input.length * toRate) / fromRate));
  const out = new Float32Array(outLen);
  const cutoff = Math.min(1, ratio);
  const half = 32;
  for (let i = 0; i < outLen; i++) {
    const t = i / ratio;
    const i0 = Math.floor(t);
    let acc = 0;
    for (let k = i0 - half; k <= i0 + half; k++) {
      const d = t - k;
      if (d < -half || d > half) continue;
      const win = 0.5 * (1 + Math.cos((Math.PI * d) / half));
      const c = sinc(cutoff * d) * cutoff * win;
      if (k >= 0 && k < input.length) acc += input[k] * c;
    }
    out[i] = acc;
  }
  return out;
}
