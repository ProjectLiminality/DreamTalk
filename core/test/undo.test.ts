/**
 * The undo stack, and the inverse-capture it rests on.
 *
 * Two halves, tested separately because they are separately true:
 *   - the READERS in scripts/ops.ts, which see what an op is about to
 *     replace (round-tripped against the writers: apply the op, apply its
 *     inverse, expect the original bytes back);
 *   - the STACK in editor/undo.ts, which is pure bookkeeping over op
 *     descriptors and knows nothing about what an op means.
 */

import { describe, expect, test } from "bun:test"
import {
  applyAppendCheckpoint,
  applyDeleteSpan,
  applyInsertSpan,
  applySetBackdrop,
  applySetOverride,
  applySetRunTime,
  changedSpans,
  insertedSpan,
  readBackdrop,
  readOverride,
  readRunTime,
  type DeleteSpanOp,
  type InsertSpanOp,
} from "../scripts/ops"
import { UndoStack, labelOf, undoAction } from "../editor/undo"

const scene = `/**
 * S02.ts — A DreamWeaving
 */

import { Dream, Circle, Create, render } from "../src/index"

export class S02Dream extends Dream {
  circle = new Circle({ radius: 2, x: 0 })
  eye = new Eye({ x: 3 })

  unfold() {
    this.backdrop("refs/video-01/DialecticalThinking.mkv", { offset: 82 })
    this.play(Create(this.circle), 2)
    this.wait(1)
  }
}

if (import.meta.main) render(S02Dream)
`

/** The span of a `new X({…})` in the text, the way the build anchors it. */
const spanOf = (source: string, construction: string) => {
  const start = source.indexOf(construction)
  if (start < 0) throw new Error(`no such construction: ${construction}`)
  return { start, end: start + construction.length }
}

const spanOfCall = (source: string, call: string) => spanOf(source, call)

describe("readOverride — what a setOverride is about to replace", () => {
  test("reads the standing numeric literal", () => {
    const span = spanOf(scene, "new Circle({ radius: 2, x: 0 })")
    expect(readOverride(scene, { span, className: "Circle", name: "radius" })).toEqual({
      kind: "literal",
      value: 2,
    })
  })

  test("reports a property that is not written there as absent", () => {
    const span = spanOf(scene, "new Circle({ radius: 2, x: 0 })")
    expect(readOverride(scene, { span, className: "Circle", name: "y" })).toEqual({
      kind: "absent",
    })
  })

  test("refuses to read a named constant as a literal", () => {
    const src = scene.replace("radius: 2", "radius: BIG")
    const span = spanOf(src, "new Circle({ radius: BIG, x: 0 })")
    const read = readOverride(src, { span, className: "Circle", name: "radius" })
    expect(read.kind).toBe("unreadable")
  })

  test("round-trips: apply then apply the inverse restores every byte", () => {
    const span = spanOf(scene, "new Circle({ radius: 2, x: 0 })")
    const before = readOverride(scene, { span, className: "Circle", name: "radius" })
    if (before.kind !== "literal") throw new Error("expected a literal")

    const forward = applySetOverride(scene, {
      op: "setOverride",
      span,
      className: "Circle",
      name: "radius",
      value: 5.5,
    })
    if (!forward.ok) throw new Error(forward.reason)
    expect(forward.text).toContain("radius: 5.5")

    // The inverse targets the SAME span: a rewrite inside a construction
    // moves its end, never its start, so the start-anchored rebase holds.
    const back = applySetOverride(forward.text, {
      op: "setOverride",
      span,
      className: "Circle",
      name: "radius",
      value: before.value,
    })
    if (!back.ok) throw new Error(back.reason)
    expect(back.text).toBe(scene)
  })

  test("round-trips a second op against the same construction (the drag case)", () => {
    const span = spanOf(scene, "new Circle({ radius: 2, x: 0 })")
    const first = applySetOverride(scene, {
      op: "setOverride",
      span,
      className: "Circle",
      name: "x",
      value: 12,
    })
    if (!first.ok) throw new Error(first.reason)
    const before = readOverride(first.text, { span, className: "Circle", name: "radius" })
    if (before.kind !== "literal") throw new Error("expected a literal")
    const second = applySetOverride(first.text, {
      op: "setOverride",
      span,
      className: "Circle",
      name: "radius",
      value: 9,
    })
    if (!second.ok) throw new Error(second.reason)
    const back = applySetOverride(second.text, {
      op: "setOverride",
      span,
      className: "Circle",
      name: "radius",
      value: before.value,
    })
    if (!back.ok) throw new Error(back.reason)
    expect(back.text).toBe(first.text)
  })
})

