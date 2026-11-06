import { midiToHz } from '../../model/scales';
import type { DrumParams, DrumVoice, SynthParams, SynthVoice, Wave } from '../../model/types';

const pulseCache = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();

/** Band-limited pulse. Cached per context so a batch does not rebuild the wave. */
export function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  let map = pulseCache.get(ctx);
  if (!map) {
    map = new Map();
    pulseCache.set(ctx, map);
  }
  const key = duty.toFixed(2);
  const cached = map.get(key);
  if (cached) return cached;
  const real = new Float32Array(32);
  const imag = new Float32Array(32);
  for (let k = 1; k < 32; k++) imag[k] = (Math.sin(k * Math.PI * duty) * 2) / (k * Math.PI);
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  map.set(key, wave);
  return wave;
}

export function dutyForWave(wave: Wave): number | null {
  if (wave === 'pulse12') return 0.12;
  if (wave === 'pulse25') return 0.25;
  return null;
}

function clampFreq(ctx: BaseAudioContext, hz: number): number {
  return Math.max(20, Math.min(ctx.sampleRate * 0.45, hz));
}

function attackGain(ctx: BaseAudioContext, dest: AudioNode, time: number, peak: number, duration: number): GainNode {
  const g = ctx.createGain();
  const top = Math.max(0.0002, peak);
  g.gain.setValueAtTime(0.0002, time);
  g.gain.linearRampToValueAtTime(top, time + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0002, time + Math.max(0.02, duration));
  g.connect(dest);
  return g;
}

function tone(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  hz: number,
  duration: number,
  peak: number,
  wave: OscillatorType | PeriodicWave,
): AudioScheduledSourceNode {
  const g = attackGain(ctx, dest, time, peak, duration);
  const osc = ctx.createOscillator();
  if (typeof wave === 'string') osc.type = wave as OscillatorType;
  else osc.setPeriodicWave(wave);
  osc.frequency.setValueAtTime(clampFreq(ctx, hz), time);
  osc.connect(g);
  osc.start(time);
  osc.stop(time + Math.max(0.03, duration) + 0.02);
  return osc;
}

export function playStyleSynth(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  voice: SynthVoice,
  params: SynthParams,
  note: number,
  vel: number,
  duration: number,
): AudioScheduledSourceNode[] {
  const hz = midiToHz(note + params.octave * 12);
  const peak = Math.max(0.0002, Math.min(1, vel)) * 0.35;
  const duty = dutyForWave(params.wave);
  const pulse = duty !== null ? pulseWave(ctx, duty) : null;
  if (voice === 'pulse') {
    return [tone(ctx, dest, time, hz, Math.min(duration, 0.2), peak, pulse ?? pulseWave(ctx, 0.25))];
  }
  if (voice === 'bell') {
    return [
      tone(ctx, dest, time, hz, Math.min(duration, 1.2), peak, 'sine'),
      tone(ctx, dest, time, hz * 2.76, Math.min(duration, 0.4), peak * 0.25, 'sine'),
    ];
  }
  if (voice === 'strings') {
    return [
      tone(ctx, dest, time, hz, duration, peak * 0.5, 'sawtooth'),
      tone(ctx, dest, time, hz * 1.005, duration, peak * 0.35, 'sawtooth'),
    ];
  }
  if (voice === 'brass') {
    return [tone(ctx, dest, time, hz, duration, peak, 'sawtooth')];
  }
  if (voice === 'pizz') {
    return [tone(ctx, dest, time, hz, Math.min(duration, 0.18), peak, 'triangle')];
  }
  if (voice === 'sub808') {
    return [tone(ctx, dest, time, Math.max(30, hz / 2), Math.min(duration, 0.45), peak, 'sine')];
  }
  return [tone(ctx, dest, time, hz, duration, peak, pulse ?? 'triangle')];
}

export function playStyleDrum(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  voice: DrumVoice,
  params: DrumParams,
  vel: number,
): AudioScheduledSourceNode[] {
  const peak = Math.max(0.0002, Math.min(1, vel)) * 0.5;
  const decay = Math.max(0.02, Math.min(1.5, params.decay));
  if (voice === 'kick808') return [tone(ctx, dest, time, clampFreq(ctx, 55 * 2 ** (params.tuneSemis / 12)), decay, peak, 'sine')];
  if (voice === 'shaker') return [tone(ctx, dest, time, 6000, Math.min(decay, 0.08), peak * 0.4, 'square')];
  if (voice === 'crash') return [tone(ctx, dest, time, 320, Math.min(decay, 0.8), peak * 0.35, 'sawtooth')];
  if (voice === 'chipNoise') return [tone(ctx, dest, time, 1800, Math.min(decay, 0.06), peak * 0.3, pulseWave(ctx, 0.12))];
  if (voice === 'snareTight') return [tone(ctx, dest, time, 180, Math.min(decay, 0.1), peak, 'triangle')];
  return [tone(ctx, dest, time, 100, decay, peak, 'sine')];
}
