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
import { Lens } from "../vocabulary/Lens/Lens"
import { FourierTrace } from "../vocabulary/Fourier/Fourier"
import { Plot } from "../vocabulary/Plot/Plot"
import { Regenaissance } from "../vocabulary/Regenaissance/Regenaissance"
import { SOPLoop } from "../vocabulary/SOPLoop/SOPLoop"
import { Horizons } from "../vocabulary/Horizons/Horizons"
import { Earth } from "../vocabulary/Earth/Earth"

/** Distance between neighbouring symbols, scene units. */
const CELL = 900
/** The second row hangs this far below the first. */
const ROW = -1300

/** A five-petalled rose, as the Fourier machine's path. */
const rose = Array.from({ length: 400 }, (_, i) => {
  const t = (i / 400) * 2 * Math.PI
  const r = 160 * Math.cos(5 * t)
  return { x: r * Math.cos(t), y: r * Math.sin(t) }
})

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
  // The second row.
  lens = new Lens({ observer: this.observer, x: -3 * CELL, y: ROW, radius: 160 })
  fourier = new FourierTrace({ path: rose, terms: 40, stroke: 3, x: -2 * CELL, y: ROW, scale: 1.4 })
  plot = new Plot({ fn: (x: number) => Math.sin(x), domain: [0, 2 * Math.PI], range: [-1.2, 1.2], width: 700, height: 420, x: -1 * CELL, y: ROW, scale: 0.9 })
  regen = new Regenaissance({ radius: 330, y: ROW })
  loop = new SOPLoop({ radius: 380, x: 1 * CELL, y: ROW })
  horizons = new Horizons({ x: 2 * CELL, y: ROW, scale: 0.45 })
  earth = new Earth({ radius: 320, x: 3 * CELL, y: ROW })

  unfold() {
    const o = this.observer
    // Far enough back to see the whole row; the arrows frame each in turn.
    o.radius.value = o.radius.defaultValue = 6400
    o.y.value = o.y.defaultValue = ROW / 2
    const all = [
      this.eye, this.cube, this.virus, this.map, this.calculator, this.road, this.quote,
      this.lens, this.fourier, this.plot, this.regen, this.loop, this.horizons, this.earth,
    ]
    for (const h of all) this.stage(h)
    for (const h of all) if (h !== this.quote) this.play(Create(h), 0.9)
    // The calculator shows its answer (it is born with it hidden, for its own song).
    this.play(this.calculator.out.opacity.to(1), 0.4)
    // The quote is hung written and credited — its own axes undo and redo it.
    this.play(this.quote.writing.to(1), 1.2)
    this.play(this.quote.crediting.to(1), 0.6)
    // Each shows its own picture: the rose drawn, the curve revealed, the horizons out.
    this.play(this.fourier.turn.to(1), 1.5)
    this.play(this.plot.reveal.to(1), 1)
    this.play(this.horizons.reveal.to(this.horizons.data.horizons.length), 1)
    this.wait(0.5)
  }
}

if (import.meta.main) render(GalleryDream)
