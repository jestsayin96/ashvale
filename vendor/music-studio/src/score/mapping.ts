import type { Scale } from '../model/types';
import type { CueType, SfxName } from './cues';

export type CueClass = 'hard' | 'soft' | 'overlay';

export type SectionMood = 'hype' | 'playful' | 'lowkey' | 'tension' | 'victory' | 'sad';

/** Where the named sound's peak should land relative to the cue. */
export type SfxAt = 'start' | 'end' | 'pre';

export interface SfxRecipe {
  name: SfxName;
  at: SfxAt;
  /** Seconds. Risers and reverse cymbals peak at the end of this duration. */
  duration?: number;
  pitch?: number;
}

export interface CueBehavior {
  type: CueType;
  cueClass: CueClass;
  /** The landing of a build is a tempo boundary even though the cue itself is not hard. */
  boundaryAtEnd: boolean;
  mood: SectionMood;
  scale: Scale | 'keep' | 'relativeMajor' | 'down2' | 'home';
  drums: 'none' | 'soft' | 'heartbeat' | 'four' | 'busy' | 'half';
  densityMax?: number;
  densityMin?: number;
  swing?: number;
  sfx: SfxRecipe[];
  note: string;
}

export const CUE_ALIASES: Record<string, CueType> = {
  surprise: 'jumpscare',
  kills: 'multikill',
  lose: 'fail',
  win: 'victory',
};

