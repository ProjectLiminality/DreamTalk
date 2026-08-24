/**
 * The vocabulary — Layer-1 primitive holons.
 * Geometry construction arrives with the renderer (PLAN Chapter 4);
 * here each part declares its parameters, which is already enough for
 * timelines, binding, and the editor's parameter panel.
 */

import { Holon } from "../holon"
import { color, length, angle, integer, completion, scalar, bool } from "../params"
import { eased, restage, together, type Anim, type Windowed } from "../anim"
import { ease } from "../timeline"
import { WHITE, BLACK, RED, PI, TAU } from "../constants"

/** A plain point — polyline data, not a param. */
export interface Vec3Like {
  x: number
  y: number
  z: number
}

/**
 * Base of all stroke-rendered primitives: a stroke color and a stroke
 * width. Width is in SCREEN PIXELS (worldUnits: false in the host) —
 * the 2021 C4D Sketch & Toon look draws constant-pixel-width lines
 * regardless of depth (see refs/video-01/frame_020.png: the grid stays
 * uniformly thin into the distance). Default 3px reads right at 1080p;
 * the 720p reference lines are ~2px.
 *
 * Two windows govern visibility along the stroke's arc length:
 * `creation` is the draw front (0 → 1 draws on), `erasure` is the
 * consume front (0 → 1 eats the stroke from its start, in draw
 * direction). UnDraw retracts the draw front; Erase advances the
 * consume front — the video-01 asymmetry (grids sweep away, plain
 * un-creates retract).
 */
export class Stroke extends Holon {
  tint = color(WHITE)
  stroke = length(3)
  /** Front-to-back consume front (the Erase verb) — 0 = nothing eaten. */
  erasure = completion(0)
  /**
   * Where along a CLOSED outline the pen starts, as a fraction of its
   * perimeter. C4D's spline primitives each carry their own start point,
   * and Sketch & Toon draws from it — so a circle that begins its arc at
   * 1/8 of the way round is not a stylistic choice but the primitive's
   * own construction. Ignored by open strokes (a Line has a real start).
   */
  drawStart = completion(0)
  /**
   * Draw the outline the other way round. pydeation builds its primitives
   * in the XZ plane; seen from a camera that looks along -Z at our XY
   * plane, that winding reads REVERSED — which is why every video-01
   * circle and rectangle draws clockwise on screen while ours, built
   * natively in XY, run counterclockwise. A winding flag rather than a
   * second set of generators: same geometry, opposite pen direction.
   *
   * On an OPEN stroke (a Line) the same flag says the same thing — the
   * pen enters from the polyline's LAST point instead of its first — and
   * it carries one further consequence, because a Line has two distinct
   * ends and the two fronts do not share one:
   *
   *   the reversed stroke is ANCHORED AT ITS LAST POINT.
   *   Draw grows backward from that anchor; Erase eats forward from the
   *   first point, back towards it. The anchor is the first ink laid
   *   down and the last ink to survive.
   *
   * That is a reading of the reference, not a preference. Scene 08's grid
   * lines are Splines from (pos, 0, -L/2) to (pos, 0, +L/2)
   * (refs/pydeation-legacy/object/custom_objects.py:283-290) and the
   * plane's bank puts the +L/2 end at the TOP of the frame. In
   * refs/video-01/frames5, band x∈[80,200]:
   *
   *   DRAW   f0609 spans screen y 20…457, f0610-f0613 y 20…713
   *          — the top end is fixed, the pen travels DOWN.
   *   ERASE  f0642 y 0…575, f0643 y 0…341, f0644 y 0…95
   *          — the top end is again what survives; the bottom is eaten.
   *
   * Both fronts therefore move relative to the SAME fixed end, and that
   * end is pydeation's LAST point. Unreversed strokes are the mirror
   * statement (anchor at the first point), which is what the framework
   * already did — so this generalises the old behaviour rather than
   * replacing it, and a fully drawn stroke erases identically either way.
   */
  drawReversed = bool(false)
}

