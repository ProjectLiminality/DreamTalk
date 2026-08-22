/**
 * FoundingSmoke.ts — A DreamWeaving
 *
 * The Chapter-2 smoke scene: a square and a circle draw themselves out
 * of the black, drift toward one another, and meet — the first breath of
 * the founding parable (the cylinder they will one day become is Ch 8).
 */

import { Dream, render } from "../src/index"
import { Create, together } from "../src/index"
import { BLUE, RED } from "../src/constants"
import { Circle, Square } from "../src/parts/index"

export class FoundingSmokeDream extends Dream {
  square = new Square({ size: 200, tint: RED, x: -300 })
  circle = new Circle({ radius: 100, tint: BLUE, x: 300 })

  unfold() {
    this.play(Create(this.square), 2)
    this.play(Create(this.circle), 2)
    this.play(
      together(this.square.x.to(0), this.circle.x.to(0)),
      1.5,
    )
    this.play(
      together(this.square.scale.to(1.2), this.circle.scale.to(1.2)),
      1,
    )
    this.wait(1)
  }
}

if (import.meta.main) render(FoundingSmokeDream)
