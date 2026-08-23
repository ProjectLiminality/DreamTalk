/**
 * TextShowcase.ts — A DreamWeaving
 *
 * The Write verb on parade: video-01's three text moments in sequence.
 * Scene07's "trans-perspectival" (height 50) writes on per letter,
 * holds, and un-writes; then Scene09's "thesis"/"anti-thesis" pair
 * (height 30) writes flanking the centre, gives way to "syn-thesis";
 * and Scene10's "dialectical thinking" caption closes.
 *
 * Every one of these is a single param animating: `creation` 0 → 1 on
 * a linear track. The per-letter domino cascade — each letter's window,
 * its wipe-on and its settle to solid — lives entirely in the glyph
 * shader (render/text.ts), which is why the whole scene is this short.
 *
 * NOTE: this scene renders only once ThreeHost dispatches on Text; the
 * three-line wiring diff is in render/text.ts's header TODO. Until
 * then, demo/text-harness.html is the rig that exercises the pipeline.
 */

import { Dream, render } from "../src/index"
import { together } from "../src/anim"
import { FadeOut } from "../src/verbs"
import { Text, Write, UnWrite } from "../src/parts/text"
import { BLUE, RED } from "../src/constants"

export class TextShowcaseDream extends Dream {
  transPerspectival = new Text({ content: "trans-perspectival", size: 50 })
  thesis = new Text({ content: "thesis", size: 30, x: -200, y: -120, tint: BLUE })
  antithesis = new Text({ content: "anti-thesis", size: 30, x: 200, y: -120, tint: RED })
  synthesis = new Text({ content: "syn-thesis", size: 30, y: -120 })
  caption = new Text({ content: "dialectical thinking", size: 30, y: -150 })

  unfold() {
    this.set(...this.observer.dolly(560))

    // Scene07: the word writes on, holds ~1s, un-writes.
    this.play(Write(this.transPerspectival), 2)
    this.wait(1)
    this.play(UnWrite(this.transPerspectival), 1.5)
    this.wait(0.3)

    // Scene09: thesis and anti-thesis, then their synthesis.
    this.play(Write(this.thesis), 1.5)
    this.play(Write(this.antithesis), 1.5)
    this.wait(0.5)
    this.play(together(UnWrite(this.thesis), UnWrite(this.antithesis)), 1.2)
    this.play(Write(this.synthesis), 1.5)
    this.wait(0.5)
    this.play(UnWrite(this.synthesis), 1.2)
    this.wait(0.3)

    // Scene10: the closing caption.
    this.play(Write(this.caption), 2)
    this.wait(1)
    this.play(FadeOut(this.caption), 1)
  }
}

if (import.meta.main) render(TextShowcaseDream)
