import { analyzeLoudness } from '../dsp/loudnessAnalyzer';
import { hann, powerSpectrum } from './fft';
import {
  BANDS,
  CENTROID_WINDOW_S,
  FFT_HOP,
  FFT_SIZE,
  LOUDNESS_LONG_HOP_S,
  LOUDNESS_LONG_MIN_SECONDS,
  LOUDNESS_LONG_WINDOW_S,
  LOUDNESS_SHORT_HOP_S,
  LOUDNESS_SHORT_WINDOW_S,
  STEREO_MONO_CORRELATION,
  STEREO_MONO_WIDTH_DB,
  STEREO_NARROW_WIDTH_DB,
  STEREO_WIDE_WIDTH_DB,
} from './targets';

export interface BandShare {
  fraction: number;
  dbBelowTotal: number;
}

export interface SpectrumSummary {
  centroidSeries: Array<{ t: number; hz: number }>;
  centroidMedianHz: number;
  centroidMinHz: number;
  centroidMaxHz: number;
  bands: Record<keyof typeof BANDS, BandShare>;
  brightnessMedianHz: number;
  highShare: number;
}

export interface StereoSummary {
  widthDb: number;
  correlation: number;
  balanceDb: number;
  label: 'mono-like' | 'narrow' | 'moderate' | 'wide';
}

export interface LoudnessSeries {
  series: Array<{ t: number; lufs: number }>;
  min: number;
  max: number;
  median: number;
  movement: number;
  windowSeconds: number;
  hopSeconds: number;
}

const WINDOW = hann(FFT_SIZE);

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = values.slice().sort((a, b) => a - b);
  if (s.length === 1) return s[0];
  const rank = p * (s.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.min(s.length - 1, lo + 1);
  return s[lo] * (1 - (rank - lo)) + s[hi] * (rank - lo);
}

function mixFrame(left: Float32Array, right: Float32Array, start: number, n: number): Float32Array {
  const frame = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const idx = start + i;
    const l = idx < left.length ? left[idx] : 0;
    const r = idx < right.length ? right[idx] : 0;
    frame[i] = 0.5 * (l + r);
  }
  return frame;
}

/** Average one-sided power spectrum of the whole file. */
export function averagePower(left: Float32Array, right: Float32Array, _sampleRate: number): Float32Array {
  const n = Math.min(left.length, right.length);
  const acc = new Float32Array(FFT_SIZE / 2 + 1);
  let frames = 0;
  if (n < FFT_SIZE) {
    const power = powerSpectrum(mixFrame(left, right, 0, FFT_SIZE), WINDOW);
    return power;
  }
  for (let i = 0; i + FFT_SIZE <= n; i += FFT_HOP) {
    const power = powerSpectrum(mixFrame(left, right, i, FFT_SIZE), WINDOW);
    for (let k = 0; k < acc.length; k++) acc[k] += power[k];
    frames++;
  }
  if (frames === 0) return acc;
  for (let k = 0; k < acc.length; k++) acc[k] /= frames;
  return acc;
}

export function centroidHz(power: Float32Array, sampleRate: number): number {
  let num = 0;
  let den = 0;
  for (let k = 0; k < power.length; k++) {
    const freq = (k * sampleRate) / FFT_SIZE;
    num += freq * power[k];
    den += power[k];
  }
  return den > 0 ? num / den : 0;
}

function bandEnergy(power: Float32Array, sampleRate: number, lo: number, hi: number): number {
  let sum = 0;
  for (let k = 0; k < power.length; k++) {
    const freq = (k * sampleRate) / FFT_SIZE;
    if (freq >= lo && freq < hi) sum += power[k];
  }
  return sum;
}

export function bandShares(power: Float32Array, sampleRate: number): Record<keyof typeof BANDS, BandShare> {
  let total = 0;
  for (let k = 0; k < power.length; k++) total += power[k];
  const out = {} as Record<keyof typeof BANDS, BandShare>;
  for (const name of Object.keys(BANDS) as Array<keyof typeof BANDS>) {
    const [lo, hi] = BANDS[name];
    const energy = bandEnergy(power, sampleRate, lo, hi);
    const fraction = total > 0 ? energy / total : 0;
    out[name] = {
      fraction,
      dbBelowTotal: fraction > 0 ? -10 * Math.log10(fraction) : 120,
    };
  }
  return out;
}

function centroidAbove(power: Float32Array, sampleRate: number, floorHz: number): number {
  let num = 0;
  let den = 0;
  for (let k = 0; k < power.length; k++) {
    const freq = (k * sampleRate) / FFT_SIZE;
    if (freq < floorHz) continue;
    num += freq * power[k];
    den += power[k];
  }
  return den > 0 ? num / den : 0;
}

function shareAbove(power: Float32Array, sampleRate: number, floorHz: number): number {
  let high = 0;
  let total = 0;
  for (let k = 0; k < power.length; k++) {
    total += power[k];
    if ((k * sampleRate) / FFT_SIZE >= floorHz) high += power[k];
  }
  return total > 0 ? high / total : 0;
}

