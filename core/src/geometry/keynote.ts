/**
 * Keynote slide → polyline. The importer behind the `Slides` holon.
 *
 * The sibling of geometry/svg.ts, and the same act: a frame change and
 * nothing else. A `.key` slide is not a foreign format to be rasterized,
 * it is a set of strokes stated in a different frame — Keynote's
 * 1920×1080 y-DOWN pixel canvas — so this module states that frame
 * change explicitly and hands the result to the ordinary Line/Stroke
 * path. There is no Keynote renderer here and there must never be one.
 *
 * WHY THIS IS EASIER THAN SVG, AND WHERE THE WORK ACTUALLY IS
 *
 * svg.ts spends most of its length on a parser, because SVG states a
 * path as a `d` mini-language string. Keynote does not: `keynote-parser`
 * decodes the .iwa protobuf into TYPED records —
 *
 *     { type: "moveTo",       points: [{x, y}] }
 *     { type: "lineTo",       points: [{x, y}] }
 *     { type: "curveTo",      points: [c1, c2, end] }
 *     { type: "closeSubpath" }
 *
 * — so there is no scanner, no implicit command repetition, no arc
 * command. What replaces the parser is the SHAPE FIT, which SVG does not
 * have at all and which is the one genuinely non-obvious thing in the
 * format:
 *
 *   A Keynote shape stores its path in its own design box, at whatever
 *   scale the shape library authored it in — the built-in circle is a
 *   0…100 box, the icon library is a 0…400 box, a text box is 1:1 with
 *   its own size, and a straight line is a 0…141.42 diagonal. The
 *   rendered shape is that path's FLATTENED CURVE BOUNDING BOX mapped
 *   onto the geometry box [position, position + size], then rotated by
 *   `angle` about the box's centre.
 *
 * That rule is not documented anywhere; it was established by measuring
 * (docs/reports/pl02/p1). Four icons on slide 2 — Tree_70, Eagle In
 * Flight_839, Sunburst_304, Apple_141 — have curve-box aspects of
 * 0.7958, 1.0004, 1.0000 and 0.8788, and their geometry sizes have the
 * same four aspects to four decimals, while their CONTROL-point boxes
 * (which include bezier overshoot) do not. The title slide's main circle
 * confirms the placement half: a 0…100 curve box at position
 * (730.4116, 205.50696) size 459.17673 gives centre (960.000, 435.095)
 * and r 229.5884, which is the geometry the recon cross-validated
 * against the footage to sub-pixel.
 *
 * So: flatten FIRST, fit SECOND. The flattening happens in the design
 * box's own units and the tolerance is scaled accordingly, which is why
 * `flattenTolerance` below is stated in SLIDE units and converted per
 * shape rather than passed through raw.
 *
 * THE OUTPUT IS DATA, NOT HOLONS
 *
 * Everything here returns plain records. Turning them into Stroke parts
 * is `core/vocabulary/Slides/Slides.ts`'s job, exactly as Sketch.ts
 * turns svg.ts's polylines into Lines. That division is what lets the
 * codegen (core/scripts/key2ts.ts) run this module at author time and
 * commit the result: the browser never sees a .key file.
 */

import { flattenCubic, type Vec2, type Bounds } from "./svg"

// ---------------------------------------------------------------------------
// The slide frame
// ---------------------------------------------------------------------------

/**
 * The deck's canvas, in its own units. Every geometry number in a
 * Keynote archive is stated here: x right, **y DOWN**, origin at the
 * TOP-LEFT corner.
 */
export const SLIDE_WIDTH = 1920
export const SLIDE_HEIGHT = 1080

/**
 * Slide units per rendered video pixel, and why it is exactly 3/2.
 *
 * The PL02 recording is 1280×720; the deck is 1920×1080. 1920/1280 =
 * 1080/720 = 3/2 exactly, so the canvas maps onto the frame with no
 * letterboxing and no crop, and one slide unit is 2/3 of a video pixel.
 * The recon's identification proof rests on this: the deck's title
 * circle r = 229.5884 slide units predicts 229.5884 × 2/3 = 153.0589 px,
 * and six averaged title-card frames measure 153.06.
 *
 * Kept as a named constant rather than inlined because it is the bridge
 * between two measured worlds — change it and every overlay number in
 * the chapter moves.
 */
