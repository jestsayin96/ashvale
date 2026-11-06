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

## Cycle 28 — the town names its families (shipped)
Worked unattended. Items 1 and 2 of the loop prompt shipped in c27, so took the next.

Every building drew a nameplate from `BK[kind].n`, which meant twenty plates reading
"House" and "House · 1". Now:
- `houseName(b)` takes the commonest surname among `b.residents` — "the Ashbys" for a
  cottage, "House Vauntmere" for a manor. The households from c20 finally reach the map.
- `labelShows(b)` hides a dwelling's plate unless you are close (`zoom > 1.45`), its roof
  is open, or its resident is selected. Civic buildings and shops are named at any
  distance, because those are what you navigate by.
- The person panel uses the family name too, with the building kind and the number under
  that roof as the subtitle.

Zoomed out you see the hall, the guild, the shops and the two manors. Zoomed in the lanes
fill with the Underhills, the Harrowgates, the Dunmores, the Lanternes, the Thornburys.

### No guard for this one, and that is deliberate
The plates are drawn on canvas, so there is nothing in the DOM to assert against and no
honest way to test the label text without exposing internals purely for the test.
Verified by screenshot at both zoom levels (`dist/labels.png`, `dist/labels-close.png`).
Said plainly rather than bolting on a weak assertion that would pass whatever happened.

## Cycle 29 — nothing down there used to break (shipped)
Worked unattended.

**Took the reading that the sting was not worth the cycle.** `stinger_a/b/c` are already
reachable through the `playSfx` path wired in c22, and `sub_drop` already fires when a
boss wakes — so adding one would have been three lines over a gap that is mostly already
filled. The real hole was behavioural: a rat fought to its last point of health exactly
like an ogre.

`MKIND[].nerve` is the share of health below which a creature breaks and runs — rogue
0.38 (quick to close, quick to bolt), mage 0.45, minion 0.28, **brute 0, because a brute
does not break**, and a boss never does whatever its kind says. A routed creature:
- runs directly away at 1.35x its speed and **does not fight** (`continue` before the
  attack block, so it cannot be cornered into swinging)
- shows `flees` over its head, dims to 55% colour and carries a `!` in the flat view,
  and plays its walk clip in 3D
- **escapes for good at 14 units.** Letting it recover instead stalled the floor: a
  routed thing still counts as roused, so the delve could never end. That was the one
  real design trap in this change.
- `clear` now ignores fleeing mobs, for the same reason.

The floor banner reads `4 still moving · 1 routed` and the delve panel says
`1 broke and ran`.

### Tests
**No deterministic guard, and saying so rather than faking one.** Whether anything breaks
inside a test window depends on the dice. What I did instead was make a rout *reportable* —
the rail is DOM, so a rout is observable — and watched for one: `ROUT SEEN ... 1 broke and
ran`, with `dist/flee.png` showing it. Making the behaviour legible in the UI was worth
doing for its own sake and happened to be what made it checkable.

## Cycle 30 — the delvers get morale too (shipped)
Worked unattended.

**The loop prompt was wrong and checking cost nothing.** It claimed nothing decides to
retreat on low health; there has been a `hpFrac < 0.34` check all along. The actual flaw
was subtler: `hpFrac` is the party **mean**, which hides the one who is dying. Three at
full health and one at five per cent averages 0.76, nobody turns back, and that one dies.

- The **worst-off member** can now call it: `wf < 0.18` with more than one in the party
  ends the push, logging who. The mean check stays for a party ground down evenly.
- A delver below **26%** sets `p.shy` and falls back toward the stairs instead of trading
  another blow — unless something is already inside 1.4 units, because you cannot
  disengage from a thing in your face. Clears at 55%, so a healed delver stands in again.
  Ranged styles are exempt: they are already standing off.
- The rail shows a hurt delver in red with a back-arrow; the delve panel says
  **Making for the stairs**.

### Tests, and a lesson about ambiguous signals
First attempt watched for "Making for the stairs" and saw it in 4.2 seconds — but with no
reason line, because that text also fires for the ordinary end-of-run retreat when the
party reaches its target floor. **The signal did not distinguish the thing being tested
from the thing that always happens.** Forcing the thresholds in a scratch build
(`f<0.995`, `wf<0.90`) settled it: `Jessa is badly hurt. The party breaks off.` plus a
delver hanging back, then reverted.

No deterministic guard, same reason as c29: whether a delver drops below 26% inside a test
window is down to dice. The behaviour is legible in the UI instead, which is what made it
observable at all.

---

# THE NORTH STAR (stated by the owner, 2026-11-06 ~02:00)
Three directions, in his words and my reading of them. **These outrank polish.** If a
cycle is choosing between one of these and a cosmetic improvement, take these.

## 1. The people must think, not follow a timetable
"these npcs are supposed to be able to think on their own... without me having to push a
button for them to do so."

