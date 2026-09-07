/**
 * Morph — one shape becoming another, as pure geometry.
 *
 * This is the ONTOLOGY-deferred capability the framework has been
 * putting off since transitions.ts:69 ("Creation/erasure/opacity stay
 * each side's own — a glide moves and recolors, it does not redraw;
 * true shape morphs come later"). Magic Move interpolates PARAMETERS
 * between two matched holons; a Morph interpolates the OUTLINES
 * themselves, between two holons that need have nothing in common.
 *
 *
 * WHAT IS HERE, AND WHAT IS NOT
 *
 * This module is the MATHEMATICS only: resampling, correspondence,
 * interpolation, and the two readings of a stroke's outline. It is core
 * infrastructure in the same sense geometry/svg.ts and geometry/xpbd.ts
 * are — pure functions over plain data, importable by anything, holding
 * no scene state and grafting nothing onto anything.
 *
 * THE ABILITY lives in `core/vocabulary/Morph/` — the `MorphShape`
 * holon, the `Morph` verb, and the `.morphTo()` graft that teaches every
 * Stroke to do this. That split is the point: a scene that wants to
 * morph imports the vocabulary module; a tool that only wants to
 * resample a polyline imports this one and gains no new methods on
 * anything. See vocabulary/Morph/README.md.
 *
 *
 * WHAT PYDEATION ACTUALLY DID (the correspondence rule, as found)
 *
 * The source does not implement point matching at all. It delegates the
 * whole question to Cinema 4D's MoGraph, in three objects
 * (refs/pydeation-legacy/animation/animator.py:581-632):
 *
 *   mospline1 = MoSpline(start_spline)
 *   mospline2 = MoSpline(destination_spline)
 *   plain_effector = PlainEffector()
 *   morpher = Cloner(mospline2, mospline1, effectors=[plain_effector],
 *                    morph_mode=True, completion=1, …)
 *   morph_completion = ChangeParams(plain_effector, modify_clone=1)
 *
 * Each piece states one half of the rule:
 *
 *   MoSpline  (object/mograph.py:37-54)
 *       MGMOSPLINEOBJECT_MODE       = 1  — Spline mode: resample a
 *                                         source spline
 *       MGMOSPLINEOBJECT_SPLINE_MODE = 3 — point distribution UNIFORM,
 *                                         i.e. by ARC LENGTH, not by
 *                                         the source's own control
 *                                         points
 *       MGMOSPLINEOBJECT_SPLINE_COUNT_STEP = 1
 *
 *     So both shapes are re-laid with points spaced evenly along their
 *     own perimeters. This is the only preprocessing there is.
 *
 *   Cloner in Blend  (object/mograph.py:118-151)
 *       MGCLONER_MODE = 3  (Blend)   MG_LINEAR_COUNT = 1
 *     One clone, blended between the two children. C4D's blend walks
 *     the two point lists BY INDEX and lerps — there is no rotation
 *     search, no proximity matching, no start-point alignment beyond
 *     each spline's own parameterization start.
 *
 *   PlainEffector.modify_clone  0 → 1  (object/mograph.py:153-175)
 *     The single scalar the animation drives. Everything else in the
 *     AnimationGroup is bookkeeping (show the morpher, hide it again at
 *     0.99, blend the two colours over the same window).
 *
 * So the correspondence rule, stated plainly and reproduced here:
 *
 *   RESAMPLE BOTH OUTLINES TO A COMMON POINT COUNT AT UNIFORM ARC
 *   LENGTH, EACH FROM ITS OWN START POINT AND IN ITS OWN WINDING,
 *   THEN INTERPOLATE INDEX BY INDEX.
 *
 * That is deliberately naive, and it is what the reference frames show:
 * Scene01's six circles arriving at a circle and a rectangle do not
 * un-twist, they simply slide. Anything cleverer — a rotation search
 * minimizing travel, a turning-function match — would be a DIFFERENT
 * animation from the one in the video, so it is refused. The framework
 * reproduces what pydeation did, not what a morph library would do.
 *
 * The one thing this module adds over C4D is that the resampling is a
 * PURE FUNCTION of the two polylines and the completion. C4D held the
 * morpher as scene state (an object shown at t=0, hidden at 0.99); here
 * `morphedPolyline(source, target, u)` can be evaluated at any u, in any
 * order, forever — which is what scrubbing needs and what the baked
 * paradigm assumes (TASTE.md "Time is a parameter").
 */

