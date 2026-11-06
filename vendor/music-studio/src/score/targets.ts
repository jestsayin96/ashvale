/**
 * Thresholds for the video-scoring studio.
 * Mirrored in docs/CUE_SHEET.md and docs/AI_GUIDE.md.
 * Numbers are pass/fail gates for measurements, not opinions about sound.
 */

/** Music accent is skipped when the nearest 1/8-beat is farther than this. */
export const MUSIC_SNAP_MAX_MS = 20;

/** Hard boundaries and SFX impacts must land within this many samples. */
export const SYNC_MAX_ERROR_SAMPLES = 1;

/** Measured SFX-stem onset may miss the cue by at most this many milliseconds. */
export const MEASURED_ONSET_MAX_MS = 5;

/** Search window for the measured onset peak. */
export const ONSET_SEARCH_MS = 40;

/** RMS envelope window used to locate an SFX peak. */
export const ONSET_WINDOW_MS = 2;

/** Onset front uses a 1 ms RMS envelope and the first sample at 50% of that window's maximum. */
export const ONSET_FRONT_MS = 1;

/** Kill-sting peaks must rise by at least this many dB. */
export const KILL_STING_RISE_DB = 0.3;

/** Short-term loudness warning gate. Staging is tuned to stay under it. */
export const SHORT_TERM_MAX_LUFS = -14;

/** Mood base tempos (bpm) used when the sheet does not lock one tempo. */
export const MOOD_BASE_BPM = {
  hype: 150,
  playful: 110,
  lowkey: 80,
  tension: 100,
  victory: 130,
  sad: 40,
} as const;

/** Section bpm must stay inside [factorLo, factorHi] times the mood base. */
export const TEMPO_FACTOR_LO = 0.75;
export const TEMPO_FACTOR_HI = 1.35;

/** A section shorter than 2 beats at the minimum bpm is free-time. */
export const MIN_BEATS = 2;

/** Fixed-tempo music snaps to this subdivision (1/8 note). */
export const SNAP_DIVISION = 8;

export const DEFAULT_KEY_ROOT = 9;
export const DEFAULT_SCALE = 'minor' as const;

/** Stop-time mute begins this many seconds before a death cue. */
export const DEATH_MUTE_LEAD_S = 0.15;

/** Jumpscare silence immediately before the hit. */
export const JUMPSCARE_SILENCE_S = 0.1;

/** Clutch stop-time before the hype entry. */
export const CLUTCH_STOP_S = 0.3;

/** Final fade so the last sample is about 0. */
export const DEFAULT_END_FADE_MS = 30;

export const DEFAULT_MUSIC_LUFS = -18;
export const DEFAULT_TARGET_LUFS = -16;
export const DEFAULT_CEILING_DBTP = -1;
export const DEFAULT_DUCK_DB = -10;
export const DUCK_DB_MIN = -14;
export const DUCK_DB_MAX = -8;
export const DEFAULT_SPEECH_DIP_DB = -6;

export const TALKING_ATTACK_MS = 40;
export const TALKING_RELEASE_MS = 300;
export const SFX_DUCK_ATTACK_MS = 20;
export const SFX_DUCK_RELEASE_MS = 250;
export const SPEECH_BLEND_MS = 100;

/** Sidechain under kicks. */
export const SIDECHAIN_DEPTH_DB = -4;
export const SIDECHAIN_DEPTH_MIN_DB = -5;
export const SIDECHAIN_DEPTH_MAX_DB = -3;
export const SIDECHAIN_RELEASE_MS = 120;

/** SFX stem sits this many dB above the music-stem target. */
export const SFX_RELATIVE_DB = 1.5;

export const SAMPLE_RATE = 44100;
export const SEGMENT_SECONDS = 20;
export const SEGMENT_TAIL_SECONDS = 3;

/** Per-cue analysis windows. */
export const CUE_WINDOW_MAX_S = 8;

export const SAD_TEMPO_MAX = 80;
export const SAD_DENSITY_MAX = 2.5;
export const SAD_CENTROID_MAX_HZ = 1800;

export const CALM_DENSITY_MAX = 3.5;
export const CALM_LEVEL_BELOW_LOUDEST_DB = 3;

export const TALKING_BELOW_PREVIOUS_DB = 8;
export const TALKING_SPEECH_SHARE_MAX = 0.4;

export const HYPE_DENSITY_MIN = 5;
export const HYPE_CENTROID_MIN_HZ = 2000;
export const HYPE_LEVEL_ABOVE_CALM_DB = 2;

export const DEATH_GAP_RMS_DB = -45;
export const DEATH_TEMPO_RATIO = 0.6;

export const FUNNY_CENTROID_MIN_HZ = 1200;

/**
 * Power centroid of bins at or above 150 Hz, median over 1 s music-stem windows.
 * The full-band centroid is kept for reference and is not a gate.
 */
export const BRIGHTNESS_FLOOR_HZ = 150;
export const HYPE_BRIGHTNESS_MIN_HZ = 1000;
export const FUNNY_BRIGHTNESS_MIN_HZ = 900;
export const SAD_BRIGHTNESS_MAX_HZ = 1800;
export const HIGH_BAND_HZ = 2000;
export const HIGH_BAND_SHARE_MIN = 0.01;

/** Short-term staging targets before the final integrated pass. */
export const SECTION_TARGET_LUFS = {
  talking: -26,
  calm: -22,
  sad: -23,
  tension: -20,
  funny: -20,
  playful: -20,
  hype: -17.5,
  multikill: -17.5,
  victory: -17.5,
  outro: -24,
  default: -20,
} as const;

export const SECTION_SPREAD_MAX_DB = 12;
export const TALKING_BELOW_MAX_DB = 20;
export const SECTION_BOOST_MAX_DB = 12;
export const SECTION_FADE_MS = 150;

/** Music returns are muted with the music stem. SFX returns are not. */
export const MUTES_INCLUDE_MUSIC_RETURNS = true;

export const HIT_LEVEL_STEP_DB = 4;
export const HIT_TIME_MS = 5;

export const OUTRO_TAIL_S = 2;
export const OUTRO_LAST_SAMPLE = 0.001;

export const MULTIKILL_MIN_GAP_S = 0.25;
export const MULTIKILL_DEFAULT_GAP_S = 0.45;
export const MULTIKILL_DEFAULT_COUNT = 3;

/** Section level offsets, dB, from intensity 0 to 1. */
export const LEVEL_OFFSET_DB = {
  calm: [-3, -1],
  hype: [1, 3],
} as const;

export const LOUDNESS_TOLERANCE_LU = 0.5;

/** Voices whose rendered peak is measured against the cue time. */
export const IMPACT_VOICES = [
  'impact',
  'stinger_a',
  'stinger_b',
  'stinger_c',
  'kill_sting',
  'jumpscare_hit',
  'sub_drop',
] as const;

export const DEFAULT_BUS_MIX = {
  drums: { gainDb: -1, pan: 0, reverbSend: 0.08, delaySend: 0.02, saturation: 0.15 },
  bass: { gainDb: -2, pan: 0, reverbSend: 0.02, delaySend: 0, saturation: 0.2 },
  harmony: { gainDb: -4, pan: 0, reverbSend: 0.28, delaySend: 0.08, saturation: 0.08 },
  melody: { gainDb: -3, pan: 0.08, reverbSend: 0.16, delaySend: 0.12, saturation: 0.1 },
  sfx: { gainDb: 0, pan: 0, reverbSend: 0.12, delaySend: 0.04, saturation: 0.08 },
} as const;
