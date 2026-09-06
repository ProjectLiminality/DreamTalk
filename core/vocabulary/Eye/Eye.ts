import { completion } from "../../src/params"
import { eased, together, type Anim } from "../../src/anim"
import { ease } from "../../src/timeline"
import { Arc, Ellipse, Line, Stroke } from "../../src/parts/primitives"
import { BLACK, PI } from "../../src/constants"

/**
 * The Eye — the creature of video-01 ("circler"/"rectangler"). Local
 * geometry per the vocabulary report (§2.5), gaze along +x:
 * two lid rays from the apex at the origin to radius 230, opened
 * ±22.5° (`opening` scales the half-angle); the eyeball arc at radius
 * 200 spanning the same fan (the lids deliberately overshoot past it —
 * the little tick at the lid tips); iris and pupil as filled ellipses
 * (the almond: 20×60 at x=180; the pupil: 8×24 black at x=190).
 * Video instances use scale 0.3. `tint` binds lids, eyeball and iris;
 * the pupil stays black.
 */
/**
 * Draw several strokes as if they were ONE — a single pen, a single
 * ease, spread across them in order.
 *
 * A sub-window would ease each stroke separately inside its own slot,
 * which is a different motion: the pen would slow down at every seam
 * and speed up after it. What actually happens when Sketch & Toon walks
 * a multi-segment spline is one ease over the whole arc length, so each
 * segment's own completion is a CLIPPED, SHIFTED reading of that shared
 * curve. Sampling the shared ease and handing each stroke its share as
 * dense linear waypoints reproduces that exactly, and keeps the result
 * a plain Anim.
 *
 * Assumes the strokes carry equal arc length, which is what the Eye's
 * two lids do; a general version would weight the shares.
 */
const oneStroke = (strokes: readonly Stroke[], retract = false): Anim => {
  const n = strokes.length
  if (n === 0) return { tracks: [] }
  const STEPS = 48
  return eased(
    "linear",
    ...strokes.map((stroke, i) => {
      const values: number[] = []
      for (let k = 0; k <= STEPS; k++) {
        const shared = ease("smooth", k / STEPS) * n
        const drawn = Math.min(1, Math.max(0, shared - i))
        values.push(retract ? 1 - drawn : drawn)
      }
      return stroke.creation.sequence(...values)
    }),
  )
}

export class Eye extends Stroke {
  /** ONTOLOGY.md: a sovereign symbol (pre-pop-out) — cast, not asset. */
  static sovereign = true
  opening = completion(1)
  // The lids are ONE stroke in the source — a three-point Spline
  // [upper tip, apex, lower tip] (custom_objects.py:79-80) — so the pen
  // runs the upper lid INWARD to the apex and then the lower lid back
  // out. Two Line parts rather than one polyline, because `opening` has
  // to turn each lid about the apex and a rotation cannot open a
  // three-point wedge; the stroke ORDER is what the reference cares
  // about, and createAnim() below restores it exactly. Note the top
  // lid's points run tip → apex, which is the direction it draws.
  lidTop = new Line({
    points: [{ x: 230, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }],
    tint: this.tint,
    stroke: this.stroke,
    b: this.opening.times(PI / 8),
  })
  lidBottom = new Line({
    points: [{ x: 0, y: 0, z: 0 }, { x: 230, y: 0, z: 0 }],
    tint: this.tint,
    stroke: this.stroke,
    b: this.opening.times(-PI / 8),
  })
  eyeball = new Arc({
    radius: 200,
    startAngle: this.opening.times(-PI / 8),
    endAngle: this.opening.times(PI / 8),
    tint: this.tint,
    stroke: this.stroke,
  })
  iris = new Ellipse({ x: 180, radiusX: 20, radiusY: 60, filled: true, tint: this.tint })
  pupil = new Ellipse({ x: 190, radiusX: 8, radiusY: 24, filled: true, tint: BLACK })

  /**
   * CreateEye: pupil fills instantly, lids+eyeball draw 0→50%, iris
   * fills 30→100% (animator.py's per-class dispatch).
   *
   * The two lids share that first half SEQUENTIALLY, because in the
   * source they are one spline and Sketch & Toon's "single" stroke
   * method walks a stroke end to end: the pen comes down the upper lid
   * to the apex over the first quarter of the span and goes back out
   * along the lower lid over the second. The reference is unambiguous
   * — frames5 f0163 has a lone segment near the UPPER tip and nothing
   * else, f0165 has the upper lid nearly whole with the lower still
   * absent, and the lower lid only arrives from f0167 — and drawing the
   * two in parallel from the apex, which is what a naive two-Line
   * reading gives, gets every one of those frames wrong.
   */
  override createAnim(): Anim {
    return together(
      [this.pupil.creation.sequence(0, 1), 0, 0.01],
      [oneStroke([this.lidTop, this.lidBottom]), 0, 0.5],
      [this.eyeball.creation.sequence(0, 1), 0, 0.5],
      [this.iris.creation.sequence(0, 1), 0.3, 1],
    )
  }

  /**
   * UnCreateEye: the iris unfills 0→50%, the pupil follows 50→60%, and
   * the lids and eyeball undraw 30→100% (animator.py's destructive
   * dispatch — the mirror of CreateEye, and NOT createAnim reversed:
   * the eye loses its look before it loses its shape).
   *
   * The lids keep the sequence they were drawn in, one after the other
   * inside that window, so the pen retreats along the same stroke it
   * came down.
   */
  override unCreateAnim(): Anim {
    return together(
      [this.iris.creation.to(0), 0, 0.5],
      [this.pupil.creation.to(0), 0.5, 0.6],
      [this.eyeball.creation.to(0), 0.3, 1],
      // The pen retreats along the stroke it came down: the lower lid
      // back to the apex first, then the upper lid out to its tip —
      // one ease across both, the mirror of oneStroke().
      [oneStroke([this.lidBottom, this.lidTop], true), 0.3, 1],
    )
  }
}
