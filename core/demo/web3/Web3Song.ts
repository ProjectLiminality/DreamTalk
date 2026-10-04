/**
 * Web3Song.ts — A DreamSong
 *
 * "Liminal Consulting — Decentralizing Web3 Insights" (2024), whole: the
 * seventeen shots as chapters of ONE composition, carrying David's own
 * voice-over. Like OriginsPitch there is no global offset: song time T IS
 * video time, so reference frame refs/web3/frames/f_000NN sits at T ≈ NN and
 * the song's 171.0s is the video's 170.97s.
 *
 * THE CHAPTERS, AND WHERE EACH WINDOW CAME FROM
 *
 * Every boundary below was read off the final render at 4fps (frames
 * extracted from LiminalConsultingWeb3Final.mov, 0.25s apart), not taken from
 * the recon's 1fps table:
 *
 *   ch  shots  scene               in      window          into it
 *    1   1     Shot01Globe          0.00    0.00 –   4.50   —
 *    2   2–3   YinYang              4.00    4.00 –  22.00   crossfade 0.5
 *    3   4–5   Web2 (retimed)      21.50   21.50 –  31.75   crossfade 0.5
 *    4   6     Shot06Web3Word      30.75   30.75 –  46.75   crossfade 1.0
 *    5   7–8   Clarity (retimed)   45.00   45.00 –  61.50   crossfade 1.75
 *    6   9     Shot09Quote         61.50   61.50 –  78.75   cut
 *    7  10–11  NodeNet (retimed)   78.75   78.75 –  94.50   cut
 *    8  12     Shot12Vitruvian     93.75   93.75 – 107.00   crossfade 0.75
 *    9  13     Light (retimed)    106.00  106.00 – 119.75   crossfade 1.0
 *   10  14     Shot14Callback     118.50  118.50 – 130.00   crossfade 1.25
 *   11  15     Shot15Hero         130.00  130.00 – 146.00   cut
 *   12  16     Portrait (retimed) 145.00  145.00 – 158.75   crossfade 1.0
 *   13  17     Closing (retimed)  158.75  158.75 – 171.00   cut
 *
 * Two of the original's transitions are not reproduced and are stated here
 * rather than faked: the zoom INTO the blue node that ends the yin-yang
 * (20.5–21.75) and the two vertical slide-wipes (106–107, 144.75–146). All
 * three are crossfades here. A slide needs the two chapters' cameras to move
 * as one, which DreamSong's transitions do not yet offer.
 *
 * RETIMED, NOT REBUILT. Six set-pieces were scored standalone at their own
 * pace, which the final render does not keep. Each is subclassed below with
 * an unfold() that keeps every holon and changes only WHEN things happen,
 * measured from the frames. The set-pieces themselves are untouched.
 *
 * THE VOICE-OVER
 *
 * David's fourteen recordings (Video/Audio/01_…14_*.m4a) were placed by
 * cross-correlating each against the final mix's audio — chunk by chunk, so
 * that the edits inside a take showed up as jumps in its offset. Several
 * takes were cut in the original edit (01 loses its false start, 02 its
 * retake of 01, 04 is three pieces with tightened gaps, 06 is one of three
 * "Vitalik put it best"s), so the cache holds the USED pieces, each imported
 * under the exact words it says (scripts/import-voice.ts, voice "David").
 * Each line's slot is the measured length of its recording, stated in the
 * score — never read from audio at play time.
 *
 * Two recordings are NOT placed, because they are not in the final mix:
 * 07_if_the_thing (David reading the quote — the mix correlates with
 * VitalikQuote.mp3 at 63.3s instead) and 14_I_would_love (an alternate take;
 * 13 already says those words). The Vitalik quote keeps the voice the Quote
 * holon already carries — that choice is David's and is not made here.
 * No soundtrack: the 3Blue1Brown score is David's call too.
 */

import { DreamSong } from "../../src/song"
import { crossfade } from "../../src/transitions"
import { together } from "../../src/anim"
import { Create, FadeIn, FadeOut } from "../../src/verbs"
import { Write } from "../../src/parts/text"
import { TAU } from "../../src/constants"
import { Shot01GlobeDream } from "./Shot01Globe"
import { YinYangDream } from "./YinYang"
import { Web2DisintegratingDream } from "./Web2Disintegrating"
import { Shot06Web3WordDream } from "./Shot06Web3Word"
import { ClarityFieldDream } from "./ClarityField"
import { Shot09QuoteDream } from "./Shot09Quote"
import { NodeNetworkDream } from "./NodeNetwork"
import { Shot12VitruvianDream } from "./Shot12Vitruvian"
import { LightSpreadDream, SPIN_END } from "./LightSpread"
import { Shot14CallbackDream } from "./Shot14Callback"
import { Shot15HeroDream } from "./Shot15Hero"
import { PortraitCardDream } from "./PortraitCard"
import { ClosingDream } from "./Closing"

