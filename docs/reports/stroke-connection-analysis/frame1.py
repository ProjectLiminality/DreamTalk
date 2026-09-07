"""Frame 1 forensics: is the sp0+sp6 co-inking real, or nearest-point confusion?
Print the actual lit-pixel clusters at t=0.2 and where each subpath's claimed
arc range physically sits."""
import json, math
import numpy as np
from PIL import Image
geom = json.load(open("/private/tmp/claude-501/-Users-davidrug-RealDealVault-ProjectLiminality-DreamTalk/6c2f0ce6-31c0-4bce-aacb-bbcca3c5db79/scratchpad/geom.json"))
G = {s["i"]: s["pts"] for s in geom}
im = np.array(Image.open("/Users/davidrug/RealDealVault/ProjectLiminality/DreamTalk/refs/pitch/origins/frames5/f_00001.jpg").convert("L")) > 60
ys, xs = np.nonzero(im)
print("lit pixels:", len(xs), "bbox x", xs.min(), xs.max(), "y", ys.min(), ys.max())

# connected components (8-neighbour flood) to see how many separate ink marks
seen = np.zeros_like(im)
comps = []
from collections import deque
for y0, x0 in zip(ys, xs):
    if seen[y0, x0]: continue
    q = deque([(y0, x0)]); seen[y0, x0] = True; cell = []
    while q:
        y, x = q.popleft(); cell.append((x, y))
        for dy in (-1,0,1):
            for dx in (-1,0,1):
                ny, nx = y+dy, x+dx
                if 0<=ny<720 and 0<=nx<1280 and im[ny,nx] and not seen[ny,nx]:
                    seen[ny,nx]=True; q.append((ny,nx))
    comps.append(cell)
comps.sort(key=len, reverse=True)
print(f"connected components: {len(comps)}  sizes: {[len(c) for c in comps[:8]]}")
for ci, c in enumerate(comps[:6]):
    cx = [p[0] for p in c]; cy = [p[1] for p in c]
    print(f"  comp{ci}: n={len(c)} x[{min(cx)},{max(cx)}] y[{min(cy)},{max(cy)}]")

def arcpt(sp, a):
    p = G[sp]; n = len(p)//2; acc = 0
    for j in range(1, n):
        d = math.hypot(p[2*j]-p[2*j-2], p[2*j+1]-p[2*j-1])
        if acc + d >= a:
            f = (a-acc)/d if d else 0
            return (p[2*j-2] + (p[2*j]-p[2*j-2])*f, p[2*j-1] + (p[2*j+1]-p[2*j-1])*f)
        acc += d
    return (p[-2], p[-1])

for sp, a0, a1 in [(0,0,452),(6,450,1142),(6,0,450),(0,452,900)]:
    print(f"  sp{sp} arc {a0}->{a1}: screen {tuple(round(v) for v in arcpt(sp,a0))} -> {tuple(round(v) for v in arcpt(sp,a1))}")
