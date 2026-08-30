/**
 * Brick packing along a footprint (TheWall/TheWall.py:86-179, :1259-1281).
 *
 * The property that matters is stated once and checked everywhere: no
 * two bricks in a row overlap, and consecutive ones actually touch —
 * that is the whole reason the original bisects instead of stepping by
 * a fixed arc length.
 */

import { describe, expect, test } from "bun:test"
import {
  buildFootprint,
  circleFootprint,
  findNextBrickT,
  flowerFootprint,
  normalAt,
  packFootprint,
  packSlots,
  rowHeight,
  sampleFootprint,
  squareAt,
  squaresOverlap,
  type Footprint,
} from "../src/geometry/packing"

const near = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps)

/** Every consecutive pair of bricks: touching, never overlapping. */
const assertPackingSound = (fp: Footprint, brickSize: number, ts: number[]): void => {
  for (let i = 1; i < ts.length; i++) {
    const prev = squareAt(fp, ts[i - 1]!, brickSize).corners
    const cur = squareAt(fp, ts[i]!, brickSize).corners
    expect(squaresOverlap(prev, cur)).toBe(false)
    // And they are ADJACENT: pulling this brick back a hair collides.
    const nudged = squareAt(fp, ts[i]! - 0.002, brickSize).corners
    expect(squaresOverlap(prev, nudged)).toBe(true)
  }
}

describe("footprint sampling", () => {
  test("a unit square's arc length is its perimeter", () => {
    const fp = buildFootprint(
      [
        { x: 0, z: 0 },
        { x: 100, z: 0 },
        { x: 100, z: 100 },
        { x: 0, z: 100 },
      ],
      true,
    )
    near(fp.totalLength, 400, 1e-9)
  })

  test("samples uniformly in arc length, not in point index", () => {
    const fp = buildFootprint(
      [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 1010, z: 0 },
      ],
      false,
    )
    // Halfway along 1010 units of length is x = 505, not the middle point.
    near(sampleFootprint(fp, 0.5).position.x, 505, 1e-9)
  })

  test("a circle's length is 2*pi*r", () => {
    const fp = circleFootprint(1000)
    expect(Math.abs(fp.totalLength - 2 * Math.PI * 1000) / (2 * Math.PI * 1000)).toBeLessThan(1e-4)
  })

  test("the normal is perpendicular to the tangent, in the ground plane", () => {
    const fp = circleFootprint(1000)
    for (const t of [0, 0.13, 0.5, 0.87]) {
      const { tangent } = sampleFootprint(fp, t)
      const n = normalAt(tangent)
      near(tangent.x * n.x + tangent.z * n.z, 0, 1e-9)
      near(Math.hypot(n.x, n.z), 1, 1e-9)
    }
  })

  test("on a circle the normal is radial", () => {
    const fp = circleFootprint(1000)
    for (const t of [0.1, 0.4, 0.75]) {
      const { position, tangent } = sampleFootprint(fp, t)
      const n = normalAt(tangent)
      const radial = Math.hypot(position.x, position.z)
      // Parallel or antiparallel to the radius — magnitude 1 either way.
      // The footprint is a 360-gon, so a chord normal misses the true
      // radial by the half-segment angle; 1e-4 covers it.
      near(Math.abs((n.x * position.x + n.z * position.z) / radial), 1, 1e-4)
    }
  })

  test("clamps outside [0,1]", () => {
    const fp = circleFootprint(100)
    expect(sampleFootprint(fp, -1).position).toEqual(sampleFootprint(fp, 0).position)
    expect(sampleFootprint(fp, 5).position).toEqual(sampleFootprint(fp, 1).position)
  })

  test("a degenerate footprint does not divide by zero", () => {
    const fp = buildFootprint([{ x: 0, z: 0 }], false)
    expect(sampleFootprint(fp, 0.5).position).toEqual({ x: 0, z: 0 })
    expect(packFootprint(fp, 100)).toEqual([0])
  })
})

