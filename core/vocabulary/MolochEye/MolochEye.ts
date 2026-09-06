/**
 * MolochEye — the innermost symbol of the TheWall holarchy, rebuilt as a
 * platonic construction (docs/reports/wall-stack-study.md, "MolochEye —
 * the platonic recipe"). Pure lines plus exactly one fill: the black
 * disk that blots out whatever the eye sits on. The sclera is
 * transparent — on the black ground the symbol is only its strokes.
 *
 * The construction's single unit is h, the lens half-height (`height`).
 * Everything else is derived from it and from two named relations:
 *
 *  - the 3-4-5 construction for the lens arcs (SIN_HALF_SPAN below);
 *  - the one-point-perspective factor k for the pupil cube, derived
 *    from CAMERA_DISTANCE_RATIO — never hard-coded.
 *
 * The remaining decimals are MEASUREMENTS of the canonical face
 * (DreamTalkVocabulary/MolochEye/MolochEye.png, 3316x1660), taken at
 * stroke CENTERLINES with h = 819px (apex-stroke center to center of the
 * lens). The study quotes some of the same facts in an outer-ink
 * convention (h = 830px, the alpha half-height); where the two differ,
 * the centerline number is the geometry and the reconciliation is noted
 * at the constant.
 */

import { color, length } from "../../src/params"
import { eased, together, type Anim } from "../../src/anim"
import { ease } from "../../src/timeline"
import { Arc, Circle, Ellipse, Line, Square, Stroke, type Vec3Like } from "../../src/parts/primitives"
import { BLACK, BLUE, PI, WHITE } from "../../src/constants"

/**
 * The 3-4-5 construction. Each lens arc subtends a half-span whose sine
 * is 4/5: from the arc's center, a tip is 4 units across and 3 units up
 * the axis for every 5 of radius. With the tips at (±2h, 0) that fixes
 * everything —
 *
 *   R·sin = 2h            →  R = 2h / (4/5) = 2.5h
 *   center = ∓(R − h)     →  (0, ∓1.5h)   (the apex is R above center)
 *   R·cos = 2.5h·(3/5)    =  1.5h  ✓ the tips land exactly on y = 0
 *
 * and each arc sweeps 2·asin(4/5) = 106.26°. Verified on the canonical
 * PNG: a circle fit to the top arc's centerline gives R = 2.503h with
 * its center 1.51h below the middle (rms 3.8px of 3316 — Keynote's own
 * bezier approximation of the arc).
 */
const SIN_HALF_SPAN = 4 / 5
const HALF_SPAN = Math.asin(SIN_HALF_SPAN)
export const LENS_RADIUS_RATIO = 2 / SIN_HALF_SPAN // = 2.5
const LENS_CENTER_RATIO = LENS_RADIUS_RATIO - 1 // = 1.5

/**
 * The pupil cube's camera: a true one-point perspective with the eye
 * point d = 1.282·L in front of the front face, L the cube's edge — the
 * C4D 36mm rig's ratio again (study). The back face, L deeper, scales by
 *
 *   k = d / (d + L)
 *
 * and so does its stroke width: perspective-true stroke scaling, which
 * is what makes the drawing a genuine cube rather than two nested
 * squares. Measured on the PNG: back/front edge 537.5/956.5 = 0.5619,
 * back/front stroke run 27/48 = 0.5625 — both the same factor, k.
 */
export const CAMERA_DISTANCE_RATIO = 1.282
export const perspectiveK = (distanceRatio: number): number =>
  distanceRatio / (distanceRatio + 1)
const K = perspectiveK(CAMERA_DISTANCE_RATIO) // ≈ 0.5617

/**
 * Measured ratios (canonical PNG, centerline convention, h = 819px):
 *
 *  - LENS_STROKE_RATIO: the white stroke, 20.1px area/peak in linear
 *    light → 0.0246h (the study's ≈0.026h in its h = 830 convention).
 *    Geometry uses it once, to place the iris fill's edge; the actual
 *    stroke width stays the free `stroke` param (screen pixels).
 *  - PUPIL_EDGE_RATIO: front square edge, stroke center to stroke
 *    center, 956.5px → 1.1673h. (The study's 1.209h is the same square
 *    measured across its OUTER ink at h = 830: (956+48)/830.)
 *  - PUPIL_STROKE_RATIO: front cube stroke / lens stroke, 46.0/20.1 —
 *    the cube draws itself heavier than the lens that holds it.
 */
const LENS_STROKE_RATIO = 0.0246
const PUPIL_EDGE_RATIO = 1.1673
const PUPIL_STROKE_RATIO = 2.284

/**
 * The black disk fills the white ring exactly to the ring stroke's inner
 * edge: r = h − stroke/2 = h·(1 − LENS_STROKE_RATIO/2) at the face's own
 * stroke weight. Measured: disk edge at 809.5px against a ring inner
 * edge of 809.1px. (The study's r = 0.974h is this same fact in the
 * outer-ink convention: 808/830.)
 */
const IRIS_FILL_RATIO = 1 - LENS_STROKE_RATIO / 2

/**
 * Draw several equal-length strokes as ONE pen with one shared ease —
 * the same reading of Sketch & Toon's multi-segment walk that the Eye's
 * lids use (parts/index.ts oneStroke, private there; duplicated rather
 * than promoted until a third symbol wants it).
 */
