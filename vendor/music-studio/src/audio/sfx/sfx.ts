import { transientSpec } from './impactSpec';
import { isMeasuredImpact, killStingAmp, peakOffsetSeconds } from './peakTable';
import { impactOffsetFor } from '../../score/arranger';
import type { SfxName } from '../../score/cues';
import { SFX_NAMES } from '../../score/cues';
import { getNoise } from '../voices/drums';
import { midiToHz } from '../../model/scales';
import { mulberry32 } from '../../model/rng';

export interface SfxParams {
  intensity: number;
  pitch: number;
  duration: number;
  seed: number;
  direction?: 'up' | 'down';
  count?: number;
  index?: number;
}

export interface SfxDef {
  name: SfxName;
  defaultDuration: number;
  impactOffset: (params: SfxParams) => number;
  play: (ctx: BaseAudioContext, dest: AudioNode, time: number, params: SfxParams) => AudioScheduledSourceNode[];
}

function env(ctx: BaseAudioContext, dest: AudioNode, time: number, duration: number, peak: number, peakAt = 0.001): GainNode {
  const g = ctx.createGain();
  const dur = Math.max(0.012, duration);
  const attack = Math.min(0.004, Math.max(0.001, peakAt));
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(Math.max(0.0001, peak), time + attack);
  g.gain.linearRampToValueAtTime(0, time + dur);
  g.connect(dest);
  return g;
}

function clampHz(ctx: BaseAudioContext, hz: number): number {
  return Math.max(20, Math.min(ctx.sampleRate * 0.45, hz));
}

function tone(ctx: BaseAudioContext, dest: AudioNode, time: number, duration: number, hz: number, peak: number, type: OscillatorType, glide?: number): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = type;
  const f0 = clampHz(ctx, hz);
  osc.frequency.setValueAtTime(f0, time);
  if (glide && glide > 0) osc.frequency.exponentialRampToValueAtTime(clampHz(ctx, glide), time + Math.max(0.012, duration));
  const g = env(ctx, dest, time, duration, peak);
  osc.connect(g);
  osc.start(time);
  osc.stop(time + Math.max(0.02, duration) + 0.01);
  return osc;
}

function noise(ctx: BaseAudioContext, dest: AudioNode, time: number, duration: number, peak: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  src.loop = true;
  const g = env(ctx, dest, time, duration, peak);
  src.connect(g);
  src.start(time);
  src.stop(time + duration + 0.02);
  return src;
}

function def(name: SfxName, defaultDuration: number, play: SfxDef['play']): SfxDef {
  return {
    name,
    defaultDuration,
    impactOffset: (params) => impactOffsetFor(name, params.duration || defaultDuration),
    play,
  };
}

