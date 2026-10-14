/**
 * Undo survives unrelated external edits (undo.ts rule 2): an outside
 * rewrite forgets only the inverses whose bytes it reached; the rest are
 * rebased past it and stay.
 */

import { describe, expect, test } from "bun:test"
import { UndoStack, changedRange, rebaseOp } from "../editor/undo"

const push = (stack: UndoStack, inverse: Record<string, unknown>) => stack.applied({ opId: `x${Math.random()}`, undo: inverse })
const A = "core/demo/A.ts"
const B = "core/demo/B.ts"

describe("changedRange — the one region two texts differ in, in old coordinates", () => {
  test("insert, delete, replace, identical", () => {
    expect(changedRange("abcdef", "abcXYdef")).toEqual({ start: 3, end: 3, delta: 2 })
    expect(changedRange("abcdef", "abef")).toEqual({ start: 2, end: 4, delta: -2 })
    expect(changedRange("abcdef", "abZZef")).toEqual({ start: 2, end: 4, delta: 0 })
    expect(changedRange("aaaa", "aaaaa")).toEqual({ start: 4, end: 4, delta: 1 })
    expect(changedRange("same", "same")).toBeUndefined()
  })
})

describe("rebaseOp — an inverse moved past an edit, or void when the edit reached it", () => {
  const r = { start: 100, end: 110, delta: 5 }
  test("spans before stay, spans after shift, spans touching void", () => {
    expect(rebaseOp({ op: "setRunTime", file: A, span: { start: 10, end: 50 } }, r)).toMatchObject({ span: { start: 10, end: 50 } })
    expect(rebaseOp({ op: "setRunTime", file: A, span: { start: 200, end: 230 } }, r)).toMatchObject({ span: { start: 205, end: 235 } })
    expect(rebaseOp({ op: "setRunTime", file: A, span: { start: 90, end: 105 } }, r)).toBeUndefined()
    expect(rebaseOp({ op: "setRunTime", file: A, span: { start: 110, end: 120 } }, r)).toMatchObject({ span: { start: 115, end: 125 } })
  })
  test("deleteSpan's also and insertSpan's at move with it; a backdrop inverse has no spans", () => {
    const del = rebaseOp({ op: "deleteSpan", file: A, span: { start: 300, end: 310 }, expect: "x", also: [{ span: { start: 5, end: 9 }, expect: "y" }] }, r)
    expect(del).toMatchObject({ span: { start: 305, end: 315 }, also: [{ span: { start: 5, end: 9 } }] })
    expect(rebaseOp({ op: "insertSpan", file: A, at: 120, text: "t" }, r)).toMatchObject({ at: 125 })
    expect(rebaseOp({ op: "insertSpan", file: A, at: 105, text: "t" }, r)).toBeUndefined()
    expect(rebaseOp({ op: "setBackdrop", file: A, path: "x" }, r)).toEqual({ op: "setBackdrop", file: A, path: "x" })
  })
  test("a pure insertion only voids a span it lands strictly inside", () => {
    const ins = { start: 50, end: 50, delta: 3 }
    expect(rebaseOp({ op: "setRunTime", span: { start: 40, end: 60 } }, ins)).toBeUndefined()
    expect(rebaseOp({ op: "setRunTime", span: { start: 50, end: 60 } }, ins)).toMatchObject({ span: { start: 53, end: 63 } })
    expect(rebaseOp({ op: "setRunTime", span: { start: 40, end: 50 } }, ins)).toMatchObject({ span: { start: 40, end: 50 } })
  })
})

describe("UndoStack.external — forget only what the edit touched", () => {
  test("another file's edit costs nothing", () => {
    const s = new UndoStack()
    push(s, { op: "setRunTime", file: A, span: { start: 10, end: 20 } })
    expect(s.external([{ file: B, range: { start: 0, end: 5, delta: 1 } }])).toBe(0)
    expect(s.depth.undo).toBe(1)
  })

  test("same file, elsewhere: rebased and kept; ⌘Z sends the shifted span", () => {
    const s = new UndoStack()
    push(s, { op: "setRunTime", file: A, span: { start: 200, end: 230 } })
    expect(s.external([{ file: A, range: { start: 0, end: 0, delta: 12 } }])).toBe(0)
    const out = s.undo()
    expect(out.kind === "sent" && out.op.span).toEqual({ start: 212, end: 242 })
  })

  test("an edit that reaches an entry forgets it and every older entry of that file — not the other file's", () => {
    const s = new UndoStack()
    push(s, { op: "setRunTime", file: A, span: { start: 10, end: 20 } }) // oldest A
    push(s, { op: "setRunTime", file: B, span: { start: 10, end: 20 } })
    push(s, { op: "setRunTime", file: A, span: { start: 100, end: 120 } }) // reached
    push(s, { op: "setRunTime", file: A, span: { start: 300, end: 320 } }) // newest A, clear of it
    expect(s.external([{ file: A, range: { start: 110, end: 115, delta: 0 } }])).toBe(2)
    expect(s.depth.undo).toBe(2)
    const first = s.undo()
    expect(first.kind === "sent" && [first.op.file, first.op.span]).toEqual([A, { start: 300, end: 320 }])
    const second = s.undo()
    expect(second.kind === "sent" && second.op.file).toBe(B)
  })

  test("no range known (the daemon never saw the old bytes): that file's history goes, said in the count", () => {
    const s = new UndoStack()
    push(s, { op: "setRunTime", file: A, span: { start: 10, end: 20 } })
    push(s, { op: "setRunTime", file: B, span: { start: 10, end: 20 } })
    expect(s.external([{ file: A }])).toBe(1)
    expect(s.depth.undo).toBe(1)
  })
})
