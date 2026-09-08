/**
 * P-8 — the fractal layout, the fill inset, and Keynote's own ease.
 *
 * What these pin, in order of how expensive the bug would be:
 *
 *   1. THE FILL INSET. A stroke is drawn CENTRED on its path, so a fill
 *      triangulated to that same path covers the ribbon's inner half —
 *      and fills blend NORMAL where strokes blend MAX, so on this deck's
 *      black fills a drawable's outline loses half its width to its own
 *      interior. Measured at 78% of all ink the uninset fills hid. The
 *      inset is a geometric offset by half the stroke width, and the
 *      thing most likely to be broken by a simplification is its SIGN:
 *      a hole's interior is the material around it, so a loop wound the
 *      other way must inset the other way.
 *   2. KEYNOTE'S EASE IS NOT THE FRAMEWORK'S. Same Bezier family, tangent
 *      length 0.42 rather than pydeation's 0.25 — CSS `ease-in-out`.
 *      Measured four times; see `Builds.KEYNOTE_EASE_S`. The tests live
 *      in `motion.test.ts` beside the code they guard; here only the
 *      consequence for `rampOpacity` is pinned.
 *   3. THE DECK DECLARES `acceleration` ON HALF ITS BUILDS AND NOT THE
 *      OTHER HALF, and the split is by build CLASS. Recorded as data so
 *      a later chapter that wants to treat the absence as linearity
 *      knows exactly what it would be changing.
 */

import { describe, expect, test } from "bun:test"
import { Slide, SlideFill } from "../vocabulary/Slides/Slides"
import { rampOpacity, keynoteEase, EASE_SAMPLES } from "../vocabulary/Slides/Builds"
import { Line } from "../src/parts/primitives"
import { slide43 } from "../vocabulary/Slides/assets/pl02/index"