export const SFX_CATALOG: Record<SfxName, SfxDef> = {
  whoosh_up: def('whoosh_up', 0.6, (ctx, dest, time, p) => {
    const src = noise(ctx, dest, time, p.duration, 0.2 + p.intensity * 0.4);
    return [src];
  }),
  whoosh_down: def('whoosh_down', 0.6, (ctx, dest, time, p) => [noise(ctx, dest, time, p.duration, 0.2 + p.intensity * 0.35)]),
  riser: def('riser', 1.2, (ctx, dest, time, p) => [tone(ctx, dest, time, p.duration, midiToHz(p.pitch), 0.15 + p.intensity * 0.35, 'sawtooth', midiToHz(p.pitch + 24))]),
  impact: def('impact', 0.35, (ctx, dest, time, p) => [
    tone(ctx, dest, time, p.duration, midiToHz(p.pitch), 0.4 + p.intensity * 0.4, 'sine', midiToHz(p.pitch - 12)),
    noise(ctx, dest, time, 0.12, 0.2 * p.intensity),
  ]),
  sub_drop: def('sub_drop', 0.4, (ctx, dest, time, p) => [tone(ctx, dest, time, p.duration, midiToHz(p.pitch + 7), 0.55, 'sine', Math.max(30, midiToHz(p.pitch - 5)))]),
  stinger_a: def('stinger_a', 0.35, (ctx, dest, time, p) => [tone(ctx, dest, time, p.duration, midiToHz(p.pitch), 0.35, 'triangle')]),
  stinger_b: def('stinger_b', 0.35, (ctx, dest, time, p) => [tone(ctx, dest, time, p.duration, midiToHz(p.pitch + 3), 0.32, 'square')]),
  stinger_c: def('stinger_c', 0.4, (ctx, dest, time, p) => [tone(ctx, dest, time, p.duration, midiToHz(p.pitch + 7), 0.3, 'sawtooth')]),
  kill_sting: def('kill_sting', 0.16, (ctx, dest, time, p) => [tone(ctx, dest, time, p.duration, midiToHz(Math.max(80, p.pitch)), killStingAmp(p.index ?? 0, p.count ?? 3, p.intensity), 'square')]),
  combo_tick: def('combo_tick', 0.08, (ctx, dest, time, p) => [tone(ctx, dest, time, p.duration, midiToHz(p.pitch), 0.18, 'square')]),
  death_fall: def('death_fall', 0.45, (ctx, dest, time, p) => [tone(ctx, dest, time, p.duration, midiToHz(p.pitch), 0.3, 'sine', midiToHz(p.pitch - 12))]),
  record_scratch: def('record_scratch', 0.35, (ctx, dest, time, p) => [
    noise(ctx, dest, time, p.duration, 0.35 + p.intensity * 0.2),
    tone(ctx, dest, time, p.duration * 0.4, 2500 + p.intensity * 2000, 0.15 + p.intensity * 0.2, 'square'),
  ]),
  sad_trombone: def('sad_trombone', 0.7, (ctx, dest, time, p) => {
    const hz = midiToHz(p.pitch);
    return [1, 2, 3].map((h) => tone(ctx, dest, time, p.duration, hz * h, (0.2 + p.intensity * 0.15) / h, 'sawtooth', midiToHz(p.pitch - 7) * h));
  }),
  boing: def('boing', 0.28, (ctx, dest, time, p) => {
    const hz = midiToHz(p.pitch);
    const bright = 0.4 + p.intensity * 0.5;
    return [1, 3, 5].map((h) => tone(ctx, dest, time, p.duration, hz * h, bright / h, 'square', midiToHz(p.pitch - 5) * h));
  }),
  blip: def('blip', 0.12, (ctx, dest, time, p) => {
    const hz = midiToHz(p.pitch);
    const bright = 0.25 + p.intensity * 0.4;
    return [1, 2, 4].map((h) => tone(ctx, dest, time, p.duration, hz * h, bright / h, 'square'));
  }),
  funny_blips: def('funny_blips', 0.4, (ctx, dest, time, p) => {
    const bright = 0.2 + p.intensity * 0.35;
    return [0, 1, 2].flatMap((i) => [1, 2].map((h) => tone(ctx, dest, time + i * 0.08, 0.08, midiToHz(p.pitch + i * 2) * h, bright / h, 'square')));
  }),
  victory_fanfare: def('victory_fanfare', 1.2, (ctx, dest, time, p) => [0, 4, 7].map((step, i) => tone(ctx, dest, time + i * 0.18, 0.4, midiToHz(p.pitch + step), 0.28, 'sawtooth'))),
  jumpscare_hit: def('jumpscare_hit', 0.45, (ctx, dest, time, p) => [
    tone(ctx, dest, time, p.duration, midiToHz(p.pitch), 0.7, 'sawtooth', 70),
    noise(ctx, dest, time, 0.2, 0.45),
  ]),
  reverse_cymbal: def('reverse_cymbal', 0.8, (ctx, dest, time, p) => [noise(ctx, dest, time, p.duration, 0.25 + p.intensity * 0.3)]),
  tick: def('tick', 0.08, (ctx, dest, time, p) => [tone(ctx, dest, time, p.duration, midiToHz(p.pitch), 0.16, 'square')]),
  glitch: def('glitch', 0.3, (ctx, dest, time, p) => {
    const rnd = mulberry32(p.seed || 1);
    const nodes: AudioScheduledSourceNode[] = [];
    for (let i = 0; i < 4; i++) {
      if (rnd() > 0.3) nodes.push(noise(ctx, dest, time + i * (p.duration / 4), p.duration / 8, 0.2));
    }
    return nodes;
  }),
  shimmer: def('shimmer', 1.1, (ctx, dest, time, p) => [
    tone(ctx, dest, time, p.duration, midiToHz(p.pitch), 0.16, 'sine'),
    tone(ctx, dest, time, p.duration, midiToHz(p.pitch + 12), 0.1, 'sine'),
  ]),
};

export function playSfx(ctx: BaseAudioContext, dest: AudioNode, time: number, name: SfxName, params: SfxParams): AudioScheduledSourceNode[] {
  const entry = SFX_CATALOG[name];
  const nodes = entry.play(ctx, dest, time, params);
  if (isMeasuredImpact(name)) {
    const offset = peakOffsetSeconds(name, params.duration || entry.defaultDuration);
    const spec = transientSpec(name);
    const amp = name === 'kill_sting'
      ? killStingAmp(params.index ?? 0, params.count ?? 3, params.intensity)
      : Math.max(0.08, 0.25 + params.intensity * 0.35);
    nodes.push(tone(ctx, dest, time + offset, spec.ms / 1000, spec.hz, amp * spec.gain, 'square'));
  }
  return nodes;
}

export function listSfxNames(): SfxName[] {
  return [...SFX_NAMES];
}
