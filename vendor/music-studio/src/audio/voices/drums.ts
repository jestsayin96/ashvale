import { mulberry32 } from '../../model/rng';
import type { DrumParams, DrumVoice } from '../../model/types';
import { playStyleDrum } from './styleVoices';

export interface DrumHit {
  vel: number;
  tuneSemis: number;
  decay: number;
  tone: number;
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

export function getNoise(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx);
  if (cached) return cached;
  const length = Math.max(1, Math.floor(ctx.sampleRate * 2));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const rnd = mulberry32(0x9e3779b9);
  for (let i = 0; i < length; i++) data[i] = rnd() * 2 - 1;
  noiseCache.set(ctx, buffer);
  return buffer;
}

function semi(freq: number, semis: number): number {
  return Math.max(20, freq * Math.pow(2, semis / 12));
}

function envGain(ctx: BaseAudioContext, dest: AudioNode, time: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  const end = time + Math.max(0.02, decay);
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(Math.max(0.0001, peak), time + 0.001);
  g.gain.exponentialRampToValueAtTime(0.001, Math.max(time + 0.004, end - 0.004));
  g.gain.linearRampToValueAtTime(0, end);
  g.connect(dest);
  return g;
}

function noiseSource(ctx: BaseAudioContext, dest: AudioNode, time: number, stop: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  src.loop = true;
  src.connect(dest);
  src.start(time);
  src.stop(stop);
  return src;
}

export function kick(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: DrumHit): AudioScheduledSourceNode[] {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const startF = semi(150, hit.tuneSemis);
  const endF = semi(45, hit.tuneSemis);
  const decay = Math.max(0.05, hit.decay);
  osc.frequency.setValueAtTime(startF, time);
  osc.frequency.exponentialRampToValueAtTime(endF, time + Math.min(0.09, decay * 0.6));
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(180 + hit.tone * 2200, time);
  filter.Q.setValueAtTime(0.7, time);
  const g = envGain(ctx, dest, time, 0.95 * hit.vel, decay);
  osc.connect(filter);
  filter.connect(g);
  const stop = time + decay + 0.03;
  osc.start(time);
  osc.stop(stop);
  return [osc];
}

export function snare(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: DrumHit): AudioScheduledSourceNode[] {
  const decay = Math.max(0.08, hit.decay);
  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(semi(190, hit.tuneSemis), time);
  body.frequency.exponentialRampToValueAtTime(semi(130, hit.tuneSemis), time + decay * 0.6);
  const bodyGain = envGain(ctx, dest, time, 0.45 * hit.vel, decay * 0.55);
  body.connect(bodyGain);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(900 + hit.tone * 2500, time);
  const noiseGain = envGain(ctx, dest, time, 0.55 * hit.vel, decay);
  const src = noiseSource(ctx, hp, time, time + decay + 0.03);
  hp.connect(noiseGain);
  const stop = time + decay + 0.03;
  body.start(time);
  body.stop(stop);
  return [body, src];
}

export function clap(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: DrumHit): AudioScheduledSourceNode[] {
  const decay = Math.max(0.12, hit.decay);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(1000 + hit.tone * 1800, time);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  const peak = Math.max(0.0002, 0.7 * hit.vel);
  for (let i = 0; i < 3; i++) {
    const t = time + i * 0.011;
    g.gain.setValueAtTime(0.0002, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, peak * (1 - i * 0.15)), t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
  }
  const tail = time + 0.04;
  g.gain.setValueAtTime(0.001, tail);
  g.gain.linearRampToValueAtTime(Math.max(0.0002, peak * 0.55), tail + 0.004);
  g.gain.exponentialRampToValueAtTime(0.001, time + decay);
  g.gain.linearRampToValueAtTime(0, time + decay + 0.01);
  g.connect(dest);
  hp.connect(g);
  const src = noiseSource(ctx, hp, time, time + decay + 0.02);
  return [src];
}

function hat(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: DrumHit, decayScale: number): AudioScheduledSourceNode[] {
  const decay = Math.max(0.02, hit.decay * decayScale);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(5000 + hit.tone * 4000, time);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(semi(8000, hit.tuneSemis), time);
  bp.Q.setValueAtTime(0.7, time);
  const g = envGain(ctx, dest, time, 0.4 * hit.vel, decay);
  hp.connect(bp);
  bp.connect(g);
  const src = noiseSource(ctx, hp, time, time + decay + 0.02);
  return [src];
}

export function hatClosed(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: DrumHit): AudioScheduledSourceNode[] {
  return hat(ctx, dest, time, hit, 1);
}

export function hatOpen(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: DrumHit): AudioScheduledSourceNode[] {
  return hat(ctx, dest, time, { ...hit, decay: Math.max(hit.decay, 0.12) }, 3.2);
}

export function tom(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: DrumHit): AudioScheduledSourceNode[] {
  const decay = Math.max(0.08, hit.decay);
  const osc = ctx.createOscillator();
  osc.type = hit.tone > 0.5 ? 'triangle' : 'sine';
  const startF = semi(140, hit.tuneSemis);
  osc.frequency.setValueAtTime(startF, time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, startF * 0.65), time + decay * 0.7);
  const g = envGain(ctx, dest, time, 0.8 * hit.vel, decay);
  osc.connect(g);
  osc.start(time);
  osc.stop(time + decay + 0.03);
  return [osc];
}

export function rim(ctx: BaseAudioContext, dest: AudioNode, time: number, hit: DrumHit): AudioScheduledSourceNode[] {
  const decay = Math.max(0.02, Math.min(0.09, hit.decay));
  const click = ctx.createOscillator();
  click.type = 'square';
  click.frequency.setValueAtTime(semi(900, hit.tuneSemis), time);
  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(semi(420, hit.tuneSemis), time);
  const gClick = envGain(ctx, dest, time, 0.22 * hit.vel, decay * 0.45);
  const gBody = envGain(ctx, dest, time, 0.4 * hit.vel, decay);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(400 + hit.tone * 1500, time);
  click.connect(hp);
  hp.connect(gClick);
  body.connect(gBody);
  const stop = time + decay + 0.02;
  click.start(time);
  body.start(time);
  click.stop(stop);
  body.stop(stop);
  return [click, body];
}

function styled(voice: DrumVoice) {
  return (ctx: BaseAudioContext, dest: AudioNode, time: number, hit: DrumHit) =>
    playStyleDrum(ctx, dest, time, voice, { tuneSemis: hit.tuneSemis, decay: hit.decay, tone: hit.tone }, hit.vel);
}

const DRUMS: Record<DrumVoice, (ctx: BaseAudioContext, dest: AudioNode, time: number, hit: DrumHit) => AudioScheduledSourceNode[]> = {
  kick,
  snare,
  clap,
  hatClosed,
  hatOpen,
  tom,
  rim,
  kick808: styled('kick808'),
  shaker: styled('shaker'),
  crash: styled('crash'),
  chipNoise: styled('chipNoise'),
  snareTight: styled('snareTight'),
};

export function playDrum(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  voice: DrumVoice,
  params: DrumParams,
  vel: number,
): AudioScheduledSourceNode[] {
  return DRUMS[voice](ctx, dest, time, {
    vel: Math.max(0, Math.min(1, vel)),
    tuneSemis: params.tuneSemis,
    decay: params.decay,
    tone: params.tone,
  });
}
