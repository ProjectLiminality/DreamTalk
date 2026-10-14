/**
 * Correspond (src/geometry/correspond.ts) — N curves into M, by arc length.
 *
 * What must hold, whatever the strategy:
 *  1. LENGTH: every target is covered exactly once, every source is used
 *     exactly once, and each source's share of the target ink equals its
 *     share of the source ink (snap 0).
 *  2. ENDS: the blend at u = 0 IS the sources, at u = 1 IS the targets —
 *     for any lag.
 *  3. DETERMINISM: same input, same pieces, bit for bit; and for the
 *     angular order, the INPUT ORDER does not matter.
 *  4. N < M, N > M, N = M all work; a point grows into a shape.
 */

import { describe, expect, test } from "bun:test"
import {
  blendPlan,
  correspond,
  crossingsOf,
  cumulative,
  planMorph,
  totalLength,
  type Curve,
} from "../src/geometry/correspond"
import type { Vec3Like } from "../src/parts/primitives"

const arc = (cx: number, cy: number, r: number, a0: number, sweep: number, n = 32): Vec3Like[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + (sweep * i) / n
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), z: 0 }
  })
const circle = (cx: number, cy: number, r: number, n = 128) => arc(cx, cy, r, 0, 2 * Math.PI, n)
const seg = (a: Vec3Like, b: Vec3Like): Vec3Like[] => [a, b]
const len = (c: Curve) => cumulative(c).at(-1)!

const ARCS = [
  arc(-300, 100, 40, 0, 2),
  arc(200, -150, 60, 1, 3),
  arc(300, 200, 30, 3, 2),
  arc(-250, -220, 90, 4, 1.2),
  arc(0, 320, 50, 3.5, 2.5),
]
// A box's front face edges + a 3D diagonal: varied lengths, not all in a plane.
const EDGES = [
  seg({ x: -100, y: -60, z: 0 }, { x: 100, y: -60, z: 0 }),
  seg({ x: 100, y: -60, z: 0 }, { x: 100, y: 60, z: 0 }),
  seg({ x: 100, y: 60, z: 0 }, { x: -100, y: 60, z: 0 }),
  seg({ x: -100, y: 60, z: 0 }, { x: -100, y: -60, z: 0 }),
  seg({ x: 100, y: 60, z: 0 }, { x: 160, y: 100, z: -80 }),
  seg({ x: -100, y: 60, z: 0 }, { x: -40, y: 100, z: -80 }),
]

/** Per-curve coverage: the union of the intervals the pieces claim on each curve. */
const coverage = (
  pieces: readonly { source: number; from: readonly [number, number]; target: number; to: readonly [number, number] }[],
  side: "source" | "target",
  count: number,
): number[] => {
  const out = Array<number>(count).fill(0)
  for (const p of pieces) {
    const [a, b] = side === "source" ? p.from : p.to
    out[side === "source" ? p.source : p.target]! += Math.abs(b - a)
  }
  return out
}

const cases: [string, Curve[], Curve[]][] = [
  ["N > M (arcs → circle)", ARCS, [circle(0, 0, 150)]],
  ["N < M (circle → edges)", [circle(0, 0, 40)], EDGES],
  ["N = M", EDGES.slice(0, 4), ARCS.slice(0, 4)],
  ["N > M > 1", ARCS, EDGES.slice(0, 3)],
]

