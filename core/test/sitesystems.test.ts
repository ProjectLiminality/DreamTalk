import { describe, expect, test } from "bun:test"
import { flight, linkStart, onRing, ringAngles, tierDrift } from "../vocabulary/SiteSystems/SiteSystems"

describe("SiteSystems layout", () => {
  test("ring angles: equal spacing, mirror-symmetric, never directly behind", () => {
    for (let n = 1; n <= 8; n++) {
      const a = ringAngles(n)
      expect(a.length).toBe(n)
      for (let k = 1; k < n; k++) expect(a[k]! - a[k - 1]!).toBeCloseTo((2 * Math.PI) / n)
      // Nothing at the back (angle π from the front), where the ERP would hide it.
      for (const x of a) expect(Math.abs(Math.cos(x) + 1)).toBeGreaterThan(1e-6)
      // Mirror-symmetric about the view axis: every x has its −x.
      const xs = a.map((x) => onRing(x, 1).x).sort((p, q) => p - q)
      xs.forEach((x, i) => expect(x + xs[n - 1 - i]!).toBeCloseTo(0))
    }
    expect(ringAngles(4).map((x) => (x * 180) / Math.PI)).toEqual([45, 135, 225, 315])
    expect(ringAngles(6)[0]! * (180 / Math.PI)).toBeCloseTo(30)
  })

  test("tier drift: the foundation stays on the standard, the rest step off it", () => {
    expect(tierDrift(0, 3, 40)).toEqual([0, 0, 0])
    expect(tierDrift(0.5, 3, 40)).toEqual([0, 20, 40])
    expect(tierDrift(2, 3, 40)).toEqual([0, 40, 80]) // departure clamps to 1
  })

  test("hand-off lines start clear of the drifted stack and the same for all", () => {
    expect(linkStart(360, 0)).toBeCloseTo(216)
    expect(linkStart(100, 80)).toBeGreaterThan(80)
  })

  test("flight: staggered, monotone, all home at 1", () => {
    const n = 5
    for (let k = 0; k < n; k++) {
      expect(flight(k, n, 0)).toBe(0)
      expect(flight(k, n, 1)).toBe(1)
      let prev = 0
      for (let t = 0; t <= 1; t += 0.05) {
        const f = flight(k, n, t)
        expect(f).toBeGreaterThanOrEqual(prev - 1e-12)
        prev = f
      }
    }
    expect(flight(0, n, 0.3)).toBeGreaterThan(flight(n - 1, n, 0.3))
  })
})
