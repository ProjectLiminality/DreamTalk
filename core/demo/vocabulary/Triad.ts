/**
 * Triad.ts — A DreamWeaving
 *
 * The triangle as it was drawn: the two poles at the base, the coil of life
 * and death under it, Life at the apex. Then the drawing opens into what it
 * is — a figure seen edge-on: the base becomes a plane, the coil a wheel
 * turning under it, the apex rises on the plane's normal. Then the second
 * reading: an eye opens at the apex — the triangle is the ego — and Life is
 * the sphere that holds it all. The wheel keeps turning throughout.
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
    this.triad.seenFrom(this.observer)
    this.set(...this.observer.dolly(1300))
    this.stage(t)
    this.dancing(3, Create(t))
    this.dancing(1.5)
    // The drawing is a figure seen edge-on: it opens into 3D.
    this.dancing(3, t.unfold.to(1))
    this.dancing(2)
    // The ego: the eye at the apex, Life the whole.
    this.dancing(2.5, t.reading.to(1))
    this.dancing(3)
  }
}

if (import.meta.main) render(TriadDream)
