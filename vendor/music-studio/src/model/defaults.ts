import type { DrumParams, Pattern, Project, SamplerParams, Step, SynthParams, Track } from './types';

export function emptyStep(): Step {
  return { on: false, vel: 0.8, len: 1 };
}

export function makePattern(length: number, hits: Array<Partial<Step> & { i: number }> = []): Pattern {
  const steps = Array.from({ length }, () => emptyStep());
  for (const hit of hits) {
    steps[hit.i] = {
      on: true,
      vel: hit.vel ?? 0.8,
      len: hit.len ?? 1,
      note: hit.note,
      prob: hit.prob,
    };
  }
  return { length, steps };
}

export function drumParams(tuneSemis = 0, decay = 0.2, tone = 0.5): DrumParams {
  return { tuneSemis, decay, tone };
}

export function synthParams(partial: Partial<SynthParams> & Pick<SynthParams, 'wave'>): SynthParams {
  return {
    wave: partial.wave,
    detuneCents: partial.detuneCents ?? 6,
    octave: partial.octave ?? 0,
    adsr: partial.adsr ?? { a: 0.01, d: 0.12, s: 0.6, r: 0.12 },
    filter: partial.filter ?? { type: 'lowpass', cutoff: 1800, q: 0.7, envAmount: 0.35 },
  };
}

export function samplerParams(partial: Partial<SamplerParams> & Pick<SamplerParams, 'sampleId'>): SamplerParams {
  return {
    sampleId: partial.sampleId,
    rootMidi: partial.rootMidi ?? 60,
    pitchSemis: partial.pitchSemis ?? 0,
    fineCents: partial.fineCents ?? 0,
    start: partial.start ?? 0,
    end: partial.end === undefined ? null : partial.end,
    gainDb: partial.gainDb ?? 0,
    adsr: partial.adsr ?? { a: 0.005, d: 0.08, s: 0.7, r: 0.08 },
    loop: partial.loop === true,
    ...(partial.loopStart !== undefined ? { loopStart: partial.loopStart } : {}),
    ...(partial.loopEnd !== undefined ? { loopEnd: partial.loopEnd } : {}),
    ...(partial.chokeGroup ? { chokeGroup: partial.chokeGroup } : {}),
    ...(partial.group ? { group: partial.group } : {}),
  };
}

function track(partial: Omit<Track, 'mute' | 'solo'> & { mute?: boolean; solo?: boolean }): Track {
  return { mute: false, solo: false, ...partial };
}

/** Demo beat: hats, backbeat, four-on-the-floor kick, sustained bass in A minor. */
export function newProject(): Project {
  const hatHits = Array.from({ length: 16 }, (_, i) => ({
    i,
    vel: i % 4 === 0 ? 0.42 : 0.28,
    len: 1,
  }));
  return {
    version: 1,
    name: 'Demo Beat',
    bpm: 100,
    swing: 0,
    bars: 4,
    mood: 'custom',
    key: { root: 9, scale: 'minor' },
    seed: 1,
    master: {
      gainDb: 0,
      speechPocket: false,
      speechDipDb: -5,
      targetLufs: -16,
      ceilingDbtp: -1,
    },
    tracks: [
      track({
        id: 'kick',
        name: 'Kick',
        kind: 'drum',
        voice: 'kick',
        gainDb: -8,
        pan: 0,
        params: drumParams(0, 0.22, 0.45),
        pattern: makePattern(16, [
          { i: 0, vel: 0.72 },
          { i: 4, vel: 0.62 },
          { i: 8, vel: 0.7 },
          { i: 12, vel: 0.6 },
        ]),
      }),
      track({
        id: 'snare',
        name: 'Snare',
        kind: 'drum',
        voice: 'snare',
        gainDb: -10,
        pan: 0.05,
        params: drumParams(0, 0.16, 0.55),
        pattern: makePattern(16, [
          { i: 4, vel: 0.55 },
          { i: 12, vel: 0.5 },
        ]),
      }),
      track({
        id: 'hat',
        name: 'Hat',
        kind: 'drum',
        voice: 'hatClosed',
        gainDb: -16,
        pan: 0.15,
        params: drumParams(0, 0.045, 0.75),
        pattern: makePattern(16, hatHits),
      }),
      track({
        id: 'bass',
        name: 'Bass',
        kind: 'synth',
        voice: 'bass',
        gainDb: -4,
        pan: 0,
        params: synthParams({
          wave: 'square',
          detuneCents: 0,
          octave: -1,
          adsr: { a: 0.005, d: 0.06, s: 0.9, r: 0.06 },
          filter: { type: 'lowpass', cutoff: 280, q: 0.6, envAmount: 0.15 },
        }),
        pattern: makePattern(16, [
          { i: 0, note: 45, vel: 0.85, len: 4 },
          { i: 4, note: 48, vel: 0.8, len: 4 },
          { i: 8, note: 52, vel: 0.82, len: 4 },
          { i: 12, note: 43, vel: 0.8, len: 4 },
        ]),
      }),
    ],
  };
}
