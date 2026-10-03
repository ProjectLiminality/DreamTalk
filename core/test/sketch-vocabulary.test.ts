import { describe, expect, test } from "bun:test"
import { buildSymbol, resampleByArcLength, VOCABULARY, vocabById } from "../sketch/vocabulary"
import { buildPrompt, cliResultText, fitCircle, parseRecognizeReply, pngSize } from "../scripts/recognize"
import type { Holon } from "../src/holon"
import type { MindVirus } from "../vocabulary/MindVirus/MindVirus"

const SENSIBLE: Record<string, Record<string, unknown>> = {
  circle: { cx: 600, cy: 700, r: 180 },
  square: { cx: 400, cy: 400, size: 200, rotation: 0.2 },
  triangle: { cx: 500, cy: 900, r: 200, rotation: 0 },
  cube: { cx: 700, cy: 600, size: 200, h: 0.6, p: 0.4, b: 0 },
  flowerOfLife: { cx: 700, cy: 900, r: 120, rings: "2", rotation: 0 },
  mindVirus: { x: 830, y: 570, size: 160, heading: 0, fold: 0.5, cable: [[150, 600], [400, 550], [720, 600]] },
  eye: { cx: 300, cy: 300, size: 200, rotation: 0 },
  figure: { cx: 300, cy: 1200, height: 300 },
}

const build = (symbol: string, params: Record<string, unknown>): Holon =>
  buildSymbol({ id: "s", symbol, params, fromStrokes: [] })

const count = (h: Holon): number => 1 + h.parts.reduce((n, c) => n + count(c), 0)

