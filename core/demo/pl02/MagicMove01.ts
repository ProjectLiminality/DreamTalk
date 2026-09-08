/**
 * MagicMove01.ts — A DreamWeaving
 *
 * PL02 deck slides 12 → 13, across the Magic Move that joins them:
 * one twelve-node dotted mesh becomes two smaller ones side by side.
 * Chapter P-6's gate, and the reason this pair and not another is that
 * **the glide is the content here** — a mid-transition frame shows
 * something a settled frame cannot, and 44 of the video's 58 transitions
 * are this one operation.
 *
 * WHY THIS PAIR
 *
 * Of the deck's 44 Magic Moves this is the cleanest instrument:
 *
 *   • the matched objects VISIBLY TRAVEL. Twelve `Head with
 *     Shoulders_826` icons move and shrink together (matched scale
 *     0.660, median travel 133 slide units), so a matcher that paired
 *     them wrongly would show heads crossing through one another rather
 *     than a tableau contracting — the failure is unmissable rather than
 *     subtle;
 *   • it carries BOTH unmatched directions at once — one outgoing
 *     drawable (the single ring outline) and three incoming (the
 *     twin-lobe outline and two double-arrows) — so the fade-out and
 *     fade-in halves of `customMagicMoveFadeUnmatchedObjects` are both
 *     exercised;
 *   • it is a DOTTED MESH, so the connection lines' behaviour through a
 *     glide is on screen rather than hypothetical (Transitions.ts's
 *     `magicMove` header states why they do not themselves glide);
 *   • and it is one of only three Magic Moves in the deck declared at
 *     **1.5s** rather than 2.0s, so the duration being READ rather than
 *     assumed is load-bearing here in a way it is not on the other 41.
 *
 * THE WINDOW IS MEASURED; THE DURATION IS READ
 *
 * The chapter's central division, and both halves are checkable.
 *
 * MEASURED — the onset. A frame-differenced scan over 214-222s puts the
 * only motion in this segment at **216.2s** (frames f_01081 → f_01082
 * step from 0.00000 to 0.00295 mean absolute difference, after five
 * perfectly still frames). That is a click, and a click exists only in
 * the footage.
 *
 * READ — the duration. The deck declares 1.5s (`KeyTransition.duration`
 * on slide 13), and the footage CONFIRMS it rather than supplying it.
 * Tracking the mesh's top ink edge through the glide — the head band's
 * upper bound, which contracts monotonically from video row 52 to row
 * 159 — and fitting the deck's own ease against candidate durations:
 *
 *     duration   1.2    1.4    1.5    1.6    1.8    2.0
 *     rms (px)  12.7    9.2    9.7   11.4   16.7   22.3
 *
 * The minimum sits at the declared 1.5s (1.4 and 1.5 are inside each
 * other's noise at 5 fps), and 2.0s is decisively excluded. Worth
 * recording because the raw frame-difference window looks like 2.0s —
 * motion runs 216.2 to 218.2 — and it is not: the last half second is
 * the unmatched fade-IN, which by `BUILD_FRACTION` occupies the tail of
 * the window and keeps changing pixels after the glide has arrived. A
 * chapter that fitted the duration to the motion window would have
 * "corrected" a number the deck states correctly, which is exactly what
 * DECISIONS' refused-fits rule forbids.
 *
 * WHAT IS STAGED
 *
 * Both pages are composed and `magicMoveSetup` lights A and darkens B;
 * the glide plays over the declared 1.5s from the measured onset; the
 * swap hands the frame to B. The hold either side is the projector's —
 * segment 12 runs 214.4-217.0 and segment 13 runs 217.0-219.4, and this
 * scene reproduces the crossing between them, not the whole slideshow.
 */

import { Dream, render } from "../../src/index"
import { Slide } from "../../vocabulary/Slides/Slides"
import {
  magicMove,
  magicMoveAnim,
  magicMoveSetup,
  magicMoveSwap,
} from "../../vocabulary/Slides/Transitions"
import { slide12 } from "../../vocabulary/Slides/assets/pl02/slide12"
import { slide13 } from "../../vocabulary/Slides/assets/pl02/slide13"

/** The measured click, as an offset into this scene's own clock. */
const ONSET = 1.0
/** The deck's own declared duration for this transition. READ, not fitted. */
const DURATION = slide13.transition?.duration ?? 1.5

export class MagicMove01Dream extends Dream {
  from = new Slide({ data: slide12 })
  to = new Slide({ data: slide13 })

  unfold() {
    this.observer.look("front")
    const match = magicMove(this.from, this.to)

    this.set(this.from.creation.to(1))
    this.set(this.to.creation.to(1))
    this.set(magicMoveSetup(this.from, this.to))

    this.wait(ONSET)
    this.play(magicMoveAnim(this.from, this.to, match), DURATION)
    this.set(magicMoveSwap(this.from, this.to, match))
    this.wait(1.5)
  }
}

if (import.meta.main) render(MagicMove01Dream)
