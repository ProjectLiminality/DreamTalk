/**
 * SVG → polyline. The importer behind the `Sketch` holon.
 *
 * "SVG is what you get when a 3D scene happens to be flat and
 * orthographic" (TASTE.md) — so an .svg is not a foreign format to be
 * rasterized, it is a set of strokes stated in a different frame. This
 * module does the frame change and nothing else: parse the path
 * mini-language, flatten its curves to polylines, apply the document's
 * own transforms, flip y, center, and scale to a caller-given height.
 * What comes out is plain `Vec2[][]` — the same polyline data a `Line`
 * has always taken, so an imported sketch renders through the identical
 * ribbon path as every other stroke. There is no SVG renderer here and
 * there must never be one.
 *
 * The contract is pydeation's `SVG(file_name, line_only=…)`
 * (refs/pydeation-legacy/object/vector_graphics.py:31): load, keep each
 * subpath a separate spline, center on the origin, scale to a target
 * size. That loader delegated to C4D's importer and to "Center Axis to";
 * this states the same two acts explicitly.
 *
 * Pure and dependency-free by design — the parser is a few hundred lines
 * because the `d` grammar is small, and hand-rolling it keeps the output
 * deterministic, which the checked-in asset modules depend on.
 */

/** A point in the flattened plane. Polyline data, not a param. */
export interface Vec2 {
  x: number
  y: number
}

/**
 * An affine 2D transform, row-major as SVG states it:
 *   x' = a·x + c·y + e
 *   y' = b·x + d·y + f
 */
export interface Matrix {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

/** m ∘ n — apply `n` first, then `m`. */
export const multiply = (m: Matrix, n: Matrix): Matrix => ({
  a: m.a * n.a + m.c * n.b,
  b: m.b * n.a + m.d * n.b,
  c: m.a * n.c + m.c * n.d,
  d: m.b * n.c + m.d * n.d,
  e: m.a * n.e + m.c * n.f + m.e,
  f: m.b * n.e + m.d * n.f + m.f,
})

export const applyMatrix = (m: Matrix, p: Vec2): Vec2 => ({
  x: m.a * p.x + m.c * p.y + m.e,
  y: m.b * p.x + m.d * p.y + m.f,
})

/** Axis-aligned bounds of a point set. */
export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** The importer's output: subpaths, whether each closed, and the bounds. */
export interface SvgGeometry {
  /** One polyline per subpath — the individual pen strokes. */
  subpaths: Vec2[][]
  /** Parallel to `subpaths`: did the source end this one with Z? */
  closedFlags: boolean[]
  /** Bounds of the emitted points (post-transform, post-fit). */
  bounds: Bounds
  /** Element types encountered but not converted, for the caller to report. */
  skipped: string[]
}

/**
 * Flattening tolerance, in the SVG's own user units: the greatest
 * distance a chord may stray from the true curve.
 *
 * This is a DRAW-ON tolerance, not a silhouette tolerance. The strokes
 * are walked by a pen at constant arc length (O-2's DrawSteady), so what
 * matters is that no chord is long enough for the pen to visibly jump
 * along it, and that the sampling is even enough that arc length is a
 * fair proxy for progress. A quarter user unit is well under a rendered
 * pixel for every asset in the corpus (their viewBoxes run 24 to 4961
 * units against a frame ~1000px tall), and it is coarse enough that
 * david.svg's dense Pixelmator bezier runs do not explode into points
 * that are closer together than the ribbon's own width.
 */
export const FLATTEN_TOLERANCE = 0.25

/**
 * Hard cap on the subdivision of a single curve segment. The adaptive
 * split is depth-limited rather than tolerance-limited in the last
 * resort, so a degenerate control polygon (a cusp, a zero-length
 * segment) terminates instead of recursing forever.
 */
const MAX_SUBDIVISION_DEPTH = 16

/** Points closer than this (user units) are the same point. */
const EPSILON = 1e-9

// ---------------------------------------------------------------------------
// Number + token scanning
// ---------------------------------------------------------------------------

/**
 * A cursor over path data. Strict on purpose: every failure names the
 * character offset, because the assets are machine-generated and a
 * silent mis-parse would show up as geometry that is subtly wrong rather
 * than as an error.
 */
class Scanner {
  private i = 0
  constructor(private readonly src: string) {}

  get offset(): number {
    return this.i
  }

