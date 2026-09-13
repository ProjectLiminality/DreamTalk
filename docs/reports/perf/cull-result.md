# Conservative frustum cull — result

**Date:** 2026-09-13 · **Optimization #2** from `thewall-profile.md` ·
**Scene under test:** `thewall` (the target), plus `mindvirus` (where the
cull actually fires) · **Host:** vanilla-Three WebGPU
(`src/render/three-host.ts`), Chrome headless `--use-angle=metal`, 1280×720,
demo daemon on :4174.

## The one-line verdict

The cull is **correct and conservative — proven byte-identical, and proven to
fire (up to 23 strokes hidden on `mindvirus`) without dropping a pixel** — but
on **TheWall specifically it removes ZERO ribbons at every frame**, because the
wall fills the view for the entire scene: not one stroke's bounding sphere is
ever wholly outside the frustum. So on TheWall it is a **~2.4 ms/frame net
overhead for no render saving.** The profile's hoped-for "opening top-down /
folded ending have most tethers off-screen" does not hold — those frames are
framed *tighter* on the wall, not looser. The mid-scene render hump is NOT
off-screen ribbons (it swings identically with the cull on or off), which is
the profile's #3, not #2. **The lever landed; TheWall just has nothing for it
to lift. It will pay off on DreamSongs that actually pan geometry off-frame.**

## The design as built (additive by construction)

`src/render/ribbon.ts`
- `RibbonStroke` gains a cached LOCAL bounding sphere (`boundsCenter`,
  `boundsRadius`), recomputed **only in `setPoints()`** — i.e. only when the
  shape changes, the same gate the host's `shapeKey` check already tracks. It
  is an AABB-center + farthest-point sphere: a valid, slightly loose cover
  (never tight), which is exactly what a conservative cull wants. An emptied
  polyline reports radius 0.

`src/render/three-host.ts`
- `StrokeBinding` carries its `group` (the frame its local sphere is stated
  in), populated at attach.
- A new `cullOffscreen()` runs at the **end of `sync()`**, after
  `syncCamera()`. It:
  1. settles the camera world matrix (`syncCamera` sets rotation via `lookAt`
     but not `matrixWorld`) and the scene graph (`updateMatrixWorld(true)` —
     the no-cylinder fast path never settles it, and `render()` re-settles
     immediately after, so no double-apply), then builds a `THREE.Frustum`
     from `projectionMatrix × matrixWorldInverse`;
  2. for each stroke **whose `mesh.visible` is already true** (never anything
     `style()` hid, never a radius-0 empty stroke), carries the local sphere
     center to world by the mesh's world matrix, scales the radius by the
     group's max world scale, and **pads** by the stroke's screen-pixel
     half-width + a 16px safety margin (`CULL_PAD_PX`) converted to world
     units at the sphere's depth (perspective: `2·d·tan(fov/2)/heightPx`,
     using distance-to-center — an over-estimate off-axis, the safe
     direction; ortho: a frame constant);
  3. sets `mesh.visible = false` **only if** the padded sphere is fully
     outside the frustum. A sphere the test cannot prove is outside is left to
     the existing rule.
- The pass is gated by `cullEnabled` (default true) — the harness flips it to
  compare cull-on vs cull-off in one process; `?cull=0` on the demo does the
  same for a scored run.

Additive, never a replacement: `style()`'s `fraction > erased && opacity > 0`
still runs every frame first; the cull only ever hides *more*, never revives
anything. Each frame `style()` recomputes `visible` from scratch, then the
cull re-decides — no state leaks across frames.

The sub-pixel / "shorter than ~1px" idea from the profile was **deliberately
NOT done** (a 1px stroke can be a scored pixel). Frustum-only here — the
provably-safe subset.

## The byte-identity gate (THE gate) — PASS

