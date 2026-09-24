/**
 * VitruvianMan — Da Vinci's figure drawn by Fourier epicycles, with his circle
 * and square, rebuilt as a DreamTalk scene.
 *
 * SOURCE. The Liminal Consulting Web3 video (~93-106s) traced the Vitruvian
 * Man with a 3Blue1Brown epicycle chain inside a RED circumscribing circle and
 * a BLUE square (docs/reports/web3-recon.md, set-piece B). David asked for the
 * Fourier tracer to exist as a reusable holon; this scene is that holon
 * (vocabulary/Fourier) carrying the figure it was built for.
 *
 * DERIVED vs CHOSEN.
 *
 *   DERIVED FROM THE PIXELS (no vector/Manim source for the figure was found,
 *   so this is the pixel-universality path David wanted):
 *     - the figure outline is `VITRUVIAN_PATH`, traced from
 *       refs/web3/frames6/vitruv_00051.png. See that file's header for the full
 *       method — threshold the bright white figure, mirror the crisp left half
 *       (the right limbs are drawn thin by frame 51), synthesise a clean head
 *       (the pen is finishing there, under a tangle of machinery), take the
 *       outer contour. It is a TRACE, not authoritative geometry.
 *     - the circle and square PROPORTIONS were measured from that same frame
 *       under the same scale: red circle radius ~314 centred ~53 units above
 *       the figure centre (Da Vinci's navel circle), blue square side ~524
 *       centred on the figure. A circle fit over the red pixels gave the centre
 *       and radius; the square from the blue pixels' bounding box.
 *
 *   CHOSEN:
 *     - `terms`. The original resolved only a handful of large circles clearly,
 *       the rest of the smoothness coming from the long tail the eye cannot
 *       separate. TERMS below is tuned so the figure is unmistakable while the
 *       machine still reads as a chain of spinning circles, not a solid disc.
 *     - the circle/square are centred on x = 0 exactly; the frame's ~9px
 *       offsets are measurement noise, and the figure is symmetric about x = 0.
 *     - `zoom` 0.75 frames the figure at ~0.68 of frame height, as in the
 *       original (CreatorMode uses the same lens); at zoom 1 a 520-unit figure
 *       would fill 0.9 of the view.
 *     - the sequence (circle + square draw in, then the trace runs, then hold)
 *       and its ~13-14s trace length follow the recon's timing for the shot.
 */

import { Dream } from "../../src/index"
import { Null, Circle, Square } from "../../src/parts/primitives"
import { Create } from "../../src/verbs"
import { together } from "../../src/anim"
import { RED, BLUE } from "../../src/constants"
import { FourierTrace } from "../../vocabulary/Fourier/Fourier"
import { VITRUVIAN_PATH } from "./vitruvian-path"

/**
 * The traced path starts at the FEET (index 0), so the pen — and with it the
 * whole epicycle chain — finishes there, collapsing into a knot at the base.
 * The original finishes at the HEAD, which is both where the eye expects a
 * drawing of a person to end and where the original's own machinery tucked
 * away.
 *
 * A Fourier series is periodic, so WHERE a closed path starts is free: rolling
 * the start point changes only the phase of every coefficient, never the curve.
 * Index 355 is the crown (the topmost point of the trace).
 */
const START_AT_HEAD = 355
const rollToHead = <T,>(pts: readonly T[], at: number): T[] => [
  ...pts.slice(at),
  ...pts.slice(0, at),
]

/** Da Vinci's circle + square, measured from the frame (see header). */
const CIRCLE_R = 314
const CIRCLE_Y = 53 // the navel circle sits above the figure centre
const SQUARE_SIZE = 524
const SQUARE_Y = 2

/**
 * How many epicycles. A handful of big circles carry the pose; the tail
 * (dropped below `minRadius` in the drawing, kept in the sum) smooths the
 * fingers and feet. 130 reads as the figure while the machine stays legible.
 */
const TERMS = 130

export class VitruvianManDream extends Dream {
  // Da Vinci's two figures, drawn first, behind the trace.
  private circle = new Circle({
    radius: CIRCLE_R,
    y: CIRCLE_Y,
    tint: RED,
    stroke: 3,
  })
  private square = new Square({
    size: SQUARE_SIZE,
    y: SQUARE_Y,
    tint: BLUE,
    stroke: 3,
  })

  // The epicycle tracer carrying the figure.
  private tracer = new FourierTrace({
    path: rollToHead(VITRUVIAN_PATH, START_AT_HEAD),
    terms: TERMS,
    stroke: 3,
  })

  private root = new Null()

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(0.75))
    this.stage(this.root)
    this.stage(this.circle)
    this.stage(this.square)
    this.stage(this.tracer)

    // 1. Da Vinci's frame draws itself in.
    this.play(together(Create(this.circle), Create(this.square)), 2.4)
    this.wait(0.4)

    // 2. The epicycles trace the figure — the shot's ~13-14s sweep.
    this.play(this.tracer.turn.to(1, { easing: "linear" }), 13.5)

    // 3. Hold on the finished figure.
    this.wait(1.5)
  }
}
