import { midiToHz } from '../../model/scales';
import { voiceSpec } from '../../score/voiceSpecs';
import type { DrumParams } from '../../model/types';
import { getNoise } from './drums';

export interface ExtraHit {
  vel: number;
  note?: number;
  duration: number;
  brightness: number;
}

function gainEnv(ctx: BaseAudioContext, dest: AudioNode, time: number, peak: number, duration: number, attack = 0.001): GainNode {
  const g = ctx.createGain();
  const dur = Math.max(0.02, duration);
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(Math.max(0.0001, peak), time + Math.min(attack, dur * 0.4));
  g.gain.linearRampToValueAtTime(0, time + dur);
  g.connect(dest);
  return g;
}

function clampHz(ctx: BaseAudioContext, hz: number): number {
  return Math.max(20, Math.min(ctx.sampleRate * 0.45, hz));
}

function osc(ctx: BaseAudioContext, dest: AudioNode, time: number, type: OscillatorType, hz: number, peak: number, duration: number, attack = 0.001): OscillatorNode {
  const node = ctx.createOscillator();
  node.type = type;
  node.frequency.setValueAtTime(clampHz(ctx, hz), time);
  const g = gainEnv(ctx, dest, time, peak, duration, attack);
  node.connect(g);
  node.start(time);
  node.stop(time + duration + 0.02);
  return node;
}

export function bell(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: ExtraHit): AudioScheduledSourceNode[] {
  const spec = voiceSpec('bell', hit.note, hit.brightness);
  const f = midiToHz(hit.note ?? 76);
  const ratios = [1, 2.76, 5.4, 8.2];
  return spec.partials.map((amp, i) => osc(ctx, dest, time, 'sine', f * (ratios[i] ?? i + 1), hit.vel * 0.25 * amp, hit.duration, 0.002));
}

export function stringPad(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: ExtraHit): AudioScheduledSourceNode[] {
  const f = midiToHz(hit.note ?? 60);
  return [-8, -3, 0, 4, 7].map((cents) => osc(ctx, dest, time, 'sawtooth', f * Math.pow(2, cents / 1200), hit.vel * 0.08, hit.duration, 0.08));
}

export function brassStab(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: ExtraHit): AudioScheduledSourceNode[] {
  const f = midiToHz(hit.note ?? 64);
  return [0, 7].map((semi) => osc(ctx, dest, time, 'sawtooth', f * Math.pow(2, semi / 12), hit.vel * 0.2, Math.min(0.4, hit.duration), 0.004));
}

export function kalimba(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: ExtraHit): AudioScheduledSourceNode[] {
  const spec = voiceSpec('kalimba', hit.note, hit.brightness);
  const f = midiToHz(hit.note ?? 72);
  const nodes: OscillatorNode[] = [];
  spec.partials.forEach((amp, i) => {
    const hz = f * (i + 1);
    if (hz > spec.cutoffHz) return;
    nodes.push(osc(ctx, dest, time, 'triangle', hz, hit.vel * 0.3 * amp, Math.min(0.6, hit.duration), 0.001));
  });
  nodes.push(osc(ctx, dest, time, 'square', Math.min(spec.cutoffHz, f * 6), hit.vel * 0.12, 0.02, 0.001));
  return nodes;
}

export function bass808(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: ExtraHit): AudioScheduledSourceNode[] {
  const node = ctx.createOscillator();
  node.type = 'sine';
  const f = midiToHz(hit.note ?? 36);
  node.frequency.setValueAtTime(clampHz(ctx, f * 1.5), time);
  node.frequency.exponentialRampToValueAtTime(clampHz(ctx, Math.max(28, f)), time + 0.08);
  const g = gainEnv(ctx, dest, time, hit.vel * 0.6, Math.max(0.3, hit.duration), 0.001);
  node.connect(g);
  node.start(time);
  node.stop(time + hit.duration + 0.02);
  return [node];
}

