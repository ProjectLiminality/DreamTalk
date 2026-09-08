/**
 * Connections — Keynote's connection lines, RECOMPUTED rather than read.
 *
 * WHY THIS MODULE EXISTS AT ALL: THE STORED PATH IS UNRELIABLE
 *
 * A `TSD.ConnectionLineArchive` is not an independent drawing. Keynote
 * recomputes it from the two objects it joins whenever either one moves,
 * and the copy that ends up in the file is whatever the last recompute
 * left there — which is not necessarily where the slide draws it. P-1's
 * survey across all 547 lines in the deck (keynote.ts,
 * `SlideShapeData.connects`) found **135 (25%) STALE**: the stored
 * chord's axis does not aim at both connected objects' centres. There is
 * no local sign that anything is wrong, so a chapter that trusts stored
 * paths draws lines in the wrong places silently, and P-3 measured
 * exactly that on slides 2 and 3.
 *
 * So every connection this module draws is REBUILT from `connects`, and
 * the stored path is used for nothing but a fallback when the endpoints
 * cannot be resolved.
 *
 * THE RULE, AS DERIVED AND AS MEASURED
 *
 * Stated first, then the evidence for each clause.
 *
 *   1. The line runs from the `from` drawable's CENTRE to the `to`
 *      drawable's CENTRE, where "centre" is the centre of its geometry
 *      box, and a GROUP's box is the union of its members' (recursively).
 *   2. It is a QUADRATIC BEZIER THROUGH the stored path's middle point,
 *      not a polyline and not a curve with that point as its control.
 *   3. It is CLIPPED at each end where the curve last leaves that
 *      object's own FLATTENED PATH — its actual drawn silhouette, not
 *      its bounding box and not an ellipse fitted to that box.
 *   4. The dash lattice is laid by ARC LENGTH from the clipped start,
 *      continuously across the whole curve.
 *
 * **Clause 1 and 3, measured on deck slide 9** — six identical
 * `Head with Shoulders_826` icons in a hexagon, fifteen lines, a complete
 * K6, settled frame `f_00950`. Walking each centre-to-centre chord and
 * locating the first dot: it lands **-0.14 +/- 1.45 slide units** from
 * the path-clip point across all fifteen. One slide unit is 2/3 of a
 * video pixel, so that is sub-pixel agreement with no free parameter.
 * The alternatives are not close: clipping at the bounding box misses by
 * **-15.4 +/- 13.1** and at a box-fitted ellipse by **-10.7 +/- 11.5**.
 * The footage says the same thing by eye — zoom the top icon in f_00950
 * and a dot sits in each shoulder notch, INSIDE the bounding box, while
 * no dot lies inside the head.
 *
 * It is not an artefact of one icon. Deck slide 10 repeats it at three
 * more silhouettes — `Cell_302` 1.32 +/- 0.77, `Bacteria_814`
 * 1.89 +/- 1.03, `Neuron_815` 0.12 +/- 2.67 — and its left cluster,
 * once its own declared `action-motion-path` and `action-scale` are
 * applied, gives **0.340 +/- 0.417**, tighter than slide 9.
 *
 * **Clause 4, and P-1's cap derivation confirmed at scale.** Fitting the
 * dot lattice on each of slide 9's fifteen chords gives a period of
 * **15.003 +/- 0.009** slide units against the round-cap prediction
 * `(0.001 + 2.0 + 1) * 5.0 = 15.005`. P-1 settled the cap rule from the
 * stylesheet on one corridor of one slide; fifteen independent lines
 * agree with it to 0.01%.
 *
 * The lattice's PHASE is what forces this module to lay dashes itself
 * rather than hand the curve to `DottedLine`. The primitive restarts its
 * pattern at every vertex (`primitives.ts` `compose` calls `dashRuns`
 * per segment), which is invisible on a straight two-point line — every
 * connection P-3 met — and wrong on a flattened curve, where it would
 * reset the phase dozens of times along one line. Slide 9's measurement
 * also says which end anchors it: the first dot sits at the clip to
 * within 1.45 units while the LAST dot scatters over 9.31 +/- 11.93,
 * a spread bounded by exactly one period. The lattice starts at the
 * `from` clip and runs; the far end is ragged by construction.
 *
 * **Clause 2, measured on the curved lines.** The stored form is always
 * three points (moveTo + lineTo + lineTo) and the archives call it
 * `kTSDConnectionLineTypeQuadratic`. Sampling reference ink along each
 * candidate reading, dash-aware, on slide 8's ten lines (a 10-unit
 * offset null control scores 0.007-0.015):
 *
 *     quadratic THROUGH the middle point   0.463 - 0.547
 *     straight polyline through it         0.072 - 0.468
 *     quadratic with it as CONTROL point   0.000 - 0.025
 *
 * 0.52 is what a perfect match to a 50%-duty (6,6) dash scores, since
 * half the samples fall in the gaps. Slide 11's seventy SOLID strokes
 * separate the two live readings much further — **0.951 +/- 0.058**
 * for the quadratic against 0.711 +/- 0.252 for the polyline, with the
 * middle point averaging 12.94 units off the chord. And one line settles
 * it without any footage at all: 4107905's stored path spans 1078 units
 * of x inside a stored frame 736.5 wide, which a polyline cannot do and
 * a curve bounded by its control polygon does exactly.
 *
 * A quadratic through P at t=1/2 has control `2P - (A + B)/2`; that is
 * `controlThrough` below, and it is arithmetic rather than a fit.
 *
 * THE OUTSET — A MISSING FIELD THAT LOOKED LIKE A MISSING RULE
 *
 * `outsetFrom` / `outsetTo` is a per-line stand-off Keynote applies
 * beyond the clip, and it is worth recording how it was found because
 * the failure mode is the instructive part.
 *
 * The rule above closes to sub-pixel on slides 9 and 10 and did not
 * close at all on slide 8, whose lines all ran long. Six candidate
 * boundary rules were tested against that slide's own drawn extents —
 * the ellipse's path, the group box, an inscribed ellipse, the
 * ellipse's box, the member-path union, a circumscribed circle — and
 * NONE gave a constant residual; the best had a standard deviation of
 * 11.3 slide units, and five of the ten lines sat exactly 30 units
 * beyond the group box while the other five scattered from -37.7 to
 * +6.0. The temptation at that point is a per-slide constant, which
 * would have "worked" on slide 8 and been wrong everywhere else.
 *
 * It was not a missing rule. P-1's note had recorded these as "both 0.0
 * throughout this deck" and they are per-line: **164 of the 467
 * in-scope lines are non-zero**, clustered on exactly the densest meshes
 * (slide 8 is 30/30, slide 11 is 10/10, slides 9 and 10 are 0/0). P-1
 * has since carried the field and `connectionPath` reads it. The five
 * lines that matched at 30 were the ones whose ray happened to leave
 * near the ellipse's extreme, where box and silhouette agree — a
 * coincidence that would have made a fitted constant look justified.
 *
 * ARROWHEADS are read the same way, from `lineEnds`: 123 in-scope heads
 * and one tail, resolved through the style chain in the GLOBAL
 * stylesheet. See `arrowHead` for what is measured about the drawn size
 * and what is not.
 */