describe("SAT overlap (:86-101)", () => {
  const square = (cx: number, cz: number, s = 100) => [
    { x: cx - s / 2, z: cz - s / 2 },
    { x: cx + s / 2, z: cz - s / 2 },
    { x: cx + s / 2, z: cz + s / 2 },
    { x: cx - s / 2, z: cz + s / 2 },
  ]

  test("a square overlaps itself", () => {
    expect(squaresOverlap(square(0, 0), square(0, 0))).toBe(true)
  })

  test("clearly apart, clearly overlapping", () => {
    expect(squaresOverlap(square(0, 0), square(300, 0))).toBe(false)
    expect(squaresOverlap(square(0, 0), square(50, 0))).toBe(true)
  })

  test("edge-to-edge contact counts as clear (the source's slop, :400)", () => {
    expect(squaresOverlap(square(0, 0), square(100, 0))).toBe(false)
    expect(squaresOverlap(square(0, 0), square(99, 0))).toBe(true)
  })

  test("diagonal separation — the case an AABB test gets wrong", () => {
    // Two squares turned 45 degrees to each other, corner to corner.
    const rot = (cx: number, cz: number, s: number, a: number) =>
      [
        [-s / 2, -s / 2],
        [s / 2, -s / 2],
        [s / 2, s / 2],
        [-s / 2, s / 2],
      ].map(([x, z]) => ({
        x: cx + x! * Math.cos(a) - z! * Math.sin(a),
        z: cz + x! * Math.sin(a) + z! * Math.cos(a),
      }))
    expect(squaresOverlap(square(0, 0), rot(120, 0, 100, Math.PI / 4))).toBe(true)
    expect(squaresOverlap(square(0, 0), rot(130, 0, 100, Math.PI / 4))).toBe(false)
  })

  test("symmetric in its arguments", () => {
    const a = square(0, 0)
    const b = square(70, 40)
    expect(squaresOverlap(a, b)).toBe(squaresOverlap(b, a))
  })
})

describe("bisection for the next brick (:103-147)", () => {
  test("on a straight run the step is exactly one brick", () => {
    const fp = buildFootprint(
      [
        { x: 0, z: 0 },
        { x: 10000, z: 0 },
      ],
      false,
    )
    const next = findNextBrickT(fp, 100, 0, squareAt(fp, 0, 100).corners)
    expect(next).toBeDefined()
    // 100 units of 10000 = t 0.01, within the bisection tolerance.
    near(next! * fp.totalLength, 100, 0.5)
  })

  test("a convex bend needs MORE arc length than a straight run", () => {
    const circle = circleFootprint(300)
    const straight = buildFootprint(
      [
        { x: 0, z: 0 },
        { x: circle.totalLength, z: 0 },
      ],
      false,
    )
    const arcOn = (fp: Footprint) =>
      findNextBrickT(fp, 100, 0, squareAt(fp, 0, 100).corners)! * fp.totalLength
    expect(arcOn(circle)).toBeGreaterThan(arcOn(straight))
  })

  test("returns undefined when the footprint runs out", () => {
    const fp = buildFootprint(
      [
        { x: 0, z: 0 },
        { x: 100, z: 0 },
      ],
      false,
    )
    expect(findNextBrickT(fp, 100, 0.999, squareAt(fp, 0.999, 100).corners)).toBeUndefined()
  })
})

describe("packing a circle", () => {
  const fp = circleFootprint(1000)
  const ts = packFootprint(fp, 100)

  test("slots are ordered and inside [0,1)", () => {
    expect(ts[0]).toBe(0)
    for (let i = 1; i < ts.length; i++) expect(ts[i]!).toBeGreaterThan(ts[i - 1]!)
    expect(ts[ts.length - 1]!).toBeLessThan(1)
  })

  test("no two bricks overlap, and consecutive ones touch", () => {
    assertPackingSound(fp, 100, ts)
  })

  test("the closed loop does not overlap itself where it comes round", () => {
    const first = squareAt(fp, ts[0]!, 100).corners
    const last = squareAt(fp, ts[ts.length - 1]!, 100).corners
    expect(squaresOverlap(first, last)).toBe(false)
  })

  test("count is close to circumference/brick, a little under for the curvature", () => {
    const ideal = fp.totalLength / 100
    expect(ts.length).toBeLessThanOrEqual(Math.ceil(ideal))
    expect(ts.length).toBeGreaterThan(ideal * 0.9)
  })

  test("a bigger brick means fewer of them", () => {
    expect(packFootprint(fp, 200).length).toBeLessThan(ts.length)
  })

  test("deterministic — same footprint, same answer", () => {
    expect(packFootprint(circleFootprint(1000), 100)).toEqual(ts)
  })
})

