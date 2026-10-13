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

## Inventory — ranked by value

Value ≈ copies × songs that benefit × how far the copies have drifted. "Owner
busy" means another agent was mid-work in that holon on 2026-10-13; those are
left for the owner's next pass (they have been told).

1. **Derived-points memo — the rest.** `vocabulary/Earth/Earth.ts`
   (`deriveLine`; `deriveSurface` is its Surface twin),
   `Earth/Connection.ts`, `FlowMap/FlowMap.ts` (`deriveChannel`),
   `Morph/Morph.ts` (×2), `SOPLoop`, `Horizons`. Target: `derivePoints`
   (and a `deriveMesh` beside `Surface` if a second surface needs it).
   Identical idea; the guard's PENDING list names them. Owners busy.
2. **The eye, computed from an Observer — 7 copies.** `soliddrawing.ts`
   `viewOf`/`toWorld`/`toLocal` (canonical), `Earth.ts` `seenFrom` +
   `worldMatrixOf` + `DEFAULT_EYE`, `Earth/Labels.ts`, `sketch/mirror.ts`
   `pageProjector`, `src/view.ts`, `holons/ValueFlow`, `parts/recede.ts`
   (uses the canonical one), `three-host.ts syncCamera` (the source of
   truth). Drift risk is real: a camera change (the viewer's orbit layer,
   `tilt`) has to be taught to each copy. Target: one `eyeOf(observer)` +
   world/local in `src/parts/soliddrawing.ts` (or a small `src/eye.ts`),
   every view-dependent holon reading it. Earth owner busy.
3. **The Web3 "light node" — 3 copies.** Globe in a bloom of falling-opacity
   rings, flower-of-life lattice, red ring, twelve rays: `demo/web3/Shot15Hero.ts`
   (+ `Web3Song` HeroShot re-fits), `YinYang.ts` red node (the same recipe at
   lobe scale: globe 0.415 vs 0.419 of the ring, rays 1.25/1.17 — the hero's
   248/232 exactly), `GlobeDemo.ts` hero. Same symbol, drifted constants and
   colours. Target: `vocabulary/LightNode` (radius = the ring; promoted
   `bloom`/`lattice`/`rays` presences; the Earth inside a Recede). Also
   `disc()` masks ×3 (ClarityField, Shot15Hero, GlobeDemo) fold into it.
4. **Particles along a path — 3 implementations.** `vocabulary/Stream`
   (dots by arc length, pure f(time)), FlowMap's `flows[i].dots`,
   SOPLoop's particles (spacing at a world speed). Same idea, different
   spacing rules and certainty handling. Target: Stream as the one
   particle carrier, FlowMap/SOPLoop composing it. Owners busy.
5. **The Web2 node — 2 copies.** Blue ring, triangular grid in the band,
   lightning bolts, red field-line spirals: `YinYang.ts` blue node and
   `Web2Disintegrating.ts` (the lattice that falls). Target:
   `vocabulary/Web2Node` or an ability of a shared node holon with #3.
6. **The noosphere lattice sphere.** `Regenaissance/lattice.ts` draws the 15
   great circles flat (front/back halves, clipped analytically); `Platonic`
   is another flat-projected cage; the Earth has a true 3D graticule. The
   Regenaissance source names a separate "NoosphereAndBiosphere" DreamTalk,
   so this lattice globe recurs. Target: a 3D `Noosphere` holon (lines on a
   true sphere, hidden by the Earth's horizon technique), set on the page
   with Recede where a flat picture needs it.
7. **The Vitruvian man.** `demo/web3/VitruvianMan.ts` + `vitruvian-path.ts`
   (Shot 12, FourierDemo) is a scene-local symbol; pl02 shows it as an image.
   Target: `vocabulary/Vitruvian` (FourierTrace inside), imported by both.
8. **The "drawing" cast** — `(stroke as unknown as { add(h: Line): Line }).add(outline)`
   to make a filled closed shape: 9 sites (FlowMap ×2, Shot01 ×2, SMark,
   prism, Labels, Earth, YinYang). Target: one public way to build a
   filled outline (a `Stroke` ability or a `Shape` primitive) — no casts.
9. **Small numeric helpers.** `clamp01` ×8 (ClarityField, YinYang,
   LightSpread, Grain, three-host, parts/text, render/text, journey),
   piecewise-linear `keyed` (Shot01), `lerp` ×3. Target: one
   `src/math.ts`. Low drift risk; do it with the next touch of each file.
10. **Cylinders.** `vocabulary/Cylinder` is the one implementation (src/parts
    re-exports it); `holons/Cylinder` extends it as the founding DreamNode.
    Not a duplicate — noted because it looks like one.

Spot-checked, no second implementation found: arrows (scenes use Line's own
arrowheads), the human figure (`vocabulary/Figure` is already the one
person), trucks/factories (`Truck`, Earth's `Factory`/`Headquarters` on
`prism.ts`). Eyes were not audited past the grep (video01/origins scenes
import `Eye`).
