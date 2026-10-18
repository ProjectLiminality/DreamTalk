/**
 * ib-campfire.test.ts — the DigitalCampfire (InterBrain film 31:31, 32:51;
 * f9451, f9541): the vesica measured on f9451, the InterBrains over their
 * shells, the gathering composed of SandTalk with its fire banked, the
 * gardens in the blooms, and the loops open at the symbol.
 */

import { describe, expect, test } from "bun:test"
import { CAMPFIRE, DigitalCampfire, loopPoints } from "../vocabulary/DigitalCampfire/DigitalCampfire"
import { InterBrainGem, CRYSTAL } from "../vocabulary/InterBrain/InterBrainGem"
import { SandTalk } from "../vocabulary/SandTalk/SandTalk"
import { DreamGarden } from "../vocabulary/DreamGarden/DreamGarden"

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)
const U = 400

describe("DigitalCampfire", () => {
  test("overlap 1 is f9451's vesica: shells 0.953·U apart, crossing 163/189 of their half-height up", () => {
    const c = new DigitalCampfire({ size: U })
    void c.parts
    const [l, r] = c.shells
    near(r!.x.value - l!.x.value, CAMPFIRE.shellGap * U)
    near(l!.x.value, -r!.x.value)
    // where they cross: x = 0, y = ry·√(1 − (gap/2)²)
    const ry = CAMPFIRE.shellAspect * U
    const cross = ry * Math.sqrt(1 - (CAMPFIRE.shellGap / 2) ** 2)
    expect(Math.abs(cross / ry - 163 / 189)).toBeLessThan(0.03)
  })

  test("overlap 0: the two worlds apart, not touching", () => {
    const c = new DigitalCampfire({ size: U, overlap: 0 })
    void c.parts
    const [l, r] = c.shells
    expect(r!.x.value - l!.x.value).toBeGreaterThan(2 * U)
  })

  test("each InterBrain stands over its shell, at f9451's size and height", () => {
    const c = new DigitalCampfire({ size: U })
    void c.parts
    c.crystals.forEach((ib, i) => {
      expect(ib).toBeInstanceOf(InterBrainGem)
      near(ib.x.value, c.shells[i]!.x.value)
      near(ib.radius.value, CAMPFIRE.crystal * U)
      near(ib.y.value, CAMPFIRE.crystalY * U)
    })
  })

  test("the gathering is SandTalk, its fire banked by default and lit by hearth", () => {
    const c = new DigitalCampfire({ size: U })
    void c.parts
    expect(c.sandTalk).toBeInstanceOf(SandTalk)
    near(c.sandTalk.size.value, CAMPFIRE.talk * U)
    near(c.sandTalk.fire.scale.value, 0)
    near(c.sandTalk.fire.flame.opacity.value, 0)
    c.hearth.value = 1
    expect(c.sandTalk.fire.scale.value).toBeGreaterThan(0)
    near(c.sandTalk.fire.flame.opacity.value, 1)
    c.talk.value = 0
    near(c.gathering.there.value, 0)
  })

  test("gardens: 0 the Logo in each bloom, 1 the garden instead — filling the Logo's ring", () => {
    const c = new DigitalCampfire({ size: U })
    void c.parts
    expect(c.gardenL).toBeInstanceOf(DreamGarden)
    const logo0 = c.crystals[0]!.logo.scale.value
    expect(logo0).toBeGreaterThan(0)
    c.gardens.value = 1
    near(c.crystals[0]!.logo.scale.value, 0)
    near(c.gardenL.radius.value, CAMPFIRE.garden * CRYSTAL.logo * CAMPFIRE.crystal * U)
  })

  test("the loops are open at the symbol, closed elsewhere, mirrored", () => {
    const S = 100
    const L = loopPoints(S, -1, 0.4)
    const R = loopPoints(S, 1, 0.4)
    // no point of either loop inside the symbol's ring
    for (const p of [...L, ...R]) expect(Math.hypot(p.x, p.y / CAMPFIRE.symbolAspect)).toBeGreaterThan(CAMPFIRE.symbol * S * 0.9)
    L.forEach((p, i) => {
      near(p.x, -R[i]!.x)
      near(p.y, -R[i]!.y)
    })
  })
})
