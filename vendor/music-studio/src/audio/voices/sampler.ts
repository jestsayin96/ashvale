import type { SamplerParams } from '../../model/types';
import type { LoadedSample, SampleLibrary } from '../../samples/library';
import { getCachedLibrary } from '../../samples/library';
import { dbToLin } from '../units';

const buffers = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
const chokeLive = new WeakMap<BaseAudioContext, Map<string, AudioBufferSourceNode>>();

export function playbackRateFor(note: number | undefined, params: SamplerParams): number {
  const midi = note === undefined ? params.rootMidi : note;
  const semis = midi - params.rootMidi + params.pitchSemis + params.fineCents / 100;
  return 2 ** (semis / 12);
}

function bufferFor(ctx: BaseAudioContext, id: string, sample: LoadedSample): AudioBuffer {
  let map = buffers.get(ctx);
  if (!map) {
    map = new Map();
    buffers.set(ctx, map);
  }
  let buf = map.get(id);
  if (buf) return buf;
  const channels = sample.buffer.channels;
  buf = ctx.createBuffer(Math.max(1, channels.length), channels[0]?.length ?? 1, sample.buffer.sampleRate);
  for (let c = 0; c < channels.length; c++) buf.copyToChannel(new Float32Array(channels[c]), c);
  map.set(id, buf);
  return buf;
}

export function playSampler(
  ctx: BaseAudioContext,
  dest: AudioNode,
  when: number,
  params: SamplerParams,
  note: number | undefined,
  vel: number,
  duration: number,
  library: SampleLibrary = getCachedLibrary(),
): AudioScheduledSourceNode[] {
  const sample = library.get(params.sampleId);
  if (!sample) return [];
  const buffer = bufferFor(ctx, params.sampleId, sample);
  const rate = playbackRateFor(note, params);
  if (!(rate > 0) || !Number.isFinite(rate)) return [];

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.setValueAtTime(rate, when);
  const startSec = Math.max(0, Math.min(buffer.duration, params.start));
  let endSec = params.end === null || params.end === undefined ? buffer.duration : Math.max(0, Math.min(buffer.duration, params.end));
  if (endSec <= startSec) endSec = Math.min(buffer.duration, startSec + 0.001);
  const slice = Math.max(0.001, endSec - startSec);
  if (params.loop) {
    src.loop = true;
    src.loopStart = params.loopStart ?? startSec;
    src.loopEnd = params.loopEnd ?? endSec;
  }

  const env = ctx.createGain();
  const peak = Math.max(0.0002, Math.min(1, vel) * dbToLin(params.gainDb));
  const a = Math.max(0.001, params.adsr.a);
  const d = Math.max(0.001, params.adsr.d);
  const r = Math.max(0.001, params.adsr.r);
  const sustain = Math.max(0.0002, Math.min(1, params.adsr.s) * peak);
  env.gain.setValueAtTime(0.0002, when);
  env.gain.exponentialRampToValueAtTime(peak, when + a);
  env.gain.exponentialRampToValueAtTime(sustain, when + a + d);
  const stopAt = when + Math.max(duration, a + d) + r;
  env.gain.setValueAtTime(sustain, Math.max(when + a + d, when + duration));
  env.gain.exponentialRampToValueAtTime(0.0002, stopAt);

  if (params.chokeGroup) {
    let live = chokeLive.get(ctx);
    if (!live) {
      live = new Map();
      chokeLive.set(ctx, live);
    }
    const previous = live.get(params.chokeGroup);
    if (previous) {
      try { previous.stop(when); } catch { /* already stopped */ }
    }
    live.set(params.chokeGroup, src);
  }

  src.connect(env);
  env.connect(dest);
  try {
    if (params.loop) src.start(when, startSec);
    else src.start(when, startSec, slice);
  } catch {
    return [];
  }
  try { src.stop(stopAt + 0.02); } catch { /* ignore */ }
  return [src];
}

/** Pure-TS resampled write used by Node tests. */
export function writeSamplerPure(
  left: Float32Array,
  right: Float32Array,
  origin: number,
  sampleRate: number,
  params: SamplerParams,
  note: number | undefined,
  vel: number,
  duration: number,
  library: SampleLibrary,
): void {
  const sample = library.get(params.sampleId);
  if (!sample) return;
  const rate = playbackRateFor(note, params);
  if (!(rate > 0)) return;
  const src = sample.buffer.channels;
  const srcRate = sample.buffer.sampleRate;
  const startSec = Math.max(0, params.start);
  const endSec = params.end === null || params.end === undefined
    ? (src[0]?.length ?? 0) / srcRate
    : Math.max(startSec, params.end);
  const outLen = Math.max(1, Math.round(duration * sampleRate));
  const peak = Math.max(0, Math.min(1, vel) * dbToLin(params.gainDb));
  const a = Math.max(0.001, params.adsr.a);
  const d = Math.max(0.001, params.adsr.d);
  const r = Math.max(0.001, params.adsr.r);
  const sustain = Math.max(0, Math.min(1, params.adsr.s));
  for (let i = 0; i < outLen; i++) {
    const t = i / sampleRate;
    let env = 1;
    if (t < a) env = Math.max(0.0002, t / a);
    else if (t < a + d) env = 1 - (1 - sustain) * ((t - a) / d);
    else if (t > duration - r) env = sustain * Math.max(0, (duration - t) / r);
    else env = sustain;
    const srcTime = startSec + t * rate;
    if (!params.loop && srcTime >= endSec) break;
    let pos = srcTime;
    if (params.loop) {
      const ls = params.loopStart ?? startSec;
      const le = params.loopEnd ?? endSec;
      const span = Math.max(0.001, le - ls);
      if (pos >= le) pos = ls + ((pos - ls) % span);
    }
    const idx = (pos * srcRate);
    const i0 = Math.floor(idx);
    const frac = idx - i0;
    const read = (ch: Float32Array) => {
      const a0 = ch[i0] ?? 0;
      const a1 = ch[i0 + 1] ?? a0;
      return a0 + (a1 - a0) * frac;
    };
    const l = read(src[0] ?? new Float32Array(1));
    const rch = read(src[1] ?? src[0] ?? new Float32Array(1));
    const at = origin + i;
    if (at < 0 || at >= left.length) continue;
    left[at] += l * peak * env;
    right[at] += rch * peak * env;
  }
}
