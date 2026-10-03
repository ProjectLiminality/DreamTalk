import { describe, expect, test } from "bun:test"
import { distillPaths, distillStrokes, type Pt } from "../sketch/distill"
import type { InkStroke } from "../sketch/protocol"
import { History, touched } from "../sketch/state"

// A seeded generator: the clusters are noisy but every run sees the same noise.
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r())

/** n loops around a circle, each with its own radius/centre wobble, as ONE stroke or several. */
const loops = (cx: number, cy: number, R: number, n: number, seed = 1, spread = 12): Pt[][] => {
  const r = rng(seed)
  const out: Pt[][] = []
  for (let k = 0; k < n; k++) {
    const dr = gauss(r) * spread
    const ox = gauss(r) * spread * 0.5
    const oy = gauss(r) * spread * 0.5
    const a0 = r() * Math.PI * 2
    const pts: Pt[] = []
    for (let i = 0; i <= 140; i++) {
      const a = a0 + (i / 140) * Math.PI * 2.1
      const rr = R + dr + gauss(r) * 0.6 + 4 * Math.sin(3 * a + k)
      pts.push({ x: cx + ox + rr * Math.cos(a), y: cy + oy + rr * Math.sin(a) })
    }
    out.push(pts)
  }
  return out
}

const sCurve = (t: number): Pt => ({ x: 300 + 80 * Math.sin(2 * Math.PI * t), y: 200 + 300 * t })

const nearestOn = (p: Pt, curve: (t: number) => Pt, steps = 600): number => {
  let d = Infinity
  for (let i = 0; i <= steps; i++) {
    const q = curve(i / steps)
    d = Math.min(d, Math.hypot(p.x - q.x, p.y - q.y))
  }
  return d
}

const timed = <T>(f: () => T): [T, number] => {
  const t0 = performance.now()
  const v = f()
  return [v, performance.now() - t0]
}

