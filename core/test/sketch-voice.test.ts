/**
 * sketch-voice.test.ts — spoken instructions (scripts/instruct.ts,
 * sketch/state.ts `edit`).
 *
 * The promises: whatever Claude answers, only edits that name real things
 * on the page with real vocabulary reach it; and however many edits one
 * sentence makes, it is ONE undo step that restores the page exactly.
 */

import { describe, expect, test } from "bun:test"
import { History, apply, editCommand, touched, updateSymbol, type SketchState } from "../sketch/state"
import { PAGE_H, PAGE_W, type InkStroke, type InstructRequest, type PlacedSymbol } from "../sketch/protocol"
import { buildInstructPrompt, parseInstructReply, type InstructContext } from "../scripts/instruct"
import { VOCABULARY } from "../sketch/vocabulary"

const stroke = (id: string, pts: [number, number][]): InkStroke => ({
  id,
  points: pts.map(([x, y], i) => ({ x, y, pressure: 0.5, t: i })),
})

const circle: PlacedSymbol = { id: "sym-c", symbol: "circle", params: { cx: 700, cy: 900, r: 100 }, fromStrokes: [] }
const virus: PlacedSymbol = {
  id: "sym-v",
  symbol: "mindVirus",
  params: { x: 300, y: 900, size: 80, heading: 0, fold: 1 },
  fromStrokes: [],
}
const scribble = stroke("ink-a", [
  [600, 400],
  [700, 380],
  [760, 450],
  [700, 520],
  [610, 480],
  [600, 400],
])

const page = (): SketchState => ({ strokes: [scribble], symbols: [circle, virus] })

const ctx: InstructContext = {
  labels: { "sym-c": "S1", "sym-v": "S2", "ink-a": "K1" },
  board: page(),
  allowed: VOCABULARY.map((e) => e.id),
}

describe("instruct reply parsing", () => {
  test("tags resolve to page ids; params coerce against the vocabulary", () => {
    const res = parseInstructReply(
      `{"ops":[{"op":"update","id":"S1","params":{"r":"200","bogus":3}},{"op":"update","id":"s2","params":{"fold":7}}],"reply":"Doubled it."}`,
      ctx,
    )
    expect(res.error).toBeUndefined()
    expect(res.reply).toBe("Doubled it.")
    expect(res.ops).toEqual([
      { op: "update", id: "sym-c", params: { r: 200 } },
      { op: "update", id: "sym-v", params: { fold: 1 } },
    ])
  })

  test("raw ids work too, prose and fences are stripped", () => {
    const res = parseInstructReply('Sure:\n```json\n{"ops":[{"op":"remove","id":"ink-a"}],"reply":"gone"}\n```', ctx)
    expect(res.ops).toEqual([{ op: "remove", id: "ink-a" }])
  })

  test("replaceStrokes keeps only real STROKES and an imported symbol", () => {
    const res = parseInstructReply(
      JSON.stringify({
        ops: [
          { op: "replaceStrokes", strokeIds: ["K1", "S1", "K9"], symbol: "flowerOfLife", params: { cx: 680, cy: 450, r: 40, rings: 2 } },
          { op: "replaceStrokes", strokeIds: ["K1"], symbol: "dragon", params: {} },
        ],
        reply: "A flower of life.",
      }),
      ctx,
    )
    expect(res.ops).toEqual([
      { op: "replaceStrokes", strokeIds: ["ink-a"], symbol: "flowerOfLife", params: { cx: 680, cy: 450, r: 40, rings: "2" } },
    ])
  })

  test("add needs an imported symbol; update may turn a symbol into another", () => {
    const res = parseInstructReply(
      JSON.stringify({
        ops: [
          { op: "add", symbol: "mindVirus", params: { x: 400, y: 900, size: 80, heading: 0, fold: 1, cable: [[100, 900], [300, 900]] } },
          { op: "add", symbol: "unicorn", params: {} },
          { op: "update", id: "S1", symbol: "flowerOfLife", params: { rings: 1 } },
          { op: "update", id: "S1", symbol: "unicorn", params: { r: 3 } },
          { op: "update", id: "K1", params: { r: 3 } },
        ],
        reply: "",
      }),
      { ...ctx, allowed: ["circle", "mindVirus", "flowerOfLife"] },
    )
    expect(res.ops).toEqual([
      { op: "add", symbol: "mindVirus", params: { x: 400, y: 900, size: 80, heading: 0, fold: 1, cable: [[100, 900], [300, 900]] } },
      { op: "update", id: "sym-c", symbol: "flowerOfLife", params: { rings: "1" } },
    ])
  })

  test("transform: points in either spelling, scale kept positive, empty dropped", () => {
    const res = parseInstructReply(
      JSON.stringify({
        ops: [
          { op: "transform", ids: ["S1", "K1"], translate: { x: -50, y: 0 }, rotate: 0.5, scale: 1000, pivot: [700, 700] },
          { op: "transform", ids: ["S1"], scale: -2 },
          { op: "transform", ids: ["S9"], translate: [1, 1] },
        ],
        reply: "",
      }),
      ctx,
    )
    expect(res.ops).toEqual([
      { op: "transform", ids: ["sym-c", "ink-a"], translate: { x: -50, y: 0 }, rotate: 0.5, scale: 50, pivot: { x: 700, y: 700 } },
    ])
  })

  test("no ops with a reply is an answer, not an error; junk is an error", () => {
    expect(parseInstructReply('{"ops":[],"reply":"There is no dragon in the vocabulary."}', ctx)).toEqual({
      ops: [],
      reply: "There is no dragon in the vocabulary.",
    })
    expect(parseInstructReply('{"ops":[{"op":"remove","id":"S7"}],"reply":"x"}', ctx).error).toBeDefined()
    expect(parseInstructReply("I can't", ctx).error).toMatch(/unparseable/)
  })
})

