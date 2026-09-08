/**
 * StoryPlaceSlide.ts — A DreamWeaving
 *
 * PL02 deck slide 32 ("story = place" / "MonoLogos\nNode" / "InterLogos"),
 * held at its settled tableau. Chapter P-2's GENERALIZATION proof: the
 * title card is one word in one face at one size, and a font decision
 * that only lands on one word has not landed at all.
 *
 * WHY THIS SLIDE AND NOT ANOTHER
 *
 * It exercises everything the title card does not, and nothing it does:
 *
 *   • the OTHER face — `HelveticaNeue` regular, where the card is Bold;
 *   • THREE sizes at once (37 / 36 / 30 slide units) against the card's
 *     single 116, so a size-dependent error in the face's metrics has
 *     somewhere to show;
 *   • a MULTI-LINE record (`MonoLogos\nNode`), which routes through the
 *     line-height and per-line centring the card's single line never
 *     touches;
 *   • the `middle` vertical branch of textBaseline(), where the card
 *     exercises `bottom` — and `middle` is the branch 88 of the deck's
 *     91 text records take, so it is the one that generalizes;
 *   • ZERO tracking, where the card's -0.02 is the whole of its final
 *     4.6%. If the tracking pass-through were wrong in the other
 *     direction, this slide is where it would show.
 *
 * Horizontal alignment is deliberately NOT varied, because the deck does
 * not vary it: all 91 text records in slides 1-58 are centred. Staging a
 * left-aligned label to exercise the branch would be inventing content,
 * which is exactly what the reproduction is not for. `textAnchorX`'s
 * left branch is pinned by unit test instead.
 *
 * THE REFERENCE WINDOW IS MEASURED, NOT CHOSEN
 *
 * Recon segment 31 (the deck's slide 32 — the +1 shift from position 18,
 * p1-importer.md §1) runs 553.8-572.6s. Its measured animation events end
 * at 557.2s and the next begins at 571.8s (analysis/events.json), so
 * 565.0s sits in the middle of a 14.6-second settled hold — frame
 * f_02826. Nothing is being timed here; the slide is held, the way the
 * projector held it.
 */

import { Dream, render } from "../../src/index"
import { Slide } from "../../vocabulary/Slides/Slides"
import { slide32 } from "../../vocabulary/Slides/assets/pl02/slide32"

export class StoryPlaceSlideDream extends Dream {
  page = new Slide({ data: slide32 })

  unfold() {
    this.observer.look("front")
    this.set(this.page.creation.to(1))
    this.wait(3)
  }
}

if (import.meta.main) render(StoryPlaceSlideDream)
