import type { MixOptions } from './mixdown';
import { parseCueText, validateCueSheet, type CueSheet, type ParseError } from './cues';

/** Options accepted on a score request. Kept here so Node CLI can parse without loading the browser API. */
export interface ScoreRequestOptions {
  seed?: number;
  bitDepth?: 16 | 24;
  stems?: boolean;
  pictures?: boolean;
  sfxFiles?: boolean;
  download?: boolean;
  tailSeconds?: number;
  endFadeMs?: number;
  musicLufs?: number;
  targetLufs?: number;
  ceilingDbtp?: number;
  duckDb?: number;
  speechDipDb?: number;
  mix?: MixOptions;
}

const SCORE_OPTION_KEYS = new Set([
  'seed', 'bitDepth', 'stems', 'pictures', 'sfxFiles', 'download', 'tailSeconds', 'endFadeMs',
  'musicLufs', 'targetLufs', 'ceilingDbtp', 'duckDb', 'speechDipDb', 'mix',
]);

export function parseCues(input: unknown): { ok: boolean; sheet: CueSheet | null; warnings: string[]; errors: ParseError[] } {
  try {
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          return parseCues(JSON.parse(trimmed) as unknown);
        } catch {
          return parseCueText(input);
        }
      }
      return parseCueText(input);
    }
    if (input && typeof input === 'object') {
      const obj = input as Record<string, unknown>;
      if (obj.op === 'score' && obj.sheet && typeof obj.sheet === 'object') {
        const validated = validateCueSheet(obj.sheet);
        return { ok: validated.ok, sheet: validated.sheet, warnings: validated.warnings, errors: validated.ok ? [] : [{ line: 0, message: validated.warnings[0] ?? 'Invalid cue sheet' }] };
      }
      const validated = validateCueSheet(input);
      return { ok: validated.ok, sheet: validated.sheet, warnings: validated.warnings, errors: validated.ok ? [] : [{ line: 0, message: validated.warnings[0] ?? 'Invalid cue sheet' }] };
    }
    return { ok: false, sheet: null, warnings: [], errors: [{ line: 0, message: 'Cue sheet must be JSON, an object, or cue text' }] };
  } catch (err) {
    return { ok: false, sheet: null, warnings: [], errors: [{ line: 0, message: err instanceof Error ? err.message : 'Cue parse failed' }] };
  }
}

function readScoreOptions(source: unknown, warnings: string[]): Partial<ScoreRequestOptions> {
  if (!source || typeof source !== 'object') return {};
  const out: Partial<ScoreRequestOptions> = {};
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (key === 'backend' || key === 'onProgress') {
      warnings.push(`ignored option ${key}`);
      continue;
    }
    if (!SCORE_OPTION_KEYS.has(key)) {
      warnings.push(`unknown option ${key}`);
      continue;
    }
    if (key === 'bitDepth') {
      const n = Number(value);
      if (n !== 16 && n !== 24) warnings.push('bitDepth must be 16 or 24');
      else out.bitDepth = n;
    } else if (key === 'stems' || key === 'pictures' || key === 'sfxFiles' || key === 'download') {
      out[key] = value === true || value === 'on' || value === 'true';
    } else if (key === 'mix') {
      if (value && typeof value === 'object') out.mix = value as MixOptions;
      else warnings.push('mix must be an object');
    } else if (key === 'seed' || key === 'tailSeconds' || key === 'endFadeMs' || key === 'musicLufs' || key === 'targetLufs' || key === 'ceilingDbtp' || key === 'duckDb' || key === 'speechDipDb') {
      const n = Number(value);
      if (!Number.isFinite(n)) warnings.push(`${key} must be a number`);
      else (out as Record<string, number>)[key] = n;
    }
  }
  return out;
}

function tableCells(row: string): string[] {
  const parts = row.split('|').map((c) => c.trim());
  if (parts.length >= 2 && parts[0] === '' && parts[parts.length - 1] === '') return parts.slice(1, -1);
  return parts.filter(Boolean);
}

/**
 * Turn a markdown `## Cues` pipe table into the text cue grammar.
 * Example rows: `| 0:00 | calm | 0.4 |`
 */
export function markdownCuesTableToText(md: string): string | null {
  const section = md.match(/##\s*Cues\b[\s\S]*?(?=\n##\s|\n#\s|$)/i);
  if (!section) return null;
  const rows = section[0].split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('|'));
  if (rows.length < 2) return null;
  const headerCells = tableCells(rows[0]).map((c) => c.toLowerCase());
  const tIdx = headerCells.findIndex((c) => c === 't' || c === 'time');
  const typeIdx = headerCells.findIndex((c) => c === 'type' || c === 'cue');
  if (tIdx < 0 || typeIdx < 0) return null;
  const intensityIdx = headerCells.findIndex((c) => c === 'intensity' || c === 'level');
  const lines: string[] = [];
  for (const row of rows.slice(1)) {
    const vals = tableCells(row);
    if (vals.every((c) => /^:?-+:?$/.test(c))) continue;
    const t = vals[tIdx];
    const type = vals[typeIdx];
    if (!t || !type) continue;
    const intensity = intensityIdx >= 0 ? vals[intensityIdx] : undefined;
    lines.push(intensity ? `${t} ${type} ${intensity}` : `${t} ${type}`);
  }
  if (!lines.length) return null;
  const lengthMatch = md.match(/\blength\s+(\S+)/i);
  const seedMatch = md.match(/\bseed\s+(\d+)/i);
  const header: string[] = [];
  if (lengthMatch) header.push(`length ${lengthMatch[1]}`);
  else header.push('length 0:04');
  if (seedMatch) header.push(`seed ${seedMatch[1]}`);
  return `${header.join('\n')}\n${lines.join('\n')}`;
}

export function extractScoreRequest(textOrObject: unknown): {
  ok: boolean;
  input: CueSheet | null;
  options: Partial<ScoreRequestOptions>;
  warnings: string[];
  errors: ParseError[];
} {
  const warnings: string[] = [];
  let raw: unknown = textOrObject;
  if (typeof textOrObject === 'string') {
    const trimmed = textOrObject.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        raw = JSON.parse(trimmed) as unknown;
      } catch {
        raw = textOrObject;
      }
    } else if (/##\s*Cues\b/i.test(trimmed) && trimmed.includes('|')) {
      const converted = markdownCuesTableToText(trimmed);
      if (converted) {
        raw = converted;
        warnings.push('Converted markdown ## Cues table to cue text');
      }
    }
  }
  let sheetSource: unknown = raw;
  let opOptions: Partial<ScoreRequestOptions> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && (raw as { op?: unknown }).op === 'score') {
    const obj = raw as { sheet?: unknown; options?: unknown };
    sheetSource = obj.sheet ?? raw;
    opOptions = readScoreOptions(obj.options, warnings);
  }
  const parsed = parseCues(sheetSource);
  const sheetOptions = readScoreOptions(parsed.sheet?.options, warnings);
  return {
    ok: parsed.ok,
    input: parsed.sheet,
    options: { ...sheetOptions, ...opOptions },
    warnings: [...parsed.warnings, ...warnings],
    errors: parsed.errors,
  };
}
