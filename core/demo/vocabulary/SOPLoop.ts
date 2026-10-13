/**
 * SOPLoop.ts — A DreamWeaving
 *
 * Sales & Operations Planning as one figure-eight: the two lobes draw on,
 * value starts to run round the loop; demand comes into focus, then supply;
 * the demand forecast — conjecture, drawn as a superposition — lands and
 * crystallises; and the two loops untwist into one circle (integrated
 * planning) and back.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together, type Anim } from "../../src/anim"
import { SOPLoop } from "../../vocabulary/SOPLoop/SOPLoop"

export class SOPLoopDream extends Dream {
  loop = new SOPLoop({ radius: 560 })

  /** Play `anim` over `dt` seconds while the loop keeps flowing. */
  private flowing(dt: number, ...anims: Anim[]): void {
    this.play(together(this.loop.time.by(dt, { easing: "linear" }), ...anims), dt)
  }

  unfold() {
    const l = this.loop
    this.stage(l)
    this.flowing(2.5, Create(l))
    this.flowing(2)
    this.flowing(1.5, l.focus.to(-1))
    this.flowing(1.5)
    this.flowing(1.5, l.focus.to(1))
    this.flowing(1.5)
    this.flowing(1.2, l.focus.to(0))
    // The forecast lands: demand's potentiality collapses into actuality.
    this.flowing(2.5, l.left.certainty.to(1))
    this.flowing(1.5)
    // Integrated planning: the two loops become one.
    this.flowing(3.5, l.round.to(1))
    this.flowing(2.5)
    this.flowing(3, l.round.to(0))
    this.flowing(1.5)
  }
}

if (import.meta.main) render(SOPLoopDream)