import { color, completion, length } from "../../src/params"
import { together, type Anim, type Windowed } from "../../src/anim"
import { Line, Group, type Vec3Like } from "../../src/parts/primitives"
import { Holon, type Overrides } from "../../src/holon"
import { WHITE, type Color } from "../../src/constants"

/** A point on the slide canvas: 1920x1080, y DOWN, origin top-left. */
export interface SlidePoint {
  x: number
  y: number
}

/** An axis-aligned box on the slide canvas. */
export interface SlideBox {
  x: number
  y: number
  w: number
  h: number
}

/**
 * What a connection can attach to: the drawable's box, and its actual
 * drawn outline as flattened polylines in CANVAS coordinates.
 *
 * Both are needed and they are not interchangeable — clause 3 above is
 * the whole reason this interface carries `outline` at all. A target
 * with no outline (a group whose members were dropped, an image whose
 * pixels this framework does not draw) falls back to its box, which is
 * the honest degradation: the box is what the deck states about it.
 */
export interface ConnectTarget {
  id: string
  box: SlideBox
  /** One polyline per subpath, in canvas coordinates. May be empty. */
  outline: readonly (readonly SlidePoint[])[]
}

/** The centre of a box — where a connection line aims. */
export const boxCentre = (b: SlideBox): SlidePoint => ({
  x: b.x + b.w / 2,
  y: b.y + b.h / 2,
})

