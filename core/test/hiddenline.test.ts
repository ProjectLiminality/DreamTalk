/**
 * Hidden line (src/geometry/hiddenline.ts) + SolidDrawing + Truck.
 *
 * The line-drawing rule (an edge is drawn where one of its faces faces the
 * eye), the contour generators, occlusion between solids, and the view the
 * holon reads from its Observer — which must be the host camera's own.
 */

import { describe, expect, test } from "bun:test"
import { hiddenLineDrawing, type Solid } from "../src/geometry/hiddenline"
import { toLocal, toWorld, viewOf } from "../src/parts/soliddrawing"
import { Observer } from "../src/dream"
import { Group } from "../src/parts/primitives"
import { Truck } from "../vocabulary/Truck/Truck"
import { BLUE } from "../src/constants"

const box = (x: number, y: number, z: number, s = 100, fill?: typeof BLUE): Solid => ({
  kind: "box",
  center: { x, y, z },
  size: { x: s, y: s, z: s },
  fill,
})

describe("a single box", () => {
  test("seen from a corner: 9 of its 12 edges, 3 faces", () => {
    const d = hiddenLineDrawing([box(0, 0, 0, 100, BLUE)], { eye: { x: 600, y: 500, z: 700 } })
    expect(d.lines.length).toBe(9)
    expect(d.faces.length).toBe(3)
    // The three hidden edges are the ones at the far corner (-50,-50,-50).
    for (const l of d.lines)
      expect(l.some((p) => p.x === -50 && p.y === -50 && p.z === -50)).toBe(false)
  })

  test("seen face-on (orthographic): only that face's 4 edges", () => {
    const d = hiddenLineDrawing([box(0, 0, 0)], { toward: { x: 0, y: 0, z: 1 } })
    expect(d.lines.length).toBe(4)
    for (const l of d.lines) for (const p of l) expect(p.z).toBe(50)
  })
})

describe("cylinders", () => {
  test("seen from the side: two contour generators and both rims, each partial", () => {
    const cyl: Solid = { kind: "cylinder", center: { x: 0, y: 0, z: 0 }, radius: 50, height: 200, axis: "y" }
    const d = hiddenLineDrawing([cyl], { eye: { x: 0, y: 0, z: 1000 } })
    const straight = d.lines.filter((l) => l.length === 2)
    expect(straight.length).toBe(2)
    for (const l of straight) expect(Math.abs(l[0]!.y - l[1]!.y)).toBeCloseTo(200, 6)
    // Neither cap faces an eye level with the middle: each rim is drawn only
    // where the mantle faces the eye — its front half.
    const rims = d.lines.filter((l) => l.length > 2)
    expect(rims.length).toBe(2)
    for (const r of rims) for (const p of r) expect(p.z).toBeGreaterThan(-1e-6)
  })

  test("from above: the top rim is a whole closed loop", () => {
    const cyl: Solid = { kind: "cylinder", center: { x: 0, y: 0, z: 0 }, radius: 50, height: 200, axis: "y" }
    const d = hiddenLineDrawing([cyl], { eye: { x: 0, y: 1000, z: 600 } })
    const top = d.lines.find((l) => l.length > 2 && l.every((p) => Math.abs(p.y - 100) < 1e-9))!
    expect(top).toBeDefined()
    expect(top[0]).toEqual(top[top.length - 1]!)
  })
})