  fail(message: string): never {
    const near = this.src.slice(Math.max(0, this.i - 20), this.i + 20)
    throw new Error(`svg path: ${message} at offset ${this.i} (near "${near}")`)
  }

  /** Whitespace and commas separate tokens and carry no meaning. */
  skipSeparators(): void {
    while (this.i < this.src.length) {
      const c = this.src.charCodeAt(this.i)
      // space, tab, LF, CR, FF, comma
      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 12 || c === 44) this.i++
      else break
    }
  }

  atEnd(): boolean {
    this.skipSeparators()
    return this.i >= this.src.length
  }

  /** The next character if it is a command letter, else null. */
  peekCommand(): string | null {
    this.skipSeparators()
    if (this.i >= this.src.length) return null
    const c = this.src[this.i]!
    return /[MmLlHhVvCcSsQqTtAaZz]/.test(c) ? c : null
  }

  takeCommand(): string {
    const c = this.peekCommand()
    if (c === null) this.fail("expected a command letter")
    this.i++
    return c
  }

  /** True when a number could start here — drives implicit repetition. */
  hasNumber(): boolean {
    this.skipSeparators()
    if (this.i >= this.src.length) return false
    const c = this.src[this.i]!
    return c === "-" || c === "+" || c === "." || (c >= "0" && c <= "9")
  }

  /**
   * One SVG number. The grammar is a restricted float: optional sign,
   * digits with an optional fractional part (either side may be empty,
   * but not both), optional exponent. Notably `.5.5` is TWO numbers, so
   * the scan must stop at the second dot rather than lean on parseFloat.
   */
  takeNumber(): number {
    this.skipSeparators()
    const start = this.i
    const s = this.src
    if (s[this.i] === "-" || s[this.i] === "+") this.i++
    let digits = 0
    while (this.i < s.length && s[this.i]! >= "0" && s[this.i]! <= "9") {
      this.i++
      digits++
    }
    if (s[this.i] === ".") {
      this.i++
      while (this.i < s.length && s[this.i]! >= "0" && s[this.i]! <= "9") {
        this.i++
        digits++
      }
    }
    if (digits === 0) this.fail("expected a number")
    if (s[this.i] === "e" || s[this.i] === "E") {
      const mark = this.i
      this.i++
      if (s[this.i] === "-" || s[this.i] === "+") this.i++
      let expDigits = 0
      while (this.i < s.length && s[this.i]! >= "0" && s[this.i]! <= "9") {
        this.i++
        expDigits++
      }
      // A trailing "e" that is not an exponent belongs to the next token.
      if (expDigits === 0) this.i = mark
    }
    const value = Number(s.slice(start, this.i))
    if (!Number.isFinite(value)) this.fail(`"${s.slice(start, this.i)}" is not a finite number`)
    return value
  }

  /**
   * An arc flag: a single "0" or "1", which may be written with no
   * separator before the next number (`a1 1 0 011 1` is legal).
   */
  takeFlag(): boolean {
    this.skipSeparators()
    const c = this.src[this.i]
    if (c !== "0" && c !== "1") this.fail("expected an arc flag (0 or 1)")
    this.i++
    return c === "1"
  }
}

// ---------------------------------------------------------------------------
// Curve flattening
// ---------------------------------------------------------------------------

/** Perpendicular distance from p to the infinite line through a and b. */
const lineDistance = (p: Vec2, a: Vec2, b: Vec2): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < EPSILON) return Math.hypot(p.x - a.x, p.y - a.y)
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len
}

/**
 * Flatten a cubic bezier by recursive subdivision, appending to `out`
 * (the start point is assumed already present).
 *
 * The flatness test is the standard control-polygon one: a cubic is
 * within tolerance of its chord when both control points are. It is
 * conservative — it never emits a chord that strays further than the
 * tolerance — and because it splits at the midpoint of the PARAMETER it
 * also splits roughly evenly in arc length on the smooth curves this
 * corpus is made of, which is what the draw-on pen wants.
 */
const flattenCubic = (
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  tolerance: number,
  out: Vec2[],
  depth = 0,
): void => {
  if (
    depth >= MAX_SUBDIVISION_DEPTH ||
    (lineDistance(p1, p0, p3) <= tolerance && lineDistance(p2, p0, p3) <= tolerance)
  ) {
    out.push(p3)
    return
  }
  // de Casteljau at t = 1/2.
  const mid = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const p01 = mid(p0, p1)
  const p12 = mid(p1, p2)
  const p23 = mid(p2, p3)
  const p012 = mid(p01, p12)
  const p123 = mid(p12, p23)
  const p0123 = mid(p012, p123)
  flattenCubic(p0, p01, p012, p0123, tolerance, out, depth + 1)
  flattenCubic(p0123, p123, p23, p3, tolerance, out, depth + 1)
}