export const SLIDE_UNITS_PER_VIDEO_PIXEL = 3 / 2

/**
 * Slide units → DreamTalk world units, given the world height the frame
 * spans.
 *
 * There is no camera in a Keynote deck, so unlike the pydeation corpus
 * there is no rig to adopt — the mapping is a pure statement that the
 * 1080-unit canvas fills the visible frame height. A scene that frames
 * `frameHeight` world units of vertical view therefore scales slide
 * units by `frameHeight / 1080`.
 *
 * With the framework's own 36mm rig (Observer.look, 53.13° horizontal
 * at 16:9, radius 1000) the visible height is 2·1000·tan(31.417°/2) =
 * 562.4987, so a slide unit is 0.5208 world units and the title
 * circle's 229.5884 becomes 119.577 — which renders back to 153.06 px
 * at 720p, closing the loop.
 */
export const slideToWorld = (frameHeight: number): number => frameHeight / SLIDE_HEIGHT

/**
 * The full slide → world frame change, as a point map.
 *
 * Two acts, both forced by the formats and neither a preference:
 *
 *  1. the origin moves from the canvas's TOP-LEFT to its CENTRE, so a
 *     slide's middle is the world origin and a Slide holon at (0,0,0)
 *     sits where the projector puts it;
 *  2. **y is negated** — Keynote's y grows downward, ours grows upward.
 *     Without this every imported slide is upside down, which is the
 *     identical flip svg.ts performs for the same reason.
 *
 * The y-flip reverses the handedness of the plane, so a subpath that was
 * clockwise in the deck is counterclockwise here. That is the winding
 * reversal `Stroke.drawReversed` documents, and it is left as it falls.
 */
export const slidePointToWorld = (p: Vec2, scale: number): Vec2 => ({
  x: (p.x - SLIDE_WIDTH / 2) * scale,
  y: -(p.y - SLIDE_HEIGHT / 2) * scale,
})

/**
 * Flattening tolerance, in SLIDE units — the greatest distance a chord
 * may stray from the true curve on the finished canvas.
 *
 * A quarter slide unit is 1/6 of a video pixel at 720p, comfortably
 * under the encode's own blur, and it is the same number svg.ts uses in
 * its (differently scaled) user units. Stated on the canvas rather than
 * in the design box because the design boxes differ per shape — 0…100
 * for a built-in circle, 0…400 for the icon library — and a fixed
 * design-box tolerance would flatten a 460-unit circle and a 90-unit
 * apple to wildly different fidelities.
 */
export const FLATTEN_TOLERANCE_SLIDE = 0.25

const EPSILON = 1e-9
const DEG = Math.PI / 180

// ---------------------------------------------------------------------------
// What keynote-parser hands us
// ---------------------------------------------------------------------------

/** One typed path element, as `keynote-parser` decodes it. */
export interface KeyPathElement {
  type: "moveTo" | "lineTo" | "curveTo" | "closeSubpath" | "quadCurveTo"
  points?: readonly Vec2[]
}

/** `TSD.GeometryArchive` — where the shape sits on the canvas. */
export interface KeyGeometry {
  position: Vec2
  size: { width: number; height: number }
  /** Rotation in DEGREES, counterclockwise, about the box's centre. */
  angle?: number
  /** Bit 1 = horizontal flip, bit 2 = vertical flip (Keynote's own). */
  flags?: number
}

/** An RGBA colour as the archives state it: components in 0…1. */
export interface KeyColor {
  r: number
  g: number
  b: number
  a: number
}

