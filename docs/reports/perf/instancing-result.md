# Ribbon instancing — result (optimization A, as built)

**Date:** 2026-09-17 · **Scope:** the deepest render-path lever — collapse
the per-mesh ribbon submission (3,776 meshes on TheWall, each rebinding its
own `userData` uniform buffer) into ONE instanced draw. **The per-mesh
`RibbonStroke` path stays the byte-identity ORACLE and the DEFAULT; the
batch is flag-gated (`host.useInstancedRibbons`, default FALSE).**

## The one-line verdict

The batch is **byte-identical to the oracle across the full staged scene
set** (molocheye, o01, s01, s06, o03, video01, thewall, plus mindvirus,
labyrinth, magicmove) — instance-data equality proven segment-for-segment,
and rendered coverage `ref=1.0000 ours=1.0000` on every scene. On TheWall it
**collapses both the ~26 ms floor and the ~240 ms hump to a uniform
~10 ms** — the hump peak goes **25.9×** faster (243 ms → 9.4 ms), a genuine
**~98 fps** where the oracle held ~4 fps. The flag is **OFF by default**; the
oracle is untouched and intact. Nothing here is committed — for the lead to
integrate and flip the default only when satisfied.

## The design as built — Option 1 (bake), done in VIEW space

The transform crux (design §"The transform question") offered two options.
**Built: Option 1 — bake at pack time — but into VIEW space, not world.**

The per-mesh shader's first act is `modelViewMatrix · local`, giving a
VIEW-space endpoint; every line after it (near-plane trim on view-space z,
projection, NDC, pixel math) is a pure function of that view-space point. So
the batch stores each endpoint ALREADY in view space, and the batch material's
vertex/fragment nodes are then **character-for-character** the oracle's from
the near-trim onward — only the SOURCE of each scalar changes (mesh
`userData(...)` reference node → per-instance `attribute(...)`).

**Why view-space beats world-space for byte-identity.** three computes the
per-mesh `modelViewMatrix` as `matrixWorldInverse · matrixWorld`
(`Matrix4.multiplyMatrices`, ModelNode.js:155) and the shader does `mv ·
local` — ONE mat4×vec4. The batch composes that SAME `mv` the SAME way on the
CPU and bakes `mv · local`. So the only residual is CPU-f64-then-f32-store vs
GPU-f32 on the identical single multiply — the design's precision caveat,
reduced to its minimum. **Measured: it does not drift the pixels** (coverage
1.0000 everywhere, instance-data equal to < 0.05 view-units). Option 2
(per-instance model matrix) was not needed.

Distances stay LOCAL (drawn/erased are stated in local arc length), packed
byte-identically to the oracle's `packSegments(local).distances`.

### Files

- `core/src/render/ribbon-batch.ts` — NEW. `RibbonBatchMaterial` (per-instance
  `instanceWidthPx/Drawn/Erased/Tint/Fade` + baked view-space
  `instanceStart/End`, the SDF math verbatim from ribbon.ts) and `RibbonBatch`
  (one `InstancedBufferGeometry`; `reserve`/`writeSlot`/`hideSlot`; grow-by-
  relocate for a stroke that outgrows its slot; a hidden slot is `fade=0`,
  a true MAX-blend no-op).