/** A quadratic is a cubic whose controls sit 2/3 of the way to the handle. */
const quadraticToCubic = (p0: Vec2, q: Vec2, p2: Vec2): [Vec2, Vec2] => [
  { x: p0.x + (2 / 3) * (q.x - p0.x), y: p0.y + (2 / 3) * (q.y - p0.y) },
  { x: p2.x + (2 / 3) * (q.x - p2.x), y: p2.y + (2 / 3) * (q.y - p2.y) },
]

/**
 * Flatten an SVG elliptical arc (the A/a command), appending to `out`.
 *
 * The endpoint parameterization is converted to a center one by the
 * procedure in the SVG 1.1 spec appendix F.6.5, including F.6.6's
 * correction step (radii too small to span the endpoints are scaled up
 * until they exactly do). Degenerate cases — zero radius, coincident
 * endpoints — collapse to a straight line, as the spec requires.
 */
const flattenArc = (
  from: Vec2,
  rxIn: number,
  ryIn: number,
  xAxisRotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  to: Vec2,
  tolerance: number,
  out: Vec2[],
): void => {
  if (Math.abs(from.x - to.x) < EPSILON && Math.abs(from.y - to.y) < EPSILON) return
  let rx = Math.abs(rxIn)
  let ry = Math.abs(ryIn)
  if (rx < EPSILON || ry < EPSILON) {
    out.push(to)
    return
  }
  const phi = (xAxisRotationDeg * Math.PI) / 180
  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)

  // F.6.5.1 — the endpoint midpoint in the ellipse's own frame.
  const dx2 = (from.x - to.x) / 2
  const dy2 = (from.y - to.y) / 2
  const x1p = cosPhi * dx2 + sinPhi * dy2
  const y1p = -sinPhi * dx2 + cosPhi * dy2

  // F.6.6 — grow radii that cannot reach.
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lambda > 1) {
    const s = Math.sqrt(lambda)
    rx *= s
    ry *= s
  }

  // F.6.5.2 — the center, in the ellipse frame and then in user space.
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
  const factor = Math.sqrt(Math.max(0, num / den)) * (largeArc === sweep ? -1 : 1)
  const cxp = (factor * (rx * y1p)) / ry
  const cyp = (factor * -(ry * x1p)) / rx
  const cx = cosPhi * cxp - sinPhi * cyp + (from.x + to.x) / 2
  const cy = sinPhi * cxp + cosPhi * cyp + (from.y + to.y) / 2

  // F.6.5.5/6 — start angle and sweep.
  const angleOf = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy)
    if (len < EPSILON) return 0
    const sign = ux * vy - uy * vx < 0 ? -1 : 1
    return sign * Math.acos(Math.min(1, Math.max(-1, dot / len)))
  }
  const ux = (x1p - cxp) / rx
  const uy = (y1p - cyp) / ry
  const vx = (-x1p - cxp) / rx
  const vy = (-y1p - cyp) / ry
  const theta1 = angleOf(1, 0, ux, uy)
  let dTheta = angleOf(ux, uy, vx, vy)
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI
  else if (sweep && dTheta < 0) dTheta += 2 * Math.PI

  // Segment count from the sagitta of one segment against the larger
  // radius: h = r(1 - cos(dθ/2)) ≤ tolerance.
  const r = Math.max(rx, ry)
  const maxStep = 2 * Math.acos(Math.min(1, Math.max(-1, 1 - tolerance / r)))
  const steps = Math.max(2, Math.ceil(Math.abs(dTheta) / Math.max(maxStep, 1e-4)))
  for (let i = 1; i <= steps; i++) {
    const t = theta1 + (dTheta * i) / steps
    const ex = rx * Math.cos(t)
    const ey = ry * Math.sin(t)
    out.push({ x: cosPhi * ex - sinPhi * ey + cx, y: sinPhi * ex + cosPhi * ey + cy })
  }
}

// ---------------------------------------------------------------------------
// Path data
// ---------------------------------------------------------------------------

