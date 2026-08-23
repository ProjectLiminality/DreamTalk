/**
 * Rails — curves an object travels ALONG rather than curves that are
 * drawn. The 2021 grammar calls this MoveAlongSpline: a C4D
 * align-to-spline constraint whose `position` parameter is keyframed
 * 0 → 1 while `tangential` locks the object's orientation to the rail.
 *
 * Two things make that a separate holon rather than a verb over an
 * existing Stroke:
 *
 *  - a rail is never drawn (Scene 02's `path` is constructed, added to
 *    the document, and never appears in a single frame), so it carries
 *    no stroke, no creation front, no tint;
 *  - what a rail must answer is not "what points do I have" but
 *    "where am I at u, and which way is inward there" — the two
 *    readings the constraint needs, and both are pure functions of the
 *    rail's own parameters.
 *
 * WHICH PARAMETER. The constraint walks the spline's NATURAL parameter,
 * not its arc length, and on an ellipse those are not the same walk: at
 * Scene 02's 400 x 260 axes they diverge by up to 0.06 of the sweep.
 * The reference decides it. Tracking the flying Eye's apex across
 * frames5 f0255-f0265 and predicting it with NO free parameters — the
 * scene's own start offset, the source's documented (0.01, 1) sub-window
 * and the framework's smoothing of 0.25 — the natural parameter lands
 * every one of the eleven frames within 6.4px (median 3), while arc
 * length misses by up to 54px and cannot be rescued by any start/
 * duration pair (its best free fit still misses by 19px, and only
 * closes if the ease is bent to a smoothing the rest of the corpus
 * rules out). `byArcLength` stays exported and tested because uniform
 * speed is a real thing a rail may want to offer — it is simply not
 * what C4D's align-to-spline tag does.
 */

import { Holon } from "../holon"
import { angle, length } from "../params"
import { eased, type Anim } from "../anim"
import { ease } from "../timeline"
import type { Vec3Like } from "./index"

/** A point on a rail plus the rail's inward normal angle there. */
export interface RailReading {
  x: number
  y: number
  /** The INWARD normal's angle, radians, measured from +x. */
  normal: number
}

/**
 * Resample a parametric planar curve so the parameter becomes
 * normalized arc length. `curve(s)` takes the natural parameter
 * s ∈ [0, 1]; the returned function takes arc length u ∈ [0, 1].
 *
 * Pure, and shared by the tests: the cumulative-length table is built
 * once at `samples` resolution and read by linear search + lerp, which
 * is exact to O(1/samples²) on any smooth curve.
 */
export const byArcLength = (
  curve: (s: number) => Vec3Like,
  samples = 512,
): ((u: number) => number) => {
  const cum: number[] = [0]
  let prev = curve(0)
  for (let i = 1; i <= samples; i++) {
    const p = curve(i / samples)
    cum.push(cum[i - 1]! + Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z))
    prev = p
  }
  const total = cum[samples]!
  return (u: number): number => {
    if (total <= 0) return 0
    const target = Math.min(1, Math.max(0, u)) * total
    let lo = 0
    let hi = samples
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (cum[mid]! < target) lo = mid
      else hi = mid
    }
    const span = cum[hi]! - cum[lo]!
    const f = span > 0 ? (target - cum[lo]!) / span : 0
    return (lo + f) / samples
  }
}

/**
 * An elliptical rail — the half-ellipse Scene 02's white Eye flies.
 *
 * Source: `Arc(angle=PI, h=PI, scale_x=2, scale_z=1.3)` at pydeation's
 * default radius 200, i.e. a half turn of an ellipse 400 wide by 260
 * tall, banked a half turn so the sweep runs BELOW the axis. Rather
 * than reconstruct that through a scaled, rotated Arc — three
 * parameters conspiring to describe one shape — the rail states the
 * shape it is: semi-axes, and the sweep it covers.
 *
 * The parametrization runs from (−rx, 0) at u = 0, through (0, −ry) at
 * the half, to (+rx, 0) at u = 1. The inward normal at u = 0 points
 * along +x and at u = 1 along −x, which is what the reference measures
 * (frames5 f0255-f0265: the Eye's gaze tracks the ellipse's normal to
 * within a degree, never its radius — see S02.ts).
 */
