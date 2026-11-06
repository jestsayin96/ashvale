const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASS = [556, 441, 341, 225];

export interface ReverbOptions {
  room?: number;
  damp?: number;
  preDelayMs?: number;
}

/** Schroeder reverb: 8 combs and 4 allpasses per channel. Deterministic, no noise source. */
export function reverb(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  options: ReverbOptions = {},
): { left: Float32Array; right: Float32Array } {
  const room = options.room ?? 0.82;
  const damp = options.damp ?? 0.35;
  const pre = Math.round(((options.preDelayMs ?? 20) / 1000) * sampleRate);
  const scale = sampleRate / 44100;
  return {
    left: channel(left, scale, room, damp, pre, 0),
    right: channel(right, scale, room, damp, pre, 23),
  };
}

function channel(input: Float32Array, scale: number, room: number, damp: number, preDelay: number, spread: number): Float32Array {
  const mixed = new Float32Array(input.length);
  for (let c = 0; c < COMBS.length; c++) {
    const size = Math.max(8, Math.round((COMBS[c] + spread) * scale));
    addComb(input, mixed, size, room, damp);
  }
  const norm = 1 / COMBS.length;
  for (let i = 0; i < mixed.length; i++) mixed[i] *= norm;
  for (let a = 0; a < ALLPASS.length; a++) {
    const size = Math.max(4, Math.round((ALLPASS[a] + spread) * scale));
    allpassInPlace(mixed, size, 0.5);
  }
  if (preDelay <= 0) return mixed;
  const delayed = new Float32Array(input.length);
  for (let i = preDelay; i < delayed.length; i++) delayed[i] = mixed[i - preDelay];
  return delayed;
}

function addComb(input: Float32Array, into: Float32Array, delay: number, feedback: number, damp: number): void {
  const buf = new Float32Array(delay);
  let index = 0;
  let filter = 0;
  for (let i = 0; i < input.length; i++) {
    const delayed = buf[index];
    filter = delayed * (1 - damp) + filter * damp;
    const next = input[i] + filter * feedback;
    buf[index] = Number.isFinite(next) ? next : 0;
    into[i] += Number.isFinite(delayed) ? delayed : 0;
    index += 1;
    if (index >= delay) index = 0;
  }
}

function allpassInPlace(buffer: Float32Array, delay: number, feedback: number): void {
  const buf = new Float32Array(delay);
  let index = 0;
  for (let i = 0; i < buffer.length; i++) {
    const delayed = buf[index];
    const inputSample = buffer[i];
    buf[index] = inputSample + delayed * feedback;
    const sample = delayed - feedback * buf[index];
    buffer[i] = Number.isFinite(sample) ? sample : 0;
    index += 1;
    if (index >= delay) index = 0;
  }
}
