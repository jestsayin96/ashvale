"""Does a growing world rebuild only the ground that changed?
Usage: python3 tools/ground.py [max seconds]"""
import sys, pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
cap = int(sys.argv[1]) if len(sys.argv) > 1 else 120
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1340, "height": 860})
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errs.append("console: " + m.text)
          if m.type == "error" and "TUNNEL" not in m.text and "ERR_" not in m.text else None)
    pg.goto((root / "index.html").as_uri()); pg.wait_for_timeout(2500)
    mesh = lambda: pg.evaluate("()=>window.__ash.mesh()")
    world = lambda: pg.evaluate("()=>window.__ash.world()")

    m0 = mesh()
    print("boot   ", {k: m0[k] for k in ("meshes", "verts", "builds", "recolours")})
    assert m0 and m0["meshes"] == 16, ("the town should be sixteen chunk meshes", m0)
    assert m0["builds"] == 16, ("boot should build each chunk once", m0)
    # Not a figure copied from an older cycle - c36's 11436 was already stale, because
    # c37 gave the made world a lip and the town's south border gained 46 quads. The
    # parts must add up to what one unchunked pass over the grid says they should.
    want = pg.evaluate("()=>window.__ash.faceVerts()")
    assert m0["verts"] == want, ("chunk meshes disagree with a single pass", m0["verts"], want)

    # --- the world grows: only the new chunk and the ones it touches may rebuild ---
    pg.click("[data-sp='8']")
    waited = 0
    while waited < cap:
        pg.wait_for_timeout(5000); waited += 5
        if mesh()["meshes"] > 16: break
    pg.click("[data-sp='0']"); pg.wait_for_timeout(400)
    m1 = mesh(); w1 = world()
    new = m1["meshes"] - m0["meshes"]
    built = m1["builds"] - m0["builds"]
    print("grew   ", waited, "s", {k: m1[k] for k in ("meshes", "verts", "builds")},
          "new=%d built=%d" % (new, built))
    assert new > 0, ("no chunk was added", m1)
    want1 = pg.evaluate("()=>window.__ash.faceVerts()")
    assert m1["verts"] == want1, ("chunk meshes disagree after growing", m1["verts"], want1)
    assert m1["meshes"] == w1["chunks"], ("a made chunk has no mesh", m1["meshes"], w1["chunks"])
    # a new chunk dirties itself plus its four neighbours, so at most five rebuilds each
    assert built <= new * 5, ("more was rebuilt than the new land and its edges", new, built)
    # and the whole world is emphatically not being rebuilt
    assert built < m1["meshes"] * new, ("looks like a full rebuild per chunk", new, built, m1)

    # --- an untouched chunk keeps its geometry, byte for byte ---
    far = [k for k in m0["per"] if k in m1["per"] and m0["per"][k] == m1["per"][k]]
    assert len(far) >= 8, ("most of the old town should be untouched",
                           len(far), m0["per"], m1["per"])

    # --- a season turns colours, and must not rebuild a single chunk ---
    before = mesh()["builds"]
    pg.evaluate("()=>window.__ash.season()")
    pg.wait_for_timeout(300)
    m2 = mesh()
    print("season ", {k: m2[k] for k in ("meshes", "verts", "builds", "recolours")})
    assert m2["builds"] == before, ("a season change rebuilt geometry", before, m2)
    assert m2["recolours"] >= m2["meshes"], ("the season did not recolour every chunk", m2)
    assert m2["verts"] == m1["verts"], ("vertices moved on a season change", m1, m2)
    drift = pg.evaluate("()=>window.__ash.colourDrift()")
    print("drift  ", drift)
    assert drift == 0, ("recoloured vertices do not match a fresh build", drift)
    b.close()
print("errors:", errs if errs else "clean")
assert not errs
