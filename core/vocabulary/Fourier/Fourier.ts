/**
 * FourierTrace — a drawing assembled from rotating circles.
 *
 * The 3Blue1Brown epicycle figure, which David used (via Manim) to trace the
 * Vitruvian Man in the Liminal Consulting Web3 video, and which he asked to
 * exist as a reusable holon rather than a one-off:
 *
 *   "the input is an SVG plus the parameters of how many terms should be
 *    visualized, how closely should that SVG path be approximated … and then
 *    the output should be that animation."
 *
 * So the interface is exactly those two knobs:
 *
 *     new FourierTrace({ path, terms: 120 })          // "how many circles"
 *     new FourierTrace({ path, tolerance: 2 })        // "how close", in path units
 *
 * `src/geometry/fourier.ts` is the mathematics; this is the drawing. Split
 * that way because the maths is testable in closed form (a unit circle is one
 * term of radius one) and the drawing is not.
 *
 * WHAT IS ON SCREEN
 *
 *   - a chain of `terms` circles, each drawn at the tip of the last, the nth
 *     spinning n times per lap;
 *   - a radius line inside each circle, so the rotation is legible — a ring
 *     alone reads as static;
 *   - the INK: the curve the final tip has traced so far.
 *
 * ONE PARAM DRIVES EVERYTHING: `turn`
 *
 * `turn` ∈ [0,1] is one full lap. Animate it 0 → 1 and the figure draws
 * itself. Everything else — every circle's position, every arm's angle, how
 * much ink exists — is derived from it, so the whole holon is a pure function
 * of one number and scrubs backwards perfectly.
 *
 * WHY THE INK IS A SEPARATE DERIVED LINE
 *
 * The trace cannot be a `drawStart`/`creation` sweep over a pre-computed
 * polyline, because the pen's position at `turn` is only defined by the
 * epicycle sum — the ink and the machine must agree exactly, or the pen
 * visibly leaves the end of the line. So the ink is derived from the SAME
 * `chainAt` call that places the circles: one source of truth per frame.
 *
 * WHY SMALL CIRCLES ARE DROPPED
 *
 * A high-term decomposition has a long tail of circles below a pixel across.
 * They cost geometry and draw nothing, so circles under `minRadius` are
 * omitted from the DRAWING while remaining in the SUM — the pen still goes
 * exactly where the full series says, it is only the scaffolding that thins.
 */

import { Group, Line, Null, Circle } from "../../src/parts/primitives"
import { bool, color, integer, length, completion } from "../../src/params"
import { WHITE, type Color } from "../../src/constants"
import {
  chainAt,
  coefficients,
  termsForError,
  type Epicycle,
  type Vec2,
} from "../../src/geometry/fourier"

