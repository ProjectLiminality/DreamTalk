/**
 * Morph (src/geometry/morph.ts) — the true shape interpolation.
 *
 * Three things are worth pinning, and they are the three the verb can
 * plausibly get wrong:
 *
 *  1. RESAMPLING is by ARC LENGTH, not by point index. That is the whole
 *     content of pydeation's MoSpline setting (SPLINE_MODE 3, Uniform),
 *     and an implementation that lerped the raw point lists would pass
 *     a circle-to-circle test and fail everything else.
 *  2. CORRESPONDENCE is index-wise from each shape's own start, with no
 *     rotation search. The naivety is the reproduction — a test that
 *     merely asserted "the morph looks reasonable" would let a cleverer
 *     matcher in, and a cleverer matcher is a different animation.
 *  3. PURITY: the outline at u is a function of (source, target, u) and
 *     nothing else. Scrubbing backwards, evaluating out of order, or
 *     evaluating the same u twice must give the same points — this is
 *     what the whole baked-time paradigm rests on.
 */

import { describe, expect, test } from "bun:test"
import {
  MORPH_SAMPLES,
  MorphShape,
  arcLengths,
  morphedPolyline,
  outlineOf,
  pointAtArcLength,
  resampleUniform,
  worldOutlineOf,
} from "../src/geometry/morph"
import { Circle, Group, Line, Rectangle, Square, type Vec3Like } from "../src/parts/primitives"
import { Morph } from "../src/verbs"
import { BLUE, RED } from "../src/constants"

/** A unit square walked counterclockwise from its bottom-left, closed. */
const unitSquare: Vec3Like[] = [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: 1, y: 1, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 0 },
]

const near = (a: number, b: number, eps = 1e-9): void => expect(Math.abs(a - b)).toBeLessThan(eps)
const nearPt = (a: Vec3Like, b: Vec3Like, eps = 1e-9): void => {
  near(a.x, b.x, eps)
  near(a.y, b.y, eps)
  near(a.z, b.z, eps)
}

