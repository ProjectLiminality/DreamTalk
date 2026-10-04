/**
 * sketch-catalogue.test.ts — the whole vocabulary as importable
 * (sketch/catalogue.ts): the shelf held to the folder, the generic
 * adapter's placement, imports as a board's own undoable state, and the
 * shelf's own words (scripts/catalogue.ts).
 */

import { describe, expect, test } from "bun:test"
import { Glob } from "bun"
import { catalogue, DEFAULT_SIZE, extentOf, importsOf, NOT_SYMBOLS, placeParams, SHELF } from "../sketch/catalogue"
import { buildSymbol, DEFAULT_IMPORTS, transformSymbol, VOCABULARY, vocabById } from "../sketch/vocabulary"
import { apply, History, symbolBox } from "../sketch/state"
import { parseBoard, serializeBoard } from "../sketch/board"
import { classDocParagraph, readmeParagraph, shelfTexts } from "../scripts/catalogue"
import { parseRecognizeReply } from "../scripts/recognize"
import type { PlacedSymbol } from "../sketch/protocol"

const repoRoot = new URL("../../", import.meta.url).pathname
const placed = (symbol: string, params: Record<string, unknown>): PlacedSymbol => ({ id: "s", symbol, params, fromStrokes: [] })

describe("the shelf", () => {
  test("every sovereign class in core/vocabulary is on the shelf or named as not a symbol", async () => {
    const onShelf = new Set(SHELF.map((s) => s.className))
    const missing: string[] = []
    const dir = `${repoRoot}core/vocabulary`
    for await (const rel of new Glob("*/*.ts").scan({ cwd: dir })) {
      const src = await Bun.file(`${dir}/${rel}`).text()
      // Each class runs to the next one; it is sovereign if it says so in between.
      for (const chunk of src.split(/^export class /m).slice(1)) {
        const name = /^\w+/.exec(chunk)![0]
        if (/^\s*static sovereign = true/m.test(chunk) && !onShelf.has(name) && !(name in NOT_SYMBOLS)) missing.push(`${rel}: ${name}`)
      }
    }
    expect(missing).toEqual([])
  })

  test("the catalogue offers every hand-written entry once, and a generic entry for every uncovered class", () => {
    const items = catalogue()
    const ids = items.map((i) => i.entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of VOCABULARY) expect(ids).toContain(e.id)
    const covered = new Set(VOCABULARY.map((e) => e.holon))
    for (const s of SHELF) if (!covered.has(s.className)) expect(ids).toContain(s.className[0]!.toLowerCase() + s.className.slice(1))
    // A hand-written entry speaks for its class: no second Eye.
    expect(ids.filter((id) => vocabById(id)?.holon === "Eye")).toEqual(["eye"])
    expect(ids).toContain("cylinder")
    expect(ids).toContain("globe")
  })
})

describe("the generic adapter", () => {
  test("a Globe sits centred on (cx, −cy), its largest extent `size`", () => {
    const h = buildSymbol(placed("globe", { cx: 600, cy: 400, size: 300, rotation: 0 }))
    // In the placing group's own frame (extentOf leaves the root's transform out).
    const g = extentOf(h)!
    expect(h.x.value).toBe(600)
    expect(h.y.value).toBe(-400)
    expect(Math.max(g.w, g.h) * h.scale.value).toBeCloseTo(300, 4)
    expect(Math.abs(g.cx) + Math.abs(g.cy)).toBeLessThan(1e-6)
  })

  test("its own params build and change the symbol, not its size on the page", () => {
    const a = buildSymbol(placed("labyrinth", { cx: 0, cy: 0, size: 200, seed: 42 }))
    const b = buildSymbol(placed("labyrinth", { cx: 0, cy: 0, size: 200, seed: 7, citadelRadius: 300 }))
    const ea = extentOf(a)!
    const eb = extentOf(b)!
    expect(Math.max(ea.w, ea.h) * a.scale.value).toBeCloseTo(200, 3)
    expect(Math.max(eb.w, eb.h) * b.scale.value).toBeCloseTo(200, 3)
  })

  test("the footprint is the fitted extent; transforms move, scale and turn it", () => {
    const s = placed("plot", { cx: 500, cy: 500, size: 200, rotation: 0 })
    const box = symbolBox(s)
    expect(box.w).toBeCloseTo(200, 3)
    expect(box.h).toBeLessThan(200)
    const t = transformSymbol(s, { translate: { x: 10, y: 0 }, scale: 2, rotate: 0.5, pivot: { x: 500, y: 500 } })
    expect(t.params).toMatchObject({ cx: 510, cy: 500, size: 400, rotation: 0.5 })
  })

  test("every catalogue item builds from the params a drop gives it", () => {
    for (const item of catalogue()) {
      const p = placeParams(item.entry, { x: 900, y: 700 })
      expect(() => buildSymbol(placed(item.entry.id, p))).not.toThrow()
      const box = symbolBox(placed(item.entry.id, p))
      expect(Math.abs(box.x + box.w / 2 - 900)).toBeLessThan(item.entry.id === "mindVirus" ? 200 : 1)
    }
    expect(placeParams(vocabById("globe")!, { x: 1, y: 2 })).toMatchObject({ cx: 1, cy: 2, size: DEFAULT_SIZE, rotation: 0 })
  })
})

