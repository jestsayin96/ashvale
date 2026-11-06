import { clamp } from '../units';

/** Soft clip. Amount 0 leaves the sample unchanged aside from a hard ±1 bound. */
export function saturateSample(sample: number, amount: number): number {
  if (!Number.isFinite(sample)) return 0;
  const bounded = clamp(sample, -4, 4);
  if (amount <= 0) return clamp(bounded, -1, 1);
  const drive = 1 + amount * 6;
  const norm = Math.tanh(drive);
  const shaped = norm === 0 ? 0 : Math.tanh(bounded * drive) / norm;
  return clamp(shaped, -1, 1);
}

export function saturateBuffer(input: Float32Array, amount: number): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = saturateSample(input[i], amount);
  return out;
}
