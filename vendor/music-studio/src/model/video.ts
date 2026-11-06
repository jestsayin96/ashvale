import { applyMood } from './moods';
import { emptyStep } from './defaults';
import { SCALE_INTERVALS } from './scales';
import type { Bars, Pattern, Project, Scale, Step, Track, VideoRole } from './types';
import { BAR_VALUES } from './types';

export const ORIGIN_NOTE =
  'Original audio synthesized in Music Studio. No samples and no borrowed recordings. A platform can still flag a coincidence, so keep this project file and the export report with the WAV.';

export interface VideoBrief {
  role: VideoRole;
  mood: 'hype' | 'playful' | 'lowkey';
  seconds: number;
  seed?: number;
  name?: string;
}

const MOOD_BPM = { hype: 150, playful: 110, lowkey: 80 } as const;

/** Scale-degree indexes, one chord per bar of the 4-bar phrase. */
const PROGRESSION: Record<VideoBrief['mood'], number[]> = {
  hype: [0, 5, 3, 6],
  playful: [0, 4, 5, 3],
  lowkey: [0, 3, 4, 2],
};

const ROLE_LABEL: Record<VideoRole, string> = {
  bed: 'Voice bed',
  music: 'Theme',
  intro: 'Intro',
  outro: 'Outro',
};

