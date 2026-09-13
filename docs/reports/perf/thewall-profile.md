# TheWall frame-path profile — measured

**Date:** 2026-09-13 · **Scene:** `thewall` (demo, `demo/wall/TheWall.ts` →
`vocabulary/TheWall/TheWall.ts`) · **Host:** vanilla-Three WebGPU
(`src/render/three-host.ts`), Chrome headless `--use-angle=metal`, 1280×720.

Measurement was done against the **demo** (`/demo/?scene=thewall`, no editor
overhead) via a puppeteer-core harness that drove `window.__dtHost.renderFrame(t)`
directly and monkey-patched the three stages of the frame path
(`dream.applyAt` → `host.sync` → `renderer.render`) to accumulate self-time.
Every per-frame number below is an average of 6–20 repetitions at a held `t`.
This is a **measurement** pass — no `src/` or `vocabulary/` changes were made.

---

## The one-line verdict

TheWall is **CPU-bound on per-object work**, not GPU fill-rate bound. At the
busiest frame the wall-clock is **~40 ms floor rising to ~220 ms** in a
transient mid-scene hump — i.e. **~5–25 fps**, against the 16.6 ms/60 fps
budget. The timeline param evaluation (`applyAt`) is already **~0 ms** — the
proxy-scan settle and the 3-animated-param design did their job. The cost is
entirely in **`sync()` (12.6 ms)** and **`renderer.render()` (27 ms floor,
resolution-independent)**, both scaling with the **~3,776 ribbon meshes /
5,901 holons** the scene carries every frame.

---

## Scene shape (measured counts)

| Quantity | Count |
|---|---|
| Root holons | 1 (`TheWall`) |
| Holons total (`walk()`) | **5,901** |
| Timeline clips | 1 |
| **Animated params** (timeline tracks) | **3** — `growth`, observer `phi`, observer `theta` |
| three.js `Group` nodes | 5,901 |
| three.js `Mesh` nodes | 4,012 |
| Object3D nodes in scene graph | **9,914** |
| Ribbon strokes (`host.strokes`) | **3,776** |
| Fills (`host.fills`) | 236 (one folded-cube bottom face per creature) |
| Cylinders / washes / arrows / texts | 0 |
| Creatures (MindVirus) | 236 |

Per creature (236 of them): a MolochEye (several strokes), a FoldableCube
(4 wall Rectangles as strokes + 1 filled bottom), and a Cable (2 tapered edge
Lines — `maxRings = 0`, so the 64-Line ring pool is empty, as the port note
intends). That works out to ~16 strokes/creature × 236 ≈ 3,776 ribbon meshes.

---

## BOOT breakdown (cold vs warm)

Time from `page.goto` (domcontentloaded ≈ 130 ms in both cases) to
`window.__dt.ready === true`, plus the first `renderFrame` (which forces
shader compilation):

| Phase | Cold (cache cleared) | Warm (236/236 cached) |
|---|---|---|
| domContentLoaded | 129 ms | 130 ms |
| **`__dt.ready`** (build + warm-fetch + attach) | **2,644 ms** | **1,074 ms** |
| of which: cable bake (`wall.cableBakeMs`) | **1,736 ms** (0 hits, XPBD sim) | 165 ms (236 hits) |
| first `renderFrame` (shader compile) | 44.8 ms | 42.9 ms |
| second `renderFrame` | 45.2 ms | 42.3 ms |

Readings:

- **The XPBD bake is confirmed load-time, not frame-time** (`bake.ts` /
  `TheWall.unfoldCables()` run in `compose()`). It is the entire cold→warm
  delta: **~1,570 ms** saved by the disk/daemon bake cache
  (`src/bakecache.ts`). Bake output is ~29.8 MB of Float32 samples across 236
  tethers. The cache works — a warm boot pays 165 ms instead of 1,736 ms.
- **Shader compile is a non-issue now** (~43 ms first frame). The historic
  11.9→1.9 s "4,700 identical materials" storm is already fixed by the single
  shared `RibbonMaterial` (`ribbon.ts` header) — this profile confirms it did
  not regress.