/** A parsed subpath in the SVG's own coordinates, before any fitting. */
export interface RawSubpath {
  points: Vec2[]
  closed: boolean
}

/**
 * Parse and flatten a path `d` attribute into subpaths, in the SVG's own
 * user-space coordinates (y still down).
 *
 * Supports the whole grammar — M/L/H/V/C/S/Q/T/A/Z, absolute and
 * relative — including implicit command repetition, which is not a
 * nicety here: david.svg is 37 subpaths written as 42 `C` commands, each
 * streaming hundreds of coordinate triples, so a parser that demanded a
 * letter per segment would read it as 42 curves instead of ~9000.
 *
 * Per the spec, a repeated M is an implicit L (and a repeated m an
 * implicit l), and a moveto after a closepath starts at the closed
 * subpath's initial point.
 */
export const parsePathData = (d: string, tolerance = FLATTEN_TOLERANCE): RawSubpath[] => {
  const scan = new Scanner(d)
  const subpaths: RawSubpath[] = []
  let current: Vec2[] = []
  let closed = false
  // The pen, the subpath's start, and the reflected control point that
  // S/T continue from (null when the previous command was not a curve of
  // the matching kind, in which case the spec says to reuse the pen).
  let pen: Vec2 = { x: 0, y: 0 }
  let start: Vec2 = { x: 0, y: 0 }
  let lastCubicControl: Vec2 | null = null
  let lastQuadControl: Vec2 | null = null
  let command = ""

  const flush = (): void => {
    if (current.length >= 2) subpaths.push({ points: current, closed })
    current = []
    closed = false
  }

  while (!scan.atEnd()) {
    if (scan.peekCommand() !== null) {
      command = scan.takeCommand()
      // Spec 8.3.2: path data must begin with a moveto. Anything else
      // has no defined starting pen, so it is an error rather than an
      // implicit start at the origin.
      if (subpaths.length === 0 && current.length === 0 && command !== "M" && command !== "m") {
        scan.fail(`path data must begin with a moveto, not "${command}"`)
      }
    } else if (command === "") {
      scan.fail("path data must begin with a command")
    } else if (command === "M") {
      // An implicit repetition of moveto is a lineto (spec 8.3.2).
      command = "L"
    } else if (command === "m") {
      command = "l"
    } else if (command === "Z" || command === "z") {
      scan.fail("closepath takes no arguments")
    }

    const relative = command >= "a" && command <= "z"
    const upper = command.toUpperCase()
    const rel = (p: Vec2): Vec2 => (relative ? { x: pen.x + p.x, y: pen.y + p.y } : p)

    switch (upper) {
      case "M": {
        const x = scan.takeNumber()
        const y = scan.takeNumber()
        flush()
        pen = rel({ x, y })
        start = pen
        current = [pen]
        lastCubicControl = null
        lastQuadControl = null
        break
      }
      case "L": {
        const x = scan.takeNumber()
        const y = scan.takeNumber()
        pen = rel({ x, y })
        current.push(pen)
        lastCubicControl = null
        lastQuadControl = null
        break
      }
      case "H": {
        const x = scan.takeNumber()
        pen = { x: relative ? pen.x + x : x, y: pen.y }
        current.push(pen)
        lastCubicControl = null
        lastQuadControl = null
        break
      }
      case "V": {
        const y = scan.takeNumber()
        pen = { x: pen.x, y: relative ? pen.y + y : y }
        current.push(pen)
        lastCubicControl = null
        lastQuadControl = null
        break
      }
      case "C": {
        const c1 = rel({ x: scan.takeNumber(), y: scan.takeNumber() })
        const c2 = rel({ x: scan.takeNumber(), y: scan.takeNumber() })
        const end = rel({ x: scan.takeNumber(), y: scan.takeNumber() })
        flattenCubic(pen, c1, c2, end, tolerance, current)
        pen = end
        lastCubicControl = c2
        lastQuadControl = null
        break
      }
      case "S": {
        // The first control is the previous one reflected through the pen.
        const c1 = lastCubicControl
          ? { x: 2 * pen.x - lastCubicControl.x, y: 2 * pen.y - lastCubicControl.y }
          : pen
        const c2 = rel({ x: scan.takeNumber(), y: scan.takeNumber() })
        const end = rel({ x: scan.takeNumber(), y: scan.takeNumber() })
        flattenCubic(pen, c1, c2, end, tolerance, current)
        pen = end
        lastCubicControl = c2
        lastQuadControl = null
        break
      }
      case "Q": {
        const q = rel({ x: scan.takeNumber(), y: scan.takeNumber() })
        const end = rel({ x: scan.takeNumber(), y: scan.takeNumber() })
        const [c1, c2] = quadraticToCubic(pen, q, end)
        flattenCubic(pen, c1, c2, end, tolerance, current)
        pen = end
        lastQuadControl = q
        lastCubicControl = null
        break
      }
      case "T": {
        const q: Vec2 = lastQuadControl
          ? { x: 2 * pen.x - lastQuadControl.x, y: 2 * pen.y - lastQuadControl.y }
          : pen
        const end = rel({ x: scan.takeNumber(), y: scan.takeNumber() })
        const [c1, c2] = quadraticToCubic(pen, q, end)
        flattenCubic(pen, c1, c2, end, tolerance, current)
        pen = end
        lastQuadControl = q
        lastCubicControl = null
        break
      }
      case "A": {
        const rx = scan.takeNumber()
        const ry = scan.takeNumber()
        const rot = scan.takeNumber()
        const largeArc = scan.takeFlag()
        const sweep = scan.takeFlag()
        const end = rel({ x: scan.takeNumber(), y: scan.takeNumber() })
        flattenArc(pen, rx, ry, rot, largeArc, sweep, end, tolerance, current)
        pen = end
        lastCubicControl = null
        lastQuadControl = null
        break
      }
      case "Z": {
        if (current.length > 0) {
          // Close by returning to the start point, unless already there.
          const last = current[current.length - 1]!
          if (Math.abs(last.x - start.x) > EPSILON || Math.abs(last.y - start.y) > EPSILON) {
            current.push(start)
          }
          closed = true
          flush()
        }
        // A command after Z resumes from the closed subpath's start.
        pen = start
        current = [pen]
        lastCubicControl = null
        lastQuadControl = null
        break
      }
      default:
        scan.fail(`unsupported command "${command}"`)
    }
  }
  flush()
  return subpaths
}

