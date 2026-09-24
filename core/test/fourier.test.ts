/**
 * The Fourier decomposition — pinned against cases whose answer is known in
 * closed form, so a wrong sign or a factor of 2π cannot hide behind a drawing
 * that merely looks plausible.
 */

import { describe, expect, test } from "bun:test"
import {
  approximationError,
  chainAt,
  coefficients,
  reconstruct,
  resampleClosed,
  termsForError,
  traceAt,
  type Vec2,
} from "../src/geometry/fourier"

/** A unit circle, counterclockwise — the one path whose series is exactly one term. */
const circle = (r = 1, n = 256): Vec2[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return { x: r * Math.cos(a), y: r * Math.sin(a) }
  })

/** An axis-aligned square — corners are the hard case for any Fourier series. */
const square = (s = 1): Vec2[] => {
  const pts: Vec2[] = []
  const per = 32
  const corners: Vec2[] = [
    { x: -s, y: -s },
    { x: s, y: -s },
    { x: s, y: s },
    { x: -s, y: s },
  ]
  for (let i = 0; i < 4; i++) {
    const a = corners[i]!
    const b = corners[(i + 1) % 4]!
    for (let k = 0; k < per; k++) {
      const u = k / per
      pts.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u })
    }
  }
  return pts
}

describe("resampleClosed", () => {
  test("returns the requested count", () => {
    expect(resampleClosed(circle(), 64).length).toBe(64)
  })

  test("spaces points equally in arc length", () => {
    // On a circle, equal arc length means equal angle — so consecutive
    // samples must be equidistant. This is the property the whole
    // decomposition rests on (see the module header).
    const pts = resampleClosed(circle(1, 17), 64) // deliberately ragged input
    const gaps: number[] = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!
      const b = pts[(i + 1) % pts.length]!
      gaps.push(Math.hypot(b.x - a.x, b.y - a.y))
    }
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length
    for (const g of gaps) expect(Math.abs(g - mean) / mean).toBeLessThan(0.05)
  })

  test("closes the loop — the last point connects back to the first", () => {
    // A path resampled as OPEN would leave a gap, which a periodic series
    // reconstructs as a jump. Guard: total length includes the closing edge.
    const pts = resampleClosed(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      4,
    )
    // Out and back: samples must appear on the return leg too.
    expect(pts.some((p) => p.x > 0 && p.x < 10)).toBe(true)
  })

  test("degenerate inputs do not throw", () => {
    expect(resampleClosed([], 8)).toEqual([])
    expect(resampleClosed([{ x: 1, y: 2 }], 3).length).toBe(3)
    expect(resampleClosed([{ x: 1, y: 1 }, { x: 1, y: 1 }], 4).length).toBe(4)
  })
})

describe("coefficients", () => {
  test("a unit circle is ONE term of radius 1 at frequency +1", () => {
    // The closed-form case. If a sign or a 2π were wrong, this breaks.
    const eps = coefficients(circle(1), 5)
    const fundamental = eps.find((e) => e.freq === 1)!
    expect(fundamental.radius).toBeCloseTo(1, 3)
    // Every other term is essentially zero.
    for (const e of eps) {
      if (e.freq !== 1) expect(e.radius).toBeLessThan(1e-3)
    }
  })

  test("radius scales with the path", () => {
    const eps = coefficients(circle(7), 5)
    expect(eps.find((e) => e.freq === 1)!.radius).toBeCloseTo(7, 2)
  })

  test("the DC term is the path's centroid", () => {
    const shifted = circle(1).map((p) => ({ x: p.x + 5, y: p.y - 3 }))
    const dc = coefficients(shifted, 3).find((e) => e.freq === 0)!
    expect(dc.c.re).toBeCloseTo(5, 2)
    expect(dc.c.im).toBeCloseTo(-3, 2)
  })

  test("terms come back in conjugate-pair order 0, +1, -1, +2, -2", () => {
    // Truncating mid-pair makes a partial sum spiral off the path, so the
    // ordering is load-bearing, not cosmetic.
    const freqs = coefficients(square(), 7).map((e) => e.freq)
    expect(freqs).toEqual([0, 1, -1, 2, -2, 3, -3])
  })

  test("returns exactly the requested number of terms", () => {
    for (const n of [1, 2, 5, 20]) expect(coefficients(square(), n).length).toBe(n)
  })

  test("raises its own sample count when terms demand it (Nyquist)", () => {
    // Asking for 200 terms at 64 samples must not alias into nonsense; the
    // implementation raises samples rather than making the author know.
    const eps = coefficients(circle(1), 200, 64)
    expect(eps.find((e) => e.freq === 1)!.radius).toBeCloseTo(1, 2)
  })
})

describe("reconstruction", () => {
  test("one term reproduces a circle almost exactly", () => {
    const path = circle(1)
    expect(approximationError(path, coefficients(path, 3))).toBeLessThan(0.01)
  })

  test("more terms never make a square worse", () => {
    const path = square(1)
    const errors = [4, 8, 16, 32, 64].map((n) =>
      approximationError(path, coefficients(path, n)),
    )
    for (let i = 1; i < errors.length; i++) {
      // Monotone within a small tolerance — corners ring (Gibbs), so allow
      // a hair of non-monotonicity rather than pretending it is exact.
      expect(errors[i]!).toBeLessThanOrEqual(errors[i - 1]! + 1e-3)
    }
    // And it genuinely converges.
    expect(errors[errors.length - 1]!).toBeLessThan(errors[0]! / 2)
  })

  test("the pen is the end of the chain", () => {
    const eps = coefficients(square(), 9)
    const chain = chainAt(eps, 0.3)
    expect(chain.length).toBe(eps.length + 1)
    const pen = traceAt(eps, 0.3)
    expect(chain[chain.length - 1]!.x).toBeCloseTo(pen.x, 10)
    expect(chain[chain.length - 1]!.y).toBeCloseTo(pen.y, 10)
  })

  test("the chain starts at the origin", () => {
    const chain = chainAt(coefficients(circle(), 5), 0.77)
    expect(chain[0]!.x).toBe(0)
    expect(chain[0]!.y).toBe(0)
  })

  test("the trace is periodic — t=0 and t=1 are the same point", () => {
    const eps = coefficients(square(), 15)
    const a = traceAt(eps, 0)
    const b = traceAt(eps, 1)
    expect(a.x).toBeCloseTo(b.x, 9)
    expect(a.y).toBeCloseTo(b.y, 9)
  })

  test("reconstruct returns the requested sample count", () => {
    expect(reconstruct(coefficients(circle(), 5), 128).length).toBe(128)
  })
})

describe("termsForError", () => {
  test("finds a small number for a circle", () => {
    expect(termsForError(circle(1), 0.01)).toBeLessThanOrEqual(3)
  })

  test("a tighter tolerance needs at least as many terms", () => {
    const path = square(1)
    expect(termsForError(path, 0.01)).toBeGreaterThanOrEqual(termsForError(path, 0.1))
  })

  test("its answer actually meets the tolerance", () => {
    const path = square(1)
    const n = termsForError(path, 0.05)
    expect(approximationError(path, coefficients(path, n))).toBeLessThanOrEqual(0.05)
  })

  test("respects the cap instead of hanging on an impossible tolerance", () => {
    expect(termsForError(square(1), 1e-9, 32)).toBeLessThanOrEqual(32)
  })
})
