/**
 * ib-noosphere.test.ts — the Noosphere (InterBrain film 7:30–7:41, 19:02,
 * 24:11, 39:27): the geodesic sphere's counts and regularity, the flower's
 * arcs running node to node, the links' bend from straight to petal, the
 * disk's lattice landing on the hexagon's corners, and the state axes'
 * endpoints.
 */

import { describe, expect, test } from "bun:test"
import {
  flowerArcs,
  geodesic,
  hexRadius,
  latticeLoops,
  meanEdgeAngle,
  morphRadius,
  sectorFlower,
  sectorTriangle,
  triLattice,
  type V3,
} from "../vocabulary/Noosphere/geodesic"
import { CUT, HEX, MAX_FACES_NU, NOOSPHERE, Noosphere } from "../vocabulary/Noosphere/Noosphere"

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

describe("the geodesic sphere", () => {
  test("class-I counts: V = 10ν² + 2, E = 30ν², F = 20ν² (Euler V − E + F = 2)", () => {
    for (const nu of [1, 2, 3, 4, 6]) {
      const g = geodesic(nu)
      expect(g.vertices.length).toBe(10 * nu * nu + 2)
      expect(g.edges.length).toBe(30 * nu * nu)
      expect(g.faces.length).toBe(20 * nu * nu)
      for (const v of g.vertices) near(Math.hypot(...v), 1)
    }
  })

  test("twelve five-valent poles, every other vertex six-valent", () => {
    const g = geodesic(3)
    const valence = new Array(g.vertices.length).fill(0)
    for (const [a, b] of g.edges) valence[a]++, valence[b]++
    expect(valence.filter((v) => v === 5).length).toBe(12)
    expect(valence.filter((v) => v === 6).length).toBe(g.vertices.length - 12)
  })

  test("f11941's 30° spacing is ν 2; f5716's ≈ 9.8° is ν 7", () => {
    const deg = (nu: number) => (meanEdgeAngle(geodesic(nu)) * 180) / Math.PI
    const nearest = (target: number) => [1, 2, 3, 4, 5, 6, 7, 8].reduce((b, nu) => (Math.abs(deg(nu) - target) < Math.abs(deg(b) - target) ? nu : b))
    expect(nearest(30)).toBe(2)
    expect(nearest(9.8)).toBe(7)
  })

  test("the lattice: every edge is drawn, split at the limb into near + far", () => {
    const g = geodesic(3)
    const { near: n, far: f } = latticeLoops(g, 100, 0.3, 0.2)
    expect(n.length + f.length).toBeGreaterThanOrEqual(g.edges.length)
    for (const run of [...n, ...f]) for (const p of run) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(100 + 1e-6)
  })
})

describe("the links: straight (narrative-engineered) → petals (vision-gardened)", () => {
  const g = geodesic(2)

  test("untrimmed, every arc runs from one vertex exactly to another", () => {
    const arcs = flowerArcs(g, 0, 1)
    expect(arcs.length).toBe(3 * g.faces.length)
    const isVertex = (p: V3) => g.vertices.some((v) => dot(v, p) > 1 - 1e-9)
    for (const a of arcs) {
      expect(isVertex(a[0]!)).toBe(true)
      expect(isVertex(a[a.length - 1]!)).toBe(true)
    }
  })

  test("bend 1: each arc keeps its distance from the corner it circles (a flower circle)", () => {
    const f = g.faces[0]!
    const [C, A, B] = [g.vertices[f[0]]!, g.vertices[f[1]]!, g.vertices[f[2]]!]
    const arc = flowerArcs({ vertices: g.vertices, edges: g.edges, faces: [f] }, 0, 1)[0]!
    const rA = Math.acos(dot(C, A))
    const rB = Math.acos(dot(C, B))
    for (const p of arc) {
      const r = Math.acos(Math.min(1, dot(C, p)))
      expect(r).toBeGreaterThan(Math.min(rA, rB) - 1e-9)
      expect(r).toBeLessThan(Math.max(rA, rB) + 1e-9)
    }
  })

  test("bend 0: the arc IS the great-circle link A→B (its midpoint is the edge's)", () => {
    const f = g.faces[0]!
    const [A, B] = [g.vertices[f[1]]!, g.vertices[f[2]]!]
    const arc = flowerArcs({ vertices: g.vertices, edges: g.edges, faces: [f] }, 0, 0)[0]!
    const mid = arc[arc.length >> 1]!
    const m: V3 = [A[0] + B[0], A[1] + B[1], A[2] + B[2]]
    const l = Math.hypot(...m)
    near(dot(mid, [m[0] / l, m[1] / l, m[2] / l]), 1, 1e-9)
  })

  test("trimmed at the node rings: no point inside a ring", () => {
    const rho = NOOSPHERE.node * meanEdgeAngle(g)
    for (const a of flowerArcs(g, rho, 1))
      for (const p of a) for (const v of g.vertices) expect(Math.acos(Math.min(1, dot(p, v)))).toBeGreaterThan(rho - 1e-6)
  })
})

