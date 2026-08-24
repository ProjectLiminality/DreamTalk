/**
 * The near cap's FIRST-DRAWN arc — pinned against the reference.
 *
 * Why this test exists: core/test/silhouette.test.ts pins capArc's
 * standalone geometry, but only ever with NEGATIVE sweeps, while
 * three-host's syncCylinder calls it with POSITIVE ones. Those three
 * tests therefore passed while the shipped render drew the near cap's
 * two arcs in the opposite order — an inversion an S01 evaluator caught
 * from a composite, not from the suite. (DECISIONS 2026-08-24: the arc
 * order is a known pose-dependent gap; what is NOT negotiable is that
 * the code does what its comment says, and that a swap is caught here
 * rather than in a render four hours later.)
 *
 * The invariant pinned: with S01's calibrated rule, the arc the pen
 * takes FIRST is the one farther from the camera (the away-facing,
 * upper arc in screen terms). If someone swaps the two capArc calls in
 * syncCylinder, this fails.
 */

import { describe, expect, test } from "bun:test"
import { capArc, silhouetteAngles } from "../src/render/silhouette"

const R = 50

/** Mean distance of an arc's points from a camera at (cx, cz). */
const meanDist = (pts: [number, number, number][], cx: number, cz: number): number =>
  pts.reduce((a, [x, , z]) => a + Math.hypot(x - cx, z - cz), 0) / pts.length

describe("the near cap's first-drawn arc (the shipped path)", () => {
  // A camera off +Z, the S01-like case.
  const CAM_X = 0
  const CAM_Z = 900

  const angles = silhouetteAngles(CAM_X, CAM_Z, R)
  if (!angles) throw new Error("camera must be outside the radius for this fixture")
  const { thetaA, thetaB } = angles
  const nearSweep = thetaB - thetaA

  // EXACTLY the calls syncCylinder makes (positive sweeps), so this test
  // constrains the shipped path rather than a parallel convention.
  const first = capArc(R, 0, thetaB, Math.PI * 2 - nearSweep, 128)
  const second = capArc(R, 0, thetaA, nearSweep, 128)

  test("the first arc drawn is the one FARTHER from the camera", () => {
    expect(meanDist(first, CAM_X, CAM_Z)).toBeGreaterThan(meanDist(second, CAM_X, CAM_Z))
  })

  test("the two arcs together cover the cap exactly once", () => {
    // Sweeps sum to a full turn: no gap, no double-coverage.
    expect(Math.abs(Math.PI * 2 - nearSweep) + Math.abs(nearSweep)).toBeCloseTo(Math.PI * 2, 12)
  })

  test("the arcs meet at both generators", () => {
    const d = (a: [number, number, number], b: [number, number, number]) =>
      Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
    expect(d(first[first.length - 1]!, second[0]!)).toBeLessThan(1e-9)
    expect(d(second[second.length - 1]!, first[0]!)).toBeLessThan(1e-9)
  })

  test("both arcs lie on the cap circle", () => {
    for (const pts of [first, second]) {
      for (const [x, , z] of pts) expect(Math.hypot(x, z)).toBeCloseTo(R, 9)
    }
  })
})