describe("an INSERTED property inverts through the span-edit path", () => {
  // The most ordinary edit in the editor: dragging an object whose x/y
  // the scene never spelled. `readOverride` says "absent", so there is no
  // literal to restore — and no single cut describes the write either,
  // because inserting into a multi-line literal whose last property had
  // no trailing comma ADDS that comma too. The general diff is what makes
  // this exact, so these cases pin every literal shape the writer emits.
  const shapes: [string, string][] = [
    ["trailing-comma multiline", "new Line({\n    tint: WHITE,\n    stroke: 2,\n  })"],
    ["no-trailing-comma multiline", "new Line({\n    tint: WHITE,\n    stroke: 2\n  })"],
    ["single line", "new Line({ tint: WHITE, stroke: 2 })"],
    ["single property", "new Line({ tint: WHITE })"],
    ["empty literal", "new Line({})"],
    ["no argument at all", "new Line()"],
  ]

  for (const [name, construction] of shapes) {
    test(`round-trips an insertion into a ${name}`, () => {
      const src = `class D extends Dream {\n  a = ${construction}\n}\n`
      const span = spanOf(src, construction)
      expect(readOverride(src, { span, className: "Line", name: "x" })).toEqual({ kind: "absent" })

      const forward = applySetOverride(src, {
        op: "setOverride",
        span,
        className: "Line",
        name: "x",
        value: 123.45,
      })
      if (!forward.ok) throw new Error(forward.reason)
      expect(forward.text).toContain("x: 123.45")

      // The daemon's inverse for an absent property, verbatim.
      const spans = changedSpans(src, forward.text)
      const edits = spans.map((s) => ({
        span: { start: s.start, end: s.end },
        expect: s.text,
        replace: s.was.length > 0 ? s.was : undefined,
      }))
      expect(edits.every((e) => e.expect.length > 0)).toBe(true)
      const [first, ...rest] = edits
      const back = applyDeleteSpan(forward.text, {
        op: "deleteSpan",
        ...first!,
        also: rest,
      })
      if (!back.ok) throw new Error(back.reason)
      expect(back.text).toBe(src)
    })
  }

  test("a two-op drag is exact at EVERY step, not only at the end", () => {
    // x then y, undone y then x — the intermediate state must be the
    // state the first op actually produced, byte for byte. A rule about
    // which comma to cut gets the ends right and the middle wrong.
    const construction = "new Line({\n    tint: WHITE,\n    stroke: 2,\n  })"
    const base = `class D extends Dream {\n  a = ${construction}\n}\n`
    const span = spanOf(base, construction)
    const write = (src: string, n: string, v: number) => {
      const r = applySetOverride(src, { op: "setOverride", span, className: "Line", name: n, value: v })
      if (!r.ok) throw new Error(r.reason)
      return r.text
    }
    const undoOf = (before: string, after: string) => {
      const edits = changedSpans(before, after).map((s) => ({
        span: { start: s.start, end: s.end },
        expect: s.text,
        replace: s.was.length > 0 ? s.was : undefined,
      }))
      const [first, ...rest] = edits
      const r = applyDeleteSpan(after, { op: "deleteSpan", ...first!, also: rest })
      if (!r.ok) throw new Error(r.reason)
      return r.text
    }

    const afterX = write(base, "x", -222)
    const afterY = write(afterX, "y", 77)
    expect(undoOf(afterX, afterY)).toBe(afterX)
    expect(undoOf(base, afterX)).toBe(base)
  })
})

