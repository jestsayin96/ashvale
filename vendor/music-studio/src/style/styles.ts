import type { Scale, SynthVoice, Wave } from '../model/types';

export interface Weighted<T> {
  id: T;
  weight: number;
}

export interface StyleDef {
  id: string;
  label: string;
  tempo: [number, number];
  scales: Array<Weighted<Scale>>;
  keyRoots: Array<Weighted<number>>;
  progressionIds: string[];
  drumIds: { kick: string[]; snare: string[]; hat: string[]; perc: string[] };
  bassIds: string[];
  melody: { maxLeap: number; register: [number, number]; forms: Array<'AABA' | 'ABAC' | 'AAAB'> };
  instruments: Array<{ voice: string; gainDb: number; pan: number; wave?: Wave }>;
  brightness: number;
  density: [number, number];
  swing: [number, number];
  structure: Array<{ name: string; bars: number }>;
  defaultMood: 'hype' | 'playful' | 'lowkey';
  lead: SynthVoice;
  bass: SynthVoice;
  harmony: SynthVoice;
  drums: boolean;
}

export const STYLE_IDS = [
  'chiptune_bounce',
  'arcade_upbeat',
  'funky',
  'epic_cinematic',
  'lofi_chill',
  'ambient_calm',
  'retro_synthwave',
  'playful_pizzicato',
  'incredibox',
] as const;

export type StyleId = (typeof STYLE_IDS)[number];

const roots = (values: number[]): Array<Weighted<number>> => values.map((id) => ({ id, weight: 1 }));
const scales = (values: Scale[]): Array<Weighted<Scale>> => values.map((id) => ({ id, weight: 1 }));

