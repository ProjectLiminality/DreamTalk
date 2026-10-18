/**
 * DreamGardenDemo — the DreamGarden standing alone, then cross-pollinating
 * (InterBrain film 31:10–31:54).
 *
 * The ring draws from the top and the nodes come up from the middle out —
 * dreams in blue rings, dreamers in red, no node above another (f9406).
 * Then a second garden appears beside it and a node is cloned from each
 * into the other (31:43: "the corresponding dream node is cloned into each
 * other's dream garden").
 *
 * Framing (default observer, 0.48 px per unit at 720p): f9406's ring is
 * 259.6 px, centred in the frame. Each garden plants 18 and keeps one slot
 * free, so the lattice is the film's 19.
 */

import { Dream, render } from "../../src/index"
import { Group } from "../../src/parts/primitives"
import { together } from "../../src/anim"
import { Create } from "../../src/verbs"
import { DreamGarden } from "../../vocabulary/DreamGarden/DreamGarden"

const PX = 0.48

const scene = () => {
  const mine = new DreamGarden({ radius: 259.6 / PX, count: 18, room: 1, seed: 1 })
  const theirs = new DreamGarden({ radius: 259.6 / PX, count: 18, room: 1, seed: 5, x: 3000, scale: 0.55 })
  const group = new Group({ members: [mine, theirs] })
  const frame = () => group
  const there = mine.crossPollinate(4, theirs, frame)
  const back = theirs.crossPollinate(7, mine, frame)
  group.attach(there)
  group.attach(back)
  return { group, mine, theirs, there, back }
}

export class DreamGardenDemoDream extends Dream {
  garden = scene()

  unfold() {
    const { mine, theirs, there, back } = this.garden
    this.play(Create(mine), 4)
    this.wait(1.5)
    this.play(together(mine.x.to(-650), mine.scale.to(0.55), theirs.x.to(650)), 1.5)
    this.play(Create(theirs), 2.5)
    this.play(Create(there), 2.5)
    this.play(Create(back), 2.5)
    this.wait(2)
  }
}

if (import.meta.main) render(DreamGardenDemoDream)
