/**
 * The vanilla-Three WebGPU host — the first adapter over the host
 * contract (mount / renderFrame(t) / dispose). The framework owns t;
 * whoever mounts this requests frames.
 *
 * Stroke rendering (PLAN Ch 4): every stroke — Circle/Square/Polygon/
 * Arc and the cylinder's caps + silhouette generators — renders
 * through the TSL ribbon pipeline (render/ribbon.ts): instanced
 * segment quads expanded to constant SCREEN-PIXEL width (the 2021
 * Sketch & Toon look), analytic capsule-SDF anti-aliasing, round
 * caps/joins, and arc-length draw-on with an AA'd round pen tip.
 * The Line2/dash era is gone; its hard-won lesson lives on in
 * ribbon.ts (animated material values must be TSL uniform nodes —
 * NodeMaterialObserver never watches plain props).
 *
 * Param-driven geometry regen: static stroke polylines are rebuilt
 * when their shape params change (editor sliders) via a cheap
 * per-frame dirty-check — a few floats compared per stroke in sync();
 * a rebuild costs one O(segments) repack + buffer upload. Stroke
 * width/tint/opacity/creation are uniforms and cost nothing to
 * animate.
 */

import * as THREE from "three/webgpu"
import { orthoHalfHeight, type Dream } from "../dream"
import { setLiveObserver } from "../geometry/frames"
import { Holon, rawHolon } from "../holon"
import type { Param, Readable } from "../params"
import { beginReads, endReads, paramEpoch, quietEpoch, readsOpaque, type ParamValue, type Reads } from "../params"
import { isPresence, seenCertainty, seenOpacity, withChainMemo } from "../certainty"
import { ECHOES, FillSuperposition, RibbonSuperposition } from "./superposition"
import { HOVER, breathe, seenGlow } from "../glow"
import { FillHalo, StrokeHalo } from "./glow"
import { clipOf, type ClipRegion } from "../clip"
import { CLIP_KEYS, clippedMaterial, initClipSlots, unclippedMeshes } from "./clip"
import {
  AnnularSector,
  Arc,
  Circle,
  Cylinder,
  Ellipse,
  Line,
  Polygon,
  Rectangle,
  Square,
  Stroke,
  annularSectorFill,
  annularSectorPolyline,
  rectanglePolyline,
  rephasePolyline,
  type Vec3Like,
} from "../parts/index"
import type { Color } from "../constants"
import { Text } from "../parts/text"
import { Surface } from "../parts/surface"
import { Polylines } from "../parts/polylines"
import { RibbonMaterial, RibbonStroke, RIBBON_KEYS, clippedRibbonMaterial } from "./ribbon"
import { BatchTable, RibbonBatch, type BatchSlot } from "./ribbon-batch"
import { FillShape, ellipsePolygon } from "./fill"
import { attachText, type TextBinding } from "./text"
import { capArc, capPolylineFrom, generatorPoint, silhouetteAngles } from "./silhouette"
import { screenArcRemap, type ProjectedPoint } from "./screen-arc"
import { CHUNK, mayReach, segmentBoxes, triangleBoxes, vertexBox, type Boxes } from "./pickcull"
import { boxDistance, boxFarthest, pointSegment, pointTriangle, raySegment, rayNearBox, rayTriangle, worldBox } from "./pickworld"
import { LayerCompositor } from "./layers"

const STROKE_SEGMENTS = 128

/**
 * C4D's Ocylinder rotation-segment default — the number of edges each cap
 * of the 2021 cylinder's contour polygon actually has. It is the unit the
 * draw-on is proportioned in (see syncCylinder).
 */
const CYLINDER_ROTATION_SEGMENTS = 64

/**
 * The geometry-regen dirty signature a stroke binding carries.
 *
 * For a Line — the many-point case (cables, morphs, sketches, section
 * curves) that dominated `sync()` — the signature is an O(1) triple: the
 * Line's `geomVersion` (bumped iff its polyline changed, static or
 * derived — primitives.ts) plus the two phase scalars the host re-applies
 * in `polyline()`. That replaces the old per-frame flatten of 3×pointCount
 * numbers with three integer/float reads and no allocation.
 *
 * For a parametric shape (Circle/Square/Polygon/Arc/AnnularSector/
 * Rectangle/Ellipse) the signature stays the small `number[]` of its
 * handful of shape params: those key on Param VALUES, not a `points`
 * array, so flattening them is already cheap, and a Param may be BOUND
 * (`follow`) — a version bumped only in `set value` would miss a derived
 * param's change and stale the geometry. The array read is unconditional
 * and correct; only the Line case — where the array was large and the
 * `points` accessor already tracks its own recompute — needs the version.
 */
interface ShapeSig {
  /** Line fast path: geometry version + drawStart + (drawReversed?1:0). */
  version: number
  drawStart: number
  reversed: number
  /** Parametric fallback: the flattened shape-param array. */
  key: number[]
  /**
   * Parametric fast path (perf I-3): the shape's Params, captured at
   * attach in `shapeKey`'s exact order, and the values last seen — compared
   * in place each frame instead of allocating a fresh key array through
   * the Holon proxy. `reversedAt` marks drawReversed (a boolean, read as
   * 1/0 like shapeKey), −1 when the shape has none.
   */
  params?: readonly { readonly value: unknown }[]
  vals?: Float64Array
  reversedAt?: number
  /**
   * Line fast path (perf J): the line behind its proxy and its two phase
   * params, captured at attach — the per-frame check reads them directly
   * instead of through the proxy's get trap (4–5 traps a line a frame).
   */
  line?: Line
  drawStartParam?: Param<number>
  reversedParam?: Param<boolean>
}

interface StrokeBinding {
  holon: Stroke
  ribbon: RibbonStroke
  /** The stroke-width param, read past the holon's proxy — the fast pick's tolerance (set on first pick). */
  pickWidth?: { readonly value: number }
  /** Shape signature for the geometry-regen dirty-check (see ShapeSig). */
  sig: ShapeSig
  /**
   * The group the ribbon mesh is a child of — the frame its local points
   * (and cached bounding sphere) are stated in. Kept so the off-screen
   * cull can read the world transform without a scene walk.
   */
  group: THREE.Group
  /**
   * The stroke's reservation inside the ribbon batch — set only when
   * `useInstancedRibbons` is on (optimization A). When present, the
   * stroke's per-mesh RibbonStroke still exists (it owns points, geometry,
   * bounds, and every measurement) but its mesh is NOT in the scene; its
   * segments and style are written into this batch slot each frame
   * instead, and the one batch mesh draws them all. Undefined ⇒ the
   * per-mesh path (the oracle) renders this stroke's own mesh.
   */
  slot?: BatchSlot
  /**
   * READS (params.ts): the params the last sync of this stroke read, the
   * epoch it read them at, and what that sync left — so a stroke none of
   * whose params has changed since is skipped whole (see sync). Undefined
   * until synced, or when its reading is opaque (an epoch memo) or long.
   */
  reads?: Reads
  readAt?: number
  /** Last sync's width, glow lift, line version and the visibility style() left. */
  lastWidth?: number
  lastLift?: number
  lastLineVersion?: number
  lastShown?: boolean
  /** The list READS refills for this stroke (reused frame to frame). */
  readsBuf?: Reads
  /** READS adaptivity: tracking misses in a row, and the sync count until which it rests. */
  readsMisses?: number
  readsOffUntil?: number
  /** The run this stroke's slot lives in (instancing on). */
  batch?: RibbonBatch
  look: StyleParams
}

/**
 * A stroke's style params, captured once at attach (perf F) — the same
 * Params `holon.creation` etc. return, since a built holon is settled —
 * so sync() reads them directly every frame instead of through the Holon
 * proxy's get-trap, five-plus times per stroke.
 */
interface StyleParams {
  creation: Param<number>
  /** The holon's opacity as SEEN — its own fade times its inherited certainty (certainty.ts). */
  opacity: Readable<number>
  tint: Param<Color>
  stroke: Param<number>
  erasure: Param<number>
  fillOpacity: Param<number>
  fillFalloff: Param<number>
  fillFalloffRadius: Param<number>
}

/** A holon's seen opacity (certainty.ts), resolved once — for the bindings that hold no StyleParams. */
const SEEN = new WeakMap<Holon, Readable<number>>()
const seenOf = (holon: Holon): Readable<number> => {
  let seen = SEEN.get(holon)
  if (!seen) SEEN.set(holon, (seen = seenOpacity(holon)))
  return seen
}

const styleOf = (holon: Stroke): StyleParams => ({
  creation: holon.creation,
  opacity: seenOpacity(holon),
  tint: holon.tint,
  stroke: holon.stroke,
  erasure: holon.erasure,
  fillOpacity: holon.fillOpacity,
  fillFalloff: holon.fillFalloff,
  fillFalloffRadius: holon.fillFalloffRadius,
})

/** A filled flat shape (Ellipse with filled=true): creation = fill-in. */
interface FillBinding {
  holon: Ellipse | Rectangle
  fill: FillShape
  sig: ShapeSig
  look: StyleParams
  /** Drawn with the radial-light material (Stroke.fillFalloff). */
  gradient: boolean
}

/**
 * The interior wash of a shape that is STILL A STROKE — pydeation's
 * filler material, which sits behind the sketch line rather than
 * replacing it (Stroke.fillOpacity). Distinct from FillBinding on both
 * counts: the holon keeps its ribbon, and the wash is driven by
 * `fillOpacity`, not by `creation`.
 */
interface WashBinding {
  holon: Stroke
  fill: FillShape
  sig: ShapeSig
  look: StyleParams
  /** Drawn with the radial-light material (Stroke.fillFalloff). */
  gradient: boolean
}

/**
 * An arrowhead riding a Line endpoint — a small filled triangle sized
 * from the stroke width (the S&T end-cap look, ~5×w long by ~4.4×w
 * wide, calibrated against refs/video-01/frame_084.png). It fades in
 * as the draw front arrives at its endpoint and out as the erase
 * front consumes it.
 */
interface ArrowBinding {
  holon: Line
  fill: FillShape
  atStart: boolean
  shapeKey: number[]
  /** The Line's own group — the frame the cap polygon is stated in. */
  group: THREE.Group
  /**
   * The ribbon binding of the very line this cap belongs to. The head
   * rides the PEN, and the pen's position is the screen-arc
   * reparametrisation of `creation` (screen-arc.ts), not `creation`
   * itself — so the cap has to ask the same question the stroke asks,
   * of the same binding, or it drifts off the front exactly where the
   * two parametrisations disagree most: a line most of whose world
   * length lies off-frame. Undefined only if the line never got a
   * ribbon (an empty polyline at mount).
   */
  stroke?: StrokeBinding
}

interface GroupBinding {
  holon: Holon
  group: THREE.Group
  /**
   * The holon's transform params — x, y, z, p, h, b, scale, in the order
   * sync() has always read them (a derived reading may compute lazily on
   * first read, so the order is kept). Captured once at attach so the
   * per-frame loop reads each Param directly instead of through the Holon
   * proxy's get-trap — ~41k trap calls a frame on TheWall. A built holon
   * is settled, so these are the very Params `holon.x` etc. return.
   */
  transform: readonly Param<number>[]
  /**
   * The values last composed into `group.matrix`, NaN until the first
   * sync. The group does not auto-update its matrix (perf E): sync()
   * composes it only when one of these changes, so the static majority of
   * a scene's groups costs a compare a frame, not a compose + trig.
   */
  applied: Float64Array
  /**
   * Set by any of the transform params changing (Param.watch) — so a group
   * none of whose params is bound or changed since its last read is
   * skipped without reading any of them (perf J — most of a song's ~32k
   * groups, every frame). Starts true: the first sync reads everything.
   */
  dirty: boolean
  /** Is any transform param bound (its reading may change unwritten)? Re-read whenever dirty. */
  anyBound: boolean
}

/**
 * A cylinder as FIVE strokes — the contour graph S&T actually walks.
 *
 * Two mantle silhouette generators, recomputed analytically each frame
 * from the camera position in cylinder-local space (render/silhouette.ts),
 * and two cap circles that the generators cut. The cut is what makes five
 * rather than four: the generators land ON the caps, so on the contour
 * graph each cap is two edges, and S&T's stroke connection then decides
 * which of those edges chain into one stroke and which stand alone.
 *
 * Which cap splits is CAMERA-RELATIVE, not local-axis-relative — see the
 * derivation on syncCylinder. The nearer cap is the one whose two arcs
 * are strokes in their own right; the farther cap survives as one closed
 * loop.
 */
interface CylinderBinding {
  holon: Cylinder
  group: THREE.Group
  /** The FAR cap, whole: one closed loop starting on generator A. */
  farCap: RibbonStroke
  /** The NEAR cap's camera-facing arc — the first ink of the whole draw. */
  nearFront: RibbonStroke
  /** The NEAR cap's away-facing arc — the pen returns for it near the end. */
  nearBack: RibbonStroke
  lineA: RibbonStroke
  lineB: RibbonStroke
  /** Cap geometry cache key — the caps' seams ride the silhouette, so the
   *  generator azimuths are part of the key, not only the size. Sign of
   *  the near cap's local y is in it too: a cylinder that turns past
   *  edge-on swaps which cap is near, and the seams follow. */
  capRadius: number
  capHeight: number
  thetaA: number
  thetaB: number
  nearY: number
}

const basePolyline = (holon: Stroke): THREE.Vector3[] | undefined => {
  if (holon instanceof Circle) {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= STROKE_SEGMENTS; i++) {
      const a = (i / STROKE_SEGMENTS) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * holon.radius.value, Math.sin(a) * holon.radius.value, 0))
    }
    return pts
  }
  if (holon instanceof Square) {
    const s = holon.size.value / 2
    return [
      new THREE.Vector3(-s, -s, 0),
      new THREE.Vector3(s, -s, 0),
      new THREE.Vector3(s, s, 0),
      new THREE.Vector3(-s, s, 0),
      new THREE.Vector3(-s, -s, 0),
    ]
  }
  if (holon instanceof Polygon) {
    const pts: THREE.Vector3[] = []
    const n = holon.sides.value
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2 + holon.phase.value
      pts.push(new THREE.Vector3(Math.cos(a) * holon.radius.value, Math.sin(a) * holon.radius.value, 0))
    }
    return pts
  }
  if (holon instanceof Arc) {
    const pts: THREE.Vector3[] = []
    const a0 = holon.startAngle.value
    const a1 = holon.endAngle.value
    for (let i = 0; i <= STROKE_SEGMENTS; i++) {
      const a = a0 + (i / STROKE_SEGMENTS) * (a1 - a0)
      pts.push(new THREE.Vector3(Math.cos(a) * holon.radius.value, Math.sin(a) * holon.radius.value, 0))
    }
    return pts
  }
  if (holon instanceof AnnularSector) {
    // No outline of its own: the ring's four pieces are its CHILDREN,
    // each drawn by its own pen (parts/primitives.ts: AnnularSector).
    // The parent contributes only the wash.
    return undefined
  }
  if (holon instanceof Rectangle) {
    if (holon.filled.value) return undefined // rendered by its FillShape
    return rectanglePolyline(holon.width.value, holon.height.value, holon.rounding.value).map(
      (p) => new THREE.Vector3(p.x, p.y, p.z),
    )
  }
  if (holon instanceof Ellipse) {
    if (holon.filled.value) return undefined // rendered by its FillShape
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= STROKE_SEGMENTS; i++) {
      const a = (i / STROKE_SEGMENTS) * Math.PI * 2
      pts.push(
        new THREE.Vector3(Math.cos(a) * holon.radiusX.value, Math.sin(a) * holon.radiusY.value, 0),
      )
    }
    return pts
  }
  if (holon instanceof Line) {
    if (holon.points.length < 2) return undefined
    return holon.points.map((p) => new THREE.Vector3(p.x, p.y, p.z))
  }
  return undefined
}

/**
 * The wash geometry for a stroke that carries a `fillOpacity` — the
 * interior its filler material covers, as triangles.
 *
 * Only the shapes the corpus actually fills are here, and each states
 * its own triangulation because fill.ts's default fan is a CONVEX
 * assumption: an annular sector needs a strip between its two arcs, a
 * circle or an ellipse fans correctly from its centre. A shape with no
 * entry simply never washes — an absent interior, not an error.
 */
const washGeometry = (
  holon: Stroke,
): { points: readonly Vec3Like[]; triangles?: readonly number[] } | undefined => {
  if (holon instanceof AnnularSector) {
    const { points, indices } = annularSectorFill(
      holon.radius.value,
      holon.innerRadius.value,
      holon.startAngle.value,
      holon.endAngle.value,
    )
    return { points, triangles: indices }
  }
  if (holon instanceof Circle) return { points: ellipsePolygon(holon.radius.value, holon.radius.value) }
  if (holon instanceof Ellipse && !holon.filled.value)
    return { points: ellipsePolygon(holon.radiusX.value, holon.radiusY.value) }
  if (holon instanceof Rectangle && !holon.filled.value)
    // A rectangle is CONVEX, so fill.ts's default fan needs no
    // triangulation of its own — and `rectanglePolyline` opens at the
    // midpoint of the bottom edge rather than at a corner, which the fan
    // does not care about (a fan from any vertex of a convex loop is
    // valid). Verified rather than assumed: fanning that polyline from
    // its first point gives exactly 90000 for a 300×300, and the rounded
    // case lands within 0.05% of w·h − (4−π)r², the residual being the
    // corner arcs' polygonal approximation. Its duplicated closing point
    // contributes one zero-area triangle.
    //
    // The `!filled` guard mirrors the Ellipse branch above and means the
    // same thing: `filled` is a CONSTRUCTION flag that renders the shape
    // AS a fill (Rectangle.filled, the FoldableCube contract) and such a
    // rectangle already has its FillShape, so a wash would be a second
    // one. `fillOpacity` is the wash BEHIND a shape that stays a stroke
    // — pydeation's `solid=True`. Scene01 states exactly that
    // distinction at its own rectangle: "`solid=True` is a fill state,
    // not a construction flag: the shapes arrive already flooded."
    return {
      points: rectanglePolyline(holon.width.value, holon.height.value, holon.rounding.value),
    }
  if (holon instanceof Line) {
    // A Line's own polyline IS its interior when it happens to close on
    // itself — which is what a MORPHING outline is (geometry/morph.ts:
    // MorphShape derives a Line whose points run from one closed shape
    // to another). Scene01's six morphs are between shapes that are
    // already flooded solid at both ends, so the blend has to carry a
    // wash the whole way across or the discs read as hollow rings
    // halfway through; refs/pitch/origins/frames5/f_00190 shows them
    // solid.
    //
    // The gate is the geometry, not the class: an OPEN line (an axis, a
    // sight line, a grid rule) has no interior and gets none.
    //
    // The fan is struck from the CENTROID rather than from the loop's
    // own first point — `ellipsePolygon` does the same, and for the same
    // reason. fill.ts's default fan pivots on pts[0], which is correct
    // only for a shape star-shaped about that particular vertex; a
    // centroid pivot is correct for any convex loop, which is what a
    // blend between two convex shapes is (a convex combination of
    // corresponding points preserves convexity). Scene01's morphs are
    // circle→circle and circle→rectangle, so this covers them exactly.
    //
    // THE PRECONDITION IS CONVEXITY, AND IT IS NARROW (P-5). A centroid
    // fan paints triangles OUTSIDE a concave silhouette, so this branch
    // is correct only for the convex loops named above. Anything whose
    // outline can be concave — a traced icon, a Keynote shape library
    // glyph — must reach `drawingSubpaths` and the even-odd scanline
    // instead, which is why that gate now admits a single child. See its
    // note; the deck's head icon (61 points, both cross-product signs)
    // is the case that forced the distinction.
    const pts = holon.points
    if (pts.length < 4) return undefined
    const a = pts[0]!
    const b = pts[pts.length - 1]!
    if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) >= 1e-6) return undefined
    const loop = pts.slice(0, -1)
    const c = loop.reduce(
      (acc, p) => ({ x: acc.x + p.x / loop.length, y: acc.y + p.y / loop.length, z: acc.z + p.z / loop.length }),
      { x: 0, y: 0, z: 0 },
    )
    return { points: [c, ...pts] }
  }
  return undefined
}

/** Is this polyline a CLOSED loop — its last point back on its first? */
const closesOnItself = (pts: readonly Vec3Like[]): boolean => {
  if (pts.length < 4) return false
  const a = pts[0]!
  const b = pts[pts.length - 1]!
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) < 1e-6
}

/**
 * A DRAWING's closed subpaths, when a stroke is composed of several —
 * which is what a Sketch is: one `Line` child per subpath of the source
 * SVG (vocabulary/Sketch/Sketch.ts's `compose`).
 *
 * Such a stroke washes as ONE surface across all of them together, and
 * the reason is `AnnularSector`'s reason stated at its own definition:
 * *the wash is one surface, not four*. Here it is not merely tidier but
 * necessary — a gear's rim and its inner circle are two subpaths, and
 * the hole between them exists only in their relationship. Filled one at
 * a time they are two discs and the gear floods to its centre, which is
 * where 88.6% of Scene03's excess ink sat (DECISIONS 2026-09-07).
 *
 * The gate is the GEOMETRY, as it is for the single closed Line above:
 * every child must be a closed Line. A stroke composed of open children
 * (an Axes' two rules, an AnnularSector's arcs and edges) has no
 * interior to speak of and gets none, and a stroke with no children at
 * all is not a drawing.
 *
 * ONE CHILD IS A DRAWING TOO (P-5, ruled 2026-09-08). This gate was
 * `< 2`, which sent a single-loop parent to `washGeometry`'s centroid
 * fan instead — correct only for a CONVEX loop (see its note), and
 * silently producing NO MESH AT ALL for a holon that class does not
 * recognise. The PL02 deck is the case: 21 of its 22 filled drawables
 * are single closed loops, none of them instantiated an occluder, and
 * deck slide 23 drew 273 saturated blue and red pixels the reference
 * does not have — a lower copy of a composition that the upper copy's
 * black-filled heads are supposed to hide. Even-odd handles one loop as
 * correctly as several (it is a scanline, not a fan), so admitting the
 * single-child case is right on the geometry rather than a concession:
 * a concave silhouette has an interior that no fan can express.
 */
const drawingSubpaths = (holon: Stroke): Vec3Like[][] | undefined => {
  const parts = holon.parts
  if (parts.length < 1) return undefined
  const loops: Vec3Like[][] = []
  for (const part of parts) {
    if (!(part instanceof Line)) return undefined
    if (!closesOnItself(part.points)) return undefined
    loops.push(part.points.slice())
  }
  return loops
}

/**
 * A drawing wash's geometry-regen signature, from its subpath CHILDREN
 * rather than its own (absent) polyline. A drawing's subpaths are all
 * Lines (`drawingSubpaths` requires it), each carrying a `geomVersion`
 * that bumps iff its points change — so the sum of those versions plus
 * the child count is an O(childCount) integer signature that changes iff
 * any subpath's geometry changed or a subpath appeared/vanished, in place
 * of flattening every subpath's every point each frame. A child that
 * OPENS (stops being a closed loop) changed its points, so its version
 * bumped and the sum caught it before it left the set.
 */
const drawingSig = (holon: Stroke): ShapeSig => {
  const parts = holon.parts
  let sum = 0
  let count = 0
  for (const part of parts) {
    if (part instanceof Line) {
      void part.points // force a derived recompute before reading the version
      sum += part.geomVersion
      count++
    }
  }
  return { version: sum, drawStart: count, reversed: 0, key: EMPTY_KEY }
}

/** Has a drawing wash's subpath geometry changed? Updates `prev` in place. */
const drawingSigChanged = (holon: Stroke, prev: ShapeSig): boolean => {
  const sig = drawingSig(holon)
  if (sig.version === prev.version && sig.drawStart === prev.drawStart) return false
  prev.version = sig.version
  prev.drawStart = sig.drawStart
  return true
}

/**
 * The stroke's outline as the pen actually walks it: the primitive's own
 * geometry, re-phased to its `drawStart` and wound to its `drawReversed`
 * (parts/index.ts: rephasePolyline). Open strokes pass through untouched.
 */
export const polyline = (holon: Stroke): THREE.Vector3[] | undefined => {
  const pts = basePolyline(holon)
  if (!pts) return undefined
  const phase = holon.drawStart.value
  const reversed = holon.drawReversed.value
  if (phase === 0 && !reversed) return pts
  return rephasePolyline(pts, phase, reversed).map((p) => new THREE.Vector3(p.x, p.y, p.z))
}

/**
 * The arrowhead triangle for one Line endpoint, in the line's local
 * space, pointing outward along the end segment.
 *
 * Sketch & Toon states the cap in its OWN fields, not as a multiple of
 * the rendered line:
 *
 *   sketch_mat[c4d.OUTLINEMAT_ENDCAP_WIDTH]  = 7
 *   sketch_mat[c4d.OUTLINEMAT_ENDCAP_HEIGHT] = 5
 *      — refs/pydeation-legacy/object/object.py:215-218
 *
 * Those 7 and 5 are the same PIXEL UNITS the thickness is stated in
 * (scene.py's PIXELUNITS_BASEH = 700), and they are HALF-extents, so the
 * drawn cap is 2*7 pixel units across and 2*5 pixel units long. That is
 * `arrowSize` — one pixel unit in rendered pixels, frameHeight / 700 —
 * times the two factors below.
 *
 * They live in a field of their own, which is the whole point: the cap
 * does NOT carry `OUTLINEMAT_THICKNESS_DISTANCE`'s 0.6 attenuation. That
 * strength multiplies the THICKNESS field alone, so when the palette
 * finally applied it (c0a9cc6) every arrowhead in the reproduction
 * shrank by 0.6 along with the lines — while the reference's did not.
 *
 * Measured on refs/video-01/frames5/f0428, where S04's gradient axis
 * runs dead horizontal and the head is unforeshortened (linear light,
 * area/peak per column): shaft 2.90px, head base 14.95px at x = 961
 * tapering linearly to zero at x = 971.6 — a clean triangle 10.9px long
 * and 14.95px across. This mapping predicts 2*5*720/700 = 10.29 and
 * 2*7*720/700 = 14.40; both readings sit ~0.5px high, which is one AA
 * skirt on each measured extent. The old mapping (2.5 and 1.75 STROKE
 * widths) fitted the same numbers only while the stroke was still
 * unattenuated at 5.14px — a coincidence of 5/2 and 7/2, and the reason
 * it survived so long.
 *
 * The cap is a SCREEN-SPACE object, exactly like the stroke width: S&T
 * draws it at a constant pixel size however far away the line runs. So
 * the polygon is world geometry sized per frame from the projected scale
 * at the pen (`syncArrow`), not from a fixed px-per-unit constant. Scene
 * 05 is what forced this: its axes recede to 0.85 px/world-unit, where a
 * cap sized for S04's 1.28 read barely wider than the line.
 */
/** S&T cap length, in pixel units: 2 * ENDCAP_HEIGHT. */
const ARROW_LENGTH_FACTOR = 10
/** S&T cap half-width, in pixel units: ENDCAP_WIDTH (the half-extent). */
const ARROW_HALF_WIDTH_FACTOR = 7

/**
 * Walk a polyline to `progress` of its arc length, returning the point
 * there and the unit direction of travel at it.
 */
