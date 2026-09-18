/**
 * Arena — the blue circle that holds an agent.
 *
 * The whiteboard's most-repeated glyph: it appears top-left as the
 * primitive, again centre-bottom as the PHYSICAL arena, and a third time
 * inside the laptop screen as the virtual arena on a display. Three
 * drawings, one idea — so it is one holon, created once and reused at
 * three scales (the transmission's "repeated glyphs are the reusable
 * holons").
 *
 * It is deliberately thin: an arena IS just the boundary that makes an
 * inside. Everything else on the board is about what happens in it.
 */

import { Circle } from "../../src/parts/primitives"
import { BLUE } from "../../src/constants"
import { Stroke } from "../../src/parts/primitives"
import { length } from "../../src/params"

export class Arena extends Stroke {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  radius = length(200)

  boundary!: Circle

  protected override compose(): void {
    this.boundary = this.add(
      new Circle({ radius: this.radius, tint: BLUE, stroke: this.stroke }),
    )
  }
}

/** The board's blue, restated once so a scene never hand-rolls the hue. */
export const ARENA_TINT = BLUE
