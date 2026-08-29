/**
 * Cable — trail purity and construction, pinned.
 *
 * The load-bearing claim (DECISIONS 2026-08-29): the trail is a pure
 * function of clock. Scrubbing away and back must reproduce every
 * polyline bit-for-bit — no accumulated state, no frame-order
 * dependence.
 */

import { describe, expect, test } from "bun:test"
import { Cable, catmullRomResample, smoothControlPoints } from "../src/parts/cable"
import { Null, type Vec3Like } from "../src/parts/index"
import { PI } from "../src/constants"

/** Constant-speed straight swim: 100 units/s along +x. */
const straight = (t: number): Vec3Like => ({ x: 100 * t, y: 0, z: 0 })

const snapshot = (cable: Cable): string =>
  JSON.stringify({
    a: cable.edgeA.points,
    b: cable.edgeB.points,
    rings: cable.ringLines.map((r) => r.points),
  })

const centroid = (pts: readonly Vec3Like[]): Vec3Like => {
  const n = pts.length || 1
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / n,
    y: pts.reduce((s, p) => s + p.y, 0) / n,
    z: pts.reduce((s, p) => s + p.z, 0) / n,
  }
}

describe("trail purity", () => {
  test("scrubbing backwards gives identical frames", () => {
    const cable = new Cable({ window: 2 }).trail(straight)
    void cable.parts
    cable.clock.value = 3
    const first = snapshot(cable)
    for (const t of [5, 0.4, 4.2, 1]) {
      cable.clock.value = t
      void snapshot(cable)
    }
    cable.clock.value = 3
    expect(snapshot(cable)).toBe(first)
  })

  test("before any motion the trail is empty", () => {
    const cable = new Cable().trail(straight)
    void cable.parts
    cable.clock.value = 0
    expect(cable.edgeA.points.length).toBe(0)
    expect(cable.edgeB.points.length).toBe(0)
    for (const r of cable.ringLines) expect(r.points.length).toBe(0)
  })
})

describe("the tube", () => {
  test("head attaches to the carrier; edges straddle the spine at ±width", () => {
    const cable = new Cable({ window: 2, width: 3 }).trail(straight)
    void cable.parts
    cable.clock.value = 3
    const a0 = cable.edgeA.points[0]!
    const b0 = cable.edgeB.points[0]!
    // head = path(3) = (300, 0, 0); edges offset ±width perpendicular
    expect((a0.x + b0.x) / 2).toBeCloseTo(300, 6)
    expect(Math.hypot(a0.x - b0.x, a0.y - b0.y, a0.z - b0.z)).toBeCloseTo(6, 6)
  })

  test("taper: tail separation is taper × head separation", () => {
    const cable = new Cable({ window: 2, width: 3, taper: 0.1 }).trail(straight)
    void cable.parts
    cable.clock.value = 3
    const a = cable.edgeA.points
    const b = cable.edgeB.points
    const sep = (i: number) =>
      Math.hypot(a[i]!.x - b[i]!.x, a[i]!.y - b[i]!.y, a[i]!.z - b[i]!.z)
    expect(sep(0)).toBeCloseTo(2 * 3, 6)
    expect(sep(a.length - 1)).toBeCloseTo(2 * 3 * 0.1, 6)
    // and it only ever narrows, head → tail
    for (let i = 1; i < a.length; i++) expect(sep(i)).toBeLessThanOrEqual(sep(i - 1) + 1e-9)
  })
})

describe("the rings", () => {
  test("world-fixed mile-markers every ringStep of travel", () => {
    const cable = new Cable({ window: 2, ringStep: 30 }).trail(straight)
    void cable.parts
    cable.clock.value = 3
    // travel spans [100, 300] over the window → rings at m·30, m = 4..10
    const active = cable.ringLines.filter((r) => r.points.length > 0)
    expect(active.length).toBe(7)
    active.forEach((ring, j) => {
      const c = centroid(ring.points)
      expect(c.x).toBeCloseTo((10 - j) * 30, 1)
    })
  })

  test("rings do not move as the carrier advances (they slide down the tube)", () => {
    const cable = new Cable({ window: 2, ringStep: 30 }).trail(straight)
    void cable.parts
    cable.clock.value = 3
    const xsBefore = cable.ringLines
      .filter((r) => r.points.length > 0)
      .map((r) => centroid(r.points).x)
    cable.clock.value = 3.1
    const xsAfter = cable.ringLines
      .filter((r) => r.points.length > 0)
      .map((r) => centroid(r.points).x)
    // every surviving ring sits where it was born, to sampling tolerance
    for (const x of xsAfter) {
      expect(Math.min(...xsBefore.map((y) => Math.abs(y - x)))).toBeLessThan(1.5)
    }
    // a new ring was born at the head (travel crossed 310 ≥ m=10·30 …
    // head marker is now m=10 at x=300, plus the window dropped m=4)
    expect(xsAfter.length).toBeGreaterThan(0)
  })

  test("rings lie in the plane perpendicular to the spine, tube-radius wide", () => {
    const cable = new Cable({ window: 2, width: 3, taper: 1 }).trail(straight)
    void cable.parts
    cable.clock.value = 3
    const ring = cable.ringLines.find((r) => r.points.length > 0)!
    // the ring closes by repeating its first point — drop the duplicate
    // before averaging or the centroid leans toward θ = 0
    const c = centroid(ring.points.slice(0, -1))
    for (const p of ring.points) {
      expect(Math.abs(p.x - c.x)).toBeLessThan(1e-6) // ⊥ +x spine
      expect(Math.hypot(p.y - c.y, p.z - c.z)).toBeCloseTo(3, 5) // taper 1 → r = width
    }
  })
})

describe("frames", () => {
  test("points are stated in the parent's local frame", () => {
    const parent = new Null({ x: 50, h: PI / 2 })
    const cable = new Cable({ window: 2 })
    // adopt the cable the Group way: parent link is what toLocal walks
    cable.parent = parent
    cable.trail(straight)
    void cable.parts
    cable.clock.value = 3
    const a0 = cable.edgeA.points[0]!
    const b0 = cable.edgeB.points[0]!
    const headLocal = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2, z: (a0.z + b0.z) / 2 }
    // world head (300,0,0); parent at x=50 turned h=90° (+z→+x):
    // local = Ry(−90°)·(250,0,0) = (0,0,250)
    expect(headLocal.x).toBeCloseTo(0, 6)
    expect(headLocal.y).toBeCloseTo(0, 6)
    expect(headLocal.z).toBeCloseTo(250, 6)
  })
})

describe("helpers", () => {
  test("smoothing pins both ends and preserves a straight line", () => {
    const line = Array.from({ length: 12 }, (_, i) => ({ x: i * 10, y: 0, z: 0 }))
    const smoothed = smoothControlPoints(line)
    expect(smoothed[0]).toEqual(line[0]!)
    expect(smoothed[11]).toEqual(line[11]!)
    for (const p of smoothed) expect(Math.abs(p.y) + Math.abs(p.z)).toBeLessThan(1e-12)
  })

  test("Catmull-Rom hits every control point and stays collinear on lines", () => {
    const ctrl = Array.from({ length: 4 }, (_, i) => ({ x: i * 30, y: 0, z: 0 }))
    const out = catmullRomResample(ctrl, 31)
    expect(out[0]!.x).toBeCloseTo(0, 9)
    expect(out[30]!.x).toBeCloseTo(90, 9)
    expect(out[10]!.x).toBeCloseTo(30, 9)
    for (const p of out) expect(Math.abs(p.y) + Math.abs(p.z)).toBeLessThan(1e-9)
  })
})
