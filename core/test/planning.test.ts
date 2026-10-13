import { describe, expect, test } from "bun:test"
import { lemniscate, loopPoint, onLeftLobe } from "../src/geometry/lemniscate"
import { cellSpan, horizonEdges, regionBoundary, roleSpot } from "../src/geometry/horizons"
import { SOPLoop } from "../vocabulary/SOPLoop/SOPLoop"
import { Horizons, MOCK_HORIZONS } from "../vocabulary/Horizons/Horizons"
import { certaintyOf } from "../src/certainty"

describe("lemniscate", () => {
  test("tips at ±a, crossing at the origin, lobes by parameter", () => {
    expect(lemniscate(0, 100).x).toBeCloseTo(100, 12)
    expect(lemniscate(Math.PI, 100).x).toBeCloseTo(-100, 12)
    const c = lemniscate(Math.PI / 2, 100)
    expect(Math.hypot(c.x, c.y)).toBeLessThan(1e-12)
    expect(onLeftLobe(Math.PI)).toBe(true)
    expect(onLeftLobe(0)).toBe(false)
  })

  test("round 0 is the figure-eight, round 1 the circle, exactly", () => {
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * 2 * Math.PI
      const p = loopPoint(t, 100, 60, 0)
      const q = lemniscate(t, 100)
      expect(p.x).toBeCloseTo(q.x, 12)
      expect(p.y).toBeCloseTo(q.y, 12)
      const r = loopPoint(t, 100, 60, 1)
      expect(Math.hypot(r.x, r.y)).toBeCloseTo(60, 9)
      expect(r.z).toBeCloseTo(0, 12)
    }
  })

  test("the flip goes through depth: mid-way the left lobe stands out of the plane", () => {
    const p = loopPoint(Math.PI * 0.75, 100, 60, 0.25)
    expect(Math.abs(p.z)).toBeGreaterThan(1)
    // The right lobe never leaves the plane during the flip.
    expect(loopPoint(0.3, 100, 60, 0.25).z).toBe(0)
  })

  test("the untwisted loop is continuous in round", () => {
    for (let k = 0; k < 20; k++) {
      const a = loopPoint(2, 100, 60, k / 20)
      const b = loopPoint(2, 100, 60, (k + 1) / 20)
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(40)
    }
  })
})

describe("horizons geometry", () => {
  const hs = [
    { width: 300, reach: 1 },
    { width: 300, reach: 2 },
    { width: 300, reach: 3 },
  ]
  test("columns stack along t", () => {
    expect(horizonEdges(hs)).toEqual([300, 600, 900])
  })

  test("a region runs from the time axis round its corner back to the domain axis", () => {
    const b = regionBoundary(hs, 1, 100)
    expect(b[0]).toEqual({ x: 600, y: 0 })
    expect(b.at(-1)).toEqual({ x: 0, y: -200 })
    for (const p of b) expect(p.x <= 600 + 1e-9 && p.y >= -200 - 1e-9).toBe(true)
  })

  test("a cell runs back to the axis on rows an inner horizon does not reach; the open horizon keeps its column", () => {
    expect(cellSpan(hs, 1, 0)).toEqual([300, 600])
    expect(cellSpan(hs, 1, 1)).toEqual([0, 600])
    expect(cellSpan(hs, 2, 2)).toEqual([600, 900])
    const a = roleSpot(hs, 1, 1, 100, 0, 2)
    const b = roleSpot(hs, 1, 1, 100, 1, 2)
    expect(a.y).toBe(-150)
    expect(a.x).toBeLessThan(b.x)
    expect(b.x).toBeLessThan(600)
  })
})

describe("SOPLoop", () => {
  test("particles take the certainty of the side they are on", () => {
    const l = new SOPLoop()
    void l.parts
    expect(l.left.certainty.value).toBeCloseTo(0.35, 12)
    l.time.value = 1.3
    const cs = l.dots.map((d) => certaintyOf(d))
    expect(Math.min(...cs)).toBeCloseTo(0.35, 2)
    expect(Math.max(...cs)).toBeCloseTo(1, 2)
  })

  test("a state space of focus, round, labels, and the conjectured side's certainty", () => {
    const l = new SOPLoop()
    void l.parts
    expect(l.stateSpace().axes.map((a) => a.id)).toEqual(["focus", "round", "labels", "left.certainty"])
  })
})

describe("Horizons", () => {
  test("one role per datum; the open seat is conjecture until filled, and says so", () => {
    const h = new Horizons()
    void h.parts
    expect(h.roles.length).toBe(MOCK_HORIZONS.roles.length)
    const open = h.role("manager")
    expect(certaintyOf(open.figure)).toBeCloseTo(0.12, 12)
    expect(open.name.content).toContain("(open)")
    open.certainty.value = 1
    expect(open.name.content).toBe("Demand manager")
  })

  test("people step in with their horizon", () => {
    const h = new Horizons()
    void h.parts
    expect(h.role("planner").scale.value).toBe(0)
    h.reveal.value = 1
    expect(h.role("planner").scale.value).toBe(1)
    expect(h.role("coo").scale.value).toBe(0)
    expect(h.role("coo").figure.stroke.value).toBe(0)
  })
})
