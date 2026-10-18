import { describe, expect, test } from "bun:test"
import {
  chordPolyline,
  hubRadius,
  mappings,
  onboardedness,
  onboardingCost,
  onboardPositions,
  pairs,
  ringDir,
  ringPhase,
  systemCost,
} from "../src/geometry/harmonization"
import { Harmonization } from "../vocabulary/Harmonization/Harmonization"
import { certaintyOf } from "../src/certainty"

describe("harmonization geometry", () => {
  test("pairwise is the complete graph, the hub one spoke each", () => {
    expect(pairs(6).length).toBe(15)
    expect(mappings(6)).toEqual({ pairwise: 15, hub: 6 })
    expect(mappings(1)).toEqual({ pairwise: 0, hub: 1 })
    const seen = new Set(pairs(5).map(([i, j]) => `${i}-${j}`))
    expect(seen.size).toBe(10)
    for (const [i, j] of pairs(5)) expect(i).toBeLessThan(j)
  })

  test("the ring is a regular polygon with no vertex straight down", () => {
    for (const n of [3, 4, 5, 6, 7, 8]) {
      const dirs = Array.from({ length: n }, (_, i) => ringDir(i, n))
      for (const d of dirs) expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 12)
      // equal steps between neighbours
      const step = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
      for (let i = 0; i < n; i++) expect(step(dirs[i]!, dirs[(i + 1) % n]!)).toBeCloseTo(step(dirs[0]!, dirs[1]!), 12)
      for (const d of dirs) expect(d.y).toBeGreaterThan(-0.9999)
      // mirror-symmetric about the vertical
      for (const d of dirs) expect(dirs.some((e) => Math.abs(e.x + d.x) < 1e-9 && Math.abs(e.y - d.y) < 1e-9)).toBe(true)
    }
    expect(ringPhase(5)).toBeCloseTo(Math.PI / 2)
  })

  test("the first system defines the model; the rest cost their distance", () => {
    const d = [0.2, 0.3, 1.4, Number.NaN]
    expect(systemCost(d, 0)).toBe(1)
    expect(systemCost(d, 1)).toBe(0.3)
    expect(systemCost(d, 2)).toBe(1)
    expect(systemCost(d, 3)).toBe(1)
    expect(onboardingCost([0.5, 0.3, 0.2], 2)).toBeCloseTo(1.3)
    expect(onboardingCost([0.5, 0.3, 0.2], 9)).toBeCloseTo(1.5)
    expect(hubRadius(0, 100, 400)).toBe(100)
    expect(hubRadius(1, 100, 400)).toBe(400)
    expect(hubRadius(0.5, 100, 400)).toBe(250)
  })

  test("onboarding ramps one system at a time", () => {
    expect(onboardedness(0, 0)).toBe(0)
    expect(onboardedness(0, 0.5)).toBe(0.5)
    expect(onboardedness(1, 0.5)).toBe(0)
    expect(onboardedness(2, 6)).toBe(1)
    expect(onboardPositions(6)).toEqual({ none: 0, first: 1, half: 3, all: 6 })
    expect(onboardPositions(2)).toEqual({ none: 0, first: 1, all: 2 })
    expect(onboardPositions(1)).toEqual({ none: 0, first: 1 })
  })

  test("a chord collapses onto the two spokes", () => {
    const a = { x: 100, y: 0 }, b = { x: 0, y: 100 }
    const straight = chordPolyline(a, b, 0)
    expect(straight[1]).toEqual({ x: 50, y: 50 })
    const hub = chordPolyline(a, b, 1)
    expect(hub[1]).toEqual({ x: 0, y: 0 })
    expect(hub[0]).toBe(a)
    expect(hub[2]).toBe(b)
  })
})


describe("Harmonization holon", () => {
  test("builds the web, the spokes and a walkable state space", () => {
    const h = new Harmonization()
    void h.parts
    expect(h.chords.length).toBe(15)
    expect(h.spokes.length).toBe(6)
    expect(h.systems.length).toBe(6)
    const axes = h.stateSpace().axes
    expect(axes.map((a) => a.id)).toEqual(["topology", "onboarded", "costs"])
    expect(axes[1]!.positions.map((p) => p.name)).toEqual(["none", "first", "half", "all"])
  })

  test("not yet onboarded is a ghost only in the hub picture", () => {
    const h = new Harmonization()
    void h.parts
    expect(certaintyOf(h.system("c").db)).toBe(1)
    h.topology.value = 1
    expect(certaintyOf(h.system("c").db)).toBe(0)
    h.onboarded.value = 3
    expect(certaintyOf(h.system("c").db)).toBe(1)
    expect(certaintyOf(h.system("d").db)).toBe(0)
  })
})
