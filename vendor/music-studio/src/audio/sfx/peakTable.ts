import { IMPACT_VOICES } from '../../score/targets';

const IMPACT = new Set<string>(IMPACT_VOICES);

/**
 * Seconds from the start of a voice to its peak.
 * The arranger and the Web Audio voices both read this table.
 * Soft whooshes are not impact measurements.
 */
export function peakOffsetSeconds(name: string, duration: number): number {
  if (name === 'riser' || name === 'reverse_cymbal' || name === 'death_fall') return Math.max(0, duration);
  if (name === 'whoosh_up' || name === 'whoosh_down') return Math.max(0, duration * 0.5);
  if (IMPACT.has(name)) return 0.001;
  return 0;
}

export function isMeasuredImpact(name: string): boolean {
  return IMPACT.has(name);
}

/** Linear amplitude for kill sting `index`. Each step is about +0.95 dB, above the +0.9 dB floor. */
export function killStingAmp(index: number, _count: number, intensity: number): number {
  const step = 10 ** (0.95 / 20);
  const base = 0.22 + Math.max(0, Math.min(1, intensity)) * 0.12;
  return Math.min(0.9, base * step ** Math.max(0, index));
}
