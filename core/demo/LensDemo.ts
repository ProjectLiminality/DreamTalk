/**
 * LensDemo.ts — the abstract made concrete (David's board, 2026-10-13,
 * top right): a thin arrow with a steady stream of blue dots, and a lens
 * on it. The lens lifts toward the camera as a cylinder — its far face
 * stays on the arrow, its near face is the magnified view, bigger only
 * because it is closer. Inside the near face the arrow becomes a road and
 * each dot a truck driving along it, the flow never stopping; then it all
 * goes back. Noosphere → biosphere → noosphere.
 */

import { Dream, render } from "../src/index"
import { Create, together, type Anim } from "../src/index"
import { WHITE } from "../src/constants"
import { Line } from "../src/parts/index"
import { Stream } from "../vocabulary/Stream/Stream"
import { FlowLens } from "../vocabulary/Lens/Lens"

const PATH = [
  { x: -760, y: -230, z: 0 },
  { x: 740, y: -230, z: 0 },
]

export class LensDream extends Dream {
  arrow = new Line({ points: PATH, tint: WHITE, arrowEnd: true, arrowSize: 1.6 })
  stream = new Stream({ path: PATH, count: 12, spacing: 130, speed: 70, radius: 9 })
  lens = new FlowLens(this.stream, {
    observer: this.observer,
    x: -330,
    y: -230,
    radius: 132,
    liftX: 330,
    liftY: 290,
    liftZ: 800,
    creation: 0,
  })

  /** A beat: `dt` seconds in which the flow keeps running. */
  private beat(dt: number, ...anims: Anim[]): void {
    this.play(together(this.stream.time.by(dt, { easing: "linear" }), ...anims), dt)
  }

  unfold() {
    this.stage(this.lens)
    this.beat(1.4, Create(this.arrow))
    this.beat(1.6)
    this.beat(1.2, this.lens.creation.to(1))
    this.beat(0.6)
    this.beat(2.4, this.lens.lift.to(1))
    this.beat(1.2)
    this.beat(3, this.lens.concrete.to(1))
    this.beat(5)
    this.beat(3, this.lens.concrete.to(0))
    this.beat(1)
    this.beat(2.2, this.lens.lift.to(0))
    this.beat(1)
  }
}

if (import.meta.main) render(LensDream)
