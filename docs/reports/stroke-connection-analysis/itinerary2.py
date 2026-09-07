"""
Sharper itinerary: for each frame's genuinely-new ink, report the ARC INTERVALS
actually covered (contiguous runs with real pixel density), not min/max spans.
This is what distinguishes "the pen swept sp0[0..452]" from "three stray
pixels landed near sp0's two ends".
"""
import json, math, sys
import numpy as np
from PIL import Image

geom = json.load(open("/private/tmp/claude-501/-Users-davidrug-RealDealVault-ProjectLiminality-DreamTalk/6c2f0ce6-31c0-4bce-aacb-bbcca3c5db79/scratchpad/geom.json"))
F = "/Users/davidrug/RealDealVault/ProjectLiminality/DreamTalk/refs/pitch/origins/frames5"

pts, lab_sp, lab_arc = [], [], []
sp_len = {}
for s in geom:
    p = s["pts"]; n = len(p)//2; arc = 0.0
    pts.append((p[0], p[1])); lab_sp.append(s["i"]); lab_arc.append(0.0)
    for j in range(1, n):
        px, py, x, y = p[2*j-2], p[2*j-1], p[2*j], p[2*j+1]
        d = math.hypot(x-px, y-py); steps = max(1, int(d))
        for t in range(1, steps+1):
            f = t/steps
            pts.append((px+(x-px)*f, py+(y-py)*f)); lab_sp.append(s["i"]); lab_arc.append(arc+d*f)
        arc += d
    sp_len[s["i"]] = arc
pts = np.array(pts); lab_sp = np.array(lab_sp); lab_arc = np.array(lab_arc)

CELL = 4; grid = {}
for i,(x,y) in enumerate(pts): grid.setdefault((int(x//CELL),int(y//CELL)),[]).append(i)
def nearest(x,y,maxd=5.0):
    best,bd=-1,maxd; cx,cy=int(x//CELL),int(y//CELL); r=int(maxd//CELL)+1
    for gx in range(cx-r,cx+r+1):
        for gy in range(cy-r,cy+r+1):
            for i in grid.get((gx,gy),()):
                d=math.hypot(pts[i][0]-x,pts[i][1]-y)
                if d<bd: bd,best=d,i
    return best,bd

def ink(n,th=60): return np.array(Image.open(f"{F}/f_{n:05d}.jpg").convert("L"))>th
def dilate(a,k=2):
    o=a.copy()
    for _ in range(k):
        t=o.copy()
        for dy in(-1,0,1):
            for dx in(-1,0,1): t|=np.roll(np.roll(o,dy,0),dx,1)
        o=t
    return o

BIN = 20.0   # arc-length bin, px
out=[]
prev=None
N = int(sys.argv[1]) if len(sys.argv)>1 else 12
for n in range(1, N+1):
    cur = ink(n)
    if prev is None: prev = np.zeros_like(cur)
    new = cur & ~dilate(prev,1)
    ys,xs = np.nonzero(new)
    bins = {}
    for x,y in zip(xs,ys):
        i,d = nearest(float(x),float(y))
        if i<0: continue
        sp=int(lab_sp[i]); b=int(lab_arc[i]//BIN)
        bins[(sp,b)] = bins.get((sp,b),0)+1
    # a bin is "inked" if it holds >=6 px (a 20px arc run at ~3px wide -> ~60px full)
    lit = sorted(k for k,v in bins.items() if v>=6)
    runs=[]
    for sp,b in lit:
        if runs and runs[-1][0]==sp and b-runs[-1][2]<=1: runs[-1][2]=b
        else: runs.append([sp,b,b])
    runs = [(sp, b0*BIN, (b1+1)*BIN, sum(bins.get((sp,b),0) for b in range(b0,b1+1))) for sp,b0,b1 in runs]
    runs.sort(key=lambda r:-r[3])
    tot=sum(r[3] for r in runs)
    out.append({"f":n,"t":round(0.2*n,2),"runs":[{"sp":r[0],"a0":r[1],"a1":round(min(r[2],sp_len[r[0]]),1),"px":r[3],"len":round(sp_len[r[0]],1)} for r in runs]})
    keep=[r for r in runs if r[3]>=0.04*tot]
    print(f"f{n:05d} t={0.2*n:.1f} new={int(new.sum()):5d}  " +
          "  ".join(f"sp{r[0]}[{r[1]:.0f}-{min(r[2],sp_len[r[0]]):.0f}]/{sp_len[r[0]]:.0f}({r[3]})" for r in keep))
    prev=cur
json.dump(out, open("/private/tmp/claude-501/-Users-davidrug-RealDealVault-ProjectLiminality-DreamTalk/6c2f0ce6-31c0-4bce-aacb-bbcca3c5db79/scratchpad/itin2.json","w"), indent=1)