describe("packing the 5-petal flower (TheWall.py:1592-1598)", () => {
  const fp = flowerFootprint({ innerRadius: 500, outerRadius: 1000, petals: 5 })
  const ts = packFootprint(fp, 100)

  test("no overlaps anywhere — through convex lobes AND concave valleys", () => {
    assertPackingSound(fp, 100, ts)
  })

  test("spacing VARIES with curvature — the whole point of the SAT search", () => {
    const gaps: number[] = []
    for (let i = 1; i < ts.length; i++) gaps.push((ts[i]! - ts[i - 1]!) * fp.totalLength)
    const min = Math.min(...gaps)
    const max = Math.max(...gaps)
    // A square held perpendicular to a curve needs AT LEAST its own
    // width of arc, and more the more the curve bends — so spacing runs
    // from just over one brick on the straightest stretches to half as
    // much again around the tightest lobes. Uniform stepping would
    // either overlap on the bends or leave gaps on the straights.
    expect(min).toBeGreaterThanOrEqual(100)
    expect(min).toBeLessThan(105)
    expect(max).toBeGreaterThan(140)
  })

  test("the footprint really has five lobes at the stated radii", () => {
    const radii: number[] = []
    for (let i = 0; i < 500; i++) {
      const p = sampleFootprint(fp, i / 500).position
      radii.push(Math.hypot(p.x, p.z))
    }
    near(Math.max(...radii), 1000, 1)
    near(Math.min(...radii), 500, 1)
    let lobes = 0
    for (let i = 0; i < radii.length; i++) {
      const prev = radii[(i - 1 + radii.length) % radii.length]!
      const next = radii[(i + 1) % radii.length]!
      if (radii[i]! > prev && radii[i]! >= next && radii[i]! > 990) lobes++
    }
    expect(lobes).toBe(5)
  })

  test("ordered and closed", () => {
    for (let i = 1; i < ts.length; i++) expect(ts[i]!).toBeGreaterThan(ts[i - 1]!)
    const first = squareAt(fp, ts[0]!, 100).corners
    const last = squareAt(fp, ts[ts.length - 1]!, 100).corners
    expect(squaresOverlap(first, last)).toBe(false)
  })
})

describe("slots — the wall's own data (replacing PackingLUT)", () => {
  const fp = circleFootprint(1000)
  const packing = packSlots(fp, { brickSize: 100, rowCount: 4 })

  test("every row gets every column", () => {
    expect(packing.slots.length).toBe(packing.rowLength * 4)
    for (let row = 0; row < 4; row++) {
      expect(packing.slots.filter((s) => s.row === row).length).toBe(packing.rowLength)
    }
  })

  test("slots come out ordered by row, then by t", () => {
    for (let i = 1; i < packing.slots.length; i++) {
      const a = packing.slots[i - 1]!
      const b = packing.slots[i]!
      expect(a.row < b.row || (a.row === b.row && a.t < b.t)).toBe(true)
    }
  })

  test("rows are identical layouts at different heights", () => {
    const row0 = packing.slots.filter((s) => s.row === 0)
    const row3 = packing.slots.filter((s) => s.row === 3)
    for (let i = 0; i < row0.length; i++) {
      expect(row3[i]!.t).toBe(row0[i]!.t)
      expect(row3[i]!.position).toEqual(row0[i]!.position)
    }
  })

  test("the slot is pushed back along the normal to centre the brick (:1270)", () => {
    const slot = packing.slots[3]!
    const raw = sampleFootprint(fp, slot.t).position
    near(slot.position.x - raw.x, slot.normal.x * 50, 1e-9)
    near(slot.position.z - raw.z, slot.normal.z * 50, 1e-9)
  })

  test("rows are centred on y = 0, spaced by the brick height (:1276)", () => {
    expect(rowHeight(0, 4, 100)).toBe(-150)
    expect(rowHeight(3, 4, 100)).toBe(150)
    expect(rowHeight(0, 1, 100)).toBe(0)
    // Two rows straddle zero — the flower scene's arrangement.
    expect(rowHeight(0, 2, 100)).toBe(-50)
    expect(rowHeight(1, 2, 100)).toBe(50)
  })

  test("deterministic", () => {
    const again = packSlots(circleFootprint(1000), { brickSize: 100, rowCount: 4 })
    expect(again.ts).toEqual(packing.ts)
  })
})