Autonomy of *action* is already true — nothing in Ashvale waits for input; parties form,
people marry, seasons turn, with the page untouched. Autonomy of *mind* is not. Today
`schedule(p)` is a clock lookup with dice:
```js
if(h<20){ const r=rnd(); if(r<0.26) return theTavern; if(r<0.38) return theAltar; ... }
```
A villager at six in the evening rolls a number. There is no reason behind the choice and
no consequence to it tomorrow. What is missing:
- **Drives.** Nobody wants anything — no hunger, ambition, loneliness, fear — so no option
  can be better than another and dice are the only honest way to pick.
- **Memory.** Every person already carries `log: []`, created in `mkPerson` and **never
  written to**. Nobody remembers a brother lost on floor nine or who they drank with.
- **Relationships** beyond blood. Families exist; friendship, debt and grudge do not.
  `formParty` picks by level and health, never by who trusts whom.

The target: a villager goes to the tavern because they are lonely and a friend is there; a
girl signs the guild roll because her sister never came back up; a delver refuses the party
containing the man who left him on floor twelve. Utility scoring over drives, with memory
feeding the scores, replaces `rnd()`.

## 2. The map must grow as people explore
"dont forget about map expansion and how it generates as people explore its not all about
the dungeon."

Today the overworld is a fixed `N x N` grid generated once from the seed; `ty`, `hh`,
`tree` and `occ` are flat arrays of that size and the 3D terrain is one mesh built once.
There is no beyond. Everything outward-facing — the east gate, the roads — leads nowhere.

This is the largest architectural item in the project. It needs chunked terrain generated
on demand around where people actually are, a reveal/known state per chunk, and a 3D
terrain that rebuilds per chunk instead of wholesale. Scouts, traders and adventurers
walking out is what should trigger it, not a button.

## 3. It must look good — but after the systems
"Its also okay for us just to get everything done first before making it look visually
appraling." Aspiration stated as "at least Diablo 3".

Honest gap, measured rather than guessed — the material census across the whole game:
```
16  MeshLambertMaterial      7  MeshBasicMaterial      0  MeshStandardMaterial
```
Every surface uses a lighting model with no specular, no normal maps and no environment
response. That single fact is why it reads flat regardless of model quality, and why the
c26 note said the HDRI could not help. The renderer pass, when it comes, is: Lambert to
MeshStandardMaterial, the normal maps already staged and unused
(`Ground037_1K-JPG_NormalGL.jpg`), ACES tone mapping and bloom — which is the largest
perceptual jump for the least work — and only then the HDRI, behind a quality toggle
because Standard plus bloom is a real cost on a laptop.

**Diablo 3 is not reachable** and should not be promised: native engine, large art team,
gigabytes of authored assets. The reachable target is the difference between a flat-shaded
toy and a lit scene. Say that plainly rather than implying otherwise.

## Cycle 31 — the breach verified, and the town answers it (shipped)

The breach shipped unverified in c8465aa. Verified now, and the verification itself taught
something: forcing `breachOdds()` to 1 was **not enough**, because the event table only
fires one event every four or more days and a breach is one weighted option among many —
over a ninety-second run, no breach came up. Forcing the *odds* only widened a gate that
was rarely reached. Calling `openBreach()` directly from `newDay()` on day 2 settled it:
`kobold diggers came up the stairs and out the east gate` then `put down at the gate.
66 gold in bounty.` **Force the thing itself, not the probability in front of it.**

Looking at that first screenshot then showed the real flaw: `fight` bubbles appeared over
defenders standing in their own kitchens across the far side of town, because `foeStep`
resolves combat abstractly and nothing moved anybody. Fixed in `schedule(p)`: while a foe
stands outside the gate, guards and adventurers go to the gate whatever the hour says, and
everyone else goes home and stays there. The town now visibly answers a breach.

**Still abstract:** the blows are traded on a timer regardless of who has actually arrived,
so a guard still fighting from two streets away is possible in the first seconds. Proper
proximity-gated defence belongs with the minds work, where someone deciding to fight is
part of what they decide.

## Cycle 32 — the first pass at minds (shipped, incomplete)
North star item 1. The evening used to be a dice roll: at six o'clock a villager drew a
number, went to the tavern for no reason, and tomorrow it meant nothing that they had.

- **Four needs** per person — `company` (rises alone, falls among people), `rest` (rises
  all day, falls at home at night), `spirit` (drains slowly, restored at the altar),
  `cheer` (rises only when they have coin to spend). Ticked in the same per-frame pass
  that moves them.
- **`chooseEvening(p)`** scores each place by the need it answers and takes the best, with
  a small jitter so identical neighbours do not march in lockstep. A spouse who is already
  out is a reason of its own. The dice remain only as a tiebreak; they no longer decide.
- **`whyOf(p)`** names the reason in plain words — lonely, worn out, looking for meaning,
  went to find <spouse>.
