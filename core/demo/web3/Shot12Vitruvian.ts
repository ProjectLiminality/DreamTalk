/**
 * Shot12Vitruvian — shot 12 (≈93.75–107s): Da Vinci's man inside his circle
 * and square, with the Fourier machine running round him.
 *
 * Composed from the VitruvianMan set-piece's parts — the FourierTrace holon,
 * the traced path, the measured circle and square — but timed and staged the
 * way the FINAL RENDER shows it, which differs from the standalone scene in a
 * way the recon summary did not say (frames overrule summaries):
 *
 *   refs/web3/frames6/vitruv_00004–00052 (4fps, 93–106s), read directly:
 *     - the whole figure is THERE from the start. It cross-dissolves in with
 *       its circle and square out of the Platonic crystals (93.75–95), dim,
 *       and the epicycle machine then runs round an outline that already
 *       exists — it is not drawn out of nothing as the standalone demo does;
 *     - the pen starts at the bottom centre (between the feet) and goes LEFT,
 *       up the left leg, across the left arm, over the head, down the right
 *       side and back — one lap in ~4.5s (94.25 → 98.75), then again;
 *     - during the first lap the outline brightens behind the pen to full
 *       white, and stays bright.
 *
 * So: a static figure (a FourierTrace held at `turn` 1 with its machinery
 * off — the same series, so the two can never disagree), plus a second
 * FourierTrace whose `turn` laps 0 → 1 repeatedly. Each lap restarts its ink
 * at 0, invisibly, because by then the static figure under it is as bright as
 * the ink. VITRUVIAN_PATH already begins at the bottom centre heading left,
 * so it is used un-rolled here (the standalone scene rolls it to finish on
 * the head).
 */

import { Dream } from "../../src/index"
import { Circle, Square } from "../../src/parts/primitives"
import { together } from "../../src/anim"
import { RED, BLUE } from "../../src/constants"
import { FourierTrace } from "../../vocabulary/Fourier/Fourier"
import { VITRUVIAN_PATH } from "./vitruvian-path"
import { CIRCLE_R, CIRCLE_Y, SQUARE_SIZE, SQUARE_Y, TERMS } from "./VitruvianMan"

/** One lap of the pen, measured from the 4fps frames. */
const LAP = 4.5

export class Shot12VitruvianDream extends Dream {
  // Measured in the reference: the circle and square are DIM — the red a
  // thin dark-red line, the blue a dark navy (f_00100), not full RED/BLUE.
  circle = new Circle({ radius: CIRCLE_R, y: CIRCLE_Y, tint: RED, stroke: 2, opacity: 0 })
  square = new Square({ size: SQUARE_SIZE, y: SQUARE_Y, tint: BLUE, stroke: 2, opacity: 0 })

  /** The figure itself, held complete. */
  figure = new FourierTrace({
    path: VITRUVIAN_PATH,
    terms: TERMS,
    stroke: 3,
    turn: 1,
    showMachine: false,
  })

  /** The machine, lapping. */
  pen = new FourierTrace({ path: VITRUVIAN_PATH, terms: TERMS, stroke: 3 })

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(0.75))
    this.stage(this.circle)
    this.stage(this.square)
    this.stage(this.figure)
    this.stage(this.pen)

    // Everything opens dim — the cross-dissolve out of the crystals.
    for (const h of this.figure.walk()) this.set(h.opacity.to(0))
    for (const h of this.pen.walk()) this.set(h.opacity.to(0))

    const machine = [...this.pen.rings.walk()].filter((h) => h !== this.pen.rings)

    // 93.75–95: the frame and the dim figure dissolve in; the machine wakes.
    this.play(
      together(
        this.circle.opacity.to(0.45),
        this.square.opacity.to(0.4),
        this.figure.ink.opacity.to(0.35),
        [this.pen.ink.opacity.to(1), 0.4, 1],
        [together(...machine.map((h) => h.opacity.to(0.6))), 0.4, 1],
      ),
      1.0,
    )

    // Lap 1 (94.25 → 98.75), the outline brightening behind the pen.
    this.wait(-0.5)
    this.play(
      together(
        this.pen.turn.to(1, { easing: "linear" }),
        [this.figure.ink.opacity.to(1, { easing: "linear" }), 0.6, 1],
      ),
      LAP,
    )
    // Laps 2 and 3, until the cut.
    for (let lap = 0; lap < 2; lap++) {
      this.set(this.pen.turn.to(0))
      this.play(this.pen.turn.to(1, { easing: "linear" }), LAP)
    }
  }
}
