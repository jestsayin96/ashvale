export function loopSampleCount(bars: number, bpm: number, sampleRate = 44100): number {
  return Math.round((bars * 4 * 60 * sampleRate) / bpm);
}