export class FourierTrace extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /**
   * The closed path to draw, in scene units. Data, like `Line.points` —
   * typically from `importSvg`, whose flattened subpaths are exactly this
   * shape.
   */
  path: Vec2[] = []

  /**
   * How many circles. The knob an author actually thinks in.
   *
   * Ignored when `tolerance` is set, which asks the same question the other
   * way round ("close enough that I cannot see the difference") and lets the
   * maths answer it.
   */
  terms = integer(80)

  /**
   * Mean error to aim for, in path units. Set it and `terms` is derived.
   * Zero (the default) means "use `terms` as given".
   */
  tolerance = length(0)

  /** One full lap of the drawing. Animate 0 → 1. */
  turn = completion(0)

  /** Circles smaller than this are dropped from the drawing (never the sum). */
  minRadius = length(1.2)

  /** The scaffolding: circles and their radius arms. */
  machineTint = color({ r: 0.45, g: 0.45, b: 0.5 })
  /** The ink the pen lays down. */
  inkTint = color(WHITE)
  /** Show the rotating machinery. Off leaves only the drawing. */
  showMachine = bool(true)

  /** Resolution of the ink — samples per lap. */
  inkSamples = integer(1400)

  /**
   * Ink width. Declared here because a FourierTrace is a Null (a frame that
   * owns parts), not a Stroke — it has no stroke of its own to inherit, but
   * every line it builds needs one, and an author should set it once.
   */
  stroke = length(3)

  private epicycles: Epicycle[] = []
  rings!: Group
  ink!: Line

  protected override compose(): void {
    const path = this.path
    if (path.length < 2) {
      // Nothing to draw, but the parts must exist: a holon that adds its
      // geometry later would reach the renderer without attributes and stay
      // invisible for its whole life (the Scene03 section-curve lesson).
      this.rings = this.add(new Group({ members: [] }))
      this.ink = this.add(new Line({ points: [], tint: this.inkTint, stroke: this.stroke }))
      return
    }

    const wanted =
      this.tolerance.value > 0
        ? termsForError(path, this.tolerance.value)
        : Math.max(1, Math.round(this.terms.value))
    this.epicycles = coefficients(path, wanted)

    // --- the machine ---------------------------------------------------
    // Each visible term gets a circle and an arm. Both are DERIVED from
    // `turn` through the same chain the ink uses, so they cannot disagree.
    const members: (Circle | Line)[] = []
    const min = this.minRadius.value
    this.epicycles.forEach((e, i) => {
      if (e.radius < min || e.freq === 0) return
      const centreOf = (t: number): Vec2 => chainAt(this.epicycles, t)[i]!
      const tipOf = (t: number): Vec2 => chainAt(this.epicycles, t)[i + 1]!

      const ring = new Circle({
        radius: e.radius,
        tint: this.machineTint,
        stroke: this.stroke.times(0.5),
        opacity: this.showMachine.value ? 0.55 : 0,
        x: this.turn.map((t) => centreOf(t).x),
        y: this.turn.map((t) => centreOf(t).y),
      })
      // The arm: centre → tip. Stated in the ring's own frame would be
      // simpler, but a Line's points are data and cannot follow a param, so
      // it is a derived polyline in scene space instead.
      const arm = new Line({
        tint: this.machineTint,
        stroke: this.stroke.times(0.5),
        opacity: this.showMachine.value ? 0.75 : 0,
      })
      derivePolyline(arm, () => [this.turn.value], () => {
        const t = this.turn.value
        const c = centreOf(t)
        const p = tipOf(t)
        return [
          { x: c.x, y: c.y, z: 0 },
          { x: p.x, y: p.y, z: 0 },
        ]
      })
      members.push(ring, arm)
    })
    this.rings = this.add(new Group({ members }))

    // --- the ink -------------------------------------------------------
    // The curve traced SO FAR: sampled from the same epicycle sum, so the
    // pen is always exactly at the end of its own line.
    this.ink = this.add(new Line({ tint: this.inkTint, stroke: this.stroke }))
    const samples = Math.max(16, Math.round(this.inkSamples.value))
    derivePolyline(this.ink, () => [this.turn.value], () => {
      const t = this.turn.value
      if (t <= 0) return []
      const upto = Math.max(2, Math.ceil(t * samples))
      const pts: { x: number; y: number; z: number }[] = []
      for (let i = 0; i < upto; i++) {
        const u = Math.min(t, (i / samples))
        const chain = chainAt(this.epicycles, u)
        const pen = chain[chain.length - 1]!
        pts.push({ x: pen.x, y: pen.y, z: 0 })
      }
      return pts
    })
  }

  /** The pen's position at the current `turn` — for anything riding the tip. */
  penAt(t: number): Vec2 {
    const chain = chainAt(this.epicycles, t)
    return chain[chain.length - 1] ?? { x: 0, y: 0 }
  }

  /** How many terms the decomposition actually used. */
  get termCount(): number {
    return this.epicycles.length
  }
}

/**
 * Give a Line derived points with a memo keyed on `sourceKey`.
 *
 * The fourth copy of this pattern in the codebase (curves.ts, Morph.ts,
 * Cable.ts) and the third time its version counter has mattered — so it is
 * written here the same way deliberately: bump `geomVersion` whenever the
 * memo recomputes, or the host's O(1) dirty-check will serve stale geometry.
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
