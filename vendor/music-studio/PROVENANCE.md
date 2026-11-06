# vendor/music-studio

A verbatim snapshot of `src/` from https://github.com/jestsayin96/music-studio
at commit `c236907` (v3.4.2), copied here on 2026-11-06.

**Do not edit anything under `src/`.** It is a copy. Changes belong upstream in the
music-studio repo, and are brought here by re-copying the tree and re-running the build.

Ashvale's own code is `entry.ts` beside this file, which re-exports only the handful of
things the game drives. `npm run build:music` bundles it to `vendor/music.bundle.js`
with esbuild, the same way three.js became `vendor/three.bundle.js`.

The studio has no runtime dependencies — it is plain Web Audio — which is why this works
at all. The only unresolvable imports are the `node:fs/promises` / `node:path` dynamic
imports in `src/samples/library.ts`, used by the studio's headless render CLI. The game
never loads samples, so they are marked external at build time and never execute.
