/**
 * DrawSteady — the constant-arc-length pen.
 *
 * What is worth asserting here is not that the verb emits tracks but
 * that its ONE claim holds: the pen's speed is the same everywhere. So
 * the tests measure speed, in world units of arc per unit of normalized
 * time, and demand it be constant — across a stroke, across a stroke
 * BOUNDARY (the seam O-1 could not make invisible), and independent of
 * how the strokes are ordered.
 */

import { describe, expect, test } from "bun:test"
import {
  DrawSteady,
  UnDrawSteady,
  orderStrokes,
  planSteady,
  polylineLength,
  steadyDuration,
  strokesOf,
} from "../src/steady"
import { Group, Line } from "../src/parts/index"
import { Axes } from "../vocabulary/Axes/Axes"
import { Sketch } from "../vocabulary/Sketch/Sketch"
import { david } from "../vocabulary/Sketch/assets/david"
import { Timeline } from "../src/timeline"
import type { Holon } from "../src/holon"

/** A straight horizontal Line of a given length — arc length is exact. */
const bar = (length: number, y = 0): Line =>
  new Line({ points: [{ x: 0, y, z: 0 }, { x: length, y, z: 0 }] })

/** A group of bars with the given lengths, in that document order. */
const bars = (...lengths: number[]): { group: Group; lines: Line[] } => {
  const lines = lengths.map((l, i) => bar(l, i * 10))
  return { group: new Group({ members: lines }), lines }
}

/**
 * Total arc length INKED at normalized time u — the pen's odometer.
 * Sampling this is how "constant speed" becomes a measurable claim.
 */
const inked = (holon: Holon, anim: ReturnType<typeof DrawSteady>, u: number): number => {
  const timeline = new Timeline([{ anim, start: 0, duration: 1 }], 1)
  timeline.apply(u)
  let total = 0
  for (const { stroke, length } of strokesOf(holon).map((s) => s)) {
    total += stroke.creation.value * length
  }
  return total
}

describe("polylineLength", () => {
  test("measures a polyline's arc, not its span", () => {
    // A zigzag: two unit-ish legs, so arc exceeds the endpoint distance.
    const points = [
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 4, z: 0 },
      { x: 6, y: 0, z: 0 },
    ]
    expect(polylineLength(points)).toBeCloseTo(10, 9)
  })

  test("a degenerate polyline has no length", () => {
    expect(polylineLength([{ x: 1, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }])).toBe(0)
  })
})

describe("orderStrokes", () => {
  const items = [{ length: 5 }, { length: 20 }, { length: 1 }, { length: 20 }]

  test("long_short puts the longest first", () => {
    expect(orderStrokes(items, "long_short").map((i) => i.length)).toEqual([20, 20, 5, 1])
  })

  test("short_long puts the shortest first", () => {
    expect(orderStrokes(items, "short_long").map((i) => i.length)).toEqual([1, 5, 20, 20])
  })

  test("document is the fallback — the order they were composed in", () => {
    expect(orderStrokes(items, "document").map((i) => i.length)).toEqual([5, 20, 1, 20])
  })

  test("ties keep document order, so the sort is deterministic", () => {
    const tagged = [
      { length: 7, tag: "a" },
      { length: 7, tag: "b" },
      { length: 7, tag: "c" },
    ]
    expect(orderStrokes(tagged, "long_short").map((i) => i.tag)).toEqual(["a", "b", "c"])
    expect(orderStrokes(tagged, "short_long").map((i) => i.tag)).toEqual(["a", "b", "c"])
  })
})

