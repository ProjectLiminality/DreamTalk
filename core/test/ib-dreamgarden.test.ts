/**
 * ib-dreamgarden.test.ts — the DreamGarden (InterBrain film 31:10–31:54):
 * the hexagonal packing filled from the middle, fitted to the ring as
 * f9406 measures it, the rim fade, the seed's determinism, and
 * cross-pollination's two endpoints.
 */

import { describe, expect, test } from "bun:test"
import { DreamGarden, GARDEN, Pollen, gardenStep, latticeSlots, sow } from "../vocabulary/DreamGarden/DreamGarden"
import { DreamNode, DREAM, DREAMER } from "../vocabulary/DreamNode/DreamNode"
import { Group } from "../src/parts/primitives"

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe("the lattice", () => {
  test("19 slots are the hexagon of two rings: 1 + 6 + 12, columns of 3-4-5-4-3", () => {
    const s = latticeSlots(19)
    expect(s.length).toBe(19)
    near(s[0]!.d, 0)
    for (const p of s.slice(1, 7)) near(p.d, 1)
    for (const p of s.slice(7)) expect(p.d === 2 || Math.abs(p.d - Math.sqrt(3)) < 1e-9 || Math.abs(p.d - 2) < 1e-9).toBe(true)
    const cols = new Map<number, number>()
    for (const p of s) cols.set(Math.round(p.x * 1000), (cols.get(Math.round(p.x * 1000)) ?? 0) + 1)
    expect([...cols.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n)).toEqual([3, 4, 5, 4, 3])
  })

  test("every pair of slots is at least one step apart (a packing, nothing overlaps)", () => {
    const s = latticeSlots(37)
    for (let i = 0; i < s.length; i++)
      for (let j = i + 1; j < s.length; j++) expect(Math.hypot(s[i]!.x - s[j]!.x, s[i]!.y - s[j]!.y)).toBeGreaterThan(1 - 1e-9)
  })

  test("the step fits the outermost node's edge to FIT of the ring; 19 gives f9406's 106.5 / 259.6", () => {
    near(gardenStep(19), 106.5 / 259.6, 0.003)
    for (const n of [1, 7, 19, 30]) {
      const s = latticeSlots(n)
      near(gardenStep(n) * (s[s.length - 1]!.d + GARDEN.node), GARDEN.fit)
    }
  })
})

describe("DreamGarden", () => {
  test("count nodes, each a DreamNode in its slot, its ring NODE of the step; all inside the ring", () => {
    const g = new DreamGarden({ radius: 500, count: 19 })
    void g.parts
    expect(g.nodes.length).toBe(19)
    const step = gardenStep(19) * 500
    g.nodes.forEach((n, i) => {
      expect(n).toBeInstanceOf(DreamNode)
      const s = latticeSlots(19)[i]!
      near(n.x.value, s.x * step)
      near(n.y.value, s.y * step)
      near(n.radius.value, GARDEN.node * step)
      expect(Math.hypot(n.x.value, n.y.value) + n.radius.value).toBeLessThanOrEqual(500 * GARDEN.fit + 1e-6)
    })
    // live: the garden grows, everything follows
    g.radius.value = 1000
    near(g.nodes[3]!.radius.value, GARDEN.node * gardenStep(19) * 1000)
  })

  test("the rim fades: the middle keeps all its ink, the two-step corners keep `rim`", () => {
    const g = new DreamGarden({ count: 19, rim: 0.4 })
    void g.parts
    near(g.beds[0]!.there.value, 1)
    near(g.beds[1]!.there.value, 1)
    near(g.beds[18]!.there.value, 0.4)
  })

  test("the seed decides, deterministically; both kinds are planted", () => {
    const a = sow(19, 7, 0.4).map((p) => p.kind + p.face.toString())
    const b = sow(19, 7, 0.4).map((p) => p.kind + p.face.toString())
    expect(a).toEqual(b)
    expect(sow(19, 8, 0.4).map((p) => p.kind)).not.toEqual(sow(19, 7, 0.4).map((p) => p.kind))
    const g = new DreamGarden({ count: 19 })
    void g.parts
    const kinds = new Set(g.nodes.map((n) => n.kind.value))
    expect(kinds).toEqual(new Set([DREAM, DREAMER]))
  })

  test("room keeps slots free and is counted in the fit", () => {
    const g = new DreamGarden({ count: 18, room: 1 })
    void g.parts
    expect(g.nodes.length).toBe(18)
    near(g.step, gardenStep(19))
  })
})

describe("cross-pollination", () => {
  test("flight 0 sits on the source node; 1 in the target's first free slot, at its size", () => {
    const a = new DreamGarden({ radius: 300, count: 6, room: 1, x: -500 })
    const b = new DreamGarden({ radius: 300, count: 6, room: 1, x: 500, scale: 0.5 })
    const group = new Group({ members: [a, b] })
    const pollen = a.crossPollinate(2, b, () => group)
    group.attach(pollen)
    void pollen.parts
    expect(pollen).toBeInstanceOf(Pollen)
    expect(pollen.node.kind.value).toBe(a.nodes[2]!.kind.value)
    pollen.flight.value = 0
    const src = a.nodes[2]!.circleIn(group)
    near(pollen.node.x.value, src.x)
    near(pollen.node.y.value, src.y)
    near(pollen.node.radius.value, src.r)
    pollen.flight.value = 1
    const dst = b.slotIn(6, group)
    near(pollen.node.x.value, dst.x)
    near(pollen.node.y.value, dst.y)
    near(pollen.node.radius.value, dst.r)
    near(dst.r, 0.5 * GARDEN.node * gardenStep(7) * 300)
    // between, it rises on its arc
    pollen.flight.value = 0.5
    expect(pollen.node.y.value).toBeGreaterThan((src.y + dst.y) / 2)
  })
})
