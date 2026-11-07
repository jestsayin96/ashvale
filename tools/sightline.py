"""What is actually standing between the camera and the town's people?

"The canopy hides 78%" was never enough: it says what the trees cost without
saying what is left when they are gone. This hides each layer in turn and
attributes the loss, so the next fix is aimed rather than guessed.
"""
import subprocess, sys, pathlib, time, io
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
root=pathlib.Path(__file__).resolve().parent.parent
srv=subprocess.Popen([sys.executable,"-m","http.server","8165","-d",str(root)],
                     stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1.5); err=[]
CLIP={"x":148,"y":55,"width":912,"height":730}
def px(a,b):
    d=ImageChops.difference(a,b).convert("L").point(lambda v:255 if v>14 else 0)
    return sum(1 for v in d.tobytes() if v)
def shot(pg): return Image.open(io.BytesIO(pg.screenshot(clip=CLIP))).convert("RGB")
def folk(pg):
    """People on screen right now, by diffing them away."""
    a=shot(pg)
    pg.evaluate("()=>window.__ash.folkLayer(false)"); pg.wait_for_timeout(1200)
    b=shot(pg)
    pg.evaluate("()=>window.__ash.folkLayer(true)"); pg.wait_for_timeout(700)
    return px(a,b)
try:
    with sync_playwright() as p:
        b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader","--no-proxy-server"])
        pg=b.new_page(viewport={"width":1340,"height":860})
        pg.on("pageerror", lambda e: err.append(str(e)))
        pg.on("console", lambda m: err.append("console: "+m.text)
              if m.type=="error" and "TUNNEL" not in m.text and "ERR_" not in m.text else None)
        pg.goto("http://127.0.0.1:8165/index.html"); pg.wait_for_timeout(1500)
        if not pg.evaluate("()=>document.getElementById('view3d').style.display==='block'"):
            pg.click("#sc3D")
        pg.wait_for_timeout(10000)
        pg.evaluate("()=>window.__ash.fast(12)")
        pg.evaluate("()=>window.__ash.director(false)")
        OFF=pg.evaluate("()=>window.__ash.world().town.x0")
        who=None
        for _ in range(60):
            who=pg.evaluate("""()=>{const p=window.__ash.walker(); if(!p) return null;
                window.__ash.followId(p.id); return p;}""")
            if who and (pg.evaluate("()=>window.__ash.folkSeen().outdoors") or 0)>14: break
            pg.wait_for_timeout(600)
        assert who, "nobody ever went outdoors"
        pg.wait_for_timeout(3000)
        here=pg.evaluate("()=>window.__ash.cam()")
        pg.evaluate("()=>window.__ash.fast(0)"); pg.evaluate("()=>window.__ash.followId(null)")
        pg.wait_for_timeout(1200)
        LX,LY=here["tx"]-OFF, here["tz"]-OFF
        out={}
        # dist 16 only: each sample needs eight screenshots and software rendering
        # runs at ~1.3 fps, so two distances overran a 280 s budget. 16 is where the
        # town is worst, so it is the one worth the frames.
        for dist in (16,):
            pg.evaluate("(a)=>window.__ash.look(a[0],a[1],a[2])",[LX,LY,dist])
            pg.wait_for_timeout(3200)
            full=folk(pg)
            pg.evaluate("()=>window.__ash.groveLayer(false)"); pg.wait_for_timeout(1100)
            notrees=folk(pg)
            pg.evaluate("()=>window.__ash.buildLayer(false)"); pg.wait_for_timeout(1100)
            bare=folk(pg)
            pg.evaluate("()=>window.__ash.groveLayer(true)"); pg.wait_for_timeout(1100)
            nobuild=folk(pg)
            pg.evaluate("()=>window.__ash.buildLayer(true)"); pg.wait_for_timeout(900)
            tree_cost = notrees-full
            bld_cost  = nobuild-full
            both      = bare-full
            print("dist %-3d visible %6d px | trees cost %6d | buildings cost %6d | "
                  "everything cost %6d  (%.0f%% of the town is hidden)"
                  % (dist, full, tree_cost, bld_cost, both,
                     0 if not bare else both*100.0/bare))
            out[dist]=(full,tree_cost,bld_cost,both,bare)
            assert bare>2000, ("nobody is out there to be hidden", dist, bare)
            # The buildings cost eight times what the trees cost, and together they
            # cost far more than the sum - the occlusion is LAYERED, so moving
            # either one alone reveals almost nothing. That is why thinning the
            # canopy was never going to work. The lever is the angle.
            print("  pitch sweep (how much of the town a steeper look recovers):")
            base=pg.evaluate("()=>window.__ash.pitch()")
            for ph in (0.62, 0.80, 0.95, 1.10):
                pg.evaluate("(v)=>window.__ash.pitch(v)", ph); pg.wait_for_timeout(2200)
                v=folk(pg)
                print("     ph %.2f  visible %6d px   %+.0f%% vs 0.62"
                      % (ph, v, 0 if ph==0.62 else (v-out[dist][0])*100.0/max(1,out[dist][0])))
                out[('ph',ph)]=v
            pg.evaluate("(v)=>window.__ash.pitch(v)", base)
        srv_ok=True
finally:
    srv.terminate()
print("errors:", "clean" if not err else err[:4])
