import { MULTIKILL_DEFAULT_COUNT } from './targets';

export const CUE_TYPES = [
  'calm',
  'tension',
  'build',
  'hype',
  'multikill',
  'kill',
  'death',
  'sad',
  'funny',
  'fail',
  'victory',
  'clutch',
  'jumpscare',
  'reveal',
  'transition',
  'outro',
  'talking',
  'sfx',
] as const;

export type CueType = (typeof CUE_TYPES)[number];

export const SFX_NAMES = [
  'whoosh_up',
  'whoosh_down',
  'riser',
  'impact',
  'sub_drop',
  'stinger_a',
  'stinger_b',
  'stinger_c',
  'kill_sting',
  'combo_tick',
  'death_fall',
  'record_scratch',
  'sad_trombone',
  'boing',
  'blip',
  'funny_blips',
  'victory_fanfare',
  'jumpscare_hit',
  'reverse_cymbal',
  'tick',
  'glitch',
  'shimmer',
] as const;

export type SfxName = (typeof SFX_NAMES)[number];

export interface CueVideo {
  lengthSeconds: number;
  fps?: number;
  bpm?: number;
  name?: string;
  style?: string;
}

export interface Cue {
  t: number;
  duration?: number;
  type: CueType;
  intensity: number;
  label?: string;
  count?: number;
  note?: string;
  sfx?: SfxName;
}

export interface CueSheet {
  version: 1;
  video: CueVideo;
  options?: Record<string, unknown>;
  cues: Cue[];
}

export interface CueWarning {
  message: string;
  line?: number;
}

export interface ValidateResult {
  ok: boolean;
  sheet: CueSheet | null;
  warnings: string[];
}

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  ok: boolean;
  sheet: CueSheet | null;
  warnings: string[];
  errors: ParseError[];
}

export const INTENSITY_WORDS: Record<string, number> = {
  low: 0.33,
  med: 0.6,
  medium: 0.6,
  high: 0.9,
};

const ALIASES: Record<string, CueType> = {
  surprise: 'jumpscare',
  kills: 'multikill',
  lose: 'fail',
  win: 'victory',
};

/** Longest phrases first so "multikill" wins over "kill". */
export const CUE_KEYWORDS: Array<{ phrase: string; type: CueType }> = [
  { phrase: 'enemy spotted', type: 'tension' },
  { phrase: 'jumpscare', type: 'jumpscare' },
  { phrase: 'multikill', type: 'multikill' },
  { phrase: 'surprise', type: 'jumpscare' },
  { phrase: 'victory', type: 'victory' },
  { phrase: 'transition', type: 'transition' },
  { phrase: 'talking', type: 'talking' },
  { phrase: 'tension', type: 'tension' },
  { phrase: 'clutch', type: 'clutch' },
  { phrase: 'reveal', type: 'reveal' },
  { phrase: 'kills', type: 'multikill' },
  { phrase: 'death', type: 'death' },
  { phrase: 'funny', type: 'funny' },
  { phrase: 'build', type: 'build' },
  { phrase: 'outro', type: 'outro' },
  { phrase: 'calm', type: 'calm' },
  { phrase: 'hype', type: 'hype' },
  { phrase: 'kill', type: 'kill' },
  { phrase: 'dies', type: 'death' },
  { phrase: 'died', type: 'death' },
  { phrase: 'lose', type: 'fail' },
  { phrase: 'fail', type: 'fail' },
  { phrase: 'win', type: 'victory' },
  { phrase: 'sad', type: 'sad' },
  { phrase: 'sfx', type: 'sfx' },
];

function isCueType(value: string): value is CueType {
  return (CUE_TYPES as readonly string[]).includes(value);
}

