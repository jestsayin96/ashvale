"""Does the map grow because people walk, and only then?
Usage: python3 tools/world.py [seconds]"""
import sys, pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
secs = int(sys.argv[1]) if len(sys.argv) > 1 else 90
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1340, "height": 860})
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errs.append("console: " + m.text)
          if m.type == "error" and "TUNNEL" not in m.text and "ERR_" not in m.text else None)
    pg.goto((root / "index.html").as_uri()); pg.wait_for_timeout(1500)
    w = lambda: pg.evaluate("()=>window.__ash.world()")
    extra = lambda: pg.evaluate("()=>({out:window.__ash.out(),outside:window.__ash.outside()})")
    boot = w(); T = boot["town"]
    print("boot   ", json.dumps({k: boot[k] for k in ("N", "made", "chunks", "bounds")}),
          "town", json.dumps(T))
    # derived from where the town actually is, never from a figure typed in here
    side = T["x1"] - T["x0"] + 1
    assert boot["made"] == side * side, ("the town is not the made world at boot", boot)
    assert boot["chunks"] == (side // 13) ** 2, ("chunk count disagrees with the town", boot)

    # --- A: paused. Nobody moves, so nothing may be made. ---
    pg.click("[data-sp='0']")
    pg.wait_for_timeout(4000)
    a = w(); print("paused ", json.dumps(a))
    assert a["chunks"] == boot["chunks"] and a["made"] == boot["made"], ("grew while paused", a)

    # --- B: running. People walk, and the world is made where they go. ---
    # Wait on GAME time, not wall time. c43 made a day four real minutes at 1x, and
    # the old wall-clock wait silently stopped giving anyone enough days to walk out:
    # 180 real seconds went from about five game-days to one and a half, and `far`
    # read 0 while the errand counters said every trip had completed perfectly.
    pg.evaluate("()=>window.__ash.fast(40)")
    day0 = pg.evaluate("()=>window.__ash.clock().mins")
    waited = 0
    while waited < secs:
        pg.wait_for_timeout(5000); waited += 5
        e = pg.evaluate("()=>window.__ash.errands()")
        days = (pg.evaluate("()=>window.__ash.clock().mins") - day0) / 1440.0
        if e["far"] > 0 and e["done"] > 0 and w()["chunks"] > boot["chunks"]:
            break
    days = (pg.evaluate("()=>window.__ash.clock().mins") - day0) / 1440.0
    print("ran    ", waited, "s =", round(days, 1), "game-days")
    bb = w(); e = pg.evaluate("()=>window.__ash.errands()")
    print("       ", json.dumps(bb), json.dumps(extra()), e)
    assert bb["chunks"] > boot["chunks"], ("nobody made any country", bb)
    assert bb["made"] > boot["made"], bb
    bx = bb["bounds"]
    assert (bx["x0"] < T["x0"] or bx["y0"] < T["y0"]
            or bx["x1"] > T["x1"] or bx["y1"] > T["y1"]), ("bounds never left the town", bx, T)
    # and it grew because somebody walked, not because anything enlarged the world
    assert e["started"] > 0 and e["done"] > 0, ("no one went out", e)
    assert e["far"] > 0, ("nobody actually left the town rectangle", e)
    # walkable is not reachable: before the field check, 8 of 14 trips died at dusk
    assert e["gaveup"] <= e["done"], ("most trips are being abandoned", e)

    # --- C: paused again. It must stop. ---
    pg.click("[data-sp='0']")
    sp = pg.evaluate("()=>window.__ash.speed()")
    c0 = w(); pg.wait_for_timeout(4000)
    c = w(); print("paused ", "speed=%s" % sp, "at-click", c0["chunks"], "->", json.dumps(c))
    assert sp == 0, ("the pause button did not pause", sp)
    assert c["chunks"] == c0["chunks"], ("grew while paused", c, c0)

    pg.click("[data-sp='8']"); pg.wait_for_timeout(600)
    # pull both cameras back far enough to see the country people have made
    for _ in range(11):
        pg.click("[data-cam='out']"); pg.wait_for_timeout(60)
    pg.wait_for_timeout(700)
    pg.screenshot(path=str(root / "dist/shot-world3d.png"))
    if pg.evaluate("()=>document.getElementById('view3d').style.display==='block'"):
        pg.click("#sc3D"); pg.wait_for_timeout(900)
    for _ in range(9):
        pg.click("[data-cam='out']"); pg.wait_for_timeout(60)
    pg.wait_for_timeout(700)
    pg.screenshot(path=str(root / "dist/shot-world.png"))
    b.close()
print("errors:", errs if errs else "clean")
assert not errs