export const STYLES: StyleDef[] = [
  {
    id: 'chiptune_bounce',
    label: 'Chiptune bounce',
    tempo: [128, 156],
    scales: scales(['major', 'mixolydian']),
    keyRoots: roots([0, 5, 7, 9]),
    progressionIds: ['I-V-vi-IV', 'I-IV-V-IV', 'I-bVII-IV-I', 'vi-IV-I-V'],
    drumIds: { kick: ['kick-soft-4', 'kick-off-8', 'kick-push', 'kick-sparse'], snare: ['snare-24', 'snare-back', 'snare-ghost', 'snare-late'], hat: ['hat-8', 'hat-off', 'hat-16-light', 'hat-open-off'], perc: ['perc-off', 'perc-clap-2', 'perc-tick', 'perc-fill'] },
    bassIds: ['walk-8', 'root-5', 'octave-hop'],
    melody: { maxLeap: 7, register: [72, 88], forms: ['AABA', 'ABAC', 'AAAB'] },
    instruments: [
      { voice: 'kick', gainDb: -8, pan: 0 },
      { voice: 'snareTight', gainDb: -10, pan: 0.05 },
      { voice: 'chipNoise', gainDb: -14, pan: 0.1 },
      { voice: 'sub808', gainDb: -6, pan: 0 },
      { voice: 'pulse', gainDb: -4, pan: -0.1, wave: 'pulse25' },
      { voice: 'pulse', gainDb: -12, pan: 0.15, wave: 'pulse12' },
    ],
    brightness: 0.85,
    density: [4, 28],
    swing: [0, 0],
    structure: [
      { name: 'intro', bars: 2 },
      { name: 'A', bars: 8 },
      { name: 'B', bars: 8 },
      { name: 'build', bars: 2 },
      { name: 'A', bars: 8 },
      { name: 'outro', bars: 2 },
    ],
    defaultMood: 'playful',
    lead: 'pulse',
    bass: 'sub808',
    harmony: 'pulse',
    drums: true,
  },
  {
    id: 'arcade_upbeat',
    label: 'Arcade upbeat',
    tempo: [132, 160],
    scales: scales(['minor', 'dorian', 'major']),
    keyRoots: roots([2, 4, 7, 9]),
    progressionIds: ['I-V-vi-IV', 'i-VI-III-VII', 'vi-IV-I-V', 'i-iv-VI-V'],
    drumIds: { kick: ['kick-4', 'kick-push', 'kick-soft-4', 'kick-off-8'], snare: ['clap-24', 'snare-24', 'snare-back', 'snare-ghost'], hat: ['hat-off', 'hat-open-off', 'hat-8', 'hat-16-light'], perc: ['perc-clap-2', 'perc-tick', 'perc-fill', 'perc-off'] },
    bassIds: ['pump-8', 'root-5', 'walk-8'],
    melody: { maxLeap: 9, register: [67, 84], forms: ['AABA', 'ABAC', 'AAAB'] },
    instruments: [
      { voice: 'kick', gainDb: -6, pan: 0 },
      { voice: 'clap', gainDb: -8, pan: 0.05 },
      { voice: 'hatOpen', gainDb: -12, pan: 0.2 },
      { voice: 'bass', gainDb: -5, pan: 0, wave: 'sawtooth' },
      { voice: 'lead', gainDb: -3, pan: -0.1, wave: 'sawtooth' },
      { voice: 'pluck', gainDb: -8, pan: 0.2, wave: 'square' },
    ],
    brightness: 0.8,
    density: [4, 30],
    swing: [0, 0.05],
    structure: [
      { name: 'intro', bars: 2 },
      { name: 'A', bars: 8 },
      { name: 'drop', bars: 8 },
      { name: 'break', bars: 4 },
      { name: 'drop', bars: 8 },
      { name: 'outro', bars: 2 },
    ],
    defaultMood: 'hype',
    lead: 'lead',
    bass: 'bass',
    harmony: 'pluck',
    drums: true,
  },
  {
    id: 'funky',
    label: 'Funky',
    tempo: [96, 116],
    scales: scales(['dorian', 'mixolydian']),
    keyRoots: roots([0, 5, 7, 10]),
    progressionIds: ['i7-IV7', 'ii7-V7-I', 'i-bVII-IV', 'I-IV-V-IV'],
    drumIds: { kick: ['kick-sync', 'kick-push', 'kick-sparse', 'kick-off-8'], snare: ['snare-ghost', 'snare-24', 'snare-back', 'snare-late'], hat: ['hat-16-light', 'hat-16-ghost', 'hat-off', 'hat-8'], perc: ['perc-tick', 'perc-clap-2', 'perc-fill', 'perc-off'] },
    bassIds: ['sync-16', 'walk-8', 'root-5'],
    melody: { maxLeap: 5, register: [60, 76], forms: ['ABAC', 'AABA', 'AAAB'] },
    instruments: [
      { voice: 'kick', gainDb: -7, pan: 0 },
      { voice: 'snare', gainDb: -8, pan: 0.04 },
      { voice: 'hatClosed', gainDb: -12, pan: 0.15 },
      { voice: 'bass', gainDb: -4, pan: 0, wave: 'square' },
      { voice: 'brass', gainDb: -8, pan: -0.15, wave: 'sawtooth' },
      { voice: 'pluck', gainDb: -10, pan: 0.2, wave: 'triangle' },
    ],
    brightness: 0.6,
    density: [3, 26],
    swing: [0.15, 0.3],
    structure: [
      { name: 'intro', bars: 2 },
      { name: 'A', bars: 8 },
      { name: 'B', bars: 8 },
      { name: 'break', bars: 4 },
      { name: 'A', bars: 8 },
      { name: 'outro', bars: 2 },
    ],
    defaultMood: 'playful',
    lead: 'brass',
    bass: 'bass',
    harmony: 'pluck',
    drums: true,
  },
  {
    id: 'epic_cinematic',
    label: 'Epic cinematic',
    tempo: [70, 100],
    scales: scales(['minor', 'harmonicMinor', 'dorian']),
    keyRoots: roots([2, 4, 9, 11]),
    progressionIds: ['i-VI-III-VII', 'i-iv-VI-V', 'i-VII-VI-VII', 'vi-IV-I-V'],
    drumIds: { kick: ['kick-half', 'kick808-ost', 'kick-sparse', 'kick-soft-4'], snare: ['tom-ost', 'snare-back', 'snare-late', 'snare-24'], hat: ['hat-sparse', 'hat-off', 'hat-8', 'hat-open-off'], perc: ['perc-crash', 'perc-fill', 'perc-off', 'perc-tick'] },
    bassIds: ['sub-hits', 'root-5', 'octave-hop'],
    melody: { maxLeap: 12, register: [55, 79], forms: ['AABA', 'AAAB', 'ABAC'] },
    instruments: [
      { voice: 'kick808', gainDb: -6, pan: 0 },
      { voice: 'tom', gainDb: -10, pan: -0.1 },
      { voice: 'crash', gainDb: -12, pan: 0 },
      { voice: 'sub808', gainDb: -5, pan: 0 },
      { voice: 'strings', gainDb: -6, pan: 0, wave: 'sawtooth' },
      { voice: 'brass', gainDb: -7, pan: 0.05, wave: 'sawtooth' },
    ],
    brightness: 0.5,
    density: [0.8, 24],
    swing: [0, 0.04],
    structure: [
      { name: 'intro', bars: 4 },
      { name: 'A', bars: 8 },
      { name: 'build', bars: 4 },
      { name: 'drop', bars: 8 },
      { name: 'break', bars: 4 },
      { name: 'outro', bars: 4 },
    ],
    defaultMood: 'hype',
    lead: 'brass',
    bass: 'sub808',
    harmony: 'strings',
    drums: true,
  },
  {
    id: 'lofi_chill',
    label: 'Lofi chill',
    tempo: [70, 88],
    scales: scales(['dorian', 'minorPent', 'major']),
    keyRoots: roots([0, 5, 7, 10]),
    progressionIds: ['ii7-V7-Imaj7-vi7', 'ii7-V7-I', 'i-bVII-IV', 'I-V'],
    drumIds: { kick: ['kick-soft-4', 'kick-sparse', 'kick-half', 'kick-off-8'], snare: ['rim-24', 'snare-tight-24', 'snare-ghost', 'snare-late'], hat: ['shaker-8', 'hat-sparse', 'hat-8', 'hat-off'], perc: ['perc-off', 'perc-tick', 'perc-fill', 'perc-clap-2'] },
    bassIds: ['root-5', 'sub-hits', 'walk-8'],
    melody: { maxLeap: 5, register: [64, 79], forms: ['AABA', 'ABAC', 'AAAB'] },
    instruments: [
      { voice: 'kick', gainDb: -12, pan: 0 },
      { voice: 'snareTight', gainDb: -14, pan: 0.05 },
      { voice: 'shaker', gainDb: -16, pan: 0.2 },
      { voice: 'sub808', gainDb: -8, pan: 0, wave: 'sine' },
      { voice: 'pizz', gainDb: -10, pan: -0.1, wave: 'triangle' },
      { voice: 'bell', gainDb: -12, pan: 0.15, wave: 'sine' },
    ],
    brightness: 0.3,
    density: [0.4, 12],
    swing: [0.1, 0.25],
    structure: [
      { name: 'intro', bars: 2 },
      { name: 'A', bars: 8 },
      { name: 'B', bars: 8 },
      { name: 'break', bars: 4 },
      { name: 'A', bars: 8 },
      { name: 'outro', bars: 2 },
    ],
    defaultMood: 'lowkey',
    lead: 'bell',
    bass: 'sub808',
    harmony: 'pizz',
    drums: true,
  },
  {
    id: 'ambient_calm',
    label: 'Ambient calm',
    tempo: [60, 80],
    scales: scales(['major', 'lydian', 'dorian', 'minorPent']),
    keyRoots: roots([0, 5, 7, 9]),
    progressionIds: ['I-V', 'I-IV', 'vi-IV', 'I-iii-IV-V'],
    drumIds: { kick: ['kick-sparse', 'kick-half', 'kick-soft-4', 'kick-off-8'], snare: ['snare-late', 'snare-ghost', 'rim-24', 'snare-24'], hat: ['shaker-sparse', 'hat-sparse', 'shaker-8', 'hat-off'], perc: ['perc-off', 'perc-tick', 'perc-fill', 'perc-clap-2'] },
    bassIds: ['drone', 'sub-hits', 'root-5'],
    melody: { maxLeap: 5, register: [67, 84], forms: ['AAAB', 'AABA', 'ABAC'] },
    instruments: [
      { voice: 'shaker', gainDb: -20, pan: 0.1 },
      { voice: 'sub808', gainDb: -10, pan: 0, wave: 'sine' },
      { voice: 'strings', gainDb: -8, pan: 0, wave: 'sawtooth' },
      { voice: 'bell', gainDb: -14, pan: 0.15, wave: 'sine' },
      { voice: 'pizz', gainDb: -16, pan: -0.1, wave: 'triangle' },
    ],
    brightness: 0.25,
    density: [0.15, 6],
    swing: [0, 0.05],
    structure: [
      { name: 'swell', bars: 8 },
      { name: 'A', bars: 8 },
      { name: 'swell', bars: 8 },
      { name: 'outro', bars: 4 },
    ],
    defaultMood: 'lowkey',
    lead: 'bell',
    bass: 'sub808',
    harmony: 'strings',
    drums: false,
  },
  {
    id: 'retro_synthwave',
    label: 'Retro synthwave',
    tempo: [96, 116],
    scales: scales(['minor', 'dorian']),
    keyRoots: roots([4, 7, 9, 11]),
    progressionIds: ['i-VI-III-VII', 'i-VII-VI-VII', 'VI-VII-i', 'i-iv-VI-V'],
    drumIds: { kick: ['kick-4', 'kick-soft-4', 'kick-push', 'kick-half'], snare: ['snare-tight-24', 'clap-24', 'snare-24', 'snare-back'], hat: ['hat-16-light', 'hat-off', 'hat-8', 'hat-open-off'], perc: ['perc-fill', 'perc-tick', 'perc-clap-2', 'perc-off'] },
    bassIds: ['pump-8', 'octave-hop', 'root-5'],
    melody: { maxLeap: 12, register: [60, 81], forms: ['AABA', 'ABAC', 'AAAB'] },
    instruments: [
      { voice: 'kick', gainDb: -6, pan: 0 },
      { voice: 'snareTight', gainDb: -8, pan: 0.05 },
      { voice: 'hatClosed', gainDb: -12, pan: 0.15 },
      { voice: 'bass', gainDb: -4, pan: 0, wave: 'sawtooth' },
      { voice: 'lead', gainDb: -5, pan: -0.1, wave: 'sawtooth' },
      { voice: 'strings', gainDb: -10, pan: 0, wave: 'sawtooth' },
      { voice: 'pluck', gainDb: -9, pan: 0.2, wave: 'pulse25' },
    ],
    brightness: 0.65,
    density: [3, 24],
    swing: [0, 0.06],
    structure: [
      { name: 'intro', bars: 4 },
      { name: 'A', bars: 8 },
      { name: 'build', bars: 4 },
      { name: 'drop', bars: 8 },
      { name: 'break', bars: 4 },
      { name: 'outro', bars: 4 },
    ],
    defaultMood: 'hype',
    lead: 'lead',
    bass: 'bass',
    harmony: 'strings',
    drums: true,
  },
  {
    id: 'playful_pizzicato',
    label: 'Playful pizzicato',
    tempo: [100, 126],
    scales: scales(['major', 'majorPent', 'lydian']),
    keyRoots: roots([0, 2, 7, 9]),
    progressionIds: ['I-vi-IV-V', 'I-IV-I-V', 'I-iii-IV-V', 'I-V-vi-IV'],
    drumIds: { kick: ['kick-sparse', 'kick-soft-4', 'kick-off-8', 'kick-push'], snare: ['rim-24', 'snare-ghost', 'snare-late', 'snare-back'], hat: ['shaker-8', 'hat-8', 'hat-off', 'shaker-sparse'], perc: ['perc-tick', 'perc-off', 'perc-fill', 'perc-clap-2'] },
    bassIds: ['walk-8', 'root-5', 'sync-16'],
    melody: { maxLeap: 7, register: [67, 86], forms: ['ABAC', 'AABA', 'AAAB'] },
    instruments: [
      { voice: 'rim', gainDb: -14, pan: 0.05 },
      { voice: 'shaker', gainDb: -16, pan: 0.2 },
      { voice: 'pizz', gainDb: -6, pan: 0, wave: 'triangle' },
      { voice: 'pluck', gainDb: -8, pan: -0.1, wave: 'triangle' },
      { voice: 'bell', gainDb: -12, pan: 0.2, wave: 'sine' },
    ],
    brightness: 0.6,
    density: [1.5, 24],
    swing: [0.15, 0.3],
    structure: [
      { name: 'intro', bars: 2 },
      { name: 'A', bars: 8 },
      { name: 'B', bars: 8 },
      { name: 'A', bars: 8 },
      { name: 'outro', bars: 2 },
    ],
    defaultMood: 'playful',
    lead: 'pizz',
    bass: 'pluck',
    harmony: 'bell',
    drums: true,
  },
  {
    id: 'incredibox',
    label: 'Layered loops (beatbox + voices)',
    tempo: [70, 125],
    scales: scales(['minor', 'phrygian', 'harmonicMinor']),
    keyRoots: roots([0, 2, 4, 7, 9]),
    progressionIds: ['i-VI-III-VII', 'i-iv-VI-V', 'i-VII-VI-VII', 'VI-VII-i'],
    drumIds: { kick: ['kick-soft-4', 'kick-sparse', 'kick-off-8', 'kick-push'], snare: ['snare-back', 'rim-24', 'snare-ghost', 'snare-late'], hat: ['hat-8', 'shaker-8', 'hat-off', 'shaker-sparse'], perc: ['perc-tick', 'perc-off', 'perc-fill', 'perc-clap-2'] },
    bassIds: ['sub-hits', 'root-5', 'drone'],
    melody: { maxLeap: 5, register: [60, 79], forms: ['AABA', 'ABAC', 'AAAB'] },
    instruments: [
      { voice: 'kick', gainDb: -8, pan: 0 },
      { voice: 'pad', gainDb: -10, pan: 0, wave: 'triangle' },
      { voice: 'bell', gainDb: -12, pan: 0.1, wave: 'sine' },
      { voice: 'bass', gainDb: -8, pan: 0, wave: 'sawtooth' },
    ],
    brightness: 0.28,
    density: [0.5, 18],
    swing: [0.05, 0.2],
    structure: [
      { name: 'intro', bars: 4 },
      { name: 'build', bars: 8 },
      { name: 'full', bars: 8 },
      { name: 'drop', bars: 4 },
      { name: 'full2', bars: 4 },
      { name: 'outro', bars: 4 },
    ],
    defaultMood: 'lowkey',
    lead: 'pad',
    bass: 'bass',
    harmony: 'pad',
    drums: true,
  },
];

export function styleById(id: string): StyleDef | undefined {
  return STYLES.find((style) => style.id === id);
}

export function tagSeed(seed: number, tag: string): number {
  let h = (seed >>> 0) ^ 0x811c9dc5;
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
