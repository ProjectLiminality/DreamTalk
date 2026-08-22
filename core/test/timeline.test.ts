import { describe, expect, test } from "bun:test"
import { Timeline } from "../src/timeline"
import { together, chain } from "../src/anim"
import { scalar, completion } from "../src/params"

describe("timeline resolution", () => {
  test("to(): initial value comes from the timeline, not live state", () => {
    const p = scalar(0)
    const tl = new Timeline([
      { anim: p.to(10, { easing: "linear" }), start: 0, duration: 1 },
      { anim: p.to(20, { easing: "linear" }), start: 2, duration: 1 },
    ])
    expect(tl.valueAt(p, 0)).toBe(0)
    expect(tl.valueAt(p, 0.5)).toBe(5)
    expect(tl.valueAt(p, 1)).toBe(10)
    // between clips: hold previous end
    expect(tl.valueAt(p, 1.5)).toBe(10)
    // second clip starts FROM 10 regardless of p.value mutations
    p.value = 999
    expect(tl.valueAt(p, 2.5)).toBe(15)
    expect(tl.valueAt(p, 3)).toBe(20)
    // after everything: hold last
    expect(tl.valueAt(p, 99)).toBe(20)
  })

  test("by(): relative offsets accumulate through the timeline", () => {
    const z = scalar(0)
    const tl = new Timeline([
      { anim: z.by(-100, { easing: "linear" }), start: 0, duration: 1 },
      { anim: z.by(-100, { easing: "linear" }), start: 1, duration: 1 },
    ])
    expect(tl.valueAt(z, 1)).toBe(-100)
    expect(tl.valueAt(z, 2)).toBe(-200)
  })

  test("sequence(): explicit waypoints, equally spaced", () => {
    const fold = scalar(0)
    const anim = fold.sequence(1, 0.1, 1)
    const tl = new Timeline([{ anim, start: 0, duration: 2 }])
    expect(tl.valueAt(fold, 0)).toBe(1)
    expect(tl.valueAt(fold, 1)).toBeCloseTo(0.1, 10)
    expect(tl.valueAt(fold, 2)).toBe(1)
  })

  test("hold-first rule: before its first segment a param holds that segment's initial value", () => {
    const creation = completion(1) // default visible…
    const anim = creation.sequence(0, 1) // …but Created at t=2
    const tl = new Timeline([{ anim, start: 2, duration: 1 }])
    // before creation: undrawn, NOT the default 1
    expect(tl.valueAt(creation, 0)).toBe(0)
    expect(tl.valueAt(creation, 3)).toBe(1)
  })

  test("untouched params sample their default", () => {
    const p = scalar(7)
    const q = scalar(0)
    const tl = new Timeline([{ anim: q.to(1), start: 0, duration: 1 }])
    expect(tl.valueAt(p, 0.5)).toBe(7)
  })

  test("clamping respects semantic ranges", () => {
    const c = completion(0)
    const tl = new Timeline([{ anim: c.to(2, { easing: "linear" }), start: 0, duration: 1 }])
    expect(tl.valueAt(c, 1)).toBe(1)
  })

  test("apply() writes live values", () => {
    const p = scalar(0)
    const tl = new Timeline([{ anim: p.to(10, { easing: "linear" }), start: 0, duration: 2 }])
    tl.apply(1)
    expect(p.value).toBe(5)
  })
})

describe("the relative-time algebra", () => {
  test("together(): parallel tracks share the span", () => {
    const a = scalar(0)
    const b = scalar(0)
    const tl = new Timeline([
      {
        anim: together(a.to(1, { easing: "linear" }), b.to(2, { easing: "linear" })),
        start: 0,
        duration: 2,
      },
    ])
    expect(tl.valueAt(a, 1)).toBe(0.5)
    expect(tl.valueAt(b, 1)).toBe(1)
  })

  test("sub-windows: [anim, a, b] renormalizes into the parent span (pydeation rescale)", () => {
    const p = scalar(0)
    const tl = new Timeline([
      {
        anim: together([p.to(1, { easing: "linear" }), 0.5, 1]),
        start: 0,
        duration: 2,
      },
    ])
    // occupies second half of the 2s span: starts at t=1
    expect(tl.valueAt(p, 1)).toBe(0)
    expect(tl.valueAt(p, 1.5)).toBe(0.5)
    expect(tl.valueAt(p, 2)).toBe(1)
  })

  test("nested windows compose multiplicatively", () => {
    const p = scalar(0)
    const inner = together([p.to(1, { easing: "linear" }), 0.5, 1]) // second half…
    const outer = together([inner, 0.5, 1]) // …of the second half = last quarter
    const tl = new Timeline([{ anim: outer, start: 0, duration: 4 }])
    expect(tl.valueAt(p, 3)).toBe(0)
    expect(tl.valueAt(p, 3.5)).toBe(0.5)
    expect(tl.valueAt(p, 4)).toBe(1)
  })

  test("chain(): sequential children divide the span", () => {
    const p = scalar(0)
    const q = scalar(0)
    const tl = new Timeline([
      {
        anim: chain(p.to(1, { easing: "linear" }), q.to(1, { easing: "linear" })),
        start: 0,
        duration: 2,
      },
    ])
    expect(tl.valueAt(p, 1)).toBe(1)
    expect(tl.valueAt(q, 1)).toBe(0)
    expect(tl.valueAt(q, 2)).toBe(1)
  })

  test("evaluation is a pure function of t (any sampling order)", () => {
    const p = scalar(0)
    const tl = new Timeline([
      { anim: p.sequence(0, 5, 2), start: 0, duration: 3 },
      { anim: p.by(10, { easing: "linear" }), start: 4, duration: 1 },
    ])
    const forward = [0, 1, 2, 3, 4, 4.5, 5].map((t) => tl.valueAt(p, t))
    const backward = [5, 4.5, 4, 3, 2, 1, 0].map((t) => tl.valueAt(p, t)).reverse()
    expect(forward).toEqual(backward)
    expect(tl.valueAt(p, 5)).toBe(12) // sequence ends at 2, then by(10)
  })
})