const onePen = (strokes: readonly Stroke[]): Anim => {
  const n = strokes.length
  if (n === 0) return { tracks: [] }
  const STEPS = 48
  return eased(
    "linear",
    ...strokes.map((stroke, i) => {
      const values: number[] = []
      for (let k = 0; k <= STEPS; k++) {
        const shared = ease("smooth", k / STEPS) * n
        values.push(Math.min(1, Math.max(0, shared - i)))
      }
      return stroke.creation.sequence(...values)
    }),
  )
}

export class MolochEye extends Stroke {
  /** ONTOLOGY.md: a sovereign symbol (pre-pop-out) — cast, not asset. */
  static sovereign = true

  /** h — the lens half-height, the construction's single unit. */
  height = length(100)
  /** The pupil cube's color. Lens, ring and disk stay the face's own
   *  white/black — only the gaze is tinted. */
  override tint = color(BLUE)
  // `stroke` (inherited) is the white lens/ring width in screen pixels;
  // the cube's strokes derive from it via PUPIL_STROKE_RATIO and k.

  // The lens: two circular arcs from the 3-4-5 construction. Angles are
  // stated about each arc's own center; both run DECREASING, so the pen
  // draws the top arc left tip → apex → right tip and the bottom arc
  // right tip → apex → left tip — one clockwise circumnavigation when
  // createAnim() chains them (the 2021 screen sense; see Stroke.drawReversed).
  lensTop = new Arc({
    radius: this.height.times(LENS_RADIUS_RATIO),
    y: this.height.times(-LENS_CENTER_RATIO),
    startAngle: PI / 2 + HALF_SPAN,
    endAngle: PI / 2 - HALF_SPAN,
    tint: WHITE,
    stroke: this.stroke,
  })
  lensBottom = new Arc({
    radius: this.height.times(LENS_RADIUS_RATIO),
    y: this.height.times(LENS_CENTER_RATIO),
    startAngle: -PI / 2 + HALF_SPAN,
    endAngle: -PI / 2 - HALF_SPAN,
    tint: WHITE,
    stroke: this.stroke,
  })
  /** The iris ring, r = h exactly — it KISSES the lens apexes (measured:
   *  ring centerline radius 819px, apex centerline distance 819px). */
  irisRing = new Circle({ radius: this.height, tint: WHITE, stroke: this.stroke })
  /** The one fill: the black disk, out to the ring's inner stroke edge.
   *  NOTE the host currently stacks every fill over every stroke
   *  (render/fill.ts renderOrder), so until attach order governs
   *  compositing this disk hides the pupil cube once faded in — see the
   *  wall report; on the black ground the disk itself is invisible. */
  irisFill = new Ellipse({
    radiusX: this.height.times(IRIS_FILL_RATIO),
    radiusY: this.height.times(IRIS_FILL_RATIO),
    filled: true,
    tint: BLACK,
  })
  // The pupil: a wireframe cube in one-point perspective, dead center —
  // front square, back square k of it, and the four corner connectors
  // running at exactly 45° (front corner (x, x) to back corner (kx, kx)
  // is direction (1, 1)). Back stroke = k · front stroke.
  pupilBack = new Square({
    size: this.height.times(PUPIL_EDGE_RATIO * K),
    tint: this.tint,
    stroke: this.stroke.times(PUPIL_STROKE_RATIO * K),
  })
  pupilFront = new Square({
    size: this.height.times(PUPIL_EDGE_RATIO),
    tint: this.tint,
    stroke: this.stroke.times(PUPIL_STROKE_RATIO),
  })
  /** The four corner connectors, back corner → front corner (compose()). */
  connectors: Line[] = []

  protected override compose(): void {
    const front = (this.height.value * PUPIL_EDGE_RATIO) / 2
    const back = front * K
    const corners: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]
    for (const [sx, sy] of corners) {
      this.connectors.push(
        this.add(
          new Line({
            // Drawn back → front: the cube grows out of depth toward the
            // viewer, matching createAnim()'s back-to-front order.
            points: [
              { x: sx * back, y: sy * back, z: 0 } satisfies Vec3Like,
              { x: sx * front, y: sy * front, z: 0 } satisfies Vec3Like,
            ],
            tint: this.tint,
            // A connector's true perspective stroke tapers from the front
            // width to k times it; the constant-width ribbon carries the
            // mean of its two ends. Measured: 35.1px vs (46.0)(1+k)/2 = 35.9.
            stroke: this.stroke.times((PUPIL_STROKE_RATIO * (1 + K)) / 2),
          }),
        ),
      )
    }
  }

  /**
   * CreateMolochEye: one pen circumnavigates the lens clockwise from the
   * left tip (top arc then bottom arc, one shared ease); the iris ring
   * draws on while the pen returns; then the cube arrives out of depth —
   * back square, connectors, front square — and the darkness settles
   * last (the disk's fade, invisible on the black ground; it exists for
   * composition, where the eye must blot out what it sits on).
   */
  override createAnim(): Anim {
    void this.parts // ensure compose() has built the connectors
    return together(
      [onePen([this.lensTop, this.lensBottom]), 0, 0.45],
      [this.irisRing.creation.sequence(0, 1), 0.35, 0.55],
      [this.pupilBack.creation.sequence(0, 1), 0.5, 0.65],
      [together(...this.connectors.map((c) => c.creation.sequence(0, 1))), 0.62, 0.78],
      [this.pupilFront.creation.sequence(0, 1), 0.72, 0.9],
      [this.irisFill.creation.sequence(0, 1), 0.92, 1],
    )
  }
}

export { LENS_STROKE_RATIO, PUPIL_EDGE_RATIO, PUPIL_STROKE_RATIO, IRIS_FILL_RATIO }
