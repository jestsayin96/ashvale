import type { Scale } from '../model/types';
import type { Cue, CueSheet, CueType, SfxName } from './cues';
import type { SectionMood } from './mapping';

export type Bus = 'drums' | 'bass' | 'harmony' | 'melody' | 'sfx' | 'reverbSend' | 'delaySend';

export type MusicBus = 'drums' | 'bass' | 'harmony' | 'melody' | 'sfx';

export interface ScoreParams {
  brightness?: number;
  levelDb?: number;
  impactSec?: number;
  role?: string;
  pitch?: number;
  index?: number;
  /** When set, pureBackend / web backends play this sample from the cached library. */
  sampleId?: string;
  rootMidi?: number;
  pitchSemis?: number;
  fineCents?: number;
  start?: number;
  end?: number | null;
  loop?: boolean;
  loopStart?: number;
  loopEnd?: number;
  gainDb?: number;
  adsr?: { a: number; d: number; s: number; r: number };
}

export interface ScoreEvent {
  id: string;
  bus: Bus;
  voice: string;
  time: number;
  duration: number;
  note?: number;
  vel: number;
  params: ScoreParams;
  cueIndex?: number;
  impactOffset?: number;
  preRollShortened?: boolean;
}

export interface ScoreSection {
  index: number;
  startSec: number;
  endSec: number;
  bpm: number;
  beats: number;
  baseBpm: number;
  freeTime: boolean;
  key: { root: number; scale: Scale };
  mood: SectionMood;
  cueIndex: number | null;
  cueType: CueType | null;
  levelDb: number;
  swing: number;
  styleId?: string;
}

export interface DuckRegion {
  start: number;
  end: number;
  depthDb: number;
  attackMs: number;
  releaseMs: number;
  kind: 'talking' | 'sfx' | 'stop';
}

export interface MuteRegion {
  start: number;
  end: number;
  reason: string;
}

export interface AccentPlan {
  cueIndex: number;
  snappedSec: number;
  errorMs: number;
  status: 'ok' | 'skipped';
}

export interface ScorePlan {
  seed: number;
  sampleRate: number;
  videoLengthSeconds: number;
  fps: number;
  name: string;
  lockedBpm: number | null;
  endFadeMs: number;
  duckDb: number;
  speechDipDb: number;
  outroFadeSec: number;
  sections: ScoreSection[];
  events: ScoreEvent[];
  duckRegions: DuckRegion[];
  muteRegions: MuteRegion[];
  accents: AccentPlan[];
  cues: Cue[];
  sheet: CueSheet;
  /** Largest music-event distance to the 1/8 grid when tempo is locked. 0 when tempo is mapped. */
  musicSnapMaxMs: number;
}

export interface BusBuffers {
  left: Float32Array;
  right: Float32Array;
}

export type StemMap = Record<Bus, BusBuffers>;
