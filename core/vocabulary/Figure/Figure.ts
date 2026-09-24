/**
 * Figure — THE person. One symbol, used wherever a DreamSong needs a human.
 *
 * Promoted out of the agent-arena demo (where it was `AgentFigure`) on
 * David's instruction, and the instruction is the whole point of this file:
 *
 *   "everywhere we use a person that is always the same symbol so that we can
 *    update it once and it will be beautiful and updated across all
 *    DreamSongs, that's the whole idea."
 *
 * So this is deliberately NOT the best stick figure we could draw. It is the
 * SHARED one. Its present look came from David's whiteboard — a round head
 * about a fifth of the total height, a straight spine, arms dropping outward
 * from just below the neck, legs splaying from the hip — and he has said
 * plainly that it is not how he wants it to look. That is fine and expected:
 * the value here is the single point of definition, so that when the person
 * is redrawn properly, every song that shows a person is redrawn with it.
 *
 * WHAT THAT DEMANDS OF THIS FILE
 *
 * Callers must depend on the SYMBOL, never on its internals. `height` is the
 * whole figure, crown to foot, so a caller states a size rather than nesting
 * a transform; `tint` colours it. Nothing else about the construction is
 * contract. A future redraw may replace every line here — different
 * proportions, a real silhouette, an SVG import — and no scene should break,
 * because no scene should ever have reached inside.
 *
 * (The parts are still named and exposed, because a scene occasionally has a
 * genuine reason to address one — the whiteboard song glows a figure's head.
 * Reaching for them is a signal that the symbol is missing an ability, not a
 * licence to depend on the anatomy.)
 */

import { Circle, Line, Stroke } from "../../src/parts/primitives"
import { RED } from "../../src/constants"
import { color, length } from "../../src/params"

/** Head diameter as a fraction of total height (from the drawing). */
const HEAD = 0.22
/** Spine length as a fraction of total height. */
const SPINE = 0.42
/** How far the arms and legs reach sideways, as a fraction of height. */
const REACH = 0.2

export class Figure extends Stroke {
  /**
   * Red by default — the whiteboard's agent colour, so the song this came
   * from is untouched. But every part now draws in `this.tint` rather than a
   * hardcoded RED, because a shared symbol that cannot be recoloured is not
   * shared: the infinite-patience song needs the same person blue, turning
   * red as it approaches the singularity.
   */
  override tint = color(RED)
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
      new Circle({ radius: headR, y: headCy, tint: this.tint, stroke }),
    )
    this.spine = this.add(
      new Line({
        points: [{ x: 0, y: neck, z: 0 }, { x: 0, y: hip, z: 0 }],
        tint: this.tint,
        stroke,
      }),
    )
    // Arms drop outward from just below the neck — the board's shrugged,
    // open posture rather than a T-pose.
    this.armLeft = this.add(
      new Line({
        points: [{ x: 0, y: shoulder, z: 0 }, { x: -reach, y: shoulder - reach * 0.55, z: 0 }],
        tint: this.tint,
        stroke,
      }),
    )
    this.armRight = this.add(
      new Line({
        points: [{ x: 0, y: shoulder, z: 0 }, { x: reach, y: shoulder - reach * 0.55, z: 0 }],
        tint: this.tint,
        stroke,
      }),
    )
    this.legLeft = this.add(
      new Line({
        points: [{ x: 0, y: hip, z: 0 }, { x: -reach * 0.8, y: foot, z: 0 }],
        tint: this.tint,
        stroke,
      }),
    )
    this.legRight = this.add(
      new Line({
        points: [{ x: 0, y: hip, z: 0 }, { x: reach * 0.8, y: foot, z: 0 }],
        tint: this.tint,
        stroke,
      }),
    )
  }
}
