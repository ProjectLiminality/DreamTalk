/**
 * TitleSlide.ts — A DreamWeaving
 *
 * "Project Liminality" (2023), the title card — the video's first frame,
 * its 375-second interlude, and its last frame, all the same slide.
 *
 * This is chapter P-1's gate, and it is deliberately the SMALLEST thing
 * the importer can be asked to prove: four shapes and a word, rendered
 * static on black, compared by eye and by overlay against the footage.
 * No builds, no transition, no timing — those are P-2 and P-3. If the
 * geometry lands, the importer is right; if it does not, nothing built
 * on it can be.
 *
 * WHY THE OVERLAY CAN BE THIS STRICT
 *
 * The recon (docs/reports/pl02-vocabulary.md §1, §2) established that the
 * deck's own numbers predict the footage to sub-pixel: the title card's
 * main circle is 459.17673 slide units across at position (730.4116,
 * 205.50696), which is centre (960.000, 435.095) and r = 229.5884; scaled
 * 1920→1280 that is r = 153.0589 px, and six averaged title-card frames
 * measure 153.06. So there is no fitting to be done here and no tolerance
 * to be argued for — the render either reproduces a number that was
 * already checked against the encode, or the importer has a bug.
 *
 * NOT THE VOCABULARY'S Logo, AND THE DIFFERENCE IS MEASURABLE
 *
 * `core/vocabulary/Logo` is the pydeation mark, built in O-3 from
 * pydeation's own derivation: small/main radius ratio 0.61, centre offset
 * 0.36·r. The deck's mark is a hand-redrawn Keynote approximation of the
 * same design — ratio 0.64902, offset 0.34003·r — and at this size that
 * is a six-pixel difference in the red circle's radius. Reusing the
 * vocabulary Logo here would be reproducing a DIFFERENT drawing that
 * happens to mean the same thing, which is exactly the substitution the
 * reproduction is supposed to catch. The slide data is the authority.
 *
 * THE FRAMING IS THE RIG, NOT A FIT
 *
 * `observer.look("front")` adopts the 36mm rig at its 1000-unit distance
 * — 562.4987 world units of visible height — and `Slide.height` defaults
 * to exactly that, so the 1080-unit canvas fills the frame the way the
 * projector filled it. Nothing here is tuned; both numbers are derived
 * (core/src/geometry/keynote.ts, slideToWorld).
 */

import { Dream, render } from "../../src/index"
import { Slide } from "../../vocabulary/Slides/Slides"
import { slide01 } from "../../vocabulary/Slides/assets/pl02/slide01"

export class TitleSlideDream extends Dream {
  title = new Slide({ data: slide01 })

  unfold() {
    this.observer.look("front")
    // Static: the card as the video holds it, with nothing animating.
    // The importer's claim is about GEOMETRY, so the scene shows the
    // settled tableau and lets the overlay do the arguing.
    this.set(this.title.creation.to(1))
    this.wait(3)
  }
}

if (import.meta.main) render(TitleSlideDream)
