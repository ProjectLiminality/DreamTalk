# Engine performance — universal optimization roadmap

Goal (David, 2026-09-14): a **super-smooth, reliable** final experience.
Optimize the engine UNIVERSALLY (every scene), deepest-impact first, then
surface-level. 60 fps on a normal machine is the target ceiling.

## The measured picture (docs/reports/perf/thewall-profile.md)

The frame path, on the stress scene (TheWall, 236 creatures / 3,776 ribbons):

- `applyAt` (timeline param eval) ≈ **0 ms** — already solved (proxy-scan
  settle + derive-caching + only 3 animated params). Not a lever.
- `sync()` ≈ **12.6 ms** — per-frame CPU, touches every stroke. Two costs:
  the shapeKey array-alloc dirty-check (~9 ms) and unconditional style writes.
- `render()` ≈ **27 ms floor / up to 222 ms hump** — the dominant cost.
  Measured **per-mesh WebGPU SUBMISSION bound** (flat across a 36× resolution
  range → NOT fill-rate; scales super-linearly with visible ribbon count;
  hiding all ribbons drops render 206→3.3 ms). Each mesh binds+uploads its own
  cloned uniform buffer (OBJECT-updated reference nodes) before its draw.

Boot is healthy (1.1 s warm; bake cached; shader storm fixed).

## Cross-scene baseline (2026-09-14) — the ceiling is GENERAL

Warm median frame-ms, 20-frame sweep, by stroke count:

| scene | strokes | median | p90 | max |
|---|---|---|---|---|
| molocheye | 9 | 0.4 | 1.2 | 2.7 |
| sketch | 37 | 0.5 | 1.6 | 2.3 |
| o01 | 119 | 3.2 | 7.3 | 8.7 |
| labyrinth | 138 | 1.2 | 3.0 | 3.9 |
| s06 (cylinder) | 267 | 2.3 | 4.5 | 5.6 |
| **video01** | **572** | **32** | **38** | **51** |
| thewall | 3,776 | ~90 | ~180 | ~366 |

**video01 (DialecticalThinking, 572 strokes) at 32 ms is a SECOND instance of
the submission ceiling — not TheWall-specific.** Frame-ms tracks stroke count
super-linearly across every scene; the per-object submission cost is the
universal predictor. Instancing (A) lifts the ceiling for EVERY multi-stroke
scene, not just the wall — video01, o01, and any future dense DreamSong all
benefit. Most scenes (<150 strokes) are already smooth (<3 ms); the lever
matters exactly where density is high, which is where it will be felt.

## Ranked plan — deepest impact first

| # | Optimization | Lever | Impact | Risk | Status |
|---|---|---|---|---|---|
| A | **Instance the ribbons** — per-stroke style in an instance buffer, one draw per material instead of per mesh | the `render()` submission floor (the real ceiling) | the only route to 60 fps at these counts | HIGH (rewrites how style reaches the shader; byte-identity path) | pending A/B findings |
| B | **Geometry version counter** — O(1) dirty-check replacing the per-frame shapeKey array alloc/compare | `sync()` CPU, ~9 ms on TheWall; GC pressure everywhere | universal CPU win, every scene | LOW-MED (dirty-check only; regen unchanged) | **in flight** (geomver) |
| ~~C~~ | ~~The moving-cable render hump~~ — **DIAGNOSED, DISSOLVED** into A | — | — | — | **DONE** (hump-diagnosis.md): the hump IS the floor's per-object submission cost at higher magnitude — no separate bug; realloc & re-upload both falsified (0 reallocs, suppressing setPoints changes nothing). The only fix is A. |
| D | **Off-screen frustum cull** + idle latch | `render()` for pan/zoom scenes | scene-dependent (0 on walls; 23/80 on mindvirus) | LOW (proven byte-identical) | **DONE** (30d403b) |
| E | Flatten per-creature scene-graph nodes (~25 → few per creature) | `sync()` transform loop + boot | ~3-5 ms + boot | LOW | **DONE 2026-10-04** as the measured lever, not literal flattening — see "E/F result" below |
| F | Surface: unconditional style writes, redundant screenArc calls, updateMatrixWorld on fast path | `sync()` tail | small, safe | LOW | **DONE 2026-10-04** — see "E/F result" below |

## Ordering rationale (updated after the hump diagnosis)

The hump diagnosis (docs/reports/perf/hump-diagnosis.md) settled the plan:
**the hump and the render floor are ONE cost** — per-object WebGPU submission
over ~3,776 ribbon meshes, each rebinding its own userData uniform buffer
(NodeUpdateType.OBJECT). Both falsified alternatives (realloc churn, steady
re-upload) would have bought zero. So the render-path lever is unambiguous:
**object count**. That makes **A (instancing) THE work** — it collapses the
floor AND the hump together, and it is fully general (every ribbon-heavy scene
scales by mesh count).

- **B (geomversion) in flight**: a pure-CPU universal win, low risk, lands
  independently of the render path. Integrate when it arrives.
