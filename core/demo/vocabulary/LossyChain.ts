/**
 * LossyChain.ts — A DreamWeaving
 *
 * The lossy chain: the stages draw on from the ground up and information
 * starts to rise. At first it looks lossless. Then the losses are shown —
 * five kinds, named on the arrows — and the stream thins as it climbs. The
 * note at the warehouse: schema harmony is not semantic harmony. Last, the
 * write path back down, a dashed ghost, is built and starts to flow.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together, type Anim } from "../../src/anim"
import { LossyChain } from "../../vocabulary/LossyChain/LossyChain"

export class LossyChainDream extends Dream {
  chain = new LossyChain({ losses: 0, note: 0 })

  /** Play `anim` over `dt` seconds while the stream keeps rising. */
  private flowing(dt: number, ...anims: Anim[]): void {
    this.play(together(this.chain.time.by(dt, { easing: "linear" }), ...anims), dt)
  }

  unfold() {
    const c = this.chain
    this.stage(c)
    this.flowing(3, Create(c))
    this.flowing(3)
    // The losses, shown: the stream thins as it rises.
    this.flowing(2, c.losses.to(1))
    this.flowing(4)
    this.flowing(1.2, c.note.to(1))
    this.flowing(3)
    // The way back down: unbuilt, then built.
    this.flowing(2.5, c.write.to(1))
    this.flowing(4)
  }
}

if (import.meta.main) render(LossyChainDream)
