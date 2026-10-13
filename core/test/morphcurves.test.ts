/**
 * MorphCurves + MorphMany (vocabulary/Morph/MorphCurves.ts) — the holon
 * and the verb over the correspondence.
 */

import { describe, expect, test } from "bun:test"
import { Circle, Line, Square } from "../src/parts/primitives"
import { Observer } from "../src/dream"
import { BLUE, WHITE } from "../src/constants"
import { MorphCurves, MorphMany, curvesOf } from "../vocabulary/Morph/MorphCurves"
import { Truck } from "../vocabulary/Truck/Truck"
import { totalLength } from "../src/geometry/correspond"

const slotsOf = (m: MorphCurves) => m.parts.filter((p): p is Line => p instanceof Line)
const ink = (m: MorphCurves) => slotsOf(m).map((l) => l.points).filter((c) => c.length >= 2)

describe("MorphCurves", () => {
  test("at 0 it draws the sources, at 1 the targets", () => {
    const a = new Line({ points: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }] })
    const b = new Line({ points: [{ x: 0, y: 50, z: 0 }, { x: 0, y: 150, z: 0 }], x: 200 })
    const c = new Circle({ radius: 60 })
    const m = new MorphCurves([a, b], [c])
    expect(totalLength(ink(m))).toBeCloseTo(200, 6)
    m.morph.value = 1
    expect(totalLength(ink(m))).toBeCloseTo(totalLength(curvesOf(c)), 6)
  })

  test("pieces blend their own source tint into their own target tint", () => {
    const a = new Line({ points: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }], tint: WHITE })
    const c = new Circle({ radius: 60, tint: BLUE })
    const m = new MorphCurves([a], [c])
    m.morph.value = 0.5
    const t = slotsOf(m)[0]!.tint.value
    expect(t.r).toBeCloseTo((WHITE.r + BLUE.r) / 2, 6)
    expect(t.g).toBeCloseTo((WHITE.g + BLUE.g) / 2, 6)
  })

  test("a solid's curves are what the camera sees, in world space", () => {
    const obs = new Observer({ phi: 0.6, theta: 0.3 })
    const truck = new Truck({ observer: obs })
    const dot = new Circle({ radius: 40 })
    const m = new MorphCurves([dot], [truck], { observer: obs })
    m.morph.value = 1
    expect(totalLength(ink(m))).toBeCloseTo(totalLength(truck.worldCurves()), 4)
  })

  test("refuses an empty side, and says why", () => {
    expect(() => new MorphCurves([], [new Square()])).toThrow(/at least one source/)
  })
})

describe("MorphMany", () => {
  test("fades fill out, travels, fades fill in — in that order", () => {
    const dot = new Circle({ radius: 40, fillOpacity: 1 })
    const sq = new Square({ size: 100, fillOpacity: 1, opacity: 0 })
    const m = new MorphCurves([dot], [sq], { opacity: 0 })
    const anim = MorphMany(m)
    const window = (param: unknown) =>
      anim.tracks.filter((t) => t.param === param).map((t) => [t.relStart, t.relStop])
    // Source fill out over the first fifth, the travel in between, the
    // target's fill over the last fifth.
    expect(window(dot.fillOpacity)).toEqual([[0, 0.2]])
    expect(window(m.morph)).toEqual([[0.2, 0.8]])
    const fillIn = window(sq.fillOpacity)[0]!
    expect(fillIn[0]).toBeCloseTo(0.79, 9)
    expect(fillIn[1]).toBe(1)
  })

  test("with nothing filled, the whole clip is travel", () => {
    const a = new Line({ points: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }] })
    const c = new Circle({ radius: 60, opacity: 0 })
    const m = new MorphCurves([a], [c])
    const anim = MorphMany(m)
    expect(anim.tracks.filter((t) => t.param === m.morph).map((t) => [t.relStart, t.relStop])).toEqual([[0, 1]])
  })
})
