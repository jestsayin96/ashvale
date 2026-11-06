export interface VoiceSpec {
  wave: 'sine' | 'sawtooth' | 'square' | 'triangle';
  cutoffHz: number;
  q: number;
  filterEnvHz: number;
  detuneCents: number;
  octaveShift: number;
  partials: number[];
  noiseHighpassHz: number;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function rising(brightness: number, low: number, high: number): number {
  return low + clamp01(brightness) * (high - low);
}

/** One spec for the browser voices and the pure stand-in. Cutoff and partial count rise with brightness. */
export function voiceSpec(voice: string, _note: number | undefined, brightness = 0.5, _mood?: string): VoiceSpec {
  const b = clamp01(brightness);
  const partialCount = Math.max(1, Math.round(1 + b * 8));
  const partials = Array.from({ length: partialCount }, (_, index) => 1 / (index + 1));
  if (voice === 'hat' || voice === 'hatOpen' || voice === 'crash' || voice === 'ride' || voice === 'shaker') {
    return {
      wave: 'square',
      cutoffHz: rising(b, 4000, 12000),
      q: 0.7,
      filterEnvHz: rising(b, 500, 2000),
      detuneCents: 0,
      octaveShift: 0,
      partials: [1],
      noiseHighpassHz: rising(b, 3500, 8000),
    };
  }
  if (voice === 'kick' || voice === 'bass808') {
    return {
      wave: 'sine',
      cutoffHz: rising(b, 80, 240),
      q: 0.7,
      filterEnvHz: 40,
      detuneCents: 0,
      octaveShift: 0,
      partials: [1, 0.15],
      noiseHighpassHz: 0,
    };
  }
  if (voice === 'bass' || voice === 'reese' || voice === 'pickBass') {
    return {
      wave: voice === 'pickBass' ? 'square' : 'sawtooth',
      cutoffHz: rising(b, 180, 1400),
      q: 0.8,
      filterEnvHz: rising(b, 40, 400),
      detuneCents: voice === 'reese' ? 8 : 3,
      octaveShift: 0,
      partials,
      noiseHighpassHz: 0,
    };
  }
  if (voice === 'pad' || voice === 'stringPad') {
    return {
      wave: 'sawtooth',
      cutoffHz: rising(b, 220, 1800),
      q: 0.6,
      filterEnvHz: rising(b, 20, 200),
      detuneCents: 6,
      octaveShift: 0,
      partials,
      noiseHighpassHz: 0,
    };
  }
  if (voice === 'pluck' || voice === 'kalimba') {
    return {
      wave: 'triangle',
      cutoffHz: rising(b, 800, 9000),
      q: 1.2,
      filterEnvHz: rising(b, 400, 2500),
      detuneCents: 2,
      octaveShift: 0,
      partials,
      noiseHighpassHz: 0,
    };
  }
  if (voice === 'bell') {
    const bellPartials = [1, 0.6 * (0.4 + b), 0.25 * b, 0.12 * b].filter((value) => value > 0.02);
    return {
      wave: 'sine',
      cutoffHz: rising(b, 1500, 8000),
      q: 2,
      filterEnvHz: 0,
      detuneCents: 0,
      octaveShift: 0,
      partials: bellPartials,
      noiseHighpassHz: 0,
    };
  }
  if (voice === 'pulse' || voice === 'chipNoise') {
    return {
      wave: 'square',
      cutoffHz: rising(b, 1800, 9000),
      q: 0.8,
      filterEnvHz: rising(b, 200, 1600),
      detuneCents: 0,
      octaveShift: 0,
      partials,
      noiseHighpassHz: voice === 'chipNoise' ? rising(b, 2000, 7000) : 0,
    };
  }
  if (voice === 'strings') {
    return {
      wave: 'sawtooth',
      cutoffHz: rising(b, 400, 3200),
      q: 0.6,
      filterEnvHz: rising(b, 40, 400),
      detuneCents: 8,
      octaveShift: 0,
      partials,
      noiseHighpassHz: 0,
    };
  }
  if (voice === 'pizz') {
    return {
      wave: 'triangle',
      cutoffHz: rising(b, 900, 7000),
      q: 1,
      filterEnvHz: rising(b, 300, 1800),
      detuneCents: 0,
      octaveShift: 0,
      partials,
      noiseHighpassHz: 0,
    };
  }
  if (voice === 'sub808' || voice === 'kick808') {
    return {
      wave: 'sine',
      cutoffHz: rising(b, 70, 220),
      q: 0.7,
      filterEnvHz: 30,
      detuneCents: 0,
      octaveShift: 0,
      partials: [1, 0.1],
      noiseHighpassHz: 0,
    };
  }
  if (voice === 'snareTight') {
    return {
      wave: 'triangle',
      cutoffHz: rising(b, 800, 5000),
      q: 0.9,
      filterEnvHz: 200,
      detuneCents: 0,
      octaveShift: 0,
      partials: [1],
      noiseHighpassHz: rising(b, 1500, 5000),
    };
  }
  if (voice === 'brass' || voice === 'brassStab') {
    return {
      wave: 'sawtooth',
      cutoffHz: rising(b, 900, 5000),
      q: 0.9,
      filterEnvHz: rising(b, 200, 1800),
      detuneCents: 4,
      octaveShift: 0,
      partials,
      noiseHighpassHz: 0,
    };
  }
  return {
    wave: 'sawtooth',
    cutoffHz: rising(b, 1500, 7000),
    q: 0.7,
    filterEnvHz: rising(b, 200, 2200),
    detuneCents: 6,
    octaveShift: 0,
    partials,
    noiseHighpassHz: 0,
  };
}
