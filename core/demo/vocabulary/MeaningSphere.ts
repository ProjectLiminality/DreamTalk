/**
 * MeaningSphere.ts — A DreamWeaving
 *
 * The sphere of meaning draws itself on — from the diabolic pole the
 * meridians spread to the equator and gather at the symbolic — and the flow
 * begins to run. It flattens into the idolic disk (breadth without depth:
 * everything spreads, nothing returns), rises again into the sphere, and the
 * reading turns round: the symbolic gives, the diabolic takes. Then back.
 * In free play (`&play=free`) the two axes are walkable and the flow runs.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together, type Anim } from "../../src/anim"
import { MeaningSphere } from "../../vocabulary/MeaningSphere/MeaningSphere"

export class MeaningSphereDream extends Dream {
  sphere = new MeaningSphere({ radius: 420, y: -70 })

  /** Play `anim` over `dt` seconds while the flow keeps running. */
  private flowing(dt: number, ...anims: Anim[]): void {
    this.play(together(this.sphere.time.by(dt, { easing: "linear" }), ...anims), dt)
  }

  unfold() {
    const m = this.sphere
    void m.parts
    m.seenFrom(this.observer)
    this.flowing(4, Create(m))
    this.flowing(5)
    this.flowing(3, m.stateAxis("depth").to("idolic"))
    this.flowing(4)
    this.flowing(3, m.stateAxis("depth").to("iconic"))
    this.flowing(2)
    this.flowing(2.5, m.stateAxis("reading").to("giving"))
    this.flowing(5)
    this.flowing(2.5, m.stateAxis("reading").to("rising"))
    this.flowing(3)
  }
}

if (import.meta.main) render(MeaningSphereDream)
