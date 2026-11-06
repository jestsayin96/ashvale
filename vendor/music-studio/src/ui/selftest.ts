import { renderLoop } from '../audio/render/loop';
import { normalizeToTarget } from '../dsp/normalize';
import { seamReport } from '../dsp/seam';
import { newProject } from '../model/defaults';

function line(ok: boolean, name: string, detail: string): string {
  return `${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`;
}

/** Renders the demo through OfflineAudioContext, then normalizes and scores the spec checks. */
export async function runSelfTest(): Promise<string[]> {
  const project = newProject();
  const loop = await renderLoop(project, { snap: false, crossfadeMs: 0 });
  const lengthOk = loop.samples === loop.nominalSamples;
  const norm = normalizeToTarget(loop.left, loop.right, loop.sampleRate, {
    targetLufs: project.master.targetLufs,
    ceilingDbtp: project.master.ceilingDbtp,
  });
  const seam = seamReport(norm.left, norm.right, loop.sampleRate);
  const lufsOk = Math.abs(norm.report.after.lufs - project.master.targetLufs) <= 0.5;
  const peakOk = norm.report.after.truePeak <= -1;
  return [
    line(lengthOk, 'length', `${loop.samples} samples (expected ${loop.nominalSamples})`),
    line(lufsOk, 'LUFS', `${norm.report.after.lufs.toFixed(2)} (target ${project.master.targetLufs})`),
    line(peakOk, 'true peak', `${norm.report.after.truePeak.toFixed(2)} dBTP`),
    line(seam.pass, 'seam', `join ${seam.joinStep.toFixed(5)}, p99.9 ${seam.p999Step.toFixed(5)}, rmsΔ ${seam.rmsDiffDb.toFixed(2)} dB`),
  ];
}
