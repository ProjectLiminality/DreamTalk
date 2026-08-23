/**
 * The cylinder–plane section math (geometry/section.ts). The defining
 * properties: every returned point lies ON the cutting plane, and ON
 * the cylinder's closed surface — mantle (|xz| = r) or a cap
 * (|y| = h/2, |xz| ≤ r). Cap clipping must hit the height bounds
 * exactly, and the kinds must match what Scenes 03/06 need: circle,
 * rectangle, ellipse, truncated ellipse.
 */

import { describe, expect, test } from "bun:test"
import { cylinderPlaneSection, type Vec3 } from "../src/geometry/section"
import { catmullRom, trimByArcLength, SectionCurve, SectionPlane, Connection } from "../src/parts/curves"
import { Circle, Line, Null, type Vec3Like } from "../src/parts/index"
import { PI } from "../src/constants"

const R = 50
const H = 200
const HALF = H / 2

const norm = (v: Vec3): Vec3 => {
  const m = Math.hypot(v.x, v.y, v.z)
  return { x: v.x / m, y: v.y / m, z: v.z / m }
}

/** Distance from the plane through p0 with (unnormalized) normal n. */
const planeDist = (p: Vec3, p0: Vec3, n: Vec3): number => {
  const u = norm(n)
  return u.x * (p.x - p0.x) + u.y * (p.y - p0.y) + u.z * (p.z - p0.z)
}

/** On the closed cylinder surface: mantle, or a cap within radius. */
const onSurface = (p: Vec3): boolean => {
  const rad = Math.hypot(p.x, p.z)
  if (Math.abs(rad - R) < 1e-6) return Math.abs(p.y) <= HALF + 1e-6
  return Math.abs(Math.abs(p.y) - HALF) < 1e-6 && rad <= R + 1e-6
}

/** Tilted plane: normal at angle `tilt` from the axis, azimuth `spin`. */
const tiltedNormal = (tilt: number, spin = 0): Vec3 => ({
  x: Math.sin(tilt) * Math.cos(spin),
  y: Math.cos(tilt),
  z: Math.sin(tilt) * Math.sin(spin),
})