- **Memory, finally.** Every person has carried `log: []` since the first commit, created
  in `mkPerson` and **never written to**. `remember()` now writes at the moments that
  deserve it: a death in the family (to spouse, children and parents), a marriage, a
  birth, coming of age, standing over a boss, and taking a relic.
- The person panel shows **What they want** as four bars, what they are doing right now
  and why, and **What they remember**.

### Still open on this item
Relationships. Friendship, debt and grudge do not exist, so `formParty` still picks by
level and health rather than by who trusts whom — which is the half that would let a
delver refuse the party containing the man who left him on floor twelve. That is the next
pass, not a finished system.

**Not yet verified in play.** Paused mid-cycle at the owner's request; the suite is green
and the build is clean, but nobody has watched a villager choose the altar because their
spirit ran low. Verify before trusting it.

## Cycle 33 — the town was frozen, and nobody had noticed (shipped)

Set out to verify the needs from c32. They saturated at 100% on every axis, which meant
nobody could prefer anything to anything. Chasing that turned up something much worse.

**`p.inside` was null for 0 of 65 people at every hour of the day, including 3am.** A
tracked villager read `pos 9.5,19.6` at every single hour — the same tile, all day,
`moving:false`, flow field present, while the schedule cycled altar → manor → altar
behind them. **The whole town had been standing still.** Confirmed it predated the minds
work by checking out `196f7c4` and measuring the same thing: 0/65 there too.

The cause: a person standing on a tile the flow field does not cover (a building
footprint, which is where everyone is placed at startup) has no direction to move in, so
the goal is dropped — and re-planned next frame to the same dead end, forever. The walk
branch now steps them to the nearest tile the field does cover instead of giving up.

After the fix, measured hourly: **16 inside / 50 moving at 19:00, 60 / 6 by 03:00,
65 of 66 home at dawn.** That is the shape a town should have.

**Why nothing caught it.** Every screenshot showed people scattered across the map, so it
looked alive — they were just never in a *different* place. Market-day tax had quietly
fallen to `0 gold` because `spendAt` fires on arrival and nobody ever arrived; I had read
that line in three separate screenshots without asking why it was zero. The needs system
was the first thing that depended on anyone actually *being* somewhere, which is the only
reason it surfaced.

With people moving, the needs work: a tracked child reads **company 0, rest 0, meaning
0.88, a night out 1.0** — rested and sociable, spiritually neglected, itching to spend.
Scores are also relative now (each need minus the mean), so a person whose needs have all
climbed has no preference rather than a false one.

### Lesson
A number that is suspiciously round deserves one question. `0 gold in tax` was on screen
for three cycles. I read it as a quiet market rather than as evidence that the economy had
stopped, because I was looking at the thing I had just changed.

## Cycle 34 — who they trust (shipped)
North star item 1, the half that was missing. Families existed; friendship and grudge did
not, so a delver walked into the Keep beside the man who left him on floor twelve and
thought nothing of it.

- **`p.bond`** is a map of other ids to a number roughly -1..1, capped at 14 people — the
  faintest acquaintance is forgotten rather than the list growing forever.
- **Time in the same room** warms a pair by 0.012 an hour, counted once a game-hour over
  people grouped by building rather than per frame. A room of more than eight is skipped:
  a crowd is not company.
- **A delve is worth more than a hundred evenings in the tavern** — +0.10 to every pair
  that comes back, +0.04 if the run failed but they lived.
- **A loss sours the survivors on each other** by 0.14 each, warms them 0.05 toward the
  dead, and writes "Came back without <name>" into each survivor's memory.
- **`formParty` picks for company now.** The first name is chance; everyone after is
  whoever the party would most want beside them, and a bond below -0.55 vetoes the pair
  outright. A little randomness remains so it is not the same four every morning.
- Bonds and memories both persist in the save.

### Verified
Six days in, Lady Highholt reads **Kelm: close** (her husband), **Bryn and Hesper:
friendly** (her children) — shared-room time producing a family without being told what a
family is. Her needs read company ~0, rest ~0, meaning 0.65, a night out 1.0, and her
reason reads **"looking for meaning"** while she walks to the altar. That is the scenario
this whole north-star item was for, on screen: a villager choosing a place because of
something she wants, not because a die came up under 0.38.

**Not yet seen in play:** a grudge. Bonds only sour when somebody dies in a party, which
needs a bad delve; nothing has been watched refusing to walk beside anyone. The veto path
is written but unexercised — treat it as untested.

## Cycle 35 — the grudge, proven and then repaired (shipped)
Verifying the veto from c34 turned up a flaw that would have made the whole bond system
pointless, and it took two attempts to even test it honestly.

**Attempt one was not a test.** Forcing `bondAdd(a,b,-0.9)` produced a bond of **-0.53**,
not -0.9, because the pair had already warmed to +0.37 from delving together and the add
is cumulative. -0.53 sits *above* the -0.55 veto, so the veto never fired — the pair were
kept apart by the scoring penalty alone and the run looked like a pass. Pinning the bond
to exactly -1.00 and holding it there was the real test: **seven parties formed, Merrick
and Jessa never once together**, while each appeared separately in several. The guild had
split into two crews around the grudge.

