/**
 * Parody.ts — A DreamWeaving
 *
 * The real and its parody in one place, seen face-on as the whiteboard drew
 * them: the red ring, whole; the counterfeit takes its place piece by piece
 * from the top (a ring of blue squares — alike, at a distance). The camera
 * turns and the difference shows: separate cubes. Back to the real, turned;
 * and face-on again.
 * In free play (?scene=parody&play=free) `parody` is the axis: click the
 * ring (or its key) to walk real ↔ parody.
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { Parody } from "../../vocabulary/Parody/Parody"

export class ParodyDream extends Dream {
  ring = new Parody({ observer: this.observer, radius: 160, stroke: 2.4 })

  unfold() {
    this.set(...this.observer.orbit({ phi: 0, theta: 0 }), ...this.observer.dolly(720))
    this.stage(this.ring)
    this.wait(1)
    this.play(this.ring.parody.to(1), 3)
    this.wait(0.5)
    this.play(together(...this.observer.orbit({ phi: 0.45, theta: 0.5 })), 3)
    this.wait(0.5)
    this.play(this.ring.parody.to(0), 3)
    this.wait(0.5)
    this.play(together(...this.observer.orbit({ phi: 0, theta: 0 })), 2.5)
    this.wait(1)
  }
}

if (import.meta.main) render(ParodyDream)