const walkTo = (
  points: readonly Vec3Like[],
  progress: number,
): { tip: THREE.Vector3; dir: THREE.Vector3 } | undefined => {
  const vec = (p: Vec3Like) => new THREE.Vector3(p.x, p.y, p.z)
  const seg: number[] = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const d = vec(points[i + 1]!).sub(vec(points[i]!)).length()
    seg.push(d)
    total += d
  }
  if (total <= 0) return undefined
  let target = progress * total
  let i = 0
  while (i < seg.length - 1 && target > seg[i]!) {
    target -= seg[i]!
    i++
  }
  const a = vec(points[i]!)
  const b = vec(points[i + 1]!)
  const delta = b.clone().sub(a)
  if (delta.lengthSq() <= 1e-12) return undefined
  const u = seg[i]! > 0 ? Math.min(1, target / seg[i]!) : 0
  return { tip: a.clone().addScaledVector(delta, u), dir: delta.normalize() }
}
const arrowPolygon = (
  points: readonly Vec3Like[],
  atStart: boolean,
  /** One S&T pixel unit in rendered pixels — `Line.arrowSize`. */
  unitPx: number,
  progress = 1,
  /** Local units per screen pixel ALONG the line — 1 keeps the cap in units. */
  unitsPerPixel = 1,
  /**
   * The view direction in the line's own local frame. The head must fan
   * out perpendicular to the line ON SCREEN, which is the direction
   * `dir × view` — for a line running away from the camera any other
   * choice foreshortens the head into the stroke, which is exactly how
   * S05's z-arm lost its arrowhead. Omitted, the head falls back to the
   * flat-scene assumption (perpendicular in the local xy plane).
   */
  viewLocal?: THREE.Vector3,
  /** Local units per screen pixel ACROSS it; defaults to the along reading. */
  unitsPerPixelAcross = unitsPerPixel,
): Vec3Like[] | undefined => {
  if (points.length < 2) return undefined
  const ordered = atStart ? [...points].reverse() : points
  // The head rides the PEN, not the endpoint: Sketch & Toon draws a
  // line-end cap on the stroke's current end, so while a line draws on,
  // its arrow travels with the front and only settles when the front
  // arrives. refs/video-01/frames5 f0419-f0427 track the S04 gradient's
  // head across x = 326, 377, 466, 577, 694, 805, 897, 952, 960 as the
  // line advances — always at the tip, never parked at the destination.
  const walked = walkTo(ordered, Math.min(1, Math.max(0, progress)))
  if (!walked) return undefined
  const { tip, dir } = walked
  const side = new THREE.Vector3()
  if (viewLocal) side.crossVectors(dir, viewLocal)
  if (side.lengthSq() < 1e-12) side.crossVectors(dir, new THREE.Vector3(0, 0, 1))
  if (side.lengthSq() < 1e-12) side.crossVectors(dir, new THREE.Vector3(0, 1, 0))
  side.normalize()
  // The endpoint is the BASE of the head; the apex sits beyond it.
  const length = unitPx * ARROW_LENGTH_FACTOR * unitsPerPixel
  const halfWidth = unitPx * ARROW_HALF_WIDTH_FACTOR * unitsPerPixelAcross
  const apex = tip.clone().addScaledVector(dir, length)
  const a = tip.clone().addScaledVector(side, halfWidth)
  const b = tip.clone().addScaledVector(side, -halfWidth)
  return [
    { x: apex.x, y: apex.y, z: apex.z },
    { x: a.x, y: a.y, z: a.z },
    { x: b.x, y: b.y, z: b.z },
  ]
}

/**
 * How many Stroke holons the built dream draws — the signal the "auto"
 * instancing threshold reads (a Stroke is exactly what becomes a ribbon
 * mesh in attach). A cheap pure walk over the already-built tree; every
 * scene pays it once at mount.
 */
const countStrokes = (dream: Dream): number => {
  let n = 0
  for (const root of dream.roots) for (const h of root.walk()) if (h instanceof Stroke) n++
  return n
}

/**
 * RESIDENCY (song.ts) — a song's chapters as the host mounts them: each
 * chapter's roots, the chapters to keep mounted at t, and the roots no
 * single chapter owns (a song's own holon, or one two chapters share),
 * which stay mounted throughout. Undefined for anything that is not a
 * song (duck-typed, as liveRoots and layerFades are).
 */
interface Residency {
  /** How many chapters the song has. */
  count: number
  /**
   * Chapter i's roots as the song holds them NOW. A lazy song (song.ts LAZY
   * CONSTRUCTION) constructs the chapter on asking, and hands back a new
   * tree once it has dropped the old one — a mount of the old tree is stale.
   */
  rootsOf: (i: number) => readonly Holon[]
  residentAt: (t: number) => readonly number[]
  always: readonly Holon[]
}

const residencyOf = (dream: Dream): Residency | undefined => {
  const song = dream as unknown as {
    residentAt?: (t: number) => readonly number[]
    chapters?: readonly { dream: Dream }[]
    lazy?: boolean
    ownRoots?: readonly Holon[]
    chapterRoots?: (i: number) => readonly Holon[]
  }
  if (typeof song.residentAt !== "function" || !song.chapters) return undefined
  // A lazy song's chapters construct their own trees: none shares a root.
  if (song.lazy && song.ownRoots && typeof song.chapterRoots === "function") {
    return {
      count: song.chapters.length,
      rootsOf: (i) => song.chapterRoots!.call(dream, i),
      residentAt: (t) => song.residentAt!.call(dream, t),
      always: song.ownRoots,
    }
  }
  const chapters = song.chapters.map((c) => c.dream.roots)
  const owners = new Map<Holon, number>()
  for (const roots of chapters) for (const r of roots) owners.set(r, (owners.get(r) ?? 0) + 1)
  const shared = new Set([...owners].filter(([, n]) => n > 1).map(([r]) => r))
  const owned = chapters.map((roots) => roots.filter((r) => !shared.has(r)))
  return {
    count: owned.length,
    rootsOf: (i) => owned[i]!,
    residentAt: (t) => song.residentAt!.call(dream, t),
    always: dream.roots.filter((r) => !owners.has(r) || shared.has(r)),
  }
}

/** A mounted chapter (RESIDENCY): its root groups, its text layout, its warm-up. */
interface ChapterMount {
  roots: readonly Holon[]
  /** How many of `roots` are begun — a chapter waiting for its cut mounts a slice a frame. */
  attached: number
  /** Holons still to attach (with their parent group and root), depth-first from the top. */
  queue: [Holon, THREE.Object3D, Holon][]
  groups: THREE.Object3D[]
  /** The next composite order this chapter claims. */
  order: number
  /** Every attached Text's layout. */
  texts: Promise<void>[]
  /** Settles once every attached Text has laid out. */
  ready: Promise<void>
  laidOut: boolean
  /** The background shader/render-object builds started so far. */
  warm?: Promise<void>
}

/** What residency needs of three's RenderObject (renderers/common/RenderObject.js). */
interface RenderObjectLike {
  material: THREE.EventDispatcher<object>
  geometry: THREE.EventDispatcher<object>
  _sourceMaterial: THREE.EventDispatcher<object> | null
  onMaterialDispose: () => void
  onGeometryDispose: () => void
  onDispose: () => void
}

/**
 * RenderObject.dispose(), for many at once. Each one listens on its
 * material, and a song's materials are SHARED (ribbon.ts, fill.ts): one
 * removeEventListener at a time is an indexOf + splice on a listener list
 * as long as everything ever drawn — quadratic, ~1 s to release a chapter.
 * So each shared list is filtered once, then the rest of dispose() runs.
 */
const releaseRenderObjects = (ros: readonly RenderObjectLike[]): void => {
  if (ros.length === 0) return
  const off = new Map<THREE.EventDispatcher<object>, Set<() => void>>()
  const drop = (m: THREE.EventDispatcher<object> | null, fn: () => void) => {
    if (!m) return
    let fns = off.get(m)
    if (!fns) off.set(m, (fns = new Set()))
    fns.add(fn)
  }
  for (const ro of ros) {
    drop(ro.material, ro.onMaterialDispose)
    drop(ro._sourceMaterial, ro.onMaterialDispose)
  }
  for (const [m, fns] of off) {
    const listeners = (m as unknown as { _listeners?: Record<string, (() => void)[]> })._listeners
    const list = listeners?.dispose
    if (!list) continue
    let k = 0
    for (const fn of list) if (!fns.has(fn)) list[k++] = fn
    list.length = k
  }
  for (const ro of ros) {
    ro.geometry.removeEventListener("dispose" as never, ro.onGeometryDispose as never)
    ro.onDispose()
  }
}

/** Is every holon of a mounting chapter attached? */
const complete = (mount: ChapterMount): boolean => mount.attached === mount.roots.length && mount.queue.length === 0

/** The params whose change requires re-sampling the polyline. */
const shapeKey = (holon: Stroke): number[] => {
  const phase = [holon.drawStart.value, holon.drawReversed.value ? 1 : 0]
  if (holon instanceof Circle) return [holon.radius.value, ...phase]
  if (holon instanceof Square) return [holon.size.value, ...phase]
  if (holon instanceof Polygon)
    return [holon.radius.value, holon.sides.value, holon.phase.value, ...phase]
  if (holon instanceof Arc)
    return [holon.radius.value, holon.startAngle.value, holon.endAngle.value]
  if (holon instanceof AnnularSector)
    return [
      holon.radius.value,
      holon.innerRadius.value,
      holon.startAngle.value,
      holon.endAngle.value,
      ...phase,
    ]
  if (holon instanceof Rectangle)
    return [holon.width.value, holon.height.value, holon.rounding.value, ...phase]
  if (holon instanceof Ellipse) return [holon.radiusX.value, holon.radiusY.value, ...phase]
  if (holon instanceof Line) return holon.points.flatMap((p) => [p.x, p.y, p.z])
  return []
}

/** Arrow geometry depends on the endpoints and the stroke width. */
const arrowKey = (holon: Line): number[] => [...shapeKey(holon), holon.arrowSize.value]

/**
 * A stroke's geometry-regen signature (see ShapeSig). Cheap and
 * allocation-free on the Line fast path — the case that dominated
 * `sync()`. For a Line the version stands in for the whole polyline, so
 * this reads `holon.points` FIRST: a derived Line's `points` getter is
 * what recomputes its memo and bumps `geomVersion`, so the version is
 * only current AFTER the getter has run for this frame (primitives.ts,
 * curves.ts). The read is cheap — a derived Line compares its small
 * sourceKey (anchor positions / a few params), never the many-point
 * output — and a static Line's read is a plain backing fetch.
 */
const freshSig = (holon: Stroke): ShapeSig => {
  if (holon instanceof Line) {
    void holon.points // force a derived recompute, so geomVersion is current
    return {
      version: holon.geomVersion,
      drawStart: holon.drawStart.value,
      reversed: holon.drawReversed.value ? 1 : 0,
      key: EMPTY_KEY,
      line: rawHolon(holon),
      drawStartParam: holon.drawStart,
      reversedParam: holon.drawReversed,
    }
  }
  // Parametric shapes: no version (a bound Param would miss it) — their
  // few Params, read directly and compared in place (perf I-3).
  const { params, reversedAt } = shapeParams(holon)
  const vals = new Float64Array(params.length)
  for (let i = 0; i < params.length; i++) {
    const v = params[i]!.value
    vals[i] = i === reversedAt ? (v ? 1 : 0) : (v as number)
  }
  return { version: 0, drawStart: 0, reversed: 0, key: EMPTY_KEY, params, vals, reversedAt }
}

/**
 * The Params `shapeKey` reads, in its order and with its class dispatch —
 * so comparing them value by value is exactly comparing the key arrays.
 */
const shapeParams = (
  holon: Stroke,
): { params: readonly { readonly value: unknown }[]; reversedAt: number } => {
  const phase = [holon.drawStart, holon.drawReversed]
  const withPhase = (...shape: { readonly value: unknown }[]) => ({
    params: [...shape, ...phase],
    reversedAt: shape.length + 1,
  })
  if (holon instanceof Circle) return withPhase(holon.radius)
  if (holon instanceof Square) return withPhase(holon.size)
  if (holon instanceof Polygon) return withPhase(holon.radius, holon.sides, holon.phase)
  if (holon instanceof Arc)
    return { params: [holon.radius, holon.startAngle, holon.endAngle], reversedAt: -1 }
  if (holon instanceof AnnularSector)
    return withPhase(holon.radius, holon.innerRadius, holon.startAngle, holon.endAngle)
  if (holon instanceof Rectangle) return withPhase(holon.width, holon.height, holon.rounding)
  if (holon instanceof Ellipse) return withPhase(holon.radiusX, holon.radiusY)
  return { params: [], reversedAt: -1 }
}

/** Shared empty array for the Line fast path — its `key` is never read. */
const EMPTY_KEY: number[] = []

/**
 * Has the stroke's geometry changed since `prev`? Updates `prev` in place
 * and returns whether a regen is due. The Line path is an O(1) triple
 * compare (version + two phase scalars); the parametric path compares the
 * small value array. A superset of the old array comparison in every
 * case, so no stale geometry is possible.
 */
/** unitsPerPixelAt's scratch (one host renders at a time; nothing holds these across a call). */
const UPP = {
  world: new THREE.Vector3(),
  basis: new THREE.Matrix3(),
  sideWorld: new THREE.Vector3(),
  forward: new THREE.Vector3(),
  up: new THREE.Vector3(0, 1, 0),
  a: new THREE.Vector3(),
  b: new THREE.Vector3(),
  scale: new THREE.Vector3(),
}
/** A group's own origin, read only. */
const ORIGIN = new THREE.Vector3()

/** READS: has none of these params changed since `at`? */
const unchangedSince = (deps: readonly Param<ParamValue>[], n: number, at: number): boolean => {
  for (let i = 0; i < n; i++) if (deps[i]!.changedAt > at) return false
  return true
}

