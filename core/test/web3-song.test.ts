/**
 * The Web3 DreamSong — and the two framework changes it needed.
 *
 *  - `say(text, { duration })`: a real recording's measured length is the
 *    slot, stated in the score (narration stays a pure function of source).
 *  - `Param.gate`: a song hides chapters by gating opacity, which reaches a
 *    BOUND opacity too — writing one throws, and ClarityField, YinYang and
 *    LightSpread all bind theirs.
 */

import { describe, expect, test } from "bun:test"
import { Dream } from "../src/dream"
import { Narration } from "../src/narration"
import { scalar } from "../src/params"
import { Web3Dream, WEB3_VOICEOVER } from "../demo/web3/Web3Song"
import { Shot09QuoteDream } from "../demo/web3/Shot09Quote"

describe("say() with a stated duration", () => {
  test("the slot is the stated length, not the estimate", () => {
    const n = new Narration()
    expect(n.add("Short.", 0, "David", 12.5)).toBe(12.5)
    expect(n.lines[0]!.duration).toBe(12.5)
  })

  test("through Dream.say", () => {
    class D extends Dream {
      unfold() {
        this.say("Words.", { voice: "David", duration: 4 })
      }
    }
    expect(new D().narration.lines[0]!.duration).toBe(4)
  })
})

describe("Param.gate", () => {
  test("scales a bound reading without touching the binding", () => {
    const src = scalar(0.8)
    const p = scalar(0)
    p.follow(src)
    p.gate = 0.5
    expect(p.value).toBeCloseTo(0.4)
    p.gate = 1
    expect(p.value).toBeCloseTo(0.8)
  })

  test("scales a plain value the same way", () => {
    const p = scalar(0.6)
    p.gate = 0
    expect(p.value).toBe(0)
    p.gate = 1
    expect(p.value).toBe(0.6)
  })
})

describe("the Web3 song", () => {
  const song = new Web3Dream()

  test("is the video's length — song time is video time", () => {
    expect(song.duration).toBeCloseTo(171, 6)
  })

  test("thirteen chapters, contiguous, covering all seventeen shots", () => {
    const ch = song.chapters
    expect(ch.length).toBe(13)
    for (let i = 1; i < ch.length; i++) {
      const overlap = ch[i]!.transition?.duration ?? 0
      expect(ch[i]!.offset).toBeCloseTo(ch[i - 1]!.offset + ch[i - 1]!.span - overlap, 6)
    }
  })

  test("the voice-over never talks over itself", () => {
    expect(song.narration.overlaps()).toEqual([])
    expect(song.narration.lines.length).toBe(WEB3_VOICEOVER.length)
  })

  test("the quote is spoken in the voice the Quote holon carries", () => {
    const quote = new Shot09QuoteDream().quote
    const line = song.narration.lines.find((l) => l.voice === quote.voice)
    expect(line?.text).toBe(quote.spoken())
  })

  test("samples anywhere without throwing (bound opacities are gated, not written)", () => {
    for (let t = 0; t <= 171; t += 3.7) song.applyAt(t)
  })
})
