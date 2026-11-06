import { buildEvents } from '../audio/events';
import { drumParams, emptyStep, synthParams } from '../model/defaults';
import { mulberry32 } from '../model/rng';
import { isInScale } from '../model/scales';
import type { Bars, DrumVoice, Pattern, Project, Scale, Step, StyleInfo, SynthVoice, Track, VideoRole, Wave } from '../model/types';
import { BAR_VALUES } from '../model/types';
import { composeForVideo, loopSeconds, type VideoBrief } from '../model/video';
import { SAME_VOICE_OVERLAP_MAX_SEC, VARIETY_MIN_DISTANCE, VARIETY_RESEED_LIMIT } from './targets';
import { bassById, drumById } from './patterns';
import { degreeMidi, planMelody } from './melody';
import { moodCell, tempoFromCell, type StyleMood } from './matrix';
import { progressionById } from './progressions';
import { planStructure, sectionAt } from './structure';
import { distance, fingerprintOf, nearest, reseedCandidate, type Fingerprint, type Similarity } from './fingerprint';
import { STYLE_IDS, styleById, tagSeed, type StyleDef } from './styles';
import { titleWords } from './titles';
import type { Rating } from '../io/ratings';
import { aggregatePreferences, ratingTempo, weightedStyle } from './preferences';
import { buildIncredibox, type LayerReport } from './incredibox';

export interface ComposeBrief extends VideoBrief {
  style?: string;
  lengthMode?: 'loop' | 'exact';
  varietyGuard?: 'warn' | 'reseed' | 'refuse' | 'off';
  /** When set, loop and exact fitting prefer this tempo inside the style range. */
  targetBpm?: number;
  useRatings?: boolean;
  ratings?: Rating[];
  densityBias?: number;
  brightnessBias?: number;
}

