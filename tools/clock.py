"""Does a game-day take as long as it is supposed to, and does the sim still work at it?
Usage: python3 tools/clock.py"""
import pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1000, "height": 640})
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errs.append("console: " + m.text)
          if m.type == "error" and "TUNNEL" not in m.text and "ERR_" not in m.text else None)
    pg.goto((root / "index.html").as_uri()); pg.wait_for_timeout(1500)
    want = pg.evaluate("()=>window.__ash.clock().daysec")

    # Measure the rate at each speed and derive the day length from it, rather than
    # sitting through four real minutes.
    out = {}
    for sp in (1, 3, 8):
        pg.click("[data-sp='%d']" % sp); pg.wait_for_timeout(600)
        c0 = pg.evaluate("()=>window.__ash.clock()"); pg.wait_for_timeout(8000)
        c1 = pg.evaluate("()=>window.__ash.clock()")
        mins = c1["mins"] - c0["mins"]
        sim = c1["sim"] - c0["sim"]      # simulated seconds, not wall seconds
        out[sp] = round(1440 / (mins / sim), 1)
        print("%dx  %6.1f game-min per %5.2f sim-s  ->  %6.1f s per game-day"
              % (sp, mins, sim, out[sp]))
    # 1x must land on the intended figure; swiftshader drops frames, so allow slack
    assert want * 0.95 <= out[1] <= want * 1.05, ("1x is not the intended day length", out[1], want)
    # and the faster settings must actually be faster, in roughly the right ratio
    assert abs(out[3] - out[1]/3) < out[1]*0.02, ("3x is not three times faster", out)
    assert abs(out[8] - out[1]/8) < out[1]*0.02, ("8x is not eight times faster", out)
    b.close()
print("errors:", errs if errs else "clean")
assert not errs
