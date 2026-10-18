/**
 * DigitalCampfireDemo — the digital campfire (InterBrain film 31:31–31:54,
 * 32:43–32:59; f9451–f9601).
 *
 * Two InterBrains come up in their overlapping worlds (f9451); two people
 * sit down between them at a symbol (f9481); the view moves in as each
 * InterBrain's bloom opens onto its dream garden (f9541), and a node is
 * cloned from one garden into the other, and one back.
 *
 * Framing (default observer, 0.48 px per unit at 720p): f9451's shells are
 * 371.5 px half-wide, their middle 38 px below the frame's; f9541 is the
 * same picture 2.4× about that middle, which then sits 128 px below the frame's.
 */

import { Dream, render } from "../../src/index"
import { Group } from "../../src/parts/primitives"
import { together } from "../../src/anim"
import { Create } from "../../src/verbs"
import { DigitalCampfire } from "../../vocabulary/DigitalCampfire/DigitalCampfire"

const PX = 0.48

const scene = () => {
  const fire = new DigitalCampfire({ talk: 0 })
  const group = new Group({ y: -38 / PX, members: [fire] })
  void fire.parts
  const frame = () => group
  const there = fire.gardenL.crossPollinate(1, fire.gardenR, frame)
  const back = fire.gardenR.crossPollinate(2, fire.gardenL, frame)
  group.attach(there)
  group.attach(back)
  return { group, fire, there, back }
}

export class DigitalCampfireDemoDream extends Dream {
  campfire = scene()

  unfold() {
    const { group, fire, there, back } = this.campfire
    this.play(Create(fire), 3)
    this.wait(1)
    this.play(fire.talk.to(1), 1.5)
    this.wait(1)
    this.play(together(group.scale.to(2.4), group.y.to(-128 / PX), fire.gardens.to(1), fire.shellOpacity.to(0.4)), 2.5)
    this.wait(1)
    this.play(Create(there), 2.5)
    this.play(Create(back), 2.5)
    this.wait(2)
  }
}

if (import.meta.main) render(DigitalCampfireDemoDream)
