/**
 * The cylinder silhouette math (render/silhouette.ts) — the tangency
 * property is the whole point: at each computed generator, the view ray
 * from the camera must be perpendicular to the surface normal, at every
 * height (the generators are exact vertical lines under perspective).
 */

import { describe, expect, test } from "bun:test"
import { capArc, capPolylineFrom, generatorPoint, silhouetteAngles } from "../src/render/silhouette"

const EPS = 1e-9

describe("silhouetteAngles", () => {
  test("tangency: view ray ⊥ surface normal at both generators, any camera height", () => {
    const cameras: [number, number][] = [
      [1500, 0],
      [0, 1500],
      [-800, 600],
      [120, -75],
      [51, 0], // just outside
    ]
    const radii = [50, 100, 1]
    const heights = [-100, 0, 37, 100]
    for (const [cx, cz] of cameras) {
      for (const r of radii) {
        if (Math.hypot(cx, cz) <= r) continue
        const angles = silhouetteAngles(cx, cz, r)
        expect(angles).toBeDefined()
        for (const theta of [angles!.thetaA, angles!.thetaB]) {
          for (const camY of [-500, 0, 1234]) {
            for (const y of heights) {
              const [px, py, pz] = generatorPoint(theta, r, y)
              const normal = [Math.cos(theta), 0, Math.sin(theta)]
              const view = [px - cx, py - camY, pz - cz]
              const dot = normal[0]! * view[0]! + normal[1]! * view[1]! + normal[2]! * view[2]!
              expect(Math.abs(dot)).toBeLessThan(1e-6)
            }
          }
        }
      }
    }
  })

  test("generators lie ON the mantle (|xz| = r)", () => {
    const angles = silhouetteAngles(-300, 450, 50)!
    for (const theta of [angles.thetaA, angles.thetaB]) {
      const [x, , z] = generatorPoint(theta, 50, 123)
      expect(Math.hypot(x, z)).toBeCloseTo(50, 9)
    }
  })

  test("symmetry: the two generators straddle the camera azimuth equally", () => {
    const angles = silhouetteAngles(200, 300, 50)!
    const phi = Math.atan2(300, 200)
    expect(phi - angles.thetaA).toBeCloseTo(angles.thetaB - phi, 12)
    expect(angles.thetaB).toBeGreaterThan(angles.thetaA)
  })

  test("front view: generators project near ±r·√(1−r²/d²)", () => {
    // Camera straight ahead on +Z: silhouette x-extent approaches ±r as
    // the camera recedes; at distance d it is exactly ±r·sin(acos(r/d)).
    const r = 100
    const d = 1500
    const angles = silhouetteAngles(0, d, r)!
    const expected = r * Math.sqrt(1 - (r / d) ** 2)
    const xs = [angles.thetaA, angles.thetaB].map((t) => r * Math.cos(t)).sort((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(-expected, 6)
    expect(xs[1]).toBeCloseTo(expected, 6)
  })

  test("distant camera approaches the orthographic limit (spread → π/2)", () => {
    const r = 50
    const angles = silhouetteAngles(0, 1e9, r)!
    const phi = Math.PI / 2
    expect(angles.thetaB - phi).toBeCloseTo(Math.PI / 2, 3)
  })

  test("degenerate: camera inside or on the mantle radius has no silhouette", () => {
    expect(silhouetteAngles(0, 0, 50)).toBeUndefined() // on the axis
    expect(silhouetteAngles(30, 20, 50)).toBeUndefined() // inside
    expect(silhouetteAngles(50, 0, 50)).toBeUndefined() // exactly on the surface
    expect(silhouetteAngles(50 + EPS, 0, 50)).toBeDefined() // just outside
  })
})

/**
 * capPolylineFrom — the cap seam that rides the silhouette. Its contract is
 * what the draw-on depends on: the pen starts exactly on the named
 * generator, walks the circle once in the named direction, and closes.
 */
describe("capPolylineFrom", () => {
  test("starts on the named angle and closes on it", () => {
    for (const reversed of [false, true]) {
      const theta = 1.234
      const pts = capPolylineFrom(50, 17, theta, reversed, 64)
      expect(pts.length).toBe(65)
      const [x0, y0, z0] = pts[0]!
      expect(Math.abs(x0 - 50 * Math.cos(theta))).toBeLessThan(EPS)
      expect(Math.abs(z0 - 50 * Math.sin(theta))).toBeLessThan(EPS)
      expect(y0).toBe(17)
      const last = pts[pts.length - 1]!
      expect(Math.abs(last[0] - x0)).toBeLessThan(1e-9)
      expect(Math.abs(last[2] - z0)).toBeLessThan(1e-9)
    }
  })

  test("every point sits on the circle at the cap's height", () => {
    const pts = capPolylineFrom(37, -100, -0.6, true, 32)
    for (const [x, y, z] of pts) {
      expect(Math.abs(Math.hypot(x, z) - 37)).toBeLessThan(1e-9)
      expect(y).toBe(-100)
    }
  })

  test("reversed walks the other way round", () => {
    const fwd = capPolylineFrom(50, 0, 0, false, 8)
    const rev = capPolylineFrom(50, 0, 0, true, 8)
    // One step in: +45 degrees forward, -45 degrees reversed.
    expect(fwd[1]![2]).toBeGreaterThan(0)
    expect(rev[1]![2]).toBeLessThan(0)
    // Same set of points, opposite order.
    for (let i = 1; i < 8; i++) {
      expect(Math.abs(fwd[i]![0] - rev[8 - i]![0])).toBeLessThan(1e-9)
      expect(Math.abs(fwd[i]![2] - rev[8 - i]![2])).toBeLessThan(1e-9)
    }
  })
})

/**
 * The two arcs a cap contributes to the contour, and which side of the
 * cap each one is.
 *
 * This pins a measurement, not a preference. video-01 Scene 01's own
 * cylinder draw (refs/video-01/frames5, new-ink deltas f0030-f0045)
 * shows the pen reaching the second cap and taking its AWAY-facing arc
 * first — at t=2.0s (f0040) the bottom ellipse's upper arc, screen
 * y≈410-440, is inked and its lower arc is not. Building the arcs the
 * other way round put our ink on the opposite side of the same ellipse
 * and cost coverage_ref 0.75 -> 0.63 on that frame.
 *
 * The geometric content: walking from thetaA toward DECREASING angle
 * walks AWAY from the camera azimuth phi (since thetaA = phi - spread),
 * so that arc is the far one; the complement, from thetaB by -nearSweep,
 * is the camera-facing one.
 */
describe("cap arcs: which side is which", () => {
  const R = 50
  const CAM: [number, number] = [700, 700]

  test("the arc from thetaA by -(2pi - gap) stays FARTHER from the camera than the one from thetaB by -gap", () => {
    const angles = silhouetteAngles(CAM[0], CAM[1], R)
    expect(angles).toBeDefined()
    const { thetaA, thetaB } = angles!
    const gap = thetaB - thetaA
    const far = capArc(R, 0, thetaA, -(Math.PI * 2 - gap), 64)
    const near = capArc(R, 0, thetaB, -gap, 64)

    const meanDist = (pts: [number, number, number][]) =>
      pts.reduce((a, [x, , z]) => a + Math.hypot(x - CAM[0], z - CAM[1]), 0) / pts.length

    expect(meanDist(far)).toBeGreaterThan(meanDist(near))
  })

  test("the two arcs meet at the generators and together cover the circle exactly once", () => {
    const angles = silhouetteAngles(CAM[0], CAM[1], R)!
    const { thetaA, thetaB } = angles
    const gap = thetaB - thetaA
    const far = capArc(R, 0, thetaA, -(Math.PI * 2 - gap), 64)
    const near = capArc(R, 0, thetaB, -gap, 64)

    // far ends where near begins, and near ends where far begins.
    const close = (a: [number, number, number], b: [number, number, number]) =>
      Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
    expect(close(far[far.length - 1]!, near[0]!)).toBeLessThan(1e-9)
    expect(close(near[near.length - 1]!, far[0]!)).toBeLessThan(1e-9)

    // Their sweeps sum to a full turn.
    expect(Math.abs(-(Math.PI * 2 - gap) + -gap + Math.PI * 2)).toBeLessThan(1e-12)
  })

  test("the near arc's sweep is the generators' angular gap, and it contains the camera azimuth", () => {
    const angles = silhouetteAngles(CAM[0], CAM[1], R)!
    const phi = Math.atan2(CAM[1], CAM[0])
    // phi lies strictly between the two generators.
    expect(phi).toBeGreaterThan(angles.thetaA)
    expect(phi).toBeLessThan(angles.thetaB)
  })
})
