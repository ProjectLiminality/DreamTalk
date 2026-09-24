/**
 * Closing — shot 17: the Project Liminality logo and title.
 *
 * The last nine seconds of the Liminal Consulting Web3 video (162–171s). A
 * blue circle, a red circle riding high inside it, and a white "A" whose apex
 * rises between them; then the title writes on beneath.
 *
 * MEASURED, NOT EYEBALLED
 *
 * Every number here was measured off `refs/web3/frames/f_00168.png` by
 * thresholding each colour and taking its bounding box, rather than judged by
 * looking. In frame pixels (1280×720):
 *
 *   BLUE circle   centre (639.5, 289.5)   radius 154.5
 *   RED circle    centre (640.0, 238.0)   radius 101.0
 *   WHITE "A"     x 550…729, y 205…412
 *
 * Two facts fall out that the eye would probably have got wrong, and they are
 * the whole character of the mark:
 *
 *   1. The circles are CONCENTRIC IN X but not in Y — the red sits 51.5px
 *      higher than the blue. That offset is what makes the logo feel like it
 *      is rising rather than sitting.
 *   2. The red circle's top (y 137) is essentially the blue circle's top
 *      (y 135). The red is not merely "smaller and inside"; it is tangent at
 *      the crown, which is why the pair reads as one form with a shared
 *      horizon instead of as a ring within a ring.
 *
 * Converted to scene units by the frame's own scale (720px tall ↦ the demo's
 * ~720-unit frame at zoom 1), with y flipped, since scene y runs up.
 *
 * THE "A" IS TWO STROKES, NOT A GLYPH
 *
 * It is drawn as an open polyline — up the left leg, over the apex, down the
 * right — and deliberately NOT set as text. Two reasons. It is a MARK, not a
 * letter: its proportions are the logo's, not the font's, and shaping it
 * would tie the brand to whatever face happens to be loaded. And it has no
 * crossbar in the reference, which no real "A" glyph would give us.
 *
 * WHAT IS NOT HERE: SHOT 16
 *
 * The portrait card (146–162s) is David's own photograph in a thin red-orange
 * ring. It is a raster asset — `media/David.png` in the source project — and
 * pulling a photograph of a person into this repo is a decision for David,
 * not for the reproduction. The ring and the timing are trivial once he says
 * so; the image is the part that needs his word. Flagged in
 * docs/campaigns/web3.md rather than done silently.
 */

import { Dream } from "../../src/index"
import { Circle, Line, Null } from "../../src/parts/primitives"
import { Text, Write } from "../../src/parts/text"
import { Create, FadeOut } from "../../src/verbs"
import { together } from "../../src/anim"
import { rgb } from "../../src/constants"

/** Measured from f_00168 (see the header), frame pixels → scene units. */
const BLUE_R = 154.5
const RED_R = 101
/** The red circle rides this far above the blue's centre. */
const RED_RISE = 51.5

/** The A's extent, measured: x ±89.5, y from 205 (apex) to 412 (feet). */
const A_HALF_WIDTH = 89.5
const A_APEX_Y = 289.5 - 205 // above the blue centre, in scene units (y up)
const A_FOOT_Y = 289.5 - 412 // below it

/**
 * The mark's colours, measured off the same frame.
 *
 * Note these are NOT core's canonical BLUE/RED. The logo is a brand mark with
 * its own palette, and matching the frame matters more here than matching the
 * vocabulary — the one place in this campaign where the canonical constants
 * are deliberately not used.
 */
const LOGO_BLUE = rgb(0x1e, 0x8b, 0xe8)
const LOGO_RED = rgb(0xe0, 0x50, 0x3c)
const LOGO_WHITE = rgb(0xff, 0xff, 0xff)

/**
 * The logo does not sit at the frame's centre — measured, its centre is at
 * y=289.5 of 720, i.e. 70.5px ABOVE centre, which in scene units (y up) is
 * +70.5. Drawing it at the origin put the whole mark low and pushed the
 * title off the bottom of the frame; this is the one number that was wrong
 * in the first render.
 */
const LOGO_Y = 70.5

export class ClosingDream extends Dream {
  blue = new Circle({ radius: BLUE_R, y: LOGO_Y, tint: LOGO_BLUE, stroke: 3.4 })
  red = new Circle({ radius: RED_R, y: LOGO_Y + RED_RISE, tint: LOGO_RED, stroke: 3.4 })

  /** The A: left leg up to the apex, then down the right. No crossbar. */
  mark = new Line({
    points: [
      { x: -A_HALF_WIDTH, y: LOGO_Y + A_FOOT_Y, z: 0 },
      { x: 0, y: LOGO_Y + A_APEX_Y, z: 0 },
      { x: A_HALF_WIDTH, y: LOGO_Y + A_FOOT_Y, z: 0 },
    ],
    tint: LOGO_WHITE,
    stroke: 3.4,
  })

  title = new Text({
    content: "Project Liminality",
    size: 62,
    tint: LOGO_WHITE,
    // Measured: the title's baseline sits ~270px below the blue centre,
    // which with the logo lifted lands it comfortably inside the frame.
    y: LOGO_Y - 272,
  })

  private root = new Null()

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.stage(this.root)

    // The circles draw first and together — they are one form (see the
    // header on the shared crown), so drawing them in sequence would break
    // the thing that makes the mark a mark.
    this.say("Project Liminality.")
    this.play(together(Create(this.blue), Create(this.red)), 2.2)
    // Then the A rises between them.
    this.play(Create(this.mark), 1.3)
    this.wait(0.4)
    this.play(Write(this.title), 1.6)
    this.wait(2.5)
    this.play(
      together(FadeOut(this.blue), FadeOut(this.red), FadeOut(this.mark), FadeOut(this.title)),
      1.2,
    )
  }
}