export interface ComposeOutcome {
  project: Project;
  fitWarning?: string;
  warnings: string[];
  similarity?: Similarity;
  refused?: string;
  usedRatings?: { hash: string; picked: boolean; biases: { density: number; brightness: number }; avoided?: boolean };
  layers?: LayerReport[];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function pickId(ids: string[], rng: () => number): string {
  return ids[Math.floor(rng() * ids.length) % ids.length];
}

function weightedPick<T extends { id: string | number | Scale; weight: number }>(rows: T[], rng: () => number): T {
  const total = rows.reduce((sum, row) => sum + row.weight, 0) || 1;
  let cursor = rng() * total;
  for (const row of rows) {
    cursor -= row.weight;
    if (cursor <= 0) return row;
  }
  return rows[rows.length - 1];
}

export function fitLoopStyle(seconds: number, style: StyleDef, mood: StyleMood, role: VideoRole, targetBpm?: number): { bars: Bars; bpm: number; seconds: number } {
  let want = seconds;
  if (role === 'intro') want = clamp(want, 2, 8);
  else if (role === 'outro') want = clamp(want, 4, 16);
  else want = clamp(want, 8, 120);
  const cell = moodCell(style.id, mood);
  const target = targetBpm ?? tempoFromCell(style.tempo, cell);
  let best = { bars: 4 as Bars, bpm: target, seconds: loopSeconds(4, target), score: Infinity };
  for (const bars of BAR_VALUES) {
    for (let bpm = style.tempo[0]; bpm <= style.tempo[1] + 1e-6; bpm += 0.5) {
      const rounded = Math.round(bpm * 2) / 2;
      const actual = loopSeconds(bars, rounded);
      const timeErr = Math.abs(actual - want) / want;
      const tempoErr = Math.abs(rounded - target) / (targetBpm === undefined ? 200 : 40);
      const score = timeErr * (targetBpm === undefined ? 10 : 3) + tempoErr;
      if (score < best.score) best = { bars, bpm: rounded, seconds: actual, score };
    }
  }
  return { bars: best.bars, bpm: best.bpm, seconds: best.seconds };
}

export function fitExact(seconds: number, style: StyleDef, mood: StyleMood, targetBpm?: number): { bars: number; bpm: number; ending: 'cadence' | 'trim-fade'; fadeMs: number } {
  const cell = moodCell(style.id, mood);
  const target = targetBpm ?? tempoFromCell(style.tempo, cell);
  let best: { bars: number; bpm: number; distance: number } | null = null;
  for (let bars = 1; bars <= 128; bars++) {
    const bpm = (bars * 240) / seconds;
    if (bpm < style.tempo[0] || bpm > style.tempo[1] || bpm < 60 || bpm > 200) continue;
    const distanceToTarget = Math.abs(bpm - target);
    if (!best || distanceToTarget < best.distance) best = { bars, bpm, distance: distanceToTarget };
  }
  if (best) return { bars: best.bars, bpm: best.bpm, ending: 'cadence', fadeMs: 400 };
  const bpm = clamp(target, Math.max(60, style.tempo[0]), Math.min(200, style.tempo[1]));
  const bars = clamp(Math.round((bpm * seconds) / 240), 1, 127);
  return { bars: bars + 1, bpm, ending: 'trim-fade', fadeMs: 400 };
}

function blank(length: number): Step[] {
  return Array.from({ length }, () => emptyStep());
}

function write(pattern: Pattern, index: number, vel: number, note?: number, notes?: number[]): void {
  if (index < 0 || index >= pattern.steps.length) return;
  const step = pattern.steps[index];
  step.on = true;
  step.vel = vel;
  step.len = 0.45;
  if (note !== undefined) step.note = note;
  if (notes && notes.length) step.notes = notes;
}

function chordTones(scale: Scale, degree: number, seventh: boolean): number[] {
  const span = seventh ? [0, 2, 4, 6] : [0, 2, 4];
  return span.map((offset) => degree + offset);
}

function drumTrack(id: DrumVoice, name: string, gainDb: number, pan: number, pattern: Pattern): Track {
  return {
    id, name, kind: 'drum', voice: id, params: drumParams(0, 0.18, 0.5),
    gainDb, pan, mute: false, solo: false, pattern,
  };
}

function synthTrack(id: string, voice: SynthVoice, wave: Wave, octave: number, gainDb: number, pan: number, cutoff: number, pattern: Pattern): Track {
  return {
    id, name: id, kind: 'synth', voice,
    params: synthParams({ wave, octave, filter: { type: 'lowpass', cutoff, q: 0.8, envAmount: 0.3 }, adsr: { a: 0.005, d: 0.12, s: 0.4, r: 0.08 } }),
    gainDb, pan, mute: false, solo: false, pattern,
  };
}

function layerOn(name: string, slot: 'drum' | 'bass' | 'harmony' | 'lead'): boolean {
  if (name === 'break') return slot === 'harmony' || slot === 'lead';
  if (name === 'intro' || name === 'swell') return slot !== 'lead';
  if (name === 'outro') return slot !== 'drum';
  return true;
}

export function measuredDensity(project: Project): number {
  const bars = project.exact?.bars ?? project.bars;
  const seconds = project.exact?.seconds ?? loopSeconds(project.bars, project.bpm);
  return buildEvents(project, bars).length / Math.max(0.001, seconds);
}

export function overlapOk(project: Project): boolean {
  const events = buildEvents(project, project.exact?.bars ?? project.bars);
  const groups = new Map<string, Array<{ time: number; duration: number }>>();
  for (const event of events) {
    const key = `${event.voice}|${event.time.toFixed(5)}`;
    const list = groups.get(event.voice) ?? [];
    if (!list.some((row) => Math.abs(row.time - event.time) < 1e-4)) list.push({ time: event.time, duration: event.duration });
    groups.set(event.voice, list);
    void key;
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.time - b.time);
    for (let i = 1; i < list.length; i++) {
      const overlap = list[i - 1].time + list[i - 1].duration - list[i].time;
      if (overlap > SAME_VOICE_OVERLAP_MAX_SEC) return false;
    }
  }
  return true;
}

