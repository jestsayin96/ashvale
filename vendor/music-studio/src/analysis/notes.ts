import { buildEvents } from '../audio/events';
import { loopSeconds } from '../model/video';
import { NOTE_NAMES, isInScale, noteName } from '../model/scales';
import type { Project, SynthParams } from '../model/types';
import { REGISTER_LOW_MAX_MIDI, REGISTER_MID_MAX_MIDI } from './targets';
import { median } from './features';

export interface InstrumentStat {
  trackName: string;
  voice: string;
  kind: 'drum' | 'synth' | 'sample';
  wave?: string;
  notes: number;
}

export interface MusicalStats {
  key: { root: number; rootName: string; scale: Project['key']['scale'] };
  instruments: InstrumentStat[];
  notesPerBar: number[];
  notesPerBarMean: number;
  synthNoteDensity: number;
  drumHitsPerBar: number;
  drumVoiceCounts: Record<string, number>;
  rhythmicDensity: number;
  onsetGridShare: { quarter: number; eighthOffbeat: number; sixteenth: number };
  rhythmRegularity: number;
  pitchRange: {
    minMidi: number;
    maxMidi: number;
    minName: string;
    maxName: string;
    spanSemitones: number;
    medianMidi: number;
    register: 'low' | 'mid' | 'high';
  };
  pitchClassHistogram: number[];
  inKeyShare: number;
}

function emptyPitch(): MusicalStats['pitchRange'] {
  return {
    minMidi: 0,
    maxMidi: 0,
    minName: 'C-1',
    maxName: 'C-1',
    spanSemitones: 0,
    medianMidi: 0,
    register: 'low',
  };
}

export function musicalStats(project: Project): MusicalStats {
  const events = buildEvents(project, project.bars);
  const seconds = Math.max(1e-9, loopSeconds(project.bars, project.bpm));
  const notesPerBar = Array.from({ length: project.bars }, () => 0);
  const drumVoiceCounts: Record<string, number> = {};
  const counts = new Map<string, number>();
  let synthNotes = 0;
  let drumHits = 0;
  let quarter = 0;
  let eighth = 0;
  let sixteenth = 0;
  let drumQuarter = 0;
  const pitches: number[] = [];
  const classes = Array.from({ length: 12 }, () => 0);
  let inKey = 0;

  for (const ev of events) {
    counts.set(ev.trackId, (counts.get(ev.trackId) ?? 0) + 1);
    const pos = ev.stepIndex % 16;
    if (pos % 4 === 0) quarter++;
    else if (pos % 4 === 2) eighth++;
    else sixteenth++;
    if (ev.kind === 'drum') {
      drumHits++;
      drumVoiceCounts[ev.voice] = (drumVoiceCounts[ev.voice] ?? 0) + 1;
      if (pos % 4 === 0) drumQuarter++;
    } else {
      // synth and sample events both count toward pitched density
      synthNotes++;
      const bar = Math.min(project.bars - 1, Math.floor(ev.stepIndex / 16));
      notesPerBar[bar]++;
      if (ev.note !== undefined) {
        const midi = Math.round(ev.note);
        pitches.push(midi);
        classes[((midi % 12) + 12) % 12]++;
        if (isInScale(midi, project.key.root, project.key.scale)) inKey++;
      }
    }
  }

  const total = events.length;
  const share = (n: number) => (total > 0 ? n / total : 0);
  const classSum = classes.reduce((a, b) => a + b, 0);
  const histogram = classes.map((n) => (classSum > 0 ? n / classSum : 0));
  const instruments: InstrumentStat[] = project.tracks
    .filter((track) => counts.has(track.id))
    .map((track) => {
      const row: InstrumentStat = {
        trackName: track.name,
        voice: track.voice,
        kind: track.kind,
        notes: counts.get(track.id) ?? 0,
      };
      if (track.kind === 'synth') row.wave = (track.params as SynthParams).wave;
      return row;
    });

  let pitch = emptyPitch();
  if (pitches.length > 0) {
    const minMidi = Math.min(...pitches);
    const maxMidi = Math.max(...pitches);
    const medianMidi = median(pitches);
    pitch = {
      minMidi,
      maxMidi,
      minName: noteName(minMidi),
      maxName: noteName(maxMidi),
      spanSemitones: maxMidi - minMidi,
      medianMidi,
      register: medianMidi < REGISTER_LOW_MAX_MIDI ? 'low' : medianMidi < REGISTER_MID_MAX_MIDI ? 'mid' : 'high',
    };
  }

  const root = ((project.key.root % 12) + 12) % 12;
  return {
    key: { root, rootName: NOTE_NAMES[root], scale: project.key.scale },
    instruments,
    notesPerBar,
    notesPerBarMean: project.bars > 0 ? synthNotes / project.bars : 0,
    synthNoteDensity: synthNotes / seconds,
    drumHitsPerBar: project.bars > 0 ? drumHits / project.bars : 0,
    drumVoiceCounts,
    rhythmicDensity: total / seconds,
    onsetGridShare: { quarter: share(quarter), eighthOffbeat: share(eighth), sixteenth: share(sixteenth) },
    rhythmRegularity: drumHits > 0 ? drumQuarter / drumHits : 0,
    pitchRange: pitch,
    pitchClassHistogram: histogram,
    inKeyShare: pitches.length > 0 ? inKey / pitches.length : 0,
  };
}