describe("length conservation", () => {
  for (const [name, src, tgt] of cases) {
    for (const order of ["angular", "sweep", "given"] as const) {
      test(`${name}, ${order}: every curve covered exactly once`, () => {
        const { pieces } = correspond(src, tgt, { order })
        const s = coverage(pieces, "source", src.length)
        const t = coverage(pieces, "target", tgt.length)
        src.forEach((c, i) => expect(s[i]!).toBeCloseTo(len(c), 6))
        tgt.forEach((c, i) => expect(t[i]!).toBeCloseTo(len(c), 6))
      })
      test(`${name}, ${order}: shares are proportional`, () => {
        const { pieces } = correspond(src, tgt, { order })
        const S = totalLength(src)
        const T = totalLength(tgt)
        for (const p of pieces) {
          const fs = Math.abs(p.from[1] - p.from[0]) / S
          const ft = Math.abs(p.to[1] - p.to[0]) / T
          expect(ft).toBeCloseTo(fs, 6)
        }
      })
      test(`${name}, ${order}: at most N + M pieces`, () => {
        const { pieces } = correspond(src, tgt, { order })
        expect(pieces.length).toBeLessThanOrEqual(src.length + tgt.length)
        expect(pieces.length).toBeGreaterThanOrEqual(Math.max(src.length, tgt.length))
      })
    }
  }

  test("the blend's total length runs from the sources' to the targets'", () => {
    const plan = planMorph(ARCS, [circle(0, 0, 150)])
    expect(totalLength(blendPlan(plan, 0))).toBeCloseTo(totalLength(ARCS), 6)
    expect(totalLength(blendPlan(plan, 1))).toBeCloseTo(len(circle(0, 0, 150)), 6)
  })
})

describe("ends are exact", () => {
  for (const lag of [0, 0.5, 1]) {
    test(`u = 0 is the sources and u = 1 the targets, lag ${lag}`, () => {
      const plan = planMorph([circle(0, 0, 40)], EDGES)
      const near = (p: Vec3Like, curves: Curve[]) =>
        Math.min(
          ...curves.flatMap((c) =>
            c.slice(1).map((b, i) => {
              const a = c[i]!
              const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
              const l2 = ab.x ** 2 + ab.y ** 2 + ab.z ** 2 || 1
              const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / l2))
              return Math.hypot(p.x - a.x - ab.x * t, p.y - a.y - ab.y * t, p.z - a.z - ab.z * t)
            }),
          ),
        )
      for (const c of blendPlan(plan, 0, lag)) for (const p of c) expect(near(p, [circle(0, 0, 40)])).toBeLessThan(1e-6)
      for (const c of blendPlan(plan, 1, lag)) for (const p of c) expect(near(p, EDGES)).toBeLessThan(1e-6)
    })
  }

  test("a target's corner survives: its vertices are among the blend's points at u = 1", () => {
    const square: Curve = [
      { x: -50, y: -50, z: 0 },
      { x: 50, y: -50, z: 0 },
      { x: 50, y: 50, z: 0 },
      { x: -50, y: 50, z: 0 },
      { x: -50, y: -50, z: 0 },
    ]
    const out = blendPlan(planMorph([circle(0, 0, 30)], [square]), 1).flat()
    for (const v of square)
      expect(out.some((p) => Math.hypot(p.x - v.x, p.y - v.y, p.z - v.z) < 1e-9)).toBe(true)
  })
})

describe("determinism", () => {
  test("same input, same pieces", () => {
    const a = JSON.stringify(correspond(ARCS, EDGES))
    const b = JSON.stringify(correspond(ARCS, EDGES))
    expect(a).toBe(b)
  })

  test("angular order is independent of input order", () => {
    const perm = [3, 0, 4, 1, 2]
    const a = correspond(ARCS, [circle(0, 0, 150)])
    const b = correspond(perm.map((i) => ARCS[i]!), [circle(0, 0, 150)])
    const key = (pieces: typeof a.pieces, map: (i: number) => number) =>
      pieces
        .map((p) => [map(p.source), p.from.map((x) => x.toFixed(6)), p.to.map((x) => x.toFixed(6))].join("|"))
        .sort()
    expect(key(b.pieces, (i) => perm[i]!)).toEqual(key(a.pieces, (i) => i))
  })
})

