# Ashvale & Dragon's Keep

A living fantasy town and the hundred-floor dungeon that feeds it, simulated in the browser.
No engine, no asset files — everything is drawn from code.

**Play:** https://jestsayin96.github.io/ashvale/

## What it simulates

**The town.** Twenty-two families — twenty common, two noble — each with real names, ages, kin,
trades and homes. Adulthood is fifteen; children attend the schoolhouse until then and are tested
for magic at seven. About one in five is gifted, in one of five schools. Five shops, one family
behind each counter. Everyone keeps a daily routine and goes indoors: click a building and the
roof lifts off so you can see the room, the furniture and who is standing in it.

**The economy.** Coin actually moves. People buy from the shops at real prices, the till fills,
and on market day the family splits the takings after a tenth goes to the hall as tax. The hall
pays wages to its clerks, teachers and guards. Anyone flush banks the surplus in the Vault.

**The Keep.** A hundred procedurally generated floors across five themes, from wet caves down to
the dragon's floors. The guild forms parties each morning; you can watch one fight its way across
a floor tile by tile, or let the others resolve in the background. Monsters wake when you get
close. Chests, torchlight, fog of war, retreat when the party is badly hurt. Every tenth floor is
held by something with a name, and killing it hands every survivor a permanent relic. People who
die down there are gone from the town, and their spouse is widowed.

## Running it

```sh
npm run serve      # http://localhost:8080
npm run check      # syntax check
npm run build      # bundle to dist/artifact.html (single-file build)
npm test           # check + build + headless smoke test with screenshots
```

Nothing to install for the game itself — it is plain HTML, CSS and one script.
The smoke test needs Python with Playwright.

## Layout

```
index.html        dev entry
src/style.css     all styling
src/body.html     markup, shared by the dev page and the bundle
src/game.js       the whole simulation and both renderers
tools/build.mjs   bundles into one self-contained file
tools/shot.py     headless smoke test, writes screenshots to dist/
ROADMAP.md        what has shipped and what is next
```

`src/game.js` is still one file. It is being split into modules a system at a time, as each
one gets worked on — see the roadmap.

## Asset credits

Characters and animation clips are from **Adobe Mixamo**, used under its licence
(free use, including commercially, with an Adobe account; no attribution required).

Props and buildings under `models/props/` are from
[BabylonJS/Assets](https://github.com/BabylonJS/Assets), licensed
**CC BY 4.0**. If this is ever distributed or sold, that credit must travel with it.

The two sets are kept in separate folders so their licences never get muddled.
