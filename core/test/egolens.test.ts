import { describe, expect, test } from "bun:test"
import { EGOLENS, EgoLens, petalOutline } from "../vocabulary/EgoLens/EgoLens"

const at = (relation: number) => {
  const ego = new EgoLens()
  void ego.parts
  ego.relation.value = relation
  return ego
}

describe("EgoLens", () => {
  test("one axis, three positions: away · icon · deep", () => {
    const ego = at(0)
    const axes = ego.stateSpace()!.axes
    expect(axes.map((a) => a.id)).toEqual(["relation"])
    expect(axes[0]!.positions.map((p) => p.name)).toEqual(["away", "icon", "deep"])
    expect(axes[0]!.escape).toBe("icon")
    // A whole that drives it takes the axis.
    const held = at(0)
    held.relation.follow({ value: 0 })
    expect(held.stateSpace()).toBeUndefined()
  })

  test("the cyclops is the watchtower's eye: clear as it opens, burning when deep", () => {
    expect(at(0).eye.stateSpace()).toBeUndefined()
    expect(at(1).eye.fire()).toBeCloseTo(1)
    expect(at(1).eye.calm()).toBeCloseTo(0)
    expect(at(0.5).eye.calm()).toBeGreaterThan(0.5)
  })

  test("turned away, the face looks down to the dark and the back up to the star", () => {
    const meanY = (pts: readonly { y: number }[]) => pts.reduce((a, p) => a + p.y, 0) / pts.length
    const lensY = EGOLENS.lens * 900
    const icon = at(0)
    expect(meanY(icon.face.points)).toBeGreaterThan(lensY)
    expect(icon.back.opacity.value).toBe(0)
    const away = at(-1)
    expect(meanY(away.face.points)).toBeLessThan(lensY)
    expect(meanY(away.back.points)).toBeGreaterThan(lensY)
    expect(away.back.opacity.value).toBeGreaterThan(0)
  })

  test("the flower: open with the light, shrivelled away, a bud too deep", () => {
    expect(at(0).bloom()).toBeCloseTo(1)
    expect(at(-1).bloom()).toBeCloseTo(-1)
    expect(at(1).bloom()).toBeCloseTo(0)
    expect(at(0).lit()).toBeCloseTo(1)
    expect(at(-1).lit()).toBeCloseTo(0)
    expect(at(1).lit()).toBeCloseTo(0)
  })

  test("the light reaches the land only as an icon", () => {
    const U = 900
    const icon = at(0)
    for (const ray of icon.raysOut) {
      const end = ray.points.at(-1)!
      expect(end.y).toBeCloseTo(EGOLENS.land * U)
      expect(Math.hypot(end.x, end.z)).toBeCloseTo(EGOLENS.pool * U)
    }
    for (const r of [-1, 1]) for (const ray of at(r).raysOut) expect(ray.points).toEqual([])
  })

  test("the rays meet the lens body, wherever it is turned", () => {
    for (const r of [0, -1]) {
      const ego = at(r)
      for (const ray of ego.raysIn) {
        const [star, hit] = ray.points as [{ x: number; y: number; z: number }, { x: number; y: number; z: number }]
        expect(star.y).toBeCloseTo(EGOLENS.star * 900)
        // Within the lens's reach of its centre: its rim, 2h.
        expect(Math.hypot(hit.x, hit.y - EGOLENS.lens * 900, hit.z)).toBeLessThanOrEqual(2 * EGOLENS.h * 900 + 1e-6)
      }
    }
  })

  test("deep, every ray is drawn into the eye", () => {
    const ego = at(1)
    for (const ray of ego.raysIn) {
      const end = ray.points.at(-1)!
      expect(end.x).toBeCloseTo(0)
      expect(end.z).toBeCloseTo(0)
      expect(end.y).toBeCloseTo(ego.eyeY())
    }
  })

  test("a petal is a closed, mirror-symmetric outline about its own plane", () => {
    const pts = petalOutline({ x: 0, y: 0, z: 0 }, 0, 10, 100, 25, 0.6, -0.3, 0.35)
    expect(pts[0]!.x).toBeCloseTo(pts.at(-1)!.x)
    // The bearing 0 lies in the x–y plane: the two edges mirror in z.
    const n = (pts.length + 1) / 2
    for (let i = 0; i < n; i++) expect(pts[i]!.z).toBeCloseTo(-pts[pts.length - 1 - i]!.z)
  })
})
