/**
 * DrawSteady — one pen, one constant speed, across a whole drawing.
 *
 * Every other constructive verb is parameterized by TIME: `Create` hands
 * each holon the same normalized 0→1 window and lets the ease shape it,
 * so a stroke's drawing rate is whatever its length divided by the span
 * happens to be. DrawSteady is parameterized by ARC LENGTH instead. The
 * pen moves at one speed for the entire drawing; a stroke twice as long
 * simply takes twice as long, and the span is a CONSEQUENCE rather than
 * a control.
 *
 * That inversion is the whole verb, and it is why it cannot be spelled
 * as a windowing of Create. It is also why the pen never lurches: there
 * is exactly one ease, over the whole traversal, instead of one per
 * subpath.
 *
 *
 * THE SOURCE, AND WHAT `draw_speed` COUNTS
 *
 * pydeation (refs/pydeation-legacy/animation/animator.py:245):
 *
 *   class DrawSteady(Animator):
 *       def __new__(cls, *cobjects, stroke_order=None, stroke_method="single",
 *                   sketch_speed="pixels", draw_speed=1000, **params):
 *
 * It sets C4D Sketch & Toon's own stroke animation into `sketch_speed
 * = "pixels"` mode and hands it `draw_speed`, then keyframes completion
 * 0→1 across the span. So the *drawing* is done by Sketch & Toon at a
 * fixed rate and pydeation's `run_time` is only the OUTER span the
 * effect lives inside. When the drawing finishes sooner than the span,
 * the remainder of the span is a hold — which is exactly what Scene00's
 * reference frames show, and it is how a `run_time=3` call produces a
 * 2.1-second draw.
 *
 * `sketch_speed="pixels"` is the literal unit: SCREEN PIXELS of arc per
 * second, measured at the RENDER WIDTH. Not world units. The 2024
 * reference pins this down with no room left over — Scene00's portrait
 * carries 25303.36 units of arc in its own SVG space, scaled by 2/3 and
 * framed by a TwoDScene at zoom 1 (1023 world units across a 1280-wide
 * render, i.e. 1.25122 px/unit):
 *
 *   world arc  = 25303.36 * 2/3          = 16868.9 units
 *   screen arc = 16868.9 * 1280/1023     = 21106.7 px
 *   duration   = 21106.7 / 10000         = 2.111 s
 *
 * Against refs/pitch/origins/frames5, the lit-pixel count rises LINEARLY
 * — deltas .107 .099 .108 .106 .093 .085 .097 .093 .081 .083 over the
 * ten frames from t=0.2 to t=2.2, then flat from f_00012 (t=2.4) on. A
 * least-squares fit of that line gives a duration of 2.095s and a start
 * of t=0.117. Predicted 2.111 against measured 2.095 is 0.8%, inside the
 * fit's own residual. The two competing readings both die on the same
 * data: world units would give 1.687s (20% fast) and pixels at a 1920
 * render 3.166s (50% slow).
 *
 * The linearity is itself the second half of the proof. A `Create` over
 * the same span would carry C4D's default ease and put the midpoint at
 * 0.5 with visibly slower ends; the measured curve has no ease in it at
 * all, because in `pixels` mode the rate — not the completion — is what
 * is held constant.
 *
 * So `speed` here is stated in px/s at a stated `frameWidth`, and the
 * caller converts through the same projection the render uses. Keeping
 * the unit honest matters more than making it convenient: a "steady"
 * draw whose speed silently depended on the frame size would be steady
 * in name only.
 *
 *
 * STROKE ORDER
 *
 * `stroke_order` decides which subpath the pen visits next. Scene00 uses
 * `"long_short"` — longest first — and the reference shows why it is the
 * expressive choice: the drawing's structural strokes (jaw, hoodie,
 * shoulders) land before the hair scribbles, so the portrait reads as a
 * face almost immediately instead of assembling out of noise. The first
 * subpath alone is 30.9% of the total arc.
 *
 * The reference confirms the ordering directly. At t=0.4 the lit region
 * spans screen x[475,774]; the longest subpath's own projected bounds
 * are x[476,776], and no other subpath is in frame yet — the pen is
 * still inside stroke #0 at 13% of the drawing. Document order would
 * have lit several short strokes across the full width by then.
 */

import { restage, together, type Anim, type Windowed } from "./anim"
import type { Holon } from "./holon"
import { Stroke } from "./parts/index"
import type { Vec3Like } from "./parts/primitives"

/**
 * The orders a pen can visit a drawing's strokes in.
 *
 * `"document"` is the fallback and the only one that needs no geometry:
 * the order the strokes were composed in, which for an imported drawing
 * is the order the artist drew them.
 */
export type StrokeOrder = "long_short" | "short_long" | "document"

/** Total length of a polyline — the time a stroke costs at a fixed speed. */
export const polylineLength = (points: readonly Vec3Like[]): number => {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
  }
  return total
}

/**
 * The drawable strokes under a holon, with the arc length each carries.
 *
 * Deliberately generic: anything in the tree that is a `Stroke` with real
 * geometry counts, so this reads a Sketch's 37 imported subpaths and an
 * Axes' shaft-and-ticks through the same walk. DrawSteady is a statement
 * about pens, not about SVGs.
 *
 * A Stroke exposes its polyline as `points` when it has one (a Line
 * does; a parametric Circle generates its own at render time). Those
 * without measurable geometry are skipped rather than guessed at — a
 * zero-length entry would take zero time and flash into being, which is
 * worse than not being steered.
 */
