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
| G | Batch pack without the per-frame CPU bake: per-stroke modelView in a small storage/instance buffer, `mv · local` on the GPU (instancing-design Option 2), or re-bake only strokes whose group moved when the camera is still | `packRibbonBatch` ~25–37 ms on TheWall | the largest remaining frame cost | **DONE 2026-10-04** — see "G result" below |
| H | Cable's view-dependent tube (`toLocal`/`tubeFrom`) per frame | ~20 ms on TheWall, grows with t | vocabulary-level, Cable only | **DONE 2026-10-04** — see "H result" |

## G result (2026-10-04) — the per-stroke table

**Built.** The batch's segments stay LOCAL — the very floats of each
stroke's own per-mesh buffers, copied only when its polyline changes and
uploaded as one coalesced range a frame — and each carries its stroke's
row index. Per frame only a small read-only storage TABLE is rewritten: 6
vec4 per stroke (the f32 modelView, composed exactly as three composes the
per-mesh uniform, then width/drawn/erased/fade, then tint). The shader does
`mv · local` on the GPU — the oracle's own line on the oracle's own inputs,
so the bake's CPU-f64/f32-store residual is gone. Row 0 is a permanently
hidden stroke for unused and abandoned slots.

**Gate.** `instancing-gate.ts` (extractor updated for the table) over the
full staged set A was gated on — molocheye, o01, s01, s06, o03, video01,
thewall (425k–500k segments at 4 t), mindvirus, labyrinth, magicmove:
instance data EQUAL everywhere, coverage 1/1 everywhere, and the PNGs
BYTE-IDENTICAL to the oracle on every TheWall frame (A only ever reached
coverage equality there). tsc clean in these files, 1690 tests green.

**Win.** `packRibbonBatch` 25–37 ms → 1.5–2 ms per frame on TheWall.

**The finding that re-frames the roadmap.** `instancing-perf.ts` and the
2026-09 profiles timed `renderer.render`'s SELF-time, which now returns
once work is submitted — the per-mesh oracle reads 1.7 ms there. Measured
to GPU COMPLETION (renderFrame, then `device.queue.onSubmittedWorkDone()`,
30-frame windows; harness floor ~1 ms on molocheye, 3–4 ms on video01),
TheWall's real frame is:

| t (s) | oracle | A (bake) | G (table) |
|---|---|---|---|
| 0.5 | 276 | 293 | 264 |
| 8.33 | 242 | 229 | 190 |
| 15.8 | 182 | 167 | 129 |

So instancing never moved the real frame much, and G's gain is the CPU it
removed (−24 to −38 ms at every t). What remains is GPU work that is
RESOLUTION-INDEPENDENT (320×180 ≈ 1920×1080) and FALLS over t while the
segment count rises (425k → 500k) — not fill-rate, not plain vertex count.

| # | Optimization | Lever | Impact | Risk |
|---|---|---|---|---|
| I | Attribute TheWall's GPU time with timestamp queries (vertex vs fragment vs the batch's storage reads; what about the early, top-down frames costs more), then fix what they show | the real frame: 130–260 ms GPU on this machine | the ceiling now | measure first — nothing to change until attributed |

Measuring tip: any perf claim from here on must await GPU completion;
`scratchpad`-style probes that time `renderer.render` alone measure
submission only.

## H result (2026-10-04) — the tether's frame, read once

The tube is not view-dependent (`view` is a build-time constant); it
recomputes each frame because the tether's clock moves. The waste was
structural: `toLocal` re-walked the ancestor chain and re-took the sine
and cosine of every ancestor's h/p/b for EVERY point (~120 per tether,
236 tethers). `Cable.localFrame()` now reads the chain once per geometry
computation (translation, the six cos/sin of −b/−p/−h, 1/scale) and
`toLocal` applies invRotHPB's arithmetic operation for operation from it
— the same floats. Byte-identity: state-gate (now table-aware for the
batch) on thewall, mindvirus, cable, labyrinth, molocheye, video01 —
identical apart from the first-frame noise floor, which differs equally
between two runs of the SAME code. GPU-complete TheWall frames:
265/239/189/126 → 264/228/164/84 ms at t = 0.5/3.33/8.33/15.8.