function isSfxName(value: string): value is SfxName {
  return (SFX_NAMES as readonly string[]).includes(value);
}

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function cleanLabel(text: string): string {
  return text.replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseClock(text: string): number | null {
  const parts = text.trim().split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  return nums[0] * 60 + nums[1];
}

function sfxForms(): Array<{ form: string; name: SfxName }> {
  const forms: Array<{ form: string; name: SfxName }> = [];
  for (const name of SFX_NAMES) {
    const spaced = name.replace(/_/g, ' ');
    for (const form of [name, spaced, name.replace(/_/g, '-'), name.replace(/_/g, '')]) {
      forms.push({ form: form.toLowerCase(), name });
    }
  }
  forms.sort((a, b) => b.form.length - a.form.length);
  return forms;
}

function findSfxMention(text: string): { name?: SfxName; rest: string } {
  const lower = text.toLowerCase();
  for (const { form, name } of sfxForms()) {
    const at = lower.indexOf(form);
    if (at < 0) continue;
    const end = at + form.length;
    const leftOk = at === 0 || !/[a-z0-9]/i.test(lower[at - 1] ?? '');
    const rightOk = end >= lower.length || !/[a-z0-9]/i.test(lower[end] ?? '');
    if (!leftOk || !rightOk) continue;
    return { name, rest: `${text.slice(0, at)} ${text.slice(end)}` };
  }
  return { rest: text };
}

function sfxNameIn(text: string): SfxName | undefined {
  return findSfxMention(text).name;
}

function findKeywordTypes(text: string): { types: CueType[]; leftover: string } {
  const lower = text.toLowerCase();
  const used = new Array<boolean>(lower.length).fill(false);
  const found: Array<{ index: number; type: CueType }> = [];
  const phrases = [...CUE_KEYWORDS].sort((a, b) => b.phrase.length - a.phrase.length);
  for (const { phrase, type } of phrases) {
    let from = 0;
    while (from < lower.length) {
      const at = lower.indexOf(phrase, from);
      if (at < 0) break;
      const end = at + phrase.length;
      const leftOk = at === 0 || !/[a-z0-9]/i.test(lower[at - 1] ?? '');
      const rightOk = end >= lower.length || !/[a-z0-9]/i.test(lower[end] ?? '');
      const free = used.slice(at, end).every((flag) => !flag);
      if (leftOk && rightOk && free) {
        for (let i = at; i < end; i++) used[i] = true;
        found.push({ index: at, type });
      }
      from = at + phrase.length;
    }
  }
  found.sort((a, b) => a.index - b.index);
  const types: CueType[] = [];
  for (const hit of found) {
    if (!types.includes(hit.type)) types.push(hit.type);
  }
  let leftover = '';
  for (let i = 0; i < text.length; i++) leftover += used[i] ? ' ' : text[i];
  return { types, leftover };
}

function takeIntensityAndCount(text: string, types: CueType[]): { intensity?: number; count?: number; leftover: string } {
  let intensity: number | undefined;
  let count: number | undefined;
  let leftover = text;
  leftover = leftover.replace(/\bx\s*(\d+)\b/gi, (_, n: string) => {
    count = Number(n);
    return ' ';
  });
  leftover = leftover.replace(/\b(\d+(?:\.\d+)?)\s*%/g, (_, n: string) => {
    intensity = Number(n) / 100;
    return ' ';
  });
  leftover = leftover.replace(/\b(low|medium|med|high)\b/gi, (word) => {
    intensity = INTENSITY_WORDS[word.toLowerCase()];
    return ' ';
  });
  leftover = leftover.replace(/\b\d+(?:\.\d+)?\b/g, (raw) => {
    const n = Number(raw);
    if (types.includes('multikill') && count === undefined && Number.isInteger(n) && n >= 2) {
      count = n;
      return ' ';
    }
    if (intensity === undefined && n >= 0 && n <= 1) {
      intensity = n;
      return ' ';
    }
    return raw;
  });
  return { intensity, count, leftover };
}

function emptySheet(video: CueVideo): CueSheet {
  return { version: 1, video, cues: [] };
}

export function parseCueText(text: string): ParseResult {
  const warnings: string[] = [];
  const errors: ParseError[] = [];
  const video: CueVideo = { lengthSeconds: 0 };
  const videoOptions: Record<string, unknown> = {};
  const cues: Cue[] = [];
  const lines = String(text ?? '').split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const lineNo = index + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    const header = line.match(/^(length|bpm|fps|name|seed|bitdepth|stems|pictures|sfxfiles|style|layers)\s+(.+)$/i);
    if (header) {
      const key = header[1].toLowerCase();
      const value = header[2].trim();
      if (key === 'name') video.name = value;
      else if (key === 'style') {
        video.style = value;
        videoOptions.style = value;
      }
      else if (key === 'layers') {
        videoOptions.layers = value;
      }
      else if (key === 'seed' || key === 'bitdepth' || key === 'stems' || key === 'pictures' || key === 'sfxfiles') {
        videoOptions[key === 'bitdepth' ? 'bitDepth' : key === 'sfxfiles' ? 'sfxFiles' : key] = value;
      }
      else if (key === 'length') {
        const seconds = parseClock(value) ?? num(value);
        if (seconds === null || seconds <= 0) errors.push({ line: lineNo, message: `Bad length "${value}"` });
        else video.lengthSeconds = seconds;
      } else if (key === 'bpm') {
        const bpm = num(value);
        if (bpm === null || bpm <= 0) errors.push({ line: lineNo, message: `Bad bpm "${value}"` });
        else video.bpm = bpm;
      } else if (key === 'fps') {
        const fps = num(value);
        if (fps === null || fps <= 0) errors.push({ line: lineNo, message: `Bad fps "${value}"` });
        else video.fps = fps;
      }
      return;
    }
    const timed = line.match(/^(\d+:\d+(?::\d+)?(?:\.\d+)?)(?:\s*-\s*(\d+:\d+(?::\d+)?(?:\.\d+)?))?\s+(.+)$/);
    if (!timed) {
      errors.push({ line: lineNo, message: `Could not read a time and an event: ${line}` });
      return;
    }
    const start = parseClock(timed[1]);
    const end = timed[2] ? parseClock(timed[2]) : null;
    if (start === null || (timed[2] && end === null)) {
      errors.push({ line: lineNo, message: `Bad timestamp on: ${line}` });
      return;
    }
    if (end !== null && end < start) {
      errors.push({ line: lineNo, message: `Range ends before it starts: ${line}` });
      return;
    }
    const named = findSfxMention(timed[3]);
    const found = findKeywordTypes(named.rest);
    if (found.types.length === 0 && named.name) found.types.push('sfx');
    if (found.types.length === 0) {
      errors.push({ line: lineNo, message: `No known event on: ${line}. Allowed SFX: ${SFX_NAMES.join(', ')}` });
      return;
    }
    const taken = takeIntensityAndCount(found.leftover, found.types);
    const label = cleanLabel(taken.leftover);
    const duration = end === null ? undefined : end - start;
    for (const type of found.types) {
      const cue: Cue = {
        t: start,
        type,
        intensity: taken.intensity ?? 0.6,
      };
      if (duration !== undefined) cue.duration = duration;
      if (type === 'multikill') cue.count = taken.count ?? MULTIKILL_DEFAULT_COUNT;
      if (type === 'sfx') {
        const fromLine = named.name ?? sfxNameIn(taken.leftover);
        if (!fromLine) {
          errors.push({ line: lineNo, message: `Unknown SFX. Allowed: ${SFX_NAMES.join(', ')}` });
          continue;
        }
        cue.sfx = fromLine;
      } else if (named.name && found.types.length === 0) {
        cue.sfx = named.name;
      }
      if (label) {
        cue.label = label;
        cue.note = label;
      }
      cues.push(cue);
    }
  });

  if (!(video.lengthSeconds > 0)) {
    let end = 0;
    for (const cue of cues) end = Math.max(end, cue.t + (cue.duration ?? 0), cue.t);
    if (end > 0) {
      video.lengthSeconds = end;
      warnings.push('length inferred from the last cue');
    }
  }
  if (errors.length > 0 || cues.length === 0) {
    return { ok: false, sheet: cues.length ? { version: 1, video, cues } : null, warnings, errors: errors.length ? errors : [{ line: 0, message: 'No cues' }] };
  }
  const validated = validateCueSheet({ version: 1, video, cues });
  if (validated.sheet && Object.keys(videoOptions).length) validated.sheet.options = videoOptions;
  return {
    ok: validated.ok && errors.length === 0,
    sheet: validated.sheet,
    warnings: [...warnings, ...validated.warnings],
    errors,
  };
}

