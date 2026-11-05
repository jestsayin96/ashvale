# Ashvale & Dragon's Keep — autonomous work log

Artifact: https://claude.ai/artifact/X37GpEyLFrXV7wwn9wzkQr
Project:  /home/claude/ashvale   (the single file at /home/claude/town/town.html is RETIRED)
Repo:     jestsayin96/ashvale  -- user must create it; then add_repo and push
Pages:    https://jestsayin96.github.io/ashvale/ once Pages is switched on

Edit src/game.js, src/style.css, src/body.html. Never edit dist/ by hand.
  node --check src/game.js && node tools/build.mjs && python3 -I tools/shot.py
Publish the artifact from dist/artifact.html (the build already escapes non-ASCII).
Other artifacts (do not break): colony https://claude.ai/artifact/BbRBE9rRHmqwS53yvBHuk6
                                village https://claude.ai/artifact/R5JgMUce2ScVDYwqDgdfS3

## Working rules for each cycle
1. Pick ONE coherent theme. No half-finished systems left in the file.
2. `node --check` the script before and after. Headless-render and read the screenshot.
3. The build escapes non-ASCII automatically now; do not hand-escape src/game.js.
4. Publish only when it runs clean. Append what shipped to the Shipped log below.
5. Keep the reply to the user short — they asked for updates on request, not narration.

## Shipped
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
4. EFFECTS LAYER — lighting, particles, hit feedback, damage numbers, loot beams, depth fog.
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

## Known rough edges
- Treasury runs tight: civic wages roughly match tax income, so the town leans on Keep loot.
  Deliberate for now, but watch it if wages grow.
- Rail/console repaint cadence is coarse; fine but could be event-driven.
- No mobile test pass since the Keep landed.
- The abstract (unwatched) delve resolver and the live one can drift in pace.