## Ribbon-vs-fill order in the batch (2026-10-04) — runs, and when batching wins

**The bug.** One batch drew every ribbon at ONE renderOrder above every
fill. Attach order IS composite order (the per-mesh oracle), so wherever
a fill is attached AFTER strokes it must cover, the batch was wrong: the
Web3 song's hero (shot 15) drew its flower lattice over the globe's black
ocean.

**The fix.** Ribbons batch in RUNS: a batched stroke joins the open batch
unless a fill (fill, wash, arrowhead — `claimFillOrder`) has claimed an
order since it opened, and each batch draws at its run's order. Within a
run only ribbons lie between the orders, and ribbon-vs-ribbon is a MAX
no-op, so runs composite exactly as the oracle does. All runs share ONE
table and ONE material (`BatchTable`) — per-batch materials cost 23 s of
boot on Web3's 6,466 runs; shared, 3.6 s.

**When to batch at all.** Each run is a draw, so batching wins only on
long runs (GPU-complete frames): TheWall 3,776 strokes / 237 runs —
batched 263/228/165/69 ms vs oracle 276/242/182, a win; Web3 17,648 /
6,466 — runs ~187 ms vs oracle 65–79, a loss, and the old single batch
(82–90 ms) was ALSO slower than the oracle besides being wrong. "auto" now
attaches batched, counts the runs, and below `MIN_STROKES_PER_RUN` (8)
hands every stroke back to its own mesh (`unbatch` — the meshes are
already in their groups), i.e. the oracle.

**Gates.** instancing-gate (forced batching = runs) on thewall (4 t),
o03, s01, molocheye, web3s15: data EQUAL and PNG BYTE-IDENTICAL to the
oracle on every frame (o03/s01 had only reached coverage equality under
the single batch). Web3 on auto: the hero frame is pixel-identical to the
oracle. state-gate vs HEAD: identical on all non-batched scenes (s01/text
show only the documented first-frame `hg` floor); thewall differs
structurally (237 batch meshes for 1) and is covered by the instancing
gate. VISIBLE CHANGE: the Web3 hero's lattice no longer draws over the
globe — the reference's own composition.

## Item I — the GPU ceiling, attributed (2026-10-04)

Method: three's timestamp queries switched on at runtime
(`renderer.backend.trackTimestamp = true`; the device already holds
`timestamp-query`), `resolveTimestampsAsync("render")` per frame, plus
GPU-complete wall time; differential hides applied after sync(). The
timestamp figure is the render pass in three's units — read it
RELATIVELY (it tracks wall − sync ≈ ×1.8).

**TheWall — what the GPU time is.**

| t | wall ms | sync ms | GPU pass | ribbons hidden | fills hidden | half the instances |
|---|---|---|---|---|---|---|
| 0.5 | 265 | 21 | 474 | 0.4 | 475 | 239 |
| 8.33 | 164 | 27 | 258 | 0.4 | 259 | 128 |
| 15.8 | 87 | 38 | 77 | 0.6 | 61 | 49 |

- Ribbons are all of it; fills nothing. Linear in instance count.
- Truly resolution-independent (canvas really resized 320×180 →
  2560×1440 in-page via `renderer.setSize`: 483/484/480/481 at t=0.5).
- Not the tethers: hiding the 472 cable strokes changes nothing at t=0.5
  (412 vs 415); the other 425,272 segments cost 412 / 234 / 69 at
  t = 0.5 / 8.33 / 15.8 — the SAME segment count, 6× apart by POSE.
- **The cause: degenerate geometry stacked on one spot.** At t=0.5,
  3,294 of 3,308 visible strokes are under 2 px on screen (median 0 px)
  and 423,790 segments fall in ONE 10-px cell — the unlaunched creatures
  at the spawn point. Every segment still rasterizes its pen-padded quad
  (pad in PIXELS, hence resolution-independent) onto the same pixels,
  and the MAX blends serialize. ~410 ms of GPU for one visible dot. At
  t=8.33: 2,146 sub-2-px strokes, 211,604 segments in the hottest cell;
  at 15.8 the creatures have spread (7,948).

