/**
 * Even-odd triangulation across a drawing's subpaths — the fix for the
 * gear that floods to its centre (geometry/evenodd.ts).
 *
 * Every expectation here is computed from the FIXTURE, by hand or by a
 * formula, never from the implementation: a square's area is its side
 * squared, an annulus is π(R²−r²), and a point is inside when a ray from
 * it crosses the loops an odd number of times. The triangulation is then
 * checked against those two independent things — its total area, and a
 * point-in-triangles test at sampled points — so a wrong triangulation
 * has to be wrong in both the same way to pass.
 */

import { describe, expect, test } from "bun:test"
import { evenOddTriangulation } from "../src/geometry/evenodd"
import type { Vec3Like } from "../src/parts/index"

/** A closed rectangle, counter-clockwise. */
const rect = (cx: number, cy: number, w: number, h: number): Vec3Like[] => [
  { x: cx - w / 2, y: cy - h / 2, z: 0 },
  { x: cx + w / 2, y: cy - h / 2, z: 0 },
  { x: cx + w / 2, y: cy + h / 2, z: 0 },
  { x: cx - w / 2, y: cy + h / 2, z: 0 },
]

/** A closed circle as a polygon of n sides. */
const circle = (cx: number, cy: number, r: number, n = 256): Vec3Like[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, z: 0 }
  })

/** Total area of a triangulation — the sum of |cross| / 2. */
const area = (t: { points: Vec3Like[]; indices: number[] }): number => {
  let sum = 0
  for (let i = 0; i < t.indices.length; i += 3) {
    const a = t.points[t.indices[i]!]!
    const b = t.points[t.indices[i + 1]!]!
    const c = t.points[t.indices[i + 2]!]!
    sum += Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2
  }
  return sum
}

/** Is (x, y) covered by any triangle? */
const covered = (t: { points: Vec3Like[]; indices: number[] }, x: number, y: number): boolean => {
  for (let i = 0; i < t.indices.length; i += 3) {
    const a = t.points[t.indices[i]!]!
    const b = t.points[t.indices[i + 1]!]!
    const c = t.points[t.indices[i + 2]!]!
    const d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
    if (Math.abs(d) < 1e-12) continue
    const u = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / d
    const v = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / d
    const w = 1 - u - v
    if (u >= -1e-9 && v >= -1e-9 && w >= -1e-9) return true
  }
  return false
}

/** The even-odd truth, straight from the definition: a ray cast +x from
 *  (x, y) and the parity of its crossings. Independent of the module. */
const insideByRay = (subpaths: readonly (readonly Vec3Like[])[], x: number, y: number): boolean => {
  let crossings = 0
  for (const loop of subpaths) {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i]!
      const b = loop[(i + 1) % loop.length]!
      if (a.y === b.y) continue
      const lo = a.y < b.y ? a : b
      const hi = a.y < b.y ? b : a
      if (y < lo.y || y >= hi.y) continue
      const xc = lo.x + ((hi.x - lo.x) * (y - lo.y)) / (hi.y - lo.y)
      if (xc > x) crossings++
    }
  }
  return crossings % 2 === 1
}

/** Sample a grid and demand the triangulation agree with the ray test. */
const agreesOnGrid = (
  subpaths: readonly (readonly Vec3Like[])[],
  half: number,
  step: number,
): { checked: number; disagreements: number } => {
  const t = evenOddTriangulation(subpaths)
  let checked = 0
  let disagreements = 0
  for (let x = -half; x <= half; x += step) {
    for (let y = -half; y <= half; y += step) {
      // Skip points within a hair of an edge: there the two answers may
      // legitimately differ by the triangulation's own boundary rule,
      // and the fill's visual correctness does not turn on them.
      let nearEdge = false
      for (const loop of subpaths) {
        for (let i = 0; i < loop.length; i++) {
          const a = loop[i]!
          const b = loop[(i + 1) % loop.length]!
          const dx = b.x - a.x
          const dy = b.y - a.y
          const len2 = dx * dx + dy * dy
          if (len2 < 1e-12) continue
          let s = ((x - a.x) * dx + (y - a.y) * dy) / len2
          s = Math.max(0, Math.min(1, s))
          if (Math.hypot(x - (a.x + s * dx), y - (a.y + s * dy)) < step) nearEdge = true
        }
      }
      if (nearEdge) continue
      checked++
      if (covered(t, x, y) !== insideByRay(subpaths, x, y)) disagreements++
    }
  }
  return { checked, disagreements }
}