/**
 * An OPEN polyline walked from its last point to its first — the open
 * counterpart of `rephasePolyline`'s `reversed` (which only ever applies
 * to closed loops, where a start phase also has to be honoured).
 *
 * Pure, and separate on purpose: a closed loop's reversal has to preserve
 * the start POINT while flipping the direction, an open stroke's simply
 * swaps its ends.
 */
export const reverseOpenPolyline = (points: readonly Vec3Like[]): Vec3Like[] =>
  [...points].reverse()

/**
 * Re-phase a CLOSED polyline so the pen starts `drawStart` of the way
 * around it and walks it in the given direction. Pure — the host's
 * geometry pass and the tests share it.
 *
 * The input's first and last point must coincide (that is what makes it
 * closed); the output keeps that property, so arc-length draw-on still
 * covers the whole outline exactly once. Two properties make this usable
 * as a scene parameter rather than a puzzle:
 *
 *  - phase is measured in ARC LENGTH, not point index, so an unevenly
 *    sampled outline (a rounded rectangle, whose corners carry more
 *    points than its sides) starts where the phase geometrically says;
 *  - phase is measured along the ORIGINAL winding and applied BEFORE the
 *    reversal, so the start POINT is the same place whichever way the pen
 *    then travels — and it does not shift when the sampling density
 *    changes. `drawStart` names a location; `drawReversed` names a
 *    direction; the two are independent.
 */
export const rephasePolyline = (
  points: readonly Vec3Like[],
  drawStart: number,
  reversed: boolean,
): Vec3Like[] => {
  if (points.length < 3) return [...points]
  const first = points[0]!
  const last = points[points.length - 1]!
  const closed =
    Math.abs(first.x - last.x) < 1e-9 &&
    Math.abs(first.y - last.y) < 1e-9 &&
    Math.abs(first.z - last.z) < 1e-9
  if (!closed) return [...points]

  // Drop the duplicated closing point; the loop is cyclic from here on.
  const loop = points.slice(0, -1)
  const n = loop.length
  const dist = (a: Vec3Like, b: Vec3Like): number =>
    Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
  const seg: number[] = []
  let total = 0
  for (let i = 0; i < n; i++) {
    const d = dist(loop[i]!, loop[(i + 1) % n]!)
    seg.push(d)
    total += d
  }
  if (total <= 0) return [...loop, loop[0]!]

  // Walk the ORIGINAL winding to the target arc length; split the
  // segment it lands inside, so the start point is exact.
  const phase = ((drawStart % 1) + 1) % 1
  let target = phase * total
  let i = 0
  while (i < n - 1 && target > seg[i]!) {
    target -= seg[i]!
    i++
  }
  let u = seg[i]! > 0 ? Math.min(1, target / seg[i]!) : 0
  // Snap to a vertex when the phase lands on one, so the walk below never
  // emits the start point twice in a row.
  const EPS = 1e-9
  if (u >= 1 - EPS) {
    i = (i + 1) % n
    u = 0
  } else if (u <= EPS) {
    u = 0
  }
  const a = loop[i]!
  const b = loop[(i + 1) % n]!
  const startPt: Vec3Like =
    u === 0 ? a : { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u }

  // From that point, walk the loop the requested way and close.
  // Forward: startPt, loop[i+1], loop[i+2], … back round to startPt.
  // Backward: startPt, loop[i], loop[i-1], … back round to startPt.
  // On a vertex start the first step would repeat startPt, so skip it.
  const at = (k: number): Vec3Like => loop[((k % n) + n) % n]!
  const onVertex = u === 0
  const steps = onVertex ? n - 1 : n
  const out: Vec3Like[] = [startPt]
  for (let k = 0; k < steps; k++) {
    out.push(reversed ? at(i - k - (onVertex ? 1 : 0)) : at(i + k + 1))
  }
  out.push(startPt)
  return out
}

/** A circle — radius and stroke color. */
export class Circle extends Stroke {
  radius = length(100)
}

/** A square — the founding simplicity (square, not rectangle). */
export class Square extends Stroke {
  size = length(200)
}