describe("readRunTime — what a setRunTime is about to replace", () => {
  test("reads the standing duration", () => {
    const span = spanOfCall(scene, "this.play(Create(this.circle), 2)")
    expect(readRunTime(scene, span)).toEqual({ kind: "literal", value: 2 })
  })

  test("an implicit duration reads as the default, not as unreadable", () => {
    const src = scene.replace("this.play(Create(this.circle), 2)", "this.play(Create(this.circle))")
    const span = spanOfCall(src, "this.play(Create(this.circle))")
    expect(readRunTime(src, span)).toEqual({ kind: "default" })
  })

  test("refuses a named constant — the editor must not flatten intent", () => {
    const src = scene.replace(", 2)", ", SIGHT_RUN_TIME)")
    const span = spanOfCall(src, "this.play(Create(this.circle), SIGHT_RUN_TIME)")
    expect(readRunTime(src, span).kind).toBe("unreadable")
  })

  test("round-trips through the writer", () => {
    const span = spanOfCall(scene, "this.play(Create(this.circle), 2)")
    const before = readRunTime(scene, span)
    if (before.kind !== "literal") throw new Error("expected a literal")
    const forward = applySetRunTime(scene, { op: "setRunTime", span, runTime: 4.25 })
    if (!forward.ok) throw new Error(forward.reason)
    expect(forward.text).toContain("this.play(Create(this.circle), 4.25)")
    const back = applySetRunTime(forward.text, {
      op: "setRunTime",
      span,
      runTime: before.value,
    })
    if (!back.ok) throw new Error(back.reason)
    expect(back.text).toBe(scene)
  })
})

describe("readBackdrop — what a setBackdrop is about to replace", () => {
  test("reads the standing spec", () => {
    expect(readBackdrop(scene)).toEqual({
      kind: "spec",
      path: "refs/video-01/DialecticalThinking.mkv",
      offset: 82,
    })
  })

  test("reports no backdrop line as absent (an insertion, not a replacement)", () => {
    const src = scene.replace(
      '    this.backdrop("refs/video-01/DialecticalThinking.mkv", { offset: 82 })\n',
      "",
    )
    expect(readBackdrop(src)).toEqual({ kind: "absent" })
  })

  test("round-trips through the writer", () => {
    const before = readBackdrop(scene)
    if (before.kind !== "spec") throw new Error("expected a spec")
    const forward = applySetBackdrop(scene, {
      op: "setBackdrop",
      path: "refs/video-01/frame_020.png",
      offset: 3,
    })
    if (!forward.ok) throw new Error(forward.reason)
    const back = applySetBackdrop(forward.text, {
      op: "setBackdrop",
      path: before.path,
      offset: before.offset,
    })
    if (!back.ok) throw new Error(back.reason)
    expect(back.text).toBe(scene)
  })
})

