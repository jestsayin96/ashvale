/**
 * Convert project sample hits (incredibox layers) into ScoreEvents for pureBackend.
 */

import { buildEvents, type MusicEvent } from '../audio/events';
import type { SamplerParams } from '../model/types';
import type { Project } from '../model/types';
import { getCachedLibrary } from '../samples/library';
import { parseRootToMidi, pitchSemisToKey } from '../samples/pitch';
import type { Bus, ScoreEvent } from './plan';

function busForGroup(group: SamplerParams['group']): Bus {
  if (group === 'beat') return 'drums';
  if (group === 'effects') return 'sfx';
  if (group === 'melody') return 'harmony';
  return 'melody';
}

export function musicSampleToScoreEvent(
  ev: MusicEvent,
  id: string,
  key?: { root: number; scale: import('../model/types').Scale },
): ScoreEvent | null {
  if (ev.kind !== 'sample') return null;
  const p = ev.params as SamplerParams;
  if (!p.sampleId) return null;
  let pitchSemis = p.pitchSemis;
  const loaded = getCachedLibrary().get(p.sampleId);
  if (key && loaded?.meta.root !== undefined) {
    const rootMidi = parseRootToMidi(loaded.meta.root) ?? loaded.meta.rootMidi;
    pitchSemis += pitchSemisToKey(rootMidi, key.root, key.scale);
  }
  return {
    id,
    bus: busForGroup(p.group),
    voice: 'sampler',
    time: ev.time,
    duration: Math.max(0.04, ev.duration),
    note: ev.note,
    vel: ev.vel,
    params: {
      levelDb: ev.gainDb,
      sampleId: p.sampleId,
      rootMidi: p.rootMidi,
      pitchSemis,
      fineCents: p.fineCents,
      start: p.start,
      end: p.end,
      loop: p.loop,
      loopStart: p.loopStart,
      loopEnd: p.loopEnd,
      gainDb: p.gainDb,
      adsr: p.adsr,
      role: p.group,
    },
  };
}

/** Sample-kind hits from a styled project, clipped to maxSeconds. */
export function sampleScoreEventsFromProject(project: Project, maxSeconds: number): ScoreEvent[] {
  const events = buildEvents(project, project.bars);
  const out: ScoreEvent[] = [];
  let n = 0;
  for (const ev of events) {
    if (ev.time >= maxSeconds) continue;
    const scored = musicSampleToScoreEvent(ev, `sample-${n++}`, project.key);
    if (!scored) continue;
    const remain = maxSeconds - scored.time;
    scored.duration = Math.min(scored.duration, Math.max(0.02, remain));
    out.push(scored);
  }
  return out;
}

export function countSamplesUsed(events: ScoreEvent[]): Record<string, number> {
  const used: Record<string, number> = {};
  for (const event of events) {
    const id = event.params.sampleId;
    if (!id) continue;
    used[id] = (used[id] ?? 0) + 1;
  }
  return used;
}
