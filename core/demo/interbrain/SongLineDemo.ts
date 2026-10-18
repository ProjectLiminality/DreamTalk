/**
 * SongLineDemo — a DreamNode's chain of provenance (InterBrain film
 * 33:21–33:43, f10096–f10186): the node comes up, the clipped
 * conversations arrive one by one above it, oldest first, each arrow
 * carrying the knowledge down toward the node; the chain folds away and
 * grows again.
 *
 * Framing: 0.48 px per unit at 720p. f10141: the node's ring 80 px
 * (167 units) centred at (640, 495) → y −281.
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { Create } from "../../src/verbs"
import { Text } from "../../src/parts/text"
import { SongLine } from "../../vocabulary/SongLine/SongLine"

const PX = 0.48

export class SongLineDemoDream extends Dream {
  line = new SongLine({ size: 80 / PX, y: (360 - 495) / PX })
  title = new Text({ content: "SongLine", size: 72, y: (360 - 640) / PX })

  unfold() {
    this.play(together(Create(this.line), Create(this.title)), 5)
    this.wait(2)
    this.play(this.line.stateAxis("grow").to("bare"), 1.5)
    this.play(this.line.stateAxis("grow").to("chained"), 3)
    this.wait(2)
  }
}

if (import.meta.main) render(SongLineDemoDream)