export function validateCueSheet(input: unknown): ValidateResult {
  const warnings: string[] = [];
  if (typeof input !== 'object' || input === null) {
    return { ok: false, sheet: null, warnings: ['Cue sheet must be an object'] };
  }
  const raw = input as Record<string, unknown>;
  const videoRaw = raw.video;
  if (typeof videoRaw !== 'object' || videoRaw === null) {
    return { ok: false, sheet: null, warnings: ['video.lengthSeconds is required'] };
  }
  const videoIn = videoRaw as Record<string, unknown>;
  const lengthSeconds = num(videoIn.lengthSeconds);
  if (lengthSeconds === null || lengthSeconds <= 0) {
    return { ok: false, sheet: null, warnings: ['video.lengthSeconds must be a positive number'] };
  }
  const video: CueVideo = { lengthSeconds };
  const fps = num(videoIn.fps);
  const bpm = num(videoIn.bpm);
  if (fps !== null) video.fps = fps;
  if (bpm !== null) video.bpm = bpm;
  if (typeof videoIn.name === 'string') video.name = videoIn.name;
  if (typeof videoIn.style === 'string' && videoIn.style.trim()) video.style = videoIn.style.trim();
  if (!Array.isArray(raw.cues)) return { ok: false, sheet: null, warnings: ['cues must be an array'] };

  const cues: Cue[] = [];
  let ok = true;
  raw.cues.forEach((item, index) => {
    if (typeof item !== 'object' || item === null) {
      ok = false;
      warnings.push(`cue ${index} is not an object`);
      return;
    }
    const src = item as Record<string, unknown>;
    let typeName = String(src.type ?? '').toLowerCase();
    if (ALIASES[typeName]) {
      warnings.push(`cue ${index} alias ${typeName} read as ${ALIASES[typeName]}`);
      typeName = ALIASES[typeName];
    }
    if (!isCueType(typeName)) {
      ok = false;
      warnings.push(`cue ${index} has unknown type "${src.type}". Allowed: ${CUE_TYPES.join(', ')}`);
      return;
    }
    const t = num(src.t);
    if (t === null) {
      ok = false;
      warnings.push(`cue ${index} needs a numeric t`);
      return;
    }
    if (t < 0 || t > lengthSeconds) {
      ok = false;
      warnings.push(`cue ${index} t ${t} is outside 0..${lengthSeconds}`);
      return;
    }
    let intensity = src.intensity === undefined ? 0.6 : num(src.intensity);
    if (intensity === null) {
      ok = false;
      warnings.push(`cue ${index} intensity is not a number`);
      return;
    }
    if (intensity < 0 || intensity > 1) {
      warnings.push(`cue ${index} intensity clamped to 0..1`);
      intensity = Math.max(0, Math.min(1, intensity));
    }
    const cue: Cue = { t, type: typeName, intensity };
    if (src.duration !== undefined) {
      const duration = num(src.duration);
      if (duration === null || duration < 0) {
        ok = false;
        warnings.push(`cue ${index} duration must be >= 0`);
        return;
      }
      cue.duration = duration;
    }
    if (typeof src.label === 'string' && src.label.trim()) cue.label = src.label.trim();
    if (typeof src.note === 'string' && src.note.trim()) cue.note = src.note.trim();
    if (typeName === 'sfx') {
      const name = String(src.sfx ?? '');
      if (!isSfxName(name)) {
        ok = false;
        warnings.push(`cue ${index} sfx must be one of: ${SFX_NAMES.join(', ')}`);
        return;
      }
      cue.sfx = name;
    }
    if (typeName === 'multikill') {
      const count = src.count === undefined ? MULTIKILL_DEFAULT_COUNT : num(src.count);
      if (count === null || count < 2) {
        warnings.push(`cue ${index} multikill count set to ${Math.max(2, MULTIKILL_DEFAULT_COUNT)}`);
        cue.count = count !== null && count >= 2 ? Math.round(count) : Math.max(2, MULTIKILL_DEFAULT_COUNT);
      } else cue.count = Math.round(count);
    }
    cues.push(cue);
  });

  let ordered = true;
  for (let i = 1; i < cues.length; i++) {
    if (cues[i].t < cues[i - 1].t) ordered = false;
  }
  if (!ordered) {
    const tagged = cues.map((cue, index) => ({ cue, index }));
    tagged.sort((a, b) => a.cue.t - b.cue.t || a.index - b.index);
    cues.splice(0, cues.length, ...tagged.map((item) => item.cue));
    warnings.push('cues were not sorted; sorted stably by time');
  }

  for (const cue of cues) {
    if (cue.duration === undefined) continue;
    const end = cue.t + cue.duration;
    if (end > lengthSeconds + 1e-9) {
      cue.duration = Math.max(0, lengthSeconds - cue.t);
      warnings.push(`duration clipped to the video end at t ${cue.t}`);
    }
  }

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (cue.type !== 'talking' || (cue.duration !== undefined && cue.duration > 0)) continue;
    let end = lengthSeconds;
    for (let j = 0; j < cues.length; j++) {
      const other = cues[j];
      if (other.type === 'talking') continue;
      if (other.t > cue.t + 1e-9) {
        end = Math.min(end, other.t);
      }
    }
    cue.duration = Math.max(0, end - cue.t);
    warnings.push(`talking cue at ${cue.t} had no duration; it runs to ${end}`);
  }

  const sheet: CueSheet = {
    version: 1,
    video,
    cues,
  };
  if (raw.options && typeof raw.options === 'object') sheet.options = raw.options as Record<string, unknown>;
  if (!ok) return { ok: false, sheet, warnings };
  return { ok: true, sheet, warnings };
}

export function sheetFromUnknown(value: unknown): ValidateResult {
  return validateCueSheet(value);
}
