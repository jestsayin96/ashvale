/**
 * Every judgment threshold used by the listening report.
 * These are measurement cutoffs, not a claim about how the audio sounds.
 */

/** Click if the join's second-difference is this many times the loop's 99.9th percentile. */
export const CLICK_SCORE_LIMIT = 1.5;

/** Second-difference percentile floor so silence does not divide by zero. */
export const CLICK_PERCENTILE_FLOOR = 1e-6;

/** RMS floor (linear) when converting a window to dB. */
export const RMS_FLOOR = 1e-9;

/** A whole-file RMS below this is treated as silence. */
export const SILENCE_RMS = 1e-5;

/** Level windows used for the seam. Only 250 and 500 ms can fail the seam. */
export const SEAM_WINDOWS_MS = [50, 100, 250, 500] as const;

/** Level mismatch needs both long windows above max(this, baseline + SEAM_BASELINE_MARGIN_DB). */
export const SEAM_LEVEL_DB = 6;
export const SEAM_BASELINE_MARGIN_DB = 3;
export const SEAM_BASELINE_WINDOW_MS = 250;
export const SEAM_BASELINE_PERCENTILE = 0.95;

/** Loops shorter than this use the original 50 ms check. */
export const SEAM_MIN_SECONDS = 1;

/** Click wrap length. */
export const SEAM_WRAP_MS = 20;

/** Speech-band energy fractions for bed and outro. */
export const SPEECH_PASS_MAX = 0.4;
export const SPEECH_WARN_MAX = 0.55;
export const SPEECH_BAND_HZ: readonly [number, number] = [300, 3000];

/**
 * Short-term loudness windows.
 * Loops of 6 s or longer use 3 s windows hopped 1 s (BS.1770 short-term size).
 * Shorter loops use 1 s windows hopped 0.5 s so a 2–5 s sting still has a series.
 */
export const LOUDNESS_LONG_MIN_SECONDS = 6;
export const LOUDNESS_LONG_WINDOW_S = 3;
export const LOUDNESS_LONG_HOP_S = 1;
export const LOUDNESS_SHORT_WINDOW_S = 1;
export const LOUDNESS_SHORT_HOP_S = 0.5;

export const FFT_SIZE = 2048;
export const FFT_HOP = 512;
export const CENTROID_WINDOW_S = 1;

export const BANDS = {
  sub: [0, 120],
  low: [120, 300],
  speech: [300, 3000],
  presence: [3000, 8000],
  air: [8000, 24000],
} as const;

/** Median MIDI register cutoffs. low < 52 <= mid < 72 <= high. */
export const REGISTER_LOW_MAX_MIDI = 52;
export const REGISTER_MID_MAX_MIDI = 72;

/** Tempo words. slow < 90, medium <= 125, fast above that. */
export const TEMPO_SLOW_MAX = 90;
export const TEMPO_MEDIUM_MAX = 125;

/** Median spectral centroid words, in Hz. */
export const BRIGHTNESS_DARK_MAX_HZ = 1200;
export const BRIGHTNESS_BALANCED_MAX_HZ = 3000;

/** p95-p10 loudness movement words, in dB. */
export const MOVEMENT_STEADY_MAX_DB = 1.5;
export const MOVEMENT_MOVING_MAX_DB = 4;

/** Onsets per second words. */
export const DENSITY_SPARSE_MAX = 2.5;
export const DENSITY_MODERATE_MAX = 6;

/**
 * Stereo labels from 10*log10(side/mid).
 * mono-like at or below -15 dB, narrow at or below -6 dB, wide at or above 0 dB, otherwise moderate.
 * Correlation <= 0 also forces wide. Correlation >= 0.98 also forces mono-like.
 */
export const STEREO_MONO_WIDTH_DB = -15;
export const STEREO_NARROW_WIDTH_DB = -6;
export const STEREO_WIDE_WIDTH_DB = 0;
export const STEREO_MONO_CORRELATION = 0.98;

export const MOOD_PASS_MIN = 0.65;
export const MOOD_BEST_TOLERANCE = 0.05;

export const MOOD_WEIGHTS = {
  bpm: 0.25,
  density: 0.25,
  brightness: 0.2,
  loudnessMovement: 0.15,
  regularity: 0.15,
} as const;

/** Ideal range, then the outer range where the score falls to 0. */
export const MOOD_RANGES = {
  hype: {
    bpm: { ideal: [140, 160], outer: [120, 180] },
    density: { ideal: [6, 12], outer: [3.5, 16] },
    brightness: { ideal: [2000, 4500], outer: [1000, 6500] },
    loudnessMovement: { ideal: [1, 5], outer: [0, 8] },
    regularity: { ideal: [0.25, 0.5], outer: [0.1, 0.7] },
  },
  playful: {
    bpm: { ideal: [100, 125], outer: [85, 140] },
    density: { ideal: [3.5, 7], outer: [2, 10] },
    brightness: { ideal: [1500, 3500], outer: [800, 5000] },
    loudnessMovement: { ideal: [1, 6], outer: [0, 9] },
    regularity: { ideal: [0.15, 0.35], outer: [0, 0.55] },
  },
  lowkey: {
    bpm: { ideal: [65, 90], outer: [55, 105] },
    density: { ideal: [1, 3.5], outer: [0.3, 5] },
    brightness: { ideal: [400, 1800], outer: [200, 2800] },
    loudnessMovement: { ideal: [0, 2.5], outer: [0, 5] },
    regularity: { ideal: [0.3, 0.6], outer: [0.1, 0.8] },
  },
} as const;

export const SPECTROGRAM_HZ: readonly [number, number] = [40, 16000];
export const SPECTROGRAM_ROWS = 128;
export const SPECTROGRAM_COLS = 240;
export const WAVEFORM_COLUMNS = 600;
