/**
 * The vocabulary — Layer-1 primitive holons.
 * Geometry construction arrives with the renderer (PLAN Chapter 4);
 * here each part declares its parameters, which is already enough for
 * timelines, binding, and the editor's parameter panel.
 */

import { Holon } from "../holon"
import { color, length, angle, integer, completion, scalar, bool } from "../params"
import { together, type Anim, type Windowed } from "../anim"
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
   */
  drawReversed = bool(false)
}

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
export class Eye extends Stroke {
  opening = completion(1)
  lidTop = new Line({
    points: [{ x: 0, y: 0, z: 0 }, { x: 230, y: 0, z: 0 }],
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

  /** CreateEye: pupil fills instantly, lids+eyeball draw 0→50%, iris fills 30→100%. */
  override createAnim(): Anim {
    return together(
      [this.pupil.creation.sequence(0, 1), 0, 0.01],
      [
        together(
          this.lidTop.creation.sequence(0, 1),
          this.lidBottom.creation.sequence(0, 1),
          this.eyeball.creation.sequence(0, 1),
        ),
        0,
        0.5,
      ],
      [this.iris.creation.sequence(0, 1), 0.3, 1],
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

/** A group of strokes drawing as a domino cascade over one span. */
const cascade = (lines: readonly Stroke[]): Anim => {
  const windows = dominoWindows(lines.length)
  return together(
    ...lines.map(
      (line, i): Windowed => [line.creation.sequence(0, 1), windows[i]![0], windows[i]![1]],
    ),
  )
}

/** The same cascade running the erase front instead of the draw front. */
const consume = (lines: readonly Stroke[]): Anim => {
  const windows = dominoWindows(lines.length)
  return together(
    ...lines.map(
      (line, i): Windowed => [line.erasure.sequence(0, 1), windows[i]![0], windows[i]![1]],
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
