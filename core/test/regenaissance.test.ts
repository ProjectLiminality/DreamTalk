import { describe, expect, test } from "bun:test"
import { GREAT_CIRCLE_NORMALS, greatCircleHalves, outsideDisc } from "../vocabulary/Regenaissance/lattice"
import { REGEN, Regenaissance, vesicaOutline } from "../vocabulary/Regenaissance/Regenaissance"
import { SMARK, SMark, sBandOutline } from "../vocabulary/Regenaissance/SMark"
import { buildSymbol } from "../sketch/vocabulary"

describe("Regenaissance", () => {
  test("the lattice is the icosahedron's 15 great circles, each a unit circle split at the limb", () => {
    expect(GREAT_CIRCLE_NORMALS.length).toBe(15)
    for (let k = 0; k < 15; k++) {
      const { front, back } = greatCircleHalves(k, 100, 0.3, 0.45)
      for (const p of [...front, ...back]) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(100 + 1e-9)
      // The halves meet at the limb, end to end.
      expect(Math.hypot(front[0]!.x - back[back.length - 1]!.x, front[0]!.y - back[back.length - 1]!.y)).toBeLessThan(1e-9)
      expect(Math.hypot(front[0]!.x, front[0]!.y)).toBeCloseTo(100, 6)
    }
  })

  test("outsideDisc keeps only the runs outside, cut on the rim", () => {
    const line = Array.from({ length: 21 }, (_, i) => ({ x: -10 + i, y: 0 }))
    const runs = outsideDisc(line, 0, 0, 4.5)
    expect(runs.length).toBe(2)
    expect(runs[0]![runs[0]!.length - 1]!.x).toBeCloseTo(-4.5, 4)
    expect(runs[1]![0]!.x).toBeCloseTo(4.5, 4)
  })

  test("the vesica piscis: tips at ±√3·r/2, r tall", () => {
    const v = vesicaOutline(100)
    const xs = v.map((p) => p.x)
    const ys = v.map((p) => p.y)
    expect(Math.max(...xs)).toBeCloseTo((Math.sqrt(3) / 2) * 100, 6)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(100, 6)
  })

  test("the S is two semicircles kissing at the centre, tips at ±0.76·R on the diagonal", () => {
    const o = sBandOutline(100)
    // Every point lies on one of the four band-edge circles about ±D.
    const k = SMARK.offset * 100
    const w = (SMARK.band * 100) / 2
    const c = k * Math.SQRT1_2
    for (const p of o) {
      const dD = Math.hypot(p.x - c, p.y - c)
      const dQ = Math.hypot(p.x + c, p.y + c)
      const near = [dD, dQ].some((d) => Math.abs(d - (k - w)) < 1e-6 || Math.abs(d - (k + w)) < 1e-6)
      expect(near).toBe(true)
    }
    // The upper tip's centreline point sits at 2k along the diagonal = 0.76·R.
    const tip = { x: (o[0]!.x + o[o.length - 2]!.x) / 2, y: (o[0]!.y + o[o.length - 2]!.y) / 2 }
    expect(Math.hypot(tip.x, tip.y)).toBeCloseTo(76, 6)
  })

  test("the holon composes from one radius and its proportions", () => {
    const regen = new Regenaissance({ radius: 390 })
    void regen.parts
    expect(regen.outer.radius.value).toBe(390)
    expect(regen.topCircle.radius.value).toBeCloseTo(REGEN.globe * 390, 9)
    expect(regen.topCircle.y.value).toBeCloseTo((REGEN.globe * 390) / 2, 9)
    expect(regen.eyeRing.radius.value).toBeCloseTo(REGEN.mark * REGEN.globe * 390, 9)
    expect(regen.sMark).toBeInstanceOf(SMark)
    expect(new Regenaissance({ mark: false }).parts.some((p) => p instanceof SMark)).toBe(false)
  })

  test("sketch: the S-mark's size is its drawn height", () => {
    const g = buildSymbol({ id: "s", symbol: "sMark", params: { cx: 0, cy: 0, size: 137.8 }, fromStrokes: [] })
    const mark = g.parts[0] as SMark
    expect(mark.radius.value).toBeCloseTo(100, 1)
  })
})
