/**
 * PortraitCard — shot 16: the personal beat.
 *
 * 146–162s of the Liminal Consulting Web3 video. After the whole argument has
 * been made in symbols, the argument's author appears: David, seated outdoors,
 * inside a thin red-orange ring. It is the call-to-action beat — the moment
 * the piece stops being about decentralisation and starts being about working
 * with a person.
 *
 * MEASURED off refs/web3/frames/f_00152.png by thresholding the ring's hue and
 * taking its bounding box:
 *
 *   ring centre   (640, 360) — dead frame centre
 *   ring radius   294 px of a 720-tall frame
 *   ring colour   ~(208, 117, 98)
 *
 * THE PHOTOGRAPH IS NOT IN THIS REPO, AND THAT IS DELIBERATE
 *
 * The ring, the size, the timing and the composition are all here. The image
 * is not. `media/David.png` lives in the source project, and committing a
 * photograph of a person into a framework repository is the author's call to
 * make, not the reproduction's — so this scene draws the FRAME and leaves the
 * portrait as an explicit placeholder.
 *
 * Swapping the real photograph in is one line once David says so: the host has
 * no image primitive yet, so it would arrive as a textured plane or an
 * `assets/` file the scene points at. Until then the placeholder states what
 * belongs here rather than pretending the shot is finished.
 *
 * WHY A PLACEHOLDER AND NOT NOTHING
 *
 * A missing shot is invisible in an assembly; a placeholder is not. When these
 * seventeen shots are finally sequenced, this one will announce that it is
 * waiting for something, which is exactly what a person reviewing the cut
 * needs to see. Silence would let it slip through.
 */

import { Dream } from "../../src/index"
import { Circle, Null } from "../../src/parts/primitives"
import { Text, Write } from "../../src/parts/text"
import { Create, FadeIn, FadeOut } from "../../src/verbs"
import { together } from "../../src/anim"
import { rgb } from "../../src/constants"

/** Measured from f_00152 — see the header. */
/**
 * 294 is the MEASURED radius in the reference's 720-tall frame — where the
 * ring very nearly touches top and bottom (y 65..655). At this scene's zoom
 * the same number overflowed, so it is scaled to leave a real margin. The
 * proportion to the frame is what the shot is about, not the absolute number.
 */
const RING_RADIUS = 232
const RING_COLOUR = rgb(0xd0, 0x75, 0x62)
/** The quiet grey the placeholder text sits in — never competes with the ring. */
const PLACEHOLDER_GREY = rgb(0x55, 0x55, 0x5c)

export class PortraitCardDream extends Dream {
  /** The ring: the one element of this shot that is fully reproduced. */
  ring = new Circle({
    radius: RING_RADIUS,
    tint: RING_COLOUR,
    stroke: 3.2,
  })

  /**
   * Where the photograph goes. A quiet inner OUTLINE, not a fill.
   *
   * A filled plate was the first attempt and it was wrong twice: a fill draws
   * opaque, so it swallowed the labels standing on it, and a dark tint at full
   * fillOpacity still read as a mid-grey disc that dominated the frame. An
   * outline states the boundary of the missing image without pretending to be
   * it.
   */
  plate = new Circle({
    radius: RING_RADIUS - 14,
    tint: PLACEHOLDER_GREY,
    stroke: 1,
    opacity: 0,
  })

  label = new Text({
    content: "portrait",
    size: 34,
    tint: PLACEHOLDER_GREY,
    opacity: 0,
  })
  note = new Text({
    content: "media/David.png — awaiting David's word",
    size: 22,
    tint: PLACEHOLDER_GREY,
    y: -46,
    opacity: 0,
  })

  private root = new Null()

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.stage(this.root)
    this.stage(this.plate)
    this.stage(this.ring)
    this.stage(this.label)
    this.stage(this.note)

    this.say("And behind the argument, a person.", { hold: true })
    this.play(together(Create(this.ring), [FadeIn(this.plate), 0.2, 1]), 2)
    this.play(together(FadeIn(this.label), [FadeIn(this.note), 0.3, 1]), 1.2)
    this.wait(3)
    this.play(
      together(FadeOut(this.ring), FadeOut(this.plate), FadeOut(this.label), FadeOut(this.note)),
      1.4,
    )
  }
}
