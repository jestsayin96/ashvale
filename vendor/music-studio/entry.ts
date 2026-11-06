/* Ashvale's own file - the only thing under vendor/music-studio that we write.
   It re-exports the handful of things the game drives: the effects catalogue, and
   enough of the studio to generate and play a score. The sequencer UI, the sample
   library and the offline render path stay out of the bundle. */
export { playSfx, listSfxNames } from './src/audio/sfx/sfx';
export { SFX_NAMES } from './src/score/cues';
export { AudioEngine } from './src/audio/engine';
export { applyMood } from './src/model/moods';
export { newProject } from './src/model/defaults';