describe("planSteady — windows are proportional to arc length", () => {
  test("a stroke twice as long gets twice the span", () => {
    const { group } = bars(100, 200, 100)
    const { windows, totalLength } = planSteady(group, "document")
    expect(totalLength).toBeCloseTo(400, 9)
    const spans = windows.map((w) => w.to - w.from)
    expect(spans[0]).toBeCloseTo(0.25, 9)
    expect(spans[1]).toBeCloseTo(0.5, 9)
    expect(spans[2]).toBeCloseTo(0.25, 9)
  })

  test("windows abut exactly and cover the whole span", () => {
    const { group } = bars(37, 11, 250, 3, 90)
    const { windows } = planSteady(group, "long_short")
    expect(windows[0]!.from).toBe(0)
    expect(windows[windows.length - 1]!.to).toBe(1)
    for (let i = 1; i < windows.length; i++) {
      // no gap and no overlap — the pen never waits and never doubles back
      expect(windows[i]!.from).toBeCloseTo(windows[i - 1]!.to, 12)
    }
  })

  test("ordering changes the sequence, never the durations", () => {
    const { group } = bars(50, 300, 120)
    const long = planSteady(group, "long_short")
    const short = planSteady(group, "short_long")
    const spanOf = (p: typeof long, length: number) =>
      p.windows.find((w) => Math.abs(w.length - length) < 1e-9)!
    for (const length of [50, 300, 120]) {
      const a = spanOf(long, length)
      const b = spanOf(short, length)
      expect(a.to - a.from).toBeCloseTo(b.to - b.from, 12)
    }
    expect(long.windows.map((w) => w.length)).toEqual([300, 120, 50])
    expect(short.windows.map((w) => w.length)).toEqual([50, 120, 300])
  })

  test("a holon with no measurable geometry plans nothing rather than dividing by zero", () => {
    const degenerate = new Group({
      members: [new Line({ points: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }] })],
    })
    const plan = planSteady(degenerate)
    expect(plan.windows).toHaveLength(0)
    expect(plan.totalLength).toBe(0)
    expect(DrawSteady(degenerate).tracks).toHaveLength(0)
  })
})

describe("DrawSteady — the pen's speed is constant", () => {
  test("inked arc grows linearly through the whole traversal", () => {
    const { group } = bars(100, 400, 250, 50)
    const anim = DrawSteady(group, { order: "long_short" })
    const total = planSteady(group).totalLength
    for (let i = 0; i <= 20; i++) {
      const u = i / 20
      expect(inked(group, anim, u)).toBeCloseTo(u * total, 6)
    }
  })

  test("speed is continuous ACROSS a stroke boundary — the seam is invisible", () => {
    // Two strokes; the boundary sits at 800/1000 = 0.8 of the span.
    const { group } = bars(800, 200)
    const anim = DrawSteady(group, { order: "long_short" })
    const seam = 0.8
    const h = 1e-4
    const before = (inked(group, anim, seam - h) - inked(group, anim, seam - 3 * h)) / (2 * h)
    const after = (inked(group, anim, seam + 3 * h) - inked(group, anim, seam + h)) / (2 * h)
    expect(before).toBeGreaterThan(0)
    // The pen crosses from one stroke to the next without changing pace.
    expect(after / before).toBeCloseTo(1, 3)
  })

  test("each stroke is fully drawn by the end, and untouched before its turn", () => {
    const { group, lines } = bars(300, 100)
    const anim = DrawSteady(group, { order: "long_short" })
    const timeline = new Timeline([{ anim, start: 0, duration: 1 }], 1)

    timeline.apply(0)
    expect(lines[0]!.creation.value).toBeCloseTo(0, 9)
    expect(lines[1]!.creation.value).toBeCloseTo(0, 9)

    // 300/400 = 0.75 is the seam: the long bar is done, the short unstarted.
    timeline.apply(0.75)
    expect(lines[0]!.creation.value).toBeCloseTo(1, 6)
    expect(lines[1]!.creation.value).toBeCloseTo(0, 6)

    timeline.apply(1)
    expect(lines[0]!.creation.value).toBeCloseTo(1, 9)
    expect(lines[1]!.creation.value).toBeCloseTo(1, 9)
  })

  test("long_short really does draw the longest stroke first", () => {
    const { group, lines } = bars(50, 500, 120)
    const timeline = new Timeline(
      [{ anim: DrawSteady(group, { order: "long_short" }), start: 0, duration: 1 }],
      1,
    )
    // A tenth of the way in, only the 500-unit bar has any ink.
    timeline.apply(0.1)
    expect(lines[1]!.creation.value).toBeGreaterThan(0)
    expect(lines[0]!.creation.value).toBeCloseTo(0, 9)
    expect(lines[2]!.creation.value).toBeCloseTo(0, 9)
  })

  test("linear is the default — a steady pen does not accelerate", () => {
    const { group } = bars(100)
    for (const track of DrawSteady(group).tracks) expect(track.easing).toBe("linear")
    for (const track of DrawSteady(group, { easing: "smooth" }).tracks) {
      expect(track.easing).toBe("smooth")
    }
  })

  test("a smooth DrawSteady eases ONCE over the whole traversal, not per stroke", () => {
    // restage() states each track's tangents against the FULL span, so a
    // stroke occupying a tenth of it does not ease within its own tenth.
    const { group } = bars(900, 100)
    for (const track of DrawSteady(group, { easing: "smooth" }).tracks) {
      expect(track.smoothingWindow).toBeCloseTo(1, 9)
    }
  })
})

