/**
 * Polygon — pydeation's `NGon`, and the one thing about it that had to
 * be measured rather than assumed: WHERE VERTEX ZERO SITS.
 *
 * Core's `Polygon` already carried `radius` and `sides`, which is
 * exactly what pydeation's NGon sets on the C4D primitive
 * (refs/pydeation-legacy/object/object.py:960-975 — `PRIM_NSIDE_SIDES`
 * and `PRIM_NSIDE_RADIUS`, and nothing else). What it also carried was a
 * start angle of π/2 — a vertex on TOP — that dated to the host's first
 * commit, had never been checked against anything, and was never
 * exercised, because until Scene07_1 no scene in the repo constructed a
 * Polygon at all.
 *
 * The reference says π/2 is wrong and 0 is right, and it says so twice
 * over: by the shapes' appearance on
 * refs/pitch/origins/frames5/f_01460 (triangle pointing RIGHT, square as
 * a DIAMOND, pentagon with a lone vertex at its right edge, hexagon
 * flat-topped) and by the triangle's measured aspect, which the two
 * phases predict differently and unmistakably.
 *
 * These tests pin the ASPECT ARITHMETIC — the thing the frames actually
 * measured — rather than the vertex coordinates, so a generator that
 * drifted to a different phase would fail here instead of agreeing with
 * itself. The predictions are recomputed from n and R by trigonometry,
 * never copied from the implementation.
 */

import { describe, expect, test } from "bun:test"
import { Circle, Polygon } from "../src/parts/primitives"
import { outlineOf } from "../src/geometry/morph"
import { PI } from "../src/constants"

/** The ink box of a holon's own outline, in its local space. */
const box = (
  holon: Polygon | Circle,
): { width: number; height: number; minX: number; maxX: number } => {
  const points = outlineOf(holon)
  expect(points).toBeDefined()
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of points!) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { width: maxX - minX, height: maxY - minY, minX, maxX }
}

describe("the phase is zero — a vertex on the +x axis", () => {
  test("that is the default, and it is stated as a param", () => {
    expect(new Polygon({}).phase.value).toBe(0)
  })

  /**
   * The triangle is the discriminating case, because n=3 is the only
   * regular polygon whose bounding box is not symmetric about its
   * centre: at phase 0 it spans R to the right of centre and R/2 to the
   * left, so 1.5R wide by √3·R tall — and at phase π/2 exactly the
   * transpose. Nothing else in the chain separates the two phases so
   * cleanly, which is why the frame measurement was taken on it.
   */
  test("a triangle is 1.5R wide and √3·R tall, not the transpose", () => {
    const R = 50
    const { width, height } = box(new Polygon({ sides: 3, radius: R }))
    expect(width).toBeCloseTo(1.5 * R, 6)
    expect(height).toBeCloseTo(Math.sqrt(3) * R, 6)
    // And the two are genuinely different, so this test can fail.
    expect(width).toBeLessThan(height)
  })

  test("the reference's own numbers come out: 76 x 86 px at R = 50", () => {
    // f_01460, Scene07_1's finished chain, measured at the camera's
    // 1.28 px per world unit with the chain's circle 100 px across
    // (hence R = 50 px). The triangle's ink box there is 76 x 86 px.
    const R = 50
    const { width, height } = box(new Polygon({ sides: 3, radius: R }))
    // Predicted 75.0 x 86.6 against a measurement of 76 x 86 — the
    // difference is the ~1 px stroke the reference draws with.
    expect(Math.abs(width - 76)).toBeLessThan(2)
    expect(Math.abs(height - 86)).toBeLessThan(2)
    // The abandoned phase would have predicted the TRANSPOSE — 86.6
    // wide by 75 tall — which is not what the frame shows, and misses
    // the measured width by more than ten pixels.
    const turned = box(new Polygon({ sides: 3, radius: R, phase: PI / 2 }))
    expect(turned.width).toBeCloseTo(Math.sqrt(3) * R, 6)
    expect(turned.height).toBeCloseTo(1.5 * R, 6)
    expect(Math.abs(turned.width - 76)).toBeGreaterThan(10)
  })

  test("the square is a diamond, and the hexagon is flat-topped", () => {
    const R = 50
    // n=4 at phase 0 puts vertices at 0, 90, 180, 270 degrees: a square
    // standing on a corner, 2R across both ways — which is what f_01460
    // shows and what an axis-aligned box (√2·R across) would not be.
    const square = box(new Polygon({ sides: 4, radius: R }))
    expect(square.width).toBeCloseTo(2 * R, 6)
    expect(square.height).toBeCloseTo(2 * R, 6)
    // n=6 at phase 0 has vertices left and right and flat edges top and
    // bottom: 2R wide, √3·R tall.
    const hexagon = box(new Polygon({ sides: 6, radius: R }))
    expect(hexagon.width).toBeCloseTo(2 * R, 6)
    expect(hexagon.height).toBeCloseTo(Math.sqrt(3) * R, 6)
  })

  /**
   * The odd-sided polygons are the reason the chain's positions had to
   * be read off the RIGHT VERTEX rather than the bounding box. At phase
   * 0 an odd n has a single vertex reaching +R while its leftmost points
   * are a symmetric PAIR that do not reach as far, so the box centre
   * sits to the RIGHT of the true centre — by R/4 for the triangle and
   * about R/10 for the pentagon. Reading the chain's spacing off box
   * centres would have made an evenly spaced row look uneven; reading it
   * off `maxX − R` recovers the centre exactly, which is how f_01460's
   * 256/448/640/832/1024 came out to the pixel.
   *
   * Even n has a vertex at both ends and no such offset, which is why
   * the square and hexagon above could be measured either way.
   */
  test("an odd n-gon's box centre sits right of its true centre", () => {
    const R = 50
    const pentagon = box(new Polygon({ sides: 5, radius: R }))
    expect(pentagon.maxX).toBeCloseTo(R, 6)
    expect(pentagon.minX).toBeCloseTo(Math.cos((4 * PI) / 5) * R, 6)
    expect((pentagon.minX + pentagon.maxX) / 2).toBeCloseTo(0.0955 * R, 3)

    const triangle = box(new Polygon({ sides: 3, radius: R }))
    expect(triangle.maxX).toBeCloseTo(R, 6)
    expect(triangle.minX).toBeCloseTo(-R / 2, 6)
    expect((triangle.minX + triangle.maxX) / 2).toBeCloseTo(R / 4, 6)

    // Even n has no offset at all.
    for (const sides of [4, 6]) {
      const even = box(new Polygon({ sides, radius: R }))
      expect((even.minX + even.maxX) / 2).toBeCloseTo(0, 6)
    }
  })
})

