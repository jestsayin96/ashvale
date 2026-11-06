"""Does the camera follow a walking person, and do the keys move it?"""
import subprocess, sys, pathlib, time, json
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parent.parent
srv=subprocess.Popen([sys.executable,"-m","http.server","8139","-d",str(root)],
                     stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1.5)
err=[]
try:
    with sync_playwright() as p:
        b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader","--no-proxy-server"])
        pg=b.new_page(viewport={"width":1340,"height":860})
        pg.on("pageerror", lambda e: err.append(str(e)))
        pg.on("console", lambda m: err.append("console: "+m.text)
              if m.type=="error" and "TUNNEL" not in m.text and "ERR_" not in m.text else None)
        pg.goto("http://127.0.0.1:8139/index.html"); pg.wait_for_timeout(1500)
        if not pg.evaluate("()=>document.getElementById('view3d').style.display==='block'"):
            pg.click("#sc3D")
        pg.wait_for_timeout(9000)

        # --- jump-to presets move the target ---
        a = pg.evaluate("()=>window.__ash.cam()")
        pg.evaluate("()=>window.__ash.jump('mouth')"); pg.wait_for_timeout(400)
        bb = pg.evaluate("()=>window.__ash.cam()")
        print("jump  ", json.dumps(a), "->", json.dumps(bb))
        assert (abs(bb["tx"]-a["tx"])+abs(bb["tz"]-a["tz"])) > 5, ("jump did not move", a, bb)

        # --- keys pan the target, screen-relative ---
        pg.evaluate("()=>window.__ash.jump('home')"); pg.wait_for_timeout(400)
        c0 = pg.evaluate("()=>window.__ash.cam()")
        pg.keyboard.down("w"); pg.wait_for_timeout(1400); pg.keyboard.up("w")
        pg.wait_for_timeout(200)
        c1 = pg.evaluate("()=>window.__ash.cam()")
        moved = abs(c1["tx"]-c0["tx"])+abs(c1["tz"]-c0["tz"])
        print("key W ", json.dumps(c0), "->", json.dumps(c1), "moved %.2f" % moved)
        assert moved > 1.0, ("W did not pan the camera", c0, c1, moved)

        # --- following a walking person keeps up with them ---
        pg.evaluate("()=>window.__ash.fast(10)")
        ok = None
        for _ in range(40):                      # wait for somebody to be on their feet
            ok = pg.evaluate("""()=>{const p=window.__ash.walker(); if(!p) return null;
                window.__ash.followId(p.id); return p;}""")
            if ok: break
            pg.wait_for_timeout(600)
        assert ok, "nobody was walking to follow"
        gaps=[]
        for _ in range(6):
            pg.wait_for_timeout(900)
            gaps.append(pg.evaluate("()=>window.__ash.followGap()"))
        print("follow", ok["name"], "gaps", [None if g is None else round(g,2) for g in gaps])
        assert all(g is not None for g in gaps), ("following stopped", gaps)
        # The easing is per FRAME, and software rendering runs at about 1.3 of them a
        # second - at 60fps this closes in well under a second. So assert that it
        # converges on the person, not that it is within some distance by a wall clock.
        assert gaps[-1] < gaps[0] * 0.6, ("the camera is not closing on them", gaps)
        assert all(gaps[i+1] <= gaps[i] + 0.35 for i in range(len(gaps)-1)), \
            ("the camera is losing ground", gaps)
        pg.screenshot(path=str(root/"dist/shot-follow.png"))
        b.close()
finally: srv.terminate()
print("errors:", err[:3] if err else "clean")
assert not err
