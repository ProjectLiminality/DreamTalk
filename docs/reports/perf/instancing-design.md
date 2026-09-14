# Ribbon instancing — the design for optimization A

The render-path ceiling, from the profile + hump diagnosis: TheWall submits
3,776 ribbon meshes, each rebinding its own `userData` uniform buffer
(`NodeUpdateType.OBJECT`) before its draw. The hump and the ~40ms floor are the
SAME per-object submission cost at two magnitudes. Collapsing draws is the only
root-cause fix, and it is universal (every ribbon-heavy scene scales by mesh
count).

## Current per-stroke data flow (ribbon.ts)

- Geometry: `InstancedBufferGeometry`, one **segment** per instance. Attributes:
  `instanceStart`, `instanceEnd` (vec3 local positions), `instanceDistanceStart`,
  `instanceDistanceEnd` (float arc length). A unit quad expanded in-shader.
- Style: per-mesh `userData` via reference nodes — `widthPx`, `drawn`, `erased`,
  `tint` (color), `fade` (float).
- Transform: `modelViewMatrix` (the mesh's world matrix × view) applied to the
  local segment endpoints in the vertex node (ribbon.ts:195-196).
- One draw call per stroke.

## The target: one draw per RIBBON BATCH

Merge many strokes' segments into ONE `InstancedBufferGeometry` drawn once.
Every value the shader currently reads per-MESH becomes a per-INSTANCE
(per-segment) attribute:

| currently | becomes |
|---|---|
| `userData.widthPx` (mesh uniform) | `instanceWidthPx` (float per segment) |
| `userData.drawn` | `instanceDrawn` (float) |
| `userData.erased` | `instanceErased` (float) |
| `userData.tint` (color) | `instanceTint` (vec3) |
| `userData.fade` | `instanceFade` (float) |
| `modelViewMatrix · localPos` | positions **pre-transformed to world** at pack time, then only `viewMatrix · worldPos` in-shader |

The shader math is otherwise IDENTICAL — the vertex/fragment nodes stay the same
functions of (startPx, endPx, dist, width, drawn, erased, tint, fade); only the
SOURCE of each scalar changes from a mesh uniform to an instance attribute. This
is what makes byte-identity achievable: the same numbers reach the same math.

## The transform question — the crux

Each stroke lives under a group with a world transform (creature
position/rotation/fold/scale). Currently the shader applies `modelViewMatrix`.
In a merged geometry there is no per-mesh model matrix. Two options:

**Option 1 — bake world positions at pack time (RECOMMENDED).** When a stroke's
geometry or transform changes, transform its local segment endpoints by the
group's world matrix on the CPU (at sync/pack time) and store WORLD positions in
the shared instance buffer. The shader applies only `viewMatrix` (camera). This
is byte-exact: `modelViewMatrix = viewMatrix · worldMatrix`, so world-transform
on CPU then view-transform in shader gives the identical clip position, to
float precision, as the current `modelViewMatrix · local`. The near-plane trim,
NDC, pixel math all follow unchanged.
- Cost: a stroke must re-pack when its TRANSFORM changes, not just its shape.
  On TheWall every creature moves every frame, so most strokes re-pack every
  frame anyway — the pack is cheap (81 points × a mat4 mul); the WIN is one draw
  instead of 3,776. The geomversion work (B) tracks shape change; transform
  change is a cheap matrix-equality check per group.
- Precision caveat: baking world positions loses the shader doing
  `viewMatrix·(worldMatrix·local)` as a single mat4 — instead it's
  `viewMatrix·(worldMatrix·local)` with the inner product on CPU (f64) then f32
  store. The current path is `(view·world)·local` composed as f32 mat4 then ×
  local. These can differ in the last f32 ulp. **This is the byte-identity risk
  and must be measured** — if frames differ, the fix is to compose the same way
  (build the f32 modelView on CPU, multiply local by it, store) so the CPU path
  mirrors the GPU path exactly.

**Option 2 — per-instance model matrix** (4× vec4 attributes per segment). More
data, avoids re-pack-on-move (transform is an attribute, positions stay local).
Heavier buffer, but no re-pack when only the transform changes. More faithful to
the current mat4 composition (store the same f32 modelView the current mesh
would have). Fallback if Option 1 shows precision drift.

## Batching strategy

- One batch per MATERIAL config. All ribbons share `sharedRibbonMaterial()`
  today (same blend, same shader), so ONE batch covers every ribbon in the
  scene — modulo renderOrder. renderOrder currently sequences strokes for
  correct compositing (three-host attaches in composite order, nextFillOrder).
  MAX blending is ORDER-INDEPENDENT for color (max is commutative), so ribbons
  that MAX-blend can share one batch regardless of order — VERIFY this against
  the fill interleaving (fills are NOT max-blended and DO need order; ribbons
  and fills must stay correctly ordered relative to each other, so the batch is
  ribbons-only and sits at the ribbon renderOrder band).
- Capacity: the batch grows its instance buffers as strokes join; a stroke's
  segments occupy a contiguous slice. When a stroke's segment count changes
  (rare — most are fixed; the section curve varies), the slice must resize —
  simplest correct approach: a free-list / re-pack, or over-allocate per stroke
  to its max. Design for the common case (fixed segment count) fast, the varying
  case correct.

## The byte-identity gate (non-negotiable, broad)

Baseline from HEAD across the full scene set: thewall, mindvirus, o01, s01, s06
(cylinder — the five-stroke near-cap ordering is the subtlest render case),
molocheye, o03, video01, magicmove, sketch, labyrinth, the wall stack. For each,
a t-sweep. The instanced path must produce frames byte-identical to the
per-mesh path. Because MAX-blend pixels aren't bit-reproducible across
processes, the gate is: (1) the geometry/instance data fed to the GPU is
identical (compare the packed world positions + per-instance style the batch
builds vs the per-mesh values the current path would set — same numbers), AND
(2) the gauntlet coverage scores unchanged to 4 decimals on every scored scene.
The cylinder scenes (s01/s06) and the wall are the highest-risk — the near-cap
five-stroke ordering and the 3,776-mesh MAX overdraw are where a batching/order
bug would surface.

## Projected win

The hump and floor are one cost; instancing collapses both. Profile projects
genuine 60fps at 3,776 strokes. Every scene benefits proportional to its stroke
count — the universal ceiling lifts.

## Risk & staging

HIGHEST risk in the engine (rewrites how style reaches the shader, on the
gauntlet-scored path). Stage it:
1. Build the batch alongside the existing per-mesh path, behind a flag.
2. Prove byte-identity (instance data equality + gauntlet scores) on the easy
   scenes first (molocheye, o01), then the cylinder (s01/s06), then the wall.
3. Only when every scene is byte-identical does the flag flip to default and the
   per-mesh path retire. Keep the per-mesh path until then — it is the oracle.
