/**
 * ib-divide.test.ts — the S that splits a whole (vocabulary/Divide): two
 * half-circles stitched where they touch, the side test the half-fields are
 * clipped by, and the Web3 yin-yang importing it (one implementation).
 */

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import {
  Divide,
  FILM_TURN,
  clipRuns,
  flowerCircles,
  gridLines,
  onSideA,
  sCurve,
  turnedCurve,
  waist,
} from "../vocabulary/Divide/Divide"

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe("Divide", () => {
  test("the S runs from rim to rim through the touching point, every point on its lobe's circle", () => {
    for (const split of [0.5, 0.2, 0.875]) {
      const R = 300
      const pts = sCurve(split, R, 32)
      near(pts[0]!.x, -R)
      near(pts[pts.length - 1]!.x, R)
      const ra = split * R
      const rb = R - ra
      const mid = pts[32]!
      near(mid.x, waist(split, R))
      near(mid.y, 0)
      pts.slice(0, 33).forEach((p) => {
        near(Math.hypot(p.x + rb, p.y), ra)
        expect(p.y).toBeLessThanOrEqual(1e-9) // under A's centre
      })
      pts.slice(33).forEach((p) => {
        near(Math.hypot(p.x - ra, p.y), rb)
        expect(p.y).toBeGreaterThanOrEqual(-1e-9) // over B's centre
      })
    }
  })

  test("turn rotates the whole S rigidly", () => {
    const a = sCurve(0.5, 200, 16)
    const b = turnedCurve(0.5, 200, FILM_TURN, 16)
    a.forEach((p, i) => near(Math.hypot(p.x, p.y), Math.hypot(b[i]!.x, b[i]!.y)))
    // The film's lobe A sits lower-left, lobe B upper-right (f5851).
    const c = Math.cos(FILM_TURN)
    expect(onSideA({ x: -100 * c, y: -100 * c }, 0.5, 200, FILM_TURN)).toBe(true)
    expect(onSideA({ x: 100 * c, y: 100 * c }, 0.5, 200, FILM_TURN)).toBe(false)
  })

  test("the side test: each lobe's disc is its own side; the axis line splits the rest", () => {
    const R = 100
    expect(onSideA({ x: -50, y: 0 }, 0.5, R, 0)).toBe(true)
    expect(onSideA({ x: 50, y: 0 }, 0.5, R, 0)).toBe(false)
    expect(onSideA({ x: 0, y: 80 }, 0.5, R, 0)).toBe(true)
    expect(onSideA({ x: 0, y: -80 }, 0.5, R, 0)).toBe(false)
  })

  test("a clipped field's runs end on the S", () => {
    const R = 400
    const inside = (p: { x: number; y: number }) => onSideA(p, 0.5, R, FILM_TURN)
    const runs = gridLines(0.16 * R, R).flatMap((l) => clipRuns(l, inside))
    expect(runs.length).toBeGreaterThan(0)
    for (const run of runs) for (const p of run.slice(1, -1)) expect(inside(p)).toBe(true)
    // Flower circles share the triangular lattice: neighbours one radius apart.
    const circles = flowerCircles(50, 100)
    const centre = (c: { x: number; y: number }[]) => ({ x: (c[0]!.x + c[24]!.x) / 2, y: (c[0]!.y + c[24]!.y) / 2 })
    const cs = circles.map(centre)
    const o = cs.find((c) => Math.hypot(c.x, c.y) < 1e-6)!
    const nearest = cs.filter((c) => c !== o).map((c) => Math.hypot(c.x - o.x, c.y - o.y)).sort((a, b) => a - b)
    nearest.slice(0, 6).forEach((d) => near(d, 50, 1e-6))
  })

  test("the holon: its curve is the S; the split axis walks the exchange", () => {
    const d = new Divide({ radius: 250, split: 0.3, turn: 0.4, fieldA: "grid", fieldB: "flower" })
    void d.parts
    const pts = d.curve.points
    const ref = turnedCurve(0.3, 250, 0.4)
    expect(pts.length).toBe(ref.length)
    pts.forEach((p, i) => near(p.x, ref[i]!.x))
    expect(d.fields.length).toBe(2)
    const axis = d.stateAxis("split")
    expect(axis.positions.map((p) => p.name)).toEqual(["B swells", "even", "A swells"])
  })

  test("the Web3 yin-yang imports the one S", () => {
    const src = readFileSync(new URL("../demo/web3/YinYang.ts", import.meta.url), "utf8")
    expect(src).toContain('from "../../vocabulary/Divide/Divide"')
    expect(src).not.toMatch(/const sCurve\b/)
  })
})
