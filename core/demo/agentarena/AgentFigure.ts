/**
 * AgentFigure — the red stick figure that stands in an arena.
 *
 * The board's second-most-repeated glyph, and the counterpart to Arena:
 * wherever there is a blue boundary there is a red inhabitant. David
 * draws it three times — as the agent in the primitive, as the human in
 * the physical arena, and again (tiny) as the virtual agent on the
 * laptop screen — so, like Arena, it is one holon reused at three scales.
 *
 * The proportions are the whiteboard's own: a round head about a fifth
 * of the total height, a straight spine, arms a little above the middle
 * dropping outward, and legs splaying from the hip. A stick figure is
 * not a person here; it is the MINIMAL mark that reads as "someone with
 * agency", which is exactly the board's use of it.
 *
 * `height` is the whole figure, crown to foot, so a caller scales it by
 * stating a size rather than by nesting a transform.
 */

import { Circle, Line, Stroke } from "../../src/parts/primitives"
import { RED } from "../../src/constants"
import { length } from "../../src/params"

/** Head diameter as a fraction of total height (from the drawing). */
const HEAD = 0.22
/** Spine length as a fraction of total height. */
const SPINE = 0.42
/** How far the arms and legs reach sideways, as a fraction of height. */
const REACH = 0.2

export class AgentFigure extends Stroke {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  height = length(120)

  head!: Circle
  spine!: Line
  armLeft!: Line
  armRight!: Line
  legLeft!: Line
  legRight!: Line

  protected override compose(): void {
    const h = this.height.value
    const headR = (h * HEAD) / 2
    // The figure is built about its own middle: crown at +h/2, feet at
    // -h/2, so placing it is placing its centre.
    const crown = h / 2
    const headCy = crown - headR
    const neck = headCy - headR
    const hip = neck - h * SPINE
    const shoulder = neck - h * SPINE * 0.3
    const foot = -h / 2
    const reach = h * REACH
    const stroke = this.stroke

    this.head = this.add(
      new Circle({ radius: headR, y: headCy, tint: RED, stroke }),
    )
    this.spine = this.add(
      new Line({
        points: [{ x: 0, y: neck, z: 0 }, { x: 0, y: hip, z: 0 }],
        tint: RED,
        stroke,
      }),
    )
    // Arms drop outward from just below the neck — the board's shrugged,
    // open posture rather than a T-pose.
    this.armLeft = this.add(
      new Line({
        points: [{ x: 0, y: shoulder, z: 0 }, { x: -reach, y: shoulder - reach * 0.55, z: 0 }],
        tint: RED,
        stroke,
      }),
    )
    this.armRight = this.add(
      new Line({
        points: [{ x: 0, y: shoulder, z: 0 }, { x: reach, y: shoulder - reach * 0.55, z: 0 }],
        tint: RED,
        stroke,
      }),
    )
    this.legLeft = this.add(
      new Line({
        points: [{ x: 0, y: hip, z: 0 }, { x: -reach * 0.8, y: foot, z: 0 }],
        tint: RED,
        stroke,
      }),
    )
    this.legRight = this.add(
      new Line({
        points: [{ x: 0, y: hip, z: 0 }, { x: reach * 0.8, y: foot, z: 0 }],
        tint: RED,
        stroke,
      }),
    )
  }
}
