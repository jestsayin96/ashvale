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
        # Let the sim RUN to each hour instead of teleporting the clock. Setting
        # `hour` directly and reading straight away measures a town that never
        # commuted: everyone is still indoors where they were at boot. That is how
        # c44 concluded "68 of 69 indoors at every hour", which is false - a running
        # town empties into the street twice a day as work and evening change.
        pg.evaluate("()=>window.__ash.fast(25)")
        want = [9, 13, 19]
        for hour in want:
            for _ in range(90):
                if pg.evaluate("()=>window.__ash.clock().hour") == hour: break
                pg.wait_for_timeout(500)
            r = pg.evaluate("()=>window.__ash.folkSeen()")
            indoors_log["%02d:00" % hour] = "%d/%d" % (r["indoors"], r["alive"])
            print("%02d:00  alive %-3d indoors %-3d outdoors %-3d"
                  % (hour, r["alive"], r["indoors"], r["outdoors"]))
            pg.wait_for_timeout(1500)
        pg.evaluate("()=>window.__ash.fast(8)")
        st = pg.evaluate("()=>window.__ash.street()")
        print("street:", json.dumps(st))
        assert st["started"] > 0, ("nobody took an outing", st)
        # The town must not be entirely indoors at midday, nor entirely in the street.
        mid = int(indoors_log["13:00"].split("/")[0])
        assert 8 <= mid <= 58, ("midday is implausible - all in or all out", indoors_log)

        # Assert the MECHANISM, not a town-wide fraction. Pointing the camera at the
        # plaza and counting heads measures where the people happen to be, which is
        # the sim's problem. What this guards is narrower and true: put the camera on
        # a building that HAS people in it, and you can see them.
        pg.evaluate("()=>window.__ash.noon(9)"); pg.wait_for_timeout(400)
        b4 = pg.evaluate("()=>{const S=window.__ash; S.look(26,23,70); return S.folkSeen();}")
        pg.wait_for_timeout(500)
        tgt = pg.evaluate("()=>window.__ash.busiest()")
        assert tgt, "nobody is inside anything"
        # inside the auto-open range, whatever that currently is
        near = pg.evaluate("()=>window.__ash.folkSeen().autoAt") - 3
        pg.evaluate("a=>window.__ash.look(a[0],a[1],a[2])", [tgt["x"], tgt["y"], near])
        pg.wait_for_timeout(600)
        after = pg.evaluate("()=>window.__ash.folkSeen()")
        print("busiest %s holds %d; seen far %d -> seen close %d (auto %d)"
              % (tgt["kind"], tgt["n"], b4["shown"], after["shown"], after["auto"]))
        # Only the first of these is a guarantee. "More than far out" held when the
        # whole town was indoors; with people in the street the far view already
        # shows plenty, and the close view need not beat it.
        assert after["shown"] >= tgt["n"], ("moving the camera onto an occupied "
                                            "building did not reveal its people", tgt, after)
        assert after["auto"] > 0, ("close in opened nothing", after)
        pg.evaluate("()=>{window.__ash.noon(9); window.__ash.look(26,23,26);}")
        pg.wait_for_timeout(700)
        pg.screenshot(path=str(root / "dist/shot-folk.png"))
        b.close()
finally:
    srv.terminate()
print("errors:", errs if errs else "clean")
assert not errs
