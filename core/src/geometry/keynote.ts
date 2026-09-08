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
  /**
   * Flip bits: 1 = horizontal, 2 = vertical.
   *
   * NOTE these are the DECODER'S bits, not the archive's. Keynote states
   * flips on the PATH SOURCE (`horizontalFlip` / `verticalFlip`) and
   * uses `geometry.flags` for something else entirely — a validity mask,
   * 3 on 2,743 drawables, 7 on 92 and 0 on 89. `keydecode.py` overwrites
   * the field with the real flip bits before it reaches here.
   *
   * In this deck both flips are FALSE on every drawable, so `flags` is
   * always 0 and `fitToFrame` never mirrors anything. Do not read a raw
   * archive's `flags` as flips — P-7 read the cursor glyph's `flags: 3`
   * as "both flip bits set" and it is nothing of the kind.
   */
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
 * An image's BOX — not its pixels.
 *
 * This framework draws strokes; a `TSD.ImageArchive` is a raster and
 * cannot be one, so an image is not a drawable here. Its geometry is
 * carried anyway, because it is load-bearing for SCORING and the recon
 * report says otherwise.
 *
 * Report §5 lists image support under "explicitly NOT needed — 29 images
 * in the whole deck, none load-bearing in slides 1-58" (its count).
 * P-1 repeated
 * that on the recon's authority; P-3 measured it and it is wrong. On
 * slide 2 the five images are **46.9% of the reference frame's ink** —
 * the Vitruvian figure alone is 481x481 slide units, the largest single
 * drawable on the video's opening tableau — and they hold that segment's
 * `coverage_ref` near 0.49 however good the vector reproduction is.
 *
 * **12 images fall inside deck 1-59, on four slides: 2 (five), 3
 * (one), 17 (four) and 18 (two).** Those four have a hard ceiling on
 * `coverage_ref` that no stroke fidelity can lift, so a chapter touching
 * them should score twice — the whole frame as the headline, and again
 * with these boxes masked — and say that the mask is the deck's own
 * declared geometry rather than a chosen crop. Masking slide 2's five
 * moves it from 0.4909/0.8725 to 0.9092/0.9244.
 *
 * WHAT THE PIXELS ACTUALLY ARE, which changes the recommendation.
 * `refs/pitch/pl02/key/Data/Man-10520.png` (the Vitruvian figure) and
 * `lightning-11152.png` are **white line art on transparent alpha** —
 * RGB exactly (255,255,255) with ZERO channel variance, 7.5% and 14.3%
 * opaque. They are not photographs. Only FOUR assets in the deck's whole
 * 117-file Data directory are line art of this kind, and the 12 in-scope
 * images draw from a handful of them (the figure once per slide, the
 * lightning glyph repeated).
 *
 * So this is `david.svg` all over again (the Origins campaign's O-1): a
 * traced drawing whose vector form lives outside the file that uses it.
 * Which means the eventual fix is probably NOT "render a textured quad"
 * — it is to trace or source these four assets as paths and import them
 * through `Sketch`, the doorway that already exists for exactly this.
 * That keeps the reproduction all-strokes and preserves draw-on, which a
 * quad could never do. It is real work and it belongs to whichever
 * chapter needs slide 2 or 17 to score whole-frame, but it is bounded
 * work on four assets rather than an open-ended raster pipeline.
 *
 * P-3 measured the cost of leaving them out: the images are 47% of
 * segment 2's reference ink and 59% of segment 3's, so those segments
 * have a hard `coverage_ref` ceiling until something draws them.
 */
export interface KeyImage {
  id: string
  frame: KeyGeometry
}

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
  /**
   * `All at Once` | `By Object` | per-character deliveries — and the
   * field that says whether an `apple:dissolve character` build actually
   * cascades per glyph.
   *
   * In this deck it never does. **All 418 in-scope builds are
   * `All at Once`** — including every `dissolve character` one. There
   * is not a single per-character delivery in the video.
   *
   * P-3 confirmed it in the footage rather than only in the file: slide
   * 2's four `dissolve character` builds all target SHAPES, not text,
   * and each fades as one piece — mean luminance over the icon's own
   * final ink mask rises 0.00/0.01/0.07/0.27/0.61/0.91/0.99/1.00 across
   * t=4.0..5.4 with no spatial fill-in at any frame.
   *
   * So `dissolve` and `dissolve character` compile to the SAME uniform
   * opacity ramp throughout, and the recon report's expected
   * `DissolveCharacters` sibling to `Write` (§5, "222 builds") is not
   * needed by ANY chapter — not just the opening arc. The effect NAME
   * does not imply a cascade; this field does, and here it never says
   * so.
   */
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
  /**
   * Keynote's on-click / after-previous flag: 1 on 354 of the 418 in-scope
   * builds, 0 on the other 64.
   *
   * Carried UNINTERPRETED and alongside `KeyBuildChunk.automatic`,
   * because the two disagree on 263 chunks and neither alone predicts
   * the footage. See KeyBuildChunk's header for the evidence on both
   * sides; do not treat either as the firing model without testing it
   * against measured onsets.
   */
  eventTrigger?: number
  /**
   * Where an `apple:action-motion-path` build moves its target — typed
   * path elements, RELATIVE to the drawable's own position, in slide
   * units.
   *
   * This is declared data, not something to derive from the footage.
   * P-3 found it by scoring slide 3, where "Story" (text 4516215) sits
   * at (1049.522, 485.569) in the deck and the reference draws it 230
   * units higher: the build's path is a straight (-1.388, -229.910), and
   * 485.569 - 229.910 = 255.66 slide units is video row 170, against the
   * reference's glyph band at rows 158-189. Rendered unmoved, that
   * segment scores coverage_ref 0.328 with the label sitting inside an
   * ellipse it should be above.
   *
   * Carried as a full element list rather than a `{dx, dy}` because a
   * translation is not general enough — though the numbers differ by
   * scope, and a chapter reading only the deck-wide figure looks for two
   * curves and finds one:
   *
   *   whole 83-slide FILE:   34 motion paths, 2 genuinely curved
   *   **in scope (deck 1-59): 19 motion paths, exactly ONE curved**
   *
   * The in-scope curve is build 5602009 on deck slide 56 — 3.0s, two
   * cubic segments, travel (-284.4, -171.0). Every other in-scope path
   * is a two-node straight run. Flatten it with `flattenElements` like any other
   * path — the straight ones arrive as degenerate curves whose controls
   * sit on their endpoints, so one code path serves both.
   *
   * The MOTION itself belongs to P-7 (the `action-motion-path` build
   * class, 19 builds in the recon's accounting); the importer's job is
   * only to stop throwing the geometry away.
   */
  motionPath?: KeyPathElement[]
}

