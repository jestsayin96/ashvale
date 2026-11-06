import { buildEvents } from '../audio/events';
import type { Project, VideoRole } from '../model/types';
import { voiceSpec } from '../score/voiceSpecs';
import { yieldToUi } from '../score/yield';
import { newProject } from '../model/defaults';
import { composeProject, type ComposeBrief, type ComposeOutcome } from './compose';
import { moodCell, tempoFromCell, type StyleMood } from './matrix';
import { styleById, STYLES, type StyleDef } from './styles';
import { MATCH_BRIGHTNESS_DEFAULT, MATCH_TRIES_DEFAULT, MATCH_WEIGHT } from './targets';

export interface MatchProfile {
  bpm?: number | null;
  brightnessHz?: number;
  density?: number;
  mood?: StyleMood;
  key?: { root: number; scale: string } | string;
  lufs?: number;
  role?: VideoRole;
  seconds?: number;
  loop?: boolean;
  styleHint?: string;
}

export interface MatchChoice {
  style: string;
  mood: StyleMood;
  scale: string;
  bpm: number;
  brightnessHz: number;
  density: number;
  distance: number;
}

export interface MatchReport {
  origin: 'synthesized';
  samples: false;
  requested: MatchProfile;
  chosen: MatchChoice;
  predicted: { bpm: number; brightnessHz: number; density: number };
  distance: number;
  runnersUp: MatchChoice[];
}

const MOODS: StyleMood[] = ['hype', 'playful', 'lowkey'];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function profileBrightness(profile: MatchProfile): number {
  if (typeof profile.brightnessHz === 'number' && Number.isFinite(profile.brightnessHz)) return profile.brightnessHz;
  return MATCH_BRIGHTNESS_DEFAULT[profile.mood ?? 'hype'];
}

export function predictedBrightnessHz(style: StyleDef, mood: StyleMood, role: VideoRole = 'music'): number {
  const cell = moodCell(style.id, mood);
  const bright = Math.min(1, Math.max(0.05, style.brightness + cell.brightnessShift + (role === 'bed' ? -0.1 : 0)));
  return 400 + bright * 2800;
}

export function predictBrightnessHz(project: Project): number {
  const events = buildEvents(project, project.bars);
  let weight = 0;
  let sum = 0;
  for (const event of events) {
    if (event.kind === 'drum' || event.trackId === 'drums') continue;
    const spec = voiceSpec(event.voice, event.note, 0.5);
    const vel = Math.max(0, event.vel);
    sum += spec.cutoffHz * vel;
    weight += vel;
  }
  return weight > 0 ? sum / weight : predictedBrightnessHz(styleById(project.style?.id ?? '') ?? STYLES[0], project.style?.mood ?? 'hype');
}

function predictedDensity(style: StyleDef, mood: StyleMood, role: VideoRole): number {
  const cell = moodCell(style.id, mood);
  const mid = (style.density[0] + style.density[1]) / 2;
  return mid * cell.densityMul * (role === 'bed' ? 0.7 : 1);
}

export function profileDistance(requested: MatchProfile, choice: MatchChoice): number {
  const bpm = requested.bpm == null || !Number.isFinite(requested.bpm)
    ? 0
    : clamp01(Math.abs(choice.bpm - requested.bpm) / 40) * MATCH_WEIGHT.bpm;
  const brightness = clamp01(Math.abs(choice.brightnessHz - profileBrightness(requested)) / 1500) * MATCH_WEIGHT.brightness;
  const density = requested.density == null
    ? 0
    : clamp01(Math.abs(choice.density - requested.density) / 12) * MATCH_WEIGHT.density;
  const mood = requested.mood && requested.mood !== choice.mood ? MATCH_WEIGHT.mood : 0;
  const style = styleById(choice.style);
  const native = requested.mood && style && style.defaultMood !== requested.mood ? MATCH_WEIGHT.native : 0;
  const hint = requested.styleHint && requested.styleHint !== choice.style ? MATCH_WEIGHT.hint : 0;
  return bpm + brightness + density + mood + native + hint;
}

export function rankMatches(profile: MatchProfile, role: VideoRole = profile.role ?? 'music'): MatchChoice[] {
  const rows: MatchChoice[] = [];
  for (const style of STYLES) {
    for (const mood of MOODS) {
      const cell = moodCell(style.id, mood);
      const bpm = Math.round(tempoFromCell(style.tempo, cell) * 2) / 2;
      const choice: MatchChoice = {
        style: style.id,
        mood,
        scale: style.scales[0]?.id ?? 'minor',
        bpm,
        brightnessHz: predictedBrightnessHz(style, mood, role),
        density: predictedDensity(style, mood, role),
        distance: 0,
      };
      choice.distance = profileDistance(profile, choice);
      rows.push(choice);
    }
  }
  rows.sort((a, b) => a.distance - b.distance || a.style.localeCompare(b.style));
  return rows;
}

export function chooseMatch(profile: MatchProfile, role?: VideoRole): { choice: MatchChoice; runnersUp: MatchChoice[] } {
  const ranked = rankMatches(profile, role ?? profile.role ?? 'music');
  return { choice: ranked[0], runnersUp: ranked.slice(1, 4) };
}

