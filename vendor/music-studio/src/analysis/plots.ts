import { powerSpectrum, hann } from './fft';
import { loudnessSeries } from './features';
import { FFT_SIZE, SPECTROGRAM_COLS, SPECTROGRAM_HZ, SPECTROGRAM_ROWS, WAVEFORM_COLUMNS } from './targets';

const WINDOW = hann(FFT_SIZE);

export interface SpectrogramData {
  db: number[][];
  rows: number;
  cols: number;
  times: number[];
  freqs: number[];
}

export interface WaveformData {
  columns: number;
  leftMin: number[];
  leftMax: number[];
  rightMin: number[];
  rightMax: number[];
  barTimes: number[];
}

export interface LoudnessPlot {
  series: Array<{ t: number; lufs: number }>;
  targetLufs: number;
}

function logHz(row: number, rows: number): number {
  const [lo, hi] = SPECTROGRAM_HZ;
  const t = rows <= 1 ? 0 : row / (rows - 1);
  return lo * Math.pow(hi / lo, t);
}

function toDb(power: number): number {
  return 10 * Math.log10(Math.max(power, 1e-12));
}

export function spectrogramMatrix(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  rows = SPECTROGRAM_ROWS,
  cols = SPECTROGRAM_COLS,
): SpectrogramData {
  const n = Math.min(left.length, right.length);
  const db = Array.from({ length: rows }, () => Array.from({ length: cols }, () => -120));
  const times: number[] = [];
  const freqs = Array.from({ length: rows }, (_, r) => logHz(r, rows));
  const hop = n <= FFT_SIZE ? 1 : Math.max(1, Math.floor((n - FFT_SIZE) / Math.max(1, cols - 1)));
  for (let c = 0; c < cols; c++) {
    const start = Math.min(Math.max(0, n - FFT_SIZE), c * hop);
    times.push(start / sampleRate);
    const frame = new Float32Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
      const idx = start + i;
      const l = idx < left.length ? left[idx] : 0;
      const r = idx < right.length ? right[idx] : 0;
      frame[i] = 0.5 * (l + r);
    }
    const power = powerSpectrum(frame, WINDOW);
    const rowPower = Array.from({ length: rows }, () => 0);
    const rowCount = Array.from({ length: rows }, () => 0);
    for (let k = 1; k < power.length; k++) {
      const freq = (k * sampleRate) / FFT_SIZE;
      if (freq < SPECTROGRAM_HZ[0] || freq > SPECTROGRAM_HZ[1]) continue;
      const t = Math.log(freq / SPECTROGRAM_HZ[0]) / Math.log(SPECTROGRAM_HZ[1] / SPECTROGRAM_HZ[0]);
      const row = Math.max(0, Math.min(rows - 1, Math.round(t * (rows - 1))));
      rowPower[row] += power[k];
      rowCount[row]++;
    }
    for (let r = 0; r < rows; r++) {
      db[r][c] = rowCount[r] > 0 ? toDb(rowPower[r] / rowCount[r]) : -120;
    }
  }
  return { db, rows, cols, times, freqs };
}

export function waveformEnvelope(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  columns = WAVEFORM_COLUMNS,
  barSeconds = 0,
): WaveformData {
  const n = Math.max(left.length, right.length);
  const leftMin: number[] = [];
  const leftMax: number[] = [];
  const rightMin: number[] = [];
  const rightMax: number[] = [];
  const size = Math.max(1, Math.ceil(n / columns));
  for (let c = 0; c < columns; c++) {
    const start = c * size;
    let l0 = Infinity;
    let l1 = -Infinity;
    let r0 = Infinity;
    let r1 = -Infinity;
    const end = Math.min(n, start + size);
    if (start >= n) {
      leftMin.push(0);
      leftMax.push(0);
      rightMin.push(0);
      rightMax.push(0);
      continue;
    }
    for (let i = start; i < end; i++) {
      const lv = i < left.length ? left[i] : 0;
      const rv = i < right.length ? right[i] : 0;
      if (lv < l0) l0 = lv;
      if (lv > l1) l1 = lv;
      if (rv < r0) r0 = rv;
      if (rv > r1) r1 = rv;
    }
    leftMin.push(l0);
    leftMax.push(l1);
    rightMin.push(r0);
    rightMax.push(r1);
  }
  const seconds = n / sampleRate;
  const barTimes: number[] = [];
  if (barSeconds > 0) {
    for (let t = 0; t <= seconds + 1e-9; t += barSeconds) barTimes.push(t);
  }
  return { columns, leftMin, leftMax, rightMin, rightMax, barTimes };
}

/** Dark blue at 0, yellow at 1. Clamped. The red channel rises with value. */
export function colorMap(value: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, value));
  const r = Math.round(20 + 230 * t);
  const g = Math.round(30 + 180 * t * t);
  const b = Math.round(80 * (1 - t));
  return [r, g, b];
}

export function loudnessPlot(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  targetLufs: number,
): LoudnessPlot {
  return { series: loudnessSeries(left, right, sampleRate).series, targetLufs };
}
