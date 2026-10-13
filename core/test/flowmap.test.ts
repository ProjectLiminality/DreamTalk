import { describe, expect, test } from "bun:test"
import {
  categoryDiscs,
  flowPoint,
  memberLayouts,
  partnerLayout,
  sliceDepths,
} from "../src/geometry/flowmap"
import { certainty, certaintyOf, ghost, GHOST_FLOOR, seenOpacity, wobble } from "../src/certainty"
import { Circle, Group } from "../src/parts/primitives"
import { FlowMap, MOCK_FLOWMAP, type FlowMapData } from "../vocabulary/FlowMap/FlowMap"

const R = 300

describe("flow-map geometry", () => {
  test("category discs shrink in from the group's own circumference — the tangent point never moves", () => {
    for (const n of [1, 2, 3, 5]) {
      for (const g of [0, 0.25, 0.5, 1]) {
        for (const d of categoryDiscs(n, R, g)) {
          expect(Math.hypot(d.x, d.y) + d.radius).toBeCloseTo(R, 9)
          if (g === 0) expect(d.radius).toBe(R)
        }
      }
    }
  })

  test("two categories at full grain are the vesica piscis: each centre on the other's rim", () => {
    const [a, b] = categoryDiscs(2, R, 1)
    expect(Math.hypot(a!.x - b!.x, a!.y - b!.y)).toBeCloseTo(a!.radius, 9)
    expect(a!.radius).toBeCloseTo((2 * R) / 3, 9)
    // The first category sits on top.
    expect(a!.y).toBeGreaterThan(0)
    expect(a!.x).toBeCloseTo(0, 9)
  })

  test("member layouts are deterministic, and every member lands in exactly its own region", () => {
    const cats = [[0], [0], [0, 1], [1], [1], [1], [0, 1], [1], []]
    const one = memberLayouts(cats, 2, R, R * 0.058)
    const two = memberLayouts(cats, 2, R, R * 0.058)
    expect(one).toEqual(two)
    const discs = categoryDiscs(2, R, 1)
    cats.forEach((set, i) => {
      const p = one.categorised[i]!
      expect(Math.hypot(p.x, p.y)).toBeLessThan(R)
      discs.forEach((d, k) => {
        const inside = Math.hypot(p.x - d.x, p.y - d.y) < d.radius
        expect(inside).toBe(set.includes(k))
      })
    })
    // Flat: all inside the sunflower, no two members on one petal.
    for (const p of one.flat) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(R * 0.68 + 1e-9)
    expect(new Set(one.flat.map((p) => `${p.x},${p.y}`)).size).toBe(cats.length)
  })

  test("members in one region keep their distance from each other and from every rim", () => {
    const cats = [[1], [1], [1], [1], [1]]
    const { categorised } = memberLayouts(cats, 2, R, R * 0.058)
    for (let i = 0; i < categorised.length; i++)
      for (let j = i + 1; j < categorised.length; j++) {
        const a = categorised[i]!
        const b = categorised[j]!
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(R * 0.058 * 2.5)
      }
  })

  test("partners: suppliers left, customers right, two-way above and below", () => {
    const pos = partnerLayout(["in", "out", "both", "both", "in"], R)
    expect(pos[0]!.x).toBeLessThan(0)
    expect(pos[4]!.x).toBeLessThan(0)
    expect(pos[1]!.x).toBeGreaterThan(0)
    expect(pos[2]!.y).toBeGreaterThan(0)
    expect(pos[3]!.y).toBeLessThan(0)
    for (const p of pos) expect(Math.hypot(p.x, p.y)).toBeGreaterThan(R)
  })

  test("slice depths: flat is one plane; opening never reorders; a closed gap merges two slices", () => {
    expect(sliceDepths([1, 1, 1], 330, 0)).toEqual([0, 0, 0, 0])
    for (const open of [[1, 1, 1], [0.3, 1, 0], [0, 0, 1]]) {
      for (const e of [0.2, 0.7, 1]) {
        const z = sliceDepths(open, 330, e)
        for (let k = 1; k < z.length; k++) expect(z[k]!).toBeGreaterThanOrEqual(z[k - 1]!)
        expect(z[0]! + z[z.length - 1]!).toBeCloseTo(0, 9)
      }
    }
    const z = sliceDepths([1, 0, 1], 330, 1)
    expect(z[1]).toBe(z[2])
  })

  test("a flow's channel runs end to end and bows in the picture's plane", () => {
    const a = { x: -100, y: 0, z: -50 }
    const b = { x: 100, y: 0, z: 50 }
    expect(flowPoint(a, b, 0, 0.2)).toEqual(a)
    expect(flowPoint(a, b, 1, 0.2)).toEqual(b)
    const mid = flowPoint(a, b, 0.5, 0.2)
    expect(mid.z).toBeCloseTo(0, 9)
    expect(mid.y).toBeGreaterThan(0)
  })
})

