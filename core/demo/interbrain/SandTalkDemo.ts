/**
 * SandTalkDemo — SandTalk standing alone (f5941, f5986, f8656).
 *
 * The circle of conversation draws, the fire is lit, the two sit down at
 * it, the Vision lights in each brow and the seed is drawn in the sand.
 * Hold. At the default camera (0.48 px per unit at 720p) the ring is the
 * film's: 425 px half-width (f8656).
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { SandTalk } from "../../vocabulary/SandTalk/SandTalk"

const PX = 0.48

export class SandTalkDemoDream extends Dream {
  talk = new SandTalk({ size: 425 / PX, vision: 0 })

  unfold() {
    this.play(Create(this.talk), 4)
    this.play(this.talk.vision.to(1), 1.5)
    this.wait(2)
  }
}

if (import.meta.main) render(SandTalkDemoDream)
