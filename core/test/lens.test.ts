/**
 * Lens / FlowLens, Stream, Road — the abstract made concrete.
 */

import { describe, expect, test } from "bun:test"
import { Observer } from "../src/dream"
import { Lens, FlowLens } from "../vocabulary/Lens/Lens"
import { Stream } from "../vocabulary/Stream/Stream"
import { Road } from "../vocabulary/Road/Road"
import { Truck } from "../vocabulary/Truck/Truck"
import { MorphCurves } from "../vocabulary/Morph/MorphCurves"

const PATH = [
  { x: -700, y: -200, z: 0 },
  { x: 700, y: -200, z: 0 },
]

describe("Lens", () => {
  test("at rest it has no sides; lifted, two contour lines join the rims", () => {
    const lens = new Lens({ observer: new Observer(), radius: 100 })
    expect(lens.sides()).toEqual([])
    lens.lift.value = 1
    const sides = lens.sides()
    expect(sides.length).toBe(2)
    const c = lens.nearCenter()
    for (const [a, b] of sides) {
      expect(Math.hypot(a!.x, a!.y)).toBeCloseTo(100, 6)
      expect(a!.z).toBe(0)
      expect(Math.hypot(b!.x - c.x, b!.y - c.y)).toBeCloseTo(100, 6)
      expect(b!.z).toBeCloseTo(c.z, 9)
    }
  })

  test("the contour lines are where the view ray grazes: neighbours on both sides of the rim fall inside the silhouette", () => {
    // Project to the screen and check the side line is tangent to both
    // projected rims: every rim point lies on ONE side of it.
    const obs = new Observer()
    const lens = new Lens({ observer: obs, radius: 100, lift: 1 })
    const eye = { x: 0, y: 0, z: 1500 }
    const proj = (p: { x: number; y: number; z: number }) => ({ x: (p.x * 1500) / (eye.z - p.z), y: (p.y * 1500) / (eye.z - p.z) })
    const c = lens.nearCenter()
    for (const [a, b] of lens.sides()) {
      const pa = proj(a!)
      const pb = proj(b!)
      const side = (q: { x: number; y: number }) => (pb.x - pa.x) * (q.y - pa.y) - (pb.y - pa.y) * (q.x - pa.x)
      const signs = new Set<number>()
      for (let i = 0; i < 72; i++) {
        const th = (i / 72) * 2 * Math.PI
        for (const rim of [
          { x: 100 * Math.cos(th), y: 100 * Math.sin(th), z: 0 },
          { x: c.x + 100 * Math.cos(th), y: c.y + 100 * Math.sin(th), z: c.z },
        ]) {
          const s = side(proj(rim))
          if (Math.abs(s) > 1e-3 * Math.hypot(pb.x - pa.x, pb.y - pa.y) * 10) signs.add(Math.sign(s))
        }
      }
      expect(signs.size).toBe(1)
    }
  })

  test("inside: the near face's centre is seen within it, a far-away point is not", () => {
    const lens = new Lens({ observer: new Observer(), radius: 100, lift: 1, x: 50 })
    const c = lens.nearCenter()
    expect(lens.inside({ x: 50 + c.x, y: c.y, z: c.z })).toBe(true)
    expect(lens.inside({ x: 2000, y: 0, z: 0 })).toBe(false)
  })
})

describe("Stream", () => {
  test("particles are a pure f(time): fractions in [0, 1] or −1, same time same answer", () => {
    const s = new Stream({ path: PATH, count: 12, spacing: 130, speed: 70 })
    s.time.value = 3.7
    const a = s.particles()
    expect(a.length).toBe(12)
    for (const v of a) expect(v === -1 || (v >= 0 && v <= 1)).toBe(true)
    s.time.value = 9
    s.time.value = 3.7
    expect(s.particles()).toEqual(a)
  })

  test("they move forward at `speed`", () => {
    const s = new Stream({ path: PATH, count: 12, spacing: 130, speed: 70 })
    s.time.value = 1
    const a = s.particles()
    s.time.value = 2
    const b = s.particles()
    const i = a.findIndex((v, k) => v >= 0 && v < 0.9 && b[k]! >= 0)
    expect((b[i]! - a[i]!) * 1400).toBeCloseTo(70, 6)
  })
})

