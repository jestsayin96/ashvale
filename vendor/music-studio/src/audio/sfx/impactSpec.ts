/**
 * Shared transient for measured impacts.
 * The Web Audio voice and simulateImpact both read this table.
 * The crest is the first sample of the burst (cosine phase), so it sits on the designed offset.
 */

export interface TransientSpec {
  hz: number;
  ms: number;
  gain: number;
  floorHz: number;
}

const TABLE: Record<string, TransientSpec> = {
  sub_drop: { hz: 2200, ms: 5, gain: 0.9, floorHz: 80 },
  jumpscare_hit: { hz: 4200, ms: 4, gain: 1, floorHz: 80 },
};

const DEFAULT_TRANSIENT: TransientSpec = { hz: 3500, ms: 6, gain: 1, floorHz: 80 };

export function transientSpec(name: string): TransientSpec {
  return TABLE[name] ?? DEFAULT_TRANSIENT;
}

/** Returns a mono burst. The largest sample is at offsetSec. */
export function simulateImpact(name: string, sampleRate: number, amp: number, offsetSec: number, seconds: number): Float32Array {
  const spec = transientSpec(name);
  const out = new Float32Array(Math.max(1, Math.round(seconds * sampleRate)));
  const start = Math.min(out.length - 1, Math.max(0, Math.round(offsetSec * sampleRate)));
  const n = Math.max(1, Math.round((spec.ms / 1000) * sampleRate));
  const peak = Math.max(0, amp) * spec.gain;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const env = Math.cos((Math.PI * i) / (2 * n));
    const carrier = Math.cos((2 * Math.PI * spec.hz * i) / sampleRate);
    out[start + i] = peak * env * carrier;
  }
  out[start] = peak;
  return out;
}