export function profileFromLibraryRow(text: string): MatchProfile | { ok: false; error: string } {
  const cells = text.split('|').map((cell) => cell.trim()).filter((cell, index, all) => !(cell === '' && (index === 0 || index === all.length - 1)));
  if (cells.length < 17) return { ok: false, error: `Library row needs 17 columns, received ${cells.length}` };
  const moodWord = cells[5].toLowerCase();
  const mood: StyleMood | undefined = moodWord === 'hype' ? 'hype' : moodWord === 'fun' ? 'playful' : moodWord === 'calm' ? 'lowkey' : undefined;
  if (!mood) return { ok: false, error: `Unknown library mood: ${cells[5]}` };
  const tempo = cells[6].toLowerCase();
  let bpm: number | null = null;
  let styleHint: string | undefined;
  const tempoNumber = tempo.match(/(\d+(?:\.\d+)?)/);
  if (tempo.includes('n/a') || tempo.includes('ambient')) {
    bpm = null;
    styleHint = 'ambient_calm';
  } else if (tempoNumber) bpm = Number(tempoNumber[1]);
  const length = cells[7].match(/(\d+):(\d+)/);
  if (!length) return { ok: false, error: `Length is not m:ss: ${cells[7]}` };
  const seconds = Number(length[1]) * 60 + Number(length[2]);
  const lufs = Number(cells[9]);
  if (!Number.isFinite(lufs)) return { ok: false, error: `LUFS is not a number: ${cells[9]}` };
  const role: VideoRole = cells[2].toLowerCase().includes('bed') ? 'bed' : 'music';
  const loop = cells[8].toLowerCase().startsWith('yes');
  return { mood, bpm, seconds, lufs, role, loop, ...(styleHint ? { styleHint } : {}) };
}

export function composeMatched(project: Project, brief: ComposeBrief, profile: MatchProfile): ComposeOutcome & { matchReport: MatchReport } {
  const { choice, runnersUp } = chooseMatch(profile, brief.role);
  const nextBrief: ComposeBrief = {
    ...brief,
    style: choice.style,
    mood: profile.mood ?? choice.mood,
    seconds: profile.seconds ?? brief.seconds,
    lengthMode: profile.loop === false ? 'exact' : profile.loop === true ? 'loop' : brief.lengthMode,
    targetBpm: choice.bpm,
  };
  const outcome = composeProject(project, nextBrief);
  const predicted = {
    bpm: outcome.project.bpm,
    brightnessHz: predictBrightnessHz(outcome.project),
    density: choice.density,
  };
  const matchReport: MatchReport = {
    origin: 'synthesized',
    samples: false,
    requested: profile,
    chosen: choice,
    predicted,
    distance: choice.distance,
    runnersUp,
  };
  return { ...outcome, matchReport };
}

export interface MatchRunOptions {
  tries?: number;
  tolerance?: number;
  seedStart?: number;
  role?: VideoRole;
  seconds?: number;
  render?: (project: Project) => Promise<{ bpm?: number; brightnessHz?: number; density?: number; lufs?: number; speechShare?: number }>;
  onProgress?: (progress: { fraction: number; message: string }) => void;
}

export async function runMatch(profile: MatchProfile, options: MatchRunOptions = {}): Promise<
  | { ok: true; chosen: MatchChoice; candidates: Array<{ seed: number; style: string; mood: StyleMood; measured: Record<string, number>; distance: number }>; matchReport: MatchReport; project: Project }
  | { ok: false; error: string }
> {
  try {
    const tries = Math.max(1, Math.min(24, options.tries ?? MATCH_TRIES_DEFAULT));
    const seedStart = options.seedStart ?? 1;
    const role = options.role ?? profile.role ?? 'music';
    const seconds = options.seconds ?? profile.seconds ?? 30;
    const ranked = rankMatches(profile, role);
    let best: { project: Project; report: MatchReport; candidate: { seed: number; style: string; mood: StyleMood; measured: Record<string, number>; distance: number } } | null = null;
    const candidates = [];
    for (let i = 0; i < tries; i++) {
      options.onProgress?.({ fraction: i / tries, message: `match ${i + 1}/${tries}` });
      const pick = ranked[i % ranked.length];
      const seed = (seedStart + i) >>> 0;
      const brief: ComposeBrief = {
        role,
        mood: profile.mood ?? pick.mood,
        seconds,
        seed,
        style: pick.style,
        lengthMode: profile.loop === false ? 'exact' : 'loop',
        varietyGuard: 'reseed',
        targetBpm: profile.bpm ?? pick.bpm,
      };
      const outcome = composeProject(newProject(), brief);
      const measured = options.render ? await options.render(outcome.project) : {
        bpm: outcome.project.bpm,
        brightnessHz: predictBrightnessHz(outcome.project),
        density: pick.density,
      };
      const choice: MatchChoice = {
        ...pick,
        bpm: measured.bpm ?? outcome.project.bpm,
        brightnessHz: measured.brightnessHz ?? pick.brightnessHz,
        density: measured.density ?? pick.density,
        distance: 0,
      };
      choice.distance = profileDistance(profile, choice);
      const candidate = { seed, style: pick.style, mood: brief.mood, measured: measured as Record<string, number>, distance: choice.distance };
      candidates.push(candidate);
      if (!best || candidate.distance < best.candidate.distance) {
        const { choice: chosen, runnersUp } = chooseMatch(profile, role);
        best = {
          project: outcome.project,
          candidate,
          report: {
            origin: 'synthesized',
            samples: false,
            requested: profile,
            chosen,
            predicted: { bpm: outcome.project.bpm, brightnessHz: predictBrightnessHz(outcome.project), density: pick.density },
            distance: candidate.distance,
            runnersUp,
          },
        };
      }
      await yieldToUi();
    }
    if (!best) return { ok: false, error: 'Match produced no candidates' };
    return { ok: true, chosen: best.report.chosen, candidates, matchReport: best.report, project: best.project };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Match failed' };
  }
}