/** The union of boxes, or undefined when there are none. */
export const unionBoxes = (boxes: readonly SlideBox[]): SlideBox | undefined => {
  if (boxes.length === 0) return undefined
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const b of boxes) {
    x0 = Math.min(x0, b.x)
    y0 = Math.min(y0, b.y)
    x1 = Math.max(x1, b.x + b.w)
    y1 = Math.max(y1, b.y + b.h)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/**
 * The control point of the quadratic that PASSES THROUGH `mid` at
 * t = 1/2, given endpoints `a` and `b`.
 *
 * B(1/2) = (a + 2c + b)/4, so c = 2*mid - (a + b)/2. Clause 2's
 * arithmetic, and the reason the stored middle point must not be used as
 * a control point directly — doing so scores 0.000-0.025 against ink
 * where this scores 0.463-0.547.
 */
export const controlThrough = (
  a: SlidePoint,
  mid: SlidePoint,
  b: SlidePoint,
): SlidePoint => ({
  x: 2 * mid.x - (a.x + b.x) / 2,
  y: 2 * mid.y - (a.y + b.y) / 2,
})

/** A quadratic Bezier sampled at t. */
export const quadAt = (
  a: SlidePoint,
  c: SlidePoint,
  b: SlidePoint,
  t: number,
): SlidePoint => {
  const mt = 1 - t
  return {
    x: mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x,
    y: mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y,
  }
}

/**
 * The quadratic as a polyline.
 *
 * The sample count is chosen from the control polygon's own size so a
 * long line and a short one are flattened to the same fidelity — the
 * same call `keynote.ts`'s flattener makes, and for the same reason:
 * a fixed count would make a 600-unit mesh line coarser than a 90-unit
 * one, and the dash lattice reads arc length off this polyline.
 */
export const flattenQuad = (
  a: SlidePoint,
  c: SlidePoint,
  b: SlidePoint,
  tolerance = 0.25,
): SlidePoint[] => {
  const dev = Math.hypot(c.x - (a.x + b.x) / 2, c.y - (a.y + b.y) / 2)
  const span = Math.hypot(b.x - a.x, b.y - a.y) + dev
  const n = Math.max(2, Math.ceil(Math.sqrt(span / Math.max(tolerance, 1e-6))))
  const out: SlidePoint[] = []
  for (let i = 0; i <= n; i++) out.push(quadAt(a, c, b, i / n))
  return out
}

/** Where segment `a`->`b` crosses segment `c`->`d`, as a t along a->b. */
const segmentCross = (
  a: SlidePoint,
  b: SlidePoint,
  c: SlidePoint,
  d: SlidePoint,
): number | undefined => {
  const rx = b.x - a.x
  const ry = b.y - a.y
  const sx = d.x - c.x
  const sy = d.y - c.y
  const den = rx * sy - ry * sx
  if (Math.abs(den) < 1e-12) return undefined
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : undefined
}

/**
 * The arc length at which a polyline LAST leaves a target's outline,
 * walking from `polyline[0]`.
 *
 * "Last", not "first", and that is clause 3 doing real work: an icon
 * like `Head with Shoulders_826` is a concave silhouette, so a ray from
 * its centre can cross its own outline several times — out of the neck,
 * back through a shoulder, out again. Keynote draws from the outermost
 * crossing, which is what the footage shows (a dot sits in each shoulder
 * notch and none inside the head).
 *
 * Returns 0 when the outline is empty or is never crossed — the honest
 * answer for a target whose shape this framework does not have, and the
 * caller then has the box to fall back on.
 */
export const outlineExit = (
  polyline: readonly SlidePoint[],
  target: ConnectTarget,
): number => {
  let best = 0
  let travelled = 0
  for (let i = 0; i + 1 < polyline.length; i++) {
    const a = polyline[i]!
    const b = polyline[i + 1]!
    const seg = Math.hypot(b.x - a.x, b.y - a.y)
    for (const sub of target.outline) {
      for (let j = 0; j + 1 < sub.length; j++) {
        const t = segmentCross(a, b, sub[j]!, sub[j + 1]!)
        if (t !== undefined) best = Math.max(best, travelled + t * seg)
      }
    }
    travelled += seg
  }
  return best
}

/** The same, measured from the FAR end — the `to` object's clip. */
export const outlineExitFromEnd = (
  polyline: readonly SlidePoint[],
  target: ConnectTarget,
): number => {
  const reversed = [...polyline].reverse()
  return outlineExit(reversed, target)
}

/** The total length of a polyline. */
export const polylineLength = (points: readonly SlidePoint[]): number => {
  let total = 0
  for (let i = 0; i + 1 < points.length; i++) {
    total += Math.hypot(
      points[i + 1]!.x - points[i]!.x,
      points[i + 1]!.y - points[i]!.y,
    )
  }
  return total
}

/** The point at arc length `d` along a polyline, clamped to its ends. */
export const pointAtLength = (
  points: readonly SlidePoint[],
  d: number,
): SlidePoint => {
  if (points.length === 0) return { x: 0, y: 0 }
  if (d <= 0) return points[0]!
  let travelled = 0
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const seg = Math.hypot(b.x - a.x, b.y - a.y)
    if (travelled + seg >= d) {
      const u = seg > 1e-12 ? (d - travelled) / seg : 0
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }
    }
    travelled += seg
  }
  return points[points.length - 1]!
}

/** The sub-polyline between two arc lengths, endpoints included. */
export const trimPolyline = (
  points: readonly SlidePoint[],
  from: number,
  to: number,
): SlidePoint[] => {
  if (to <= from) return []
  const out: SlidePoint[] = [pointAtLength(points, from)]
  let travelled = 0
  for (let i = 0; i + 1 < points.length; i++) {
    const seg = Math.hypot(
      points[i + 1]!.x - points[i]!.x,
      points[i + 1]!.y - points[i]!.y,
    )
    const at = travelled + seg
    if (at > from && at < to) out.push(points[i + 1]!)
    travelled = at
  }
  out.push(pointAtLength(points, to))
  return out
}

/**
 * The dash runs along a polyline, by CONTINUOUS ARC LENGTH.
 *
 * This is the difference from `primitives.ts`'s `dashRuns`, which lays a
 * pattern per SEGMENT and so restarts its phase at every vertex. That is
 * invisible on the straight two-point connections P-3 met and wrong on a
 * flattened curve, where a mesh line is dozens of segments and the
 * lattice would reset dozens of times. Slide 9's measured period holds
 * to 15.003 +/- 0.009 over lines up to 594 units long, which only a
 * continuous lattice reproduces.
 *
 * `period` is the caller's, because the cap is part of it — P-1's
 * derivation, `(dash + gap + 1) * width` under a round cap and
 * `(dash + gap) * width` under a butt cap. This function takes the
 * finished numbers rather than re-deriving them, so there is one place
 * that arithmetic lives.
 */