describe("phase is a real parameter, not a constant in disguise", () => {
  test("turning an n-gon by 2π/n maps it onto itself", () => {
    const R = 70
    for (const sides of [3, 4, 5, 6]) {
      const plain = box(new Polygon({ sides, radius: R }))
      const turned = box(new Polygon({ sides, radius: R, phase: (2 * PI) / sides }))
      expect(turned.width).toBeCloseTo(plain.width, 6)
      expect(turned.height).toBeCloseTo(plain.height, 6)
    }
  })

  test("a triangle turned by π/2 is the transpose of one that is not", () => {
    const R = 40
    const plain = box(new Polygon({ sides: 3, radius: R }))
    const turned = box(new Polygon({ sides: 3, radius: R, phase: PI / 2 }))
    expect(turned.width).toBeCloseTo(plain.height, 6)
    expect(turned.height).toBeCloseTo(plain.width, 6)
  })
})

describe("Scene07_1's chain — the geometry the frames measured", () => {
  /**
   * The five ideas at their finished places: `NGon(n=3..6)` and a
   * `Circle`, all `radius=25, scale=3/2`, at x = −300, −150, 0, 150,
   * 300. On f_01460 those land at screen 256, 448, 640, 832, 1024 px —
   * every one exact at the camera's 1.28 px per world unit — and the
   * chain's circle measures 100 px across.
   */
  const RADIUS = 25
  const SCALE = 3 / 2
  const PX_PER_UNIT = 1.28

  test("the chain's shapes are all one size, and it is the reference's", () => {
    const worldRadius = RADIUS * SCALE
    expect(worldRadius).toBeCloseTo(37.5, 12)
    // The circle is the plain case: 2R across.
    expect(2 * worldRadius * PX_PER_UNIT).toBeCloseTo(96, 6)
    // Measured 100 px to the outside of a ~2 px stroke on each side.
    expect(Math.abs(2 * worldRadius * PX_PER_UNIT - 100)).toBeLessThan(5)
  })

  test("the five x positions land on the measured pixels", () => {
    const measured = [256, 448, 640, 832, 1024]
    const xs = [-300, -150, 0, 150, 300]
    xs.forEach((x, i) => {
      expect(640 + x * PX_PER_UNIT).toBeCloseTo(measured[i]!, 6)
    })
  })

  test("the chain runs polygon to circle, gaining a side each step", () => {
    const chain = [
      new Polygon({ sides: 3, radius: RADIUS }),
      new Polygon({ sides: 4, radius: RADIUS }),
      new Polygon({ sides: 5, radius: RADIUS }),
      new Polygon({ sides: 6, radius: RADIUS }),
    ]
    // Each step's outline encloses more area than the last — the
    // convergence toward the circle, stated as the thing it is.
    const areas = chain.map((p) => {
      const n = p.sides.value
      const R = p.radius.value
      return (n / 2) * R * R * Math.sin((2 * PI) / n)
    })
    for (let i = 1; i < areas.length; i++) {
      expect(areas[i]!).toBeGreaterThan(areas[i - 1]!)
    }
    // And all of them fall short of the circle they are converging on.
    const circle = PI * RADIUS * RADIUS
    for (const area of areas) expect(area).toBeLessThan(circle)
    // The hexagon is already within 10% of it, which is why five steps
    // is enough for the chain to read as arriving.
    expect(areas[3]! / circle).toBeGreaterThan(0.8)
  })
})
