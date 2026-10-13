/**
 * GalleryDemo.ts — A DreamWeaving
 *
 * The walkable symbols side by side: every holon here declares its state
 * space (Holon.stateSpace(), src/automaton.ts), so in free play
 * (`?scene=gallery&play=free`) each one is a visual automaton of its own.
 * ← → walk from symbol to symbol (the view glides to frame it, and its
 * axes alone are live on the keys and the HUD), a click acts on any of
 * them, Esc steps back to see them all; drag to look around.
 *
 * The song itself is only the gallery being hung: each symbol is created
 * in turn, then everything rests — the last pose is where free play opens.
 */

import { Dream, render } from "../src/index"
import { Create } from "../src/verbs"
import { BLUE, RED } from "../src/constants"
import { Eye } from "../vocabulary/Eye/Eye"
import { FoldableCube } from "../vocabulary/FoldableCube/FoldableCube"
import { MindVirus } from "../vocabulary/MindVirus/MindVirus"
import { Road } from "../vocabulary/Road/Road"
import { FlowMap } from "../vocabulary/FlowMap/FlowMap"
import { Calculator } from "./creatormode/Calculator"
import { Quote } from "../vocabulary/Quote/Quote"

/** Distance between neighbouring symbols, scene units. */
const CELL = 900

export class GalleryDream extends Dream {
  eye = new Eye({ tint: BLUE, scale: 0.55, x: -3 * CELL })
  cube = new FoldableCube({ size: 260, tint: RED, x: -2 * CELL, p: -0.5, h: 0.6 })
  virus = new MindVirus({ scale: 2.6, x: -1 * CELL, h: -0.5, p: 0.35 })
  map = new FlowMap({ radius: 260, x: 0, seenBy: () => this.observer })
  calculator = new Calculator({ scale: 0.9, x: 1 * CELL })
  road = new Road({ x: 2 * CELL, y: -60, scale: 0.9, h: -0.4, p: 0.25 })
  quote = new Quote({
    x: 3 * CELL,
    scale: 0.5,
    lines: ["Every symbol", "is a state machine."],
    attribution: "the gallery",
  })

  unfold() {
    const o = this.observer
    // Far enough back to see the whole row; the arrows frame each in turn.
    o.radius.value = o.radius.defaultValue = 5200
    const all = [this.eye, this.cube, this.virus, this.map, this.calculator, this.road, this.quote]
    for (const h of all) this.stage(h)
    for (const h of all) if (h !== this.quote) this.play(Create(h), 0.9)
    // The calculator shows its answer (it is born with it hidden, for its own song).
    this.play(this.calculator.out.opacity.to(1), 0.4)
    // The quote is hung written and credited — its own axes undo and redo it.
    this.play(this.quote.writing.to(1), 1.2)
    this.play(this.quote.crediting.to(1), 0.6)
    this.wait(0.5)
  }
}

if (import.meta.main) render(GalleryDream)
