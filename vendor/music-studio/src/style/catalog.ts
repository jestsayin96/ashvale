import { RATING_VALUES } from '../io/ratings';
import { CUE_TYPES, SFX_NAMES } from '../score/cues';
import { APP_VERSION } from '../version';
import { PRESETS } from './batch';
import { moodCell, MOODS } from './matrix';
import { STYLES } from './styles';
import { MATCH_BRIGHTNESS_DEFAULT, VARIETY_MIN_DISTANCE } from './targets';

export function catalog() {
  return {
    version: APP_VERSION,
    styles: STYLES.map((style) => ({
      id: style.id,
      label: style.label,
      tempo: style.tempo,
      scales: style.scales.map((row) => row.id),
      defaultMood: style.defaultMood,
      moods: Object.fromEntries(MOODS.map((mood) => [mood, moodCell(style.id, mood).fit])),
      instruments: style.instruments,
      structure: style.structure,
      brightness: style.brightness,
      density: style.density,
    })),
    moods: [...MOODS],
    roles: ['bed', 'music', 'intro', 'outro'],
    lengthModes: ['loop', 'exact'],
    varietyGuard: ['warn', 'reseed', 'refuse', 'off'],
    varietyMinDistance: VARIETY_MIN_DISTANCE,
    sfxNames: [...SFX_NAMES],
    cueTypes: [...CUE_TYPES],
    presets: [...PRESETS],
    ratingValues: [...RATING_VALUES],
    matchProfile: ['bpm', 'brightnessHz', 'density', 'mood', 'key', 'lufs', 'role', 'seconds', 'loop', 'styleHint'],
    matchBrightnessDefault: { ...MATCH_BRIGHTNESS_DEFAULT },
    useRatings: true,
    preferences: ['total', 'styled', 'byStyle', 'byMood', 'byRole', 'bias', 'loved', 'avoid', 'hash'],
    defaults: {
      compose: { lengthMode: 'loop for bed/music, exact for intro/outro', varietyGuard: 'warn' },
      exportWav: { bitDepth: 16, pictures: false, uniqueSuffix: true },
      exportAll: { bitDepth: 16, uniqueSuffix: true },
      batch: { packaging: 'files', varietyGuard: 'reseed', delayMs: 500, download: true },
      scoreVideo: { bitDepth: 16, stems: true, pictures: true, sfxFiles: false, download: true },
    },
    limits: { tracks: 16, patternLength: [16, 2048], bpm: [60, 200], batchItems: 200 },
  };
}
