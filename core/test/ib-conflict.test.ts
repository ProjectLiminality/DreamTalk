import { describe, expect, test } from "bun:test"
import { BOLT, Conflict, MIN_REVEAL, boltOutline, ringSpot } from "../vocabulary/Conflict/Conflict"
import { Create } from "../src/verbs"
import { TAU } from "../src/constants"
import type { Line, Shape } from "../src/parts/primitives"

/** The bolts' outlines (walking the holon composes it). */
const outlines = (c: Conflict) => (void [...c.walk()], c.bolts.members as Shape[]).map((s) => s.outlines[0] as Line)
const centroid = (pts: { x: number; y: number }[]) => {
  const body = pts.slice(0, -1)
  return { x: body.reduce((a, p) => a + p.x, 0) / body.length, y: body.reduce((a, p) => a + p.y, 0) / body.length }
}
const extent = (pts: { x: number; y: number }[], dx: number, dy: number) => {
  const d = pts.map((p) => p.x * dx + p.y * dy)
  return [Math.min(...d), Math.max(...d)] as const
}

describe("Conflict — the bolt", () => {
  test("the glyph spans its length exactly, tail −½ to tip +½, and is a little under half as wide (f346: 71/163)", () => {
    const along = BOLT.map((p) => p[0])
    const across = BOLT.map((p) => p[1])
    expect(Math.min(...along)).toBe(-0.5)
    expect(Math.max(...along)).toBe(0.5)
    const w = Math.max(...across) - Math.min(...across)
    expect(w).toBeGreaterThan(0.42)
    expect(w).toBeLessThan(0.47)
    // The tip is ONE vertex, and it is the far end.
    expect(along.filter((u) => u === 0.5).length).toBe(1)
  })

  test("one bolt: `size` long along `direction`, the tip where it points", () => {
    for (const dir of [-TAU / 4, 0, 1.1]) {
      const c = new Conflict({ size: 200, direction: dir })
      const pts = outlines(c)[0]!.points
      const [lo, hi] = extent(pts, Math.cos(dir), Math.sin(dir))
      expect(lo).toBeCloseTo(-100, 6)
      expect(hi).toBeCloseTo(100, 6)
      // The tip vertex lies at +size/2 along the direction.
      const tipIdx = BOLT.findIndex((p) => p[0] === 0.5)
      const tip = pts[tipIdx]!
      expect(tip.x * Math.cos(dir) + tip.y * Math.sin(dir)).toBeCloseTo(100, 6)
    }
  })

  test("the default bolt points down the frame, as at f346", () => {
    const pts = outlines(new Conflict({ size: 100 }))[0]!.points
    const tip = pts[BOLT.findIndex((p) => p[0] === 0.5)]!
    expect(tip.y).toBeCloseTo(-50, 6)
  })

  test("every outline closes on itself (the host washes it as a drawing)", () => {
    for (const reveal of [0, MIN_REVEAL, 0.3, 1]) {
      const o = boltOutline(0, 0, 100, 0, reveal)
      expect(o.length).toBeGreaterThanOrEqual(4)
      expect(o[0]).toEqual(o[o.length - 1]!)
    }
  })

  test("creation is the strike: the middle `creation` share of the length is revealed, never nothing", () => {
    const c = new Conflict({ size: 100, direction: 0 })
    const line = outlines(c)[0]!
    for (const k of [0.25, 0.5, 0.9, 1]) {
      c.creation.value = k
      const [lo, hi] = extent(line.points, 1, 0)
      expect(lo).toBeCloseTo((-k / 2) * 100, 6)
      expect(hi).toBeCloseTo((k / 2) * 100, 6)
    }
    c.creation.value = 0
    const [lo, hi] = extent(line.points, 1, 0)
    expect(hi - lo).toBeCloseTo(MIN_REVEAL * 100, 6)
    // ...and the sliver is hidden.
    const shape = c.bolts.members[0] as Shape
    expect(shape.opacity.value).toBe(0)
    c.creation.value = 1
    expect(shape.opacity.value).toBe(1)
  })

  test("Create runs creation 0 → 1 on the holon itself", () => {
    const c = new Conflict()
    const tracks = Create(c).tracks
    expect(tracks.length).toBe(1)
    expect(tracks[0]!.param).toBe(c.creation)
  })
})

describe("Conflict — the ring (Chaos / Oppression, f541)", () => {
  test("circle ring: count bolts, centres `radius` out, evenly turned from `phase`", () => {
    const c = new Conflict({ size: 50, count: 8, radius: 260, direction: 0 })
    const ls = outlines(c)
    expect(ls.length).toBe(8)
    ls.forEach((l, i) => {
      const a = (i / 8) * TAU
      // The glyph's bounding-box centre is the bolt's centre: mid-length, mid-width.
      const pts = l.points
      const [lo, hi] = extent(pts, Math.cos(a), Math.sin(a))
      expect((lo + hi) / 2).toBeCloseTo(260, 6)
    })
  })

  test("radiating (direction 0) points every tip away from the centre; striking (π) at it", () => {
    const tipIdx = BOLT.findIndex((p) => p[0] === 0.5)
    for (const [direction, sign] of [[0, 1], [TAU / 2, -1]] as const) {
      const c = new Conflict({ size: 50, count: 8, radius: 260, direction })
      outlines(c).forEach((l) => {
        const tip = l.points[tipIdx]!
        const mid = centroid(l.points)
        expect(sign * (Math.hypot(tip.x, tip.y) - Math.hypot(mid.x, mid.y))).toBeGreaterThan(0)
      })
    }
  })

  test("a square ring puts the corner bolts at the square's corners (Oppression)", () => {
    expect(ringSpot(1, 8, 0, "square").x).toBeCloseTo(1, 9)
    expect(ringSpot(1, 8, 0, "square").y).toBeCloseTo(1, 9)
    expect(ringSpot(2, 8, 0, "square").y).toBeCloseTo(1, 9)
    expect(Math.hypot(ringSpot(1, 8, 0, "circle").x, ringSpot(1, 8, 0, "circle").y)).toBeCloseTo(1, 9)
  })

  test("spread is the state: 0 gathers every bolt at the centre, 1 flies them to the ring; walkable", () => {
    const c = new Conflict({ size: 50, count: 8, radius: 260, direction: 0, spread: 0 })
    for (const l of outlines(c)) {
      const [lo, hi] = extent(l.points, 1, 0)
      expect(Math.abs((lo + hi) / 2)).toBeLessThan(30)
    }
    c.spread.value = 1
    expect(Math.hypot(...Object.values(centroid(outlines(c)[0]!.points)))).toBeGreaterThan(200)
    const axes = c.stateSpace()!.axes
    expect(axes.map((a) => a.id)).toEqual(["spread"])
    expect(axes[0]!.positions.map((p) => p.name)).toEqual(["gathered", "radiating"])
    // One bolt has no ring to walk.
    expect(new Conflict().stateSpace()).toBeUndefined()
  })
})
