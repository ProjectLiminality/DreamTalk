/**
 * sketch-state.test.ts — the sketchpad's page model (sketch/state.ts).
 *
 * The promise David leans on: a wrong replacement is one undo away, and
 * the scribble comes back EXACTLY — same objects, same order — so he can
 * pick a different reading. And the lasso catches what it visibly encloses.
 */

import { describe, expect, test } from "bun:test"
import {
  History,
  apply,
  emptyState,
  hitTest,
  lassoSelect,
  pointInPolygon,
  selectionBox,
  strokeInLasso,
  symbolBox,
  translateSymbol,
} from "../sketch/state"
import type { InkStroke, PlacedSymbol } from "../sketch/protocol"

const stroke = (id: string, pts: [number, number][]): InkStroke => ({
  id,
  points: pts.map(([x, y], i) => ({ x, y, pressure: 0.5, t: i })),
})

const wobblyCircle = (id: string, cx: number, cy: number, r: number): InkStroke =>
  stroke(
    id,
    Array.from({ length: 40 }, (_, i) => {
      const a = (i / 40) * Math.PI * 2
      const rr = r * (1 + 0.08 * Math.sin(5 * a))
      return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as [number, number]
    }),
  )

const circleSymbol: PlacedSymbol = {
  id: "sym-1",
  symbol: "circle",
  params: { cx: 400, cy: 500, r: 100 },
  fromStrokes: [],
}

const square = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

describe("the command stack", () => {
  test("replace removes the strokes and adds the symbol, recording what it replaced", () => {
    const h = new History()
    const a = wobblyCircle("a", 400, 500, 100)
    const b = stroke("b", [[10, 10], [20, 20]])
    h.do({ kind: "addStroke", stroke: a })
    h.do({ kind: "addStroke", stroke: b })
    h.do({ kind: "replace", ids: ["a"], symbol: circleSymbol })
    expect(h.state.strokes.map((k) => k.id)).toEqual(["b"])
    expect(h.state.symbols).toHaveLength(1)
    expect(h.state.symbols[0]!.fromStrokes).toEqual(["a"])
  })

  test("undoing a replacement restores the strokes exactly, in one step", () => {
    const h = new History()
    const a = wobblyCircle("a", 400, 500, 100)
    const b = stroke("b", [[10, 10], [20, 20]])
    const c = stroke("c", [[30, 30], [40, 40]])
    for (const k of [a, b, c]) h.do({ kind: "addStroke", stroke: k })
    const before = h.state
    h.do({ kind: "replace", ids: ["a", "c"], symbol: circleSymbol })
    const cmd = h.undo()
    expect(cmd?.kind).toBe("replace")
    expect(h.state).toBe(before)
    expect(h.state.strokes[0]).toBe(a) // the very same object
    expect(h.state.strokes.map((k) => k.id)).toEqual(["a", "b", "c"])
    expect(h.state.symbols).toEqual([])
  })

  test("redo reapplies; a new command clears the redo branch", () => {
    const h = new History()
    h.do({ kind: "addStroke", stroke: wobblyCircle("a", 400, 500, 100) })
    h.do({ kind: "replace", ids: ["a"], symbol: circleSymbol })
    const after = h.state
    h.undo()
    expect(h.canRedo).toBe(true)
    h.redo()
    expect(h.state).toBe(after)
    h.undo()
    h.do({ kind: "addStroke", stroke: stroke("z", [[0, 0]]) })
    expect(h.canRedo).toBe(false)
  })

  test("undo then a different pick: the second reading replaces the same strokes", () => {
    const h = new History()
    h.do({ kind: "addStroke", stroke: wobblyCircle("a", 400, 500, 100) })
    h.do({ kind: "replace", ids: ["a"], symbol: circleSymbol })
    h.undo()
    h.do({ kind: "replace", ids: ["a"], symbol: { ...circleSymbol, id: "sym-2", symbol: "square" } })
    expect(h.state.strokes).toEqual([])
    expect(h.state.symbols.map((s) => s.symbol)).toEqual(["square"])
  })

  test("delete, erase, move, clear are pure and undoable", () => {
    const h = new History()
    const a = stroke("a", [[0, 0], [10, 0]])
    h.do({ kind: "addStroke", stroke: a })
    const s0 = h.state
    const s1 = apply(s0, { kind: "move", ids: ["a"], dx: 5, dy: 7 })
    expect(s1.strokes[0]!.points[1]).toMatchObject({ x: 15, y: 7 })
    expect(a.points[1]).toMatchObject({ x: 10, y: 0 }) // input untouched
    h.do({ kind: "erase", ids: ["a"] })
    expect(h.state.strokes).toEqual([])
    h.undo()
    expect(h.state).toBe(s0)
    h.do({ kind: "clear" })
    expect(h.state).toEqual(emptyState())
    h.undo()
    expect(h.state).toBe(s0)
  })

  test("moving a symbol shifts its position and path, not its shape", () => {
    const mv: PlacedSymbol = {
      id: "mv",
      symbol: "mindVirus",
      params: { x: 100, y: 200, size: 80, fold: 0.5, heading: 1, cable: [[0, 0], [50, 60]] },
      fromStrokes: [],
    }
    const moved = translateSymbol(mv, 10, -20)
    expect(moved.params).toEqual({ x: 110, y: 180, size: 80, fold: 0.5, heading: 1, cable: [[10, -20], [60, 40]] })
  })
})

describe("hit-testing", () => {
  test("point in polygon", () => {
    const poly = square(0, 0, 100, 100)
    expect(pointInPolygon({ x: 50, y: 50 }, poly)).toBe(true)
    expect(pointInPolygon({ x: 150, y: 50 }, poly)).toBe(false)
  })

  test("a stroke is lassoed when most of its points are inside", () => {
    const poly = square(0, 0, 100, 100)
    const mostlyIn = stroke("m", [[10, 10], [20, 20], [30, 30], [150, 30]])
    const mostlyOut = stroke("o", [[10, 10], [150, 20], [160, 30], [170, 30]])
    expect(strokeInLasso(mostlyIn, poly)).toBe(true)
    expect(strokeInLasso(mostlyOut, poly)).toBe(false)
  })

  test("lassoSelect catches enclosed strokes and symbols, nothing else", () => {
    const state = {
      strokes: [wobblyCircle("in", 400, 500, 100), wobblyCircle("out", 1000, 1500, 80)],
      symbols: [circleSymbol, { ...circleSymbol, id: "far", params: { cx: 1100, cy: 300, r: 40 } }],
    }
    const ids = lassoSelect(state, square(250, 350, 550, 650))
    expect(ids.sort()).toEqual(["in", "sym-1"])
  })

  test("hitTest finds the symbol under a point, then the nearest stroke", () => {
    const state = { strokes: [stroke("s", [[0, 0], [100, 0]])], symbols: [circleSymbol] }
    expect(hitTest(state, { x: 400, y: 500 })).toBe("sym-1")
    expect(hitTest(state, { x: 50, y: 6 })).toBe("s")
    expect(hitTest(state, { x: 50, y: 60 })).toBeUndefined()
  })

  test("symbol and selection boxes are in page units", () => {
    expect(symbolBox(circleSymbol)).toEqual({ x: 300, y: 400, w: 200, h: 200 })
    const state = { strokes: [stroke("s", [[0, 0], [100, 50]])], symbols: [circleSymbol] }
    expect(selectionBox(state, new Set(["s", "sym-1"]))).toEqual({ x: 0, y: 0, w: 500, h: 600 })
  })
})
