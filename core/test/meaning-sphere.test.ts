/**
 * meaning-sphere.test.ts — the sphere of meaning: an ellipsoid that is a
 * sphere at depth 1 and its equatorial disk at 0; arrows that rise from the
 * diabolic pole to the symbolic one (or, read giving, the other way); the
 * disk's arrows that never return; its two walkable axes and its clock.
 */

import { describe, expect, test } from "bun:test"
import { MEANING, MeaningSphere, meridianPoint, radii, readAt } from "../vocabulary/MeaningSphere/MeaningSphere"
import { gatherStateSpace } from "../src/automaton"
import { Polylines } from "../src/parts/polylines"

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)

/** Every drawn point of a stroke, local to the ball, with its opacity per loop. */
const loopsOf = (m: MeaningSphere, key: "arrowsBlue" | "arrowsRed" | "guidesBlue" | "guidesRed") => {
  const lines = m[key]
  return { loops: lines.loops, op: Array.from(lines.loopOpacity?.() ?? []) }
}

describe("MeaningSphere geometry", () => {
  test("a sphere at depth 1, the disk at 0: the equator holds, the poles come down", () => {
    expect(radii(1)).toEqual({ a: 1, b: 1 })
    near(radii(0).b, MEANING.flat)
    for (const d of [0, 0.5, 1]) {
      const { a, b } = radii(d)
      near(meridianPoint(0, 1.3, a, b).y, -b)
      near(meridianPoint(1, 1.3, a, b).y, b)
      const e = meridianPoint(0.5, 1.3, a, b)
      near(Math.hypot(e.x, e.z), 1)
      near(e.y, 0)
    }
  })

  test("the two readings mirror the path; halfway, every arrow stands on the equator", () => {
    for (const x of [0, 0.2, 0.7, 1]) {
      near(readAt(x, 0), x)
      near(readAt(x, 1), 1 - x)
      near(readAt(x, 0.5), 0.5)
    }
  })

  test("the meridians are symmetric: 2 × meridians on the disk, every other one gone on the sphere", () => {
    const sphere = new MeaningSphere({ radius: 100, depth: 1, pitch: 0, spin: 0 })
    void sphere.parts
    const disk = new MeaningSphere({ radius: 100, depth: 0, pitch: 0, spin: 0 })
    void disk.parts
    const ends = (m: MeaningSphere) => {
      // Near and far: every guide stroke the ball holds at the guides' pen.
      const guides = [...m.walk()].filter((h): h is Polylines => h instanceof Polylines && h.stroke.value === m.guideStroke.value)
      const pts = guides.flatMap((g) => g.loops.flat())
      // The equator ends of the lower half-meridians: their longitudes.
      const rim = pts.filter((p) => Math.abs(Math.hypot(p.x, p.z) - 100) < 1e-6 && Math.abs(p.y) < 1e-6)
      return new Set(rim.map((p) => Math.round((Math.atan2(p.z, p.x) / (2 * Math.PI)) * 24 + 24) % 24)).size
    }
    expect(ends(sphere)).toBe(12)
    expect(ends(disk)).toBe(24)
  })

  test("rising, the arrows run from the south pole to the north; red above the equator, blue below", () => {
    const m = new MeaningSphere({ radius: 100, pitch: 0 })
    void m.parts
    for (const l of m.arrowsBlue.loops) for (const p of l) expect(p.y).toBeLessThanOrEqual(1e-6 + MEANING.head * 100)
    for (const l of m.arrowsRed.loops) for (const p of l) expect(p.y).toBeGreaterThanOrEqual(-1e-6 - MEANING.head * 100)
    // Each shaft is drawn tail to tip: rising, every one climbs; giving, every one descends.
    const shafts = () => m.arrowsBlue.loops.concat(m.arrowsRed.loops).filter((l) => l.length > 3)
    const rises = () => shafts().map((l) => l[l.length - 1]!.y - l[0]!.y)
    for (const t of [0.4, 3.3, 7.1]) {
      m.time.value = t
      expect(shafts().length).toBeGreaterThan(12)
      expect(rises().every((d) => d > 0)).toBe(true)
    }
    m.reading.value = 1
    for (const t of [0.4, 3.3, 7.1]) {
      m.time.value = t
      expect(rises().every((d) => d < 0)).toBe(true)
    }
  })

  test("idolic: nothing returns — every drawn arrow lies on the disk's lower half, out from the centre", () => {
    const m = new MeaningSphere({ radius: 100, depth: 0, pitch: 0 })
    void m.parts
    for (const t of [0, 1.3, 2.9, 5.2]) {
      m.time.value = t
      const red = loopsOf(m, "arrowsRed")
      // Red (above the equator) is drawn at no opacity at all.
      expect(red.op.every((o) => o === 0)).toBe(true)
      expect(loopsOf(m, "arrowsBlue").loops.length).toBeGreaterThan(0)
    }
  })

  test("depth and reading are walkable axes, and time is the clock", () => {
    const m = new MeaningSphere()
    const space = gatherStateSpace([m])
    expect(space.axes.map((a) => a.id).sort()).toEqual(["depth", "reading"])
    expect(space.axes.find((a) => a.id === "depth")!.positions.map((p) => p.name)).toEqual(["idolic", "iconic"])
    expect(space.axes.find((a) => a.id === "reading")!.positions.map((p) => p.name)).toEqual(["rising", "giving"])
    expect(space.clocks).toContain(m.time)
    // A whole that drives a state takes the axis with it.
    const held = new MeaningSphere()
    held.depth.follow(m.depth)
    expect(gatherStateSpace([held]).axes.map((a) => a.id)).toEqual(["reading"])
  })
})