**Then the flaw.** Forcing a party death showed the survivors' bond going 0.04 → **-0.00**.
`bondLoss` applied its -0.14, and then `endRun` handed out the full +0.10 camaraderie
bonus to every surviving pair, cancelling it almost exactly. **Losing a comrade and
surviving together were worth the same amount**, so a party could bury someone and feel
no differently about each other. `bondDelve` now takes a `lost` flag and warms 0.015
instead of 0.10 when the run buried somebody. Re-measured: 0.02 → **-0.10**, and it holds.
Also stopped writing the "came back up from floor N" memory on a run that lost someone —
that is not what anybody remembers about that day.

### What this says about testing
Both problems hid behind a result that looked correct. The pair *were* kept apart; the
penalty *was* applied. Only checking the actual number — the bond, not the outcome —
showed that neither was happening for the reason I thought. **Assert on the mechanism,
not on the thing the mechanism was supposed to cause.**

## Cycle 36 — the map representation, decided before any code

Measured the blast radius first. The fixed grid is assumed in:
`I(` **98 sites**, `inB(` 15, `ty[` 41, `hh[` 14, `tree[` 7, `occ[` 6, `N*N` 6 —
plus `wcell`/`vcell` (20) and the single-mesh `terrainGeo()`.

```js
const N=52, TW=32, TH=16, HZ=10;
const ty=new Uint8Array(N*N), hh=new Int8Array(N*N), occ=new Int16Array(N*N), tree=new Uint8Array(N*N);
const I=(x,y)=>y*N+x, inB=(x,y)=>x>=0&&y>=0&&x<N&&y<N;
```

### Option A — a chunk map keyed by coordinate
`Map<"cx,cy", chunk>` with per-chunk typed arrays. Truly unbounded.
**Rejected.** `ty` stops being an array and becomes a lookup, so all 41 `ty[` sites, 14
`hh[`, and the 98 `I(` sites change shape — about 160 edits, every one a chance at a
silent off-by-one in code that is already hard to test (the town was frozen for ten
cycles without anyone noticing). The unboundedness buys nothing a town sim will ever use.

### Option B — a larger fixed grid, generated lazily — **CHOSEN**
Raise `N` to 156 with the existing town centred, and generate land only where someone has
been. `I(x,y)=y*N+x` and `inB` keep their exact meaning, so **all 98 call sites stay as
they are.** Memory is 156² = 24,336 cells across four arrays — Uint8 + Int8 + Int16 +
Uint8 = 5 bytes a cell = **119 KB**, which is nothing.

Costs, stated honestly:
- A hard outer bound. At ~52 tiles of unexplored land in every direction from the town
  and a walking speed of 1.7–2.6 tiles/sec, that is a large world for this game; and the
  number is one constant, raisable later.
- **`terrainGeo()` must stop building the whole grid.** 156² is 24k top quads plus side
  faces — far too many to rebuild wholesale on a season change. It has to iterate only
  generated regions, and later build per chunk. This is the real work and it is confined
  to one function, which is exactly why B is cheaper than A.

### Staging from here
1. (this cycle) Grow N with the town centred, add a `gen` byte per region, generate the
   town region at boot, and make `terrainGeo()` walk only generated regions. **The town
   must look and behave exactly as it does today** — same screenshots, same tests green.
2. A `seen` state and generation on demand when somebody nears an unexplored edge.
3. Someone with a reason to walk out, driven by the needs from item 1.
4. Per-chunk terrain meshes, and the flat view drawing only known cells.

### c36 stage 1 — implemented and measured
`N` is 156 with `TOWN=52` placed at `OFF=52`, so the town is centred with 52 tiles of
room in every direction. `tx0`/`ty0` convert town coordinates to world ones; `fill` and
`raise` apply the offset themselves since they are only ever called from `buildTerrain`.

**All 98 `I(` sites and 15 `inB` sites are unchanged, as the decision promised.** What did
have to move was every hardcoded landmark: the 2D camera init, `centre()`, the keep and
east-gate camera presets, the sun target and its orbit, the keep glow, the water plane,
and the 3D camera's `tx/tz`.

`GEN` is a byte per cell marking made ground, with a bounding box; `terrainGeo()` walks
only that box and skips unmade cells.

Measured at boot: `N=156 cells=24336 made=2704 bounds=52,52..103,103 meshVerts=11436`.
The whole grid would be ~97k vertices; the town is 11.4k. The mechanism does what the
decision said it would.

**Caught by looking, again.** After the first pass the tests were green and the flat view
was perfect — and the 3D view was an empty sky, because `R3`'s camera target was still
`tx:26,tz:23`, now far outside the town. `npm test` only fails on console errors, so
"clean" meant nothing here. Read the PNGs.

