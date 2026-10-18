/**
 * MindDemo.ts — A DreamWeaving
 *
 * The Mind standing alone: the domesticated mind draws — the bust, the cube
 * closing round its head, the blue triangle around them (MolochConsciousness)
 * — holds, then turns liminal as the film turns it (f7021, 2595–2630): the
 * cube lifts away and fades, the Vision lights in the head, the triangle
 * rounds into the red circle. Hold.
 *
 * At the default camera the size is the film's: the circle's 125.5 px of
 * 720 is 261 units.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { Mind } from "../../vocabulary/Mind/Mind"

export class MindDemoDream extends Dream {
  mind = new Mind({ size: 261 })

  unfold() {
    this.play(Create(this.mind), 2.5)
    this.wait(1.5)
    this.play(this.mind.liminal.to(1), 2.5)
    this.wait(2)
  }
}

if (import.meta.main) render(MindDemoDream)
