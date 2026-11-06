# Ashvale & Dragon's Keep — autonomous work log

Artifact: https://claude.ai/artifact/X37GpEyLFrXV7wwn9wzkQr
Project:  /home/claude/ashvale   (the single file at /home/claude/town/town.html is RETIRED)
Repo:     https://github.com/jestsayin96/ashvale  (origin/main)
Pages:    https://jestsayin96.github.io/ashvale/  LIVE, redeploys on every push to main

Edit src/game.js, src/style.css, src/body.html. Never edit dist/ by hand.
  node --check src/game.js && node tools/build.mjs && python3 -I tools/shot.py
Publish the artifact from dist/artifact.html (the build already escapes non-ASCII).
The earlier colony and village artifacts were deleted at the user's request on 5 Nov;
their local files under /home/claude/colony and /home/claude/village are the only copies.

## Working rules for each cycle
1. Pick ONE coherent theme. No half-finished systems left in the file.
2. `node --check` the script before and after. Headless-render and read the screenshot.
3. The build escapes non-ASCII automatically now; do not hand-escape src/game.js.
4. Publish only when it runs clean. Append what shipped to the Shipped log below.
5. Keep the reply to the user short — they asked for updates on request, not narration.

## Shipped
- c16 bosses with presence: a boss grows with the depth it guards (1.9 up to ~4 units by
  floor 100), carries a point light and a slow-pulsing ring on the floor in its own colour
  from BOSSES[], and the Keep announces it by name the moment it wakes.
  Verified the way the crypts were: bossFor() temporarily forced to BOSSES[4] so a boss
  appeared on floor 2, looked at, reverted. The test never reaches floor 10.
- c15 the crypts: dungeon dressing is themed by depth band now. BANDPROPS gives each of the
  five bands its own vocabulary - rubble and crates in the wet caves, coffins, graves,
  gravestones, skulls and ribcages in the crypts, lanterns in the iron halls, shrines on
  the dragon's floors. 12 props from KayKit Halloween Bits (CC0).
  The test only ever reaches floor 2, so the crypt band was verified by temporarily
  forcing bandProps(25) and looking. Worth repeating for any band-specific work.
  Also: tools/shot3d.py clicks through the DOM now. The rail repaints on a cadence and
  Playwright's actionability checks hung forever on an element that detached mid-click.
- c14 interiors and a cheaper loop: 17 KayKit furniture models drive the interiors, so
  lifting a roof shows real beds, tables, barrels, shelves and chests instead of coloured
  boxes. Chests in the Keep are built once per floor and rebuilt only when one is forced,
  rather than cloned from scratch every frame. The test now lifts every roof and captures
  dist/shot-3d-inside.png, because interiors were never in any screenshot before.
  PYTHON SLICE WARNING, AGAIN: s[s.index(A):s.index(B)] silently gives '' when B occurs
  BEFORE A, and str.replace('',new,1) then inserts at position 0. A render block landed at
  the top of the file outside the IIFE. Anchor on line numbers for blocks whose comment
  text repeats elsewhere in the file.
- c13 town effects and dressing: gold floats over a shop when somebody spends there, motes
  drift over the altar, boulders stand on the rocky ridge, a well sits on the plaza and a
  windmill out by the fields. The Keep was relit after the torch models dimmed it.
  BUG: effects are world-space and both views drew ALL of them, so a chest forced on floor
  nine popped '+22 gold' over the town square. Every effect now carries the world it
  belongs to and fxDraw skips the others. An effect with no base height is a Keep effect.
- c12 the Keep dressed: KayKit Dungeon Remastered (CC0, 203 props) is cloned and usable.
  Real chests (gold while shut, plain once forced, with a coin pile beside an unopened one),
  mounted torches under the flames, and pillars, barrels, crates and rubble scattered from
  each floor's own seeded hash so a floor looks the same every time you return to it.
  dungProp(kind,x,y,want,rot,yOff) scales any prop to a target size and sits it on the floor.
  Unused from that pack: beds, tables, banners, bottles, shelves, coins, keys, wall and
  floor tiles (a full modular dungeon kit, if the generator is ever rebuilt around it).
- c11 all KayKit, all CC0: every building kind now maps to a KayKit model (castle for the
  hall, church for the altar, blacksmith, archery range for the fletcher, market, barracks,
  towers for the guild and the vault), and the trees and rocks are KayKit too. The Babylon
  props were dropped, so the repo has NO attribution obligation left - everything is CC0.
  BUG WORTH REMEMBERING: render3D's per-frame loop reset roof/wall visibility every frame
  and overrode swapBuilding, so real models were buried under their procedural stand-ins.
  A building with a model now takes a different branch entirely.