## Cycle 37 — the map grows because people walk into it

### Stage 2, and most of stage 3 with it
Stage 2 alone could not be measured honestly. The trigger is somebody approaching
the made edge, and in c36 nobody had any reason to go near one — so a stage-2-only
cycle would have ended with a mechanism that compiled and a probe that teleported
a villager to prove it. Stage 3 was the only honest test of stage 2, so both are here.

**Chunks.** `CSZ=13` divides both `TOWN` (52) and `N` (156), so the town occupies
chunks 4..7 on each axis exactly and no chunk ever straddles its border. `CHGEN`
marks which chunks exist; the town's sixteen are marked at boot.

**`genChunk(cx,cy)`** writes wild country that meets the town without a seam, by
carrying on the formulas `buildTerrain` authored with rather than inventing new
ones: the eastern ridge is the same `2+(u-45)*2+sin(v*0.4)*1.5`, clamped; the river
is the same `2+sin(v*0.3)*1.4`, with a drift that is zero at the town's border and
grows with distance so it wanders instead of running 156 tiles straight. Heights,
rock and woodland come from hash noise (`h2`/`vnoise`), not `rnd()` — a cell has to
generate the same whatever order the chunks happen to be made in.

**`exploreFrom(x,y)`** runs on every step anybody takes, and makes any chunk within
seven tiles. Generating around the walker rather than at the frontier means the land
is already there by the time they can path onto it. Each new chunk clears
`fieldCache`: every cached flow field was solved against a world that stopped at the
old border and now disagrees with the ground.

**A reason to go.** Between eight and five an adult with no trade sat at home with
`why` reading "nothing to do". They now take a day in the country after what it
gives — firewood, game, roots — and come back with a few coins, their appetite for
a night out spent and their legs tired. It is the first errand in the game that does
not end at a door, so `p.goal.b` can now be null. The destination is drawn from made
ground, preferring the outermost reachable tile. At boot nothing outside exists, so
the first trip is to a wooded corner of the town's own edge; walking there makes the
next ring, and the trip after that can go into it. **The frontier creeps outward at
the pace people actually travel.**

### Three things the measurement caught that looking could not
1. **`far: 0` while every other number said success.** 9 trips, 24 chunks made,
   bounds grown in two directions — and nobody had set foot outside the town. All
   the growth was `SIGHT` reaching over the border while people walked *inside*.
   The counter that distinguishes "the world grew" from "somebody left" is the only
   reason that was visible. *Assert on the thing you mean, not on its side effect.*
2. **Walkable is not reachable.** Two foragers in a row set out for the grass west
   of the river — good ground that no path from the town can cross — stood with no
   flow value under them and gave up at dusk; 8 of 14 trips died that way.
   `wildSpot` now builds the field for a candidate and checks it comes back to the
   walker before committing. 14 of 14 completed after.
3. **A trip has to fit in the daylight left.** The clock advances 22 game-minutes
   per dt-unit and a walker covers about 1.7 tiles in one, so an hour of daylight is
   worth roughly 4.6 tiles. A forager setting out at four was picking somewhere a
   whole day away. The destination is now budgeted against `(20-hour)`.

### A fourth, which was my own measurement lying
The probe failed with `grew while paused`, 3 chunks appearing with the sim stopped.
It had not. `bb` was read, then two tool calls and four assertions ran, then the
pause was clicked — all at 8x speed — and the assertion blamed the pause for the
gap between its two readings. It now reads the count at the moment of the click and
checks `speed===0` as well; growth while paused is zero. **An assertion that
compares numbers taken at different times will invent a bug and send the next cycle
hunting it.** Worse, `2>&1 | grep` on the probe had been swallowing the traceback,
so for two runs it looked like a silent pass.

