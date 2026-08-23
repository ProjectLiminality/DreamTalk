/**
 * The video-01 vocabulary batch — pure logic tests: domino timing,
 * rounded-rectangle geometry, Create dispatch (Eye/Axes choreography),
 * and the Erase vs UnDraw asymmetry at the timeline level.
 */

import { describe, expect, test } from "bun:test"
import {
  Axes,
  Eye,
  Line,
  Rectangle,
  Square,
  dominoWindows,
  rectanglePolyline,
} from "../src/parts/index"
import { Create, Erase, UnCreate, UnDraw } from "../src/verbs"
import { Dream } from "../src/dream"
import { PI } from "../src/constants"
import type { Track } from "../src/anim"
import type { Param, ParamValue } from "../src/params"

const tracksFor = (tracks: Track[], param: Param<ParamValue>): Track[] =>
  tracks.filter((t) => t.param === param)

describe("dominoWindows", () => {
  test("cascade starts at 0, ends near 1, stays inside [0, 1]", () => {
    const windows = dominoWindows(8)
    expect(windows).toHaveLength(8)
    expect(windows[0]![0]).toBe(0)
    expect(windows[7]![1]).toBeGreaterThan(0.95)
    for (const [a, b] of windows) {
      expect(a).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThanOrEqual(1)
      expect(b).toBeGreaterThan(a)
    }
  })

  test("windows stagger monotonically (the domino ordering)", () => {
    const windows = dominoWindows(12)
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i]![0]).toBeGreaterThan(windows[i - 1]![0])
    }
  })

  test("degenerate counts", () => {
    expect(dominoWindows(0)).toHaveLength(0)
    const single = dominoWindows(1)
    expect(single).toHaveLength(1)
    expect(single[0]![0]).toBeGreaterThanOrEqual(0)
    expect(single[0]![1]).toBeLessThanOrEqual(1)
  })
})

describe("rectanglePolyline", () => {
  test("rounding 0: a closed 5-segment outline from the bottom center", () => {
    const pts = rectanglePolyline(100, 200, 0)
    expect(pts).toHaveLength(6)
    expect(pts[0]).toEqual({ x: 0, y: -100, z: 0 })
    expect(pts[pts.length - 1]).toEqual(pts[0])
  })

  test("rounding 1 on a square is literally a circle (the cornered circle)", () => {
    const pts = rectanglePolyline(100, 100, 1)
    for (const p of pts) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(50, 6)
    }
    expect(pts[pts.length - 1]).toEqual(pts[0])
  })

  test("rounding 1/2 on 100×200: corner radius 25, bounds respected", () => {
    const pts = rectanglePolyline(100, 200, 0.5)
    for (const p of pts) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(50 + 1e-9)
      expect(Math.abs(p.y)).toBeLessThanOrEqual(100 + 1e-9)
    }
    // The corner arc's outermost diagonal point sits at the 25-radius fillet.
    const corner = pts.find((p) => p.x > 49.9 && p.y > 74.9 && p.y < 75.1)
    expect(corner).toBeDefined()
  })
})

describe("Create dispatch", () => {
  test("default: deep-parallel draw-on, unchanged for plain parts", () => {
    const square = new Square({})
    const anim = Create(square)
    expect(anim.tracks).toHaveLength(1)
    const track = anim.tracks[0]!
    expect(track.param).toBe(square.creation)
    expect(track.relStart).toBe(0)
    expect(track.relStop).toBe(1)
    expect(track.values).toEqual([0, 1])
  })

  test("Eye: pupil instant, lids+eyeball 0→50%, iris 30→100%", () => {
    const eye = new Eye({})
    const anim = Create(eye)
    const pupil = tracksFor(anim.tracks, eye.pupil.creation)
    expect(pupil).toHaveLength(1)
    expect(pupil[0]!.relStart).toBe(0)
    expect(pupil[0]!.relStop).toBeCloseTo(0.01, 9)
    const iris = tracksFor(anim.tracks, eye.iris.creation)
    expect(iris[0]!.relStart).toBeCloseTo(0.3, 9)
    expect(iris[0]!.relStop).toBe(1)
    for (const part of [eye.lidTop, eye.lidBottom, eye.eyeball]) {
      const track = tracksFor(anim.tracks, part.creation)[0]!
      expect(track.relStart).toBe(0)
      expect(track.relStop).toBeCloseTo(0.5, 9)
    }
  })

  test("Eye geometry follows opening (lids rotate, eyeball arc narrows)", () => {
    const eye = new Eye({})
    expect(eye.lidTop.b.value).toBeCloseTo(PI / 8, 9)
    expect(eye.eyeball.startAngle.value).toBeCloseTo(-PI / 8, 9)
    eye.opening.value = 0.5
    expect(eye.lidTop.b.value).toBeCloseTo(PI / 16, 9)
    expect(eye.lidBottom.b.value).toBeCloseTo(-PI / 16, 9)
    expect(eye.eyeball.endAngle.value).toBeCloseTo(PI / 16, 9)
  })

  test("Axes: axes 0→80%, grid groups domino across the full span", () => {
    const axes = new Axes({
      mode: "xy",
      xStart: -450,
      xEnd: 450,
      yStart: -260,
      yEnd: 260,
      gridSpacing: 100,
      drawGrid: true,
    })
    void axes.parts
    expect(axes.axisLines).toHaveLength(2)
    // x: ±100..±400 → 8 lines; y: ±100, ±200 → 4 lines.
    expect(axes.gridGroups[0]).toHaveLength(8)
    expect(axes.gridGroups[1]).toHaveLength(4)

    const anim = Create(axes)
    for (const axis of axes.axisLines) {
      const track = tracksFor(anim.tracks, axis.creation)[0]!
      expect(track.relStart).toBe(0)
      expect(track.relStop).toBeCloseTo(0.8, 9)
    }
    for (const group of axes.gridGroups) {
      const starts = group.map((line) => tracksFor(anim.tracks, line.creation)[0]!.relStart)
      expect(starts[0]).toBe(0)
      for (let i = 1; i < starts.length; i++) {
        expect(starts[i]!).toBeGreaterThan(starts[i - 1]!)
      }
      const last = tracksFor(anim.tracks, group[group.length - 1]!.creation)[0]!
      expect(last.relStop).toBeLessThanOrEqual(1)
    }
  })
})

