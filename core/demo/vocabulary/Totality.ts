/**
 * Totality.ts — A DreamWeaving
 *
 * The cross, drawn flat: horizontality, then verticality. The bar opens
 * into a plane with the vertical its normal, and closes again. Then the
 * figure turns to show the third axis the flat cross hid — totality, behind
 * the intersection — with the icons strung down it, and turns back as the
 * eye comes into the intersection: down the line, the cross repeats in
 * itself, endlessly, receding. And back out to the cross.
 * In free play (?scene=totality&play=free): `t` through, `p` the plane.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together, type Anim } from "../../src/anim"
import { Totality } from "../../vocabulary/Totality/Totality"

export class TotalityDream extends Dream {
  cross = new Totality()

  /** Play `anim` over `dt` seconds while the tunnel flows. */
  private flowing(dt: number, ...anims: Anim[]): void {
    this.play(together(this.cross.fall.by(dt, { easing: "linear" }), ...anims), dt)
  }

  unfold() {
    const c = this.cross
    c.seenFrom(this.observer)
    this.stage(c)
    this.flowing(2.5, Create(c))
    this.flowing(1)
    this.flowing(2.2, c.plane.to(1))
    this.flowing(1.5)
    this.flowing(2.2, c.plane.to(0))
    this.flowing(1)
    // Through the intersection, down the third axis.
    this.flowing(5, c.through.to(1))
    this.flowing(8)
    this.flowing(4, c.through.to(0))
    this.flowing(1)
  }
}

if (import.meta.main) render(TotalityDream)