**The double attach (explorer's find) — measured, and NOT TheWall's
cost.** At HEAD (separate worktree, before `oneparent`'s fix) a census of
host bindings: pl02 7,807 extra ribbons (18,371 drawn for 10,564 real,
+74%), p02k 2,103 extra (+74%), creatormode 5; TheWall, Web3 and video01
NONE. p02k, oracle path, HEAD → fixed tree: boot 3.7 → 2.0 s, frame
10.8/9.5 → 6.6/6.4 ms (CPU; its GPU pass is ~0.1 either way). pl02: see
the line below once measured.

**Proposed fix (not built) — I-1: drop stacked degenerate strokes from
the draw, exactly.** A stroke whose ink collapses to (sub-)pixel extent
draws a round dot of its pen width; N identical dots under MAX are ONE
dot, byte-exact. So per frame, among visible strokes whose projected
extent is below ~1 px, keep one representative per (pixel-snapped
centre, width, tint, fade) and hide the rest — the cull pass already
projects bounds, so the test is its own cost. Where degenerate strokes
differ (width, tint) the rule keeps each distinct dot, so it stays exact
(MAX of identical inputs is idempotent; differing ones are all kept).
Expected gain to GPU completion on TheWall: t=0.5 ~240 ms → ~25 ms (the
pass collapses to the ~14 real strokes plus sync); t=8.33 ~135 ms →
roughly half or better (2,146 of 3,540 strokes degenerate); t=15.8 small.
Gate: instancing/state gate + PNG cmp on thewall, then the wall gauntlet.
Open question for the build: whether "degenerate" should be judged on
screen extent (view-dependent, per frame) or on world scale ≈ 0 (cheaper,
covers exactly the unlaunched creatures) — measure both.

### Item I, continued (2026-10-04) — the one-parent fix measured, and Web3's ceiling

**One parent per holon (57a347b), GPU-complete, auto mode,** two worktrees
built from 57a347b~1 (before) and 57a347b (after):

| scene | before (wall ms / GPU pass) | after | boot before → after |
|---|---|---|---|
| pl02 (t 60, 300) | 114 / 92 · 111 / 87 | **70 / 50 · 78 / 72** | 51.3 → 33.4 s |
| p02k (t 5, 20) | 24 / 23 · 28 / 33 | **14 / 13 · 16 / 17** | 3.2 → 2.2 s |
| thewall (t 0.5, 8.33, 15.8) | 267 · 169 · 77 | 268 · 166 · 74 | unchanged (no doubles) |
| web3 (t 40, 100, 138) | 90 · 78 · 71 | 87 · 75 · 70 | unchanged (no doubles) |

So the double attach was 30–41% of the PL02 frames and none of TheWall's
or Web3's ceilings — those stand as attributed above (TheWall) and below.

**Web3 is CPU-bound, not GPU** (its pass is 4–17 against 70–90 ms walls).
CPU profile, per frame at t=40 (after the fix; 17,648 strokes, 6,460
washes, ~35k scene nodes), self time:

- matrix settle ~19 ms — `updateMatrixWorld` 10.6 + `multiplyMatrices`
  8.3. Three recomposes every auto-updating node each settle; the ribbon
  and fill MESHES (identity, never moved — the only transform writers are
  the group loop and the camera) still auto-update.
- shape dirty-check ~9.6 ms — `shapeKey` 6.8 + `sigChanged` 2.8: Web3 is
  mostly PARAMETRIC strokes (circles…), and F's allocation-free path
  covers only Lines; parametric shapes still allocate a key array per
  stroke per frame.
- sync() loops ~13.6, Holon proxy reads ~5.8 (the parametric key reads),
  Param getters ~3.2, render-list build ~5, applyAt 2.2.

| # | Optimization | Lever | Expected | Risk |
|---|---|---|---|---|
| I-1 | Hide stacked degenerate strokes, one dot per identical (centre, width, tint, fade) — exact under MAX | TheWall GPU (above) | t=0.5 ~265→~25 ms; t=8.33 ~half | **DONE 2026-10-04** — see "I-1 result" |
| I-2 | Ribbon/fill meshes `matrixAutoUpdate=false` (identity) and a non-forced settle, so only moved subtrees recompute | Web3/pl02 matrix settle ~19 ms | −10…−15 ms on Web3 | **DONE 2026-10-04** — see "I-2 result" |
| I-3 | Allocation-free parametric dirty-check (cached shape Params + scalar compare, like E/F did for transforms/style) | Web3 shapeKey ~9.6 ms | −6…−8 ms | **DONE 2026-10-04** — see "I-3 result" |

Measuring kit (scratchpad/engine): GPU-complete probe with runtime
timestamps (`gpulite.ts`, `gpuattr.ts`), census of host bindings
(`dupes.ts`). Every number above awaits GPU completion.

## I-1 result (2026-10-04) — a stroke scaled to nothing is one dot

**Criterion: exact world scale 0, not screen extent.** A stroke whose
group world matrix has an exactly-zero 3×3 maps every endpoint to exactly
the matrix's translation (0·x adds nothing, f64 or GPU f32); its screen
length is 0 and the shader's fronts multiply by a pxPerUnit of 0, so every
segment paints the same round dot whatever drawn/erased are. A "< 1 px on
screen" rule is NOT exact (a sub-pixel capsule is not a dot) and buys
little more: at t=0.5 exact-zero covers 3,728 strokes / 419,866 segments
(→ 5 distinct dots) against 423,108 for < 1 px; at 8.33, 205,428 vs
242,184. Kept: exact zero.

**Build.** In packRibbonBatch, per batch per frame: the first collapsed
stroke per (translation, width, tint, fade) draws ONE segment
(`writeStroke(…, drawSegments)` points the rest of its run at the hidden
row, re-pointing only when that count changes); later identical ones hide
their row. Only within a batch — between batches a fill may lie.

**Gates.** instancing-gate (collapsed strokes left out of the data proof on
both sides, so the rendered PNG must then be byte-identical): thewall at
0.2 / 0.5 / 1 / 2 / 3.33 / 5 / 6.5 / 8.33 / 10 / 12 / 14 / 16 — data EQUAL,
PNG IDENTICAL to the oracle every time (submitted segments 425,592 → 3,297
at t=0.2; 463,032 → 258,174 at 8.33); mindvirus, s06, molocheye pass as
before. Wall gauntlet (every 4th reference frame): summary identical
before/after and all 20 scored renders byte-identical. state-gate on the
non-batched set 168/168 identical. 1,810 tests green.

**Win, GPU-complete wall ms (TheWall):**

| t | before | after |
|---|---|---|
| 0.5 | 265 | **43** |
| 3.33 | 231 | **60** |
| 8.33 | 167 | **64** |
| 12 | 112–129 | **79–90** |
| 15.8 | 62–87 (noisy) | 77–98 (noisy; I-1 touches 32 strokes there) |

Harness fixes made on the way (both scripts had stopped working): the
instancing and wall gauntlets waited for `networkidle0`, which never
settles now that the page streams audio — they wait for the ready flag.
And the wall gauntlet's freshness guard (9bdf659) had been pasted INSIDE
its embedded Python crop script, so every crop failed and nothing was
scored; it is back at top level.

## I-2 result (2026-10-04) — only moved subtrees settle

The host's own meshes (ribbons, fills, washes, drawing washes, arrowheads,
cylinder contours) and the scene root stop auto-updating; each is flagged
once so the first settle computes it, and the host's frame settle is no
longer forced (`freezeStaticMatrices`, `settleScene`). A subtree is then
recomputed exactly when its group moved — sync() calls group.updateMatrix(),
which flags it — from the same inputs, so every matrixWorld is the same
float. Text's contour meshes, rebuilt later, keep auto-updating; the pick /
bounds helpers keep their own forced settles.

**Gate.** state-gate on 18 scenes (the default 16 + web3 + p02k): matrices
(`hm`) identical on all 18; 17 identical outright. Web3's uniform hash
differs in TRAVERSAL ORDER only: a direct dump of every ribbon's uniforms
(17,971) and every material's (6,483) at the gate's first frame is
identical as a multiset; its four async Text glyph meshes are created at a
different moment (layout resolves on a frame timer), so their object ids
and child order differ — MAX-blended, order-free. 1,810 tests green.

**Win, GPU-complete wall ms** (before = cd3bea7, a fresh worktree):

| scene | before | after |
|---|---|---|
| web3 (t 40 / 100 / 138) | 80 / 77 / 73 | **71 / 59 / 57** |
| thewall (t 0.5 / 8.33) | 47 / 78 | 45 / 71 |
| p02k (t 5 / 20) | 15.0 / 15.6 | 13.9 / 14.8 |
| pl02 (t 60 / 300) | 64 / 76 | 62 / 72 (boot 31.4 → 29.1 s) |

Also: state-gate.ts waits for the ready flag instead of `networkidle0`
(the page streams audio now — same fix as the two gauntlets).

## I-3 result (2026-10-04) — the parametric dirty-check, in place

`freshSig` captures a parametric stroke's Params at attach — `shapeParams`,
the exact Params `shapeKey` reads, in its class-dispatch and field order —
with their values in a Float64Array; `sigChanged` compares them in place,
one read per Param, with the same `===` (a NaN still always reads as a
change; drawReversed still 1/0). No key array per stroke per frame, no
proxy traps. Regeneration happens on exactly the same frames.

**Gate.** state-gate on 18 scenes: 17 identical (s01's documented
first-frame `hg` floor aside). Web3 differed in its first capture — in
NODE COUNT, i.e. its holons — because the web3 agent saved Web3Song.ts
between my base and new captures; a fresh base matched 28/28. 1,817 tests
green.

**Win, GPU-complete wall ms** (before = HEAD 35fdad9 worktree; after = the
same plus only this diff):

| scene | before | after |
|---|---|---|
| web3 (t 40 / 100 / 138) | 80 / 66 / 60 | **65 / 57 / 50** |
| thewall (t 0.5 / 8.33) | 44.5 / 76 | 44 / 69 |
| p02k (t 5 / 20, 4 runs) | ~13.2 / ~14.3 | ~13.7 / ~15.9 |

p02k's t=20 reads ~1.5 ms higher in 3 of 4 runs, yet its CPU profile
FALLS (5.1 → 3.7 ms a frame, sigChanged and the proxy reads both down);
I-3 does not touch the GPU path, so the residue is submission timing on a
15 ms frame — recorded, not explained.

**Where Web3 now stands.** 89/78/71 ms before I-2 → 65/57/50 after I-3
(GPU-complete, this machine), still CPU-bound: sync loops, proxy reads on
the remaining paths, render-list build. Next lever if wanted: re-profile.

## Layered dissolves (2026-10-04) — a picture fades as one

**The defect.** Opacity is per leaf, and a DreamSong's crossfade /
dissolve multiplied its ramp into every leaf's opacity gate. Half-faded
leaf by leaf, a translucent fill shows whatever the same picture drew
beneath it: in Web3's dive the globe's black sea let the red lattice
through (`dissolve-layers-dive.png`, top row before, bottom after, at
t = 20.0 / 20.5 / 20.9 / 21.3).

**The fix — what film does.** A dissolve flattens each picture, then mixes
the flat pictures by weight: A·a + B·b. `DreamSong.layerFades` reports the
fading chapters (roots + weight) instead of ramping leaves; Magic Move
still builds individual holons out and in. The host (`fadingLayers`,
src/render/layers.ts `LayerCompositor`) renders everything else as an
ordinary pass, then each fading layer alone at full strength into a
half-float, 4×-sampled target cleared to transparent black, and ADDS it in
scaled by its weight (one quad). Weight-0 layers are hidden. Frames with no
layer strictly between 0 and 1 take the ordinary single pass, unchanged.
The sum is what the song's own measurements describe ("the Vitruvian's
brightest line and the globe's sum to one"). A batched host mixes chapters
in one draw and renders unlayered; no batched song has a dissolve today.

**Gates.** The compositor reproduces an ordinary frame: one layer of a
whole scene at weight 0.999999 vs the direct render — max |Δ| 1/255, no
pixel above 2, identical ink (orientation, colour space and AA all right);
at 0.5 the peak white is 188 = sRGB(linear 0.5), as per-leaf fades render.
state-gate: the default 16 + p02k identical (s01's documented floor);
Web3, on frozen worktrees at e2aa6aa (the web3 agent was saving shots
mid-run), identical 28/28 — its gate marks all lie outside transition
windows, so nothing leaks out of them. Five song tests moved from "each
leaf ramps" to "each chapter's layer carries the weight, its leaves stay
whole". 1,817 tests green.

**Cost.** Outside windows nothing changes. Inside them the extra passes
add ~1–2%: 1,469 → 1,476 ms at t=20.5. Those ~1.5 s frames are a separate,
pre-existing defect found here — see the next item.

## Found: Text contours re-inset every frame of a camera move (~1.5 s/frame)

CPU profile of Web3 inside the dive (30 frames, 44.8 s): `segmentDistance`
17.2 s, `fits` 14.6 s, `boundaryLoops` 4.5 s, `buildOutlines` 2.1 s. Text
rebuilds its contour insets whenever its pixels-per-unit moves
(render/text.ts), which is every frame while the camera dollies, and the
text-weight fix's `insetLoopDeepest` checks fit against every edge of the
glyph, inside a 12-step bisection. Exact remedies, no visual change: cache
`boundaryLoops` per glyph geometry, and answer `fits`' "is any edge within
r" through a uniform grid of segments (cell ≥ r, so a 3×3 lookup is
exhaustive) instead of all pairs.

### Text contour inset cost — the exact half, done (2026-10-04)

- `insetLoopDeepest`'s fit test asks "is any edge closer than r" through a
  `SegmentGrid` (cell = the half-pen ≥ every r, so the 3×3 cells around a
  point hold every edge that could be closer) instead of all pairs.
  Exactness checked directly: HEAD's outline.ts vs the new one on every
  contour of a pangram at three sizes and five insets — 945 cases, 0
  differences — and 7.8× faster (8.2 s → 1.0 s).
- `buildOutlines` caches each glyph's boundary rings per layout (keyed by
  the position attribute and its version).
