/**
 * The ribbon stroke's WIDTH CONTRACT: `stroke = N` must deposit N pixels
 * of ink. This pins the property that a framework-wide 1.76x line-weight
 * error hid behind for ten scene builds.
 *
 * The shader's coverage is analytic, so the contract can be checked
 * without a GPU: reproduce the fragment stage's one line of arithmetic
 *
 *   coverage = 1 - smoothstep(hw - AA_PX, hw + AA_PX, d)
 *
 * over a stroke's cross-section and integrate. Coverage IS linear light
 * (the fragment returns it premultiplied on black), so the integral of
 * coverage across the profile is the ink width — the same area/peak
 * quantity measured on real renders. If someone changes AA_PX, the
 * half-width factor, or introduces a dpr term, this fails.
 *
 * Why this test and not an FWHM one: half-max width read off sRGB pixels
 * runs ~0.7px above the true width, and trusting it is precisely what
 * sent a previous investigation hunting a renderer bug that did not
 * exist. See the width contract on RibbonMaterial.
 */

import { describe, expect, test } from "bun:test"
import {
  STROKE_GRID,
  STROKE_MAIN,
  THICKNESS_GRID,
  THICKNESS_MAIN,
  strokePx,
} from "../demo/video01/palette"

/** AA band half-width — must track render/ribbon.ts's AA_PX. */
const AA_PX = 1.0

/** three's smoothstep, as TSL's node evaluates it. */
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * The fragment stage's coverage at distance `d` from the centerline of a
 * stroke of nominal width `widthPx` — ribbon.ts's `halfWidth()` and the
 * smoothstep that follows it, verbatim.
 */
const coverageAt = (widthPx: number, d: number): number => {
  const hw = widthPx * 0.5
  return 1 - smoothstep(hw - AA_PX, hw + AA_PX, Math.abs(d))
}

/**
 * Ink width: the integral of coverage across the whole profile. Fine
 * Riemann sum — the integrand is smooth and compactly supported.
 */
const inkWidth = (widthPx: number): number => {
  const limit = widthPx / 2 + AA_PX + 1
  const steps = 200000
  const dx = (2 * limit) / steps
  let sum = 0
  for (let i = 0; i < steps; i++) sum += coverageAt(widthPx, -limit + (i + 0.5) * dx)
  return sum * dx
}

describe("ribbon width contract", () => {
  test("stroke = N deposits N pixels of ink, across the useful range", () => {
    for (const n of [3, 4, 5, 5.142857, 6, 8, 12]) {
      expect(inkWidth(n)).toBeCloseTo(n, 6)
    }
  })

  test("the AA band is absorbed, not added: coverage is 0.5 at the nominal edge", () => {
    for (const n of [2, 3, 5, 9]) {
      expect(coverageAt(n, n / 2)).toBeCloseTo(0.5, 12)
    }
  })

  test("the profile is symmetric and reaches full brightness iff N > 2 * AA_PX", () => {
    expect(coverageAt(5, 0)).toBe(1)
    // A hairline thinner than the band never reaches full brightness — it
    // fades rather than thinning below the band width, which is correct:
    // it is what keeps a shrinking stroke from aliasing into dashes.
    expect(coverageAt(1.5, 0)).toBeLessThan(1)
    expect(coverageAt(1.5, 0)).toBeGreaterThan(0)
  })

  test("the identity is exact down to N = 2 * AA_PX, and no further", () => {
    // At and above the band width the two halves of the skirt cancel
    // exactly. This is the floor of the honest range.
    expect(inkWidth(2 * AA_PX)).toBeCloseTo(2 * AA_PX, 6)
  })

  test("sub-band hairlines floor out instead of vanishing", () => {
    // Below 2 * AA_PX the cancellation stops being exact — the inner half
    // of the skirt is clipped by the centerline while the outer half
    // still runs, so a hairline lays down slightly MORE ink than nominal
    // (0.5 -> 0.67) and cannot thin past the band. That is the wanted
    // behaviour: a stroke animating toward zero fades out smoothly
    // instead of aliasing into a dashed line. It is also why no video-01
    // width lives down here — the thinnest is the 1.85px grid.
    expect(inkWidth(0.5)).toBeGreaterThan(0.5)
    expect(inkWidth(0.5)).toBeLessThan(0.8)
    // Monotonic: thinner nominal still means less ink.
    expect(inkWidth(0.5)).toBeLessThan(inkWidth(1))
    expect(inkWidth(1)).toBeLessThan(inkWidth(1.5))
  })
})

/**
 * The other half of the contract: the caller's unit mapping. The renderer
 * was always exact; THIS is where the 1.76x lived, so these numbers are
 * pinned against measurements of refs/video-01/frames5 rather than
 * against the arithmetic that produced them.
 */
describe("video-01 stroke width mapping", () => {
  test("2021 thickness units map to the reference's measured ink width", () => {
    // Measured in linear light on refs/video-01/frames5 (1280x720):
    // main strokes 2.92px (S04 f0420, 370 isolated runs, p50), grid
    // lines ~1.85px (S01-era frames). Tolerance covers YouTube encode
    // softening and sub-pixel stroke placement.
    expect(STROKE_MAIN).toBeCloseTo(2.92, 0)
    expect(STROKE_GRID).toBeCloseTo(1.85, 1)
  })

  test("both S&T factors are present: base-height rescale AND distance attenuation", () => {
    // 5 * (720/700) * 0.6. Dropping either factor is the regression this
    // guards: without the 0.6 it is 5.14 (the ten-scene bug), without the
    // base-height rescale it is 3.00.
    expect(strokePx(THICKNESS_MAIN, 720)).toBeCloseTo(3.0857, 4)
    expect(strokePx(THICKNESS_GRID, 720)).toBeCloseTo(1.8514, 4)
    expect(strokePx(THICKNESS_MAIN, 720)).not.toBeCloseTo(5.142857, 3)
  })

  test("the mapping is linear in both thickness and frame height", () => {
    expect(strokePx(THICKNESS_MAIN, 1080)).toBeCloseTo(strokePx(THICKNESS_MAIN, 720) * 1.5, 9)
    expect(strokePx(10, 720)).toBeCloseTo(strokePx(5, 720) * 2, 9)
  })

  test("main:grid is 5:3 — true before and after the fix, so it proves nothing alone", () => {
    // Kept as documentation of the trap: this ratio (1.667) equals the
    // absolute error the fix removed (1/0.6 = 1.667), which is exactly
    // why a ratio check certified the broken mapping.
    expect(STROKE_MAIN / STROKE_GRID).toBeCloseTo(5 / 3, 9)
  })
})
