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
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errs.append("console: " + m.text)
                  if m.type == "error" and "TUNNEL" not in m.text and "ERR_" not in m.text else None)
        pg.goto("http://127.0.0.1:8123/index.html"); pg.wait_for_timeout(1500)
        pg.click("[data-sp='8']"); pg.wait_for_timeout(3000)
        pg.click("#sc3D"); pg.wait_for_timeout(9000)      # models load, skins spawn
        pg.screenshot(path=str(root / "dist/shot-3d-models.png"))
        pg.click("#scKeep"); pg.wait_for_timeout(6000)       # 3D stays on across the switch
        pg.screenshot(path=str(root / "dist/shot-3d-keep.png"))
        b.close()
finally:
    srv.terminate()
if errs:
    print("FAILED"); print("\n".join(errs[:10])); sys.exit(1)
print("clean")
