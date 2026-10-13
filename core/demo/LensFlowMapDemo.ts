/**
 * LensFlowMapDemo.ts — the Lens on a live FlowMap flow.
 *
 * The value flow map shows its flow layers and tilts into the stage stack;
 * then a lens settles on a raw-material flow, rides it, and lifts. In its
 * window the flow is made concrete — a road lying in the stack's own
 * ground plane (the plane the flow runs through), trucks driving it — and
 * the flow never stops. Then it goes abstract again and the lens lowers.
 *
 * The camera is FlowMap's orthographic one, so the lens magnifies by
 * `zoom` (an orthographic camera has no closeness to magnify with).
 */

import { Dream, render } from "../src/index"
import { Create } from "../src/verbs"
import { together, type Anim } from "../src/anim"
import { FlowMap } from "../vocabulary/FlowMap/FlowMap"
import { FlowLens } from "../vocabulary/Lens/Lens"

export class LensFlowMapDream extends Dream {
  map = new FlowMap({ radius: 300 })

  /** The map composed up front, so its stack — the flows' frame — exists. */
  stack = (void this.map.parts, this.map.stack)

  lens = new FlowLens(
    {
      // The first raw-material flow: its path in the stack's frame, its particles.
      path: () => this.map.stage("raw").flows[0]!.path(),
      particles: () => this.map.stage("raw").flows[0]!.particles(),
      frame: this.stack,
    },
    {
      observer: this.observer,
      at: 0.5,
      radius: 52,
      zoom: 2.7,
      liftX: -110,
      liftY: 345,
      liftZ: 400,
      align: 1,
      alignTo: this.stack,
      dotRadius: 6,
      symbolSize: 1.15,
      creation: 0,
    },
  )

  private flowing(dt: number, ...anims: Anim[]): void {
    this.play(together(this.map.time.by(dt, { easing: "linear" }), ...anims), dt)
  }

  unfold() {
    const o = this.observer
    o.orthographic.value = o.orthographic.defaultValue = true
    o.zoom.value = o.zoom.defaultValue = 1023 / (1300 * (16 / 9))
    this.stage(this.map)
    this.stage(this.lens)
    const m = this.map
    this.flowing(2.5, Create(m))
    this.flowing(1.2, m.stage("raw").shown.to(1))
    this.flowing(1.2, m.stage("semi").shown.to(1))
    this.flowing(1.2, m.stage("finished").shown.to(1))
    this.flowing(3, m.expand.to(1))
    this.flowing(0.8)
    this.flowing(1.2, this.lens.creation.to(1))
    this.flowing(2.4, this.lens.lift.to(1))
    this.flowing(1)
    this.flowing(3, this.lens.concrete.to(1))
    this.flowing(5)
    this.flowing(3, this.lens.concrete.to(0))
    this.flowing(0.6)
    this.flowing(2.2, this.lens.lift.to(0))
    this.flowing(1)
  }
}

if (import.meta.main) render(LensFlowMapDream)
