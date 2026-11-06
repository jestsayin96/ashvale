/**
 * Layers file: schedule sample hits by bar ranges and 16th-step masks.
 * Used by the headless CLI (--layers) and optional cue-sheet `layers:` path.
 */

import { writeSamplerPure } from '../audio/voices/sampler';
import { measureLufs } from '../dsp/lufs';
import { samplerParams } from '../model/defaults';
import type { SampleLibrary } from '../samples/library';
import { dbToLin } from '../audio/units';

export interface LayerBarRange {
  start: number;
  end: number;
}

export interface LayerSpec {
  id: string;
  steps: string;
  bars: LayerBarRange[];
  gain: number;
}

export interface LayersFile {
  bpm: number;
  bars: number;
  note?: string;
  layers: LayerSpec[];
}

export interface LayersParseResult {
  ok: boolean;
  layers?: LayersFile;
  errors: string[];
  warnings: string[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Default vocal bus target: 3.5 dB under the synth bed (within 3–4). */
export const DEFAULT_VOCAL_UNDER_BED_DB = 3.5;

export function parseLayersJson(raw: unknown, defaults?: { bpm?: number; bars?: number }): LayersParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['Layers file must be a JSON object'], warnings };
  const bpm = Number(raw.bpm ?? defaults?.bpm ?? 100);
  const bars = Number(raw.bars ?? defaults?.bars ?? 16);
  if (!(bpm > 0 && bpm < 400)) errors.push('bpm must be a positive number under 400');
  if (!(Number.isInteger(bars) && bars > 0 && bars <= 512)) errors.push('bars must be an integer 1..512');
  if (!Array.isArray(raw.layers)) errors.push('layers must be an array');
  else if ((raw.layers as unknown[]).length === 0) errors.push('layers must contain at least one layer');
  if (errors.length) return { ok: false, errors, warnings };

  const layers: LayerSpec[] = [];
  (raw.layers as unknown[]).forEach((row, index) => {
    if (!isObj(row)) {
      errors.push(`layers[${index}] must be an object`);
      return;
    }
    const id = String(row.id ?? '');
    if (!id) {
      errors.push(`layers[${index}] is missing id`);
      return;
    }
    const steps = String(row.steps ?? '');
    if (!steps || !/^[\.xX]+$/.test(steps)) {
      errors.push(`layers[${index}] (${id}) steps must be a non-empty string of . and x`);
      return;
    }
    if (!Array.isArray(row.bars) || row.bars.length === 0) {
      errors.push(`layers[${index}] (${id}) bars must be a non-empty list of [start,end]`);
      return;
    }
    const ranges: LayerBarRange[] = [];
    for (const pair of row.bars as unknown[]) {
      if (!Array.isArray(pair) || pair.length < 2) {
        errors.push(`layers[${index}] (${id}) bars entries must be [start,end]`);
        continue;
      }
      const start = Number(pair[0]);
      const end = Number(pair[1]);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
        errors.push(`layers[${index}] (${id}) invalid bar range [${pair[0]},${pair[1]}]`);
        continue;
      }
      ranges.push({ start, end });
    }
    const gain = row.gain === undefined ? 0 : Number(row.gain);
    if (!Number.isFinite(gain)) {
      errors.push(`layers[${index}] (${id}) gain must be a number`);
      return;
    }
    layers.push({ id, steps, bars: ranges, gain });
  });

  if (errors.length) return { ok: false, errors, warnings };
  return {
    ok: true,
    layers: {
      bpm,
      bars,
      ...(typeof raw.note === 'string' ? { note: raw.note } : {}),
      layers,
    },
    errors,
    warnings,
  };
}

function peakNormalize(channels: Float32Array[]): Float32Array[] {
  let peak = 0;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  if (!(peak > 1e-9)) return channels.map((ch) => new Float32Array(ch));
  const g = 1 / peak;
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) out[i] = ch[i] * g;
    return out;
  });
}

export interface LayerRenderResult {
  left: Float32Array;
  right: Float32Array;
  hits: Array<{ id: string; time: number }>;
  samplesUsed: Record<string, number>;
  warnings: string[];
}