/** A regular polygon. */
export class Polygon extends Stroke {
  radius = length(100)
  sides = integer(6)
}

/** A circular arc — radius, startAngle → endAngle (radians, CCW). */
export class Arc extends Stroke {
  radius = length(100)
  startAngle = angle(0)
  endAngle = angle(PI / 2)
}

/**
 * A cylinder along local +Y — the star of the 2021 vocabulary. Defaults
 * radius 50 × height 200 per the source (C4D's own defaults, deliberately
 * matching circle r=50 and rectangle 100×200 in video-01).
 *
 * Its wireframe is entirely view-dependent: the host renders the two cap
 * circles (always full circles — no hidden-line removal, per the 2021
 * look) plus the two mantle silhouette generators computed analytically
 * per frame from the camera position (render/silhouette.ts). Draw-on runs
 * the four strokes sequentially, arc-length-proportioned, like Sketch &
 * Toon's "single" stroke method: top cap → bottom cap → the two lines.
 */
export class Cylinder extends Stroke {
  radius = length(50)
  height = length(200)
}

/** An invisible locator — pure transform. */
export class Null extends Holon {}

/**
 * A Null that adopts holons built elsewhere — pydeation's `Group`.
 *
 * The ordinary way to own parts is to declare them as fields, and that
 * stays the rule. But 2021 scenes routinely build an object at one place
 * and then wrap it so a transform applies to the WRAPPER's pivot rather
 * than the object's own — `Group(Eye(x=300))` turned by `b` orbits the
 * eye around the world origin instead of spinning it where it stands.
 * That is a real compositional act, not a naming convenience: the group
 * contributes a frame, and the parts keep their own identities (a scene
 * still animates `eye.tint` directly, which is why they are constructed
 * first and handed over rather than declared inside).
 *
 * `members` are adopted through the same dynamic-part path `compose()`
 * uses, so they parent, walk, and animate exactly like declared fields.
 */
export class Group extends Null {
  members: Holon[] = []

  protected override compose(): void {
    for (const member of this.members) this.add(member)
  }
}

/**
 * An open polyline — the workhorse behind axes, grids, sight lines and
 * the Eye's lids. `points` is data (local space); optional S&T-style
 * arrowheads render as small filled triangles riding the endpoints
 * (they appear as the draw front arrives, vanish as the erase front
 * consumes their end).
 */
export class Line extends Stroke {
  points: Vec3Like[] = []
  arrowStart = bool(false)
  arrowEnd = bool(false)
  /**
   * ONE Sketch & Toon pixel unit, in rendered pixels — the scale the
   * arrowhead is sized in. S&T states the cap in its own fields
   * (ENDCAP_WIDTH 7, ENDCAP_HEIGHT 5, object.py:215-218), in the pixel
   * units of scene.py's 700-line reference height, so this is
   * frameHeight / 700 and NOT a multiple of `stroke`: the cap is
   * untouched by the 0.6 distance-thickness attenuation that the
   * THICKNESS field carries. Default 1.029 = 720/700, the reference
   * frame height; a scene rendering at 1080p sets 1.543.
   *
   * See the arrowPolygon header in render/three-host.ts for the
   * measurement this is fitted to (f0428: a 10.9 x 14.95px head).
   */
  arrowSize = length(720 / 700)
}

/**
 * A rectangle, width × height, with the video-01 rounding morph:
 * `rounding` 0 → 1 maps to corner radius min(w,h)/2 · rounding
 * (rounding 1 on a square is literally a circle — the "cornered
 * circle" of Scene03). Draws from its bottom center, counterclockwise
 * (S&T "bottom_top" stroke order). Default 100 × 200 RED per the
 * vocabulary report — the canonical anti-thesis shape.
 */
export class Rectangle extends Stroke {
  width = length(100)
  height = length(200)
  rounding = completion(0)
  override tint = color(RED)
}

