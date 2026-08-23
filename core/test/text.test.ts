/**
 * Text/Write — pure logic tests: the per-letter domino window math,
 * content → glyph grouping, the draw/fill phase split, and the Write /
 * UnWrite tracks. The GPU side (render/text.ts) re-derives the phase
 * math in TSL from the same constants; these tests are what keep the
 * two definitions honest.
 */

import { describe, expect, test } from "bun:test"
import {
  DRAW_WINDOW,
  FILL_WINDOW,
  Text,
  UnWrite,
  Write,
  WRITE_GLOBAL_SMOOTHING,
  WRITE_REL_OVERLAP,
  letterCount,
  letters,
  writePhases,
  writeWindows,
} from "../src/parts/text"
import { dominoWindows } from "../src/parts/index"
import { Create, UnCreate } from "../src/verbs"
import { WHITE } from "../src/constants"

describe("letters — content → glyph grouping", () => {
  test("non-whitespace characters, in order", () => {
    expect(letters("abc")).toEqual(["a", "b", "c"])
    expect(letters("syn-thesis")).toEqual([..."syn-thesis"])
  })

  test("whitespace never becomes a glyph (troika renders none)", () => {
    expect(letters("dialectical thinking")).toHaveLength(19)
    expect(letters("  a \t b \n ")).toEqual(["a", "b"])
    expect(letters("")).toEqual([])
  })

  test("the video-01 strings", () => {
    expect(letterCount("trans-perspectival")).toBe(18)
    expect(letterCount("thesis")).toBe(6)
    expect(letterCount("anti-thesis")).toBe(11)
    expect(letterCount("dialectical thinking")).toBe(19)
  })

  test("astral characters count as one letter, not two code units", () => {
    expect(letters("a😀b")).toEqual(["a", "😀", "b"])
  })
})

describe("writeWindows — the per-letter domino", () => {
  test("one window per glyph, ordered, inside [0, 1]", () => {
    const windows = writeWindows(18)
    expect(windows).toHaveLength(18)
    expect(windows[0]![0]).toBe(0)
    expect(windows[17]![1]).toBeGreaterThan(0.95)
    for (let i = 0; i < windows.length; i++) {
      const [a, b] = windows[i]!
      expect(a).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThanOrEqual(1)
      expect(b).toBeGreaterThan(a)
      if (i > 0) expect(a).toBeGreaterThan(windows[i - 1]![0])
    }
  })

  test("the 2021 dynamic relative duration, verbatim", () => {
    // rel_duration = 1 / (n·(1 − rel_overlap) + 1); the windows must be
    // exactly the shared domino algebra fed with it.
    for (const n of [1, 6, 18]) {
      const relDuration = 1 / (n * (1 - WRITE_REL_OVERLAP) + 1)
      expect(writeWindows(n)).toEqual(
        dominoWindows(n, relDuration, WRITE_GLOBAL_SMOOTHING),
      )
    }
  })

  test("letters overlap — the cascade is a domino, not a queue", () => {
    const windows = writeWindows(10)
    // rel_overlap 0.7 means each letter starts well before its
    // predecessor has finished.
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i]![0]).toBeLessThan(windows[i - 1]![1])
    }
  })

  test("longer strings do not run past the span", () => {
    // The shared domino shifts the first window to 0 and THEN rescales
    // the set to land on 1, so the start can drift a hair above 0 —
    // sub-frame, and the first letter is blank there anyway.
    for (const n of [2, 5, 19, 40]) {
      const windows = writeWindows(n)
      expect(windows[0]![0]).toBeCloseTo(0, 2)
      expect(windows[n - 1]![1]).toBeLessThanOrEqual(1)
    }
  })

  test("no glyphs, no windows", () => {
    expect(writeWindows(0)).toEqual([])
  })
})

describe("writePhases — DrawThenFillCompletely", () => {
  test("draw runs over the first 60%, fill over the last 50%", () => {
    expect(DRAW_WINDOW).toEqual([0, 0.6])
    expect(FILL_WINDOW).toEqual([0.5, 1])
  })

  test("a letter starts blank and ends solid", () => {
    expect(writePhases(0)).toEqual({ draw: 0, fill: 0 })
    expect(writePhases(1)).toEqual({ draw: 1, fill: 1 })
  })

  test("the outline completes before the fill begins to dominate", () => {
    const early = writePhases(0.3)
    expect(early.draw).toBeCloseTo(0.5, 10)
    expect(early.fill).toBe(0)

    // The phases overlap by design: at 0.55 the outline is nearly done
    // and the fill has just started.
    const mid = writePhases(0.55)
    expect(mid.draw).toBeCloseTo(0.55 / 0.6, 10)
    expect(mid.fill).toBeCloseTo(0.1, 10)

    // Past the draw window the outline is complete, the fill still rising.
    const late = writePhases(0.8)
    expect(late.draw).toBe(1)
    expect(late.fill).toBeCloseTo(0.6, 10)
  })

  test("both phases are monotonic and clamped", () => {
    let prevDraw = -1
    let prevFill = -1
    for (let i = 0; i <= 40; i++) {
      const { draw, fill } = writePhases(i / 40)
      expect(draw).toBeGreaterThanOrEqual(prevDraw)
      expect(fill).toBeGreaterThanOrEqual(prevFill)
      expect(draw).toBeLessThanOrEqual(1)
      expect(fill).toBeLessThanOrEqual(1)
      prevDraw = draw
      prevFill = fill
    }
    // Out-of-range progress clamps rather than extrapolating.
    expect(writePhases(-1)).toEqual({ draw: 0, fill: 0 })
    expect(writePhases(2)).toEqual({ draw: 1, fill: 1 })
  })
})

