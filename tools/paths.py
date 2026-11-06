"""What the flow-field cache actually costs. Usage: python3 tools/paths.py [seconds]"""
import sys, pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
secs = int(sys.argv[1]) if len(sys.argv) > 1 else 60
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1100, "height": 700})
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errs.append("console: " + m.text)
          if m.type == "error" and "TUNNEL" not in m.text and "ERR_" not in m.text else None)
    pg.goto((root / "index.html").as_uri()); pg.wait_for_timeout(1500)
    pg.click("[data-sp='8']")
    f0 = pg.evaluate("()=>window.__ash.fields()")
    d0 = pg.evaluate("()=>window.__ash.world()")
    pg.wait_for_timeout(secs * 1000)
    f1 = pg.evaluate("()=>window.__ash.fields()")
    d1 = pg.evaluate("()=>window.__ash.world()")
    pop = pg.evaluate("()=>window.__ash.people?window.__ash.people():null")
    d = {k: f1[k] - f0[k] for k in ("hit", "build", "wipe", "cells", "ms")}
    print("over %ds: %s" % (secs, json.dumps(d)))
    print("cache  size=%d  bytes=%.1f MB  N=%d" % (f1["size"], f1["bytes"]/1e6, d1["N"]))
    print("rate   %.1f builds/min   hit rate %.1f%%   %.2f ms per build   %.0f cells per build"
          % (d["build"]*60/secs,
             100.0*d["hit"]/max(1, d["hit"]+d["build"]),
             d["ms"]/max(1, d["build"]),
             d["cells"]/max(1, d["build"])))
    print("world  made=%d chunks=%d" % (d1["made"], d1["chunks"]))
    # A flood must stay bounded by the cap, not by the size of the map. FMAX=130 and
    # a 4-connected flood of radius d covers about 2*d^2 cells, so 40,000 is the
    # ceiling with slack. This does not bind yet - today's floods are ~2,200 because
    # most of the grid is unwalkable - but it is the number that stops mattering only
    # if someone removes the cap, and it is what keeps the map affordable at any N.
    per = d["cells"] / max(1, d["build"])
    assert per <= 40000, ("a flood is no longer bounded by FMAX", per)
    assert d["build"] > 0, ("no fields were built - the probe measured nothing", d)
    hit = 100.0 * d["hit"] / max(1, d["hit"] + d["build"])
    assert hit > 50, ("the field cache has stopped working", hit)
    b.close()
print("errors:", errs if errs else "clean")
assert not errs
