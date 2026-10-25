/**
 * Triad.ts — A DreamWeaving
 *
 * The triangle as it was drawn: the two poles at the base, the coil of life
 * and death under it, Life at the apex. Then the drawing opens into what it
 * is — a figure seen edge-on: the base becomes a plane, the coil a wheel
 * turning under it, the apex rises on the plane's normal. Then the second
 * reading: an eye opens at the apex — the triangle is the ego — and Life is
 * the sphere that holds it all. The wheel keeps turning throughout.
 * Last, the perspectives: the camera goes down onto the plane and looks up
 * at the eye, then low between the poles, then up above the apex — the
 * same figure from below, from the side, from above — and home.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together, type Anim } from "../../src/anim"
import { Triad } from "../../vocabulary/Triad/Triad"

export class TriadDream extends Dream {
  triad = new Triad()

  /** Play `anim` over `dt` seconds while the wheel turns. */
  private dancing(dt: number, ...anims: Anim[]): void {
    this.play(together(this.triad.dance.by(dt, { easing: "linear" }), ...anims), dt)
  }

  unfold() {
    const t = this.triad
    // The camera is the triad's to carry (its `view` reading), home at 1300.
    this.triad.rig(this.observer, { radius: 1300 })
    this.stage(t)
    this.dancing(3, Create(t))
    this.dancing(1.5)
    // The drawing is a figure seen edge-on: it opens into 3D.
    this.dancing(3, t.unfold.to(1))
    this.dancing(2)
    // The ego: the eye at the apex, Life the whole.
    this.dancing(2.5, t.reading.to(1))
    this.dancing(3)
    // The perspectives: from below, from the side, from above, and home.
    this.dancing(3.5, t.below.to(1))
    this.dancing(2.5)
    this.dancing(3.5, t.below.to(0), t.side.to(1))
    this.dancing(5)
    this.dancing(3.5, t.side.to(0), t.above.to(1))
    this.dancing(3)
    this.dancing(3, t.above.to(0))
    this.dancing(1)
  }
}

if (import.meta.main) render(TriadDream)