describe("Text holon", () => {
  test("defaults follow the vocabulary report", () => {
    const text = new Text()
    expect(text.size.value).toBe(50)
    expect(text.stroke.value).toBe(5)
    expect(text.tint.value).toEqual(WHITE)
    expect(text.font).toBeUndefined()
  })

  test("content and look are set through the constructor", () => {
    const text = new Text({ content: "syn-thesis", size: 30, z: -120 })
    expect(text.content).toBe("syn-thesis")
    expect(text.size.value).toBe(30)
    expect(text.z.value).toBe(-120)
  })

  test("per-letter access exposes each glyph's window", () => {
    const text = new Text({ content: "anti-thesis" })
    const glyphs = text.letters
    expect(glyphs).toHaveLength(11)
    expect(glyphs.map((g) => g.char).join("")).toBe("anti-thesis")
    expect(glyphs.map((g) => g.index)).toEqual([...Array(11).keys()])
    expect(glyphs.map((g) => g.window)).toEqual(writeWindows(11))
  })

  test("per-letter progress tracks the write front", () => {
    const text = new Text({ content: "abc" })
    const [first, , last] = text.letters
    text.creation.value = 0
    expect(text.letterProgress(0)).toBe(0)
    expect(text.letterProgress(2)).toBe(0)

    // Mid-way through the first letter's own window.
    text.creation.value = (first!.window[0] + first!.window[1]) / 2
    expect(text.letterProgress(0)).toBeCloseTo(0.5, 10)
    // …and the last letter has not started.
    expect(text.letterProgress(2)).toBe(0)

    text.creation.value = 1
    expect(text.letterProgress(0)).toBe(1)
    expect(text.letterProgress(2)).toBe(1)
    expect(text.letterPhases(2)).toEqual({ draw: 1, fill: 1 })
  })

  test("letters lead each other — the domino ordering, live", () => {
    const text = new Text({ content: "trans-perspectival" })
    text.creation.value = 0.5
    const progress = text.letters.map((_, i) => text.letterProgress(i))
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]!).toBeLessThanOrEqual(progress[i - 1]!)
    }
  })

  test("an out-of-range letter index is inert", () => {
    const text = new Text({ content: "hi" })
    expect(text.letterProgress(7)).toBe(0)
    expect(text.letterPhases(7)).toEqual({ draw: 0, fill: 0 })
  })
})

describe("Write / UnWrite tracks", () => {
  test("Write drives creation 0 → 1 on a LINEAR track", () => {
    const text = new Text({ content: "thesis" })
    const { tracks } = Write(text)
    expect(tracks).toHaveLength(1)
    const track = tracks[0]!
    expect(track.param).toBe(text.creation)
    expect(track.mode).toBe("sequence")
    expect(track.values).toEqual([0, 1])
    // The domino algebra already carries the easing — smoothing here
    // would ease the cascade twice.
    expect(track.easing).toBe("linear")
  })

  test("UnWrite runs a SECOND forward front, not creation backwards", () => {
    // pydeation's UnWrite is Domino(UnFillThenUnDraw) over the SAME
    // letter order (animator.py:128-140), so the first letter goes
    // first. Running `creation` 1 → 0 would take the LAST letter first
    // — video-01 f0778-f0782 show the reference losing "dialectical"
    // while "thinking" still stands.
    const text = new Text({ content: "thesis" })
    const track = UnWrite(text).tracks[0]!
    expect(track.param).toBe(text.erasure)
    expect(track.values).toEqual([0, 1])
    expect(track.easing).toBe("linear")
  })

  test("Create(text) dispatches to Write, not the default draw-on", () => {
    const text = new Text({ content: "dialectical thinking" })
    const { tracks } = Create(text)
    expect(tracks).toHaveLength(1)
    expect(tracks[0]!.param).toBe(text.creation)
    expect(tracks[0]!.easing).toBe("linear")
  })

  test("UnCreate(text) dispatches to UnWrite via the erase front", () => {
    const text = new Text({ content: "dialectical thinking" })
    const { tracks } = UnCreate(text)
    expect(tracks).toHaveLength(1)
    expect(tracks[0]!.param).toBe(text.erasure)
    expect(tracks[0]!.values).toEqual([0, 1])
    expect(tracks[0]!.easing).toBe("linear")
  })

  test("the two fronts compose as min(write, 1 − erase), per letter", () => {
    const text = new Text({ content: "abc" })
    // Fully written, untouched by the erase front: every letter solid.
    text.creation.value = 1
    text.erasure.value = 0
    expect(text.letterPhasesNow(0)).toEqual({ draw: 1, fill: 1 })
    // The erase front fully past letter 0: that letter is gone while
    // the LAST letter, whose window ends later, still stands.
    text.erasure.value = 1
    expect(text.letterPhasesNow(0)).toEqual({ draw: 0, fill: 0 })
    // Halfway through the erase front, the cascade points FORWARD:
    // the first letter is never further along than the last.
    text.erasure.value = 0.5
    expect(text.letterErasure(0)).toBeGreaterThanOrEqual(text.letterErasure(2))
  })
})
