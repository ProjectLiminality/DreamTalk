/**
 * speculate.ts — reading ahead of ✦: the likely selection, the idle wait,
 * one reading in flight, answers kept by ink — driven by fake timers and a
 * fake recognizer.
 */

import { describe, expect, test } from "bun:test"
import type { InkStroke, RecognizeRequest, RecognizeResponse } from "../sketch/protocol"
import { inkKey, likelySelection, Speculator } from "../sketch/speculate"

const stroke = (id: string, x: number, y: number, w = 40): InkStroke => ({
  id,
  points: [
    { x, y, pressure: 0.5, t: 0 },
    { x: x + w, y: y + w, pressure: 0.5, t: 8 },
  ],
})

const fakeTimers = () => {
  const pending = new Map<number, () => void>()
  let n = 0
  return {
    timers: {
      set: (f: () => void) => (pending.set(++n, f), n),
      clear: (h: unknown) => void pending.delete(h as number),
    },
    /** Let the page rest: every pending timer fires. */
    rest: () => {
      const fs = [...pending.values()]
      pending.clear()
      for (const f of fs) f()
    },
    get count() {
      return pending.size
    },
  }
}

const reading: RecognizeResponse = { candidates: [{ symbol: "circle", params: { cx: 1, cy: 1, r: 1 }, confidence: 0.9, why: "" }] }

const setup = (answer: () => Promise<RecognizeResponse> = async () => reading) => {
  const t = fakeTimers()
  const asked: { req: RecognizeRequest; signal: AbortSignal }[] = []
  let idle = true
  let ready = 0
  const s = new Speculator({
    ask: (req, signal) => (asked.push({ req, signal }), answer()),
    build: (strokes, vocabulary) => ({ png: "", crop: { x: 0, y: 0, w: 1, h: 1 }, strokes, vocabulary }),
    isIdle: () => idle,
    onReady: () => ready++,
    timers: t.timers,
  })
  s.enabled = true
  return { s, t, asked, setIdle: (v: boolean) => (idle = v), ready: () => ready }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe("the likely selection", () => {
  test("the burst just drawn, not the drawing across the page", () => {
    const far = stroke("far", 1500, 1200)
    const burst = [stroke("a", 100, 100), stroke("b", 130, 120), stroke("c", 170, 150)]
    expect(likelySelection([far, ...burst]).map((k) => k.id)).toEqual(["a", "b", "c"])
  })

  test("walking back stops at the first stroke out of reach", () => {
    const ids = likelySelection([stroke("old", 120, 110), stroke("gap", 900, 900), stroke("new", 100, 100)]).map((k) => k.id)
    expect(ids).toEqual(["new"])
  })
})

describe("reading ahead", () => {
  const ink = [stroke("a", 100, 100)]
  const target = () => ({ strokes: ink, vocabulary: ["circle"] })

  test("off: nothing is asked, ever", () => {
    const { s, t, asked } = setup()
    s.enabled = false
    s.poke(target)
    t.rest()
    expect(asked).toHaveLength(0)
  })

  test("asks once the page rests, once per ink, and keeps the answer for ✦", async () => {
    const { s, t, asked, ready } = setup()
    s.poke(target)
    s.poke(target)
    expect(asked).toHaveLength(0) // still waiting for the rest
    t.rest()
    expect(asked).toHaveLength(1)
    await flush()
    expect(ready()).toBe(1)
    expect(s.ready({ strokes: ink, vocabulary: ["circle"] })).toBe(true)
    expect(await s.answer({ strokes: ink, vocabulary: ["circle"] })).toEqual(reading)
    // The same ink again: already read.
    s.poke(target)
    t.rest()
    expect(asked).toHaveLength(1)
  })

  test("✦ during the reading waits for it instead of asking again", async () => {
    let resolve!: (r: RecognizeResponse) => void
    const { s, t, asked } = setup(() => new Promise((r) => (resolve = r)))
    s.poke(target)
    t.rest()
    const pending = s.answer({ strokes: ink, vocabulary: ["circle"] })
    expect(pending).toBeDefined()
    resolve(reading)
    expect(await pending).toEqual(reading)
    expect(asked).toHaveLength(1)
    // Different ink: no answer to give.
    expect(s.answer({ strokes: [stroke("z", 0, 0)], vocabulary: ["circle"] })).toBeUndefined()
  })

  test("new ink aborts the reading in flight", () => {
    const { s, t, asked } = setup(() => new Promise(() => {}))
    s.poke(target)
    t.rest()
    s.poke(() => ({ strokes: [...ink, stroke("b", 120, 120)], vocabulary: ["circle"] }))
    t.rest()
    expect(asked).toHaveLength(2)
    expect(asked[0]!.signal.aborted).toBe(true)
    expect(asked[1]!.signal.aborted).toBe(false)
  })

  test("mid-gesture it waits for the next rest", () => {
    const { s, t, asked, setIdle } = setup()
    setIdle(false)
    s.poke(target)
    t.rest()
    expect(asked).toHaveLength(0)
    expect(t.count).toBe(1)
    setIdle(true)
    t.rest()
    expect(asked).toHaveLength(1)
  })

  test("an empty reading is not kept: ✦ asks properly", async () => {
    const { s, t } = setup(async () => ({ candidates: [] }))
    s.poke(target)
    t.rest()
    await flush()
    expect(s.answer({ strokes: ink, vocabulary: ["circle"] })).toBeUndefined()
  })

  test("the key is the ink and the imports, in any order", () => {
    const a = stroke("a", 1, 1), b = stroke("b", 5, 5)
    expect(inkKey({ strokes: [a, b], vocabulary: ["x", "y"] })).toBe(inkKey({ strokes: [b, a], vocabulary: ["y", "x"] }))
    expect(inkKey({ strokes: [a], vocabulary: ["x"] })).not.toBe(inkKey({ strokes: [stroke("a", 9, 9)], vocabulary: ["x"] }))
  })
})