export function spectrumSummary(left: Float32Array, right: Float32Array, sampleRate: number): SpectrumSummary {
  const n = Math.min(left.length, right.length);
  const win = Math.max(1, Math.round(CENTROID_WINDOW_S * sampleRate));
  const series: Array<{ t: number; hz: number }> = [];
  const bright: number[] = [];
  const highs: number[] = [];
  const bins = Math.floor(FFT_SIZE / 2);
  const acc = new Float64Array(bins);
  const take = (power: Float32Array, t: number) => {
    series.push({ t, hz: centroidHz(power, sampleRate) });
    bright.push(centroidAbove(power, sampleRate, 150));
    highs.push(shareAbove(power, sampleRate, 2000));
    for (let k = 0; k < power.length && k < acc.length; k++) acc[k] += power[k];
  };
  if (n === 0) take(new Float32Array(bins), 0);
  else if (n <= win) take(averagePower(left, right, sampleRate), 0);
  else {
    for (let i = 0; i + win <= n; i += win) take(averagePower(left.subarray(i, i + win), right.subarray(i, i + win), sampleRate), i / sampleRate);
  }
  const hz = series.map((p) => p.hz);
  return {
    centroidSeries: series,
    centroidMedianHz: median(hz),
    centroidMinHz: hz.length ? Math.min(...hz) : 0,
    centroidMaxHz: hz.length ? Math.max(...hz) : 0,
    bands: bandShares(Float32Array.from(acc), sampleRate),
    brightnessMedianHz: median(bright),
    highShare: median(highs),
  };
}

export function stereoSummary(left: Float32Array, right: Float32Array): StereoSummary {
  const n = Math.min(left.length, right.length);
  let midE = 0;
  let sideE = 0;
  let lE = 0;
  let rE = 0;
  let sumL = 0;
  let sumR = 0;
  let sumLL = 0;
  let sumRR = 0;
  let sumLR = 0;
  for (let i = 0; i < n; i++) {
    const mid = 0.5 * (left[i] + right[i]);
    const side = 0.5 * (left[i] - right[i]);
    midE += mid * mid;
    sideE += side * side;
    lE += left[i] * left[i];
    rE += right[i] * right[i];
    sumL += left[i];
    sumR += right[i];
    sumLL += left[i] * left[i];
    sumRR += right[i] * right[i];
    sumLR += left[i] * right[i];
  }
  const widthDb = 10 * Math.log10(Math.max(sideE, 1e-16) / Math.max(midE, 1e-16));
  const meanL = n > 0 ? sumL / n : 0;
  const meanR = n > 0 ? sumR / n : 0;
  const varL = n > 0 ? sumLL / n - meanL * meanL : 0;
  const varR = n > 0 ? sumRR / n - meanR * meanR : 0;
  const cov = n > 0 ? sumLR / n - meanL * meanR : 0;
  const correlation = varL > 1e-18 && varR > 1e-18 ? cov / Math.sqrt(varL * varR) : 1;
  const balanceDb = 10 * Math.log10(Math.max(lE, 1e-16) / Math.max(rE, 1e-16));
  let label: StereoSummary['label'] = 'moderate';
  if (correlation <= 0 || widthDb >= STEREO_WIDE_WIDTH_DB) label = 'wide';
  else if (correlation >= STEREO_MONO_CORRELATION || widthDb <= STEREO_MONO_WIDTH_DB) label = 'mono-like';
  else if (widthDb <= STEREO_NARROW_WIDTH_DB) label = 'narrow';
  return { widthDb, correlation, balanceDb, label };
}

export function loudnessSeries(left: Float32Array, right: Float32Array, sampleRate: number): LoudnessSeries {
  const n = Math.min(left.length, right.length);
  const seconds = n / sampleRate;
  const long = seconds >= LOUDNESS_LONG_MIN_SECONDS;
  const windowSeconds = long ? LOUDNESS_LONG_WINDOW_S : LOUDNESS_SHORT_WINDOW_S;
  const hopSeconds = long ? LOUDNESS_LONG_HOP_S : LOUDNESS_SHORT_HOP_S;
  const heard = analyzeLoudness(left, right, sampleRate);
  const points = n === 0 ? [{ t: 0, lufs: null }] : heard.series(windowSeconds, hopSeconds);
  const series = points.map((point) => ({ t: point.t, lufs: point.lufs ?? Number.NEGATIVE_INFINITY }));
  const values = series.map((p) => p.lufs).filter((v) => Number.isFinite(v));
  const movement = values.length >= 2 ? percentile(values, 0.95) - percentile(values, 0.1) : 0;
  return {
    series,
    min: values.length ? Math.min(...values) : Number.NEGATIVE_INFINITY,
    max: values.length ? Math.max(...values) : Number.NEGATIVE_INFINITY,
    median: median(values),
    movement,
    windowSeconds,
    hopSeconds,
  };
}

export function rmsPerSecond(left: Float32Array, right: Float32Array, sampleRate: number): Array<{ t: number; db: number }> {
  const n = Math.min(left.length, right.length);
  const out: Array<{ t: number; db: number }> = [];
  const step = Math.max(1, Math.round(sampleRate));
  if (n === 0) return [{ t: 0, db: -120 }];
  for (let i = 0; i < n; i += step) {
    const end = Math.min(n, i + step);
    let s = 0;
    let count = 0;
    for (let j = i; j < end; j++) {
      s += left[j] * left[j] + right[j] * right[j];
      count++;
    }
    const rms = count > 0 ? Math.sqrt(s / count) : 0;
    out.push({ t: i / sampleRate, db: 20 * Math.log10(Math.max(rms, 1e-9)) });
  }
  return out;
}