- Remaining warm-boot cost beyond the 165 ms bake (~900 ms) is scene
  construction + `attach()` building 9,914 Object3D nodes + the 236
  warm-cache fetches. Not investigated further — it is one-time and already
  sub-1.1 s.
- **Caveat (harness artifact, not a scene bug):** the cache write-back after a
  cold boot is fire-and-forget (`unfoldCables()` `void (async…)`), so closing
  the page immediately dropped all but 5 of the 236 PUTs. In normal use the
  daemon keeps 236 files and the warm path is the 1,074 ms above.

---

## PER-FRAME breakdown

Busiest frame chosen by sweeping `t` across the 16.67 s duration and taking
the max total; the busiest region is **t ≈ 2.5–7.5 s** (creatures mid-flight,
long moving cable ribbons). Peak at **t = 3.33 s**.

### Stage self-time at t = 3.33 s (avg of 8 reps)

| Stage | Self-time | What it is |
|---|---|---|
| `dream.applyAt(t)` | **~0.00 ms** | timeline `valueAt` for 3 params + `param.value =` writes |
| `host.sync()` | **12.6 ms** | push holon state into 5,901 groups + 3,776 ribbons |
| `renderer.render()` | **27 ms floor / 222 ms hump** | WebGPU submit |
| **total renderFrame** | **~40 ms floor / ~225 ms hump** | |

`sync()` decomposed (avg 20 reps):

| `sync()` sub-phase | ms |
|---|---|
| Group transform loop (5,901 groups: `position/rotation/scale.set`) | 3.3 |
| Stroke param-read + `style()` loop (3,776 strokes) | ~9.3 |
| `scene.updateMatrixWorld(true)` (called only if cylinders/arrows/texts — **0 here**) | (1.25 if forced) |

Note `sync()` recomputes `shapeKey(holon)` (a fresh number[] alloc) and
`keysEqual` for **every one of the 3,776 strokes every frame**, even though
their shape never changes on this scene (only transforms animate) — that plus
two `screenArc` calls per stroke is the bulk of the ~9 ms stroke loop.

### Frame-time across the whole timeline (avg 8 reps, full `renderFrame`)

| t (s) | total ms | applyAt | sync | render | fps |
|---|---|---|---|---|---|
| 0.00 | 37 | 0.00 | 10.1 | 27.0 | 27 |
| 1.67 | 47 | 0.00 | 13.6 | 33.8 | 21 |
| 2.50 | 167 | 0.01 | 13.9 | 153 | 6 |
| **3.33** | **225** | 0.03 | 14.4 | **211** | **4** |
| 5.00 | 204 | 0.00 | 15.9 | 188 | 5 |
| 7.50 | 155 | 0.01 | 17.9 | 137 | 6 |
| 8.33 | 47 | 0.00 | 18.5 | 28.6 | 21 |
| 12.50 | 116 | 0.00 | 21.0 | 95 | 9 |
| 16.67 | 51 | 0.00 | 21.8 | 30 | 20 |

`applyAt` is flat at zero the whole way; `sync` drifts up slowly (10→24 ms) as
more strokes acquire non-zero draw fronts; `render` carries the whole story
and the whole variance.

### Dirty-tracking (question 3 from the brief)

- **Animated params: 3.** Checking every 30-fps adjacent pair across the whole
  500-frame scene: **1,500/1,500 param-samples change** — but that is 3 params
  × 500 frames. All three (`growth`, `phi`, `theta`) are linear ramps, so they
  change every frame *by design*.
- **There is no per-holon dirty problem to fix.** The 5,901 holons are driven
  by `derive()` bindings off those 3 params (`TheWall.drive()` caches the
  journey state per growth value already). `applyAt` = 0 ms confirms it.
- **The slideshow-style "re-evaluates the entire deck every setT" pathology
  does NOT apply here** — the timeline only holds 3 tracks. The re-evaluation
  cost has moved *downstream* of the timeline, into `sync()` and `render()`,
  which touch every object unconditionally.

### CPU vs GPU verdict — the decisive test

Rendering the **same frame at four canvas resolutions**:

