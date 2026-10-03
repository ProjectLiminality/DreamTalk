/**
 * sketch-transform.test.ts — moving, turning and scaling what is on the
 * whiteboard (sketch/xform.ts, vocabulary.ts transformSymbol, the
 * `transform` command in state.ts).
 *
 * The promises: a symbol's params change the way its picture would — its
 * position orbits the pivot, its lengths scale, its page angle turns
 * clockwise — and a whole gesture is one undoable step.
 */

import { describe, expect, test } from "bun:test"
import { transformSymbol } from "../sketch/vocabulary"
import { History, transformStroke } from "../sketch/state"
import {
  composeSim,
  simApply,
  simFromPairs,
  simOf,
  xfFromSim,
  xfPoint,
  type Xf,
} from "../sketch/xform"
import type { InkStroke, PlacedSymbol } from "../sketch/protocol"

const sym = (symbol: string, params: Record<string, unknown>): PlacedSymbol => ({ id: "s", symbol, params, fromStrokes: [] })
const quarter = Math.PI / 2

describe("xform", () => {
  test("a positive page angle turns clockwise on the page (y down): +x goes to +y", () => {
    const q = xfPoint({ translate: { x: 0, y: 0 }, rotate: quarter, scale: 1, pivot: { x: 0, y: 0 } }, { x: 10, y: 0 })
    expect(q.x).toBeCloseTo(0, 9)
    expect(q.y).toBeCloseTo(10, 9)
  })

  test("Xf ↔ Sim describe the same map, about any pivot", () => {
    const xf: Xf = { translate: { x: 5, y: -3 }, rotate: 0.7, scale: 1.8, pivot: { x: 100, y: 40 } }
    const m = simOf(xf)
    for (const p of [{ x: 0, y: 0 }, { x: 300, y: -20 }]) {
      const a = xfPoint(xf, p)
      const b = simApply(m, p)
      expect(b.x).toBeCloseTo(a.x, 9)
      expect(b.y).toBeCloseTo(a.y, 9)
      const c = xfPoint(xfFromSim(m, { x: -50, y: 900 }), p)
      expect(c.x).toBeCloseTo(a.x, 9)
      expect(c.y).toBeCloseTo(a.y, 9)
    }
  })

  test("two fingers: pinch 2× and twist 30° about their midpoint", () => {
    const a0 = { x: 400, y: 600 }
    const b0 = { x: 600, y: 600 }
    const t = Math.PI / 6
    const mid = { x: 500, y: 600 }
    const a = { x: mid.x - 200 * Math.cos(t), y: mid.y - 200 * Math.sin(t) }
    const b = { x: mid.x + 200 * Math.cos(t), y: mid.y + 200 * Math.sin(t) }
    const xf = xfFromSim(simFromPairs(a0, b0, a, b), mid)
    expect(xf.scale).toBeCloseTo(2, 9)
    expect(xf.rotate).toBeCloseTo(t, 9)
    expect(xf.translate.x).toBeCloseTo(0, 9)
    expect(xf.translate.y).toBeCloseTo(0, 9)
  })

  test("segments compose: second ∘ first", () => {
    const first = simOf({ translate: { x: 10, y: 0 }, rotate: 0, scale: 1, pivot: { x: 0, y: 0 } })
    const second = simOf({ translate: { x: 0, y: 0 }, rotate: quarter, scale: 2, pivot: { x: 0, y: 0 } })
    const p = simApply(composeSim(second, first), { x: 0, y: 0 })
    expect(p.x).toBeCloseTo(0, 9)
    expect(p.y).toBeCloseTo(20, 9)
  })
})