describe("Road", () => {
  test("its lines are trimmed to the bound", () => {
    const road = new Road({ length: 600, bound: (p) => p.x < 100 })
    void road.parts
    const lines = road.lines.map((l) => l.points).filter((p) => p.length >= 2)
    expect(lines.length).toBeGreaterThan(2)
    for (const l of lines) for (const p of l) expect(p.x).toBeLessThan(100 + 1e-3)
    const edge = road.lines[0]!.points
    expect(Math.max(...edge.map((p) => p.x))).toBeCloseTo(100, 2)
  })
})

describe("FlowLens", () => {
  const build = () => {
    const stream = new Stream({ path: PATH, count: 12, spacing: 130, speed: 70 })
    const lens = new FlowLens(stream, { observer: new Observer(), x: -300, y: -200, radius: 130, lift: 1 })
    void lens.parts
    return { stream, lens }
  }

  test("abstract (concrete 0): no truck shows, whatever time it is", () => {
    const { stream, lens } = build()
    const trucks = [...lens.walk()].filter((h): h is Truck => h instanceof Truck)
    for (let T = 0; T < 8; T += 0.37) {
      stream.time.value = T
      for (const t of trucks) expect(t.opacity.value).toBe(0)
    }
  })

  test("concrete: trucks run continuously, but only across the middle of the window", () => {
    const { stream, lens } = build()
    lens.concrete.value = 1
    const trucks = [...lens.walk()].filter((h): h is Truck => h instanceof Truck)
    let seen = 0
    for (let T = 0; T < 12; T += 0.25) {
      stream.time.value = T
      const shown = trucks.filter((t) => t.opacity.value > 0 && t.fillOpacity.value > 0)
      seen += shown.length > 0 ? 1 : 0
      // A shown truck stands within the middle of the road's span, never at the rim.
      for (const t of shown) expect(Math.abs(t.x.value)).toBeLessThan(0.5 * 2 * 130)
    }
    expect(seen).toBeGreaterThan(20)
  })

  test("the line and the dots are morphers' sources; at rest they draw no plan", () => {
    const { lens } = build()
    const morphers = [...lens.walk()].filter((h): h is MorphCurves => h instanceof MorphCurves)
    expect(morphers.length).toBe(1 + 4)
    for (const m of morphers) expect(m.morph.value).toBe(0)
  })
})

describe("FlowLens alignment", () => {
  test("align 1: the window's ground stands on the frame's up, the road along the flow", async () => {
    const { Group } = await import("../src/parts/primitives")
    const { rotHPB } = await import("../src/parts/curves")
    const { toWorld } = await import("../src/parts/soliddrawing")
    // A frame turned and pitched like an expanded FlowMap stack; the flow
    // runs along its depth (local z).
    const frame = new Group({ h: 1.22, p: 0.42 })
    const lens = new FlowLens(
      {
        path: () => [
          { x: 0, y: 0, z: -300 },
          { x: 0, y: 0, z: 300 },
        ],
        particles: () => [],
        frame,
      },
      { observer: new Observer(), at: 0.5, radius: 50, align: 1, alignTo: frame, lift: 1 },
    )
    const { h, p, b } = lens.groundTurn()
    const up = rotHPB({ x: 0, y: 1, z: 0 }, p, h, b)
    const along = rotHPB({ x: 1, y: 0, z: 0 }, p, h, b)
    const o = toWorld(frame, { x: 0, y: 0, z: 0 })
    const fy = toWorld(frame, { x: 0, y: 1, z: 0 })
    const fz = toWorld(frame, { x: 0, y: 0, z: 1 })
    // The lens is unrotated, so lens-local directions are world directions.
    expect(up.x).toBeCloseTo(fy.x - o.x, 6)
    expect(up.y).toBeCloseTo(fy.y - o.y, 6)
    expect(up.z).toBeCloseTo(fy.z - o.z, 6)
    expect(along.x).toBeCloseTo(fz.x - o.x, 6)
    expect(along.y).toBeCloseTo(fz.y - o.y, 6)
    expect(along.z).toBeCloseTo(fz.z - o.z, 6)
  })

  test("zoom: the near face grows with lift, and the window's contents with it", () => {
    const lens = new Lens({ observer: new Observer({ orthographic: true }), radius: 50, zoom: 3 })
    expect(lens.nearRadius()).toBe(50)
    lens.lift.value = 1
    expect(lens.nearRadius()).toBeCloseTo(150, 9)
    expect(lens.sides().length).toBe(2)
  })
})
