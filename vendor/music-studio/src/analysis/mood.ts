import { MOOD_BEST_TOLERANCE, MOOD_PASS_MIN, MOOD_RANGES, MOOD_WEIGHTS } from './targets';

export interface MoodMetrics {
  bpm: number;
  synthNotesPerBar: number;
  rhythmicDensity: number;
  centroidMedianHz: number;
  loudnessMovement: number;
  rhythmRegularity: number;
}

export interface MetricScore {
  value: number;
  ideal: readonly [number, number];
  outer: readonly [number, number];
  score: number;
}

export interface MoodScore {
  requested: string | null;
  role: string | null;
  best: 'hype' | 'playful' | 'lowkey';
  scores: { hype: number; playful: number; lowkey: number };
  pass: boolean | null;
  suggestions: string[];
  perMetric: Record<string, MetricScore>;
}

type MoodName = keyof typeof MOOD_RANGES;
type MetricName = keyof (typeof MOOD_RANGES)['hype'];

const METRIC_OF: Record<MetricName, (m: MoodMetrics) => number> = {
  bpm: (m) => m.bpm,
  density: (m) => m.rhythmicDensity,
  brightness: (m) => m.centroidMedianHz,
  loudnessMovement: (m) => m.loudnessMovement,
  regularity: (m) => m.rhythmRegularity,
};

function rangeScore(value: number, ideal: readonly [number, number], outer: readonly [number, number]): number {
  if (value >= ideal[0] && value <= ideal[1]) return 1;
  if (value < ideal[0]) {
    if (value <= outer[0] || ideal[0] === outer[0]) return 0;
    return (value - outer[0]) / (ideal[0] - outer[0]);
  }
  if (value >= outer[1] || ideal[1] === outer[1]) return 0;
  return (outer[1] - value) / (outer[1] - ideal[1]);
}

function moodScore(metrics: MoodMetrics, mood: MoodName): { total: number; per: Record<string, MetricScore> } {
  const ranges = MOOD_RANGES[mood];
  let total = 0;
  const per: Record<string, MetricScore> = {};
  (Object.keys(METRIC_OF) as MetricName[]).forEach((name) => {
    const range = ranges[name];
    const value = METRIC_OF[name](metrics);
    const score = rangeScore(value, range.ideal, range.outer);
    per[name] = { value, ideal: range.ideal, outer: range.outer, score };
    total += score * MOOD_WEIGHTS[name];
  });
  return { total, per };
}

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function suggestionsFor(metrics: MoodMetrics, mood: MoodName): string[] {
  const ranges = MOOD_RANGES[mood];
  const lines: string[] = [];
  const bpm = ranges.bpm;
  if (metrics.bpm < bpm.ideal[0] || metrics.bpm > bpm.ideal[1]) {
    const mid = Math.round((bpm.ideal[0] + bpm.ideal[1]) / 2);
    const dir = metrics.bpm > bpm.ideal[1] ? 'high' : 'low';
    lines.push(
      `BPM is ${dir} for ${mood}: ${num(metrics.bpm)}, ideal ${bpm.ideal[0]}-${bpm.ideal[1]}. musicStudio.run({ op: "set", bpm: ${mid} })`,
    );
  }
  const density = ranges.density;
  if (metrics.rhythmicDensity > density.ideal[1]) {
    lines.push(
      `Too busy for ${mood}: ${num(metrics.rhythmicDensity)} onsets/s, ideal ${density.ideal[0]}-${density.ideal[1]}. Reduce density (fewer hat/pluck steps) or lower BPM.`,
    );
  } else if (metrics.rhythmicDensity < density.ideal[0]) {
    lines.push(
      `Too empty for ${mood}: ${num(metrics.rhythmicDensity)} onsets/s, ideal ${density.ideal[0]}-${density.ideal[1]}. Add a few hat or pluck steps.`,
    );
  }
  const bright = ranges.brightness;
  if (metrics.centroidMedianHz > bright.ideal[1]) {
    lines.push(
      `Too bright for ${mood}: centroid ${num(metrics.centroidMedianHz)} Hz, ideal ${bright.ideal[0]}-${bright.ideal[1]} Hz. Lower a lowpass cutoff or drop the lead an octave.`,
    );
  } else if (metrics.centroidMedianHz < bright.ideal[0]) {
    lines.push(
      `Too dark for ${mood}: centroid ${num(metrics.centroidMedianHz)} Hz, ideal ${bright.ideal[0]}-${bright.ideal[1]} Hz. Open the filter or add a higher pluck.`,
    );
  }
  const move = ranges.loudnessMovement;
  if (metrics.loudnessMovement < move.ideal[0] || metrics.loudnessMovement > move.ideal[1]) {
    lines.push(
      `Loudness movement is ${num(metrics.loudnessMovement)} dB for ${mood}, ideal ${move.ideal[0]}-${move.ideal[1]} dB.`,
    );
  }
  const reg = ranges.regularity;
  if (metrics.rhythmRegularity < reg.ideal[0] || metrics.rhythmRegularity > reg.ideal[1]) {
    lines.push(
      `Drum regularity is ${num(metrics.rhythmRegularity)} for ${mood}, ideal ${reg.ideal[0]}-${reg.ideal[1]} (share of drum hits on quarter notes).`,
    );
  }
  return lines;
}

export function scoreMood(metrics: MoodMetrics, requestedMood?: string | null, role?: string | null): MoodScore {
  const names: MoodName[] = ['hype', 'playful', 'lowkey'];
  const scored = {
    hype: moodScore(metrics, 'hype'),
    playful: moodScore(metrics, 'playful'),
    lowkey: moodScore(metrics, 'lowkey'),
  };
  const scores = { hype: scored.hype.total, playful: scored.playful.total, lowkey: scored.lowkey.total };
  let best: MoodName = 'lowkey';
  for (const name of names) if (scores[name] > scores[best]) best = name;
  const requested = requestedMood && requestedMood in MOOD_RANGES ? (requestedMood as MoodName) : null;
  const pass = requested === null ? null : scores[requested] >= MOOD_PASS_MIN && scores[requested] >= scores[best] - MOOD_BEST_TOLERANCE;
  return {
    requested,
    role: role ?? null,
    best,
    scores,
    pass,
    suggestions: requested ? suggestionsFor(metrics, requested) : [],
    perMetric: requested ? scored[requested].per : scored[best].per,
  };
}
