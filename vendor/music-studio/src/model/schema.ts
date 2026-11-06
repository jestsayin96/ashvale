import type { ArrangementCell, Bars, DrumParams, ExactPlan, Origin, Pattern, PatternSlot, Project, SamplerParams, Scale, Step, StyleInfo, StyleSection, SynthParams, Track, VideoRole } from './types';
import { BAR_VALUES } from './types';
import { TRACK_LIMIT } from '../style/targets';

const SCALES: Scale[] = ['minor', 'major', 'minorPent', 'majorPent', 'dorian', 'phrygian', 'mixolydian', 'lydian', 'harmonicMinor'];
const ROLES: VideoRole[] = ['bed', 'music', 'intro', 'outro'];
const WAVES = ['sine', 'triangle', 'sawtooth', 'square', 'pulse12', 'pulse25'];
const DRUMS = ['kick', 'snare', 'clap', 'hatClosed', 'hatOpen', 'tom', 'rim', 'kick808', 'shaker', 'crash', 'chipNoise', 'snareTight'];
const SYNTHS = ['lead', 'bass', 'pad', 'pluck', 'pulse', 'bell', 'strings', 'brass', 'pizz', 'sub808'];
const FILTERS = ['lowpass', 'highpass', 'bandpass'];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function fail(msg: string): never {
  throw new Error(msg);
}