Raw pixels on TheWall are **not bit-reproducible across separate browser
processes** (MAX-blended overdraw across 3,776 meshes is GPU-schedule
sensitive), so a naive cmp of a baseline capture vs a post-change capture
DIFFERS even with the code unchanged — a red herring. The correct gate
compares **cull-on vs cull-off in the SAME process, on the settled `setT`
frame** (the demo's double-render makes each frame a pure function of t): same
GPU, same frame, only the cull path varies.

**TheWall — `cmp` cull-on vs cull-off, settled, per scored frame:**

```
f0001 IDENTICAL   f0018 IDENTICAL   f0043 IDENTICAL
f0007 IDENTICAL   f0026 IDENTICAL   f0063 IDENTICAL
f0013 IDENTICAL   f0038 IDENTICAL   f0078 IDENTICAL
```

And the fidelity score (overlay.py `coverage_ref` vs `refs/wall/thewall5`) is
identical to 4 decimals across cull-ON, cull-OFF, and a second cull-OFF run;
`|ON−OFF| = 0.0000` at every frame, equal to the `|OFF−OFF₂|` render-to-render
noise floor (also 0.0000 on the settled frames):

```
idx    cullON  cullOFF cullOFF2  |ON-OFF|  |OFF-OFF2|  culled
f0026  0.8734  0.8734  0.8734    0.0000    0.0000       0
f0038  0.9819  0.9819  0.9819    0.0000    0.0000       0
f0043  0.9842  0.9842  0.9842    0.0000    0.0000       0
f0063  0.9422  0.9422  0.9422    0.0000    0.0000       0
f0078  0.9136  0.9136  0.9136    0.0000    0.0000       0
```

On TheWall this is trivially true (culled = 0). The *real* byte-identity proof
is on a scene where the cull FIRES:

**`mindvirus` — the cull hides up to 23 of 80 strokes; every frame still
`cmp`-IDENTICAL cull-on vs cull-off** (31 frames swept across the duration):

```
t=3.20 culled=6  IDENTICAL     t=3.96 culled=23 IDENTICAL
t=3.39 culled=13 IDENTICAL     t=4.14 culled=23 IDENTICAL
t=3.58 culled=19 IDENTICAL     …
t=3.77 culled=22 IDENTICAL     t=5.65 culled=23 IDENTICAL
maxCulled=23  GATE PASS: identical every frame even where the cull fired
```

This is the load-bearing result: the cull removes only genuinely off-screen
ribbons, and does so without changing a single scored pixel, verified where it
actually acts.

## Culled-count table (the honest ceiling on TheWall)

| t (s) | culled / 3776 | note |
|---|---|---|
| 0.00 (opening, top-down) | **0** | wall fills frame |
| 0.20 | 0 | |
| 3.33 (hump peak) | 0 | creatures mid-flight, all on-screen |
| 5.00 (hump) | 0 | |
| 7.50 | 0 | |
| 8.33 | 0 | |
| 12.50 | 0 | |
| 16.00 (folding) | 0 | |
| 16.669 (folded ending) | **0** | folded wall still fills frame |

Independent confirmation (not via the cull code): projecting every stroke's
sphere **center** to NDC, **0 / 3776 centers fall outside the [−1,1] cube** at
t = 0, 3.33 and 16.669. Nothing on TheWall is off-screen, ever. (The cull
mechanism is not broken — the 9 unit tests and the 23-stroke mindvirus result
prove it fires; TheWall simply presents no opportunity.)

## Render-ms before/after (TheWall)

Because culled = 0, the draw submission is byte-identical to the pre-cull path,
so render-ms is unchanged **by construction**. Interleaved measurement (cull
on/off alternated per rep to cancel warmup/order) confirms it:

| t (s) | render OFF (ms) | render ON (ms) | culled |
|---|---|---|---|
| 0.00 | 25.5 | 25.0 | 0 |
| 3.33 | 29.5 | 26.2 | 0 |
| 5.00 | 147.6 | 152.6 | 0 |
| 16.669 | 31.4 | 88.4 | 0 |

The ON/OFF pairs are equal within noise at the floor (t=0, t=3.33). The wild
swings at t=5 and t=16.669 appear on BOTH ON and OFF — they are the transient
GPU pipeline stall the profile flagged (its #3, the "least-understood number"),
not the cull. **The cull neither helps nor hurts render on TheWall.**

**Frame-path overhead the cull adds** (interleaved, warmed — the reliable
figure): `sync()` grows by **~2.2–2.7 ms/frame** (was ~7.9→10 ms, now
~10→13.6 ms), dominated by the required `updateMatrixWorld(true)` (~1.25 ms,
redundant with render's own settle on the no-cylinder fast path) plus the
3,776 sphere transform/test loop. The per-stroke `unitsPerPixelAt` projection
was replaced with the cheap depth formula above, cutting the overhead from
~3.5 ms to ~2.4 ms.

## Gates

- **Byte-identity:** PASS. `cmp`-identical cull-on vs cull-off on the settled
  frame, both on TheWall (culled=0) and — decisively — on mindvirus where the
  cull hides 23 strokes. overlay.py scores unchanged to 4 decimals.
- **tsc:** clean (`bunx tsc --noEmit`).
- **bun test:** 1243 pass / 0 fail across 62 files, including 9 new
  `test/cull.test.ts` cases: local sphere covers the polyline; emptied
  polyline → radius 0; sphere behind camera culls; sphere far to the side
  culls; dead-center sphere kept; sphere straddling the frustum edge kept; a
  wide (80px) stroke a hair past the edge kept by the width padding; group
  world scale respected; a style()-hidden stroke never reconsidered.

## Honest verdict on the hump

**Frustum culling does NOT touch TheWall's hump, and cannot** — the hump is
long, moving, on-screen cables mid-flight, not off-screen ribbons. Every stroke
is inside the frustum at every t. Render-ms swings identically with the cull on
or off. This confirms the profile's own caveat under #2/#3: the 150–222 ms
hump is a per-object GPU upload/pipeline stall driven by moving geometry, which
points at **#3 (characterise & remove the hump)** and **#5 (instance the
creatures)** — not this optimization.

What this delivers instead: a **correct, conservative, always-safe frustum
cull** now lives in the ribbon host, proven to hide off-screen ribbons with
zero pixel cost. It is a net loss on TheWall (~2.4 ms/frame for 0 culled) and
would be worth gating off for TheWall alone, but it is the right primitive for
the DreamSongs to come that pan and zoom geometry off-frame — where `mindvirus`
already shows it reclaiming a quarter of the strokes.

### Follow-ups (not done here, by scope)

- Consider skipping the cull's `updateMatrixWorld(true)` + loop for scenes that
  never cull (a cheap per-scene "has anything ever left frame?" latch), so the
  ~2.4 ms is not paid on walls that fill the view.
- Pre-existing bug, NOT touched (not my file): `scripts/wall-gauntlet.ts:117`
  leaks a TS call `ensureFreshDemoBundle()` into an inline python string, so
  its crop step throws `NameError` and scores 0 frames. Scoring here was done
  with a standalone crop + `overlay.py` harness instead. Worth a one-line fix.

---

## The idle latch (follow-up, integrated) — the cull pays nothing where it can't fire

The cull's own verdict was that on TheWall it is a **~2.4 ms/frame net loss**
(0 culled, wall fills the view). Rather than gate it off per-scene by hand, the
pass now **self-disables** on any frame it cannot help.

**The rule (ThreeHost.cullOffscreen):** two scalars fully identify a pure
frame — the timeline `t` and the camera view-projection matrix. After a full
pass that culls **nothing**, the pass records `(t, VP)` and arms an idle flag.
On the next frame, if `beforeSync` is undefined (pure path), the idle flag is
armed, and both `t` and `VP` match the armed values, the frame is bit-identical
to the one that culled nothing — so its cull result is nothing too, and the
expensive `scene.updateMatrixWorld(true)` + 3,776-stroke sweep are skipped. Any
change to `t` or the camera re-arms the full pass; a frame that culls anything
leaves the latch disarmed, so the pass keeps running while ink is off-screen.

**Safety.** The latch engages ONLY in the pure frame path. The editor's
`beforeSync` can move geometry with `t` held (dragging a paused object), which
neither scalar would catch — so a live override layer disables the latch
outright and the editor pays the full cull (fine: interactive, not playing 236
creatures). `cullLatchT` starts NaN, so the first frame always runs.

**Byte-identity — the visible-mesh-set proof.** Raw TheWall pixels are not
bit-reproducible across screenshots (MAX-blend schedule), so the gate compares
the thing the cull actually controls: the **set of `mesh.visible` flags** the
latch path produces vs the full-cull path, same process, same frame. This set
is deterministic and is the sole input the cull contributes to the pixels.

- **TheWall** (latch skips, cull fires 0): visible-mesh set identical at
  t = 0, 3.33, 8.33, 16.669 — **0 mesh differences**, 3776/3776 both ways.
- **mindvirus** (cull fires 6/23/23): the latch never skips (a culling frame
  disarms it), so it re-runs the full cull and matches exactly — **0 mesh
  differences** at t = 3.20, 3.96, 5.65. `latchSkippedCulled == fullCulled`.

Since the latch never changes which meshes draw, it cannot change a pixel.

**Reclaim (held busy frame, t=3.33, TheWall):** renderFrame **41.97 ms**
forcing the full cull each frame → **37.43 ms** with the latch skipping —
the ~2.4 ms cull overhead (plus variance) returned. This helps the **paused
viewer** (fly-around-while-paused holds `t`) and any static hold; a *playing*
scene advances `t` every frame and does not latch, which is correct — during
playback the cull must run to catch geometry leaving frame. So the net effect
is: the cull costs nothing on a held frame it can't help, and still fires the
moment the view or time changes.

**Tests:** 5 latch cases in `test/cull.test.ts` (identical frame skips; changed
t never skips; moved camera never skips; override layer disables the latch;
unarmed / NaN-t never skips) — 14 cull tests total, 1248 suite-wide.
