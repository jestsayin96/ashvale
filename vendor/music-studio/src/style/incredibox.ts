/**
 * Layered-loops recipe (style id "incredibox").
 * Generic enter/drop structure from seeded rules. Not an imitation of any game's sounds or melodies.
 */

import { makePattern, samplerParams, synthParams } from '../model/defaults';
import { mulberry32 } from '../model/rng';
import type { Pattern, Project, SamplerParams, StyleSection, Track, VideoRole } from '../model/types';
import { getCachedLibrary, listSamples } from '../samples/library';
import type { SampleGroup } from '../samples/manifest';
import {
  EXACT_FADE_MS_DEFAULT,
  LAYER_BRIGHTNESS,
  LAYER_MAX_CHANGES_PER_BOUNDARY,
  LAYER_MAX_SIMULTANEOUS,
  LOWKEY_BPM,
  LOWKEY_PAD_WIDTH,
} from './targets';
import { moodCell, tempoFromCell, type StyleMood } from './matrix';
import { styleById, tagSeed } from './styles';
import { titleWords } from './titles';
import { fingerprintOf } from './fingerprint';
import { BAR_VALUES, type Bars } from '../model/types';

export interface LayerReport {
  track: string;
  group: SampleGroup;
  sampleId: string | null;
  enters: string[];
  drops: string[];
}

/** Sums to 32 bars so project.bars stays inside BAR_VALUES. */
const STRUCTURE: StyleSection[] = [
  { name: 'intro', bars: 4 },
  { name: 'build', bars: 8 },
  { name: 'full', bars: 8 },
  { name: 'drop', bars: 4 },
  { name: 'full2', bars: 4 },
  { name: 'outro', bars: 4 },
];

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function stepsFromMask(mask: string, vel = 0.8): Pattern {
  const chars = mask.replace(/\s/g, '');
  const length = Math.max(16, Math.ceil(chars.length / 16) * 16);
  const hits: Array<{ i: number; vel: number }> = [];
  for (let i = 0; i < chars.length; i++) if (chars[i] === 'x' || chars[i] === 'X') hits.push({ i, vel });
  return makePattern(length, hits);
}

function pickSample(group: SampleGroup, typeHint: string, seed: number): string | null {
  const rows = listSamples(getCachedLibrary()).filter((row) => row.group === group || row.type.includes(typeHint));
  if (rows.length === 0) {
    const any = listSamples(getCachedLibrary()).filter((row) => row.type.includes(typeHint) || row.group === group);
    if (any.length === 0) return null;
    return any[Math.abs(seed) % any.length].id;
  }
  return rows[Math.abs(seed) % rows.length].id;
}

function arrangementFor(sections: StyleSection[], active: Record<string, string | null>): Track['arrangement'] {
  return sections.map((section) => ({ section: section.name, slot: active[section.name] ?? null }));
}

function scaleStructure(total: number): StyleSection[] {
  const n = Math.max(1, Math.floor(total));
  if (n < STRUCTURE.length) {
    return STRUCTURE.slice(0, n).map((row) => ({ name: row.name, bars: 1 }));
  }
  const base = STRUCTURE.reduce((sum, row) => sum + row.bars, 0);
  let allocated = 0;
  return STRUCTURE.map((row, index) => {
    if (index === STRUCTURE.length - 1) return { name: row.name, bars: Math.max(1, n - allocated) };
    const bars = Math.max(1, Math.round((row.bars / base) * n));
    allocated += bars;
    return { name: row.name, bars };
  });
}

