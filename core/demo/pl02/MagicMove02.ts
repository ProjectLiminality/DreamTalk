/**
 * MagicMove02.ts — A DreamWeaving
 *
 * PL02 deck slides 36 → 37, across the Magic Move that joins them: the
 * Liminal Wallet laptop holds perfectly still while ONE icon — a lotus
 * in its rounded tile, with the cursor arrow beside it — travels
 * diagonally into the blue ring.
 *
 * WHY THIS PAIR: IT ISOLATES THE GLIDE COMPLETELY
 *
 * MagicMove01 proves the matcher on a crowd (twelve interchangeable
 * heads, where the risk is pairing the wrong ones). This proves the
 * opposite property, and it is the cleaner instrument for the GLIDE
 * itself: the match is **11 matched, 0 unmatched out, 0 unmatched in** —
 * no fades anywhere, nothing appearing or disappearing. Every pixel that
 * changes between these two tableaux changes because a matched pair
 * moved.
 *
 * That makes the transition a pure measurement of the glide path. Nine
 * of the eleven matched drawables have zero travel (the laptop shell,
 * the ring, the logo, the label), and exactly two move — so a
 * mid-transition frame is a direct read of where the interpolation put
 * them, with no dissolve confounding the ink. If the ease were wrong, or
 * the offset arithmetic in `glideOf`, this frame would say so plainly.
 *
 * THE MEASUREMENT (and it confirms the deck a second time)
 *
 * The lotus tile is the only moving ink in a 270×180 px window, so its
 * centroid tracks the glide directly. From `frames5`:
 *
 *     t      605.0  605.2  605.4  605.6  605.8  606.0  606.2  606.4  606.6  607.0
 *     cx     849.6  844.5  835.3  822.0  810.4  792.8  772.1  758.8  751.6  750.9
 *
 * It leaves 851.7 and arrives at 750.9 — 101 px of travel — and is
 * settled from 607.0 on. Fitting the deck's own ease over a grid of
 * onsets and durations puts the minimum at **onset 605.0, duration
 * 1.7s** (rms 2.6 px); holding the onset at the frame-differenced 604.9,
 * the DECLARED 2.0s fits at rms 3.8 px — under 4% of the travel — while
 * 1.6s and 2.4s are excluded at 9.8 and 13.6.
 *
 * So the declared duration is READ and the footage confirms it, exactly
 * as in MagicMove01. The onset is MEASURED, because a click exists only
 * in the footage. Nothing here is fitted: the 1.7s grid minimum is
 * inside the 5 fps sampling's own resolution of the declared 2.0s and
 * is reported rather than adopted — adopting it would be fitting a
 * duration the deck states, which DECISIONS' refused-fits rule forbids.
 */

import { Dream, render } from "../../src/index"
import { Slide } from "../../vocabulary/Slides/Slides"
import {
  magicMove,
  magicMoveAnim,
  magicMoveSetup,
  magicMoveSwap,
} from "../../vocabulary/Slides/Transitions"
import { slide36 } from "../../vocabulary/Slides/assets/pl02/slide36"
import { slide37 } from "../../vocabulary/Slides/assets/pl02/slide37"

/** The measured click, as an offset into this scene's own clock. */
const ONSET = 1.0
/** The deck's own declared duration. READ, not fitted — see the header. */
const DURATION = slide37.transition?.duration ?? 2.0

export class MagicMove02Dream extends Dream {
  from = new Slide({ data: slide36 })
  to = new Slide({ data: slide37 })

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

if (import.meta.main) render(MagicMove02Dream)
