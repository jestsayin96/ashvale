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
