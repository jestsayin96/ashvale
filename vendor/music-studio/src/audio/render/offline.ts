import type { Project } from '../../model/types';
import { buildEvents } from '../events';
import { dbToLin } from '../units';
import { triggerEvent, triggerSting } from '../trigger';
import { loopSampleCount } from './timing';
import type { FxParams, StingPreset } from '../voices/fx';

export async function renderProject(
  project: Project,
  bars: number,
  opts?: { tailSamples?: number },
): Promise<{ left: Float32Array; right: Float32Array }> {
  const sampleRate = 44100;
  const loop = loopSampleCount(bars, project.bpm, sampleRate);
  const tail = Math.max(0, opts?.tailSamples ?? 0);
  const length = Math.max(1, loop + tail);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const master = ctx.createGain();
  master.gain.value = dbToLin(project.master.gainDb);
  master.connect(ctx.destination);
  for (const ev of buildEvents(project, bars)) triggerEvent(ctx, master, ev, ev.time);
  const audio = await ctx.startRendering();
  return {
    left: new Float32Array(audio.getChannelData(0)),
    right: new Float32Array(audio.getChannelData(1)),
  };
}

export async function renderSting(
  preset: StingPreset,
  params: FxParams,
): Promise<{ left: Float32Array; right: Float32Array }> {
  const sampleRate = 44100;
  const frames = Math.max(1, Math.ceil(params.duration * sampleRate));
  const ctx = new OfflineAudioContext(2, frames, sampleRate);
  const master = ctx.createGain();
  master.connect(ctx.destination);
  triggerSting(ctx, master, 0, preset, params);
  const audio = await ctx.startRendering();
  return {
    left: new Float32Array(audio.getChannelData(0)),
    right: new Float32Array(audio.getChannelData(1)),
  };
}
