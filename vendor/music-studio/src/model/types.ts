export type Wave = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'pulse12' | 'pulse25';
export type DrumVoice = 'kick' | 'snare' | 'clap' | 'hatClosed' | 'hatOpen' | 'tom' | 'rim' | 'kick808' | 'shaker' | 'crash' | 'chipNoise' | 'snareTight';
export type SynthVoice = 'lead' | 'bass' | 'pad' | 'pluck' | 'pulse' | 'bell' | 'strings' | 'brass' | 'pizz' | 'sub808';
export type Scale = 'minor' | 'major' | 'minorPent' | 'majorPent' | 'dorian' | 'phrygian' | 'mixolydian' | 'lydian' | 'harmonicMinor';
export type MoodName = 'hype' | 'playful' | 'lowkey' | 'custom';
export type VideoRole = 'bed' | 'music' | 'intro' | 'outro';

export const BAR_VALUES = [1, 2, 4, 8, 16, 32] as const;
export type Bars = (typeof BAR_VALUES)[number];

/** Proof-of-origin stored with a composed video loop. */
export interface Origin {
  /** true for synth-only, false when only samples, 'mixed' when both. */
  synthesized: boolean | 'mixed';
  samples: boolean;
  role: VideoRole;
  requestedSeconds: number;
  loopSeconds: number;
  /** Present when samples are used. */
  sampleIds?: string[];
}

export interface Step {
  on: boolean;
  note?: number;
  /** Extra simultaneous MIDI notes. The step's own note stays first. */
  notes?: number[];
  vel: number;
  len: number;
  prob?: number;
}

export interface Pattern {
  /** Multiple of 16, from 16 through 2048. */
  length: number;
  steps: Step[];
}

export interface StyleSection {
  name: string;
  bars: number;
}

export interface StyleInfo {
  id: string;
  mood: 'hype' | 'playful' | 'lowkey';
  progressionId: string;
  drumId: string;
  bassId: string;
  motifId: string;
  lengthMode: 'loop' | 'exact';
  structure: StyleSection[];
  fingerprint: string;
  requestedSeed: number;
  usedSeed: number;
  reseeds: number;
  similarity?: { nearestDistance: number; nearestId: string; nearestName: string; threshold: number; requestedSeed: number; usedSeed: number; reseeds: number };
  titleWords: string;
  ratingsHash?: string;
}

export interface ExactPlan {
  seconds: number;
  bars: number;
  ending: 'cadence' | 'trim-fade';
  fadeMs: number;
}

export interface SynthParams {
  wave: Wave;
  detuneCents: number;
  octave: number;
  adsr: { a: number; d: number; s: number; r: number };
  filter: { type: 'lowpass' | 'highpass' | 'bandpass'; cutoff: number; q: number; envAmount: number };
}

export interface DrumParams {
  tuneSemis: number;
  decay: number;
  tone: number;
}

/** Sampler params. start/end are seconds into the WAV. */
export interface SamplerParams {
  sampleId: string;
  rootMidi: number;
  pitchSemis: number;
  fineCents: number;
  start: number;
  end: number | null;
  gainDb: number;
  adsr: { a: number; d: number; s: number; r: number };
  loop: boolean;
  loopStart?: number;
  loopEnd?: number;
  /** Reserved. Not implemented. */
  reverse?: false;
  chokeGroup?: string;
  group?: 'beat' | 'voice' | 'melody' | 'effects';
}

export interface PatternSlot {
  id: string;
  name: string;
  pattern: Pattern;
}

export interface ArrangementCell {
  section: string;
  slot: string | null;
}

export interface Track {
  id: string;
  name: string;
  kind: 'drum' | 'synth' | 'sample';
  voice: DrumVoice | SynthVoice | 'sampler';
  params: DrumParams | SynthParams | SamplerParams;
  gainDb: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  pattern: Pattern;
  slots?: PatternSlot[];
  arrangement?: ArrangementCell[];
}

export interface Project {
  version: 1;
  name: string;
  bpm: number;
  swing: number;
  bars: Bars;
  mood?: MoodName;
  key: { root: number; scale: Scale };
  origin?: Origin;
  style?: StyleInfo;
  exact?: ExactPlan;
  /** Optional section map used by sample-track arrangements when style.structure is absent. */
  sections?: StyleSection[];
  tracks: Track[];
  master: {
    gainDb: number;
    speechPocket: boolean;
    speechDipDb: number;
    targetLufs: number;
    ceilingDbtp: number;
  };
  seed: number;
}
