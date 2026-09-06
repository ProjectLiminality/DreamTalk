/**
 * Cable.ts — A DreamWeaving
 *
 * The Cable standing alone in its trail spelling: a carrier swims a
 * sine path across the frame and the cable IS its past — the tapered
 * tube's two silhouette edges, contour rings born at the head every
 * ringStep of travel and receding down the tube. Pure f(t): scrub it
 * backwards and the geometry is identical.
 */

import { Dream, render } from "../../src/index"
import { Cable } from "../../vocabulary/Cable/Cable"
import type { Vec3Like } from "../../src/parts/primitives"

const DUR = 6

/** The carrier's journey — a steady serpentine, stated purely. */
const swim = (t: number): Vec3Like => ({
  x: -300 + 120 * t,
  y: 80 * Math.sin(1.5 * t),
  z: 0,
})

export class CableDream extends Dream {
  cable = new Cable({ stroke: 2 }).trail(swim, { window: 4 })

  unfold() {
    this.set(...this.observer.dolly(700))
    this.play(this.cable.clock.to(DUR, { easing: "linear" }), DUR)
    this.wait(1)
  }
}

if (import.meta.main) render(CableDream)
