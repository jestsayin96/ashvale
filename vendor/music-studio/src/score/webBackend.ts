import { SFX_CATALOG, playSfx, type SfxParams } from '../audio/sfx/sfx';
import type { SfxName } from './cues';
import { dbToLin } from '../audio/units';
import { playDrum } from '../audio/voices/drums';
import { playExtra } from '../audio/voices/extra';
import { playSynth } from '../audio/voices/synth';
import type { DrumVoice, SynthParams, SynthVoice } from '../model/types';
import type { SynthBackend } from './backend';
import { silentStems } from './buffers';
import type { ScoreEvent } from './plan';
import { voiceSpec } from './voiceSpecs';

const DRUMS: Record<string, DrumVoice> = {
  kick: 'kick',
  snare: 'snare',
  clap: 'clap',
  hat: 'hatClosed',
  hatOpen: 'hatOpen',
  tom: 'tom',
  rim: 'rim',
  kick808: 'kick808',
  shaker: 'shaker',
  crash: 'crash',
  chipNoise: 'chipNoise',
  snareTight: 'snareTight',
};

const SYNTHS: Record<string, SynthVoice> = {
  lead: 'lead',
  bass: 'bass',
  pad: 'pad',
  pluck: 'pluck',
  pulse: 'pulse',
  bell: 'bell',
  strings: 'strings',
  brass: 'brass',
  pizz: 'pizz',
  sub808: 'sub808',
};

function synthParams(event: ScoreEvent): SynthParams {
  const spec = voiceSpec(event.voice, event.note, event.params.brightness ?? 0.5);
  return {
    wave: spec.wave,
    detuneCents: spec.detuneCents,
    octave: spec.octaveShift,
    adsr: { a: 0.005, d: 0.1, s: 0.45, r: 0.08 },
    filter: { type: 'lowpass', cutoff: spec.cutoffHz, q: spec.q, envAmount: spec.filterEnvHz },
  };
}

export const webBackend: SynthBackend = {
  async render(events, startSample, lengthSamples, sampleRate) {
    if (typeof OfflineAudioContext === 'undefined') {
      throw new Error('OfflineAudioContext is unavailable');
    }
    const stems = silentStems(lengthSamples);
    const names = (Object.keys(stems) as Array<keyof typeof stems>).filter((name) => events.some((event) => event.bus === name));
    if (names.length === 0) return stems;
    const ctx = new OfflineAudioContext(names.length * 2, lengthSamples, sampleRate);
    const merger = ctx.createChannelMerger(names.length * 2);
    merger.connect(ctx.destination);
    names.forEach((name, index) => {
      const dest = ctx.createGain();
      dest.channelCount = 2;
      dest.channelCountMode = 'explicit';
      const splitter = ctx.createChannelSplitter(2);
      dest.connect(splitter);
      splitter.connect(merger, 0, index * 2);
      splitter.connect(merger, 1, index * 2 + 1);
      for (const event of events) {
        if (event.bus !== name) continue;
        const when = event.time - startSample / sampleRate;
        if (when < -0.05) continue;
        schedule(ctx, dest, event, Math.max(0, when));
      }
    });
    const rendered = await ctx.startRendering();
    names.forEach((name, index) => {
      stems[name].left.set(rendered.getChannelData(index * 2).subarray(0, lengthSamples));
      stems[name].right.set(rendered.getChannelData(index * 2 + 1).subarray(0, lengthSamples));
    });
    return stems;
  },
};

function schedule(ctx: BaseAudioContext, dest: AudioNode, event: ScoreEvent, time: number): void {
  const peak = Math.max(0.0001, event.vel) * dbToLin(event.params.levelDb ?? 0);
  if (DRUMS[event.voice]) {
    playDrum(ctx, dest, time, DRUMS[event.voice], { tuneSemis: 0, decay: Math.min(0.4, event.duration), tone: event.params.brightness ?? 0.4 }, Math.min(1, peak));
    return;
  }
  if (SYNTHS[event.voice] && event.note !== undefined) {
    playSynth(ctx, dest, time, SYNTHS[event.voice], synthParams(event), event.note, Math.min(1, peak), event.duration);
    return;
  }
  if (event.bus === 'sfx' && event.voice in SFX_CATALOG) {
    const params: SfxParams = {
      intensity: event.params.brightness ?? event.vel,
      pitch: typeof event.params.pitch === 'number' ? event.params.pitch : event.note ?? 60,
      duration: event.duration,
      seed: Math.round((event.params.index ?? 1) * 1000 + event.time * 10),
      index: event.params.index,
    };
    playSfx(ctx, dest, time, event.voice as SfxName, params);
    return;
  }
  playExtra(ctx, dest, time, event.voice, {
    vel: Math.min(1, peak),
    note: event.note,
    duration: event.duration,
    brightness: event.params.brightness ?? 0.5,
  });
}
