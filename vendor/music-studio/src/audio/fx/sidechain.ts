import { dbToLin } from '../units';

export interface SidechainHit {
  sample: number;
  depthDb: number;
}

/** Linear release from depthDb back to unity. The hit sample is the deepest point. */
export function sidechainEnvelope(
  length: number,
  sampleRate: number,
  hits: SidechainHit[],
  releaseMs: number,
): Float32Array {
  const gain = new Float32Array(length);
  gain.fill(1);
  const release = Math.max(1, Math.round((releaseMs / 1000) * sampleRate));
  for (const hit of hits) {
    const depth = dbToLin(hit.depthDb);
    const start = Math.round(hit.sample);
    for (let i = 0; i <= release; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= length) continue;
      const g = depth + (1 - depth) * (i / release);
      if (g < gain[idx]) gain[idx] = g;
    }
  }
  return gain;
}

export function applyGainCurve(buffer: Float32Array, gain: Float32Array): void {
  const n = Math.min(buffer.length, gain.length);
  for (let i = 0; i < n; i++) buffer[i] *= gain[i];
}