describe("the Cylinder", () => {
  test("is built as the intersection of a rectangle and a circle, turned by h/p/b", () => {
    const g = buildSymbol(placed("cylinder", { cx: 300, cy: 200, radius: 50, height: 120, h: 0, p: 0.5, b: 0.2 }))
    const cyl = g.parts[0] as unknown as { radius: { value: number }; height: { value: number } }
    expect(cyl.radius.value).toBe(50)
    expect(cyl.height.value).toBe(120)
    expect(g.x.value).toBe(300)
    expect(g.y.value).toBe(-200)
    expect(g.p.value).toBe(0.5)
    expect(g.b.value).toBe(-0.2)
  })
})

describe("imports are the board's own", () => {
  test("an old board imports the defaults; the list round-trips through the file", () => {
    expect(importsOf({})).toEqual([...DEFAULT_IMPORTS])
    const old = parseBoard({ strokes: [], symbols: [] })!
    expect(old.vocabulary).toBeUndefined()
    expect(serializeBoard(old)).not.toContain("vocabulary")
    const text = serializeBoard({ strokes: [], symbols: [], vocabulary: ["circle", "cylinder", "globe"] })
    expect(text).toContain(`"vocabulary": ["circle","cylinder","globe"]`)
    expect(parseBoard(JSON.parse(text))!.vocabulary).toEqual(["circle", "cylinder", "globe"])
  })

  test("an import is one undo step, and survives every other command", () => {
    const h = new History()
    h.do({ kind: "imports", vocabulary: ["circle", "globe"] })
    h.do({ kind: "addSymbol", symbol: placed("globe", { cx: 1, cy: 1, size: 10 }) })
    expect(importsOf(h.state)).toEqual(["circle", "globe"])
    h.do({ kind: "clear" })
    expect(importsOf(h.state)).toEqual(["circle", "globe"])
    h.undo()
    h.undo()
    h.undo()
    expect(importsOf(h.state)).toEqual([...DEFAULT_IMPORTS])
    const s = apply({ strokes: [], symbols: [], vocabulary: ["circle"] }, {
      kind: "edit",
      steps: [{ kind: "imports", vocabulary: ["globe"] }, { kind: "addSymbol", symbol: placed("globe", {}) }],
      selected: [],
    })
    expect(s.vocabulary).toEqual(["globe"])
    expect(s.symbols.length).toBe(1)
  })

  test("the recognizer answers only with what is imported — generic ids included", () => {
    const reply = JSON.stringify({ candidates: [{ symbol: "globe", params: { cx: 1, cy: 2, size: 3, spin: 0.5 }, confidence: 0.8 }] })
    expect(parseRecognizeReply(reply, ["globe"]).candidates[0]).toMatchObject({ symbol: "globe", params: { cx: 1, cy: 2, size: 3, spin: 0.5 } })
    expect(parseRecognizeReply(reply, ["circle"]).candidates).toEqual([])
  })
})

describe("the shelf's own words", () => {
  test("a README's first prose paragraph, flattened", () => {
    expect(readmeParagraph("# Cylinder\n\n![Cylinder](Cylinder.png)\n\nThe star of the\n`2021` vocabulary.\n\nMore.")).toBe(
      "The star of the 2021 vocabulary.",
    )
  })

  test("a class doc, else the module's header comment", () => {
    expect(classDocParagraph("/**\n * A thing.\n *\n * More.\n */\nexport class Thing extends X {}", "Thing")).toBe("A thing.")
    expect(classDocParagraph("/** Header — a module. */\nimport x\nexport class Thing {}", "Thing")).toBe("Header — a module.")
  })

  test("every shelf class has something to say", async () => {
    const texts = await shelfTexts(repoRoot)
    for (const s of SHELF) expect(texts[s.className]?.description.length ?? 0).toBeGreaterThan(10)
    expect(texts.Cylinder!.face).toBe("/api/face/Cylinder")
  })
})