// ---------------------------------------------------------------------------
// Basic shapes
// ---------------------------------------------------------------------------

/** Segments per quarter turn when a circle/ellipse element is flattened. */
const ELLIPSE_QUARTER_SEGMENTS = 16

const ellipseSubpath = (cx: number, cy: number, rx: number, ry: number): RawSubpath => {
  const n = ELLIPSE_QUARTER_SEGMENTS * 4
  const points: Vec2[] = []
  for (let i = 0; i <= n; i++) {
    const t = (2 * Math.PI * i) / n
    points.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) })
  }
  return { points, closed: true }
}

/**
 * The rounded-rect corner arcs of the `rect` element. Only used when the
 * source states rx/ry; a plain rect is four straight segments.
 */
const rectSubpath = (
  x: number,
  y: number,
  w: number,
  h: number,
  rxIn: number,
  ryIn: number,
  tolerance: number,
): RawSubpath => {
  const rx = Math.min(Math.max(0, rxIn), w / 2)
  const ry = Math.min(Math.max(0, ryIn), h / 2)
  if (rx < EPSILON || ry < EPSILON) {
    return {
      points: [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
        { x, y },
      ],
      closed: true,
    }
  }
  const points: Vec2[] = [{ x: x + rx, y }]
  const corner = (to: Vec2, sweepFrom: Vec2): void => {
    flattenArc(sweepFrom, rx, ry, 0, false, true, to, tolerance, points)
  }
  points.push({ x: x + w - rx, y })
  corner({ x: x + w, y: y + ry }, { x: x + w - rx, y })
  points.push({ x: x + w, y: y + h - ry })
  corner({ x: x + w - rx, y: y + h }, { x: x + w, y: y + h - ry })
  points.push({ x: x + rx, y: y + h })
  corner({ x, y: y + h - ry }, { x: x + rx, y: y + h })
  points.push({ x, y: y + ry })
  corner({ x: x + rx, y }, { x, y: y + ry })
  return { points, closed: true }
}

/** Parse `points="x,y x,y …"` of polyline/polygon. */
const parsePoints = (raw: string): Vec2[] => {
  const nums = raw
    .trim()
    .split(/[\s,]+/)
    .filter((s) => s.length > 0)
    .map(Number)
  if (nums.some((n) => !Number.isFinite(n))) {
    throw new Error("svg points: non-numeric coordinate")
  }
  const points: Vec2[] = []
  for (let i = 0; i + 1 < nums.length; i += 2) points.push({ x: nums[i]!, y: nums[i + 1]! })
  return points
}

