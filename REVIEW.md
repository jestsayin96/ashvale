# The standard

Ashvale is a watcher's interface. It is meant to be on a stream one day, which
means it is judged by somebody who is **not** reading the text, has **not** been
told what to look for, and can leave at any time.

Every cycle now runs **review → improve → build → review**. The review is first and
it is done by *looking*, not by reading counters. No probe in this repo measures
whether the thing is good; `npm test` only measures whether it does what the last
cycle claimed. The 0.25%-of-the-frame finding was invisible to ten green probes and
obvious in one screenshot.

## How a review is done

Open the build. Take the frame at **dist 12, 22 and 40**, at **08:00, 13:00 and
21:00**, in the town and in the Keep. Then answer these, in writing, with the
defect named and where it is:

1. **Is there a subject?** Does the eye land somewhere, or does the frame read as
   an even field of stuff?
2. **Can you tell what is happening without reading?** Movement, a crowd, a
   direction people are going, something lit that was not lit before.
3. **Is anything dead?** Empty panels, black columns, a rail with nothing in it,
   a stretch of ground with nothing on it.
4. **Does it look authored or defaulted?** Default greens, even spacing, a flat
   horizon, uniform tree scatter, a grid you can count.
5. **Would it survive downscaling?** Half size, as a stream gets. What is the
   first thing to disappear?
6. **Is anything lying?** A number that does not match what is on screen, a label
   for something that is not there, a counter that rose while the thing got worse.

Write every defect down in the register below, even the ones not being fixed this
cycle. A defect that is seen and not recorded gets re-discovered in three cycles'
time as if it were new.

## Rules the register is kept by

- A defect is **named and located**, never "the UI feels dated". *Where*, at what
  distance, at what hour.
- A fix is **measured against the defect**, not against a counter that happens to
  exist. If no measurement exists, build the probe, and have it assert on
  something derived this cycle.
- A defect is **struck only after the re-review** — look again, at the same
  distance and hour, and say what changed.
- **A counter going up is not the thing getting better.** c43, c46 and c49 each
  had a rising counter sitting on top of a regression.
- Nothing is called finished. "Masterpiece" is not a state the register can
  report; it is the direction the register is walked in.

---

# Working alongside another assistant

Mr. E runs a second assistant (Cursor, which can read the repo; previously Grok,
which could not) on the UI in parallel. Two agents pushing to one repo collide, so
the split is **by file, not by task**:

| | files |
|---|---|
| **The other assistant** | `src/style.css`, `index.html` |
| **This loop** | `src/game.js`, `tools/`, `ROADMAP.md`, `REVIEW.md`, `package.json` |

**`git pull --rebase` at the start of every cycle**, before anything else. Their
work lands between cycles and will otherwise be clobbered or conflict.

Two things any outside assistant has to be told, because both have been got wrong:

- **The marks under people are WebGL, not DOM.** `.mark` and `.ground-mark` match
  nothing. Anything about how a person is marked on the ground belongs to this
  loop, in `game.js`.
- **The rail is painted by JS.** `.grp`, `.tiny`, `.camrow` exist only at runtime
  and will not be found by grepping `index.html`. A rule written against a class
  that does not exist — Grok's `.keep-open` — silently matches everything or
  nothing. Verify the selector is real before styling it.

**Markup and styling are theirs; what it SAYS is the simulation's.** Their first
standing block scraped the clock with a regex and chose a canned sentence by hour
band, so the chronicle announced people out in the country whether or not any had
gone — and drove it from a MutationObserver that overwrote `game.js`'s line on
every tick. They cannot see the sim, so any text making a claim about the world
can only be a guess, and a confident guess in the world's voice is the one thing
that costs a watcher their trust. Shells, classes and ids: theirs. Sentences and
numbers: `game.js`.

Their CSS is **merged, never pasted over**. Grok's first pass dropped ~50 selectors
including `.float`; diff the selector lists before applying anything.

---

# The register

### Open

