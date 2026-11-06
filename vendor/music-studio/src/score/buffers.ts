import type { Bus, StemMap } from './plan';

const BUSES: Bus[] = ['drums', 'bass', 'harmony', 'melody', 'sfx', 'reverbSend', 'delaySend'];

export function silentStems(length: number): StemMap {
  const stems = {} as StemMap;
  for (const bus of BUSES) {
    stems[bus] = { left: new Float32Array(length), right: new Float32Array(length) };
  }
  return stems;
}

export function busNames(): Bus[] {
  return [...BUSES];
}