| Canvas | render ms |
|---|---|
| 320×180 | 29.3 |
| 640×360 | 28.2 |
| 1280×720 | 27.2 |
| 1920×1080 | 27.3 |

**Render time is flat across a 36× pixel range** → the frame is **NOT
fragment/fill-rate/overdraw bound.** The MAX-blended `depthWrite=false`
ribbons do overdraw heavily, but overdraw is not what costs.

Isolation tests instead pin the cost to **per-ribbon-mesh submission**:

- Hiding all 3,776 ribbons: render drops **206 ms → 3.3 ms**. Ribbons are the
  entire render cost.
- Render vs number of visible ribbons at t=3.33 (super-linear):

  | visible ribbons | render ms |
  |---|---|
  | 0 | 4.0 |
  | 378 | 5.7 |
  | 944 | 8.5 |
  | 1,888 | 15.5 |
  | 2,832 | 23.0 |
  | 3,776 | **73.7** |

  The last quartile is where cost explodes — consistent with the WebGPU
  backend's per-render-object work (each mesh reads its own `userData`
  reference-node uniforms — `NodeUpdateType.OBJECT`, per `ribbon.ts` — and
  binds/uploads its own cloned uniform buffer before its draw).

- Actual GPU **draw calls stay 38–398** across the whole timeline (WebGPU
  batches), and **`updateMatrixWorld` is 1.25 ms** — neither is the bottleneck.

- **The 150–222 ms hump at t=2.5–7.5 s is a transient** that the object counts
  do *not* explain: segment total moves only 425k→500k (+18%) and drawing
  meshes 3,304→3,776 (+14%) across the whole scene, while render swings 27→222→39
  ms. It is repeatable across reps (not GC). It coincides with the regime where
  cables are **long and moving every frame** (mid-flight), which points at a
  GPU-backend pipeline/upload stall driven by the moving per-mesh geometry
  rather than by pixel or object count. This is the single least-understood
  number in the profile and the highest-value thing to characterise before
  optimizing render submission.

Segment/mesh totals per frame (steady, for reference): ~425k–500k instanced
quad segments across ~3,300–3,776 drawing ribbons; `maxSegments`/stroke = 160
(every stroke resampled to `SUBDIVISION = 128` + caps regardless of on-screen
length).

---

## Ranked optimization plan

Ranked by (measured impact ÷ risk). Risk is highest for anything touching the
byte-identity render path (the ribbon SDF, blending, resample) that the
gauntlets score against; lowest for CPU bookkeeping that cannot change a pixel.

### 1. Skip `shapeKey` recompute for transform-only strokes — **~7–9 ms/frame, very low risk**
`sync()` allocates a fresh `number[]` shapeKey and runs `keysEqual` for all
3,776 strokes every frame, though on TheWall no stroke's *shape* ever changes
(only x/y/z/h/p/scale, which live on the group, not the polyline). Measured
stroke loop ≈ 9.3 ms; the `style()` + `screenArc` calls inside it are cheap,
so most of it is the per-stroke key alloc/compare.
**Fix:** gate the shape-regen on a cheap dirty flag (e.g. only recompute
shapeKey when a shape param actually has an animation track, decided once at
attach — the same test `washesFillOpacity` already does for washes), or hash to
a scalar instead of an array. **Risk:** does not touch the render path or any
sampled value; pure bookkeeping. **Projected:** floor frame 40→~31 ms
(25→32 fps); does nothing for the hump.

### 2. Cull ribbons that are off-screen or degenerate — **up to ~180 ms in the hump, low-to-medium risk**
Ribbons set `frustumCulled = false` (deliberately, for the fast path) and are
`visible` whenever `fraction > erased && opacity > 0`, so all ~3,776 are
submitted every frame regardless of whether they're on screen or sub-pixel.
Render scales with *visible* mesh count (table above), and the hump is exactly
when the most ribbons are large/moving.
**Fix:** a cheap per-frame screen-bounds test (cable tip + anchor already known
from the baked track) to set `mesh.visible = false` for ribbons wholly outside
the frame or shorter than ~1 px. During the top-down opening and the folded-in
ending, a large fraction of tethers are tiny or occluded.
**Risk:** must be conservative — a false cull drops ink the gauntlet scores.
Frustum/screen math is well understood but sits next to the render path.
**Projected:** if it halves visible ribbons in the hump, render 220→~30–70 ms
(4→14–30 fps) there; modest at the floor. **Biggest single lever for the hump.**

