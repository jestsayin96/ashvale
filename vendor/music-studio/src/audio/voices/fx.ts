import { getNoise } from './drums';
import { mulberry32 } from '../../model/rng';
import { midiToHz } from '../../model/scales';

export interface FxParams {
  duration: number;
  pitch: number;
  brightness: number;
  intensity: number;
  seed: number;
}

function noise(ctx: BaseAudioContext, time: number, stop: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  src.loop = true;
  src.start(time);
  src.stop(stop);
  return src;
}

export function whoosh(ctx: BaseAudioContext, dest: AudioNode, time: number, p: FxParams): AudioScheduledSourceNode[] {
  const dur = p.duration;
  const src = noise(ctx, time, time + dur + 0.02);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.setValueAtTime(1.5 + p.brightness * 6, time);
  const f0 = Math.max(80, 180 * Math.pow(2, (p.pitch - 60) / 12));
  const f1 = Math.max(f0 + 50, 800 + p.brightness * 7000);
  bp.frequency.setValueAtTime(f0, time);
  bp.frequency.exponentialRampToValueAtTime(f1, time + dur * 0.55);
  bp.frequency.exponentialRampToValueAtTime(f0, time + dur);
  const g = ctx.createGain();
  const peak = 0.15 + p.intensity * 0.55;
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(peak, time + 0.02);
  g.gain.linearRampToValueAtTime(peak * 0.85, time + dur * 0.5);
  g.gain.linearRampToValueAtTime(0, time + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(dest);
  return [src];
}

export function hit(ctx: BaseAudioContext, dest: AudioNode, time: number, p: FxParams): AudioScheduledSourceNode[] {
  const dur = p.duration;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const f0 = midiToHz(p.pitch);
  osc.frequency.setValueAtTime(f0 * 2, time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, f0 * 0.5), time + 0.18);
  const og = ctx.createGain();
  const peak = 0.3 + p.intensity * 0.6;
  og.gain.setValueAtTime(0, time);
  og.gain.linearRampToValueAtTime(peak, time + 0.001);
  og.gain.exponentialRampToValueAtTime(0.001, time + Math.min(0.45, dur * 0.4));
  og.gain.linearRampToValueAtTime(0, time + Math.min(0.5, dur * 0.45));
  osc.connect(og);
  og.connect(dest);
  osc.start(time);
  osc.stop(time + dur);

  const src = noise(ctx, time, time + 0.4);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(400 + p.brightness * 4000, time);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0, time);
  ng.gain.linearRampToValueAtTime(peak * 0.45, time + 0.001);
  ng.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
  ng.gain.linearRampToValueAtTime(0, time + 0.16);
  src.connect(hp);
  hp.connect(ng);
  ng.connect(dest);
  return [osc, src];
}

export function riser(ctx: BaseAudioContext, dest: AudioNode, time: number, p: FxParams): AudioScheduledSourceNode[] {
  const dur = p.duration;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  const f0 = Math.max(40, midiToHz(p.pitch - 12));
  const f1 = Math.max(f0 + 20, midiToHz(p.pitch + 12 + p.brightness * 12));
  osc.frequency.setValueAtTime(f0, time);
  osc.frequency.exponentialRampToValueAtTime(f1, time + dur);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(300, time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(400, 1200 + p.brightness * 6000), time + dur);
  const g = ctx.createGain();
  const peak = 0.12 + p.intensity * 0.4;
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(peak * 0.15, time + 0.02);
  g.gain.linearRampToValueAtTime(peak, time + dur * 0.92);
  g.gain.linearRampToValueAtTime(0, time + dur);
  osc.connect(filter);
  filter.connect(g);
  g.connect(dest);
  osc.start(time);
  osc.stop(time + dur + 0.02);

  const src = noise(ctx, time, time + dur + 0.02);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0, time);
  ng.gain.linearRampToValueAtTime(peak * 0.25, time + dur * 0.9);
  ng.gain.linearRampToValueAtTime(0, time + dur);
  src.connect(ng);
  ng.connect(dest);
  return [osc, src];
}

export function blip(ctx: BaseAudioContext, dest: AudioNode, time: number, p: FxParams): AudioScheduledSourceNode[] {
  const dur = p.duration;
  const rng = mulberry32(p.seed >>> 0);
  const count = Math.max(4, Math.round(dur * 3));
  const gap = dur / count;
  const sources: AudioScheduledSourceNode[] = [];
  const scale = [0, 2, 4, 7, 9];
  for (let i = 0; i < count; i++) {
    const t = time + i * gap;
    const len = Math.min(0.18, gap * 0.7);
    const osc = ctx.createOscillator();
    osc.type = i % 2 === 0 ? 'sine' : 'triangle';
    const semi = scale[Math.floor(rng() * scale.length)] + (rng() > 0.7 ? 12 : 0);
    const hz = midiToHz(p.pitch + semi);
    osc.frequency.setValueAtTime(hz, t);
    const g = ctx.createGain();
    const peak = (0.15 + p.intensity * 0.45) * (0.6 + 0.4 * p.brightness);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.02, len));
    g.gain.linearRampToValueAtTime(0, t + len + 0.01);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + len + 0.02);
    sources.push(osc);
  }
  return sources;
}

export type StingPreset = 'whoosh' | 'hit' | 'riser' | 'blip';

const FX: Record<StingPreset, (ctx: BaseAudioContext, dest: AudioNode, time: number, p: FxParams) => AudioScheduledSourceNode[]> = {
  whoosh,
  hit,
  riser,
  blip,
};

export function playSting(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  preset: StingPreset,
  params: FxParams,
): AudioScheduledSourceNode[] {
  return FX[preset](ctx, dest, time, params);
}
