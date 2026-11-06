import { renderLoop } from '../audio/render/loop';
import { encodeWav } from '../audio/render/wav';
import { normalizeToTarget, type NormalizeReport } from '../dsp/normalize';
import { seamReport, type SeamReport } from '../dsp/seam';
import { APP_VERSION } from '../version';
import type { Project } from '../model/types';
import { ORIGIN_NOTE } from '../model/video';
import { downloadBytes, safeName } from './download';

export interface ExportResult {
  wavName: string;
  reportName: string;
  report: Record<string, unknown>;
  norm: NormalizeReport;
  seam: SeamReport;
}

export async function renderAndNormalize(
  project: Project,
  options: { snap: boolean; crossfadeMs: number },
): Promise<{
  loop: Awaited<ReturnType<typeof renderLoop>>;
  norm: Awaited<ReturnType<typeof normalizeToTarget>>;
  seam: SeamReport;
}> {
  const loop = await renderLoop(project, {
    snap: options.snap,
    crossfadeMs: options.crossfadeMs,
  });
  const norm = normalizeToTarget(loop.left, loop.right, loop.sampleRate, {
    targetLufs: project.master.targetLufs,
    ceilingDbtp: project.master.ceilingDbtp,
  });
  const seam = seamReport(norm.left, norm.right, loop.sampleRate);
  return { loop, norm, seam };
}

export async function exportProject(
  project: Project,
  options: { snap: boolean; crossfadeMs: number; bitDepth: 16 | 24 },
): Promise<ExportResult> {
  const { loop, norm, seam } = await renderAndNormalize(project, options);
  const wav = encodeWav(norm.left, norm.right, loop.sampleRate, options.bitDepth, project.seed || 1);
  const base = safeName(project.name);
  const wavName = `${base}_${Math.round(project.bpm)}bpm_${project.bars}bars.wav`;
  const reportName = `${base}.report.json`;
  const report = buildReport(project, norm.report, seam, options.bitDepth, loop.sampleRate, norm.left.length);
  downloadBytes(wav, wavName, 'audio/wav');
  downloadBytes(JSON.stringify(report, null, 2), reportName, 'application/json');
  return { wavName, reportName, report, norm: norm.report, seam };
}

export function buildReport(
  project: Project,
  norm: NormalizeReport,
  seam: SeamReport,
  bitDepth: 16 | 24,
  sampleRate: number,
  samples: number,
): Record<string, unknown> {
  return {
    name: project.name,
    bpm: project.bpm,
    bars: project.bars,
    seed: project.seed,
    key: project.key,
    mood: project.mood,
    speechPocket: project.master.speechPocket,
    targetLufs: project.master.targetLufs,
    ceilingDbtp: project.master.ceilingDbtp,
    origin: project.origin ?? { synthesized: true, samples: false },
    note: ORIGIN_NOTE,
    measurements: { ...norm, seam, bitDepth, sampleRate, samples },
    appVersion: APP_VERSION,
    timestamp: new Date().toISOString(),
    ...(project.style ? { style: project.style } : {}),
    ...(project.exact ? { exact: project.exact } : {}),
  };
}