| # | Defect | Where | First seen |
|---|---|---|---|
| 18 | Occlusion moved rather than went away: people-pixels at dist 20 fell 17,359 → 6,578 after the buildings grew, while the canopy's share of hiding dropped 43.8% → 12.6%. The **buildings** now hide the town. Do not book this as a win. | town, dist 20–26 | c51 |
| ~~16~~ | ~~The canopy hides 42.7%~~ of the town's visible people at dist 26 (12.8% at dist 16). Measured c50; this is defect 1's cause. Needs clearings, thinning near the town, or shorter trees on the town edge. | town, dist 26 | c50 |
| ~~10~~ | ~~Trees are identical cones~~ — one shape, one green, one size, scattered evenly across the whole map. The single loudest "this is a prototype" signal in any frame. | everywhere, all distances | c49 review |
| 11 | The ground is a visible checkerboard — hard-edged tile squares in the grass, a grid you can count. | town, noon, dist 40 | c49 review |
| 12 | No subject. The frame is an even field of stuff; the eye lands nowhere. The plaza is the only candidate and it is empty. | town, dist 40 | c49 review |
| 13 | At the boot camera distance (40) there is nobody on screen at all. c49 fixed legibility; the first thing a watcher sees is still an empty town. | town, boot | c49 review |
| 14 | The chronicle carries dev chatter as though it were a world event — "Models loaded: the town is wearing its proper face". | chronicle, boot | c49 review |
| 15 | The Ashvale badge, bottom left, is an empty diamond placeholder. | footer | c49 review |
| ~~17~~ | ~~People are too big close in and too small far out~~ — see struck; the buildings were the problem. Distance-dependent scaling may still be wanted for stream downscaling, but it is no longer urgent. | | |
| 17b | People are too big close in and too small far out — one global `folkScale` cannot serve both. At 1.6 an adult was 2.3 units against a 4–5 unit house. Cut to 1.35 as a compromise, which is right at neither end. Needs distance-dependent scaling, the way the ground disc already does it. **Check first whether the HOUSES are the ones out of scale**: `fitModel` fits each building to its plot, so a KayKit house may be inflated well past the scale its own characters were drawn for. | town, dist 12–16 | c50 review |
| 1 | Only 6 of 58 outdoor people are in frame at all; size fixed legibility, not presence. Canopy is the untested suspect. | town, dist 20, any hour | c49 |
| 2 | The conga line: whole town walks single file to one spot, strands out there after dark, chasing a frontier that recedes as it is approached. | open country, 17:00 onward | c49 |
| 4 | Left rail clips its own last line; no scroll at 860px viewport height. | left rail, short viewports | c48 |
| 5 | The Keep has no follow and no keyboard camera at all. Both camera cycles were town-only. | the Keep | c47 |
| 6 | Ground mark is near-black at 34% opacity and vanishes on grass. Needs a rim, not more opacity — and it is WebGL, so it cannot be fixed in CSS. | town, all distances | c49 |
| 7 | `genChunk`'s terrain rules are Ashvale-relative (`u>=46` is a half-plane, not a ridge). Replayed over the map they make 81.9% impassable rock, which is what blocks the other three kingdoms. | the whole map | c41 |
| 8 | Four Lambert materials remain in the Keep; the wall one carries an `onBeforeCompile` patch that must be read before it is touched. | the Keep | c38 |
| 9 | No normal maps. Needs ambientCG textures that are not in this repo. | everywhere | c38 |

### Struck

| # | Defect | Fixed | Re-reviewed |
|---|---|---|---|
| 10 | The canopy was striped into rows of one model: `(x*3+y*7)%3` — x*3 is divisible by 3 for every x, so the prototype came from y alone. Three real KayKit trees read as one cone copied forever. | c50, real 2D hash + height, lean and tint variation | 6 shapes, 6 canopy colours, height spread 1.32 → 6.52, even 33/33/33 split |
| 3 | Chronicle column was an empty black 280px band for the first in-game day. | c50, Cursor's standing block + `paintNow`/`townBeat` in game.js counting the town | "Everyone is indoors." → "2 are out in the open."; vitals agree with the header, asserted in shot.py |
| 15 | The Ashvale badge was an empty diamond placeholder. | c50, Cursor's crest + `paintBadge` town/person toggle | pending visual re-review |
| 16 | The canopy hid 43.8% of visible people at dist 26. | c51, as a side effect of the building rescale — not by fixing the trees | 12.6% at dist 26, 9.9% at 16; but see defect 18, the hiding moved to the buildings |
| 17 | Every building took a different scale factor (×1.29 hall to ×3.38 guild) because `fitModel` stretched each to fill its plot, while characters were fitted by height. A school at 3.38 units was barely two people tall, which is why villagers looked like giants beside one. | c51, `fitBuilding`: height target per kind, plot as a limit with 1.35× overspill | hall 5.11→6.90, school 3.38→4.56, guild→9.00 on target, people steady ~1.8; hall:person 3.02 → 4.06 |
| 0 | People were 0.25% of the frame — six readable figures in a town of 58 outdoors, biggest 29x41px. | c49, folkScale swept to 1.6 | 3.26% / 18 figures at dist 20 |
