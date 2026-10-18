/**
 * InterBrainDemo — the InterBrain symbol, its gem, and the unfold.
 *
 *   ib-interbrain         the symbol: the red flower-of-life sphere draws on,
 *                         a gem in every node, the Logo makes itself at its
 *                         heart; it turns. In free play (`&play=free`) click
 *                         it, or press `u`: it unfolds into what it holds.
 *   ib-interbrain-unfold  the unfold played: symbol → the gems released as
 *                         DreamNodes, a liminal web of friends and dreams
 *                         round the Logo, the song's chapters as a song line
 *                         — and folded back.
 *   ib-interbrain-gem     the small icon (InterBrainGem) standing alone, then
 *                         in its red ring, as the film rings it (f8221, f12376).
 *
 * Framing (default observer, 0.48 px per unit at 720p): f11941's sphere is
 * 193 px (radius 402); f12376's ring is 134 px (radius 279), its crystal's
 * half-height 122 px — 0.91 of the ring.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together } from "../../src/anim"
import { RED } from "../../src/constants"
import { DreamNode } from "../../vocabulary/DreamNode/DreamNode"
import { InterBrain } from "../../vocabulary/InterBrain/InterBrain"
import { InterBrainGem } from "../../vocabulary/InterBrain/InterBrainGem"

const PX = 0.48

export class InterBrainDemoDream extends Dream {
  ib = new InterBrain({ radius: 193 / PX })

  unfold() {
    const { ib } = this
    void ib.parts
    ib.seenFrom(this.observer) // real 3-D: the horizon and the discs follow the camera's orbit
    this.play(Create(ib), 4)
    this.play(ib.sphere.spin.to(ib.sphere.spin.value + 0.5), 4)
  }
}

export class InterBrainUnfoldDemoDream extends Dream {
  ib = new InterBrain({ radius: 150 / PX })

  unfold() {
    const { ib } = this
    void ib.parts
    ib.seenFrom(this.observer)
    const unfold = ib.stateAxis("unfold")
    this.play(Create(ib), 3)
    this.wait(1)
    this.play(unfold.to("unfolded"), 4)
    this.wait(2.5)
    this.play(unfold.to("symbol"), 3)
    this.play(ib.sphere.spin.to(ib.sphere.spin.value + 0.3), 2)
  }
}

export class InterBrainGemDemoDream extends Dream {
  face = new InterBrainGem({ radius: 300 })
  node = new DreamNode({ radius: 134 / PX, dreamTint: RED, faceFill: 122 / 134, face: this.face })

  unfold() {
    void this.node.parts // compose() is lazy: the ring exists once it has run
    this.play(Create(this.face), 3)
    this.wait(1)
    this.play(together(this.node.ring.creation.sequence(0, 1)), 2)
    this.wait(2)
  }
}

if (import.meta.main) render(InterBrainDemoDream)