/** A resolved stroke: colour, width, and the dash pattern if any. */
export interface KeyStroke {
  color: KeyColor
  width: number
  /** `TSDSolidPattern` | `TSDPattern` | `TSDEmptyPattern`. */
  patternType: string
  /** The dash array, in stroke-width multiples. Empty when solid. */
  pattern: readonly number[]
  cap: string
  join: string
}

/** A resolved fill. Only flat colour survives; see `KeyShape.fill`. */
export interface KeyFill {
  color: KeyColor
}

// ---------------------------------------------------------------------------
// The slide model — what survives the import
// ---------------------------------------------------------------------------

/**
 * A drawn shape, flattened and placed on the canvas.
 *
 * `subpaths` are in SLIDE coordinates (y still down, origin top-left) —
 * the frame change to world happens in the holon, so the data modules
 * stay readable against the deck and against every number in the recon
 * report.
 */
export interface KeyShape {
  kind: "shape"
  /** The Keynote archive id — the identity MagicMove matches on (P-6). */
  id: string
  /** `localizationKey` when this is a built-in library icon (`Tree_70`). */
  icon?: string
  /** One polyline per subpath, in slide coordinates. */
  subpaths: Vec2[][]
  /** Parallel to `subpaths`: did the source close it? */
  closed: boolean[]
  stroke?: KeyStroke
  /** Flat colour only. A gradient fill is dropped and named in `skipped`. */
  fill?: KeyFill
  /** The shape's own opacity, 0…1. */
  opacity: number
  /** The geometry box it was fitted into, kept for MagicMove and for tests. */
  frame: KeyGeometry
}

/**
 * A run of text, with the box Keynote laid it in.
 *
 * Keynote anchors text in a RECTANGLE (position + size, plus a vertical
 * alignment within it); core's `Text` anchors a block on a POINT. The
 * conversion is the holon's, so both the box and the alignment survive
 * here rather than being collapsed to a point at import time — P-2 needs
 * the box to place the title card, and collapsing early would throw away
 * the only thing that makes the placement checkable.
 */
export interface KeyText {
  kind: "text"
  id: string
  /** The string, newlines intact (`MonoLogos\nNode` is one record). */
  content: string
  /** The text box on the canvas. */
  frame: KeyGeometry
  /** Horizontal alignment within the box. */
  align: "left" | "center" | "right" | "justify"
  /** Where the laid-out lines sit inside the box (`kFrameAlign*`). */
  verticalAlign: "top" | "middle" | "bottom"
  /** The box's inner inset, in slide units. Keynote's default is 4. */
  padding: { left: number; top: number; right: number; bottom: number }
  /** Paragraph line spacing as a MULTIPLE of the font size (0.8 on the
   *  title card — Keynote's tight-leading default for the Basic Black
   *  theme's title style). */
  lineSpacing: number
  /**
   * TRACKING — extra advance after each character, as a fraction of the
   * em; negative tightens. Optional, so a module generated before this
   * field existed still typechecks; absent reads as 0, the face's own
   * advance.
   *
   * It is declared in the THEME stylesheet's character style rather than
   * on the slide, so it reaches the model only through the decoder's
   * merged style chain — and it is load-bearing on the title card, whose
   * -0.02 is exactly the difference between the deck's 610 px word and
   * HelveticaNeue-Bold's untracked 640 at 720p (P-2). The shaper's
   * `letterSpacing` is the same quantity in the same units, so it is a
   * pass-through and not a conversion.
   */
  tracking?: number
  /** Point size, in SLIDE units (the deck's 24 / 32 / 34 / 50 / 116). */
  fontSize: number
  /** PostScript face name — `HelveticaNeue-Bold`, `HelveticaNeue`. */
  fontName: string
  bold: boolean
  italic: boolean
  color: KeyColor
  opacity: number
}

/** A drawable: either geometry or type. Groups are flattened away — see
 *  `KeySlide.groups` for what is kept of them. */
export type KeyDrawable = KeyShape | KeyText