### Two more c36 offset bugs, both found by looking
`c36` moved the town to the middle of the grid and I believed I had caught every
hardcoded landmark. Two survived, and `npm test` was green over both:
- the flat view's Keep glow and `Dragon's Keep ↓N` plate drew at world (49,19),
  far out in the unmade north-west — **the plate is simply missing from c36's
  screenshot, and I published it anyway**;
- the 3D **Re-centre** button set the camera target to the unoffset `26,23`, so
  pressing it threw the view into the void.
I could not find an honest cheap automated guard for either — a red-pixel count
cannot tell the Keep's glow from a red roof. The guard is the rule, which has now
caught this class three times: **read the PNGs, every one, every cycle.**

### Measured
```
boot    chunks=16 made=2704  bounds=52,52..103,103
paused  chunks=16 made=2704            (unchanged)
ran 65s chunks=23 made=3887  bounds=52,39..103,116  started=10 done=5 gaveup=0 far=4
paused  chunks=28 ... at click 28 -> 28 (unchanged, speed=0)
```
Growth is north, south and west only. East is the ridge and the near west is the
river, so there is nowhere else to walk — which is the generator agreeing with the
authored map rather than ignoring it.

Also: the 3D water plane was sized to the whole grid, which turned every unmade acre
into open sea and read as an island. It is a unit plane now, fitted to `genBounds()`
on every regrow.

### Still open
- **Stage 4 — per-chunk terrain meshes.** The frontier reads as rectangular slabs
  with a cliff lip, which is honest (it is the edge of the known world) but coarse;
  per-chunk meshes would let the edge be softened as well as making `applySeason()`
  cheap on a large world.
- Trees in new country are the procedural cones; `dressTown`'s GLB props are
  town-only.
- The errand is the only reason anyone leaves. A trader with somewhere to trade,
  and an adventurer walking to the gate, would both use the same machinery.

## Cycle 38 — the ground, a chunk at a time (item 2, stage 4 — closes item 2)

One geometry over the whole made world was fine while the world was the town. Once
it grew wherever somebody walked, every new chunk rebuilt every acre ever made, and
so did every season change. The ground is now one mesh per chunk under a group:
`chunkGeo(cx,cy)` builds one, `syncGround` installs only the dirty ones, and
`R3.chunks` is a Map keyed the same way as `CHGEN`.

**A season turns colours, not shapes.** So the two are split: `chunkGeo` lays the
buffers down and `chunkRecolour` rewrites the colour attribute in place — no
geometry, no index buffer, no `computeVertexNormals`. Both drive the same
`chunkWalk`, because two loops that each decide how many quads a cell needs are two
chances to disagree, and the first disagreement would paint every colour after it
onto the wrong vertex.

**Why a new chunk dirties five.** A cell's side faces are drawn against its
neighbours' heights, so land appearing next door changes the *old* chunk's lip. The
new chunk and its four neighbours are marked; nothing else.

### Measured
```
boot    meshes=16 verts=11620 builds=16 recolours=0
grew    meshes=22 verts=16140 builds=28      new=6  built=12
season  meshes=22 verts=16140 builds=28 recolours=22   drift=0
```
Six new chunks cost **12 builds**, not 132 — and the old single mesh rebuilt all
16,140 vertices for each one of the six. A season change rebuilds **nothing**:
`builds` does not move, 22 chunks recolour, no vertex shifts.

I measured build counts rather than wall-clock. In a headless swiftshader browser a
millisecond figure is noise; the count is exact and says the same thing.

### The count that did not match, and why it was my fault
The first assertion was `verts == 11436`, the figure in c36's entry above. It read
11620. **That number was stale and I had copied it out of an older cycle instead of
measuring the code in front of me** — c37 gave the made world a lip (`lev` returns
-0.6 for unmade ground), and the town's south border below the ridge is 46 cells at
height zero that now draw a face: 46 x 4 = 184, exactly the difference. The split
had changed nothing.

The assertion is now an independent count. `__ash.faceVerts()` applies the same rule
in one pass over the whole grid with no chunks in it; the per-chunk meshes must add
up to it. That is the thing splitting a mesh can actually break — a cell covered
twice at a border, or none — and a magic constant would never have caught it.

### Both new guards removed once, and both failed
- **Neighbour dirtying removed:** 16348 verts against the grid's 16140. The 208
  extra are 52 stale lip quads along borders that stopped being borders. The verts
  cross-check *is* the guard for neighbour dirtying, which is a better outcome than
  the separate test I was going to write.
- **A four-vertex slip inserted into `chunkRecolour`:** `colourDrift` reported 12712
  mismatched floats. It rebuilds each chunk with the real builder and compares, so a
  recolour walk that drifts from the one that laid the vertices down cannot hide
  behind counts that still agree.

### Still open
- The frontier still reads as rectangular slabs with a cliff lip. Per-chunk meshes
  are what make softening it possible; it was not done this cycle.
- `applySeason` also recolours the flat view's palette, which is untouched by any of
  this and still cheap.
- Trees in new country are the procedural cones; `dressTown`'s GLB props are
  town-only.
- **Item 2 is closed.** Item 3, the renderer, is next: the census is still
  `16 MeshLambertMaterial, 7 MeshBasicMaterial, 0 MeshStandardMaterial`, and Lambert
  ignores envMap entirely, which is why the HDRI cannot help yet.

## Cycle 39 — item 3 begins: the pipeline was wrong, and the art was built on it

### First, two claims checked rather than carried forward
The loop prompt said to confirm "the PBR ground textures and the HDRI actually reach
the shader". **There is no HDRI in this repo.** `spruit_sunrise_2k.hdr` is in the
owner's asset library on his machine; only four albedo WebPs were ever vendored, and
the normal maps c26 called "already staged" are not here either. And the census had
to be redone: a grep over the source says `16 Lambert / 7 Basic / 0 Standard`, but
the **live scene** says `406 / 51 / 113` — a grep cannot see what the KayKit models
bring with them. `__ash.materials()` now walks the real scene graph.

### What was actually wrong
`renderer.outputEncoding` was `LinearEncoding` and `ColorManagement` was off. Every
hex in this file was picked by eye, so every one of them is sRGB, and three was
handing those numbers to the shader as linear light and writing the result straight
out. That is why the roofs read as poster paint and the ground as washed-out olive.

Fixed: `ColorManagement.enabled=true`, `outputEncoding=sRGBEncoding`, ACES filmic
tone mapping, `encoding=sRGBEncoding` on the albedo textures, and — because colour
management converts a `THREE.Color` but cannot reach numbers pushed straight into a
buffer attribute — an explicit sRGB-to-linear on the terrain's hand-built vertex
colours. Then every town surface from Lambert to `MeshStandardMaterial` with a
roughness that means something: 0.97 ground, 0.93 plaster, 0.74 tile, 0.72 skin.

### Correct looked worse, and that is the interesting part
With the pipeline fixed and the old lights, the town came out **milky** — paler and
flatter than the version that was technically wrong. The art had been authored
against the broken pipeline, and the old look was getting its punch from a bug.
A correct pipeline that ships looking worse is not an improvement, so the lights had
to be rebalanced: a strong key against a quiet fill, exposure 0.85.

### The knob that was not connected to anything
The first tuning run reported `sun: 3.2` and I believed the light had changed. It had
not. `render3D` rewrites `sun.intensity` and `hemi.intensity` **every frame** from the
clock, so the constructor values and anything set between frames are gone by the next
tick. I had read the value back in the same tick I set it. That comparison varied
exposure and nothing else. The real knobs are now `LIT.sun`/`LIT.hemi` multipliers
inside the per-frame formula, and `__ash.lit()` reads intensities back **after** a
frame: `sun:1.9` shows up as an effective 2.42, which is how you know it arrived.

Settled on exposure 0.85, `LIT.sun` 1.9, `LIT.hemi` 0.55, ambient 0.06, chosen by
comparing four looks in one browser run. Night was checked separately and is better
than before — the lit windows carry it now that the ambient is not washing it flat.

### Measured
```
baseline  406 Lambert / 51 Basic / 113 Standard   tone=None  enc=Linear   1.3 fps
after       0 Lambert / 51 Basic / 517 Standard   tone=ACES  enc=sRGB     1.3 fps
```
The four Lambert left in the source are the Keep's, deliberately untouched: the wall
material carries an `onBeforeCompile` patch and is not something to convert at the
end of a cycle. `tools/render.py` is in `npm test` and fails if a Lambert returns to
the town scene, or if the renderer stops writing sRGB.

**On the frame cost: no difference measured, and that is weak evidence.** This is
swiftshader software rendering, where fill rate and the 2048 shadow map dominate; it
says the change added no runaway cost, not that a laptop GPU will not feel 517
Standard materials. Worth re-measuring on real hardware before adding bloom.

### A test that had been lying for many cycles
`shot3d.py` clicked `#sc3D` blind to "switch to 3D". The page already boots in 3D, so
that click turned it **off**, and every `shot-3d-models.png` and `shot-3d-inside.png`
since has been a picture of the flat canvas. The asset assertions still passed, which
is why nobody noticed. It now checks the toggle state and asserts the 3D view is the
one on screen. `render.py` had the same bug on its first run and was caught the same
way — by the picture not showing what it claimed to.

