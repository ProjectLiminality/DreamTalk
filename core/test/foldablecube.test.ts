/**
 * FoldableCube — the hinge math, pinned on the SHIPPED params (the
 * cap-arc lesson: tests make exactly the calls the renderer makes).
 * Corners are composed through the host's own transform order
 * (world = T + R·(S·local), R = Rz(b)·Rx(p)·Ry(h)) using the exported
 * rotHPB, walking wall → pivot → cube frames.
 */

import { describe, expect, test } from "bun:test"
import { FoldableCube, hingeAngle } from "../src/parts/foldablecube"
import { rotHPB } from "../src/parts/curves"
import { bipolar } from "../src/params"
import type { Holon } from "../src/holon"
import type { Vec3Like } from "../src/parts/index"
import { PI } from "../src/constants"

/** One level of the host's group transform. */
const up = (h: Holon, v: Vec3Like): Vec3Like => {
  const s = h.scale.value
  const r = rotHPB({ x: v.x * s, y: v.y * s, z: v.z * s }, h.p.value, h.h.value, h.b.value)
  return { x: r.x + h.x.value, y: r.y + h.y.value, z: r.z + h.z.value }
}

/** A wall's four corners in the CUBE frame (wall local → pivot → cube). */
const wallCorners = (cube: FoldableCube, wallIndex: number): Vec3Like[] => {
  const pivot = [cube.frontPivot, cube.backPivot, cube.rightPivot, cube.leftPivot][wallIndex]!
  void pivot.parts // ensure the Group adopted its wall
  const wall = pivot.members[0]!
  const half = cube.size.value / 2
  const corners: Vec3Like[] = []
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      corners.push(up(pivot, up(wall, { x: sx * half, y: sy * half, z: 0 })))
    }
  }
  return corners
}

const dist = (a: Vec3Like, b: Vec3Like): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

/** Count distinct points under a tolerance. */
const distinct = (points: Vec3Like[], tol = 1e-9): number => {
  const kept: Vec3Like[] = []
  for (const p of points) {
    if (!kept.some((q) => dist(p, q) < tol)) kept.push(p)
  }
  return kept.length
}

const allWallCorners = (cube: FoldableCube): Vec3Like[] =>
  [0, 1, 2, 3].flatMap((i) => wallCorners(cube, i))

describe("the hinge law", () => {
  test("pivot angle is fold · PI/2, per-face signs as shipped", () => {
    const cube = new FoldableCube()
    void cube.parts
    for (const fold of [-1, -0.5, 0, 0.3, 1]) {
      cube.fold.value = fold
      expect(cube.frontPivot.p.value).toBeCloseTo(-hingeAngle(fold), 12)
      expect(cube.backPivot.p.value).toBeCloseTo(hingeAngle(fold), 12)
      expect(cube.rightPivot.b.value).toBeCloseTo(hingeAngle(fold), 12)
      expect(cube.leftPivot.b.value).toBeCloseTo(-hingeAngle(fold), 12)
    }
    expect(hingeAngle(1)).toBeCloseTo(PI / 2, 12)
  })

  test("hinge-edge corners sit ON the bottom edges at every fold", () => {
    const cube = new FoldableCube()
    void cube.parts
    const half = cube.size.value / 2
    // fold 0 is excluded: flat, EVERY corner is at y = 0 (its own test).
    for (const fold of [-1, -0.4, 0.15, 0.7, 1]) {
      cube.fold.value = fold
      for (const corner of allWallCorners(cube)) {
        // Every wall keeps two corners at y = 0 on the bottom square's
        // perimeter — the hinge line never moves.
        if (Math.abs(corner.y) < 1e-9) {
          expect(Math.max(Math.abs(corner.x), Math.abs(corner.z))).toBeCloseTo(half, 9)
        }
      }
      // exactly 8 hinge corners (2 per wall), landing on the bottom's 4
      // corners pairwise → 4 distinct points among them
      const hinges = allWallCorners(cube).filter((c) => Math.abs(c.y) < 1e-9)
      expect(hinges.length).toBe(8)
      expect(distinct(hinges)).toBe(4)
    }
  })

  test("fold 0 is the flat cross: everything at y = 0, walls outboard", () => {
    const cube = new FoldableCube()
    void cube.parts
    cube.fold.value = 0
    const corners = allWallCorners(cube)
    for (const c of corners) expect(Math.abs(c.y)).toBeLessThan(1e-9)
    // outer edges reach 1.5 · size from center
    const reach = Math.max(...corners.map((c) => Math.max(Math.abs(c.x), Math.abs(c.z))))
    expect(reach).toBeCloseTo(1.5 * cube.size.value, 9)
    // nothing meets: 8 outer corners all distinct
    const outer = corners.filter((c) => Math.abs(c.y) > -1) // all 16
    expect(distinct(outer)).toBe(12) // 4 shared hinge corners + 8 free
  })

  test("fold ±1: adjacent wall corners MEET — the cube closes", () => {
    const cube = new FoldableCube()
    void cube.parts
    for (const fold of [1, -1]) {
      cube.fold.value = fold
      const corners = allWallCorners(cube)
      const size = cube.size.value
      const rim = corners.filter((c) => Math.abs(c.y - fold * size) < 1e-9)
      // 8 top corners (2 per wall) collapsing into the 4 corners of the
      // open square at y = fold · size
      expect(rim.length).toBe(8)
      expect(distinct(rim)).toBe(4)
      // and they are the square's corners at ±size/2
      for (const c of rim) {
        expect(Math.abs(c.x)).toBeCloseTo(size / 2, 9)
        expect(Math.abs(c.z)).toBeCloseTo(size / 2, 9)
      }
    }
  })

  test("fold binds by passing the Param (pass-the-param)", () => {
    const shared = bipolar(0.25)
    const cube = new FoldableCube({ fold: shared })
    void cube.parts
    expect(cube.fold).toBe(shared)
    shared.value = -0.75
    expect(cube.frontPivot.p.value).toBeCloseTo((0.75 * PI) / 2, 12)
  })
})