describe("evenOddTriangulation", () => {
  test("a single square is its own area", () => {
    const t = evenOddTriangulation([rect(0, 0, 100, 100)])
    expect(area(t)).toBeCloseTo(100 * 100, 6)
  })

  test("two nested squares are the frame between them — the hole is empty", () => {
    const outer = rect(0, 0, 100, 100)
    const inner = rect(0, 0, 40, 40)
    const t = evenOddTriangulation([outer, inner])
    // 100² − 40² = 10000 − 1600 = 8400, by hand.
    expect(area(t)).toBeCloseTo(8400, 6)
    // The hole's centre is NOT painted; a point in the frame is.
    expect(covered(t, 0, 0)).toBe(false)
    expect(covered(t, 35, 0)).toBe(true)
    expect(covered(t, 0, 35)).toBe(true)
    // And outside stays outside.
    expect(covered(t, 60, 0)).toBe(false)
  })

  test("the hole does not care which order the loops arrive in", () => {
    const outer = rect(0, 0, 100, 100)
    const inner = rect(0, 0, 40, 40)
    expect(area(evenOddTriangulation([inner, outer]))).toBeCloseTo(8400, 6)
  })

  test("the hole does not care about either loop's winding direction", () => {
    const outer = rect(0, 0, 100, 100)
    const inner = rect(0, 0, 40, 40)
    // Reversing a loop flips its signed area; even-odd counts crossings,
    // not signs, so nothing may move. (A NONZERO rule would fill this
    // solid — which is exactly the rule these drawings are not authored
    // under.)
    expect(area(evenOddTriangulation([outer, [...inner].reverse()]))).toBeCloseTo(8400, 6)
    expect(area(evenOddTriangulation([[...outer].reverse(), inner]))).toBeCloseTo(8400, 6)
  })

  test("an annulus is π(R² − r²) — the gear's shape", () => {
    const R = 100
    const r = 40
    const n = 512
    const t = evenOddTriangulation([circle(0, 0, R, n), circle(0, 0, r, n)])
    // A regular n-gon inscribed in radius ρ has area (n/2)ρ² sin(2π/n),
    // so the exact expectation for THIS fixture is the difference of two
    // of those — not π(R²−r²), which the polygons only approach.
    const ngon = (rho: number) => (n / 2) * rho * rho * Math.sin((2 * Math.PI) / n)
    expect(area(t)).toBeCloseTo(ngon(R) - ngon(r), 3)
    // Sanity: that is within 0.01% of the circle formula.
    expect(area(t)).toBeCloseTo(Math.PI * (R * R - r * r), -1)
    expect(covered(t, 0, 0)).toBe(false)
    expect(covered(t, 70, 0)).toBe(true)
  })

  test("two disjoint discs are two discs, not the hull of both", () => {
    const n = 256
    const t = evenOddTriangulation([circle(-200, 0, 50, n), circle(200, 0, 50, n)])
    const ngon = (rho: number) => (n / 2) * rho * rho * Math.sin((2 * Math.PI) / n)
    expect(area(t)).toBeCloseTo(2 * ngon(50), 4)
    // The gap between them is empty — the failure a hull-based or
    // bridged triangulation would show.
    expect(covered(t, 0, 0)).toBe(false)
    expect(covered(t, -200, 0)).toBe(true)
    expect(covered(t, 200, 0)).toBe(true)
  })

  test("an island inside a hole fills again — parity, at depth three", () => {
    const t = evenOddTriangulation([rect(0, 0, 100, 100), rect(0, 0, 60, 60), rect(0, 0, 20, 20)])
    // 100² − 60² + 20² = 10000 − 3600 + 400 = 6800.
    expect(area(t)).toBeCloseTo(6800, 6)
    expect(covered(t, 0, 0)).toBe(true) // the island
    expect(covered(t, 25, 0)).toBe(false) // the hole around it
    expect(covered(t, 45, 0)).toBe(true) // the frame
  })

  test("nested holes side by side — two holes in one outer loop", () => {
    const t = evenOddTriangulation([
      rect(0, 0, 200, 100),
      rect(-50, 0, 40, 40),
      rect(50, 0, 40, 40),
    ])
    // 200·100 − 40² − 40² = 20000 − 1600 − 1600 = 16800.
    expect(area(t)).toBeCloseTo(16800, 6)
    expect(covered(t, -50, 0)).toBe(false)
    expect(covered(t, 50, 0)).toBe(false)
    expect(covered(t, 0, 0)).toBe(true) // the bridge between the holes
  })

  test("loops that touch at a vertex are counted once, not twice", () => {
    // Two unit squares meeting corner to corner at the origin. Their
    // shared vertex is a scanline and lies on both loops; a double count
    // there would eat one of the squares.
    const a: Vec3Like[] = [
      { x: -100, y: -100, z: 0 },
      { x: 0, y: -100, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: -100, y: 0, z: 0 },
    ]
    const b: Vec3Like[] = [
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 0, z: 0 },
      { x: 100, y: 100, z: 0 },
      { x: 0, y: 100, z: 0 },
    ]
    expect(area(evenOddTriangulation([a, b]))).toBeCloseTo(2 * 100 * 100, 6)
  })

  test("a repeated closing point changes nothing — Sketch's own form", () => {
    const open = rect(0, 0, 100, 100)
    const closed = [...open, open[0]!]
    expect(area(evenOddTriangulation([closed]))).toBeCloseTo(100 * 100, 6)
    expect(area(evenOddTriangulation([closed, rect(0, 0, 40, 40)]))).toBeCloseTo(8400, 6)
  })

  test("degenerate input yields nothing rather than throwing", () => {
    expect(evenOddTriangulation([]).indices).toHaveLength(0)
    expect(evenOddTriangulation([[]]).indices).toHaveLength(0)
    // Two points is a segment, three collinear points enclose nothing.
    expect(evenOddTriangulation([[{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }]]).indices).toHaveLength(0)
    const collinear = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 20, y: 0, z: 0 },
    ]
    expect(area(evenOddTriangulation([collinear]))).toBeCloseTo(0, 9)
  })

  test("a horizontal-edged shape (the rectangle) is exact, not approximate", () => {
    // Horizontal edges are dropped by the sweep; this is the check that
    // dropping them costs no area.
    const t = evenOddTriangulation([rect(0, 0, 300, 7)])
    expect(area(t)).toBeCloseTo(300 * 7, 6)
  })

  test("the triangulation agrees with the ray-crossing definition on a grid", () => {
    // The strongest check: not a formula, but the RULE itself, sampled.
    const gear = [circle(0, 0, 100, 64), circle(0, 0, 40, 64)]
    const g1 = agreesOnGrid(gear, 140, 7)
    expect(g1.checked).toBeGreaterThan(500)
    expect(g1.disagreements).toBe(0)

    const nested = [rect(0, 0, 200, 200), rect(0, 0, 120, 120), rect(0, 0, 40, 40)]
    const g2 = agreesOnGrid(nested, 140, 7)
    expect(g2.checked).toBeGreaterThan(500)
    expect(g2.disagreements).toBe(0)
  })

  test("the wash is flat in the drawing's own z plane", () => {
    const lifted = rect(0, 0, 100, 100).map((p) => ({ ...p, z: 12 }))
    const t = evenOddTriangulation([lifted])
    expect(t.points.every((p) => p.z === 12)).toBe(true)
  })

  test("triangles do not overlap — the trapezoids tile the region", () => {
    // Area summed per triangle equals the region's true area only if no
    // two triangles overlap; the annulus check above already implies it,
    // and this states it on a shape with an odd vertex set.
    const t = evenOddTriangulation([
      rect(0, 0, 100, 100),
      [
        { x: -20, y: -30, z: 0 },
        { x: 30, y: -10, z: 0 },
        { x: 0, y: 25, z: 0 },
      ],
    ])
    // The inner triangle's area by the shoelace formula:
    // ½|(-20)(-10-25) + 30(25-(-30)) + 0((-30)-(-10))| = ½|700 + 1650| = 1175.
    expect(area(t)).toBeCloseTo(100 * 100 - 1175, 6)
  })
})