import {
  Circle,
  Ellipse,
  Line,
  Polygon,
  Rectangle,
  Square,
  Stroke,
  rectanglePolyline,
  rephasePolyline,
  type Vec3Like,
} from "../parts/primitives"
import { rotHPB } from "../parts/curves"
import type { Holon } from "../holon"

/** The default resampling density — C4D's MoSpline at COUNT_STEP 1. */
export const MORPH_SAMPLES = 128

const dist = (a: Vec3Like, b: Vec3Like): number =>
  Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)

/**
 * Cumulative arc length along a polyline: `out[i]` is the distance from
 * the first point to point i, and `out[n-1]` is the total.
 */
export const arcLengths = (points: readonly Vec3Like[]): number[] => {
  const out: number[] = [0]
  for (let i = 1; i < points.length; i++) out.push(out[i - 1]! + dist(points[i - 1]!, points[i]!))
  return out
}

/**
 * The point at `s` of the way along a polyline's arc length — the
 * MoSpline's own sampler. `s` is clamped to [0, 1]; a degenerate
 * polyline (zero length) answers its first point everywhere.
 */
export const pointAtArcLength = (points: readonly Vec3Like[], s: number): Vec3Like => {
  if (points.length === 0) return { x: 0, y: 0, z: 0 }
  if (points.length === 1) return points[0]!
  const cum = arcLengths(points)
  const total = cum[cum.length - 1]!
  if (total <= 0) return points[0]!
  const target = Math.min(1, Math.max(0, s)) * total
  // Binary search for the segment containing `target`.
  let lo = 0
  let hi = cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid]! <= target) lo = mid
    else hi = mid
  }
  const span = cum[hi]! - cum[lo]!
  const u = span > 0 ? (target - cum[lo]!) / span : 0
  const a = points[lo]!
  const b = points[hi]!
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u }
}

/**
 * Re-lay a polyline with `count` points spaced evenly along its arc
 * length — pydeation's `MoSpline(spline)` with SPLINE_MODE 3 (Uniform).
 *
 * The output keeps the input's endpoints exactly (sample 0 and sample
 * count-1 sit at s = 0 and s = 1), so a CLOSED input — one whose first
 * and last point coincide, which is how every primitive's polyline
 * arrives from the host — stays closed. That matters: the morphed shape
 * has to remain a loop through the whole interpolation, or the outline
 * springs open halfway and the wash has no interior.
 */
export const resampleUniform = (
  points: readonly Vec3Like[],
  count: number = MORPH_SAMPLES,
): Vec3Like[] => {
  if (count < 2) return points.length ? [points[0]!] : []
  if (points.length === 0) return []
  const out: Vec3Like[] = []
  for (let i = 0; i < count; i++) out.push(pointAtArcLength(points, i / (count - 1)))
  return out
}

/**
 * The morphed outline at completion `u` — the whole verb, as one pure
 * function of its three inputs.
 *
 * Both outlines are resampled to `count` points at uniform arc length
 * and lerped index by index (the Blend cloner's rule, above). At u = 0
 * the result is the source resampled, at u = 1 the target resampled;
 * in between it is neither shape but a real one, closed if both ends
 * were closed.
 *
 * Note what is NOT here: no rotation search, no reversal test, no
 * nearest-neighbour matching. See the header — the naivety is the
 * reproduction.
 */
export const morphedPolyline = (
  source: readonly Vec3Like[],
  target: readonly Vec3Like[],
  u: number,
  count: number = MORPH_SAMPLES,
): Vec3Like[] => {
  const t = Math.min(1, Math.max(0, u))
  const a = resampleUniform(source, count)
  const b = resampleUniform(target, count)
  const n = Math.min(a.length, b.length)
  const out: Vec3Like[] = []
  for (let i = 0; i < n; i++) {
    const p = a[i]!
    const q = b[i]!
    out.push({
      x: p.x + (q.x - p.x) * t,
      y: p.y + (q.y - p.y) * t,
      z: p.z + (q.z - p.z) * t,
    })
  }
  return out
}