### Open, and precisely what is known about it
Beyond the town's edge there is a field of pale tiles with grey blocks standing on it.
Ruled out by measurement, not by eye:
- **not the water plane** — toggled off, the field is still there;
- **not generated country** — `__ash.hist()` reports `wild: {}` in that run, zero
  cells made outside the town;
- **not the terrain's own water** — the town histogram is ordinary
  (1697 grass, 312 rock, 255 water, 292 road).
It became visible only now because the void beyond the made world reads as bright sky
instead of near-black. Next cycle starts from those three eliminations rather than
from scratch. Also still open: the Keep's four Lambert materials, the frontier's
rectangular lip, and normal maps — which need the ambientCG normal textures that are
not in this repo.

## Cycle 40 — 2,785 boulders standing on land that does not exist

### Found by naming it, not by looking at it
c39 left a field of pale tiles with grey blocks beyond the town and three things
ruled out. Rather than guess a fourth time, `__ash.strays()` now walks the scene
graph, takes each object's world-space centre, and names anything sitting outside
the bounding box of ground that exists. One run:

```
bounds 52,52..103,103   inside 734
  Scene/rock_single_A  Mesh MeshStandardMaterial   n=2785  far=53
```

**`ty.fill(ROCK)` at boot makes every cell outside the authored town ROCK**, and
`dressTown`'s boulder pass walked the whole 156x156 grid looking for ROCK. 21,632
unmade cells, a hash letting through about one in seven: 2,785 boulders hanging over
nothing, up to 53 tiles out. They had been there since the props landed. Nothing
showed it while the void rendered near-black; c39 made the sky bright and there they
were.

