/**
 * rephasePolyline — where the pen starts on a closed outline, and which
 * way it walks. The video-01 primitives are built in pydeation's XZ
 * plane and seen from the front, so they draw CLOCKWISE from a start
 * point that is not the outline's own first vertex; these are the
 * properties a scene relies on when it names those two numbers.
 */

import { describe, expect, test } from "bun:test"
import { rectanglePolyline, rephasePolyline, type Vec3Like } from "../src/parts/index"

const RECT = () => rectanglePolyline(100, 200, 0)

/** The unit circle as the host samples it: angle 0, counterclockwise. */
const circlePolyline = (radius: number, segments = 32): Vec3Like[] => {
  const pts: Vec3Like[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius, z: 0 })
  }
  return pts
}

const near = (a: Vec3Like, b: Vec3Like, eps = 1e-6): boolean =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < eps

const perimeter = (pts: readonly Vec3Like[]): number => {
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(
      pts[i]!.x - pts[i - 1]!.x,
      pts[i]!.y - pts[i - 1]!.y,
      pts[i]!.z - pts[i - 1]!.z,
    )
  }
  return total
}

describe("rephasePolyline", () => {
  test("identity: phase 0, forward, leaves a closed outline alone", () => {
    const rect = RECT()
    expect(rephasePolyline(rect, 0, false)).toEqual(rect)
  })

  test("open polylines pass through untouched — a Line has a real start", () => {
    const open: Vec3Like[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 10, y: 10, z: 0 },
    ]
    expect(rephasePolyline(open, 0.5, true)).toEqual(open)
  })

  test("the result stays closed and keeps the whole perimeter", () => {
    const rect = RECT()
    const before = perimeter(rect)
    for (const phase of [0, 1 / 8, 5 / 12, 0.5, 0.99]) {
      for (const reversed of [false, true]) {
        const out = rephasePolyline(rect, phase, reversed)
        expect(near(out[0]!, out[out.length - 1]!)).toBe(true)
        expect(perimeter(out)).toBeCloseTo(before, 6)
      }
    }
  })

  test("phase is arc length along the ORIGINAL winding, not point index", () => {
    // The 100x200 rectangle's perimeter is 600, starting at the bottom
    // centre and running to the bottom-right corner first. 250/600 is
    // therefore exactly the TOP-RIGHT corner — S04's rectangle start.
    const out = rephasePolyline(RECT(), 250 / 600, false)
    expect(near(out[0]!, { x: 50, y: 100, z: 0 })).toBe(true)
  })

  test("the start POINT does not move when the winding flips", () => {
    const forward = rephasePolyline(RECT(), 5 / 12, false)
    const backward = rephasePolyline(RECT(), 5 / 12, true)
    expect(near(forward[0]!, backward[0]!)).toBe(true)
    // ...but the second point does: forward continues to the top-left,
    // backward turns and heads down the right edge.
    expect(near(forward[1]!, { x: -50, y: 100, z: 0 })).toBe(true)
    expect(near(backward[1]!, { x: 50, y: -100, z: 0 })).toBe(true)
  })

  test("S04's circle: starts at 45 degrees and runs clockwise", () => {
    const out = rephasePolyline(circlePolyline(50), 1 / 8, true)
    const r = 50 / Math.SQRT2
    expect(near(out[0]!, { x: r, y: r, z: 0 })).toBe(true)
    // Clockwise means the angle decreases from 45 degrees.
    const angle = (p: Vec3Like) => Math.atan2(p.y, p.x)
    expect(angle(out[1]!)).toBeLessThan(angle(out[0]!))
  })

  test("a phase landing exactly on a vertex introduces no duplicate", () => {
    const out = rephasePolyline(RECT(), 250 / 600, true)
    for (let i = 1; i < out.length; i++) {
      if (i === out.length - 1) break
      expect(near(out[i]!, out[i - 1]!)).toBe(false)
    }
  })

  test("phase wraps: 1.25 and 0.25 describe the same start", () => {
    const a = rephasePolyline(RECT(), 0.25, true)
    const b = rephasePolyline(RECT(), 1.25, true)
    expect(near(a[0]!, b[0]!)).toBe(true)
  })
})
