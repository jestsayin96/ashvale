import type { ScoreEvent, StemMap } from './plan';

export interface SynthBackend {
  render(events: ScoreEvent[], startSample: number, lengthSamples: number, sampleRate: number): Promise<StemMap>;
}

export type { StemMap };
