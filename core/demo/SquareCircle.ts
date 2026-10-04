/**
 * SquareCircle.ts — A DreamWeaving
 *
 * The test of elegance (ONTOLOGY.md 2026-09-16): a cylinder that is not
 * given its size but DERIVED as the intersection of a square and a circle
 * (Cylinder.of, geometry/sdf.ts). The square grows and the cylinder grows
 * taller; the circle shrinks and the cylinder grows thinner — no line of
 * this scene touches the cylinder's own shape.
 */

import { Dream, render } from "../src/index"
import { Create, together } from "../src/index"
import { BLUE, RED } from "../src/constants"
import { Circle, Square } from "../src/parts/index"
import { Cylinder } from "../vocabulary/Cylinder/Cylinder"

export class SquareCircleDream extends Dream {
  square = new Square({ size: 200, tint: RED, x: -340 })
  circle = new Circle({ radius: 100, tint: BLUE, x: -40 })
  cylinder = Cylinder.of(this.square, this.circle, { x: 300 })

  unfold() {
    this.set(...this.observer.orbit({ phi: 0.3, theta: 0.3 }), ...this.observer.dolly(950))
    this.play(together(Create(this.square), Create(this.circle)), 2)
    this.play(Create(this.cylinder), 2)
    this.wait(0.5)
    this.play(this.square.size.to(320), 2)
    this.wait(0.5)
    this.play(this.circle.radius.to(55), 2)
    this.wait(0.5)
    this.play(together(this.square.size.to(200), this.circle.radius.to(100)), 2)
    this.wait(1)
  }
}

if (import.meta.main) render(SquareCircleDream)