describe("instruct prompt", () => {
  const req = (selection: string[]): InstructRequest => ({
    transcript: 'make it "twice" as big',
    png: "",
    selection,
    board: page(),
    vocabulary: VOCABULARY.map((e) => e.id),
    labels: ctx.labels,
  })

  test("names the selection by tag, or says the whole scene", () => {
    const p = buildInstructPrompt(req(["sym-c"]), "/x.png", { w: PAGE_W / 2, h: PAGE_H / 2 }, VOCABULARY)
    expect(p).toContain("SELECTED: S1.")
    expect(p).toContain("S1 [SELECTED] circle")
    expect(p).toContain("K1 ink")
    expect(p).toContain("make it 'twice' as big")
    expect(p).toContain("page x = px·2.0000")
    const whole = buildInstructPrompt(req([]), "/x.png", undefined, VOCABULARY)
    expect(whole).toContain("NOTHING is selected")
  })
})

describe("edit command", () => {
  let n = 0
  const ids = () => `new-${++n}`

  test("ops become ONE step; undo restores the page exactly, redo re-applies it", () => {
    const before = page()
    const h = new History(before)
    const cmd = editCommand(
      h.state,
      [
        { op: "update", id: "sym-c", params: { r: 200 } },
        { op: "replaceStrokes", strokeIds: ["ink-a"], symbol: "flowerOfLife", params: { cx: 680, cy: 450, r: 40, rings: "1" } },
        { op: "add", symbol: "mindVirus", params: { x: 400, y: 600, size: 60 } },
        { op: "transform", ids: ["sym-v"], translate: { x: 10, y: 20 } },
        { op: "remove", id: "sym-missing" },
      ],
      ["sym-c"],
      ids,
    )!
    expect(cmd.kind).toBe("edit")
    expect(cmd.steps.map((s) => s.kind)).toEqual(["update", "replace", "addSymbol", "transform"])
    const after = h.do(cmd)
    expect(after.strokes).toEqual([])
    expect(after.symbols.map((y) => y.symbol)).toEqual(["circle", "mindVirus", "flowerOfLife", "mindVirus"])
    expect(after.symbols[0]!.params).toEqual({ cx: 700, cy: 900, r: 200 })
    expect(after.symbols[1]!.params.x).toBe(310)
    expect(after.symbols[1]!.params.y).toBe(920)
    expect(after.symbols[2]!.fromStrokes).toEqual(["ink-a"])
    // inputs untouched
    expect(circle.params.r).toBe(100)

    h.undo()
    expect(h.state).toBe(before)
    expect(h.state.strokes[0]).toBe(scribble)
    expect(h.canUndo).toBe(false)
    h.redo()
    expect(h.state).toBe(after)
  })

  test("what stays selected: changed and new things", () => {
    const cmd = editCommand(
      page(),
      [
        { op: "update", id: "sym-c", params: { r: 1 } },
        { op: "add", symbol: "circle", params: { cx: 1, cy: 1, r: 1 } },
        { op: "remove", id: "sym-v" },
      ],
      [],
      () => "sym-new",
    )!
    expect(touched(cmd)).toEqual(["sym-c", "sym-new"])
  })

  test("a transform with no pivot turns about the centre of what it moves", () => {
    const cmd = editCommand(page(), [{ op: "transform", ids: ["sym-c"], scale: 2 }], [])!
    const s = apply(page(), cmd)
    expect(s.symbols[0]!.params).toEqual({ cx: 700, cy: 900, r: 200 })
  })

  test("ops that name nothing left on the page → no command", () => {
    expect(editCommand(page(), [{ op: "remove", id: "gone" }, { op: "update", id: "ink-a", params: { r: 2 } }], [])).toBeUndefined()
    // removing then updating the same symbol: the update finds nothing
    const cmd = editCommand(page(), [{ op: "remove", id: "sym-c" }, { op: "update", id: "sym-c", params: { r: 2 } }], [])!
    expect(cmd.steps.map((s) => s.kind)).toEqual(["delete"])
  })

  test("turning a symbol into another keeps only the params they share", () => {
    const y = updateSymbol(circle, { symbol: "flowerOfLife", params: { rings: "2" } })
    expect(y).toEqual({ ...circle, symbol: "flowerOfLife", params: { cx: 700, cy: 900, r: 100, rings: "2" } })
    const sq = updateSymbol(circle, { symbol: "square", params: { size: 50 } })
    expect(sq.params).toEqual({ cx: 700, cy: 900, size: 50 })
  })
})
