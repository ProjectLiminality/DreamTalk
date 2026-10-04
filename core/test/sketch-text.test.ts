/**
 * sketch-text.test.ts — handwriting made platonic: the `text` vocabulary
 * entry (sketch/vocabulary.ts). Its input is the string, its output the
 * animated geometry of writing it — so the promises are about placement
 * (the cap band where the hand wrote it), transforms (size scales, the
 * baseline turns, the words never change), the recognizer's handling of
 * a transcription, and that a board's Text is ready for Write.
 */

import { describe, expect, test } from "bun:test"
import { buildSymbol, TEXT_ASCENDER_EM, TEXT_CAP_EM, textBandEm, transformSymbol } from "../sketch/vocabulary"
import { parseRecognizeReply, buildPrompt } from "../scripts/recognize"
import { symbolBox } from "../sketch/state"
import { vocabById } from "../sketch/vocabulary"
import { boardDream, type BoardDream } from "../demo/boards/Board"
import { Text, Write, UnWrite } from "../src/parts/text"
import type { PlacedSymbol } from "../sketch/protocol"

const text = (params: Record<string, unknown>): PlacedSymbol => ({ id: "t1", symbol: "text", params, fromStrokes: [] })

describe("text symbol", () => {
  test("builds a bare Text: the string is data, the em from the cap height", () => {
    const t = buildSymbol(text({ content: "DreamTalk", cx: 700, cy: 400, size: 80, rotation: 0 })) as Text
    expect(t).toBeInstanceOf(Text)
    expect(t.content).toBe("DreamTalk")
    expect(t.size.value).toBeCloseTo(80 / TEXT_CAP_EM, 9)
    // The baseline sits half a cap below the centre (page y down → scene −).
    expect(t.x.value).toBeCloseTo(700, 9)
    expect(t.y.value).toBeCloseTo(-(400 + 40), 9)
    expect(t.b.value).toBeCloseTo(0, 9)
  })

  test("the band is the capitals' when one was written, else the tall letters'", () => {
    expect(textBandEm("DreamTalk")).toBe(TEXT_CAP_EM)
    expect(textBandEm("route 66")).toBe(TEXT_CAP_EM)
    expect(textBandEm("dreamtalk")).toBe(TEXT_ASCENDER_EM)
    expect(textBandEm("one")).toBe(TEXT_CAP_EM) // no tall letter: the cap band is the fallback
    const t = buildSymbol(text({ content: "hello", cx: 0, cy: 0, size: 80 })) as Text
    expect(t.size.value).toBeCloseTo(80 / TEXT_ASCENDER_EM, 9)
  })

  test("rotation turns the block about its centre, not its baseline", () => {
    const r = Math.PI / 2 // clockwise quarter: the text reads top → bottom
    const t = buildSymbol(text({ content: "x", cx: 700, cy: 400, size: 80, rotation: r })) as Text
    // The baseline's "below" now points to page −x.
    expect(t.x.value).toBeCloseTo(700 - 40, 9)
    expect(t.y.value).toBeCloseTo(-400, 9)
    expect(t.b.value).toBeCloseTo(-r, 9)
  })

  test("several lines centre the whole block", () => {
    const t = buildSymbol(text({ content: "A\nB", cx: 0, cy: 0, size: 100 })) as Text
    const step = (100 / TEXT_CAP_EM) * 1.2
    expect(t.y.value).toBeCloseTo(-(50 - step / 2), 9)
    expect(t.lineHeight).toBe(1.2)
  })

  test("transform: size scales, rotation turns, the words stay", () => {
    const s = text({ content: "Hello", cx: 100, cy: 100, size: 50, rotation: 0 })
    const out = transformSymbol(s, { pivot: { x: 100, y: 100 }, scale: 2, rotate: 0.3, translate: { x: 10, y: 0 } })
    expect(out.params.content).toBe("Hello")
    expect(out.params.size).toBeCloseTo(100, 9)
    expect(out.params.rotation).toBeCloseTo(0.3, 9)
    expect(out.params.cx).toBeCloseTo(110, 9)
  })

  test("its footprint is wide like the word, not square", () => {
    const b = symbolBox(text({ content: "DreamTalk", cx: 700, cy: 400, size: 80 }))
    expect(b.w).toBeGreaterThan(4 * b.h)
    expect(b.x + b.w / 2).toBeCloseTo(700, 9)
  })

  test("recognizer: the transcription survives coercion verbatim; empty text is dropped", () => {
    const r = parseRecognizeReply(
      JSON.stringify({
        candidates: [
          { symbol: "text", params: { content: "DreamTalk", cx: "700", cy: 400, size: 80, rotation: 0 }, confidence: 0.95 },
          { symbol: "text", params: { content: "  ", cx: 1, cy: 1, size: 1 }, confidence: 0.9 },
        ],
      }),
    )
    expect(r.candidates.length).toBe(1)
    expect(r.candidates[0]!.params).toEqual({ content: "DreamTalk", cx: 700, cy: 400, size: 80, rotation: 0 })
  })

  test("the prompt teaches words-alone → text, words-beside-a-shape → notes", () => {
    const prompt = buildPrompt(
      { png: "", crop: { x: 0, y: 0, w: 10, h: 10 }, strokes: [], vocabulary: ["circle", "text"] },
      "/tmp/x.png",
      undefined,
      [vocabById("circle")!, vocabById("text")!],
    )
    expect(prompt).toContain('it IS the symbol "text"')
    expect(prompt).toContain("never with \"text\"")
    const noText = buildPrompt(
      { png: "", crop: { x: 0, y: 0, w: 10, h: 10 }, strokes: [], vocabulary: ["circle"] },
      "/tmp/x.png",
      undefined,
      [vocabById("circle")!],
    )
    expect(noText).not.toContain('it IS the symbol "text"')
  })

  test("a board's Text is ready to Write in and UnWrite out", () => {
    const board = {
      strokes: [],
      symbols: [{ id: "t1", symbol: "text", params: { content: "DreamTalk", cx: 700, cy: 400, size: 80, rotation: 0 }, fromStrokes: [] }],
    }
    class Opening extends boardDream("scratch", board) {
      override unfold() {
        super.unfold()
        const words = (this as unknown as BoardDream).byId.t1 as Text
        this.play(Write(words), 2)
        this.wait(1)
        this.play(UnWrite(words), 1)
      }
    }
    const dream = new Opening() as BoardDream
    void dream.roots // unfold
    const words = dream.byId.t1 as Text
    expect(words).toBeInstanceOf(Text)
    expect(dream.duration).toBeCloseTo(4, 6)
    dream.applyAt(1)
    expect(words.creation.value).toBeCloseTo(0.5, 6) // linear: the domino carries the easing
    dream.applyAt(2.5)
    expect(words.creation.value).toBeCloseTo(1, 6)
    expect(words.erasure.value).toBeCloseTo(0, 6)
    dream.applyAt(4)
    expect(words.erasure.value).toBeCloseTo(1, 6)
  })
})
