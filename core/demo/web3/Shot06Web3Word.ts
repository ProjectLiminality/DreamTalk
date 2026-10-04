/**
 * Shot06Web3Word — shot 6 (≈31–45s): "Web3" self-organising out of the
 * debris of the Web2 triangle.
 *
 * The set-piece is FlowerTextDemo's word, unchanged; this shot only retimes
 * it to the reference, which the frames at 4fps (refs, 30.75–36s) pin down:
 *
 *   30.75–31.75  the cloud arrives FROM BELOW — the falling Web2 circles
 *                pour into it at the bottom of the frame, so the cloud rises
 *                into place rather than appearing at the centre;
 *   31–33.6      the circles gather into the letters (ease-out — fast, then
 *                a gentle arrival). At 33s "Web" already reads with a loose
 *                "3"; by 35s the word is crisp;
 *   35.5–45      the word holds while the voice-over runs on.
 *
 * So the settle is ~4s here, not the standalone demo's 7s: the original's
 * effect is quicker than the demo chose to show it.
 */

import { together } from "../../src/anim"
import { FlowerText } from "../../vocabulary/FlowerText/FlowerText"
import { FlowerTextDemoDream, web3Mask } from "./FlowerTextDemo"

/** How far below its rest the cloud starts, in scene units. */
const RISE_FROM = -300
/**
 * The word as the frame has it (40s, 1280w): 742 × 226px, centred 13px
 * above the frame's middle — the demo's word drawn 0.78× as large, its
 * ringlets with it.
 */
const WORD_HEIGHT = 172
const REST_Y = 10

export class Shot06Web3WordDream extends FlowerTextDemoDream {
  override word = new FlowerText({
    mask: web3Mask(WORD_HEIGHT),
    circleRadius: 4.8,
    spacing: 6,
    settle: 0,
    scatterDistance: 260,
    scatterMin: 25,
    seed: 7,
    stroke: 1.5,
    circleOpacity: 0.85,
  })

  override unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.stage(this.word)
    this.set(this.word.y.to(RISE_FROM))

    // Re-measured at 4fps (the red cloud's median height): it enters the
    // bottom of frame at ~31.1 and reaches rest at ~33.4 — so the rise
    // starts 0.35s into the chapter and takes 2.3s.
    this.wait(0.35)
    this.play(
      together(
        [this.word.y.to(REST_Y, { easing: "easeOut" }), 0, 0.48],
        [this.word.settle.to(1, { easing: "easeOut" }), 0.02, 0.6],
      ),
      4.75,
    )
    // Held to the chapter's end (46.75).
    this.wait(10.9)
  }
}