// --- the retimed set-pieces ---------------------------------------------

/** Shots 4–5: fades in whole at 22–23, holds, collapses 26–32. */
class Web2Shot extends Web2DisintegratingDream {
  override unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.stage(this.lattice)
    this.wait(0.5)
    this.play(this.assemble.creation.to(1), 1)
    this.wait(3)
    this.play(this.collapse.creation.to(1, { easing: "easeIn" }), 6)
  }
}

/** Shots 7–8: the field gathers 45–47.5; the clarity disc arrives 50–51.5. */
class ClarityShot extends ClarityFieldDream {
  override unfold() {
    this.stageField()
    this.play(this.burst.creation.to(1, { easing: "easeOut" }), 2.5)
    this.wait(2.5)
    this.play(this.clarity.creation.to(1), 1.5)
    this.wait(10)
  }
}

/** Shots 10–11: nodes drift 78.75–86.5, wire up to 89.5, crystals by 92.75. */
class NodeShot extends NodeNetworkDream {
  override unfold() {
    const crystals = [this.octa, this.icosa, this.tetra, this.cube]
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.stage(this.mesh)
    this.stage(this.cloud)
    for (const c of crystals) this.stage(c)
    this.play(this.gather.creation.to(1), 3)
    this.wait(4.75)
    this.play(this.connect.creation.to(1, { easing: "linear" }), 3)
    this.wait(0.25)
    this.play(
      together(
        [this.crystallise.creation.to(1), 0, 0.6],
        [together(...crystals.map((c) => FadeIn(c))), 0, 0.6],
        ...crystals.map((c) => c.spin.to(TAU * 0.5, { easing: "linear" })),
      ),
      4.75,
    )
  }
}

/**
 * Shot 13: the outline globe turns 106–110.5, the insight ignites and floods
 * 110.5–113, the arcs wrap it 113–118. The standalone scene holds the
 * cursor for its placeholder narration before the arcs, which pushed them
 * past this chapter's cut; the song's timing is the frames'.
 */
class LightShot extends LightSpreadDream {
  override unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.outline.spin.follow(this.fill.spin.map((s) => s))
    for (const h of [this.fill, this.outline, this.hotspot, this.arcs]) this.stage(h)
    // One continuous turn under all three beats (the frames never pause it).
    this.play(
      together(
        this.spin.creation.to(1, { easing: "linear" }),
        this.fill.spin.to(SPIN_END, { easing: "linear" }),
        [this.ignite.creation.to(1), 4.5 / 12, 7 / 12],
        [this.fill.landOpacity.to(1), 4.5 / 12, 7 / 12],
        [this.spread.creation.to(1, { easing: "linear" }), 7 / 12, 1],
      ),
      12,
    )
    this.wait(2)
  }
}

/** Shot 16: the ring at 145–146, held to 156.5, gone by 157.25. */
class PortraitShot extends PortraitCardDream {
  override unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    for (const h of [this.plate, this.ring, this.label, this.note]) this.stage(h)
    this.play(together(Create(this.ring), [FadeIn(this.plate), 0.2, 1]), 1)
    this.play(together(FadeIn(this.label), [FadeIn(this.note), 0.3, 1]), 1)
    this.wait(9.5)
    this.play(
      together(FadeOut(this.ring), FadeOut(this.plate), FadeOut(this.label), FadeOut(this.note)),
      0.75,
    )
  }
}

/**
 * Shot 17, in the order the frames show — blue circle (158.75–160), the A
 * (160–161), THEN the red circle (161–162.5), the title (163.5–165) — and it
 * holds to the end of the film. The standalone scene draws both circles
 * together and fades out; the final render does neither.
 */
class ClosingShot extends ClosingDream {
  constructor() {
    super()
    // The title is Manim's serif in the final render.
    this.title.font = "Times-Roman"
  }

  override unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.play(Create(this.blue), 1.25)
    this.play(Create(this.mark), 1)
    this.play(Create(this.red), 1.5)
    this.wait(1)
    this.play(Write(this.title), 1.5)
    this.wait(6)
  }
}

// --- the voice-over -----------------------------------------------------

/**
 * Every line of the final mix: [start (s), stated length (s), words, voice].
 * Start = where the piece sits in the mix (cross-correlation, see header);
 * length = the imported piece's ffprobe duration.
 */
