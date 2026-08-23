import { describe, expect, test } from "bun:test"
import { Timeline, c4dEaseWith, smoothingFor } from "../src/timeline"
import { together, chain, restage } from "../src/anim"
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

describe("C4D auto-tangent easing", () => {
  test("the ease is monotone, pinned at both ends, and symmetric when its tangents are", () => {
    expect(c4dEaseWith(0, 0.25, 0.25)).toBe(0)
    expect(c4dEaseWith(1, 0.25, 0.25)).toBe(1)
    expect(c4dEaseWith(0.5, 0.25, 0.25)).toBeCloseTo(0.5, 9)
    let prev = -1
    for (let i = 0; i <= 20; i++) {
      const v = c4dEaseWith(i / 20, 0.25, 0.25)
      expect(v).toBeGreaterThan(prev)
      prev = v
    }
    // The symmetric ease mirrors about its midpoint.
    for (const u of [0.1, 0.25, 0.4]) {
      expect(c4dEaseWith(u, 0.3, 0.3) + c4dEaseWith(1 - u, 0.3, 0.3)).toBeCloseTo(1, 9)
    }
  })

  test("a zeroed tangent removes the ease on that side only", () => {
    // smoothing_right = 0 (easeIn): eased at the start, so it runs behind
    // linear early — and it ARRIVES at speed, where the symmetric ease has
    // already flattened out.
    expect(c4dEaseWith(0.1, 0.25, 0)).toBeLessThan(0.1)
    const slopeIn = (1 - c4dEaseWith(0.999, 0.25, 0)) / 0.001
    const slopeSym = (1 - c4dEaseWith(0.999, 0.25, 0.25)) / 0.001
    expect(slopeIn).toBeGreaterThan(0.5)
    expect(slopeSym).toBeLessThan(0.05)
    // smoothing_left = 0 (easeOut): the mirror image — it LEAVES at speed.
    expect(c4dEaseWith(0.1, 0, 0.25)).toBeGreaterThan(c4dEaseWith(0.1, 0.25, 0.25))
    expect(c4dEaseWith(0.001, 0, 0.25) / 0.001).toBeGreaterThan(0.5)
    // Zero on both sides is the straight ramp.
    for (const u of [0.2, 0.5, 0.8]) expect(c4dEaseWith(u, 0, 0)).toBeCloseTo(u, 6)
  })

  test("smoothingFor keeps the stated tangents unless they were stated wider", () => {
    // An ordinary track eases over its OWN window, whatever that is.
    expect(smoothingFor("smooth", 1)).toEqual({ left: 0.25, right: 0.25 })
    expect(smoothingFor("smooth", 0.5)).toEqual({ left: 0.25, right: 0.25 })
    // A restaged one carries tangents stated against the wider window,
    // so squeezing it into half the span doubles them.
    expect(smoothingFor("easeIn", 0.5, 1)).toEqual({ left: 0.5, right: 0 })
    expect(smoothingFor("easeOut", 0.5, 0.75)).toEqual({ left: 0, right: 0.375 })
    // Never past 1: beyond that the control points cross.
    expect(smoothingFor("smooth", 0.1, 1).left).toBe(1)
    expect(smoothingFor("linear", 0.25, 1)).toEqual({ left: 0, right: 0 })
  })

  test("restage() stretches the ease into its new window; a plain tuple does not", () => {
    const plain = completion(0)
    const staged = completion(0)
    const tl = new Timeline([
      { anim: together([plain.sequence(0, 1), 0, 0.5]), start: 0, duration: 2 },
      { anim: restage(staged.sequence(0, 1), 0, 0.5), start: 0, duration: 2 },
    ])
    // Same window, same endpoints…
    for (const p of [plain, staged]) {
      expect(tl.valueAt(p, 0)).toBe(0)
      expect(tl.valueAt(p, 1)).toBeCloseTo(1, 6)
      expect(tl.valueAt(p, 1.5)).toBe(1)
    }
    // …but the restaged one carries a longer ease-in, so it runs behind
    // through the opening of the window and catches up at the close.
    // (The default ease is symmetric, so they meet at the midpoint.)
    expect(tl.valueAt(staged, 0.25)).toBeLessThan(tl.valueAt(plain, 0.25))
    expect(tl.valueAt(staged, 0.5)).toBeCloseTo(tl.valueAt(plain, 0.5), 6)
    expect(tl.valueAt(staged, 0.75)).toBeGreaterThan(tl.valueAt(plain, 0.75))
  })
})