describe("the flat noosphere", () => {
  test("disk → hexagon: radius 1 at u 0; the hexagon's corners and apothem at u 1", () => {
    for (const th of [0, 0.3, 1, 2]) near(morphRadius(th, 0, NOOSPHERE.hex), 1)
    near(morphRadius(0, 1, NOOSPHERE.hex), NOOSPHERE.hex)
    near(morphRadius(Math.PI / 6, 1, NOOSPHERE.hex), NOOSPHERE.hex * Math.cos(Math.PI / 6))
    near(hexRadius(Math.PI / 3), 1)
  })

  test("the hexagon's corners lie on the flower's lattice (the triangles' grid is that lattice)", () => {
    const R = 400
    const s = (NOOSPHERE.hex * R) / NOOSPHERE.steps
    const lat = triLattice(s, R)
    for (let k = 0; k < 6; k++) {
      const [, a] = sectorTriangle(k, NOOSPHERE.hex * R)
      expect(lat.some((p) => Math.hypot(p.x - a.x, p.y - a.y) < 1e-6)).toBe(true)
    }
  })

  test("a sector's flower stays inside its sector and the boundary", () => {
    const R = 400
    const s = (NOOSPHERE.hex * R) / NOOSPHERE.steps
    const runs = sectorFlower(1, R, s, 1, NOOSPHERE.hex)
    expect(runs.length).toBeGreaterThan(50)
    for (const run of runs)
      for (const p of run) {
        const r = Math.hypot(p.x, p.y)
        expect(r).toBeLessThanOrEqual(R * morphRadius(Math.atan2(p.y, p.x), 1, NOOSPHERE.hex) + 1e-3)
        if (r > 1e-3) {
          const a = (Math.atan2(p.y, p.x) + 2 * Math.PI) % (2 * Math.PI)
          expect(a).toBeGreaterThan(Math.PI / 3 - 1e-3)
          expect(a).toBeLessThan((2 * Math.PI) / 3 + 1e-3)
        }
      }
  })
})

describe("Noosphere — the holon", () => {
  test("the axes and their endpoints", () => {
    const n = new Noosphere({ frequency: 2 })
    const space = n.stateSpace()!
    const ids = space.axes.map((a) => a.id)
    expect(ids).toEqual(["bloom", "garden", "flat", "fragment", "interbrain", "lens"])
    const frag = space.axes.find((a) => a.id === "fragment")!
    expect(frag.positions.map((p) => [p.name, [...p.values.values()][0]])).toEqual([
      ["whole", 0],
      ["struck", CUT],
      ["hexagon", HEX],
      ["vortex", 1],
    ])
    const garden = space.axes.find((a) => a.id === "garden")!
    expect(garden.positions.map((p) => p.name)).toEqual(["narrative-engineered", "vision-gardened"])
  })

  test("flat cross-fades the sphere and the disk; the vortex scatters the shards", () => {
    const n = new Noosphere({ frequency: 2, flat: 0 })
    void n.parts
    expect(n.sphere.there.value).toBe(1)
    expect(n.disk.there.value).toBe(0)
    n.flat.value = 1
    expect(n.sphere.there.value).toBe(0)
    expect(n.disk.there.value).toBe(1)
    n.fragment.value = 0
    for (const s of n.shards) near(Math.hypot(s.x.value, s.y.value), 0)
    n.fragment.value = 1
    const out = NOOSPHERE.drift * NOOSPHERE.hex * n.radius.value
    for (const s of n.shards) near(Math.hypot(s.x.value, s.y.value), out)
  })

  test("an InterBrain per node on a coarse sphere, none on a fine one; shown only when `interbrain` is", () => {
    const coarse = new Noosphere({ frequency: 2, bloom: 1 })
    void coarse.parts
    expect(coarse.slots.length).toBe(geodesic(2).vertices.length)
    expect(Math.max(...coarse.slots.map((s) => s.there.value))).toBe(0)
    coarse.interbrain.value = 1
    expect(Math.max(...coarse.slots.map((s) => s.there.value))).toBe(1)
    const fine = new Noosphere({ frequency: MAX_FACES_NU + 1 })
    void fine.parts
    expect(fine.slots.length).toBe(0)
  })
})
