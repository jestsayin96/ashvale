import { analyzeLoudness } from './loudnessAnalyzer';
import { processBiquad, type BiquadCoeffs } from './biquad';
import { resample } from './resample';

/** BS.1770-4 K-weighting at 48 kHz. */
const STAGE1: BiquadCoeffs = {
  b0: 1.53512485958697,
  b1: -2.69169618940638,
  b2: 1.19839281085285,
  a1: -1.69065929318241,
  a2: 0.73248077421585,
};
const STAGE2: BiquadCoeffs = {
  b0: 1,
  b1: -2,
  b2: 1,
  a1: -1.99004745483398,
  a2: 0.99007225036621,
};

const LUFS_RATE = 48000;
const BLOCK = 19200;
const HOP = 4800;
const OFFSET = -0.691;

export interface LufsResult {
  integrated: number;
  shortTermMax: number;
}

function meanSquare(x: Float32Array, start: number, end: number): number {
  let s = 0;
  const n = end - start;
  if (n <= 0) return 0;
  for (let i = start; i < end; i++) s += x[i] * x[i];
  return s / n;
}

function loudnessFromZ(z: number): number {
  if (!(z > 0)) return Number.NEGATIVE_INFINITY;
  return OFFSET + 10 * Math.log10(z);
}

function blockZs(channels: Float32Array[]): number[] {
  const n = channels[0]?.length ?? 0;
  const zs: number[] = [];
  if (n === 0) return zs;
  if (n < BLOCK) {
    let z = 0;
    for (const ch of channels) z += meanSquare(ch, 0, n);
    zs.push(z);
    return zs;
  }
  for (let i = 0; i + BLOCK <= n; i += HOP) {
    let z = 0;
    for (const ch of channels) z += meanSquare(ch, i, i + BLOCK);
    zs.push(z);
  }
  return zs;
}

function gated(zs: number[]): number {
  if (zs.length === 0) return Number.NEGATIVE_INFINITY;
  const absCut = Math.pow(10, (-70 - OFFSET) / 10);
  let sum = 0;
  let count = 0;
  for (const z of zs) {
    if (z > absCut) {
      sum += z;
      count++;
    }
  }
  if (count === 0) return Number.NEGATIVE_INFINITY;
  const relLoud = loudnessFromZ(sum / count) - 10;
  const relCut = Math.pow(10, (relLoud - OFFSET) / 10);
  let sum2 = 0;
  let count2 = 0;
  for (const z of zs) {
    if (z > absCut && z > relCut) {
      sum2 += z;
      count2++;
    }
  }
  if (count2 === 0) return Number.NEGATIVE_INFINITY;
  return loudnessFromZ(sum2 / count2);
}

function shortTermMax(channels: Float32Array[]): number {
  const n = channels[0]?.length ?? 0;
  const win = LUFS_RATE * 3;
  const hop = LUFS_RATE;
  if (n === 0) return Number.NEGATIVE_INFINITY;
  const windows: Array<[number, number]> = [];
  if (n < win) windows.push([0, n]);
  else for (let i = 0; i + win <= n; i += hop) windows.push([i, i + win]);
  let max = Number.NEGATIVE_INFINITY;
  for (const [a, b] of windows) {
    let z = 0;
    for (const ch of channels) z += meanSquare(ch, a, b);
    const l = loudnessFromZ(z);
    if (l > max) max = l;
  }
  return max;
}

function kWeight(x: Float32Array): Float32Array {
  return processBiquad(processBiquad(x, STAGE1), STAGE2);
}

export function measureLufs(left: Float32Array, right: Float32Array, sampleRate: number): LufsResult {
  const heard = analyzeLoudness(left, right, sampleRate);
  return { integrated: heard.integrated(), shortTermMax: heard.shortTermMax() };
}
