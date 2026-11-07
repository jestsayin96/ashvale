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

        # c57. The mouse must be put somewhere harmless FIRST. Playwright parks it
        # at (0,0) and never moves it unless something is clicked - and the click
        # below is conditional, because the page now boots straight into 3D. The
        # top-left corner is a screen EDGE, so c47's edge-panning was driving the
        # camera every frame, and edge-panning sets userPanned, which stands the
        # director down entirely. The probe was holding the camera and then
        # reporting that the director would not take it.
        pg.mouse.move(600, 420)
        pg.wait_for_timeout(300)

        # --- a staged event pulls the camera toward it ---
        pg.evaluate("()=>window.__ash.director(true)")
        pg.evaluate("()=>window.__ash.jump('home')"); pg.wait_for_timeout(400)
        pg.evaluate("()=>window.__ash.director(true)")   # jump clears userPanned/follow
        c0 = pg.evaluate("()=>window.__ash.cam()")
        # Stage the event, then hold the queue: the claim under test is that the
        # view goes and looks at a thing, and a lively town supplies a newer thing
        # every second or two. Without this the director was correctly chasing the
        # latest event and the probe was reading it as never arriving.
        pg.evaluate("()=>window.__ash.holdScenes(true)")
        ev = pg.evaluate("()=>window.__ash.stage(45,40)")
        gaps=[]
        # c57: 6 x 700 ms was four seconds, which was plenty when the town had
        # three people outdoors and is not plenty now that it has sixty-five and
        # renders slower. The ease closes ~2.7% of the gap PER FRAME, so what this
        # loop really needs is frames, not wall time.
        st=[]
        for _ in range(14):
            pg.wait_for_timeout(900)
            c = pg.evaluate("()=>window.__ash.cam()")
            st.append(pg.evaluate("""()=>{try{
                const d=window.__ash.director(), c=window.__ash.cam();
                return {at:d.at, scenes:d.scenes, on:d.on, follow:c.follow,
                        tx:+c.tx.toFixed(1), tz:+c.tz.toFixed(1), dist:c.dist};
              }catch(e){ return 'threw: '+e.message; }}"""))
            gaps.append(round(((c["tx"]-ev["x"])**2 + (c["tz"]-ev["y"])**2) ** 0.5, 2))
        print("director state first:", st[0])
        print("director state last :", st[-1])
        start = ((c0["tx"]-ev["x"])**2 + (c0["tz"]-ev["y"])**2) ** 0.5
        print("event at", ev["x"], ev["y"], "start %.1f" % start, "gaps", gaps)
        # eased per frame, so assert convergence rather than a distance by a wall clock
        # c57: this asserted on the LAST gap and started failing as the town got
        # livelier. The reading was [22.95, 20.65, 21.06, 21.49, 21.91, 22.33] -
        # closing, then steadily moving away - because a NEWER event fired
        # somewhere else and the director went to that instead, which is its whole
        # job. The probe had quietly assumed the staged event would be the only
        # thing happening, and that was only ever true when three people were
        # outdoors. The claim is "the view goes and looks", so the closest
        # approach is what tests it.
        best=min(gaps)
        assert best < start * 0.6, ("the director did not go to the event", start, gaps)
        # Monotonic only up to the closest approach; after that it is allowed to
        # be called away by something newer.
        upto=gaps[:gaps.index(best)+1]
        assert all(upto[i+1] <= upto[i] + 0.4 for i in range(len(upto)-1)), \
            ("the director lost ground on its way in", upto)

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
        pg.evaluate("()=>window.__ash.holdScenes(false)")
        print("switched off ->", json.dumps(st))
        assert st["on"] is False and st["at"] is None, ("the toggle does not hold", st)

        pg.evaluate("()=>{window.__ash.director(true); window.__ash.stage(26,23);}")
        pg.wait_for_timeout(1800)
        pg.screenshot(path=str(root/"dist/shot-director.png"))
        b.close()
finally: srv.terminate()
print("errors:", err[:3] if err else "clean")
assert not err
