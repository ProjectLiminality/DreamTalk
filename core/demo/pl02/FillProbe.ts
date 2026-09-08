/**
 * FillProbe.ts — the occlusion-at-scale check (P-8)
 *
 * NOT a reproduction scene. This is the measurement instrument for one
 * question the ground truth records as open, and it exists so the answer
 * is a scored frame rather than an assertion.
 *
 * THE OPEN QUESTION. P-5 built `SlideFill` — the deck's flat fills as
 * OCCLUDERS, since a black fill on a black stage paints nothing of its
 * own and its entire visible effect is to hide what is behind it — and
 * verified its winding on `Notebook_109`'s even-odd hole. P-3's
 * push-back was accepted: the motivating frame never exercised HIDING,
 * so occlusion order, black-stage interaction, and whether hidden ink
 * actually disappears were all untested. The vocabulary report carries
 * it as "VERIFIED WINDING but UNTESTED OCCLUSION", with P-9 and P-10
 * told to run a cheap check before trusting it at 70 and 15 fills.
 *
 * WHY DECK 43 IS THE RIGHT PLACE, AND IT IS CHEAPER THAN P-9's. The
 * fractal tableau is 60 black-filled ellipses with 30 genuinely
 * overlapping pairs, and 39 unfilled drawables whose boxes cross a
 * filled one. Its whole construction is cone lines running from an apex
 * ring down to four base rings, passing BEHIND the ellipses on the way —
 * so the fills are not incidental to the picture, they are what makes it
 * read as a cone tree rather than a tangle. If occlusion is broken at
 * scale, this frame shows it.
 *
 * THE MEASUREMENT is `Slide.fills`, and both scenes below are the same
 * page at the same instant with only that flag differing. Scoring both
 * against `f_03370` gives the honest answer to "what do fills actually
 * hide", in the one currency the campaign trusts.
 */

import { Dream, render } from "../../src/index"
import { Slide } from "../../vocabulary/Slides/Slides"
import { slide43 } from "../../vocabulary/Slides/assets/pl02/index"

/** The fractal at rest, fills ON — the deck's own behaviour. */
export class FillOnDream extends Dream {
  page = new Slide({ data: slide43 })

  unfold() {
    this.observer.look("front")
    this.play(this.page.creation.to(1), 0)
    this.play({ tracks: [] }, 1)
  }
}

/** The same page and instant with the opaque fills left out. */
export class FillOffDream extends Dream {
  page = new Slide({ data: slide43, fills: false })

  unfold() {
    this.observer.look("front")
    this.play(this.page.creation.to(1), 0)
    this.play({ tracks: [] }, 1)
  }
}

if (import.meta.main) render(FillOnDream)
