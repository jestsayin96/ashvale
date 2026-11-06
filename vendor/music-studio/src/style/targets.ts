/** Thresholds for styled composition. Mirrored in docs/STYLES.md. */

/** Pairs closer than this are too similar. Calibrated so identical is 0, a 3 BPM identity pair fails, and 100 seeds of one cell mostly pass. */
export const VARIETY_MIN_DISTANCE = 0.16;

export const VARIETY_RESEED_LIMIT = 12;
export const VARIETY_LOG_CAP = 2000;
export const FINGERPRINT_KEY = 'musicStudio.fingerprints.v1';

/** Sequential notes of one voice may touch. Overlap past this many seconds fails the plan check. */
export const SAME_VOICE_OVERLAP_MAX_SEC = 0.02;

export const EXACT_FADE_MS_DEFAULT = 400;
export const EXACT_FADE_MS_MIN = 80;
export const EXACT_END_SAMPLE_ABS = 0.001;
export const EXACT_END_RMS_DB = -60;

export const LOOP_LENGTH_TOLERANCE = 0.08;
export const LOOP_BPM_STEP = 0.5;

export const MOTIF_MAX_NOTES = 4;
export const MELODY_DISTINCT_MIN = 150;
export const MELODY_SEED_COUNT = 200;

export const TRACK_LIMIT = 16;
export const PATTERN_LENGTH_MAX = 2048;

export const BATCH_ITEM_CAP = 200;
export const FILL_LIBRARY_COUNT = 20;

/** Bass-excluded centroid defaults when a profile omits brightnessHz. Medians of the CC0 set were 1163, 483, and 765. */
export const MATCH_BRIGHTNESS_DEFAULT = { hype: 1100, playful: 600, lowkey: 700 } as const;

/** Weights for profile distance. Each term is already scaled into 0..1 before multiplying. */
export const MATCH_WEIGHT = { bpm: 0.35, brightness: 0.25, density: 0.15, mood: 0.15, hint: 0.1, native: 0.12 } as const;

export const MATCH_TRIES_DEFAULT = 6;

/** Layered-loops (incredibox) recipe. */
export const LAYER_MAX_SIMULTANEOUS = 8;
export const LAYER_MAX_CHANGES_PER_BOUNDARY = 2;
export const LAYER_BRIGHTNESS = [0.15, 0.45] as const;
export const LAYER_REVERB_SEND = 0.35;
export const LAYER_DELAY_SEND = 0.18;

/** Static gain trim ceiling for stem/mix exports (BS.1770-4 true peak). */
export const TRUE_PEAK_CEILING_DBTP = -1;

/** Low-key / calm mood targets. */
/** Keep ≤90 so scoreMood lowkey BPM ideal [65,90] can fully pass. */
export const LOWKEY_BPM = [70, 88] as const;
export const LOWKEY_LOWPASS_HZ = [2500, 4500] as const;
export const LOWKEY_MONO_BELOW_HZ = 150;
export const LOWKEY_PAD_WIDTH = 0.35;
export const LOWKEY_HAAS_MS = 12;
