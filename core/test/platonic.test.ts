/**
 * The Platonic solids — pinned against the facts that are known in closed form,
 * so a mistyped coordinate or a dropped edge cannot hide behind a wireframe
 * that merely looks like a crystal: the classic V/E/F counts, unit-radius
 * vertices, well-formed edges, and a rotation that is pure and 2π-periodic.
 */

import { describe, expect, test } from "bun:test"
import {
  SOLIDS,
  project,
  rotate,
  type SolidName,
  type Vec3,
} from "../src/geometry/platonic"

// name → [vertices, edges, faces], the canonical counts.
const COUNTS: Record<SolidName, [number, number, number]> = {
  tetrahedron: [4, 6, 4],
  cube: [8, 12, 6],
  octahedron: [6, 12, 8],
  dodecahedron: [20, 30, 12],
  icosahedron: [12, 30, 20],
}

const NAMES = Object.keys(COUNTS) as SolidName[]

describe("the five solids have the right counts", () => {
  for (const name of NAMES) {
    const [v, e, f] = COUNTS[name]!
    test(`${name}: ${v} vertices, ${e} edges, ${f} faces`, () => {
      const solid = SOLIDS[name]!
      expect(solid.vertices.length).toBe(v)
      expect(solid.edges.length).toBe(e)
      expect(solid.faces).toBe(f)
      // Euler's formula, as an independent cross-check on the three.
      expect(v - e + f).toBe(2)
    })
  }
})

describe("every vertex is unit distance from the centre", () => {
  for (const name of NAMES) {
    test(name, () => {
      for (const p of SOLIDS[name]!.vertices) {
        expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 9)
      }
    })
  }
})

describe("edges are well-formed", () => {
  for (const name of NAMES) {
    test(`${name}: each edge joins two distinct existing vertices, i < j, unique`, () => {
      const solid = SOLIDS[name]!
      const n = solid.vertices.length
      const seen = new Set<string>()
      for (const [i, j] of solid.edges) {
        expect(i).toBeGreaterThanOrEqual(0)
        expect(j).toBeLessThan(n)
        expect(i).toBeLessThan(j) // distinct AND ordered
        const key = `${i}-${j}`
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    })

    test(`${name}: all edges are the same length`, () => {
      const solid = SOLIDS[name]!
      const len = ([i, j]: [number, number]) => {
        const a = solid.vertices[i]!
        const b = solid.vertices[j]!
        return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
      }
      const first = len(solid.edges[0]!)
      for (const e of solid.edges) expect(len(e)).toBeCloseTo(first, 9)
    })
  }
})

describe("every vertex is used by at least one edge (no orphans)", () => {
  for (const name of NAMES) {
    test(name, () => {
      const solid = SOLIDS[name]!
      const used = new Set<number>()
      for (const [i, j] of solid.edges) {
        used.add(i)
        used.add(j)
      }
      expect(used.size).toBe(solid.vertices.length)
    })
  }
})

describe("rotation is pure and periodic", () => {
  const p: Vec3 = { x: 0.3, y: -0.6, z: 0.7 }

  test("zero rotation is the identity", () => {
    const r = rotate(p, 0, 0)
    expect(r.x).toBeCloseTo(p.x, 12)
    expect(r.y).toBeCloseTo(p.y, 12)
    expect(r.z).toBeCloseTo(p.z, 12)
  })

  test("rotation preserves length (it is a rotation, not a shear)", () => {
    const r = rotate(p, 1.1, -0.4)
    expect(Math.hypot(r.x, r.y, r.z)).toBeCloseTo(Math.hypot(p.x, p.y, p.z), 12)
  })

  test("2π in either axis returns to the start", () => {
    const yaw = rotate(p, Math.PI * 2, 0.4)
    const base = rotate(p, 0, 0.4)
    expect(yaw.x).toBeCloseTo(base.x, 9)
    expect(yaw.y).toBeCloseTo(base.y, 9)
    expect(yaw.z).toBeCloseTo(base.z, 9)

    const pitch = rotate(p, 0.4, Math.PI * 2)
    const base2 = rotate(p, 0.4, 0)
    expect(pitch.x).toBeCloseTo(base2.x, 9)
    expect(pitch.y).toBeCloseTo(base2.y, 9)
    expect(pitch.z).toBeCloseTo(base2.z, 9)
  })

  test("same inputs give the same output — no hidden state", () => {
    const a = rotate(p, 0.9, 0.3)
    const b = rotate(p, 0.9, 0.3)
    expect(a).toEqual(b)
  })
})

describe("project", () => {
  test("scales vertices by radius and keeps every edge (nothing culled)", () => {
    const solid = SOLIDS.cube!
    const { vertices, edges } = project(solid, 200, 0.5, 0.3)
    expect(vertices.length).toBe(8)
    expect(edges.length).toBe(12) // all 12, including the back ones
    // A cube vertex is at unit radius; projected screen radius ≤ 200.
    for (const v of vertices) expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(200 + 1e-9)
  })

  test("an edge's endpoints are the projected vertices it indexes", () => {
    const solid = SOLIDS.tetrahedron!
    const { vertices, edges } = project(solid, 100, 0.2, -0.1)
    for (const e of edges) {
      // Every endpoint coincides with some projected vertex.
      const isVertex = (pt: { x: number; y: number }) =>
        vertices.some((v) => Math.abs(v.x - pt.x) < 1e-9 && Math.abs(v.y - pt.y) < 1e-9)
      expect(isVertex(e.a)).toBe(true)
      expect(isVertex(e.b)).toBe(true)
    }
  })

  test("projection at spin 0 and spin 2π agree (pure, periodic)", () => {
    const at = (yaw: number) => project(SOLIDS.icosahedron!, 150, yaw, 0.25).vertices
    const a = at(0)
    const b = at(Math.PI * 2)
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.x).toBeCloseTo(b[i]!.x, 6)
      expect(a[i]!.y).toBeCloseTo(b[i]!.y, 6)
    }
  })
})