export const dashAlong = (
  points: readonly SlidePoint[],
  dash: number,
  period: number,
): SlidePoint[][] => {
  const total = polylineLength(points)
  if (total <= 0 || dash <= 0 || period <= 0) return [[...points]]
  const runs: SlidePoint[][] = []
  for (let d = 0; d < total - 1e-9; d += period) {
    const run = trimPolyline(points, d, Math.min(total, d + dash))
    if (run.length >= 2) runs.push(run)
  }
  return runs
}

/**
 * One connection line's recomputed geometry, in slide coordinates.
 *
 * Everything above, applied in order. Separated from the holon because
 * it is pure arithmetic over the deck's own numbers and is where the
 * tests reach — the same division `keynote.ts` keeps from `Slides.ts`.
 */
export interface ConnectionPath {
  /** The clipped, flattened curve. Empty when the ends coincide. */
  points: SlidePoint[]
  /** The unclipped curve, for tests and for reporting the clip amounts. */
  full: SlidePoint[]
  /** Arc length at which the `from` clip fell. */
  clipFrom: number
  /** Arc length at which the `to` clip fell, from the start. */
  clipTo: number
}

/**
 * Recompute a connection line between two targets.
 *
 * `mid` is the stored path's middle point, which is the ONLY thing taken
 * from the stored geometry and is taken because it carries the curve's
 * bow — the endpoints it sits between are recomputed, but how far the
 * line bellies out between them is a real authored quantity with no
 * other source. Passing it undefined gives a straight line, which is
 * what the great majority of the deck's connections are.
 *
 * `outset` is Keynote's `outsetFrom`/`outsetTo`, a further inset beyond
 * the silhouette clip. It defaults to 0 because that is what the slides
 * this rule is derived on declare; see the module header for why a
 * non-zero one is not modelled from the footage.
 */
export const connectionPath = (
  from: ConnectTarget,
  to: ConnectTarget,
  mid?: SlidePoint,
  outset: { from?: number; to?: number } = {},
): ConnectionPath => {
  const a = boxCentre(from.box)
  const b = boxCentre(to.box)
  const straight = Math.hypot(b.x - a.x, b.y - a.y) < 1e-9
  if (straight) return { points: [], full: [], clipFrom: 0, clipTo: 0 }

  const full = mid
    ? flattenQuad(a, controlThrough(a, mid, b), b)
    : [a, b]
  const total = polylineLength(full)

  // Clause 3: clip at each object's own outline, falling back to its box
  // when this framework has no outline for it (a dropped image, a group
  // whose members did not compose). The box fallback is stated rather
  // than silent because it is measurably worse — -15.4 +/- 13.1 slide
  // units against the outline's -0.14 +/- 1.45 on slide 9.
  const exitFrom = from.outline.length > 0
    ? outlineExit(full, from)
    : outlineExit(full, boxAsTarget(from))
  const exitTo = to.outline.length > 0
    ? outlineExitFromEnd(full, to)
    : outlineExitFromEnd(full, boxAsTarget(to))

  const clipFrom = Math.min(total, exitFrom + (outset.from ?? 0))
  const clipTo = Math.max(0, total - exitTo - (outset.to ?? 0))
  return { points: trimPolyline(full, clipFrom, clipTo), full, clipFrom, clipTo }
}

/** A target's box as a closed rectangle outline — the clip fallback. */
export const boxAsTarget = (t: ConnectTarget): ConnectTarget => ({
  id: t.id,
  box: t.box,
  outline: [
    [
      { x: t.box.x, y: t.box.y },
      { x: t.box.x + t.box.w, y: t.box.y },
      { x: t.box.x + t.box.w, y: t.box.y + t.box.h },
      { x: t.box.x, y: t.box.y + t.box.h },
      { x: t.box.x, y: t.box.y },
    ],
  ],
})

/**
 * An arrowhead's outline, in slide coordinates.
 *
 * The deck's dominant decoration is `"simple arrow"`: a filled triangle
 * whose path is (0,0) (3,6) (6,0), joined to the line at (3,0) — so it
 * is 6 wide across the base and 6 long, its tip forward and its base
 * centred on the line's end.
 *
 * `size` is the drawn length. Measured on three of slide 8's lines the
 * head runs **9.66 +/- 0.10** long by **4.67 +/- 0.20** half-width, an
 * aspect of 2.07 against the path's own 6/3 = 2.0 — so the SHAPE is the
 * declared one and only the scale is in question. That scale is not a
 * clean multiple of the 2.0 stroke width and three samples cannot
 * establish the rule, so it is a caller-supplied length here rather than
 * a constant derived from too little.
 *
 * This framework draws strokes, so the filled triangle is drawn as its
 * closed outline. On a 2-unit stroke at slide scale the difference is
 * under a pixel of the frame, and a fill would be the wrong claim to
 * make while `isFilled` is a field the consumer does not act on.
 */
export const arrowHead = (
  tip: SlidePoint,
  towards: SlidePoint,
  size: number,
  halfWidth = size / 2,
): SlidePoint[] => {
  const dx = tip.x - towards.x
  const dy = tip.y - towards.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-9 || size <= 0) return []
  const ux = dx / len
  const uy = dy / len
  const base = { x: tip.x - ux * size, y: tip.y - uy * size }
  // The normal, in the canvas's own y-down frame.
  const nx = -uy
  const ny = ux
  return [
    { x: base.x + nx * halfWidth, y: base.y + ny * halfWidth },
    tip,
    { x: base.x - nx * halfWidth, y: base.y - ny * halfWidth },
    { x: base.x + nx * halfWidth, y: base.y + ny * halfWidth },
  ]
}