/**
 * A group, recorded as MEMBERSHIP rather than as a container.
 *
 * Keynote's `TSD.GroupArchive` carries a geometry of its own, but its
 * children are stored in absolute canvas coordinates already — so a
 * group contributes no transform, only identity ("these ten shapes are
 * one thing"). Flattening the tree and keeping the membership list is
 * therefore lossless AND simpler than nesting: the holon can still wrap
 * a group's members in a `Group` when a scene wants to move them
 * together, and P-6's MagicMove can match on group identity.
 */
export interface KeyGroup {
  id: string
  /** Ids of the drawables directly inside, in z-order. */
  members: string[]
}

/**
 * A build (Keynote's per-object animation), as declared.
 *
 * Builds arrive in the DECK'S OWN ORDER — the `KN.SlideArchive.builds`
 * list, which the format states rather than the importer observing. When
 * they FIRE is a separate question, answered by `KeySlide.buildChunks`.
 */
export interface KeyBuild {
  /** The `KN.BuildArchive` id — what a build chunk refers to. */
  id: string
  /** The drawable this build animates. */
  target: string
  /** `com.apple.iWork.Keynote.LineDrawForLine`, `apple:dissolve`, … */
  effect: string
  /** `In` | `Out` | `Action`. */
  animationType: string
  duration: number
  delay: number
  /** `All at Once` | `By Object` | per-character deliveries. */
  delivery: string
  /** `kEaseBoth`, … — the acceleration curve Keynote names. */
  acceleration?: string
  /**
   * Which END of the stroke a `LineDrawForLine` draws from — the field
   * that disambiguates a direction the geometry cannot supply.
   *
   * Carried UNINTERPRETED, on purpose. The deck uses three values (51
   * once, 52 twenty-eight times, 53 fifteen times) and omits the field
   * entirely on 114 of its 158 LineDrawForLine builds, so absence is the
   * default and only five slides state it at all — deck slide 9 uses 53
   * throughout. P-3 measured slide 2's four connection lines against the
   * footage and found all four draw centre-outward, two of them AGAINST
   * their stored point order (52) and one with it (51); four samples
   * name the field's role but not its general semantics, so a consumer
   * that needs a rule states its own reading rather than inheriting a
   * guess from here.
   */
  direction?: number
}

/**
 * One chunk of animation — the firing model, and the real timing.
 *
 * Keynote separates WHAT animates (a build) from WHEN it fires (a
 * chunk). Chunks are listed in firing order. The chunk's `duration`
 * agrees with its build's in all 384 cases here, so a chunk contributes
 * the WHEN and never a second duration to reconcile — the value worth
 * having is `automatic`.
 *
 * THIS CORRECTS THE RECON REPORT. Its §0 states "every one of the 413
 * build events has `isAutomatic` and `automaticDelay` absent, i.e.
 * Keynote's default: advance on click", and concludes the shape of each
 * animation is in the file while the moment it fires is not. That reads
 * `isAutomatic` on the build's `animationAttributes` — the wrong field.
 * The chunk's own `automatic` flag tells a different story: across
 * slides 1-58, **89 of 384 chunks are click-advanced and 295 are
 * automatic**. So the deck DOES declare its cascades; only the clicks
 * are missing from it.
 *
 * The arithmetic corroborates: 89 clicks + 58 slide transitions = 147
 * declared advances, against the 141 animation events the recon measured
 * from `frames5` — within 4%, the residual being events too subtle or
 * too closely spaced for a motion scan to separate. That is a much
 * tighter account of the video's 141 events than "413 builds compress by
 * clicking", and it means a reproduction has more declared timing
 * available to it than the report supposed: only the 89 click onsets are
 * genuinely footage-only.
 */
export interface KeyBuildChunk {
  /** The `KeyBuild.id` this chunk fires. */
  build: string
  duration: number
  delay: number
  /**
   * True when this chunk follows its predecessor automatically; false
   * when it waits for a click. 295 true / 89 false across slides 1-58.
   */
  automatic: boolean
  chunkId: number
}

