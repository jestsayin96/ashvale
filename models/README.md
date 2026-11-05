# models/

Drop `.glb` files in here and the 3D view picks them up. Nothing in this folder is
required: with no `manifest.json`, the game renders the procedural boxes-and-cones
version and says nothing about it. The published Claude artifact has no `models/`
at all, so it always runs procedural — this folder only affects the GitHub Pages build.

## manifest.json

```json
{
  "cap": 20,
  "buildings": { "house": "cottage.glb", "hall": "town-hall.glb" },
  "characters": { "man": "peasant-man.glb", "woman": "peasant-girl.glb",
                  "guard": "castle-guard.glb", "adventurer": "knight.glb" },
  "roles":      { "nobleman": "man", "noblewoman": "woman", "child": "woman" },
  "animations": "animations.glb",
  "clips": { "idle": "Idle", "walk": "Walking", "attack": "Sword Slash", "die": "Dying" }
}
```

- **buildings** — keys are building kinds from `BK` in `src/game.js`: `hall guild school
  bank guard altar smith fletch apoth store tailor tavern rose manor house gate`.
  Any kind you leave out keeps its procedural box and roof.
- **characters** — keys are roles: `man woman child guard adventurer nobleman noblewoman
  default`. A missing role falls back through `roles` -> `man`/`woman` -> `default` ->
  the simple figure.
- **roles** — aliases, so one model can cover several roles without duplicating the file.
- **animations** — one `.glb` holding the clips. Mixamo characters all share a skeleton,
  so a single animation file retargets onto every Mixamo character automatically.
- **clips** — maps the four slots the game uses onto the clip names inside that file.
  Run with no `clips` and the raw clip names are used as-is.

## What a model has to satisfy

| | |
|---|---|
| format | `.glb` (binary glTF, textures embedded) |
| axis | Y up, Z forward |
| units | metres |
| character origin | between the feet, at floor level |
| building origin | anywhere — the loader recentres on the footprint and sits it on the ground |
| character height | anything; it is rescaled to 1.7 m (1.2 m for children) |
| building size | anything; it is scaled to fit the footprint in `BK` |
| budget | keep each under ~3 MB. 20 animated characters is the default cap (`cap`) |

Scale and position are corrected on load, so an export that is 100x too big or
offset from the origin still works. Rotation is not corrected: if a character faces
sideways in-game, fix the orientation in Blender and re-export.

Character height is measured from the **skeleton**, not from the mesh's bounding box.
A SkinnedMesh's `Box3` is computed in bind space and can be badly wrong -- the Xbot
test model reports 0.018 units for a rig that is really 1.78 -- which would scale it
up ninety-fold into a giant filling the screen. Bone positions are always honest, so
that is what the loader trusts, with the final scale clamped as a backstop.

## Mixamo

1. Pick a character, **Download** -> FBX Binary, **With Skin**, T-pose.
2. Pick the animations once (idle, walk, attack, die), **Without Skin**.
3. In Blender import the character, import each animation, push each down as an
   action, then export glTF 2.0 with "Include animations".
4. The character goes in `characters`, the action file in `animations`.

Because every Mixamo rig shares bone names, step 2 and 3 are done **once** and the
result is reused by every Mixamo character you add.