describe("insertedSpan + deleteSpan — the appendCheckpoint inverse", () => {
  test("finds the exact byte range one insertion added", () => {
    const before = "abc\ndef\n"
    const after = "abc\nXYZ\ndef\n"
    expect(insertedSpan(before, after)).toEqual({ start: 4, end: 8, text: "XYZ\n" })
  })

  test("refuses a non-contiguous change", () => {
    expect(insertedSpan("abcdef", "aXbcdeYf")).toBeUndefined()
  })

  test("refuses a change that removed text", () => {
    expect(insertedSpan("abcdef", "abc")).toBeUndefined()
  })

  /** The daemon's own inverse construction, as a testable function. */
  const deleteSpanInverse = (before: string, after: string) => {
    const spans = changedSpans(before, after)
    const edits = spans.map((s) => ({
      span: { start: s.start, end: s.end },
      expect: s.text,
      replace: s.was.length > 0 ? s.was : undefined,
    }))
    const [first, ...rest] = edits
    return { op: "deleteSpan" as const, ...first!, also: rest }
  }

  test("a MULTI-TARGET capture is undone byte-exactly — statement and import", () => {
    const anchor = spanOfCall(scene, "this.play(Create(this.circle), 2)")
    const forward = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "after",
      anchor,
      targets: [
        { path: "this.circle.x", value: 4 },
        { path: "this.eye.y", value: -1.5 },
      ],
      duration: 1,
      file: "core/demo/video01/S02.ts",
    })
    if (!forward.ok) throw new Error(forward.reason)
    expect(forward.text).toContain("this.circle.x.to(4)")
    // `together` joins the EXISTING import rather than arriving on a new
    // line, so the write changes two regions and one of them is a
    // replacement. This is the case a pure-insertion diff cannot invert.
    expect(forward.text).toContain("render, together }")

    const spans = changedSpans(scene, forward.text)
    expect(spans.length).toBe(2)
    expect(spans.filter((s) => s.was === "").length).toBe(1)

    const back = applyDeleteSpan(forward.text, deleteSpanInverse(scene, forward.text))
    if (!back.ok) throw new Error(back.reason)
    expect(back.text).toBe(scene)
  })

  test("undoing a multi-region capture is itself redoable byte-exactly", () => {
    const anchor = spanOfCall(scene, "this.play(Create(this.circle), 2)")
    const forward = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "after",
      anchor,
      targets: [
        { path: "this.circle.x", value: 4 },
        { path: "this.eye.y", value: -1.5 },
      ],
      duration: 1,
      file: "core/demo/video01/S02.ts",
    })
    if (!forward.ok) throw new Error(forward.reason)
    const undone = applyDeleteSpan(forward.text, deleteSpanInverse(scene, forward.text))
    if (!undone.ok) throw new Error(undone.reason)

    // The redo inverse: one region was REMOVED (empty guard → insertSpan),
    // the other was replaced back (a guarded `also` edit).
    const spans = changedSpans(forward.text, undone.text)
    const edits = spans.map((s) => ({
      span: { start: s.start, end: s.end },
      expect: s.text,
      replace: s.was.length > 0 ? s.was : undefined,
    }))
    const removalAt = edits.findIndex((e) => e.expect.length === 0)
    expect(removalAt).toBeGreaterThanOrEqual(0)
    const gap = spans[removalAt]!
    const redone = applyInsertSpan(undone.text, {
      op: "insertSpan",
      at: gap.start,
      text: gap.was,
      context: undone.text.slice(gap.start, gap.start + 120),
      also: edits.filter((e) => e.expect.length > 0),
    })
    if (!redone.ok) throw new Error(redone.reason)
    expect(redone.text).toBe(forward.text)
  })

  test("insertSpan re-locates through context when the offset has drifted", () => {
    const forward = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "end",
      targets: [{ path: "this.circle.x", value: 4 }],
      duration: 1,
    })
    if (!forward.ok) throw new Error(forward.reason)
    const span = insertedSpan(scene, forward.text)!
    const undone = applyDeleteSpan(forward.text, {
      op: "deleteSpan",
      span: { start: span.start, end: span.end },
      expect: span.text,
    })
    if (!undone.ok) throw new Error(undone.reason)
    const context = undone.text.slice(span.start, span.start + 120)
    // A hand edit above shifts every offset; the context still names the place.
    const drifted = `// a hand edit\n${undone.text}`
    const redone = applyInsertSpan(drifted, {
      op: "insertSpan",
      at: span.start,
      text: span.text,
      context,
    })
    if (!redone.ok) throw new Error(redone.reason)
    expect(redone.text).toBe(`// a hand edit\n${forward.text}`)
  })

  test("insertSpan refuses when its context is gone", () => {
    const res = applyInsertSpan("nothing familiar here", {
      op: "insertSpan",
      at: 0,
      text: "x",
      context: "a line that was deleted",
    })
    expect(res.ok).toBe(false)
  })

  test("changedSpans reports nothing when the text is unchanged", () => {
    expect(changedSpans(scene, scene)).toEqual([])
  })

  test("deleteSpan is all-or-nothing when one guard fails", () => {
    const forward = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "end",
      targets: [{ path: "this.circle.x", value: 4 }],
      duration: 1,
    })
    if (!forward.ok) throw new Error(forward.reason)
    const span = insertedSpan(scene, forward.text)!
    const res = applyDeleteSpan(forward.text, {
      op: "deleteSpan",
      span: { start: span.start, end: span.end },
      expect: span.text,
      also: [{ span: { start: 0, end: 5 }, expect: "text that is not there" }],
    })
    expect(res.ok).toBe(false)
    // Nothing was written — the caller still holds the un-undone file.
    expect(forward.text).toContain("this.circle.x.to(4)")
  })

  test("a single-target capture is undone byte-exactly", () => {
    const anchor = spanOfCall(scene, "this.play(Create(this.circle), 2)")
    const forward = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "after",
      anchor,
      targets: [{ path: "this.circle.x", value: 4 }],
      duration: 1,
    })
    if (!forward.ok) throw new Error(forward.reason)
    const span = insertedSpan(scene, forward.text)!
    expect(span).toBeDefined()
    const back = applyDeleteSpan(forward.text, {
      op: "deleteSpan",
      span: { start: span.start, end: span.end },
      expect: span.text,
    })
    if (!back.ok) throw new Error(back.reason)
    expect(back.text).toBe(scene)
  })

  test("deleteSpan refuses when the bytes underneath have changed", () => {
    const res = applyDeleteSpan(scene, {
      op: "deleteSpan",
      span: { start: 0, end: 10 },
      expect: "this text is not in the file at all",
    })
    expect(res.ok).toBe(false)
  })

  test("deleteSpan re-locates a drifted span when the text is unique", () => {
    const forward = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "end",
      targets: [{ path: "this.circle.x", value: 4 }],
      duration: 1,
    })
    if (!forward.ok) throw new Error(forward.reason)
    const span = insertedSpan(scene, forward.text)!
    // Prepend a line: every offset shifts, but the text is still unique.
    const drifted = `// a hand edit\n${forward.text}`
    const back = applyDeleteSpan(drifted, {
      op: "deleteSpan",
      span: { start: span.start, end: span.end },
      expect: span.text,
    })
    if (!back.ok) throw new Error(back.reason)
    expect(back.text).toBe(`// a hand edit\n${scene}`)
  })

  test("deleteSpan refuses an ambiguous re-location", () => {
    const doubled = `${scene}${scene}`
    const res = applyDeleteSpan(doubled, {
      op: "deleteSpan",
      span: { start: 99999, end: 100000 },
      expect: "    this.wait(1)\n",
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain("more than once")
  })

  test("insertSpan puts a deleted range back (redo of an undone capture)", () => {
    const forward = applyAppendCheckpoint(scene, {
      op: "appendCheckpoint",
      placement: "end",
      targets: [{ path: "this.circle.x", value: 4 }],
      duration: 1,
    })
    if (!forward.ok) throw new Error(forward.reason)
    const span = insertedSpan(scene, forward.text)!
    const undone = applyDeleteSpan(forward.text, {
      op: "deleteSpan",
      span: { start: span.start, end: span.end },
      expect: span.text,
    })
    if (!undone.ok) throw new Error(undone.reason)
    const redone = applyInsertSpan(undone.text, {
      op: "insertSpan",
      at: span.start,
      text: span.text,
    })
    if (!redone.ok) throw new Error(redone.reason)
    expect(redone.text).toBe(forward.text)
  })

  test("insertSpan refuses an offset the file no longer has", () => {
    expect(applyInsertSpan("short", { op: "insertSpan", at: 500, text: "x" }).ok).toBe(false)
  })
})