describe("transformSymbol", () => {
  test("a circle rotated about an external pivot moves its centre; its radius stays", () => {
    const c = transformSymbol(sym("circle", { cx: 200, cy: 100, r: 50 }), { rotate: quarter, pivot: { x: 100, y: 100 } })
    expect(c.params.cx as number).toBeCloseTo(100, 9)
    expect(c.params.cy as number).toBeCloseTo(200, 9)
    expect(c.params.r).toBe(50)
  })

  test("scaling scales lengths and distances from the pivot, not position-free shape", () => {
    const c = transformSymbol(sym("circle", { cx: 200, cy: 100, r: 50 }), { scale: 3, pivot: { x: 100, y: 100 } })
    expect(c.params).toEqual({ cx: 400, cy: 100, r: 150 })
  })

  test("page angles add, clockwise-positive, wrapped into (−π, π]", () => {
    const sq = transformSymbol(sym("square", { cx: 0, cy: 0, size: 10, rotation: 0.1 }), { rotate: 0.2 })
    expect(sq.params.rotation as number).toBeCloseTo(0.3, 9)
    const eye = transformSymbol(sym("eye", { cx: 0, cy: 0, size: 10, rotation: 3 }), { rotate: 1 })
    expect(eye.params.rotation as number).toBeCloseTo(4 - 2 * Math.PI, 9)
    // The cube's in-plane bank turns; its 3D heading and pitch do not.
    const cube = transformSymbol(sym("cube", { cx: 0, cy: 0, size: 10, h: 0.6, p: 0.4, b: 0 }), { rotate: 0.5 })
    expect(cube.params).toMatchObject({ h: 0.6, p: 0.4, b: 0.5 })
  })

  test("scaling a mindVirus scales its body and its cable; heading turns with it", () => {
    const mv = sym("mindVirus", {
      x: 300, y: 200, size: 80, heading: 0, fold: 0.5,
      cable: [[100, 200], [200, 220]],
    })
    const out = transformSymbol(mv, { scale: 2, rotate: quarter, pivot: { x: 300, y: 200 } })
    expect(out.params.x).toBeCloseTo(300, 9)
    expect(out.params.size).toBe(160)
    expect(out.params.fold).toBe(0.5)
    expect(out.params.heading as number).toBeCloseTo(quarter, 9)
    const cable = out.params.cable as [number, number][]
    // (100,200) is 200 left of the pivot → twice as far, turned to straight up.
    expect(cable[0]![0]).toBeCloseTo(300, 9)
    expect(cable[0]![1]).toBeCloseTo(-200, 9)
    const len = (c: [number, number][]) => Math.hypot(c[1]![0] - c[0]![0], c[1]![1] - c[0]![1])
    expect(len(cable)).toBeCloseTo(2 * len(mv.params.cable as [number, number][]), 9)
  })

  test("{x, y} points keep their spelling and extra fields", () => {
    const out = transformSymbol(sym("unknownThing", { x: 0, y: 0, path: [{ x: 1, y: 2, w: 9 }] }), {
      translate: { x: 10, y: 10 },
    })
    expect(out.params).toEqual({ x: 10, y: 10, path: [{ x: 11, y: 12, w: 9 }] })
  })

  test("a figure has no angle: rotating about its own centre leaves it be", () => {
    const f = sym("figure", { cx: 50, cy: 60, height: 100 })
    const out = transformSymbol(f, { rotate: 1, pivot: { x: 50, y: 60 } })
    expect(out.params.cx as number).toBeCloseTo(50, 9)
    expect(out.params.cy as number).toBeCloseTo(60, 9)
    expect(out.params.height).toBe(100)
  })
})

describe("the transform command", () => {
  const stroke: InkStroke = {
    id: "k",
    points: [
      { x: 0, y: 0, pressure: 0.3, t: 1 },
      { x: 10, y: 0, pressure: 0.7, t: 2 },
    ],
  }

  test("strokes and symbols turn together about one pivot; one undo restores both", () => {
    const h = new History({ strokes: [stroke], symbols: [sym("circle", { cx: 20, cy: 0, r: 5 })] })
    const before = h.state
    h.do({ kind: "transform", ids: ["k", "s"], xf: { translate: { x: 0, y: 0 }, rotate: quarter, scale: 2, pivot: { x: 0, y: 0 } } })
    const k = h.state.strokes[0]!
    expect(k.points[1]!.x).toBeCloseTo(0, 9)
    expect(k.points[1]!.y).toBeCloseTo(20, 9)
    expect(k.points[1]!.pressure).toBe(0.7)
    const c = h.state.symbols[0]!
    expect(c.params.cx as number).toBeCloseTo(0, 9)
    expect(c.params.cy as number).toBeCloseTo(40, 9)
    expect(c.params.r).toBe(10)
    h.undo()
    expect(h.state).toBe(before)
  })

  test("transformStroke leaves its input untouched", () => {
    transformStroke(stroke, { translate: { x: 5, y: 5 }, rotate: 0, scale: 1, pivot: { x: 0, y: 0 } })
    expect(stroke.points[0]).toEqual({ x: 0, y: 0, pressure: 0.3, t: 1 })
  })
})
