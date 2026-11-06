import type { StyleSection, VideoRole } from '../model/types';
import type { StyleDef } from './styles';

function fitCounts(weights: number[], total: number): number[] {
  if (total <= 0) return weights.map(() => 0);
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((weight) => Math.max(1, Math.round((total * weight) / sum)));
  let diff = raw.reduce((a, b) => a + b, 0) - total;
  let guard = 0;
  while (diff !== 0 && guard < 10000) {
    const index = guard % raw.length;
    if (diff > 0 && raw[index] > (raw.length > total ? 0 : 1)) {
      raw[index] -= 1;
      diff -= 1;
    } else if (diff < 0) {
      raw[index] += 1;
      diff += 1;
    }
    guard += 1;
  }
  if (raw.reduce((a, b) => a + b, 0) !== total) {
    raw[0] += total - raw.reduce((a, b) => a + b, 0);
  }
  return raw;
}

/** Section plan whose bar counts add up to `totalBars`. Loop mode drops intro and outro hits. */
export function planStructure(style: StyleDef, role: VideoRole, totalBars: number, mode: 'loop' | 'exact'): StyleSection[] {
  let parts = style.structure.map((section) => ({ ...section }));
  if (mode === 'loop') {
    parts = parts.filter((section) => section.name !== 'intro' && section.name !== 'outro');
    if (parts.length === 0) parts = [{ name: 'A', bars: 4 }];
    parts = [...parts, { name: 'turnaround', bars: 1 }];
  }
  if (role === 'intro') parts = [{ name: 'intro', bars: Math.max(1, totalBars) }];
  if (role === 'outro') parts = [{ name: 'outro', bars: Math.max(1, totalBars) }];
  const counts = fitCounts(parts.map((part) => part.bars), Math.max(1, totalBars));
  return parts.map((part, index) => ({ name: part.name, bars: counts[index] ?? 0 })).filter((part) => part.bars > 0);
}

export function sectionAt(structure: StyleSection[], bar: number): string {
  let cursor = 0;
  for (const section of structure) {
    cursor += section.bars;
    if (bar < cursor) return section.name;
  }
  return structure[structure.length - 1]?.name ?? 'A';
}
