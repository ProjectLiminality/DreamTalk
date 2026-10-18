import { describe, expect, test } from "bun:test"
import { arrowDrops, fateSeed, glyphStrokes, LOSS_KINDS, LossyChain, lossFate, MOCK_LOSSY_CHAIN } from "../vocabulary/LossyChain/LossyChain"

describe("LossyChain", () => {
  test("drops: losses × rate per arrow, capped", () => {
    expect(arrowDrops(3, [{ at: 0 }, { at: 0 }, { at: 2 }], 0.1)).toEqual([0.2, 0, 0.1])
    expect(arrowDrops(1, Array.from({ length: 20 }, () => ({ at: 0 })), 0.1)[0]).toBe(0.6)
  })

  test("fate is deterministic and the stream thins by the declared share", () => {
    const drops = [0.2, 0.1, 0.3]
    const n = 2000
    const fell = [0, 0, 0]
    let through = 0
    for (let j = 0; j < n; j++) {
      const a = lossFate(j, drops)
      expect(lossFate(j, drops)).toBe(a)
      if (a < 0) through++
      else fell[a]!++
    }
    // Equidistributed seeds: each arrow takes its share of what reaches it.
    expect(fell[0]! / n).toBeCloseTo(0.2, 2)
    expect(fell[1]! / n).toBeCloseTo(0.8 * 0.1, 2)
    expect(fell[2]! / n).toBeCloseTo(0.8 * 0.9 * 0.3, 2)
    expect(through / n).toBeCloseTo(0.8 * 0.9 * 0.7, 2)
    for (let j = 0; j < 50; j++) expect(fateSeed(j)).toBeGreaterThanOrEqual(0)
  })

  test("no losses, no fall", () => {
    for (let j = 0; j < 100; j++) expect(lossFate(j, [0, 0, 0])).toBe(-1)
  })

  test("five distinct glyphs, each in its unit box", () => {
    const keys = LOSS_KINDS.map((k) => JSON.stringify(glyphStrokes(k.kind)))
    expect(new Set(keys).size).toBe(5)
    for (const k of LOSS_KINDS)
      for (const run of glyphStrokes(k.kind))
        for (const p of run) expect(Math.max(Math.abs(p.x), Math.abs(p.y))).toBeLessThanOrEqual(1.0001)
  })

  test("its axes: losses, note, write — and time a clock", () => {
    const c = new LossyChain()
    void c.parts
    const space = c.stateSpace()
    expect(space.axes.map((a) => a.id)).toEqual(["losses", "note", "write"])
    expect(space.clocks).toEqual([c.time])
    expect(c.stages.map((s) => s.stageId)).toEqual(MOCK_LOSSY_CHAIN.stages.map((s) => s.id))
    expect(c.stage("ai").certainty.value).toBeLessThan(1)
  })
})
