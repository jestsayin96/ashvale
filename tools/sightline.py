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
        pg.evaluate("()=>window.__ash.fast(22)")
        pg.evaluate("()=>window.__ash.director(false)")
        OFF=pg.evaluate("()=>window.__ash.world().town.x0")
        who=None
        # Boot is 06:00 and the town is still indoors; at fast(22) a few dozen
        # polls covers the morning. 60 at fast(12) did not, on one run.
        for _ in range(110):
            who=pg.evaluate("""()=>{const p=window.__ash.walker(); if(!p) return null;
                window.__ash.followId(p.id); return p;}""")
            if who and (pg.evaluate("()=>window.__ash.folkSeen().outdoors") or 0)>14: break
            pg.wait_for_timeout(600)
        assert who, "nobody ever went outdoors"
        pg.wait_for_timeout(3000)
        here=pg.evaluate("()=>window.__ash.cam()")
        # Two phases, two camera conditions, because they are incompatible.
        # Layer attribution needs a STILL camera, and a held follow eases the camera
        # every single frame - nine seconds of settling still left 393,704 px of
        # "movement" in the diff. So attribution runs unfollowed, and the cutaway,
        # which only exists while following, is checked by counting rather than by
        # diffing pixels.
        pg.evaluate("()=>window.__ash.fast(0)"); pg.evaluate("()=>window.__ash.followId(null)")
        pg.wait_for_timeout(1200)
        LX,LY=here["tx"]-OFF, here["tz"]-OFF
        out={}
        # dist 16 only: each sample needs eight screenshots and software rendering
        # runs at ~1.3 fps, so two distances overran a 280 s budget. 16 is where the
        # town is worst, so it is the one worth the frames.
        for dist in (16,):
            pg.evaluate("(a)=>window.__ash.look(a[0],a[1],a[2])",[LX,LY,dist])
            # The follow is held so the cutaway is live, and a held follow eases the
            # camera every frame - which is exactly what a pixel diff cannot have.
            # Let it converge before sampling anything, or the diff is the whole
            # moving frame (427,392 px of "people", on one memorable run).
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
        # --- phase 2: the cutaway, counted ---
        print("  cutaway (buildings standing between camera and the followed person):")
        pg.evaluate("()=>window.__ash.fast(20)")
        for _ in range(90):
            w2=pg.evaluate("""()=>{const p=window.__ash.walker(); if(!p) return null;
                window.__ash.followId(p.id); return p;}""")
            if w2: break
            pg.wait_for_timeout(500)
        pg.wait_for_timeout(3000)
        # Phase 1 cleared the follow to hold the camera still, so phase 2 must
        # re-establish it AND CHECK. The first version did not, found nobody to
        # follow, and reported "the cutaway never fired" - which was true, and
        # about the probe. A direct debug had it fading 4 of 35 at the same moment.
        st0=pg.evaluate("()=>window.__ash.cutStat()")
        assert st0["following"], ("phase 2 never got a follow, so there was nothing "
                                  "for the cutaway to do", st0)
        best={'on':0,'off':0}
        for on in (True, False):
            pg.evaluate("(v)=>window.__ash.cutaway(v)", on)
            # The fade eases at 7/second and software rendering clamps a frame's
            # delta to 0.1 s, so it needs about three frames - over two real
            # seconds here - to come back. Sampling straight after the toggle
            # counted a building that was still on its way to clear, and the
            # "off" state looked identical to the "on" one.
            pg.wait_for_timeout(5000)
            peak=0; last=0
            for _ in range(10):
                pg.wait_for_timeout(1200)
                st=pg.evaluate("()=>window.__ash.cutStat()")
                peak=max(peak, st["faded"]); last=st["faded"]
            # Peak for ON, because which buildings are in the way changes as the
            # person walks and any one of them proves the feature. SETTLED for OFF,
            # because a peak taken while a fade is still clearing counts a building
            # on its way out - which is how "off" once read identically to "on".
            best['on' if on else 'off']= peak if on else last
            print("     cutaway %-5s  up to %d of %d buildings stepped aside"
                  % (str(on).lower(), peak, st["total"]))
        assert best['on'] >= 1, ("the cutaway never fired while following", best)
        assert best['off'] == 0, ("buildings faded with the cutaway switched off", best)
        # The pitch sweep lived here and is gone. Two runs disagreed about whether
        # anything past the game's 0.78 helps - one found 0.80 best and 1.10 worse,
        # the other the exact reverse - because the probe parks somewhere different
        # every run. A measurement that cannot repeat itself is not evidence, and
        # keeping it in the suite would only invite someone to act on one half of it.
        srv_ok=True
finally:
    srv.terminate()
print("errors:", "clean" if not err else err[:4])
