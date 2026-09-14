# The mid-scene render hump — root-cause diagnosis (optimization #3)

**Date:** 2026-09-14 · **Scene:** `thewall` (demo, `/demo/?scene=thewall`) ·
**Host:** vanilla-Three WebGPU (`src/render/three-host.ts`), Chrome headless
`--use-angle=metal`, 1280×720. Puppeteer-core harness driving
`window.__dtHost.renderFrame(t)` with `renderer.render` monkey-patched for
self-time, and `RibbonStroke.prototype.setPoints`/`allocate` instrumented for
call-count, packed-segment sum, and reallocation detection.

This is a **measurement/diagnosis** pass — no `src/`, `core/vocabulary/`, or
bundle-source changes. The demo bundle was rebuilt (`bun run build:demo`) from
current source before measuring.

---

## The one-line verdict

**Both starting hypotheses are FALSIFIED.** The hump is **neither**
instance-buffer re-upload (a) **nor** the power-of-2 realloc / pipeline
re-validation on a changed segment count (b). There are **zero reallocations**
mid-flight, and freezing all `setPoints` reproduces the hump unchanged. The
hump is a **WebGPU-backend per-object submission cost that appears only when
(i) ~3,776 ribbon meshes are visible at once AND (ii) the scene crosses a
choreography threshold at t ≈ 1.65** — the moment the tethers enter their
active XPBD draping regime. It is a **step function, not a smooth curve**, it
is **entirely TheWall-specific** (no other scene with moving derived geometry
shows it), and it is **paid only on a continuously-advancing frame** — a warm
repeat of the very same t, or a cold jump to it, both render in ~25 ms.

---

## 1. Peak location (fine sweep, 0.1 s, 2–8 s)

Sweeping t and timing render, the profile's "222 ms at t=3.33" turns out to be
**an artifact of how it measured** (single `setT`-style renders after a jump,
which pay a one-time shader/pipeline **compile** each jump). Separating
*first render at a t* (`cold`) from *an immediate repeat at the same t*
(`warm`, geometry frozen) shows:

| t (s) | render cold | render **warm (repeat)** | setPoints calls | **reallocs** |
|---|---|---|---|---|
| 2.2 | **816 ms** | 26 ms | 108 | **0** |
| 3.3 | 29 ms | 33 ms | 418 | **0** |
| 3.9–4.2 | 353–678 ms | 23–26 ms | ~100 | **0** |
| 8.1–10.1 | 169–243 ms | 26 ms | ~450 | **0** |

The big `cold` spikes are **one-time pipeline compiles** for cables newly
crossing the activation threshold — they **vanish on the second visit** (see
§4, revisit test). They are *not* the hump the profile was chasing.

**The real hump is a different, sustained phenomenon** that only appears under
**continuous playback** (t advancing one 30 fps step per frame), and it has a
**hard onset**:

| t (s) | render ms (continuous) | movedGroups | cable strokes moved |
|---|---|---|---|
| 1.5 | 25 | 15 | 24 |
| 1.6 | 25 | 17 | 28 |
| **1.7** | **179** | 18 | 30 |
| 2.0 | 173–182 | 22 | 40 |
| 2.5 | 182 | — | 52 |

**Peak: the plateau begins at t ≈ 1.65** (25 ms → 179 ms between t=1.6 and
t=1.7) and holds ~170–190 ms through t ≈ 3, then **decays monotonically** back
to the ~25 ms floor by t ≈ 11–12. The onset is a **step**, not proportional to
moving-object count (which crosses the boundary smoothly).

---

## 2. `setPoints` / realloc / upload decomposition (at the peak)

Instrumenting `RibbonStroke` across the whole hump region:

- **Reallocations: 0.** `allocate()` never fires mid-flight, at any t, on any
  stroke. The power-of-2 capacity is reached once, at each cable's activation,
  and is stable forever after. **Hypothesis (b) — realloc / pipeline
  re-validation from a changing segment count — is dead.**

  *Why:* a tether's edge Line is **always 81 points** (21 baked particles →
  Catmull-Rom ×3 → 81 spine points → two ±radius edges), so `resamplePolyline`
  with `target=128` gives a **constant** `perSegment = ceil(128/80) = 2` →
  **160 segments every frame**. Capacity rounds 160 → 2⁸ = 256 once and never
  moves. The only realloc-relevant transition is empty(0)→160 **once** at
  activation. `ribbon-math.ts`'s integer `perSegment` step never trips because
  the input point count never varies.

- **Bytes re-uploaded at the peak: ~230 KB/frame** (≈46 moving cable strokes ×
  5,120 bytes each: 160 segs × (6+2) floats). Even re-uploading **all 3,776
  strokes** is only 18.4 MB and, measured, costs **+12 ms** (§3c). Upload
  bandwidth is nowhere near 150 ms. **Hypothesis (a) — steady per-frame
  re-upload cost — is also dead.**

