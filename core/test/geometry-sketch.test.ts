/**
 * GeometrySketch (vocabulary/GeometrySketch, geometry/angles.ts) — a
 * shape's sharp angles found and annotated: the right-angle square where
 * it is 90°, an arc across every other corner, on the interior side, in
 * 3D, following the shape live.
 */

import { describe, expect, test } from "bun:test"
import { angleMark, cornersOf, MARK_ROOM, type Vec3Like } from "../src/geometry/angles"
import "../vocabulary/GeometrySketch/GeometrySketch"
import { GeometrySketch, isSketchable } from "../vocabulary/GeometrySketch/GeometrySketch"
import {
  AnnularSector,
  Circle,
  Line,
  Polygon,
  Rectangle,
  Square,
} from "../src/parts/primitives"
import { outlineOf } from "../src/geometry/morph"

const P = (x: number, y: number, z = 0): Vec3Like => ({ x, y, z })
const close = (pts: Vec3Like[]): Vec3Like[] => [...pts, pts[0]!]
const deg = (r: number): number => (r * 180) / Math.PI
const dist = (a: Vec3Like, b: Vec3Like): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

describe("cornersOf — which vertices are angles, and which side is inside", () => {
  test("a square: four right angles", () => {
    const c = cornersOf(close([P(0, 0), P(10, 0), P(10, 10), P(0, 10)]))
    expect(c.length).toBe(4)
    for (const k of c) {
      expect(k.right).toBe(true)
      expect(deg(k.interior)).toBeCloseTo(90, 9)
    }
  })

  test("a triangle and a pentagon: their true interior angles, no right ones", () => {
    const tri = cornersOf(outlineOf(new Polygon({ sides: 3, radius: 50 }))!)
    expect(tri.map((k) => Math.round(deg(k.interior)))).toEqual([60, 60, 60])
    const penta = cornersOf(outlineOf(new Polygon({ sides: 5, radius: 50 }))!)
    expect(penta.map((k) => Math.round(deg(k.interior)))).toEqual([108, 108, 108, 108, 108])
    expect([...tri, ...penta].some((k) => k.right)).toBe(false)
  })

  test("curves and rounded corners have no sharp angle to show", () => {
    expect(cornersOf(outlineOf(new Circle({ radius: 100 }))!)).toEqual([])
    expect(cornersOf(outlineOf(new Rectangle({ width: 200, height: 100, rounding: 0.3 }))!)).toEqual([])
  })

  test("a concave L: the inner corner is reflex and its arc sweeps inside the shape", () => {
    const L = close([P(0, 0), P(20, 0), P(20, 10), P(10, 10), P(10, 20), P(0, 20)])
    const c = cornersOf(L)
    expect(c.length).toBe(6)
    const reflex = c.filter((k) => k.interior > Math.PI)
    expect(reflex.length).toBe(1)
    expect(deg(reflex[0]!.interior)).toBeCloseTo(270, 9)
    expect(reflex[0]!.at).toEqual(P(10, 10))
    // Polygon angle sum: (n − 2)·180°.
    expect(deg(c.reduce((s, k) => s + k.interior, 0))).toBeCloseTo(720, 9)
    // The reflex arc's midpoint lies inside the L, not in its notch.
    const arc = angleMark(reflex[0]!, 2)
    const mid = arc[Math.floor(arc.length / 2)]!
    expect(mid.x).toBeLessThan(10)
    expect(mid.y).toBeLessThan(10)
  })

  test("winding does not matter: reversed, the same interiors", () => {
    const L = [P(0, 0), P(20, 0), P(20, 10), P(10, 10), P(10, 20), P(0, 20)]
    const a = cornersOf(close(L)).map((k) => Math.round(deg(k.interior))).sort()
    const b = cornersOf(close([...L].reverse())).map((k) => Math.round(deg(k.interior))).sort()
    expect(b).toEqual(a)
  })

  test("an open polyline shows each corner's smaller angle, never its ends", () => {
    const zig = cornersOf([P(0, 0), P(10, 10), P(20, 0), P(30, 10)])
    expect(zig.length).toBe(2)
    for (const k of zig) expect(deg(k.interior)).toBeCloseTo(90, 9)
  })

  test("in 3D: a square tilted out of the screen keeps its right angles, marks in its plane", () => {
    const t = Math.PI / 3
    const tilt = (p: Vec3Like): Vec3Like => P(p.x, p.y * Math.cos(t), p.y * Math.sin(t))
    const sq = close([P(0, 0), P(10, 0), P(10, 10), P(0, 10)].map(tilt))
    const c = cornersOf(sq)
    expect(c.length).toBe(4)
    for (const k of c) {
      expect(k.right).toBe(true)
      // The plane is y·sin t = z·cos t; every mark point stays on it.
      for (const m of angleMark(k, 2)) expect(m.y * Math.sin(t) - m.z * Math.cos(t)).toBeCloseTo(0, 9)
    }
  })
})

