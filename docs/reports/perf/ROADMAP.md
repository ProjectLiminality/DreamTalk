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

## Ranked plan — deepest impact first

| # | Optimization | Lever | Impact | Risk | Status |
|---|---|---|---|---|---|
| A | **Instance the ribbons** — per-stroke style in an instance buffer, one draw per material instead of per mesh | the `render()` submission floor (the real ceiling) | the only route to 60 fps at these counts | HIGH (rewrites how style reaches the shader; byte-identity path) | pending A/B findings |
| B | **Geometry version counter** — O(1) dirty-check replacing the per-frame shapeKey array alloc/compare | `sync()` CPU, ~9 ms on TheWall; GC pressure everywhere | universal CPU win, every scene | LOW-MED (dirty-check only; regen unchanged) | **in flight** (geomver) |
| ~~C~~ | ~~The moving-cable render hump~~ — **DIAGNOSED, DISSOLVED** into A | — | — | — | **DONE** (hump-diagnosis.md): the hump IS the floor's per-object submission cost at higher magnitude — no separate bug; realloc & re-upload both falsified (0 reallocs, suppressing setPoints changes nothing). The only fix is A. |
| D | **Off-screen frustum cull** + idle latch | `render()` for pan/zoom scenes | scene-dependent (0 on walls; 23/80 on mindvirus) | LOW (proven byte-identical) | **DONE** (30d403b) |
| E | Flatten per-creature scene-graph nodes (~25 → few per creature) | `sync()` transform loop + boot | ~3-5 ms + boot | LOW | later |
| F | Surface: unconditional style writes, redundant screenArc calls, updateMatrixWorld on fast path | `sync()` tail | small, safe | LOW | later |

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
