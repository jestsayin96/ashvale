import { makePattern, newProject, synthParams, drumParams } from './defaults';
import { mulberry32 } from './rng';
import { isInScale, SCALE_INTERVALS } from './scales';
import type { DrumVoice, MoodName, Project, Scale, Step, SynthVoice, Track } from './types';

function ri(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function rf(rng: () => number, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

function pitches(root: number, scale: Scale, from: number, to: number): number[] {
  const out: number[] = [];
  for (let m = from; m <= to; m++) if (isInScale(m, root, scale)) out.push(m);
  if (out.length === 0) {
    const rel = SCALE_INTERVALS[scale][0];
    out.push(from + ((rel + root - (from % 12) + 12) % 12));
  }
  return out;
}

function pick(rng: () => number, notes: number[]): number {
  return notes[Math.floor(rng() * notes.length)];
}

function drumTrack(
  id: string,
  name: string,
  voice: DrumVoice,
  gainDb: number,
  pan: number,
  tune: number,
  decay: number,
  tone: number,
  hits: Array<Partial<Step> & { i: number }>,
): Track {
  return {
    id,
    name,
    kind: 'drum',
    voice,
    params: drumParams(tune, decay, tone),
    gainDb,
    pan,
    mute: false,
    solo: false,
    pattern: makePattern(16, hits),
  };
}

function synthTrack(
  id: string,
  name: string,
  voice: SynthVoice,
  gainDb: number,
  pan: number,
  params: ReturnType<typeof synthParams>,
  hits: Array<Partial<Step> & { i: number }>,
): Track {
  return {
    id,
    name,
    kind: 'synth',
    voice,
    params,
    gainDb,
    pan,
    mute: false,
    solo: false,
    pattern: makePattern(16, hits),
  };
}

/**
 * Overwrites bpm, swing, key, tracks, and patterns.
 * Leaves target LUFS and true-peak ceiling alone.
 */
export function applyMood(project: Project, mood: Exclude<MoodName, 'custom'>, seed: number): Project {
  const rng = mulberry32(seed >>> 0);
  const base: Project = { ...(project ?? newProject()) };
  delete base.origin;
  const accent = 0.45 + ((Math.abs(Math.trunc(seed)) % 997) / 997) * 0.4;

  if (mood === 'hype') {
    const scale: Scale = rng() < 0.5 ? 'minor' : 'phrygian';
    const root = ri(rng, 0, 11);
    const bassNotes = pitches(root, scale, 36, 52);
    const leadNotes = pitches(root, scale, 60, 84);
    const hat: Array<Partial<Step> & { i: number }> = [];
    for (let i = 0; i < 16; i++) hat.push({ i, vel: rf(rng, 0.35, 0.85), len: 1 });
    const opens: Array<Partial<Step> & { i: number }> = [];
    for (const i of [2, 6, 10, 14]) if (rng() > 0.35) opens.push({ i, vel: rf(rng, 0.35, 0.7) });
    const lead: Array<Partial<Step> & { i: number }> = [];
    for (let i = 0; i < 16; i += 2) {
      if (rng() > 0.25) lead.push({ i, note: pick(rng, leadNotes), vel: rf(rng, 0.55, 0.9), len: rng() > 0.5 ? 2 : 1 });
    }
    const bass: Array<Partial<Step> & { i: number }> = [0, 4, 8, 12].map((i) => ({
      i,
      note: pick(rng, bassNotes),
      vel: rf(rng, 0.7, 0.95),
      len: 3,
    }));
    bass[0].vel = accent;
    return {
      ...base,
      bpm: ri(rng, 140, 160),
      swing: 0,
      mood: 'hype',
      seed: seed >>> 0,
      key: { root, scale },
      master: { ...base.master, speechPocket: false },
      tracks: [
        drumTrack('kick', 'Kick', 'kick', -4, 0, 0, 0.18, 0.5, [
          { i: 0, vel: accent },
          { i: 4, vel: 0.9 },
          { i: 8, vel: 0.95 },
          { i: 12, vel: 0.9 },
        ]),
        drumTrack('clap', 'Clap', 'clap', -6, 0.05, 0, 0.22, 0.6, [
          { i: 4, vel: 0.85 },
          { i: 12, vel: 0.8 },
        ]),
        drumTrack('hat', 'Hat', 'hatClosed', -12, 0.2, ri(rng, -2, 3), 0.04, 0.8, hat),
        drumTrack('ohat', 'Open hat', 'hatOpen', -14, -0.15, 0, 0.18, 0.7, opens.length ? opens : [{ i: 14, vel: 0.5 }]),
        drumTrack('tom', 'Tom', 'tom', -8, -0.1, ri(rng, -5, 2), 0.2, 0.45, [
          { i: ri(rng, 6, 7), vel: 0.7 },
          { i: 15, vel: rf(rng, 0.45, 0.75) },
        ]),
        synthTrack('bass', 'Bass', 'bass', -3, 0, synthParams({
          wave: 'square', detuneCents: 0, octave: -1,
          adsr: { a: 0.005, d: 0.08, s: 0.75, r: 0.06 },
          filter: { type: 'lowpass', cutoff: 240, q: 0.7, envAmount: 0.2 },
        }), bass),
        synthTrack('lead', 'Lead', 'lead', -8, -0.05, synthParams({
          wave: 'sawtooth', detuneCents: rf(rng, 4, 14), octave: 0,
          adsr: { a: 0.01, d: 0.12, s: 0.45, r: 0.12 },
          filter: { type: 'lowpass', cutoff: rf(rng, 1400, 2800), q: 0.8, envAmount: 0.45 },
        }), lead),
      ],
    };
  }

  if (mood === 'playful') {
    const scale: Scale = 'majorPent';
    const root = ri(rng, 0, 11);
    const bassNotes = pitches(root, scale, 40, 55);
    const leadNotes = pitches(root, scale, 64, 88);
    const shaker: Array<Partial<Step> & { i: number }> = [];
    for (let i = 0; i < 16; i++) if (rng() > 0.25) shaker.push({ i, vel: rf(rng, 0.2, 0.5) });
    const rim: Array<Partial<Step> & { i: number }> = [];
    for (const i of [2, 6, 10, 14]) if (rng() > 0.2) rim.push({ i, vel: rf(rng, 0.4, 0.75) });
    const plucks: Array<Partial<Step> & { i: number }> = [];
    for (let i = 0; i < 16; i++) if (rng() > 0.55) plucks.push({ i, note: pick(rng, leadNotes), vel: rf(rng, 0.45, 0.85), len: 1 });
    if (plucks.length === 0) plucks.push({ i: 0, note: pick(rng, leadNotes), vel: 0.7, len: 1 });
    const bass: Array<Partial<Step> & { i: number }> = [];
    for (const i of [0, 3, 6, 8, 11, 14]) {
      if (rng() > 0.2) bass.push({ i, note: pick(rng, bassNotes), vel: rf(rng, 0.6, 0.9), len: 2 });
    }
    if (bass.length === 0) bass.push({ i: 0, note: bassNotes[0], vel: accent, len: 2 });
    else bass[0].vel = accent;
    return {
      ...base,
      bpm: ri(rng, 100, 120),
      swing: rf(rng, 0.2, 0.3),
      mood: 'playful',
      seed: seed >>> 0,
      key: { root, scale },
      master: { ...base.master, speechPocket: false },
      tracks: [
        drumTrack('kick', 'Kick', 'kick', -8, 0, 0, 0.16, 0.4, [
          { i: 0, vel: accent * 0.8 },
          { i: 8, vel: 0.55 },
          ...(rng() > 0.4 ? [{ i: 10, vel: 0.4 }] : []),
        ]),
        drumTrack('rim', 'Rim', 'rim', -10, 0.1, ri(rng, -2, 4), 0.04, 0.7, rim.length ? rim : [{ i: 4, vel: 0.6 }, { i: 12, vel: 0.55 }]),
        drumTrack('shaker', 'Shaker', 'hatClosed', -16, 0.25, 2, 0.03, 0.85, shaker.length ? shaker : [{ i: 0, vel: 0.3 }, { i: 4, vel: 0.3 }]),
        drumTrack('clap', 'Clap', 'clap', -12, -0.05, 0, 0.16, 0.5, [{ i: 4, vel: 0.45 }, { i: 12, vel: 0.4 }]),
        synthTrack('bass', 'Bass', 'bass', -6, 0, synthParams({
          wave: 'square', detuneCents: 4, octave: -1,
          adsr: { a: 0.005, d: 0.1, s: 0.35, r: 0.08 },
          filter: { type: 'lowpass', cutoff: 500, q: 0.8, envAmount: 0.4 },
        }), bass),
        synthTrack('pluck', 'Pluck', 'pluck', -10, -0.1, synthParams({
          wave: 'triangle', detuneCents: rf(rng, 0, 8), octave: 0,
          adsr: { a: 0.004, d: 0.09, s: 0.15, r: 0.08 },
          filter: { type: 'lowpass', cutoff: 2200, q: 0.9, envAmount: 0.7 },
        }), plucks),
        synthTrack('lead', 'Lead', 'lead', -12, 0.15, synthParams({
          wave: rng() > 0.5 ? 'triangle' : 'square', detuneCents: 6, octave: 1,
          adsr: { a: 0.01, d: 0.1, s: 0.3, r: 0.1 },
          filter: { type: 'lowpass', cutoff: 2400, q: 0.6, envAmount: 0.3 },
        }), [{ i: ri(rng, 0, 4), note: pick(rng, leadNotes), vel: 0.6, len: 2 }, { i: ri(rng, 8, 12), note: pick(rng, leadNotes), vel: 0.55, len: 2 }]),
      ],
    };
  }

  const scale: Scale = rng() < 0.5 ? 'dorian' : 'minorPent';
  const root = ri(rng, 0, 11);
  const bassNotes = pitches(root, scale, 36, 48);
  const midNotes = pitches(root, scale, 55, 72);
  const highNotes = pitches(root, scale, 67, 84);
  // Low-key: 70–88 BPM, sparse (kick on 1/3, no 16th hats), dark filters, wide pads, mono bass.
  const hats: Array<Partial<Step> & { i: number }> = [];
  for (const i of [2, 6, 10, 14]) if (rng() > 0.45) hats.push({ i, vel: rf(rng, 0.12, 0.28) });
  if (hats.length === 0) hats.push({ i: 6, vel: 0.18 }, { i: 14, vel: 0.16 });
  const padSteps: Array<Partial<Step> & { i: number }> = [
    { i: 0, note: pick(rng, midNotes), vel: 0.48, len: 16 },
  ];
  const plucks: Array<Partial<Step> & { i: number }> = [];
  if (rng() > 0.4) plucks.push({ i: 0, note: pick(rng, midNotes), vel: rf(rng, 0.25, 0.4), len: 2 });
  if (rng() > 0.55) plucks.push({ i: 8, note: pick(rng, highNotes), vel: rf(rng, 0.22, 0.38), len: 2 });
  if (plucks.length === 0) plucks.push({ i: 8, note: midNotes[0], vel: 0.3, len: 2 });
  const bass: Array<Partial<Step> & { i: number }> = [
    { i: 0, note: pick(rng, bassNotes), vel: accent * 0.85, len: 8 },
    { i: 8, note: pick(rng, bassNotes), vel: rf(rng, 0.5, 0.7), len: 8 },
  ];
  return {
    ...base,
    bpm: ri(rng, 70, 88),
    swing: rf(rng, 0, 0.06),
    mood: 'lowkey',
    seed: seed >>> 0,
    key: { root, scale },
    master: { ...base.master, speechPocket: true },
    tracks: [
      drumTrack('kick', 'Kick', 'kick', -14, 0, -3, 0.32, 0.25, [
        { i: 0, vel: accent * 0.45 },
        { i: 8, vel: 0.32 },
      ]),
      drumTrack('hat', 'Hat', 'hatClosed', -22, 0.25, 0, 0.04, 0.5, hats),
      drumTrack('rim', 'Rim', 'rim', -20, -0.15, 0, 0.03, 0.35, [{ i: 6, vel: 0.22 }]),
      synthTrack('pad', 'Pad', 'pad', -15, -0.35, synthParams({
        wave: 'triangle', detuneCents: rf(rng, 6, 14), octave: 0,
        adsr: { a: 0.5, d: 0.45, s: 0.7, r: 0.9 },
        filter: { type: 'lowpass', cutoff: rf(rng, 450, 850), q: 0.45, envAmount: 0.1 },
      }), padSteps),
      synthTrack('padR', 'Pad wide', 'pad', -18, 0.35, synthParams({
        wave: 'sine', detuneCents: rf(rng, 4, 10), octave: 0,
        adsr: { a: 0.55, d: 0.4, s: 0.65, r: 0.95 },
        filter: { type: 'lowpass', cutoff: rf(rng, 500, 900), q: 0.4, envAmount: 0.08 },
      }), [{ i: 0, note: pick(rng, midNotes), vel: 0.4, len: 16 }]),
      synthTrack('pluck', 'Pluck', 'pluck', -18, 0.2, synthParams({
        wave: 'sine', detuneCents: 2, octave: 0,
        adsr: { a: 0.015, d: 0.16, s: 0.15, r: 0.3 },
        filter: { type: 'lowpass', cutoff: rf(rng, 900, 1400), q: 0.6, envAmount: 0.3 },
      }), plucks),
      synthTrack('bass', 'Sub', 'bass', -9, 0, synthParams({
        wave: 'sine', detuneCents: 0, octave: -1,
        adsr: { a: 0.03, d: 0.12, s: 0.85, r: 0.25 },
        filter: { type: 'lowpass', cutoff: 180, q: 0.45, envAmount: 0.04 },
      }), bass),
    ],
  };
}
