/**
 * TimeSpiral.ts — A DreamWeaving
 *
 * The spiral of time draws itself: the base and Kronos's arrow, then the
 * helix rising out of the plane turn by turn, the ring round one aeon, the
 * star of fate above. The present moment travels it all along. The spiral
 * folds back into its two forms — Kronos, the straight line; Aion, the
 * circle — and opens again; then its turns stop rhyming and mirror, and
 * rhyme once more. In free play (`&play=free`) both axes are walkable.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together, type Anim } from "../../src/anim"
import { TimeSpiral } from "../../vocabulary/TimeSpiral/TimeSpiral"

export class TimeSpiralDream extends Dream {
  spiral = new TimeSpiral()

  /** Play `anim` over `dt` seconds while the present moment travels. */
  private passing(dt: number, ...anims: Anim[]): void {
    this.play(together(this.spiral.now.by(dt, { easing: "linear" }), ...anims), dt)
  }

  unfold() {
    const t = this.spiral
    void t.parts
    t.seenFrom(this.observer)
    this.set(...this.observer.dolly(1300))
    this.stage(t)
    this.passing(4, Create(t))
    this.passing(4)
    this.passing(2.6, t.stateAxis("time").to("kronos"))
    this.passing(3)
    this.passing(2.6, t.stateAxis("time").to("aion"))
    this.passing(3.5)
    this.passing(2.6, t.stateAxis("time").to("spiral"))
    this.passing(2)
    this.passing(2.2, t.stateAxis("rhyme").to("mirror"))
    this.passing(2.5)
    this.passing(2.2, t.stateAxis("rhyme").to("rhyme"))
    this.passing(3)
  }
}

if (import.meta.main) render(TimeSpiralDream)
