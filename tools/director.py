"""When something happens, does the view go and look at it - and does it let go?"""
import subprocess, sys, pathlib, time, json
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parent.parent
srv=subprocess.Popen([sys.executable,"-m","http.server","8141","-d",str(root)],
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
        pg.goto("http://127.0.0.1:8141/index.html"); pg.wait_for_timeout(1500)
        if not pg.evaluate("()=>document.getElementById('view3d').style.display==='block'"):
            pg.click("#sc3D")
        pg.wait_for_timeout(9000)

        # --- a staged event pulls the camera toward it ---
        pg.evaluate("()=>window.__ash.director(true)")
        pg.evaluate("()=>window.__ash.jump('home')"); pg.wait_for_timeout(400)
        pg.evaluate("()=>window.__ash.director(true)")   # jump clears userPanned/follow
        c0 = pg.evaluate("()=>window.__ash.cam()")
        ev = pg.evaluate("()=>window.__ash.stage(45,40)")
        gaps=[]
        for _ in range(6):
            pg.wait_for_timeout(700)
            c = pg.evaluate("()=>window.__ash.cam()")
            gaps.append(round(((c["tx"]-ev["x"])**2 + (c["tz"]-ev["y"])**2) ** 0.5, 2))
        start = ((c0["tx"]-ev["x"])**2 + (c0["tz"]-ev["y"])**2) ** 0.5
        print("event at", ev["x"], ev["y"], "start %.1f" % start, "gaps", gaps)
        # eased per frame, so assert convergence rather than a distance by a wall clock
        assert gaps[-1] < start * 0.6, ("the director did not go to the event", start, gaps)
        assert all(gaps[i+1] <= gaps[i] + 0.4 for i in range(len(gaps)-1)), \
            ("the director lost ground", gaps)

        # --- a key press takes it back, and it stays taken ---
        pg.keyboard.down("d"); pg.wait_for_timeout(900); pg.keyboard.up("d")
        pg.wait_for_timeout(300)
        held = pg.evaluate("()=>window.__ash.director()")
        c1 = pg.evaluate("()=>window.__ash.cam()")
        pg.wait_for_timeout(1500)
        c2 = pg.evaluate("()=>window.__ash.cam()")
        drift = ((c2["tx"]-c1["tx"])**2 + (c2["tz"]-c1["tz"])**2) ** 0.5
        print("after key", json.dumps(held), "drift %.2f" % drift)
        assert held["at"] is None, ("a key press did not release the director", held)
        assert drift < 0.6, ("the camera kept moving after the watcher took it", drift)

        # --- and it can be switched off entirely ---
        off = pg.evaluate("()=>window.__ash.director(false)")
        pg.evaluate("()=>window.__ash.stage(20,20)")
        pg.wait_for_timeout(1200)
        st = pg.evaluate("()=>window.__ash.director()")
        print("switched off ->", json.dumps(st))
        assert st["on"] is False and st["at"] is None, ("the toggle does not hold", st)

        pg.evaluate("()=>{window.__ash.director(true); window.__ash.stage(26,23);}")
        pg.wait_for_timeout(1800)
        pg.screenshot(path=str(root/"dist/shot-director.png"))
        b.close()
finally: srv.terminate()
print("errors:", err[:3] if err else "clean")
assert not err