/**
 * A round end decoration — Keynote's `"filled circle"`.
 *
 * NOT hypothetical, and worth its own function rather than a triangle
 * with more points: the deck contains two of them. They are the reason a
 * consumer must not key on "always a simple arrow on the `to` end" —
 * P-1's own warning, and it is the second half of the same warning that
 * a TAIL exists (one, in the file), which is why `lineDecoration` below
 * dispatches on the identifier rather than assuming.
 *
 * Drawn centred on the line's end, since a dot has no direction.
 */
export const roundHead = (tip: SlidePoint, size: number): SlidePoint[] => {
  if (size <= 0) return []
  const r = size / 2
  const out: SlidePoint[] = []
  const n = 16
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * i) / n
    out.push({ x: tip.x + r * Math.cos(a), y: tip.y + r * Math.sin(a) })
  }
  return out
}

/**
 * One end decoration's outline, dispatched on what the deck calls it.
 *
 * The identifier is READ rather than assumed. Across the deck 123 lines
 * carry a head and one carries a tail, and while almost all are
 * `"simple arrow"`, **two are `"filled circle"`** — so a consumer that
 * drew every decoration as a triangle would be wrong twice, silently,
 * and in a way no scored frame in this chapter would have caught
 * (neither exception falls on slides 7, 8, 9 or 14).
 *
 * An unrecognised identifier draws NOTHING rather than guessing a shape.
 * A decoration missing from the frame is a visible, reportable gap; one
 * invented in the wrong shape is a fidelity claim the data does not
 * support.
 */
export const lineDecoration = (
  identifier: string | undefined,
  tip: SlidePoint,
  towards: SlidePoint,
  size: number,
): SlidePoint[] => {
  if (identifier === "filled circle") return roundHead(tip, size)
  if (identifier === "simple arrow" || identifier === undefined) {
    return arrowHead(tip, towards, size)
  }
  return []
}

/**
 * A connection line as a holon: the dashes (or the solid stroke) plus
 * its arrowhead, sharing one draw front.
 *
 * WHY A HOLON RATHER THAN A `DottedLine`
 *
 * Two reasons, both measured. The lattice must be continuous across a
 * flattened curve, which `DottedLine` cannot do (module header). And a
 * `LineDrawForLine` build on an arrowed line must draw the head with the
 * shaft rather than as a separate object, which needs them under one
 * parent with one `creation` ordering.
 *
 * It composes one `Line` per dash exactly as `DottedLine` does, so every
 * stroke in the mesh goes through the identical ribbon path as every
 * other stroke in the framework. There is no connection-specific
 * rendering anywhere, which is `Slide`'s own contract one level down.
 */
export class Connection extends Holon {
  /** The clipped curve, in WORLD coordinates. */
  points: Vec3Like[] = []
  /**
   * End decorations, ONE OUTLINE EACH, in world coordinates.
   *
   * A list of lists rather than one flat list, because a line can carry
   * both a head and a tail — the deck has one such — and concatenating
   * them would draw a spurious segment joining the two ends of the line.
   */
  decorations: Vec3Like[][] = []

  /** Dash length and full period, in world units. Zero dash = solid. */
  dash = length(0)
  period = length(0)

  tint = color(WHITE)
  stroke = length(1)
  override opacity = completion(1)

  /** One Line per dash, in draw order from the `from` end. */
  dashes: Line[] = []
  /** One Line per end decoration, in `decorations` order. */
  arrows: Line[] = []

  /** The first decoration, which on almost every arrowed line is the
   *  only one — kept for readability at call sites. */
  get arrow(): Line | undefined {
    return this.arrows[0]
  }

  protected override compose(): void {
    if (this.points.length >= 2) {
      const runs =
        this.dash.value > 0 && this.period.value > 0
          ? dashAlong(
              this.points.map((p) => ({ x: p.x, y: p.y })),
              this.dash.value,
              this.period.value,
            )
          : [this.points.map((p) => ({ x: p.x, y: p.y }))]
      for (const run of runs) {
        this.dashes.push(
          this.add(
            new Line({
              points: run.map((p) => ({ x: p.x, y: p.y, z: 0 })),
              tint: this.tint.value,
              stroke: this.stroke.value,
              opacity: this.opacity.value,
            }),
          ),
        )
      }
    }
    for (const outline of this.decorations) {
      if (outline.length < 2) continue
      this.arrows.push(
        this.add(
          new Line({
            points: outline.map((p) => ({ x: p.x, y: p.y, z: 0 })),
            tint: this.tint.value,
            stroke: this.stroke.value,
            opacity: this.opacity.value,
          }),
        ),
      )
    }
  }

  /** Everything that actually draws — what an opacity ramp must reach. */
  drawn(): Line[] {
    void this.parts
    return [...this.dashes, ...this.arrows]
  }

