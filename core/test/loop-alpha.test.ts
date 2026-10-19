import { describe, expect, test } from "bun:test"
import * as THREE from "three/webgpu"
import { RibbonStroke } from "../src/render/ribbon"

// Per-loop alpha, per-loop pen and per-loop fronts on one ribbon (a Polylines' mesh).
const v = (x: number, y: number) => new THREE.Vector3(x, y, 0)
const loops = [
  [v(0, 0), v(10, 0), v(10, 10)], // 20 long
  [v(0, 20), v(5, 20)], // 5 long
]
const read = (r: RibbonStroke, name: string) => {
  const a = r.geometry.getAttribute(name) as THREE.InterleavedBufferAttribute | THREE.InstancedBufferAttribute
  return Array.from((("data" in a ? a.data.array : a.array) as Float32Array).slice(0, r.geometry.instanceCount * ("data" in a ? 2 : 1)))
}

describe("RibbonStroke loops", () => {
  test("alpha is 1 everywhere unless stated, one value per loop when stated, reset by a new shape", () => {
    const r = new RibbonStroke(2)
    r.setLoops(loops)
    expect(read(r, "instanceAlpha")).toEqual([1, 1, 1])
    r.setLoopAlphas([0.5, 0])
    expect(read(r, "instanceAlpha")).toEqual([0.5, 0.5, 0])
    r.setLoops(loops)
    expect(read(r, "instanceAlpha")).toEqual([1, 1, 1])
    r.setLoopAlphas([0.25, 1])
    r.setPoints([v(0, 0), v(1, 0)])
    expect(read(r, "instanceAlpha").every((a) => a === 1)).toBe(true)
  })
  test("plain loops run one arc on across the gaps; a per-loop pen restarts each loop at 0 and ends it at 1", () => {
    const r = new RibbonStroke(2)
    r.setLoops(loops)
    expect(read(r, "instanceDistanceStart")).toEqual([0, 10, 10, 20, 20, 25])
    expect(r.totalLength).toBe(25)
    r.setLoops(loops, { perLoopPen: true })
    expect(read(r, "instanceDistanceStart")).toEqual([0, 0.5, 0.5, 1, 0, 1])
    expect(r.totalLength).toBe(1)
  })
  test("fronts: the one draw fraction lands on each loop's own front; 0 hides a loop; undefined restores", () => {
    const r = new RibbonStroke(2)
    r.setLoops(loops, { perLoopPen: true })
    r.setLoopFronts([0.25, 0], 0.5)
    const d = read(r, "instanceDistanceStart")
    // Loop 0 scaled by 0.5 / 0.25: the front (0.5) is a quarter along it.
    expect(d.slice(0, 4)).toEqual([0, 1, 1, 2])
    // Loop 1 starts past any front.
    expect(Math.min(...d.slice(4))).toBeGreaterThan(1)
    r.setLoopFronts(undefined, 0.5)
    expect(read(r, "instanceDistanceStart")).toEqual([0, 0.5, 0.5, 1, 0, 1])
  })
})