- Gates (frozen worktrees at cdf2ae4): state-gate text, patience,
  agentarena, quote, web3s09 identical; web3 identical but for one
  first-frame `hg` value — every ribbon's geometry at that frame is
  identical in the same order (17,929), so it is the documented
  unused-buffer-tail floor. 1,818 tests green.
- Web3 transition frames, GPU-complete: 1,437 → **439** ms (t=20.5),
  1,575 → **649** ms (t=46); t=40 unchanged (68).

**Still ~360 ms/frame there** (`near` 5.8 s, `within` 2.6 s, `fits`
2.6 s per 30 frames): Web3's pens are wider than its stems, so nearly every
contour bisects, every frame of a dolly. The remaining lever is not exact:
Text re-insets whenever its pixels-per-unit moves by more than an absolute
1e-4 — already a quantization. Re-insetting only on a ~0.5% relative move
would change the inset by ≤ ~0.01 px during camera moves (sub-pixel, but
not byte-identical) and remove nearly all of it. A TASTE-level call for
David/lead, not taken here.

## Web3 CPU re-profiled (2026-10-04, after I-2/I-3) — the next lever is dormant chapters

t=40, ~58 ms a frame CPU: matrix-settle walk ~12 ms (I-2 skips the
multiplies, three still visits all ~42k nodes per settle), Line dirty-check
~8.7, Param/derived getters ~8, sync() ~4.8, proxy reads ~3.5, render-list
projection ~2.7.