- `renderer.info.memory.geometries` is **flat at 4,013** the entire timeline —
  no geometry/buffer leak, no climbing program count.

---

## 3. Isolation: upload vs draw vs frame-change

**(a) Freeze test.** Render the peak frame, then render it again — the second
render has stable `shapeKey`s, so `sync()` calls `setPoints` **zero** times
(no resample, no repack, no `needsUpdate`). Result: **816 ms → 22 ms**. With
all geometry regeneration and upload removed, the frame is cheap. So the cost
is not in `setPoints` itself.

**(b) Full-playback freeze.** Three complete 0→12 s playback passes at 30 fps:

| pass | setPoints | median | p90 | max | spikes >60 ms |
|---|---|---|---|---|---|
| 1 (cold, normal) | on | 90 ms | 174 ms | 366 ms | 232 |
| 2 (warm, normal) | on | 92 ms | 180 ms | 584 ms | 240 |
| 3 (warm, **suppressed**) | **off** | 94 ms | 174 ms | 523 ms | 242 |

**Suppressing every `setPoints` call changes nothing** (pass 2 ≡ pass 3), and
warm ≡ cold (compile is amortized). **The hump is independent of geometry
regeneration and upload entirely.**

**(c) Force-upload test.** At a warm t, re-uploading all 3,776 strokes' buffers
(`needsUpdate=true`) then rendering: **25 ms → 37 ms** (+12 ms for 3,776
uploads). Confirms upload is cheap.

**(d) Resolution test inside the hump.** Warm-repeat render at t=2.0 (peak)
across 320×180 → 1920×1080: **24–27 ms, flat.** Fragment/fill/overdraw is
**not** the cost (consistent with `cull-result.md` and the profile's floor
reading — but now confirmed *inside* the hump region too).

**(e) The decisive axis — jump vs advance vs repeat, at the SAME t=2.0:**

| how t=2.0 is reached | render ms |
|---|---|
| **Cold jump** from t=0 (minimal history) | **26 ms** |
| **Warm repeat** of t=2.0 | **25 ms** |
| **Continuous advance** (…1.93 → 1.97 → 2.0) | **173–182 ms** |

The cable **geometry at t=2.0 is byte-identical** in all three (the tether is
baked — a pure table lookup). The *only* thing that differs is the **previous
frame's per-object GPU state**. The hump is therefore a backend cost that
scales with **how much per-object submission state changed since the last
draw**, incurred only when advancing through the active-cable regime — not with
resolution, not with segment count, not with upload volume.

---

## 4. The decisive realloc-vs-reupload verdict

**Neither.** The two candidate root causes the brief posed both fail their
tests with direct evidence:

| candidate | prediction | measurement | verdict |
|---|---|---|---|
| (a) per-frame instance re-upload | suppressing `setPoints` removes the hump; hump scales with bytes | suppressing changes nothing (pass 2≡3); forcing all uploads = +12 ms | **FALSIFIED** |
| (b) realloc / pipeline re-validation on changing segment count | reallocs cluster in the hump; segment count varies | **0 reallocs** anywhere; segment count constant at 160/stroke | **FALSIFIED** |

**Actual root cause:** a **WebGPU per-render-object submission cost** —
each of the ~3,776 ribbon meshes reads its own `userData` reference-node
uniforms (`NodeUpdateType.OBJECT`, `ribbon.ts` header) and binds/updates its
own cloned uniform buffer before its draw. This cost is **latent** (~25 ms for
all 3,776 when the frame is a repeat or a cold jump) but **inflates ~7× to
~180 ms once the scene is being advanced frame-to-frame through the regime
where the tethers are actively draping** (t ≈ 1.65 onward). The revisit test
pins the *compile* spikes as separate and one-time (t=9.6: **707 ms cold →
32 ms on second visit**, identical `setPoints` work both times); the hump that
remains is the per-changed-frame bind/submit cost, and it is a **step at
t≈1.65**, decaying as cables shorten and settle into the wall.

The mechanism is a per-object bind-group / uniform-buffer refresh that the
Metal-backed WebGPU backend pays proportional to **objects whose per-object
state differs from the previous submission**, and which is amplified by the
sheer count (3,776) only in TheWall.

---

## 5. Generality — TheWall-specific, NOT an engine property

Full continuous playback of every scene with moving/derived polylines:

| scene | strokes | median | p90 | max | hump? |
|---|---|---|---|---|---|
| `cable` (standalone trail, per-frame **recomputed**, not baked) | 66 | 0 ms | 1 ms | 1 ms | **no** |
| `mindvirus` (moving cable + creature) | 80 | 1 ms | 1 ms | 2 ms | **no** |
| `magicmove` (6 morph shapes gliding) | 7 | 0 ms | 0 ms | 3 ms | **no** (sub-ms noise) |
| `o01` | 119 | 0 ms | 1 ms | 3 ms | **no** |
| `s08` (2-pt axes receding — the resample stress case) | 101 | 0 ms | 1 ms | 1 ms | **no** |
| `thewall` | 3,776 | 90 ms | 180 ms | 366 ms | **YES** |

