"""The live material census, and the shots that say whether a renderer change happened.
Usage: python3 tools/render.py [tag]"""
import subprocess, sys, pathlib, time, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
tag = sys.argv[1] if len(sys.argv) > 1 else "now"
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8126", "-d", str(root)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
errs = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
                                    "--no-proxy-server"])
        pg = b.new_page(viewport={"width": 1340, "height": 860})
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errs.append("console: " + m.text)
              if m.type == "error" and "TUNNEL" not in m.text and "ERR_" not in m.text else None)
        pg.goto("http://127.0.0.1:8126/index.html"); pg.wait_for_timeout(1500)
        # the page already boots in 3D, so clicking the toggle blind turns it OFF
        if not pg.evaluate("()=>document.getElementById('view3d').style.display==='block'"):
            pg.click("#sc3D")
        pg.wait_for_timeout(9000)     # models load
        assert pg.evaluate("()=>document.getElementById('view3d').style.display==='block'")
        # noon, so the shot is not judged on a night sky
        pg.evaluate("()=>window.__ash.noon&&window.__ash.noon()")
        pg.click("[data-sp='0']"); pg.wait_for_timeout(600)
        fps = pg.evaluate("""()=>new Promise(res=>{ let n=0; const t0=performance.now();
          const f=()=>{ n++; const d=performance.now()-t0;
            if(d<3000) requestAnimationFrame(f); else res(+(n/(d/1000)).toFixed(1)); };
          requestAnimationFrame(f); })""")
        print(tag, "fps", fps, "lit", json.dumps(pg.evaluate("()=>window.__ash.lit?window.__ash.lit():null")))
        cen = pg.evaluate("()=>window.__ash.materials()")
        print(tag, json.dumps(cen))
        pg.screenshot(path=str(root / ("dist/shot-render-%s.png" % tag)))
        if tag != "baseline":
            # the town scene has no lighting model without specular left in it
            assert cen["byType"].get("MeshLambertMaterial", 0) == 0, \
                ("a Lambert material is back in the town scene", cen["byType"])
            assert cen["tone"] == 4, ("tone mapping is not ACES filmic", cen)
            assert cen["enc"] == 3001, ("the renderer is not writing sRGB", cen)
        # a close look at one building, where a lighting model shows most
        pg.evaluate("()=>window.__ash.look&&window.__ash.look(26,23,14)")
        pg.wait_for_timeout(900)
        pg.screenshot(path=str(root / ("dist/shot-render-close-%s.png" % tag)))
        b.close()
finally:
    srv.terminate()
print("errors:", errs if errs else "clean")
assert not errs
