"""Render a model's animation to an animated GIF, for looking at it.
   usage: python3 -I tools/preview.py [model.glb] [anim.glb] [clipword] [out.gif]"""
import subprocess, sys, pathlib, time, io
from playwright.sync_api import sync_playwright
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
model = sys.argv[1] if len(sys.argv) > 1 else "peasant-man.glb"
anim  = sys.argv[2] if len(sys.argv) > 2 else "Xbot.glb"
clip  = sys.argv[3] if len(sys.argv) > 3 else "walk"
out   = pathlib.Path(sys.argv[4] if len(sys.argv) > 4 else root / "dist/walk.gif")
FRAMES = 24

srv = subprocess.Popen([sys.executable, "-m", "http.server", "8126", "-d", str(root)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
                                    "--no-proxy-server"])
        pg = b.new_page(viewport={"width": 460, "height": 560})
        pg.goto(f"http://127.0.0.1:8126/tools/preview.html?model={model}&anim={anim}&clip={clip}")
        for _ in range(60):
            st = pg.evaluate("window.__state")
            if st != "loading": break
            pg.wait_for_timeout(500)
        print("state:", st)
        if st != "ready":
            sys.exit(f"cannot preview: {st}")
        print("fit:", pg.evaluate("window.__dbg"))
        dur = pg.evaluate("window.__dur")
        print(f"clip duration {dur:.2f}s")
        frames = []
        for i in range(FRAMES):
            pg.evaluate("t => window.__frame(t)", dur * i / FRAMES)
            frames.append(Image.open(io.BytesIO(pg.locator("canvas").screenshot())).convert("RGB"))
        b.close()
finally:
    srv.terminate()

pal = [f.quantize(colors=128, method=Image.MEDIANCUT) for f in frames]
out.parent.mkdir(exist_ok=True)
pal[0].save(out, save_all=True, append_images=pal[1:],
            duration=int(dur * 1000 / FRAMES), loop=0, optimize=True)
print("wrote", out, f"{out.stat().st_size/1024:.0f} KB")
