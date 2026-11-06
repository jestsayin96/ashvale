import { applySpeechPocket } from '../../dsp/speechPocket';
import { seamReport, type SeamReport } from '../../dsp/seam';
import type { Project } from '../../model/types';
import { renderProject } from './offline';
import { loopSampleCount } from './timing';

export { loopSampleCount };

export function foldTail(
  left: Float32Array,
  right: Float32Array,
  loopSamples: number,
): { left: Float32Array; right: Float32Array } {
  const n = Math.max(0, loopSamples);
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  const foldN = Math.max(0, Math.min(n, left.length - n));
  for (let i = 0; i < n; i++) {
    outL[i] = i < left.length ? left[i] : 0;
    outR[i] = i < right.length ? right[i] : 0;
  }
  for (let i = 0; i < foldN; i++) {
    outL[i] += left[n + i];
    outR[i] += right[n + i];
  }
  return { left: outL, right: outR };
}

/** Nearest index, within 5 ms, where both channels change sign. Returns the cut length. */
export function nearestZeroCut(left: Float32Array, right: Float32Array, loopSamples: number, sampleRate: number): number {
  const delta = Math.round(0.005 * sampleRate);
  const from = Math.max(1, loopSamples - delta);
  const to = Math.min(left.length - 1, right.length - 1, loopSamples + delta);
  let best = loopSamples;
  let bestDist = Infinity;
  for (let i = from; i <= to; i++) {
    const lCross = left[i - 1] * left[i] <= 0;
    const rCross = right[i - 1] * right[i] <= 0;
    if (!lCross || !rCross) continue;
    const dist = Math.abs(i - loopSamples);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/** Equal-power crossfade pairing the start with the end, measured inward from the seam. */
export function crossfadeSeam(left: Float32Array, right: Float32Array, samples: number): void {
  const n = Math.min(left.length, right.length);
  const c = Math.max(0, Math.min(samples, Math.floor(n / 2)));
  if (c === 0) return;
  const ls = left.slice(0, c);
  const rs = right.slice(0, c);
  const le = new Float32Array(c);
  const re = new Float32Array(c);
  for (let i = 0; i < c; i++) {
    le[i] = left[n - 1 - i];
    re[i] = right[n - 1 - i];
  }
  for (let i = 0; i < c; i++) {
    const away = c === 1 ? 0 : i / (c - 1);
    const mix = Math.cos(away * Math.PI * 0.5);
    const theta = mix * Math.PI * 0.25;
    const a = Math.cos(theta);
    const b = Math.sin(theta);
    left[i] = ls[i] * a + le[i] * b;
    right[i] = rs[i] * a + re[i] * b;
    left[n - 1 - i] = le[i] * a + ls[i] * b;
    right[n - 1 - i] = re[i] * a + rs[i] * b;
  }
}

export interface LoopRender {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  nominalSamples: number;
  samples: number;
  seam: SeamReport;
  snapped: boolean;
}

export async function renderLoop(
  project: Project,
  options: { snap: boolean; crossfadeMs: number },
): Promise<LoopRender> {
  const sampleRate = 44100;
  const nominalSamples = loopSampleCount(project.bars, project.bpm, sampleRate);
  const tailSamples = 2 * sampleRate;
  const rendered = await renderProject(project, project.bars, { tailSamples });
  let bufferL = rendered.left;
  let bufferR = rendered.right;
  if (project.master.speechPocket) {
    bufferL = new Float32Array(rendered.left);
    bufferR = new Float32Array(rendered.right);
    applySpeechPocket(bufferL, bufferR, sampleRate, project.master.speechDipDb);
  }
  let end = nominalSamples;
  let snapped = false;
  if (options.snap) {
    const cut = nearestZeroCut(bufferL, bufferR, nominalSamples, sampleRate);
    if (cut !== nominalSamples) snapped = true;
    end = cut;
  }
  const folded = foldTail(bufferL, bufferR, end);
  if (options.crossfadeMs > 0) {
    crossfadeSeam(folded.left, folded.right, Math.round((options.crossfadeMs / 1000) * sampleRate));
  }
  return {
    left: folded.left,
    right: folded.right,
    sampleRate,
    nominalSamples,
    samples: folded.left.length,
    seam: seamReport(folded.left, folded.right, sampleRate),
    snapped,
  };
}
