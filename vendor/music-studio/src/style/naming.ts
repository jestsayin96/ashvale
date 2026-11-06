import type { Project } from '../model/types';
import { safeName } from '../io/download';

const SCALE_TOKEN: Record<string, string> = {
  minor: 'min',
  major: 'maj',
  dorian: 'dor',
  phrygian: 'phr',
  mixolydian: 'mix',
  lydian: 'lyd',
  harmonicMinor: 'hmin',
  minorPent: 'minpent',
  majorPent: 'majpent',
};

const NAMES = ['C', 'Cs', 'D', 'Eb', 'E', 'F', 'Fs', 'G', 'Ab', 'A', 'Bb', 'B'];

export function keyToken(root: number, scale: string): string {
  const name = NAMES[((root % 12) + 12) % 12];
  return `${name}${SCALE_TOKEN[scale] ?? scale}`;
}

export function stamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

export function styledBaseName(project: Project, uniqueSuffix = true, date = new Date()): string {
  const style = project.style?.id ?? 'music';
  const mood = project.style?.mood ?? project.mood ?? 'custom';
  const role = project.origin?.role ?? 'music';
  const seconds = Math.round(project.exact?.seconds ?? project.origin?.loopSeconds ?? 0);
  const base = `${style}_${mood}_${role}_${Math.round(project.bpm)}bpm_${keyToken(project.key.root, project.key.scale)}_s${project.seed}_${seconds}s`;
  const stamped = uniqueSuffix ? `${base}_${stamp(date)}` : base;
  return safeName(stamped);
}

export function legacyBaseName(project: Project): string {
  return `${safeName(project.name)}_${Math.round(project.bpm)}bpm_${project.bars}bars`;
}