/** Place peak-normalized samples at every 'x' inside the bar ranges. */
export function renderLayersBus(
  file: LayersFile,
  library: SampleLibrary,
  sampleRate: number,
  options?: { lengthSeconds?: number },
): LayerRenderResult {
  const stepDur = 60 / file.bpm / 4;
  const lengthSeconds = options?.lengthSeconds ?? (file.bars * 16 * stepDur);
  const n = Math.max(1, Math.round(lengthSeconds * sampleRate));
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const hits: Array<{ id: string; time: number }> = [];
  const samplesUsed: Record<string, number> = {};
  const warnings: string[] = [];

  for (const layer of file.layers) {
    const loaded = library.get(layer.id);
    if (!loaded) {
      warnings.push(`unknown sample id "${layer.id}" — skipped`);
      continue;
    }
    const norm = peakNormalize(loaded.buffer.channels);
    const tempLib: SampleLibrary = new Map(library);
    tempLib.set(layer.id, { meta: loaded.meta, buffer: { sampleRate: loaded.buffer.sampleRate, channels: norm } });
    const stepsPerBar = layer.steps.length;
    const params = samplerParams({
      sampleId: layer.id,
      rootMidi: loaded.meta.rootMidi,
      gainDb: layer.gain,
      adsr: { a: 0.002, d: 0.05, s: 0.9, r: 0.03 },
      loop: loaded.meta.loop,
      loopStart: loaded.meta.loopStart,
      loopEnd: loaded.meta.loopEnd,
    });
    const srcDur = (norm[0]?.length ?? 1) / loaded.buffer.sampleRate;

    for (const range of layer.bars) {
      for (let bar = range.start; bar <= range.end && bar < file.bars; bar++) {
        for (let s = 0; s < stepsPerBar; s++) {
          const ch = layer.steps[s];
          if (ch !== 'x' && ch !== 'X') continue;
          const stepIndex = bar * stepsPerBar + s;
          // When steps length != 16, still treat stepsPerBar as the bar grid.
          const time = (bar * 16 + (s * 16) / stepsPerBar) * stepDur;
          if (time >= lengthSeconds) continue;
          const origin = Math.round(time * sampleRate);
          writeSamplerPure(left, right, origin, sampleRate, params, undefined, 1, Math.min(srcDur, 4), tempLib);
          hits.push({ id: layer.id, time });
          samplesUsed[layer.id] = (samplesUsed[layer.id] ?? 0) + 1;
        }
      }
    }
  }

  // Soft fade last 1.5 s of the vocal bus (Python reference).
  const fadeSamples = Math.min(n, Math.round(1.5 * sampleRate));
  for (let i = 0; i < fadeSamples; i++) {
    const idx = n - fadeSamples + i;
    const g = 1 - i / Math.max(1, fadeSamples);
    left[idx] *= g;
    right[idx] *= g;
  }

  return { left, right, hits, samplesUsed, warnings };
}

/**
 * Scale bed by 0.8, then set vocals so their LUFS is `vocalDb` relative to the
 * (pre-scale) bed. Default vocalDb = -3.5 (vocals ~3–4 dB under the bed).
 */
export function mixBedAndVocals(
  bed: { left: Float32Array; right: Float32Array },
  vocals: { left: Float32Array; right: Float32Array },
  sampleRate: number,
  vocalDb: number = -DEFAULT_VOCAL_UNDER_BED_DB,
): {
  mix: { left: Float32Array; right: Float32Array };
  vocals: { left: Float32Array; right: Float32Array };
  bedScaled: { left: Float32Array; right: Float32Array };
  bedGain: number;
  vocalGain: number;
  underBedDb: number;
} {
  const n = Math.max(bed.left.length, vocals.left.length);
  const bedL = new Float32Array(n);
  const bedR = new Float32Array(n);
  const vocL = new Float32Array(n);
  const vocR = new Float32Array(n);
  bedL.set(bed.left);
  bedR.set(bed.right);
  vocL.set(vocals.left.subarray(0, Math.min(n, vocals.left.length)));
  vocR.set(vocals.right.subarray(0, Math.min(n, vocals.right.length)));

  const bedLufs = measureLufs(bedL, bedR, sampleRate).integrated;
  const vocLufs = measureLufs(vocL, vocR, sampleRate).integrated;
  const bedGain = 0.8;
  let vocalGain = 1;
  const targetDelta = Number.isFinite(vocalDb) ? vocalDb : -DEFAULT_VOCAL_UNDER_BED_DB;
  if (Number.isFinite(bedLufs) && Number.isFinite(vocLufs) && vocLufs > -120 && bedLufs > -120) {
    const targetVoc = bedLufs + targetDelta;
    vocalGain = dbToLin(targetVoc - vocLufs);
  }
  const underBedDb = -targetDelta;

  for (let i = 0; i < n; i++) {
    bedL[i] *= bedGain;
    bedR[i] *= bedGain;
    vocL[i] *= vocalGain;
    vocR[i] *= vocalGain;
  }
  const mixL = new Float32Array(n);
  const mixR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    mixL[i] = bedL[i] + vocL[i];
    mixR[i] = bedR[i] + vocR[i];
  }
  return {
    mix: { left: mixL, right: mixR },
    vocals: { left: vocL, right: vocR },
    bedScaled: { left: bedL, right: bedR },
    bedGain,
    vocalGain,
    underBedDb,
  };
}