export function loopSeconds(bars: number, bpm: number): number {
  return (bars * 4 * 60) / bpm;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Pick a legal bar count and tempo so the loop is as close as possible to the request. */
export function fitLoop(seconds: number, moodBpm: number, role: VideoRole): { bars: Bars; bpm: number; seconds: number } {
  let want = seconds;
  if (role === 'intro') want = clamp(want, 2, 8);
  else if (role === 'outro') want = clamp(want, 4, 16);
  else want = clamp(want, 8, 120);

  let best = { bars: 4 as Bars, bpm: moodBpm, seconds: loopSeconds(4, moodBpm), score: Infinity };
  for (const bars of BAR_VALUES) {
    const raw = Math.round((bars * 4 * 60) / want);
    const bpm = clamp(raw, 60, 200);
    const actual = loopSeconds(bars, bpm);
    const timeErr = Math.abs(actual - want) / want;
    const tempoErr = Math.abs(bpm - moodBpm) / 200;
    const score = timeErr * 10 + tempoErr;
    if (score < best.score) best = { bars, bpm, seconds: actual, score };
  }
  return { bars: best.bars, bpm: best.bpm, seconds: best.seconds };
}

function degreeToMidi(root: number, scale: Scale, degree: number, center: number): number {
  const iv = SCALE_INTERVALS[scale];
  const len = iv.length;
  const norm = ((degree % len) + len) % len;
  const oct = Math.floor(degree / len);
  let midi = root + iv[norm] + oct * 12;
  while (midi < center - 7) midi += 12;
  while (midi > center + 7) midi -= 12;
  return midi;
}

function blank(length: 64): Step[] {
  return Array.from({ length }, () => emptyStep());
}

function tileDrums(pattern: Pattern, role: VideoRole, voice: string): Pattern {
  const steps = blank(64);
  for (let i = 0; i < 64; i++) {
    const src = pattern.steps[i % pattern.length];
    const step: Step = { ...src };
    const bar = Math.floor(i / 16);
    const pos = i % 16;
    if (role === 'intro' && bar >= 2) step.on = false;
    if (role === 'outro' && bar === 3 && pos > 8 && voice !== 'kick') step.on = false;
    if (role === 'bed' && (voice === 'hatClosed' || voice === 'hatOpen' || voice === 'snare' || voice === 'clap')) {
      step.vel = Math.min(1, step.vel * 0.72);
    }
    if (voice === 'tom' && bar === 3 && pos >= 12 && role !== 'bed') {
      step.on = true;
      step.vel = Math.min(1, 0.4 + (pos - 12) * 0.1);
      step.len = 1;
    }
    steps[i] = step;
  }
  return { length: 64, steps };
}

function writeHarmony(track: Track, project: Project, mood: VideoBrief['mood'], role: VideoRole): Pattern {
  const steps = blank(64);
  const root = ((project.key.root % 12) + 12) % 12;
  const scale = project.key.scale;
  const prog = PROGRESSION[mood];
  const voice = track.voice;
  for (let bar = 0; bar < 4; bar++) {
    if (role === 'intro' && bar >= 2) continue;
    const degree = prog[bar];
    const at = bar * 16;
    if (voice === 'bass') {
      steps[at] = { on: true, note: degreeToMidi(root, scale, degree, 43), vel: role === 'bed' ? 0.7 : 0.84, len: 14 };
    } else if (voice === 'pad') {
      steps[at] = { on: true, note: degreeToMidi(root, scale, degree + 2, 58), vel: role === 'bed' ? 0.42 : 0.55, len: 12 };
    } else if (voice === 'pluck') {
      const slots = role === 'bed' || role === 'outro' ? [4, 12] : [2, 6, 10, 14];
      slots.forEach((pos, n) => {
        if (role === 'outro' && bar === 3) return;
        steps[at + pos] = {
          on: true,
          note: degreeToMidi(root, scale, degree + (n % 3) * 2, 67),
          vel: role === 'bed' ? 0.38 : 0.62,
          len: 2,
        };
      });
    } else {
      const slots = role === 'bed' ? [0, 8] : role === 'outro' ? [0] : [0, 4, 8, 12];
      slots.forEach((pos, n) => {
        if (role === 'outro' && bar === 3) return;
        steps[at + pos] = {
          on: true,
          note: degreeToMidi(root, scale, degree + n * 2, role === 'bed' ? 64 : 72),
          vel: role === 'bed' ? 0.4 : 0.7,
          len: role === 'bed' ? 3 : 4,
        };
      });
    }
  }
  return { length: 64, steps };
}

/**
 * Build a video loop from a mood. Same seed always makes the same project.
 * Speech-under beds sit near −20 LUFS with the speech pocket on.
 * Music-only themes sit near −16 LUFS.
 */
export function composeForVideo(project: Project, brief: VideoBrief): Project {
  const seed = (brief.seed ?? project.seed ?? 1) >>> 0;
  const moodProject = applyMood(project, brief.mood, seed);
  const fit = fitLoop(brief.seconds, MOOD_BPM[brief.mood], brief.role);
  const tracks = moodProject.tracks.map((track) => {
    const next: Track = {
      ...track,
      pattern: track.kind === 'drum'
        ? tileDrums(track.pattern, brief.role, track.voice)
        : writeHarmony(track, moodProject, brief.mood, brief.role),
    };
    if (brief.role === 'bed' && (track.voice === 'lead' || track.voice === 'pluck' || track.voice === 'hatOpen')) {
      next.gainDb = Math.max(-24, track.gainDb - 4);
    }
    if (brief.role === 'music' && track.voice === 'lead') {
      next.gainDb = Math.min(6, track.gainDb + 1);
    }
    return next;
  });

  const speech = brief.role === 'bed' || brief.role === 'outro';
  const targetLufs = brief.role === 'bed' ? -20 : brief.role === 'outro' ? -18 : -16;
  const name = brief.name?.trim() || `${ROLE_LABEL[brief.role]} · ${brief.mood}`;

  return {
    ...moodProject,
    name,
    bpm: fit.bpm,
    bars: fit.bars,
    seed,
    tracks,
    master: {
      ...moodProject.master,
      speechPocket: speech,
      speechDipDb: brief.role === 'bed' ? -6 : brief.role === 'outro' ? -4 : -5,
      targetLufs,
    },
    origin: {
      synthesized: true,
      samples: false,
      role: brief.role,
      requestedSeconds: brief.seconds,
      loopSeconds: Math.round(fit.seconds * 100) / 100,
    },
  };
}

export function describeProject(project: Project): string {
  const keyNames = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const root = keyNames[((project.key.root % 12) + 12) % 12];
  const seconds = project.origin?.loopSeconds ?? loopSeconds(project.bars, project.bpm);
  const pocket = project.master.speechPocket ? 'speech pocket on' : 'speech pocket off';
  const style = project.style ? ` Style ${project.style.id}.` : '';
  return `${project.name}: ${seconds.toFixed(1)}s, ${project.bpm} BPM, ${project.bars} bars, ${root} ${project.key.scale}, target ${project.master.targetLufs} LUFS, ${pocket}, seed ${project.seed}.${style}`;
}