describe("cylinderPlaneSection", () => {
  test("on-plane and on-surface across a sweep of tilts, spins and offsets", () => {
    for (const tilt of [0.01, Math.PI / 6, Math.PI / 4, Math.PI / 3, 1.4, Math.PI / 2 - 0.01]) {
      for (const spin of [0, 1.1, 2.7, -0.6]) {
        for (const off of [0, 10, -25]) {
          const n = tiltedNormal(tilt, spin)
          const p0: Vec3 = { x: n.x * off, y: n.y * off, z: n.z * off }
          const section = cylinderPlaneSection(R, H, p0, n)
          expect(section.points.length).toBeGreaterThan(0)
          for (const p of section.points) {
            expect(Math.abs(planeDist(p, p0, n))).toBeLessThan(1e-6)
            expect(onSurface(p)).toBe(true)
          }
        }
      }
    }
  })

  test("plane ⊥ axis: a circle at the plane height; empty beyond the caps", () => {
    const n: Vec3 = { x: 0, y: 1, z: 0 }
    const section = cylinderPlaneSection(R, H, { x: 0, y: 30, z: 0 }, n)
    expect(section.kind).toBe("circle")
    expect(section.closed).toBe(true)
    for (const p of section.points) {
      expect(p.y).toBeCloseTo(30, 9)
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(R, 9)
    }
    expect(cylinderPlaneSection(R, H, { x: 0, y: HALF + 1, z: 0 }, n).kind).toBe("empty")
    // Downward normal describes the same unoriented plane.
    const flipped = cylinderPlaneSection(R, H, { x: 0, y: 30, z: 0 }, { x: 0, y: -1, z: 0 })
    expect(flipped.kind).toBe("circle")
    expect(flipped.points[0]!.y).toBeCloseTo(30, 9)
  })

  test("plane ∥ axis: the S06 rectangle — generators + cap chords", () => {
    // Through the axis: chord width is the full diameter.
    const through = cylinderPlaneSection(R, H, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })
    expect(through.kind).toBe("rectangle")
    expect(through.closed).toBe(true)
    expect(through.points.length).toBe(5)
    const width = Math.hypot(
      through.points[1]!.x - through.points[2]!.x,
      through.points[1]!.z - through.points[2]!.z,
    )
    expect(width).toBeCloseTo(2 * R, 6)
    const ys = through.points.map((p) => p.y)
    expect(Math.min(...ys)).toBeCloseTo(-HALF, 9)
    expect(Math.max(...ys)).toBeCloseTo(HALF, 9)

    // Offset plane (S06's z=1 flavor): chord narrows to 2·√(r²−d²).
    const d = 30
    const offset = cylinderPlaneSection(R, H, { x: d, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })
    expect(offset.kind).toBe("rectangle")
    for (const p of offset.points) expect(p.x).toBeCloseTo(d, 6)
    const chord = Math.hypot(
      offset.points[1]!.x - offset.points[2]!.x,
      offset.points[1]!.z - offset.points[2]!.z,
    )
    expect(chord).toBeCloseTo(2 * Math.sqrt(R * R - d * d), 6)

    // Tangent → a single generator line; beyond → empty.
    expect(cylinderPlaneSection(R, H, { x: R, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }).kind).toBe("line")
    expect(cylinderPlaneSection(R, H, { x: R + 1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }).kind).toBe(
      "empty",
    )
  })

  test("moderate tilt: the S03 full ellipse, semi-axes r and r/cos(tilt)", () => {
    const tilt = Math.PI / 4 // y-extent r·tan(tilt) = 50 < 100 → untruncated
    const section = cylinderPlaneSection(R, H, { x: 0, y: 0, z: 0 }, tiltedNormal(tilt))
    expect(section.kind).toBe("ellipse")
    expect(section.closed).toBe(true)
    const first = section.points[0]!
    const last = section.points[section.points.length - 1]!
    expect(Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z)).toBeLessThan(1e-9)
    const dists = section.points.map((p) => Math.hypot(p.x, p.y, p.z))
    expect(Math.max(...dists)).toBeCloseTo(R / Math.cos(tilt), 4)
    expect(Math.min(...dists)).toBeCloseTo(R, 4)
    // Wholly on the mantle — never touches the caps.
    for (const p of section.points) expect(Math.hypot(p.x, p.z)).toBeCloseTo(R, 9)
  })

  test("steep tilt: truncated by both caps, boundaries exactly at ±h/2", () => {
    const tilt = 1.4 // r·tan(1.4) ≈ 290 > 100 → clipped top and bottom
    const section = cylinderPlaneSection(R, H, { x: 0, y: 0, z: 0 }, tiltedNormal(tilt))
    expect(section.kind).toBe("truncated")
    expect(section.closed).toBe(true)
    const ys = section.points.map((p) => p.y)
    expect(Math.max(...ys)).toBeCloseTo(HALF, 9)
    expect(Math.min(...ys)).toBeCloseTo(-HALF, 9)
    for (const y of ys) expect(Math.abs(y)).toBeLessThanOrEqual(HALF + 1e-9)
    // Cap-chord endpoints sit on the cap RIM (mantle ∩ cap).
    for (const p of section.points) {
      if (Math.abs(Math.abs(p.y) - HALF) < 1e-9) {
        expect(Math.hypot(p.x, p.z)).toBeCloseTo(R, 6)
      }
    }
    // Closed: first point repeated last.
    const first = section.points[0]!
    const last = section.points[section.points.length - 1]!
    expect(Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z)).toBeLessThan(1e-9)
  })

  test("offset steep tilt: clipped by one cap only", () => {
    // Push the plane up so only the top cap clips.
    const tilt = 1.1 // y-extent ±r·tan ≈ ±98 — offset lifts it past +100 only
    const n = tiltedNormal(tilt)
    const off = 30
    const p0: Vec3 = { x: n.x * off, y: n.y * off, z: n.z * off }
    const section = cylinderPlaneSection(R, H, p0, n)
    expect(section.kind).toBe("truncated")
    const ys = section.points.map((p) => p.y)
    expect(Math.max(...ys)).toBeCloseTo(HALF, 9)
    expect(Math.min(...ys)).toBeGreaterThan(-HALF) // bottom cap untouched
  })

  test("no consecutive duplicate points, and no jumps larger than a chord bound", () => {
    for (const tilt of [Math.PI / 4, 1.4]) {
      const section = cylinderPlaneSection(R, H, { x: 0, y: 0, z: 0 }, tiltedNormal(tilt, 0.8))
      for (let i = 1; i < section.points.length; i++) {
        const a = section.points[i - 1]!
        const b = section.points[i]!
        const step = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
        expect(step).toBeGreaterThan(1e-9)
        expect(step).toBeLessThan(2 * R + 1e-6) // never longer than the diameter
      }
    }
  })

  test("degenerate inputs are empty", () => {
    const n: Vec3 = { x: 0, y: 1, z: 0 }
    expect(cylinderPlaneSection(0, H, { x: 0, y: 0, z: 0 }, n).kind).toBe("empty")
    expect(cylinderPlaneSection(R, 0, { x: 0, y: 0, z: 0 }, n).kind).toBe("empty")
    expect(cylinderPlaneSection(R, H, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }).kind).toBe(
      "empty",
    )
  })
})

