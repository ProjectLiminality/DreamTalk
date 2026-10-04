import { describe, expect, test } from "bun:test"
import { GREAT_CIRCLE_NORMALS, greatCircleHalves, outsideDisc } from "../vocabulary/Regenaissance/lattice"
import { REGEN, Regenaissance, vesicaOutline } from "../vocabulary/Regenaissance/Regenaissance"
import { SMARK, SMARK_PEN, SMark, sBandOutline, sCentreline } from "../vocabulary/Regenaissance/SMark"
import { buildSymbol } from "../sketch/vocabulary"
import { flattenSymbol } from "../sketch/mirror"

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

  test("the pen runs the S's centreline: tip → centre → tip on the two semicircles", () => {
    const c = sCentreline(100)
    const k = SMARK.offset * 100
    const d = k * Math.SQRT1_2
    for (const p of c) {
      const onD = Math.abs(Math.hypot(p.x - d, p.y - d) - k) < 1e-6
      const onQ = Math.abs(Math.hypot(p.x + d, p.y + d) - k) < 1e-6
      expect(onD || onQ).toBe(true)
    }
    expect(Math.hypot(c[0]!.x - 2 * d, c[0]!.y - 2 * d)).toBeLessThan(1e-9)
    expect(Math.hypot(c[c.length - 1]!.x + 2 * d, c[c.length - 1]!.y + 2 * d)).toBeLessThan(1e-9)
    expect(c.some((p) => Math.hypot(p.x, p.y) < 1e-9)).toBe(true)
  })

  test("no pen on the band's edges (a constant weight that swelled small marks); a fixed one on its spine", () => {
    const mark = new SMark({ radius: 10 })
    void mark.parts
    const [edge] = mark.band.parts
    expect(edge!.opacity.value).toBe(0)
    expect(mark.band.fillOpacity.value).toBe(1)
    expect(mark.spine.stroke.value).toBe(SMARK_PEN)
    // the pen is a screen weight: it does not grow with the mark
    const big = new SMark({ radius: 400 })
    void big.parts
    expect(big.spine.stroke.value).toBe(SMARK_PEN)
  })

  test("on the tablet the mark is ONE solid grey: band filled, its spine and the dot's rim in the band's grey", () => {
    const prims = flattenSymbol({ symbol: "sMark", params: { cx: 300, cy: 300, size: 200 } })
    const fills = prims.filter((p) => p.k === "fill")
    // band, dot and square each a fill
    expect(fills.length).toBe(3)
    const greys = new Set(prims.map((p) => p.grey ?? 0))
    expect(greys.size).toBe(1)
    expect([...greys][0]).toBeGreaterThan(0)
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
