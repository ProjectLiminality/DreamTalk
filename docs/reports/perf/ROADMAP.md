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
| C | **The moving-cable render hump** (27→222 ms) — root cause: buffer realloc churn vs steady re-upload | `render()` transient stall on animated geometry | uniform frame time; general to animated polylines | MED (touches how geometry reaches GPU) | **diagnosing** (hump) |
| D | **Off-screen frustum cull** + idle latch | `render()` for pan/zoom scenes | scene-dependent (0 on walls; 23/80 on mindvirus) | LOW (proven byte-identical) | **DONE** (30d403b) |
| E | Flatten per-creature scene-graph nodes (~25 → few per creature) | `sync()` transform loop + boot | ~3-5 ms + boot | LOW | later |
| F | Surface: unconditional style writes, redundant screenArc calls, updateMatrixWorld on fast path | `sync()` tail | small, safe | LOW | later |

## Ordering rationale

- **B and C first** (in flight): B is a pure-CPU universal win with low risk;
  C's diagnosis tells us whether the render stall is realloc churn (a cheap
  pre-allocation fix) or steady re-upload (which only instancing/A fixes). C's
  verdict *shapes* A.
- **A after B+C land and we re-measure**: it's the biggest prize and the
  highest risk, directly on the byte-identity render path the gauntlets pin.
  Do the cheap universal wins first, re-profile, then commit to the chapter.
- **D done**: the primitive exists, self-disabling where it can't help.
- **E, F**: surface polish once the deep levers are in.

Every step re-measures against the profile and gates on byte-identity across a
broad scene set — never one scene. "Universal" means the scene set is the gate.
