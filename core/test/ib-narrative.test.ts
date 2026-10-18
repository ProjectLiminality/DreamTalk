/**
 * Narrative — the perspective cube in its ring, and the FoldableCube taper
 * it stands on. Corners are composed through the host's own transform
 * order (world = T + R·(S·local), R from rotHPB), as foldablecube.test.ts
 * does, so the tests make the calls the renderer makes.
 */

import { describe, expect, test } from "bun:test"
import { DEFAULT_VIEW_DISTANCE, NARRATIVE, Narrative } from "../vocabulary/Narrative/Narrative"
import { FoldableCube, hingeAngle, taperFor, wallPolyline, wallSlant } from "../vocabulary/FoldableCube/FoldableCube"
import { rectanglePolyline } from "../src/parts/primitives"
import { rotHPB } from "../src/parts/curves"
import type { Holon } from "../src/holon"
import type { Vec3Like } from "../src/parts/index"
import { BLUE, PI, WHITE } from "../src/constants"

const up = (h: Holon, v: Vec3Like): Vec3Like => {
  const s = h.scale.value
  const r = rotHPB({ x: v.x * s, y: v.y * s, z: v.z * s }, h.p.value, h.h.value, h.b.value)
  return { x: r.x + h.x.value, y: r.y + h.y.value, z: r.z + h.z.value }
}
const dist = (a: Vec3Like, b: Vec3Like) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const distinct = (pts: Vec3Like[], tol = 1e-9) => {
  const kept: Vec3Like[] = []
  for (const p of pts) if (!kept.some((q) => dist(p, q) < tol)) kept.push(p)
  return kept
}
/** Every wall outline point in the CUBE frame. */
const wallPoints = (cube: FoldableCube): Vec3Like[] => {
  void cube.parts
  return [cube.frontPivot, cube.backPivot, cube.rightPivot, cube.leftPivot].flatMap((pivot) => {
    void pivot.parts
    const wall = cube.walls[[cube.frontPivot, cube.backPivot, cube.rightPivot, cube.leftPivot].indexOf(pivot)]!
    return wall.points.map((p) => up(pivot, up(wall, p)))
  })
}

describe("FoldableCube taper — the film's one-point perspective", () => {
  test("taper 1 is the cube unchanged: square walls, swing PI/2", () => {
    expect(hingeAngle(1, 1)).toBe(PI / 2)
    expect(wallSlant(100, 1)).toBe(100)
    for (const out of [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }])
      expect(wallPolyline(100, 1, out)).toEqual(rectanglePolyline(100, 100, 0))
  })

  for (const [taper, depth] of [[0.5, 1], [0.75, 1], [0.9, 1], [0.72, 0.02], [0.6, 0.3]] as const)
    test(`taper ${taper}, depth ${depth}: the cup closes at fold ±1 into a frustum — rim size, bottom taper·size, depth depth·size`, () => {
      const size = 100
      const cube = new FoldableCube({ size, taper, depth })
      void cube.parts
      for (const fold of [1, -1]) {
        cube.fold.value = fold
        const pts = wallPoints(cube)
        const rim = pts.filter((p) => Math.abs(p.y - fold * depth * size) < 1e-9)
        // the four free-edge corners of the walls collapse onto the rim's four
        const rimCorners = distinct(rim).filter((p) => Math.abs(Math.abs(p.x) - size / 2) < 1e-9 && Math.abs(Math.abs(p.z) - size / 2) < 1e-9)
        expect(rimCorners.length).toBe(4)
        const hinge = distinct(pts.filter((p) => Math.abs(p.y) < 1e-9))
        for (const c of hinge) expect(Math.max(Math.abs(c.x), Math.abs(c.z))).toBeCloseTo((taper * size) / 2, 9)
        // nothing pokes beyond the frustum's depth
        for (const p of pts) expect(Math.abs(p.y)).toBeLessThanOrEqual(depth * size + 1e-9)
      }
      // the bottom is the frustum's small square
      expect(cube.bottom.width.value).toBeCloseTo(taper * size, 12)
      // fold 0: flat, the trapezoids lie in the ground plane
      cube.fold.value = 0
      for (const p of wallPoints(cube)) expect(Math.abs(p.y)).toBeLessThan(1e-9)
    })

  test("taperFor: the camera's foreshortening times the taper gives the asked-for ratio", () => {
    const size = 100
    const d = 1500
    const t = taperFor(0.716, size, d)
    expect((t * d) / (d + size)).toBeCloseTo(0.716, 12)
    expect((taperFor(0.716, size, d, 0.02) * d) / (d + 0.02 * size)).toBeCloseTo(0.716, 12)
    expect(taperFor(0.99, 1000, 1000)).toBe(1) // clamped to a true cube
  })
})

describe("Narrative — the perspective cube in its ring", () => {
  test("composed: FoldableCube closed (fold 1, open toward the viewer), ring and disc share the centre", () => {
    const n = new Narrative({ size: 112 })
    void n.parts
    expect(n.cube).toBeInstanceOf(FoldableCube)
    expect(n.cube.fold.value).toBe(1)
    expect(n.cube.fold.isBound).toBe(true)
    expect(n.cube.size.value).toBe(112)
    expect(n.cube.p.value).toBeCloseTo(PI / 2, 12)
    // rim in the symbol's plane: the cup's depth lies behind it
    expect(n.cube.depth.value).toBe(NARRATIVE.depth)
    expect(n.cube.z.value).toBeCloseTo(-112 * NARRATIVE.depth, 12)
    expect(n.circle.radius.value).toBeCloseTo(NARRATIVE.ring * 112, 12)
    expect(n.parts.indexOf(n.disc)).toBeLessThan(n.parts.indexOf(n.cube))
    expect(n.parts.indexOf(n.cube)).toBeLessThan(n.parts.indexOf(n.ringLayer))
  })

  test("seen front-on from the default observer the back square is the film's 0.716 of the front", () => {
    const n = new Narrative({ size: 112 })
    void n.parts
    const d = DEFAULT_VIEW_DISTANCE
    const seen = () => (n.cube.taper.value * d) / (d + n.cube.depth.value * n.cube.size.value)
    expect(seen()).toBeCloseTo(NARRATIVE.back, 12)
    // and a perspective handed in is honoured (Worldview's deeper 0.66)
    n.perspective.value = 0.66
    expect(seen()).toBeCloseTo(0.66, 12)
  })

  test("a relief: 600 units off-centre the back square's parallax is under a pixel", () => {
    const size = 233 // f5686's front edge at the default camera
    const shift = (600 * NARRATIVE.depth * size) / DEFAULT_VIEW_DISTANCE // world units
    expect(shift * (720 / (2 * DEFAULT_VIEW_DISTANCE * Math.tan((53.13 * PI) / 360)))).toBeLessThan(1)
  })

  test("ring 0 … 1 is the walkable state: bare cube ↔ ringed; tints default white in blue", () => {
    const n = new Narrative()
    void n.parts
    expect(n.cube.tint.value).toEqual(WHITE)
    expect(n.circle.tint.value).toEqual(BLUE)
    expect(n.ringLayer.presence.value).toBe(1)
    expect(n.disc.presence.value).toBe(1)
    n.ring.value = 0
    expect(n.ringLayer.presence.value).toBe(0)
    expect(n.disc.presence.value).toBe(0)
    const axes = n.stateSpace()!.axes
    expect(axes.map((a) => a.id)).toEqual(["ring"])
    const blue = new Narrative({ tint: BLUE, ring: 0 })
    void blue.parts
    expect(blue.cube.tint.value).toEqual(BLUE)
  })
})
