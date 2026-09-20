/**
 * Calculator — the arena David chose to make the two modes concrete.
 *
 *   "you are in this arena of the calculator, and your agent in that arena,
 *    like your avatar, is your cursor. In game mode you can click while your
 *    mouse is over the plus button, and it will write the number eight to the
 *    output field, because that's how the game works. But now in creator mode
 *    … you select it … and you could say, I want this button to actually do a
 *    multiplication instead of addition."
 *
 * Deliberately the plainest possible app: two operands, an operator button, an
 * output. Anything more would be about calculators, and this scene is not
 * about calculators — it is about the fact that a thing you can USE is also a
 * thing you can CHANGE, and that only one gesture separates the two.
 *
 * Every piece is a named field, because the scene has to address them
 * individually: light this button, glow that one, rewrite this operator,
 * change that number. A blob of geometry could be drawn but not operated on,
 * and being operable is the whole point.
 *
 * The operator and the output are DATA (plain `Text` content), not fixed
 * drawing, so the scene can switch `+`→`×` and `8`→`15` and have the same
 * holon simply say something else. That is the small, honest version of the
 * transmission's claim: the symbol carries what it does.
 */

import { Group, Null, Rectangle } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { WHITE } from "../../src/constants"

/** Button and field geometry — one grid, stated once.
 *  (`rounding` is a COMPLETION, 0..1, not a pixel radius: 1 is a stadium.) */
const CELL = 120
const GAP = 34

export class Calculator extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  // The window the app lives in. In DreamOS this frame is not decoration:
  // it is the boundary of the DreamNode — window ≡ folder ≡ place.
  frame = new Rectangle({ width: 520, height: 400, rounding: 0.12, tint: WHITE })

  // --- the two operands ---------------------------------------------------
  slotA = new Rectangle({ width: CELL, height: CELL, rounding: 0.18, x: -(CELL + GAP), y: 90, tint: WHITE })
  valueA = new Text({ content: "3", size: 64, tint: WHITE, x: -(CELL + GAP), y: 90 })
  slotB = new Rectangle({ width: CELL, height: CELL, rounding: 0.18, x: CELL + GAP, y: 90, tint: WHITE })
  valueB = new Text({ content: "5", size: 64, tint: WHITE, x: CELL + GAP, y: 90 })

  /**
   * The operator — the button the whole scene turns on.
   *
   * TWO glyphs, not one that changes: `Text.content` is DATA, fixed at
   * construction (like Line.points), so a rule cannot be edited in place.
   * That constraint turns out to say the right thing — the old rule LEAVES
   * and the new rule ARRIVES, which is what changing a rule actually is.
   * `opPlus` is written at birth; `opTimes` waits at opacity 0 for the
   * moment creator mode rewrites the behaviour.
   */
  opButton = new Rectangle({ width: CELL, height: CELL, rounding: 0.18, y: 90, tint: WHITE })
  opPlus = new Text({ content: "+", size: 64, tint: WHITE, y: 90 })
  opTimes = new Text({ content: "×", size: 64, tint: WHITE, y: 90, opacity: 0 })

  // --- the result ---------------------------------------------------------
  outSlot = new Rectangle({ width: CELL * 3 + GAP * 2, height: CELL, rounding: 0.18, y: -90, tint: WHITE })
  /** What the old rule produced, and what the new one produces. Same reason
   *  as the operator: a result is not edited, it is RE-COMPUTED. */
  out8 = new Text({ content: "8", size: 72, tint: WHITE, y: -90, opacity: 0 })
  out15 = new Text({ content: "15", size: 72, tint: WHITE, y: -90, opacity: 0 })

  /** Everything, for one-line staging and fades. */
  all = new Group({
    members: [
      this.frame,
      this.slotA,
      this.valueA,
      this.slotB,
      this.valueB,
      this.opButton,
      this.opPlus,
      this.opTimes,
      this.outSlot,
      this.out8,
      this.out15,
    ],
  })
}
