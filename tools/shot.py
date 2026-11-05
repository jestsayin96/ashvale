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
    pg.goto((root / target).as_uri()); pg.wait_for_timeout(1500)
    (root / "dist").mkdir(exist_ok=True)
    pg.screenshot(path=str(root / "dist/shot-town.png"))
    pg.click("[data-sp='8']")
    pg.wait_for_timeout(3000)                      # ~09:00, people out and about
    pg.click("#sc3D"); pg.wait_for_timeout(2000)   # 3D in daylight
    pg.screenshot(path=str(root / "dist/shot-3d.png"))
    pg.click("#sc3D"); pg.wait_for_timeout(secs * 1000)
    pg.screenshot(path=str(root / "dist/shot-run.png"))
    stats = {k: pg.inner_text("#" + k) for k in ["sPop", "sGold", "sFloor", "sClock"]}
    pg.click("#scKeep"); pg.wait_for_timeout(3000)
    pg.screenshot(path=str(root / "dist/shot-keep.png"))
    b.close()

print("stats", stats)
if errs:
    print("FAILED"); print("\n".join(errs[:10])); sys.exit(1)
print("clean")