A scene with a **moving, per-frame-recomputed** cable (`cable`, `mindvirus`)
renders at **sub-millisecond**. The hump is **not** a general property of
animated polylines or of `setPoints`. It emerges **only** at TheWall's
object-count scale (≈3,776 visible ribbons) intersected with the active-cable
regime. Any future scene that puts thousands of ribbons on screen while
per-object state churns every frame will hit it; nothing at hundreds will.

---

## 6. The fix each root cause implies

Because the falsified causes (a) and (b) are dead, **do not pre-allocate max
capacity and do not chase `needsUpdate`** — they would buy nothing (0 reallocs
already; upload is +12 ms). The real cost is **O(visible ribbon meshes) of
per-object bind/submit**, so the fixes are the ones the profile already ranked
for render submission — now with the hump's mechanism understood:

### Fix A — GPU-instance the ribbon submission (profile #5) — the true fix
**Impact:** collapses the per-object submit cost that IS the hump. One draw per
stroke-*type* across all 236 creatures, per-instance transform + fold +
draw-front + width/tint/erase in an instance buffer, instead of 3,776
independent meshes each rebinding its own uniform buffer. This removes both the
~40 ms floor and the ~180 ms hump (they are the same cost, at two magnitudes).
**Projected:** floor + hump → a uniform frame; genuine 60 fps at these counts.
**Risk to byte-identity:** HIGH — a near-total rewrite of the ribbon host on
the gauntlet-scored render path. This is a chapter, not a tweak.
**impact ÷ risk:** high impact, high risk.

### Fix B — off-screen / degenerate cull (profile #2) — the pragmatic lever
**Impact:** the hump is `O(visible ribbons)`; `cull-result.md` found the cull
does **not** currently cut TheWall (it fills the view — `vis` stayed 3,776 the
whole run). But a **screen-size** cull (hide sub-pixel / fully-behind-wall
tethers during the folded-in phases) would cut the *visible* count in exactly
the regime where each visible mesh is most expensive. Where it cuts, the hump
falls proportionally.
**Projected:** if it halves visible ribbons in the hump, ~180 → ~90 ms there.
Partial, and does nothing where all ribbons are genuinely on-screen (t≈2–3).
**Risk:** LOW-MEDIUM — a false cull drops scored ink; screen math sits next to
the render path but touches no sampled value.
**impact ÷ risk:** medium impact, low risk — **do this first**, but know it is
a mitigation of the symptom, not the cause.

### Fix C — flatten per-creature scene-graph nodes (profile #4) — adjacent help
**Impact:** 3,776 meshes across 5,901 groups is ~25 nodes/creature; fewer
world-matrix updates per changed frame is fewer per-object refreshes feeding
the backend cost. Bake child offsets into the polylines at attach so each
creature is one group.
**Projected:** shaves the group-transform + `updateMatrixWorld` share (a few
ms) and modestly reduces the per-changed-frame churn that amplifies the hump.
**Risk:** LOW for the frame path (transforms only); touches `attach()`
structure, needs a gauntlet byte-identity pass.
**impact ÷ risk:** low-moderate impact, low risk.

### Not worth doing (proven here)
- **Pre-allocate max ribbon capacity / dedupe `needsUpdate`:** 0 reallocs
  measured, upload is +12 ms. Buys nothing.
- **Reduce SUBDIVISION / lower resolution:** render is resolution-independent
  *inside the hump* too (§3d). No gain, fidelity risk.
- **Dirty-track `applyAt`:** already 0 ms (3 params).

---

## Ranked by (impact ÷ risk to byte-identity)

1. **Fix B (screen-size cull)** — low risk, partial impact, ships now. Cuts the
   hump wherever ribbons are off-screen/sub-pixel; ~180 → ~90 ms there.
2. **Fix C (flatten nodes)** — low risk, small impact; reduces the per-changed
   -frame churn feeding the backend cost.
3. **Fix A (GPU instancing)** — the only root-cause fix (the hump and the floor
   are one per-object-submission cost); high risk, high impact, a chapter of
   work. Do 1–2 and re-measure before committing.

**The single most important finding for the optimizer:** the hump and the
~40 ms floor are **the same cost** — per-object WebGPU submission over ~3,776
meshes — seen at two magnitudes. There is no separate "hump bug" to fix. Chasing
buffer re-upload or realloc (the two hypotheses on the table) would have spent
effort on causes that measurement shows contribute **zero**. The lever is
**object count on the render path**: cull it (B), flatten it (C), or instance
it away (A).
