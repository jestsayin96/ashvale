# The standard

Ashvale is a watcher's interface. It is meant to be on a stream one day, which
means it is judged by somebody who is **not** reading the text, has **not** been
told what to look for, and can leave at any time.

Every cycle now runs **review → improve → build → review**. The review is first and
it is done by *looking*, not by reading counters. No probe in this repo measures
whether the thing is good; `npm test` only measures whether it does what the last
cycle claimed. The 0.25%-of-the-frame finding was invisible to ten green probes and
obvious in one screenshot.

## A probe must confirm the system is doing the thing it is about to measure

c57's director failure cost two cycles and four confident wrong explanations.
Instrumented, it took one run: `at: [60.5, 41]` — the director engaged and
converging perfectly, on a **different** event. A real one had fired at the guild
and won the race. The probe measured its distance to the event *it* staged, saw
that distance growing, and reported a working feature as a dead one.

The gaps could not tell *"the director is not working"* apart from *"the director
is working on something else"*, and those want opposite responses.

**Assert where the measurement repeats; report where it does not.** Dist 12 in
`seen.py` swung tenfold between runs (45,574 → 27,235 → 4,219) because it frames a
small area whose population is luck; dist 20 held at 9,021–17,565 all evening. A
floor on a number that swings 10× is a coin toss wearing a test's clothes: it fails
on a good build and passes on a broken one, roughly at random. Dist 7 was dropped
outright for the same reason — a sample that can legitimately be empty cannot carry
an assertion.

## A probe must not change the thing it measures

Said three ways now, because it keeps arriving in new clothes:

- c52 measured its noise floor with the people **visible**, so the "noise" was
  their own animated limbs, which grow with them.
- c54 found `__ash.look()` forcing `S.ph=0.62` when the game's default is 0.78 —
  so every occlusion figure from c50 to c53 described a camera angle nobody sees.
- `grove.py` reported "the canopy hides 78%" while measuring the canopy's share of
  a frame where the **buildings** had already hidden everyone.

And its corollary, which cost two failures in one cycle: **change the
configuration and every number taken under the old one is void**, however
carefully it was derived. All of `seen.py`'s floors went stale the moment the
pitch was freed.

## Looking on real hardware

This container has no GPU: every probe drives a browser through software rendering
at about 1.3 fps, so the frames reviewed here are an approximation and can only ever
be **stills**. Motion — whether the town moves like somewhere people live — has
never once been reviewed.

The owner's machine can close both gaps. `Claude_Browser__preview_start` on
<https://jestsayin96.github.io/ashvale/> renders on his GPU at real speed, and
`__ash` is available in that page exactly as it is in the probes, so the camera can
be driven from JavaScript. Confirmed working c52.

Two limits found straight away: the pane opens narrow (~507px), which shows the
responsive collapse rather than the stream layout — set a viewport with
`resize_window` and reset it to `desktop` afterwards — and screenshots come back
scaled to the pane, so fine detail is better judged close in than wide.

Note also that `github.io` is **not** on this container's egress allowlist. The live
build can only be fetched from his machine, never from here.

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
| 18 | **Buildings hide the town, not trees.** Measured at the game's real pitch with each layer hidden in turn: trees cost 1,853 px, buildings 26,285 — fourteen to one — and together 31,262, far more than the sum, so the occlusion is **layered** and moving either alone reveals almost nothing. 62% of outdoor people are hidden at dist 16. The fix is a cutaway between camera and subject, not thinning anything. | town, dist 16 | c54 |
| 12 | No subject. The frame is an even field of stuff; the eye lands nowhere. The plaza is the only candidate and it is empty. | town, dist 40 | c49 review |
| 14 | The chronicle carries dev chatter as though it were a world event — "Models loaded: the town is wearing its proper face". | chronicle, boot | c49 review |
| 15 | The Ashvale badge, bottom left, is an empty diamond placeholder. | footer | c49 review |
| 19b | Villagers are *tinted* KayKit adventurers with the weapons put away, not villager meshes. Good enough to read as a town; a genuine peasant body is still a Blender job, and c53 established exactly which meshes to touch (Body/Arms/Legs/Cape/Hat — never Head). | everywhere | c53 |
| 4 | Left rail clips its own last line; no scroll at 860px viewport height. | left rail, short viewports | c48 |
| 5 | The Keep has no follow and no keyboard camera at all. Both camera cycles were town-only. | the Keep | c47 |
| 6 | Ground mark is near-black at 34% opacity and vanishes on grass. Needs a rim, not more opacity — and it is WebGL, so it cannot be fixed in CSS. | town, all distances | c49 |
| 7 | `genChunk`'s terrain rules are Ashvale-relative (`u>=46` is a half-plane, not a ridge). Replayed over the map they make 81.9% impassable rock, which is what blocks the other three kingdoms. | the whole map | c41 |
| 8 | Four Lambert materials remain in the Keep; the wall one carries an `onBeforeCompile` patch that must be read before it is touched. | the Keep | c38 |

