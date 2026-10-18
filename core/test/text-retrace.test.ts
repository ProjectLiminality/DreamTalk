/**
 * When a Text retraces its contours (render/text.ts outlineRetraceDue):
 * held frames exactly, a moving zoom lazily, an unseen text never.
 */
import { describe, expect, test } from "bun:test"
import {
  OUTLINE_DRIFT,
  RETRACE_BUDGET,
  forgetMovingRetrace,
  grantMovingRetrace,
  noteTextSync,
  onTextLayout,
  outlineRetraceDue,
  requestOutlineSettle,
} from "../src/render/text"
import * as TextRender from "../src/render/text"
import { Text } from "../src/parts/text"

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
  test("…until the scale holds for a frame (then within the frame's budget)", () => {
    expect(outlineRetraceDue({ ...base, bucket: 12, lastBucket: 12, t: 2, lastT: 1.9 })).toBe("budget")
  })
  test("…or drifts past OUTLINE_DRIFT (~10%): then within the frame's budget", () => {
    const far = base.traced + OUTLINE_DRIFT + 1
    expect(outlineRetraceDue({ ...base, bucket: far, lastBucket: far - 1, t: 2, lastT: 1.9 })).toBe("budget")
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

describe("requestOutlineSettle", () => {
  // A hand-cranked frame clock: each tick runs what was queued for it.
  const clock = () => {
    let queue: (() => void)[] = []
    return {
      later: (fn: () => void) => void queue.push(fn),
      tick: () => {
        const q = queue
        queue = []
        for (const fn of q) fn()
      },
    }
  }

  test("frames stop after a kept-stale sync: one settle repaint", () => {
    const c = clock()
    let repaints = 0
    const off = onTextLayout(() => repaints++)
    requestOutlineSettle(c.later)
    requestOutlineSettle(c.later) // coalesced
    c.tick()
    c.tick()
    expect(repaints).toBe(1)
    c.tick()
    expect(repaints).toBe(1)
    off()
  })

  test("frames keep coming: no repaint", () => {
    const c = clock()
    let repaints = 0
    const off = onTextLayout(() => repaints++)
    requestOutlineSettle(c.later)
    c.tick()
    noteTextSync() // a frame was drawn in between
    c.tick()
    expect(repaints).toBe(0)
    off()
  })
})

test("requestOutlineSettle: a frame kept stale while a settle is in flight still settles", () => {
  let queue: (() => void)[] = []
  const later = (fn: () => void) => void queue.push(fn)
  const tick = () => {
    const q = queue
    queue = []
    for (const fn of q) fn()
  }
  let repaints = 0
  const off = onTextLayout(() => repaints++)
  requestOutlineSettle(later)
  tick()
  noteTextSync() // the next frame drew…
  requestOutlineSettle(later) // …and kept stale again (coalesced into the one in flight)
  tick() // in-flight check: frames came — but watch on
  expect(repaints).toBe(0)
  tick()
  tick() // frames stopped
  expect(repaints).toBe(1)
  off()
})

describe("grantMovingRetrace", () => {
  // Ids far from any live binding's.
  const ids = Array.from({ length: RETRACE_BUDGET + 3 }, (_, i) => 1_000_000 + i)

  test("a moving frame retraces at most RETRACE_BUDGET texts, the longest-waiting first", () => {
    // Frame 1: everyone drifted at once — the first RETRACE_BUDGET get it.
    const f1 = ids.map((id) => grantMovingRetrace(id, 101))
    expect(f1.filter(Boolean).length).toBe(RETRACE_BUDGET)
    expect(f1.slice(0, RETRACE_BUDGET).every(Boolean)).toBe(true)
    // Frame 2: a new drifter comes FIRST in host order, but the waiters
    // from frame 1 hold the reserved slots.
    const late = 2_000_000
    const newcomer = grantMovingRetrace(late, 102)
    const waiters = ids.slice(RETRACE_BUDGET).map((id) => grantMovingRetrace(id, 102))
    expect(waiters.every(Boolean)).toBe(true)
    expect(newcomer).toBe(RETRACE_BUDGET - waiters.length > 0)
    for (const id of [...ids, late]) forgetMovingRetrace(id)
  })

  test("a forgotten text (retraced by a held frame, or disposed) waits no longer", () => {
    for (const id of ids) grantMovingRetrace(id, 201)
    for (const id of ids) forgetMovingRetrace(id)
    // Nobody reserved: a fresh drifter gets a slot at once.
    expect(grantMovingRetrace(3_000_000, 202)).toBe(true)
    forgetMovingRetrace(3_000_000)
  })
})

describe("legibility LOD", () => {
  const { legibility, TEXT_LEGIBLE_CAP_PX: CAP, TEXT_LEGIBLE_BAND_PX: BAND, TEXT_CAP_EM: EM } = TextRender
  // pixels-per-unit that puts a size-50 text's capitals at `px` on screen.
  const ppuFor = (px: number) => px / (50 * EM)
  test("exactly 1 at and above the band: legible text renders as before", () => {
    expect(legibility(50, ppuFor(CAP + BAND))).toBe(1)
    expect(legibility(50, 1.28)).toBe(1) // the 2021 rig: 44 px caps
  })
  test("0 at and below the threshold: not drawn, not traced", () => {
    expect(legibility(50, ppuFor(CAP))).toBe(0)
    expect(legibility(50, ppuFor(1))).toBe(0)
  })
  test("eases monotonically across the band", () => {
    let prev = 0
    for (let px = CAP; px <= CAP + BAND; px += BAND / 16) {
      const v = legibility(50, ppuFor(px))
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
    expect(legibility(50, ppuFor(CAP + BAND / 2))).toBeCloseTo(0.5, 6)
  })
  test("a holon opts out with lod = false", () => {
    expect(new Text({ content: "x" }).lod).toBe(true)
    expect(new Text({ content: "x", lod: false }).lod).toBe(false)
  })
})