/**
 * One chunk of animation — the firing model, and the real timing.
 *
 * Keynote separates WHAT animates (a build) from WHEN it fires (a
 * chunk). Chunks are listed in firing order. The chunk's `duration`
 * agrees with its build's in all 418 cases here, so a chunk contributes
 * the WHEN and never a second duration to reconcile — the value worth
 * having is `automatic`.
 *
 * THE FIRING MODEL IS NOT SETTLED, AND THIS COMMENT WILL NOT PRETEND IT
 * IS. Three candidate fields exist and no single one of them predicts
 * the footage:
 *
 *  - `automatic` (here, on the chunk). 91 of 418 false, 327 true in
 *    scope. Deck-wide arithmetic is excellent — 91 clicks + 59
 *    transitions = 150 declared advances against the recon's 141
 *    measured animation events, within 7%. But it fails LOCALLY: slide 2
 *    has exactly one false, so this reading fires all 13 of its builds
 *    as a single cascade, and P-3 measured its four connection lines
 *    drawing at plainly separated times (7 events in the segment).
 *
 *  - `eventTrigger` (on the build's `attributes`). 354 of 418 are 1
 *    ("on click") in scope, including ALL 13 on slide 2 —
 *    which fits P-3's local measurement. But 354 + 59 = 413 declared
 *    advances against 141 measured overshoots by 2.9x.
 *
 *  - The two DISAGREE constantly (263 chunks are `automatic: true` while
 *    their build says `eventTrigger: 1`), so they are not two spellings
 *    of one fact.
 *
 * What is certain: the recon report's §0 reading is wrong in its
 * mechanism. It cites `isAutomatic` on the build's `animationAttributes`
 * — a field that is absent throughout, so its absence says nothing — and
 * concludes every advance is a click. Both fields above carry real,
 * varying information that the report did not use.
 *
 * What is NOT certain is which governs. Resolving it needs the footage,
 * not the archives: the honest test is to count measured onsets within
 * individual segments against each reading's prediction, across enough
 * slides to separate them. That belongs to the chapter that owns build
 * timing (P-3 / P-9), which is why BOTH fields are carried here
 * uninterpreted — `automatic` on the chunk, `eventTrigger` on the build
 * — and why neither is presented as the answer.
 */