function layerTrack(
  id: string,
  name: string,
  group: SampleGroup,
  sampleId: string | null,
  seed: number,
  patternA: Pattern,
  patternB: Pattern,
  active: Record<string, string | null>,
  synthFallback: Track,
  sections: StyleSection[],
): Track {
  if (!sampleId) {
    return {
      ...synthFallback,
      id,
      name,
      arrangement: arrangementFor(sections, active),
      slots: [
        { id: 'A', name: 'A', pattern: patternA },
        { id: 'B', name: 'B', pattern: patternB },
      ],
      pattern: patternA,
    };
  }
  const params: SamplerParams = samplerParams({
    sampleId,
    rootMidi: group === 'beat' ? 36 : 60,
    pitchSemis: (seed % 5) - 2,
    group,
    loop: group === 'voice' || group === 'melody',
    gainDb: group === 'effects' ? -6 : -3,
    adsr: group === 'beat' ? { a: 0.002, d: 0.06, s: 0.2, r: 0.05 } : { a: 0.02, d: 0.1, s: 0.7, r: 0.15 },
    chokeGroup: group === 'beat' && name.toLowerCase().includes('hat') ? 'hats' : undefined,
  });
  return {
    id,
    name,
    kind: 'sample',
    voice: 'sampler',
    params,
    gainDb: -4,
    pan: ((seed % 7) - 3) * 0.08,
    mute: false,
    solo: false,
    pattern: patternA,
    slots: [
      { id: 'A', name: 'A', pattern: patternA },
      { id: 'B', name: 'B', pattern: patternB },
    ],
    arrangement: arrangementFor(sections, active),
  };
}

function countActive(tracks: Track[], section: string): number {
  let n = 0;
  for (const track of tracks) {
    const cell = track.arrangement?.find((row) => row.section === section);
    if (cell && cell.slot !== null && !track.mute) n += 1;
  }
  return n;
}

function changesAt(tracks: Track[], from: string, to: string): number {
  let n = 0;
  for (const track of tracks) {
    const a = track.arrangement?.find((row) => row.section === from)?.slot ?? null;
    const b = track.arrangement?.find((row) => row.section === to)?.slot ?? null;
    if (a !== b) n += 1;
  }
  return n;
}

