/**
 * QuoteDemo — the Quote holon carrying its first real quote.
 *
 * Vitalik Buterin's line, as it appears in the Liminal Consulting Web3
 * video. The wording and the line breaks are taken verbatim from the
 * original Manim source (RealDealVault/VitalikQuote/vitalik_quote_animation.py),
 * including where the lines break — that is a rhetorical choice, not
 * wrapping, and the holon deliberately does not re-wrap it.
 *
 * The original's timing, also from that source: Write with lag_ratio 0.9
 * over 7.5s, wait 2, then the author over 1s.
 */

import { Dream } from "../../src/index"
import { Null } from "../../src/parts/primitives"
import { Quote } from "../../vocabulary/Quote/Quote"

export class QuoteDemoDream extends Dream {
  quote = new Quote({
    lines: [
      '"If the thing technically runs on 50,000 computers',
      "but only 42 people know how it works,",
      "your decentralization-index is not 50,000 — it's 42.\"",
    ],
    attribution: "Vitalik Buterin",
    // Sized to fit 1280x720 with margins: the longest line is 52 chars,
    // so anything above ~34 runs off the frame.
    size: 30,
  })

  private root = new Null()

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.stage(this.root)
    this.stage(this.quote)
    // The original: 7.5s for the block, wait 2, 1s for the credit.
    this.play(this.quote.writing.to(1, { easing: "linear" }), 7.5)
    this.wait(2)
    this.play(this.quote.crediting.to(1), 1)
    this.wait(2)
  }
}
