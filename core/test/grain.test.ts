/**
 * The material symbols (Pallet, FilmReel, Pouch, SheetStack) and Grain —
 * the particle that climbs the ladder of knowledge.
 */

import { describe, expect, test } from "bun:test"
import { Observer } from "../src/dream"
import { BLUE, RED } from "../src/constants"
import { totalLength } from "../src/geometry/correspond"
import type { SolidDrawing } from "../src/parts/soliddrawing"
import { Pallet } from "../vocabulary/Pallet/Pallet"
import { FilmReel } from "../vocabulary/FilmReel/FilmReel"
import { Pouch } from "../vocabulary/Pouch/Pouch"
import { SheetStack } from "../vocabulary/SheetStack/SheetStack"
import { Grain, NEUTRAL, RUNG, grainPhases, rungCertainty } from "../vocabulary/Grain/Grain"
import { solidBounds } from "../src/geometry/hiddenline"

/** A three-quarter view from above, orthographic — the grain scene's camera. */
const observer = (): Observer => {
  const o = new Observer()
  o.orthographic.value = true
  o.phi.value = 0.4
  o.theta.value = 0.45
  return o
}

const SYMBOLS: [string, (o: { observer: Observer }) => SolidDrawing][] = [
  ["Pallet (sacks)", (o) => new Pallet(o)],
  ["Pallet (octabin)", (o) => new Pallet({ ...o, load: "octabin" })],
  ["Pallet (bare)", (o) => new Pallet({ ...o, load: "none" })],
  ["FilmReel", (o) => new FilmReel(o)],
  ["Pouch", (o) => new Pouch(o)],
  ["SheetStack", (o) => new SheetStack(o)],
]

/** The bounding box of a set of solids. */
const bounds = (d: SolidDrawing) => {
  const lo = { x: Infinity, y: Infinity, z: Infinity }
  const hi = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const s of d.solids()) {
    const b = solidBounds(s)
    for (const a of ["x", "y", "z"] as const) {
      lo[a] = Math.min(lo[a], b.lo[a])
      hi[a] = Math.max(hi[a], b.hi[a])
    }
  }
  return { lo, hi }
}

describe("the material symbols", () => {
  for (const [name, make] of SYMBOLS) {
    test(`${name}: draws visible edges and fills, deterministically, within its slots`, () => {
      const a = make({ observer: observer() })
      const b = make({ observer: observer() })
      const da = a.drawing()
      expect(da.lines.length).toBeGreaterThan(4)
      // A bare pallet is all wood, and the wood is lines only (Pallet.ts).
      if (name !== "Pallet (bare)") expect(da.faces.length + (da.surfaces?.length ?? 0)).toBeGreaterThan(0)
      expect(b.drawing()).toEqual(da)
      // Every visible span has a slot to be drawn in.
      const slots = a.parts.length
      expect(da.lines.length + da.faces.length).toBeLessThanOrEqual(slots)
    })

    test(`${name}: the origin is the middle of its bounding box`, () => {
      const { lo, hi } = bounds(make({ observer: observer() }))
      for (const a of ["x", "y", "z"] as const) expect(lo[a] + hi[a]).toBeCloseTo(0, 6)
    })
  }

  test("the material param colours the load, not the wood", () => {
    const p = new Pallet({ material: BLUE })
    const fills = p.solids().map((s) => s.fill)
    expect(fills.some((f) => f && f.b === BLUE.b && f.r === BLUE.r)).toBe(true)
    // The deck is unfilled (see Pallet.ts): it hides lines, never the load's fill.
    expect(fills.some((f) => f === undefined)).toBe(true)
  })
})

describe("Grain — the rungs", () => {
  test("rung certainty is piecewise linear between the rungs' own", () => {
    const k = [1, 0.8, 0.2, 0.6]
    expect(rungCertainty(0, k)).toBe(1)
    expect(rungCertainty(2, k)).toBeCloseTo(0.2, 12)
    expect(rungCertainty(1.5, k)).toBeCloseTo(0.5, 12)
    expect(rungCertainty(3, k)).toBeCloseTo(0.6, 12)
    expect(rungCertainty(-1, k)).toBe(1)
    expect(rungCertainty(9, k)).toBeCloseTo(0.6, 12)
  })

  test("every channel is continuous in the rung (no jumps anywhere on 0…3)", () => {
    const dg = 1e-3
    let prev = grainPhases(0)
    for (let g = dg; g <= 3 + 1e-9; g += dg) {
      const cur = grainPhases(g)
      for (const key of ["color", "fillOut", "morph", "fillIn", "label"] as const)
        expect(Math.abs(cur[key] - prev[key])).toBeLessThan(dg * 8)
      for (const key of ["fillOut", "morph", "fillIn"] as const)
        expect(Math.abs(cur.item[key] - prev.item[key])).toBeLessThan(dg * 8)
      prev = cur
    }
  })

  test("the rungs in order: colour, then the morph (fill out → travel → fill in), then the label", () => {
    const flat = (g: number) => {
      const { item: _, ...rest } = grainPhases(g)
      return rest
    }
    expect(flat(0)).toEqual({ color: 0, fillOut: 0, morph: 0, fillIn: 0, label: 0 })
    expect(flat(1)).toEqual({ color: 1, fillOut: 0, morph: 0, fillIn: 0, label: 0 })
    const two = grainPhases(2)
    expect([two.color, two.fillOut, two.morph, two.label]).toEqual([1, 1, 1, 0])
    expect(two.fillIn).toBeCloseTo(1, 12)
    expect(grainPhases(3).label).toBe(1)
    const mid = grainPhases(1.5)
    expect(mid.fillOut).toBe(1)
    expect(mid.morph).toBeCloseTo(0.5, 12)
    expect(mid.fillIn).toBe(0)
  })

  test("the dot's colour goes from neutral to its category's", () => {
    const g = new Grain({ category: RED })
    expect(g.dotTint()).toEqual(NEUTRAL)
    g.grain.value = RUNG.category
    expect(g.dotTint()).toEqual(RED)
    g.grain.value = 0.5
    expect(g.dotTint().r).toBeCloseTo((NEUTRAL.r + RED.r) / 2, 9)
  })

  test("the grain's certainty follows the rung it stands on", () => {
    const g = new Grain({ typeKnown: 0.25, itemKnown: 0.5 })
    expect(g.certainty.value).toBe(1)
    g.grain.value = RUNG.type
    expect(g.certainty.value).toBeCloseTo(0.25, 12)
    g.grain.value = 1.5
    expect(g.certainty.value).toBeCloseTo(0.625, 12)
    g.typeKnown.value = 1 // the data arrives
    g.grain.value = RUNG.type
    expect(g.certainty.value).toBe(1)
  })
})