export class EllipticalRail extends Holon {
  radiusX = length(400)
  radiusY = length(260)
  /** Extra rotation applied to the whole rail, radians about +z. */
  bank = angle(0)

  /** The rail's point at the natural parameter s ∈ [0, 1]. */
  point(s: number): Vec3Like {
    const rx = this.radiusX.value
    const ry = this.radiusY.value
    const a = Math.PI * Math.min(1, Math.max(0, s))
    return { x: -rx * Math.cos(a), y: -ry * Math.sin(a), z: 0 }
  }

  /**
   * Read the rail at u — position plus the inward normal's angle, which
   * is what a tangential constraint hands an object riding it.
   *
   * The normal comes from the implicit form: ∇(x²/rx² + y²/ry²) points
   * outward, so its negation points in. Using the gradient rather than
   * the radius is the whole difference between a circle's behaviour and
   * an ellipse's, and the reference is unambiguous about it: at
   * (−316, −162) the flying Eye gazes at 51.0 degrees, which is the
   * normal's 50.4 and not the radius' 27.1.
   */
  at(u: number): RailReading {
    const p = this.point(u)
    const rx = this.radiusX.value
    const ry = this.radiusY.value
    const nx = -p.x / (rx * rx)
    const ny = -p.y / (ry * ry)
    const bank = this.bank.value
    const cos = Math.cos(bank)
    const sin = Math.sin(bank)
    return {
      x: p.x * cos - p.y * sin,
      y: p.x * sin + p.y * cos,
      normal: Math.atan2(ny, nx) + bank,
    }
  }

  /** The same reading, walked at UNIFORM SPEED instead. */
  atArcLength(u: number, samples = 512): RailReading {
    return this.at(byArcLength((s) => this.point(s), samples)(u))
  }
}

/**
 * MoveAlongSpline — ride a rail from `from` to `to`, tangentially.
 *
 * The 2021 constraint keyframes ONE value (the position parameter) with
 * the standard ease and derives position and orientation from it. Our
 * timeline animates params, not constraints, so the derivation happens
 * here: the span is sampled at `steps` eased instants, the rail read at
 * each, and the readings emitted as dense LINEAR waypoint sequences on
 * x, y and b. Pre-easing the waypoints and interpolating linearly
 * between them reproduces the constraint's motion exactly — the ease
 * lives in where the samples sit, not in how they are joined — and
 * keeps the result a pure Anim, samplable at any t like everything else.
 *
 * `gazeOffset` turns the rail's inward normal into the rider's own
 * heading: an Eye gazes along +x, so it rides with no offset at all,
 * which is what Scene 02's `b=PI` amounts to once the constraint has
 * taken the orientation over.
 */
export const MoveAlong = (
  rider: Holon,
  rail: EllipticalRail,
  opts: { from?: number; to?: number; steps?: number; gazeOffset?: number } = {},
): Anim => {
  const from = opts.from ?? 0
  const to = opts.to ?? 1
  const steps = opts.steps ?? 64
  const gaze = opts.gazeOffset ?? 0
  const xs: number[] = []
  const ys: number[] = []
  const bs: number[] = []
  let previous = 0
  for (let i = 0; i <= steps; i++) {
    const progress = ease("smooth", i / steps)
    const reading = rail.at(from + (to - from) * progress)
    xs.push(reading.x)
    ys.push(reading.y)
    // Unwrap so a sweep through the branch cut never spins backwards.
    let heading = reading.normal + gaze
    while (i > 0 && heading - previous > Math.PI) heading -= 2 * Math.PI
    while (i > 0 && previous - heading > Math.PI) heading += 2 * Math.PI
    previous = heading
    bs.push(heading)
  }
  return eased("linear", rider.x.sequence(...xs), rider.y.sequence(...ys), rider.b.sequence(...bs))
}
