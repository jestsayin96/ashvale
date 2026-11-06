import { encodeWav } from '../audio/render/wav';
import { measureLufs } from '../dsp/lufs';
import { measureTruePeak4x } from '../dsp/truepeak';
import { TRUE_PEAK_CEILING_DBTP } from '../style/targets';
import { APP_VERSION } from '../version';

export type StemKind = 'mix' | 'music' | 'sfx' | 'vocals';

export interface StemAudio {
  left: Float32Array;
  right: Float32Array;
}

export interface StemFileReport {
  file: string;
  stem: StemKind;
  lufs: number;
  truePeakDbtp: number;
  samplePeakDbfs: number;
  trimDb: number;
  seconds: number;
}

export interface StemExportReport {
  version: string;
  files: StemFileReport[];
  warnings: string[];
  plan?: unknown;
  listen?: unknown;
}

export function applyGain(left: Float32Array, right: Float32Array, gain: number): { left: Float32Array; right: Float32Array } {
  const oL = new Float32Array(left.length);
  const oR = new Float32Array(right.length);
  for (let i = 0; i < left.length; i++) oL[i] = left[i] * gain;
  for (let i = 0; i < right.length; i++) oR[i] = right[i] * gain;
  return { left: oL, right: oR };
}

/** Static gain so true peak ≤ ceiling. No limiter pumping. */
export function trimToTruePeakCeiling(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  ceilingDbtp = TRUE_PEAK_CEILING_DBTP,
): { left: Float32Array; right: Float32Array; trimDb: number; truePeakDbtp: number; samplePeakDbfs: number; lufs: number } {
  const before = measureTruePeak4x(left, right);
  let trimDb = 0;
  let outL = left;
  let outR = right;
  if (before.truePeak > ceilingDbtp) {
    trimDb = ceilingDbtp - before.truePeak;
    const gain = 10 ** (trimDb / 20);
    const scaled = applyGain(left, right, gain);
    outL = scaled.left;
    outR = scaled.right;
  }
  const after = measureTruePeak4x(outL, outR);
  const lufs = measureLufs(outL, outR, sampleRate).integrated;
  return {
    left: outL,
    right: outR,
    trimDb,
    truePeakDbtp: after.truePeak,
    samplePeakDbfs: after.samplePeak,
    lufs,
  };
}

export function maxAbsDiff(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let max = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > max) max = d;
  }
  return max;
}

/** Pre-limiter check: music + sfx ≈ mix (no vocals). */
export function stemsSumClose(mix: StemAudio, music: StemAudio, sfx: StemAudio, tol = 1e-4): boolean {
  const n = Math.min(mix.left.length, music.left.length, sfx.left.length);
  for (let i = 0; i < n; i++) {
    if (Math.abs(mix.left[i] - (music.left[i] + sfx.left[i])) > tol) return false;
    if (Math.abs(mix.right[i] - (music.right[i] + sfx.right[i])) > tol) return false;
  }
  return true;
}

/**
 * Pre-limiter residual of mix − (music + sfx + vocals) as peak dBFS.
 * Comparison point is the raw stem buses before true-peak trim / master limiter.
 */
export function stemsResidualPeakDbfs(
  mix: StemAudio,
  music: StemAudio,
  sfx: StemAudio,
  vocals: StemAudio,
): number {
  const n = Math.min(mix.left.length, music.left.length, sfx.left.length, vocals.left.length);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const dL = Math.abs(mix.left[i] - (music.left[i] + sfx.left[i] + vocals.left[i]));
    const dR = Math.abs(mix.right[i] - (music.right[i] + sfx.right[i] + vocals.right[i]));
    peak = Math.max(peak, dL, dR);
  }
  if (!(peak > 0)) return -120;
  return 20 * Math.log10(peak);
}

export function prepareStemFiles(
  baseName: string,
  sampleRate: number,
  bitDepth: 16 | 24,
  seed: number,
  stems: Partial<Record<StemKind, StemAudio>> & Pick<Record<StemKind, StemAudio>, 'mix' | 'music' | 'sfx'>,
  extras?: { warnings?: string[]; plan?: unknown; listen?: unknown },
): { files: Array<{ filename: string; data: Uint8Array; mime: string }>; report: StemExportReport } {
  const order: StemKind[] = stems.vocals ? ['mix', 'music', 'sfx', 'vocals'] : ['mix', 'music', 'sfx'];
  const files: Array<{ filename: string; data: Uint8Array; mime: string }> = [];
  const reports: StemFileReport[] = [];
  for (const stem of order) {
    const audio = stems[stem];
    if (!audio) continue;
    const trimmed = trimToTruePeakCeiling(audio.left, audio.right, sampleRate);
    const filename = `${baseName}_${stem}.wav`;
    files.push({
      filename,
      data: encodeWav(trimmed.left, trimmed.right, sampleRate, bitDepth, seed),
      mime: 'audio/wav',
    });
    reports.push({
      file: filename,
      stem,
      lufs: trimmed.lufs,
      truePeakDbtp: trimmed.truePeakDbtp,
      samplePeakDbfs: trimmed.samplePeakDbfs,
      trimDb: trimmed.trimDb,
      seconds: trimmed.left.length / sampleRate,
    });
  }
  const report: StemExportReport = {
    version: APP_VERSION,
    files: reports,
    warnings: extras?.warnings ?? [],
    ...(extras?.plan !== undefined ? { plan: extras.plan } : {}),
    ...(extras?.listen !== undefined ? { listen: extras.listen } : {}),
  };
  return { files, report };
}