function buildStyled(project: Project, brief: ComposeBrief, seed: number): { project: Project; fitWarning?: string; warnings: string[]; layers?: LayerReport[] } {
  const style = styleById(brief.style ?? '');
  if (!style) throw new Error(`Unknown style: ${brief.style}. Styles: ${STYLE_IDS.join(', ')}`);
  if (style.id === 'incredibox') {
    const made = buildIncredibox(project, { ...brief, seed });
    return { project: made.project, fitWarning: made.fitWarning, warnings: made.warnings, layers: made.layers };
  }
  const mood = brief.mood;
  const cell = moodCell(style.id, mood);
  const mode = brief.lengthMode ?? (brief.role === 'intro' || brief.role === 'outro' ? 'exact' : 'loop');
  const warnings = cell.warning ? [cell.warning] : [];
  const scalePool = style.scales.filter((row) => {
    const dark = row.id === 'minor' || row.id === 'dorian' || row.id === 'phrygian' || row.id === 'harmonicMinor' || row.id === 'minorPent';
    const bright = row.id === 'major' || row.id === 'mixolydian' || row.id === 'lydian' || row.id === 'majorPent';
    if (mood === 'hype' && style.scales.some((item) => item.id === 'minor' || item.id === 'dorian' || item.id === 'harmonicMinor' || item.id === 'minorPent')) return dark;
    if (mood === 'playful' && style.scales.some((item) => bright && item.id === row.id || item.id === 'major' || item.id === 'mixolydian' || item.id === 'lydian' || item.id === 'majorPent')) return bright;
    return true;
  });
  const scale = weightedPick(scalePool.length ? scalePool : style.scales, mulberry32(tagSeed(seed, `scale:${style.id}`))).id as Scale;
  const root = Number(weightedPick(style.keyRoots, mulberry32(tagSeed(seed, `key:${style.id}`))).id);
  const progression = progressionById(pickId(style.progressionIds, mulberry32(tagSeed(seed, `progression:${style.id}`))));
  const drumRng = mulberry32(tagSeed(seed, `drums:${style.id}`));
  const bassRng = mulberry32(tagSeed(seed, `bass:${style.id}`));
  const drumId = `${pickId(style.drumIds.kick, drumRng)}+${pickId(style.drumIds.snare, drumRng)}+${pickId(style.drumIds.hat, drumRng)}+${pickId(style.drumIds.perc, drumRng)}`;
  const bassId = pickId(style.bassIds, bassRng);
  const fitted = mode === 'exact' ? null : fitLoopStyle(brief.seconds, style, mood, brief.role, brief.targetBpm);
  const exact = mode === 'exact' ? fitExact(brief.role === 'intro' ? clamp(brief.seconds, 2, 8) : brief.role === 'outro' ? clamp(brief.seconds, 4, 16) : brief.seconds, style, mood, brief.targetBpm) : null;
  const totalBars = exact?.bars ?? fitted?.bars ?? 4;
  const bpm = exact?.bpm ?? fitted?.bpm ?? style.tempo[0];
  const structure = planStructure(style, brief.role, totalBars, mode);
  const patternLength = Math.max(16, Math.min(2048, totalBars * 16));
  const melody = planMelody(style.id, seed, totalBars, root, scale, style.melody.register, style.melody.maxLeap);
  const kick = drumById(drumId.split('+')[0]);
  const snare = drumById(drumId.split('+')[1]);
  const hat = drumById(drumId.split('+')[2]);
  const perc = drumById(drumId.split('+')[3]);
  const bass = bassById(bassId);
  const densityMul = cell.densityMul * (brief.role === 'bed' ? 0.7 : 1) * (1 + 0.25 * (brief.densityBias ?? 0));
  const brightness = clamp(style.brightness + cell.brightnessShift + (brief.role === 'bed' ? -0.1 : 0) + 0.1 * (brief.brightnessBias ?? 0), 0.05, 1);
  const swingRng = mulberry32(tagSeed(seed, `swing:${style.id}`));
  const swing = style.swing[0] + swingRng() * (style.swing[1] - style.swing[0]);

  const kickP = { length: patternLength, steps: blank(patternLength) };
  const snareP = { length: patternLength, steps: blank(patternLength) };
  const hatP = { length: patternLength, steps: blank(patternLength) };
  const bassP = { length: patternLength, steps: blank(patternLength) };
  const leadP = { length: patternLength, steps: blank(patternLength) };
  const harmP = { length: patternLength, steps: blank(patternLength) };

  for (let bar = 0; bar < totalBars; bar++) {
    const name = sectionAt(structure, bar);
    const chord = progression.degrees[Math.floor(bar / progression.barsPerChord) % progression.degrees.length];
    const tones = chordTones(scale, chord, progression.quality === '7th');
    for (let step = 0; step < 16; step++) {
      const index = bar * 16 + step;
      if (index >= patternLength) break;
      if (style.drums && layerOn(name, 'drum') && densityMul > 0.2) {
        const gate = densityMul >= 0.9 || step % 2 === 0;
        if (gate && kick.steps[step] > 0) write(kickP, index, kick.steps[step]);
        if (snare.steps[step] > 0) write(snareP, index, snare.steps[step]);
        if (gate && hat.steps[step] > 0) write(hatP, index, hat.steps[step] * (brief.role === 'bed' ? 0.7 : 1));
      }
      if (layerOn(name, 'bass') && bass.degrees[step] >= 0) {
        const midi = degreeMidi(root, scale, chord + bass.degrees[step], 40);
        write(bassP, index, 0.7, midi);
      }
      if (layerOn(name, 'harmony') && step === 0) {
        const chordNotes = tones.map((degree) => degreeMidi(root, scale, degree, 64));
        write(harmP, index, 0.45, chordNotes[0], chordNotes.slice(1));
      }
      if (layerOn(name, 'lead') && melody.notes[index] !== null && (densityMul > 0.55 || step % 4 === 0)) {
        write(leadP, index, name === 'outro' ? 0.35 : 0.62, melody.notes[index] ?? 60);
      }
    }
    if ((name === 'B' || name === 'drop') && bar % 4 === 3) {
      for (let step = 0; step < 16; step++) {
        const index = bar * 16 + step;
        const midi = degreeMidi(root, scale, tones[step % tones.length], 76);
        if (!leadP.steps[index]?.on) write(leadP, index, 0.4, midi);
      }
    }
  }

  const leadGain = Math.max(-24, -4 + (brief.role === 'bed' ? -4 : 0));
  const tracks: Track[] = [];
  if (style.drums) {
    tracks.push(drumTrack(style.id === 'epic_cinematic' ? 'kick808' : style.id === 'playful_pizzicato' ? 'rim' : 'kick', 'kick', -8, 0, kickP));
    tracks.push(drumTrack(style.id === 'lofi_chill' || style.id === 'retro_synthwave' ? 'snareTight' : 'snare', 'snare', -10, 0.05, snareP));
    const hatVoice: DrumVoice = style.id === 'chiptune_bounce' ? 'chipNoise' : style.id === 'ambient_calm' || style.id === 'lofi_chill' || style.id === 'playful_pizzicato' ? 'shaker' : 'hatClosed';
    tracks.push(drumTrack(hatVoice, 'hat', -14, 0.15, hatP));
  } else {
    tracks.push(drumTrack('shaker', 'shaker', -20, 0.1, hatP));
  }
  const bassVoice: SynthVoice = style.bass;
  const leadVoice: SynthVoice = style.lead;
  const harmVoice: SynthVoice = style.harmony;
  tracks.push(synthTrack('bass', bassVoice, style.id === 'chiptune_bounce' ? 'square' : 'sawtooth', -1, -6, 0, 240 + brightness * 900, bassP));
  tracks.push(synthTrack('lead', leadVoice, style.id === 'chiptune_bounce' ? 'pulse25' : 'sawtooth', 0, leadGain, -0.1, 800 + brightness * 6000, leadP));
  tracks.push(synthTrack('harmony', harmVoice, 'triangle', 0, -10, 0.1, 500 + brightness * 2500, harmP));

  const displayBars = (BAR_VALUES.includes(totalBars as Bars) ? totalBars : BAR_VALUES.find((value) => value >= totalBars) ?? 32) as Bars;
  const title = titleWords(style.id, seed);
  const info: StyleInfo = {
    id: style.id,
    mood,
    progressionId: progression.id,
    drumId,
    bassId,
    motifId: melody.motifId,
    lengthMode: mode,
    structure,
    fingerprint: '',
    requestedSeed: brief.seed ?? seed,
    usedSeed: seed,
    reseeds: 0,
    titleWords: title,
  };
  const speech = brief.role === 'bed' || brief.role === 'outro';
  const targetLufs = brief.role === 'bed' ? -20 : brief.role === 'outro' ? -18 : -16;
  const seconds = exact ? (brief.role === 'intro' ? clamp(brief.seconds, 2, 8) : brief.role === 'outro' ? clamp(brief.seconds, 4, 16) : brief.seconds) : fitted?.seconds ?? brief.seconds;
  const next: Project = {
    ...project,
    name: brief.name?.trim() || title,
    bpm,
    swing: clamp(swing, 0, 0.6),
    bars: mode === 'loop' ? (fitted?.bars ?? displayBars) : displayBars,
    mood,
    seed,
    key: { root, scale },
    tracks,
    style: info,
    ...(exact ? { exact: { seconds, bars: exact.bars, ending: exact.ending, fadeMs: exact.fadeMs } } : { exact: undefined }),
    master: {
      ...project.master,
      speechPocket: speech,
      speechDipDb: brief.role === 'bed' ? -6 : brief.role === 'outro' ? -4 : -5,
      targetLufs,
    },
    origin: {
      synthesized: true,
      samples: false,
      role: brief.role,
      requestedSeconds: brief.seconds,
      loopSeconds: Math.round(seconds * 100) / 100,
    },
  };
  const print = fingerprintOf(next);
  next.style = { ...info, fingerprint: print.id };
  for (const track of next.tracks) {
    if (track.kind !== 'synth') continue;
    for (const step of track.pattern.steps) {
      if (!step.on || step.note === undefined) continue;
      if (!isInScale(step.note, next.key.root, next.key.scale) && track.id !== 'bass') {
        warnings.push(`note ${step.note} left the scale`);
      }
    }
  }
  return { project: next, fitWarning: cell.warning, warnings };
}

