/**
 * FlowMap.ts — A DreamWeaving
 *
 * The value flow map walking its own state space: the group draws on with its
 * members; the grain reveals the categories (two discs shrink in from the
 * rim into a vesica, the sites take their colours) and folds back; the flow
 * layers switch on one by one — raw material in (ghosted: conjecture),
 * semi-finished, finished out; the whole map tilts into the stage stack,
 * the categories return in 3D, and it all lays flat and face-on again.
 *
 * Time runs through every step (`flowing`), so the particles never stop.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together, type Anim } from "../../src/anim"
import { FlowMap } from "../../vocabulary/FlowMap/FlowMap"

export class FlowMapDream extends Dream {
  map = new FlowMap({ radius: 300 })

  /** Play `anim` over `dt` seconds while the flow keeps running. */
  private flowing(dt: number, ...anims: Anim[]): void {
    this.play(together(this.map.time.by(dt, { easing: "linear" }), ...anims), dt)
  }

  unfold() {
    const m = this.map
    // Orthographic: the stage stack reads like the board's drawing — every
    // slice the same size at the same slant — instead of fanning open under
    // perspective. ~1300 units of picture height.
    const o = this.observer
    o.orthographic.value = o.orthographic.defaultValue = true
    o.zoom.value = o.zoom.defaultValue = 1023 / (1300 * (16 / 9))
    this.stage(m)

    this.flowing(3, Create(m))
    this.flowing(1)
    // Grain: the categorical dimension, revealed and folded away again.
    this.flowing(2.5, m.grain.to(1))
    this.flowing(1.5)
    this.flowing(2, m.grain.to(0))
    this.flowing(0.5)
    // The flow layers, in the value chain's order.
    this.flowing(1.6, m.stage("raw").shown.to(1))
    this.flowing(1.6, m.stage("semi").shown.to(1))
    this.flowing(1.6, m.stage("finished").shown.to(1))
    this.flowing(3)
    // The chain's order as a dimension: tilt into the stage stack.
    this.flowing(3, m.expand.to(1))
    this.flowing(2.5)
    this.flowing(2.5, m.grain.to(1))
    this.flowing(3)
    // And back: flat, face-on, exactly.
    this.flowing(3, m.expand.to(0))
    this.flowing(3)
  }
}

if (import.meta.main) render(FlowMapDream)
