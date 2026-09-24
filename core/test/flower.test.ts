/**
 * The flower-of-life packing and its scatter — pinned so the effect stays
 * deterministic (it must scrub backwards and re-render identically) and the
 * mask genuinely tests point membership, holes included.
 */

import { describe, expect, test } from "bun:test"
import {
  hash32,
  hexPack,
  pointInShape,
  polygonsBounds,
  scatterOffset,
  scatteredPosition,
  type Vec2,
} from "../src/geometry/flower"

/** An axis-aligned square as a closed polygon. */
const square = (cx: number, cy: number, half: number): Vec2[] => [
  { x: cx - half, y: cy - half },
  { x: cx + half, y: cy - half },
  { x: cx + half, y: cy + half },
  { x: cx - half, y: cy + half },
]

describe("pointInShape (even-odd)", () => {
  const box = [square(0, 0, 100)]

  test("inside a simple polygon", () => {
    expect(pointInShape({ x: 0, y: 0 }, box)).toBe(true)
    expect(pointInShape({ x: 90, y: -90 }, box)).toBe(true)
  })

  test("outside a simple polygon", () => {
    expect(pointInShape({ x: 200, y: 0 }, box)).toBe(false)
    expect(pointInShape({ x: 0, y: 200 }, box)).toBe(false)
  })

  test("a counter (hole) is excluded — the 'e'/'b'/'3' case", () => {
    // Outer square with an inner square hole: even-odd makes the inner
    // region OUTSIDE the fill.
    const annulus = [square(0, 0, 100), square(0, 0, 40)]
    expect(pointInShape({ x: 0, y: 0 }, annulus)).toBe(false) // in the hole
    expect(pointInShape({ x: 70, y: 0 }, annulus)).toBe(true) // in the ring
  })
})

describe("hexPack", () => {
  const box = [square(0, 0, 100)]

  test("is deterministic — same mask and spacing, same points in order", () => {
    const a = hexPack(box, { spacing: 20 })
    const b = hexPack(box, { spacing: 20 })
    expect(a.length).toBeGreaterThan(0)
    expect(a).toEqual(b)
  })

  test("every packed point is inside the mask", () => {
    const pts = hexPack(box, { spacing: 20 })
    for (const p of pts) expect(pointInShape(p, box)).toBe(true)
  })

  test("rows are hex-spaced — half-step x stagger, √3/2 y step", () => {
    const spacing = 20
    const pts = hexPack(box, { spacing })
    // Group points by row (their y), in packing order.
    const ys = [...new Set(pts.map((p) => Math.round(p.y * 1e4) / 1e4))].sort((a, b) => a - b)
    expect(ys.length).toBeGreaterThan(2)
    // Vertical step between adjacent rows is spacing·√3/2.
    const rowStep = spacing * (Math.sqrt(3) / 2)
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]! - ys[i - 1]!).toBeCloseTo(rowStep, 3)
    }
    // Adjacent rows are staggered by half a spacing in x.
    const rowOf = (y: number) => pts.filter((p) => Math.abs(p.y - y) < rowStep / 2).map((p) => p.x)
    const row0 = rowOf(ys[0]!)
    const row1 = rowOf(ys[1]!)
    const off = Math.abs(row0[0]! - row1[0]!)
    expect(off).toBeCloseTo(spacing / 2, 3)
  })

  test("a hole in the mask leaves a gap in the packing", () => {
    const annulus = [square(0, 0, 100), square(0, 0, 40)]
    const pts = hexPack(annulus, { spacing: 10 })
    // No packed point sits inside the counter.
    for (const p of pts) {
      const inHole = Math.abs(p.x) < 40 && Math.abs(p.y) < 40
      expect(inHole).toBe(false)
    }
  })

  test("margin keeps points off the rim", () => {
    const pts = hexPack(box, { spacing: 10, margin: 8 })
    for (const p of pts) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(100 - 8 + 1e-9)
      expect(Math.abs(p.y)).toBeLessThanOrEqual(100 - 8 + 1e-9)
    }
  })
})

describe("seeded scatter", () => {
  test("hash32 is stable and varies with its inputs", () => {
    expect(hash32(5, 0, 1)).toBe(hash32(5, 0, 1))
    expect(hash32(5, 0, 1)).not.toBe(hash32(6, 0, 1))
    expect(hash32(5, 0, 1)).not.toBe(hash32(5, 1, 1))
    expect(hash32(5, 0, 1)).not.toBe(hash32(5, 0, 2))
  })

  test("the same seed gives the same scatter", () => {
    const a = scatterOffset(42, 7, 200, 20)
    const b = scatterOffset(42, 7, 200, 20)
    expect(a).toEqual(b)
  })

  test("a different seed gives a different scatter", () => {
    const a = scatterOffset(42, 7, 200, 20)
    const b = scatterOffset(42, 8, 200, 20)
    expect(a).not.toEqual(b)
  })

  test("scatter magnitude stays within [min, distance]", () => {
    for (let i = 0; i < 500; i++) {
      const o = scatterOffset(i, 3, 200, 20)
      const mag = Math.hypot(o.x, o.y)
      expect(mag).toBeGreaterThanOrEqual(20 - 1e-9)
      expect(mag).toBeLessThanOrEqual(200 + 1e-9)
    }
  })
})

describe("scatteredPosition (the one param)", () => {
  const final = { x: 30, y: -12 }

  test("settle = 1 lands exactly on the final position", () => {
    for (let i = 0; i < 100; i++) {
      const p = scatteredPosition(final, i, 5, 200, 1, 20)
      expect(p.x).toBeCloseTo(final.x, 10)
      expect(p.y).toBeCloseTo(final.y, 10)
    }
  })

  test("settle = 0 scatters within the stated distance of the final spot", () => {
    for (let i = 0; i < 500; i++) {
      const p = scatteredPosition(final, i, 5, 200, 0, 20)
      const d = Math.hypot(p.x - final.x, p.y - final.y)
      expect(d).toBeGreaterThanOrEqual(20 - 1e-9)
      expect(d).toBeLessThanOrEqual(200 + 1e-9)
    }
  })

  test("is linear in settle — half-way is half the offset", () => {
    const p0 = scatteredPosition(final, 3, 5, 200, 0, 0)
    const pHalf = scatteredPosition(final, 3, 5, 200, 0.5, 0)
    expect(pHalf.x).toBeCloseTo(final.x + (p0.x - final.x) * 0.5, 10)
    expect(pHalf.y).toBeCloseTo(final.y + (p0.y - final.y) * 0.5, 10)
  })
})

describe("polygonsBounds", () => {
  test("wraps the extent of all polygons", () => {
    const b = polygonsBounds([square(0, 0, 50), square(100, 0, 10)])
    expect(b).toEqual({ minX: -50, minY: -50, maxX: 110, maxY: 50 })
  })

  test("empty is a zero box", () => {
    expect(polygonsBounds([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 })
  })
})