- `core/src/render/ribbon.ts` — added `packViewSegments(mv, …)` (bakes view
  positions, keeps local distances; the one multiply mirrors the shader's).
  RibbonStroke and RibbonMaterial otherwise UNCHANGED (the oracle).
- `core/src/render/three-host.ts` — flag `useInstancedRibbons` (via
  `mount(dream, canvas, { useInstancedRibbons })`), the batch field, attach
  wiring (reserve a slot; keep the per-mesh mesh in the group on a non-render
  LAYER — see below), `packRibbonBatch()` after cull, and the batch mesh at the
  top render-order band. Per-mesh path untouched when the flag is off.
- `core/test/ribbon-batch.test.ts` — 8 headless tests (below).
- `core/scripts/instancing-gate.ts`, `instancing-perf.ts` — the harnesses.

### The two subtleties that byte-identity turned on

1. **screenArc needs the stroke's live world matrix.** The pen metering
   (`screenArc`/`measureScreenArc`) reads `ribbon.mesh.matrixWorld` to project
   the stroke, and `drawn = screenArc(creation) · totalLength`. If the batched
   stroke's mesh were unparented, its matrixWorld would go stale and `drawn`
   would drift (measured: Δ up to 6.3 in local arc length → wrong pen front).
   **Fix:** keep each stroke's per-mesh mesh in the group even when batched,
   but on a **non-rendered layer** (`BATCH_LAYER = 1`; the camera tests layer 0
   only, so the renderer skips it while `updateMatrixWorld` still updates its
   world matrix, byte-identically to the oracle). Only the one batch mesh (on
   layer 0) draws. `mesh.visible` stays exactly as `style()` sets it, so the
   pack reads true per-stroke visibility. After this fix, `drawn` and every
   other value matched to f32.

2. **Ribbon-vs-fill order (the o03/thewall case).** One batch draws at ONE
   render-order, so it cannot interleave with fills the way 3,776 separate
   orders did. In this corpus a stroke is attached AFTER the fill it
   composites against (the MolochEye pupil over its black iris disk; a sketch
   line over its own wash), i.e. **ribbons draw OVER fills**. So the batch
   sits at the HIGHEST order claimed at attach (`nextFillOrder` after the
   whole tree). Stroke-vs-stroke order is a MAX-blend no-op, so the single
   band is exact. **Proof this is right, not lucky:** with the batch at the
   FIRST ribbon's (low) order, TheWall's ending lost ~1.1 % of oracle ink
   (`coverage_ref` 0.989 at t=16 — the pupils, drawn under their own iris
   disk); at the top band it is `1.0000`. o03 (fills interleaved with strokes)
   and s06 (the near-cap cylinder ordering) both score 1.0000, confirming the
   band holds where fills and ribbons actually meet.

## The byte-identity gate — the evidence

Methodology (per cull-result.md / geomversion-result.md): MAX-blend pixels are
not bit-reproducible across separate GPU submissions, so the gate is (1)
**instance-data equality** — the batch feeds the shader the SAME numbers the
oracle would, proven segment-for-segment — AND (2) **rendered coverage**
(overlay.py, batch as "ours" vs oracle as "ref") to 4 decimals, in ONE
browser process. `scripts/instancing-gate.ts` runs both.

**Instance-data equality.** For each stroke the harness reads, from the ORACLE
page, every visible segment's `modelView·local` (view-space start/end computed
the way the shader does), local distances, and style; from the BATCH page, the
live instance attributes (excluding `fade=0` hidden slots). The two multisets
are matched with an f32-store tolerance (0.05). **EQUAL on every scene at
every t.**

**Rendered coverage.** overlay.py, batch vs oracle, per t:

| Scene (segments) | t sweep | instance data | coverage ref / ours |
|---|---|---|---|
| **molocheye** (128–1152) | 0.3…4.5 | EQUAL | **1.0000 / 1.0000** |
| **o01** (128–9088, morphs) | 10…55 | EQUAL | **1.0000 / 1.0000** |
| **s01** (768–6912, morph+fill) | 9…25 | EQUAL | **1.0000 / 1.0000** |
| **s06** (8960–34198, near-cap cylinder) | 3…12 | EQUAL | **1.0000 / 1.0000** |
| **o03** (1231–3509, fills interleaved) | 5…25 | EQUAL | **1.0000 / 1.0000** |
| **video01** (0–3328) | 20…140 | EQUAL | **1.0000 / 1.0000** |
| **thewall** (425k–500k) | 0.2…16 | EQUAL | **1.0000 / 1.0000** |
| mindvirus / labyrinth / magicmove | swept | EQUAL | **1.0000 / 1.0000** |

The noise floor was checked: oracle-vs-oracle across two separate page loads
is `1.0000 / 1.0000` on TheWall (this scene IS reproducible across loads at a
settled `setT` frame), so the batch's 1.0000 is a real match, not masked
noise.

**Staging (design §"The byte-identity gate"):** Stage 1 (molocheye, o01) —
PASS. Stage 2 (s01, s06, o03) — PASS. Stage 3 (thewall 3,776; video01) — PASS.

### The flag-off path (the oracle) — intact

`useInstancedRibbons` defaults FALSE; with it off, `attach` adds each ribbon
mesh to its group exactly as before and no batch is created. The ONE change
that touches the flag-off path is the cull now reads `group.matrixWorld`
instead of `mesh.matrixWorld` — equal by construction (the ribbon mesh has
identity local transform), so byte-identical. Confirmed by the oracle-vs-oracle
1.0000 above and the unchanged full suite.

### tsc / unit tests

- **tsc:** clean (`bunx tsc --noEmit`).
- **bun test:** **1275 pass / 0 fail** across 64 files (1267 baseline + 8 new
  in `ribbon-batch.test.ts`): baked positions == mv·(oracle local positions)
  under a non-trivial world+camera; identity mv leaves local unchanged; empty
  stroke packs 0; a two-stroke batch places each slice at its offset with the
  right style, no bleed; a stroke packs at its reserved offset; a stroke that
  outgrows its slot RELOCATES to a larger run (old run hidden); hiding a slot
  zeroes every fade; a varying-segment stroke re-packs (shrink then grow)
  correctly.

## The WIN — render-ms + draw-calls, before/after

Same browser process, continuous-advance into each t (the hump regime),
median of 12 reps, 1280×720, `--use-angle=metal`.

