"""Does the whole town still walk to the same place, and stay out after dark?

The owner sent a screenshot of two perfect columns of people standing in the
wilderness at night. That is one destination shared by everybody - one flow
field, one identical path, one identical speed - plus a dusk check that could
never fire because it lived in a function that only ran when nobody had a goal.
"""
import subprocess, sys, pathlib, time, json
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parent.parent
srv=subprocess.Popen([sys.executable,"-m","http.server","8169","-d",str(root)],
                     stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1.5); err=[]
try:
    with sync_playwright() as p:
        b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader","--no-proxy-server"])
        pg=b.new_page(viewport={"width":1340,"height":860})
        pg.on("pageerror", lambda e: err.append(str(e)))
        pg.on("console", lambda m: err.append("console: "+m.text)
              if m.type=="error" and "TUNNEL" not in m.text and "ERR_" not in m.text else None)
        pg.goto("http://127.0.0.1:8169/index.html"); pg.wait_for_timeout(1500)
        if not pg.evaluate("()=>document.getElementById('view3d').style.display==='block'"):
            pg.click("#sc3D")
        pg.wait_for_timeout(9000)
        pg.evaluate("()=>window.__ash.fast(45)")
        best={"places":0,"walkers":0,"biggest":0}
        stranded=0; nights=0; seen=set()
        day0=pg.evaluate("()=>window.__ash.clock().mins")
        while True:
            pg.wait_for_timeout(2500)
            c=pg.evaluate("()=>window.__ash.conga()")
            if not c: continue
            if c["walkers"]>best["walkers"]: best=c
            if c["hour"]>=21 or c["hour"]<5:
                nights+=1; stranded=max(stranded,c["strandedAfterDark"])
                if c["who"]: seen.update(w["who"] for w in c["who"])
            days=(pg.evaluate("()=>window.__ash.clock().mins")-day0)/1440.0
            # 2.5 game-days, which crosses two nights. At fast(45) under software
            # rendering a game-day costs about 83 real seconds, so five days
            # overran a 400 s budget and the probe was killed mid-run.
            if days>2.5 and nights>0: break
            if days>3.2: break
        print("busiest moment: %d foragers walking to %d distinct places, "
              "most-shared place had %d of them"
              % (best["walkers"], best["places"], best["biggest"]))
        print("after dark: sampled %d times, worst was %d people still outside the town"
              % (nights, stranded))
        if seen: print("   e.g. %s" % ", ".join(sorted(seen)[:4]))
        assert nights>0, ("never sampled a night", nights)
        # Derived this cycle. Before: every forager took the same spot, so places
        # was 1 and `biggest` equalled `walkers`; and people stood out there at
        # midnight because the dusk check lived where it could never run.
        assert best["walkers"]<2 or best["places"]>1, \
            ("every forager is still walking to the same place", best)
        assert best["biggest"]<=max(2,best["walkers"]*0.6), \
            ("most of the town is still sharing one destination", best)
        assert stranded==0, ("people are still stranded outside the town after dark", stranded)
finally:
    srv.terminate()
print("errors:", "clean" if not err else err[:4])
