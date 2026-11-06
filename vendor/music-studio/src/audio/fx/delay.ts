/** Tempo-free feedback delay: 3/16 note at the given bpm, with a one-pole lowpass in the loop. */
export function feedbackDelay(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  bpm: number,
  feedback = 0.35,
): { left: Float32Array; right: Float32Array } {
  const seconds = (60 / Math.max(1, bpm)) * (3 / 16);
  const delay = Math.max(1, Math.round(seconds * sampleRate));
  return {
    left: delayChannel(left, delay, feedback),
    right: delayChannel(right, delay, feedback),
  };
}

function delayChannel(input: Float32Array, delay: number, feedback: number): Float32Array {
  const out = new Float32Array(input.length);
  const buf = new Float32Array(delay);
  let index = 0;
  let low = 0;
  const damp = 0.35;
  for (let i = 0; i < input.length; i++) {
    const delayed = buf[index];
    low = delayed * (1 - damp) + low * damp;
    const sample = input[i] + low * feedback;
    buf[index] = Number.isFinite(sample) ? sample : 0;
    out[i] = Number.isFinite(delayed) ? delayed : 0;
    index += 1;
    if (index >= delay) index = 0;
  }
  return out;
}
