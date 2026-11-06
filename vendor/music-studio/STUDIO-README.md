# Music Studio

A local browser app for writing original music for your own videos. It is a step sequencer with synthesized drums and synths, plus an optional CC0 WAV sampler. Mood presets, a bar-aligned loop renderer, a 2–5 second sting maker, and WAV export are built in. Runtime network is limited to loading local `/samples/` assets served by Vite.

## v3.4.2

- **`npm run render` exit 13:** Do not `unref` yield timers (that emptied the event loop while the render promise was still pending). CLI uses `main().then(() => process.exit(...))` with no top-level await. Exit tests assert WAV + `report.json`, plus `--stems` / `--layers`.

## v3.4.1

- **`npm run render` exits:** Node no longer hangs after printing the JSON line (MessageChannel ports were holding the event loop). CLI calls `process.exit` after the JSON line. Spawn test covers exit code 0. Style-header matrix runs every style on short sheets plus one longform style pass so the suite stays faster.

## v3.4.0

- **Samples in headless render:** `pureBackend` plays cached WAVs. `--style incredibox` schedules beat/voice layers; JSON summary includes `samplesUsed`. `--no-samples` keeps the synth fallback.
- **`--layers <json>`:** bar-range + 16th-step sample schedules (see `examples/layers_example.json`). Default vocal bus sits ~3.5 dB under the bed (`--vocal-db` overrides). Cue-sheet header `layers path.json` also works.
- **Manifest `root`:** tonal chants/hums may list `"root": "A3"` (or MIDI); render pitches to the nearest in-key degree within ±6 semis.
- **Loader:** WAVE_FORMAT_EXTENSIBLE PCM/float WAVs; missing manifest `version` warns and assumes 1.
- **Vocals stem:** `--stems` can write `_vocals.wav` with the layer bus; music + sfx + vocals ≈ mix before the limiter.
- **`--help` / `-h`:** full flag list. Vitest uses a single forks pool so `npm test` exits cleanly.

## v3.3.0

- **Headless CLI:** `npm run render -- examples/short.md --out out/ --stems` plans and synthesizes a cue sheet in Node (same `pureBackend` path as `scoreVideo`), writes WAVs + `report.json` + `listen.md`, and prints one JSON summary line. Optional `--samples <dir>` loads `manifest.json` / `manifest.local.json` via `loadSampleLibraryFromDir`.
- **Load library:** Sequencer **Load library** button calls `musicStudio.loadSamples()`. AI box supports async `{ "op": "loadSamples", "url"?: "..." }` through `applyCommandAsync` / `musicStudio.run`.
- **Stems:** `exportStems` / `exportAll({ stems: true })` / CLI `--stems` write `_mix`, `_music`, and `_sfx` WAVs with per-file LUFS and 4× true-peak trim to −1 dBTP (`TRUE_PEAK_CEILING_DBTP`).
- **Low-key moods:** Slower (70–88 BPM), sparser (no 16th hats, kick on 1&3), darker low-pass, wider pads with mono low end. Incredibox `mood:'lowkey'` passes the mood check on seeds 1..5 without loosening `scoreMood`.

## Requirements

- Node.js 20 or newer (LTS)
- Chrome or Edge

## Run

```
npm install
npm run dev
```

