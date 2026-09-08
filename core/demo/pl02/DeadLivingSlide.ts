/**
 * DeadLivingSlide.ts — A DreamWeaving
 *
 * PL02 deck slide 5 ("Story" over "Dead Thing" / "Living Being"), held
 * at its settled tableau. Chapter P-2's GENERALIZATION proof: a font
 * decision that only lands on one word has not landed at all.
 *
 * WHY THIS SLIDE
 *
 * It is the deck's most nearly PURE TYPE page — five text records
 * against **two** shapes — so the fidelity score here is carried almost
 * entirely by the letterforms. On the title card the geometry (two
 * circles and a Λ, already a 1.000/1.000 PASS in P-1) supplies most of
 * the ink and the word is a minority of it; here that is inverted, and a
 * face or a metric that were merely close would have nowhere to hide.
 *
 * It also exercises what the title card does not:
 *
 *   • the OTHER face — `HelveticaNeue` regular, where the card is Bold;
 *   • two sizes at once (50 and 40 slide units) against the card's
 *     single 116, so an error that scales with size has somewhere to
 *     show;
 *   • the `middle` branch of textBaseline(), where the card exercises
 *     `bottom` — and `middle` is the branch nearly every text record in
 *     the deck takes, so it is the one that generalizes;
 *   • ZERO tracking, where the card's -0.02 is the whole of its final
 *     4.6%. A tracking pass-through that were wrong in the other
 *     direction is visible here and nowhere on the card.
 *
 * Horizontal alignment is deliberately NOT varied, because the deck does
 * not vary it: all 91 text records in slides 1-58 are centred. Staging a
 * left-aligned label to exercise the branch would be inventing content,
 * which is what the reproduction is precisely not for — `textAnchorX`'s
 * left branch is pinned by unit test instead.
 *
 * NO GROUPS, AND THAT IS WHY THIS SLIDE AND NOT SLIDE 32
 *
 * Slide 32 was the first choice — it carries the deck's `MonoLogos\nNode`
 * multi-line record — and it cannot be scored yet: the importer places
 * grouped drawables at their group-relative coordinates, so its whole
 * tableau collapses toward the origin (reported to P-1; the composite is
 * docs/reports/pl02/p2-slide32-f_02826-composite.png, coverage 0.29).
 * This slide has zero groups, so it isolates the type exactly.
 *
 * THE REFERENCE WINDOW IS MEASURED, NOT CHOSEN
 *
 * Segment 5 runs 98.0-119.4s. Its measured animation events end at 99.6s
 * and the next begins at 116.2s (analysis/events.json), so 108.0s sits in
 * the middle of a 16.6-second settled hold — frame f_00541. Nothing is
 * being timed here; the slide is held, the way the projector held it.
 */

import { Dream, render } from "../../src/index"
import { Slide } from "../../vocabulary/Slides/Slides"
import { slide05 } from "../../vocabulary/Slides/assets/pl02/slide05"

export class DeadLivingSlideDream extends Dream {
  page = new Slide({ data: slide05 })

  unfold() {
    this.observer.look("front")
    this.set(this.page.creation.to(1))
    this.wait(3)
  }
}

if (import.meta.main) render(DeadLivingSlideDream)