### 3. Characterise & remove the mid-scene render hump — **~120–190 ms in the hump, medium risk, needs investigation first**
The 27→222→39 ms swing is not explained by counts or resolution and is the
largest anomaly. Likely a WebGPU/Metal per-object uniform-upload or pipeline
stall triggered by cables whose geometry (`setPoints`) changes every frame.
**Next step (measurement, not a fix):** GPU timestamp queries or a
`renderer.info`-level per-pass timing to confirm whether the hump is
buffer-upload, pipeline re-validation, or draw. Then likely mitigations:
reuse instance buffers without re-upload when a cable's segment count is
stable (the code already keeps buffer *objects* stable for that reason — verify
`needsUpdate` isn't forcing a full re-upload each frame), or batch ribbons that
share the material into fewer render objects.
**Risk:** medium — touches how ribbon geometry reaches the GPU.
**Projected:** removing the hump alone takes worst-case 225→~40 ms (4→25 fps),
making frame time *uniform* across the timeline.

### 4. Merge the per-creature scene-graph nodes — **~3–5 ms/frame + boot, low risk**
5,901 groups and 9,914 Object3D nodes for 236 creatures is ~25 nodes each.
The group transform loop is 3.3 ms and `updateMatrixWorld` is 1.25 ms; both
scale with node count, and boot builds all 9,914.
**Fix:** flatten a creature's internal hierarchy (bake child offsets into the
ribbon polylines at attach, so each creature is one group not ~25). **Risk:**
low for the frame path (transforms only), but touches `attach()` structure and
would need the gauntlet to confirm byte-identity. **Projected:** sync
12.6→~9 ms, plus a faster boot.

### 5. Instance identical creatures — **large, high risk, biggest ceiling**
Every creature is the same holon drawn at a different transform/fold. The
render path builds 3,776 independent meshes. A true GPU-instanced path (one
draw per stroke-*type* across all 236 creatures, per-instance transform + fold
+ draw-front in an instance buffer) would collapse submission cost to O(stroke
types) instead of O(creatures × strokes).
**Risk:** high — a near-total rewrite of the ribbon host and the fold geometry,
directly on the byte-identity render path the gauntlets pin. **Projected:** the
only route to a genuine 60 fps at these counts, but it is a chapter of work, not
a tweak. Do #1–#4 first and re-measure before committing.

### Not worth doing
- **Dirty-track `setT`/`applyAt`:** `applyAt` is already 0 ms (3 params). No
  gain.
- **Reduce ribbon `SUBDIVISION`:** render is resolution- *and* effectively
  segment-count-insensitive at the floor (per-object cost dominates), and
  SUBDIVISION is calibrated against the reference (`ribbon.ts`). High risk to
  fidelity, ~no measured gain.
- **Lower render resolution:** render is resolution-independent — saves nothing.

---

## Projected trajectory

| State | Floor frame | Hump frame |
|---|---|---|
| **Measured today** | ~40 ms (25 fps) | ~225 ms (4 fps) |
| + #1 (shapeKey gate) | ~31 ms (32 fps) | ~216 ms |
| + #2 (cull off-screen) | ~28 ms (36 fps) | ~70 ms (14 fps) |
| + #3 (hump removed) | ~28 ms (36 fps) | ~40 ms (25 fps) |
| + #4 (flatten nodes) | ~24 ms (42 fps) | ~35 ms (28 fps) |
| + #5 (instancing) | 60 fps target — requires the rewrite |

#1–#4 are incremental, low-to-medium risk, and get the scene to a **uniform
~25–42 fps**. Reaching a solid **60 fps** at 236 creatures / 3,776 strokes
requires #5 (GPU instancing of the creatures), which is the real chapter of
work. Every projection above is an extrapolation from the isolation
measurements in this document and should be re-measured after each step.