describe("occlusion", () => {
  test("a box hidden behind a bigger box draws nothing", () => {
    const d = hiddenLineDrawing([box(0, 0, 0, 300), box(0, 0, -400, 100)], { eye: { x: 0, y: 0, z: 1500 } })
    // Only the front box's front face (4 edges) — the small one is behind it.
    expect(d.lines.length).toBe(4)
  })

  test("a partly hidden OPEN edge keeps its far end (regression: s = 1 is not s = 0)", () => {
    // A tall thin box behind a short wide one: its near vertical edges are
    // hidden low down and visible above — the visible run must end at the TOP.
    const d = hiddenLineDrawing(
      [{ kind: "box", center: { x: 0, y: 0, z: 0 }, size: { x: 300, y: 100, z: 100 } },
       { kind: "box", center: { x: 0, y: 100, z: -200 }, size: { x: 100, y: 300, z: 100 } }],
      { eye: { x: 0, y: 0, z: 1500 } },
    )
    const verticals = d.lines.filter((l) => l.length === 2 && l[0]!.x === l[1]!.x && l[0]!.z === -150 && Math.abs(l[0]!.x) === 50)
    expect(verticals.length).toBe(2)
    for (const l of verticals) {
      const ys = l.map((p) => p.y).sort((a, b) => a - b)
      expect(ys[1]).toBeCloseTo(250, 6) // reaches the top of the tall box
      expect(ys[0]).toBeGreaterThan(-50) // and starts above where the front box hides it
    }
  })

  test("faces come back to front", () => {
    const view = { eye: { x: 0, y: 200, z: 1500 } }
    const d = hiddenLineDrawing([box(0, 0, 200, 100, BLUE), box(0, 0, -300, 100, BLUE)], view)
    const depth = (f: (typeof d.faces)[number]) => {
      const c = f.points[0]!
      return Math.hypot(c.x - view.eye.x, c.y - view.eye.y, c.z - view.eye.z)
    }
    expect(d.faces[0]!.solid).toBe(1)
    expect(depth(d.faces[0]!)).toBeGreaterThan(depth(d.faces[d.faces.length - 1]!))
  })
})

describe("the view", () => {
  test("viewOf is the host camera's placement (three-host syncCamera)", () => {
    const obs = new Observer({ phi: 0.6, theta: 0.3, radius: 1200, zoom: 2, x: 10, y: 20, z: 30 })
    const v = viewOf(obs)
    if (!("eye" in v)) throw new Error("perspective expected")
    const r = 600
    expect(v.eye.x).toBeCloseTo(10 + r * Math.sin(0.6) * Math.cos(0.3), 9)
    expect(v.eye.y).toBeCloseTo(20 + r * Math.sin(0.3), 9)
    expect(v.eye.z).toBeCloseTo(30 + r * Math.cos(0.6) * Math.cos(0.3), 9)
    const ortho = viewOf(new Observer({ orthographic: true }))
    expect(ortho).toEqual({ toward: { x: 0, y: 0, z: 1 } })
  })

  test("toLocal inverts toWorld through a rotated, scaled parent", () => {
    const t = new Truck({ x: 40, h: 0.4 })
    const g = new Group({ members: [t], p: 0.3, scale: 2, y: -10 })
    void g.parts
    const p = { x: 12, y: -7, z: 33 }
    const back = toLocal(t, toWorld(t, p))
    expect(back.x).toBeCloseTo(p.x, 9)
    expect(back.y).toBeCloseTo(p.y, 9)
    expect(back.z).toBeCloseTo(p.z, 9)
  })
})

describe("Truck", () => {
  test("its drawing fits its slots from every side", () => {
    for (let k = 0; k < 16; k++) {
      const obs = new Observer({ phi: (k / 16) * 2 * Math.PI, theta: 0.1 + (k % 4) * 0.3, radius: 1200 })
      const truck = new Truck({ observer: obs })
      const d = truck.drawing()
      expect(d.lines.length).toBeGreaterThan(8)
      expect(d.lines.length).toBeLessThanOrEqual(160)
      expect(d.faces.length).toBeLessThanOrEqual(64)
    }
  })

  test("its world curves move with it, and change with the view", () => {
    const obs = new Observer({ phi: 0.6, theta: 0.3 })
    const truck = new Truck({ observer: obs, x: 100 })
    const a = truck.worldCurves()
    expect(Math.min(...a.flat().map((p) => p.x))).toBeCloseTo(100 - 325, 6)
    obs.phi.value = -0.6
    const b = truck.worldCurves()
    expect(JSON.stringify(b)).not.toBe(JSON.stringify(a))
  })
})
