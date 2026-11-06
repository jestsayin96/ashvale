/* Ashvale's own file. The only thing the game needs from the studio is the ability to
   fire one of its effects into an AudioContext; the sequencer, UI and sample library
   stay out of the bundle. */
export { playSfx, listSfxNames } from './src/audio/sfx/sfx';
export { SFX_NAMES } from './src/score/cues';
