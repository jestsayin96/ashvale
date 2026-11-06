"""How much of a person is actually on screen?

Every counter in this repo answers "how many does the game believe it drew".
This one answers the other question: take the frame, take it again with the
people layers hidden, and diff.  Whatever changed is a person, in pixels, and
nothing in the sim gets a vote.
"""
import subprocess, sys, pathlib, time, json
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
root=pathlib.Path(__file__).resolve().parent.parent
srv=subprocess.Popen([sys.executable,"-m","http.server","8141","-d",str(root)],
                     stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1.5)
err=[]

def blobs(mask, w, h, minpx):
    """Connected runs of changed pixels, so one person counts once."""
    seen=bytearray(w*h); out=[]
    for i in range(w*h):
        if not mask[i] or seen[i]: continue
        stack=[i]; seen[i]=1; cells=[]
        while stack:
            j=stack.pop(); cells.append(j)
            x,y=j%w, j//w
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx,ny=x+dx,y+dy
                if 0<=nx<w and 0<=ny<h:
                    k=ny*w+nx
                    if mask[k] and not seen[k]: seen[k]=1; stack.append(k)
        if len(cells)>=minpx:
            xs=[c%w for c in cells]; ys=[c//w for c in cells]
            out.append((len(cells), max(xs)-min(xs)+1, max(ys)-min(ys)+1))
    out.sort(reverse=True)
    return out

try:
    with sync_playwright() as p:
        b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader","--no-proxy-server"])
        pg=b.new_page(viewport={"width":1340,"height":860})
        pg.on("pageerror", lambda e: err.append(str(e)))
        pg.on("console", lambda m: err.append("console: "+m.text)
              if m.type=="error" and "TUNNEL" not in m.text and "ERR_" not in m.text else None)
        pg.goto("http://127.0.0.1:8141/index.html"); pg.wait_for_timeout(1500)
        if not pg.evaluate("()=>document.getElementById('view3d').style.display==='block'"):
            pg.click("#sc3D")
        pg.wait_for_timeout(10000)          # let the models land

        # --- stand over somebody who is out on their feet ---
        # `look` takes TOWN-LOCAL tiles and applies the kingdom offset itself.  Feed it
        # the world coordinates `cam()` hands back and it adds the offset again, walking
        # the camera 36 tiles into the wilderness on every call - which is how the first
        # frozen run came back with the nearest person 85 tiles away and an empty frame.
        pg.evaluate("()=>window.__ash.fast(10)")
        pg.evaluate("()=>window.__ash.director(false)")
        OFF=pg.evaluate("()=>window.__ash.world().town.x0")
        who=None
        for _ in range(60):
            who=pg.evaluate("""()=>{const p=window.__ash.walker(); if(!p) return null;
                window.__ash.followId(p.id); return p;}""")
            if who and (pg.evaluate("()=>window.__ash.folkSeen().outdoors") or 0)>12: break
            pg.wait_for_timeout(600)
        assert who, "nobody ever went outdoors"
        pg.wait_for_timeout(3000)

        # Freeze everything the probe does not mean to measure.  The first run diffed 73%
        # of the frame: between the two shots the clock moved, the sun moved, the camera
        # was still easing and the trees were still swaying, so the diff was the town.
        # A probe that changes what it measures is the oldest trap in this repo.
        here=pg.evaluate("()=>window.__ash.cam()")
        pg.evaluate("()=>window.__ash.fast(0)")
        pg.evaluate("()=>window.__ash.followId(null)")
        pg.wait_for_timeout(1200)
        LX, LY = here["tx"]-OFF, here["tz"]-OFF
        seen=pg.evaluate("()=>window.__ash.folkSeen()")
        print("parked at town-local %.0f,%.0f  %s  outdoors %s  shown %s"
              % (LX, LY, who["name"], seen.get("outdoors"), seen.get("shown")))

        shots={}
        for dist in (20, 12, 7):
            pg.evaluate("(a)=>window.__ash.look(a[0],a[1],a[2])", [LX, LY, dist])
            pg.wait_for_timeout(3500)       # let the ease finish before anything is read
            rig=pg.evaluate("()=>window.__ash.folkRig(6)")
            up=[r for r in rig if r["shown"]]
            assert up, ("paused, every nearby person is hidden - the freeze is the bug, "
                        "not the drawing", dist, rig[:3])
            CLIP={"x":148,"y":55,"width":912,"height":730}
            on=pg.screenshot(clip=CLIP)
            pg.evaluate("()=>window.__ash.folkLayer(false)"); pg.wait_for_timeout(1700)
            off=pg.screenshot(clip=CLIP)
            # The noise floor must be measured with the people GONE.  Taking it with
            # them on measures their own animated limbs, which grow with them: the
            # bigger and better-animated the town got, the more "noise" the control
            # reported, and a signal-over-noise test quietly turned into a test that
            # punished the improvement.  With the layer hidden this is what is left
            # moving on its own - the altar motes, the keep glow, the effects.
            pg.wait_for_timeout(1700)
            ctl0, ctl1 = off, pg.screenshot(clip=CLIP)
            pg.evaluate("()=>window.__ash.folkLayer(true)"); pg.wait_for_timeout(600)

            import io as _io
            q0=Image.open(_io.BytesIO(ctl0)).convert("RGB")
            q1=Image.open(_io.BytesIO(ctl1)).convert("RGB")
            drift=ImageChops.difference(q0,q1).convert("L").point(lambda v: 255 if v>14 else 0)
            dpx=sum(1 for v in drift.tobytes() if v)
            a=Image.open(_io.BytesIO(on)).convert("RGB")
            c=Image.open(_io.BytesIO(off)).convert("RGB")
            d=ImageChops.difference(a,c).convert("L").point(lambda v: 255 if v>14 else 0)
            w,h=d.size; px=d.tobytes()
            mask=bytearray(1 if v else 0 for v in px)
            changed=sum(mask)
            bl=blobs(mask,w,h,30)
            shots[dist]=(changed, bl, rig, dpx)
            # `fast(0)` stops the sim, not the animation: the skin mixers, the altar
            # motes and the keep glow all keep running, and the closer the camera the
            # more animated person is on screen to drift.  So the noise floor is not a
            # constant - the only honest test is signal against it, measured together.
            assert changed > 6*dpx, ("what changed is the background moving, not people",
                                     dist, changed, dpx)
            print("dist %-3d changed %6d px (%.2f%% of frame)   figures>=30px: %d   background drift %d px   biggest %s"
                  % (dist, changed, changed*100.0/(w*h), len(bl),
                     dpx, ", ".join("%dpx %dx%d"%t for t in bl[:4]) or "none"))
            for r in rig[:4]:
                print("         %-10s d=%-5s %-5s shown=%-5s h=%-6s disc=%s"
                      % (r["who"], r["d"], r["rig"], r["shown"], r["h"], r["disc"]))
            if dist==7:
                a.save(root/"dist"/"shot-seen.png")

        # --- the assertions, on figures derived in this run alone ---
        close=shots[7]
        assert close[0] > 2000, ("almost nothing on screen is a person at dist 7", close[0])
        assert len(close[1]) >= 3, ("fewer than three readable figures close in", close[1])
        tall=max((t[2] for t in close[1]), default=0)
        assert tall >= 24, ("the biggest figure is under 24px tall at dist 7", tall)
        assert shots[20][0] > 300, ("nobody survives pulling back to dist 20", shots[20][0])
finally:
    srv.terminate()
print("errors:", "clean" if not err else err[:4])
