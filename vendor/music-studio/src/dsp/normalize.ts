import { limitTruePeak } from './limiter';
import { measureLufs } from './lufs';
import { measurePeaks } from './truepeak';

export interface LoudnessStats {
  lufs: number;
  shortTermMax: number;
  samplePeak: number;
  truePeak: number;
}

export interface NormalizeReport {
  before: LoudnessStats;
  after: LoudnessStats;
  passes: number;
  note: string;
}

export interface NormalizeResult {
  left: Float32Array;
  right: Float32Array;
  report: NormalizeReport;
}

function stats(left: Float32Array, right: Float32Array, sampleRate: number): LoudnessStats {
  const lufs = measureLufs(left, right, sampleRate);
  const peaks = measurePeaks(left, right);
  return {
    lufs: lufs.integrated,
    shortTermMax: lufs.shortTermMax,
    samplePeak: peaks.samplePeak,
    truePeak: peaks.truePeak,
  };
}

function applyGain(left: Float32Array, right: Float32Array, gain: number): { left: Float32Array; right: Float32Array } {
  const oL = new Float32Array(left.length);
  const oR = new Float32Array(right.length);
  for (let i = 0; i < left.length; i++) oL[i] = left[i] * gain;
  for (let i = 0; i < right.length; i++) oR[i] = right[i] * gain;
  return { left: oL, right: oR };
}

function joinNote(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return `${a}; ${b}`;
}

export function normalizeToTarget(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  opts: { targetLufs: number; ceilingDbtp: number },
): NormalizeResult {
  const before = stats(left, right, sampleRate);
  let note = '';
  if (left.length < sampleRate) note = 'very short: LUFS approximate';
  if (!Number.isFinite(before.lufs)) {
    const after = before;
    return {
      left: new Float32Array(left),
      right: new Float32Array(right),
      report: { before, after, passes: 0, note: joinNote(note, 'silence: skipped') },
    };
  }

  let curL: Float32Array = new Float32Array(left);
  let curR: Float32Array = new Float32Array(right);
  let passes = 0;
  let internal = opts.ceilingDbtp - 0.3;
  let after = before;

  for (let p = 0; p < 6; p++) {
    after = stats(curL, curR, sampleRate);
    if (Math.abs(after.lufs - opts.targetLufs) <= 0.3 && after.truePeak <= opts.ceilingDbtp) break;
    let gainDb = opts.targetLufs - after.lufs;
    if (!Number.isFinite(gainDb)) break;
    if (gainDb > 24) gainDb = 24;
    if (gainDb < -24) gainDb = -24;
    const gained = applyGain(curL, curR, Math.pow(10, gainDb / 20));
    const limited = limitTruePeak(gained.left, gained.right, sampleRate, internal);
    curL = limited.left;
    curR = limited.right;
    passes++;
  }
  after = stats(curL, curR, sampleRate);

  let safety = 0;
  while (after.truePeak > opts.ceilingDbtp && safety < 10) {
    internal -= 0.2;
    const limited = limitTruePeak(curL, curR, sampleRate, internal);
    curL = limited.left;
    curR = limited.right;
    after = stats(curL, curR, sampleRate);
    safety++;
    passes++;
  }

  if (after.truePeak > opts.ceilingDbtp) {
    const extra = after.truePeak - opts.ceilingDbtp + 0.05;
    const gained = applyGain(curL, curR, Math.pow(10, -extra / 20));
    curL = gained.left;
    curR = gained.right;
    after = stats(curL, curR, sampleRate);
  }

  if (Math.abs(after.lufs - opts.targetLufs) > 0.3) note = joinNote(note, 'limited by ceiling');
  return { left: curL, right: curR, report: { before, after, passes, note } };
}
