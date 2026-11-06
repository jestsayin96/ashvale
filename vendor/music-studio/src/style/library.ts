import type { Project } from '../model/types';
import { APP_VERSION } from '../version';
import { styledBaseName } from './naming';

export const LIBRARY_COLUMNS = [
  'File', 'Type', 'Class', 'Title', 'Artist', 'Mood', 'Tempo', 'Length', 'Clean loop?',
  'LUFS', 'dBTP', 'Peak flag', 'Source URL', 'License', 'Credit req.', 'Content ID risk', 'Best use',
] as const;

const MOOD_WORD = { hype: 'hype', playful: 'fun', lowkey: 'calm' } as const;

function lengthLabel(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remain = rounded % 60;
  return `${minutes}:${String(remain).padStart(2, '0')}`;
}

export interface LibraryNumbers {
  lufs: number;
  truePeak: number;
  seamStatus?: string;
  seamNumbers?: string;
}

export function libraryRow(project: Project, measured: LibraryNumbers, base = styledBaseName(project, false)): string {
  const seconds = project.exact?.seconds ?? project.origin?.loopSeconds ?? 0;
  const moodKey = project.style?.mood ?? 'hype';
  const mood = MOOD_WORD[moodKey as keyof typeof MOOD_WORD] ?? moodKey;
  const role = project.origin?.role ?? 'music';
  const clean = project.exact
    ? `no (exact length, ${project.exact.ending})`
    : `yes (seam ok, ${measured.seamNumbers ?? measured.seamStatus ?? 'n/a'}; not listened)`;
  const peakFlag = measured.truePeak > 0 ? 'TP>0' : '-';
  const cells = [
    `${base}.wav`,
    'wav',
    role === 'bed' ? 'bed' : 'track',
    project.style?.titleWords || project.name,
    'Music Studio (original)',
    mood,
    `${Math.round(project.bpm)} (exact)`,
    lengthLabel(seconds),
    clean,
    measured.lufs.toFixed(1),
    measured.truePeak.toFixed(1),
    peakFlag,
    `local: Music Studio v${APP_VERSION} seed ${project.seed}`,
    'Original (synthesized in Music Studio, no samples)',
    'N (none needed)',
    'LOW: fully synthesized original, no samples',
    `${project.style?.id ?? 'music'} ${role}, ${Math.round(project.bpm)} bpm, ${measured.lufs.toFixed(1)} LUFS, ${measured.truePeak.toFixed(1)} dBTP`,
  ];
  return `| ${cells.join(' | ')} |`;
}

export function creditsRow(project: Project): string {
  return `| ${project.style?.titleWords || project.name} | no credit needed (original) |`;
}

export function youtubeLine(project: Project, measured: LibraryNumbers): string {
  return `${project.style?.titleWords || project.name} — original synthesized audio, ${Math.round(project.bpm)} bpm, ${measured.lufs.toFixed(1)} LUFS, seed ${project.seed}.`;
}

export function oneLiner(project: Project, measured: LibraryNumbers): string {
  const text = `${project.style?.titleWords || project.name}: ${Math.round(project.bpm)} bpm, ${measured.lufs.toFixed(1)} LUFS, seed ${project.seed}.`;
  return text.length <= 100 ? text : text.slice(0, 100);
}

export function libraryMarkdown(project: Project, measured: LibraryNumbers, base?: string): string {
  const header = `| ${LIBRARY_COLUMNS.join(' | ')} |`;
  const rule = `| ${LIBRARY_COLUMNS.map(() => '---').join(' | ')} |`;
  return [
    header,
    rule,
    libraryRow(project, measured, base),
    '',
    creditsRow(project),
    '',
    youtubeLine(project, measured),
    '',
    oneLiner(project, measured),
    '',
    `appVersion: ${APP_VERSION}`,
  ].join('\n');
}