  /**
   * The draw-on, dash by dash from the `from` end, the head last.
   *
   * This is `LineDrawForLine` on a connection: the same spatial sweep
   * `DottedLine.createAnim` performs, over this holon's own continuous
   * lattice, with the arrowhead arriving at the end of the shaft because
   * that is where the shaft reaches it.
   */
  override createAnim(): Anim {
    void this.parts
    const items = this.drawn()
    const n = items.length
    if (n === 0) return { tracks: [] }
    return together(
      ...items.map((d, i): Windowed => [
        d.creation.sequence(0, 1),
        i / n,
        (i + 1) / n,
      ]),
    )
  }

  override unCreateAnim(): Anim {
    void this.parts
    const items = this.drawn()
    const n = items.length
    if (n === 0) return { tracks: [] }
    return together(
      ...items.map((d, i): Windowed => [
        d.creation.to(0),
        1 - (i + 1) / n,
        1 - i / n,
      ]),
    )
  }
}

/**
 * A CONNECTION WHOSE ENDPOINTS ARE MOVING — the relation, held as a
 * relation for the whole of a Magic Move.
 *
 * ═══════════════════════════════════════════════════════════════════
 * WHY A SECOND CLASS RATHER THAN A PARAM ON `Connection`
 * ═══════════════════════════════════════════════════════════════════
 *
 * `Connection` above bakes: `compose()` reads `points` once and lays a
 * fixed lattice of `Line` children along it. That is right for a settled
 * page, where the geometry is a constant, and it is the reason the
 * static slides close to sub-pixel.
 *
 * It is wrong the moment the endpoints move, and the footage is what
 * says so. Through deck 12→13's Magic Move the reference's dotted mesh
 * is visibly RE-DRAWN between the travelling heads — the lines stay
 * anchored in the icons' shoulder notches the whole way across — while a
 * baked mesh can only be dragged along as rigid ink. The module header
 * above already states the static half of this truth (Keynote recomputes
 * a line whenever either object moves, which is why 25% of the stored
 * paths are stale); this class is the same truth extended through time.
 * **A connection is a RELATION, not a drawable, and it stays one while
 * its endpoints move.**
 *
 * So the geometry is PULLED per frame rather than pushed: each dash's
 * `points` is an accessor over a memo keyed on the endpoint boxes and
 * the completion, exactly as `MorphShape` derives its outline and
 * `curves.ts` its section curve. The six-line idiom is written out here
 * rather than imported, for the reason Morph.ts gives for the same
 * choice: widening a core module's surface to share six lines would
 * couple two files that otherwise share nothing.
 *
 * ═══════════════════════════════════════════════════════════════════
 * THE DASH COUNT IS FIXED AT COMPOSE, AND THE LATTICE IS NOT
 * ═══════════════════════════════════════════════════════════════════
 *
 * This is the one real constraint, and it shapes the whole class.
 *
 * The host binds one ribbon per `Line` ONCE, walking `holon.parts` at
 * mount (three-host.ts `attach`). A holon cannot gain or lose children
 * per frame. But a shrinking mesh needs FEWER dashes: measured on this
 * very pair, deck 12→13's connections carry 22, 18, 44, 46 dashes on
 * slide 12 and 15, 12, 29, 31 on slide 13 — the lattice loses a third
 * of its dots as the tableau contracts, because the period is fixed in
 * slide units and the line gets shorter.
 *
 * So the count is allocated for the LONGEST the path gets across the
 * window (`maxDashes` below walks the completion range at construction),
 * and a dash whose slot has fallen off the shortened curve derives an
 * EMPTY polyline. The host handles that explicitly — sync() passes an
 * emptied derived polyline straight through so the ribbon empties too
 * — so a surplus dash paints nothing rather than smearing a stale
 * segment. Nothing is drawn that the lattice does not currently reach.
 *
 * ═══════════════════════════════════════════════════════════════════
 * PURITY: THE GEOMETRY AT t IS A FUNCTION OF (BOXES, t)
 * ═══════════════════════════════════════════════════════════════════
 *
 * `completion` is the only time-varying input, and every dash's polyline
 * is a pure function of it and the two pairs' four boxes. Nothing
 * accumulates frame to frame: the memo is a cache keyed on the inputs,
 * not a state. Scrubbing backwards, or sampling t out of order, gives
 * the identical frame — which the scrub test pins, and which is what
 * `Timeline`'s f(t) contract requires of anything derived.
 *
 * The endpoint box at completion u is the pair's own box lerped under
 * the SAME ease the glide runs on (`smooth`, passed in), so the line's
 * ends track the icons rather than drifting against them. Passing the
 * ease in rather than importing it keeps this module free of
 * `src/transitions.ts` and lets a test drive it linearly.
 */

/** A box interpolated between two states — the endpoint at completion u. */
export const lerpBox = (a: SlideBox, b: SlideBox, u: number): SlideBox => ({
  x: a.x + (b.x - a.x) * u,
  y: a.y + (b.y - a.y) * u,
  w: a.w + (b.w - a.w) * u,
  h: a.h + (b.h - a.h) * u,
})

