/**
 * MolochEye — the platonic derivations, pinned (wall-stack-study.md).
 * Every ratio here is recomputed from its own relation, never copied
 * from the implementation's constants.
 */

import { describe, expect, test } from "bun:test"
import {
  CAMERA_DISTANCE_RATIO,
  IRIS_FILL_RATIO,
  LENS_RADIUS_RATIO,
  MolochEye,
  perspectiveK,
} from "../vocabulary/MolochEye/MolochEye"
import { PI } from "../src/constants"

describe("the 3-4-5 lens", () => {
  test("R = 2.5h falls out of sin(half-span) = 4/5 and tips at ±2h", () => {
    // R·sin = 2h → R/h = 2 / (4/5) = 2.5 — the derivation, not the constant.
    expect(LENS_RADIUS_RATIO).toBeCloseTo(2 / (4 / 5), 12)
    const eye = new MolochEye({ height: 819 }) // the reference's own h in px
    expect(eye.lensTop.radius.value).toBeCloseTo(2.5 * 819, 9)
    expect(eye.lensBottom.radius.value).toBeCloseTo(2.5 * 819, 9)
    // centers at ∓(R − h) = ∓1.5h
    expect(eye.lensTop.y.value).toBeCloseTo(-1.5 * 819, 9)
    expect(eye.lensBottom.y.value).toBeCloseTo(1.5 * 819, 9)
  })

  test("arc endpoints land on the tips (±2h, 0) and the apexes (0, ±h)", () => {
    const h = 100
    const eye = new MolochEye({ height: h })
    const point = (arc: typeof eye.lensTop, angle: number): [number, number] => [
      arc.x.value + arc.radius.value * Math.cos(angle),
      arc.y.value + arc.radius.value * Math.sin(angle),
    ]
    // top arc: start = left tip, midpoint = apex, end = right tip
    const [sx, sy] = point(eye.lensTop, eye.lensTop.startAngle.value)
    const [ex, ey] = point(eye.lensTop, eye.lensTop.endAngle.value)
    const mid = (eye.lensTop.startAngle.value + eye.lensTop.endAngle.value) / 2
    const [ax, ay] = point(eye.lensTop, mid)
    expect(sx).toBeCloseTo(-2 * h, 9)
    expect(sy).toBeCloseTo(0, 9)
    expect(ex).toBeCloseTo(2 * h, 9)
    expect(ey).toBeCloseTo(0, 9)
    expect(ax).toBeCloseTo(0, 9)
    expect(ay).toBeCloseTo(h, 9)
    // bottom arc mirrors it
    const [bx, by] = point(
      eye.lensBottom,
      (eye.lensBottom.startAngle.value + eye.lensBottom.endAngle.value) / 2,
    )
    expect(bx).toBeCloseTo(0, 9)
    expect(by).toBeCloseTo(-h, 9)
    // each arc sweeps 2·asin(4/5) = 106.26°
    const sweep = Math.abs(eye.lensTop.endAngle.value - eye.lensTop.startAngle.value)
    expect(sweep).toBeCloseTo(2 * Math.asin(4 / 5), 12)
    expect((sweep * 180) / PI).toBeCloseTo(106.26, 2)
  })
})

describe("the iris", () => {
  test("the ring kisses the apexes: r = h identically", () => {
    const eye = new MolochEye({ height: 137 })
    // identity binding — the ring's radius IS the height param
    expect(eye.irisRing.radius.value).toBe(eye.height.value)
    expect(eye.irisRing.radius.value).toBe(137)
  })

  test("the black disk stops at the ring's inner stroke edge", () => {
    const eye = new MolochEye({ height: 100 })
    expect(eye.irisFill.filled.value).toBe(true)
    expect(eye.irisFill.radiusX.value).toBe(eye.irisFill.radiusY.value)
    expect(eye.irisFill.radiusX.value).toBeCloseTo(100 * IRIS_FILL_RATIO, 9)
    expect(IRIS_FILL_RATIO).toBeLessThan(1)
    expect(IRIS_FILL_RATIO).toBeGreaterThan(0.97)
  })
})

describe("the pupil cube's one-point perspective", () => {
  test("k derives from the camera distance: d/(d+L) at d = 1.282L", () => {
    // The derivation the study insists on: never hard-code 0.562.
    const k = CAMERA_DISTANCE_RATIO / (CAMERA_DISTANCE_RATIO + 1)
    expect(perspectiveK(CAMERA_DISTANCE_RATIO)).toBeCloseTo(k, 12)
    expect(k).toBeCloseTo(0.5618, 4)
  })

  test("back square = k · front square, in edge AND stroke", () => {
    const eye = new MolochEye({ height: 250, stroke: 5 })
    const k = CAMERA_DISTANCE_RATIO / (CAMERA_DISTANCE_RATIO + 1)
    expect(eye.pupilBack.size.value).toBeCloseTo(k * eye.pupilFront.size.value, 9)
    expect(eye.pupilBack.stroke.value).toBeCloseTo(k * eye.pupilFront.stroke.value, 9)
  })

  test("the four connectors run corner to corner at exactly 45°", () => {
    const eye = new MolochEye({ height: 100 })
    void eye.parts // compose()
    expect(eye.connectors.length).toBe(4)
    const k = CAMERA_DISTANCE_RATIO / (CAMERA_DISTANCE_RATIO + 1)
    const front = eye.pupilFront.size.value / 2
    for (const line of eye.connectors) {
      const [a, b] = line.points
      // 45°: |dx| = |dy|, and the ends sit on the two squares' corners
      expect(Math.abs(b!.x - a!.x)).toBeCloseTo(Math.abs(b!.y - a!.y), 9)
      expect(Math.abs(b!.x)).toBeCloseTo(front, 9)
      expect(Math.abs(a!.x)).toBeCloseTo(front * k, 9)
    }
  })

  test("the connectors' stroke is the mean of its perspective-true ends", () => {
    const eye = new MolochEye({ height: 100, stroke: 4 })
    void eye.parts
    const k = CAMERA_DISTANCE_RATIO / (CAMERA_DISTANCE_RATIO + 1)
    const front = eye.pupilFront.stroke.value
    const back = eye.pupilBack.stroke.value
    expect(eye.connectors[0]!.stroke.value).toBeCloseTo((front + back) / 2, 9)
    expect(back).toBeCloseTo(front * k, 9)
  })
})

describe("the whole", () => {
  test("sovereign, blue-gazed, and choreographed", () => {
    const eye = new MolochEye()
    expect(MolochEye.sovereign).toBe(true)
    expect(eye.tint.value).toEqual({ r: 0, g: 162 / 255, b: 255 / 255 })
    const anim = eye.createAnim()
    expect(anim.tracks.length).toBeGreaterThan(0)
    // one track per stroke of the construction plus the disk's fade:
    // 2 arcs + ring + back + front + 4 connectors + fill = 10 params
    const params = new Set(anim.tracks.map((t) => t.param))
    expect(params.size).toBe(10)
  })
})