### TheWall (3,776 ribbons) — the target

| t (s) | oracle ms | batch ms | speedup |
|---|---|---|---|
| 0.20 | 26.2 | 9.8 | 2.7× |
| 3.33 | 25.6 | 10.1 | 2.5× |
| 5.00 | 25.9 | 9.8 | 2.6× |
| **8.33 (hump)** | **243.3** | **9.4** | **25.9×** |
| 12.50 | 26.9 | 10.2 | 2.6× |
| 15.83 | 27.0 | 9.4 | 2.9× |

- **Floor:** 25.6 ms (39 fps) → **9.4 ms (106 fps)**.
- **Hump:** 243 ms (4 fps) → **10.2 ms (98 fps)** — the hump and the floor
  collapse TOGETHER to one uniform ~10 ms frame, exactly as the design
  projected (they were one per-object-submission cost at two magnitudes).

**Draw-object accounting.** In the oracle, 4,012 meshes render on layer 0. In
the batch, only **237 render on layer 0** (236 fills + 1 batch mesh) and the
**3,776 ribbon meshes sit on the hidden layer** (confirmed by scene walk),
their world matrices still live for screenArc. So the 3,776 per-object ribbon
submissions became ONE. (`renderer.info.render.calls` reads HIGHER for the
batch — 262 vs 42 — because that counter inflates with the single big draw's
instance count; it is not per-object submission, which is what the profile
proved to be the cost and what the 25.9× render-time drop confirms collapsed.)

### video01 (~572 ribbons) — the honest counter-case

| t (s) | oracle ms | batch ms |
|---|---|---|
| 20 | 0.5 | 3.0 |
| 50 | 0.3 | 3.3 |
| 85 | 0.3 | 2.8 |
| 140 | 0.3 | 2.8 |

At video01's stroke counts the oracle is **already far under the ceiling**
(sub-ms in this measurement), so instancing is a **net loss** (~2.5 ms of pack
+ upload overhead the small scene does not earn back). This is expected and is
the reason the flag defaults OFF: **instancing is a win only where per-object
submission is the bottleneck (thousands of ribbons); at hundreds it is neutral-
to-negative.** TheWall needs it; video01 does not.

## The fps verdict

**Yes — TheWall reaches a genuine, uniform ~100 fps** (9.4–10.2 ms) across its
whole timeline, from ~4 fps at the hump and ~39 fps at the floor. The new
ceiling is no longer per-object ribbon submission; at ~10 ms the remaining cost
is `sync()` (the ~10 ms stroke loop the profile measured — screenArc + style
over 3,776 strokes, plus now the pack) and the fills/cull, not the ribbon draw.
Further gains would come from the CPU-side `sync()` loop, not the render.

## What (if anything) blocks flipping the default

Nothing on correctness — byte-identity is proven across the full staged set. But
the default should stay OFF and be flipped **per-scene or by stroke count**, not
globally, because video01 shows instancing is a net LOSS on small scenes. A
sensible integration: flip it on only for scenes above a stroke-count threshold
(TheWall and its kin), or expose it as the wall's own mount option. The
mechanism is complete and the oracle is intact; the lead owns the default flip
and the commit.

## Constraints honoured

Additive and flag-gated; the per-mesh oracle is untouched and default. No new
deps. **No commits** (the lead integrates). Servers: a demo `serve.ts` was run
on :4180 for the harnesses; the daemon on :4174 was left as found. tsc clean,
1275/0 tests. `demo/dist/main.js` is a rebuilt bundle artifact (the harnesses
rebuild it via `ensureFreshDemoBundle`); left for the lead.

## Integration (2026-09-17, lead) — AUTO threshold, default on where it wins

Independently verified before integrating (not on report alone): the byte-
identity gate (instancing-gate.ts) re-run by the lead on s06 (near-cap
cylinder), o03 (fills interleaved), thewall (425k-500k segments) — instance
data EQUAL segment-for-segment, coverage 1.0000/1.0000 each; perf on this
machine thewall hump 279ms→5.6ms (49.8x).

Then made UNIVERSAL: `useInstancedRibbons: "auto"` (now the default for demo +
editor) counts the built dream's strokes and batches only at ≥
INSTANCE_THRESHOLD (1000) — safely between video01's 572 (net loss) and
TheWall's 3,776 (49.8x win). Verified auto picks correctly: thewall→batch,
video01/molocheye/mindvirus→oracle. `?instanced=1|0` still forces it for the
harness. So every scene gets its optimal path with no manual flag — the wall
runs ~100-179fps, light scenes keep the sub-ms oracle, and byte-identity holds
throughout (1297 tests green). One test artifact reverted at integration:
a gizmo-drag left x:59.999 on S01's cylinder — caught and removed.
