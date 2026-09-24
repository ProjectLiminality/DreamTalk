/**
 * The globe projection — pinned against cases whose answer is known by hand,
 * so a wrong axis, a dropped tilt, or a back-face that leaks onto the near face
 * cannot hide behind a drawing that merely looks round.
 */

import { describe, expect, test } from "bun:test"
import {
  clampedRing,
  frontArcs,
  projectLatLon,
  type Projected,
} from "../src/geometry/globe"

const R = 200

describe("projectLatLon", () => {
  test("lon = -spin, lat = 0 lands dead centre, facing the camera", () => {
    // The point whose spun longitude is 0 sits on +z: centre of the disc.
    const p = projectLatLon(30, 0, R, (-30 * Math.PI) / 180, 0)
    expect(p.x).toBeCloseTo(0, 6)
    expect(p.y).toBeCloseTo(0, 6)
    expect(p.z).toBeCloseTo(1, 6) // fully near-face
  })

  test("the equator at spin longitude 90 sits on the limb, edge-on", () => {
    // lon 90 (no spin) → x = +R, z = 0: the right edge, neither near nor far.
    const p = projectLatLon(90, 0, R, 0, 0)
    expect(p.x).toBeCloseTo(R, 6)
    expect(p.y).toBeCloseTo(0, 6)
    expect(p.z).toBeCloseTo(0, 6)
  })

  test("the north pole lands on the y axis, leaned by tilt", () => {
    // With no tilt the pole is at (0, R) and edge-on (z = 0).
    const flat = projectLatLon(0, 90, R, 0, 0)
    expect(flat.x).toBeCloseTo(0, 6)
    expect(flat.y).toBeCloseTo(R, 6)
    expect(flat.z).toBeCloseTo(0, 6)
    // Tilting the pole toward the camera drops its screen y and lifts its z.
    const tilt = 0.3
    const leaned = projectLatLon(0, 90, R, 0, tilt)
    expect(leaned.x).toBeCloseTo(0, 6)
    expect(leaned.y).toBeCloseTo(R * Math.cos(tilt), 6)
    expect(leaned.z).toBeCloseTo(Math.sin(tilt), 6) // now on the near face
  })

  test("the far meridian is on the far face (z < 0)", () => {
    const p = projectLatLon(180, 0, R, 0, 0)
    expect(p.z).toBeLessThan(0)
    expect(p.x).toBeCloseTo(0, 6)
  })

  test("every projected point stays within the disc", () => {
    for (let lon = -180; lon <= 180; lon += 17) {
      for (let lat = -90; lat <= 90; lat += 13) {
        const p = projectLatLon(lon, lat, R, 0.7, 0.2)
        expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(R + 1e-6)
      }
    }
  })
})

describe("rotation is pure", () => {
  const ring = [0, 0, 40, 20, 80, -10, 20, -40] // an arbitrary lon/lat loop

  test("the same spin yields identical geometry", () => {
    const a = clampedRing(ring, R, 1.2, 0.15)
    const b = clampedRing(ring, R, 1.2, 0.15)
    expect(a).toEqual(b)
  })

  test("a full turn (2π) returns the same projection", () => {
    const a = clampedRing(ring, R, 0.5, 0.15)
    const b = clampedRing(ring, R, 0.5 + Math.PI * 2, 0.15)
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.x).toBeCloseTo(b[i]!.x, 4)
      expect(a[i]!.y).toBeCloseTo(b[i]!.y, 4)
    }
  })

  test("a different spin moves the geometry", () => {
    const a = clampedRing(ring, R, 0, 0.15)
    const b = clampedRing(ring, R, 0.6, 0.15)
    const moved = a.some((p, i) => Math.hypot(p.x - b[i]!.x, p.y - b[i]!.y) > 1)
    expect(moved).toBe(true)
  })
})

describe("clampedRing keeps the loop usable for a fill", () => {
  // A ring that straddles the limb: some near, some far.
  const ring = [0, 0, 120, 30, 200, 0, 120, -30]

  test("no clamped point escapes the disc", () => {
    const pts = clampedRing(ring, R, 0, 0.1)
    for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(R + 1e-4)
  })

  test("a wholly near-face ring is untouched by the clamp", () => {
    const near = [0, 0, 20, 10, -20, 10, -20, -10]
    const clamped = clampedRing(near, R, 0, 0)
    for (let i = 0; i < near.length; i += 2) {
      const direct = projectLatLon(near[i]!, near[i + 1]!, R, 0, 0)
      expect(clamped[i / 2]!.x).toBeCloseTo(direct.x, 6)
      expect(clamped[i / 2]!.y).toBeCloseTo(direct.y, 6)
    }
  })

  test("a back-face point is pushed out to the limb", () => {
    // lon 180 is on the far face; its clamp must land on the circle.
    const back = [180, 0, 170, 5, 190, -5]
    const pts = clampedRing(back, R, 0, 0)
    // the first vertex (lon 180, on the far face) is clamped to radius R.
    expect(Math.hypot(pts[0]!.x, pts[0]!.y)).toBeCloseTo(R, 3)
  })
})

describe("frontArcs drops the far face", () => {
  test("a ring entirely on the near face is one arc of near-face points", () => {
    const near = [0, 0, 20, 20, -20, 20, -20, -20, 20, -20]
    const arcs = frontArcs(near, R, 0, 0)
    expect(arcs.length).toBe(1)
    // Every point projects to a location matching a near-face source point or
    // lies within the disc (no far-face leakage).
    for (const p of arcs[0]!) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(R + 1e-4)
  })

  test("a ring wholly on the far face yields no arcs", () => {
    const far = [180, 0, 170, 10, 190, 10, 185, -10]
    expect(frontArcs(far, R, 0, 0)).toEqual([])
  })

  test("a straddling ring's clipped ends land on the limb", () => {
    // A ring whose seam (its first vertex) is on the FAR face, so the arc has
    // real clipped endpoints rather than a seam-merged near-face vertex.
    const ring = [180, 0, 60, 20, 60, -20]
    const arcs = frontArcs(ring, R, 0, 0)
    expect(arcs.length).toBeGreaterThanOrEqual(1)
    for (const arc of arcs) {
      // No point escapes the disc, and the clipped ends ride the silhouette.
      for (const p of arc) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(R + 1e-4)
      expect(Math.hypot(arc[0]!.x, arc[0]!.y)).toBeCloseTo(R, 2)
      expect(Math.hypot(arc[arc.length - 1]!.x, arc[arc.length - 1]!.y)).toBeCloseTo(R, 2)
    }
  })
})

// A hand check that the projection sees the expected hemisphere: at spin 0 the
// prime meridian faces us, so a point near lon 0 is near-face and its antipode
// is far-face — the property the demo's Africa/Europe hero face relies on.
test("spin 0 faces the prime meridian", () => {
  const front: Projected = projectLatLon(10, 20, R, 0, 0.1)
  const back: Projected = projectLatLon(190, 20, R, 0, 0.1)
  expect(front.z).toBeGreaterThan(0)
  expect(back.z).toBeLessThan(0)
})