export function buildIncredibox(
  project: Project,
  brief: { role: VideoRole; mood: StyleMood; seconds: number; seed?: number; lengthMode?: 'loop' | 'exact'; name?: string },
): { project: Project; warnings: string[]; layers: LayerReport[]; fitWarning?: string } {
  const style = styleById('incredibox')!;
  const seed = (brief.seed ?? project.seed) >>> 0;
  const mood = brief.mood;
  const cell = moodCell('incredibox', mood);
  const warnings: string[] = [];
  const mode = brief.lengthMode ?? (brief.role === 'intro' || brief.role === 'outro' ? 'exact' : 'loop');
  const wantSeconds = mode === 'exact'
    ? (brief.role === 'intro' ? clamp(brief.seconds, 2, 8) : brief.role === 'outro' ? clamp(brief.seconds, 4, 16) : Math.max(0.25, brief.seconds))
    : clamp(brief.seconds, 8, 120);
  const structureBars = STRUCTURE.reduce((sum, row) => sum + row.bars, 0);
  let bpm = tempoFromCell(style.tempo, cell);
  let exactPlan: { seconds: number; bars: number; ending: 'cadence' | 'trim-fade'; fadeMs: number } | null = null;
  if (mode === 'exact') {
    let best: { bars: number; bpm: number; distance: number } | null = null;
    for (let bars = 1; bars <= 128; bars++) {
      const candidate = (bars * 240) / wantSeconds;
      if (candidate < style.tempo[0] || candidate > style.tempo[1] || candidate < 60 || candidate > 200) continue;
      const distance = Math.abs(candidate - bpm);
      if (!best || distance < best.distance) best = { bars, bpm: candidate, distance };
    }
    if (best) {
      bpm = best.bpm;
      exactPlan = { seconds: wantSeconds, bars: best.bars, ending: 'cadence', fadeMs: EXACT_FADE_MS_DEFAULT };
    } else {
      const bars = clamp(Math.round((bpm * wantSeconds) / 240), 1, 128);
      exactPlan = { seconds: wantSeconds, bars, ending: 'trim-fade', fadeMs: EXACT_FADE_MS_DEFAULT };
    }
  } else {
    // Prefer the recipe structure length; nudge bpm so loop seconds stay near the request.
    const target = (structureBars * 240) / wantSeconds;
    bpm = clamp(target, style.tempo[0], style.tempo[1]);
  }
  if (mood === 'lowkey') {
    bpm = clamp(bpm, LOWKEY_BPM[0], LOWKEY_BPM[1]);
  }
  const brightness = clamp(style.brightness + cell.brightnessShift, LAYER_BRIGHTNESS[0], LAYER_BRIGHTNESS[1]);
  void brightness;
  const totalBars = exactPlan?.bars ?? structureBars;
  const structure = exactPlan ? scaleStructure(totalBars) : STRUCTURE;

  const kickId = pickSample('beat', 'kick', tagSeed(seed, 'kick'));
  const snareId = pickSample('beat', 'snare', tagSeed(seed, 'snare'));
  const hatId = pickSample('beat', 'hat', tagSeed(seed, 'hat'));
  const bassId = pickSample('beat', 'bass', tagSeed(seed, 'bass'));
  const voiceId = pickSample('voice', 'chant', tagSeed(seed, 'voice')) ?? pickSample('voice', 'hum', tagSeed(seed, 'hum'));
  const padId = pickSample('melody', 'pad', tagSeed(seed, 'pad'));
  const fxId = pickSample('effects', 'fx', tagSeed(seed, 'fx'));
  const usedSamples = [kickId, snareId, hatId, bassId, voiceId, padId, fxId].filter((id): id is string => !!id);
  if (usedSamples.length === 0) warnings.push('No samples loaded; synthesized fallback.');

  const sparse = mood === 'lowkey';
  // Kick on 1&3; snare on 3; hats on 8th offbeats so drum regularity lands ~0.4–0.6.
  const kickA = stepsFromMask(sparse ? 'x.......x.......' : 'x...x...x...x...');
  const kickB = stepsFromMask(sparse ? 'x...............' : 'x.....x.x...x...');
  const snareA = stepsFromMask(sparse ? '........x.......' : '....x.......x...');
  const snareB = stepsFromMask(sparse ? '........x.......' : '....x..x....x...');
  // No 16th hats on lowkey — sparse 8th offbeats only.
  const hatA = stepsFromMask(sparse ? '..x.......x.....' : 'x.x.x.x.x.x.x.x.');
  const hatB = stepsFromMask(sparse ? '..x.....x.......' : 'x.x.x.xx.x.x.x.x');
  const bassA = stepsFromMask(sparse ? 'x.......x.......' : 'x.......x.......');
  const bassB = stepsFromMask(sparse ? 'x...............' : 'x...x...x.......');
  const voiceA = stepsFromMask('x...............');
  const voiceB = stepsFromMask(sparse ? '........x.......' : '....x.......x...');
  const padA = stepsFromMask('x...............');
  const padB = stepsFromMask(sparse ? 'x...............' : 'x.......x.......');
  const fxA = stepsFromMask('............x...');
  const fxB = stepsFromMask(sparse ? '................' : 'x...............');

  const synthKick: Track = {
    id: 'layer_kick', name: 'Beat kick', kind: 'drum', voice: 'kick', params: { tuneSemis: 0, decay: 0.22, tone: 0.4 },
    gainDb: -6, pan: 0, mute: false, solo: false, pattern: kickA,
  };

  // Arrangements change at most LAYER_MAX_CHANGES_PER_BOUNDARY layers per section edge.
  const tracks: Track[] = [
    layerTrack('layer_kick', 'Beat kick', 'beat', kickId, tagSeed(seed, 'tk'), kickA, kickB, {
      intro: 'A', build: 'A', full: 'A', drop: null, full2: 'B', outro: null,
    }, synthKick, structure),
    layerTrack('layer_snare', 'Beat snare', 'beat', snareId, tagSeed(seed, 'ts'), snareA, snareB, {
      intro: null, build: 'A', full: 'A', drop: 'A', full2: 'B', outro: 'B',
    }, { ...synthKick, id: 'layer_snare', name: 'Beat snare', voice: 'snare', pattern: snareA }, structure),
    layerTrack('layer_hat', 'Beat hat', 'beat', hatId, tagSeed(seed, 'th'), hatA, hatB, {
      intro: null, build: 'A', full: 'A', drop: 'A', full2: 'A', outro: 'A',
    }, { ...synthKick, id: 'layer_hat', name: 'Beat hat', voice: 'hatClosed', pattern: hatA }, structure),
    layerTrack('layer_bass', 'Beat bass', 'beat', bassId, tagSeed(seed, 'tb'), bassA, bassB, {
      intro: null, build: null, full: 'A', drop: null, full2: null, outro: null,
    }, {
      id: 'layer_bass', name: 'Beat bass', kind: 'synth', voice: 'bass',
      params: synthParams({ wave: 'sawtooth', octave: -1, adsr: { a: 0.01, d: 0.1, s: 0.5, r: 0.1 } }),
      gainDb: -8, pan: 0, mute: false, solo: false, pattern: bassA,
    }, structure),
    layerTrack('layer_voice', 'Voice chant', 'voice', voiceId, tagSeed(seed, 'tv'), voiceA, voiceB, {
      intro: null, build: null, full: 'A', drop: 'A', full2: 'A', outro: 'A',
    }, {
      id: 'layer_voice', name: 'Voice chant', kind: 'synth', voice: 'bell',
      params: synthParams({
        wave: 'sine',
        adsr: { a: 0.08, d: 0.25, s: 0.55, r: 0.3 },
        filter: { type: 'lowpass', cutoff: sparse ? 1200 : 2800, q: 0.5, envAmount: 0.15 },
      }),
      gainDb: sparse ? -12 : -10, pan: sparse ? LOWKEY_PAD_WIDTH : 0.1, mute: false, solo: false, pattern: voiceA,
    }, structure),
    layerTrack('layer_pad', 'Melody pad', 'melody', padId, tagSeed(seed, 'tp'), padA, padB, {
      intro: 'A', build: 'A', full: 'A', drop: 'A', full2: 'A', outro: 'A',
    }, {
      id: 'layer_pad', name: 'Melody pad', kind: 'synth', voice: 'pad',
      params: synthParams({
        wave: 'triangle',
        adsr: { a: 0.35, d: 0.4, s: 0.7, r: 0.6 },
        filter: { type: 'lowpass', cutoff: sparse ? 900 : 1800, q: 0.45, envAmount: 0.1 },
      }),
      gainDb: sparse ? -14 : -12, pan: sparse ? -LOWKEY_PAD_WIDTH : -0.1, mute: false, solo: false, pattern: padA,
    }, structure),
    layerTrack('layer_fx', 'Effects sweep', 'effects', fxId, tagSeed(seed, 'tf'), fxA, fxB, {
      intro: sparse ? null : 'A', build: sparse ? null : 'A', full: 'A', drop: 'A', full2: sparse ? null : 'A', outro: null,
    }, {
      id: 'layer_fx', name: 'Effects sweep', kind: 'synth', voice: 'pluck',
      params: synthParams({
        wave: sparse ? 'sine' : 'sawtooth',
        adsr: { a: 0.02, d: 0.3, s: 0.1, r: 0.25 },
        filter: { type: 'lowpass', cutoff: sparse ? 1400 : 3200, q: 0.6, envAmount: 0.2 },
      }),
      gainDb: -14, pan: 0.2, mute: false, solo: false, pattern: fxA,
    }, structure),
  ];

  // Enforce max simultaneous and max changes by silencing the least essential layer if needed.
  for (let i = 1; i < structure.length; i++) {
    const from = structure[i - 1].name;
    const to = structure[i].name;
    while (changesAt(tracks, from, to) > LAYER_MAX_CHANGES_PER_BOUNDARY) {
      const mutable = tracks.find((track) => {
        const a = track.arrangement?.find((row) => row.section === from)?.slot ?? null;
        const b = track.arrangement?.find((row) => row.section === to)?.slot ?? null;
        return a !== b && b !== null && track.id !== 'layer_pad';
      });
      if (!mutable?.arrangement) break;
      const cell = mutable.arrangement.find((row) => row.section === to);
      if (cell) cell.slot = null;
    }
    while (countActive(tracks, to) > LAYER_MAX_SIMULTANEOUS) {
      const drop = [...tracks].reverse().find((track) => track.arrangement?.find((row) => row.section === to)?.slot);
      const cell = drop?.arrangement?.find((row) => row.section === to);
      if (!cell) break;
      cell.slot = null;
    }
  }

  const groupOf: Record<string, SampleGroup> = {
    layer_kick: 'beat',
    layer_snare: 'beat',
    layer_hat: 'beat',
    layer_bass: 'beat',
    layer_voice: 'voice',
    layer_pad: 'melody',
    layer_fx: 'effects',
  };
  const layers: LayerReport[] = tracks.map((track) => {
    const enters: string[] = [];
    const drops: string[] = [];
    let prev: string | null = null;
    for (const section of structure) {
      const slot = track.arrangement?.find((row) => row.section === section.name)?.slot ?? null;
      if (prev === null && slot !== null) enters.push(section.name);
      if (prev !== null && slot === null) drops.push(section.name);
      if (prev !== null && slot !== null && prev !== slot && !enters.includes(section.name)) enters.push(section.name);
      prev = slot;
    }
    const sampleId = track.kind === 'sample' ? (track.params as SamplerParams).sampleId : null;
    return { track: track.id, group: groupOf[track.id] ?? 'melody', sampleId, enters, drops };
  });

  const legalBars = (BAR_VALUES as readonly number[]).includes(totalBars)
    ? totalBars as Bars
    : ([...BAR_VALUES].reverse().find((b) => b <= totalBars) ?? 32) as Bars;

  const scale = mood === 'hype' ? 'phrygian' as const : mood === 'playful' ? 'harmonicMinor' as const : 'minor' as const;
  const root = [0, 2, 4, 7, 9][Math.abs(tagSeed(seed, 'root')) % 5];
  const next: Project = {
    ...project,
    name: brief.name ?? titleWords('incredibox', seed),
    bpm,
    swing: 0.08 + (mulberry32(tagSeed(seed, 'swing'))() * 0.12),
    bars: legalBars,
    mood,
    key: { root, scale },
    seed,
    sections: structure,
    tracks,
    master: {
      ...project.master,
      targetLufs: brief.role === 'bed' ? -20 : -16,
      speechPocket: brief.role === 'bed',
    },
    origin: usedSamples.length
      ? { synthesized: 'mixed', samples: true, role: brief.role, requestedSeconds: brief.seconds, loopSeconds: wantSeconds, sampleIds: usedSamples }
      : { synthesized: true, samples: false, role: brief.role, requestedSeconds: brief.seconds, loopSeconds: wantSeconds },
    style: {
      id: 'incredibox',
      mood,
      progressionId: 'layered',
      drumId: 'beatbox',
      bassId: 'sub',
      motifId: 'layer',
      lengthMode: mode,
      structure,
      fingerprint: '',
      requestedSeed: seed,
      usedSeed: seed,
      reseeds: 0,
      titleWords: titleWords('incredibox', seed),
    },
    ...(exactPlan ? { exact: exactPlan } : {}),
  };
  if (next.style) next.style.fingerprint = fingerprintOf(next).id;
  return { project: next, warnings, layers, fitWarning: cell.warning };
}