describe("connection curve helpers", () => {
  test("catmullRom passes through every anchor, in order", () => {
    const anchors = [
      { x: 100, y: -50, z: 0 },
      { x: 20, y: -50, z: 0 },
      { x: 0, y: -30, z: 0 },
      { x: 0, y: 100, z: 0 },
    ]
    const pts = catmullRom(anchors, 24)
    expect(pts.length).toBe(3 * 24 + 1)
    for (const a of anchors) {
      const nearest = Math.min(...pts.map((p) => Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z)))
      expect(nearest).toBeLessThan(1e-9)
    }
    expect(pts[0]).toEqual(anchors[0]!)
    expect(pts[pts.length - 1]).toEqual(anchors[anchors.length - 1]!)
  })

  test("trimByArcLength cuts the S&T stroke-offset window", () => {
    const line = [
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 0, z: 0 },
    ]
    const trimmed = trimByArcLength(line, 0.15, 0.2)
    expect(trimmed[0]!.x).toBeCloseTo(15, 9)
    expect(trimmed[trimmed.length - 1]!.x).toBeCloseTo(80, 9)
    // Degenerate window collapses to nothing.
    expect(trimByArcLength(line, 0.6, 0.6)).toEqual([])
    // No trim returns the full polyline endpoints.
    const full = trimByArcLength(line, 0, 0)
    expect(full[0]!.x).toBeCloseTo(0, 9)
    expect(full[full.length - 1]!.x).toBeCloseTo(100, 9)
  })

  test("trim measures ARC length, not index", () => {
    // Uneven segment lengths: 0→10→100.
    const line = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 100, y: 0, z: 0 },
    ]
    const trimmed = trimByArcLength(line, 0.5, 0)
    expect(trimmed[0]!.x).toBeCloseTo(50, 9)
  })
})

/**
 * The derived-curve parts. The property that matters to the renderer:
 * reading `line.points` ALWAYS reflects the current parameters — the
 * host's dirty-check reads that array and nothing else, so a stale read
 * is a frame of visibly wrong geometry (which is exactly the bug a
 * push-based `refresh()` produced before these curves learned to pull).
 */
