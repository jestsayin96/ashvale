import { midiToHz } from '../../model/scales';
import type { SynthParams, SynthVoice } from '../../model/types';
import { playStyleSynth } from './styleVoices';
import { clamp } from '../units';

export interface SynthHit {
  vel: number;
  note: number;
  duration: number;
  params: SynthParams;
}

function freqClamp(ctx: BaseAudioContext, hz: number): number {
  return clamp(hz, 20, ctx.sampleRate * 0.45);
}

function oscWave(wave: SynthParams['wave']): OscillatorType {
  if (wave === 'sine' || wave === 'triangle' || wave === 'sawtooth' || wave === 'square') return wave;
  return 'square';
}

function startOsc(ctx: BaseAudioContext, type: OscillatorType, hz: number, detune: number, time: number, stop: number): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freqClamp(ctx, hz), time);
  osc.detune.setValueAtTime(detune, time);
  osc.start(time);
  osc.stop(stop);
  return osc;
}

function shape(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  hit: SynthHit,
  oscs: Array<{ type: OscillatorType; freq: number; detune: number; gain: number }>,
): AudioScheduledSourceNode[] {
  const { params, vel, duration } = hit;
  const adsr = params.adsr;
  const a = Math.max(0.001, adsr.a);
  const d = Math.max(0.001, adsr.d);
  const r = Math.max(0.001, adsr.r);
  const peak = Math.max(0.0001, vel);
  const sustain = Math.max(0.0001, peak * clamp(adsr.s, 0, 1));
  const rel = time + Math.max(duration, a + d);

  const filter = ctx.createBiquadFilter();
  filter.type = params.filter.type;
  filter.Q.setValueAtTime(clamp(params.filter.q, 0.1, 18), time);
  const base = freqClamp(ctx, params.filter.cutoff);
  const top = freqClamp(ctx, params.filter.cutoff * Math.pow(2, clamp(params.filter.envAmount, 0, 1) * 4));
  filter.frequency.setValueAtTime(base, time);
  filter.frequency.linearRampToValueAtTime(top, time + a);
  filter.frequency.linearRampToValueAtTime(base, time + a + d);
  filter.frequency.setValueAtTime(base, rel);
  filter.frequency.linearRampToValueAtTime(freqClamp(ctx, base * 0.75), rel + r);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(peak, time + a);
  g.gain.linearRampToValueAtTime(sustain, time + a + d);
  g.gain.setValueAtTime(sustain, rel);
  g.gain.linearRampToValueAtTime(0, rel + r);
  filter.connect(g);
  g.connect(dest);

  const stop = rel + r + 0.03;
  const sources: AudioScheduledSourceNode[] = [];
  for (const spec of oscs) {
    const osc = startOsc(ctx, spec.type, spec.freq, spec.detune, time, stop);
    const og = ctx.createGain();
    og.gain.setValueAtTime(spec.gain, time);
    osc.connect(og);
    og.connect(filter);
    sources.push(osc);
  }
  return sources;
}

export function lead(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: SynthHit): AudioScheduledSourceNode[] {
  const hz = midiToHz(hit.note + hit.params.octave * 12);
  const wave = oscWave(hit.params.wave);
  return shape(ctx, dest, time, hit, [
    { type: wave, freq: hz, detune: 0, gain: 0.45 },
    { type: wave, freq: hz, detune: hit.params.detuneCents, gain: 0.45 },
  ]);
}

export function bass(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: SynthHit): AudioScheduledSourceNode[] {
  const hz = midiToHz(hit.note + hit.params.octave * 12);
  return shape(ctx, dest, time, hit, [
    { type: 'sine', freq: hz, detune: 0, gain: 0.75 },
    { type: 'square', freq: hz * 0.5, detune: hit.params.detuneCents * 0.25, gain: 0.28 },
  ]);
}

export function pad(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: SynthHit): AudioScheduledSourceNode[] {
  const params = {
    ...hit.params,
    wave: 'sawtooth' as const,
    adsr: { ...hit.params.adsr, a: Math.max(0.4, hit.params.adsr.a) },
  };
  const shaped: SynthHit = { ...hit, params };
  const hz = midiToHz(hit.note + params.octave * 12);
  const detune = Math.max(8, Math.abs(params.detuneCents));
  return shape(ctx, dest, time, shaped, [
    { type: 'sawtooth', freq: hz, detune: -detune, gain: 0.28 },
    { type: 'sawtooth', freq: hz, detune: detune, gain: 0.28 },
  ]);
}

export function pluck(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: SynthHit): AudioScheduledSourceNode[] {
  const params = {
    ...hit.params,
    adsr: {
      a: Math.min(0.02, Math.max(0.001, hit.params.adsr.a)),
      d: Math.min(0.2, Math.max(0.04, hit.params.adsr.d)),
      s: Math.min(0.35, hit.params.adsr.s),
      r: Math.min(0.2, Math.max(0.02, hit.params.adsr.r)),
    },
  };
  const shaped: SynthHit = { ...hit, params };
  const hz = midiToHz(hit.note + params.octave * 12);
  const wave: OscillatorType = params.wave === 'sine' ? 'triangle' : oscWave(params.wave);
  return shape(ctx, dest, time, shaped, [
    { type: wave, freq: hz, detune: 0, gain: 0.5 },
    { type: wave, freq: hz, detune: params.detuneCents, gain: 0.35 },
  ]);
}

function styled(voice: SynthVoice) {
  return (ctx: BaseAudioContext, dest: AudioNode, time: number, hit: SynthHit) =>
    playStyleSynth(ctx, dest, time, voice, hit.params, hit.note, hit.vel, hit.duration);
}

const SYNTHS: Record<SynthVoice, (ctx: BaseAudioContext, dest: AudioNode, time: number, hit: SynthHit) => AudioScheduledSourceNode[]> = {
  lead,
  bass,
  pad,
  pluck,
  pulse: styled('pulse'),
  bell: styled('bell'),
  strings: styled('strings'),
  brass: styled('brass'),
  pizz: styled('pizz'),
  sub808: styled('sub808'),
};

export function playSynth(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  voice: SynthVoice,
  params: SynthParams,
  note: number,
  vel: number,
  duration: number,
): AudioScheduledSourceNode[] {
  return SYNTHS[voice](ctx, dest, time, {
    vel: Math.max(0, Math.min(1, vel)),
    note,
    duration: Math.max(0.02, duration),
    params,
  });
}