**93–99.5% of it is chapters nobody can see.** A DreamSong keeps all 13
chapters in the scene, and hides the inactive ones only through their
leaves' opacity gate — so sync(), every settle and the render-list walk
visit them all, every frame:

| t | live holons | dormant holons |
|---|---|---|
| 10 | 154 | 16,100 |
| 40 | 1,082 | 15,172 |
| 100 | 160 | 16,094 |
| 138 | 75 | 16,179 |

| # | Optimization | Lever | Expected | Risk |
|---|---|---|---|---|
| I-4 | Dormant chapters: the song names its live roots; the host skips the others' strokes/fills in sync() and hides their root groups (the render walk then skips them) | Web3 ~58 ms CPU | → single-digit ms | **DONE 2026-10-04** (option a) — see "I-4 + text-inset quantization" |

## I-4 + text-inset quantization (2026-10-04)

**Text inset quantization** (render/text.ts). The projection scale a Text
insets at is snapped onto a fixed log grid of 0.5% steps
(`insetBucketOf` / `insetScaleOf`) and the contours re-inset only when the
BUCKET changes — a pure function of the frame, so the same t draws the
same pixels whatever was played or scrubbed before (the old "re-inset when
ppu moved > 1e-4 since last time" depended on history). Inset results are
cached per (layout, glyph, inset depth), so a scrub back to a seen bucket
skips the bisection. Pixels: only Text-bearing frames change, sub-pixel —
max |Δ| 2/255 on Quote, 1/255 on the text showcase, 6/255 on web3s09
(the comma's tip; `text-inset-quantized-crop.png`: before | after |
difference ×40), nothing above 8 anywhere. Static-camera Text frames shift
too, by design: today's static inset was itself history-chosen (the first
ppu more than 1e-4 from the default); "exact on static frames" and "pure
in the frame" cannot both hold. On its own it does not speed Web3's dive
(the dolly crosses a bucket every frame) — its job there is purity, which
I-4 then needs.

