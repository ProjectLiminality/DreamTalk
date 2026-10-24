/**
 * EgoLens.ts — A DreamWeaving
 *
 * The ego as a lens: the star draws on, its light comes down the axis and
 * through the lens, spreads over the land, and the lotus opens. Then the
 * three relationships, walked: the ego turns away (the land goes dark, the
 * flower shrivels), back to the icon, and too deep — the lens becomes the
 * cyclops, the light drawn into its eye — and back. In free play
 * (`&play=free`) click the symbol or press its digit.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { EgoLens } from "../../vocabulary/EgoLens/EgoLens"

export class EgoLensDream extends Dream {
  ego = new EgoLens()

  unfold() {
    const { ego } = this
    ego.seenFrom(this.observer)
    this.set(...this.observer.orbit({ theta: 0.32 }), ...this.observer.dolly(1650))
    const relation = ego.stateAxis("relation")
    this.play(Create(ego), 4)
    this.wait(1.5)
    this.play(relation.to("away"), 2.4)
    this.wait(1.5)
    this.play(relation.to("icon"), 2.4)
    this.wait(1.5)
    this.play(relation.to("deep"), 2.4)
    this.wait(1.5)
    this.play(relation.to("icon"), 2.4)
    this.wait(1)
  }
}

if (import.meta.main) render(EgoLensDream)
