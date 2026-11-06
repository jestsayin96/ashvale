import { writeSamplerPure } from '../audio/voices/sampler';
import { dbToLin } from '../audio/units';
import { samplerParams } from '../model/defaults';
import { midiToHz } from '../model/scales';
import { getCachedLibrary } from '../samples/library';
import type { SynthBackend } from './backend';
import { silentStems } from './buffers';
import type { ScoreEvent } from './plan';
import { IMPACT_VOICES } from './targets';
import { voiceSpec } from './voiceSpecs';
import { yieldToUi } from './yield';

const IMPACT = new Set<string>(IMPACT_VOICES);

/**
 * Deterministic stand-in used by Node tests and the headless CLI.
 * Synth voices use band-limited partials; sample hits use writeSamplerPure
 * against getCachedLibrary(). It does not claim to be the Web Audio output.
 */
export const pureBackend: SynthBackend = {
  async render(events, startSample, lengthSamples, sampleRate) {
    const stems = silentStems(lengthSamples);
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const bus = stems[event.bus] ?? stems.melody;
      writeEvent(bus.left, bus.right, event, startSample, sampleRate);
      if (i % 80 === 79) await yieldToUi();
    }
    return stems;
  },
};

function writeSampleHit(left: Float32Array, right: Float32Array, event: ScoreEvent, origin: number, sampleRate: number): void {
  const id = event.params.sampleId!;
  const library = getCachedLibrary();
  const loaded = library.get(id);
  if (!loaded) return;
  const params = samplerParams({
    sampleId: id,
    rootMidi: event.params.rootMidi ?? 60,
    pitchSemis: event.params.pitchSemis ?? 0,
    fineCents: event.params.fineCents ?? 0,
    start: event.params.start ?? 0,
    end: event.params.end === undefined ? null : event.params.end,
    gainDb: (event.params.gainDb ?? 0) + (event.params.levelDb ?? 0),
    loop: event.params.loop === true,
    loopStart: event.params.loopStart,
    loopEnd: event.params.loopEnd,
    adsr: event.params.adsr ?? { a: 0.002, d: 0.04, s: 0.85, r: 0.02 },
  });
  const rate = 2 ** (((event.note ?? params.rootMidi) - params.rootMidi + params.pitchSemis + params.fineCents / 100) / 12);
  const srcLen = (loaded.buffer.channels[0]?.length ?? 0) / loaded.buffer.sampleRate / Math.max(1e-6, rate);
  const duration = Math.max(event.duration, Math.min(srcLen, 8));
  writeSamplerPure(left, right, origin, sampleRate, params, event.note, Math.max(0, event.vel), duration, library);
}

function writeEvent(left: Float32Array, right: Float32Array, event: ScoreEvent, startSample: number, sampleRate: number): void {
  const origin = Math.round(event.time * sampleRate) - startSample;
  if (event.params.sampleId) {
    writeSampleHit(left, right, event, origin, sampleRate);
    return;
  }
  const impact = origin + Math.round((event.impactOffset ?? 0) * sampleRate);
  const level = dbToLin(event.params.levelDb ?? 0);
  const amp = Math.max(0, event.vel) * level * voiceAmp(event);
  if (!(amp > 0)) return;
  const spec = voiceSpec(event.voice, event.note, event.params.brightness ?? 0.5);
  if (event.bus === 'sfx' && IMPACT.has(event.voice)) {
    burst(left, right, impact, amp, sampleRate);
    return;
  }
  const peakSample = Math.max(0, impact);
  if (spec.noiseHighpassHz > 0) {
    noiseHat(left, right, origin, amp * 0.7, sampleRate, Math.max(1, Math.round(event.duration * sampleRate)), spec.noiseHighpassHz, event.time);
    return;
  }
  const dur = Math.max(1, Math.round(event.duration * sampleRate));
  const base = event.note ? midiToHz(event.note + spec.octaveShift * 12) : event.voice === 'kick' || event.voice === 'bass808' ? 70 : 180;
  const attack = Math.max(1, Math.round(0.001 * sampleRate));
  const release = Math.max(attack, Math.round(0.03 * sampleRate));
  for (let h = 0; h < spec.partials.length; h++) {
    const hz = base * (h + 1);
    if (hz > spec.cutoffHz || hz > sampleRate * 0.45) continue;
    const partial = spec.partials[h];
    for (let i = 0; i < dur; i++) {
      const idx = origin + i;
      if (idx < 0 || idx >= left.length) continue;
      let env = 1;
      if ((event.impactOffset ?? 0) > 0) {
        const rise = Math.max(1, Math.round(0.004 * sampleRate));
        const localPeak = peakSample - origin;
        if (i < localPeak - rise) env = 0.02;
        else if (i < localPeak) env = (i - (localPeak - rise)) / rise;
        else env = Math.exp(-(i - localPeak) / Math.max(1, sampleRate * 0.03));
      } else if (i < attack) env = i / attack;
      else if (i > dur - release) env = Math.max(0, (dur - i) / release);
      const sample = Math.sin((2 * Math.PI * hz * idx) / sampleRate) * amp * partial * env;
      left[idx] += sample;
      right[idx] += sample;
    }
  }
}

function burst(left: Float32Array, right: Float32Array, center: number, amp: number, sampleRate: number): void {
  const attack = Math.max(1, Math.round(0.001 * sampleRate));
  const hold = Math.max(1, Math.round(0.003 * sampleRate));
  const start = center - attack;
  for (let i = 0; i < attack + hold; i++) {
    const idx = start + i;
    if (idx < 0 || idx >= left.length) continue;
    const env = i < attack ? (i + 1) / attack : 1;
    const sample = amp * env;
    left[idx] += sample;
    right[idx] += sample;
  }
}

function noiseHat(
  left: Float32Array,
  right: Float32Array,
  origin: number,
  amp: number,
  sampleRate: number,
  dur: number,
  highpassHz: number,
  seedTime: number,
): void {
  let state = Math.imul(Math.floor(seedTime * 1000) + 1, 0x9e3779b9) >>> 0;
  const next = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000 * 2 - 1;
  };
  const rc = 1 / (2 * Math.PI * highpassHz);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);
  let prevX = 0;
  let prevY = 0;
  const attack = Math.max(1, Math.round(0.001 * sampleRate));
  for (let i = 0; i < dur; i++) {
    const idx = origin + i;
    const x = next();
    const y = alpha * (prevY + x - prevX);
    prevX = x;
    prevY = y;
    if (idx < 0 || idx >= left.length) continue;
    const env = i < attack ? (i + 1) / attack : Math.exp(-i / (sampleRate * 0.03));
    left[idx] += y * amp * env;
    right[idx] += y * amp * env * 0.9;
  }
}

function voiceAmp(event: ScoreEvent): number {
  if (event.voice === 'hat' || event.voice === 'crash' || event.voice === 'clap') return 0.55;
  if (event.voice === 'kick') return 0.08;
  if (event.voice === 'pluck' || event.voice === 'lead' || event.voice === 'brass') return 0.36;
  if (event.voice === 'bass' || event.voice === 'bass808' || event.voice === 'pickBass') return 0.05;
  if (event.voice === 'pad' || event.voice === 'bell') return event.params.role === 'talk-air' ? 0.08 : 0.06;
  if (event.bus === 'sfx') return 0.34;
  return 0.1;
}