export interface KeyBuildChunk {
  /** The `KeyBuild.id` this chunk fires. */
  build: string
  duration: number
  delay: number
  /**
   * True when this chunk follows its predecessor automatically; false
   * when it waits for a click. 327 true / 91 false in scope.
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

/**
 * A NOTE ON DECK SLIDE 54, AND THE LIMIT OF WHAT THE ARCHIVE KNOWS.
 *
 * P-8 found that deck 54's seven "tablet" groups (5450290, 5451245,
 * 5451291, 5451337, 5451383, 5451439, 5451499 — each a blue ring plus a
 * Cylinder_563 at angle 90) are ALL declared at one point: group
 * (581.784, 359.175), cylinder (586.13, 362.46), byte-identical across
 * all seven. The footage draws them at seven spread positions matching
 * deck 55's declared tablet layout.
 *
 * The importer was investigated for a dropped mechanism and there is
 * none. Checked and excluded:
 *
 *   - group-offset chains — all seven are TOP-LEVEL in drawablesZOrder;
 *   - `motionPath` — their only builds are plain `apple:dissolve` In,
 *     with no `actionMotionPathSource` on any of them;
 *   - the transition — deck 55's Magic Move stages matched objects, but
 *     it cannot supply deck 54's own held layout;
 *   - a nested duplicate set inside the big group 5447990 — there is
 *     none, these seven are the slide's only tablets;
 *   - decoder loss — the RAW protobuf was read for 5450290 and matches
 *     the decode exactly, position included;
 *   - preserved unknown fields — the `IgnoreAndPreserve` paths 1.12/1.13
 *     appear on ALL 24 of the slide's groups, not just these seven, so
 *     they are a generic per-group field (shadow/reflection), not a
 *     position;
 *   - a derivable relationship — the seven displacements to deck 55's
 *     positions are all different, sharing no common offset.
 *
 * AND YET Keynote's own slide thumbnail for deck 54 renders the seven
 * tablets SPREAD. So Keynote knows a layout that this file, as decoded,
 * does not state — most likely held in application state or a cache
 * outside the slide archive.
 *
 * This configuration is UNIQUE in the deck: scanning every slide for
 * three or more top-level drawables sharing one exact position finds
 * exactly this one case. That, plus the thumbnail disagreeing with the
 * geometry, reads as an authoring artifact rather than a format feature.
 *
 * The importer therefore reports what the file says, and P-8's decision
 * to score deck 54 with the gap stated as a ceiling — rather than moving
 * geometry on a guess — is the correct one. Deriving the positions from
 * deck 55 would be fitting the reproduction to the answer.
 */

/** One slide, fully imported. */
export interface KeySlide {
  /** 1-based position in the SHOW's order (the recon's segment table). */
  index: number
  /** The `KN.SlideArchive` id. */
  id: string
  /** Drawables in z-order, back to front. */
  drawables: KeyDrawable[]
  groups: KeyGroup[]
  /** Image boxes — geometry only, for scoring. See KeyImage. */
  images: KeyImage[]
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
 *   middle  the CAP BOX is centred in the padded interior — NOT the
 *           cap-plus-descent block — so the baseline sits half a cap
 *           height below that centre. See below: this is the one that
 *           was wrong, and the descent is deliberately absent from it.
 *
 * The title card exercises the `bottom` branch and closes to 0.4 px: box
 * bottom 895.496 slide units, padding 4, descent 0.212·116 = 24.6, so
 * baseline 866.9 slide units = 577.9 video px against a measured 577.
 *
 * Multi-line strings (`MonoLogos\nNode`, three of the deck's 48) get the
 * FIRST line's baseline; the holon steps subsequent lines by the line
 * height, which is what core's `Text` does with an embedded newline.
 *
 * WHAT `middle` CENTRES, AND THE MEASUREMENT THAT SETTLED IT
 *
 * Keynote centres the CAP BOX, not the cap-plus-descent block. The
 * distinction is worth exactly `descent / 2` for a single line — an
 * identity, not an approximation: centring cap+descent puts the baseline
 * at (top+bottom)/2 − (cap+descent)/2 + cap, centring the cap box puts
 * it at (top+bottom)/2 + cap/2, and subtracting gives descent/2 at every
 * size (checked at 30, 37, 50, 70 and 116).
 *
 * MEASURED at five texts across three slides and four point sizes, as
 * the bottom ink row of a DESCENDER-FREE glyph in the 1280×720 frame
 * (the whole word will not do — "Story"'s bottom row is the `y`, four
 * pixels below the baseline, and that trap cost one wrong reading here):
 *
 *   text (glyph)        size   y        cap+desc   cap box   measured
 *   DiaLogos  (D)       70   126.408      95.99    100.93      101
 *   Location A (L)      30   647.701     436.82    438.94      439
 *   non-contextual (n)  30   694.692     468.15    470.27      470
 *   Story     (S)       50   540.000     368.37    371.90      372
 *   Dead Thing (D)      40   866.000     584.03    586.85      587
 *
 * The cap box lands within 0.3 px on all five; centring cap+descent sits
 * 2-5 px high, growing with the point size exactly as descent/2 must.
 * Found by P-5 on the first three, reproduced independently here on the
 * last two.
 *
 * WHY IT SURVIVED P-2's GATE, which is the more useful half. The title
 * card is the deck's ONE `bottom`-aligned record: across the shipped
 * modules the census is **1 bottom, 43 middle**. So the branch P-2
 * verified to 0.4 px against the footage is not the branch 43 of the 44
 * records take, and `middle` had never met a reference frame until P-5's
 * chain slides put nine labels in front of it. A gate validates the
 * features its own slide happens to use, and no more.
 *
 * THE MULTI-LINE `middle` CASE IS DERIVED, NOT YET MEASURED. All five
 * texts above are single-line. Centring the cap box says a block of n
 * lines spans (n−1)·lineHeight + cap, which is what the code does; the
 * footage has not yet been asked. Slide 32's `MonoLogos\nNode` is the
 * available witness (P-2 scores it at f_02851) and it agreed, but at one
 * line spacing only. Treat a multi-line middle-aligned discrepancy as
 * this line, not as the single-line rule.
 */
export const textBaseline = (text: KeyText, lineCount = 1): number => {
  const size = text.fontSize
  const cap = size * HELVETICA_CAP_HEIGHT
  const descent = size * HELVETICA_DESCENT
  const lineHeight = size * (text.lineSpacing > 0 ? text.lineSpacing : 1)
  const top = text.frame.position.y + text.padding.top
  const bottom = text.frame.position.y + text.frame.size.height - text.padding.bottom
  // The centred block is the CAP BOX — no descent. See the header's
  // measurement table: including it puts every middle-aligned label
  // descent/2 too high, which is 2-5 px at the deck's sizes.
  const capBlock = (lineCount - 1) * lineHeight + cap

  switch (text.verticalAlign) {
    case "bottom":
      return bottom - descent - (lineCount - 1) * lineHeight
    case "middle":
      return (top + bottom) / 2 - capBlock / 2 + cap
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
  /** Image boxes — geometry only, for scoring. Absent when the slide has
   *  none, which is 54 of the 58. See KeyImage. */
  images?: KeyImage[]
  /** Builds in the deck's own declared order. */
  builds: KeyBuild[]
  /** The click grouping, in click order. Optional so modules generated
   *  before P-3 still typecheck. */
  buildChunks?: KeyBuildChunk[]
  /**
   * Archive types and syntheses the decode could not handle faithfully,
   * named so a consumer can see them rather than inheriting silence.
   * `TSD.ImageArchive` is the common one; the other is
   * `kTSDRightSingleArrow:synthesis-unverified` (see keydecode.py).
   */
  skipped?: string[]
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
  /**
   * The dash array in stroke-width multiples; absent when solid.
   *
   * READ THIS WITH `cap`. Keynote's period is the dash plus the gap
   * plus, under a round cap, one further stroke width — because a round
   * cap paints a half-disc beyond each end of the run, so a dash of
   * length d occupies d + w on the line. The deck's dotted mesh is
   * stated as (0.001, 2.0), a deliberate ZERO dash meaning "paint
   * nothing but the cap", which is only visible at all under RoundCap.
   * See `cap` for the evidence.
   */
  dash?: number[]
  /**
   * `ButtCap` | `RoundCap` — and on a dashed stroke it changes the
   * PERIOD, not just the end shape.
   *
   * The deck splits perfectly along this line: every (0.001, 2.0) dotted
   * pattern is `RoundCap`, and every other dash pattern — (6, 6) and
   * (1, 1) — is `ButtCap`. That is read from the stylesheet, not
   * inferred, and it is what makes the dot period derivable rather than
   * fitted.
   *
   * The arithmetic, on slide 2's connection lines (stroke width 11 slide
   * units = 7.333 video px, pattern (0.001, 2.0)):
   *
   *   butt  (dash + gap) · w       = 14.674 px   — 33% short
   *   round (dash + gap + 1) · w   = 22.007 px   — 0.5% off
   *
   * against P-3's measured 21.9 px in the eagle corridor; and it turns
   * our 14 dots over that corridor into 9.33 against the reference's 10.
   * Three independent confirmations of one value stated in the file.
   */
  cap?: string
  /** Hex fill colour; absent when unfilled or gradient-filled. */
  fill?: string
  opacity: number
  /**
   * For a `TSD.ConnectionLineArchive`: the two drawables it joins.
   *
   * READ THIS BEFORE TRUSTING THE PATH. Keynote recomputes a connection
   * line's geometry from the objects it connects, so a STORED path can
   * be stale — left over from wherever those objects used to sit — and
   * there is no local sign that anything is wrong. A chapter that trusts
   * stored paths will draw lines in the wrong places silently.
   *
   * P-3 found the worked example on slide 3: line 4515938 joins the tree
   * (4515966) to the Vitruvian image (4515878), whose box centres are
   * both at slide y 540 — video row 360, exactly where the reference
   * draws a long horizontal dotted line. The stored path fits to
   * (465, 727) -> (743, 653), a short lower-left diagonal the footage
   * does not contain anywhere.
   *
   * HOW COMMON: 25%, and the working assumption should be that a
   * stored path is UNRELIABLE. Surveyed across all 547 connection
   * lines in the file (489 of them in scope)
   * by testing whether the stored chord's axis aims at BOTH connected
   * objects' centres (within 3 slide units) —
   *
   *   352  (64%)  FRESH — aims at both centres
   *   135  (25%)  STALE — misses at least one
   *    60  (11%)  unresolvable (no `connectedFrom`/`connectedTo`)
   *
   * An earlier version of this comment said "15 stale, a handful" on the
   * strength of a weaker test — distance from each endpoint to its
   * object's BOX — which scores a line fresh when EITHER end touches,
   * and so passed the very common half-right case. P-3 found it: slide
   * 2's four dotted lines all aim exactly at the Vitruvian image's
   * centre (perpendicular deviation 0.0) while three of them miss their
   * OTHER endpoint by 47.6, 66.6 and 16.7 units. The correct test is the
   * one above, and it is nine times less forgiving.
   *
   * The footage settles it beyond the archives. Sampling the reference
   * frame along each candidate axis and counting how many samples land
   * on ink (f_00081, 2px tolerance): the sun line's stored path hits
   * **0%** and its centre-to-centre line **41%**; the eagle line's
   * stored path **7%** against **57%**. For dotted lines ~50% is what a
   * perfect match looks like, since half the samples fall in the gaps.
   * P-3's independent fit of the eagle line's 584 ink pixels gives slope
   * 0.5862 against the centre-to-centre 0.5866 and the stored 0.6816,
   * and extrapolates to the image centre within **0.3 px**.
   *
   * THE RULE, as far as it is established: the line runs between the two
   * connected drawables' CENTRES, clipped to their boundaries — the
   * visible dots begin outside each icon, which is presumably what
   * `outsetFrom`/`outsetTo` are for (both 0.0 throughout this deck).
   * Attachment is NOT a fixed point on the box: the stored endpoints of
   * slide 2's four lines sit at box fractions 1.425, 0.049, 3.604 and
   * 0.042, which no single attachment rule produces — further evidence
   * that they are leftovers rather than a convention to be decoded.
   *
   * The endpoints are carried and the derivation is NOT performed here:
   * where a line should run when its stored path disagrees is a
   * rendering decision (which edge does it attach to, does it route
   * around anything) that belongs to P-4, the chapter that owns
   * connection meshes.
   */
  connects?: { from?: string; to?: string }
  /**
   * True for a `TSD.ConnectionLineArchive`, whatever else it carries.
   *
   * Set unconditionally BECAUSE `connects` is not: 31 of the 489 in-scope
   * connection lines declare no `connectedFrom`/`connectedTo` at all, so
   * a consumer that identifies connection lines by the presence of
   * `connects` will conclude a slide has none. Slide 15 is exactly that
   * case — eight connection lines, all imported correctly, none with
   * endpoints.
   */
  isConnectionLine?: boolean
  /**
   * True when this shape is an IMAGE'S OWN TRACED OUTLINE, projected
   * through the ordinary shape fit rather than rasterized.
   *
   * `TSD.ImageArchive.tracedPath` is Keynote's instant-alpha
   * vectorization, stored in the same typed element form as every
   * bezierPathSource and stated in the image's `naturalSize` design box
   * — so it needs no special handling at all beyond being noticed. All
   * 31 images in the file carry one; the 12 in scope are served by two
   * assets, a 35-element lightning glyph and the 2,239-element,
   * 194-subpath Vitruvian figure.
   *
   * This RETIRES the plan recorded earlier in this file to trace those
   * assets from the footage. The deck vectorized them itself, so what
   * was going to be a measurement is a reading — at the same standard as
   * the title card. The image's BOX is still carried on
   * `SlideData.images` for chapters that mask while scoring.
   *
   * ONE PROPERTY A CONSUMER MUST KNOW. An instant-alpha trace follows
   * the OUTER boundary of the drawn ink, not its centreline — it is the
   * silhouette of an opaque region, and a stroked line's silhouette is
   * its two outer edges. So a traced outline renders slightly LARGER
   * than the raster's own line: on slide 2 the Vitruvian's outer circle
   * measures 322 video px across against the reference's 309, i.e. about
   * 6.5 px per side, which back-projects to a source stroke roughly 37
   * design px wide. Scoring lifts `coverage_ref` on that frame from
   * 0.4878 to 0.9036 even so.
   *
   * That is inherent to what a trace IS, not an importer defect, and the
   * correction (inset by half the source stroke, or render the trace
   * thinner) is a rendering decision. It is left to the consumer rather
   * than guessed at here.
   */
  fromTracedImage?: boolean
  /**
   * `kTSDConnectionLineTypeQuadratic` | `kTSDConnectionLineTypeOrthogonal`.
   *
   * Across the whole 83-slide file: 541 quadratic, 6 orthogonal. But
   * **within deck 1-59 every one of the 489 lines is quadratic** — all
   * six orthogonals are on out-of-scope slides — so P-4's "all
   * quadratic" is right for the video, and the field is carried because
   * the file is not uniform, not because the reproduction is. And the
   * quadratic form is a real quadratic — P-4 proved Keynote renders the
   * 3-point path as a curve THROUGH the middle point rather than as a
   * 2-segment polyline, by ink-hit rate on slide 11's 70 solid strokes
   * (0.951 +/- 0.058 for quad-through against 0.711 +/- 0.252 for
   * polyline) plus a control-polygon bounding argument on line 4107905.
   *
   * That supersedes the straight centre-to-centre rule recorded under
   * `connects`, which holds only as the degenerate case where the middle
   * point is collinear with the ends.
   */
  lineType?: string
  /**
   * How far the drawn line stands OFF each endpoint, in slide units.
   *
   * **This corrects a claim P-1 made and P-4 refuted.** An earlier
   * version of the `connects` note said `outsetFrom`/`outsetTo` were
   * "both 0.0 throughout this deck". They are per-line, and non-zero
   * exactly on the biggest meshes — which is the worst place for a
   * consumer to have assumed zero on my say-so.
   *
   * In scope (deck 1-59, 489 lines): 325 are (0, 0), 78 are
   * (0.0, 10.0), 74 are (10.0, 10.0) and 12 are (30.0, 30.0).
   *
   * So **164 of the 489 in-scope lines carry a non-zero outset**, and
   * they cluster on the densest meshes — slide 8's are 30.0/30.0 and
   * slide 11's 10.0/10.0, which is the worst possible place for a
   * consumer to have assumed zero on my say-so. Absent here means both
   * are zero.
   */
  outset?: { from: number; to: number }
  /**
   * Arrowheads, resolved through the style chain — the style archive
   * lives in the GLOBAL `Index/DocumentStylesheet.iwa`, not in the slide
   * file, so this is a document-wide id lookup.
   *
   * Richer than a single arrow convention: 142 in-scope drawables carry
   * an end decoration — and across the whole
   * file two use a `filled circle` rather than the `simple arrow`. The arrow's own path is a filled triangle —
   * moveTo(0,0), lineTo(3,6), lineTo(6,0), close — with `endPoint`
   * (3,0) and a MiterJoin.
   *
   * The record is passed through WHOLE and uninterpreted. P-4 measured
   * the drawn head at 9.66 x 4.67 half-width slide units, whose aspect
   * matches the path's 2.0, but could not pin the absolute scale rule
   * from three samples — so the data is here and the scale derivation
   * belongs to the consumer that has more of them.
   */
  lineEnds?: {
    head?: KeyLineEnd
    tail?: KeyLineEnd
  }
}

/** One end decoration (arrowhead, dot) as the stylesheet states it. */
export interface KeyLineEnd {
  /** `simple arrow`, `filled circle`, … */
  identifier?: string
  /** The decoration's own outline, in its own small design units. */
  path: KeyPathElement[]
  /** Where the line's end sits within that outline. */
  endPoint?: Vec2
  isFilled: boolean
  lineJoin?: string
}
