/**
 * Rails and dashes — the pure math Scene 02 forced into the vocabulary.
 */

import { describe, expect, test } from "bun:test"
import { byArcLength, EllipticalRail } from "../src/parts/paths"
import { dashRuns, Cross, Line } from "../src/parts/index"

describe("byArcLength", () => {
  test("is the identity on a straight line", () => {
    const walk = byArcLength((s) => ({ x: 100 * s, y: 0, z: 0 }))
    for (const u of [0, 0.25, 0.5, 0.75, 1]) expect(walk(u)).toBeCloseTo(u, 4)
  })

  test("straightens a curve whose natural parameter runs unevenly", () => {
    // s^2 covers the first half of the line in the first 70% of s.
    const walk = byArcLength((s) => ({ x: 100 * s * s, y: 0, z: 0 }))
    expect(walk(0.25)).toBeCloseTo(0.5, 3)
    expect(walk(1)).toBeCloseTo(1, 4)
  })
})

describe("EllipticalRail", () => {
  const rail = new EllipticalRail({ radiusX: 400, radiusY: 260 })

  test("runs from (-rx, 0) through (0, -ry) to (+rx, 0)", () => {
    expect(rail.at(0).x).toBeCloseTo(-400, 6)
    expect(rail.at(0).y).toBeCloseTo(0, 6)
    expect(rail.at(0.5).x).toBeCloseTo(0, 1)
    expect(rail.at(0.5).y).toBeCloseTo(-260, 1)
    expect(rail.at(1).x).toBeCloseTo(400, 6)
    expect(rail.at(1).y).toBeCloseTo(0, 6)
  })

  test("the inward normal turns a half circle end to end", () => {
    expect(rail.at(0).normal).toBeCloseTo(0, 6)
    expect(rail.at(0.5).normal).toBeCloseTo(Math.PI / 2, 2)
    expect(Math.abs(rail.at(1).normal)).toBeCloseTo(Math.PI, 6)
  })

  test("walks the NATURAL parameter, not arc length", () => {
    // What the reference's flying Eye actually does (S02.ts): the two
    // walks part company by up to 0.06 of the sweep on these axes, and
    // the reference sides with the natural one.
    expect(rail.at(0.25).x).toBeCloseTo(-400 * Math.cos(Math.PI / 4), 6)
    expect(rail.at(0.25).y).toBeCloseTo(-260 * Math.sin(Math.PI / 4), 6)
    // The uniform-speed reading is still there, and it is different.
    expect(Math.abs(rail.atArcLength(0.25).x - rail.at(0.25).x)).toBeGreaterThan(10)
  })

  test("the normal is the ellipse's, not the radius'", () => {
    // The reference's own reading (frames5 f0258, video 51.6s): the Eye
    // at world (-316, -162) gazes at 51.0 degrees. The radius there
    // points at 27.1 degrees — an error of 24 degrees, which is what
    // makes this worth a test.
    let hit = { x: 0, y: 0, normal: 0 }
    let best = Infinity
    for (let i = 0; i <= 2000; i++) {
      const r = rail.at(i / 2000)
      const d = Math.hypot(r.x + 316, r.y + 162)
      if (d < best) {
        best = d
        hit = r
      }
    }
    expect((hit.normal * 180) / Math.PI).toBeCloseTo(50.4, 0)
  })

  test("atArcLength walks at uniform speed — equal arc per equal step", () => {
    const lengths: number[] = []
    for (let i = 0; i < 20; i++) {
      const a = rail.atArcLength(i / 20)
      const b = rail.atArcLength((i + 1) / 20)
      lengths.push(Math.hypot(b.x - a.x, b.y - a.y))
    }
    const mean = lengths.reduce((s, v) => s + v, 0) / lengths.length
    for (const l of lengths) expect(Math.abs(l - mean) / mean).toBeLessThan(0.01)
  })
})

describe("dashRuns", () => {
  const a = { x: 0, y: 0, z: 0 }
  const b = { x: 10, y: 0, z: 0 }

  test("starts on and truncates at the end", () => {
    const runs = dashRuns(a, b, 2, 2)
    expect(runs.length).toBe(3)
    expect(runs[0]![0].x).toBeCloseTo(0, 6)
    expect(runs[0]![1].x).toBeCloseTo(2, 6)
    expect(runs[2]![0].x).toBeCloseTo(8, 6)
    expect(runs[2]![1].x).toBeCloseTo(10, 6)
  })

  test("a zero dash degrades to the whole segment", () => {
    expect(dashRuns(a, b, 0, 2)).toEqual([[a, b]])
  })
})

describe("Cross", () => {
  test("fromCenter grows four arms out of the origin", () => {
    const cross = new Cross({ size: 6 })
    const arms = cross.parts.filter((p) => p instanceof Line) as Line[]
    expect(arms.length).toBe(4)
    for (const arm of arms) {
      expect(arm.points[0]).toEqual({ x: 0, y: 0, z: 0 })
      expect(Math.hypot(arm.points[1]!.x, arm.points[1]!.y)).toBeCloseTo(6, 6)
    }
  })

  test("the crossing variant is two full strokes", () => {
    const cross = new Cross({ size: 6, fromCenter: false })
    const arms = cross.parts.filter((p) => p instanceof Line) as Line[]
    expect(arms.length).toBe(2)
    expect(Math.hypot(arms[0]!.points[1]!.x - arms[0]!.points[0]!.x, arms[0]!.points[1]!.y - arms[0]!.points[0]!.y)).toBeCloseTo(12, 6)
  })
})
