/**
 * RingEye.ts — A DreamWeaving
 *
 * The ring is drawn lying and turns up toward the viewer; through it the
 * watchtower's eye, burning on its tower. The camera turns — the eye
 * follows, looking out through the ring. Then the same ring frames the
 * clear eye: the fire goes out, the slit opens into a round pupil, the
 * lids and the world in it arrive. And back.
 * In free play (?scene=ring-eye&play=free) `gaze` is the axis: click the
 * ring (or its key) to walk watchtower ↔ clear.
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { Create } from "../../src/verbs"
import { RingEye } from "../../vocabulary/RingEye/RingEye"

export class RingEyeDream extends Dream {
  ring = new RingEye({ observer: this.observer, radius: 150, y: 90 })

  unfold() {
    const { ring } = this
    this.set(...this.observer.orbit({ phi: 0, theta: 0.12 }), ...this.observer.dolly(1000))
    const gaze = ring.stateAxis("gaze")
    this.play(Create(ring), 4)
    this.wait(1)
    this.play(together(...this.observer.orbit({ phi: 0.25, theta: 0.6 })), 3)
    this.wait(0.5)
    this.play(gaze.to("clear"), 2.6)
    this.wait(1.5)
    this.play(together(...this.observer.orbit({ phi: -0.55, theta: 0.2 })), 3)
    this.wait(0.5)
    this.play(gaze.to("watchtower"), 2.6)
    this.wait(1)
    this.play(together(...this.observer.orbit({ phi: 0, theta: 0.12 })), 2.5)
    this.wait(1)
  }
}

if (import.meta.main) render(RingEyeDream)
