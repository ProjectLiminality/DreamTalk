/**
 * Regenaissance.ts — A DreamWeaving
 *
 * The Regenaissance standing alone: the ring closes, the two worlds'
 * circles and the axis draw on, the noosphere's lattice weaves while the
 * biosphere's land floods in, and the eye opens with the mark writing
 * itself in it. Then both worlds turn — the mind one way, the Earth the
 * other — before it all un-creates.
 */

import { Dream, render } from "../../src/index"
import { Create, UnCreate } from "../../src/verbs"
import { together } from "../../src/anim"
import { Regenaissance } from "../../vocabulary/Regenaissance/Regenaissance"

export class RegenaissanceDream extends Dream {
  regen = new Regenaissance({ radius: 680 })

  unfold() {
    this.play(Create(this.regen), 4)
    this.play(
      together(
        this.regen.latticeSpin.to(this.regen.latticeSpin.value + 0.8),
        this.regen.earthSpin.to(this.regen.earthSpin.value - 0.5),
      ),
      4,
    )
    this.wait(1)
    this.play(UnCreate(this.regen), 2)
    this.wait(0.5)
  }
}

if (import.meta.main) render(RegenaissanceDream)