describe("the inverse survives the wire", () => {
  // The inverses travel as JSON and are rebuilt field-by-field on the
  // daemon side. A rebuild that drops a field turns a REPLACEMENT into a
  // deletion — which is how a two-op drag's first undo silently removed
  // both properties instead of one. These pin every field that carries
  // meaning, so a narrowing rebuild fails here rather than in the file.
  test("deleteSpan keeps replace and also through JSON", () => {
    const op: DeleteSpanOp = {
      op: "deleteSpan",
      span: { start: 10, end: 20 },
      expect: "the new text",
      replace: "the old text",
      also: [{ span: { start: 0, end: 5 }, expect: "aaa", replace: "bbb" }],
    }
    const wire = JSON.parse(JSON.stringify(op)) as DeleteSpanOp
    expect(wire.replace).toBe("the old text")
    expect(wire.also).toHaveLength(1)
    expect(wire.also![0]!.replace).toBe("bbb")
  })

  test("a replacement deleteSpan REPLACES rather than deletes", () => {
    const src = "aaa\nxxx\nccc\n"
    const res = applyDeleteSpan(src, {
      op: "deleteSpan",
      span: { start: 4, end: 8 },
      expect: "xxx\n",
      replace: "yyy\n",
    })
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toBe("aaa\nyyy\nccc\n")
  })

  test("insertSpan keeps context and also through JSON", () => {
    const op: InsertSpanOp = {
      op: "insertSpan",
      at: 4,
      text: "zzz\n",
      context: "ccc\n",
      also: [{ span: { start: 0, end: 3 }, expect: "aaa", replace: "AAA" }],
    }
    const wire = JSON.parse(JSON.stringify(op)) as InsertSpanOp
    expect(wire.context).toBe("ccc\n")
    expect(wire.also).toHaveLength(1)
    const res = applyInsertSpan("aaa\nccc\n", wire)
    if (!res.ok) throw new Error(res.reason)
    expect(res.text).toBe("AAA\nzzz\nccc\n")
  })
})

