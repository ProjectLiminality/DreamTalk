/**
 * RealTalkWord.ts — A DreamWeaving
 *
 * Ass talk ↔ real talk: ASSTALK in its cloud, the speech lines going out;
 * the cloud lies down into the ground line, the A steps over, the S's are
 * re-cut into R, E and L — REALTALK. Hold, and back.
 * In free play (?scene=realtalk-word&play=free) `real` is the axis: click
 * the word (or its key) to walk ass ↔ real.
 */

import { Dream, render } from "../../src/index"
import { RealTalkWord } from "../../vocabulary/RealTalkWord/RealTalkWord"

export class RealTalkWordDream extends Dream {
  word = new RealTalkWord({ size: 150 })

  unfold() {
    this.stage(this.word)
    this.wait(1.2)
    this.play(this.word.real.to(1), 3)
    this.wait(1.5)
    this.play(this.word.real.to(0), 3)
    this.wait(1)
  }
}

if (import.meta.main) render(RealTalkWordDream)