export function reese(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: ExtraHit): AudioScheduledSourceNode[] {
  const f = midiToHz(hit.note ?? 36);
  return [osc(ctx, dest, time, 'sawtooth', f, hit.vel * 0.15, hit.duration, 0.01), osc(ctx, dest, time, 'sawtooth', f * 1.01, hit.vel * 0.15, hit.duration, 0.01)];
}

export function pickBass(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: ExtraHit): AudioScheduledSourceNode[] {
  return [osc(ctx, dest, time, 'square', midiToHz(hit.note ?? 40), hit.vel * 0.2, Math.min(0.25, hit.duration), 0.001)];
}

export function shimmerVoice(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: ExtraHit): AudioScheduledSourceNode[] {
  return bell(ctx, dest, time, { ...hit, vel: hit.vel * 0.5 });
}

function noiseHit(ctx: BaseAudioContext, dest: AudioNode, time: number, peak: number, duration: number, highpass: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(highpass, time);
  const g = gainEnv(ctx, dest, time, peak, duration, 0.001);
  src.connect(filter);
  filter.connect(g);
  src.start(time);
  src.stop(time + duration + 0.02);
  return src;
}

export function hatShaker(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: ExtraHit): AudioScheduledSourceNode[] {
  return [noiseHit(ctx, dest, time, hit.vel * 0.2, 0.05, 6000)];
}

export function ride(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: ExtraHit): AudioScheduledSourceNode[] {
  return [noiseHit(ctx, dest, time, hit.vel * 0.18, 0.4, 4000)];
}

export function crash(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: ExtraHit): AudioScheduledSourceNode[] {
  return [noiseHit(ctx, dest, time, hit.vel * 0.35, Math.max(0.4, hit.duration), 3000)];
}

export function reverseCymbal(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: ExtraHit): AudioScheduledSourceNode[] {
  const src = noiseHit(ctx, dest, time, hit.vel * 0.3, hit.duration, 2000);
  return [src];
}

export function brushSnare(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: ExtraHit): AudioScheduledSourceNode[] {
  return [noiseHit(ctx, dest, time, hit.vel * 0.2, 0.18, 1000)];
}

export function playExtra(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  voice: string,
  hit: ExtraHit,
): AudioScheduledSourceNode[] {
  if (voice === 'bell') return bell(ctx, dest, time, hit);
  if (voice === 'stringPad' || voice === 'pad') return stringPad(ctx, dest, time, hit);
  if (voice === 'brass') return brassStab(ctx, dest, time, hit);
  if (voice === 'kalimba' || voice === 'pluck') return kalimba(ctx, dest, time, hit);
  if (voice === 'bass808') return bass808(ctx, dest, time, hit);
  if (voice === 'reese') return reese(ctx, dest, time, hit);
  if (voice === 'pickBass' || voice === 'bass') return pickBass(ctx, dest, time, hit);
  if (voice === 'shimmer') return shimmerVoice(ctx, dest, time, hit);
  if (voice === 'shaker' || voice === 'hat') return hatShaker(ctx, dest, time, hit);
  if (voice === 'ride') return ride(ctx, dest, time, hit);
  if (voice === 'crash' || voice === 'reverseCymbal') return voice === 'crash' ? crash(ctx, dest, time, hit) : reverseCymbal(ctx, dest, time, hit);
  if (voice === 'snareBrush') return brushSnare(ctx, dest, time, hit);
  if (voice === 'lead') return [osc(ctx, dest, time, 'sawtooth', midiToHz(hit.note ?? 64), hit.vel * 0.15, hit.duration, 0.005)];
  return [osc(ctx, dest, time, 'sine', midiToHz(hit.note ?? 60), hit.vel * 0.2, hit.duration, 0.002)];
}

export function extraFromDrum(params: DrumParams, vel: number, duration: number): ExtraHit {
  return { vel, duration, brightness: params.tone, note: 36 + params.tuneSemis };
}