/**
 * An endpoint that MOVES: the target as it is on each page, plus the
 * outline that travels with it.
 *
 * The outline is carried on the A side only and transformed by the
 * similarity taking A's box onto the interpolated one — rather than
 * interpolated point-by-point against B's outline. That is deliberate
 * and it is the same claim `Transitions.ts` makes about the glide
 * itself: a matched pair is ONE object being resized, not two shapes
 * morphing, and its 107 measured matches are isotropic within 0.4%. So
 * the silhouette the line clips against is A's, scaled — which is
 * exactly the shape on screen mid-glide, because that IS what the glide
 * draws.
 */
export interface GlidingTarget {
  id: string
  /** The endpoint's box on the outgoing page. */
  from: SlideBox
  /** The endpoint's box on the incoming page. */
  to: SlideBox
  /** The outgoing page's silhouette, in canvas coordinates. */
  outline: readonly (readonly SlidePoint[])[]
}

/** The `ConnectTarget` a `GlidingTarget` presents at completion u. */
export const targetAt = (t: GlidingTarget, u: number): ConnectTarget => {
  const box = lerpBox(t.from, t.to, u)
  // The similarity taking the A box onto the interpolated one, applied
  // to A's own silhouette. Degenerate A boxes (a zero-width rule) fall
  // back to a pure translation, which is the only sane reading.
  const sx = t.from.w > 1e-9 ? box.w / t.from.w : 1
  const sy = t.from.h > 1e-9 ? box.h / t.from.h : 1
  const outline = t.outline.map((sub) =>
    sub.map((p) => ({
      x: box.x + (p.x - t.from.x) * sx,
      y: box.y + (p.y - t.from.y) * sy,
    })),
  )
  return { id: t.id, box, outline }
}

/** What a `GlidingConnection` needs to re-derive itself at any u. */
export interface GlidingSpec {
  from: GlidingTarget
  to: GlidingTarget
  /** The stored bow, as a fraction of the chord — see `midAt`. */
  bow?: { along: number; across: number }
  outset?: { from?: number; to?: number }
  /** Dash length and period, in SLIDE units (converted on the way out). */
  dash: number
  period: number
}

/**
 * The bow's middle point at completion u, transferred onto the current
 * chord.
 *
 * The same construction `Slides.ts` performs once at compose time, said
 * again per frame because the chord it is transferred onto is now
 * moving. Storing the bow as a FRACTION of the chord rather than a
 * position is what makes that possible at all — and it is the reading
 * `Slides.ts` already derived for the static case, where the stored
 * frame is stale and an absolute middle point lands off the line.
 */
export const midAt = (
  a: SlidePoint,
  b: SlidePoint,
  bow: { along: number; across: number },
): SlidePoint => {
  const vx = b.x - a.x
  const vy = b.y - a.y
  return {
    x: a.x + vx * bow.along + -vy * bow.across,
    y: a.y + vy * bow.along + vx * bow.across,
  }
}

/** The connection's clipped path at completion u, in SLIDE units. */
export const glidingPathAt = (spec: GlidingSpec, u: number): SlidePoint[] => {
  const from = targetAt(spec.from, u)
  const to = targetAt(spec.to, u)
  const mid = spec.bow
    ? midAt(boxCentre(from.box), boxCentre(to.box), spec.bow)
    : undefined
  return connectionPath(from, to, mid, spec.outset).points
}

/** The dash runs at completion u, in SLIDE units. */
export const glidingDashesAt = (spec: GlidingSpec, u: number): SlidePoint[][] => {
  const points = glidingPathAt(spec, u)
  if (points.length < 2) return []
  return spec.dash > 0 && spec.period > 0
    ? dashAlong(points, spec.dash, spec.period)
    : [points]
}

/**
 * The most dashes this connection ever needs across the window.
 *
 * Sampled rather than reasoned about, because the path length is not
 * monotonic in u in general — two endpoints can approach and then
 * separate — so no closed form is available and the honest answer is to
 * look.
 *
 * WHAT IS SAMPLED IS THE LENGTH, NOT THE LATTICE, and that is a
 * performance decision with a measured price behind it. Laying the full
 * dash lattice at every sample means clipping the curve against two
 * 166-point silhouettes and trimming a polyline per dot, thirty-three
 * times over, for every line in the mesh: in the browser that put deck
 * 12→13's scene construction at **31.4 s**, past the harness's own 30 s
 * navigation limit — the scene did not hang, it was genuinely that slow.
 * The dash COUNT is `ceil(length / period)` and needs only the length,
 * which is one `connectionPath` walk with no trimming, so sampling the
 * cheap quantity and converting gives the identical bound for a fraction
 * of the work.
 *
 * The count is rounded UP and then given one further slot of headroom.
 * That is not padding for its own sake: the lattice starts at the `from`
 * clip and runs (module header), so a length that grows by a hair past a
 * period boundary gains a dot, and a bound that was exactly tight would
 * clip it. An extra slot costs one empty polyline, which the host draws
 * as nothing; one too few would visibly truncate the mesh.
 *
 * EIGHT SAMPLES, and the headroom is why that is enough. Both endpoints
 * travel affinely in u, so the chord length is smooth and slowly varying
 * — it has no oscillation for a fine grid to catch that a coarse one
 * misses. Checked against a 200-step walk over all thirty of deck
 * 12→13's lines, eight samples miss the true peak count on NONE of them
 * and the allocated slack is exactly 1 on every line: the bound is tight
 * and correct, not merely safe. The cost mattered — this runs per line
 * at scene construction, and each sample is a full clip against two
 * silhouettes.
 */
