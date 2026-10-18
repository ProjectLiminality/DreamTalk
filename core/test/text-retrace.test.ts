/**
 * When a Text retraces its contours (render/text.ts outlineRetraceDue):
 * held frames exactly, a moving zoom lazily, an unseen text never.
 */
import { describe, expect, test } from "bun:test"
import { OUTLINE_DRIFT, outlineRetraceDue } from "../src/render/text"

const base = { stale: false, seen: true, bucket: 10, traced: 10, lastBucket: 10, t: 1, lastT: 1 }

describe("outlineRetraceDue", () => {
  test("nothing to do when traced at this bucket", () => {
    expect(outlineRetraceDue(base)).toBe(false)
  })
  test("a held frame (same t) retraces a changed bucket at once", () => {
    expect(outlineRetraceDue({ ...base, bucket: 11, lastBucket: 11, t: 2, lastT: 2 })).toBe(true)
    // setT's second render: same t as the first, whose bucket differed.
    expect(outlineRetraceDue({ ...base, bucket: 12, lastBucket: 11, t: 2, lastT: 2 })).toBe(true)
  })
  test("a scale still moving through time keeps the traced contours", () => {
    expect(outlineRetraceDue({ ...base, bucket: 12, lastBucket: 11, t: 2, lastT: 1.9 })).toBe(false)
  })
  test("…until the scale holds for a frame", () => {
    expect(outlineRetraceDue({ ...base, bucket: 12, lastBucket: 12, t: 2, lastT: 1.9 })).toBe(true)
  })
  test("…or drifts past OUTLINE_DRIFT (~10%)", () => {
    const far = base.traced + OUTLINE_DRIFT + 1
    expect(outlineRetraceDue({ ...base, bucket: far, lastBucket: far - 1, t: 2, lastT: 1.9 })).toBe(true)
    expect(Math.exp(OUTLINE_DRIFT * Math.log(1.005))).toBeCloseTo(1.1, 2)
  })
  test("no t from the caller: every bucket change retraces", () => {
    expect(outlineRetraceDue({ ...base, bucket: 12, lastBucket: 11, t: undefined, lastT: Number.NaN })).toBe(true)
  })
  test("a fresh layout retraces even mid-zoom", () => {
    expect(outlineRetraceDue({ ...base, stale: true, bucket: 12, lastBucket: 11, t: 2, lastT: 1.9 })).toBe(true)
  })
  test("an unseen text never retraces", () => {
    expect(outlineRetraceDue({ ...base, seen: false, stale: true })).toBe(false)
    expect(outlineRetraceDue({ ...base, seen: false, bucket: 40, lastBucket: 40 })).toBe(false)
  })
})
