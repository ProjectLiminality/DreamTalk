/**
 * Shot09Quote — shot 9 (≈61.5–78.75s): Vitalik's line written over the
 * receding field of complexity.
 *
 * A composition of two existing pieces: the ClarityField (its fourth beat,
 * `veil`, exists for this shot) and the Quote holon exactly as QuoteDemo
 * carries it. What the frames show at 4fps (refs, 61–80s):
 *
 *   61.5–63      the clarity disc fades out and the field dims further;
 *   63.25–70.75  the three lines write on, cascading (the Manim source's
 *                lag 0.9); the attribution follows at ~71.25–72;
 *   74.0–74.75   the quote fades out over the still-dim field;
 *   75.0–76.0    the clarity disc comes back;
 *   76–78.75     it holds — then its dots fly out into the node cloud of
 *                shot 10 (the next chapter).
 *
 * WHOSE VOICE. The line is spoken in the song by the recording Quote already
 * carries (VitalikButerin) — David's pending decision, deliberately left as
 * it was. The say() lives in the song (Web3Song), with the rest of the
 * voice-over, so this shot is silent on its own.
 */

import { FadeOut } from "../../src/verbs"
import { Quote } from "../../vocabulary/Quote/Quote"
import { ClarityFieldDream } from "./ClarityField"

/** The quote's words — verbatim from the Manim source (see QuoteDemo). */
export const VITALIK_LINES = [
  '"If the thing technically runs on 50,000 computers',
  "but only 42 people know how it works,",
  "your decentralization-index is not 50,000 — it's 42.\"",
]

export class Shot09QuoteDream extends ClarityFieldDream {
  quote = new Quote({
    lines: VITALIK_LINES,
    attribution: "Vitalik Buterin",
    voice: "VitalikButerin",
    size: 33,
    lineHeight: 1.75,
    attributionPlacement: "right",
    attributionScale: 1.05,
    // The original is Manim's default serif; and the block measured on
    // f_00072 spans ~187–620px either side of centre — the holon's 0.58em width
    // estimate is tuned for a sans and overshoots in Times.
    font: "Times-Roman",
    attributionFont: "Times-Italic",
    attributionTint: { r: 0.95, g: 0.95, b: 0.95 },
    blockWidth: 690,
  })

  override unfold() {
    this.stageField()
    this.stage(this.quote)

    // The field as shot 8 left it: gathered, with its clarity disc.
    this.set(this.burst.creation.to(1), this.clarity.creation.to(1))

    // The disc recedes and the field dims (61.5–63).
    this.play(this.veil.creation.to(1), 1.5)
    this.wait(0.25)

    // The quote writes on (63.25–70.75), then the credit (71.25–72).
    this.play(this.quote.writing.to(1, { easing: "linear" }), 7.5)
    this.wait(0.5)
    this.play(this.quote.crediting.to(1), 0.75)
    this.wait(2)

    // It fades (74.0–74.75), and the clarity returns (75–76).
    this.play(FadeOut(this.quote), 0.75)
    this.wait(0.25)
    this.play(this.veil.creation.to(0), 1)
    this.wait(2.75)
  }
}
