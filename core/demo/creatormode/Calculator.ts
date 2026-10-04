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
 * The calculator CONTAINS WHAT IT DOES (HyperTalk: "the button contains
 * what it does"). Its operator is a param — `op`, a choice among four rules
 * — and the output is not drawn, it is DERIVED: `out` says whatever the
 * rule makes of the two operands, recomputed on every read. So changing `op`
 * from `+` to `×` — on the timeline, or in creator mode from the editor's
 * inspector, where it lands as `new Calculator({ op: "×" })` in the
 * DreamWeaving — makes the same holon say 15 where it said 8. The behaviour
 * is data, held by the holon, and git-tracked with the scene.
 */

import { Group, Null, Rectangle } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { choice, derive, text } from "../../src/params"
import { WHITE } from "../../src/constants"

/** Button and field geometry — one grid, stated once.
 *  (`rounding` is a COMPLETION, 0..1, not a pixel radius: 1 is a stadium.) */
const CELL = 120
const GAP = 34

/**
 * The rules the operator button can hold — the button's whole behaviour,
 * as data. The keys are what the button SAYS, so the glyph and the rule
 * cannot disagree.
 */
export const RULES: Readonly<Record<string, (a: number, b: number) => number>> = {
  "+": (a, b) => a + b,
  "−": (a, b) => a - b,
  "×": (a, b) => a * b,
  "÷": (a, b) => a / b,
}

/** What a rule makes of two typed operands, as the output field shows it. */
export const compute = (a: string, op: string, b: string): string => {
  const rule = RULES[op]
  const r = rule ? rule(Number(a), Number(b)) : NaN
  if (!Number.isFinite(r)) return "—"
  // Six places are a calculator's honesty; trailing zeros are not.
  return String(Math.round(r * 1e6) / 1e6).replace("-", "−")
}

export class Calculator extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  // --- what the calculator IS: two inputs and a rule ---------------------
  // Strings, because an input field holds what was typed into it.
  // (Not `a`/`b`: `b` is every holon's bank angle.)
  inputA = text("3")
  inputB = text("5")
  op = choice("+", Object.keys(RULES))

  // The window the app lives in. In DreamOS this frame is not decoration:
  // it is the boundary of the DreamNode — window ≡ folder ≡ place.
  frame = new Rectangle({ width: 520, height: 400, rounding: 0.12, tint: WHITE })

  // --- the two operands ---------------------------------------------------
  // Each glyph SHARES its input param: it says exactly what was typed.
  slotA = new Rectangle({ width: CELL, height: CELL, rounding: 0.18, x: -(CELL + GAP), y: 90, tint: WHITE })
  valueA = new Text({ content: this.inputA, size: 64, tint: WHITE, x: -(CELL + GAP), y: 90 })
  slotB = new Rectangle({ width: CELL, height: CELL, rounding: 0.18, x: CELL + GAP, y: 90, tint: WHITE })
  valueB = new Text({ content: this.inputB, size: 64, tint: WHITE, x: CELL + GAP, y: 90 })

  /**
   * The operator — the button the whole scene turns on. ONE glyph whose
   * content IS the `op` param: select it in creator mode and the inspector
   * offers the four rules; pick one and the edit is written where `op` is
   * declared — on this Calculator's construction.
   */
  opButton = new Rectangle({ width: CELL, height: CELL, rounding: 0.18, y: 90, tint: WHITE })
  opGlyph = new Text({ content: this.op, size: 64, tint: WHITE, y: 90 })

  // --- the result ---------------------------------------------------------
  outSlot = new Rectangle({ width: CELL * 3 + GAP * 2, height: CELL, rounding: 0.18, y: -90, tint: WHITE })
  /** Not edited — RE-COMPUTED: a reading of the inputs through the rule. */
  out = new Text({
    content: derive(() => compute(this.inputA.value, this.op.value, this.inputB.value)),
    size: 72,
    tint: WHITE,
    y: -90,
    opacity: 0,
  })

  /** Everything, for one-line staging and fades. */
  all = new Group({
    members: [
      this.frame,
      this.slotA,
      this.valueA,
      this.slotB,
      this.valueB,
      this.opButton,
      this.opGlyph,
      this.outSlot,
      this.out,
    ],
  })
}