export function composeStyled(project: Project, brief: ComposeBrief, pool: Fingerprint[] = []): ComposeOutcome {
  let usedRatings: ComposeOutcome['usedRatings'];
  if (brief.useRatings && brief.ratings && brief.ratings.length > 0) {
    const prefs = aggregatePreferences(brief.ratings);
    const seed = (brief.seed ?? project.seed) >>> 0;
    brief = { ...brief };
    if (!brief.style) {
      brief.style = weightedStyle(prefs, brief.mood, seed);
      usedRatings = { hash: prefs.hash, picked: true, biases: prefs.bias };
    } else {
      brief.densityBias = prefs.bias.density;
      brief.brightnessBias = prefs.bias.brightness;
      const loved = prefs.loved.find((row) => row.style === brief.style && row.mood === brief.mood);
      const pulled = ratingTempo(brief.style, brief.mood, loved?.bpmMean);
      if (pulled !== undefined && brief.targetBpm === undefined) brief.targetBpm = pulled;
      const avoided = prefs.avoid.some((row) => row.style === brief.style && row.mood === brief.mood) && (brief.varietyGuard ?? 'warn') !== 'off';
      usedRatings = { hash: prefs.hash, picked: false, biases: prefs.bias, ...(avoided ? { avoided: true } : {}) };
    }
  }
  const guard = brief.varietyGuard ?? 'warn';
  let seed = (brief.seed ?? project.seed) >>> 0;
  const requested = seed;
  let reseeds = 0;
  let best = buildStyled(project, brief, seed);
  let bestDistance = 1;
  const working = pool.map((row) => ({ ...row }));
  const score = (candidate: Project): number => {
    if (guard === 'off' || working.length === 0) return 1;
    return nearest(fingerprintOf(candidate), working).distance;
  };
  bestDistance = score(best.project);
  if (guard === 'reseed') {
    while (bestDistance < VARIETY_MIN_DISTANCE && reseeds < VARIETY_RESEED_LIMIT) {
      reseeds += 1;
      seed = reseedCandidate(requested, reseeds);
      const attempt = buildStyled(project, brief, seed);
      const value = score(attempt.project);
      if (value > bestDistance) {
        best = attempt;
        bestDistance = value;
      }
      if (value >= VARIETY_MIN_DISTANCE) {
        best = attempt;
        bestDistance = value;
        break;
      }
    }
  }
  if (best.project.style) {
    best.project.style.requestedSeed = requested;
    best.project.style.usedSeed = best.project.seed;
    best.project.style.reseeds = reseeds;
  }
  const fp = fingerprintOf(best.project);
  const near = working.length ? nearest(fp, working) : { distance: 1, entry: null };
  const similarity: Similarity = {
    nearestDistance: near.distance,
    nearestId: near.entry?.id ?? '',
    nearestName: near.entry?.name ?? '',
    threshold: VARIETY_MIN_DISTANCE,
    requestedSeed: requested,
    usedSeed: best.project.seed,
    reseeds,
  };
  if (best.project.style) best.project.style.similarity = similarity;
  if (usedRatings && best.project.style) best.project.style.ratingsHash = usedRatings.hash;
  if (usedRatings?.avoided) best.warnings.push('avoided');
  if (guard === 'refuse' && near.entry && near.distance < VARIETY_MIN_DISTANCE) {
    return {
      project: best.project,
      fitWarning: best.fitWarning,
      warnings: best.warnings,
      similarity,
      refused: `too similar to ${near.entry.name} (distance ${near.distance.toFixed(3)} < ${VARIETY_MIN_DISTANCE})`,
      ...(usedRatings ? { usedRatings } : {}),
      ...(best.layers ? { layers: best.layers } : {}),
    };
  }
  return {
    project: best.project,
    fitWarning: best.fitWarning,
    warnings: best.warnings,
    similarity,
    ...(usedRatings ? { usedRatings } : {}),
    ...(best.layers ? { layers: best.layers } : {}),
  };
}

export function composeProject(project: Project, brief: ComposeBrief, pool: Fingerprint[] = []): ComposeOutcome {
  if (!brief.style) return { project: composeForVideo(project, brief), warnings: [] };
  return composeStyled(project, brief, pool);
}