describe("UnDrawSteady", () => {
  test("retracts at the same constant speed, last stroke leaving first", () => {
    const { group, lines } = bars(300, 100)
    // Start fully drawn, as an UnDraw always follows a Draw.
    for (const line of lines) line.creation.value = 1
    const anim = UnDrawSteady(group, { order: "long_short" })
    const timeline = new Timeline([{ anim, start: 0, duration: 1 }], 1)
    const total = planSteady(group).totalLength

    for (let i = 0; i <= 10; i++) {
      const u = i / 10
      timeline.apply(u)
      const remaining = lines.reduce(
        (a, line, j) => a + line.creation.value * [300, 100][j]!,
        0,
      )
      expect(remaining).toBeCloseTo((1 - u) * total, 5)
    }
  })
})

describe("DrawSteady is about pens, not SVGs", () => {
  test("it steers an Axes — any Stroke composite works", () => {
    const axes = new Axes({ drawTicks: true })
    const plan = planSteady(axes, "long_short")
    expect(plan.windows.length).toBeGreaterThan(2)
    expect(plan.totalLength).toBeGreaterThan(0)
    // Longest first, and the spans track the lengths.
    for (let i = 1; i < plan.windows.length; i++) {
      expect(plan.windows[i]!.length).toBeLessThanOrEqual(plan.windows[i - 1]!.length + 1e-9)
    }
    const anim = DrawSteady(axes)
    for (let i = 0; i <= 10; i++) {
      const u = i / 10
      expect(inked(axes, anim, u)).toBeCloseTo(u * plan.totalLength, 5)
    }
  })

  test("it steers a Sketch's 37 imported subpaths", () => {
    const sketch = new Sketch({ data: david, height: 434.03 })
    const plan = planSteady(sketch, "long_short")
    expect(plan.windows).toHaveLength(37)
    // The longest stroke carries ~31% of the drawing — the structural
    // outline that makes the portrait read as a face immediately.
    const first = plan.windows[0]!
    expect(first.to - first.from).toBeCloseTo(0.309, 2)
  })
})

describe("steadyDuration — draw_speed in px/s at a stated frame width", () => {
  test("a bar of known arc takes arc/speed seconds at 1 px per unit", () => {
    const { group } = bars(5000)
    expect(steadyDuration(group, { speed: 1000, pxPerUnit: 1 })).toBeCloseTo(5, 9)
  })

  test("speed is in SCREEN pixels — the projection scales the duration", () => {
    const { group } = bars(1000)
    const world = steadyDuration(group, { speed: 1000, pxPerUnit: 1 })
    const projected = steadyDuration(group, { speed: 1000, pxPerUnit: 2 })
    expect(projected).toBeCloseTo(2 * world, 9)
  })

  test("Scene00's numbers reproduce the reference's 2.11s draw", () => {
    // The source: David(scale=2/3) drawn at draw_speed=10000, framed by a
    // TwoDScene at zoom 1 (1023 world units across a 1280-wide render).
    // refs/pitch/origins/frames5 measures a LINEAR 2.095s draw; see
    // core/src/steady.ts for the full derivation.
    const sketch = new Sketch({ data: david, height: (651.044 * 2) / 3 })
    const duration = steadyDuration(sketch, { speed: 10000, pxPerUnit: 1280 / 1023 })
    expect(duration).toBeCloseTo(2.111, 2)
  })
})
