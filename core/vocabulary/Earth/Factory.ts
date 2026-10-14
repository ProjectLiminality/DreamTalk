/**
 * Factory — a hall under a sawtooth roof, drawn as lines in 3D.
 *
 * The sawtooth is the oldest pictogram of industry: north-light glazing on
 * every tooth, the vertical face of each one a window. Three teeth over a
 * long low hall, a prism (prism.ts) with true hidden lines, standing on
 * y = 0 so a `Place` (Earth.ts) stands it on the planet. On a map its
 * colour IS its meaning, so `tint` is the param that matters; `size` is the
 * hall's length and every other proportion follows from it.
 *
 * A `Building` (prism.ts), so a morph target too: give it `seenBy` and
 * `worldCurves()` answers its VISIBLE edges for that observer's view.
 */

import { color, length } from "../../src/params"
import { WHITE } from "../../src/constants"
import { BODY, Building, prism, type P2 } from "./prism"

/** How tall the hall's walls are, and each tooth above them, per unit of length. */
const WALL = 0.3
const TOOTH = 0.22
const TEETH = 3

export class Factory extends Building {
  static sovereign = true
  tint = color(WHITE)
  stroke = length(1.5)
  body = color(BODY)
  size = length(8)

  /** The hall's full height (walls + teeth) at `size` — what a rising site must sink. */
  static heightFor = (size: number): number => size * (WALL + TOOTH)

  protected override compose(): void {
    const w = this.size.value
    const h = w * WALL
    const tooth = w * TOOTH
    const profile: P2[] = [
      [w / 2, 0],
      [w / 2, h],
    ]
    // Right to left: each tooth rises vertically (the glazing) and slopes
    // back down to the foot of the next.
    for (let i = TEETH; i > 0; i--) {
      profile.push([-w / 2 + (w * i) / TEETH, h + tooth], [-w / 2 + (w * (i - 1)) / TEETH, h])
    }
    profile.push([-w / 2, 0])
    this.shape([prism(this, profile, w * 0.6, { tint: this.tint, stroke: this.stroke, body: this.body })])
  }
}
