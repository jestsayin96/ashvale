"""Can a watcher see that the town is alive? Usage: python3 tools/folk.py"""
import subprocess, sys, pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8133", "-d", str(root)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import time; time.sleep(1.5)
errs = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
                                    "--no-proxy-server"])
        pg = b.new_page(viewport={"width": 1340, "height": 860})
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errs.append("console: " + m.text)
              if m.type == "error" and "TUNNEL" not in m.text and "ERR_" not in m.text else None)
        pg.goto("http://127.0.0.1:8133/index.html"); pg.wait_for_timeout(1500)
        if not pg.evaluate("()=>document.getElementById('view3d').style.display==='block'"):
            pg.click("#sc3D")
        pg.wait_for_timeout(9000)
        worst = None; indoors_log = {}
        for hour in (9, 13, 19, 23):
            pg.evaluate("h=>window.__ash.noon(h)", hour)
            for dist in (18, 40, 70):
                pg.evaluate("d=>{const S=window.__ash; S.look(26,23,d);}", dist)
                pg.wait_for_timeout(500)
                r = pg.evaluate("()=>window.__ash.folkSeen()")
                indoors_log["%02d:00" % hour] = "%d/%d" % (r["indoors"], r["alive"])
                frac = r["shown"] / max(1, r["alive"])
                print("%02d:00 dist %-3d  alive %-3d indoors %-3d  SEEN %-3d (%.0f%%)  auto %d"
                      % (hour, dist, r["alive"], r["indoors"], r["shown"], frac*100, r["auto"]))
                # Close in, looking at a street, you should see its life. Further out
                # the town keeps its roofs on purpose - opening a building hides its
                # model, and a town of roofless stubs looks worse than an empty one.
                if dist <= 18 and (worst is None or frac < worst[0]):
                    worst = (frac, hour, dist, r)
        print("NOTE indoors at each hour:", indoors_log)

        # Assert the MECHANISM, not a town-wide fraction. Pointing the camera at the
        # plaza and counting heads measures where the people happen to be, which is
        # the sim's problem. What this guards is narrower and true: put the camera on
        # a building that HAS people in it, and you can see them.
        pg.evaluate("()=>window.__ash.noon(9)"); pg.wait_for_timeout(400)
        b4 = pg.evaluate("()=>{const S=window.__ash; S.look(26,23,70); return S.folkSeen();}")
        pg.wait_for_timeout(500)
        tgt = pg.evaluate("()=>window.__ash.busiest()")
        assert tgt, "nobody is inside anything"
        pg.evaluate("t=>window.__ash.look(t.x,t.y,16)", tgt)
        pg.wait_for_timeout(600)
        after = pg.evaluate("()=>window.__ash.folkSeen()")
        print("busiest %s holds %d; seen far %d -> seen close %d (auto %d)"
              % (tgt["kind"], tgt["n"], b4["shown"], after["shown"], after["auto"]))
        assert after["shown"] >= tgt["n"], ("moving the camera onto an occupied "
                                            "building did not reveal its people", tgt, after)
        assert after["shown"] > b4["shown"], ("close in showed no more than far out", b4, after)
        pg.evaluate("()=>{window.__ash.noon(9); window.__ash.look(26,23,26);}")
        pg.wait_for_timeout(700)
        pg.screenshot(path=str(root / "dist/shot-folk.png"))
        b.close()
finally:
    srv.terminate()
print("errors:", errs if errs else "clean")
assert not errs
