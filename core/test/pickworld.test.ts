import { describe, expect, test } from "bun:test"
import {
  boxDistance,
  boxFarthest,
  pointSegment,
  pointTriangle,
  raySegment,
  rayNearBox,
  rayTriangle,
  worldBox,
} from "../src/render/pickworld"

const random = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
type P = [number, number, number]
const lerp = (a: P, b: P, u: number): P => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]
const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

describe("3D pick geometry agrees with brute force", () => {
  const rnd = random(5)
  const pt = (s = 100): P => [rnd() * s, rnd() * s, rnd() * s]

  test("point–segment", () => {
    for (let k = 0; k < 300; k++) {
      const [p, a, b] = [pt(), pt(), pt()]
      let brute = Infinity
      for (let i = 0; i <= 2000; i++) brute = Math.min(brute, dist(p, lerp(a, b, i / 2000)))
      const [d] = pointSegment(...p, ...a, ...b)
      expect(d).toBeLessThanOrEqual(brute + 1e-9)
      expect(d).toBeGreaterThan(brute - 0.2)
    }
  })

  test("ray–segment (closest approach on a capped ray)", () => {
    for (let k = 0; k < 200; k++) {
      const o = pt()
      const dir = pt(1)
      const n = Math.hypot(...dir)
      const d: P = [dir[0] / n, dir[1] / n, dir[2] / n]
      const tMax = 50 + Math.abs(rnd()) * 150
      const [a, b] = [pt(), pt()]
      let brute = Infinity
      for (let i = 0; i <= 400; i++)
        for (let j = 0; j <= 100; j++) brute = Math.min(brute, dist(lerp(o, [o[0] + d[0] * tMax, o[1] + d[1] * tMax, o[2] + d[2] * tMax], i / 400), lerp(a, b, j / 100)))
      const [got, t, u] = raySegment(...o, ...d, tMax, ...a, ...b)
      expect(got).toBeLessThanOrEqual(brute + 1e-6)
      expect(got).toBeGreaterThan(brute - 2)
      expect(t).toBeGreaterThanOrEqual(0)
      expect(t).toBeLessThanOrEqual(tMax)
      expect(dist([o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t], lerp(a, b, u))).toBeCloseTo(got, 6)
    }
  })

  test("point–triangle", () => {
    for (let k = 0; k < 300; k++) {
      const [p, a, b, c] = [pt(), pt(), pt(), pt()]
      let brute = Infinity
      for (let i = 0; i <= 60; i++)
        for (let j = 0; j <= 60 - i; j++) {
          const u = i / 60
          const v = j / 60
          const q: P = [a[0] + (b[0] - a[0]) * u + (c[0] - a[0]) * v, a[1] + (b[1] - a[1]) * u + (c[1] - a[1]) * v, a[2] + (b[2] - a[2]) * u + (c[2] - a[2]) * v]
          brute = Math.min(brute, dist(p, q))
        }
      const [d] = pointTriangle(p, a, b, c)
      expect(d).toBeLessThanOrEqual(brute + 1e-9)
      expect(d).toBeGreaterThan(brute - 3)
    }
  })

  test("ray–triangle hits where the ray crosses the plane inside, misses outside", () => {
    const a: P = [0, 0, 0]
    const b: P = [10, 0, 0]
    const c: P = [0, 10, 0]
    expect(rayTriangle([2, 2, 5], [0, 0, -1], a, b, c)).toBeCloseTo(5)
    expect(rayTriangle([2, 2, -5], [0, 0, 1], a, b, c)).toBeCloseTo(5) // two-sided
    expect(rayTriangle([8, 8, 5], [0, 0, -1], a, b, c)).toBeUndefined()
    expect(rayTriangle([2, 2, 5], [0, 0, 1], a, b, c)).toBeUndefined() // behind the origin
  })

  test("world boxes contain every transformed point; ray-box entry is conservative", () => {
    for (let k = 0; k < 100; k++) {
      const c = [Math.cos(rnd() * 3), Math.sin(rnd() * 3)]
      const s = 0.5 + Math.abs(rnd()) * 2
      const m = [c[0]! * s, c[1]! * s, 0, 0, -c[1]! * s, c[0]! * s, 0, 0, 0, 0, s, 0, rnd() * 50, rnd() * 50, rnd() * 50, 1]
      const box = new Float32Array([-10, -20, -5, 10, 20, 5])
      const w = new Float64Array(6)
      worldBox(box, 0, m, w)
      for (let i = 0; i < 20; i++) {
        const x = rnd() * 10
        const y = rnd() * 20
        const z = rnd() * 5
        const q = [m[0]! * x + m[4]! * y + m[8]! * z + m[12]!, m[1]! * x + m[5]! * y + m[9]! * z + m[13]!, m[2]! * x + m[6]! * y + m[10]! * z + m[14]!]
        expect(boxDistance(w, 0, q[0]!, q[1]!, q[2]!)).toBeLessThan(1e-4)
        expect(boxFarthest(w, 0, 0, 0, 0)).toBeGreaterThanOrEqual(Math.hypot(q[0]!, q[1]!, q[2]!) - 1e-4)
      }
    }
    const b = new Float64Array([0, 0, 0, 1, 1, 1])
    expect(rayNearBox(b, 0, -5, 0.5, 0.5, 1, 0, 0, 100, 0)).toBeCloseTo(5)
    expect(rayNearBox(b, 0, -5, 3, 0.5, 1, 0, 0, 100, 0)).toBeNaN()
    expect(rayNearBox(b, 0, -5, 3, 0.5, 1, 0, 0, 100, 2.5)).toBeCloseTo(2.5) // within the pad
    expect(rayNearBox(b, 0, -5, 0.5, 0.5, 1, 0, 0, 3, 0)).toBeNaN() // capped short of it
  })
})