- c10 LICENCE FIX + KayKit. Mixamo forbids REDISTRIBUTION, and committing converted .glb
  files to a public repo is redistribution. Every Mixamo-derived file was removed and
  purged from git history. The cast is now KayKit (CC0, no attribution): Knight, Mage,
  Rogue, Barbarian plus four skeletons for the Keep, and 25 weapon models.
  RULES GOING FORWARD:
    * NEVER commit a Mixamo file. Use KayKit, or Babylon with attribution.
    * KayKit rigs have 41 bones and a purpose-built 'handslot.r' bone - parent weapons
      to it with no transform, it is authored for exactly that.
    * Each KayKit character carries all its own clips, so no shared animation files.
      tools/prune-anims.mjs trims 76 clips to the ~32 used and resamples: 26 MB -> 10 MB.
    * HEIGHT: take the LARGER of the mesh Box3 and the skeleton span. Box3 reads far too
      small for some rigs (three's Xbot: 0.018 for 1.78); the skeleton reads short for
      big-headed stylised ones like KayKit. Either alone produces giants or dolls.
    * Figures are 1.45 units, not a true 1.7, because Keep corridors are one tile wide.
  Reachable and still unused: KayKit Dungeon Remastered, Medieval Hexagon (blacksmith,
  church, barracks, castle), City Builder Bits, Furniture Bits, Halloween Bits.
  opengameart.org is BLOCKED, so Quaternius packs cannot be fetched here.
- c9b archers and casters: every adventurer has a stable fighting style - sword, bow, axe,
  or staff if they are gifted - and it picks BOTH their model and their clips. Style clips
  are looked up as <pfx>_<slot> (bow_idle, gs_attack, axe_run) before the generic set, so
  an archer stands, moves and dies like an archer. The gifted now cast: the clip plays and
  a burst goes off in their school's colour at both ends.
  WEAPONS: Mixamo ships the motion but NOT the prop, so a swordsman mimed an empty swing.
  Babylon's runeSword and frostAxe are parented to the mixamorig:RightHand bone instead.
  Scale is divided by the rig's own scale because the bone inherits it.
  Four more faces in: archer (Erika), yaku, eve, maria.
- c9 the village pack: BabylonJS/Assets (CC BY 4.0) is reachable from the sandbox and has
  a villagePack and a graveYardPack. 30 props pulled, 18 MB compressed to 2.3 MB. Cottages
  and the inn are now real models, and the procedural cone trees are replaced by real ones
  scattered with varied scale and rotation. The building swap path from c5 ran for the
  first time and worked. ATTRIBUTION: CC BY 4.0 needs a credit - see README, and keep
  Mixamo (no attribution) and Babylon (attribution) in separate folders.
  Still unused from that repo: graveYardPack (mausoleums, sarcophagi, tombstones - the
  Keep's crypt floors 20-40), a dragon, frostAxe, runeSword, haunted_house, a yeti.
- c8 effects: a 2D overlay canvas (#fx) above whichever view is running, so one
  implementation serves the flat Keep and the 3D one. Floating damage numbers (crits in
  the caster's gift colour, larger), impact sparks, death bursts, a named line when a
  delver falls or a boss dies, gold on a forced chest, a white flash on a struck body
  (materials are cloned per instance so one flash is its own), and a vignette in the Keep.
  FONT STRINGS ON CANVAS MUST QUOTE A TWO-WORD FAMILY: '700 20px Nunito Sans, sans-serif'
  is invalid and silently leaves the context at its 10px default. That cost an hour.
- c7 the real cast + wall dissolve: eight Mixamo characters in (peasant man and girl,
  castle guard x2, knight, paladin, goblin, vampire). Monsters in the Keep are now the
  goblin, bosses the vampire, both skinned and animated like the party. Walls dissolve
  where they would hide the delve, via onBeforeCompile on the wall material.
  TEXTURE BUDGET: 60 MB of raw fbx2gltf output became 13 MB with
    npx gltf-transform optimize IN OUT --texture-compress webp --texture-size 1024 \
        --no-compress --no-simplify
  Run that on EVERY new character. Draco was tried and dropped: it needs a separate
  decoder file, which the artifact build cannot load. WebP needs nothing extra and
  three r150 reads it fine - verified by rendering.
- c6 the Keep in 3D: the dungeon renders in three.js too. Walls and floors built as two
  vertex-coloured meshes per floor from dty, themed by depth band; torches as flickering
  point lights; a lantern that follows the party; loot beams over unopened chests; mobs as
  capsules with a boss aura; the delvers are the SAME skinned characters who walk the town.
  3D is now a toggle independent of scene, so Town and The Keep both render either way.
  Clip slots fall back down a chain, so a rig missing 'guard_idle' plays 'idle' rather
  than freezing in its bind pose.
- c5.2 the cast: Peasant Man (real Mixamo) plus 23 clips converted from Mixamo animation
  packs, 2.1 MB total. Manifest 'animations' now takes a slot->file map. clipFor() picks
  by what a person is DOING: asleep in their own bed at night, praying at the altar,
  sitting and talking in the tavern, drunk, at a desk in the school, on guard, walking,
  idle - with separate male and female locomotion.
- c5.1 retargeting: clip tracks are rebound by normalised bone name (three's 'mixamorigHips'
  vs FBX2glTF's 'mixamorig:Hips'), ROTATIONS ONLY. Mixamo FBX converts to glb in-container
  via the fbx2gltf npm package - no Blender needed. tools/preview.py renders any model's
  animation to a GIF with the camera auto-framed on the skeleton.
- c5 assets: optional .glb pipeline. three rebundled with esbuild (three + GLTFLoader +
  SkeletonUtils, one global, 651 KB) replacing the deprecated UMD build. models/manifest.json
  drives building and character models; absent or empty -> fully procedural, silently.
  Rigged characters with AnimationMixer, fuzzy clip matching (idle/walk/run/attack/die),
  nearest-N cap with a 0.4s reassign. Placeholder cast: Soldier + Xbot from three's examples.
- c4 3D: three.js view as a third tab - heightmap terrain, pitched roofs, lit windows,
  roof-off interiors with hearth/lamp point lights, instanced trees, orbit camera,
  day/night sun and sky, click-to-select by raycast, rail camera row drives it too
- c3.5 repo: split into a project, build to a single-file bundle, smoke test, Pages workflow
- c0 town: 22 families, kin, trades, magic, 5 shops, nobles, guild, altar, Rosehouse, guard, bank, school
- c0 keep: 100-floor ledger, abstract delves, deaths, levels
- c1 interiors: roof cutaway, furniture per building type, people indoors, lift-all-roofs
- c2 keep: real generated floors, live combat, chests, fog, retreat, scene switch, UI pass
- c2 fix: floor connectivity repair pass (pools were severing floors)

## Next up (ordered by value, re-evaluate each cycle)
1. ECONOMY — gold actually moves: shop tills, wages, tax to the vault, deposits, prices. DONE c3
2. BOSSES + RELICS — every 10th floor a named boss; relics as permanent party upgrades. DONE c3
3. THREE.JS — real 3D renderer as an alternate view. Big. Needs its own cycle, maybe two. <- c4
4. EFFECTS LAYER  <- c6 — lighting, particles, hit feedback, damage numbers, loot beams, depth fog.
   The user asked for Diablo 3 as the visual bar. Needs the 3D view first. (agreed c4.5)
5. ROT.JS + TONE.JS — swap the hand-rolled dungeon generator for rot.js (five algorithms, real
   FOV), and add procedural audio with tone.js. Both MIT, both on cdnjs, no asset files.
6. CONTRACTS — the guild posts jobs the town needs; player can nudge priorities.
7. SEASONS + EVENTS — a storyteller: harvests, plague, bandits, a dragon waking.
8. AGEING FORWARD — marriages between families, births, generations over long play.
9. SAVE/LOAD — localStorage snapshot so a long game survives a reload.
10. SECOND SETTLEMENT — trade route, caravans, the start of war.

## Noted mid-run
- Blender MCP tools appeared on the user's machine (mcp__remote-devices__Blender__*).
  That changes the earlier answer: assets COULD be modelled and rendered there. But an
  artifact still cannot load external files, so the only usable path is Blender -> render
  sprite sheets -> inline as data URIs, which costs page weight. Raise it with the user
  before spending a cycle on it; do not assume.

## Assets
- SHARED CLIPS ARE GATED ON THE RIG. A character may only use the shared Mixamo clips if
  its own bones are named mixamorig*; checked at load. A model's own clips always win.
  Without that gate, Mixamo clips folded three's Soldier into a red spread-eagled mess.
- Animation packs are the way to collect clips: one download gives up to 50, and the free
  account has them all. 'Without Skin' / T-pose, FBX Binary, 30fps, reduction none.
- CROSS-RIG RETARGETING DOES NOT WORK and is not worth fixing. Xbot and a native Mixamo
  character share bone NAMES but not rest poses (Xbot came back through Blender), so raw
  rotations collapse the legs. The fix is not bind-pose compensation, it is: download the
  animations from Mixamo, where they are authored against the rig every Mixamo character
  already has. Then no retargeting happens at all beyond name normalisation.
- Mixamo downloads through the Claude browser pane are UNRELIABLE: the first prompted a
  save dialog, later ones complete the export and never download. Its /monitor endpoint
  needs an OAuth bearer the page holds, so fetching job_result by hand gets "Oauth token
  is not valid". Have the user download in Brave instead; it is four files, once.
- Pages serves models/; the artifact bundle sets window.__ASHVALE_NO_ASSETS and never fetches.
- The sandbox can reach GitHub and npm but NOTHING else, so models can be curled straight
  from raw.githubusercontent.com. Mixamo and Tripo cannot: they are blocked AND need the
  user's login, so those files come via his connected folder C:\ashvale-assests.
- Xbot.glb IS the Mixamo base rig, so the placeholder cast validates the exact skeleton his
  Mixamo downloads will have. Swap the files, keep the manifest keys.
- TERRAIN TEXTURES NOT DONE. The terrain is one vertex-coloured mesh with no UVs; texturing
  it properly needs either per-type meshes or an atlas. Deliberately deferred, not forgotten.
- Buildings: the swap path is written but untested - no building .glb exists yet.

## The cast, and what is missing
- TWO real character models: peasant-man.glb and peasant-girl.glb. Men, children and
  nobles are the man; women and girls are her. GUARDS are still three's Soldier, which is
  not a Mixamo rig and so only has idle/walk/run - Castle Guard 01 would fix that, and
  Knight D Pelegrini would give adventurers their own look.
  Adding one: download from Mixamo (FBX Binary, With Skin, T-pose), convert with
  node_modules/fbx2gltf/bin/Linux/FBX2glTF --binary, add a manifest 'characters' key.
- 238 more clips sit unconverted in the user's folder (sword and shield, magic, creatures,
  zombies, farming, gestures). tools/ has the converter; add a line per clip and rebuild.
- Monsters are the goblin and the vampire, which are hero-grade models doing mob duty. Fine
  for now; a proper bestiary still wants Tripo's free gallery.
- Still unconverted in the user's folder: Erika Archer, Eve, Maria J J Ong, Yaku J Ignite,
  Ch10_nonPBR (110 MB), and 238 animation clips across the packs.

## Known rough edges
- Wall dissolve is a distance fade around a point 2.6 units in front of the party, not a
  true occlusion test: a wall far off to the side but still in the way will not fade.
- No fog of war in the 3D Keep; the whole floor is built at once and darkness does the work.
- Chests, and mobs when no mob model is loaded, are rebuilt from scratch every frame.
- The town has no effects of its own yet; the overlay is cleared there.
- Nothing yet marks a cast: the gifted have a wisp but no spell effect.
- Placeholder characters render dark red at night; could be Soldier's texture failing to
  decode rather than just dim light. Check in daylight when the real cast lands.
- SHADOWS DO WORK. The earlier "swiftshader renders no shadows" conclusion was WRONG:
  tools/preview.py renders a clean contact shadow under the character. Whatever the
  box-on-a-plane control case was doing, it was not representative. If shadows look
  absent in the town view it is a frustum or bias problem, not a platform limit.
- three.js 0.150.1 is vendored and INLINED into the bundle (714 KB). The UMD build is
  deprecated at r150+ and gone at r160, so do not bump past 0.159 without porting to modules.
- The 3D view renders the town only. Pressing Town/Keep leaves 3D; 3 toggles it.
- The Keep in 3D, and the effects layer, are the next visual steps.
- Treasury runs tight: civic wages roughly match tax income, so the town leans on Keep loot.
  Deliberate for now, but watch it if wages grow.
- Rail/console repaint cadence is coarse; fine but could be event-driven.
- No mobile test pass since the Keep landed.
- The abstract (unwatched) delve resolver and the live one can drift in pace.

## Cycle 17 — seasons, events and generations (shipped)
The town had an economy and a population but nothing ever happened *to* it. Now:

- **The turning year.** Four seasons of 7 days each; `season()` drives the 2D tile
  palette (`TC[GRASS]`, `TC[FIELD]`), the 3D terrain colours (`C3`, geometry rebuilt
  on the turn), the tree canopy, and the sun/hemisphere warmth. Spring's values are
  the original palette exactly, so a fresh load looks as it always did.
- **A storyteller.** `EVENTS` — good harvest, hard frost, travelling fair, fever,
  bandits, guild dues, the Keep stirring — weighted, season-gated, at most one every
  four days. `dstir` from "the Keep stirs" raises delve `danger` and decays a season
  later. A hard frost sets `weather='bitter'`, which pulls the 3D fog in.
- **The harvest pays.** `marketDay()` now credits the hall `hands*1.6*season().harvest`,
  so autumn is fat (1.7x) and winter is lean (0.3x). Visible in the market-day line.
- **Generations.** Ageing moved off the old per-day `rnd()<0.0016` roll (one birthday
  per person per ~625 days, so nothing ever happened) onto `birthdays()`, run once a
  year at the spring turn. Coming of age, the guild roll, and death from old age
  (`age>62`, rising) all run there. `marriages()` weds unrelated unwed adults of
  different houses and moves one into the other's home. `births()` adds a child to a
  married couple, capped at 4 per mother and 150 souls.
- `bereave()` now clears the *spouse's* back-pointer, so a widow can remarry, marks
  the person dead, and pulls them out of an active delve party.
- The altar was still named after the owner's handle. Renamed to the Altar of the
  Pale Hour. **No real or personal names anywhere in this project.**

### What the tests did not catch, again
`npm test` runs to day 4 — inside the first season. Every season, event and birthday
path is invisible to it. Verified instead by building a throwaway `SEASONLEN=1` copy
into the scratchpad and driving it at 8x until autumn and winter, then *looking* at
`dist/shot-3d-autumn.png` and `dist/shot-3d-winter.png`. Keep that trick: a test
build with the period shortened is the only cheap way to see long-period behaviour.

## Cycle 18 — the flat views work again, and 3D is the default (shipped)
The 2D Keep had been rendering as a 280x200 scrap in the top-left corner of the stage
for several cycles. Not neglect — a bug.

**Cause.** The 2D canvas is `display:none` whenever the 3D view is up, and a hidden
element measures 0x0. `resize()` clamped that to its minimum and then *wrote it back*
as the element's real CSS size:
```js
CW=Math.max(280,Math.floor(r.width));   // r.width is 0 when hidden -> 280
cv.style.width=CW+'px';                 // the canvas is now a 280px element
```
One trip through the 3D view shrank the flat canvas permanently; nothing re-measured
on the way back because the ResizeObserver had already fired while it was hidden.

**Fix.** `resize()` ignores a zero measurement and keeps the last good size; it is also
called explicitly the moment the flat canvas becomes visible (`set3D`) and on every
`setScene`. `loadRun` now snaps the Keep camera for both views and writes `camSave.keep`,
so arriving on a floor never starts off-screen.

**3D is the default view on load.** `set3D(true)` at boot, wrapped in try/catch; a
browser with no WebGL falls back to the flat view exactly as before. The flat views stay
as the map you can drop back to.

### The test was blind to this, and now isn't
`tools/shot.py` clicked `#sc3D` positionally, which inverted once 3D became the default —
`shot-town.png` was silently capturing the 3D view. It now asks which view is on screen
(`view2d()`/`view3d()` helpers) rather than toggling blind, and **asserts the flat canvas
is at least 900x500** after a trip through 3D, in both the town and the Keep.
Verified by removing the fix and re-running: the suite fails with
`flat canvas collapsed to 280x200 after a trip through 3D`. Put the guard in before
trusting it — an assertion never seen to fail is not a test.

## Cycle 19 — the town persists, and the chrome stops shouting (shipped)

### Save/load
The map, the buildings and their layouts all come from a fixed seed, so none of that is
stored — only what has happened since. `snapshot()` writes people (scalars plus id refs
for home/work/spouse/kids/parents), ECON, KEEP, the tills, the clock, season, year,
`dstir`, `pid` and the RNG seed. `loadGame()` rebuilds `people` and relinks every
reference by id; `b.residents` and `b.staff` are rebuilt from the people rather than
stored twice. A spouse that did not survive the round trip leaves a widow, not a
dangling link. ~20 KB for a 69-soul town.

Everything is best-effort: `store()` returns null rather than throwing where storage is
blocked, a failed write logs once and never blocks the sim, and a corrupt or stale save
starts a fresh town instead of breaking the page. Autosaves once an in-game day and on
`visibilitychange`/`pagehide`. **New town** in the header wipes it, with a confirm step.

### The GUI
Counted the components and found the actual problem: `.stat`, `.sbtn`, `.seg`, `.tool`,
`.cbtn`, `.cbtns button`, `.tag`, `.party` and `#log` were **nine different things all
drawn as "rounded rectangle, panel2 fill, edge stroke."** Nothing was louder than
anything else, so the eye had nowhere to land. Not a palette problem.

The rule now: **a frame means you can click it.** Readouts lost their boxes and became
type — the header stats are a figure and the word for it, the way a ledger sets columns.
Rail items are rows that get a fill on hover. Only buttons and the segmented controls
keep a border. Also:
- the header is `flex-wrap:nowrap` and no longer drops the speed controls onto a second row
- the rail is masked at the foot so a cut-off item reads as "more below", and the eight
  place names are paired into two columns, which took the rail from 110px of overflow at
  1440x900 to none
- the chronicle sits over a bright green afternoon or a black corridor, so it needs a
  backdrop — a blurred dark wash with one gold rule, not a sixth competing card

**CSS slice hazard, the same shape as the Python one:** replacing
`css[css.index(A):css.index(B)]` silently swallowed the `#log h4` rules that lived
between the two anchors, which un-styled the chronicle's heading. Check what is actually
*inside* a range before replacing it, not just that both anchors exist.

### Tests
`shot.py` now pauses, saves, reloads and asserts pop/gold/floor are unchanged. Verified
by forcing `loadGame` to bail and confirming the suite fails with
`the town did not survive a reload`. Both guards added this session were seen to fail
before being trusted.

## Cycle 20 — the Houses of Ashvale (shipped)
Cycles 17 and 19 gave the town marriages, births and deaths, and there was nowhere to
read any of it. The chronicle scrolls away in seconds and the dead were spliced out of
`people` with no record left at all.

- **`ANNALS`** — a slow record beside the fast chronicle, dated by season and year:
  weddings, births, coming of age, deaths. Capped at 160.
- **`DEAD`** — `bereave(v,how)` now takes a cause and files the person before removing
  them, so "was killed by goblin scouts on floor 3, aged 33" survives them. Capped at 120.
  Every call site passes a cause: the boss kill, the off-screen delve roll, old age.
- **The Houses panel** (`#housesBtn`) — every household under its roof, nobles first,
  grown-ups before children, each line carrying trade, spouse, gift and whether they are
  below in the Keep. Clicking a name opens that person. Then "Gone before", then the annals.
- Both are persisted in the save alongside everything else.

Design: a household is a heading and the people under it, held by one rule down the left.
No cards — the indent carries the grouping, which keeps it consistent with the chrome
rule from c19 (a frame means you can click it; `.kinrow` gets its fill on hover only).

### Tests
`shot.py` opens the panel and asserts at least 5 households and 20 people. Verified by
dropping `live` from the panel's innerHTML and confirming
`the houses panel came up near-empty: {'house': 0, 'kin': 0}`.

**Verifying generations needs the SEASONLEN=1 trick** — `npm test` reaches day 4, which is
inside the first season, so no birthday pass has run and the annals are nearly empty.
Drive the shortened build to year 2+ to see marriages and deaths accumulate.

## Cycle 21 — four kinds of thing in the dark (shipped)
`skeleton_minion` was every monster and `skeleton_warrior` every boss, while
`skeleton_rogue.glb` and `skeleton_mage.glb` sat converted and unused in `models/kay/`.

**`MKIND`** gives each kind its own numbers *and its own behaviour*, which was the point —
a different mesh alone would have been decoration:
- **minion** — the old behaviour unchanged: walks in, swings at 1.1 reach, 1.1s cadence.
- **rogue** — 3.5 speed against the minion's 2.0 and a 0.7s cadence, but 62% of the health.
  It is on you before the party can turn.
- **mage** — `keepAway: 3.4`. It will not close. Inside its circle it *walks backwards* and
  casts anyway, because `reach` is 5.4 and the attack check is independent of the move.
  55% health, 1.45x damage. Its bolt draws as five bursts along the line to the target, so
  you can see where the hit came from, and it carries a coloured aura in both renderers.
- **brute** — the warrior mesh at 1.62 units, near double health and damage on a 1.8s swing.

**`BANDMOBS`** is the mix per depth band, matching `BANDPROPS`: the wet caves are rabble
with the odd rogue, the crypts raise mages, the iron halls field brutes, and the dragon's
floors are brutes and mages almost entirely.

### What the test does and does not prove
`shot3d.py` now records every `.glb` the page fetches and fails if any of the four mob
models was never requested — verified by deleting the `mage` key from the manifest and
watching it fail with `mob models never requested: skeleton_mage.glb`. **Be honest about
the scope:** `loadAssets` loads the whole manifest up front, so this catches a wrong or
missing key — the silent fallback to the minion — but it does *not* prove a mage ever
spawns. The test only reaches floor ~11, which is the one band with no mage in its mix.
Behaviour was checked by forcing `bandMobs` to return `BANDMOBS[1]` on every floor.

**Serve from the repo root when checking assets.** The first pass at this served the built
page out of the scratchpad, so `models/` was not beside it, nothing loaded, and the
screenshots showed a bare procedural floor that looked like a rendering failure. The glb
fetch list is what settled it.

## Cycle 22 — sound, from the owner's own studio (shipped)
The owner pointed at https://github.com/jestsayin96/music-studio. It is a browser music
studio in TypeScript with **no runtime dependencies** — plain Web Audio — which is exactly
the argument for not bundling tone.js (~400KB for a footstep).

- `vendor/music-studio/src/` is a **verbatim snapshot** of that repo's `src/` at `c236907`
  (v3.4.2). **Never edit anything under it.** Changes belong upstream; they arrive here by
  re-copying the tree. `PROVENANCE.md` beside it says so. The upstream clone at
  /home/claude/music-studio was never modified — `git status` clean throughout.
- `vendor/music-studio/entry.ts` is Ashvale's own file and the only one we write. It
  re-exports `playSfx` and the catalogue, nothing else — no sequencer, no UI, no sampler.
- `npm run build:music` bundles it to `vendor/music.bundle.js` with esbuild, exactly as
  three.js became `vendor/three.bundle.js`. **10 KB minified, 3.4 KB gzipped.** The only
  unresolvable imports are `node:fs/promises` / `node:path`, dynamic imports in
  `src/samples/library.ts` for the studio's headless CLI; marked external, never executed.
- `SFXMAP` maps game events onto the studio's catalogue: `impact` for a blow, `shimmer`
  for a spell and for a wedding, `kill_sting` when a delver falls, `sub_drop` when a boss
  wakes, `riser` on descending, `victory_fanfare` on clearing a floor, `death_fall` for a
  death in the town. Rate-limited to one of each kind per 70ms — a busy floor asks for
  twenty hits in a frame.
- **Off by default.** No `AudioContext` is constructed until the speaker is pressed, which
  is also the gesture browsers require. Muting suspends the context rather than tearing it
  down. The preference is remembered, but a remembered "on" only relabels the button; it
  never starts audio without a click.

### Tests
`shot.py` proxies the `AudioContext` constructor from an init script and fails if one
exists before the speaker is pressed, or if pressing it makes anything other than exactly
one. Verified by calling `sndStart()` at boot and watching it fail with
`1 AudioContext(s) existed before the speaker was pressed`.

### Two self-inflicted detours worth remembering
1. **Playwright's `add_init_script` takes a bare body, not an arrow function.** Passing
   `"()=>{...}"` defines a function and discards it, so the probe never installed and the
   first run reported zero effects played — which read as "sound is broken" when sound was
   fine. The second probe, counting calls via `console.log` from inside `snd()`, settled it
   in one run. When a probe says nothing happened, suspect the probe.
2. The first bundling attempt failed on `node:fs/promises`. That is the studio's headless
   render path, not a real dependency — `--external:` is the whole fix.

## Cycle 23 — a score that follows the year and the depth (shipped)
`entry.ts` now re-exports `AudioEngine`, `applyMood` and `newProject` as well as the
effects. **30 KB minified, 10 KB gzipped** for the whole thing — the studio's moods,
scales, sequencer and voices.

- `scoreWant()` picks a mood from where you are: `playful` above ground in spring and
  summer, `lowkey` in autumn and winter; in the Keep, `lowkey` in the caves and crypts
  and `hype` from the iron halls down.
- `scoreUpdate()` rebuilds the project only when the mood actually changes, seeded from
  the season and the scene so a given season sounds the same each time you return to it.
  Called on the season turn, on a scene change, and on arriving at a floor.
- The score sits at −19 dB, well under the effects.
- **One AudioContext for everything.** `AudioEngine.build()` is synchronous, so
  `sndStart()` constructs the engine, calls `startAudio()` and takes `engine.context` for
  the effects bus. The "exactly one context, none before the gesture" guard still holds.
  Muting stops the engine and suspends the context.

### Tests
`shot.py` now builds a project, plays it, and **reads the analyser** — it fails unless the
peak exceeds 0.001. Verified by reverting `entry.ts` to the sfx-only exports, which fails
with `the music bundle threw: MUSIC.AudioEngine is not a constructor`. This guards the
vendored bundle itself, which is the thing most likely to break when the snapshot is
re-copied from upstream.

### Three probe failures in a row — the lesson, properly learned
Counting calls needs a wrapper, and every wrapper I wrote failed to install for a
different reason (an arrow function Playwright discarded; a `setInterval` race; a
`defineProperty` accessor that broke the global it was watching). Each time the probe
reported "nothing happened" and each time the feature was working. **Measure the output,
not the calls.** Reading 0.1835 off the analyser settled in one run what three wrappers
could not, and it is also the assertion worth keeping, because signal is the thing that
cannot lie.

## Cycle 24 — the party fights four different ways, and the header stops overflowing (shipped)

### PSTYLE
`styleOf()` was already choosing a model and a clip set per adventurer; now it chooses
how they fight, mirroring `MKIND`:
- **sword** — the old numbers unchanged: 1.15 reach, 0.85s, 1.0x. The baseline.
- **axe** — 1.25 reach but 1.55s between swings for **1.95x** damage. One heavy blow.
- **bow** — **6.5 reach**, so an archer opens fire while the others are still closing,
  and holds where it stands instead of walking in. Pays for it: inside 1.8 units the
  damage drops to **35%** (`smother`), because you cannot draw with a thing on top of you.
  The shot draws as four bursts along the line so you can see it cross the room.
- **staff** — 5.0 reach, 1.35x, and it **spends the gift**: `p.mana` starts at 4 and
  regenerates 0.22/s, each cast costs 1, and a dry caster falls back to a 35% poke on a
  shorter cooldown. Only the gifted get a staff, so this is the gift made material.

### The header, twice bitten
It has now outgrown its width in two different ways — wrapping the speed buttons onto a
dead second row in c19, and clipping "Ashvale" off the left once the ♪ button landed in
c22. Measured rather than guessed: it needed 1481px and overflowed on anything under that.
It now sheds weight in order — stat labels at 1460, the subtitle at 1180, all but the
clock at 1150, the rest of the stats at 950, **New town** at 860, **Houses**/**Ledger** at
760 — and fits cleanly from 1680 down to 700.

### Tests
`shot.py` resizes to 1680, 1440, 1280 and 1024 and fails on any overflow **or** on a
header taller than 60px, which catches both failure modes. Verified by deleting the first
breakpoint: `header overflows by 56px at 1440px wide / by 217px at 1280px wide`.
What it does not prove: nothing checks the *styles* numerically — PSTYLE was verified by
running a delve and reading the screenshot, and the archer's hold-at-range behaviour is
visible there but not asserted.

## Cycle 25 — a real bestiary, and a legible party (shipped)

### The creatures
The owner connected `C:\Users\morta\village_assets` — 4,467 models across 50 packs with
an `asset_index.json` mapping name to path. The Quaternius creatures were FBX, which the
vendored `node_modules/fbx2gltf/bin/Linux/FBX2glTF` converts in-container; no Blender
needed. Eight creatures, each rigged with its own idle/walk/attack/death, compressed with
gltf-transform at 512px: **2.7 MB for the whole bestiary.**

`MOBART` maps depth to body — rat from floor 1, bat from 7, spider 13, slime 21, snake 31,
wasp 46, frog 61, the KayKit skeletons from 76, **and the dragon at 100.** `MKIND` still
decides *behaviour*, so a rogue-shaped spider is a spider that closes fast. `BEAST` sizes
each creature on its own terms rather than as a scaled humanoid.

`CLIPWORDS.walk` gained `flying`, `fly`, `slither`, `hop` — the flyers name their
locomotion clip `_Flying`, and without that a bat hangs in bind pose.

### The delver rail
`PSTYLE` started mattering a lot in c24 and nothing showed it. Each party member is now a
row carrying the style word in its own colour, a health bar, and — for a caster — the
remaining charges as `\u25cf\u25cf\u25cf\u25cb`, because a dry caster fights at a third
strength and that has to be visible. Relics show as a gold mark with the names on hover.

### Tests
`shot3d.py` now requires all twelve creature and skeleton models to be fetched. Verified
by deleting the `dragon` key: `mob/creature models never requested: dragon.glb`.
**What it does not prove:** `loadAssets` pulls the whole manifest up front, so this catches
a wrong key, not that a given creature ever spawns. Depth-specific art was checked by
forcing `artFor` to return `spider` and looking.

### Licences
Quaternius is CC0, same as KayKit. Nothing from `C:\ashvale-assests` (Mixamo) was touched.

### Not needed, and worth writing down
Blender and Godot were offered. **Godot is a different engine** — it cannot improve a
three.js page, only replace it. **Blender was not needed** either: the creatures existed
as FBX. Blender's real jobs here would be `.blend`-only assets, decimating the 9 MB
`Imp.glb`/`Puglin.glb`, and baking AO. The two biggest wins in that library need neither:
`hdri/spruit_sunrise_2k.hdr` as a three.js environment map, and the twelve `ambientcg/`
PBR sets — `Ground037/054/068` for the fields, `Rock023/030/035/051` for the ridge,
`Lava004/005` for the magma deeps, which currently render as flat orange.

## Cycle 26 — photographic ground (shipped)
`terrainGeo()` now emits UVs derived from world position (`x*0.5, z*0.5`), so one tiling
texture runs across the whole map and each quad's grain lines up with its neighbour's.
The ground material takes a `map` when the manifest offers one; **map and vertex colour
multiply**, so the seasonal palette from c17 still turns the year while the surface gains
real grain.

Four ambientCG sets (CC0) at 512px WebP: `ground` 99 KB, `rock` 67 KB, `lava` 55 KB,
`paving` 75 KB — **304 KB for all four**. Only `ground` is wired so far; rock, paving and
lava are in the manifest and unused. Lava is the interesting one: the magma deeps at
floors 61-80 currently render as flat orange.

The texture loads only on the assets tier, so the artifact build is untouched.

### The HDRI, and why it is not in yet
`hdri/spruit_sunrise_2k.hdr` is 5.7 MB and would want an RGBELoader the bundle does not
carry. More to the point, the terrain and buildings are `MeshLambertMaterial`, which does
not respond to an environment map at all — only the KayKit models would light from it, and
a fixed sunrise would fight the day/night cycle that already tints the sky. Worth doing as
its own cycle with a resized equirect WebP and a decision about the clock, not bolted on.

### On routing downloads through the owner's machine
The owner offered Blender's internet access, since this sandbox's egress allowlist refuses
cdnjs, quaternius.com and the rest. **Declined, deliberately.** Using a remote MCP server
as a download proxy is working around a security control rather than through it; the
sanctioned route is the account's own allowlist (claude.ai → Settings → Capabilities).
It is also unnecessary: `village_assets` already holds 4,467 models across 50 packs, and
this project has used perhaps thirty of them.

## Cycle 27 — the deeps look like the deeps, and the camera reads the room (shipped)
Worked unattended; the owner was asleep with the bridge left up.

### Surfaces underground
`dungeonGeo()` now emits UVs as the town's terrain does, with one difference that matters:
a floor quad takes the ground plane (`x, z`), a **wall** takes `(x+z)` horizontally and `y`
up, so a wall's grain runs vertically and continues into the wall beside it instead of
restarting at every quad.

Each depth band names its surface in `THEMES[].tex`: `rock` in the wet caves, `paving` in
the crypts, `rock` in the iron halls, **`lava` in the magma deeps**, `rock` on the dragon's
floors. Floors 61-80 rendered as flat orange before; they are cracked stone with molten
veins now. The texture multiplies with the band's vertex palette, so the existing colour
grading survives.

`loadAssets` now loads every entry in `manifest.textures` into `R3TEX` rather than only
the ground, since a Keep floor is built later and just needs them in the cache.

### The camera
The Keep camera has sat at `dist:12, ph:1.30` since the wall-dissolve work — almost on top
of the party, with no sense of the room. Now `dist:21, ph:1.14`.

### Tests
`shot3d.py` fails if any of the four surface textures is never requested. Verified by
deleting the `lava` key: `surface textures never requested: lava.webp`.
**What it does not prove:** a texture that loads but never reaches a material would still
pass. The lava band itself was checked by forcing `themeFor` to return `THEMES[3]` on every
floor and looking at `dist/lava-keep.png`.
