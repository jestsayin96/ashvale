import { highpassCoeffs, peakingCoeffs, processBiquad } from './biquad';

/**
 * High-pass at 100 Hz plus peaking cuts at 600 Hz and 1800 Hz.
 * Each peak uses half of speechDipDb so the combined dip is about that deep
 * through the speech range. In-place.
 */
export function applySpeechPocket(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  speechDipDb: number,
): void {
  const dip = speechDipDb / 2;
  const hp = highpassCoeffs(100, Math.SQRT1_2, sampleRate);
  const p1 = peakingCoeffs(600, 0.7, dip, sampleRate);
  const p2 = peakingCoeffs(1800, 0.7, dip, sampleRate);
  for (const ch of [left, right]) {
    let y = processBiquad(ch, hp);
    y = processBiquad(y, p1);
    y = processBiquad(y, p2);
    ch.set(y);
  }
}