Open exactly [http://localhost:5173](http://localhost:5173). Click **Start audio**, then **Play**.

## Workflow

1. In **For a video**, choose what the clip needs: under talking, music only, an intro, or an outro. Pick a feel and a length, then press **Compose for video**.
2. Press **Start audio**, then **Play**, and listen. Same seed makes the same piece again.
3. Press **Normalize + Export WAV**. A voice bed aims for about −20 LUFS and dips the speech range. A music-only theme aims for about −16 LUFS.
4. The export is one seamless loop. Repeat it under a longer video.

You can still edit steps, change mood, render a loop, or make a 2–5 second sting.

## Styles and batches

The For a video panel can leave Style on Legacy, which keeps the original compose, or pick a style (including `incredibox` layered loops). Length can be a loop or an exact duration. Variety warns, reseeds, refuses, or stays off when a new piece is close to one already logged.

`musicStudio.batch('fill-library-20')` builds 20 items across styles, moods, and roles. `styles-sampler-8` builds one 30 second loop per style. Reports list measured LUFS, true peak, BPM, and timing. They do not say how the music sounds. See `docs/STYLES.md`.

Match builds a new piece from profile numbers or one LIBRARY.md row. Ratings can bias the next compose. Both stay on measurements. Match results stay synthesized with `samples: false`.

## Samples

Drop CC0 WAVs under `public/samples/` and list them in `public/samples/manifest.json`. Optional `manifest.local.json` merges on top and is gitignored. Large packs are not committed; only the tiny `demo/` kit ships in git. After pull, the box bot can add a CC0 vocal pack locally.

```js
await musicStudio.loadSamples()
musicStudio.listSamples()
musicStudio.run({ op: 'addSampleTrack', name: 'Beat kick', sampleId: 'demo_kick', group: 'beat', steps: 'x...x...x...x...' })
```

Sample tracks use the sequencer pattern grid, slot tabs (A/B/C/D), sampler knobs (pitch, start/end seconds, gain, ADSR, loop), and the Arranger strip (section × track → slot or off).

## Layered loops (incredibox recipe)

```js
await musicStudio.loadSamples()
musicStudio.compose({ role: 'music', mood: 'lowkey', seconds: 60, seed: 7, style: 'incredibox' })
const heard = await musicStudio.describe()
heard.report.layers
```

Style `incredibox` stacks beat, voice, melody, and effects layers that enter and drop at section boundaries. With no samples loaded it falls back to synthesized voices and warns. Origin reports `samples: true` and `synthesized: 'mixed'` when sample tracks are used.

Exports download through the browser to your Downloads folder: `<name>_<bpm>bpm_<bars>bars.wav` and `<name>.report.json`. Stings download as `sting_<preset>_<seedhex>.wav`.

The report and the `.studio.json` file record the seed and that the audio was synthesized here with no samples. Keep both next to the WAV. That is a record of how the file was made. It does not promise a platform will never flag a coincidence.

## For an AI

After the page loads, `window.musicStudio` is ready. No clicks are required except where a browser blocks audio until **Start audio**.

```js
await musicStudio.compose({ role: "bed", mood: "lowkey", seconds: 45, seed: 12 })
await musicStudio.exportWav()
musicStudio.getProject()
musicStudio.run({ op: "set", bpm: 90, speechPocket: true, targetLufs: -20 })
musicStudio.help()
```

`role` is `bed`, `music`, `intro`, or `outro`. `mood` is `hype`, `playful`, or `lowkey`. The same `seed` always rebuilds the same project. The **AI command** box on the page runs the same JSON.

```js
const heard = await musicStudio.describe()
heard.report.summary.paragraph
heard.report.mood.pass
heard.report.speechRoom.verdict
heard.report.seam.status
await musicStudio.exportAll()
await musicStudio.rate({ rating: "love", note: "use this bed" })
musicStudio.getRatings()
musicStudio.downloadRatings()
```

`describe()` returns the listening report and does not download anything. `exportAll({ bitDepth })` downloads, in order:

- `<name>_<bpm>bpm_<bars>bars.wav`
- `<name>.report.json`
- `<name>.listen.json`
- `<name>.listen.md`
- `<name>.spectrogram.png`
- `<name>.loudness.png`
- `<name>.waveform.png`

`exportWav({ bitDepth, pictures })` still returns `{ ok, wavName, reportName, summary }` and also downloads `<name>.listen.json` and `<name>.listen.md`. The returned object may include `listenName` and `listenMdName`. Pictures are included only when `pictures` is true, or when you call `exportAll`. The Export panel checkbox **Include pictures + listening report** is on by default and uses `exportAll`.

Seam text now says **Seam OK** or **Seam CHECK**. A loud kick in the first 50 ms no longer fails the seam by itself. CHECK means a click at the join, or the 250 ms and 500 ms windows are both far apart.

`rate`, `getRatings`, and `downloadRatings` use the browser's localStorage key `musicStudio.ratings.v1`. **Download ratings.json** also saves `music-studio.ratings.json` to the browser Downloads folder. The rating buttons on the page call the same `rate` function.

These reports are measurements. A person still has to listen. See `docs/AI_GUIDE.md` for the check-and-adjust loop.

## Scoring a video

Paste a cue sheet into the Cue sheet panel, or call `musicStudio.scoreVideo(sheet, options)` from the page. The panel has seed, bit depth, stems, pictures, and SFX-file controls. A sheet is timestamps and event names (`calm`, `tension`, `hype`, `multikill`, `death`, `talking`, and the rest listed in `docs/CUE_SHEET.md`). Compose builds one synthesized score plus sound effects on those times. After export, the readout includes a timing line and the file list.

Export all saves, 500 ms apart: `<name>.score.wav`, `<name>.music.wav`, `<name>.sfx.wav`, sync JSON and markdown, a cue CSV, an EDL marker list, score listen JSON and markdown, three PNGs, and the normalized cue sheet. `download: false` returns the same names and the report objects without saving files. The sync summary and the per-cue table are measurements. The Score self-test button renders the example sheets with the Web Audio voices. The automated tests use a stand-in synth, so a person still has to run that button and listen.

The AI command box sends a cue sheet to `scoreVideo` when the text is JSON with a `cues` array, an `{ "op": "score" }` command, or cue text that parses into at least one cue. Other commands still use `run`.

## Listening reports and pictures

After a render, the app writes what it measured: loudness, brightness, stereo width, how many notes landed in key, whether the speech band is crowded, whether the mood numbers match the request, and whether the loop join clicks. The three PNGs are a spectrogram, a short-term loudness graph, and a waveform with bar lines. An AI that cannot hear the file can read `listen.json`, `listen.md`, and those pictures. Nothing in that text is a verdict that the music sounds good.

## Tests

```
npm test
```

**Self-test** in the header renders the demo project in an offline audio context, normalizes it, and prints PASS or FAIL for length, LUFS, true peak, and the loop seam.

Keep your `.studio.json` / report origin fields as proof of how the file was made (synthesized, mixed with CC0 samples, or sample-only).