describe("arc length", () => {
  test("cumulative lengths run 0 to the perimeter", () => {
    const cum = arcLengths(unitSquare)
    expect(cum).toEqual([0, 1, 2, 3, 4])
  })

  test("a point at s is s of the way round by LENGTH, not by index", () => {
    // An UNEVENLY sampled segment: three points, but the second sits at
    // 90% of the length. Index-wise sampling would put s=0.5 at that
    // point; arc-length sampling puts it at the true midpoint.
    const uneven: Vec3Like[] = [
      { x: 0, y: 0, z: 0 },
      { x: 9, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
    ]
    nearPt(pointAtArcLength(uneven, 0.5), { x: 5, y: 0, z: 0 })
    nearPt(pointAtArcLength(uneven, 0.9), { x: 9, y: 0, z: 0 })
  })

  test("s is clamped and the endpoints are exact", () => {
    nearPt(pointAtArcLength(unitSquare, 0), unitSquare[0]!)
    nearPt(pointAtArcLength(unitSquare, 1), unitSquare[4]!)
    nearPt(pointAtArcLength(unitSquare, -3), unitSquare[0]!)
    nearPt(pointAtArcLength(unitSquare, 7), unitSquare[4]!)
  })

  test("a degenerate polyline answers its first point everywhere", () => {
    const dot: Vec3Like[] = [
      { x: 2, y: 3, z: 0 },
      { x: 2, y: 3, z: 0 },
    ]
    nearPt(pointAtArcLength(dot, 0.4), { x: 2, y: 3, z: 0 })
  })
})

describe("uniform resampling — the MoSpline rule", () => {
  test("N samples are evenly spaced along the perimeter", () => {
    const out = resampleUniform(unitSquare, 9)
    expect(out.length).toBe(9)
    // Perimeter 4, eight gaps of 0.5 each.
    const cum = arcLengths(out)
    for (let i = 0; i < out.length; i++) near(cum[i]!, i * 0.5, 1e-9)
  })

  test("endpoints survive, so a closed input stays closed", () => {
    const out = resampleUniform(unitSquare, 37)
    nearPt(out[0]!, out[out.length - 1]!)
  })

  test("an unevenly sampled shape comes back evenly sampled", () => {
    // Two sides of the square carrying ten times the points of the other
    // two — the case a naive index lerp gets wrong.
    const dense: Vec3Like[] = []
    for (let i = 0; i <= 40; i++) dense.push({ x: i / 40, y: 0, z: 0 })
    dense.push({ x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 })
    const out = resampleUniform(dense, 41)
    const cum = arcLengths(out)
    const step = cum[cum.length - 1]! / 40
    for (let i = 1; i < out.length; i++) near(cum[i]! - cum[i - 1]!, step, 1e-9)
  })
})

describe("morphedPolyline — the blend", () => {
  const square = unitSquare
  const shifted = unitSquare.map((p) => ({ x: p.x + 10, y: p.y, z: p.z }))

  test("u=0 is the source resampled and u=1 the target resampled", () => {
    const a = morphedPolyline(square, shifted, 0, 33)
    const b = morphedPolyline(square, shifted, 1, 33)
    expect(a).toEqual(resampleUniform(square, 33))
    expect(b).toEqual(resampleUniform(shifted, 33))
  })

  test("halfway is the midpoint of every corresponding pair", () => {
    const mid = morphedPolyline(square, shifted, 0.5, 33)
    const a = resampleUniform(square, 33)
    for (let i = 0; i < mid.length; i++) near(mid[i]!.x, a[i]!.x + 5)
  })

  test("u is clamped — a morph cannot overshoot either end", () => {
    expect(morphedPolyline(square, shifted, -2, 17)).toEqual(
      morphedPolyline(square, shifted, 0, 17),
    )
    expect(morphedPolyline(square, shifted, 5, 17)).toEqual(
      morphedPolyline(square, shifted, 1, 17),
    )
  })

  test("a closed source and a closed target give a closed blend", () => {
    for (const u of [0, 0.1, 0.37, 0.5, 0.83, 1]) {
      const out = morphedPolyline(square, shifted, u, 64)
      nearPt(out[0]!, out[out.length - 1]!, 1e-9)
    }
  })

  test("correspondence is index-wise, with NO rotation search", () => {
    // The same square, its winding started a quarter turn later. A
    // matcher that hunted for the best alignment would find the identity
    // and produce a still image; C4D's Blend does not, so every point
    // travels a quarter of the perimeter and the halfway shape is
    // visibly smaller than either end. Pinning the naivety on purpose.
    const rotated: Vec3Like[] = [
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ]
    const mid = morphedPolyline(square, rotated, 0.5, 65)
    const start = resampleUniform(square, 65)
    let moved = 0
    for (let i = 0; i < mid.length; i++) {
      moved += Math.hypot(mid[i]!.x - start[i]!.x, mid[i]!.y - start[i]!.y)
    }
    expect(moved).toBeGreaterThan(10)
  })
})

describe("purity", () => {
  const a = unitSquare
  const b = [
    { x: 0, y: 0, z: 0 },
    { x: 3, y: 0, z: 0 },
    { x: 3, y: 2, z: 0 },
    { x: 0, y: 2, z: 0 },
    { x: 0, y: 0, z: 0 },
  ]

  test("the same u gives the same points, however often it is asked", () => {
    const first = morphedPolyline(a, b, 0.41, 48)
    for (let i = 0; i < 5; i++) expect(morphedPolyline(a, b, 0.41, 48)).toEqual(first)
  })

  test("evaluation order does not matter — scrubbing backwards is exact", () => {
    const us = [0, 0.13, 0.29, 0.5, 0.71, 0.88, 1]
    const forward = us.map((u) => morphedPolyline(a, b, u, 48))
    const backward = [...us].reverse().map((u) => morphedPolyline(a, b, u, 48))
    expect(backward.reverse()).toEqual(forward)
  })

  test("the inputs are never mutated", () => {
    const src = a.map((p) => ({ ...p }))
    const dst = b.map((p) => ({ ...p }))
    morphedPolyline(src, dst, 0.5, 48)
    expect(src).toEqual(a)
    expect(dst).toEqual(b)
  })
})

describe("outlineOf — the shapes a morph can name", () => {
  test("a circle's outline has the circle's radius everywhere", () => {
    const pts = outlineOf(new Circle({ radius: 50 }))!
    expect(pts.length).toBe(MORPH_SAMPLES + 1)
    for (const p of pts) near(Math.hypot(p.x, p.y), 50, 1e-9)
  })

  test("a rectangle's outline has the rectangle's perimeter", () => {
    const pts = outlineOf(new Rectangle({ width: 100, height: 200 }))!
    const cum = arcLengths(pts)
    near(cum[cum.length - 1]!, 600, 1e-6)
  })

  test("a square's outline closes on itself", () => {
    const pts = outlineOf(new Square({ size: 10 }))!
    nearPt(pts[0]!, pts[pts.length - 1]!)
  })

  test("the pen's own phase and winding are applied", () => {
    const plain = outlineOf(new Circle({ radius: 20 }))!
    const phased = outlineOf(new Circle({ radius: 20, drawStart: 0.25 }))!
    // Same shape, different starting point.
    near(Math.hypot(phased[0]!.x, phased[0]!.y), 20, 1e-9)
    expect(Math.hypot(phased[0]!.x - plain[0]!.x, phased[0]!.y - plain[0]!.y)).toBeGreaterThan(1)
  })

  test("a shape with no outline answers undefined rather than empty", () => {
    // A Line with fewer than two points has no outline; the caller must
    // be able to tell that from a shape whose outline is genuinely empty.
    expect(outlineOf(new Line({ points: [] }))).toBeUndefined()
  })
})

describe("worldOutlineOf — the common frame", () => {
  test("a shape's own offset moves its outline", () => {
    const pts = worldOutlineOf(new Circle({ radius: 10, x: 100, y: -50 }))!
    for (const p of pts) near(Math.hypot(p.x - 100, p.y + 50), 10, 1e-9)
  })

  test("an ancestor's transform is carried too", () => {
    const inner = new Circle({ radius: 10, x: 20 })
    // A Group at x=200, half scale: the circle should land at x=210 with
    // a radius of 5 in world terms.
    void new Group({ members: [inner], x: 200, scale: 0.5 }).parts
    const pts = worldOutlineOf(inner)!
    for (const p of pts) near(Math.hypot(p.x - 210, p.y), 5, 1e-9)
  })
})

describe("MorphShape — the holon", () => {
  const staged = (): { shape: MorphShape; src: Circle; dst: Rectangle } => {
    const src = new Circle({ radius: 20, x: -100, tint: BLUE })
    const dst = new Rectangle({ width: 100, height: 200, x: 100, tint: RED })
    const shape = new MorphShape(src, dst)
    // compose() installs the derived accessor; reading `parts` runs it —
    // the same idiom every composed holon's tests use (cable.test.ts).
    void shape.parts
    return { shape, src, dst }
  }

  test("at morph=0 it IS the source's world outline", () => {
    const { shape, src } = staged()
    shape.morph.value = 0
    const pts = shape.line.points
    const want = resampleUniform(worldOutlineOf(src)!, MORPH_SAMPLES)
    expect(pts.length).toBe(want.length)
    for (let i = 0; i < pts.length; i++) nearPt(pts[i]!, want[i]!, 1e-9)
  })

  test("at morph=1 it IS the target's world outline", () => {
    const { shape, dst } = staged()
    shape.morph.value = 1
    const pts = shape.line.points
    const want = resampleUniform(worldOutlineOf(dst)!, MORPH_SAMPLES)
    for (let i = 0; i < pts.length; i++) nearPt(pts[i]!, want[i]!, 1e-9)
  })

  test("the derived points re-read when the blend moves, and memoize when it does not", () => {
    const { shape } = staged()
    shape.morph.value = 0.3
    const first = shape.line.points
    // Same identity while nothing has changed — the host's dirty-check
    // depends on it.
    expect(shape.line.points).toBe(first)
    shape.morph.value = 0.6
    expect(shape.line.points).not.toBe(first)
  })

  test("it follows a source that MOVES mid-morph", () => {
    const { shape, src } = staged()
    shape.morph.value = 0
    const before = shape.line.points[0]!
    src.x.value = -300
    const after = shape.line.points[0]!
    near(after.x - before.x, -200, 1e-9)
  })

  test("scrubbing a MorphShape is exact in both directions", () => {
    const { shape } = staged()
    const at = (u: number): Vec3Like[] => {
      shape.morph.value = u
      return shape.line.points.map((p) => ({ ...p }))
    }
    const up = [0, 0.25, 0.5, 0.75, 1].map(at)
    const down = [1, 0.75, 0.5, 0.25, 0].map(at).reverse()
    expect(down).toEqual(up)
  })

  test("a shape with no outline is refused loudly", () => {
    const bad = new MorphShape(new Line({ points: [] }), new Circle({ radius: 10 }))
    void bad.parts
    expect(() => bad.line.points).toThrow(/no outline/)
  })
})

describe("the Morph verb — pydeation's windows", () => {
  const staged = () => {
    const src = new Circle({ radius: 20, tint: BLUE })
    const dst = new Rectangle({ width: 100, height: 200, tint: RED })
    const shape = new MorphShape(src, dst)
    void shape.parts
    return { shape, src, dst }
  }

  test("copy=false hides the source at the very start", () => {
    const { shape, src, dst } = staged()
    const anim = Morph(shape, src, dst)
    const hide = anim.tracks.find((t) => t.param === src.opacity)
    expect(hide).toBeDefined()
    expect(hide!.relStart).toBe(0)
    near(hide!.relStop, 0.01)
  })

  test("copy=true leaves the source standing", () => {
    const { shape, src, dst } = staged()
    const anim = Morph(shape, src, dst, { copy: true })
    expect(anim.tracks.some((t) => t.param === src.opacity)).toBe(false)
  })

  test("the target arrives in the last hundredth", () => {
    const { shape, src, dst } = staged()
    const show = Morph(shape, src, dst).tracks.find((t) => t.param === dst.opacity)!
    near(show.relStart, 0.99)
    expect(show.relStop).toBe(1)
  })

  test("the blend itself runs the whole span", () => {
    const { shape, src, dst } = staged()
    const blend = Morph(shape, src, dst).tracks.find((t) => t.param === shape.morph)!
    expect(blend.relStart).toBe(0)
    expect(blend.relStop).toBe(1)
    expect(blend.values).toEqual([0, 1])
  })

  test("the two surfaces blend TO the target's over the whole span", () => {
    const { shape, src, dst } = staged()
    const tracks = Morph(shape, src, dst).tracks
    for (const [param, want] of [
      [shape.tint, dst.tint.value],
      [shape.fillOpacity, dst.fillOpacity.value],
    ] as const) {
      const t = tracks.find((tr) => tr.param === param)!
      expect(t.relStart).toBe(0)
      expect(t.relStop).toBe(1)
      // `.to()`, not a frozen two-value sequence: the destination is a
      // construction constant and is read here, while the START comes
      // from the timeline. See the Morph verb's header — freezing the
      // source's BUILD-time surfaces is wrong for any scene whose
      // source is coloured or filled by an earlier play, which is
      // Scene01's case exactly.
      expect(t.mode).toBe("to")
      expect(t.values).toEqual([want])
    }
  })

  test("exactly one of the three is lit at each end of the span", () => {
    const { shape, src, dst } = staged()
    const tracks = Morph(shape, src, dst).tracks
    // The morpher lights at the start and leaves at 0.99, where the
    // destination takes over — two tracks on the morpher's opacity.
    const own = tracks.filter((t) => t.param === shape.opacity)
    expect(own.length).toBe(2)
    expect(own.some((t) => t.relStart === 0)).toBe(true)
    expect(own.some((t) => Math.abs(t.relStart - 0.99) < 1e-9)).toBe(true)
  })
})
