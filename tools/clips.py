"""Which animations does the town actually play, and on people anyone can see?

The rigs carry 32 clips. Before c52 the town used four of them outdoors, because
every clip that makes a place look inhabited sat behind `p.inside` - and a person
inside a closed building is not drawn. This counts the clips playing on VISIBLE
people over a working day, which is the only population that matters.
"""
import subprocess, sys, pathlib, time, json, collections
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parent.parent
srv=subprocess.Popen([sys.executable,"-m","http.server","8161","-d",str(root)],
                     stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1.5); err=[]
try:
    with sync_playwright() as p:
        b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader","--no-proxy-server"])
        pg=b.new_page(viewport={"width":1340,"height":860})
        pg.on("pageerror", lambda e: err.append(str(e)))
        pg.on("console", lambda m: err.append("console: "+m.text)
              if m.type=="error" and "TUNNEL" not in m.text and "ERR_" not in m.text else None)
        pg.goto("http://127.0.0.1:8161/index.html"); pg.wait_for_timeout(1500)
        if not pg.evaluate("()=>document.getElementById('view3d').style.display==='block'"):
            pg.click("#sc3D")
        pg.wait_for_timeout(10000)
        pg.evaluate("()=>window.__ash.fast(25)")
        seen=collections.Counter()
        for _ in range(26):
            pg.wait_for_timeout(2200)
            rows=pg.evaluate("()=>window.__ash.clips()")
            if rows:
                for k,v in rows.items(): seen[k]+=v
        tot=sum(seen.values())
        print("clips played on people who were actually on screen, over a working day:")
        for k,v in seen.most_common():
            print("   %-12s %5d  %4.1f%%" % (k, v, v*100.0/max(1,tot)))
        kinds=set(seen)
        print("distinct clips: %d   samples: %d" % (len(kinds), tot))
        assert tot>200, ("almost nobody was visible to sample", tot)
        # Floors set from what this cycle actually measured, not from a number I
        # would like to be true. Walking fell 97.5% -> 82.4% and the inhabited
        # clips went 2.3% -> 17.7%; `cheer` and `gather` need a child or a forager
        # near the camera and do not appear every run, so they are not required.
        assert len(kinds)>=4, ("the town still only plays a handful of clips", dict(seen))
        lively={'sit_ground','talk','cheer','gather'}
        got=kinds & lively
        assert len(got)>=2, ("the inhabited clips still are not reaching visible people", dict(seen))
        share=sum(seen[k] for k in got)*100.0/max(1,tot)
        print("inhabited clips (%s): %.1f%% of visible frames" % (", ".join(sorted(got)), share))
        assert share>8.0, ("inhabited clips are a rounding error", share, dict(seen))
        walkshare=(seen.get('walk',0)+seen.get('walk_f',0))*100.0/max(1,tot)
        print("walking: %.1f%% of visible frames (was 97.5%% before c52)" % walkshare)
        assert walkshare<92.0, ("the town is still nothing but commuters", walkshare)
finally:
    srv.terminate()
print("errors:", "clean" if not err else err[:4])
