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

| 8 | **`vocabulary/Vitruvian`**: Da Vinci's man (traced path, measured circle and square, FourierTrace pen, optional held figure) was built twice (the standalone scene and shot 12). Shot 12 keeps its uncommitted `terms: 500` tweak as `figureTerms: 500`. | d5eb624 | Byte-identical against the working tree. |
| 9 | **`Holon.attach(part)`** (team-lead's decision): the one public way to attach a part after construction, the same one-parent adoption as `add`. prism.ts uses it; the guard flags `as unknown as { add(` casts. | 46cf9e1 | No change (attach is add). |

The owners have since moved Earth, Connection, Morph, FlowMap, SOPLoop and Horizons onto `derivePoints`. The guard's derived-points PENDING list is empty.

## Inventory — what is left

"Owner" means another agent owns that holon; they have been told what the
shared piece is.

1. **The eye, computed from an Observer.** Canonical: `soliddrawing.ts`
   `viewOf` / `toWorld` / `toLocal` (Recede uses them). Copies: `Earth.ts`
   `seenFrom` / `worldMatrixOf` / `DEFAULT_EYE` / `localEye`, `Earth/Labels.ts`,
   `holons/ValueFlow`. earth is moving them into a shared
   `src/geometry/frames.ts` (soliddrawing re-exports it). `sketch/mirror.ts` builds a THREE camera with
   perspective-only maths (deliberately, for the page projection), and
   `three-host syncCamera` is the source of truth. Drift risk: every camera
   change (orbit layer, tilt) has to reach each copy. Owner: earth, valueflow.
2. ~~**Casts past `add()`**~~ — done: FlowMap, then Earth, Labels,
   PointData and GeoFlow (d1c112f) use `attach()`; the guard's lists are
   all empty.
3. **Particles along a path.** `Stream`, FlowMap's flows and SOPLoop
   already share the maths (`src/geometry/flowmap.ts` `streamArc`,
   `atArcLength`); what repeats is the per-particle wiring (memo, placement,
   symbol hook). Target: FlowMap and SOPLoop compose `Stream`. Owner:
   flowmap/symbols. Low drift risk now that the maths is shared.
4. **The noosphere lattice** (`Regenaissance/lattice.ts`) has only one use.
   Promote it to a 3D `Noosphere` holon when a second song wants it, not
   before.
5. **Small helpers left:** `clamp01` in Grain, three-host and MorphCurves
   (owners' files). The vector `lerp`s differ by type and are not duplicates.

6. **Hand geometry, said twice (audit 2026-10-15).** `J` (joint
   indices), `dist`, the palm centre and the fingertips' `reach` are in
   both `src/hands.ts` / `hands/screen.ts` (the input layer) and
   `src/gesture/hand.ts` (the gesture layer). The grab thresholds
   (0.9 open → 0.45 fist) are tuned on one `reach`, so a change to either
   formula silently de-tunes the other. Target: once, in `src/hands.ts`,
   with the gesture layer importing the data module (it already consumes
   its frames).
7. **The keyed memo, three ways.** `derivePoints` (primitives.ts),
   `deriveLoops` (parts/polylines.ts) and Earth's `deriveSurface` each
   restate "recompute when the key changes, bump the version". The
   difference is which property carries the version. Target, if a fourth
   appears: one `keyedMemo(key, compute)` that all three wrap. Today the
   three are short and tested, so this is low priority.

Audited 2026-10-15 and found clean: the soft echo is ONE primitive
(`render/echo.ts`) under both superposition and glow; the session
recorders are complementary (`editor/recorder.ts` keeps the walk, view and
voice, and `hands/recorder.ts` appends hand frames to the same session);
One-Euro, DTW and the action / clip modules each exist once. Small: one
`lerp` and an inline clamp in `hands/sim.ts` (use `src/math.ts`).

Checked, not duplicates: the YinYang "Web2 node" (ring, triangular grid,
bolts, field spirals) appears once. `Web2Disintegrating` is a different
symbol (a triangle lattice that falls apart). `holons/Cylinder` extends the
one Cylinder.

Spot-checked, no second implementation found: arrows (scenes use Line's own
arrowheads), the human figure (`vocabulary/Figure` is already the one
person), trucks/factories (`Truck`, Earth's `Factory`/`Headquarters` on
`prism.ts`). Eyes were not audited past the grep (video01/origins scenes
import `Eye`).

2026-10-18: `LightNode` → **`DreamTalkSymbol`** (`vocabulary/DreamTalkSymbol/`) — the InterBrain film shows this exact symbol and names it DreamTalk ("the digital extension of SandTalk", 29:08; "a DreamTalk symbol", 29:14); `vocabulary/LightNode/LightNode.ts` is a thin re-export, boards map `lightNode` → `dreamTalkSymbol` (sketch/board.ts), and `?scene=web3s15` renders pixel-identical before/after (t=3, t=8).

2026-10-18: `SMark` → **`Vision`** (`vocabulary/Vision/`) — the InterBrain film names the red S-mark Vision ("an organic vision that reveals itself through inspiration", 18:54; f5686 "Narrative → Vision"); popped out of Regenaissance (which now imports Vision), `vocabulary/Regenaissance/SMark.ts` is a thin re-export of the old names (`SMark`, `SMARK`, `SMARK_PEN`, `MARK_RED`, `sCentreline`, `sBandOutline`), the shelf lists `Vision`; boards keep the hand-written `sMark` entry (its holon is now `Vision`), so no board rename. Regenaissance's tests pass unchanged.