### A second bug hiding behind the first
`dressTown` ran once (`S.dressed=true`) and removed the procedural tree instances as
it went. So **any country generated after the models loaded had no trees of either
kind** — the instanced ones were gone and the GLB ones were never placed. It is
re-entrant now: `dressedAt` marks a cell done, `dressCell` does one cell, and
`regrow3D` calls `dressNew` for whatever just appeared.

### Removing the fix, and removing the wrong one first
The rule says remove the fix and confirm it fails. I removed the `isMade` gate in
`dressCell` and **the suite stayed green** — because the gate is not what fixes this.
The loop now runs over `genBounds()` instead of `0..N`, and that is what keeps the
boulders home. Restoring the whole-grid walk *and* dropping the gate reproduced the
bug exactly — 2,785 visible strays, guard fires.

Stated plainly: **the bounds loop is tested, the `GEN` gate is not.** The gate earns
its place when the frontier stops being a rectangle, because `genBounds` is a box and
will contain unmade cells; but the probe that loads models does not grow the world,
so I have not exercised that path. Next cycle can grow the world inside `render.py`
and close it.

### The guard had to be told what it meant
First version asserted zero objects outside the bounds and failed at 250 — person
boxes and gift spheres parked at the origin. They are pooled models for people who
are away, and they are **effectively hidden**: `o.visible` was true but a parent
group's was not. The check now walks the parent chain and counts only what would
actually be on screen. An assertion about what is visible has to mean visible.

### Measured
```
before   3884 meshes in the scene, 2785 of them boulders over the void
after    1071 meshes, strays 0
```
A 72% cut in the scene graph, which should matter more on a real GPU than anything
else this cycle did — swiftshader reported 1.3 fps either way, and that remains weak
evidence for the reasons c39 gave.

### Still open
- The Keep's four Lambert materials; the wall one carries an `onBeforeCompile` patch.
- Normal maps need the ambientCG normal textures, which are **not in this repo**.
- The frontier's rectangular cliff lip.
- The ridge boulders read dense from some angles. Tuning, not correctness.

# THE NORTH STAR, REVISED — 6 Nov 2026

The owner changed the shape of the world. His words:

> "Okay lets not bud an ever expandimg world but instead 1 that has 4 kingdoms"

> "Lets add 3 more dungeons but lets not have them so close to the kingdoms lets gave
> them spread out so they adventures actually have to go out on an adventure to go to
> these dungeons"

And, asked how alive the other kingdoms should be and what connects them, he chose
**all four fully simulated**, with **trade and travellers, war and borders, and
diplomacy and rulers**.

## What this replaces
Generation-on-demand is retired. The world is **bounded and authored**, not infinite.
`exploreFrom`/`ensureChunk` stop being a generator and become **fog of war**: the land
all exists from the start, and walking reveals it. `GEN` becomes `SEEN`. Keep the
bounds-limited rendering, the per-chunk meshes and the dirty-chunk machinery exactly
as they are — all of that is right for a fixed world too, and c38's measurements
still hold.

## What carries over, unchanged
- Per-chunk terrain meshes and recolour-on-season (c38).
- `genChunk`'s noise and its continuation of the river and ridge formulas — now used
  to **author a fixed map once at boot** instead of lazily.
- The errand machinery (c37). A goal with `p.goal.b===null` is already the thing that
  sends a person out of town with a reason; a journey to another kingdom or to a
  distant dungeon is the same mechanism with a destination worth having.
- Everything in item 1: needs, bonds, grudges, memory, party selection.
- The renderer work (c39, c40).

## The shape to build toward
1. **Four kingdoms, spread across the map, each a living town.** Ashvale is one of
   them. The other three need their own names, plans and populations — generated with
   variation rather than copy-pasted, and **no personal or real names, ever**.
2. **Four dungeons, far from every kingdom.** The Keep stops being a five-minute walk
   from the guild hall. A delve starts with a journey measured in game-days.
3. **Travel as a first-class state.** A party on the road is neither in a town nor on
   a floor; it is somewhere between, and can be seen there.
4. **Trade and travellers**, then **diplomacy and rulers**, then **war and borders**.

## Honest costs, stated up front
- **~280 simulated people, four times today's load.** The needs and bond work is O(n)
  and fine. The thing to watch is `fieldTo`: each cached flow field is a 24,336-entry
  `Int16Array` built by a BFS over the whole grid, capped at 240 entries — about
  11 MB, and four towns' worth of destinations will thrash it. Expect to need local
  or hierarchical pathing. **Measure it before assuming it is fine, and measure the
  population, not one sample.**
- The grid may need to be larger than 156 to hold four realms and four distant
  dungeons. Decide that by measuring, and remember c36: a larger fixed grid was chosen
  precisely because `I(x,y)` and `inB` keep their meaning and the call sites do not
  change. Raising `N` again should still be cheap.
- Four towns of models is four times the scene graph. c40 cut it from 3,884 meshes to
  1,071; do not give that back without noticing.
