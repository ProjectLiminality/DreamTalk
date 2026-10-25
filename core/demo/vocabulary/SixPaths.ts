/**
 * SixPaths.ts — A DreamWeaving
 *
 * The six paths draw themselves on — three axes from one centre, the
 * octahedron round them, the six names — and the flow begins: in through the
 * perceptions, out through the expressions. The light walks the three pairs
 * (causal, trans-causal, immanent); the flow narrows to perception alone,
 * then to expression alone; and the figure turns until the perception face
 * meets the eye and the two triangles stand as the hexagram.
 * In free play (`&play=free`) the three axes are walkable and the flow runs.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together, type Anim } from "../../src/anim"
import { SixPaths } from "../../vocabulary/SixPaths/SixPaths"

export class SixPathsDream extends Dream {
  paths = new SixPaths({ radius: 400 })

  /** Play `anim` over `dt` seconds while the flow keeps running. */
  private flowing(dt: number, ...anims: Anim[]): void {
    this.play(together(this.paths.time.by(dt, { easing: "linear" }), ...anims), dt)
  }

  unfold() {
    const s = this.paths
    void s.parts
    s.seenFrom(this.observer)
    const focus = s.stateAxis("focus")
    const mode = s.stateAxis("mode")
    this.flowing(5, Create(s))
    this.flowing(3)
    this.flowing(1.4, focus.to("causal"))
    this.flowing(2.5)
    this.flowing(1.4, focus.to("trans-causal"))
    this.flowing(2.5)
    this.flowing(1.4, focus.to("immanent"))
    this.flowing(2.5)
    this.flowing(1.4, focus.to("all"))
    this.flowing(2)
    this.flowing(2, mode.to("perception"))
    this.flowing(3)
    this.flowing(2.5, mode.to("expression"))
    this.flowing(3)
    this.flowing(2, mode.to("whole"))
    this.flowing(2.5, s.stateAxis("view").to("hexagram"))
    this.flowing(5)
    this.flowing(2.5, s.stateAxis("view").to("upright"))
    this.flowing(2)
  }
}

if (import.meta.main) render(SixPathsDream)
