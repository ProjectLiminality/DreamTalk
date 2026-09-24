/**
 * FourierDemo — the epicycle tracer, proving itself on a known shape.
 *
 * Built to VERIFY the Fourier vocabulary holon before it is asked to carry
 * the Vitruvian Man: a shape whose decomposition is obvious by eye (a square
 * — its corners ring, which is the visible signature of a truncated series)
 * so that a wrong sign or a stale memo shows up immediately rather than
 * hiding inside a complicated drawing.
 */

import { Dream } from "../../src/index"
import { Null } from "../../src/parts/primitives"
import { FourierTrace } from "../../vocabulary/Fourier/Fourier"
import { BLUE } from "../../src/constants"
import type { Vec2 } from "../../src/geometry/fourier"

/** A square with rounded sampling — enough corners to need real terms. */
const square = (s: number): Vec2[] => {
  const pts: Vec2[] = []
  const corners: Vec2[] = [
    { x: -s, y: -s },
    { x: s, y: -s },
    { x: s, y: s },
    { x: -s, y: s },
  ]
  for (let i = 0; i < 4; i++) {
    const a = corners[i]!
    const b = corners[(i + 1) % 4]!
    for (let k = 0; k < 40; k++) {
      const u = k / 40
      pts.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u })
    }
  }
  return pts
}

export class FourierDemoDream extends Dream {
  tracer = new FourierTrace({
    path: square(160),
    terms: 40,
    stroke: 4,
    inkTint: BLUE,
  })

  private root = new Null()

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.stage(this.root)
    this.stage(this.tracer)
    this.play(this.tracer.turn.to(1, { easing: "linear" }), 8)
    this.wait(1.5)
  }
}
