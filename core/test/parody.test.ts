/**
 * Parody — the torus and the same ring as cubes, one mesh along `parody`.
 */

import { describe, expect, test } from "bun:test"
import { PARODY, Parody, parodyHalves, parodyMesh, segmentProgress } from "../vocabulary/Parody/Parody"
import type { Mesh } from "../src/geometry/meshes"
import { derive } from "../src/params"

/** Every edge shared by exactly two triangles, once each way: a closed, consistently wound surface. */
const closedAndOriented = (m: Mesh): boolean => {
  const directed = new Map<string, number>()
  for (const [a, b, c] of m.triangles)
    for (const [p, q] of [[a, b], [b, c], [c, a]] as const) directed.set(`${p}>${q}`, (directed.get(`${p}>${q}`) ?? 0) + 1)
  for (const [k, n] of directed) {
    const [p, q] = k.split(">")
    if (n !== 1 || directed.get(`${q}>${p}`) !== 1) return false
  }
  return true
}

const volume = (m: Mesh): number => {
  let v = 0
  for (const [a, b, c] of m.triangles) {
    const A = m.positions[a]!
    const B = m.positions[b]!
    const C = m.positions[c]!
    v += (A.x * (B.y * C.z - B.z * C.y) - A.y * (B.x * C.z - B.z * C.x) + A.z * (B.x * C.y - B.y * C.x)) / 6
  }
  return v
}

describe("Parody", () => {
  test("closed, outward-wound bodies at every stage, with and without spread", () => {
    for (const spread of [0, 2])
      for (const u of [0, 0.01, 0.3, 0.5, 0.8, 1]) {
        const m = parodyMesh(100, 12, u, spread)
        expect(closedAndOriented(m)).toBe(true)
        expect(volume(m)).toBeGreaterThan(0)
        const { real, parody } = parodyHalves(100, 12, u, spread)
        expect(real.triangles.length + parody.triangles.length).toBe(m.triangles.length)
        for (const half of [real, parody]) if (half.triangles.length) expect(closedAndOriented(half)).toBe(true)
      }
  })

  test("0 is one seamless torus; 1 is twelve cubes of edge CUBE·R", () => {
    const torus = parodyMesh(100, 12, 0)
    // No caps: only the tube's quads.
    expect(torus.triangles.length).toBe(12 * PARODY.spine * PARODY.section * 2)
    const r = (PARODY.cube * 100) / 2
    // A polygonal torus: within 1.5% of the true volume (its facets cut inside).
    expect(Math.abs(volume(torus) / (2 * Math.PI * 100 * Math.PI * r * r) - 1)).toBeLessThan(0.015)
    const cubes = parodyMesh(100, 12, 1)
    expect(volume(cubes)).toBeCloseTo(12 * (PARODY.cube * 100) ** 3, 3)
    expect(parodyHalves(100, 12, 0).parody.triangles.length).toBe(0)
    expect(parodyHalves(100, 12, 1).real.triangles.length).toBe(0)
  })

  test("the counterfeit runs from the top down both sides, mirror-symmetric", () => {
    const ts = segmentProgress(12, 0.4, 2)
    expect(ts[0]).toBe(1)
    for (let i = 1; i < 12; i++) expect(ts[i]).toBe(ts[12 - i]!)
    for (let i = 1; i <= 6; i++) expect(ts[i]!).toBeLessThanOrEqual(ts[i - 1]!)
    expect(segmentProgress(12, 0, 2).every((t) => t === 0)).toBe(true)
    expect(segmentProgress(12, 1, 2).every((t) => t === 1)).toBe(true)
  })

  test("one walkable axis, real ↔ parody; none when a whole drives it", () => {
    const p = new Parody()
    const axes = p.stateSpace()!.axes
    expect(axes.map((a) => a.id)).toEqual(["parody"])
    expect(axes[0]!.positions.map((x) => x.name)).toEqual(["real", "parody"])
    const driven = new Parody()
    driven.parody.follow(derive(() => 0.5))
    expect(driven.stateSpace()).toBeUndefined()
  })
})
