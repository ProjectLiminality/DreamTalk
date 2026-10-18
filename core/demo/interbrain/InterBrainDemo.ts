/**
 * InterBrainDemo — the InterBrain's face standing alone, then in its ring.
 *
 * The crystal draws and darkens round its heart, the Logo makes itself
 * there; then, as in the film (f8221, f12376), the face goes into a red
 * ring — a DreamNode, `dreamTint` red — and is held.
 *
 * Framing (default observer, 0.48 px per unit at 720p): f12376's ring is
 * 134 px (radius 279), its crystal's half-height 122 px — 0.91 of the ring.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { RED } from "../../src/constants"
import { DreamNode } from "../../vocabulary/DreamNode/DreamNode"
import { InterBrain } from "../../vocabulary/InterBrain/InterBrain"

const PX = 0.48

export class InterBrainDemoDream extends Dream {
  face = new InterBrain({ radius: 300 })
  node = new DreamNode({ radius: 134 / PX, dreamTint: RED, faceFill: 122 / 134, face: this.face })

  unfold() {
    void this.node.parts // compose() is lazy: the ring exists once it has run
    this.play(Create(this.face), 3)
    this.wait(1)
    this.play(this.node.ring.creation.sequence(0, 1), 2)
    this.wait(2)
  }
}

if (import.meta.main) render(InterBrainDemoDream)
