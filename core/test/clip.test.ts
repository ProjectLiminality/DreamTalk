import { describe, expect, test } from "bun:test"
import { Circle, Group } from "../src/parts/primitives"
import { clip, clipCoverage, clipOf } from "../src/clip"

describe("clip — ink seen through a window", () => {
  test("nothing declared: no clip anywhere (the host switches no material)", () => {
    const leaf = new Circle()
    new Group({ members: [leaf] })
    expect(clipOf(leaf)).toBeUndefined()
  })

  test("a clip inherits down the tree; the nearest wins", () => {
    const leaf = new Circle()
    const inner = new Group({ members: [leaf] })
    const outer = new Group({ members: [inner] })
    const a = new Circle({ radius: 10 })
    const b = new Circle({ radius: 20 })
    const far = clip(outer, () => a)
    expect(clipOf(leaf)).toBe(far)
    const near = clip(inner, () => b)
    expect(clipOf(leaf)).toBe(near)
    expect(clipOf(outer)).toBe(far)
    expect(near.disc()).toBe(b)
  })

  test("coverage: 1 inside, 0 outside, a one-pixel ramp across the rim", () => {
    const c = { x: 100, y: 100 }
    const u = { x: 50, y: 0 }
    const v = { x: 0, y: 25 } // an ellipse 100×50 px
    expect(clipCoverage({ x: 100, y: 100 }, c, u, v)).toBe(1)
    expect(clipCoverage({ x: 140, y: 100 }, c, u, v)).toBe(1)
    expect(clipCoverage({ x: 160, y: 100 }, c, u, v)).toBe(0)
    expect(clipCoverage({ x: 100, y: 130 }, c, u, v)).toBe(0)
    expect(clipCoverage({ x: 100, y: 125 }, c, u, v)).toBeCloseTo(0.5, 9)
    // An edge-on disc is a window of no area.
    expect(clipCoverage(c, c, { x: 1, y: 0 }, { x: 2, y: 0 })).toBe(0)
  })
})
