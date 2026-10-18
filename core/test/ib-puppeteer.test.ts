import { describe, expect, test } from "bun:test"
import { Puppeteer, STRING_ANCHORS, TRACE, handOutline, stringAnchor } from "../vocabulary/Puppeteer/Puppeteer"
import type { Line } from "../src/parts/primitives"

describe("Puppeteer — the hand that works the strings", () => {
  test("the hand is one unit wide, sits above its grip, and is about as tall as it is wide (f3541: 113 × 102 px)", () => {
    const pts = handOutline()
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1, 1)
    expect(Math.min(...ys)).toBeGreaterThan(-0.02)
    expect(Math.max(...ys)).toBeGreaterThan(0.8)
    expect(Math.max(...ys)).toBeLessThan(1)
    // Closed.
    expect(pts[0]!.x).toBeCloseTo(pts[pts.length - 1]!.x, 9)
    expect(pts[0]!.y).toBeCloseTo(pts[pts.length - 1]!.y, 9)
    expect(TRACE.width).toBe(113)
  })

  test("the strings hang straight down from their anchors to `length` below the grip; no cross bar", () => {
    const W = 200
    const L = 350
    const p = new Puppeteer({ size: W, length: L })
    void p.parts
    const lines = [...(p.back.members as Line[]), ...(p.front.members as Line[])]
    expect(lines.length).toBe(5)
    for (const l of lines) {
      expect(l.points.length).toBe(2)
      expect(l.points[0]!.x).toBeCloseTo(l.points[1]!.x, 9)
      expect(l.points[1]!.y).toBeCloseTo(-L, 9)
      expect(l.points[0]!.y).toBeGreaterThanOrEqual(-1e-9)
    }
    // The thumb's and the knuckle's strings run in front of the hand.
    expect((p.front.members as Line[]).length).toBe(2)
    expect(p.parts.indexOf(p.back)).toBeLessThan(p.parts.indexOf(p.silhouette))
    expect(p.parts.indexOf(p.hand)).toBeLessThan(p.parts.indexOf(p.front))
  })

  test("any number of strings spreads across the film's anchors", () => {
    expect(stringAnchor(0, 5)).toEqual(stringAnchor(0, STRING_ANCHORS.length))
    const three = [0, 1, 2].map((i) => stringAnchor(i, 3))
    expect(three[0]!.x).toBeCloseTo(stringAnchor(0, 5).x, 9)
    expect(three[2]!.x).toBeCloseTo(stringAnchor(4, 5).x, 9)
    expect(three[1]!.x).toBeCloseTo(stringAnchor(2, 5).x, 9)
    const p = new Puppeteer({ strings: 3 })
    void p.parts
    expect(p.back.members.length + p.front.members.length).toBe(3)
  })
})