/** The slide's incoming transition. */
export interface KeyTransition {
  /** `apple:magic-move-implied-motion-path`, `…BLTFadeThruColor`, `none`. */
  effect: string
  duration: number
  delay: number
  /** The timing curve name, when the archive states one. */
  timingCurve?: string
  /** MagicMove's fade of objects with no partner on the next slide. */
  fadeUnmatched?: boolean
}

/** One slide, fully imported. */
export interface KeySlide {
  /** 1-based position in the SHOW's order (the recon's segment table). */
  index: number
  /** The `KN.SlideArchive` id. */
  id: string
  /** Drawables in z-order, back to front. */
  drawables: KeyDrawable[]
  groups: KeyGroup[]
  /** Builds in the deck's own declared order. */
  builds: KeyBuild[]
  /** The click grouping, in click order — see KeyBuildChunk. */
  buildChunks: KeyBuildChunk[]
  transition?: KeyTransition
  /** Element kinds encountered but not converted, for the caller to report. */
  skipped: string[]
}

// ---------------------------------------------------------------------------
// Flattening
// ---------------------------------------------------------------------------

/** A parsed subpath in the shape's own DESIGN box, before the fit. */
interface RawSubpath {
  points: Vec2[]
  closed: boolean
}

/** A quadratic is a cubic whose controls sit 2/3 of the way to the handle. */
const quadraticToCubic = (p0: Vec2, q: Vec2, p2: Vec2): [Vec2, Vec2] => [
  { x: p0.x + (2 / 3) * (q.x - p0.x), y: p0.y + (2 / 3) * (q.y - p0.y) },
  { x: p2.x + (2 / 3) * (q.x - p2.x), y: p2.y + (2 / 3) * (q.y - p2.y) },
]

/**
 * Flatten a typed element list into subpaths, in the path's own units.
 *
 * The curve maths is svg.ts's `flattenCubic`, imported rather than
 * restated — same recursive de Casteljau, same control-polygon flatness
 * test, same depth cap. Only the dispatch differs, and it is trivial
 * because the records are already typed.
 *
 * `closeSubpath` behaves as SVG's Z: return to the subpath's start if
 * not already there, mark it closed, and let a following element start
 * a new run. Keynote emits a redundant trailing `moveTo` back to the
 * start after most `closeSubpath`s (see any built-in circle) — that
 * lands as a 1-point run and is dropped by the length guard, which is
 * why the built-in circle imports as ONE subpath and not two.
 */
export const flattenElements = (
  elements: readonly KeyPathElement[],
  tolerance: number,
): RawSubpath[] => {
  const subpaths: RawSubpath[] = []
  let current: Vec2[] = []
  let closed = false
  let pen: Vec2 = { x: 0, y: 0 }
  let start: Vec2 = { x: 0, y: 0 }

  const flush = (): void => {
    if (current.length >= 2) subpaths.push({ points: current, closed })
    current = []
    closed = false
  }

  for (const el of elements) {
    const pts = el.points ?? []
    switch (el.type) {
      case "moveTo": {
        const p = pts[0]
        if (!p) break
        flush()
        pen = { x: p.x, y: p.y }
        start = pen
        current = [pen]
        break
      }
      case "lineTo": {
        const p = pts[0]
        if (!p) break
        pen = { x: p.x, y: p.y }
        current.push(pen)
        break
      }
      case "curveTo": {
        const [c1, c2, end] = pts
        if (!c1 || !c2 || !end) break
        if (current.length === 0) current = [pen]
        flattenCubic(pen, c1, c2, end, tolerance, current)
        pen = { x: end.x, y: end.y }
        break
      }
      case "quadCurveTo": {
        const [q, end] = pts
        if (!q || !end) break
        if (current.length === 0) current = [pen]
        const [c1, c2] = quadraticToCubic(pen, q, end)
        flattenCubic(pen, c1, c2, end, tolerance, current)
        pen = { x: end.x, y: end.y }
        break
      }
      case "closeSubpath": {
        if (current.length > 0) {
          const last = current[current.length - 1]!
          if (Math.abs(last.x - start.x) > EPSILON || Math.abs(last.y - start.y) > EPSILON) {
            current.push(start)
          }
          closed = true
          flush()
        }
        pen = start
        break
      }
    }
  }
  flush()
  return subpaths
}

