/**
 * RightTriangle — the triangle under a curve, and the slope it implies.
 *
 * Built for "Infinite Patience, Immediate Results", where a right triangle
 * carries the entire argument: its base is elapsed time, its height is what
 * has been gained, and its HYPOTENUSE is the average rate of gain. When the
 * height diverges, that hypotenuse stands vertical — and it stands vertical
 * no matter how long the base is. That is the paradox the song is about, and
 * it is a fact about this shape, which is why the shape is a holon.
 *
 * Generalised beyond that use, because a right triangle drawn to expose a
 * SLOPE is a recurring mathematical gesture:
 *
 *     new RightTriangle({ foot: {x,y}, base: 300, rise: 180 })
 *
 * `foot` is the right-angle corner. `base` runs right from it, `rise` runs up.
 * The three sides are separate, addressable strokes so a scene can emphasise
 * one — and in this song it must, since the hypotenuse is the point.
 *
 * WHY THE SIDES ARE THREE LINES AND NOT ONE CLOSED POLYLINE
 *
 * A closed polyline would draw as a single stroke and could only be styled as
 * a whole. Here the hypotenuse carries the meaning while the legs are
 * scaffolding, so they need their own tints and widths. The cost is that
 * "the triangle" is a Group rather than a shape — acceptable, because nothing
 * about this figure is ever filled.
 *
 * THE SLOPE READOUT
 *
 * `slope` is rise/base — the number the hypotenuse is a picture of. Exposed
 * because a scene may want to say it, and because it is the quantity that
 * goes to infinity while the picture stays on screen: the triangle cannot
 * show you an infinite height, but it can show you a vertical line, and
 * `slope` is how a caller knows which is happening.
 */

import { Group, Line, Null } from "../../src/parts/primitives"
import { color, length } from "../../src/params"
import { WHITE } from "../../src/constants"

/**
 * Give a Line derived points with a memo keyed on `sourceKey`.
 *
 * The sixth copy of this pattern (curves.ts, Morph.ts, Cable.ts, Fourier.ts,
 * Plot.ts). Written identically each time on purpose: bump `geomVersion`
 * whenever the memo recomputes, or the host's O(1) dirty-check serves stale
 * geometry.
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

export interface Vec2 {
  readonly x: number
  readonly y: number
}

export class RightTriangle extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The right-angle corner, in the parent's coordinates. */
  foot: Vec2 = { x: 0, y: 0 }
  /** How far the base runs to the right of `foot`. */
  base = length(200)
  /** How far the vertical leg rises from the base's far end. */
  rise = length(120)

  /**
   * Line width. Declared because this holon is a Null (a frame owning parts),
   * not a Stroke — it has no stroke to inherit, but every line it builds
   * needs one, and a caller should state it once.
   */
  stroke = length(3)

  /** The legs: scaffolding, quieter than the hypotenuse. */
  legTint = color({ r: 0.5, g: 0.5, b: 0.55 })
  /** The hypotenuse: the slope, and in this song the whole argument. */
  hypotenuseTint = color(WHITE)

  baseLine!: Line
  riseLine!: Line
  hypotenuse!: Line
  sides!: Group

  /** rise / base — the number the hypotenuse pictures. Infinite at base 0. */
  get slope(): number {
    const b = this.base.value
    return b === 0 ? Number.POSITIVE_INFINITY : this.rise.value / b
  }

  protected override compose(): void {
    // All three sides are DERIVED from `base` and `rise`, not computed once:
    // the triangle's whole purpose here is to grow, and a triangle whose
    // geometry were fixed at compose() would be a still picture of the
    // argument rather than the argument.
    const key = () => [this.base.value, this.rise.value, this.foot.x, this.foot.y]

    this.baseLine = new Line({ tint: this.legTint, stroke: this.stroke.times(0.75) })
    derivePolyline(this.baseLine, key, () => {
      const { x, y } = this.foot
      return [
        { x, y, z: 0 },
        { x: x + this.base.value, y, z: 0 },
      ]
    })

    this.riseLine = new Line({ tint: this.legTint, stroke: this.stroke.times(0.75) })
    derivePolyline(this.riseLine, key, () => {
      const { x, y } = this.foot
      const b = this.base.value
      return [
        { x: x + b, y, z: 0 },
        { x: x + b, y: y + this.rise.value, z: 0 },
      ]
    })

    // Foot → apex: the average rate of climb over the whole base.
    this.hypotenuse = new Line({ tint: this.hypotenuseTint, stroke: this.stroke })
    derivePolyline(this.hypotenuse, key, () => {
      const { x, y } = this.foot
      return [
        { x, y, z: 0 },
        { x: x + this.base.value, y: y + this.rise.value, z: 0 },
      ]
    })
    this.sides = this.add(
      new Group({ members: [this.baseLine, this.riseLine, this.hypotenuse] }),
    )
  }
}
