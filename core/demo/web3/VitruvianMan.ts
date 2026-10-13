/**
 * VitruvianMan — Da Vinci's figure drawn by Fourier epicycles, with his circle
 * and square, rebuilt as a DreamTalk scene.
 *
 * SOURCE. The Liminal Consulting Web3 video (~93-106s) traced the Vitruvian
 * Man with a 3Blue1Brown epicycle chain inside a RED circumscribing circle and
 * a BLUE square (docs/reports/web3-recon.md, set-piece B). The symbol is the
 * Vitruvian holon (vocabulary/Vitruvian: the traced path, the measured circle
 * and square, the FourierTrace machine); this scene is its standalone face.
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
import { Null } from "../../src/parts/primitives"
import { Create } from "../../src/verbs"
import { together } from "../../src/anim"
import { START_AT_HEAD, Vitruvian } from "../../vocabulary/Vitruvian/Vitruvian"

export class VitruvianManDream extends Dream {
  // The pen finishes on the HEAD, where the eye expects a drawing of a
  // person to end and where the original's own machinery tucked away.
  private man = new Vitruvian({ startAt: START_AT_HEAD })

  private root = new Null()

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(0.75))
    this.stage(this.root)
    this.stage(this.man)

    // 1. Da Vinci's frame draws itself in.
    this.play(together(Create(this.man.circle), Create(this.man.square)), 2.4)
    this.wait(0.4)

    // 2. The epicycles trace the figure — the shot's ~13-14s sweep.
    this.play(this.man.pen.turn.to(1, { easing: "linear" }), 13.5)

    // 3. Hold on the finished figure.
    this.wait(1.5)
  }
}
