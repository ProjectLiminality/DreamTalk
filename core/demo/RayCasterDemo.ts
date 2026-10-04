/**
 * RayCasterDemo.ts — A DreamWeaving
 *
 * The eyes perceive (ONTOLOGY.md 2026-09-16). On the left, the
 * Dialectical-Thinking beat as the edge case it is: an Eye casts three
 * rays across its own opening at a circle; they stop where they meet it,
 * an "x" marks each hit, and a shockwave rings out — all energy at
 * impact, fading as it spreads. On the right, the general form: an
 * emitter inside a square casting in every direction.
 */

import { Dream, render } from "../src/index"
import { Create, together } from "../src/index"
import { BLUE } from "../src/constants"
import { Circle, Null, Square } from "../src/parts/index"
import { Eye } from "../vocabulary/Eye/Eye"
import { Cast, RayCaster } from "../vocabulary/Eye/RayCaster"

export class RayCasterDemoDream extends Dream {
  eye = new Eye({ x: -560, scale: 0.35, tint: BLUE })
  circle = new Circle({ radius: 90, x: -120 })
  looking = this.eye.rayCast([this.circle], { reach: 700 })
  caster = this.looking.caster

  centre = new Null({ x: 380 })
  room = new Square({ size: 260, x: 380 })
  burst = new RayCaster(this.centre, [this.room], { steps: 16, reach: 400 })

  unfold() {
    this.set(...this.observer.dolly(1250))
    this.play(together(Create(this.eye), Create(this.circle), Create(this.room)), 2)
    this.play(together(this.looking.anim, Cast(this.burst)), 3)
    this.wait(1)
  }
}

if (import.meta.main) render(RayCasterDemoDream)