// ---------------------------------------------------------------------------
// transform= attributes
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180

/**
 * Parse a `transform` attribute — matrix/translate/scale/rotate/skewX/
 * skewY, in the SVG's left-to-right order (the leftmost is applied last,
 * i.e. outermost).
 *
 * No asset in the origins corpus carries one; it is here because the
 * next SVG someone drops in will, and because a silently ignored
 * transform is exactly the kind of failure that reads as "the import is
 * subtly wrong" rather than as an error.
 */
export const parseTransform = (raw: string): Matrix => {
  let m = IDENTITY
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(raw)) !== null) {
    const name = match[1]!
    const args = match[2]!
      .trim()
      .split(/[\s,]+/)
      .filter((s) => s.length > 0)
      .map(Number)
    if (args.some((n) => !Number.isFinite(n))) {
      throw new Error(`svg transform: non-numeric argument in "${match[0]}"`)
    }
    let step: Matrix
    switch (name) {
      case "matrix":
        if (args.length !== 6) throw new Error("svg transform: matrix() needs 6 arguments")
        step = { a: args[0]!, b: args[1]!, c: args[2]!, d: args[3]!, e: args[4]!, f: args[5]! }
        break
      case "translate":
        step = { ...IDENTITY, e: args[0] ?? 0, f: args[1] ?? 0 }
        break
      case "scale": {
        const sx = args[0] ?? 1
        step = { ...IDENTITY, a: sx, d: args[1] ?? sx }
        break
      }
      case "rotate": {
        const angle = (args[0] ?? 0) * DEG
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const rot: Matrix = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 }
        if (args.length >= 3) {
          // rotate(a, cx, cy) = translate(c) · rotate(a) · translate(-c)
          const cx = args[1]!
          const cy = args[2]!
          step = multiply(
            multiply({ ...IDENTITY, e: cx, f: cy }, rot),
            { ...IDENTITY, e: -cx, f: -cy },
          )
        } else {
          step = rot
        }
        break
      }
      case "skewX":
        step = { ...IDENTITY, c: Math.tan((args[0] ?? 0) * DEG) }
        break
      case "skewY":
        step = { ...IDENTITY, b: Math.tan((args[0] ?? 0) * DEG) }
        break
      default:
        throw new Error(`svg transform: unsupported function "${name}"`)
    }
    m = multiply(m, step)
  }
  return m
}

// ---------------------------------------------------------------------------
// Document walk
// ---------------------------------------------------------------------------

/** One element found in the document, with its inherited transform. */
interface Element {
  tag: string
  attrs: Record<string, string>
  transform: Matrix
}

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g

const parseAttrs = (raw: string): Record<string, string> => {
  const attrs: Record<string, string> = {}
  let match: RegExpExecArray | null
  ATTR_RE.lastIndex = 0
  while ((match = ATTR_RE.exec(raw)) !== null) {
    attrs[match[1]!] = match[3] ?? match[4] ?? ""
  }
  return attrs
}

/** Elements that carry no drawable geometry and whose contents we skip. */
const NON_DRAWING = new Set(["defs", "clipPath", "mask", "symbol", "marker", "pattern"])

/** Shapes we convert. Anything else drawable is reported in `skipped`. */
const SHAPES = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"])

/**
 * Walk the document's tags, accumulating group transforms, and return
 * the drawable elements in document order.
 *
 * A regex tag scan rather than a DOM: this runs in a bun script with no
 * browser present, the corpus is machine-generated well-formed markup,
 * and the alternative is a dependency. It is deliberately shallow — it
 * understands nesting and transforms and nothing else about XML.
 */
