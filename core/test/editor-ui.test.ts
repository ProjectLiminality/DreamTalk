/**
 * The timeline's clip reading, and the numeric field's entry parsing.
 *
 * Both are pure functions over real scene data, so they are testable
 * without a DOM — which is the point of having split them out of the
 * mount functions. What is pinned here is the behaviour the SPEC names:
 * a row labelled by what it animates, sub-windows recovered from the
 * tracks' own algebra, and a field that can express 250.0 exactly (the
 * complaint that motivated replacing the slider in the first place).
 */

import { expect, test, describe } from "bun:test"
import { describeClip } from "../editor/timeline"
import { parseEntry, formatNumber, wantsSlider } from "../editor/numeric"
import { together, chain, type Anim } from "../src/anim"
import { Circle, Rectangle, Axes } from "../src/parts/index"
import { Create, FadeIn } from "../src/verbs"
import { completion, bipolar, length, angle, integer, scalar } from "../src/params"
import type { Clip } from "../src/timeline"

const clipOf = (anim: Anim, start = 0, duration = 2): Clip => ({ anim, start, duration })

describe("describeClip", () => {
  test("labels a row by the holon class and the params it moves", () => {
    const circle = new Circle({ radius: 50 })
    const row = describeClip(clipOf(Create(circle)), 0)
    expect(row.label).toContain("Circle")
    expect(row.label).toContain("creation")
    expect(row.holons[0]).toBe(circle)
  })

  test("names the SYMBOL, not the leaf part that owns the param", () => {
    // An Axes animates through its own child Lines. A row reading "Line"
    // would name something the scene never wrote.
    const axes = new Axes({ mode: "x", drawGrid: true })
    const row = describeClip(clipOf(Create(axes)), 0)
    expect(row.label).toContain("Axes")
    expect(row.label).not.toContain("Line")
  })

  test("two classes read as a pair; more collapse to a count", () => {
    const a = new Circle({ radius: 10 })
    const b = new Rectangle({ width: 10, height: 10 })
    const pair = describeClip(clipOf(together(Create(a), Create(b))), 0)
    expect(pair.label).toContain("Circle")
    expect(pair.label).toContain("Rectangle")

    const three = describeClip(
      clipOf(
        together(
          Create(new Circle({ radius: 1 })),
          Create(new Rectangle({ width: 1, height: 1 })),
          Create(new Axes({ mode: "x" })),
        ),
      ),
      0,
    )
    expect(three.label).toMatch(/\+\d/)
  })

  test("a plain parallel group is one full-span window", () => {
    const row = describeClip(
      clipOf(together(Create(new Circle({ radius: 1 })), FadeIn(new Circle({ radius: 2 })))),
      0,
    )
    expect(row.cascade).toBe(false)
    expect(row.windows).toHaveLength(1)
    expect(row.windows[0]!.start).toBe(0)
    expect(row.windows[0]!.stop).toBe(1)
  })

  test("a chain of three recovers three windows at thirds", () => {
    const row = describeClip(
      clipOf(
        chain(
          Create(new Circle({ radius: 1 })),
          Create(new Circle({ radius: 2 })),
          Create(new Circle({ radius: 3 })),
        ),
      ),
      0,
    )
    expect(row.cascade).toBe(false)
    expect(row.windows).toHaveLength(3)
    expect(row.windows[0]!.stop).toBeCloseTo(1 / 3, 5)
    expect(row.windows[1]!.start).toBeCloseTo(1 / 3, 5)
    expect(row.windows[2]!.stop).toBeCloseTo(1, 5)
  })

  test("an explicit sub-window [anim, a, b] survives into the row", () => {
    const row = describeClip(clipOf(together([Create(new Circle({ radius: 1 })), 0.25, 0.75])), 0)
    expect(row.windows[0]!.start).toBeCloseTo(0.25, 5)
    expect(row.windows[0]!.stop).toBeCloseTo(0.75, 5)
  })

  test("a domino collapses to ONE swept band, not dozens of hairlines", () => {
    // A gridded Axes staggers its many lines — the exact shape that would
    // otherwise render as the per-parameter lane dump the spec forbids.
    const axes = new Axes({
      mode: "xy",
      drawGrid: true,
      gridSpacing: 100,
      xStart: -500,
      xEnd: 500,
      yStart: -500,
      yEnd: 500,
    })
    const row = describeClip(clipOf(Create(axes)), 0)
    expect(row.cascade).toBe(true)
    expect(row.windows).toHaveLength(1)
    // The single band is the envelope of everything it stands for.
    expect(row.windows[0]!.count).toBeGreaterThan(6)
    expect(row.windows[0]!.start).toBeGreaterThanOrEqual(0)
    expect(row.windows[0]!.stop).toBeLessThanOrEqual(1)
  })
})

describe("parseEntry — a field must be able to say 250.0", () => {
  test("plain numbers, including the one a slider could not express", () => {
    expect(parseEntry("250")).toBe(250)
    expect(parseEntry("250.0")).toBe(250)
    expect(parseEntry("-0.5")).toBe(-0.5)
    expect(parseEntry("  1.25  ")).toBe(1.25)
    expect(parseEntry("1e3")).toBe(1000)
  })

  test("one infix operation, the arithmetic a human would do in their head", () => {
    expect(parseEntry("250/2")).toBe(125)
    expect(parseEntry("100 + 40")).toBe(140)
    expect(parseEntry("3*7")).toBe(21)
    expect(parseEntry("10-2.5")).toBe(7.5)
  })

  test("rejects rather than guesses", () => {
    expect(parseEntry("")).toBeUndefined()
    expect(parseEntry("abc")).toBeUndefined()
    expect(parseEntry("1+")).toBeUndefined()
    // No arbitrary evaluation: this is not an eval() in disguise.
    expect(parseEntry("alert(1)")).toBeUndefined()
    expect(parseEntry("1+2+3")).toBeUndefined()
  })

  test("a division by zero is refused, not passed on as Infinity", () => {
    expect(parseEntry("1/0")).toBeUndefined()
  })
})

describe("formatNumber", () => {
  test("keeps whole numbers whole and drops trailing zeros", () => {
    expect(formatNumber(250, 2)).toBe("250")
    expect(formatNumber(0.5, 3)).toBe("0.5")
    expect(formatNumber(Math.PI / 2, 3)).toBe("1.571")
    expect(formatNumber(-0, 2)).toBe("0")
  })

  test("never yields scientific notation or a float tail", () => {
    expect(formatNumber(0.1 + 0.2, 3)).toBe("0.3")
    expect(formatNumber(1e-7, 3)).toBe("0")
    expect(formatNumber(NaN, 2)).toBe("—")
  })
})

describe("wantsSlider — a slider only where the RANGE is the meaning", () => {
  test("bounded, proportional params keep one", () => {
    expect(wantsSlider(completion(0))).toBe(true)
    expect(wantsSlider(bipolar(0))).toBe(true)
  })

  test("everything a number happens to be does not", () => {
    // The 250.0 complaint: a length over [-600, 600] gets the field alone.
    expect(wantsSlider(length(250))).toBe(false)
    expect(wantsSlider(scalar(0))).toBe(false)
    expect(wantsSlider(angle(0))).toBe(false)
    expect(wantsSlider(integer(6))).toBe(false)
  })
})
