import { mulberry32 } from '../model/rng';
import type { DrumParams, DrumVoice, Pattern, Project, SamplerParams, SynthParams, SynthVoice, Track } from '../model/types';

export interface MusicEvent {
  time: number;
  stepIndex: number;
  trackId: string;
  kind: 'drum' | 'synth' | 'sample';
  voice: DrumVoice | SynthVoice | 'sampler';
  params: DrumParams | SynthParams | SamplerParams;
  gainDb: number;
  pan: number;
  vel: number;
  duration: number;
  note?: number;
}

export function stepDuration(bpm: number): number {
  return 60 / bpm / 4;
}

function sectionNameAt(project: Project, bar: number): string | null {
  const structure = project.style?.structure ?? project.sections;
  if (!structure || structure.length === 0) return null;
  let cursor = 0;
  for (const section of structure) {
    if (bar >= cursor && bar < cursor + section.bars) return section.name;
    cursor += section.bars;
  }
  return structure[structure.length - 1]?.name ?? null;
}

function patternForBar(track: Track, project: Project, bar: number): Pattern | null {
  if (!track.arrangement || track.arrangement.length === 0) return track.pattern;
  const section = sectionNameAt(project, bar);
  if (!section) return track.pattern;
  const cell = track.arrangement.find((row) => row.section === section);
  if (!cell) return track.pattern;
  if (cell.slot === null) return null;
  const slot = track.slots?.find((row) => row.id === cell.slot || row.name === cell.slot);
  return slot?.pattern ?? track.pattern;
}

/** Timed note list for one loop. Swing delays every odd 16th. Shorter patterns tile. */
export function buildEvents(project: Project, bars: number): MusicEvent[] {
  const stepDur = stepDuration(project.bpm);
  const total = bars * 16;
  const anySolo = project.tracks.some((t) => t.solo);
  const rng = mulberry32(project.seed >>> 0);
  const events: MusicEvent[] = [];

  for (const track of project.tracks) {
    if (track.mute) continue;
    if (anySolo && !track.solo) continue;
    for (let i = 0; i < total; i++) {
      const bar = Math.floor(i / 16);
      const pattern = patternForBar(track, project, bar);
      if (!pattern) continue;
      const plen = pattern.length;
      const step = pattern.steps[i % plen];
      if (!step?.on) continue;
      const prob = step.prob ?? 1;
      if (prob < 1 && rng() >= prob) continue;
      let time = i * stepDur;
      if (i % 2 === 1) time += project.swing * stepDur;
      const notes = [step.note, ...(step.notes ?? [])].filter((note): note is number => note !== undefined);
      const emitted = notes.length > 0 ? notes : [undefined];
      for (const note of emitted) {
        events.push({
          time,
          stepIndex: i,
          trackId: track.id,
          kind: track.kind,
          voice: track.voice,
          params: track.params,
          gainDb: track.gainDb,
          pan: track.pan,
          vel: step.vel,
          duration: Math.max(0.02, step.len) * stepDur,
          note,
        });
      }
    }
  }

  events.sort((a, b) => a.time - b.time || (a.trackId < b.trackId ? -1 : a.trackId > b.trackId ? 1 : 0));
  return events;
}