/**
 * An ellipse — radiusX × radiusY. `filled: true` renders it as a flat
 * triangulated fill (the sanctioned entry of fills into the host: the
 * Eye's iris and pupil); its `creation` then drives the fill's fade-in
 * (Fill semantics) instead of a draw-on. Unfilled, it is an ordinary
 * stroke.
 */
export class Ellipse extends Stroke {
  radiusX = length(100)
  radiusY = length(50)
  filled = bool(false)
}

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

/**
 * The domino stagger — pydeation's Domino timing algebra, ported
 * verbatim (animation/animator.py). N children get sub-windows of the
 * span whose midpoints follow an inverse smoothstep (the cascade eases
 * in and out along the line set) and whose durations breathe with a
 * cosine (globalSmoothing). Windows are shifted to start at 0, rescaled
 * to end near 1, then clamped to [0, 1].
 */
export const dominoWindows = (
  count: number,
  relDuration = 0.3,
  globalSmoothing = 0.5,
): [number, number][] => {
  if (count <= 0) return []
  const invSmoothstep = (x: number) => 0.5 - Math.sin(Math.asin(1.0 - 2.0 * x) / 3.0)
  const windows: [number, number][] = []
  for (let i = 0; i < count; i++) {
    const mid = invSmoothstep((1 / 2) * (1 / count) + i / count)
    const dur = relDuration * (1 + globalSmoothing * Math.cos((TAU * i) / count))
    windows.push([mid - dur / 2, mid + dur / 2])
  }
  const shift = Math.abs(windows[0]![0])
  for (const w of windows) {
    w[0] += shift
    w[1] += shift
  }
  const rescale = 1 + (1 - windows[windows.length - 1]![1])
  for (const w of windows) {
    w[0] = Math.min(1, Math.max(0, w[0] * rescale))
    w[1] = Math.min(1, Math.max(0, w[1] * rescale))
  }
  return windows
}

/**
 * A group of strokes drawing as a domino cascade over one span.
 *
 * `restage`, not a bare window, and the reason is in the pydeation source
 * rather than in any frame. Each child's `Animation` is constructed by
 * `CObject.animate` with `rel_run_time = (rel_start_point, rel_end_point)
 * = (0, 1)`, so `rel_duration` is 1 (animation.py:10-20). `Domino` then
 * squeezes it into its window by `rescale_run_time`, which rewrites
 * `rel_run_time` and **leaves `rel_duration` at 1** (animation.py:29-44)
 * — and `rel_duration` is exactly what `play()` multiplies the run time
 * by when it sets the keyframe tangents (`run_time=run_time *
 * rel_duration`, scene.py:990, feeding `smoothing * run_time` into
 * `SetTimeLeft/Right`, scene.py:785-786).
 *
 * So a grid line occupying 0.3 of a 3s draw carries a tangent stated
 * against the whole 3s: a normalized smoothing of 0.25/0.3 = 0.83,
 * clamped at 1 by `smoothingFor`. The cascade's children are therefore
 * far more eased than their windows alone would suggest — many lines
 * visibly *started* and creeping, rather than a few lines racing. That
 * is what the reference shows (video-01 S08 f0608: 18 grid lines carry
 * ink where a 0.25-eased cascade puts 14), and it is a property of the
 * 2021 machinery, not a fit.
 */
const cascade = (lines: readonly Stroke[]): Anim => {
  const windows = dominoWindows(lines.length)
  return together(
    ...lines.map((line, i) =>
      restage(line.creation.sequence(0, 1), windows[i]![0], windows[i]![1]),
    ),
  )
}

/** The same cascade running the erase front instead of the draw front. */
const consume = (lines: readonly Stroke[]): Anim => {
  const windows = dominoWindows(lines.length)
  return together(
    ...lines.map((line, i) =>
      restage(line.erasure.sequence(0, 1), windows[i]![0], windows[i]![1]),
    ),
  )
}