describe("derived curve parts", () => {
  const pointsOf = (holon: { parts: readonly unknown[] }): Vec3Like[] =>
    (holon.parts[0] as { points: Vec3Like[] }).points

  test("SectionCurve emits its section as the Line's points", () => {
    const sc = new SectionCurve({ radius: R, height: H, tilt: PI / 4 })
    expect(sc.parts.length).toBe(1)
    const pts = pointsOf(sc)
    expect(sc.section!.kind).toBe("ellipse")
    expect(pts.length).toBeGreaterThan(2)
    for (const p of pts) expect(Math.hypot(p.x, p.z)).toBeCloseTo(R, 6)
  })

  test("SectionCurve points track param changes on the NEXT read — no staleness", () => {
    const sc = new SectionCurve({ radius: R, height: H, tilt: PI / 4 })
    expect(pointsOf(sc).length).toBeGreaterThan(0)
    expect(sc.section!.kind).toBe("ellipse")

    // Flatten to cap-parallel: the very next read must already be the circle.
    sc.tilt.value = 0
    const flat = pointsOf(sc)
    expect(sc.section!.kind).toBe("circle")
    for (const p of flat) expect(p.y).toBeCloseTo(0, 6)

    // Steepen past the caps: truncated, clamped to the height bounds.
    sc.tilt.value = 1.4
    const steep = pointsOf(sc)
    expect(sc.section!.kind).toBe("truncated")
    expect(Math.max(...steep.map((p) => p.y))).toBeCloseTo(HALF, 6)

    // Offset slides the plane along its own normal.
    sc.tilt.value = PI / 4
    sc.offset.value = 40
    const shifted = pointsOf(sc)
    const n = tiltedNormal(PI / 4)
    const p0: Vec3 = { x: n.x * 40, y: n.y * 40, z: n.z * 40 }
    for (const p of shifted) expect(Math.abs(planeDist(p, p0, n))).toBeLessThan(1e-6)
  })

  /**
   * planeFrame "parent" is Scene 06's construction: the Plane stands still
   * in the scene and the CYLINDER turns through it, so the cut is stated in
   * the parent frame and the holon's own pose is undone before the section
   * is computed. One animated parameter (`p`) must then walk the whole
   * family of shapes — that is the scene's entire argument, so it is the
   * property worth pinning.
   */
  test("SectionCurve planeFrame 'parent': a fixed plane, a turning cylinder", () => {
    // S06's plane: normal (0, -1, 0) in the parent frame, through the origin.
    const sc = new SectionCurve({
      planeFrame: "parent",
      radius: R,
      height: H,
      tilt: PI,
      spin: 0,
      offset: 0,
      p: PI / 2,
    })
    // Axis lying IN the plane → the lengthwise cut, S06's red rectangle.
    const lengthwise = pointsOf(sc)
    expect(sc.section!.kind).toBe("rectangle")
    expect(Math.max(...lengthwise.map((q) => Math.abs(q.y)))).toBeCloseTo(HALF, 6)

    // A quarter turn on: the axis now stands normal to the plane → circle.
    sc.p.value = PI
    const round = pointsOf(sc)
    expect(sc.section!.kind).toBe("circle")
    for (const q of round) expect(Math.hypot(q.x, q.z)).toBeCloseTo(R, 6)

    // Half a turn from the start: back to the rectangle, the other way up.
    sc.p.value = (3 * PI) / 2
    void pointsOf(sc)
    expect(sc.section!.kind).toBe("rectangle")

    // In between: an ellipse, and every point still on the mantle.
    sc.p.value = PI * 0.75
    const oval = pointsOf(sc)
    expect(sc.section!.kind).toBe("ellipse")
    for (const q of oval) expect(Math.hypot(q.x, q.z)).toBeCloseTo(R, 6)
  })

  test("SectionCurve planeFrame 'local' ignores the holon's own pose", () => {
    const sc = new SectionCurve({ radius: R, height: H, tilt: 0, p: 0 })
    const flat = pointsOf(sc).map((q) => q.y)
    sc.p.value = PI / 3
    // Local framing: the cut is stated relative to the cylinder, so turning
    // the cylinder carries the cut with it — the local polyline is unchanged.
    expect(pointsOf(sc).map((q) => q.y)).toEqual(flat)
  })

  test("SectionCurve memoizes: unchanged params return the same array identity", () => {
    const sc = new SectionCurve({ radius: R, height: H, tilt: PI / 4 })
    const a = pointsOf(sc)
    expect(pointsOf(sc)).toBe(a) // no recompute, no churn for the dirty-check
    sc.spin.value = 0.7
    expect(pointsOf(sc)).not.toBe(a)
  })

  test("Connection traces source → waypoints → target, trimmed off both ends", () => {
    const source = new Circle({ x: -200, y: 0 })
    const target = new Circle({ x: 200, y: 0 })
    const conn = new Connection(source, target, {
      via: [{ x: 0, y: 120, z: 0 }],
      offsetStart: 0.15,
      offsetEnd: 0.2,
    })
    const pts = pointsOf(conn)
    expect(pts.length).toBeGreaterThan(2)
    // Trimmed: neither end reaches its anchor any more.
    expect(pts[0]!.x).toBeGreaterThan(-200)
    expect(pts[pts.length - 1]!.x).toBeLessThan(200)
    // The trim is 15% / 20% of arc length — measure it against the untrimmed trace.
    const full = catmullRom([
      { x: -200, y: 0, z: 0 },
      { x: 0, y: 120, z: 0 },
      { x: 200, y: 0, z: 0 },
    ])
    const arc = (line: readonly Vec3Like[]): number => {
      let s = 0
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1]!
        const b = line[i]!
        s += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
      }
      return s
    }
    expect(arc(pts) / arc(full)).toBeCloseTo(0.65, 2)
    // It passes through the waypoint (an INTERPOLATING spline, like the
    // C4D Tracer in bezier mode — not a control-point bezier).
    const nearest = Math.min(...pts.map((p) => Math.hypot(p.x - 0, p.y - 120, p.z - 0)))
    expect(nearest).toBeLessThan(1e-6)
  })

  test("Connection is LIVE: moving an anchor moves the arrow", () => {
    const source = new Circle({ x: -200, y: 0 })
    const target = new Circle({ x: 200, y: 0 })
    const conn = new Connection(source, target, { offsetStart: 0, offsetEnd: 0 })
    const before = pointsOf(conn)
    expect(before[before.length - 1]!.x).toBeCloseTo(200, 6)

    target.x.value = 500
    const after = pointsOf(conn)
    expect(after[after.length - 1]!.x).toBeCloseTo(500, 6)
  })

  test("Connection reads anchors in WORLD space, through parent transforms", () => {
    // A target parented under a moved, scaled group: its world position is
    // the parent transform applied to its local one. A Holon field IS the
    // parenting mechanism (the field scan adopts it).
    class Grouped extends Null {
      target = new Circle({ x: 30, y: 0 })
    }
    const group = new Grouped({ x: 100, y: 50, scale: 2 })
    const target = group.target
    void group.parts // run the field scan, so `target.parent` is wired
    const source = new Circle({ x: -200, y: 0 })
    const conn = new Connection(source, target, { offsetStart: 0, offsetEnd: 0 })
    const pts = pointsOf(conn)
    const end = pts[pts.length - 1]!
    expect(end.x).toBeCloseTo(100 + 30 * 2, 6)
    expect(end.y).toBeCloseTo(50, 6)
  })

  test("Connection carries the S10 arrowhead at its end", () => {
    const conn = new Connection(new Circle({ x: -100 }), new Circle({ x: 100 }))
    const line = conn.parts[0] as Line
    expect(line.arrowEnd.value).toBe(true)
    expect(line.arrowStart.value).toBe(false)
  })
})

