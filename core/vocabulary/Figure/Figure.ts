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
 * THE DRAWING (redrawn 2026-10-13, on David's ask for a beautiful platonic
 * person). His whiteboards draw people as a circle floating over an arch,
 * and that is the idea kept: a round head with air beneath it; ONE arch — a
 * half-ellipse — that rises over the shoulders and falls into both arms,
 * hands hanging beside the hips; a spine from the arch's crown to the hip;
 * two legs in a quiet stance. Four kinds of line, no sticks for arms: the
 * posture is open and at rest. It reads as "someone" from 40 px to a
 * thousand, and every song that shows a person was redrawn with it — which
 * is the whole point of the single point of definition.
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

/**
 * The proportions — the whole person in a handful of ratios of its height
 * h, so the symbol is one idea at every size.
 *
 *   HEAD     the head's diameter: ~5½ heads tall, a person rather than an
 *            athlete — readable as "someone" at 40 px.
 *   GAP      air between head and shoulders: the head floats, the way the
 *            whiteboard's own people are drawn (a circle over an arch).
 *   ARCH     the shoulders-and-arms arch: one half-ellipse that rises over
 *            the shoulders and falls into both arms — ARCH_W its half-width
 *            (the shoulders' breadth), ARCH_H its height (the arms' length);
 *            SWEEP carries the hands a little past the ellipse's waist, so
 *            they hang beside the hips. One curve, not four sticks — the
 *            posture is open.
 *   HIP      where the spine ends and the legs begin, measured down from
 *            the arch's crown.
 *   STANCE   the feet's half-spread.
 */
const HEAD = 0.19
const GAP = 0.035
const ARCH_W = 0.15
const ARCH_H = 0.25
const SWEEP = (12 * Math.PI) / 180
const HIP = 0.36
const STANCE = 0.12

/** Samples along each half of the arch — smooth at any size the symbol is drawn. */
const ARC_SAMPLES = 24

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
    // Built about its own middle: crown at +h/2, feet at −h/2, so placing
    // the figure is placing its centre.
    const crown = h / 2
    const headCy = crown - headR
    const shoulderTop = headCy - headR - h * GAP
    const rx = h * ARCH_W
    const ry = h * ARCH_H
    const archCy = shoulderTop - ry
    const hip = shoulderTop - h * HIP
    const foot = -h / 2
    const stroke = this.stroke

    this.head = this.add(new Circle({ radius: headR, y: headCy, tint: this.tint, stroke }))

    // The arch, as two halves from its crown out and down to each hand —
    // so the arms draw on from the shoulders, symmetrically.
    const half = (side: -1 | 1) => {
      const pts = []
      const a0 = Math.PI / 2
      const a1 = side > 0 ? -SWEEP : Math.PI + SWEEP
      for (let i = 0; i <= ARC_SAMPLES; i++) {
        const a = a0 + (a1 - a0) * (i / ARC_SAMPLES)
        pts.push({ x: rx * Math.cos(a), y: archCy + ry * Math.sin(a), z: 0 })
      }
      return new Line({ points: pts, tint: this.tint, stroke })
    }
    this.armLeft = this.add(half(-1))
    this.armRight = this.add(half(1))

    this.spine = this.add(
      new Line({ points: [{ x: 0, y: shoulderTop, z: 0 }, { x: 0, y: hip, z: 0 }], tint: this.tint, stroke }),
    )
    // Legs from the hip, a quiet stance.
    this.legLeft = this.add(
      new Line({ points: [{ x: 0, y: hip, z: 0 }, { x: -h * STANCE, y: foot, z: 0 }], tint: this.tint, stroke }),
    )
    this.legRight = this.add(
      new Line({ points: [{ x: 0, y: hip, z: 0 }, { x: h * STANCE, y: foot, z: 0 }], tint: this.tint, stroke }),
    )
  }
}
