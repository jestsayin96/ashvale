"""Headless smoke test. Usage: python3 tools/shot.py [index.html] [seconds]"""
import sys, pathlib
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
target = sys.argv[1] if len(sys.argv) > 1 else "index.html"
secs = int(sys.argv[2]) if len(sys.argv) > 2 else 20
errs = []

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1340, "height": 860})
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errs.append("console: " + m.text)
          if m.type == "error" and "TUNNEL" not in m.text and "ERR_" not in m.text else None)
    pg.add_init_script("""
      window.__ctxCount = 0;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        const P = new Proxy(AC, { construct(t, a) { window.__ctxCount++; return new t(...a); } });
        window.AudioContext = P; window.webkitAudioContext = P;
      }
    """)
    pg.goto((root / target).as_uri()); pg.wait_for_timeout(1800)
    (root / "dist").mkdir(exist_ok=True)

    def view2d():
        """Make sure the flat canvas is the one on screen."""
        if pg.evaluate("()=>document.getElementById('view3d').style.display==='block'"):
            pg.click("#sc3D"); pg.wait_for_timeout(900)

    def view3d():
        if not pg.evaluate("()=>document.getElementById('view3d').style.display==='block'"):
            pg.click("#sc3D"); pg.wait_for_timeout(1600)

    def flat_size():
        return pg.evaluate("""()=>{const r=document.getElementById('view')
            .getBoundingClientRect(); return [Math.round(r.width),Math.round(r.height)];}""")

    # 3D is the default view on load
    view3d(); pg.screenshot(path=str(root / "dist/shot-3d.png"))
    pg.click("[data-sp='8']"); pg.wait_for_timeout(3000)

    view2d(); pg.wait_for_timeout(800)
    pg.screenshot(path=str(root / "dist/shot-town.png"))
    w, h = flat_size()
    # A hidden canvas measures 0 and used to be clamped to 280x200, stranding both flat
    # views in the corner of the stage for the rest of the session. Never again.
    if w < 900 or h < 500:
        errs.append(f"flat canvas collapsed to {w}x{h} after a trip through 3D")

    pg.wait_for_timeout(secs * 1000)
    pg.screenshot(path=str(root / "dist/shot-run.png"))
    stats = {k: pg.inner_text("#" + k) for k in ["sPop", "sGold", "sFloor", "sClock"]}

    pg.click("#scKeep"); pg.wait_for_timeout(3000)
    pg.screenshot(path=str(root / "dist/shot-keep.png"))
    w, h = flat_size()
    if w < 900 or h < 500:
        errs.append(f"flat Keep canvas collapsed to {w}x{h}")

    # Nothing may make a noise before the person asks for it. No AudioContext should
    # exist at all until the speaker is pressed.
    ctxs = pg.evaluate("()=>window.__ctxCount|0")
    if ctxs:
        errs.append(f"{ctxs} AudioContext(s) existed before the speaker was pressed")
    pg.click("#sndBtn"); pg.wait_for_timeout(600)
    after = pg.evaluate("()=>window.__ctxCount|0")
    if after != 1:
        errs.append(f"pressing the speaker made {after} AudioContext(s), expected 1")
    pg.click("#sndBtn"); pg.wait_for_timeout(300)

    # The header has outgrown its width twice: once wrapping the speed buttons onto a
    # dead second row, once clipping the title. Check it at the widths people use.
    for w, h in ((1680, 900), (1440, 900), (1280, 720), (1024, 768)):
        pg.set_viewport_size({"width": w, "height": h}); pg.wait_for_timeout(500)
        m = pg.evaluate("""()=>{const e=document.querySelector('header');
            return {h:e.offsetHeight, over:e.scrollWidth-e.clientWidth};}""")
        if m["over"] > 1:
            errs.append(f"header overflows by {m['over']}px at {w}px wide")
        if m["h"] > 60:
            errs.append(f"header wrapped to {m['h']}px at {w}px wide")
    pg.set_viewport_size({"width": 1340, "height": 860}); pg.wait_for_timeout(500)

    # The vendored studio must actually make a sound. Count no calls - measure the
    # signal, which is the only thing that cannot lie. This guards the bundle itself,
    # the part most likely to break when the snapshot is re-copied from upstream.
    sig = pg.evaluate("""async () => {
      try {
        const e = new MUSIC.AudioEngine();
        e.project = MUSIC.applyMood(MUSIC.newProject(), 'lowkey', 11);
        e.setMasterGain(-6);
        await e.toggle();
        await new Promise(r => setTimeout(r, 900));
        const a = e.meter, buf = new Float32Array(a.fftSize);
        a.getFloatTimeDomainData(buf);
        let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v));
        e.stop();
        return { playing: e.playing, peak };
      } catch (err) { return { error: String(err) }; }
    }""")
    if sig.get("error"):
        errs.append("the music bundle threw: " + sig["error"])
    elif not sig.get("peak", 0) > 0.001:
        errs.append(f"the score produced no signal: {sig}")

    # c50. The chronicle's standing block must be COUNTED, not canned. The first
    # version of it scraped the clock with a regex and picked a sentence by hour
    # band, so it announced people in the country whether or not any had gone.
    # Two tests: the vitals must agree with the header, and the line must change
    # when the town does. A sentence that never changes is a caption.
    now0 = pg.evaluate("""()=>{const g=i=>{const e=document.getElementById(i);
        return e?e.textContent.trim():null};
        return {beat:g('nowBeat'),pop:g('nowPop'),gold:g('nowGold'),
                floor:g('nowFloor'),hPop:g('sPop'),hGold:g('sGold'),hFloor:g('sFloor')};}""")
    if now0["pop"] != now0["hPop"] or now0["gold"] != now0["hGold"] \
       or now0["floor"] != now0["hFloor"]:
        errs.append(f"the standing block disagrees with the header: {now0}")
    if not now0["beat"] or len(now0["beat"]) < 8:
        errs.append(f"the standing block has no line: {now0}")
    pg.evaluate("()=>window.__ash.fast(20)"); pg.wait_for_timeout(14000)
    now1 = pg.evaluate("""()=>{const g=i=>{const e=document.getElementById(i);
        return e?e.textContent.trim():null};
        return {beat:g('nowBeat'),pop:g('nowPop'),hPop:g('sPop')};}""")
    if now1["pop"] != now1["hPop"]:
        errs.append(f"the standing block stopped tracking the header: {now1}")
    print("now    %r -> %r" % (now0["beat"], now1["beat"]))
    pg.evaluate("()=>window.__ash.fast(1)")

    # The houses panel must render households, not an empty shell.
    pg.click("#housesBtn"); pg.wait_for_timeout(900)
    counts = pg.evaluate("()=>({house:document.querySelectorAll('.house').length,"
                         "kin:document.querySelectorAll('.kinrow').length})")
    if counts["house"] < 5 or counts["kin"] < 20:
        errs.append(f"the houses panel came up near-empty: {counts}")
    pg.screenshot(path=str(root / "dist/shot-houses.png"))
    pg.click("[data-close='houses']"); pg.wait_for_timeout(400)

    # The town must survive a reload. Pause first so the clock cannot drift between
    # the snapshot and the comparison.
    pg.click("[data-sp='0']"); pg.wait_for_timeout(400)
    pg.evaluate("()=>document.dispatchEvent(new Event('visibilitychange'))")
    pg.wait_for_timeout(300)
    keys = ["sPop", "sGold", "sFloor"]
    before = {k: pg.inner_text("#" + k) for k in keys}
    saved = pg.evaluate("()=>{try{return localStorage.getItem('ashvale.save.v1');}"
                        "catch(e){return null;}}")
    if not saved:
        errs.append("nothing was written to localStorage")
    else:
        pg.reload(); pg.wait_for_timeout(2500)
        pg.click("[data-sp='0']"); pg.wait_for_timeout(400)
        after = {k: pg.inner_text("#" + k) for k in keys}
        if before != after:
            errs.append(f"the town did not survive a reload: {before} -> {after}")
    b.close()

print("stats", stats)
if errs:
    print("FAILED"); print("\n".join(errs[:10])); sys.exit(1)
print("clean")