const collectElements = (svg: string): { elements: Element[]; skipped: string[] } => {
  const elements: Element[] = []
  const skipped: string[] = []
  // Comments, CDATA, the prolog and the doctype carry no geometry, and
  // their contents can contain anything that looks like a tag.
  const src = svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?[^>]*>/gi, "")

  const stack: Matrix[] = [IDENTITY]
  /** Depth of the innermost non-drawing element we are inside, if any. */
  let suppressedAt: number | null = null

  const TAG_RE = /<\s*(\/?)\s*([a-zA-Z_:][-a-zA-Z0-9_:.]*)([^>]*?)(\/?)\s*>/g
  let match: RegExpExecArray | null
  while ((match = TAG_RE.exec(src)) !== null) {
    const isClose = match[1] === "/"
    const tag = match[2]!.replace(/^.*:/, "") // drop any namespace prefix
    const rest = match[3] ?? ""
    const selfClosing = match[4] === "/"

    if (isClose) {
      if (suppressedAt !== null && stack.length === suppressedAt) suppressedAt = null
      if (stack.length > 1) stack.pop()
      continue
    }

    const attrs = parseAttrs(rest)
    const local = attrs["transform"] ? parseTransform(attrs["transform"]) : IDENTITY
    const inherited = multiply(stack[stack.length - 1]!, local)

    if (!selfClosing) stack.push(inherited)

    if (suppressedAt !== null) continue
    if (NON_DRAWING.has(tag)) {
      if (!selfClosing) suppressedAt = stack.length
      continue
    }
    if (tag === "svg" || tag === "g" || tag === "title" || tag === "desc" || tag === "metadata") {
      continue
    }
    if (SHAPES.has(tag)) {
      elements.push({ tag, attrs, transform: inherited })
    } else if (!skipped.includes(tag)) {
      skipped.push(tag)
    }
  }
  return { elements, skipped }
}

/** A drawable element's geometry, in the element's own coordinates. */
const shapeSubpaths = (el: Element, tolerance: number): RawSubpath[] => {
  const num = (name: string, fallback = 0): number => {
    const raw = el.attrs[name]
    if (raw === undefined || raw.trim() === "") return fallback
    const v = Number.parseFloat(raw)
    if (!Number.isFinite(v)) throw new Error(`svg ${el.tag}: bad ${name}="${raw}"`)
    return v
  }
  switch (el.tag) {
    case "path": {
      const d = el.attrs["d"]
      return d ? parsePathData(d, tolerance) : []
    }
    case "rect": {
      const w = num("width")
      const h = num("height")
      if (w <= 0 || h <= 0) return []
      // Per spec, a lone rx or ry supplies the other.
      const hasRx = el.attrs["rx"] !== undefined
      const hasRy = el.attrs["ry"] !== undefined
      const rx = hasRx ? num("rx") : hasRy ? num("ry") : 0
      const ry = hasRy ? num("ry") : rx
      return [rectSubpath(num("x"), num("y"), w, h, rx, ry, tolerance)]
    }
    case "circle": {
      const r = num("r")
      return r > 0 ? [ellipseSubpath(num("cx"), num("cy"), r, r)] : []
    }
    case "ellipse": {
      const rx = num("rx")
      const ry = num("ry")
      return rx > 0 && ry > 0 ? [ellipseSubpath(num("cx"), num("cy"), rx, ry)] : []
    }
    case "line":
      return [
        {
          points: [
            { x: num("x1"), y: num("y1") },
            { x: num("x2"), y: num("y2") },
          ],
          closed: false,
        },
      ]
    case "polyline":
    case "polygon": {
      const points = parsePoints(el.attrs["points"] ?? "")
      if (points.length < 2) return []
      if (el.tag === "polygon") {
        const first = points[0]!
        const last = points[points.length - 1]!
        if (Math.abs(first.x - last.x) > EPSILON || Math.abs(first.y - last.y) > EPSILON) {
          points.push(first)
        }
        return [{ points, closed: true }]
      }
      return [{ points, closed: false }]
    }
    default:
      return []
  }
}

/**
 * The viewBox → viewport mapping, as a matrix.
 *
 * Only the default `preserveAspectRatio` (xMidYMid meet) is
 * implemented — uniform scale to fit, centered — which is what every
 * asset in the corpus wants and what the attribute defaults to when
 * absent. Since the geometry is re-fitted to a target height afterwards
 * anyway, this matters only for the ASPECT of a document whose declared
 * width/height disagree with its viewBox (man.svg does: 294.32 x 300
 * against a 361.89 x 362.32 box).
 */
