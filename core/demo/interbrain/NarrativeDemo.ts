/**
 * NarrativeDemo.ts — A DreamWeaving
 *
 * The Narrative standing alone, as the film sets it beside the Vision
 * (f5686): the white perspective cube draws, the blue ring closes round it.
 * Hold; the ring lets go (the bare cube a mind's head is held in), and
 * closes again. Hold.
 *
 * At the default camera the size is the film's: f5686's front edge, 112 px
 * of 720, is 233 units (Mind's scale, 125.5 px = 261 units).
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { Narrative } from "../../vocabulary/Narrative/Narrative"

export class NarrativeDemoDream extends Dream {
  narrative = new Narrative({ size: 233, stroke: 3.6, ringStroke: 4.2 })

  unfold() {
    this.play(Create(this.narrative), 2)
    this.wait(1.5)
    this.play(this.narrative.ring.to(0), 1)
    this.wait(1)
    this.play(this.narrative.ring.to(1), 1)
    this.wait(1.5)
  }
}

if (import.meta.main) render(NarrativeDemoDream)