describe("Grain — the morph, in its own frame", () => {
  const make = (overrides: Record<string, unknown> = {}) => {
    const g = new Grain({ observer: observer(), category: BLUE, symbol: (o) => new FilmReel(o), size: 80, stand: true, ...overrides })
    void g.parts // compose
    return g
  }

  test("just past rung 1 the pieces ARE the dot's outline; just before the fill comes in they ARE the symbol's edges", () => {
    const g = make()
    const dot = totalLength([g.dotOutline()])
    g.grain.value = 1 + 0.2 + 1e-9 // fill out done, travel at u ≈ 0
    expect(totalLength(g.pieces())).toBeCloseTo(dot, 3)
    g.grain.value = 2 - 0.2 - 1e-9 // travel at u ≈ 1, fill not yet in
    expect(totalLength(g.pieces())).toBeCloseTo(totalLength(g.symbolCurves()), 2)
  })

  test("no pieces at rest: below the morph, and once the symbol stands", () => {
    const g = make()
    expect(g.pieces()).toEqual([])
    g.grain.value = RUNG.type
    expect(g.pieces()).toEqual([])
    g.grain.value = RUNG.item
    expect(g.pieces()).toEqual([])
  })

  test("the pieces move continuously with the rung", () => {
    const g = make()
    const at = (x: number) => {
      g.grain.value = x
      return totalLength(g.pieces())
    }
    let prev = at(1.21)
    for (let x = 1.22; x < 1.79; x += 0.01) {
      const cur = at(x)
      expect(Math.abs(cur - prev)).toBeLessThan(0.08 * Math.max(cur, prev))
      prev = cur
    }
  })

  test("deterministic, and planned once while the grain travels (orthographic)", () => {
    const a = make()
    const b = make()
    a.grain.value = b.grain.value = 1.5
    expect(a.pieces()).toEqual(b.pieces())
    const plan = a.plan()
    a.x.value = 400
    a.y.value = -120
    expect(a.plan()).toBe(plan)
  })

  test("standing, the symbol's base is on the dot's plane", () => {
    const g = make()
    const ys = g.symbolCurves().flat().map((p) => p.y)
    // Nothing below the plane; the lowest VISIBLE line is near it (a
    // round roll seen from above shows its silhouette a little up).
    expect(Math.min(...ys)).toBeGreaterThan(-1e-6)
    expect(Math.min(...ys)).toBeLessThan(0.15 * 80)
  })

  test("the material follows the category", () => {
    const g = make()
    const reel = g.symbol as FilmReel
    g.grain.value = 0
    expect(reel.material.value).toEqual(NEUTRAL)
    g.grain.value = RUNG.type
    expect(reel.material.value).toEqual(BLUE)
  })
})

describe("Grain — the item rung, data-driven", () => {
  const make = () => {
    const g = new Grain({
      observer: observer(),
      category: BLUE,
      symbol: (o) => new FilmReel(o),
      item: (o) => new FilmReel({ ...o, width: 110, diameter: 260 }),
      size: 80,
      stand: true,
    })
    void g.parts
    return g
  }

  test("the exact item is drawn at the TYPE's scale: a narrower, taller reel is narrower and taller", () => {
    const g = make()
    const span = (cs: { x: number; y: number }[][], a: "x" | "y") => {
      const v = cs.flat().map((p) => p[a])
      return Math.max(...v) - Math.min(...v)
    }
    const t = g.symbolCurves()
    const i = g.symbolCurves(g.item)
    expect(span(i, "x")).toBeLessThan(span(t, "x"))
    expect(span(i, "y")).toBeGreaterThan(span(t, "y"))
  })

  test("2 → 3: the type's edges become the item's — exact at both ends of the travel", () => {
    const g = make()
    g.grain.value = 2 + 0.2 + 1e-9
    expect(totalLength(g.pieces())).toBeCloseTo(totalLength(g.symbolCurves()), 2)
    g.grain.value = 3 - 0.2 - 1e-9
    expect(totalLength(g.pieces())).toBeCloseTo(totalLength(g.symbolCurves(g.item)), 2)
    g.grain.value = 3
    expect(g.pieces()).toEqual([])
  })

  test("the handover: the type's symbol shows until its fill is out, the item's from when its fill comes in", () => {
    const g = make()
    const shown = (x: number) => {
      g.grain.value = x
      return [g.symbol!.opacity.value > 0, g.item!.opacity.value > 0]
    }
    expect(shown(2)).toEqual([true, false])
    expect(shown(2.1)).toEqual([true, false])
    expect(shown(2.5)).toEqual([false, false])
    expect(shown(2.95)).toEqual([false, true])
    expect(shown(3)).toEqual([false, true])
  })
})