const boundsOf = (subpaths: readonly (readonly Vec2[])[]): Bounds => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const sp of subpaths) {
    for (const p of sp) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  return { minX, minY, maxX, maxY }
}

/**
 * Place a flattened path into its geometry box — THE fit rule.
 *
 * The path's curve bounding box maps onto [position, position + size];
 * then `angle` rotates the result counterclockwise about the box's
 * centre, and Keynote's flip bits mirror it in the box.
 *
 * A degenerate axis (the title slide's two lines have height exactly 0)
 * collapses to a scale of 1 on that axis rather than dividing by zero,
 * and the box's own centre still places it — which is how a zero-height
 * rotated line lands on its stated endpoints.
 *
 * The rotation is COUNTERCLOCKWISE in Keynote's y-down canvas, so in
 * canvas coordinates it reads as the standard rotation with y negated;
 * stated directly here so the y-flip to world stays the holon's single
 * responsibility rather than being smeared across two modules.
 */
export const fitToFrame = (
  subpaths: readonly (readonly Vec2[])[],
  frame: KeyGeometry,
): Vec2[][] => {
  const box = boundsOf(subpaths)
  const bw = box.maxX - box.minX
  const bh = box.maxY - box.minY
  const sx = bw > EPSILON ? frame.size.width / bw : 1
  const sy = bh > EPSILON ? frame.size.height / bh : 1
  const flipH = ((frame.flags ?? 0) & 1) !== 0
  const flipV = ((frame.flags ?? 0) & 2) !== 0
  const cx = frame.position.x + frame.size.width / 2
  const cy = frame.position.y + frame.size.height / 2
  const theta = (frame.angle ?? 0) * DEG
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)

  return subpaths.map((sp) =>
    sp.map((p): Vec2 => {
      // Design box → the geometry box, as an offset from its centre.
      let dx = (p.x - box.minX) * sx - frame.size.width / 2
      let dy = (p.y - box.minY) * sy - frame.size.height / 2
      if (flipH) dx = -dx
      if (flipV) dy = -dy
      // Counterclockwise on a y-down canvas.
      return { x: cx + dx * cos + dy * sin, y: cy - dx * sin + dy * cos }
    }),
  )
}

/**
 * The whole shape-geometry act: flatten in the design box, then fit.
 *
 * `tolerance` is in SLIDE units and is converted into the design box's
 * own units by the box's scale, so a 0…400 icon squeezed into a 90-unit
 * apple is not flattened four times finer than it renders.
 */
export const importShapePath = (
  elements: readonly KeyPathElement[],
  frame: KeyGeometry,
  tolerance = FLATTEN_TOLERANCE_SLIDE,
): { subpaths: Vec2[][]; closed: boolean[] } => {
  // Flatten once coarsely to learn the design box, so the tolerance can
  // be scaled; then flatten again at the right fineness. Two passes are
  // cheap (the corpus is 6,289 control points) and the alternative is
  // guessing the box from the control points, which the Apple_141 case
  // above shows is wrong by 18%.
  const probe = flattenElements(elements, tolerance)
  const box = boundsOf(probe.map((s) => s.points))
  const bw = box.maxX - box.minX
  const bh = box.maxY - box.minY
  const sx = bw > EPSILON ? frame.size.width / bw : 1
  const sy = bh > EPSILON ? frame.size.height / bh : 1
  const scale = Math.max(Math.abs(sx), Math.abs(sy))
  const designTolerance = scale > EPSILON ? tolerance / scale : tolerance

  const raw = flattenElements(elements, designTolerance)
  return {
    subpaths: fitToFrame(
      raw.map((s) => s.points),
      frame,
    ),
    closed: raw.map((s) => s.closed),
  }
}