### Struck

| # | Defect | Fixed | Re-reviewed |
|---|---|---|---|
| 10 | The canopy was striped into rows of one model: `(x*3+y*7)%3` — x*3 is divisible by 3 for every x, so the prototype came from y alone. Three real KayKit trees read as one cone copied forever. | c50, real 2D hash + height, lean and tint variation | 6 shapes, 6 canopy colours, height spread 1.32 → 6.52, even 33/33/33 split |
| 3 | Chronicle column was an empty black 280px band for the first in-game day. | c50, Cursor's standing block + `paintNow`/`townBeat` in game.js counting the town | "Everyone is indoors." → "2 are out in the open."; vitals agree with the header, asserted in shot.py |
| 15 | The Ashvale badge was an empty diamond placeholder. | c50, Cursor's crest + `paintBadge` town/person toggle | pending visual re-review |
| 16 | The canopy hid 43.8% of visible people at dist 26. | c51, as a side effect of the building rescale — not by fixing the trees | 12.6% at dist 26, 9.9% at 16; but see defect 18, the hiding moved to the buildings |
| 17 | Every building took a different scale factor (×1.29 hall to ×3.38 guild) because `fitModel` stretched each to fill its plot, while characters were fitted by height. A school at 3.38 units was barely two people tall, which is why villagers looked like giants beside one. | c51, `fitBuilding`: height target per kind, plot as a limit with 1.35× overspill | hall 5.11→6.90, school 3.38→4.56, guild→9.00 on target, people steady ~1.8; hall:person 3.02 → 4.06 |
| 19 | The town had **three bodies** — every man a rogue, every woman a mage, every child a hooded rogue. | c53, per-mesh tint of clothing only | 3 → 6 distinct appearances among visible people |
| 9 | No normal maps; needed ambientCG textures not in the repo. | c52, owner supplied the packs on his machine; 8 maps staged, downscaled and vendored at 610 KB | ground has colour + normal at scale 0.65, confirmed on GPU |
| 11 | The ground was a visible checkerboard — `((x*7+y*13)^(x*3+y*11))%7`, an XOR of two linear forms mod 7, which is a lattice. Three discrete buckets meant three discrete greens. | c52, the h2 mixing hash, continuous tint | gone; confirmed by eye on the GPU build, ground reads as mottled grass |
| 13 | At boot there was nobody on screen at all — and the cause was the CLOCK, not the camera: the town started at 06:00 with all 69 people behind doors. | c57, wake at 09:00 and open on the town centre at dist 22 | indoors 69→4, outdoors 0→65, shown 0→45; 4,940 px of people in the opening frame |
| 2 | The conga line: the whole town walked single file to one spot and stood out there after dark, chasing a frontier that receded as they approached. The owner saw it before any probe did. | c56 — dusk check moved to where the walking happens; `wildSpot` shuffles a pool instead of taking the best; aims at a band ~7 tiles out instead of the receding edge | 4 foragers → 4 distinct places, most-shared had 1; 0 stranded after dark across 6 night samples |
| 1 | Only 6 of 58 outdoor people were in frame at all. | c54 attributed it: buildings, not canopy | superseded by defect 18 |
| 0 | People were 0.25% of the frame — six readable figures in a town of 58 outdoors, biggest 29x41px. | c49, folkScale swept to 1.6 | 3.26% / 18 figures at dist 20 |