function num(v: unknown, label: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${label} must be a finite number`);
  return v;
}

function readStep(v: unknown, label: string): Step {
  if (!isObj(v)) fail(`${label} must be an object`);
  if (typeof v.on !== 'boolean') fail(`${label} is missing on/off`);
  const vel = num(v.vel, `${label} velocity`);
  if (vel < 0 || vel > 1) fail(`${label} velocity out of range (0-1): ${vel}`);
  const len = num(v.len, `${label} length`);
  if (len <= 0) fail(`${label} length must be positive`);
  const step: Step = { on: v.on, vel, len };
  if (v.note !== undefined) {
    const note = num(v.note, `${label} note`);
    if (note < 0 || note > 127) fail(`${label} note out of MIDI range: ${note}`);
    step.note = note;
  }
  if (v.prob !== undefined) {
    const prob = num(v.prob, `${label} probability`);
    if (prob < 0 || prob > 1) fail(`${label} probability out of range (0-1): ${prob}`);
    step.prob = prob;
  }
  if (v.notes !== undefined) {
    if (!Array.isArray(v.notes)) fail(`${label} notes must be an array`);
    step.notes = v.notes.map((note, index) => {
      const midi = num(note, `${label} chord note ${index}`);
      if (midi < 0 || midi > 127) fail(`${label} chord note out of MIDI range: ${midi}`);
      return midi;
    });
  }
  return step;
}

function readPattern(v: unknown, label: string): Pattern {
  if (!isObj(v)) fail(`${label} pattern must be an object`);
  const length = v.length;
  if (typeof length !== 'number' || length < 16 || length > 2048 || length % 16 !== 0) {
    fail(`${label} pattern length must be a multiple of 16 from 16 to 2048`);
  }
  if (!Array.isArray(v.steps)) fail(`${label} pattern is missing steps`);
  if (v.steps.length !== length) {
    fail(`${label} pattern steps (${v.steps.length}) do not match length ${length}`);
  }
  return { length, steps: v.steps.map((s, i) => readStep(s, `${label} step ${i}`)) };
}

function readDrumParams(v: unknown, label: string): DrumParams {
  if (!isObj(v)) fail(`${label} drum params must be an object`);
  return {
    tuneSemis: num(v.tuneSemis, `${label} tune`),
    decay: num(v.decay, `${label} decay`),
    tone: num(v.tone, `${label} tone`),
  };
}

function readSynthParams(v: unknown, label: string): SynthParams {
  if (!isObj(v)) fail(`${label} synth params must be an object`);
  if (!WAVES.includes(String(v.wave))) fail(`${label} waveform is invalid`);
  if (!isObj(v.adsr)) fail(`${label} is missing ADSR`);
  if (!isObj(v.filter)) fail(`${label} is missing filter`);
  const type = String(v.filter.type);
  if (!FILTERS.includes(type)) fail(`${label} filter type is invalid`);
  return {
    wave: v.wave as SynthParams['wave'],
    detuneCents: num(v.detuneCents, `${label} detune`),
    octave: num(v.octave, `${label} octave`),
    adsr: {
      a: num(v.adsr.a, `${label} attack`),
      d: num(v.adsr.d, `${label} decay`),
      s: num(v.adsr.s, `${label} sustain`),
      r: num(v.adsr.r, `${label} release`),
    },
    filter: {
      type: type as SynthParams['filter']['type'],
      cutoff: num(v.filter.cutoff, `${label} cutoff`),
      q: num(v.filter.q, `${label} Q`),
      envAmount: num(v.filter.envAmount, `${label} filter envelope`),
    },
  };
}

function readSamplerParams(v: unknown, label: string): SamplerParams {
  if (!isObj(v)) fail(`${label} sampler params must be an object`);
  const sampleId = String(v.sampleId ?? '');
  if (!sampleId) fail(`${label} is missing sampleId`);
  const pitchSemis = num(v.pitchSemis ?? 0, `${label} pitchSemis`);
  if (pitchSemis < -24 || pitchSemis > 24) fail(`${label} pitchSemis out of range (-24..24)`);
  const fineCents = num(v.fineCents ?? 0, `${label} fineCents`);
  if (fineCents < -100 || fineCents > 100) fail(`${label} fineCents out of range (-100..100)`);
  const start = num(v.start ?? 0, `${label} start`);
  if (start < 0) fail(`${label} start must be >= 0 seconds`);
  let end: number | null = null;
  if (v.end !== undefined && v.end !== null) {
    end = num(v.end, `${label} end`);
    if (end < 0) fail(`${label} end must be >= 0 seconds`);
  }
  if (!isObj(v.adsr)) fail(`${label} is missing ADSR`);
  const params: SamplerParams = {
    sampleId,
    rootMidi: num(v.rootMidi ?? 60, `${label} rootMidi`),
    pitchSemis,
    fineCents,
    start,
    end,
    gainDb: num(v.gainDb ?? 0, `${label} sample gain`),
    adsr: {
      a: num(v.adsr.a, `${label} attack`),
      d: num(v.adsr.d, `${label} decay`),
      s: num(v.adsr.s, `${label} sustain`),
      r: num(v.adsr.r, `${label} release`),
    },
    loop: v.loop === true,
  };
  if (v.loopStart !== undefined) params.loopStart = num(v.loopStart, `${label} loopStart`);
  if (v.loopEnd !== undefined) params.loopEnd = num(v.loopEnd, `${label} loopEnd`);
  if (v.chokeGroup !== undefined) params.chokeGroup = String(v.chokeGroup);
  if (v.group !== undefined) {
    const group = String(v.group);
    if (group !== 'beat' && group !== 'voice' && group !== 'melody' && group !== 'effects') fail(`${label} group is invalid`);
    params.group = group;
  }
  if (v.reverse === true) fail(`${label} reverse is reserved and not implemented`);
  return params;
}

function readSlots(v: unknown, label: string): PatternSlot[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) fail(`${label} slots must be an array`);
  return v.map((row, i) => {
    if (!isObj(row)) fail(`${label} slot ${i} must be an object`);
    return { id: String(row.id ?? ''), name: String(row.name ?? ''), pattern: readPattern(row.pattern, `${label} slot ${i}`) };
  });
}

function readArrangement(v: unknown, label: string): ArrangementCell[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) fail(`${label} arrangement must be an array`);
  return v.map((row, i) => {
    if (!isObj(row)) fail(`${label} arrangement ${i} must be an object`);
    return { section: String(row.section ?? ''), slot: row.slot === null || row.slot === undefined ? null : String(row.slot) };
  });
}

function readTrack(v: unknown, index: number): Track {
  const label = `Track ${index + 1}`;
  if (!isObj(v)) fail(`${label} must be an object`);
  if (typeof v.id !== 'string' || !v.id) fail(`${label} is missing an id`);
  if (typeof v.name !== 'string') fail(`${label} is missing a name`);
  if (v.kind !== 'drum' && v.kind !== 'synth' && v.kind !== 'sample') fail(`${label} kind must be drum, synth, or sample`);
  const voice = String(v.voice);
  if (v.kind === 'drum' && !DRUMS.includes(voice)) fail(`${label} drum voice is invalid: ${voice}`);
  if (v.kind === 'synth' && !SYNTHS.includes(voice)) fail(`${label} synth voice is invalid: ${voice}`);
  if (v.kind === 'sample' && voice !== 'sampler') fail(`${label} sample voice must be sampler`);
  const params = v.kind === 'drum'
    ? readDrumParams(v.params, label)
    : v.kind === 'synth'
      ? readSynthParams(v.params, label)
      : readSamplerParams(v.params, label);
  const track: Track = {
    id: v.id,
    name: v.name,
    kind: v.kind,
    voice: voice as Track['voice'],
    params,
    gainDb: num(v.gainDb, `${label} gain`),
    pan: num(v.pan, `${label} pan`),
    mute: v.mute === true,
    solo: v.solo === true,
    pattern: readPattern(v.pattern, label),
  };
  const slots = readSlots(v.slots, label);
  const arrangement = readArrangement(v.arrangement, label);
  if (slots) track.slots = slots;
  if (arrangement) track.arrangement = arrangement;
  return track;
}

function readOrigin(v: unknown): Origin | undefined {
  if (v === undefined) return undefined;
  if (!isObj(v)) fail('Origin must be an object');
  const samples = v.samples === true;
  const synthesized = v.synthesized === 'mixed' ? 'mixed' as const : v.synthesized === true ? true : v.synthesized === false ? false : fail('Origin.synthesized must be true, false, or mixed');
  if (!samples && synthesized !== true) fail('Origin without samples must say synthesized:true');
  if (samples && synthesized === true) fail('Origin with samples cannot claim synthesized:true only; use mixed or false');
  const role = String(v.role);
  if (!ROLES.includes(role as VideoRole)) fail(`Unknown video role: ${role}`);
  const origin: Origin = {
    synthesized,
    samples,
    role: role as VideoRole,
    requestedSeconds: num(v.requestedSeconds, 'Requested seconds'),
    loopSeconds: num(v.loopSeconds, 'Loop seconds'),
  };
  if (Array.isArray(v.sampleIds)) origin.sampleIds = v.sampleIds.map((id) => String(id));
  return origin;
}

function readStyle(v: unknown): StyleInfo | undefined {
  if (v === undefined) return undefined;
  if (!isObj(v)) fail('style must be an object');
  const mood = String(v.mood);
  if (mood !== 'hype' && mood !== 'playful' && mood !== 'lowkey') fail(`Unknown style mood: ${mood}`);
  const lengthMode = String(v.lengthMode);
  if (lengthMode !== 'loop' && lengthMode !== 'exact') fail(`Unknown length mode: ${lengthMode}`);
  const structure = Array.isArray(v.structure)
    ? v.structure.map((section, index) => {
        if (!isObj(section)) fail(`style section ${index} must be an object`);
        return { name: String(section.name ?? 'section'), bars: num(section.bars, `style section ${index} bars`) };
      })
    : [];
  return {
    id: String(v.id ?? ''),
    mood,
    progressionId: String(v.progressionId ?? ''),
    drumId: String(v.drumId ?? ''),
    bassId: String(v.bassId ?? ''),
    motifId: String(v.motifId ?? ''),
    lengthMode,
    structure,
    fingerprint: String(v.fingerprint ?? ''),
    requestedSeed: num(v.requestedSeed ?? 0, 'requested seed'),
    usedSeed: num(v.usedSeed ?? 0, 'used seed'),
    reseeds: num(v.reseeds ?? 0, 'reseeds'),
    titleWords: String(v.titleWords ?? ''),
    ...(typeof v.ratingsHash === 'string' ? { ratingsHash: v.ratingsHash } : {}),
  };
}

function readExact(v: unknown): ExactPlan | undefined {
  if (v === undefined) return undefined;
  if (!isObj(v)) fail('exact must be an object');
  const ending = String(v.ending);
  if (ending !== 'cadence' && ending !== 'trim-fade') fail(`Unknown ending: ${ending}`);
  return {
    seconds: num(v.seconds, 'exact seconds'),
    bars: num(v.bars, 'exact bars'),
    ending,
    fadeMs: num(v.fadeMs ?? 400, 'fade ms'),
  };
}

export function validateProject(json: unknown): Project {
  if (!isObj(json)) fail('Project must be a JSON object');
  if (json.version !== 1) {
    fail(`Unsupported project version: ${String(json.version)} (expected 1)`);
  }
  if (!Array.isArray(json.tracks) || json.tracks.length === 0) {
    fail('Project is missing tracks');
  }
  if (json.tracks.length > TRACK_LIMIT) fail(`Project has more than ${TRACK_LIMIT} tracks`);
  const bpm = num(json.bpm, 'BPM');
  if (bpm < 60 || bpm > 200) fail(`BPM out of range (60-200): ${bpm}`);
  const swing = num(json.swing, 'Swing');
  if (swing < 0 || swing > 0.6) fail(`Swing out of range (0-0.6): ${swing}`);
  const bars = num(json.bars, 'Bars');
  if (!(BAR_VALUES as readonly number[]).includes(bars)) fail(`Bars must be ${BAR_VALUES.join(', ')}`);
  if (typeof json.name !== 'string' || !json.name.trim()) fail('Project is missing a name');
  if (!isObj(json.key)) fail('Project is missing a key');
  const root = num(json.key.root, 'Key root');
  if (!SCALES.includes(json.key.scale as Scale)) fail(`Unknown scale: ${String(json.key.scale)}`);
  if (!isObj(json.master)) fail('Project is missing master settings');
  const speechDipDb = num(json.master.speechDipDb, 'Speech dip');
  if (speechDipDb < -9 || speechDipDb > 0) fail(`Speech dip out of range (0 to -9 dB): ${speechDipDb}`);
  const mood = json.mood;
  if (mood !== undefined && mood !== 'hype' && mood !== 'playful' && mood !== 'lowkey' && mood !== 'custom') {
    fail(`Unknown mood: ${String(mood)}`);
  }
  const origin = readOrigin(json.origin);
  const style = readStyle(json.style);
  const exact = readExact(json.exact);
  let sections: StyleSection[] | undefined;
  if (json.sections !== undefined) {
    if (!Array.isArray(json.sections)) fail('sections must be an array');
    sections = json.sections.map((row, i) => {
      if (!isObj(row)) fail(`sections[${i}] must be an object`);
      return { name: String(row.name ?? ''), bars: num(row.bars, `sections[${i}].bars`) };
    });
  }
  const project: Project = {
    version: 1,
    name: json.name,
    bpm,
    swing,
    bars: bars as Bars,
    mood: mood as Project['mood'],
    ...(origin ? { origin } : {}),
    ...(style ? { style } : {}),
    ...(exact ? { exact } : {}),
    ...(sections ? { sections } : {}),
    key: { root, scale: json.key.scale as Scale },
    tracks: json.tracks.map((t, i) => readTrack(t, i)),
    master: {
      gainDb: num(json.master.gainDb, 'Master gain'),
      speechPocket: json.master.speechPocket === true,
      speechDipDb,
      targetLufs: num(json.master.targetLufs, 'Target LUFS'),
      ceilingDbtp: num(json.master.ceilingDbtp, 'Ceiling dBTP'),
    },
    seed: num(json.seed, 'Seed'),
  };
  return project;
}

/** Validation warnings that do not block loading (e.g. unknown sampleId). */
export function projectWarnings(project: Project, knownSampleIds?: Set<string>): string[] {
  const warnings: string[] = [];
  for (const track of project.tracks) {
    if (track.kind !== 'sample') continue;
    const id = (track.params as SamplerParams).sampleId;
    if (knownSampleIds && !knownSampleIds.has(id)) warnings.push(`missing sample ${id}`);
  }
  return warnings;
}
