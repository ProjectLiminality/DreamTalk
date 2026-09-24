/**
 * Plot — a function drawn on axes.
 *
 * Built for "Infinite Patience, Immediate Results", where the whole argument
 * is carried by the shape of a curve near a singularity, and generalised
 * because a DreamSong that wants to SHOW a mathematical claim will want this
 * again.
 *
 * WHAT IT IS
 *
 *     new Plot({
 *       fn: (x) => -1 / x,          // the function, in graph coordinates
 *       domain: [-1, -0.02],        // what part of it exists
 *       range: [0, 12],             // what part of the y axis is on screen
 *       width: 760, height: 460,    // the box it occupies, in scene units
 *     })
 *
 * `reveal` ∈ [0,1] draws the curve left to right. Everything else — the axes,
 * the clipping, where a graph point lands on screen — follows from the four
 * numbers above, so a scene states the mathematics and not the pixels.
 *
 * THE COORDINATE MAP IS THE WHOLE JOB
 *
 * Two spaces meet here and confusing them is the only real way to get a plot
 * wrong: GRAPH space (where the function lives, x ∈ domain, y ∈ range) and
 * SCENE space (where holons live, centred on the plot's own origin). `at()`
 * is the single conversion, and everything — the curve, the axes, and any
 * holon a scene wants to ride along the curve — goes through it. One
 * conversion, stated once, is what lets a caller place a triangle's apex on
 * the curve without knowing anything about the box.
 *
 * CLIPPING, AND WHY IT MATTERS HERE
 *
 * A function that diverges does not have a largest value, so a plot of one
 * MUST clip, or a single sample at x = −0.001 puts a point a thousand screen-
 * heights away and the renderer's bounding volume swallows the frame. Points
 * above `range[1]` are clamped to the top of the box, which is also what an
 * asymptote should look like: the curve runs up the wall and leaves.
 *
 * The clamp is deliberately NOT a dropped point. Dropping would break the
 * polyline into pieces and the eye would read a gap where the mathematics has
 * continuity.
 */

import { Group, Line, Null } from "../../src/parts/primitives"
import { color, completion, integer, length } from "../../src/params"
import { WHITE } from "../../src/constants"

export interface Vec2 {
  readonly x: number
  readonly y: number
}

export class Plot extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The function to draw, in graph coordinates. */
  fn: (x: number) => number = (x) => x

  /** Which slice of the x axis exists, in graph coordinates. */
  domain: [number, number] = [-1, 1]
  /** Which slice of the y axis is on screen. Values above are clamped. */
  range: [number, number] = [0, 10]

  /** The box the plot occupies, in scene units, centred on its own origin. */
  width = length(760)
  height = length(460)

  /** How much of the curve is drawn, left to right. */
  reveal = completion(0)

  /** Samples across the domain. A divergence needs plenty near its pole. */
  samples = integer(900)

  /**
   * Line width. Declared because this holon is a Null (a frame owning parts),
   * not a Stroke — it has no stroke to inherit, but every line it builds
   * needs one, and a caller should state it once.
   */
  stroke = length(3)

  curveTint = color(WHITE)
  axisTint = color({ r: 0.45, g: 0.45, b: 0.5 })
  /** Draw the axes. Off leaves the curve alone. */
  showAxes = true

  curve!: Line
  axes!: Group

  /**
   * Graph coordinates → scene coordinates. THE conversion (see the header).
   *
   * Public because a scene legitimately needs it: the infinite-patience song
   * puts a triangle's apex exactly on the curve, and it can only do that by
   * asking the plot where a graph point is.
   */
  at(x: number, y: number): Vec2 {
    const [x0, x1] = this.domain
    const [y0, y1] = this.range
    const w = this.width.value
    const h = this.height.value
    const u = (x - x0) / (x1 - x0)
    // Clamped, not dropped — an asymptote runs up the wall and leaves.
    const v = (Math.min(Math.max(y, y0), y1) - y0) / (y1 - y0)
    return { x: -w / 2 + u * w, y: -h / 2 + v * h }
  }

  /** The curve's height at x, in graph coordinates — unclamped. */
  valueAt(x: number): number {
    return this.fn(x)
  }

  protected override compose(): void {
    const [x0, x1] = this.domain
    const n = Math.max(2, Math.round(this.samples.value))

    // --- the curve -----------------------------------------------------
    // Derived from `reveal` so the draw is a pure function of one param,
    // the shape every holon in this vocabulary shares.
    this.curve = this.add(new Line({ tint: this.curveTint, stroke: this.stroke }))
    derivePolyline(
      this.curve,
      () => [this.reveal.value],
      () => {
        const r = this.reveal.value
        if (r <= 0) return []
        // Sample only as far as `reveal` has reached, at full resolution —
        // so the drawn portion is always the same curve, never a coarser one
        // that refines as it grows.
        const upto = Math.max(2, Math.ceil(r * n))
        const pts: { x: number; y: number; z: number }[] = []
        for (let i = 0; i < upto; i++) {
          const x = x0 + (i / n) * (x1 - x0)
          const p = this.at(x, this.fn(x))
          pts.push({ x: p.x, y: p.y, z: 0 })
        }
        return pts
      },
    )

    // --- the axes ------------------------------------------------------
    if (!this.showAxes) {
      this.axes = this.add(new Group({ members: [] }))
      return
    }
    const w = this.width.value
    const h = this.height.value
    const xAxis = new Line({
      points: [
        { x: -w / 2, y: -h / 2, z: 0 },
        { x: w / 2, y: -h / 2, z: 0 },
      ],
      tint: this.axisTint,
      stroke: this.stroke.times(0.6),
    })
    // The y axis stands at x = 0 in GRAPH space when that is inside the
    // domain — which for this song is the singularity itself, at the right
    // edge. Otherwise it stands at the box's left wall.
    const yAtZero = x0 <= 0 && 0 <= x1 ? this.at(0, this.range[0]).x : -w / 2
    const yAxis = new Line({
      points: [
        { x: yAtZero, y: -h / 2, z: 0 },
        { x: yAtZero, y: h / 2, z: 0 },
      ],
      tint: this.axisTint,
      stroke: this.stroke.times(0.6),
    })
    this.axes = this.add(new Group({ members: [xAxis, yAxis] }))
  }
}

/**
 * Give a Line derived points with a memo keyed on `sourceKey`.
 *
 * The fifth copy of this pattern (curves.ts, Morph.ts, Cable.ts, Fourier.ts).
 * Written the same way each time deliberately: bump `geomVersion` whenever the
 * memo recomputes, or the host's O(1) dirty-check serves stale geometry.
 */
const derivePolyline = (
  line: Line,
  sourceKey: () => readonly number[],
  compute: () => { x: number; y: number; z: number }[],
): void => {
  let key: readonly number[] | undefined
  let memo: { x: number; y: number; z: number }[] = []
  Object.defineProperty(line, "points", {
    configurable: true,
    enumerable: true,
    get() {
      const next = sourceKey()
      if (!key || key.length !== next.length || next.some((v, i) => v !== key![i])) {
        key = next
        memo = compute()
        line.geomVersion++
      }
      return memo
    },
    set(_v) {},
  })
}
