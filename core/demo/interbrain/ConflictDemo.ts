/**
 * ConflictDemo.ts — A DreamWeaving
 *
 * The Conflict standing alone, in the film's three uses. One bolt strikes
 * in at the centre (f264–f267) — the conflict between two things (f346) —
 * turns to point (f436) and back, and goes. Then the two pathologies'
 * rings (f541): Chaos's bolts flying outward on a circle (left), and
 * Oppression's striking inward on a square (right), each strikes in
 * gathered and explodes out to its ring.
 *
 * Framing: the default eye projects z = 0 at 720/1500 = 0.48 px per unit,
 * so the frames' pixels convert by ÷ 0.48: the single bolt is 163 px long
 * (340), the ring bolts 49 px (102); Chaos's ring is centred at x 347 px
 * (−610) with its bolts 125.5 px out (261); Oppression's at 935 px (+615),
 * its square ring 129 px from the centre to a side (268).
 */

import { Dream, render } from "../../src/index"
import { Create, UnCreate } from "../../src/verbs"
import { together } from "../../src/anim"
import { TAU } from "../../src/constants"
import { Conflict } from "../../vocabulary/Conflict/Conflict"

const PX = 720 / 1500

export class ConflictDemoDream extends Dream {
  bolt = new Conflict({ size: 163 / PX })
  chaos = new Conflict({ size: 49 / PX, count: 8, radius: 125.5 / PX, direction: 0, spread: 0, x: (347 - 640) / PX, creation: 0 })
  oppression = new Conflict({
    size: 49 / PX,
    count: 8,
    radius: 129 / PX,
    ring: "square",
    direction: TAU / 2,
    spread: 0,
    x: (935 - 640) / PX,
    creation: 0,
  })

  unfold() {
    this.play(Create(this.bolt), 0.6)
    this.wait(1)
    this.play(this.bolt.direction.to(0), 0.6)
    this.wait(1)
    this.play(this.bolt.direction.to(-TAU / 4), 0.6)
    this.wait(0.5)
    this.play(UnCreate(this.bolt), 0.4)
    this.play(together(Create(this.chaos), Create(this.oppression)), 0.4)
    this.play(together(this.chaos.spread.to(1), this.oppression.spread.to(1)), 1.2)
    this.wait(2)
  }
}

if (import.meta.main) render(ConflictDemoDream)