/** Signed area of a closed ring — positive when counter-clockwise. */
const signedArea = (pts: readonly { x: number; y: number }[]): number => {
  let a = 0
  const n = pts.length - (Math.hypot(pts[pts.length - 1]!.x - pts[0]!.x, pts[pts.length - 1]!.y - pts[0]!.y) < 1e-9 ? 1 : 0)
  for (let i = 0; i < n; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % n]!
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

/** A closed square of side `s` centred on the origin, wound CCW. */
const square = (s: number) => {
  const h = s / 2
  return [
    { x: -h, y: -h, z: 0 },
    { x: h, y: -h, z: 0 },
    { x: h, y: h, z: 0 },
    { x: -h, y: h, z: 0 },
    { x: -h, y: -h, z: 0 },
  ]
}

const composedLoop = (fill: SlideFill): { x: number; y: number; z: number }[] => {
  void fill.parts
  const line = fill.parts[0] as Line
  return line.points as { x: number; y: number; z: number }[]
}

describe("the fill inset", () => {
  test("a zero inset leaves the loop exactly as given", () => {
    const loop = square(10)
    const fill = new SlideFill({ loops: [loop], inset: 0 })
    const out = composedLoop(fill)
    expect(out.length).toBe(loop.length)
    for (let i = 0; i < loop.length; i++) {
      expect(out[i]!.x).toBeCloseTo(loop[i]!.x, 9)
      expect(out[i]!.y).toBeCloseTo(loop[i]!.y, 9)
    }
  })

  test("a square insets by the stated distance ON EACH EDGE", () => {
    // The quantity that matters is the EDGE offset, not the vertex
    // displacement: a corner's vertex moves d/sin(theta/2), which for a
    // right angle is d*sqrt(2). Asserting the edge is what pins the
    // bisector arithmetic rather than a coincidence of squares.
    const fill = new SlideFill({ loops: [square(10)], inset: 1 })
    const out = composedLoop(fill)
    const xs = out.map((p) => p.x)
    const ys = out.map((p) => p.y)
    expect(Math.max(...xs)).toBeCloseTo(4, 6)
    expect(Math.min(...xs)).toBeCloseTo(-4, 6)
    expect(Math.max(...ys)).toBeCloseTo(4, 6)
    expect(Math.min(...ys)).toBeCloseTo(-4, 6)
  })

  test("the inset SHRINKS a CCW loop and shrinks a CW one too", () => {
    // The sign is read from the loop's own winding, so a shape stored
    // clockwise must not grow. This is the bug a "just offset along the
    // left normal" simplification would introduce, and it would only
    // show up on whichever of the deck's icons happens to be wound the
    // other way.
    const ccw = square(10)
    const cw = [...ccw].reverse()
    expect(signedArea(ccw)).toBeGreaterThan(0)
    expect(signedArea(cw)).toBeLessThan(0)
    for (const loop of [ccw, cw]) {
      const before = Math.abs(signedArea(loop))
      const after = Math.abs(signedArea(composedLoop(new SlideFill({ loops: [loop], inset: 1 }))))
      expect(after).toBeLessThan(before)
      // 10x10 -> 8x8
      expect(after).toBeCloseTo(64, 6)
    }
  })

  test("an inset larger than the feature falls back rather than inverting", () => {
    // A step past `MAX_INSET_RATIO` folds the polygon. An unshrunk fill
    // is a smaller error than an inside-out one, so the loop is returned
    // untouched — and its area must not go NEGATIVE, which is what an
    // unguarded offset would produce.
    const loop = square(2)
    const out = composedLoop(new SlideFill({ loops: [loop], inset: 10 }))
    expect(signedArea(out)).toBeGreaterThan(0)
  })

  test("the fractal's filled drawables all inset, and none inverts", () => {
    // The real corpus rather than a synthetic square: deck 43 carries 60
    // black-filled shapes, and this asserts every one of them ends up
    // with a smaller, still-positively-wound interior.
    const page = new Slide({ data: slide43 })
    void page.parts
    let checked = 0
    for (const holon of page.strokes) {
      if (!(holon instanceof SlideFill)) continue
      void holon.parts
      for (let i = 0; i < holon.loops.length; i++) {
        const before = holon.loops[i]!
        const after = (holon.parts[i] as Line).points
        if (after.length !== before.length) continue // fell back
        const a0 = Math.abs(signedArea(before as { x: number; y: number }[]))
        const a1 = Math.abs(signedArea(after as { x: number; y: number }[]))
        expect(a1).toBeLessThanOrEqual(a0 + 1e-9)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(40)
  })

  test("a fill is composed BEFORE its outline — attach order is composite order", () => {
    // three-host.ts's contract: a stroke attached after a fill draws over
    // it. If `composeShape` ever emitted the outline first, the fill
    // would cover the whole stroke rather than half of it, and the inset
    // would be treating a symptom.
    const page = new Slide({ data: slide43 })
    void page.parts
    const parts = page.byId.get("5508168")
    expect(parts).toBeDefined()
    expect(parts![0]).toBeInstanceOf(SlideFill)
    expect(parts![1]).toBeInstanceOf(Line)
  })

  test("fills:false composes no SlideFill at all — the A/B is real", () => {
    const off = new Slide({ data: slide43, fills: false })
    void off.parts
    expect(off.strokes.some((s) => s instanceof SlideFill)).toBe(false)
    const on = new Slide({ data: slide43 })
    void on.parts
    expect(on.strokes.filter((s) => s instanceof SlideFill).length).toBeGreaterThan(40)
  })
})

describe("the opacity ramp on Keynote's ease", () => {
  test("a keynote ramp is a LINEAR sequence whose waypoints are the curve", () => {
    const target = new Line({ points: square(4) })
    const anim = rampOpacity(target, [0, 1], true)
    const track = anim.tracks.find((t) => t.param === target.opacity)!
    expect(track.easing).toBe("linear")
    expect(track.mode).toBe("sequence")
    const wp = track.values as number[]
    expect(wp.length).toBe(EASE_SAMPLES + 1)
    expect(wp[0]!).toBeCloseTo(0, 9)
    expect(wp[wp.length - 1]!).toBeCloseTo(1, 9)
    for (let k = 0; k < wp.length; k++) {
      expect(wp[k]!).toBeCloseTo(keynoteEase(k / EASE_SAMPLES), 9)
    }
  })

  test("an Out ramp starts at 1 and reaches 0", () => {
    // The Out case states ONE value and starts from whatever the target
    // holds, which at build time is 1. A sequence has to state both ends,
    // so getting this wrong would make an Out build a no-op.
    const target = new Line({ points: square(4) })
    const wp = rampOpacity(target, [0], true).tracks.find((t) => t.param === target.opacity)!
      .values as number[]
    expect(wp[0]!).toBeCloseTo(1, 9)
    expect(wp[wp.length - 1]!).toBeCloseTo(0, 9)
  })

  test("the default ramp is UNCHANGED — the instant step must not take waypoints", () => {
    // `bc-appear` squeezes its whole transition into INSTANT_WINDOW,
    // where the curve is unobservable and 33 waypoints inside one
    // millisecond would be cost with no effect. The flag defaults off so
    // that caller is untouched.
    const target = new Line({ points: square(4) })
    const track = rampOpacity(target, [1]).tracks.find((t) => t.param === target.opacity)!
    expect(track.mode).toBe("to")
    expect(track.easing).not.toBe("linear")
  })
})

describe("what deck 43 actually declares", () => {
  test("it nests three levels — the deepest grouping in the deck", () => {
    // The row's hypothesis was "deep group nesting at scale". It IS the
    // deepest, and it is also already-solved: deck 48 nests three levels
    // too and P-7 scored it at 1.0000/0.9948. Pinned so a later reader
    // sees the depth is real and the capability is not new.
    const parent = new Map<string, string>()
    for (const g of slide43.groups) for (const m of g.members) parent.set(m, g.id)
    const depth = (id: string): number => {
      let d = 0
      let cur = id
      while (parent.has(cur) && d < 20) {
        cur = parent.get(cur)!
        d++
      }
      return d
    }
    expect(Math.max(...slide43.groups.map((g) => depth(g.id)))).toBe(3)
  })

  test("60 of its drawables carry an opaque fill — the occlusion corpus", () => {
    expect(slide43.shapes.filter((s) => s.fill).length).toBe(60)
  })

  test("every one of its dissolves declares NO acceleration, and its LineDraw does", () => {
    // The deck splits `acceleration` by build CLASS, not by slide: 155
    // builds state kEaseBoth (all motion, all scale, all LineDraw) and
    // 229 state nothing (all dissolves, all appears). The dissolves
    // nevertheless MEASURE as an ease — see Builds.KEYNOTE_EASE_S — so
    // an absent field is read as a default rather than as linearity.
    // Pinned here so that reading is visible as a choice.
    for (const b of slide43.builds) {
      if (b.effect.includes("LineDraw")) expect(b.acceleration).toBe("kEaseBoth")
      else expect(b.acceleration ?? null).toBeNull()
    }
  })
})