describe("strategies", () => {
  test("angular: each arc lands on the side of the circle it came from", () => {
    const plan = planMorph(ARCS, [circle(0, 0, 150)])
    const mean = (ps: Vec3Like[]) => ({
      x: ps.reduce((s, p) => s + p.x, 0) / ps.length,
      y: ps.reduce((s, p) => s + p.y, 0) / ps.length,
    })
    // Pieces of the same source, weighted by size, should point the same way.
    for (const p of plan.pieces) {
      if (p.from.length < 4) continue
      const a = mean(p.from)
      const b = mean(p.to)
      const da = Math.atan2(a.y, a.x)
      const db = Math.atan2(b.y, b.x)
      const diff = Math.abs(Math.atan2(Math.sin(da - db), Math.cos(da - db)))
      expect(diff).toBeLessThan(Math.PI / 2)
    }
  })

  test("given: order and direction untouched, no rotation", () => {
    const { pieces, offset } = correspond(EDGES.slice(0, 2), [seg({ x: 0, y: 0, z: 0 }, { x: 300, y: 0, z: 0 })], {
      order: "given",
    })
    expect(offset).toBe(0)
    expect(pieces.map((p) => p.source)).toEqual([0, 1])
    expect(pieces[0]!.to[0]).toBe(0)
    expect(pieces[0]!.from[0]).toBe(0)
    expect(pieces[1]!.to[1]).toBeCloseTo(300, 9)
  })

  test("snap: a single closed target's seam moves onto a source boundary — N pieces, no split", () => {
    const exact = correspond(ARCS, [circle(0, 0, 150)])
    const snapped = correspond(ARCS, [circle(0, 0, 150)], { snap: 0.5 })
    expect(exact.pieces.length).toBe(ARCS.length + 1)
    expect(snapped.pieces.length).toBe(ARCS.length)
    // Each arc is now whole.
    expect(new Set(snapped.pieces.map((p) => p.source)).size).toBe(ARCS.length)
  })

  test("snap groups whole sources onto targets when N > M", () => {
    const { pieces } = correspond(ARCS, EDGES.slice(0, 2), { order: "given", snap: 0.5 })
    // Every source appears exactly once — none is shaved across two targets.
    expect(pieces.length).toBe(ARCS.length)
  })
})

describe("degenerate inputs", () => {
  test("a point grows into a shape: the whole target, from one point", () => {
    const point: Curve = [{ x: 5, y: 5, z: 5 }]
    const plan = planMorph([point], EDGES)
    expect(totalLength(blendPlan(plan, 1))).toBeCloseTo(totalLength(EDGES), 6)
    for (const c of blendPlan(plan, 0)) for (const p of c) expect(p).toEqual({ x: 5, y: 5, z: 5 })
  })

  test("an empty side yields no pieces", () => {
    expect(correspond([], EDGES).pieces).toEqual([])
    expect(correspond(EDGES, []).pieces).toEqual([])
  })
})

describe("rigid-then-deform travel", () => {
  const { blendTravel, chainCurves } = require("../src/geometry/correspond") as typeof import("../src/geometry/correspond")
  const plan = planMorph(ARCS, EDGES, { normal: { x: 0, y: 0, z: 1 } })

  for (const stagger of [0, 0.4]) {
    test(`exact at both ends (stagger ${stagger}), offsets included`, () => {
      const at0 = blendTravel(plan, 0, { stagger })
      const at1 = blendTravel(plan, 1, { stagger })
      plan.pieces.forEach((p, i) => {
        at0[i]!.forEach((q, j) => expect(Math.hypot(q.x - p.from[j]!.x, q.y - p.from[j]!.y, q.z - p.from[j]!.z)).toBeLessThan(1e-9))
        at1[i]!.forEach((q, j) => expect(Math.hypot(q.x - p.to[j]!.x, q.y - p.to[j]!.y, q.z - p.to[j]!.z)).toBeLessThan(1e-9))
      })
      const off = { from: { x: 10, y: 0, z: 0 }, to: { x: 0, y: -5, z: 2 } }
      const moved = blendTravel(plan, 1, { stagger, offset: off })
      expect(moved[0]![0]!.y).toBeCloseTo(plan.pieces[0]!.to[0]!.y - 5, 9)
    })
  }

  test("mid-flight, a piece is still ONE polyline of its own point count, and pieces leave in stagger order", () => {
    const mid = blendTravel(plan, 0.3, { stagger: 0.6, axis: { x: 1, y: 0, z: 0 } })
    plan.pieces.forEach((p, i) => expect(mid[i]!.length).toBe(p.from.length))
    const keyOf = (i: number) => plan.pieces[i]!.motion.ct.x
    const moved = (i: number) => mid[i]!.some((q, j) => Math.hypot(q.x - plan.pieces[i]!.from[j]!.x, q.y - plan.pieces[i]!.from[j]!.y) > 1e-6)
    const order = plan.pieces.map((_, i) => i).sort((a, b) => keyOf(a) - keyOf(b))
    // The leftmost-bound piece has left; the rightmost has not yet.
    expect(moved(order[0]!)).toBe(true)
    expect(moved(order[order.length - 1]!)).toBe(false)
  })

  test("chainCurves joins curves that meet, keeps length, leaves closed ones alone", () => {
    const sq = [
      [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }],
      [{ x: 10, y: 10, z: 0 }, { x: 10, y: 0, z: 0 }], // reversed on purpose
      [{ x: 10, y: 10, z: 0 }, { x: 0, y: 10, z: 0 }],
      circle(50, 50, 5),
    ]
    const { curves, members } = chainCurves(sq, 1e-6)
    expect(curves.length).toBe(2)
    expect(members[0]).toEqual([0, 1, 2])
    expect(len(curves[0]!)).toBeCloseTo(30, 9)
    expect(curves[1]!.length).toBe(circle(50, 50, 5).length)
  })

  test("sweep-angular merges stretches that continue each other on both sides", () => {
    const one = [arc(0, 0, 100, 0, Math.PI)]
    const { pieces } = correspond(one, [circle(0, 0, 50)], { order: "sweep-angular" })
    expect(pieces.length).toBeLessThanOrEqual(2)
  })
})