**I-4, option (a)** (song.ts `liveRoots`, three-host.ts `updateDormancy` /
`asleep`). A song names the roots of the chapters on screen; the host
skips every dormant chapter's stroke / fill / wash / drawing-wash /
cylinder / arrow / text work, its cull and batch entries, and its pick
candidates, and hides its root group (the render walk skips it). The
group transform loop and every settle still run, so every world matrix is
exactly what it was and a waking chapter meters its pens from the same
previous-frame matrices it always did.

Gate (frozen worktrees at a26f983 + quantization, vs + I-4): **532/532
frames identical across 19 scenes**, the four songs (video01, magicmove,
web3, origins) included. Two refinements of state-gate.ts were needed and
are honest ones: matrices of EVERY node still, but nodes/uniforms/geometry
only for DRAWABLES on the visible traversal (an object in a hidden subtree
is never submitted; a visible group around invisible meshes and a hidden
group are the same frame); and shared buffers de-duplicated PER FRAME (the
once-per-page set made a frame's hash depend on which buffers earlier
frames had shown — identity history, not content). Before both, the only
differences were exactly those artefacts, plus Text's history-dependent
inset — which the quantization removes. 1,829 tests green.

**Web3, GPU-complete wall ms, HEAD (a26f983) → quantization + I-4:**

| t | 10 | 20.5 (dive) | 40 | 46 (crossfade) | 100 | 138 |
|---|---|---|---|---|---|---|
| before | 55 | 431 | 66 | 596 | 58 | 50 |
| after | **34** | **37** | **45** | **184** | **35** | **28** |

Note for anyone running worktrees here: DreamTalk is a submodule whose
shared config sets `core.worktree`, so `git -C <linked-worktree>` status /
checkout can report on or touch the MAIN tree. Verify a worktree's
content with `git show <rev>:<path> | cmp` rather than its git status.
