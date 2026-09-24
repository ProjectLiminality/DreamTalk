/**
 * Quote — someone's words, written out and spoken.
 *
 * David asked for this as a reusable holon, on the grounds that it recurs:
 *
 *   "I would love to have a quote object that can basically be used over time
 *    for different ways … it should be able to play the audio of something
 *    someone said while writing out the text … it is a recurring thing to use
 *    quote in the DreamSong framework."
 *
 * Its first use is Vitalik Buterin's line in the Liminal Consulting Web3
 * video, which the original made in Manim:
 *
 *     "If the thing technically runs on 50,000 computers
 *      but only 42 people know how it works,
 *      your decentralization-index is not 50,000 — it's 42."
 *                                          – Vitalik Buterin
 *
 * WHAT MAKES IT A HOLON RATHER THAN THREE TEXTS
 *
 * A quote is not just text that happens to be indented. It is a *unit of
 * attribution*: the words belong to someone, they arrive in the order they
 * were said, and — crucially for this framework — they may have been actually
 * SPOKEN, in a recording that exists. Bundling those three facts means a
 * scene says `new Quote({...})` and gets the layout, the cascade and the
 * voice together, instead of re-deciding line spacing and attribution
 * placement every time someone is quoted.
 *
 * THE LINE CASCADE
 *
 * Manim wrote the three lines with `lag_ratio=0.9` — each line starts when
 * the previous is 90% done, so they overlap slightly and the block arrives
 * as one gesture rather than three. That reading is reproduced here by
 * giving each line a window inside `writing`, offset by the same ratio. The
 * attribution then writes separately, after a beat, because it is a
 * different speech act: the words end, and only then are they credited.
 *
 * THE VOICE
 *
 * `audio` names a recording of the line actually being said. It is wired
 * through the SAME narration channel `Dream.say()` uses (src/narration.ts),
 * so a quote's audio is not a special case — it is a line on the score, and
 * a scene with no audio available simply writes the text in silence.
 *
 * The reason it is opt-in per quote rather than automatic: a quote in a
 * DreamSong is usually read by the narrator, not by its author, and speaking
 * over the narrator is worse than not having the recording at all.
 */

import { Group, Null } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { color, completion, length } from "../../src/params"
import { WHITE } from "../../src/constants"

/** How much of a line is written before the next one starts (Manim's lag_ratio). */
const LAG = 0.9

export class Quote extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /**
   * The quoted words, one entry per visual line.
   *
   * Lines are authored, not wrapped: where a quote breaks is a rhetorical
   * choice ("but only 42 people know how it works," lands because it is its
   * own line), and automatic wrapping would take that away.
   */
  lines: string[] = []

  /** Who said it. Rendered with the dash, italic-feeling, after the words. */
  attribution = ""

  /**
   * WHOSE voice speaks this quote, if a recording of it exists.
   *
   * Names a voice in the cache, not a file path — the cache is
   * content-addressed on (text, voice), so the scene asks for "this text in
   * Vitalik's voice" and gets the real recording, exactly as it would have
   * got a synthesized narrator. `scripts/import-voice.ts` puts a real
   * recording under that key.
   *
   * Opt-in, and undefined by default: a quote in a DreamSong is usually read
   * BY the narrator, and two voices at once is worse than one.
   */
  voice: string | undefined = undefined

  /**
   * The quote as ONE line of narration — what a scene passes to `say()` so
   * the spoken audio sits on the same timeline as the writing.
   *
   *     this.say(quote.spoken(), { voice: quote.voice })
   *
   * The lines are joined with spaces rather than newlines because the breaks
   * are visual rhetoric, not pauses in the speech.
   */
  spoken(): string {
    return this.lines.join(" ")
  }

  /** The cascade: 0 → 1 writes the whole block, lines overlapping. */
  writing = completion(0)
  /** The attribution's own write, kept separate — the credit is its own beat. */
  crediting = completion(0)

  size = length(46)
  /** Baseline-to-baseline, as a multiple of `size`. */
  lineHeight = length(1.45)
  tint = color(WHITE)
  /** The attribution is quieter than the words. */
  attributionTint = color({ r: 0.62, g: 0.62, b: 0.66 })

  /**
   * Half the block's width, so the left-aligned lines sit centred as a
   * BLOCK while staying flush with each other.
   *
   * A quote wants both things at once and they fight: `align: "left"` puts
   * every line's left edge on the holon's origin (which is what makes a
   * quote read as a quote — ragged right, flush left), but that also throws
   * the whole block off to one side of wherever it was placed. So the block
   * is shifted left by its own half-width. Estimated from the longest line
   * rather than measured, because glyph layout is asynchronous (the shaper
   * loads a font) and a holon's geometry must exist the moment it composes.
   */
  blockWidth = length(0)

  /** Built parts, so a scene can address a single line if it wants to. */
  lineTexts: Text[] = []
  credit?: Text
  block!: Group

  protected override compose(): void {
    const size = this.size.value
    const step = size * this.lineHeight.value
    const n = this.lines.length
    // Centre the block on the holon's own origin, so placing a Quote places
    // its middle — what a caller means by "put the quote here".
    const top = ((n - 1) / 2) * step
    // ~0.58em per character, measured against the rendered demo rather than
    // assumed (0.5 came out visibly narrow, which pushed the block right).
    // A scene that needs it exact can state `blockWidth` itself.
    const longest = this.lines.reduce((m, l) => Math.max(m, l.length), 0)
    const width = this.blockWidth.value > 0 ? this.blockWidth.value : longest * size * 0.58
    const left = -width / 2

    this.lineTexts = this.lines.map((content, i) => {
      // Each line owns a window inside `writing`, offset by the lag. With
      // LAG = 0.9 the windows overlap by a tenth, which is the original's
      // one-gesture arrival rather than three separate writes.
      const span = 1 / (1 + (n - 1) * LAG)
      const start = i * LAG * span
      return new Text({
        content,
        size: this.size,
        tint: this.tint,
        align: "left",
        x: left,
        y: top - i * step,
        // Remap the block's single `writing` into this line's window.
        creation: this.writing.map((w) =>
          Math.max(0, Math.min(1, (w - start) / span)),
        ),
      })
    })

    const members: Text[] = [...this.lineTexts]
    if (this.attribution) {
      this.credit = new Text({
        content: this.attribution.startsWith("–") ? this.attribution : `– ${this.attribution}`,
        size: this.size.times(0.85),
        tint: this.attributionTint,
        align: "left",
        // Sits below the last line, indented — the conventional placement,
        // and far enough down that it reads as a separate act.
        y: top - n * step - size * 0.35,
        x: left + size * 1.2,
        creation: this.crediting,
      })
      members.push(this.credit)
    }
    this.block = this.add(new Group({ members }))
  }

  /**
   * How long the words take to arrive, given a per-line pace.
   *
   * Offered because the cascade's overlap makes the total non-obvious: three
   * lines at 2s each is not 6s, it is 2s + 2×(0.9×2s). A scene that wants to
   * hold on the finished block needs the real number.
   */
  writeSeconds(perLine: number): number {
    const n = this.lines.length
    return n === 0 ? 0 : perLine * (1 + (n - 1) * LAG)
  }
}
