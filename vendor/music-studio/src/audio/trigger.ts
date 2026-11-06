import type { MusicEvent } from './events';
import { dbToLin, clamp } from './units';
import { playDrum } from './voices/drums';
import { playSting, type FxParams, type StingPreset } from './voices/fx';
import { playSampler } from './voices/sampler';
import { playSynth } from './voices/synth';
import type { DrumParams, DrumVoice, SamplerParams, SynthParams, SynthVoice } from '../model/types';
import type { SampleLibrary } from '../samples/library';
import { getCachedLibrary } from '../samples/library';

export function triggerEvent(
  ctx: BaseAudioContext,
  dest: AudioNode,
  ev: MusicEvent,
  when: number,
  library: SampleLibrary = getCachedLibrary(),
): AudioScheduledSourceNode[] {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(dbToLin(ev.gainDb), when);
  const pan = ctx.createStereoPanner();
  pan.pan.setValueAtTime(clamp(ev.pan, -1, 1), when);
  gain.connect(pan);
  pan.connect(dest);
  if (ev.kind === 'drum') {
    return playDrum(ctx, gain, when, ev.voice as DrumVoice, ev.params as DrumParams, ev.vel);
  }
  if (ev.kind === 'sample') {
    return playSampler(ctx, gain, when, ev.params as SamplerParams, ev.note, ev.vel, ev.duration, library);
  }
  return playSynth(
    ctx,
    gain,
    when,
    ev.voice as SynthVoice,
    ev.params as SynthParams,
    ev.note ?? 60,
    ev.vel,
    ev.duration,
  );
}

export function triggerSting(
  ctx: BaseAudioContext,
  dest: AudioNode,
  when: number,
  preset: StingPreset,
  params: FxParams,
): AudioScheduledSourceNode[] {
  return playSting(ctx, dest, when, preset, params);
}