export const WEB3_VOICEOVER: readonly (readonly [number, number, string, string?])[] = [
  [3.94, 6.3, "As most of us can feel by now, we are living through an unprecedented period in human history."],
  [11.01, 7.9, "Never before have our collective challenges seemed more daunting, and our dreams of a more beautiful world seemed more within reach."],
  [20.27, 9.2, "As the era of centralization is coming to an end, with our top-down control structures slowly but surely disintegrating under their own weight,"],
  [29.47, 4.03, "A new culture has emerged around the idea of Web3,"],
  [33.51, 5.8, "seeking to direct this enormous potential towards a more beautiful and decentralized future."],
  [40.41, 12.2, "However, as of now, the understanding of how these decentralized technologies this collective genius is creating actually work remains centralized to a comparably small class of developers,"],
  [52.95, 6.9, "constituting one of the most crucial remaining bottlenecks for building a more resilient and decentralized future."],
  [60.47, 2.0, "Vitalik put it best:"],
  // The quote, in the voice the Quote holon carries — the exact line and
  // voice QuoteDemo speaks, so the recording already in the cache answers.
  [63.28, 7.93, "\"If the thing technically runs on 50,000 computers but only 42 people know how it works, your decentralization-index is not 50,000 — it's 42.\"", "VitalikButerin"],
  [73.3, 2.7, "So, how do we address this issue?"],
  [77.62, 5.7, "The by far most effective means for spreading the light of understanding are visual metaphors."],
  [83.97, 2.9, "Symbols that help people connect the dots"],
  [87.5, 3.95, "and perceive the clarity behind the complexity."],
  [93.36, 8.87, "A visual way of communicating ideas, much more fundamental than the many different languages spoken around the world today."],
  [102.36, 2.6, "A universal language"],
  [105.71, 1.75, "for a universal movement,"],
  [107.48, 10.96, "not limited by superficial differences in location or cultural background, but united by the greater cause of serving all of mankind."],
  [118.45, 16.89, "By upgrading our capacity to communicate these profound ideas with clarity, we can effectively widen the circle of understanding and thus unleash this movement's full potential in bringing about the more beautiful world our hearts know is possible."],
  [136.27, 20.18, "If you are holding a piece of this puzzle that has the potential to change the world but as of now is not being widely understood as such, I would love to help you communicate your unique innovation to this space so it can naturally attract the minds and resources that will help you make it a reality."],
]

/** David's voice — the name the recordings were imported under. */
export const DAVID_VOICE = "David"

export class Web3Dream extends DreamSong {
  constructor() {
    super([
      { scene: Shot01GlobeDream, span: 4.5 }, //            0.00 –   4.50
      [{ scene: YinYangDream, span: 18 }, crossfade(0.5)], //   4.00 –  22.00
      [{ scene: Web2Shot, span: 10.25 }, crossfade(0.5)], //   21.50 –  31.75
      [{ scene: Shot06Web3WordDream, span: 16 }, crossfade(1)], // 30.75 – 46.75
      [{ scene: ClarityShot, span: 16.5 }, crossfade(1.75)], // 45.00 –  61.50
      { scene: Shot09QuoteDream, span: 17.25 }, //          61.50 –  78.75
      { scene: NodeShot, span: 15.75 }, //                  78.75 –  94.50
      [{ scene: Shot12VitruvianDream, span: 13.25 }, crossfade(0.75)], // 93.75 – 107.00
      [{ scene: LightShot, span: 13.75 }, crossfade(1)], // 106.00 – 119.75
      [{ scene: Shot14CallbackDream, span: 11.5 }, crossfade(1.25)], // 118.50 – 130.00
      { scene: Shot15HeroDream, span: 16 }, //              130.00 – 146.00
      [{ scene: PortraitShot, span: 13.75 }, crossfade(1)], // 145.00 – 158.75
      { scene: ClosingShot, span: 12.25 }, //               158.75 – 171.00
    ])
  }

  /**
   * The voice-over is the SONG's score, not any chapter's: the chapters'
   * own placeholder say() lines are not carried (DreamSong places clips,
   * not narration). Placed first, at absolute times, then the cursor is
   * returned to 0 for the chapters.
   */
  override unfold(): void {
    let cursor = 0
    for (const [start, duration, text, voice] of WEB3_VOICEOVER) {
      this.wait(start - cursor)
      cursor = start
      this.say(text, { voice: voice ?? DAVID_VOICE, duration })
    }
    this.wait(-cursor)
    super.unfold()
  }
}