describe("sketch vocabulary", () => {
  test("every entry builds from sensible params", () => {
    for (const entry of VOCABULARY) {
      expect(SENSIBLE[entry.id]).toBeDefined()
      const h = build(entry.id, SENSIBLE[entry.id]!)
      expect(count(h)).toBeGreaterThan(0)
    }
  })

  test("every entry survives junk params", () => {
    for (const entry of VOCABULARY) expect(() => build(entry.id, { cx: "nope", cable: 7 })).not.toThrow()
  })

  test("a circle's centre lands at (cx, −cy), radius in page units", () => {
    const c = build("circle", { cx: 600, cy: 700, r: 180 }) as Holon & { radius: { value: number } }
    expect(c.x.value).toBe(600)
    expect(c.y.value).toBe(-700)
    expect(c.radius.value).toBe(180)
  })

  test("flower of life: 7 or 19 circles", () => {
    expect(build("flowerOfLife", { cx: 0, cy: 0, r: 10, rings: "1" }).parts.length).toBe(7)
    expect(build("flowerOfLife", { cx: 0, cy: 0, r: 10, rings: 2 }).parts.length).toBe(19)
  })

  test("mindVirus with a cable rests where drawn, fold as drawn, trail spans the cable", () => {
    const mv = build("mindVirus", SENSIBLE.mindVirus!) as unknown as MindVirus
    void mv.parts
    // The origin is the creature's face: half an edge ahead of the body centre.
    expect(mv.x.value).toBeCloseTo(830 + 80, 6)
    expect(mv.y.value).toBeCloseTo(-570, 6)
    expect(mv.fold.value).toBe(0.5)
    expect(mv.cube.fold.value).toBe(0.5)
    // The journey starts at the free tail end.
    const tail = mv.pathAt(0)
    expect(tail.x).toBeCloseTo(150, 6)
    expect(tail.y).toBeCloseTo(-600, 6)
    expect(mv.cable.edgeA.points.length).toBeGreaterThan(10)
    // The trail ends where the drawn cable meets the body — not through it.
    const trail = (mv.cable as unknown as { _path: (t: number) => { x: number; y: number } })._path
    const head = trail(mv.cable.clock.value)
    expect(head.x).toBeCloseTo(720, 6)
    expect(head.y).toBeCloseTo(-600, 6)
  })

  test("resampleByArcLength walks equal steps", () => {
    const pts = resampleByArcLength([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 4)
    expect(pts.length).toBe(5)
    expect(pts[2]).toEqual({ x: 10, y: 0 })
    expect(pts[4]).toEqual({ x: 10, y: 10 })
  })

  test("unknown symbol throws in buildSymbol, undefined in vocabById", () => {
    expect(vocabById("dragon")).toBeUndefined()
    expect(() => build("dragon", {})).toThrow()
  })
})

describe("recognizer reply parsing", () => {
  test("fenced JSON parses", () => {
    const r = parseRecognizeReply('```json\n{"candidates":[{"symbol":"circle","params":{"cx":"10","cy":20,"r":5},"confidence":0.9,"why":"round"}],"notes":"label: sun"}\n```')
    expect(r.error).toBeUndefined()
    expect(r.candidates).toEqual([{ symbol: "circle", params: { cx: 10, cy: 20, r: 5 }, confidence: 0.9, why: "round" }])
    expect(r.notes).toBe("label: sun")
  })

  test("prose around a bare object parses", () => {
    const r = parseRecognizeReply('Here you go: {"candidates":[{"symbol":"triangle","params":{},"confidence":1,"why":""}]} done')
    expect(r.candidates[0]!.symbol).toBe("triangle")
  })

  test("unknown and un-imported symbols are dropped; order by confidence", () => {
    const text = JSON.stringify({
      candidates: [
        { symbol: "dragon", params: {}, confidence: 1 },
        { symbol: "square", params: { size: 3 }, confidence: 0.3 },
        { symbol: "circle", params: { r: 3 }, confidence: 0.6 },
        { symbol: "cube", params: {}, confidence: 0.9 },
      ],
    })
    const r = parseRecognizeReply(text, ["circle", "square"])
    expect(r.candidates.map((c) => c.symbol)).toEqual(["circle", "square"])
  })

  test("all candidates unknown → error", () => {
    const r = parseRecognizeReply('{"candidates":[{"symbol":"dragon"}]}')
    expect(r.candidates).toEqual([])
    expect(r.error).toBeDefined()
  })

  test("coercion: fold clamped, junk numbers and unknown params dropped, points normalised", () => {
    const r = parseRecognizeReply(
      JSON.stringify({
        candidates: [
          {
            symbol: "mindVirus",
            params: { x: 1, y: "2", size: "big", fold: 3, wings: 2, cable: [[0, 0], { x: 5, y: 6 }, "junk"] },
            confidence: 7,
          },
        ],
      }),
    )
    const c = r.candidates[0]!
    expect(c.params).toEqual({ x: 1, y: 2, fold: 1, cable: [[0, 0], [5, 6]] })
    expect(c.confidence).toBe(1)
  })

  test("junk → error, never throws", () => {
    for (const junk of ["", "lol", "[]", "null", "{\"candidates\": 4}"]) {
      const r = parseRecognizeReply(junk)
      expect(r.candidates).toEqual([])
    }
    expect(parseRecognizeReply("lol").error).toBeDefined()
  })

  test("CLI output: the result event's text", () => {
    const out = JSON.stringify([{ type: "system" }, { type: "result", result: "{\"candidates\":[]}", num_turns: 2 }])
    expect(cliResultText(out)).toBe('{"candidates":[]}')
    expect(cliResultText(JSON.stringify({ type: "result", result: "x" }))).toBe("x")
    expect(() => cliResultText(JSON.stringify([{ type: "result", is_error: true, result: "limit" }]))).toThrow()
  })

  test("circle fit recovers centre and radius", () => {
    const pts = Array.from({ length: 50 }, (_, i) => ({
      x: 100 + 40 * Math.cos(i / 8),
      y: 200 + 40 * Math.sin(i / 8),
    }))
    const f = fitCircle(pts)!
    expect(f.cx).toBeCloseTo(100, 6)
    expect(f.cy).toBeCloseTo(200, 6)
    expect(f.r).toBeCloseTo(40, 6)
  })

  test("prompt names the image, the crop mapping and only the imported symbols", () => {
    const png = new Uint8Array(24)
    png.set([0x89, 0x50, 0x4e, 0x47], 0)
    new DataView(png.buffer).setUint32(16, 300)
    new DataView(png.buffer).setUint32(20, 200)
    const size = pngSize(png)
    expect(size).toEqual({ w: 300, h: 200 })
    const prompt = buildPrompt(
      {
        png: "",
        crop: { x: 100, y: 50, w: 600, h: 400 },
        strokes: [{ id: "a", points: [{ x: 1, y: 2, pressure: 1, t: 0 }] }],
        vocabulary: ["circle"],
      },
      "/tmp/x.png",
      size,
      [vocabById("circle")!],
    )
    expect(prompt).toContain("/tmp/x.png")
    expect(prompt).toContain("page x = 100 + px·2.0000")
    expect(prompt).toContain('id "circle"')
    expect(prompt).not.toContain('id "mindVirus"')
  })
})