describe("angleMark — the square and the arc", () => {
  const [corner] = cornersOf(close([P(0, 0), P(100, 0), P(100, 100), P(0, 100)]))

  test("a right angle takes the square: an L of side `size` closing the corner", () => {
    const m = angleMark(corner!, 10)
    expect(m.length).toBe(3)
    expect(dist(m[0]!, corner!.at)).toBeCloseTo(10, 9)
    expect(dist(m[2]!, corner!.at)).toBeCloseTo(10, 9)
    expect(dist(m[1]!, corner!.at)).toBeCloseTo(10 * Math.SQRT2, 9)
  })

  test("any other angle takes an arc of radius `size` from one edge to the other", () => {
    const [k] = cornersOf(outlineOf(new Polygon({ sides: 3, radius: 100 }))!)
    const m = angleMark(k!, 12)
    for (const p of m) expect(dist(p, k!.at)).toBeCloseTo(12, 9)
    // It starts on the edge toward the previous vertex and ends on the next.
    const along = (d: Vec3Like): Vec3Like => P(k!.at.x + d.x * 12, k!.at.y + d.y * 12, k!.at.z + d.z * 12)
    expect(dist(m[0]!, along(k!.u))).toBeCloseTo(0, 9)
    expect(dist(m[m.length - 1]!, along(k!.v))).toBeCloseTo(0, 9)
  })

  test("a mark never overruns a small figure", () => {
    const [k] = cornersOf(close([P(0, 0), P(10, 0), P(10, 10), P(0, 10)]))
    const m = angleMark(k!, 50)
    expect(dist(m[0]!, k!.at)).toBeCloseTo(10 * MARK_ROOM, 9)
  })
})

describe("GeometrySketch — the ability", () => {
  test("a square gets four marks, a pentagon five, a circle none", () => {
    expect(new GeometrySketch(new Square({ size: 200 })).parts.length).toBe(4)
    expect(new GeometrySketch(new Polygon({ sides: 5, radius: 100 })).parts.length).toBe(5)
    expect(new GeometrySketch(new Circle({ radius: 100 })).parts.length).toBe(0)
  })

  test("the marks sit on the corners, and follow the shape as it moves and grows", () => {
    const square = new Square({ size: 200 })
    const sketch = new GeometrySketch(square, { size: 20 })
    const corners = () =>
      (sketch.parts as Line[]).map((l) => l.points[1]!).map((p) => [Math.round(p.x), Math.round(p.y)])
    // Each square mark's middle point is (size, size) in from its corner.
    expect(corners().sort()).toEqual([[-80, -80], [-80, 80], [80, -80], [80, 80]].sort())
    square.size.value = 300
    square.x.value = 50
    expect(corners().sort()).toEqual([[-80, -130], [-80, 130], [180, -130], [180, 130]].sort())
  })

  test("style is the sketch's own, bound into every mark", () => {
    const sketch = new GeometrySketch(new Square({ size: 200 }), { stroke: 2 })
    for (const mark of sketch.parts as Line[]) expect(mark.stroke).toBe(sketch.stroke)
  })

  test("the gate refuses what has no single outline, and teaches", () => {
    expect(isSketchable(new Square())).toBe(true)
    expect(isSketchable(new AnnularSector())).toBe(false)
    expect(() => new GeometrySketch(new AnnularSector())).toThrow(/category error/)
    expect(() => new GeometrySketch(new Line({ points: [P(0, 0)] }))).toThrow(/Give it its points/)
  })

  test("the graft: every Stroke learns sketchGeometry(), returning the sketch and its draw-on", () => {
    const tri = new Polygon({ sides: 3, radius: 80 })
    const { sketch, anim } = tri.sketchGeometry({ size: 15 })
    expect(sketch).toBeInstanceOf(GeometrySketch)
    expect(sketch.size.value).toBe(15)
    expect(sketch.parts.length).toBe(3)
    expect(anim.tracks.length).toBeGreaterThan(0)
  })
})
