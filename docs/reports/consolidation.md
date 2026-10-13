# Consolidation — one symbol, one implementation

2026-10-13. David: "the globe DreamTalk symbol (the new Earth) is far superior
to the 2D globes in other DreamSongs. We want one reusable Earth object
imported everywhere the symbol is used, so all improvements propagate to all
DreamSongs. Do that move for Earth first, then abstract it into a general
functionality to clean up our vibe mess methodically."

The rule now lives in docs/TASTE.md (Architecture, "One symbol, one
implementation") and is guarded by `core/test/one-implementation.test.ts`:
no shelf symbol's class is declared outside its own folder (a DreamNode
that *extends* the one implementation, like `holons/Cylinder`, is fine), and
no private copy of the derived-points memo outside an allowlist that only
shrinks.

## Done

| # | What | Commit | Pixels |
|---|---|---|---|
| 1 | **Earth everywhere.** The flat Web3 `Globe` (21 Natural Earth rings projected to a disc each frame) is retired. Every Web3 shot (1, 2–3, 13, 15 and the song's chapters), GlobeDemo, Regenaissance and the whiteboard use `vocabulary/Earth`. A flat picture's layering is kept by `src/parts/recede.ts` (the Earth scaled about the eye until it lies behind the page: the same pixels, page ink composites over it, its solids `composite: "inOrder"`). LightSpread's two globes became one Earth; its spreading light is the Earth's land light; its arcs are the Earth's own `greatCircleArc`, living in its frame and hidden by its horizon. Old boards' `globe` opens as `earth`. | 49fadbf, bf55244 | Changed, intended: real 1:50m coasts, a true sphere, the ocean opaque from the first frame. Choreography unchanged (rendered 0.5–140 s before/after). |
| 2 | **`derivePoints` once**, exported from `src/parts/primitives.ts` beside `Line`. It lived as ~20 private copies ("the fifth copy … written the same way deliberately"); Slides/Connections' copy had lost its `geomVersion` bump. 14 files migrated. | 7fb786c | Byte-identical, 26 frames over 11 scenes. |
| 3 | **`seen()` / `decodeSrgb()`** in `src/constants.ts`: six copies of "a sampled screen colour, handed to the host decoded". The pending colour-space question now has one place in scene code. | 9d57d4c | Byte-identical (web2, yinyang). |
| 4 | Regenaissance's lattice turns through `rotHPB` instead of its own copy of the h/p rotation. | 86976ad | Same numbers (max diff 0). |
| 5 | **`vocabulary/LightNode`**: the Web3 decentralised node (Earth in a bloom, flower of life, red ring, rays) was drawn in Shot15Hero/HeroShot, YinYang's red lobe and GlobeDemo. One holon, `radius` its one size, layer presences as params; on the shelf. | 5227d27 | YinYang byte-identical; the hero differs by ~50 px at the ray tips; GlobeDemo's hero panel now is the real node (intended). |
| 6 | **`src/math.ts`** `clamp` / `clamp01`: nine private copies (text, geometry, view, sketch, Web3). | 58173b0 | Byte-identical. |
| 7 | **`Shape`** (primitives.ts): a filled area of any outline as a public primitive, replacing the cast past `add()` in SMark, YinYang's bolts and Shot 1's glows and veil. | 8d90684 | Byte-identical. |

Since then the owners have moved Earth, Connection and Morph onto `derivePoints` too.

## Inventory — what is left

"Owner" means another agent owns that holon; they have been told what the
shared piece is.

1. **The eye, computed from an Observer.** Canonical: `soliddrawing.ts`
   `viewOf` / `toWorld` / `toLocal` (Recede uses them). Copies: `Earth.ts`
   `seenFrom` / `worldMatrixOf` / `DEFAULT_EYE` / `localEye`, `Earth/Labels.ts`,
   `holons/ValueFlow`. `sketch/mirror.ts` builds a THREE camera with
   perspective-only maths (deliberately, for the page projection), and
   `three-host syncCamera` is the source of truth. Drift risk: every camera
   change (orbit layer, tilt) has to reach each copy. Owner: earth, valueflow.
2. **Derived points, the rest:** `FlowMap` (`deriveChannel`), `SOPLoop`,
   `Horizons`. Owner: symbols/flowmap. The guard's PENDING list names them.
3. **Parts added after construction:** `prism.ts`, `Earth/Labels.ts`,
   `Earth.ts` (`addTo`) and FlowMap's stages cast past `add()` to compose
   into a plain Null. `Group({ members })` is the public form when the
   members are known up front. If they can't be, `add` may want a public
   twin. That is a core API decision, so propose it, don't decide it.
4. **The Vitruvian man.** `demo/web3/VitruvianMan.ts` (standalone) and
   `Shot12Vitruvian.ts` both build Da Vinci's circle + square + FourierTrace
   from shared constants. A `vocabulary/Vitruvian` holon would hold all
   three. Blocked: `Shot12Vitruvian.ts` has an uncommitted edit
   (`terms: 500`) from before this session, whose owner is unknown.
5. **Particles along a path.** `Stream`, FlowMap's flows and SOPLoop
   already share the maths (`src/geometry/flowmap.ts` `streamArc`,
   `atArcLength`); what repeats is the per-particle wiring (memo, placement,
   symbol hook). Target: FlowMap and SOPLoop compose `Stream`. Owner:
   flowmap/symbols. Low drift risk now that the maths is shared.
6. **The noosphere lattice** (`Regenaissance/lattice.ts`) has only one use.
   Promote it to a 3D `Noosphere` holon when a second song wants it, not
   before.
7. **Small helpers left:** `clamp01` in Grain, three-host and MorphCurves
   (owners' files). The vector `lerp`s differ by type and are not duplicates.

Checked, not duplicates: the YinYang "Web2 node" (ring, triangular grid,
bolts, field spirals) appears once. `Web2Disintegrating` is a different
symbol (a triangle lattice that falls apart). `holons/Cylinder` extends the
one Cylinder.

Spot-checked, no second implementation found: arrows (scenes use Line's own
arrowheads), the human figure (`vocabulary/Figure` is already the one
person), trucks/factories (`Truck`, Earth's `Factory`/`Headquarters` on
`prism.ts`). Eyes were not audited past the grep (video01/origins scenes
import `Eye`).