/**
 * Axes with optional grid and ticks — generated entirely from Line
 * parts (symbolic holon: the CPU decides what exists; compose() runs
 * once, so extents/spacing are construction-time). Faithful to the
 * pydeation construction (custom_objects.py): per axis letter in
 * `mode`, one arrowed axis line plus — per `drawGrid` — grid lines of
 * `gridLineLength` centered on the axis at every `gridSpacing` from
 * start to end (0 and the extremes excluded), at half the axes' stroke
 * width, in `gridTint`. In DreamTalk's world the scene plane is XY:
 * an "xy" grid is x-positioned lines running in y plus y-positioned
 * lines running in x (rotate the holon for walls and floors).
 */
export class Axes extends Stroke {
  mode = "xy"
  xStart = scalar(-200)
  xEnd = scalar(200)
  yStart = scalar(-200)
  yEnd = scalar(200)
  zStart = scalar(-200)
  zEnd = scalar(200)
  gridSpacing = length(30)
  gridLineLength = length(1000)
  drawGrid = bool(false)
  drawTicks = bool(false)
  arrowEnd = bool(true)
  /** Forwarded to each axis Line — see Line.arrowSize. */
  arrowSize = length(720 / 700)
  gridTint = color(WHITE)

  axisLines: Line[] = []
  gridGroups: Line[][] = []
  tickGroups: Line[][] = []

  protected override compose(): void {
    const spacing = this.gridSpacing.value
    const halfGrid = this.gridLineLength.value / 2
    const extents: Record<string, [number, number]> = {
      x: [this.xStart.value, this.xEnd.value],
      y: [this.yStart.value, this.yEnd.value],
      z: [this.zStart.value, this.zEnd.value],
    }
    // Local frame per axis: its direction, and the in-plane perpendicular
    // its grid lines and ticks run along (pydeation's XZ plane → our XY).
    const frames: Record<string, { dir: Vec3Like; perp: Vec3Like }> = {
      x: { dir: { x: 1, y: 0, z: 0 }, perp: { x: 0, y: 1, z: 0 } },
      y: { dir: { x: 0, y: 1, z: 0 }, perp: { x: 1, y: 0, z: 0 } },
      z: { dir: { x: 0, y: 0, z: 1 }, perp: { x: 1, y: 0, z: 0 } },
    }
    const at = (v: Vec3Like, k: number): Vec3Like => ({ x: v.x * k, y: v.y * k, z: v.z * k })
    const sum = (a: Vec3Like, b: Vec3Like): Vec3Like => ({
      x: a.x + b.x,
      y: a.y + b.y,
      z: a.z + b.z,
    })
    // Grid positions at integer multiples of spacing, most negative
    // first, excluding 0 and the outermost multiple (pydeation's
    // range(1, round(extent / distance)) on both sides).
    const positions = (start: number, end: number): number[] => {
      const out: number[] = []
      // Round the magnitudes so both sides treat half-spacings alike.
      const negCount = Math.round(Math.abs(start) / spacing)
      const posCount = Math.round(end / spacing)
      for (let i = negCount - 1; i >= 1; i--) out.push(-i * spacing)
      for (let i = 1; i < posCount; i++) out.push(i * spacing)
      return out
    }

    for (const axis of this.mode) {
      const frame = frames[axis]
      const extent = extents[axis]
      if (!frame || !extent) continue
      const [start, end] = extent
      this.axisLines.push(
        this.add(
          new Line({
            points: [at(frame.dir, start), at(frame.dir, end)],
            tint: this.tint,
            stroke: this.stroke,
            arrowEnd: this.arrowEnd.value,
            arrowSize: this.arrowSize,
          }),
        ),
      )
      if (this.drawGrid.value) {
        const group: Line[] = []
        for (const pos of positions(start, end)) {
          group.push(
            this.add(
              new Line({
                points: [
                  sum(at(frame.dir, pos), at(frame.perp, -halfGrid)),
                  sum(at(frame.dir, pos), at(frame.perp, halfGrid)),
                ],
                tint: this.gridTint,
                stroke: this.stroke.times(0.5),
              }),
            ),
          )
        }
        this.gridGroups.push(group)
      }
      if (this.drawTicks.value) {
        const group: Line[] = []
        const tickHalf = 5 // pydeation tick_length 10, centered
        const posCount = Math.round(end / spacing)
        const negCount = Math.round(Math.abs(start) / spacing)
        for (let i = -(negCount - 1); i < posCount; i++) {
          group.push(
            this.add(
              new Line({
                points: [
                  sum(at(frame.dir, i * spacing), at(frame.perp, -tickHalf)),
                  sum(at(frame.dir, i * spacing), at(frame.perp, tickHalf)),
                ],
                tint: this.tint,
                stroke: this.stroke,
              }),
            ),
          )
        }
        this.tickGroups.push(group)
      }
    }
  }

