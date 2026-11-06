"""Asset-path check: serves the project over http so models/manifest.json actually loads."""
import subprocess, sys, pathlib, time
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8123", "-d", str(root)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
errs = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-proxy-server"])
        pg = b.new_page(viewport={"width": 1340, "height": 860})
        glbs = []
        texs = []
        pg.on("response", lambda r: glbs.append(r.url.rsplit("/", 1)[-1])
              if r.url.endswith(".glb") else None)
        pg.on("response", lambda r: texs.append(r.url.rsplit("/", 1)[-1])
              if r.url.endswith(".webp") else None)
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errs.append("console: " + m.text)
                  if m.type == "error" and "TUNNEL" not in m.text and "ERR_" not in m.text else None)
        pg.goto("http://127.0.0.1:8123/index.html"); pg.wait_for_timeout(1500)
        pg.click("[data-sp='8']"); pg.wait_for_timeout(3000)
        pg.click("#sc3D"); pg.wait_for_timeout(9000)      # models load, skins spawn
        pg.screenshot(path=str(root / "dist/shot-3d-models.png"))
        # the rail repaints on a cadence, so a located element can detach mid-click.
        # go through the DOM instead of Playwright's actionability checks.
        tap = lambda sel: pg.evaluate(
            "s => { const e = document.querySelector(s); if (e) e.click(); }", sel)
        tap("#xrayT"); pg.wait_for_timeout(2500)
        pg.screenshot(path=str(root / "dist/shot-3d-inside.png"))
        tap("#xrayT"); pg.wait_for_timeout(400)
        pg.click("#scKeep"); pg.wait_for_timeout(6000)       # 3D stays on across the switch
        for _ in range(4):                                   # pull back so the floor is visible
            tap("[data-cam='out']"); pg.wait_for_timeout(250)
        pg.wait_for_timeout(1500)
        pg.screenshot(path=str(root / "dist/shot-3d-keep.png"))
        # Every mob kind must actually pull its own model. A wrong manifest key falls
        # back to the minion silently and nothing on screen says so.
        want = {"skeleton_minion.glb", "skeleton_warrior.glb",
                "skeleton_rogue.glb", "skeleton_mage.glb",
                # the bestiary: a wrong manifest key here falls back to a skeleton and
                # nothing on screen says the creature is missing
                "rat.glb", "bat.glb", "spider.glb", "slime.glb",
                "snake_angry.glb", "wasp.glb", "frog.glb", "dragon.glb"}
        missing = want - set(glbs)
        if missing:
            errs.append("mob/creature models never requested: " + ", ".join(sorted(missing)))
        # Surfaces. A texture that never loads leaves the flat vertex colour behind and
        # the scene still renders, so nothing on screen says it is missing.
        wanttex = {"ground.webp", "rock.webp", "paving.webp", "lava.webp"}
        gone = wanttex - set(texs)
        if gone:
            errs.append("surface textures never requested: " + ", ".join(sorted(gone)))
        b.close()
finally:
    srv.terminate()
if errs:
    print("FAILED"); print("\n".join(errs[:10])); sys.exit(1)
print("clean")