// ---------------------------------------------------------------------------
// Type placement
// ---------------------------------------------------------------------------

/**
 * HelveticaNeue's vertical metrics, as fractions of the em.
 *
 * Only two numbers are needed to place a line of type against a box, and
 * both are the face's own: the CAP HEIGHT (how far the capitals rise
 * above the baseline) and the DESCENT (how far the tails drop below it).
 * The deck sets every string in HelveticaNeue, whose published cap
 * height is 0.714 em and whose descender is 0.212 em.
 *
 * These are the face's published values, and the footage confirms them
 * rather than supplying them — which is the difference between a
 * derivation and a fit. On the title card at font size 116 slide units
 * (77.333 video px), 0.714 em predicts a 55.2 px cap height and the
 * reference's dense-glyph band measures rows 522…577, i.e. 55 px.
 */
export const HELVETICA_CAP_HEIGHT = 0.714
export const HELVETICA_DESCENT = 0.212

/**
 * The BASELINE of a single-line text record, in slide coordinates.
 *
 * Keynote lays lines inside the box's padded interior and then aligns
 * the resulting block vertically; core's `Text` anchors on the baseline
 * (render/text.ts: "three-text lays the block out from its own origin —
 * x already centred, y on the BASELINE"). So the conversion between the
 * two models is exactly this function, and it is a conversion rather
 * than an approximation.
 *
 *   bottom  the block's DESCENT rests on the padded bottom edge, so
 *           the baseline sits one descent above it;
 *   top     the block's ASCENT hangs from the padded top edge — Keynote
 *           uses the line height for this, which at `lineSpacing` L is
 *           L·size, leaving (L·size − cap − descent) of internal leading
 *           split above the cap;
 *   middle  the block's ink is centred in the padded interior, so the
 *           baseline sits half a cap height below that centre.
 *
 * The title card exercises the `bottom` branch and closes to 0.4 px: box
 * bottom 895.496 slide units, padding 4, descent 0.212·116 = 24.6, so
 * baseline 866.9 slide units = 577.9 video px against a measured 577.
 *
 * Multi-line strings (`MonoLogos\nNode`, three of the deck's 48) get the
 * FIRST line's baseline; the holon steps subsequent lines by the line
 * height, which is what core's `Text` does with an embedded newline.
 */
export const textBaseline = (text: KeyText, lineCount = 1): number => {
  const size = text.fontSize
  const cap = size * HELVETICA_CAP_HEIGHT
  const descent = size * HELVETICA_DESCENT
  const lineHeight = size * (text.lineSpacing > 0 ? text.lineSpacing : 1)
  const top = text.frame.position.y + text.padding.top
  const bottom = text.frame.position.y + text.frame.size.height - text.padding.bottom
  const blockHeight = (lineCount - 1) * lineHeight + cap + descent

  switch (text.verticalAlign) {
    case "bottom":
      return bottom - descent - (lineCount - 1) * lineHeight
    case "middle":
      return (top + bottom) / 2 - blockHeight / 2 + cap
    default:
      return top + (lineHeight - cap - descent) / 2 + cap
  }
}

/**
 * The x a text record's block anchors on, in slide coordinates —
 * paired with `textBaseline`, and the same conversion in the other axis.
 *
 * `center` puts the padded interior's middle on the anchor and `left`
 * its left edge, which is precisely core's `TextAlign`. Keynote's
 * `right` and `justify` have no core counterpart yet; `right` falls back
 * to the padded right edge with a left anchor (correct for a single
 * line only), and `justify` reads as `left`, which is what the deck's
 * two justified paragraph styles actually render as at these widths.
 */
