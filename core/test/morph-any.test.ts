/**
 * Morph(a, b) — the universal spelling, its routes, and Forms as a state.
 */

import { describe, expect, test } from "bun:test"
import { Observer } from "../src/dream"
import { BLUE } from "../src/constants"
import { Circle, Line, Square } from "../src/parts/primitives"
import { Morph, MorphShape } from "../vocabulary/Morph/Morph"
import { routeFor } from "../vocabulary/Morph/universal"
import { Forms } from "../vocabulary/Morph/Forms"
import { MorphCurves } from "../vocabulary/Morph/MorphCurves"
import { Truck } from "../vocabulary/Truck/Truck"
import { Pallet } from "../vocabulary/Pallet/Pallet"
import { Word } from "../vocabulary/Word/Word"

const seg = (x: number) => new Line({ points: [{ x, y: 0, z: 0 }, { x: x + 40, y: 30, z: 0 }] })

describe("routes", () => {
  test("chosen by what the two are", () => {
    const obs = new Observer({ phi: 0.6, theta: 0.3 })
    expect(routeFor(new Circle(), "circle")).toBe("word")
    expect(routeFor(new Circle(), new Word("x"))).toBe("word")
    expect(routeFor(new Circle(), new Square())).toBe("point")
    const lines = new Line({ points: [] })
    void lines
    expect(routeFor(new Truck({ observer: obs }), new Pallet({ observer: obs }))).toBe("travel")
    expect(routeFor(new Circle({ radius: 10 }), new Truck({ observer: obs }))).toBe("travel")
  })

  test("many lines into one circle gathers", () => {
    // A holon showing several lines (a composite of Lines).
    const many = new Truck({ observer: new Observer() })
    expect(routeFor(many, new Circle({ radius: 200 }))).toBe("gather")
  })

  test("the classic spelling still means pydeation's morph", () => {
    const a = new Circle()
    const b = new Square({ opacity: 0 })
    const shape = new MorphShape(a, b)
    const anim = Morph(shape, a, b)
    expect(anim.tracks.some((t) => t.param === shape.morph)).toBe(true)
  })
})

describe("Morph(a, b)", () => {
  test("is an Anim to play, carries back(), its route and what it built", () => {
    const dot = new Circle({ radius: 30, fillOpacity: 1, tint: BLUE })
    const sq = new Square({ size: 100, opacity: 0 })
    const m = Morph(dot, sq)
    expect(m.route).toBe("point")
    expect(m.tracks.length).toBeGreaterThan(0)
    expect(m.holons.filter((h) => h instanceof MorphCurves).length).toBe(2)
    // There shows the square at the end; back shows the dot.
    expect(m.tracks.some((t) => t.param === sq.opacity && t.values[0] === 1)).toBe(true)
    expect(m.back().tracks.some((t) => t.param === dot.opacity && t.values[0] === 1)).toBe(true)
  })

  test("into a word goes through the line, and can land on a declared Word", () => {
    const obs = new Observer({ phi: 0.6, theta: 0.3 })
    const truck = new Truck({ observer: obs })
    const word = new Word("truck", { observer: obs, opacity: 0, size: 150 })
    const m = Morph(truck, word)
    expect(m.route).toBe("word")
    expect(m.holons).toContain(word)
    expect(m.holons.some((h) => h instanceof Line)).toBe(true)
  })
})

describe("Forms", () => {
  const build = () => {
    const obs = new Observer({ phi: 0.6, theta: 0.3 })
    const dot = new Circle({ radius: 40, fillOpacity: 1, tint: BLUE })
    const truck = new Truck({ observer: obs, opacity: 0 })
    const word = new Word("truck", { observer: obs, opacity: 0 })
    const forms = new Forms({ dot, truck, word }, { observer: obs })
    return { dot, truck, word, forms }
  }

  test("one axis, its positions the forms, each a true picture", () => {
    const { dot, truck, word, forms } = build()
    const [ax] = forms.stateSpace().axes
    expect(ax!.id).toBe("form")
    expect(ax!.positions.map((p) => p.name)).toEqual(["dot", "truck", "word"])
    const truckPos = ax!.positions[1]!.values
    expect(truckPos.get(truck.opacity as never)).toBe(1)
    expect(truckPos.get(dot.opacity as never)).toBe(0)
    expect(truckPos.get(word.opacity as never)).toBe(0)
    expect(ax!.handles()).toEqual([dot, truck, word])
  })

  test("via is the real morph between the two forms, both ways, built up front", () => {
    const { truck, word, forms } = build()
    const [ax] = forms.stateSpace().axes
    const there = ax!.via!("truck", "word")
    expect(there.tracks.some((t) => t.param === word.opacity && t.values[0] === 1)).toBe(true)
    const back = ax!.via!("word", "truck")
    expect(back.tracks.some((t) => t.param === truck.opacity && t.values[0] === 1)).toBe(true)
    // 3 forms → 3 pairs, every morpher a part of Forms (so it is drawn).
    expect(forms.parts.filter((p) => p instanceof MorphCurves).length).toBeGreaterThanOrEqual(6)
  })
})

describe("the neutral route", () => {
  test("unlike solids go through a camera-facing circle, held a beat", async () => {
    const { dissimilarity } = await import("../vocabulary/Morph/universal")
    const obs = new Observer({ phi: 0.7, theta: 0.32, radius: 700 })
    const truck = new Truck({ observer: obs, scale: 0.42 })
    const pallet = new Pallet({ observer: obs, opacity: 0 })
    expect(dissimilarity(truck, pallet)).toBeGreaterThan(0.03)
    const m = Morph(truck, pallet)
    expect(m.route).toBe("neutral")
    const circle = m.holons.find((h): h is Line => h instanceof Line)!
    const pts = circle.points
    expect(pts[0]).toEqual(pts.at(-1)!)
    // shown at the end of the first half, hidden only after the held beat
    const show = m.tracks.find((t) => t.param === circle.opacity && t.values[0] === 1)!
    const hide = m.tracks.filter((t) => t.param === circle.opacity && t.values[0] === 0).map((t) => t.relStart)
    expect(show.relStop).toBeCloseTo(0.45, 6)
    expect(Math.max(...hide)).toBeGreaterThanOrEqual(0.55 - 1e-9)
  })

  test("alike shapes and a dot fly straight (no neutral)", async () => {
    const { dissimilarity } = await import("../vocabulary/Morph/universal")
    const obs = new Observer({ phi: 0.7, theta: 0.32 })
    const a = new Truck({ observer: obs, scale: 0.42 })
    const b = new Truck({ observer: obs, scale: 0.5, opacity: 0 })
    expect(dissimilarity(a, b)).toBeLessThan(0.01)
    expect(Morph(a, b).route).toBe("travel")
    expect(Morph(new Circle({ radius: 40 }), new Truck({ observer: obs, opacity: 0 })).route).toBe("travel")
  })
})