export const strokesOf = (holon: Holon): { stroke: Stroke; length: number }[] => {
  const found: { stroke: Stroke; length: number }[] = []
  for (const h of holon.walk()) {
    if (!(h instanceof Stroke)) continue
    const points = (h as Stroke & { points?: readonly Vec3Like[] }).points
    if (!points || points.length < 2) continue
    const length = polylineLength(points)
    if (length > 1e-9) found.push({ stroke: h, length })
  }
  return found
}

/**
 * Order strokes for the pen. Ties keep document order, so the result is
 * deterministic on drawings with repeated shapes (a row of identical
 * ticks must not reshuffle between runs).
 */
export const orderStrokes = <T extends { length: number }>(
  items: readonly T[],
  order: StrokeOrder,
): T[] => {
  if (order === "document") return [...items]
  const sign = order === "long_short" ? -1 : 1
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => sign * (a.item.length - b.item.length) || a.i - b.i)
    .map(({ item }) => item)
}

export interface SteadyPlan {
  /** Per-stroke [relStart, relStop] windows, in traversal order. */
  windows: { stroke: Stroke; from: number; to: number; length: number }[]
  /** Total arc length traversed, in the holon's own world units. */
  totalLength: number
}

/**
 * Lay the strokes end to end along one normalized traversal.
 *
 * Each stroke's window is its share of the TOTAL arc length, which is
 * precisely what makes the speed constant: at any moment the pen has
 * covered `u * totalLength` of arc, whichever stroke it happens to be
 * inside. Windows abut exactly (each begins where the last ended), so
 * the handoff between strokes costs no time and drops no ink.
 *
 * Pure, and separated from the Anim it feeds so the proportionality and
 * the ordering can be asserted directly (core/test/drawsteady.test.ts).
 */
export const planSteady = (holon: Holon, order: StrokeOrder = "long_short"): SteadyPlan => {
  const ordered = orderStrokes(strokesOf(holon), order)
  const totalLength = ordered.reduce((a, s) => a + s.length, 0)
  if (totalLength <= 1e-9) return { windows: [], totalLength: 0 }

  const windows: SteadyPlan["windows"] = []
  let at = 0
  for (let i = 0; i < ordered.length; i++) {
    const { stroke, length } = ordered[i]!
    const from = at
    at += length / totalLength
    // The last window closes on exactly 1 — accumulated division would
    // otherwise leave a sliver of the final stroke undrawn.
    windows.push({ stroke, from, to: i === ordered.length - 1 ? 1 : at, length })
  }
  return { windows, totalLength }
}

/**
 * Seconds a steady draw of this holon takes at a given pen speed.
 *
 * `speed` is px/s at `frameWidth` (see the header): the caller supplies
 * the projection because only the scene knows its own framing. For the
 * 2024 TwoDScene that is `frameWidth / 1023` px per world unit.
 *
 * This is what lets a scene state the source's numbers verbatim and get
 * the source's timing out, instead of hand-tuning a run_time to match.
 */
export const steadyDuration = (
  holon: Holon,
  opts: { speed: number; pxPerUnit: number; order?: StrokeOrder },
): number => {
  const { totalLength } = planSteady(holon, opts.order ?? "long_short")
  return (totalLength * opts.pxPerUnit) / opts.speed
}

/**
 * Draw every stroke of a holon at one constant arc-length speed.
 *
 * The Anim fills its whole span — the caller decides how many seconds
 * that is, and `steadyDuration` is how a scene computes the seconds the
 * 2021 `draw_speed` implies. The default ease is `"linear"`, which is
 * not the framework's usual default and is the point of the verb: a
 * steady pen has no acceleration. The reference measures dead-linear
 * (see the header), so the C4D-smooth alternative is available but
 * off by default.
 *
 * `restage` rather than a bare window tuple: the ease is stated once
 * over the WHOLE traversal, and restaging keeps its tangents at that
 * full length while the windows squeeze — so there is one global ease
 * and no per-subpath seam, which is exactly what O-1's Sketch could not
 * express. At `linear` the two are identical anyway; the distinction is
 * what makes `easing: "smooth"` behave as one ease over one long stroke
 * rather than 37 little ones.
 */
export const DrawSteady = (
  holon: Holon,
  opts: { order?: StrokeOrder; easing?: "linear" | "smooth" } = {},
): Anim => {
  const { windows } = planSteady(holon, opts.order ?? "long_short")
  if (windows.length === 0) return { tracks: [] }
  const easing = opts.easing ?? "linear"

  const items: Windowed[] = windows.map(({ stroke, from, to }) =>
    restage({ tracks: stroke.creation.sequence(0, 1).tracks.map((t) => ({ ...t, easing })) }, from, to),
  )
  return together(...items)
}

/**
 * The retracting counterpart: the pen walks back the way it came, so the
 * stroke drawn LAST is the first to leave. Same constant speed.
 */
export const UnDrawSteady = (
  holon: Holon,
  opts: { order?: StrokeOrder; easing?: "linear" | "smooth" } = {},
): Anim => {
  const { windows } = planSteady(holon, opts.order ?? "long_short")
  if (windows.length === 0) return { tracks: [] }
  const easing = opts.easing ?? "linear"

  const items: Windowed[] = windows.map(({ stroke, from, to }) =>
    restage({ tracks: stroke.creation.to(0).tracks.map((t) => ({ ...t, easing })) }, 1 - to, 1 - from),
  )
  return together(...items)
}