  /** CreateAxes: axes draw 0→80%, each grid group dominoes 0→100%, ticks 30→100%. */
  override createAnim(): Anim {
    void this.parts // ensure compose() has generated the line set
    const hasSub = this.gridGroups.length > 0 || this.tickGroups.length > 0
    const items: Windowed[] = [
      [together(...this.axisLines.map((l) => l.creation.sequence(0, 1))), 0, hasSub ? 0.8 : 1],
    ]
    for (const group of this.gridGroups) items.push([cascade(group), 0, 1])
    for (const group of this.tickGroups) items.push([cascade(group), 0.3, 1])
    return together(...items)
  }

  /**
   * UnCreateAxes: built on Erase, not UnDraw (animator.py:881-912) — the
   * axes are consumed from their start over the whole span while the tick
   * dominoes are eaten inside the first 70% of it, so the lattice sweeps
   * away ahead of the line rather than retracting back along it.
   */
  override unCreateAnim(): Anim {
    void this.parts // ensure compose() has generated the line set
    const items: Windowed[] = [
      [together(...this.axisLines.map((l) => l.erasure.sequence(0, 1))), 0, 1],
    ]
    for (const group of this.gridGroups) items.push([consume(group), 0, 1])
    for (const group of this.tickGroups) items.push([consume(group), 0, 0.7])
    return together(...items)
  }
}

/**
 * The rounded-rectangle outline as a polyline, from bottom center,
 * counterclockwise; corners become arc fans when rounding > 0.
 * Pure — shared by the host's geometry pass and the tests.
 */
export const rectanglePolyline = (
  width: number,
  height: number,
  rounding: number,
  cornerSegments = 8,
): Vec3Like[] => {
  const w = width / 2
  const h = height / 2
  const r = Math.min(w, h) * Math.min(1, Math.max(0, rounding))
  const pts: Vec3Like[] = []
  const push = (x: number, y: number) => pts.push({ x, y, z: 0 })
  if (r <= 0) {
    push(0, -h)
    push(w, -h)
    push(w, h)
    push(-w, h)
    push(-w, -h)
    push(0, -h)
    return pts
  }
  const arc = (cx: number, cy: number, a0: number, a1: number) => {
    for (let i = 1; i <= cornerSegments; i++) {
      const a = a0 + ((a1 - a0) * i) / cornerSegments
      push(cx + r * Math.cos(a), cy + r * Math.sin(a))
    }
  }
  push(0, -h)
  push(w - r, -h)
  arc(w - r, -h + r, -PI / 2, 0)
  push(w, h - r)
  arc(w - r, h - r, 0, PI / 2)
  push(-w + r, h)
  arc(-w + r, h - r, PI / 2, PI)
  push(-w, -h + r)
  arc(-w + r, -h + r, PI, (3 * PI) / 2)
  push(0, -h)
  return pts
}

/**
 * The cross marker — video-01's contact point (§2.9 of the vocabulary
 * report; `custom_objects.py:148`).
 *
 * pydeation builds it as four splines of length 200 running OUTWARD from
 * the origin (`fromCenter`, the variant Scene 02 uses, so each arm draws
 * from the middle out and a Glimpse blooms the mark open) or as two
 * crossing splines through it. `size` is the arm length in world units —
 * the source states it as a scale on the 200-unit arm, which is a
 * construction detail, not a parameter anybody would want to turn.
 *
 * `b` (inherited) does the source's 45-degree turn: the marks in
 * Scene 02 are `Cross(h=PI/4, …)`, a legacy heading, which is our bank.
 */