/**
 * A stroke's outline in its OWN local space, as the pen walks it —
 * the CPU-side reading of the same geometry the host's `basePolyline`
 * builds, for the primitives a morph can be stated between.
 *
 * Deliberately narrow. The corpus morphs closed plane figures into other
 * closed plane figures (Scene01: circle → circle, circle → rectangle;
 * Scene06/07_1: octocat → framed polygon, polygon → polygon) and nothing
 * else, so this covers exactly the shapes a `Morph` can name. A holon
 * with no entry answers undefined and the morph refuses it loudly at
 * construction rather than rendering a blank — a silent empty outline is
 * the failure mode this class of code is prone to.
 *
 * The segment counts match the host's (STROKE_SEGMENTS = 128, the
 * rectangle's corner fans 8) so that a morph at u = 0 is the source's
 * own outline sampled the same way — the morph starts where the shape
 * already is, to the pixel.
 */
export const outlineOf = (holon: Stroke, segments = MORPH_SAMPLES): Vec3Like[] | undefined => {
  const ring = (rx: number, ry: number): Vec3Like[] => {
    const pts: Vec3Like[] = []
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2
      pts.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry, z: 0 })
    }
    return pts
  }
  let base: Vec3Like[] | undefined
  if (holon instanceof Circle) base = ring(holon.radius.value, holon.radius.value)
  else if (holon instanceof Ellipse) base = ring(holon.radiusX.value, holon.radiusY.value)
  else if (holon instanceof Square) {
    const s = holon.size.value / 2
    base = [
      { x: -s, y: -s, z: 0 },
      { x: s, y: -s, z: 0 },
      { x: s, y: s, z: 0 },
      { x: -s, y: s, z: 0 },
      { x: -s, y: -s, z: 0 },
    ]
  } else if (holon instanceof Polygon) {
    const n = holon.sides.value
    const pts: Vec3Like[] = []
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2 + holon.phase.value
      pts.push({ x: Math.cos(a) * holon.radius.value, y: Math.sin(a) * holon.radius.value, z: 0 })
    }
    base = pts
  } else if (holon instanceof Rectangle) {
    base = rectanglePolyline(holon.width.value, holon.height.value, holon.rounding.value)
  } else if (holon instanceof Line) {
    base = holon.points.length >= 2 ? [...holon.points] : undefined
  }
  if (!base) return undefined
  // The pen's own phase and winding, exactly as the host applies them
  // (three-host.ts: polyline) — a morph must start from the outline the
  // shape is actually drawn as, not from the generator's raw winding.
  const phase = holon.drawStart.value
  const reversed = holon.drawReversed.value
  return phase === 0 && !reversed ? base : rephasePolyline(base, phase, reversed)
}

/**
 * A stroke's outline in WORLD space — its own outline carried through
 * the transform chain it hangs from.
 *
 * A morph interpolates between two shapes that live in different frames
 * (Scene01's outer nodes sit on a 200-unit ring; the circle they become
 * sits at x = −200), so the interpolation has to happen somewhere both
 * of them can be stated. World space is that place, and it is what C4D
 * used too: the morpher Cloner is a scene-level object, and pydeation
 * parents it to the scene root, not to either shape.
 *
 * The holon's own rotation and scale apply first, then every ancestor's,
 * in the same order `worldPosition` walks — one shared reading of the
 * transform hierarchy rather than a second, divergent one.
 */
export const worldOutlineOf = (
  holon: Stroke,
  segments = MORPH_SAMPLES,
): Vec3Like[] | undefined => {
  const local = outlineOf(holon, segments)
  if (!local) return undefined
  const chain: Holon[] = []
  for (let node: Holon | undefined = holon; node; node = node.parent) chain.push(node)
  return local.map((p) => {
    let out = p
    for (const node of chain) {
      const s = node.scale.value
      out = rotHPB(
        { x: out.x * s, y: out.y * s, z: out.z * s },
        node.p.value,
        node.h.value,
        node.b.value,
      )
      out = { x: out.x + node.x.value, y: out.y + node.y.value, z: out.z + node.z.value }
    }
    return out
  })
}
