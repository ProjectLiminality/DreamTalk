import { describe, expect, test } from "bun:test"
import { Polylines, deriveLoops } from "../src/parts/polylines"
import { scalar } from "../src/params"

const sq = (s: number) => [
  { x: 0, y: 0, z: 0 },
  { x: s, y: 0, z: 0 },
  { x: s, y: s, z: 0 },
]

describe("Polylines — many lines as one stroke", () => {
  test("loops is an override, and every write bumps geomVersion (the host's O(1) dirty-check)", () => {
    const p = new Polylines({ loops: [sq(1), sq(2)] })
    expect(p.loops.length).toBe(2)
    const v = p.geomVersion
    p.loops = [sq(3)]
    expect(p.geomVersion).toBe(v + 1)
    expect(p.loops[0]![1]!.x).toBe(3)
  })

  test("derived loops recompute only when their source key changes", () => {
    const p = new Polylines()
    const size = scalar(1)
    let runs = 0
    deriveLoops(p, () => [size.value], () => {
      runs++
      return [sq(size.value), sq(size.value * 2)]
    })
    void p.loops
    void p.loops
    expect(runs).toBe(1)
    const v = p.geomVersion
    size.value = 5
    expect(p.loops[1]![1]!.x).toBe(10)
    expect(runs).toBe(2)
    expect(p.geomVersion).toBe(v + 1)
  })

  test("no pen of its own beyond the Stroke's: stroke, tint, opacity, creation are its params", () => {
    const p = new Polylines({ stroke: 2 })
    expect(p.stroke.value).toBe(2)
    expect(p.creation).toBeDefined()
  })
})

describe("deriveLoops — the version refreshes itself", () => {
  test("geomVersion moves when the source changes, without anyone reading loops first (the host's order)", () => {
    const p = new Polylines()
    let n = 1
    deriveLoops(p, () => [n], () => [Array.from({ length: n + 1 }, (_, i) => ({ x: i, y: 0, z: 0 }))])
    const v0 = p.geomVersion
    expect(p.geomVersion).toBe(v0)
    n = 3
    const v1 = p.geomVersion
    expect(v1).toBeGreaterThan(v0)
    expect(p.loops[0]!.length).toBe(4)
    expect(p.geomVersion).toBe(v1)
  })
})