const viewBoxMatrix = (svg: string): Matrix => {
  const head = svg.slice(0, svg.indexOf(">") + 1)
  const attrs = parseAttrs(head)
  const vb = attrs["viewBox"]
  if (!vb) return IDENTITY
  const parts = vb
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`svg: bad viewBox="${vb}"`)
  }
  const [vx, vy, vw, vh] = parts as [number, number, number, number]
  if (vw <= 0 || vh <= 0) return IDENTITY
  const lengthAttr = (name: string): number | null => {
    const raw = attrs[name]
    if (!raw) return null
    const v = Number.parseFloat(raw)
    return Number.isFinite(v) && v > 0 ? v : null
  }
  const w = lengthAttr("width")
  const h = lengthAttr("height")
  if (w === null || h === null) return { ...IDENTITY, e: -vx, f: -vy }
  const s = Math.min(w / vw, h / vh)
  return {
    a: s,
    b: 0,
    c: 0,
    d: s,
    e: -vx * s + (w - vw * s) / 2,
    f: -vy * s + (h - vh * s) / 2,
  }
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

export interface ImportOptions {
  /**
   * The height the sketch is scaled to, in world units — pydeation's
   * target size. Aspect is preserved; width follows. Null leaves the
   * document's own units alone (still y-flipped and centered).
   */
  height?: number | null
  /** Flattening tolerance in the SVG's user units. */
  tolerance?: number
  /**
   * Center the result on the origin — pydeation's "Center Axis to".
   * On by default; the fit is to the geometry's bounding box, not to
   * the viewBox, so a drawing that does not fill its canvas still lands
   * centered (which is what the C4D command did).
   */
  center?: boolean
}

/**
 * Import an SVG document's geometry as centered, scaled polylines in
 * DreamTalk's plane.
 *
 * Three frame changes happen here, in this order, and each is the SVG
 * loader's own behaviour rather than a choice:
 *
 *  1. the document's viewBox and any group transforms are applied, so
 *     the points are in the SVG's rendered coordinates;
 *  2. **y is negated** — SVG's y grows downward, ours grows upward, and
 *     without this every imported sketch is upside down;
 *  3. the geometry is centered on the origin and uniformly scaled so its
 *     bounding box is `height` tall (pydeation's Center-Axis-then-size).
 *
 * The y-flip reverses the handedness of the plane, so a subpath that was
 * clockwise in the file is counterclockwise here. That is the same
 * winding reversal `Stroke.drawReversed` documents for the 2021
 * primitives, and it is left as it falls: a Sketch's pen direction is
 * whatever the artist's pen direction was, mirrored, and a scene that
 * wants the other one says so.
 */
export const importSvg = (source: string, options: ImportOptions = {}): SvgGeometry => {
  const tolerance = options.tolerance ?? FLATTEN_TOLERANCE
  const { elements, skipped } = collectElements(source)
  const root = viewBoxMatrix(source)

  const subpaths: Vec2[][] = []
  const closedFlags: boolean[] = []
  for (const el of elements) {
    const m = multiply(root, el.transform)
    for (const sp of shapeSubpaths(el, tolerance)) {
      if (sp.points.length < 2) continue
      // Flip y as the points are placed: one pass, one frame change.
      subpaths.push(
        sp.points.map((p): Vec2 => {
          const q = applyMatrix(m, p)
          return { x: q.x, y: -q.y }
        }),
      )
      closedFlags.push(sp.closed)
    }
  }

  const raw = boundsOf(subpaths)
  const width = raw.maxX - raw.minX
  const height = raw.maxY - raw.minY
  const cx = (raw.minX + raw.maxX) / 2
  const cy = (raw.minY + raw.maxY) / 2
  const target = options.height ?? null
  const scale = target !== null && height > EPSILON ? target / height : 1
  const center = options.center ?? true

  if (scale !== 1 || center) {
    for (const sp of subpaths) {
      for (let i = 0; i < sp.length; i++) {
        const p = sp[i]!
        sp[i] = {
          x: (p.x - (center ? cx : 0)) * scale,
          y: (p.y - (center ? cy : 0)) * scale,
        }
      }
    }
  }

  // Normalize -0 away, so an empty or degenerate drawing's bounds
  // compare equal to a plain zero box.
  const z = (n: number): number => (n === 0 ? 0 : n)
  return {
    subpaths,
    closedFlags,
    bounds: center
      ? {
          minX: z((-width / 2) * scale),
          minY: z((-height / 2) * scale),
          maxX: z((width / 2) * scale),
          maxY: z((height / 2) * scale),
        }
      : {
          minX: z(raw.minX * scale),
          minY: z(raw.minY * scale),
          maxX: z(raw.maxX * scale),
          maxY: z(raw.maxY * scale),
        },
    skipped,
  }
}