export const CUE_BEHAVIOR: Record<CueType, CueBehavior> = {
  calm: {
    type: 'calm',
    cueClass: 'hard',
    boundaryAtEnd: false,
    mood: 'lowkey',
    scale: 'dorian',
    drums: 'soft',
    densityMax: 3.5,
    sfx: [],
    note: 'Low-key pad, sparse pluck, soft or no drums, about 70-88 bpm, dark low-pass, wide pads.',
  },
  talking: {
    type: 'talking',
    cueClass: 'overlay',
    boundaryAtEnd: false,
    mood: 'lowkey',
    scale: 'keep',
    drums: 'none',
    densityMax: 3.5,
    sfx: [],
    note: 'Overlay. Duck music and thin the arrangement. No SFX.',
  },
  tension: {
    type: 'tension',
    cueClass: 'hard',
    boundaryAtEnd: false,
    mood: 'tension',
    scale: 'phrygian',
    drums: 'heartbeat',
    sfx: [
      { name: 'riser', at: 'end', duration: 1.5, pitch: 48 },
      { name: 'tick', at: 'start', duration: 0.08, pitch: 72 },
    ],
    note: 'Phrygian pedal, heartbeat kick, rising filter. Low riser and ticks.',
  },
  build: {
    type: 'build',
    cueClass: 'soft',
    boundaryAtEnd: true,
    mood: 'tension',
    scale: 'keep',
    drums: 'busy',
    sfx: [
      { name: 'riser', at: 'end', duration: 2, pitch: 52 },
      { name: 'reverse_cymbal', at: 'end', duration: 1.2, pitch: 60 },
    ],
    note: 'Riser section. Density opens toward the end. Silence for 1/16 beat before the landing.',
  },
  hype: {
    type: 'hype',
    cueClass: 'hard',
    boundaryAtEnd: false,
    mood: 'hype',
    scale: 'minor',
    drums: 'four',
    densityMin: 5,
    sfx: [{ name: 'impact', at: 'start', duration: 0.35, pitch: 48 }],
    note: 'Four-on-the-floor, saw lead, busy hats, about 140-160 bpm.',
  },
  multikill: {
    type: 'multikill',
    cueClass: 'hard',
    boundaryAtEnd: false,
    mood: 'hype',
    scale: 'minor',
    drums: 'busy',
    densityMin: 5,
    sfx: [],
    note: 'Hype plus N rising kill stings, combo ticks, and a final boom.',
  },
  kill: {
    type: 'kill',
    cueClass: 'soft',
    boundaryAtEnd: false,
    mood: 'hype',
    scale: 'keep',
    drums: 'four',
    sfx: [
      { name: 'kill_sting', at: 'start', duration: 0.18, pitch: 72 },
      { name: 'blip', at: 'start', duration: 0.12, pitch: 84 },
    ],
    note: 'Accent on the grid when the snap error is within 20 ms. Sting and blip stay on the cue.',
  },
  death: {
    type: 'death',
    cueClass: 'hard',
    boundaryAtEnd: false,
    mood: 'sad',
    scale: 'down2',
    drums: 'half',
    densityMax: 2.5,
    sfx: [
      { name: 'death_fall', at: 'pre', duration: 0.45, pitch: 64 },
      { name: 'sub_drop', at: 'start', duration: 0.4, pitch: 36 },
    ],
    note: 'Music mutes from t-0.15 s. Descending fall, then a low boom exactly at t. Half-time after.',
  },
  sad: {
    type: 'sad',
    cueClass: 'hard',
    boundaryAtEnd: false,
    mood: 'sad',
    scale: 'down2',
    drums: 'none',
    densityMax: 2.5,
    sfx: [],
    note: 'Minor, root down 2 semitones, about half tempo (70-88 feel), dark pad and soft bell, sparse.',
  },
  funny: {
    type: 'funny',
    cueClass: 'hard',
    boundaryAtEnd: false,
    mood: 'playful',
    scale: 'majorPent',
    drums: 'soft',
    swing: 0.25,
    sfx: [
      { name: 'boing', at: 'start', duration: 0.28, pitch: 67 },
      { name: 'blip', at: 'start', duration: 0.12, pitch: 79 },
    ],
    note: 'Playful major pentatonic, swing, pluck and bounce bass.',
  },
  fail: {
    type: 'fail',
    cueClass: 'hard',
    boundaryAtEnd: false,
    mood: 'playful',
    scale: 'major',
    drums: 'soft',
    sfx: [
      { name: 'record_scratch', at: 'start', duration: 0.35, pitch: 60 },
      { name: 'sad_trombone', at: 'start', duration: 0.7, pitch: 58 },
    ],
    note: 'Scratch, then a descending stab, then a playful section.',
  },
  victory: {
    type: 'victory',
    cueClass: 'hard',
    boundaryAtEnd: false,
    mood: 'victory',
    scale: 'relativeMajor',
    drums: 'four',
    densityMin: 5,
    sfx: [
      { name: 'victory_fanfare', at: 'start', duration: 1.2, pitch: 64 },
      { name: 'reverse_cymbal', at: 'pre', duration: 0.6, pitch: 60 },
    ],
    note: 'Relative major. Brass fanfare and hype drums.',
  },
  clutch: {
    type: 'clutch',
    cueClass: 'hard',
    boundaryAtEnd: false,
    mood: 'hype',
    scale: 'minor',
    drums: 'four',
    densityMin: 5,
    sfx: [
      { name: 'riser', at: 'pre', duration: 0.8, pitch: 50 },
      { name: 'impact', at: 'start', duration: 0.4, pitch: 48 },
    ],
    note: 'Tension, 0.3 s stop-time, then a hype entry on t.',
  },
  jumpscare: {
    type: 'jumpscare',
    cueClass: 'hard',
    boundaryAtEnd: false,
    mood: 'hype',
    scale: 'phrygian',
    drums: 'none',
    sfx: [
      { name: 'reverse_cymbal', at: 'pre', duration: 0.35, pitch: 66 },
      { name: 'jumpscare_hit', at: 'start', duration: 0.45, pitch: 61 },
    ],
    note: '0.1 s of silence, then a dissonant stab and sub hit at t.',
  },
  reveal: {
    type: 'reveal',
    cueClass: 'hard',
    boundaryAtEnd: false,
    mood: 'hype',
    scale: 'major',
    drums: 'soft',
    sfx: [
      { name: 'riser', at: 'pre', duration: 0.7, pitch: 55 },
      { name: 'impact', at: 'start', duration: 0.3, pitch: 60 },
      { name: 'shimmer', at: 'start', duration: 1.1, pitch: 76 },
    ],
    note: 'Riser into a bell and a chord on t.',
  },
  transition: {
    type: 'transition',
    cueClass: 'hard',
    boundaryAtEnd: false,
    mood: 'lowkey',
    scale: 'keep',
    drums: 'soft',
    sfx: [],
    note: 'Filter sweep and a whoosh. Direction follows the intensity change.',
  },
  outro: {
    type: 'outro',
    cueClass: 'hard',
    boundaryAtEnd: false,
    mood: 'lowkey',
    scale: 'home',
    drums: 'none',
    densityMax: 2.5,
    sfx: [{ name: 'whoosh_down', at: 'start', duration: 0.5, pitch: 52 }],
    note: 'Thins out. The final chord ends at the video end, then silence.',
  },
  sfx: {
    type: 'sfx',
    cueClass: 'soft',
    boundaryAtEnd: false,
    mood: 'lowkey',
    scale: 'keep',
    drums: 'none',
    sfx: [],
    note: 'Only the named sound at t.',
  },
};

/** Scale degrees for one bar of harmony. 0 is the root of the section scale. */
export const CHORD_DEGREES: Record<'minor' | 'sad' | 'major' | 'tension', number[]> = {
  minor: [0, 5, 2, 6],
  sad: [0, 3, 5, 4],
  major: [0, 4, 5, 3],
  tension: [0, 1, 0, 1],
};

export function chordKindFor(scale: Scale, mood: SectionMood): keyof typeof CHORD_DEGREES {
  if (mood === 'sad') return 'sad';
  if (mood === 'tension' || scale === 'phrygian') return 'tension';
  if (scale === 'major' || scale === 'majorPent') return 'major';
  return 'minor';
}

export function expectedMoodForCue(type: CueType): 'hype' | 'playful' | 'lowkey' {
  if (type === 'funny' || type === 'fail') return 'playful';
  if (type === 'hype' || type === 'multikill' || type === 'victory' || type === 'clutch' || type === 'jumpscare' || type === 'reveal') {
    return 'hype';
  }
  return 'lowkey';
}
