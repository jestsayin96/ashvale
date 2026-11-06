import { linToDb } from '../audio/units';
import { truePeakSample } from './resample';

export interface PeakResult {
  truePeak: number;
  samplePeak: number;
}

export function measurePeaks(left: Float32Array, right: Float32Array): PeakResult {
  let sample = 0;
  const n = Math.min(left.length, right.length);
  for (let i = 0; i < n; i++) {
    const a = left[i] < 0 ? -left[i] : left[i];
    const b = right[i] < 0 ? -right[i] : right[i];
    if (a > sample) sample = a;
    if (b > sample) sample = b;
  }
  const gate = sample * 10 ** (-6 / 20);
  let truePeakLin = sample;
  const channels = [left.subarray(0, n), right.subarray(0, n)];
  for (let i = 0; i < n; i++) {
    const a = left[i] < 0 ? -left[i] : left[i];
    const b = right[i] < 0 ? -right[i] : right[i];
    if (Math.max(a, b) + 1e-12 < gate) continue;
    const peak = truePeakSample(channels, i);
    if (peak > truePeakLin) truePeakLin = peak;
  }
  return { truePeak: linToDb(truePeakLin), samplePeak: linToDb(sample) };
}

/** Alias: measurePeaks already uses 4× windowed-sinc oversampling (BS.1770-4). */
export function measureTruePeak4x(left: Float32Array, right: Float32Array): PeakResult {
  return measurePeaks(left, right);
}