- **A next, and it is the chapter**: the render-submission ceiling. The lead
  designs the architecture (per-instance style buffer, one draw per stroke-type)
  before an implementer touches the gauntlet-scored path; byte-identity across
  the full scene set is the gate. This is where the 60fps lives.
- **D done**: the cull primitive exists, self-disabling where it can't help.
  Note: the diagnosis suggests a *screen-size* cull (sub-pixel/occluded tethers)
  as a partial pre-A mitigation, but it's a symptom patch — A is the cause fix,
  so we go for A rather than layering mitigations.
- **E, F**: surface polish once A lands and we re-measure.

Every step re-measures against the profile and gates on byte-identity across a
broad scene set — never one scene. "Universal" means the scene set is the gate.

## E/F result (2026-10-04) — the post-A re-measure, then the sync() levers

**Re-measure first (the A integration only timed `render()`).** With
instancing on, TheWall's render IS ~9 ms — but the whole frame was
57 / 71 / 94 / 113 ms at t = 0.2 / 3.33 / 8.33 / 12.5 s, because `sync()`
carried 48–104 ms. A CPU profile at t = 12.5 (30 frames) split it:
`packRibbonBatch`/`packViewSegments` ~30 ms (A's per-frame view-space bake
of ~480k segments — the camera moves every frame, so all of it, every
frame), `Cable.toLocal`/`tubeFrom` ~23 ms (the vocabulary's view-dependent
tube, recomputed per frame), and the **Holon proxy get-trap ~14 ms** (every
`holon.x.value` read in sync goes through the Proxy). E and F target the
last of those plus the settles; the first two are new items (G, H below).

**E — as built.** The literal fix (elide groups) was measured first: 2,597
of TheWall's 5,901 holons are identity-transformed, unbound and untracked —
but untracked is not static (song.ts Magic Move lerps, editor overrides and
System.ts all write transforms at runtime), so elision needs a promote-on-
change guard that reads the same params anyway. What the loop actually paid
for was the proxy reads and the per-group compose + Euler trig. So:
GroupBinding captures the seven transform Params at attach (read directly,
no trap), skips a group whose values are unchanged (Object.is — a -0 or NaN
counts as a change exactly when it would compose differently), and the
group's `matrixAutoUpdate` is off: sync() composes `group.matrix` only on
change. Measured: sync −5–6 ms on TheWall at every t. Literal flattening
would now save < 0.5 ms (a share of a 1.6 ms settle) — not worth its guard.

**F — as built.** (1) Stroke/fill/wash bindings capture their style Params
(creation, opacity, tint, stroke, erasure, fillOpacity) — no proxy traps in
the per-stroke loop. (2) One `measureScreenArc` per stroke per frame serves
both fronts (was two projections when mid-draw AND mid-erase), and the
projection loop no longer clones a Vector3 per point (two swapped scratch
points, one scratch NDC — the same arithmetic). `syncArrow` still measures
on its own, after the settle, exactly as before. (3) One settle per frame:
`matricesSettled` is set by a full settle and cleared on entry to sync()
and after a Text contour rebuild (it can parent fresh meshes); the cull
skips re-settling what sync() just settled, and `renderFrame` turns off the
renderer's own `scene.updateMatrixWorld()` for that one call when nothing
has moved since (camera matrices stay the renderer's). TheWall: settles
4.4 → 1.6–1.9 ms, cull 2.0 → 0.9 ms. video01: screenArc 1.4 → 1.1 ms,
frame 3.0 → 2.5 ms.

**TheWall frame, before E → after E+F:** 57 / 71 / 94 / 113 ms →
51 / 64 / 88 / 106 ms (t = 0.2 / 3.33 / 8.33 / 12.5; medians of 10
continuous-advance reps, headless Chrome, Metal).

**Gate — byte-identity by construction, proven.** `scripts/state-gate.ts`
(new) hashes everything the GPU receives after every frame of a fixed
sequence (matrices, visibility, layers, renderOrder, userData + numeric
material uniforms, used buffer ranges, the batch as a multiset of live
instances, camera): 16 scenes × 28 frames (thewall, video01, s01, s03, s04,
s06, o01, o03, molocheye, mindvirus, labyrinth, magicmove, founding, text,
patience, agentarena) IDENTICAL before/after E and before/after F, apart
from the documented first-frame `hg` noise floor on labyrinth/o01 (run-to-
run, also present baseline-vs-baseline). tsc clean, 1617 tests green.

## Next levers (measured 2026-10-04, not yet built)

| # | Optimization | Lever | Impact | Risk |
|---|---|---|---|---|
| G | Batch pack without the per-frame CPU bake: per-stroke modelView in a small storage/instance buffer, `mv · local` on the GPU (instancing-design Option 2), or re-bake only strokes whose group moved when the camera is still | `packRibbonBatch` ~25–37 ms on TheWall | the largest remaining frame cost | HIGH — the byte-identity argument for Option 1 (one CPU multiply = the shader's) has to be re-made for the GPU path |
| H | Cable's view-dependent tube (`toLocal`/`tubeFrom`) per frame | ~20 ms on TheWall, grows with t | vocabulary-level, Cable only | MEDIUM — Cable is scored by the wall gauntlet |
