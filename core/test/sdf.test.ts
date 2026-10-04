/**
 * The square ∩ circle cylinder (geometry/sdf.ts, Cylinder.of) — the
 * founding derivation as a proof, not a pair of matching numbers: the
 * intersection of the profile's prism and the circle's prism IS the
 * cylinder, point for point, while the profile spans the circle; and a
 * cylinder made `of` a square and a circle follows them wherever they go.
 */

import { describe, expect, test } from "bun:test"
import {
  circlePrism,
  cylinder,
  intersect,
  squareCircleCylinder,
  squarePrism,
  union,
} from "../src/geometry/sdf"
import { Cylinder } from "../vocabulary/Cylinder/Cylinder"
import { Circle, Rectangle, Square } from "../src/parts/primitives"
import { Dream } from "../src/dream"
import { together } from "../src/anim"

/** Sample a box around the shapes; return the sign disagreements. */
const disagreements = (a: (x: number, y: number, z: number) => number, b: typeof a, extent: number) => {
  const bad: number[][] = []
  const n = 24
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++)
      for (let k = 0; k <= n; k++) {
        const x = -extent + (2 * extent * i) / n + 0.37
        const y = -extent + (2 * extent * j) / n + 0.21
        const z = -extent + (2 * extent * k) / n + 0.13
        const da = a(x, y, z)
        const db = b(x, y, z)
        if (Math.abs(da) < 1e-6 || Math.abs(db) < 1e-6) continue // on a surface
        if (Math.sign(da) !== Math.sign(db)) bad.push([x, y, z])
      }
  return bad
}

describe("square ∩ circle = cylinder", () => {
  test("the founding proportion: square 200, circle r=100 — exactly a 100×200 cylinder", () => {
    const meet = intersect(squarePrism(200, 200), circlePrism(100))
    expect(disagreements(meet, cylinder(100, 200), 160)).toEqual([])
  })

  test("video-01's canon: rectangle 100×200, circle r=50 — the 50×200 cylinder", () => {
    const meet = intersect(squarePrism(100, 200), circlePrism(50))
    expect(disagreements(meet, cylinder(50, 200), 140)).toEqual([])
    expect(squareCircleCylinder(100, 200, 50)).toEqual({ radius: 50, height: 200, exact: true })
  })

  test("a profile wider than the circle still meets it in the circle's cylinder", () => {
    const meet = intersect(squarePrism(300, 120), circlePrism(60))
    expect(disagreements(meet, cylinder(60, 120), 180)).toEqual([])
  })

  test("a profile narrower than the circle shaves the mantle — not a cylinder, and says so", () => {
    const meet = intersect(squarePrism(80, 200), circlePrism(60))
    const bad = disagreements(meet, cylinder(60, 200), 140)
    expect(bad.length).toBeGreaterThan(0)
    // Every disagreement is mantle the profile's flat sides cut away.
    for (const [x] of bad) expect(Math.abs(x!)).toBeGreaterThan(40)
    expect(squareCircleCylinder(80, 200, 60).exact).toBe(false)
  })

  test("the box and cylinder distances are exact (not just in sign)", () => {
    expect(squarePrism(2, 2)(3, 0, 7)).toBeCloseTo(2, 12)
    expect(squarePrism(2, 2)(2, 2, 0)).toBeCloseTo(Math.SQRT2, 12)
    expect(squarePrism(2, 2)(0, 0, 0)).toBeCloseTo(-1, 12)
    expect(cylinder(1, 2)(0, 3, 0)).toBeCloseTo(2, 12)
    expect(cylinder(1, 2)(2, 2, 0)).toBeCloseTo(Math.SQRT2, 12)
    expect(union(circlePrism(1), squarePrism(4, 4))(0, 0, 0)).toBe(-2)
  })
})

describe("Cylinder.of — derived, so it follows", () => {
  test("radius from the circle, height from the profile", () => {
    const c = Cylinder.of(new Rectangle({ width: 100, height: 200 }), new Circle({ radius: 50 }))
    expect(c.radius.value).toBe(50)
    expect(c.height.value).toBe(200)
  })

  test("rectangle → square: the cylinder follows the swap", () => {
    const circle = new Circle({ radius: 50 })
    const fromRectangle = Cylinder.of(new Rectangle({ width: 100, height: 200 }), circle)
    const fromSquare = Cylinder.of(new Square({ size: 100 }), circle)
    expect(fromRectangle.height.value).toBe(200)
    expect(fromSquare.height.value).toBe(100)
    expect(fromSquare.radius.value).toBe(50)
  })

  test("change the inputs, the cylinder changes with them", () => {
    const square = new Square({ size: 200 })
    const circle = new Circle({ radius: 100 })
    const c = Cylinder.of(square, circle)
    square.size.value = 260
    circle.radius.value = 80
    expect(c.height.value).toBe(260)
    expect(c.radius.value).toBe(80)
  })

  test("it cannot be set behind its parts' backs", () => {
    const c = Cylinder.of(new Square({ size: 200 }), new Circle({ radius: 100 }))
    expect(() => {
      c.radius.value = 10
    }).toThrow()
  })

  test("animating a part animates the cylinder, on the timeline", () => {
    class Grow extends Dream {
      square = new Square({ size: 200 })
      circle = new Circle({ radius: 100 })
      cylinder = Cylinder.of(this.square, this.circle)
      unfold() {
        this.play(together(this.square.size.to(300), this.circle.radius.to(150)), 2)
      }
    }
    const dream = new Grow()
    dream.build()
    dream.applyAt(0)
    expect([dream.cylinder.radius.value, dream.cylinder.height.value]).toEqual([100, 200])
    dream.applyAt(2)
    expect([dream.cylinder.radius.value, dream.cylinder.height.value]).toEqual([150, 300])
  })

  test("transform and look still come through the overrides", () => {
    const c = Cylinder.of(new Square({ size: 200 }), new Circle({ radius: 100 }), { x: 40, stroke: 5 })
    expect(c.x.value).toBe(40)
    expect(c.stroke.value).toBe(5)
  })
})