export const maxDashes = (spec: GlidingSpec, steps = 8): number => {
  if (!(spec.dash > 0) || !(spec.period > 0)) {
    // A solid line is one run whenever it has any geometry at all.
    for (let i = 0; i <= steps; i++) {
      if (glidingPathAt(spec, i / steps).length >= 2) return 1
    }
    return 0
  }
  let longest = 0
  for (let i = 0; i <= steps; i++) {
    const len = polylineLength(glidingPathAt(spec, i / steps))
    if (len > longest) longest = len
  }
  if (longest <= 0) return 0
  return Math.ceil(longest / spec.period) + 1
}

/**
 * Install a pull-based `points` accessor on a Line: `compute` runs only
 * when `sourceKey` changes, and the memo is what every reader sees.
 *
 * The idiom `curves.ts` and `Morph.ts` both carry, written out a third
 * time for the reason Morph.ts states about the second: it is six lines,
 * and exporting it would couple modules that otherwise share nothing.
 */
const derivePoints = (
  line: Line,
  sourceKey: () => readonly number[],
  compute: () => Vec3Like[],
): void => {
  let key: readonly number[] | undefined
  let memo: Vec3Like[] = []
  Object.defineProperty(line, "points", {
    configurable: true,
    enumerable: true,
    get(): Vec3Like[] {
      const next = sourceKey()
      if (!key || key.length !== next.length || next.some((v, i) => v !== key![i])) {
        key = next
        memo = compute()
      }
      return memo
    },
    set(_v: Vec3Like[]) {},
  })
}

/**
 * A connection line re-derived per frame between two gliding endpoints.
 *
 * Drives one param, `completion`: 0 is the outgoing page's geometry and
 * 1 the incoming page's, and every dash's polyline is a pure function of
 * it. See the long header above for the dash-count constraint, the
 * purity contract, and why this is a class rather than a flag.
 */
export class GlidingConnection extends Holon {
  /** 0 = the `from` page's geometry, 1 = the `to` page's. */
  completion = completion(0)

  tint = color(WHITE)
  stroke = length(1)
  override opacity = completion(1)

  /** One Line per dash slot, allocated for the longest the path gets. */
  dashes: Line[] = []

  /** Slide→world scale, so the derivation can emit world coordinates. */
  worldScale = 1

  /** The ease the glide runs on — identity by default, for tests. */
  ease: (u: number) => number = (u) => u

  // Held off the field scan: this is plain data the derivation reads,
  // not a Param and not a part.
  private spec!: GlidingSpec

  constructor(spec: GlidingSpec, overrides: Overrides = {}) {
    super(overrides)
    this.spec = spec
  }

  /**
   * The dash runs at the CURRENT completion, in slide units — memoized
   * per completion value.
   *
   * THE MEMO IS PER LINE, NOT PER DASH, and that is a performance fact
   * with teeth. The whole lattice comes out of ONE `connectionPath` walk
   * (clip the curve against two 166-point silhouettes, then lay dashes
   * along it), so a per-dash derivation would repeat that walk once per
   * dot — twenty-two times over for a line carrying twenty-two dots, and
   * the host reads every dash's `points` every frame through `shapeKey`.
   * Measured, that was 82 ms per frame for this one mesh; sharing the
   * walk brings it to a few. The memo is still a pure cache keyed on the
   * completion, so nothing about the scrub contract changes.
   */
  runsNow(): SlidePoint[][] {
    const u = this.completion.value
    if (this.memoAt !== u) {
      this.memoAt = u
      this.memo = glidingDashesAt(this.spec, this.ease(u))
    }
    return this.memo
  }

  private memoAt = Number.NaN
  private memo: SlidePoint[][] = []

  protected override compose(): void {
    const n = maxDashes(this.spec)
    for (let i = 0; i < n; i++) {
      const line = this.add(
        new Line({
          tint: this.tint,
          stroke: this.stroke,
          opacity: this.opacity,
        }),
      )
      derivePoints(
        line,
        // The completion is the only time-varying input; the boxes are
        // construction constants. Keying on it alone is what makes the
        // memo a cache rather than a state.
        () => [this.completion.value],
        () => {
          const run = this.runsNow()[i]
          if (!run) return []
          return run.map((p) => {
            const w = this.toWorld(p)
            return { x: w.x, y: w.y, z: 0 }
          })
        },
      )
      this.dashes.push(line)
    }
  }

  /** Slide point → world, the same flip `slidePointToWorld` performs. */
  private toWorld(p: SlidePoint): { x: number; y: number } {
    return { x: (p.x - 960) * this.worldScale, y: -(p.y - 540) * this.worldScale }
  }

  /** Everything that actually draws — what an opacity ramp must reach. */
  drawn(): Line[] {
    void this.parts
    return this.dashes
  }
}

/** A `Group` of Connections, so a mesh can be moved as one thing. */
export const meshGroup = (members: readonly Connection[]): Group =>
  new Group({ members: [...members] })

export type { Color }