describe("Erase vs UnDraw", () => {
  test("Erase advances erasure and leaves creation alone; UnDraw retracts creation", () => {
    const line = new Line({ points: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }] })
    const erase = Erase(line)
    expect(tracksFor(erase.tracks, line.erasure)).toHaveLength(1)
    expect(tracksFor(erase.tracks, line.creation)).toHaveLength(0)
    const undraw = UnDraw(line)
    expect(tracksFor(undraw.tracks, line.creation)).toHaveLength(1)
    expect(tracksFor(undraw.tracks, line.erasure)).toHaveLength(0)
  })

  test("timeline: the drawn front holds at 1 while the erase front consumes", () => {
    class EraseDream extends Dream {
      line = new Line({ points: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }] })
      unfold() {
        this.play(Create(this.line), 1)
        this.play(Erase(this.line), 1)
      }
    }
    const dream = new EraseDream()
    dream.applyAt(0.5)
    expect(dream.line.creation.value).toBeGreaterThan(0)
    expect(dream.line.creation.value).toBeLessThan(1)
    expect(dream.line.erasure.value).toBe(0)
    dream.applyAt(1.5)
    expect(dream.line.creation.value).toBe(1)
    expect(dream.line.erasure.value).toBeGreaterThan(0)
    expect(dream.line.erasure.value).toBeLessThan(1)
    dream.applyAt(2)
    expect(dream.line.erasure.value).toBe(1)
  })
})

describe("UnCreate dispatch", () => {
  test("default: the draw front retracts, nothing is erased", () => {
    const square = new Square({})
    const tracks = UnCreate(square).tracks
    expect(tracksFor(tracks, square.creation)).toHaveLength(1)
    expect(tracksFor(tracks, square.erasure)).toHaveLength(0)
  })

  test("UnCreateAxes erases instead, ticks inside the first 70%", () => {
    const axes = new Axes({ mode: "x", xStart: -250, xEnd: 250, gridSpacing: 30, drawTicks: true })
    const tracks = UnCreate(axes).tracks
    // Every stroke is consumed by its erase front, never by un-drawing.
    expect(tracks.every((t) => t.param.name === "erasure")).toBe(true)
    const axis = tracksFor(tracks, axes.axisLines[0]!.erasure)[0]!
    expect(axis.relStart).toBe(0)
    expect(axis.relStop).toBe(1)
    // 15 ticks at -210..210, all done by 0.7 of the span.
    const ticks = axes.tickGroups[0]!
    expect(ticks).toHaveLength(15)
    for (const tick of ticks) {
      const track = tracksFor(tracks, tick.erasure)[0]!
      expect(track.relStop).toBeLessThanOrEqual(0.7 + 1e-9)
    }
  })
})

describe("C4D auto-tangent easing", () => {
  /** A single param driven 0 → 1 over exactly 1s, sampled off the timeline. */
  class EaseDream extends Dream {
    line = new Line({ points: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }] })
    unfold() {
      this.play(Create(this.line), 1)
    }
  }
  const at = (t: number): number => {
    const dream = new EaseDream()
    dream.applyAt(t)
    return dream.line.creation.value
  }

  test("endpoints are exact and the curve is monotone", () => {
    expect(at(0)).toBe(0)
    expect(at(1)).toBe(1)
    let prev = -1
    for (let i = 0; i <= 20; i++) {
      const v = at(i / 20)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  test("symmetric about the midpoint, which sits at 1/2", () => {
    expect(at(0.5)).toBeCloseTo(0.5, 9)
    for (const u of [0.1, 0.25, 0.4]) {
      expect(at(u) + at(1 - u)).toBeCloseTo(1, 9)
    }
  })

  test("it is the smoothing-0.25 curve, not smoothstep", () => {
    // Smoothstep is the s = 1/3 member of the same family; at the ends
    // the two separate by ~30%, which is what the video-01 reference
    // measures (see timeline.ts). Pin the difference so a silent revert
    // to smoothstep fails here.
    const smoothstep = (u: number) => u * u * (3 - 2 * u)
    expect(at(0.1)).toBeGreaterThan(smoothstep(0.1) * 1.2)
    expect(1 - at(0.9)).toBeGreaterThan((1 - smoothstep(0.9)) * 1.2)
    // The values the reference fit implies, to 3dp.
    expect(at(0.1)).toBeCloseTo(0.0396, 3)
    expect(at(0.9)).toBeCloseTo(0.9604, 3)
  })
})