export const textAnchorX = (text: KeyText): number => {
  const left = text.frame.position.x + text.padding.left
  const right = text.frame.position.x + text.frame.size.width - text.padding.right
  switch (text.align) {
    case "center":
      return (left + right) / 2
    case "right":
      return right
    default:
      return left
  }
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/** A Keynote colour as a hex string, for the generated modules. */
export const colorToHex = (c: KeyColor): string => {
  const ch = (v: number): string =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0")
  return `#${ch(c.r)}${ch(c.g)}${ch(c.b)}`
}

/**
 * The deck's palette, READ FROM THE STYLESHEET — which corrects the
 * recon report on two counts, and both corrections matter.
 *
 * Report §1 quotes "blue ≈ #00A1FF and red ≈ #EE220C — the deck's
 * stylesheet carries exactly those two, and they are pydeation's
 * BLUE/RED". Reading the stylesheet directly says otherwise. Counting
 * the stroke colours across its 109 shape styles gives white 46, black
 * 16, **#00A2FF 12**, **#FF644E 10**, and one instance each of #61D835,
 * #EE220C, #53585F and #FAE232.
 *
 * So:
 *
 *  - the blue is **#00A2FF**, not #00A1FF. The encode's measured
 *    #00A1FF is a rounding of it (the stylesheet float is 0.6336032,
 *    i.e. 161.57/255, which rounds to 162);
 *  - the body red is **#FF644E**, used ten times including on the title
 *    card. #EE220C exists but appears exactly ONCE in the whole deck,
 *    so it is an outlier, not the palette.
 *
 * And the conclusion the report drew from its own numbers holds even
 * more cleanly than it claimed: #00A2FF and #FF644E are `constants.ts`'s
 * BLUE and RED — pydeation's own constants, to the byte. The deck and
 * the 2021 corpus share a palette exactly, so a reproduction carries one
 * blue and one red, not two of each.
 *
 * The stylesheet wins under the derivation rule (DECISIONS 2026-09-07:
 * read what the source declares; measure only what exists nowhere else).
 */
export const DECK_BLUE = "#00a2ff"
export const DECK_RED = "#ff644e"
export const DECK_WHITE = "#ffffff"
/** The greyed/secondary state — slides 15 and 29's dimmed chain links. */
export const DECK_DIM = "#a9a9a9"

// ---------------------------------------------------------------------------
// The generated-module contract
// ---------------------------------------------------------------------------

/**
 * The shape of a generated slide module (core/scripts/key2ts.ts).
 *
 * Deliberately dumb, exactly like `SketchData`: flat coordinate arrays
 * and provenance, no methods. Coordinates are in SLIDE units (y down,
 * origin top-left) so a module reads directly against the deck and
 * against the recon report's numbers; the frame change to world is the
 * `Slide` holon's, and baking it in would freeze a scene-level decision
 * into an asset.
 */
export interface SlideData {
  /** 1-based position in the show — the recon's segment index. */
  index: number
  /** The `KN.SlideArchive` id, for cross-referencing the deck. */
  id: string
  /** Repo-relative path of the unpacked deck this came from. */
  source: string
  /** First 16 hex of the slide archive's SHA-256, for drift detection. */
  hash: string
  shapes: SlideShapeData[]
  texts: KeyText[]
  groups: KeyGroup[]
  /** Builds in the deck's own declared order. */
  builds: KeyBuild[]
  /** The click grouping, in click order. Optional so modules generated
   *  before P-3 still typecheck. */
  buildChunks?: KeyBuildChunk[]
  transition?: KeyTransition
}

/**
 * One shape in a generated module. Flat `[x0,y0, x1,y1, …]` runs rather
 * than `{x,y}` objects — the same call svg2ts.ts makes, for the same
 * reason: the object form triples a module's size for no gain.
 */
export interface SlideShapeData {
  id: string
  icon?: string
  /** Flat runs in slide coordinates. */
  subpaths: number[][]
  /** Parallel to `subpaths`: 1 when the source closed it. */
  closed: number[]
  /** Hex stroke colour; absent when the shape has no stroke. */
  stroke?: string
  /** Stroke width in slide units. */
  strokeWidth?: number
  /** The dash array in stroke-width multiples; absent when solid. */
  dash?: number[]
  /** Hex fill colour; absent when unfilled or gradient-filled. */
  fill?: string
  opacity: number
}