export class Cross extends Stroke {
  size = length(6)
  fromCenter = bool(true)

  arms: Line[] = []

  protected override compose(): void {
    const s = this.size.value
    const ends: [Vec3Like, Vec3Like][] = this.fromCenter.value
      ? [
          [{ x: 0, y: 0, z: 0 }, { x: 0, y: s, z: 0 }],
          [{ x: 0, y: 0, z: 0 }, { x: s, y: 0, z: 0 }],
          [{ x: 0, y: 0, z: 0 }, { x: 0, y: -s, z: 0 }],
          [{ x: 0, y: 0, z: 0 }, { x: -s, y: 0, z: 0 }],
        ]
      : [
          [{ x: 0, y: -s, z: 0 }, { x: 0, y: s, z: 0 }],
          [{ x: -s, y: 0, z: 0 }, { x: s, y: 0, z: 0 }],
        ]
    for (const [a, b] of ends) {
      this.arms.push(this.add(new Line({ points: [a, b], tint: this.tint, stroke: this.stroke })))
    }
  }
}

/**
 * Split a segment into a dash pattern — the on-runs of a dotted line,
 * in the segment's own space. Pure, so the tests and the holon share it.
 *
 * The pattern always STARTS with an on-run at the segment's start and is
 * truncated (never stretched) at its end, which is how Sketch & Toon's
 * line-style presets lay a pattern down: the last dash is whatever fits.
 */
export const dashRuns = (
  from: Vec3Like,
  to: Vec3Like,
  dash: number,
  gap: number,
): [Vec3Like, Vec3Like][] => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dz = to.z - from.z
  const total = Math.hypot(dx, dy, dz)
  const period = dash + gap
  if (total <= 0 || dash <= 0 || period <= 0) return [[from, to]]
  const at = (d: number): Vec3Like => {
    const u = d / total
    return { x: from.x + dx * u, y: from.y + dy * u, z: from.z + dz * u }
  }
  const runs: [Vec3Like, Vec3Like][] = []
  for (let d = 0; d < total - 1e-9; d += period) {
    runs.push([at(d), at(Math.min(total, d + dash))])
  }
  return runs
}

/**
 * A dotted polyline — Sketch & Toon's `line_style="dotted"`, which
 * Scene 02's sin and cos droppers wear.
 *
 * The dash pattern is geometry here, not shading: the holon composes one
 * Line per on-run, which keeps the ribbon pipeline untouched and makes
 * the pattern editable the way every other construction is. `dash` and
 * `gap` are WORLD lengths — the 2021 preset states them in the same
 * screen pixel units the thickness uses, so a scene that wants the
 * reference's exact rhythm converts once, at its own camera scale.
 *
 * Draw-on runs the dashes in order, each over its own share of the
 * span, so the pen still travels the line from one end to the other.
 */
export class DottedLine extends Stroke {
  points: Vec3Like[] = []
  dash = length(2.3)
  gap = length(3.2)

  dashes: Line[] = []

  protected override compose(): void {
    for (let i = 0; i < this.points.length - 1; i++) {
      for (const [a, b] of dashRuns(
        this.points[i]!,
        this.points[i + 1]!,
        this.dash.value,
        this.gap.value,
      )) {
        this.dashes.push(
          this.add(new Line({ points: [a, b], tint: this.tint, stroke: this.stroke })),
        )
      }
    }
  }

  override createAnim(): Anim {
    void this.parts
    const n = this.dashes.length
    if (n === 0) return { tracks: [] }
    return together(
      ...this.dashes.map(
        (d, i): Windowed => [d.creation.sequence(0, 1), i / n, (i + 1) / n],
      ),
    )
  }

  override unCreateAnim(): Anim {
    void this.parts
    const n = this.dashes.length
    if (n === 0) return { tracks: [] }
    return together(
      ...this.dashes.map((d, i): Windowed => [d.creation.to(0), 1 - (i + 1) / n, 1 - i / n]),
    )
  }
}