describe("certainty", () => {
  test("ghost: hard data is untouched, conjecture keeps a floor", () => {
    expect(ghost(1)).toBe(1)
    expect(ghost(0)).toBe(GHOST_FLOOR)
    expect(ghost(-3)).toBe(GHOST_FLOOR)
  })

  test("no certainty anywhere: the renderer gets the holon's own opacity, the very same param", () => {
    const c = new Circle()
    new Group({ members: [c] })
    expect(seenOpacity(c)).toBe(c.opacity)
  })

  test("certainty inherits down the tree, as a product", () => {
    class Branch extends Group {
      certainty = certainty(0.5)
    }
    const leaf = new Circle({ opacity: 0.8 })
    const inner = new Branch({ members: [leaf] })
    const outer = new Branch({ members: [inner] })
    expect(certaintyOf(leaf)).toBeCloseTo(0.25, 12)
    expect(seenOpacity(leaf).value).toBeCloseTo(0.8 * ghost(0.25), 12)
    outer.certainty.value = 1
    expect(seenOpacity(leaf).value).toBeCloseTo(0.8 * ghost(0.5), 12)
  })

  test("wobble: certain things hold still; conjecture hovers, deterministically", () => {
    expect(wobble(3, 1.7, 1, 10)).toEqual({ x: 0, y: 0 })
    expect(wobble(3, 1.7, 0, 10)).toEqual(wobble(3, 1.7, 0, 10))
    const w = wobble(3, 1.7, 0, 10)
    expect(Math.hypot(w.x, w.y)).toBeGreaterThan(0)
    expect(Math.hypot(w.x, w.y)).toBeLessThanOrEqual(10 * Math.SQRT2 + 1e-9)
  })
})

describe("FlowMap", () => {
  test("grain interpolates every member between its two layouts", () => {
    const m = new FlowMap({ radius: R })
    void m.parts
    const flat = m.frame().members.map((p) => ({ ...p }))
    m.grain.value = 1
    const cat = m.frame().members.map((p) => ({ ...p }))
    m.grain.value = 0.5
    m.frame().members.forEach((p, i) => {
      expect(p.x).toBeCloseTo((flat[i]!.x + cat[i]!.x) / 2, 9)
      expect(p.y).toBeCloseTo((flat[i]!.y + cat[i]!.y) / 2, 9)
    })
    // And back exactly.
    m.grain.value = 0
    expect(m.frame().members).toEqual(flat)
  })

  test("expand tilts the stack and spreads the slices; collapsing is face-on and flat again, exactly", () => {
    const m = new FlowMap({ radius: R })
    void m.parts
    expect(Math.abs(m.stack.h.value)).toBe(0)
    expect(m.slices.map((s) => s.z.value)).toEqual([0, 0, 0, 0])
    m.expand.value = 1
    expect(m.stack.h.value).toBeCloseTo(m.tilt.value, 12)
    const z = m.slices.map((s) => s.z.value)
    for (let k = 1; k < z.length; k++) expect(z[k]! - z[k - 1]!).toBeCloseTo(m.gap.value, 9)
    // A stage closed: its two slices merge, the rest keep their order.
    m.stage("semi").open.value = 0
    const zc = m.slices.map((s) => s.z.value)
    expect(zc[2]).toBe(zc[1])
    m.stage("semi").open.value = 1
    m.expand.value = 0
    expect(Math.abs(m.stack.h.value)).toBe(0)
    expect(m.slices.map((s) => Math.abs(s.z.value))).toEqual([0, 0, 0, 0])
  })

  test("one slice per stage boundary; flows, particles and certainty follow the data", () => {
    const m = new FlowMap({ radius: R })
    void m.parts
    expect(m.slices.length).toBe(MOCK_FLOWMAP.stages.length + 1)
    expect(m.flows.length).toBe(MOCK_FLOWMAP.flows.length)
    expect(m.flows[0]!.dots.length).toBe(Math.round(4 * 1.5))
    // Raw material is conjecture in the mock: its particles are ghosted.
    expect(certaintyOf(m.flows[0]!.dots[0]!)).toBeCloseTo(0.15, 12)
    expect(certaintyOf(m.flows[MOCK_FLOWMAP.flows.length - 1]!.dots[0]!)).toBe(1)
  })

  test("particles are a pure function of time", () => {
    const m = new FlowMap({ radius: R })
    void m.parts
    m.stage("semi").shown.value = 1
    const dot = m.stage("semi").flows[0]!.dots[1]!
    m.time.value = 3.25
    const a = [dot.x.value, dot.y.value, dot.z.value, dot.opacity.value]
    m.time.value = 7
    m.time.value = 3.25
    expect([dot.x.value, dot.y.value, dot.z.value, dot.opacity.value]).toEqual(a)
  })

  test("a flow naming an unknown entity is refused", () => {
    const bad: FlowMapData = { ...MOCK_FLOWMAP, flows: [{ from: "nobody", to: "A", stage: "raw" }] }
    expect(() => new FlowMap({ data: bad }).parts).toThrow(/unknown entity 'nobody'/)
  })
})