// --- The stack itself: pure bookkeeping over descriptors --------------------

const inverse = (name: string, value: number) => ({
  type: "op",
  op: "setOverride",
  file: "core/demo/video01/S02.ts",
  name,
  value,
})

describe("UndoStack", () => {
  test("an ack with an inverse becomes the thing cmd+Z sends", () => {
    const stack = new UndoStack()
    stack.applied({ opId: "op-1", undo: inverse("radius", 2) })
    expect(stack.depth).toEqual({ undo: 1, redo: 0 })
    const out = stack.undo()
    expect(out.kind).toBe("sent")
    if (out.kind !== "sent") return
    expect(out.op.op).toBe("setOverride")
    expect(out.op.value).toBe(2)
    expect(typeof out.op.opId).toBe("string")
    expect(stack.depth).toEqual({ undo: 0, redo: 0 })
  })

  test("the undo op's own ack becomes the redo entry, not a new undo", () => {
    const stack = new UndoStack()
    stack.applied({ opId: "op-1", undo: inverse("radius", 2) })
    const out = stack.undo()
    if (out.kind !== "sent") throw new Error("expected sent")
    // The daemon inverts the undo too: the value that was undone.
    stack.applied({ opId: String(out.op.opId), undo: inverse("radius", 5.5) })
    expect(stack.depth).toEqual({ undo: 0, redo: 1 })
    const redo = stack.redo()
    if (redo.kind !== "sent") throw new Error("expected sent")
    expect(redo.op.value).toBe(5.5)
  })

  test("redoing pushes back onto undo — the two stacks stay symmetric", () => {
    const stack = new UndoStack()
    stack.applied({ opId: "op-1", undo: inverse("radius", 2) })
    const undone = stack.undo()
    if (undone.kind !== "sent") throw new Error("expected sent")
    stack.applied({ opId: String(undone.op.opId), undo: inverse("radius", 5.5) })
    const redone = stack.redo()
    if (redone.kind !== "sent") throw new Error("expected sent")
    stack.applied({ opId: String(redone.op.opId), undo: inverse("radius", 2) })
    expect(stack.depth).toEqual({ undo: 1, redo: 0 })
    const again = stack.undo()
    if (again.kind !== "sent") throw new Error("expected sent")
    expect(again.op.value).toBe(2)
  })

  test("a fresh edit branches history — the redo stack is dropped", () => {
    const stack = new UndoStack()
    stack.applied({ opId: "op-1", undo: inverse("radius", 2) })
    const undone = stack.undo()
    if (undone.kind !== "sent") throw new Error("expected sent")
    stack.applied({ opId: String(undone.op.opId), undo: inverse("radius", 5.5) })
    expect(stack.canRedo).toBe(true)
    stack.applied({ opId: "op-9", undo: inverse("x", 0) })
    expect(stack.depth).toEqual({ undo: 1, redo: 0 })
  })

  test("an ack with NO inverse ends the stack rather than leaving a hole", () => {
    const stack = new UndoStack()
    stack.applied({ opId: "op-1", undo: inverse("radius", 2) })
    // An override INSERTED into a construction that had no such property:
    // setOverride cannot express its removal, so it is not undoable — and
    // undoing PAST it would restore a state that never existed.
    stack.applied({ opId: "op-2" })
    expect(stack.depth).toEqual({ undo: 0, redo: 0 })
    expect(stack.undo().kind).toBe("empty")
  })

  test("a rejected op leaves no trace", () => {
    const stack = new UndoStack()
    const id = stack.nextOpId()
    stack.rejected(id)
    expect(stack.depth).toEqual({ undo: 0, redo: 0 })
  })

  test("clear() reports whether there was history to lose", () => {
    const stack = new UndoStack()
    expect(stack.clear()).toBe(false)
    stack.applied({ opId: "op-1", undo: inverse("radius", 2) })
    expect(stack.clear()).toBe(true)
    expect(stack.depth).toEqual({ undo: 0, redo: 0 })
  })

  test("clear() drops in-flight correlations too", () => {
    const stack = new UndoStack()
    stack.applied({ opId: "op-1", undo: inverse("radius", 2) })
    const out = stack.undo()
    if (out.kind !== "sent") throw new Error("expected sent")
    stack.clear()
    // The undo's ack arrives after the clear: it must not resurrect a redo
    // entry pointing at bytes the external edit already replaced.
    stack.applied({ opId: String(out.op.opId), undo: inverse("radius", 5.5) })
    expect(stack.depth).toEqual({ undo: 1, redo: 0 })
  })

  test("opIds are unique across a session", () => {
    const stack = new UndoStack()
    const ids = new Set([stack.nextOpId(), stack.nextOpId(), stack.nextOpId()])
    expect(ids.size).toBe(3)
  })

  test("undo on an empty stack is empty, never a wrong write", () => {
    expect(new UndoStack().undo()).toEqual({ kind: "empty" })
    expect(new UndoStack().redo()).toEqual({ kind: "empty" })
  })
})

describe("undoAction — live first", () => {
  test("a standing live override is released before any file history", () => {
    const stack = new UndoStack()
    stack.applied({ opId: "op-1", undo: inverse("radius", 2) })
    expect(undoAction({ size: 1 }, stack)).toBe("release")
  })

  test("with nothing live, cmd+Z pops committed history", () => {
    const stack = new UndoStack()
    stack.applied({ opId: "op-1", undo: inverse("radius", 2) })
    expect(undoAction({ size: 0 }, stack)).toBe("pop")
  })

  test("with neither, cmd+Z does nothing at all", () => {
    expect(undoAction({ size: 0 }, new UndoStack())).toBe("none")
  })
})

describe("labelOf", () => {
  test("names each op the way the status line says it", () => {
    expect(labelOf({ op: "setOverride", name: "radius" })).toBe("radius")
    expect(labelOf({ op: "setRunTime" })).toBe("clip duration")
    expect(labelOf({ op: "setBackdrop" })).toBe("backdrop")
    expect(labelOf({ op: "deleteSpan" })).toBe("checkpoint")
    expect(labelOf({ op: "insertSpan" })).toBe("checkpoint")
  })
})