const sigChanged = (holon: Stroke, prev: ShapeSig): boolean => {
  if (prev.line) {
    const line = prev.line
    void line.points // recompute-if-needed before reading the version
    const version = line.geomVersion
    const drawStart = prev.drawStartParam!.value
    const reversed = prev.reversedParam!.value ? 1 : 0
    if (version === prev.version && drawStart === prev.drawStart && reversed === prev.reversed) {
      return false
    }
    prev.version = version
    prev.drawStart = drawStart
    prev.reversed = reversed
    return true
  }
  // Parametric: the same `===` element compare the key arrays had (a NaN
  // still always reads as a change), without the per-frame array.
  const params = prev.params!
  const vals = prev.vals!
  const reversedAt = prev.reversedAt!
  // One read per Param, as shapeKey made; storing as we go is the same as
  // keeping the old key when nothing changed (=== can't tell the stored
  // value from the one it replaces).
  let changed = false
  for (let i = 0; i < params.length; i++) {
    const raw = params[i]!.value
    const v = i === reversedAt ? (raw ? 1 : 0) : (raw as number)
    if (!(v === vals[i])) changed = true
    vals[i] = v
  }
  return changed
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/**
 * The scene graph's STRUCTURE epoch: bumped whenever any Object3D gains or
 * loses a child (add/remove — attach and clear go through them). The
 * targeted settle (ThreeHost.settleScene) trusts its index of the graph
 * only while this is unchanged; any reparenting falls back to three's own
 * full traversal and re-indexes. Patched once, page-wide: a counter bump,
 * nothing else changes.
 */
let structureEpoch = 0
{
  const proto = THREE.Object3D.prototype as unknown as {
    add: (...o: THREE.Object3D[]) => THREE.Object3D
    remove: (...o: THREE.Object3D[]) => THREE.Object3D
    __dtStructure?: boolean
  }
  if (!proto.__dtStructure) {
    proto.__dtStructure = true
    const add = proto.add
    const remove = proto.remove
    proto.add = function (this: THREE.Object3D, ...o: THREE.Object3D[]) {
      structureEpoch++
      return add.apply(this, o)
    }
    proto.remove = function (this: THREE.Object3D, ...o: THREE.Object3D[]) {
      structureEpoch++
      return remove.apply(this, o)
    }
  }
}

/** A tint lifted toward white by `amount` — the hover glow's brightness. */
const liftTint = (tint: Color, amount: number): Color =>
  amount <= 0
    ? tint
    : {
        r: tint.r + (1 - tint.r) * amount,
        g: tint.g + (1 - tint.g) * amount,
        b: tint.b + (1 - tint.b) * amount,
      }

/** Run `fn` when the main thread is idle (soon, at the latest). */
const whenIdle = (fn: () => void): void => {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  if (ric) ric(fn, { timeout: 250 })
  else setTimeout(fn, 0)
}

export class ThreeHost {
  readonly renderer: THREE.WebGPURenderer
  readonly scene: THREE.Scene
  /** The active camera — whichever projection the observer currently asks for. */
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  private readonly perspCamera: THREE.PerspectiveCamera
  private readonly orthoCamera: THREE.OrthographicCamera
  readonly dream: Dream
  private readonly groups: GroupBinding[] = []
  private readonly strokes: StrokeBinding[] = []
  private readonly cylinders: CylinderBinding[] = []
  private readonly fills: FillBinding[] = []
  private readonly washes: WashBinding[] = []
  /**
   * The echo clouds of uncertain leaves (render/superposition.ts), synced
   * in the view-dependent pass — their offsets are stated in pixels.
   * Empty unless some holon declares a certainty.
   */
  private readonly superpositions: { blur: RibbonSuperposition | FillSuperposition; group: THREE.Group }[] = []
  private readonly blurOf = new Map<RibbonStroke, RibbonSuperposition>()
  /** Triangle-mesh fills (parts/surface.ts) — sheets and depth-writing solids. */
  private readonly surfaces: { holon: Surface; fill: FillShape; version: number; gradient: boolean }[] = []
  /** Many-polyline strokes (parts/polylines.ts) — one ribbon each, no pen front. */
  private readonly polylines: { holon: Polylines; ribbon: RibbonStroke; version: number; look: StyleParams }[] = []
  /**
   * Drawings that wash as one even-odd surface across their subpaths —
   * a Sketch and anything else composed of closed Lines
   * (`drawingSubpaths`). Kept apart from `washes` because the geometry
   * that has to be watched is the CHILDREN's, not the holon's own.
   */
  private readonly drawingWashes: WashBinding[] = []
  /**
   * Subpaths whose interior is already painted by an ancestor's drawing
   * wash, and which must therefore not paint it again — the double
   * coverage that made every gear a disc.
   */
  private readonly washedByAncestor = new Set<Holon>()
  private readonly arrows: ArrowBinding[] = []
  /**
   * Text holons — glyph geometry, the Write domino's uniforms, and the
   * traced contours the draw phase strokes (render/text.ts). The group
   * is kept alongside because the contours' inset is stated in screen
   * pixels and has to be converted at this frame's projection.
   */
  private readonly texts: { binding: TextBinding; group: THREE.Object3D; holon: Holon }[] = []

  /** paramEpoch at the end of the last sync — a held frame's proof (see sync). */
  private syncedEpoch = Number.NaN

  /** Every attached holon's root — the chapter it belongs to, in a song. */
  private readonly rootOf = new Map<Holon, Holon>()
  /**
   * Perf I-4 — this frame's DORMANT roots: a DreamSong's chapters off
   * screen (song.ts liveRoots), gated to opacity 0 and drawing nothing.
   * Their per-stroke work (geometry check, pen metering, style, text,
   * cylinders, arrows, cull, batch) is skipped and their root groups are
   * hidden, so the render walk skips them too. Their GROUP transforms and
   * every settle still run — so every world matrix is exactly what it
   * was, and a chapter waking up meters its pens from the same previous-
   * frame matrices it always did. Undefined outside a song.
   */
  private dormant?: Set<Holon>

  /** Is this holon in a dormant chapter this frame? */
  private asleep(holon: Holon): boolean {
    return this.dormant !== undefined && this.dormant.has(this.rootOf.get(holon)!)
  }

  /** Bumped whenever the SET of dormant roots changes (not every frame). */
  private dormancyVersion = 0
  private readonly awakeCache = new WeakMap<readonly unknown[], { version: number; n: number; list: unknown[] }>()

  /**
   * The bindings of `list` that are awake, in their original order — the
   * exact set the per-binding `asleep` check used to let through, filtered
   * once per change of dormancy instead of asked of every binding every
   * frame (perf J: Web3 asked it of ~32k strokes a frame for ~1.6 ms). The
   * whole list outside a song.
   */
  private awake<B extends { holon: Holon }>(list: readonly B[], dozes = true): readonly B[] {
    if (this.dormant === undefined && (this.dozing === undefined || !dozes)) return list
    // Keyed on the list and its length too: bindings are appended after
    // mount (a text's contours), and a grown list must be filtered again.
    const hit = this.awakeCache.get(list)
    if (hit && hit.version === this.dormancyVersion && hit.n === list.length) return hit.list as B[]
    const dozing = dozes ? this.dozing : undefined
    const awake = list.filter((b) => !this.asleep(b.holon) && !dozing?.has(b.holon))
    this.awakeCache.set(list, { version: this.dormancyVersion, n: list.length, list: awake })
    return awake
  }

  /** Read the song's live roots; hide the dormant chapters' root groups. */
  private updateDormancy(): void {
    this.updateChapterDormancy()
    this.updatePresenceSleep()
  }

  private updateChapterDormancy(): void {
    const live = (this.dream as { liveRoots?: ReadonlySet<Holon> }).liveRoots
    if (!live) {
      this.dormant = undefined
      return
    }
    const roots = this.rootGroupMap()
    const dormant = new Set<Holon>()
    for (const [root, group] of roots) {
      const asleep = !live.has(root)
      if (asleep) dormant.add(root)
      group.visible = !asleep
    }
    const prev = this.dormant
    if (!prev || prev.size !== dormant.size || [...dormant].some((r) => !prev.has(r))) this.dormancyVersion++
    this.dormant = dormant
  }

  // --- PRESENCE SLEEP -------------------------------------------------------
  //
  // Residency in the state space: a subtree whose INHERITED presence
  // (certainty.ts) is exactly 0 draws nothing — every stroke, fill and
  // surface in it is styled with a seen opacity of 0 — so it dozes like a
  // dormant chapter: its per-binding sync (geometry checks, pen metering,
  // style, cull) is skipped and its group is hidden, so the render walk
  // skips it too. A hyperobject's other lenses and levels cost nothing.
  //
  // Exactness: a subtree falls asleep only on the SECOND frame its
  // presence reads 0 — the first is synced in full, so every mesh in it is
  // left styled invisible (what picking, glow and the batch read is
  // already exact) — and wakes on the very frame its presence rises above
  // 0, before that frame's draw: it is synced in full then, from geometry
  // signatures kept since it slept, like a chapter waking. Its group
  // transforms and the settle still run while it sleeps, so every world
  // matrix (bounds, picks, pen metering on waking) is what it would be.
  // Texts, cylinders and arrows keep syncing (they are few, and a Text's
  // layout must be current the moment it wakes).

  /** This frame's dozing holons (every holon under a presence of 0 for two frames); undefined when none. */
  private dozing?: Set<Holon>
  /** The holons that own a presence param, with their groups — gathered per structure. */
  private presenceOwners?: { holon: Holon; group: THREE.Object3D; params: Param<number>[] }[]
  private presenceOwnersFor = -1
  /** Bumped whenever holons are attached or released after mount (adopt, release, residency). */
  private bindingsEpoch = 0
  private presenceOwnersN = -1
  /** Owners whose presence read 0 last frame, and those asleep now (in owner order). */
  private zeroLastFrame = new Set<Holon>()
  private sleepingOwners: Holon[] = []

  private updatePresenceSleep(): void {
    if (this.presenceOwnersFor !== this.bindingsEpoch || this.presenceOwnersN !== this.groups.length) {
      this.presenceOwnersFor = this.bindingsEpoch
      this.presenceOwnersN = this.groups.length
      // The structure changed: everything wakes and is synced in full this
      // frame (and may fall asleep again from the next).
      if (this.sleepingOwners.length > 0) {
        const was = new Set(this.sleepingOwners)
        for (const { holon, group } of this.presenceOwners ?? []) {
          if (was.has(holon) && (!this.dormant || this.rootOf.get(holon) !== holon)) group.visible = true
        }
        this.sleepingOwners = []
        this.dozing = undefined
        this.dormancyVersion++
      }
      this.zeroLastFrame = new Set()
      const owners: { holon: Holon; group: THREE.Object3D; params: Param<number>[] }[] = []
      for (const { holon, group } of this.groups) {
        let params: Param<number>[] | undefined
        for (const p of holon.params.values()) if (isPresence(p)) (params ??= []).push(p)
        if (params) owners.push({ holon, group, params })
      }
      this.presenceOwners = owners
    }
    const owners = this.presenceOwners!
    if (owners.length === 0 && this.dozing === undefined) return
    const zero = new Set<Holon>()
    const sleeping: Holon[] = []
    for (const { holon, params } of owners) {
      if (this.asleep(holon) || !params.some((p) => p.value === 0)) continue
      zero.add(holon)
      if (this.zeroLastFrame.has(holon)) sleeping.push(holon)
    }
    this.zeroLastFrame = zero
    const prev = this.sleepingOwners
    if (sleeping.length === prev.length && sleeping.every((h, i) => h === prev[i])) return
    this.sleepingOwners = sleeping
    const asleepNow = new Set(sleeping)
    for (const { holon, group } of owners) {
      // A chapter root's visibility is the chapter's (updateChapterDormancy).
      if (asleepNow.has(holon)) group.visible = false
      else if (!this.dormant || this.rootOf.get(holon) !== holon) group.visible = true
    }
    if (sleeping.length === 0) this.dozing = undefined
    else {
      const dozing = new Set<Holon>()
      for (const owner of sleeping) for (const h of owner.walk()) dozing.add(h)
      this.dozing = dozing
    }
    this.dormancyVersion++
  }
  /** Fills stack over strokes and over earlier fills — see fill.ts. */
  private nextFillOrder = 1
  /**
   * The hover glow's targets (LOOPS.md: symbols glow on hover — the game
   * loop's first seed). Holons whose ink lifts toward white this frame,
   * with the subtree flattened once at highlight() time so sync() pays a
   * Set lookup per binding and nothing more. Empty means no glow, which
   * is the only state the demo page and the gauntlet can ever be in —
   * neither calls highlight(), so a capture cannot glow by construction.
   */
  private readonly highlighted = new Set<Holon>()
  private highlightAmount = 0
  /**
   * ATTENTION (src/glow.ts, render/glow.ts) — the interaction layer's
   * golden glow, by channel ("hover", "selection", …): each channel's
   * targets flattened to their subtrees, merged into one holon → amount
   * map. Empty unless someone calls attend(), which the demo page, the
   * gauntlet and every export never do — so no capture can glow unless a
   * scene AUTHORS a glow param.
   */
  private readonly attention = new Map<string, { roots: readonly Holon[]; holons: Set<Holon>; amount: number }>()
  private readonly attended = new Map<Holon, number>()
  /** Authored glows (`glow()` params), gathered once over the bound holons; undefined until first asked. */
  private authoredGlow?: Map<Holon, Readable<number>>
  private authoredGlowOver = -1
  /** The halos made so far, by the ink they surround (a ribbon or a fill mesh). */
  private readonly halos = new Map<object, StrokeHalo | FillHalo>()
  /** The halos lit last frame — the ones to put out when attention moves on. */
  private litHalos = new Set<StrokeHalo | FillHalo>()
  /** Where halos live: their own layer, so no binding's group ever measures them. */
  private glowLayer?: THREE.Group

  private constructor(dream: Dream, canvas: HTMLCanvasElement, useInstancedRibbons: boolean) {
    this.dream = dream
    this.instanced = useInstancedRibbons
    this.renderer = new THREE.WebGPURenderer({ canvas, antialias: true })
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000000)
    this.perspCamera = new THREE.PerspectiveCamera(53.13, 16 / 9, 1, 100000)
    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100000, 100000)
    this.camera = this.perspCamera
  }

  /**
   * Ribbon count at or above which instancing WINS (opt A). Below it the
   * per-mesh oracle is faster — the batch's pack + upload isn't earned back
   * (video01's ~572 strokes measured a net loss; TheWall's 3,776 a 49.8×
   * win). 1,000 sits safely in the gap: well above every light scene, well
   * below the walls. `useInstancedRibbons: "auto"` (the default for the demo
   * + editor) picks per-scene from the built dream's stroke count, so every
   * scene gets its optimal path with no manual flag.
   */
  static readonly INSTANCE_THRESHOLD = 1000

  /**
   * Batched ribbons draw in RUNS — one batch per stretch of attach order no
   * fill interrupts (attach), which is what keeps them composited exactly
   * as the per-mesh oracle composites them. Each run is a draw, so batching
   * only wins when runs are long. Measured 2026-10-04, GPU-complete frames:
   * TheWall, 3,776 strokes in 237 runs (~16 a run): batched 263/228/165/
   * 69 ms vs oracle 276/242/182 — a win; Web3, 17,648 strokes in 6,466
   * runs (~2.7 a run, its washes interleave everywhere): batched ~187 ms vs
   * oracle 65–79 — a loss (and one single batch, besides drawing strokes
   * over the fills that should cover them, was still slower than the
   * oracle). "auto" keeps the batch only at or above this many strokes per
   * run; otherwise the strokes simply render as themselves.
   */
  static readonly MIN_STROKES_PER_RUN = 8

  static async mount(
    dream: Dream,
    canvas: HTMLCanvasElement,
    opts: {
      useInstancedRibbons?: boolean | "auto"
      /** A DreamSong mounts only the chapters near the playhead (RESIDENCY below); false mounts every chapter. */
      residency?: boolean
      /** The song time the first frame will show — the chapters resident there are mounted before ready. */
      at?: number
    } = {},
  ): Promise<ThreeHost> {
    await Promise.resolve() // keep the signature async-stable
    // RESIDENCY: a song's chapters mount lazily. An explicit instancing
    // request keeps every chapter mounted (a batch's runs are laid out once).
    const resident = opts.residency !== false && opts.useInstancedRibbons !== true
    // A song mounted whole stands whole: a lazily constructed one (song.ts) builds every chapter.
    if (!resident) (dream as { eager?: () => void }).eager?.()
    dream.build()
    const residency = resident ? residencyOf(dream) : undefined
    // "auto": count the built dream's strokes and instance only where it wins.
    // An explicit boolean (the byte-identity harness) overrides the threshold.
    // A resident song never batches (no song's runs are long enough to win).
    const flag = residency
      ? false
      : opts.useInstancedRibbons === "auto" || opts.useInstancedRibbons === undefined
        ? countStrokes(dream) >= ThreeHost.INSTANCE_THRESHOLD
        : opts.useInstancedRibbons
    const host = new ThreeHost(dream, canvas, flag)
    await host.renderer.init()
    host.renderer.setSize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height, false)
    if (residency) return host.mountResident(residency, opts.at ?? 0)
    for (const root of dream.roots) host.attach(root, host.scene)
    // Clips (src/clip.ts): their ink switches to clipped materials; a batch
    // draws with one material, so a scene with clipped strokes renders them
    // as themselves.
    host.watchEchoes()
    host.premakeEchoes()
    // Only the clipped strokes leave their batch: they render as themselves
    // at their own orders, which within a run (ribbons only, MAX blending)
    // composites exactly as the batch would.
    if (host.gatherClips() && host.ribbonBatches.length > 0) host.unbatchClipped()
    // "auto" decides the second half here, once the runs exist: short runs
    // lose to the oracle, so the strokes go back to rendering themselves.
    const auto = opts.useInstancedRibbons === "auto" || opts.useInstancedRibbons === undefined
    const batched = host.strokes.reduce((n, b) => n + (b.batch ? 1 : 0), 0)
    if (
      host.ribbonBatches.length > 0 &&
      (batched === 0 || (auto && batched / host.ribbonBatches.length < ThreeHost.MIN_STROKES_PER_RUN))
    ) {
      host.unbatch()
    }
    // With instancing on, the batch meshes join the scene once every
    // stroke has claimed its slot.
    // Each batch already sits at its own run's renderOrder (see attach).
    for (const batch of host.ribbonBatches) host.scene.add(batch.mesh)
    host.freezeStaticMatrices()
    // Glyph layout is asynchronous (three-text loads HarfBuzz and the
    // font on first use), so a host carrying Text is not frame-ready the
    // moment it mounts. Awaiting every binding here is what makes a
    // screenshot at an arbitrary t deterministic — without it the first
    // frames a harness captures are silently textless.
    await Promise.all(host.texts.map((t) => t.binding.ready))
    host.warmed = host.prewarm()
    return host
  }

  /**
   * Build every hidden mesh's render object, bindings and GPU buffers in
   * the background after mount — not in the frame a hidden line first
   * becomes visible (a morph's slot lines, a reveal), where three would
   * otherwise create a hundred of them at once (10–21 ms of render spikes).
   *
   * renderer.compileAsync gathers its objects SYNCHRONOUSLY (projection
   * honours `visible`) and only then builds them one at a time, yielding to
   * the main thread between objects. So every mesh is shown for exactly the
   * synchronous gather and given back its visibility before control
   * returns: no frame ever sees it, nothing is drawn, the frames are the
   * bytes they were — and mount does not wait for it (a song's thousands of
   * sleeping chapters warm up while it plays).
   */
  private prewarm(): Promise<void> {
    // Only what three has NOT built yet — a mesh it drew once is warm — and
    // SLEEPING subtrees too: a dormant chapter, a presence-0 branch, a
    // slot state not yet recalled. A hidden GROUP hides its whole subtree
    // from compileAsync's gather, so for each chunk every object is hidden
    // but the chunk's meshes and their ancestors (and all is given back
    // before control returns: no frame sees it). One chunk per idle slice,
    // so no frame waits on a large tree (ValueFlow: 20k objects in one root).
    this.trackBuilt()
    // Gathered at the first idle moment, after the first frames have built
    // what they show.
    let cold: THREE.Mesh[] | undefined
    const builds: Promise<void>[] = []
    return new Promise<void>((resolve) => {
      const slice = () => {
        if (!cold) {
          cold = []
          this.scene.traverse((object) => {
            const mesh = object as THREE.Mesh
            if (mesh.isMesh && !this.built.has(mesh) && mesh.layers.test(this.camera.layers)) cold!.push(mesh)
          })
        }
        const chunk: THREE.Mesh[] = []
        while (cold.length > 0 && chunk.length < ThreeHost.WARM_CHUNK) {
          const mesh = cold.pop()!
          if (!this.built.has(mesh) && mesh.parent) chunk.push(mesh)
        }
        if (chunk.length > 0) builds.push(this.warmMeshes(chunk))
        if (cold.length > 0) whenIdle(slice)
        else void Promise.all(builds).then(() => resolve())
      }
      whenIdle(slice)
    })
  }

  /** Meshes compiled per idle slice (each one yields to the main thread as it builds). */
  static readonly WARM_CHUNK = 200
  /** Main-thread time one idle slice of other warm-up work may take (ms). */
  static readonly WARM_SLICE_MS = 6

  /**
   * Every mesh three has built a render object for — what the warm-up can
   * skip. Read off the renderer's own object cache as it fills (one wrap of
   * its factory); without it, nothing counts as built and all is warmed.
   */
  private readonly built = new WeakSet<THREE.Object3D>()
  private tracking = false
  private trackBuilt(): void {
    if (this.tracking) return
    this.tracking = true
    const objects = (this.renderer as unknown as { _objects?: { createRenderObject?: (...a: unknown[]) => unknown } })._objects
    const make = objects?.createRenderObject
    if (!objects || typeof make !== "function") return
    objects.createRenderObject = (...a: unknown[]) => {
      this.built.add(a[3] as THREE.Object3D)
      return make.apply(objects, a)
    }
  }

  /**
   * Compile these meshes' render objects: for compileAsync's synchronous
   * gather, everything in the scene is hidden but them and their
   * ancestors; all of it is given back before control returns.
   */
  private warmMeshes(meshes: readonly THREE.Mesh[]): Promise<void> {
    const was = new Map<THREE.Object3D, boolean>()
    let compiling: Promise<void>
    try {
      this.scene.traverse((object) => {
        if (object === this.scene) return
        was.set(object, object.visible)
        object.visible = false
      })
      for (const mesh of meshes) {
        for (let o: THREE.Object3D | null = mesh; o && o !== this.scene; o = o.parent) o.visible = true
      }
      compiling = this.compileEverywhere(this.scene)
    } finally {
      for (const [object, visible] of was) object.visible = visible
    }
    return compiling
  }

  /**
   * compileAsync for every render context this host draws into: the
   * canvas, and the layer compositor's target — a subtree mid-dissolve
   * (presence, a lens recall) is drawn into that, and a render object is
   * per context, so warming the canvas alone left a recall's first frames
   * building thousands (ValueFlow ⌥8: 3.7k). Both contexts are chosen
   * synchronously at the call, so the target is set and restored around it.
   */
  private compileEverywhere(root: THREE.Object3D): Promise<void> {
    const builds = [this.renderer.compileAsync(root, this.camera, this.scene)]
    const target = (this.compositor ??= new LayerCompositor(4)) as unknown as { target?: THREE.RenderTarget }
    if (target.target) {
      const previous = this.renderer.getRenderTarget()
      this.renderer.setRenderTarget(target.target)
      try {
        builds.push(this.renderer.compileAsync(root, this.camera, this.scene))
      } finally {
        this.renderer.setRenderTarget(previous)
      }
    }
    return Promise.all(builds).then(
      () => {},
      () => {},
    )
  }

  /** Resolves once the background prewarm has built every render object. */
  warmed: Promise<void> = Promise.resolve()

  /**
   * Does this stroke's interior ever show? True if `fillOpacity` starts
   * non-zero, or if any clip in the timeline carries a track targeting
   * it. Read once per holon at attach, which is the only moment the
   * answer can still change what gets built.
   */
  /**
   * Will this fill ever light radially (Stroke.fillFalloff)? Decided once
   * at attach, as washesFillOpacity decides a wash: a non-zero falloff, a
   * bound one, or one a track moves. Only such fills switch to the
   * radial-light material; every other fill keeps its flat one exactly.
   */
  private lightsRadially(holon: Stroke, fill: FillShape, curved = false): boolean {
    const f = holon.fillFalloff
    const uses = f.value > 0 || f.isBound || this.tracked().has(f)
    if (uses) {
      if (curved) fill.useSurfaceGradient()
      else fill.useGradient()
    }
    return uses
  }

  private washesFillOpacity(holon: Stroke): boolean {
    if (holon.fillOpacity.value > 0) return true
    // A BOUND fillOpacity (`.follow()`, or a derived reading passed in at
    // construction) can rise later through any upstream track, so a zero
    // at attach proves nothing. YinYang's globes were this: their land
    // follows a birth driver that is 0 at attach, no track names the param
    // itself, so no wash was ever built and the land drew as bare outline.
    if (holon.fillOpacity.isBound) return true
    return this.tracked().has(holon.fillOpacity)
  }

  /**
   * Every param some clip's track names — "does a track move it?" asked
   * once per stroke at attach. Scanning the clips per stroke was O(strokes
   * × tracks): 318k strokes × 13.8k tracks on the whole InterBrain song,
   * minutes of attach. Rebuilt whenever the clip list has grown (a holon
   * adopted after the dream gained clips sees them).
   */
  private tracked(): ReadonlySet<unknown> {
    const clips = this.dream.clips
    if (!this.trackedParams || this.trackedParams.clips !== clips.length) {
      const params = new Set<unknown>()
      for (const clip of clips) for (const track of clip.anim.tracks) params.add(track.param)
      this.trackedParams = { clips: clips.length, params }
    }
    return this.trackedParams.params
  }
  private trackedParams?: { clips: number; params: Set<unknown> }

  private attach(holon: Holon, parent: THREE.Object3D, root: Holon = holon): void {
    this.rootOf.set(holon, root)
    const group = new THREE.Group()
    // sync() composes the matrix itself, and only when the transform moved.
    group.matrixAutoUpdate = false
    parent.add(group)
    this.groups.push({
      holon,
      group,
      transform: [holon.x, holon.y, holon.z, holon.p, holon.h, holon.b, holon.scale],
      applied: new Float64Array(7).fill(Number.NaN),
      dirty: true,
      anyBound: true,
    })
    const binding = this.groups[this.groups.length - 1]!
    for (const p of binding.transform) p.watch(binding)

    if (holon instanceof Text) {
      const order = holon.composite === "first" ? undefined : this.claimFillOrder()
      this.texts.push({ binding: attachText(holon, group, order, holon.composite === "overlay"), group, holon })
    } else if (holon instanceof Cylinder) {
      const width = holon.stroke.value
      const r = holon.radius.value
      const h = holon.height.value
      const binding: CylinderBinding = {
        holon,
        group,
        farCap: new RibbonStroke(width),
        nearBack: new RibbonStroke(width),
        nearFront: new RibbonStroke(width),
        lineA: new RibbonStroke(width),
        lineB: new RibbonStroke(width),
        capRadius: r,
        capHeight: h,
        // NaN so the first sync always rebuilds the seams from the live camera.
        thetaA: NaN,
        thetaB: NaN,
        nearY: NaN,
      }
      group.add(
        binding.farCap.mesh,
        binding.nearBack.mesh,
        binding.nearFront.mesh,
        binding.lineA.mesh,
        binding.lineB.mesh,
      )
      this.cylinders.push(binding)
    } else if (holon instanceof Ellipse && holon.filled.value) {
      const fill = new FillShape(this.claimFillOrder())
      fill.setPolygon(ellipsePolygon(holon.radiusX.value, holon.radiusY.value))
      group.add(fill.mesh)
      this.fills.push({ holon, fill, sig: freshSig(holon), look: styleOf(holon), gradient: this.lightsRadially(holon, fill) })
    } else if (holon instanceof Rectangle && holon.filled.value) {
      const fill = new FillShape(this.claimFillOrder())
      fill.setPolygon(
        rectanglePolyline(holon.width.value, holon.height.value, holon.rounding.value),
      )
      group.add(fill.mesh)
      this.fills.push({ holon, fill, sig: freshSig(holon), look: styleOf(holon), gradient: this.lightsRadially(holon, fill) })
    } else if (holon instanceof Surface) {
      // A curved area carries its own triangles; a solid one writes depth
      // and is the only thing in the host anything can be behind.
      const fill = new FillShape(this.claimFillOrder())
      if (holon.solid.value) fill.useSolid(holon.composite === "inOrder")
      const gradient = !holon.solid.value && this.lightsRadially(holon, fill, true)
      // The version first: a DERIVED surface builds its arrays on that read.
      const version = holon.geomVersion
      fill.setMesh(holon.positions, holon.indices, holon.alphas)
      group.add(fill.mesh)
      this.surfaces.push({ holon, fill, version, gradient })
    } else if (holon instanceof Polylines) {
      // Many lines, one ribbon: its segments skip the gaps between loops.
      const ribbon = new RibbonStroke(holon.stroke.value)
      ribbon.mesh.renderOrder = this.nextFillOrder++
      const version = holon.geomVersion
      const loops = holon.loops.map((loop) => loop.map((p) => new THREE.Vector3(p.x, p.y, p.z)))
      ribbon.setLoops(loops)
      group.add(ribbon.mesh)
      this.polylines.push({ holon, ribbon, version, look: styleOf(holon) })
      const sure = seenCertainty(holon)
      if (sure) {
        const blur = new RibbonSuperposition(ribbon, sure, this.superpositions.length + 1, group)
        blur.setLoops(loops)
        this.blurOf.set(ribbon, blur)
        this.superpositions.push({ blur, group })
      }
    } else if (holon instanceof Stroke) {
      let strokeBinding: StrokeBinding | undefined
      // The wash goes down BEFORE the ribbon, so the sketch line draws
      // over its own interior — pydeation's two materials on one object,
      // in the order C4D composites them. It claims a renderOrder from
      // the same counter the fills use, which is what keeps the
      // MolochEye contract intact: attach order IS composite order, and
      // a wash attached here still sits under everything attached after.
      //
      // Only a stroke that ACTUALLY washes gets one. pydeation builds a
      // filler material on every object unconditionally, but a mesh that
      // is permanently invisible is still a mesh and still consumes a
      // renderOrder — and every existing scene's stacking is stated in
      // that counter (MolochEye's pupil-over-disk). So the gate is the
      // param itself: a non-zero start, or a track that moves it.
      //
      // A DRAWING washes once, across all of its subpaths together
      // (`drawingSubpaths`), and its subpaths then do not wash on their
      // own — they are not separate interiors, they are one interior's
      // boundary. Claimed here, before the children are reached.
      const loops = this.washesFillOpacity(holon) ? drawingSubpaths(holon) : undefined
      if (loops) {
        const fill = new FillShape(this.claimFillOrder())
        fill.setPolygons(loops)
        group.add(fill.mesh)
        this.drawingWashes.push({ holon, fill, sig: drawingSig(holon), look: styleOf(holon), gradient: this.lightsRadially(holon, fill) })
        for (const part of holon.parts) this.washedByAncestor.add(part)
      }
      const washed =
        !loops && !this.washedByAncestor.has(holon) && this.washesFillOpacity(holon)
          ? washGeometry(holon)
          : undefined
      if (washed) {
        const fill = new FillShape(this.claimFillOrder())
        fill.setPolygon(washed.points, washed.triangles)
        group.add(fill.mesh)
        const wash: WashBinding = { holon, fill, sig: freshSig(holon), look: styleOf(holon), gradient: this.lightsRadially(holon, fill) }
        this.washes.push(wash)
        const sure = seenCertainty(holon)
        if (sure) {
          const look = () => ({ opacity: wash.look.fillOpacity.value * wash.look.opacity.value, tint: wash.look.tint.value })
          this.superpositions.push({ blur: new FillSuperposition(sure, this.superpositions.length + 1, fill, group, look), group })
        }
      }
      const pts = polyline(holon)
      // A Line's polyline may be DERIVED (parts/curves.ts) and therefore
      // empty at mount and non-empty later — Scene03's section curve
      // starts with the cutting plane clear of the cylinder. Binding it
      // anyway (and letting sync() fill it in) is what lets such a stroke
      // ever appear; a shape holon with no polyline is a real absence.
      if (pts || holon instanceof Line) {
        const ribbon = new RibbonStroke(holon.stroke.value)
        // Attach order IS composite order: a stroke attached after a fill
        // draws over it (MolochEye's pupil over its black iris disk).
        // Stroke-vs-stroke order is a no-op under MAX blending.
        ribbon.mesh.renderOrder = this.nextFillOrder++
        ribbon.setPoints(pts ?? [])
        strokeBinding = { holon, ribbon, sig: freshSig(holon), group, look: styleOf(holon) }
        this.inkStale = true // a new stroke: the 3D pick's sphere index starts over
        const sure = seenCertainty(holon)
        if (sure) {
          const blur = new RibbonSuperposition(ribbon, sure, this.superpositions.length + 1, group)
          blur.setPoints(pts ?? [])
          this.blurOf.set(ribbon, blur)
          this.superpositions.push({ blur, group })
        }
        if (this.useInstancedRibbons) {
          // Instancing on: one batch mesh draws every ribbon. The stroke's
          // own mesh STILL joins the group — so its world matrix updates
          // exactly as it would in the oracle path, which is what
          // screenArc/measureScreenArc read (byte-identical `drawn`/pen
          // metering) — but it is placed on a non-rendered layer so the
          // renderer never draws it (only the batch does). `mesh.visible`
          // stays as style() sets it, so packRibbonBatch reads true
          // visibility; layer BATCH_LAYER keeps it out of the frame.
          group.add(ribbon.mesh)
          ribbon.mesh.layers.set(ThreeHost.BATCH_LAYER)
          // Attach order is composite order, and a batch draws at ONE
          // renderOrder — so ribbons batch in RUNS: a stroke joins the open
          // batch unless a fill has claimed an order since it opened, in
          // which case it opens the next one. Within a run nothing but
          // ribbons lies between their orders, and ribbon-vs-ribbon order
          // is a MAX no-op, so the batch at the run's latest order
          // composites exactly as the per-mesh oracle does. (One batch
          // above every fill was wrong wherever a fill was attached AFTER
          // strokes it must cover: Web3's hero globe over its lattice.)
          if (!this.openBatch) {
            this.batchTable ??= new BatchTable()
            this.openBatch = new RibbonBatch(256, this.batchTable)
            this.ribbonBatches.push(this.openBatch)
          }
          this.openBatch.mesh.renderOrder = ribbon.mesh.renderOrder
          strokeBinding.batch = this.openBatch
          // Reserve with headroom over the current segment count so a
          // breathing stroke rarely relocates. A stroke with no segments
          // yet (an empty derived Line) still gets a small slot.
          const initial = ribbon.geometry.instanceCount
          strokeBinding.slot = this.openBatch.reserve(Math.max(2, initial))
        } else {
          group.add(ribbon.mesh)
        }
        this.strokes.push(strokeBinding)
      }
      if (holon instanceof Line) {
        for (const atStart of [false, true]) {
          if (!(atStart ? holon.arrowStart : holon.arrowEnd).value) continue
          const polygon = arrowPolygon(holon.points, atStart, holon.arrowSize.value)
          if (!polygon) continue
          const fill = new FillShape(this.claimFillOrder())
          fill.setPolygon(polygon)
          group.add(fill.mesh)
          this.arrows.push({
            holon,
            fill,
            atStart,
            shapeKey: arrowKey(holon),
            group,
            stroke: strokeBinding,
          })
        }
      }
    }

    // RESIDENCY: a chapter mounting in slices takes its parts from a
    // queue — the same depth-first order, pausable between holons.
    const queue = this.attachQueue
    if (queue) for (let k = holon.parts.length - 1; k >= 0; k--) queue.push([holon.parts[k]!, group, root])
    else for (const part of holon.parts) this.attach(part, group, root)
  }

  /**
   * A hook between sampling and syncing, for a host that wants to overlay
   * something on top of the timeline's values (the editor's live layer —
   * see editor/overrides.ts). Left undefined, the frame path is exactly
   * what it always was: sample t, sync, render. The demo page and the
   * gauntlet never set it, so they always see the pure timeline.
   */
  beforeSync?: () => void

  /** Deterministic: sample the timeline at t, sync the scene, render. */
  async renderFrame(t: number): Promise<void> {
    this.frameT = t
    // View-dependent geometry reads the camera this host renders with (frames.ts liveView).
    setLiveObserver(this.dream.observer)
    this.dream.applyAt(t)
    if (this.residency) {
      const settling = this.reside(t)
      if (settling) await settling
    }
    this.beforeSync?.()
    this.sync()
    // When sync() left every world matrix settled and nothing has moved
    // since, the renderer's own scene.updateMatrixWorld() would only
    // recompute the same matrices over every node (perf F) — skip it for
    // this one call. Camera matrices are the renderer's to update, as
    // ever. The flag is restored before anything else can render.
    // The renderer's own traversal is exactly settleScene()'s; settle the
    // targeted way if sync() did not, and never let it walk the graph.
    if (!this.matricesSettled) this.settleScene()
    const settled = this.matricesSettled
    if (settled) this.scene.matrixWorldAutoUpdate = false
    try {
      const layers = this.fadingLayers()
      if (layers) await (this.compositor ??= new LayerCompositor(4)).render(this.renderer, this.scene, this.camera, layers)
      else await this.renderer.render(this.scene, this.camera)
    } finally {
      if (settled) this.scene.matrixWorldAutoUpdate = true
    }
    // RESIDENCY: chapters mounted this frame warm up behind it.
    if (this.residency) this.warmMounted()
    // Echo clouds made this frame while hidden: built behind it, too.
    if (this.coldEchoes.size > 0) this.warmEchoes()
  }

  /** Composites fading wholes as single pictures (layers.ts). */
  private compositor?: LayerCompositor

  /**
   * The wholes fading as ONE picture this frame — a DreamSong's crossfade
   * or dissolve (song.ts `layerFades`) — as the top-level objects to
   * composite and their weights; undefined when nothing fades strictly
   * below full, which is every frame of every scene outside such a window
   * (the ordinary single pass, unchanged). A batched host mixes chapters
   * inside one draw and cannot isolate them, so it renders unlayered
   * (no batched song has a dissolve today: Web3's runs are too short to
   * batch).
   */
  private fadingLayers(): { objects: THREE.Object3D[]; weight: number }[] | undefined {
    const fades = (this.dream as { layerFades?: readonly { roots: readonly Holon[]; opacity: number }[] })
      .layerFades
    if (!fades || !fades.some((f) => f.opacity < 1) || this.ribbonBatches.length > 0) return undefined
    const roots = this.rootGroupMap()
    return fades
      .filter((f) => f.opacity < 1)
      .map((f) => ({
        objects: f.roots.flatMap((r) => {
          const g = roots.get(r)
          return g ? [g] : []
        }),
        weight: f.opacity,
      }))
  }

  private rootGroups?: Map<Holon, THREE.Object3D>

  /** Each root holon's group (the scene's direct children), built once. */
  private rootGroupMap(): Map<Holon, THREE.Object3D> {
    if (!this.rootGroups) {
      this.rootGroups = new Map()
      for (const { holon, group } of this.groups) if (group.parent === this.scene) this.rootGroups.set(holon, group)
    }
    return this.rootGroups
  }

  /**
   * True from a full scene settle until anything could move a node again
   * (perf F). sync() clears it on entry — the group loop recomposes
   * matrices — and after the view-dependent pass when Text is present
   * (its contour rebuild can parent new meshes). Read by the cull, to
   * skip re-settling what sync() just settled, and by renderFrame.
   */
  private matricesSettled = false

  /**
   * Perf I-2 — the host's own meshes (ribbons, fills, washes, arrowheads,
   * cylinder contours) sit at the identity inside their holon's group
   * forever: the only transform writers in the frame path are the group
   * loop and the camera. Left auto-updating, each recomposed its matrix
   * and flagged itself dirty on every settle, and the auto-updating scene
   * root forced the whole tree (Web3: ~19 ms a frame over ~35k nodes). So
   * they — and the scene root — stop auto-updating, each flagged once so
   * the first settle computes its world matrix, and the settle is no
   * longer forced: a subtree is recomputed exactly when its group's
   * matrix moved (sync() calls group.updateMatrix(), which flags it), from
   * the same inputs as before, so every matrixWorld is the same float.
   * Meshes built later (Text's contour rebuild) keep auto-updating.
   */
  private freezeStaticMatrices(): void {
    const freeze = (o: THREE.Object3D) => {
      o.matrixAutoUpdate = false
      o.matrixWorldNeedsUpdate = true
    }
    this.scene.matrixAutoUpdate = false
    this.scene.matrixWorldNeedsUpdate = true
    for (const { ribbon } of this.strokes) freeze(ribbon.mesh)
    for (const { fill } of this.fills) freeze(fill.mesh)
    for (const { fill } of this.washes) freeze(fill.mesh)
    for (const { fill } of this.drawingWashes) freeze(fill.mesh)
    for (const { fill } of this.arrows) freeze(fill.mesh)
    for (const c of this.cylinders) {
      for (const r of [c.farCap, c.nearBack, c.nearFront, c.lineA, c.lineB]) freeze(r.mesh)
    }
  }

  /**
   * The frame's settle — exactly three's `scene.updateMatrixWorld()`, but
   * without walking every node (perf J). That traversal visits the whole
   * graph (Web3: ~72k nodes, twice a frame with text) to find the few
   * that need work: the groups sync() moved this frame (updateMatrix flags
   * them) and the meshes three still auto-updates (Text's). So those are
   * visited directly, in depth-first order, each subtree once — the same
   * calls in the same order on the same inputs, so every matrixWorld is
   * the same float. The index is trusted only while the graph's structure
   * is unchanged (structureEpoch); otherwise it is the full traversal, and
   * a fresh index.
   */
  private settleScene(): void {
    if (this.settleIndex === undefined || this.indexedStructure !== structureEpoch) {
      this.scene.updateMatrixWorld()
      this.indexScene()
      this.inkStale = true
    } else {
      const index = this.settleIndex
      // Both lists are depth-first already (the groups attach depth-first;
      // a list that is not gets sorted): merge them, settling each subtree
      // once, roots before what they contain.
      const moved = this.movedGroups
      for (let k = 1; k < moved.length; k++) {
        if (index.get(moved[k - 1]!)![0] > index.get(moved[k]!)![0]) {
          moved.sort((a, b) => index.get(a)![0] - index.get(b)![0])
          break
        }
      }
      const auto = this.autoNodes
      let i = 0
      let j = 0
      let coveredTo = -1
      while (i < moved.length || j < auto.length) {
        const a = i < moved.length ? index.get(moved[i]!)! : undefined
        const b = j < auto.length ? index.get(auto[j]!)! : undefined
        const takeMoved = a !== undefined && (b === undefined || a[0] <= b[0])
        const o = takeMoved ? moved[i++]! : auto[j++]!
        const span = takeMoved ? a! : b!
        if (span[0] < coveredTo) continue // inside a subtree already settled
        o.updateMatrixWorld()
        coveredTo = span[1]
        this.noteMoved(span)
      }
    }
    this.movedGroups.length = 0
    this.matricesSettled = true
    this.settledStructure = structureEpoch
  }

  /** The graph's structure when matrices were last settled — a node added since has no settled matrix yet. */
  private settledStructure = -1

  /** The groups sync() re-composed this frame — the targeted settle's roots. */
  private readonly movedGroups: THREE.Object3D[] = []
  /** Depth-first [first, past-last] index of every node, for the targeted settle. */
  private settleIndex?: Map<THREE.Object3D, [number, number]>
  /** The nodes three auto-updates (matrixAutoUpdate), in depth-first order. */
  private autoNodes: THREE.Object3D[] = []
  private indexedStructure = -1

  private indexScene(): void {
    const index = new Map<THREE.Object3D, [number, number]>()
    const auto: THREE.Object3D[] = []
    let n = 0
    const visit = (o: THREE.Object3D) => {
      const span: [number, number] = [n++, 0]
      index.set(o, span)
      if (o.matrixAutoUpdate && o !== this.scene) auto.push(o)
      for (const c of o.children) visit(c)
      span[1] = n
    }
    visit(this.scene)
    this.settleIndex = index
    this.autoNodes = auto
    this.indexedStructure = structureEpoch
  }

  /** The t of the frame in flight — the cull's idle latch reads it. */
  private frameT = Number.NaN

  private sync(): void {
    this.syncCount++
    this.matricesSettled = false
    this.updateDormancy()
    for (const binding of this.groups) {
      if (!binding.dirty && !binding.anyBound) continue
      const { group, transform: tr, applied: last } = binding
      if (binding.dirty) {
        // A follow() is a change too, so a newly bound param re-arms this.
        binding.dirty = false
        binding.anyBound = tr.some((p) => p.isBound)
      }
      const x = tr[0]!.value
      const y = tr[1]!.value
      const z = tr[2]!.value
      const p = tr[3]!.value
      const h = tr[4]!.value
      const b = tr[5]!.value
      const s = tr[6]!.value
      // Unmoved since the last compose: the matrix already IS this
      // transform (Object.is, so a -0 or NaN reads as a change exactly
      // when it would compose differently).
      if (
        Object.is(x, last[0]) &&
        Object.is(y, last[1]) &&
        Object.is(z, last[2]) &&
        Object.is(p, last[3]) &&
        Object.is(h, last[4]) &&
        Object.is(b, last[5]) &&
        Object.is(s, last[6])
      ) {
        continue
      }
      last[0] = x
      last[1] = y
      last[2] = z
      last[3] = p
      last[4] = h
      last[5] = b
      last[6] = s
      group.position.set(x, y, z)
      // h/p/b ARE C4D's HPB triple, so they must compose the way C4D
      // composes them: M = R_H · R_P · R_B in C4D's axes, which under the
      // fixed axis dictionary (X, Y, Z)c4d → (x, z, y) reads as
      // Rz(b) · Rx(p) · Ry(h) in ours — three's 'ZXY' Euler order, not
      // its 'XYZ' default. Single-axis poses are unaffected (which is why
      // this went unnoticed until S09 turned a rectangle about two axes
      // at once: the wrong order put its corners 43px off the reference).
      group.rotation.set(p, h, b, "ZXY")
      group.scale.set(s, s, s)
      group.updateMatrix()
      this.movedGroups.push(group)
    }
    // A HELD frame: no param (value, gate, bias, binding) and no Line's
    // points have been written since the last sync (paramEpoch), so no
    // stroke's or fill's geometry can have changed — skip every check.
    // A paused editor, free play standing still: thousands of lines
    // confirmed in one compare. Playback writes params every frame, so it
    // never takes this path; nothing it skips could differ.
    const held = this.syncedEpoch === paramEpoch()
    let widest = 0
    for (const binding of this.awake(this.strokes)) {
      const { holon, ribbon } = binding
      const lift = this.highlightOf(holon)
      // READS: nothing this stroke read last time has changed since, its
      // glow, its line's points and the visibility it was left with are as
      // they were (the cull may have hidden it since), and it was not
      // metering a pen front (a reading of the camera): it would sync to
      // exactly what it shows — skip it.
      const known = binding.reads
      // Not worth tracking now (it kept missing): sync plainly until the re-probe.
      if (!ThreeHost.READS || (binding.readsOffUntil !== undefined && this.syncCount < binding.readsOffUntil)) {
        const width = this.syncStroke(binding, held, lift)
        if (width > widest) widest = width
        continue
      }
      if (
        known !== undefined &&
        lift === binding.lastLift &&
        ribbon.mesh.visible === binding.lastShown &&
        (binding.sig.line === undefined || binding.sig.line.geomVersion === binding.lastLineVersion) &&
        unchangedSince(known.deps, known.n ?? known.deps.length, binding.readAt!)
      ) {
        if (binding.lastWidth! > widest) widest = binding.lastWidth!
        continue
      }
      // A held frame skips the geometry check, so what it reads is not the
      // whole list: it keeps the last one (still exact — nothing changed).
      let width: number
      if (held && known !== undefined) width = this.syncStroke(binding, held, lift)
      else {
        // One list per stroke, refilled (no allocation per frame); each param listed once.
        const reads = (binding.readsBuf ??= { deps: [], opaque: false })
        const readAt = quietEpoch()
        const outer = beginReads(reads)
        try {
          width = this.syncStroke(binding, held, lift)
        } finally {
          endReads(outer)
        }
        const kept = !held && !reads.opaque && reads.n! <= ThreeHost.MAX_READS
        binding.reads = kept ? reads : undefined
        binding.readAt = readAt
        // ADAPTIVE: a stroke that is opaque, too long, or dirty again frame
        // after frame (a list that never holds) pays the tracking and the
        // check for nothing — after READS_MISSES such frames in a row it
        // syncs plainly for READS_REST frames, then is probed again.
        if (!held) {
          const missed = !kept || known !== undefined
          binding.readsMisses = missed ? (binding.readsMisses ?? 0) + 1 : 0
          if (binding.readsMisses >= ThreeHost.READS_MISSES) {
            binding.readsOffUntil = this.syncCount + ThreeHost.READS_REST
            binding.readsMisses = ThreeHost.READS_MISSES - 1
            binding.reads = undefined
          }
        }
      }
      if (width > widest) widest = width
      binding.lastWidth = width
      binding.lastLift = lift
      binding.lastLineVersion = binding.sig.line?.geomVersion
      binding.lastShown = ribbon.mesh.visible
    }
    this.widestStroke = widest
    for (const binding of this.awake(this.fills, false)) {
      const { holon, fill } = binding
      if (!held && sigChanged(holon, binding.sig)) {
        fill.setPolygon(
          holon instanceof Ellipse
            ? ellipsePolygon(holon.radiusX.value, holon.radiusY.value)
            : rectanglePolyline(holon.width.value, holon.height.value, holon.rounding.value),
        )
      }
      // Fill semantics: creation IS the fill-in, composed with fade.
      const { look } = binding
      fill.style(
        look.creation.value * look.opacity.value,
        liftTint(look.tint.value, this.highlightOf(holon)),
      )
      if (binding.gradient) fill.setGradient(look.fillFalloff.value, look.fillFalloffRadius.value)
    }
    for (const binding of this.awake(this.washes)) {
      const { holon, fill } = binding
      if (!held && sigChanged(holon, binding.sig)) {
        const washed = washGeometry(holon)
        if (washed) fill.setPolygon(washed.points, washed.triangles)
      }
      // The wash reads `fillOpacity`, NOT `creation`: the two are
      // independent surfaces, which is the whole point of the param and
      // exactly what UnFillThenUnDraw needs — the interior goes while
      // the outline is still there to go afterwards. Fade still
      // multiplies through, as it does for the sketch line.
      fill.style(
        binding.look.fillOpacity.value * binding.look.opacity.value,
        liftTint(binding.look.tint.value, this.highlightOf(holon)),
      )
      if (binding.gradient) fill.setGradient(binding.look.fillFalloff.value, binding.look.fillFalloffRadius.value)
    }
    for (const binding of this.awake(this.polylines)) {
      const { holon, ribbon, look } = binding
      // No pen front: shown while created and not erased.
      const on = look.creation.value > 0 && look.erasure.value < 1 ? 1 : 0
      const opacity = look.opacity.value
      const width = look.stroke.value
      // Hidden lines keep their loops (and skip deriving them) until they can show, as strokes do.
      if (on > 0 && opacity > 0 && width > 0 && holon.geomVersion !== binding.version) {
        const loops = holon.loops.map((loop) => loop.map((p) => new THREE.Vector3(p.x, p.y, p.z)))
        binding.version = holon.geomVersion
        ribbon.setLoops(loops)
        this.blurOf.get(ribbon)?.setLoops(loops)
      }
      ribbon.style(on, opacity, look.tint.value, width)
    }
    for (const binding of this.awake(this.surfaces)) {
      const { holon, fill } = binding
      if (holon.geomVersion !== binding.version) {
        binding.version = holon.geomVersion
        fill.setMesh(holon.positions, holon.indices, holon.alphas)
      }
      // Seen opacity (certainty.ts): a Layer's presence fades the land as it does the strokes.
      fill.style(holon.fillOpacity.value * seenOf(holon).value, liftTint(holon.tint.value, this.highlightOf(holon)))
      if (binding.gradient) {
        fill.setGradient(holon.fillFalloff.value, holon.fillFalloffRadius.value)
        fill.setGradientAt(holon.fillFalloffX.value, holon.fillFalloffY.value, holon.fillFalloffZ.value)
      }
    }
    for (const binding of this.awake(this.drawingWashes)) {
      const { holon, fill } = binding
      // The geometry watched is the SUBPATHS', since the drawing holon
      // has no polyline of its own — tracked by the sum of the subpath
      // Lines' geomVersions plus their count (drawingSig), an O(childCount)
      // integer signature in place of flattening every subpath every frame.
      // A drawing whose subpaths have gone (or opened) simply stops
      // painting — `setPolygons` empties the mesh rather than leaving the
      // last good one behind.
      if (drawingSigChanged(holon, binding.sig)) {
        fill.setPolygons(drawingSubpaths(holon) ?? [])
      }
      fill.style(
        binding.look.fillOpacity.value * binding.look.opacity.value,
        liftTint(binding.look.tint.value, this.highlightOf(holon)),
      )
      if (binding.gradient) fill.setGradient(binding.look.fillFalloff.value, binding.look.fillFalloffRadius.value)
    }
    this.syncCamera()

    // View-dependent geometry needs finished world matrices AND the final
    // camera for this frame — so it comes last. Arrowheads are among it:
    // an S&T end cap is a constant number of PIXELS, so its world size is
    // a reading of the projection at the pen.
    // The batch needs settled world matrices every frame (to bake each
    // stroke's view-space segments) — so it forces the settle even on a
    // scene with no cylinders/arrows/texts.
    if (
      this.cylinders.length > 0 ||
      this.arrows.length > 0 ||
      this.texts.length > 0 ||
      this.ribbonBatches.length > 0 ||
      this.superpositions.length > 0 ||
      this.clips.size > 0 ||
      this.clipTexts.length > 0 ||
      this.glowing()
    ) {
      this.settleScene()
      for (const binding of this.cylinders) if (!this.asleep(binding.holon)) this.syncCylinder(binding)
      for (const binding of this.arrows) if (!this.asleep(binding.holon)) this.syncArrow(binding)
      // Text belongs here too: a letter's traced contour is inset by half
      // a stroke, and a stroke is a count of PIXELS, so how far to pull
      // the contour in is a reading of this frame's projection.
      for (const { binding, group, holon } of this.texts) {
        if (this.asleep(holon)) continue
        binding.sync(1 / this.unitsPerPixelAt(group, ORIGIN), this.frameT)
      }
      // Uncertainty's echoes: offsets in pixels, so after the settle.
      for (const { blur, group } of this.superpositions) {
        blur.sync(this.frameT, () => this.unitsPerPixelAt(group, ORIGIN))
      }
      // Attention's halos: after every stroke and fill is styled and settled.
      this.syncGlow()
      // Clips: their discs as this frame's camera sees them.
      if (this.clipTexts.length > 0) this.adoptClippedText()
      if (this.clips.size > 0) this.syncClips()
      // A contour rebuild parents fresh ribbon meshes whose world
      // matrices are not yet settled.
      if (this.texts.length > 0) this.matricesSettled = false
    }

    this.cullOffscreen()
    this.syncedEpoch = paramEpoch()

    // Pack every batched stroke into the single instanced draw — LAST, so
    // it sees the cull's visibility decisions and this frame's settled
    // world matrices + camera. A no-op when instancing is off.
    this.packRibbonBatch()
  }

  /** Most params a stroke's sync may read and still be skipped by READS (the check reads each one's changedAt). */
  static readonly MAX_READS = 64
  /** READS on (the default); false syncs every stroke every frame — the A/B baseline. */
  static READS = true
  /** READS adaptivity: consecutive frames a stroke's tracking may miss before it rests, and how many frames it rests. */
  static readonly READS_MISSES = 3
  static readonly READS_REST = 60
  /** Syncs so far (READS' re-probe clock). */
  private syncCount = 0

  /** One stroke's per-frame sync (READS: run tracked); returns its width. */
  private syncStroke(binding: StrokeBinding, held: boolean, lift: number): number {
    const { holon, ribbon, look } = binding
    const opacity = look.opacity.value
    const width = look.stroke.value
    // The geometry dirty-check: an O(1) version+phase compare for a Line
    // (the many-point case that dominated this loop), the small
    // shape-param array for a parametric shape. A superset of the old
    // per-frame flatten+compare, so no stale geometry — see ShapeSig.
    // A stroke that cannot show (seen opacity or width 0: ribbon.style
    // hides it, picking and glow skip hidden ink) leaves its geometry —
    // and a derived polyline's computation — until the frame it can: its
    // signature is kept, so that frame finds the change and reshapes
    // before the draw (state-space residency at the leaf).
    if (!held && opacity > 0 && width > 0 && sigChanged(holon, binding.sig)) {
      // `undefined` from a Line means its derived polyline has emptied
      // out this frame — pass it through so the ribbon empties too.
      const pts = polyline(holon)
      if (pts || holon instanceof Line) {
        ribbon.setPoints(pts ?? [])
        this.blurOf.get(ribbon)?.setPoints(pts ?? [])
        this.noteReshaped(binding)
      }
    }
    const creation = look.creation.value
    const tint = look.tint.value
    const erasure = look.erasure.value
    // One screen-arc measurement serves both fronts (perf F): a stroke
    // mid-draw AND mid-erase used to project its polyline twice. Only a
    // front strictly inside (0, 1) needs it — screenArc's own early outs.
    // A stroke that cannot show (opacity or width 0 — ribbon.style hides
    // it whatever its fronts say) is not measured at all.
    const seen = opacity > 0 && width > 0
    const creationMid = seen && !(creation <= 0) && !(creation >= 1)
    const erasureMid = seen && !(erasure <= 0) && !(erasure >= 1)
    const measured =
      creationMid || erasureMid ? this.measureScreenArc(ribbon) : undefined
    ribbon.style(
      creationMid ? this.arcFrom(measured, creation) : creation <= 0 ? 0 : 1,
      opacity,
      liftTint(tint, lift),
      width * (1 + 2 * lift),
      erasureMid ? this.arcFrom(measured, erasure) : erasure <= 0 ? 0 : 1,
    )
    // A pen front is a reading of the camera, which no param lists.
    if (creationMid || erasureMid) readsOpaque()
    return width
  }

  /**
   * Write every batched stroke into the shared batch (perf G): its table
   * row each frame — the modelView and style — and its LOCAL segments only
   * when its polyline changed; strokes style()/cull left invisible are
   * hidden by their row. Runs only when `useInstancedRibbons` is on. The
   * modelView is composed EXACTLY as three composes the per-mesh uniform
   * (matrixWorldInverse · matrixWorld, Matrix4.multiplyMatrices), from
   * `group.matrixWorld` — the ribbon mesh has identity local transform, so
   * that is the mesh.matrixWorld the per-mesh path would use — and the
   * shader multiplies it by the same local endpoint, on the GPU.
   */
  private packRibbonBatch(): void {
    if (this.ribbonBatches.length === 0) return
    const viewInverse = this.camera.matrixWorldInverse
    const dots = this.batchDots
    for (const set of dots.values()) set.clear()
    for (const binding of this.strokes) {
      const { ribbon, group, slot, batch } = binding
      if (!slot || !batch) continue
      if (this.dormant && this.asleep(binding.holon)) {
        batch.hideStroke(slot)
        continue
      }
      const geometry = ribbon.geometry
      const count = geometry.instanceCount
      // A stroke style()/cull hid, or an empty derived polyline, draws
      // nothing — hide its row and leave its segments be.
      if (!ribbon.mesh.visible || count < 1) {
        batch.hideStroke(slot)
        continue
      }
      const ud = ribbon.mesh.userData
      const tint = ud[RIBBON_KEYS.tint] as THREE.Color
      // Perf I-1 — a stroke scaled to NOTHING is one dot, drawn ~128 times.
      // With its world matrix's linear part exactly zero, every endpoint
      // is exactly the matrix's translation (0·x adds nothing, CPU or GPU
      // f32), the screen length is 0, and the shader's draw fronts multiply
      // by a pxPerUnit of 0 — so each segment paints the SAME round dot,
      // whatever drawn/erased say. N identical dots under MAX are one dot,
      // byte for byte: draw one segment of the first such stroke per
      // (centre, width, tint, fade) in this batch, hide the rest. Only
      // within a batch — between batches a fill may lie, and it could
      // cover the first dot and not a later one. (TheWall's unlaunched
      // creatures: ~420k segments at t=0.5, ~205k at 8.33.)
      const w = group.matrixWorld.elements
      let drawSegments: number | undefined
      if (
        w[0] === 0 && w[1] === 0 && w[2] === 0 &&
        w[4] === 0 && w[5] === 0 && w[6] === 0 &&
        w[8] === 0 && w[9] === 0 && w[10] === 0
      ) {
        const key = `${w[12]},${w[13]},${w[14]},${ud[RIBBON_KEYS.widthPx]},${tint.r},${tint.g},${tint.b},${ud[RIBBON_KEYS.fade]}`
        let seen = dots.get(batch)
        if (!seen) dots.set(batch, (seen = new Set()))
        if (seen.has(key)) {
          batch.hideStroke(slot)
          continue
        }
        seen.add(key)
        drawSegments = 1
      }
      this.batchMv.multiplyMatrices(viewInverse, group.matrixWorld)
      binding.slot = batch.writeStroke(
        slot,
        {
          points: ribbon.worldPoints(),
          positions: (geometry.getAttribute("instanceStart") as THREE.InterleavedBufferAttribute).data
            .array as Float32Array,
          distances: (geometry.getAttribute("instanceDistanceStart") as THREE.InterleavedBufferAttribute)
            .data.array as Float32Array,
          count,
        },
        this.batchMv,
        ud[RIBBON_KEYS.widthPx] as number,
        ud[RIBBON_KEYS.drawn] as number,
        ud[RIBBON_KEYS.erased] as number,
        tint.r,
        tint.g,
        tint.b,
        ud[RIBBON_KEYS.fade] as number,
        drawSegments,
      )
    }
    for (const batch of this.ribbonBatches) batch.flush()
  }

  /**
   * Reusable scratch for the cull pass — one frustum and a handful of
   * vectors, allocated once so the per-frame loop over 3,776 strokes
   * makes no garbage.
   */
  private readonly cullFrustum = new THREE.Frustum()
  private readonly cullVP = new THREE.Matrix4()
  private readonly cullCenter = new THREE.Vector3()
  private readonly cullScale = new THREE.Vector3()
  private readonly cullSphere = new THREE.Sphere()
  /** Ribbons the last cull pass hid because they were off-screen (debug). */
  culledOffscreen = 0
  /**
   * The idle latch (perf #2 follow-up): the cull's ~2.4 ms/frame — the
   * updateMatrixWorld(true) settle plus the sweep over every stroke — is
   * pure waste on a scene that never has anything off-screen (TheWall fills
   * the view for its whole duration, culling 0 at every t). The latch skips
   * the pass entirely once it has proven, on a settled frame, that the frame
   * is IDENTICAL to one that culled nothing.
   *
   * Two scalars fully identify a pure frame: the timeline t and the camera's
   * view-projection matrix. If both are unchanged AND the last run culled
   * zero, this frame's geometry is bit-for-bit the previous frame's, so its
   * cull result is too — skip. Any change to either re-arms the full pass.
   *
   * SAFETY: the latch engages ONLY in the pure frame path. The editor's
   * `beforeSync` can move geometry with t held (dragging a paused object),
   * which neither scalar would catch — so a live override layer disables the
   * latch outright (`beforeSync !== undefined`), and the editor pays the full
   * cull every frame, which is fine (it is interactive, not playing 236
   * creatures). `cullLatchT` starts NaN so the first frame always runs.
   */
  private cullLatchT = Number.NaN
  private readonly cullLatchVP = new THREE.Matrix4()
  private cullLatchIdle = false
  /**
   * Master switch for the off-screen cull. On by default; the only thing
   * that turns it off is a harness proving byte-identity — with the cull
   * off, the frame is exactly the pre-cull path, so cull-on vs cull-off in
   * the SAME process isolates the cull's pixel effect from GPU run-to-run
   * noise (TheWall's MAX-blended overdraw is not bit-reproducible across
   * browser processes). Also a plain escape hatch.
   */
  cullEnabled = true

  /**
   * OPTIMIZATION A — ribbon instancing (ribbon-batch.ts). Off by default:
   * the per-mesh RibbonStroke path is the byte-identity ORACLE and stays
   * the default until instancing is proven byte-identical on the full
   * scene set. When on, ribbons are baked into ONE batched draw
   * (`ribbonBatches`, one per fill-free run) instead of 3,776 meshes, collapsing the
   * per-object WebGPU submission cost that IS the render ceiling
   * (hump-diagnosis.md). Read once at mount, since it decides what attach
   * builds; flipping it after mount does nothing until the next mount.
   */
  get useInstancedRibbons(): boolean {
    return this.instanced
  }
  private instanced: boolean

  /**
   * Undo instancing after attach: every batched stroke's own mesh is
   * already in its group (on BATCH_LAYER, for its world matrix), so it
   * returns to the rendered layer and is the per-mesh oracle again — the
   * same renderOrder, the same everything — and the batches are dropped.
   */
  private unbatch(): void {
    for (const binding of this.strokes) {
      if (!binding.batch) continue
      binding.ribbon.mesh.layers.set(0)
      binding.batch = undefined
      binding.slot = undefined
    }
    for (const batch of this.ribbonBatches) batch.geometry.dispose()
    this.ribbonBatches.length = 0
    this.openBatch = undefined
    this.batchTable?.material.dispose()
    this.batchTable = undefined
    this.instanced = false
  }
  /** Take the clipped strokes out of their batches (a batch draws with one, unclipped, material). */
  private unbatchClipped(): void {
    for (const binding of this.strokes) {
      if (!binding.batch || !binding.slot || !this.clipOfMesh.has(binding.ribbon.mesh)) continue
      binding.batch.hideStroke(binding.slot)
      binding.ribbon.mesh.layers.set(0)
      binding.batch = undefined
      binding.slot = undefined
    }
  }
  /** The batched-ribbon runs, in attach order — present only when instancing is on. */
  private readonly ribbonBatches: RibbonBatch[] = []
  /** The run strokes are joining at attach; a fill closes it. */
  private openBatch?: RibbonBatch
  /** The table + material every run shares (ribbon-batch.ts BatchTable). */
  private batchTable?: BatchTable

  /** A fill's renderOrder — and the end of the open ribbon run. */
  private claimFillOrder(): number {
    this.openBatch = undefined
    return this.nextFillOrder++
  }
  /**
   * Scratch for the batch pack loop: one modelView matrix, reused every
   * stroke every frame, so the batch path makes no per-frame garbage.
   */
  private readonly batchMv = new THREE.Matrix4()
  /** Per batch, this frame's dots already drawn (perf I-1, packRibbonBatch). */
  private readonly batchDots = new Map<RibbonBatch, Set<string>>()

  /**
   * ADDITIVE off-screen cull (perf #2): hide ribbon meshes that are
   * PROVABLY, wholly outside the view frustum, on top of — never instead
   * of — style()'s existing `fraction > erased && opacity > 0` rule.
   *
   * The byte-identity contract is the whole point: a ribbon that
   * contributes a single scored pixel must NOT be culled. Two guards make
   * that safe:
   *
   *  - Only strokes style() already left VISIBLE are considered. A ribbon
   *    hidden by the draw/erase/opacity rule stays hidden; nothing here
   *    turns anything back on.
   *  - The test volume is a padded bounding sphere over the LOCAL polyline
   *    (RibbonStroke.boundsCenter/boundsRadius, recomputed only when the
   *    shape changes). The center is carried to world by the mesh's world
   *    matrix; the radius is scaled by the group's max world scale and
   *    then PADDED — the SDF ribbon paints out to the stroke's screen-pixel
   *    half-width plus the AA skirt, and that width lives in pixels, not
   *    world units, so we over-estimate its world size generously
   *    (CULL_PAD_PX screen px converted at the sphere's own view depth,
   *    then floored to a world minimum). A sphere the frustum cannot prove
   *    is fully outside is left to the existing rule. Only a padded sphere
   *    entirely outside every frustum plane is hidden.
   *
   * Correctness rests on testing against the SAME matrices the render will
   * use: updateMatrixWorld(true) settles every group's world transform
   * (render calls it again, so no double-apply), and the camera's
   * matrixWorldInverse is refreshed from this frame's syncCamera() before
   * the frustum is built.
   */
  private cullOffscreen(): void {
    if (!this.cullEnabled || this.strokes.length === 0) {
      this.culledOffscreen = 0
      return
    }
    // Settle the camera and build this frame's view-projection. This is the
    // cheap half of the pass, and cullVP is what the idle latch compares on,
    // so it must happen before the latch check.
    this.camera.updateMatrixWorld(true)
    this.cullVP.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)

    // The idle latch: in the pure frame path (no override layer), a frame
    // whose t and camera VP both match the last run that culled NOTHING is
    // bit-identical to it, so its cull result is nothing too — skip the
    // expensive scene settle + sweep. Any change to t or the camera re-arms.
    // The result of skipping is that every mesh keeps the visibility style()
    // set this frame, which — the frame being identical — is the same set the
    // skipped cull would have produced. culledOffscreen stays 0, as it was.
    if (
      this.beforeSync === undefined &&
      this.cullLatchIdle &&
      Object.is(this.frameT, this.cullLatchT) &&
      this.cullVP.equals(this.cullLatchVP)
    ) {
      this.culledOffscreen = 0
      return
    }

    this.culledOffscreen = 0
    // The frustum must be this frame's: the no-cylinder fast path never
    // settles the scene graph, so do it here — unless sync() already did
    // and nothing has moved since (the stroke groups this pass reads are
    // exactly what that settle produced).
    if (!this.matricesSettled) this.settleScene()
    this.cullFrustum.setFromProjectionMatrix(this.cullVP)

    // World units per screen pixel, for the SDF-skirt padding. Perspective:
    // depth-dependent, worldPerPx(d) = 2·d·tan(fov/2)/heightPx, computed
    // per stroke from a cheap distance-to-center (an over-estimate off-axis
    // — the safe direction). Ortho: a frame constant. The whole safety
    // margin is this padding, so both readings deliberately err large.
    const heightPx = this.renderer.domElement.height || 720
    const cam = this.camera
    const persp = cam instanceof THREE.PerspectiveCamera
    const perspFactor = persp ? (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / heightPx : 0
    const orthoPerPx =
      cam instanceof THREE.OrthographicCamera ? (cam.top - cam.bottom) / heightPx : 0
    const camPos = cam.position

    for (const { ribbon, group } of this.awake(this.strokes)) {
      const mesh = ribbon.mesh
      // Additive: never reconsider what style() already hid, and leave
      // empty/uninitialised strokes (radius 0) to the existing rule.
      if (!mesh.visible || ribbon.boundsRadius <= 0) continue

      // Local sphere → world. Center by the group's world matrix — the
      // ribbon mesh has identity local transform, so this equals its
      // mesh.matrixWorld, and in the instanced path the mesh is not
      // parented (so its own matrixWorld is never settled); the group's is
      // the authoritative frame in both paths. Radius by the group's max
      // world scale (uniform in this corpus, but read the three axes so a
      // non-uniform scale still bounds).
      this.cullCenter.copy(ribbon.boundsCenter).applyMatrix4(group.matrixWorld)
      this.cullScale.setFromMatrixScale(group.matrixWorld)
      const maxScale = Math.max(
        Math.abs(this.cullScale.x),
        Math.abs(this.cullScale.y),
        Math.abs(this.cullScale.z),
      )
      let radius = ribbon.boundsRadius * maxScale

      // Pad for the SDF's screen-pixel skirt. widthPx is a CSS-pixel
      // DIAMETER; the shader's pad is halfWidth + AA + 1px (ribbon.ts).
      const widthPx = (mesh.userData[RIBBON_KEYS.widthPx] as number) || 0
      const padPx = widthPx * 0.5 + ThreeHost.CULL_PAD_PX
      const worldPerPx = persp ? this.cullCenter.distanceTo(camPos) * perspFactor : orthoPerPx
      radius += padPx * worldPerPx

      this.cullSphere.set(this.cullCenter, radius)
      if (!this.cullFrustum.intersectsSphere(this.cullSphere)) {
        mesh.visible = false
        this.culledOffscreen++
      }
    }

    // Arm the idle latch for the next frame: if this full sweep culled
    // nothing, remember (t, VP) so an identical next frame can skip. Only in
    // the pure path — an override layer can move geometry with t held, which
    // the latch cannot see, so it never engages there. A frame that DID cull
    // leaves the latch disarmed (idle=false), so the pass keeps running while
    // anything is off-screen.
    this.cullLatchIdle = this.beforeSync === undefined && this.culledOffscreen === 0
    if (this.cullLatchIdle) {
      this.cullLatchT = this.frameT
      this.cullLatchVP.copy(this.cullVP)
    }
  }

  /**
   * One arrowhead, sized in screen pixels and parked at the pen.
   *
   * The cap polygon lives in the Line's local space, so its pixel size is
   * whatever the projection makes of it there; `unitsPerPixel` inverts
   * that reading — local units per screen pixel at the head's own
   * position — so the same S&T factors give the same rendered cap
   * whatever the depth or the holon's scale.
   */
  private syncArrow(binding: ArrowBinding): void {
    const { holon, fill, atStart, group } = binding
    // The head rides the pen: it sits at whatever fraction of the line
    // is currently drawn, so it travels with the draw front and, as the
    // erase front eats the tail, keeps station at the surviving end.
    // Its position changes every frame, so the shapeKey cache cannot
    // gate the rebuild — only the visibility can.
    const creation = holon.creation.value
    const erasure = holon.erasure.value
    // Only the DRAW front carries the head. The erase front does not:
    // f0430/f0432/f0434 keep the S04 gradient's head parked at its
    // destination (cols 960-967) while the tail retreats behind it —
    // the head belongs to the stroke's end, and erasing eats the start.
    // The pen's position along the line is the SCREEN-arc
    // reparametrisation of `creation` — the same reading the ribbon
    // takes (screenArc / render/screen-arc.ts). Walking the raw fraction
    // here put the cap wherever world arc length says, which is a
    // different place entirely on a line most of whose world length
    // falls off-frame: S01's y-axis runs world y = -2000 → +400 and
    // starts a thousand pixels below the viewport, so at the first frame
    // of its Create the reference draws its cap at screen y ≈ 712 (the
    // bottom edge — the first visible point) while world arc put ours
    // off-screen entirely. refs/video-01/frames5 f0090-f0094 track that
    // cap up the frame at y = 712, 700, 646, 590, 509.
    const drawn = binding.stroke ? this.screenArc(binding.stroke, creation) : creation
    // The START head is parked at 1, not 0 — and the asymmetry with
    // `drawn` is two separate facts, not one.
    //
    // The `drawn` half is the comment above: only the draw front carries
    // a head, and the pen has ALREADY passed the start end (it left from
    // there), so a start head never rides the front. It is parked.
    //
    // The 1 is where it is parked, and 0 is the wrong end. Both
    // `walkTo` and `arrowPolygon` take the point list already REVERSED
    // for a start head (`atStart ? [...points].reverse() : points`), so
    // progress 0 walks to the reversed list's first point — which is the
    // line's LAST point, on top of the end head. A line with both heads
    // rendered as a bare line with a DIAMOND at its right end (two
    // triangles back to back) and nothing at its left. Progress 1 walks
    // the reversed list to its far end, which is the line's start.
    //
    // Never caught because nothing used `arrowStart` until Scene07's
    // "code ↔ idea" link (f_01230); the only other mention in the repo
    // asserts it false (test/section.test.ts). Reported by O-7 with the
    // walk replicated on a -100 → +100 line, and confirmed the same way.
    const progress = atStart ? 1 : drawn
    const present = atStart
      ? clamp01(creation / 0.02) * (1 - clamp01(erasure / 0.02))
      : clamp01(creation / 0.02) * (1 - clamp01((erasure - 0.92) / 0.08))
    if (present > 0) {
      binding.shapeKey = arrowKey(holon)
      const walked = walkTo(atStart ? [...holon.points].reverse() : holon.points, progress)
      // The cap is a screen-space triangle, so its two axes are measured
      // separately: its length runs ALONG the line (foreshortened when
      // the line recedes) and its width across the line as seen.
      const viewLocal = this.viewDirectionIn(group)
      const along = walked ? this.unitsPerPixelAt(group, walked.tip, walked.dir) : 1
      const side = walked
        ? new THREE.Vector3().crossVectors(walked.dir, viewLocal)
        : new THREE.Vector3()
      const across = walked ? this.unitsPerPixelAt(group, walked.tip, side) : 1
      const polygon = arrowPolygon(
        holon.points,
        atStart,
        holon.arrowSize.value,
        progress,
        along,
        viewLocal,
        across,
      )
      if (polygon) fill.setPolygon(polygon)
    }
    // The head is seen as its line is (certainty.ts): read the line's seen opacity.
    const seen = binding.stroke ? binding.stroke.look.opacity.value : holon.opacity.value
    fill.style(present * seen, liftTint(holon.tint.value, this.highlightOf(holon)))
  }

  /** The camera's view direction expressed in a group's local frame. */
  private viewDirectionIn(group: THREE.Object3D): THREE.Vector3 {
    const forward = this.camera.getWorldDirection(new THREE.Vector3())
    const inverse = new THREE.Matrix3().setFromMatrix4(group.matrixWorld).invert()
    return forward.applyMatrix3(inverse).normalize()
  }

  /**
   * Local units per rendered pixel at a point in a group's local space —
   * the inverse of the projection's magnification there. Measured, not
   * derived: step one local unit sideways in screen space and read how
   * far the projected point moved. That covers perspective foreshortening,
   * orthographic framing and any holon scaling on the way down, with one
   * expression and no special cases.
   */
  private unitsPerPixelAt(
    group: THREE.Object3D,
    localPoint: THREE.Vector3,
    /**
     * The LOCAL direction to measure along. Omitted, the reading is taken
     * across the view axis — the isotropic answer, right for anything
     * facing the camera. A direction that recedes from the camera
     * projects SHORTER, and geometry laid along it (an arrowhead on an
     * axis running into the screen) needs that foreshortening in its
     * reading or it renders a fraction of its intended pixel size.
     */
    localDir?: THREE.Vector3,
  ): number {
    const width = this.renderer.domElement.width || 1280
    const height = this.renderer.domElement.height || 720
    // Scratch objects (called per Text and per uncertain stroke, every frame):
    // the same operations on reused vectors, so the same floats.
    const { world, basis, sideWorld, forward, a, b } = UPP
    world.copy(localPoint).applyMatrix4(group.matrixWorld)
    basis.setFromMatrix4(group.matrixWorld)
    sideWorld.set(0, 0, 0)
    if (localDir && localDir.lengthSq() > 1e-12) {
      sideWorld.copy(localDir).applyMatrix3(basis)
    }
    if (sideWorld.lengthSq() < 1e-12) {
      // A step whose world direction is perpendicular to the view — the
      // isotropic reading, with no degenerate head-on case.
      this.camera.getWorldDirection(forward)
      sideWorld.crossVectors(forward, UPP.up)
      if (sideWorld.lengthSq() < 1e-12) sideWorld.set(1, 0, 0)
    }
    sideWorld.normalize()
    a.copy(world).project(this.camera)
    b.copy(world).add(sideWorld).project(this.camera)
    // NDC spans 2 units across each viewport axis.
    const pixels = Math.hypot((b.x - a.x) * (width / 2), (b.y - a.y) * (height / 2))
    if (!Number.isFinite(pixels) || pixels <= 1e-9) return 1
    // …and back into the group's local units, which the world step is
    // not stated in when the holon carries a scale.
    const scale = UPP.scale.setFromMatrixScale(group.matrixWorld).x || 1
    return 1 / (pixels * scale)
  }

  /**
   * The 2021 projection, rebuilt from pydeation's rig (see dream.ts for the
   * derivation and citations). The camera orbits the focus point (observer
   * x, y) at `radius`: `phi` azimuth about +Y, `theta` elevation, and at
   * phi = theta = 0 it sits on -Z looking toward +Z — the convention of the
   * modern C4D rig (objects/camera_objects.py:217-221). `tilt` then rolls
   * it about its own view axis, which is what a FROZEN bank does: it turns
   * the picture, it does not orbit the camera.
   *
   * Perspective zoom is realized as distance (radius / zoom), never as
   * focal length; orthographic zoom is the CAMERA_ZOOM framing ratio.
   */
  private syncCamera(): void {
    const obs = this.dream.observer
    const phi = obs.phi.value
    const theta = obs.theta.value
    const zoom = obs.zoom.value
    const ortho = obs.orthographic.value
    // Pan: the observer's x/y slide the focus point across the view plane,
    // which is what pydeation's camera_position (x, z in its top-view world)
    // does. the focus honours observer.z — defaults 0, so every legacy scene is untouched; the 2021 rig's camera-pedestal maps through it (o8 derivation).
    const focus = new THREE.Vector3(obs.x.value, obs.y.value, obs.z.value)

    // Orthographic framing is set by zoom alone, so the distance only has to
    // clear the geometry; perspective framing IS the distance.
    const r = ortho ? obs.radius.value : obs.radius.value / (zoom || 1)
    // The framework's long-standing spherical convention — unchanged, so
    // existing scenes orbit exactly as they did.
    const offset = new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(theta),
      r * Math.cos(phi) * Math.cos(theta),
    )

    const camera = this.selectCamera(ortho)
    camera.position.copy(focus).add(offset)
    camera.up.set(0, 1, 0)
    camera.lookAt(focus)
    // Roll about the view axis (applied after lookAt, in camera space).
    if (obs.tilt.value !== 0) camera.rotateZ(obs.tilt.value)

    const aspect = this.aspect()
    if (camera instanceof THREE.OrthographicCamera) {
      const halfH = orthoHalfHeight(zoom || 1, aspect)
      const halfW = halfH * aspect
      camera.left = -halfW
      camera.right = halfW
      camera.top = halfH
      camera.bottom = -halfH
      camera.zoom = 1
    } else {
      camera.aspect = aspect
      // The observer states fov the way three.js does: vertically.
      camera.fov = THREE.MathUtils.radToDeg(obs.fov.value)
      camera.zoom = 1
    }
    camera.updateProjectionMatrix()
  }

  /** Scenes are composed for 16:9 and letterboxed, never re-framed. */
  private aspect(): number {
    return 16 / 9
  }

  /** Swap the active camera when the observer's projection mode changes. */
  private selectCamera(ortho: boolean): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    this.camera = ortho ? this.orthoCamera : this.perspCamera
    return this.camera
  }

  private syncCylinder(binding: CylinderBinding): void {
    const { holon, group, farCap, nearBack, nearFront, lineA, lineB } = binding
    const radius = holon.radius.value
    const height = holon.height.value

    // The silhouette generators, from the camera in cylinder-local space.
    const camLocal = group.worldToLocal(this.camera.position.clone())
    const angles = silhouetteAngles(camLocal.x, camLocal.z, radius)

    // WHICH CAP IS NEAR is what orders the whole draw, and the camera
    // decides it: `camLocal.y` is the camera's height along the
    // cylinder's own axis, so the cap at +h/2 is the nearer one exactly
    // when camLocal.y > 0. Nothing about local "top" and "bottom"
    // survives the cylinder turning — and in Scene 06 it turns a full
    // revolution — so the roles are stated against the camera and
    // recomputed whenever it moves.
    const nearY = camLocal.y >= 0 ? height / 2 : -height / 2
    const farY = -nearY

    const thetaA = angles?.thetaA ?? 0
    const thetaB = angles?.thetaB ?? Math.PI
    if (
      radius !== binding.capRadius ||
      height !== binding.capHeight ||
      thetaA !== binding.thetaA ||
      thetaB !== binding.thetaB ||
      nearY !== binding.nearY
    ) {
      const v3 = (p: [number, number, number]) => new THREE.Vector3(...p)

      // THE PEN PATH, measured — not fitted — off Scene 06's own 2s
      // cylinder Create, which is the cleanest instance in the whole
      // reference: a STATIC cylinder (nothing else is moving), at a pose
      // the calibrated camera reproduces to the pixel, drawn alone on
      // black over eleven frames (frames5 f0494-f0504).
      //
      // Method: project the cylinder's two cap circles under the solved
      // camera, walk each at 0.5-degree steps, and ask of every frame
      // which steps are lit. Indices run from thetaA (0) with INCREASING
      // theta; thetaB lands at index 330 of 720. The result, per frame:
      //
      //   frame   near cap lit          far cap lit
      //   f0494   [321..332]   n=12     —
      //   f0495   [264..332]   n=69     —
      //   f0496   [185..332]   n=148    —
      //   f0497   [ 93..332]   n=240    —
      //   f0498   n=338  (0..330 whole) n=70   from index 0, increasing
      //   f0499   n=338  FROZEN         n=338
      //   f0500   n=338  FROZEN         n=634
      //   f0501   n=338  FROZEN         n=721  (closed)
      //   f0502   n=655                 n=721
      //   f0503   n=721  (closed)       n=721
      //
      // and, sampling the two generators along their length,
      //
      //   generator B fills from its FAR end toward the near cap
      //               (f0500 -> f0502)
      //   generator A fills from its NEAR end toward the far cap
      //               (f0503 -> f0504)
      //
      // Read as a pen that is put down five times, that is:
      //
      //   1. near cap, thetaB -> thetaA DECREASING  (the camera-facing
      //      arc, 165 degrees here) — the first ink of the scene
      //   2. far cap, thetaA all the way round INCREASING (one closed
      //      loop; it is never interrupted)
      //   3. generator B, far end -> near end
      //   4. near cap, thetaB -> thetaA INCREASING (the away-facing arc,
      //      the complement, 195 degrees here)
      //   5. generator A, near end -> far end
      //
      // WHY THE NEAR CAP SPLITS AND THE FAR CAP DOES NOT is S&T's own
      // stroke connection, and it follows from the source rather than
      // from the frames. pydeation sets CONNECTIIONZ = 3 (match in
      // world), JOIN_ANGLE_LIMIT = PI and CLOSECONNECTION = True
      // (refs/pydeation-legacy/object/object.py:203-205), so contour
      // edges that touch are joined into longer strokes, preferring the
      // smallest turn. At a silhouette junction the generator meets the
      // cap TANGENTIALLY on screen — that is what a silhouette is — so
      // measured at this pose the turn to the generator is 0.5 degrees
      // against 1.0 degrees for the cap's own continuation: the join
      // takes the generator, and it takes it on ONE side only, which is
      // the side the cap's contour is already heading. On the far cap
      // both junctions choose the SAME arc, so its other arc is left
      // joined to it and the loop survives whole; on the near cap they
      // choose opposite arcs and the loop is cut in two. The asymmetry
      // is the two caps' opposite orientation with respect to the
      // camera, which is why this is stated camera-relatively.
      //
      // The `stroke_order` that then sequences the five is pydeation's
      // own default, "bottom_top" (object.py:90) — S&T mode 3.
      // WHICH of the near cap's two arcs the pen takes first is settled
      // by Scene 01, whose Create is the only one in the reference where
      // the near cap is drawn alone for five clear frames (f0031-f0035,
      // nothing else lit). It takes the AWAY-facing arc first.
      //
      // Projecting this cylinder's top cap under the solved camera —
      // pose p=0.4 b=0.1, held fixed through the whole Create — the two
      // arcs land on opposite sides of the ellipse:
      //
      //   thetaA -> thetaB (camera-facing)   screen y 251 -> 307  (LOWER)
      //   thetaB -> thetaA the other way     screen y 297 -> 240  (UPPER)
      //
      // and the reference's ink starts at (531,277) and runs to (641,217)
      // by f0035 — the UPPER side, i.e. the away-facing arc. Drawing the
      // camera-facing arc first puts our ink on the far side of the same
      // ellipse from the reference's: coverage_ref 0.83 -> 0.047 on
      // f0035, and scene mean 0.9826/0.9888 -> 0.9433/0.9503.
      //
      // (Scene 06's f0494-f0497 were read the other way round. Both
      // scenes agree the near cap SPLITS and the far cap does not; they
      // are only being read differently about which half comes first,
      // and Scene 01 is the cleaner read of the two because its near cap
      // is the only thing on screen while it is drawn.)
      //
      // KNOWN OPEN CONFLICT — the two readings are BOTH measurements, and
      // they disagree because the POSES disagree. Scene 06's cylinder is
      // p=PI/2 (lying along the depth axis); Scene 01's is p=0.4 b=0.1
      // (nearly upright). Scene 06's read is at least as clean as Scene
      // 01's — its cylinder is static, alone on black for eleven frames
      // (f0494-f0504), and the calibrated camera reproduces its pose to
      // the pixel — and it says the CAMERA-FACING arc goes first: walking
      // both cap circles at 0.5-degree steps, the near cap lights indices
      // 332->0 over f0494-f0498 (decreasing theta, the short arc through
      // the camera azimuth), FREEZES at 338 through f0501 while the far
      // cap runs 70->721, then jumps to 655 (f0502) and 721 (f0503).
      //
      // Scored on Scene 06 at step 1 (68 frames), the two choices trade
      // the SAME pass rate for very different quality:
      //
      //   away-facing first (this code) 61/68, mean cov ref 0.930
      //   camera-facing first           61/68, mean cov ref 0.9999
      //
      // — i.e. with Scene 06's own reading every reference pixel is
      // reproduced on every frame of the scene, and its seven failures
      // are purely the pen running ahead (coverage_ours 0.53-0.81 on
      // f0495-f0501), whereas this code's seven failures are the arc
      // drawn on the wrong side of the ellipse (coverage_ref 0.02-0.15).
      //
      // Neither reading is wrong about its own scene, so the rule that
      // separates them has NOT been found. pydeation's stroke_order
      // default "bottom_top" (object.py:90) was tested as that rule by
      // every screen-y key available — bottom-most point, centre, start
      // point — and none reproduces either observed sequence, let alone
      // both. The likely place it hides is one level earlier, in how
      // CONNECTIIONZ=3 / JOIN_ANGLE_LIMIT=PI / CLOSECONNECTION=True
      // (object.py:203-205) chain the six contour edges into strokes
      // BEFORE stroke_order sequences them: at a silhouette junction the
      // generator meets the cap tangentially on screen (measured 0.5
      // degrees of turn against the cap's own 1.0), so the join prefers
      // the generator, and which arc that orphans depends on the pose.
      // Deriving that properly is the fix; fitting a pose-dependent
      // switch to two scenes would encode nothing and is refused.
      const nearSweep = thetaB - thetaA
      nearFront.setPoints(
        capArc(radius, nearY, thetaB, Math.PI * 2 - nearSweep, CYLINDER_ROTATION_SEGMENTS).map(v3),
      )
      // nearFront ends on thetaA (it went the long way from thetaB), so
      // nearBack is the SHORT way back: thetaA -> thetaB, the
      // camera-facing arc. The two still meet at both generators.
      nearBack.setPoints(
        capArc(radius, nearY, thetaA, nearSweep, CYLINDER_ROTATION_SEGMENTS).map(v3),
      )
      farCap.setPoints(capPolylineFrom(radius, farY, thetaA, false).map(v3))
      binding.capRadius = radius
      binding.capHeight = height
      binding.thetaA = thetaA
      binding.thetaB = thetaB
      binding.nearY = nearY
    }

    if (angles) {
      // Generator B runs FAR -> NEAR; generator A runs NEAR -> FAR. Both
      // directions are read off the reference (see the pen path above).
      const set = (line: RibbonStroke, theta: number, fromNear: boolean) => {
        const nearEnd = new THREE.Vector3(...generatorPoint(theta, radius, nearY))
        const farEnd = new THREE.Vector3(...generatorPoint(theta, radius, farY))
        line.setPoints(fromNear ? [nearEnd, farEnd] : [farEnd, nearEnd])
      }
      set(lineA, angles.thetaA, true)
      set(lineB, angles.thetaB, false)
    }

    // Draw-on: the five strokes run sequentially inside the holon's one
    // `creation`, in the pen order above:
    //
    //   near FRONT arc -> far cap -> generator B -> near BACK arc -> generator A
    //
    // The erase front consumes them through the same partition.
    //
    // PROPORTIONING. pydeation animates with stroke_method "single" and
    // sketch_speed "completion" (object.py:423, 198-199), which is S&T
    // metering one pen across the strokes by LENGTH. The generators are
    // the only place a rule can be got wrong, since the cap arcs are
    // fixed multiples of one another, and the reference settles it
    // arithmetically rather than by fitting: with the pen's speed known
    // from the far cap (0.371 and 0.411 of a full cap circle over the
    // eased-creation intervals f0498-99 and f0499-500, i.e. 2.85 and
    // 3.09 circles per unit of creation) and from generator B over its
    // own interval (0.761 of the generator over f0500-501, 5.84
    // generators per unit), one generator is 2.97/5.84 = 0.51 cap
    // circles. The cylinder's own geometry says 2r/(2*pi*r) = 0.318 in
    // WORLD length and, at this pose, 0.50 in SCREEN length. Screen
    // length it is — and that is the same rule screen-arc.ts derived for
    // metering WITHIN a stroke, now simply applied BETWEEN them too, so
    // the cylinder stops being the one primitive with two rules.
    const mantleVisible = angles !== undefined
    const w = [
      this.screenLength(nearFront),
      this.screenLength(farCap),
      mantleVisible ? this.screenLength(lineB) : 0,
      this.screenLength(nearBack),
      mantleVisible ? this.screenLength(lineA) : 0,
    ]
    const totalW = w.reduce((a, b) => a + b, 0) || 1
    const bounds = [0]
    let acc = 0
    for (const x of w) {
      acc += x / totalW
      bounds.push(acc)
    }
    bounds[bounds.length - 1] = 1

    const creation = holon.creation.value
    const erasure = holon.erasure.value
    const opacity = seenOf(holon).value
    const lift = this.highlightOf(holon)
    const tint: Color = liftTint(holon.tint.value, lift)
    const width = holon.stroke.value * (1 + 2 * lift)
    const window = (v: number, a: number, b: number) =>
      b <= a ? (v >= b ? 1 : 0) : Math.min(1, Math.max(0, (v - a) / (b - a)))
    // WITHIN a stroke the pen advances by SCREEN pixels, exactly as
    // render/screen-arc.ts derived for every other stroke — the cylinder
    // is not an exception, and the reference says so on this very draw.
    // Through the near cap's own phase the new ink per frame, divided by
    // the eased creation the frame advanced, is flat:
    //
    //     f0495  dCreation 0.056  new ink 245px
    //     f0496            0.075          520
    //     f0497            0.103          650
    //
    // A pen metering WORLD arc would vary by the ellipse's
    // foreshortening — nearly 2:1 between its wide top and its squashed
    // near side — and would not hold flat like that.
    const sub = (line: RibbonStroke, i: number) => {
      const a = bounds[i]!
      const b = bounds[i + 1]!
      const drawn = window(creation, a, b)
      const measured = drawn > 0 && drawn < 1 ? this.measureScreenArc(line) : undefined
      const world = measured
        ? Math.max(0, Math.min(1, measured.remap.worldAt(drawn) / measured.totalWorld))
        : drawn
      line.style(world, opacity, tint, width, window(erasure, a, b))
    }
    sub(nearFront, 0)
    sub(farCap, 1)
    if (mantleVisible) sub(lineB, 2)
    else lineB.style(0, opacity, tint, width, 0)
    sub(nearBack, 3)
    if (mantleVisible) sub(lineA, 4)
    else lineA.style(0, opacity, tint, width, 0)
  }

  // --- Picking (EDITOR-V3 decision 1: "what holon is under this pixel?") ---
  //
  // The host already knows the answer and nobody else can: a DreamTalk
  // stroke has NO pickable geometry in the ordinary sense. Its mesh is a
  // unit quad expanded to a constant SCREEN-PIXEL ribbon entirely inside
  // the vertex shader (ribbon.ts), so a THREE.Raycaster against it
  // reports either nothing or a 2-unit square at the origin. Picking is
  // therefore done where the ink actually is: in screen space, against
  // the very segment buffers the shader reads, at this frame's
  // projection — the same arithmetic the fragment stage does, on the CPU.
  //
  // That is not a workaround, it is the accurate answer: a hit means the
  // cursor is within `stroke/2 + PICK_SLOP` pixels of drawn ink, which is
  // exactly what the eye sees. Thin strokes (video-01 runs 1.4-2.9px) get
  // the slop as a fat, forgiving target without the *deep* choice below
  // ever becoming imprecise.

  /** Extra pixels of forgiveness around a stroke's own half-width. */
  private static readonly PICK_SLOP = 7

  /**
   * Screen-pixel safety margin the off-screen cull adds beyond the
   * stroke's own half-width (cullOffscreen). It absorbs the SDF's AA
   * skirt + 1px guard (ribbon.ts pad is halfWidth + AA_PX + 1) with room
   * to spare, plus the looseness in a min-AABB-radius bounding sphere and
   * any float slack in the projection reading — err large, since keeping
   * a ribbon that could have been culled is free but culling one that
   * shows ink fails the byte-identity gate. 16px is many times the ~2px
   * the shader can actually paint beyond the line.
   */
  private static readonly CULL_PAD_PX = 16

  /**
   * The layer the per-mesh ribbon meshes sit on when instancing is ON —
   * one the camera does not render (cameras test layer 0 only). It keeps
   * each stroke's mesh in the scene graph (so its world matrix updates for
   * screenArc, byte-identically to the oracle) while the renderer draws
   * only the single batch mesh (which stays on layer 0). Any layer but 0.
   */
  private static readonly BATCH_LAYER = 1

  /**
   * The holon under a viewport point, or undefined over empty space.
   *
   * `ndcX`/`ndcY` are normalized device coordinates (-1..1, y up) — what
   * a click on the canvas converts to. Only ink that is actually visible
   * at the current t can be hit: invisible meshes, un-drawn spans and
   * erased spans are all skipped, so clicking where a stroke *will be*
   * selects nothing, which is what direct manipulation means.
   *
   * Ties break toward the DEEPEST holon (a part over its whole) and then
   * toward the closest ink, so clicking an Eye's pupil selects the pupil
   * and clicking one grid line of an Axes selects that Line.
   *
   * FAST, EXACT (pickcull.ts): each buffer's local chunk boxes (cached until
   * its geometry changes) are projected first; ink whose box cannot come
   * within the tolerance of the cursor is never measured, and a holon
   * shallower than the best so far is never measured either. Same answers
   * as `pickReference` (the exhaustive pick), ~70 ms → ~1 ms in the gallery.
   */
  pick(ndcX: number, ndcY: number): Holon | undefined {
    const width = this.renderer.domElement.width || 1280
    const height = this.renderer.domElement.height || 720
    const px = ((ndcX + 1) / 2) * width
    const py = ((1 - ndcY) / 2) * height
    // Settled since the last frame and no node added or removed since: every
    // world matrix already is the float a forced update would make (perf F)
    // — skip the walk over every node (~8k in the gallery, ~2.5 ms).
    if (!this.matricesSettled || this.settledStructure !== structureEpoch) this.scene.updateMatrixWorld(true)
    this.pickViewProjection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)
    this.pickModel.fill(NaN) // the view may have moved since the last pick

    let best: { holon: Holon; depth: number; distance: number } | undefined
    const consider = (holon: Holon, distance: number, tolerance: number) => {
      if (distance > tolerance || this.asleep(holon)) return
      const depth = this.depthOf(holon)
      // Deeper wins outright; at equal depth, nearer ink wins.
      if (best && (best.depth > depth || (best.depth === depth && best.distance <= distance))) return
      best = { holon, depth, distance }
    }
    // A holon shallower than the best so far cannot win: skip measuring it.
    const outranked = (holon: Holon) => best !== undefined && this.depthOf(holon) < best.depth

    for (const binding of this.strokes) {
      if (outranked(binding.holon)) continue
      // The raw holon's param, kept on the binding: the same value, without the proxy's
      // and the internals lookup's toll on every read (7k strokes in the gallery).
      const strokeWidth = (binding.pickWidth ??= rawHolon(binding.holon).stroke)
      const tolerance = strokeWidth.value / 2 + ThreeHost.PICK_SLOP
      consider(binding.holon, this.ribbonDistanceCulled(binding.ribbon, px, py, width, height, tolerance), tolerance)
    }
    for (const binding of this.cylinders) {
      if (outranked(binding.holon)) continue
      const tolerance = binding.holon.stroke.value / 2 + ThreeHost.PICK_SLOP
      for (const ribbon of [binding.farCap, binding.nearBack, binding.nearFront, binding.lineA, binding.lineB]) {
        consider(binding.holon, this.ribbonDistanceCulled(ribbon, px, py, width, height, tolerance), tolerance)
      }
    }
    for (const binding of this.fills) {
      if (outranked(binding.holon)) continue
      consider(binding.holon, this.fillDistanceCulled(binding.fill, px, py, width, height), 0)
    }
    for (const binding of [...this.washes, ...this.drawingWashes]) {
      // A hidden fill (its style left it invisible: opacity 0) fails the
      // opacity test too — known without reading its derived look.
      if (!binding.fill.mesh.visible) continue
      if (binding.look.fillOpacity.value * binding.look.opacity.value <= 0.01) continue
      if (outranked(binding.holon)) continue
      consider(binding.holon, this.fillDistanceCulled(binding.fill, px, py, width, height), 0)
    }
    for (const binding of this.surfaces) {
      if (!binding.fill.mesh.visible) continue
      if (binding.holon.fillOpacity.value * seenOf(binding.holon).value <= 0.01) continue
      if (outranked(binding.holon)) continue
      consider(binding.holon, this.fillDistanceCulled(binding.fill, px, py, width, height), 0)
    }
    for (const binding of this.arrows) {
      if (outranked(binding.holon)) continue
      consider(binding.holon, this.fillDistanceCulled(binding.fill, px, py, width, height), 0)
    }
    for (const { binding, group } of this.texts) {
      if (outranked(binding.holon)) continue
      consider(binding.holon, this.groupScreenDistance(group, px, py, width, height, true), 0)
    }
    return best?.holon
  }

  /**
   * The exhaustive pick — every segment and triangle of every visible
   * binding projected — kept verbatim as the oracle the fast `pick` must
   * agree with (scripts/pick-gate.ts).
   */
  pickReference(ndcX: number, ndcY: number): Holon | undefined {
    const width = this.renderer.domElement.width || 1280
    const height = this.renderer.domElement.height || 720
    const px = ((ndcX + 1) / 2) * width
    const py = ((1 - ndcY) / 2) * height
    this.scene.updateMatrixWorld(true)

    let best: { holon: Holon; depth: number; distance: number } | undefined
    const consider = (holon: Holon, distance: number, tolerance: number) => {
      if (distance > tolerance || this.asleep(holon)) return
      const depth = this.depthOf(holon)
      // Deeper wins outright; at equal depth, nearer ink wins.
      if (best && (best.depth > depth || (best.depth === depth && best.distance <= distance))) return
      best = { holon, depth, distance }
    }

    for (const binding of this.strokes) {
      consider(
        binding.holon,
        this.ribbonDistance(binding.ribbon, px, py, width, height),
        binding.holon.stroke.value / 2 + ThreeHost.PICK_SLOP,
      )
    }
    for (const binding of this.cylinders) {
      const tolerance = binding.holon.stroke.value / 2 + ThreeHost.PICK_SLOP
      for (const ribbon of [binding.farCap, binding.nearBack, binding.nearFront, binding.lineA, binding.lineB]) {
        consider(binding.holon, this.ribbonDistance(ribbon, px, py, width, height), tolerance)
      }
    }
    // Fills are real triangles, so they pick as areas: inside = distance 0.
    for (const binding of this.fills) {
      consider(binding.holon, this.fillDistance(binding.fill, px, py, width, height), 0)
    }
    // A stroke's WASH (its fillOpacity interior: a filled dot), a drawing's
    // even-odd fill (a word) and a Surface (a mesh's fill) are areas too —
    // clicking the middle of a filled shape picks it. Only while the fill
    // is actually seen: a hidden form's fills must not steal the click.
    for (const binding of [...this.washes, ...this.drawingWashes]) {
      if (binding.look.fillOpacity.value * binding.look.opacity.value <= 0.01) continue
      consider(binding.holon, this.fillDistance(binding.fill, px, py, width, height), 0)
    }
    for (const binding of this.surfaces) {
      if (binding.holon.fillOpacity.value * seenOf(binding.holon).value <= 0.01) continue
      consider(binding.holon, this.fillDistance(binding.fill, px, py, width, height), 0)
    }
    for (const binding of this.arrows) {
      consider(binding.holon, this.fillDistance(binding.fill, px, py, width, height), 0)
    }
    for (const { binding, group } of this.texts) {
      consider(binding.holon, this.groupScreenDistance(group, px, py, width, height), 0)
    }
    return best?.holon
  }

  // --- Picking in 3D: the nearest ink to a point, the first along a ray -----
  //
  // For a hand's spark, which stands in space. The same ink as `pick`, by the
  // same rules — what you cannot see you cannot touch: invisible meshes, the
  // undrawn and erased spans of a stroke, hidden washes and surfaces, and
  // sleeping roots stay out. Each buffer's local chunk boxes (pickcull.ts)
  // become world boxes, cached until the buffer or its world matrix changes,
  // so a query measures only the ink near it (pickworld.ts).

  /**
   * The nearest visible ink within `radius` (world units) of `point`: its
   * holon, the distance, and the nearest point on the ink. Nearest wins;
   * within 5% of the radius of the nearest, the deeper holon wins (a pupil
   * inside its eye). `accept` narrows what counts (a spark wants ink with a
   * walkable owner): a rejected holon is no candidate at all, so the answer
   * is the nearest ACCEPTED ink; asked once per holon per query.
   */
  pickNear(
    point: THREE.Vector3,
    radius: number,
    opts: { exhaustive?: boolean; accept?: (holon: Holon) => boolean } = {},
  ): { holon: Holon; distance: number; at: THREE.Vector3 } | undefined {
    this.settleForPick()
    const accepted = acceptance(opts.accept)
    // `exhaustive` measures every piece, no box skipped — the oracle the culled query is gated against.
    const far = (dist: number) => !opts.exhaustive && dist > radius
    const px = point.x
    const py = point.y
    const pz = point.z
    const near = new Map<Holon, { distance: number; at: [number, number, number] }>()
    const offer = (holon: Holon, distance: number, x: number, y: number, z: number) => {
      if (!accepted(holon)) return
      const had = near.get(holon)
      if (!had || distance < had.distance) near.set(holon, { distance, at: [x, y, z] })
    }
    const p: [number, number, number] = [px, py, pz]
    this.forEachInk(
      (holon, ribbon) => {
        const w = this.ribbonWorld(ribbon)
        if (!w || far(boxDistance(w.whole, 0, px, py, pz))) return
        for (let k = 0; k < w.n; k++) {
          if (far(boxDistance(w.chunks, k * 6, px, py, pz))) continue
          this.forEachRibbonSegment(ribbon, k * CHUNK, (k + 1) * CHUNK, (ax, ay, az, bx, by, bz) => {
            const [d, u] = pointSegment(px, py, pz, ax, ay, az, bx, by, bz)
            if (d <= radius) offer(holon, d, ax + (bx - ax) * u, ay + (by - ay) * u, az + (bz - az) * u)
          })
        }
      },
      (holon, fill) => {
        // The fill's whole vertex box first (one pass, no triangles): most fills are far.
        const whole = !opts.exhaustive && this.fillWholeWorld(fill)
        if (whole && far(boxDistance(whole, 0, px, py, pz))) return
        const w = this.fillWorld(fill)
        if (!w || far(boxDistance(w.whole, 0, px, py, pz))) return
        for (let k = 0; k < w.n; k++) {
          if (far(boxDistance(w.chunks, k * 6, px, py, pz))) continue
          this.forEachTriangle(fill, k * CHUNK, (k + 1) * CHUNK, (a, b, c) => {
            const [d, x, y, z] = pointTriangle(p, a, b, c)
            if (d <= radius) offer(holon, d, x, y, z)
          })
        }
      },
      (holon, group) =>
        this.forEachGlyphBox(group, (box) => {
          const d = boxDistance(box, 0, px, py, pz)
          if (d <= radius)
            offer(
              holon,
              d,
              Math.min(Math.max(px, box[0]!), box[3]!),
              Math.min(Math.max(py, box[1]!), box[4]!),
              Math.min(Math.max(pz, box[2]!), box[5]!),
            )
        }),
      // The stroke's own bounding sphere first (ribbon.ts computeBounds: the cover the
      // off-screen cull already trusts) — a few multiplies, no cache touched.
      opts.exhaustive
        ? undefined
        : {
            // dist − r ≤ radius, squared (a hair of slack so rounding never drops a sphere the exhaustive pass keeps).
            near: (x, y, z, r) => {
              const ex = x - px
              const ey = y - py
              const ez = z - pz
              const reach = (r + radius) * (1 + 1e-9)
              return ex * ex + ey * ey + ez * ez <= reach * reach
            },
          },
    )
    let nearest = Infinity
    for (const { distance } of near.values()) nearest = Math.min(nearest, distance)
    let best: { holon: Holon; depth: number; distance: number; at: [number, number, number] } | undefined
    for (const [holon, { distance, at }] of near) {
      if (distance > nearest + 0.05 * radius) continue
      const depth = this.depthOf(holon)
      if (!best || depth > best.depth || (depth === best.depth && distance < best.distance)) best = { holon, depth, distance, at }
    }
    return best && { holon: best.holon, distance: best.distance, at: new THREE.Vector3(...best.at) }
  }

  /**
   * The first visible ink along the ray `origin + t·direction` (t ≤
   * maxDistance): its holon, t, and the point. A stroke counts where its
   * centreline passes within its own half-width plus `tolerancePx` pixels of
   * the ray, the pixel measured at that ink's distance from the eye (so a ray
   * from the eye through a screen point agrees with what is drawn there);
   * fills by their triangles, text by its glyph boxes. At equal t the deeper
   * holon wins. `accept`, as for pickNear: only accepted ink counts (none
   * given: any visible ink — what occlusion wants).
   */
  pickRay(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    opts: { maxDistance?: number; tolerancePx?: number; exhaustive?: boolean; accept?: (holon: Holon) => boolean } = {},
  ): { holon: Holon; t: number; at: THREE.Vector3 } | undefined {
    this.settleForPick()
    const accepted = acceptance(opts.accept)
    // `exhaustive`: every piece measured, no box skipped (the gate's oracle).
    const missed = (enter: number) => !opts.exhaustive && (Number.isNaN(enter) || (best !== undefined && enter > best.t))
    const len = direction.length()
    if (!(len > 0)) return undefined
    const dx = direction.x / len
    const dy = direction.y / len
    const dz = direction.z / len
    const ox = origin.x
    const oy = origin.y
    const oz = origin.z
    const tMax = opts.maxDistance ?? Infinity
    const extra = opts.tolerancePx ?? 0
    const eye = this.camera.getWorldPosition(new THREE.Vector3())
    const perPx = this.worldPerPixel()
    const o: [number, number, number] = [ox, oy, oz]
    const d: [number, number, number] = [dx, dy, dz]
    let best: { holon: Holon; t: number; depth: number; at: [number, number, number] } | undefined
    const offer = (holon: Holon, t: number, x: number, y: number, z: number) => {
      if (t > tMax || !accepted(holon)) return
      if (best && t > best.t + 1e-9) return
      const depth = this.depthOf(holon)
      if (best && Math.abs(t - best.t) <= 1e-9 && depth <= best.depth) return
      best = { holon, t, depth, at: [x, y, z] }
    }
    this.forEachInk(
      (holon, ribbon, widthPx) => {
        const tolPx = widthPx / 2 + extra
        const w = this.ribbonWorld(ribbon)
        if (!w) return
        // The pad: the stroke's half-width in pixels at the farthest the box reaches from the eye.
        const whole = tolPx * perPx(boxFarthest(w.whole, 0, eye.x, eye.y, eye.z))
        if (missed(rayNearBox(w.whole, 0, ox, oy, oz, dx, dy, dz, tMax, whole))) return
        for (let k = 0; k < w.n; k++) {
          const pad = tolPx * perPx(boxFarthest(w.chunks, k * 6, eye.x, eye.y, eye.z))
          if (missed(rayNearBox(w.chunks, k * 6, ox, oy, oz, dx, dy, dz, tMax, pad))) continue
          this.forEachRibbonSegment(ribbon, k * CHUNK, (k + 1) * CHUNK, (ax, ay, az, bx, by, bz) => {
            const [dist, t, u] = raySegment(ox, oy, oz, dx, dy, dz, tMax, ax, ay, az, bx, by, bz)
            const x = ax + (bx - ax) * u
            const y = ay + (by - ay) * u
            const z = az + (bz - az) * u
            const ex = x - eye.x
            const ey = y - eye.y
            const ez = z - eye.z
            if (dist <= tolPx * perPx(Math.sqrt(ex * ex + ey * ey + ez * ez))) offer(holon, t, x, y, z)
          })
        }
      },
      (holon, fill) => {
        const whole = !opts.exhaustive && this.fillWholeWorld(fill)
        if (whole && missed(rayNearBox(whole, 0, ox, oy, oz, dx, dy, dz, tMax, 0))) return
        const w = this.fillWorld(fill)
        if (!w || missed(rayNearBox(w.whole, 0, ox, oy, oz, dx, dy, dz, tMax, 0))) return
        for (let k = 0; k < w.n; k++) {
          if (missed(rayNearBox(w.chunks, k * 6, ox, oy, oz, dx, dy, dz, tMax, 0))) continue
          this.forEachTriangle(fill, k * CHUNK, (k + 1) * CHUNK, (a, b, c) => {
            const t = rayTriangle(o, d, a, b, c)
            if (t !== undefined) offer(holon, t, ox + dx * t, oy + dy * t, oz + dz * t)
          })
        }
      },
      (holon, group) =>
        this.forEachGlyphBox(group, (box) => {
          const t = rayNearBox(box, 0, ox, oy, oz, dx, dy, dz, tMax, 0)
          if (!Number.isNaN(t)) offer(holon, t, ox + dx * t, oy + dy * t, oz + dz * t)
        }),
      // The bounding sphere first: skip a stroke the (capped) ray passes farther from than its
      // radius plus its half-width in pixels at the sphere's far side from the eye.
      opts.exhaustive
        ? undefined
        : {
            withWidth: (x, y, z, r, widthPx) => {
              const along = Math.max(0, Math.min(tMax, (x - ox) * dx + (y - oy) * dy + (z - oz) * dz))
              const mx = ox + dx * along - x
              const my = oy + dy * along - y
              const mz = oz + dz * along - z
              const ex = x - eye.x
              const ey = y - eye.y
              const ez = z - eye.z
              const reach = (r + (widthPx / 2 + extra) * perPx(Math.sqrt(ex * ex + ey * ey + ez * ez) + r)) * (1 + 1e-9)
              return mx * mx + my * my + mz * mz <= reach * reach
            },
          },
    )
    const b = best as { holon: Holon; t: number; at: [number, number, number] } | undefined
    return b && { holon: b.holon, t: b.t, at: new THREE.Vector3(...b.at) }
  }

  /** The world matrices a pick reads, current — the same rule as `pick`'s. */
  private settleForPick(): void {
    if (!this.matricesSettled || this.settledStructure !== structureEpoch) {
      this.scene.updateMatrixWorld(true)
      this.inkStale = true
    }
  }

  // --- The strokes' world spheres, flat (the 3D pick's first look) ----------
  //
  // A query's first pass over 7k strokes is memory-bound, not arithmetic:
  // right after a render every binding, ribbon, mesh and matrix it touches
  // is cold. So their world bounding spheres live in one Float64Array, kept
  // current incrementally — a stroke re-shaped by sync() (noteReshaped), a
  // subtree the settle moved (noteMoved: its depth-first node span), or all
  // of them when the graph's structure changed or a forced update ran
  // (inkStale). Visibility, sleep and width are read only for the strokes
  // whose sphere passes.

  private strokeSpheres?: {
    n: number
    structure: number
    /** [x, y, z, r] per stroke (this.strokes order); r < 0: no sphere (always looked at). */
    spheres: Float64Array
    /** Stroke indices sorted by their mesh's depth-first node index, and those node indices. */
    byNode: Int32Array
    nodes: Int32Array
    /** Strokes whose mesh is not in the settle index: recomputed on every query. */
    unindexed: number[]
    /** Stroke meshes among the first k nodes (depth-first): a span [a, b) holds one iff prefix[b] > prefix[a]. */
    prefix: Int32Array
    of: Map<StrokeBinding, number>
  }
  private inkStale = true
  /**
   * The widest awake stroke at the last sync (px) — a ray's pre-cull pad,
   * valid while no param has changed since (paramEpoch === syncedEpoch).
   */
  private widestStroke = 0
  private readonly inkReshaped: StrokeBinding[] = []
  private readonly inkMoved: [number, number][] = []

  private noteReshaped(binding: StrokeBinding): void {
    if (this.inkStale) return
    if (this.inkReshaped.length > 4096) this.inkStale = true
    else this.inkReshaped.push(binding)
  }

  private noteMoved(span: [number, number]): void {
    const idx = this.strokeSpheres
    if (this.inkStale || !idx) return
    // Most settled subtrees (text meshes three keeps auto-updating) hold no stroke at all.
    const prefix = idx.prefix
    if (span[1] >= prefix.length || prefix[span[1]]! === prefix[span[0]]!) {
      if (span[1] < prefix.length) return
      this.inkStale = true // a node past the index: the graph grew
      return
    }
    if (this.inkMoved.length > 4096) this.inkStale = true
    else this.inkMoved.push(span)
  }

  private writeSphere(spheres: Float64Array, i: number, ribbon: RibbonStroke): void {
    const r = ribbon.boundsRadius
    const o = i * 4
    if (!(r > 0)) {
      spheres[o + 3] = -1
      return
    }
    const m = ribbon.mesh.matrixWorld.elements
    const c = ribbon.boundsCenter
    spheres[o] = m[0]! * c.x + m[4]! * c.y + m[8]! * c.z + m[12]!
    spheres[o + 1] = m[1]! * c.x + m[5]! * c.y + m[9]! * c.z + m[13]!
    spheres[o + 2] = m[2]! * c.x + m[6]! * c.y + m[10]! * c.z + m[14]!
    const sx = m[0]! * m[0]! + m[1]! * m[1]! + m[2]! * m[2]!
    const sy = m[4]! * m[4]! + m[5]! * m[5]! + m[6]! * m[6]!
    const sz = m[8]! * m[8]! + m[9]! * m[9]! + m[10]! * m[10]!
    spheres[o + 3] = r * Math.sqrt(Math.max(sx, sy, sz))
  }

  /** The strokes' world spheres, brought current (see above). */
  private strokeSphereIndex() {
    const strokes = this.strokes
    let idx = this.strokeSpheres
    if (!idx || this.inkStale || idx.n !== strokes.length || idx.structure !== structureEpoch || !this.settleIndex) {
      const n = strokes.length
      const spheres = new Float64Array(n * 4)
      const of = new Map<StrokeBinding, number>()
      const pairs: [number, number][] = []
      const unindexed: number[] = []
      for (let i = 0; i < n; i++) {
        const b = strokes[i]!
        of.set(b, i)
        this.writeSphere(spheres, i, b.ribbon)
        const node = this.settleIndex?.get(b.ribbon.mesh)?.[0]
        if (node === undefined) unindexed.push(i)
        else pairs.push([node, i])
      }
      pairs.sort((a, b) => a[0] - b[0])
      const prefix = new Int32Array((this.settleIndex?.size ?? 0) + 1)
      for (const [node] of pairs) prefix[node + 1]!++
      for (let k = 1; k < prefix.length; k++) prefix[k]! += prefix[k - 1]!
      idx = {
        n,
        structure: structureEpoch,
        spheres,
        byNode: Int32Array.from(pairs, (p) => p[1]),
        nodes: Int32Array.from(pairs, (p) => p[0]),
        unindexed,
        of,
        prefix,
      }
      this.strokeSpheres = idx
      this.inkStale = false
      this.inkReshaped.length = 0
      this.inkMoved.length = 0
      return idx
    }
    for (const b of this.inkReshaped) {
      const i = idx.of.get(b)
      if (i !== undefined) this.writeSphere(idx.spheres, i, b.ribbon)
    }
    this.inkReshaped.length = 0
    for (const [from, to] of this.inkMoved) {
      // The first stroke whose node is ≥ from, then every one inside the span.
      let lo = 0
      let hi = idx.nodes.length
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (idx.nodes[mid]! < from) lo = mid + 1
        else hi = mid
      }
      for (let k = lo; k < idx.nodes.length && idx.nodes[k]! < to; k++) {
        const i = idx.byNode[k]!
        this.writeSphere(idx.spheres, i, strokes[i]!.ribbon)
      }
    }
    this.inkMoved.length = 0
    for (const i of idx.unindexed) this.writeSphere(idx.spheres, i, strokes[i]!.ribbon)
    return idx
  }

  /** World units per drawing-buffer pixel at distance `t` from the eye. */
  private worldPerPixel(): (t: number) => number {
    const height = this.renderer.domElement.height || 720
    const cam = this.camera
    if (cam instanceof THREE.PerspectiveCamera) {
      const k = (2 * Math.tan((cam.fov * Math.PI) / 360)) / (cam.zoom * height)
      return (t) => t * k
    }
    const ortho = cam as unknown as THREE.OrthographicCamera
    const span = (ortho.top - ortho.bottom) / (ortho.zoom || 1) / height
    return () => span
  }

  /**
   * Every pickable piece of visible ink, by `pick`'s rules: a ribbon (with
   * its stroke width), a fill, or a text's glyph group. Positional and
   * allocation-free — it runs over every binding (7k strokes in the gallery)
   * on every query.
   */
  private forEachInk(
    ribbonFn: (holon: Holon, ribbon: RibbonStroke, widthPx: number) => void,
    fillFn: (holon: Holon, fill: FillShape) => void,
    glyphFn: (holon: Holon, group: THREE.Object3D) => void,
    /**
     * A cheap first look at a stroke's world bounding sphere: false skips it.
     * `near` reads the flat sphere index (no width needed); `withWidth` is
     * asked per stroke with its sphere computed inline and its width (a
     * ray's pad grows with the stroke's width).
     */
    first?:
      | { near: (x: number, y: number, z: number, r: number) => boolean }
      | { withWidth: (x: number, y: number, z: number, r: number, widthPx: number) => boolean },
  ): void {
    if (first && "near" in first) {
      const { spheres } = this.strokeSphereIndex()
      for (let i = 0, n = this.strokes.length; i < n; i++) {
        const o = i * 4
        const r = spheres[o + 3]!
        if (r > 0 && !first.near(spheres[o]!, spheres[o + 1]!, spheres[o + 2]!, r)) continue
        const binding = this.strokes[i]!
        if (!binding.ribbon.mesh.visible || this.asleep(binding.holon)) continue
        ribbonFn(binding.holon, binding.ribbon, (binding.pickWidth ??= rawHolon(binding.holon).stroke).value)
      }
    } else if (first && this.syncedEpoch === paramEpoch()) {
      // Held since the last sync: every awake stroke is at most `widestStroke` wide, so the
      // flat index with that width is a safe first look; each survivor then answers with its own.
      const { spheres } = this.strokeSphereIndex()
      const widest = this.widestStroke
      for (let i = 0, n = this.strokes.length; i < n; i++) {
        const o = i * 4
        const r = spheres[o + 3]!
        if (r > 0 && !first.withWidth(spheres[o]!, spheres[o + 1]!, spheres[o + 2]!, r, widest)) continue
        const binding = this.strokes[i]!
        if (!binding.ribbon.mesh.visible || this.asleep(binding.holon)) continue
        const widthPx = (binding.pickWidth ??= rawHolon(binding.holon).stroke).value
        if (r > 0 && widthPx < widest && !first.withWidth(spheres[o]!, spheres[o + 1]!, spheres[o + 2]!, r, widthPx)) continue
        ribbonFn(binding.holon, binding.ribbon, widthPx)
      }
    } else if (first) {
      for (const binding of this.strokes) {
        const ribbon = binding.ribbon
        if (!ribbon.mesh.visible) continue
        const widthPx = (binding.pickWidth ??= rawHolon(binding.holon).stroke).value
        const r = ribbon.boundsRadius
        if (r > 0) {
          const m = ribbon.mesh.matrixWorld.elements
          const c = ribbon.boundsCenter
          const sx = m[0]! * m[0]! + m[1]! * m[1]! + m[2]! * m[2]!
          const sy = m[4]! * m[4]! + m[5]! * m[5]! + m[6]! * m[6]!
          const sz = m[8]! * m[8]! + m[9]! * m[9]! + m[10]! * m[10]!
          const may = first.withWidth(
            m[0]! * c.x + m[4]! * c.y + m[8]! * c.z + m[12]!,
            m[1]! * c.x + m[5]! * c.y + m[9]! * c.z + m[13]!,
            m[2]! * c.x + m[6]! * c.y + m[10]! * c.z + m[14]!,
            r * Math.sqrt(Math.max(sx, sy, sz)),
            widthPx,
          )
          if (!may) continue
        }
        if (this.asleep(binding.holon)) continue
        ribbonFn(binding.holon, ribbon, widthPx)
      }
    } else
      for (const binding of this.strokes) {
        if (!binding.ribbon.mesh.visible || this.asleep(binding.holon)) continue
        ribbonFn(binding.holon, binding.ribbon, (binding.pickWidth ??= rawHolon(binding.holon).stroke).value)
      }
    for (const binding of this.cylinders) {
      if (this.asleep(binding.holon)) continue
      const width = binding.holon.stroke.value
      ribbonFn(binding.holon, binding.farCap, width)
      ribbonFn(binding.holon, binding.nearBack, width)
      ribbonFn(binding.holon, binding.nearFront, width)
      ribbonFn(binding.holon, binding.lineA, width)
      ribbonFn(binding.holon, binding.lineB, width)
    }
    for (const binding of this.fills) if (!this.asleep(binding.holon)) fillFn(binding.holon, binding.fill)
    for (const list of [this.washes, this.drawingWashes])
      for (const binding of list) {
        if (binding.look.fillOpacity.value * binding.look.opacity.value <= 0.01 || this.asleep(binding.holon)) continue
        fillFn(binding.holon, binding.fill)
      }
    for (const binding of this.surfaces) {
      if (binding.holon.fillOpacity.value * seenOf(binding.holon).value <= 0.01 || this.asleep(binding.holon)) continue
      fillFn(binding.holon, binding.fill)
    }
    for (const binding of this.arrows) if (!this.asleep(binding.holon)) fillFn(binding.holon, binding.fill)
    for (const { binding, group } of this.texts) if (!this.asleep(binding.holon)) glyphFn(binding.holon, group)
  }

  /** World boxes of a buffer's local chunk boxes, cached until the boxes or the world matrix change. */
  private readonly worldBoxCache = new WeakMap<object, { local: Boxes; m: Float64Array; whole: Float64Array; chunks: Float64Array; n: number }>()
  private worldBoxesOf(key: object, local: Boxes, matrix: THREE.Matrix4) {
    const e = matrix.elements
    let w = this.worldBoxCache.get(key)
    if (w && w.local === local) {
      let same = true
      for (let i = 0; i < 16; i++)
        if (w.m[i] !== e[i]) {
          same = false
          break
        }
      if (same) return w
    }
    const n = Math.ceil(local.count / CHUNK)
    w = { local, m: Float64Array.from(e), whole: new Float64Array(6), chunks: new Float64Array(n * 6), n }
    worldBox(local.whole, 0, e, w.whole)
    for (let k = 0; k < n; k++) worldBox(local.chunks, k * 6, e, w.chunks, k * 6)
    this.worldBoxCache.set(key, w)
    return w
  }

  private ribbonWorld(ribbon: RibbonStroke) {
    if (!ribbon.mesh.visible) return undefined
    const count = ribbon.geometry.instanceCount
    const start = ribbon.geometry.getAttribute("instanceStart") as THREE.InterleavedBufferAttribute | undefined
    if (count < 1 || !start) return undefined
    return this.worldBoxesOf(ribbon, segmentBoxes(ribbon.geometry, start.data.array as Float32Array, start.data.version, count), ribbon.mesh.matrixWorld)
  }

  /**
   * A visible fill's world box from its vertices alone (pickcull vertexBox:
   * one pass, cached by version) — the cheap first look, before its
   * triangles are boxed. Written to a scratch; undefined when none.
   */
  private fillWholeWorld(fill: FillShape): Float64Array | undefined {
    if (!fill.mesh.visible) return undefined
    const position = fill.mesh.geometry.getAttribute("position") as THREE.BufferAttribute | undefined
    if (!position || position.count === 0) return undefined
    worldBox(vertexBox(fill.mesh.geometry, position).whole, 0, fill.mesh.matrixWorld.elements, this.wholeScratch)
    return this.wholeScratch
  }
  private readonly wholeScratch = new Float64Array(6)

  private fillWorld(fill: FillShape) {
    if (!fill.mesh.visible) return undefined
    const geometry = fill.mesh.geometry
    const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined
    const index = geometry.getIndex()
    if (!position || !index) return undefined
    return this.worldBoxesOf(fill, triangleBoxes(geometry, position, index), fill.mesh.matrixWorld)
  }

  /**
   * A ribbon's visible segments [from, to), in world space, each clipped to
   * the drawn window — ribbonDistance's own reading of the buffers.
   */
  private forEachRibbonSegment(
    ribbon: RibbonStroke,
    from: number,
    to: number,
    fn: (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => void,
  ): void {
    const count = ribbon.geometry.instanceCount
    const start = ribbon.geometry.getAttribute("instanceStart") as THREE.InterleavedBufferAttribute | undefined
    const dist = ribbon.geometry.getAttribute("instanceDistanceStart") as THREE.InterleavedBufferAttribute | undefined
    if (!start || !dist) return
    const positions = start.data.array as Float32Array
    const distances = dist.data.array as Float32Array
    const drawn = ribbon.drawnLength
    const erased = ribbon.erasedLength
    const m = ribbon.mesh.matrixWorld.elements
    const tx = (x: number, y: number, z: number, r: number) => m[r]! * x + m[r + 4]! * y + m[r + 8]! * z + m[r + 12]!
    for (let i = from, end = Math.min(to, count); i < end; i++) {
      const d0 = distances[i * 2]!
      const d1 = distances[i * 2 + 1]!
      if (d0 >= drawn || d1 <= erased) continue
      const lx = positions[i * 6]!
      const ly = positions[i * 6 + 1]!
      const lz = positions[i * 6 + 2]!
      const mx = positions[i * 6 + 3]!
      const my = positions[i * 6 + 4]!
      const mz = positions[i * 6 + 5]!
      let ax = tx(lx, ly, lz, 0)
      let ay = tx(lx, ly, lz, 1)
      let az = tx(lx, ly, lz, 2)
      let bx = tx(mx, my, mz, 0)
      let by = tx(mx, my, mz, 1)
      let bz = tx(mx, my, mz, 2)
      const span = d1 - d0
      if (span > 1e-9) {
        const f = Math.max(0, Math.min(1, (erased - d0) / span))
        const g = Math.max(0, Math.min(1, (drawn - d0) / span))
        if (g <= f) continue
        const ex = bx - ax
        const ey = by - ay
        const ez = bz - az
        bx = ax + ex * g
        by = ay + ey * g
        bz = az + ez * g
        ax += ex * f
        ay += ey * f
        az += ez * f
      }
      fn(ax, ay, az, bx, by, bz)
    }
  }

  /** A fill's triangles [from, to), in world space. */
  private forEachTriangle(
    fill: FillShape,
    from: number,
    to: number,
    fn: (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => void,
  ): void {
    const geometry = fill.mesh.geometry
    const position = geometry.getAttribute("position") as THREE.BufferAttribute
    const index = geometry.getIndex()!
    const m = fill.mesh.matrixWorld.elements
    const vertex = (v: number): [number, number, number] => {
      const x = position.getX(v)
      const y = position.getY(v)
      const z = position.getZ(v)
      return [
        m[0]! * x + m[4]! * y + m[8]! * z + m[12]!,
        m[1]! * x + m[5]! * y + m[9]! * z + m[13]!,
        m[2]! * x + m[6]! * y + m[10]! * z + m[14]!,
      ]
    }
    for (let i = from * 3, end = Math.min(to * 3, index.count); i < end; i += 3)
      fn(vertex(index.getX(i)), vertex(index.getX(i + 1)), vertex(index.getX(i + 2)))
  }

  /** The world box of each visible glyph mesh under a text's group. */
  private forEachGlyphBox(group: THREE.Object3D, fn: (box: Float64Array) => void): void {
    for (const child of this.glyphMeshes(group)) {
      if (!child.visible) continue
      const position = child.geometry.getAttribute("position") as THREE.BufferAttribute | undefined
      if (!position) continue
      fn(this.worldBoxesOf(child, vertexBox(child.geometry, position), child.matrixWorld).whole)
    }
  }

  /** A text group's meshes, listed once per graph structure (a traverse per query was most of a 3D query's cost). */
  private glyphMeshes(group: THREE.Object3D): THREE.Mesh[] {
    const hit = this.glyphMeshCache.get(group)
    if (hit && hit.structure === structureEpoch) return hit.meshes
    const meshes: THREE.Mesh[] = []
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) meshes.push(child)
    })
    this.glyphMeshCache.set(group, { structure: structureEpoch, meshes })
    return meshes
  }
  private readonly glyphMeshCache = new WeakMap<THREE.Object3D, { structure: number; meshes: THREE.Mesh[] }>()

  /**
   * A holon's screen-space bounding box, in pixels, as a Box3 whose z is
   * unused — what a selection affordance is drawn from. Covers the holon
   * and everything below it, so selecting a whole frames all its parts.
   * Undefined when nothing of it is currently on screen.
   */
  boundsOf(holon: Holon): THREE.Box3 | undefined {
    const width = this.renderer.domElement.width || 1280
    const height = this.renderer.domElement.height || 720
    return this.measureBounds(holon, width, height)
  }

  private measureBounds(holon: Holon, width: number, height: number): THREE.Box3 | undefined {
    const box = new THREE.Box3()
    box.makeEmpty()
    const point = new THREE.Vector3()
    const found = this.eachInkPoint(holon, (world) => {
      point.copy(world).project(this.camera)
      box.expandByPoint(
        new THREE.Vector3(((point.x + 1) / 2) * width, ((1 - point.y) / 2) * height, 0),
      )
    })
    return found ? box : undefined
  }

  /**
   * A holon's ink as a WORLD-space box — view-independent, so the viewer's
   * camera can frame a holon exactly from wherever it stands (src/view.ts
   * frameSphere) instead of guessing from an oblique screen box.
   */
  worldBoundsOf(holon: Holon): THREE.Box3 | undefined {
    const box = new THREE.Box3()
    box.makeEmpty()
    return this.eachInkPoint(holon, (world) => box.expandByPoint(world)) ? box : undefined
  }

  /**
   * World ink boxes for several holons in ONE sweep of the ink — what a
   * spatial pointer (a hand's spark, demo/handplay.ts) tests itself against:
   * each holon's box covers its whole subtree. Holons with no ink on stage
   * are absent.
   */
  worldBoundsOfEach(holons: Iterable<Holon>): Map<Holon, THREE.Box3> {
    this.scene.updateMatrixWorld(true)
    const wanted = new Set(holons)
    const out = new Map<Holon, THREE.Box3>()
    const owners: Holon[] = []
    const ownersOf = (holon: Holon): Holon[] => {
      owners.length = 0
      for (let h: Holon | undefined = holon; h; h = h.parent) if (wanted.has(h)) owners.push(h)
      return owners
    }
    const add = (who: Holon[], points: THREE.Vector3[]) => {
      for (const h of who) {
        let box = out.get(h)
        if (!box) out.set(h, (box = new THREE.Box3().makeEmpty()))
        for (const p of points) box.expandByPoint(p)
      }
    }
    for (const b of this.strokes) {
      const who = ownersOf(b.holon)
      if (who.length) add(who, this.ribbonWorldPoints(b.ribbon, b.ribbon.mesh))
    }
    for (const b of this.cylinders) {
      const who = ownersOf(b.holon)
      if (!who.length) continue
      for (const r of [b.farCap, b.nearBack, b.nearFront, b.lineA, b.lineB]) add(who, this.ribbonWorldPoints(r, r.mesh))
    }
    for (const b of [...this.fills, ...this.arrows]) {
      const who = ownersOf(b.holon)
      if (who.length) add(who, this.meshWorldPoints(b.fill.mesh))
    }
    for (const { binding, group } of this.texts) {
      const who = ownersOf(binding.holon)
      if (who.length) add(who, this.meshWorldPoints(group))
    }
    return out
  }

  /**
   * Visit every world point of a holon's ink (its whole subtree): ribbons,
   * cylinder contours, fills and arrowheads, text. A holon with no ink of
   * its own (a Null, a Group, an empty whole) is still framable and
   * selectable — it falls back to its origin. False when it is not on stage.
   */
  private eachInkPoint(holon: Holon, visit: (world: THREE.Vector3) => void): boolean {
    // As pick: settled since the last frame with no node added or removed,
    // every world matrix already is what a forced update would make — the
    // hover outline asks this every frame, and the forced walk was all its cost.
    if (!this.matricesSettled || this.settledStructure !== structureEpoch) this.scene.updateMatrixWorld(true)
    const wanted = new Set<Holon>()
    for (const h of holon.walk()) wanted.add(h)
    let any = false
    const add = (world: THREE.Vector3) => {
      any = true
      visit(world)
    }
    const addRibbon = (ribbon: RibbonStroke, object: THREE.Object3D) => {
      for (const world of this.ribbonWorldPoints(ribbon, object)) add(world)
    }

    for (const binding of this.strokes) {
      if (wanted.has(binding.holon)) addRibbon(binding.ribbon, binding.ribbon.mesh)
    }
    for (const binding of this.cylinders) {
      if (!wanted.has(binding.holon)) continue
      for (const ribbon of [binding.farCap, binding.nearBack, binding.nearFront, binding.lineA, binding.lineB]) {
        addRibbon(ribbon, ribbon.mesh)
      }
    }
    for (const binding of [...this.fills, ...this.arrows]) {
      if (!wanted.has(binding.holon)) continue
      for (const world of this.meshWorldPoints(binding.fill.mesh)) add(world)
    }
    for (const { binding, group } of this.texts) {
      if (!wanted.has(binding.holon)) continue
      for (const world of this.meshWorldPoints(group)) add(world)
    }
    if (!any) {
      const found = this.groups.find((g) => g.holon === holon)
      if (!found) return false
      add(new THREE.Vector3().setFromMatrixPosition(found.group.matrixWorld))
    }
    return true
  }

  /**
   * Attach a holon WHILE the scene runs — a symbol summoned by a hand
   * (demo/summon.ts) — as a new root beside the dream's own. It draws as
   * itself (never into an instanced batch: the batches' runs are laid out
   * at mount), is pickable and glowable like any part, and is not in the
   * Dream: no timeline touches it, so whoever summoned it animates it.
   * Returns its release, which takes every trace of it out of the host.
   */
  adopt(holon: Holon): () => void {
    void holon.parts // compose before attaching
    const instanced = this.instanced
    this.instanced = false
    // RESIDENCY: above every chapter's composite orders, as attach-last always was.
    const order = this.nextFillOrder
    if (this.residency) this.nextFillOrder = this.adoptedOrder ?? (this.residency.count + 1) * ThreeHost.CHAPTER_ORDERS + 1
    try {
      this.attach(holon, this.scene)
    } finally {
      this.instanced = instanced
      if (this.residency) {
        this.adoptedOrder = this.nextFillOrder
        this.nextFillOrder = order
      }
    }
    this.rootGroups = undefined
    this.inks = undefined
    this.bindingsEpoch++
    this.freezeStaticMatrices()
    return () => this.release(holon)
  }

  /** Take an adopted holon (and its subtree) out of the scene and every binding list. */
  private release(holon: Holon): void {
    this.bindingsEpoch++
    const gone = new Set<Holon>(holon.walk())
    const prune = <B extends { holon: Holon }>(list: readonly B[]): void => {
      const l = list as B[]
      for (let i = l.length - 1; i >= 0; i--) if (gone.has(l[i]!.holon)) l.splice(i, 1)
    }
    const root = this.groups.find((g) => g.holon === holon)?.group
    prune(this.groups)
    prune(this.strokes)
    prune(this.cylinders)
    prune(this.fills)
    prune(this.washes)
    prune(this.surfaces)
    prune(this.polylines)
    prune(this.drawingWashes)
    prune(this.arrows)
    prune(this.texts)
    if (root) {
      const sp = this.superpositions as { group: THREE.Group }[]
      for (let i = sp.length - 1; i >= 0; i--) {
        let o: THREE.Object3D | null = sp[i]!.group
        while (o && o !== root) o = o.parent
        if (o === root) sp.splice(i, 1)
      }
      root.removeFromParent()
    }
    for (const h of gone) {
      this.rootOf.delete(h)
      this.washedByAncestor.delete(h)
    }
    this.rootGroups = undefined
    this.inks = undefined
  }

  // --- RESIDENCY (song.ts) -------------------------------------------------
  //
  // A long song cannot keep every chapter's picture in the tab (the
  // InterBrain film mounted whole: ~150k holons, ~3.3 GB of heap, most of
  // it ribbon geometry and render objects). A resident song mounts only the
  // chapters song.residentAt(t) names — the live ones, the next one a few
  // seconds before its cut, the last one a moment after — and releases the
  // rest: bindings, meshes, GPU buffers, render objects.
  //
  // Purity: what is mounted never reaches a pixel. Only live chapters draw
  // (the song gates the rest to 0 and they are dormant here), and a live
  // chapter is always resident. A chapter mounted afresh is attached from
  // the holons as they stand and synced like any binding on its first frame
  // (fresh signatures, syncedEpoch reset), so at t it is exactly the
  // chapter that never left — setT's second render settles its matrices,
  // as it does for any jump. Composite order is a chapter's own: chapter i
  // claims render orders from (i + 1)·CHAPTER_ORDERS, the same orders on
  // every mount and above every earlier chapter's, as attach order gave
  // them when everything mounted at once.

  /** The song's chapters as mounted lazily; undefined for every other dream. */
  private residency?: Residency
  /** The next composite order an adopted holon claims in a resident song. */
  private adoptedOrder?: number
  /** Set while a chapter mounts in slices: attach() queues parts here instead of recursing. */
  private attachQueue?: [Holon, THREE.Object3D, Holon][]
  /** Mounted chapters by index. */
  private readonly mounted = new Map<number, ChapterMount>()
  /** Root groups mounted since the last warm-up pass, with their chapter. */
  private unwarmed: { mount: ChapterMount; groups: THREE.Object3D[]; warmedTo?: number }[] = []
  /** Render objects built per mesh — released with their chapter (shared materials never dispose them). */
  private readonly renderObjectsOf = new WeakMap<THREE.Object3D, RenderObjectLike[]>()
  /** Render-order headroom per chapter (RESIDENCY). */
  static readonly CHAPTER_ORDERS = 2 ** 32

  /** mount() for a resident song: the song-wide roots, then the chapters resident at `at`. */
  private async mountResident(residency: Residency, at: number): Promise<ThreeHost> {
    this.residency = residency
    // Record every render object three builds, by object, so a released
    // chapter can release its own: they listen on the SHARED materials,
    // which never dispose, so nothing else would ever let them go.
    const objects = (this.renderer as unknown as { _objects?: { createRenderObject: (...a: unknown[]) => RenderObjectLike } })._objects
    if (objects) {
      const create = objects.createRenderObject.bind(objects)
      objects.createRenderObject = (...a: unknown[]) => {
        const ro = create(...a)
        // Once only: three disposes a stale one itself (a cache-key change),
        // and a second onDispose would rebuild its node state to destroy it.
        const onDispose = ro.onDispose
        let gone = false
        ro.onDispose = () => {
          if (gone) return
          gone = true
          onDispose()
        }
        const object = a[3] as THREE.Object3D
        const list = this.renderObjectsOf.get(object)
        if (list) list.push(ro)
        else this.renderObjectsOf.set(object, [ro])
        return ro
      }
    }
    for (const root of residency.always) this.attach(root, this.scene)
    this.freezeStaticMatrices()
    if (this.gatherClips()) this.dedupeClipTexts()
    await Promise.all(this.texts.map((t) => t.binding.ready))
    for (const i of residency.residentAt(at)) this.mountChapter(i)
    await Promise.all([...this.mounted.values()].map((m) => m.ready))
    this.warmMounted()
    return this
  }

  /**
   * Bring the mounted set to residentAt(t): release what left it, mount
   * what entered. A LIVE chapter mounts whole, now; one only waiting for
   * its cut mounts a few roots a frame (MOUNT_BUDGET_MS), so playback
   * does not stall for the second a large chapter takes to build. Returns
   * a promise only when a live chapter's text is still laying out — a
   * frame must not draw a chapter without its words.
   */
  private reside(t: number): Promise<void> | undefined {
    const residency = this.residency!
    const want = residency.residentAt(t)
    // A mount whose chapter the song has since constructed afresh is stale.
    for (const [i, mount] of [...this.mounted]) {
      if (!want.includes(i) || mount.roots !== residency.rootsOf(i)) this.unmountChapter(i)
    }
    const live = (this.dream as { liveRoots?: ReadonlySet<Holon> }).liveRoots
    const isLive = (i: number) => residency.rootsOf(i).some((r) => live?.has(r) ?? true)
    let budget: number | undefined
    for (const i of want) {
      const mount = this.mounted.get(i)
      if (mount && complete(mount)) continue
      if (isLive(i)) this.mountChapter(i)
      else if (budget === undefined || performance.now() < budget) {
        budget ??= performance.now() + ThreeHost.MOUNT_BUDGET_MS
        this.mountChapter(i, budget)
      }
    }
    const waiting = want.filter(isLive).map((i) => this.mounted.get(i)!).filter((m) => !m.laidOut)
    return waiting.length > 0 ? Promise.all(waiting.map((m) => m.ready)).then(() => {}) : undefined
  }

  /** Milliseconds a frame spends mounting (or warming) a chapter that is not on screen yet — at least a slice. */
  static readonly MOUNT_BUDGET_MS = 10

  /** The mounted chapter indices, ascending — the harness reads it. */
  get residentChapters(): number[] {
    return [...this.mounted.keys()].sort((a, b) => a - b)
  }

  /** Attach chapter i's remaining roots — all of them, or (with `until`) as many as fit before that time, at least one. */
  private mountChapter(i: number, until?: number): void {
    const roots = this.residency!.rootsOf(i)
    let mount = this.mounted.get(i)
    if (!mount) {
      mount = {
        roots,
        attached: 0,
        queue: [],
        groups: [],
        order: (i + 1) * ThreeHost.CHAPTER_ORDERS + 1,
        texts: [],
        ready: Promise.resolve(),
        laidOut: true,
      }
      this.mounted.set(i, mount)
    }
    const mark = {
      strokes: this.strokes.length,
      fills: this.fills.length,
      washes: this.washes.length,
      drawingWashes: this.drawingWashes.length,
      arrows: this.arrows.length,
      cylinders: this.cylinders.length,
      texts: this.texts.length,
    }
    const groupsBefore = this.groups.length
    // The chapter's own composite orders, continued across its slices; its
    // holons attached depth-first off a queue, a few hundred between clock reads.
    const order = this.nextFillOrder
    this.nextFillOrder = mount.order
    const before = this.scene.children.length
    const queue = mount.queue
    this.attachQueue = queue
    try {
      // The tree stands still while it mounts: each holon's certainty and
      // presence chains are its parent's plus its own (certainty.ts).
      withChainMemo(() => {
        for (let n = 1; queue.length > 0 || mount.attached < mount.roots.length; n++) {
          if (queue.length === 0) {
            const root = roots[mount.attached++]!
            queue.push([root, this.scene, root])
          }
          const [holon, parent, root] = queue.pop()!
          this.attach(holon, parent, root)
          if (until !== undefined && (n & 63) === 0 && performance.now() >= until) break
        }
      })
    } finally {
      this.attachQueue = undefined
      mount.order = this.nextFillOrder
      this.nextFillOrder = order
    }
    mount.groups.push(...this.scene.children.slice(before))
    const added = this.groups.slice(groupsBefore)
    // freezeStaticMatrices, for these bindings only.
    const freeze = (o: THREE.Object3D) => {
      o.matrixAutoUpdate = false
      o.matrixWorldNeedsUpdate = true
    }
    for (const { ribbon } of this.strokes.slice(mark.strokes)) freeze(ribbon.mesh)
    for (const { fill } of this.fills.slice(mark.fills)) freeze(fill.mesh)
    for (const { fill } of this.washes.slice(mark.washes)) freeze(fill.mesh)
    for (const { fill } of this.drawingWashes.slice(mark.drawingWashes)) freeze(fill.mesh)
    for (const { fill } of this.arrows.slice(mark.arrows)) freeze(fill.mesh)
    for (const c of this.cylinders.slice(mark.cylinders)) {
      for (const r of [c.farCap, c.nearBack, c.nearFront, c.lineA, c.lineB]) freeze(r.mesh)
    }
    const texts = this.texts.slice(mark.texts).map((t) => t.binding.ready)
    if (texts.length > 0) {
      mount.texts.push(...texts)
      mount.laidOut = false
      const all = mount.texts.length
      const ready = Promise.all(mount.texts).then(() => {
        if (mount.texts.length === all) mount.laidOut = true
      })
      mount.ready = ready
    }
    // Warmed whole, once whole: a slice's parts land under earlier slices' groups.
    if (complete(mount)) this.unwarmed.push({ mount, groups: mount.groups })
    if (added.some((b) => clipOf(b.holon)) && this.gatherClips()) this.dedupeClipTexts()
    // Authored glows, kept current instead of re-gathered over every group.
    if (this.authoredGlow) {
      for (const { holon } of added) {
        const g = seenGlow(holon)
        if (g) this.authoredGlow.set(holon, g)
      }
      this.authoredGlowOver = this.groups.length
    }
    this.residencyChanged()
  }

  private unmountChapter(i: number): void {
    const mount = this.mounted.get(i)!
    this.mounted.delete(i)
    this.unwarmed = this.unwarmed.filter((w) => w.mount !== mount)
    const gone = new Set<Holon>()
    for (const root of mount.roots.slice(0, mount.attached)) for (const h of root.walk()) gone.add(h)
    const objects = new Set<THREE.Object3D>()
    for (const g of mount.groups) g.traverse((o) => void objects.add(o))

    for (const t of this.texts) if (gone.has(t.holon)) t.binding.dispose()
    for (const b of this.groups) if (gone.has(b.holon)) for (const p of b.transform) p.unwatch(b)
    const prune = <B extends { holon: Holon }>(list: readonly B[]): void => {
      const l = list as B[]
      let k = 0
      for (const b of l) if (!gone.has(b.holon)) l[k++] = b
      l.length = k
    }
    for (const b of this.strokes) if (gone.has(b.holon)) this.blurOf.delete(b.ribbon)
    for (const b of this.polylines) if (gone.has(b.holon)) this.blurOf.delete(b.ribbon)
    prune(this.groups)
    prune(this.strokes)
    prune(this.cylinders)
    prune(this.fills)
    prune(this.washes)
    prune(this.surfaces)
    prune(this.polylines)
    prune(this.drawingWashes)
    prune(this.arrows)
    prune(this.texts)
    const sp = this.superpositions as { group: THREE.Object3D }[]
    for (let k = sp.length - 1; k >= 0; k--) if (objects.has(sp[k]!.group)) sp.splice(k, 1)
    // Halos of released ink go with it (they live in the glow layer).
    for (const [key, halo] of this.halos) {
      const ink = key instanceof RibbonStroke ? key.mesh : (key as THREE.Object3D)
      if (!objects.has(ink)) continue
      for (const m of halo.meshes()) {
        m.removeFromParent()
        m.geometry.dispose()
        objects.add(m)
      }
      this.halos.delete(key)
      this.litHalos.delete(halo)
    }
    for (const [region, meshes] of this.clips) {
      for (const m of meshes) if (objects.has(m)) meshes.delete(m)
      if (meshes.size === 0) this.clips.delete(region)
    }
    for (const o of objects) this.clipOfMesh.delete(o)
    const ct = this.clipTexts
    for (let k = ct.length - 1; k >= 0; k--) if (objects.has(ct[k]!.group)) ct.splice(k, 1)
    for (const h of gone) {
      this.rootOf.delete(h)
      this.washedByAncestor.delete(h)
      this.authoredGlow?.delete(h)
    }
    if (this.authoredGlow) this.authoredGlowOver = this.groups.length
    for (const g of mount.groups) g.removeFromParent()
    // GPU: every geometry (materials are shared), and every render object
    // three built for these meshes — again once an in-flight warm-up ends,
    // since it may still be building some.
    const release = () => {
      const ros: RenderObjectLike[] = []
      for (const o of objects) {
        const list = this.renderObjectsOf.get(o)
        if (list) {
          ros.push(...list)
          this.renderObjectsOf.delete(o)
        }
      }
      releaseRenderObjects(ros)
    }
    for (const o of objects) if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose()
    release()
    void mount.warm?.then(release)
    this.residencyChanged()
  }

  /** Every cache keyed on the binding lists or the graph starts over. */
  private residencyChanged(): void {
    this.bindingsEpoch++
    this.rootGroups = undefined
    this.inks = undefined
    this.groupIndex = undefined
    this.syncedEpoch = Number.NaN
    this.cullLatchIdle = false
    this.dormancyVersion++
    // The 3D pick's sphere index starts over (and lets released strokes go).
    this.strokeSpheres = undefined
    this.inkStale = true
    this.inkReshaped.length = 0
    this.inkMoved.length = 0
  }

  /** gatherClips() is a mount-time pass; run again it would list a clipped Text twice. */
  private dedupeClipTexts(): void {
    const seen = new Set<THREE.Object3D>()
    const ct = this.clipTexts
    let k = 0
    for (const c of ct) if (!seen.has(c.group)) (seen.add(c.group), (ct[k++] = c))
    ct.length = k
  }

  /**
   * Warm the chapters mounted since the last pass, in the background —
   * prewarm()'s technique per chapter: every hidden object in it (its
   * root groups too, when it is dormant) is shown for the synchronous
   * gather of compileAsync only, so no frame sees it.
   */
  private warmMounted(): void {
    if (this.unwarmed.length === 0) return
    // A few root groups a frame: the gather is synchronous, and a large
    // chapter's whole would hold one frame for half a second.
    const until = performance.now() + ThreeHost.MOUNT_BUDGET_MS
    const builds: Promise<void>[] = []
    while (this.unwarmed.length > 0 && (builds.length === 0 || performance.now() < until)) {
      const next = this.unwarmed[0]!
      const g = next.groups[next.warmedTo ?? 0]!
      next.warmedTo = (next.warmedTo ?? 0) + 1
      if (next.warmedTo >= next.groups.length) this.unwarmed.shift()
      const shown: THREE.Object3D[] = []
      let compiling: Promise<void>
      try {
        g.traverse((o) => {
          if (!o.visible) {
            o.visible = true
            shown.push(o)
          }
        })
        compiling = this.renderer.compileAsync(g, this.camera, this.scene)
      } finally {
        for (const o of shown) o.visible = false
      }
      const mount = next.mount
      mount.warm = Promise.all([mount.warm, compiling]).then(
        () => {},
        () => {},
      )
      builds.push(mount.warm)
    }
    const prior = this.warmed
    this.warmed = Promise.all([prior, ...builds]).then(() => {})
  }



  /**
   * Glow a holon's ink (its whole subtree), several holons', or none
   * (null) — the editor's hover affordance over sovereign symbols. The
   * lift rides the tint and width values sync() already writes into the
   * ribbon/fill uniforms every frame: tint lerps `amount` toward white
   * and stroke width swells by `2*amount`, so a glow costs nothing new —
   * no passes, no materials, no postprocessing. Takes effect on the next
   * renderFrame().
   */
  highlight(target: Holon | readonly Holon[] | null, amount = HOVER): void {
    // The tint lift this once was is retired: hover is attention's faint glow.
    this.attend("hover", target, amount)
  }

  /**
   * Lay attention's golden glow (src/glow.ts) on a holon — its whole
   * subtree — or several, or none (null), on a named CHANNEL: "hover",
   * "selection", a game handle… Channels overlap by max, so a selected
   * thing that is also hovered simply stays fully lit. `amount` is the
   * intensity (glow.ts HOVER = faint, SELECTED = 1) and may be re-set
   * every frame to animate it. Interaction only: it lives here, never in
   * the Dream. Takes effect on the next renderFrame(); returns whether
   * anything changed (a held view repaints only then).
   */
  attend(channel: string, target: Holon | readonly Holon[] | null, amount = 1): boolean {
    const targets: readonly Holon[] = !target ? [] : Array.isArray(target) ? target : [target as Holon]
    const prior = this.attention.get(channel)
    // Unchanged: nothing to do (a caller may re-state its attention every frame).
    if (targets.length === 0 || amount <= 0) {
      if (!prior) return false
    } else if (prior && prior.amount === amount && targets.length === prior.roots.length && targets.every((h, i) => h === prior.roots[i])) {
      return false
    }
    if (targets.length === 0 || amount <= 0) this.attention.delete(channel)
    else {
      const same = prior && targets.length === prior.roots.length && targets.every((h, i) => h === prior.roots[i])
      if (same) prior.amount = amount
      else {
        const holons = new Set<Holon>()
        for (const root of targets) for (const holon of root.walk()) holons.add(holon)
        this.attention.set(channel, { holons, amount, roots: targets.slice() })
      }
    }
    this.attended.clear()
    for (const { holons, amount: a } of this.attention.values()) {
      for (const holon of holons) if (a > (this.attended.get(holon) ?? 0)) this.attended.set(holon, a)
    }
    return true
  }

  /**
   * CLIPS (src/clip.ts): each region and the meshes drawn under it — the
   * clipped holons' strokes and fills, their echoes, and any halo made for
   * them later. Empty unless a scene declares a clip.
   */
  private readonly clips = new Map<ClipRegion, Set<THREE.Mesh>>()
  private readonly clipOfMesh = new Map<THREE.Object3D, ClipRegion>()

  /** Put a mesh under a clip: its material's clipped twin, and its slots. */
  private clipMesh(mesh: THREE.Mesh, region: ClipRegion): void {
    if (this.clipOfMesh.has(mesh)) return
    const m = mesh.material as THREE.Material
    mesh.material = m instanceof RibbonMaterial ? clippedRibbonMaterial(m) : clippedMaterial(m)
    initClipSlots(mesh)
    this.clipOfMesh.set(mesh, region)
    let set = this.clips.get(region)
    if (!set) this.clips.set(region, (set = new Set()))
    set.add(mesh)
  }

  /** Find every clipped holon's ink at mount; true if there is any. */
  /**
   * Superposition echoes are made lazily — the first frame their ink is
   * uncertain, usually while it is still hidden — and a mesh three has
   * never drawn costs a new render object in the frame it first shows
   * (valueflow: 12 a frame as particles enter, ~20 ms). So every echo made
   * is noted here, and the groups that gained one are compiled in the
   * background after the frame (the prewarm, scoped to them).
   */
  private readonly coldEchoes = new Set<THREE.Object3D>()
  private watchEchoes(): void {
    for (const { blur, group } of this.superpositions) {
      blur.onEcho = () => this.coldEchoes.add(group)
    }
  }
  /**
   * The echo clouds a scene may need, made ahead of their first doubt in
   * idle slices (and then warmed like any), so a jump that both doubts and
   * shows a line (a recall, a scrub) makes nothing in its frame. Up to a
   * budget of meshes: a scene of tens of thousands of doubtable lines (a
   * field of Grains) keeps them lazy, where traversal would cost more.
   */
  private premakeEchoes(): void {
    const blurs = this.superpositions
      .map(({ blur }) => blur)
      .filter((b): b is RibbonSuperposition => b instanceof RibbonSuperposition)
    if (blurs.length * ECHOES > ThreeHost.ECHO_PREMAKE_BUDGET) return
    let next = 0
    const slice = () => {
      const until = performance.now() + ThreeHost.WARM_SLICE_MS
      while (next < blurs.length && performance.now() < until) blurs[next++]!.prepare()
      if (this.coldEchoes.size > 0) this.warmEchoes()
      if (next < blurs.length) whenIdle(slice)
    }
    whenIdle(slice)
  }
  /** Most echo meshes made ahead of need (premakeEchoes). */
  static readonly ECHO_PREMAKE_BUDGET = 24000

  private warmEchoes(): void {
    const builds: Promise<void>[] = []
    for (const group of this.coldEchoes) {
      const shown: THREE.Object3D[] = []
      let compiling: Promise<void>
      try {
        group.traverse((o) => {
          if ((o as THREE.Mesh).isMesh && !o.visible) {
            o.visible = true
            shown.push(o)
          }
        })
        compiling = this.compileEverywhere(group)
      } finally {
        for (const o of shown) o.visible = false
      }
      builds.push(compiling)
    }
    this.coldEchoes.clear()
    const prior = this.warmed
    this.warmed = Promise.all([prior, ...builds]).then(() => {})
  }

  private gatherClips(): boolean {
    for (const [holon, ink] of this.inkIndex()) {
      const region = clipOf(holon)
      if (!region) continue
      for (const ribbon of ink.ribbons) this.clipMesh(ribbon.mesh, region)
      for (const mesh of ink.fills) this.clipMesh(mesh as THREE.Mesh, region)
    }
    for (const { blur } of this.superpositions) {
      const region = this.clipOfMesh.get(blur.source)
      if (!region) continue
      // Echoes are made lazily, the first frame their line is uncertain.
      for (const mesh of blur.meshes()) this.clipMesh(mesh, region)
      const cold = blur.onEcho
      blur.onEcho = (mesh) => {
        this.clipMesh(mesh, region)
        cold?.(mesh)
      }
    }
    // A Text's glyphs land asynchronously: its group is watched, and what
    // arrives in it adopts the clip on the next frame (adoptClippedText).
    for (const t of this.texts) {
      const region = clipOf(t.holon)
      if (region) this.clipTexts.push({ group: t.group, region })
    }
    this.adoptClippedText()
    return this.clips.size > 0 || this.clipTexts.length > 0
  }

  /** Clipped Texts' groups — their glyph meshes and contours come and go with layout. */
  private readonly clipTexts: { group: THREE.Object3D; region: ClipRegion }[] = []

  /** Put whatever a clipped Text has laid out since under its clip. */
  private adoptClippedText(): void {
    for (const { group, region } of this.clipTexts) {
      for (const mesh of unclippedMeshes(group, this.clipOfMesh)) this.clipMesh(mesh, region)
    }
  }

  private readonly clipPoint = new THREE.Vector3()
  /** Write each clip's disc, as this frame projects it, into its meshes (device px, y down). */
  private syncClips(): void {
    const w = this.renderer.domElement.width || 1280
    const h = this.renderer.domElement.height || 720
    const p = this.clipPoint
    const toPx = (x: number, y: number, z: number, m: THREE.Matrix4) => {
      p.set(x, y, z).applyMatrix4(m).project(this.camera)
      return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h }
    }
    for (const [region, meshes] of this.clips) {
      const disc = region.disc()
      const group = this.groupOf(disc)
      const r = (disc as unknown as { radius?: Param<number> }).radius?.value ?? 0
      let c = { x: -1e9, y: -1e9 }
      let u = { x: 1, y: 0 }
      let v = { x: 0, y: 1 }
      if (group && r > 0) {
        const m = group.matrixWorld
        c = toPx(0, 0, 0, m)
        const a = toPx(r, 0, 0, m)
        const b = toPx(0, r, 0, m)
        u = { x: a.x - c.x, y: a.y - c.y }
        v = { x: b.x - c.x, y: b.y - c.y }
      }
      for (const mesh of meshes) {
        ;(mesh.userData[CLIP_KEYS.c] as THREE.Vector2).set(c.x, c.y)
        ;(mesh.userData[CLIP_KEYS.u] as THREE.Vector2).set(u.x, u.y)
        ;(mesh.userData[CLIP_KEYS.v] as THREE.Vector2).set(v.x, v.y)
      }
    }
  }

  private groupIndex?: Map<Holon, THREE.Group>
  private groupOf(holon: Holon): THREE.Group | undefined {
    if (!this.groupIndex || this.groupIndex.size !== this.groups.length) {
      this.groupIndex = new Map(this.groups.map((g) => [g.holon, g.group]))
    }
    return this.groupIndex.get(holon)
  }

  /** Does this holon (or anything below it) draw ink a glow can follow? */
  hasInk(holon: Holon): boolean {
    const index = this.inkIndex()
    for (const h of holon.walk()) if (index.has(h)) return true
    return false
  }

  /** Does anything glow this frame (or did, and must be put out)? */
  private glowing(): boolean {
    return this.attended.size > 0 || this.litHalos.size > 0 || this.authoredGlows().size > 0
  }

  /** Every bound holon that declares (or inherits) an authored glow. */
  private authoredGlows(): Map<Holon, Readable<number>> {
    if (this.authoredGlow && this.authoredGlowOver === this.groups.length) return this.authoredGlow
    const found = new Map<Holon, Readable<number>>()
    for (const { holon } of this.groups) {
      const g = seenGlow(holon)
      if (g) found.set(holon, g)
    }
    this.authoredGlowOver = this.groups.length
    return (this.authoredGlow = found)
  }

  /** The ink a holon draws with its own bindings: its ribbons and its fill meshes. */
  private inkMeshes(holon: Holon): { ribbons: RibbonStroke[]; fills: { mesh: THREE.Mesh; opacity: number }[] } {
    const ink = this.inkIndex().get(holon)
    if (!ink) return { ribbons: [], fills: [] }
    const fills = ink.fills.map((mesh) => ({ mesh, opacity: (mesh.userData.dtFillFade as number | undefined) ?? 1 }))
    for (const group of ink.texts) {
      // The glyphs themselves (not their traced pen contours): a letter's
      // halo follows its outline and its counters.
      for (const child of group.children) {
        if (child instanceof THREE.Mesh && !(child.material instanceof RibbonMaterial) && child.visible) {
          fills.push({ mesh: child, opacity: seenOf(holon).value })
        }
      }
    }
    return { ribbons: ink.ribbons, fills }
  }

  /**
   * Every holon's own ink, indexed once (and again only when bindings are
   * added) — so attending to a whole Earth costs a lookup per holon.
   */
  private inkIndex(): Map<Holon, { ribbons: RibbonStroke[]; fills: THREE.Mesh[]; texts: THREE.Object3D[] }> {
    const size =
      this.strokes.length + this.polylines.length + this.cylinders.length + this.fills.length + this.arrows.length +
      this.surfaces.length + this.washes.length + this.drawingWashes.length + this.texts.length
    if (this.inks && this.inksOver === size) return this.inks
    const index = new Map<Holon, { ribbons: RibbonStroke[]; fills: THREE.Mesh[]; texts: THREE.Object3D[] }>()
    const of = (holon: Holon) => {
      let ink = index.get(holon)
      if (!ink) index.set(holon, (ink = { ribbons: [], fills: [], texts: [] }))
      return ink
    }
    for (const b of this.strokes) of(b.holon).ribbons.push(b.ribbon)
    for (const b of this.polylines) of(b.holon).ribbons.push(b.ribbon)
    for (const b of this.cylinders) of(b.holon).ribbons.push(b.farCap, b.nearFront, b.nearBack, b.lineA, b.lineB)
    // A filled shape's interior counts too: its light falls outside it, never across it.
    for (const b of [...this.fills, ...this.arrows, ...this.surfaces, ...this.washes, ...this.drawingWashes]) {
      of(b.holon).fills.push(b.fill.mesh)
    }
    for (const t of this.texts) of(t.holon).texts.push(t.group)
    this.inksOver = size
    return (this.inks = index)
  }
  private inks?: Map<Holon, { ribbons: RibbonStroke[]; fills: THREE.Mesh[]; texts: THREE.Object3D[] }>
  private inksOver = -1

  /** Light every attended or glowing holon's halos; put out the rest. */
  private syncGlow(): void {
    if (!this.glowing()) return
    const authored = this.authoredGlows()
    const lit = new Set<StrokeHalo | FillHalo>()
    const light = (holon: Holon, amount: number) => {
      if (amount <= 0 || this.asleep(holon)) return
      const layer = (this.glowLayer ??= this.makeGlowLayer())
      const { ribbons, fills } = this.inkMeshes(holon)
      for (const ribbon of ribbons) {
        let halo = this.halos.get(ribbon)
        if (!halo) {
          this.halos.set(ribbon, (halo = new StrokeHalo(ribbon, layer)))
          const region = this.clipOfMesh.get(ribbon.mesh)
          if (region) for (const mesh of halo.meshes()) this.clipMesh(mesh, region)
        }
        ;(halo as StrokeHalo).sync(amount)
        lit.add(halo)
      }
      for (const { mesh, opacity } of fills) {
        let halo = this.halos.get(mesh)
        if (!halo) {
          this.halos.set(mesh, (halo = new FillHalo(mesh, layer)))
          const region = this.clipOfMesh.get(mesh)
          if (region) for (const m of halo.meshes()) this.clipMesh(m, region)
        }
        ;(halo as FillHalo).sync(amount, opacity, this.camera)
        lit.add(halo)
      }
    }
    // A held glow breathes with the scene's t — still when t stands still.
    const breath = breathe(Number.isFinite(this.frameT) ? this.frameT : 0)
    const seen = new Set<Holon>()
    for (const [holon, amount] of this.attended) {
      seen.add(holon)
      light(holon, Math.max(amount, authored.get(holon)?.value ?? 0) * breath)
    }
    for (const [holon, g] of authored) if (!seen.has(holon)) light(holon, g.value * breath)
    for (const halo of this.litHalos) if (!lit.has(halo)) halo.hide()
    this.litHalos = lit
  }

  private makeGlowLayer(): THREE.Group {
    const layer = new THREE.Group()
    // Identity, never moved: each halo carries its ink's world matrix itself.
    layer.matrixAutoUpdate = false
    // RESIDENCY: chapter ink sits at orders far above glow.ts's MASK_ORDER,
    // so the halos composite after it as a group (three's groupOrder).
    if (this.residency) layer.renderOrder = 1
    this.scene.add(layer)
    return layer
  }

  /** This holon's glow amount this frame — 0 for almost everything. */
  private highlightOf(holon: Holon): number {
    return this.highlighted.size > 0 && this.highlighted.has(holon) ? this.highlightAmount : 0
  }

  /**
   * A holon's world-space origin — where its group sits after every
   * ancestor transform. The drag plane of direct manipulation passes
   * through this point (editor/manipulate.ts).
   */
  worldOriginOf(holon: Holon): THREE.Vector3 | undefined {
    const found = this.groups.find((g) => g.holon === holon)
    if (!found) return undefined
    this.scene.updateMatrixWorld(true)
    return new THREE.Vector3().setFromMatrixPosition(found.group.matrixWorld)
  }

  /**
   * The world matrix of the frame a holon's x/y/z are stated in — its
   * parent group's (the scene's identity for a root). A world-space
   * delta carried through this matrix's inverse becomes the local delta
   * the holon's own params speak.
   */
  parentWorldMatrixOf(holon: Holon): THREE.Matrix4 | undefined {
    const found = this.groups.find((g) => g.holon === holon)
    if (!found) return undefined
    this.scene.updateMatrixWorld(true)
    return (found.group.parent ?? this.scene).matrixWorld.clone()
  }

  /** Depth in the part tree — how many wholes a holon sits inside. */
  private depthOf(holon: Holon): number {
    // A mounted holon's parents are final: its depth is counted once
    // (the pick asks it of every binding, through the proxy, per pointer move).
    const known = this.depths.get(holon)
    if (known !== undefined) return known
    let depth = 0
    let node: Holon | undefined = holon.parent
    while (node) {
      depth++
      node = node.parent
    }
    this.depths.set(holon, depth)
    return depth
  }
  private readonly depths = new WeakMap<Holon, number>()

  /**
   * Pixel distance from (px, py) to a ribbon's currently VISIBLE ink.
   *
   * Reads the packed instance buffers directly — the shader's own view of
   * the polyline — and honours the [erased, drawn] arc-length window, so
   * a half-drawn stroke is only pickable where the pen has been.
   */
  private ribbonDistance(
    ribbon: RibbonStroke,
    px: number,
    py: number,
    width: number,
    height: number,
    from = 0,
    to = Infinity,
  ): number {
    if (!ribbon.mesh.visible) return Infinity
    const count = ribbon.geometry.instanceCount
    if (count < 1) return Infinity
    const start = ribbon.geometry.getAttribute("instanceStart") as
      | THREE.InterleavedBufferAttribute
      | undefined
    const dist = ribbon.geometry.getAttribute("instanceDistanceStart") as
      | THREE.InterleavedBufferAttribute
      | undefined
    if (!start || !dist) return Infinity
    const positions = start.data.array as Float32Array
    const distances = dist.data.array as Float32Array
    const drawn = ribbon.drawnLength
    const erased = ribbon.erasedLength

    const matrix = ribbon.mesh.matrixWorld
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    let best = Infinity
    for (let i = from, end = Math.min(to, count); i < end; i++) {
      // Skip segments entirely outside the visible arc-length window.
      const d0 = distances[i * 2]!
      const d1 = distances[i * 2 + 1]!
      if (d0 >= drawn || d1 <= erased) continue
      a.set(positions[i * 6]!, positions[i * 6 + 1]!, positions[i * 6 + 2]!).applyMatrix4(matrix)
      b.set(positions[i * 6 + 3]!, positions[i * 6 + 4]!, positions[i * 6 + 5]!).applyMatrix4(matrix)
      // Clip the segment to the drawn window so the pen tip is honest.
      const span = d1 - d0
      if (span > 1e-9) {
        const from = Math.max(0, Math.min(1, (erased - d0) / span))
        const to = Math.max(0, Math.min(1, (drawn - d0) / span))
        if (to <= from) continue
        const delta = b.clone().sub(a)
        b.copy(a).addScaledVector(delta, to)
        a.addScaledVector(delta, from)
      }
      const pa = this.toScreen(a, width, height)
      const pb = this.toScreen(b, width, height)
      if (!pa || !pb) continue
      const d = segmentDistance2D(px, py, pa.x, pa.y, pb.x, pb.y)
      if (d < best) best = d
    }
    return best
  }

  /** 0 inside a visible fill's triangles, Infinity outside. */
  private fillDistance(
    fill: FillShape,
    px: number,
    py: number,
    width: number,
    height: number,
    fromTriangle = 0,
    toTriangle = Infinity,
  ): number {
    if (!fill.mesh.visible) return Infinity
    const geometry = fill.mesh.geometry
    const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined
    const index = geometry.getIndex()
    if (!position || !index) return Infinity
    const matrix = fill.mesh.matrixWorld
    const v = new THREE.Vector3()
    const project = (vertex: number): { x: number; y: number } | undefined => {
      v.fromBufferAttribute(position, vertex).applyMatrix4(matrix)
      return this.toScreen(v, width, height)
    }
    for (let i = fromTriangle * 3, end = Math.min(toTriangle * 3, index.count); i < end; i += 3) {
      const p0 = project(index.getX(i))
      const p1 = project(index.getX(i + 1))
      const p2 = project(index.getX(i + 2))
      if (!p0 || !p1 || !p2) continue
      if (pointInTriangle2D(px, py, p0, p1, p2)) return 0
    }
    return Infinity
  }

  /** Scratch for the fast pick: the camera's view-projection, and one buffer's MVP. */
  private readonly pickViewProjection = new THREE.Matrix4()
  private readonly pickModelViewProjection = new THREE.Matrix4()
  /** The model matrix the MVP above was made from (siblings share theirs: the Earth's thousands of strokes). */
  private readonly pickModel = new Float64Array(16).fill(NaN)

  /** projection · view · model for the fast pick — reused while consecutive buffers share a world matrix. */
  private pickMvp(world: THREE.Matrix4): ArrayLike<number> {
    const e = world.elements
    const last = this.pickModel
    let same = true
    for (let i = 0; i < 16; i++)
      if (e[i] !== last[i]) {
        same = false
        break
      }
    if (!same) {
      last.set(e)
      this.pickModelViewProjection.multiplyMatrices(this.pickViewProjection, world)
    }
    return this.pickModelViewProjection.elements
  }

  /**
   * ribbonDistance, measured only on the chunks whose boxes can reach within
   * `tolerance` px of the cursor (pickcull.ts). Equal to ribbonDistance
   * whenever that is ≤ tolerance; otherwise both are > tolerance (or ∞).
   */
  private ribbonDistanceCulled(
    ribbon: RibbonStroke,
    px: number,
    py: number,
    width: number,
    height: number,
    tolerance: number,
  ): number {
    if (!ribbon.mesh.visible) return Infinity
    const count = ribbon.geometry.instanceCount
    if (count < 1) return Infinity
    const start = ribbon.geometry.getAttribute("instanceStart") as THREE.InterleavedBufferAttribute | undefined
    if (!start) return Infinity
    const boxes = segmentBoxes(ribbon.geometry, start.data.array as Float32Array, start.data.version, count)
    const mvp = this.pickMvp(ribbon.mesh.matrixWorld)
    if (!mayReach(boxes.whole, 0, mvp, width, height, px, py, tolerance)) return Infinity
    let best = Infinity
    for (let k = 0, n = Math.ceil(count / CHUNK); k < n; k++) {
      if (!mayReach(boxes.chunks, k * 6, mvp, width, height, px, py, tolerance)) continue
      const d = this.ribbonDistance(ribbon, px, py, width, height, k * CHUNK, (k + 1) * CHUNK)
      if (d < best) best = d
    }
    return best
  }

  /** fillDistance, tested only in the triangle chunks whose boxes contain the cursor. */
  private fillDistanceCulled(fill: FillShape, px: number, py: number, width: number, height: number): number {
    if (!fill.mesh.visible) return Infinity
    const geometry = fill.mesh.geometry
    const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined
    const index = geometry.getIndex()
    if (!position || !index) return Infinity
    const boxes = triangleBoxes(geometry, position, index)
    const mvp = this.pickMvp(fill.mesh.matrixWorld)
    if (!mayReach(boxes.whole, 0, mvp, width, height, px, py, 0)) return Infinity
    for (let k = 0, n = Math.ceil(boxes.count / CHUNK); k < n; k++) {
      if (!mayReach(boxes.chunks, k * 6, mvp, width, height, px, py, 0)) continue
      if (this.fillDistance(fill, px, py, width, height, k * CHUNK, (k + 1) * CHUNK) === 0) return 0
    }
    return Infinity
  }

  /** 0 inside any visible mesh under an object (text glyph quads). */
  private groupScreenDistance(
    object: THREE.Object3D,
    px: number,
    py: number,
    width: number,
    height: number,
    cull = false,
  ): number {
    let hit = Infinity
    object.traverse((child) => {
      if (hit === 0) return
      if (!(child instanceof THREE.Mesh) || !child.visible) return
      const position = child.geometry.getAttribute("position") as THREE.BufferAttribute | undefined
      if (!position) return
      if (cull) {
        const mvp = this.pickMvp(child.matrixWorld)
        if (!mayReach(vertexBox(child.geometry, position).whole, 0, mvp, width, height, px, py, 0)) return
      }
      // Glyph quads are small and numerous; their screen AABB is the
      // honest, cheap answer for "did the cursor land on this text".
      const box = new THREE.Box2()
      const v = new THREE.Vector3()
      for (let i = 0; i < position.count; i++) {
        v.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld)
        const screen = this.toScreen(v, width, height)
        if (screen) box.expandByPoint(new THREE.Vector2(screen.x, screen.y))
      }
      if (!box.isEmpty() && box.containsPoint(new THREE.Vector2(px, py))) hit = 0
    })
    return hit
  }

  /** World-space points of a ribbon's current segment buffers. */
  private ribbonWorldPoints(ribbon: RibbonStroke, object: THREE.Object3D): THREE.Vector3[] {
    const count = ribbon.geometry.instanceCount
    const start = ribbon.geometry.getAttribute("instanceStart") as
      | THREE.InterleavedBufferAttribute
      | undefined
    if (count < 1 || !start) return []
    const positions = start.data.array as Float32Array
    const out: THREE.Vector3[] = []
    for (let i = 0; i < count; i++) {
      out.push(
        new THREE.Vector3(positions[i * 6]!, positions[i * 6 + 1]!, positions[i * 6 + 2]!)
          .applyMatrix4(object.matrixWorld),
      )
      out.push(
        new THREE.Vector3(positions[i * 6 + 3]!, positions[i * 6 + 4]!, positions[i * 6 + 5]!)
          .applyMatrix4(object.matrixWorld),
      )
    }
    return out
  }

  /** World-space vertices of every mesh under an object. */
  private meshWorldPoints(object: THREE.Object3D): THREE.Vector3[] {
    const out: THREE.Vector3[] = []
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.visible) return
      const position = child.geometry.getAttribute("position") as THREE.BufferAttribute | undefined
      if (!position) return
      for (let i = 0; i < position.count; i++) {
        out.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld))
      }
    })
    return out
  }

  /**
   * Creation/erasure fraction → the WORLD-arc fraction the ribbon wants,
   * under Sketch & Toon's actual draw model: the pen advances by SCREEN
   * pixels of VISIBLE stroke (render/screen-arc.ts carries the derivation
   * and the reference measurement).
   *
   * Why the host and not the shader: the map depends on this frame's
   * projection of this stroke, is different for every stroke, and is
   * needed as a scalar, not per-fragment. That is CPU work by TASTE's
   * own split rule ("work that decides what elements exist runs on CPU";
   * here, where the pen IS). The ribbon keeps its world-arc uniforms
   * untouched, so nothing about the stroke pipeline changes — only the
   * number handed to it.
   *
   * Cost: one projection pass per stroke per frame over
   * SCREEN_ARC_SAMPLES points. A straight Line needs the subdivision
   * because screen position is NOT affine in world position under
   * perspective — the whole effect being reproduced is that
   * non-affinity — so two endpoints would measure a chord and miss it.
   */
  private screenArc(binding: StrokeBinding, fraction: number): number {
    if (fraction <= 0) return 0
    if (fraction >= 1) return 1
    return this.arcFrom(this.measureScreenArc(binding.ribbon), fraction)
  }

  /** A fraction strictly inside (0, 1), remapped through a measurement. */
  private arcFrom(
    measured: { remap: ReturnType<typeof screenArcRemap>; totalWorld: number } | undefined,
    fraction: number,
  ): number {
    if (!measured) return fraction
    return Math.max(0, Math.min(1, measured.remap.worldAt(fraction) / measured.totalWorld))
  }

  /**
   * One ribbon's screen-arc measurement for this frame: how long its
   * visible ink is in pixels, and the fraction→world map along it.
   *
   * Factored out of screenArc() because the cylinder needs the LENGTH on
   * its own — to weigh its five contour strokes against each other —
   * before it needs the map within any one of them.
   */
  private measureScreenArc(
    ribbon: RibbonStroke,
  ): { remap: ReturnType<typeof screenArcRemap>; totalWorld: number } | undefined {
    const pts = ribbon.worldPoints()
    if (pts.length < 2) return undefined
    const width = this.renderer.domElement.width || 1280
    const height = this.renderer.domElement.height || 720
    const matrix = ribbon.mesh.matrixWorld
    // A pooled array of point records, rewritten in place (perf: one fresh
    // object per point per stroke per frame was the draw-on's GC churn —
    // ~80k a frame on the Earth). toScreen's arithmetic is inlined
    // unchanged, so every value is the same as before, bit for bit.
    const projected = this.arcPool
    const perspective = this.camera instanceof THREE.PerspectiveCamera
    let count = 0
    // Two scratch points, swapped each step, in place of a clone per
    // point (perf F) — the same values, so the same arithmetic.
    let v = this.arcPoint
    let previous = this.arcPrevious
    let world = 0
    let first = true
    for (const local of pts) {
      v.copy(local).applyMatrix4(matrix)
      if (!first) world += v.distanceTo(previous)
      first = false
      const ndc = this.ndcScratch.copy(v).project(this.camera)
      const onCamera =
        Number.isFinite(ndc.x) && Number.isFinite(ndc.y) && !(perspective && ndc.z > 1)
      const p = (projected[count] ??= { x: 0, y: 0, world: 0, onCamera: false })
      p.x = onCamera ? ((ndc.x + 1) / 2) * width : 0
      p.y = onCamera ? ((1 - ndc.y) / 2) * height : 0
      p.world = world
      p.onCamera = onCamera
      count++
      const swap = previous
      previous = v
      v = swap
    }
    if (world <= 0) return undefined
    const remap = screenArcRemap(projected, world, { width, height }, count)
    // A stroke with no visible ink has no screen parametrisation; the
    // remap already falls back to the identity, so this is the cheap
    // early out.
    if (remap.screenLength <= 0) return undefined
    return { remap, totalWorld: world }
  }

  /**
   * One ribbon's ink length in SCREEN pixels at this frame, 0 when it
   * has none — the weight the cylinder proportions its five contour
   * strokes by (see syncCylinder). Same measurement as screenArc()'s,
   * asked for the total rather than the map.
   */
  private screenLength(ribbon: RibbonStroke): number {
    return this.measureScreenArc(ribbon)?.remap.screenLength ?? 0
  }

  /** Scratch for measureScreenArc / toScreen — never held across calls. */
  /** measureScreenArc's reusable point records (screenArcRemap keeps no reference). */
  private readonly arcPool: ProjectedPoint[] = []
  private readonly arcPoint = new THREE.Vector3()
  private readonly arcPrevious = new THREE.Vector3()
  private readonly ndcScratch = new THREE.Vector3()

  /** World point → device pixels (y down), or undefined behind the camera. */
  private toScreen(
    world: THREE.Vector3,
    width: number,
    height: number,
  ): { x: number; y: number } | undefined {
    const ndc = this.ndcScratch.copy(world).project(this.camera)
    if (!Number.isFinite(ndc.x) || !Number.isFinite(ndc.y)) return undefined
    if (this.camera instanceof THREE.PerspectiveCamera && ndc.z > 1) return undefined
    return { x: ((ndc.x + 1) / 2) * width, y: ((1 - ndc.y) / 2) * height }
  }

  dispose(): void {
    for (const { binding } of this.texts) binding.dispose()
    this.texts.length = 0
    this.compositor?.dispose()
    this.renderer.dispose()
  }
}

/** A 3D pick's `accept`, asked once per holon per query (none: every holon). */
const acceptance = (accept: ((holon: Holon) => boolean) | undefined): ((holon: Holon) => boolean) => {
  if (!accept) return () => true
  const seen = new Map<Holon, boolean>()
  return (holon) => {
    let ok = seen.get(holon)
    if (ok === undefined) seen.set(holon, (ok = accept(holon)))
    return ok
  }
}

/** Pixel distance from a point to a 2D segment. */
const segmentDistance2D = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number => {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  const u = lenSq > 1e-12 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq)) : 0
  return Math.hypot(px - (ax + dx * u), py - (ay + dy * u))
}

/** Whether a 2D point lies inside a triangle (any winding). */
const pointInTriangle2D = (
  px: number,
  py: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): boolean => {
  const cross = (ox: number, oy: number, ux: number, uy: number, vx: number, vy: number) =>
    (ux - ox) * (vy - oy) - (uy - oy) * (vx - ox)
  const d1 = cross(a.x, a.y, b.x, b.y, px, py)
  const d2 = cross(b.x, b.y, c.x, c.y, px, py)
  const d3 = cross(c.x, c.y, a.x, a.y, px, py)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}