describe("nearest order", () => {
  // Relations: arcs from sites scattered round a hub, all converging on it,
  // bowing to one side — GeoFlow's relation arcs → the group's circle.
  const hub = { x: 0, y: 0, z: 0 }
  const sites = [
    [-73, 57], [86, -112], [-126, 19], [231, -197], [-75, 165], [-261, -123], [-75, 124], [-108, 144], [21, -100], [117, 104],
  ].map(([x, y]) => ({ x: x!, y: y!, z: 0 }))
  const arcs = sites.map((s) =>
    Array.from({ length: 33 }, (_, i) => {
      const t = i / 32
      const mx = (s.x + hub.x) / 2 - (hub.y - s.y) * 0.25
      const my = (s.y + hub.y) / 2 + (hub.x - s.x) * 0.25
      return {
        x: (1 - t) ** 2 * s.x + 2 * t * (1 - t) * mx + t * t * hub.x,
        y: (1 - t) ** 2 * s.y + 2 * t * (1 - t) * my + t * t * hub.y,
        z: 0,
      }
    }),
  )
  const ring = Array.from({ length: 129 }, (_, i) => ({
    x: 220 * Math.cos((i / 128) * 2 * Math.PI),
    y: -40 + 220 * Math.sin((i / 128) * 2 * Math.PI),
    z: 0,
  }))

  test("arcs converging on one place land uncrossed — fewer crossed paths than angular", () => {
    const near = correspond(arcs, [ring], { order: "nearest" })
    const ang = correspond(arcs, [ring], { order: "angular" })
    const xn = crossingsOf(near, arcs, [ring])
    const xa = crossingsOf(ang, arcs, [ring])
    expect([xa, xn]).toEqual([2, 0])
    // still a correspondence: every bit of the ring covered exactly once
    const covered = near.pieces.reduce((s, p) => s + Math.abs(p.to[1] - p.to[0]), 0)
    expect(covered).toBeCloseTo(cumulative(ring).at(-1)!, 3)
  })

  test("the default; where angular is as good (shapes ringing one centre) the plan IS angular's", () => {
    const around = Array.from({ length: 8 }, (_, k) =>
      Array.from({ length: 9 }, (_, i) => {
        const a = ((k + i / 8 * 0.7) / 8) * 2 * Math.PI
        return { x: 300 * Math.cos(a), y: 300 * Math.sin(a), z: 0 }
      }),
    )
    expect(correspond(around, [ring])).toEqual(correspond(around, [ring], { order: "angular" }))
    expect(correspond(around, [ring], { order: "nearest" })).toEqual(correspond(around, [ring], { order: "angular" }))
  })
})