describe("distill", () => {
  test("ten overlapping loops → one closed loop on the mean radius", () => {
    const strokes = loops(500, 500, 300, 10, 7)
    const [paths, ms] = timed(() => distillPaths(strokes))
    expect(paths.length).toBe(1)
    const p = paths[0]!
    expect(p.closed).toBe(true)
    const radii = p.points.map((q) => Math.hypot(q.x - 500, q.y - 500))
    const mean = radii.reduce((a, b) => a + b, 0) / radii.length
    expect(Math.abs(mean - 300) / 300).toBeLessThan(0.03)
    // round, not lumpy: every point within the loops' own wobble of the mean
    for (const r of radii) expect(Math.abs(r - mean)).toBeLessThan(15)
    expect(ms).toBeLessThan(250) // generous for CI; typically far less
  })

  test("the loops drawn as ONE long stroke distil the same", () => {
    const one = loops(400, 400, 150, 8, 3).flat()
    const paths = distillPaths([one])
    expect(paths.length).toBe(1)
    expect(paths[0]!.closed).toBe(true)
  })

  test("a bundle of nearly parallel passes → one open curve near the true one", () => {
    const r = rng(11)
    const truth = (t: number): Pt => ({ x: 100 + 600 * t, y: 400 + 80 * Math.sin(Math.PI * t) })
    const strokes: Pt[][] = []
    for (let k = 0; k < 7; k++) {
      const off = gauss(r) * 6
      const t0 = r() * 0.05
      const t1 = 0.95 + r() * 0.05
      const pts: Pt[] = []
      for (let i = 0; i <= 120; i++) {
        const t = t0 + ((t1 - t0) * i) / 120
        const q = truth(t)
        pts.push({ x: q.x + gauss(r) * 0.5, y: q.y + off + gauss(r) * 0.5 })
      }
      strokes.push(pts)
    }
    const paths = distillPaths(strokes)
    expect(paths.length).toBe(1)
    const p = paths[0]!
    expect(p.closed).toBe(false)
    const ds = p.points.map((q) => nearestOn(q, truth))
    expect(Math.max(...ds)).toBeLessThan(8)
    // spans (nearly) the whole bundle, ends extended past the skeleton's shrinkage
    const xs = p.points.map((q) => q.x)
    expect(Math.min(...xs)).toBeLessThan(120)
    expect(Math.max(...xs)).toBeGreaterThan(680)
  })

  test("stippled dabs along an S → an open curve tracing it", () => {
    const r = rng(5)
    const strokes: Pt[][] = []
    for (let k = 0; k < 320; k++) {
      const c = sCurve(r())
      const x = c.x + gauss(r) * 7
      const y = c.y + gauss(r) * 7
      const a = r() * Math.PI
      const len = 4 + r() * 10
      strokes.push([
        { x, y },
        { x: x + Math.cos(a) * len, y: y + Math.sin(a) * len },
      ])
    }
    const paths = distillPaths(strokes)
    expect(paths.length).toBe(1)
    const p = paths[0]!
    expect(p.closed).toBe(false)
    const ds = p.points.map((q) => nearestOn(q, sCurve))
    expect(ds.reduce((a, b) => a + b, 0) / ds.length).toBeLessThan(5)
    // it covers the S end to end
    const ys = p.points.map((q) => q.y)
    expect(Math.min(...ys)).toBeLessThan(225)
    expect(Math.max(...ys)).toBeGreaterThan(475)
  })

  test("two separate clusters → two strokes", () => {
    const strokes = [...loops(300, 300, 100, 6, 2, 6), ...loops(800, 700, 140, 6, 9, 6)]
    const paths = distillPaths(strokes)
    expect(paths.length).toBe(2)
    expect(paths.every((p) => p.closed)).toBe(true)
    const centres = paths
      .map((p) => ({
        x: p.points.reduce((a, q) => a + q.x, 0) / p.points.length,
        y: p.points.reduce((a, q) => a + q.y, 0) / p.points.length,
      }))
      .sort((a, b) => a.x - b.x)
    expect(Math.hypot(centres[0]!.x - 300, centres[0]!.y - 300)).toBeLessThan(10)
    expect(Math.hypot(centres[1]!.x - 800, centres[1]!.y - 700)).toBeLessThan(10)
  })

  test("junctions: a crossing stays two strokes straight through; a T is a bar and a stem meeting it", () => {
    const bundle = (a: Pt, b: Pt, n: number, seed: number): Pt[][] => {
      const r = rng(seed)
      const L = Math.hypot(b.x - a.x, b.y - a.y)
      const nx = -(b.y - a.y) / L
      const ny = (b.x - a.x) / L
      return Array.from({ length: n }, () => {
        const off = gauss(r) * 5
        return Array.from({ length: 101 }, (_, i) => {
          const t = -0.02 + (1.04 * i) / 100
          return { x: a.x + (b.x - a.x) * t + nx * off + gauss(r) * 0.4, y: a.y + (b.y - a.y) * t + ny * off + gauss(r) * 0.4 }
        })
      })
    }
    const cross = distillPaths([...bundle({ x: 100, y: 100 }, { x: 500, y: 500 }, 5, 1), ...bundle({ x: 500, y: 100 }, { x: 100, y: 500 }, 5, 2)])
    expect(cross.length).toBe(2)
    for (const p of cross) {
      const a = p.points[0]!
      const b = p.points[p.points.length - 1]!
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(500) // corner to corner, not half of it
    }
    const tee = distillPaths([...bundle({ x: 100, y: 100 }, { x: 500, y: 100 }, 5, 3), ...bundle({ x: 300, y: 100 }, { x: 300, y: 450 }, 5, 4)])
    expect(tee.length).toBe(2)
    const [bar, stem] = [...tee].sort((p, q) => Math.abs(p.points[0]!.y - p.points[p.points.length - 1]!.y) - Math.abs(q.points[0]!.y - q.points[q.points.length - 1]!.y))
    const xs = bar!.points.map((q) => q.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(380)
    // the stem's top meets the bar
    const top = stem!.points.reduce((m, q) => (q.y < m.y ? q : m))
    expect(Math.abs(top.y - 100)).toBeLessThan(8)
  })

  test("a single clean stroke stays itself", () => {
    const line: Pt[] = Array.from({ length: 100 }, (_, i) => ({ x: 100 + 4 * i, y: 300 + 30 * Math.sin(i / 15) }))
    const paths = distillPaths([line])
    expect(paths.length).toBe(1)
    for (const q of paths[0]!.points) {
      const i = (q.x - 100) / 4
      expect(Math.abs(q.y - (300 + 30 * Math.sin(i / 15)))).toBeLessThan(2)
    }
  })

  test("distillStrokes: InkStrokes out, closed ones drawn closed, median pressure", () => {
    const ink: InkStroke[] = loops(500, 500, 200, 6, 4).map((pts, i) => ({
      id: `k${i}`,
      points: pts.map((p, j) => ({ ...p, pressure: 0.4 + (i % 2) * 0.2, t: 1000 + j })),
    }))
    let n = 0
    const out = distillStrokes(ink, () => `d${n++}`)
    expect(out.length).toBe(1)
    const k = out[0]!
    expect(k.id).toBe("d0")
    expect(k.points[0]!.x).toBeCloseTo(k.points[k.points.length - 1]!.x, 5)
    expect(new Set(k.points.map((p) => p.pressure)).size).toBe(1)
    for (let i = 1; i < k.points.length; i++) expect(k.points[i]!.t).toBeGreaterThan(k.points[i - 1]!.t)
  })

  test("nothing in, nothing out; a dot stays a dot", () => {
    expect(distillPaths([])).toEqual([])
    const dot = distillPaths([[{ x: 10, y: 10 }, { x: 10.5, y: 10.2 }]])
    expect(dot.length).toBe(1)
    expect(dot[0]!.points.length).toBe(1)
  })

  test("the distill command: in the first stroke's place, ONE undo step, exact", () => {
    const k = (id: string, x: number): InkStroke => ({ id, points: [{ x, y: 0, pressure: 0.5, t: 0 }, { x: x + 10, y: 0, pressure: 0.5, t: 1 }] })
    const a = k("a", 0)
    const b = k("b", 20)
    const c = k("c", 40)
    const d = k("d", 60)
    const h = new History({ strokes: [a, b, c, d], symbols: [] })
    const clean = k("clean", 30)
    const cmd = { kind: "distill" as const, ids: ["b", "d"], strokes: [clean] }
    h.do(cmd)
    expect(h.state.strokes.map((s) => s.id)).toEqual(["a", "clean", "c"])
    expect(touched(cmd)).toEqual(["clean"])
    h.undo()
    expect(h.state.strokes).toEqual([a, b, c, d])
    expect(h.state.strokes[1]).toBe(b)
  })
})
