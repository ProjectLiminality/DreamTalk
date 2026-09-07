"""
Reconstruct the reference pen's itinerary through david.svg's geometry.

For each frame f_00001..f_00016 of refs/pitch/origins/frames5 (5fps), find
which lit pixels are NEW versus the previous frame, and map each to the
nearest point on the projected subpath polylines. Output: per frame, the
distribution of newly-inked ink over (subpath, arc-position) — i.e. where
the pen was during that 0.2s.

Ground truth for any candidate connection rule.
"""
import json, sys, math
from PIL import Image
import numpy as np

GEOM = "/private/tmp/claude-501/-Users-davidrug-RealDealVault-ProjectLiminality-DreamTalk/6c2f0ce6-31c0-4bce-aacb-bbcca3c5db79/scratchpad/geom.json"
FRAMES = "/Users/davidrug/RealDealVault/ProjectLiminality/DreamTalk/refs/pitch/origins/frames5"
THRESH = 60          # luminance above this counts as ink (frames are white-on-black)

geom = json.load(open(GEOM))

# Flatten geometry into a point cloud with (subpath, cumulative-arc) labels,
# densified to <=1px spacing so nearest-point lookup is pixel-accurate.
pts, lab_sp, lab_arc = [], [], []
sp_len = {}
for s in geom:
    p = s["pts"]; n = len(p)//2
    arc = 0.0
    for j in range(n):
        x, y = p[2*j], p[2*j+1]
        if j > 0:
            px, py = p[2*j-2], p[2*j-1]
            d = math.hypot(x-px, y-py)
            steps = max(1, int(d))            # densify to ~1px
            for t in range(1, steps+1):
                f = t/steps
                pts.append((px + (x-px)*f, py + (y-py)*f))
                lab_sp.append(s["i"]); lab_arc.append(arc + d*f)
            arc += d
        else:
            pts.append((x, y)); lab_sp.append(s["i"]); lab_arc.append(0.0)
    sp_len[s["i"]] = arc

pts = np.array(pts); lab_sp = np.array(lab_sp); lab_arc = np.array(lab_arc)

# Spatial hash for nearest lookup (grid of 4px cells).
CELL = 4
grid = {}
for idx, (x, y) in enumerate(pts):
    grid.setdefault((int(x//CELL), int(y//CELL)), []).append(idx)

def nearest(x, y, maxd=6.0):
    best, bd = -1, maxd
    cx, cy = int(x//CELL), int(y//CELL)
    r = int(maxd//CELL)+1
    for gx in range(cx-r, cx+r+1):
        for gy in range(cy-r, cy+r+1):
            for idx in grid.get((gx, gy), ()):
                d = math.hypot(pts[idx][0]-x, pts[idx][1]-y)
                if d < bd: bd, best = d, idx
    return best, bd

def ink(name):
    im = Image.open(f"{FRAMES}/{name}.jpg").convert("L")
    return np.array(im) > THRESH

frames = [f"f_{i:05d}" for i in range(1, int(sys.argv[1]) if len(sys.argv)>1 else 17)]
prev = np.zeros((720,1280), bool)
print(f"{'frame':>8} {'t':>5} {'lit':>7} {'new':>7}  newly-inked distribution (subpath: arc-range px, count)")
per_frame = []
for fi, name in enumerate(frames):
    cur = ink(name)
    new = cur & ~prev
    ys, xs = np.nonzero(new)
    hits = {}
    unmatched = 0
    for x, y in zip(xs, ys):
        idx, d = nearest(float(x), float(y))
        if idx < 0: unmatched += 1; continue
        sp = int(lab_sp[idx]); a = float(lab_arc[idx])
        hits.setdefault(sp, []).append(a)
    rows = []
    for sp, arcs in sorted(hits.items(), key=lambda kv: -len(kv[1])):
        if len(arcs) < 8: continue     # ignore AA speckle
        arcs = sorted(arcs)
        rows.append((sp, arcs[0], arcs[-1], len(arcs), sp_len[sp]))
    per_frame.append({"frame":name, "t":round(0.2*(fi+1),2), "lit":int(cur.sum()),
                      "new":int(new.sum()), "rows":[{"sp":r[0],"a0":round(r[1],1),
                      "a1":round(r[2],1),"n":r[3],"len":round(r[4],1)} for r in rows]})
    desc = "  ".join(f"sp{r[0]}:[{r[1]:.0f}-{r[2]:.0f}]/{r[4]:.0f} n={r[3]}" for r in rows[:8])
    print(f"{name:>8} {0.2*(fi+1):5.1f} {int(cur.sum()):7d} {int(new.sum()):7d}  {desc}")
    prev = cur

json.dump(per_frame, open("/private/tmp/claude-501/-Users-davidrug-RealDealVault-ProjectLiminality-DreamTalk/6c2f0ce6-31c0-4bce-aacb-bbcca3c5db79/scratchpad/itinerary.json","w"), indent=1)