/**
 * SectionPlane — the 2021 `Plane(b=PI/2, b_frozen=PI/4, x=…)` of Scene03,
 * whose sweep is the whole family of cuts in one animation. The frozen
 * bank is the load-bearing part: it frames the plane's POSITION as well
 * as its orientation, which is what makes the cut pass through the
 * cylinder's own axis at the half-turn.
 */
describe("SectionPlane", () => {
  /** The Scene03 plane at a given point in its sweep. */
  const s03Plane = (h: number, x: number): SectionPlane => {
    const plane = new SectionPlane({ b: PI / 2, frozenB: PI / 4, x })
    plane.h.value = h
    return plane
  }

  test("the frozen bank puts the plane on the diagonal, not the axis", () => {
    const p = s03Plane(0, 100)
    expect(p.origin.x).toBeCloseTo(100 / Math.SQRT2, 6)
    expect(p.origin.z).toBeCloseTo(-100 / Math.SQRT2, 6)
    expect(p.origin.y).toBeCloseTo(0, 12)
  })

  test("heading turns the normal from axis-parallel to axis-perpendicular", () => {
    // h = 0: normal has no y component — the cut is parallel to the axis.
    expect(Math.abs(s03Plane(0, 1).normal.y)).toBeCloseTo(0, 6)
    // h = PI/2: normal IS the axis — the cut is a flat circle.
    expect(Math.abs(s03Plane(PI / 2, 1).normal.y)).toBeCloseTo(1, 6)
    // h = PI: back to axis-parallel, mirrored.
    expect(Math.abs(s03Plane(PI, 1).normal.y)).toBeCloseTo(0, 6)
  })

  test("the S03 sweep's half-turn cuts through the cylinder's axis", () => {
    // At h = PI the plane's travel has reached x = 150/sqrt2 (the source
    // moves it 1 -> 201 while it turns 0 -> 2PI), and the cut is the
    // two-generator case straight through the axis of the cylinder at
    // x = 150 — the reading refs/video-01/frames5/f0391 pins.
    const p = s03Plane(PI, 150 / Math.SQRT2)
    const n = p.normal
    const o = p.origin
    const d = n.x * (o.x - 150) + n.y * o.y + n.z * o.z
    expect(d).toBeCloseTo(0, 6)
  })

  test("a SectionCurve cut by a plane matches the same plane stated by hand", () => {
    const plane = s03Plane(2.2, 90)
    const curve = new SectionCurve({ radius: R, height: H, x: 150 }).cutBy(plane)
    const pts = curve.refresh()
    expect(pts.length).toBeGreaterThan(2)
    const n = plane.normal
    const o = plane.origin
    for (const p of pts) {
      expect(planeDist(p, { x: o.x - 150, y: o.y, z: o.z }, n)).toBeCloseTo(0, 6)
    }
  })
})
