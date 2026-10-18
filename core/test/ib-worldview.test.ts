/**
 * ib-worldview.test.ts — the Worldview (InterBrain film 10:56–11:50): the
 * prism's construction, the light's geometry derived from it, the clipping
 * the lens contents rest on, and every state param's endpoints. Plus the
 * FragmentedEarth pop-out it imports.
 */

import { describe, expect, test } from "bun:test"
import {
  LENS,
  PASTEL,
  SOURCE,
  SPECTRUM,
  WV,
  Worldview,
  bowOffset,
  clipCircle,
  eyeArc,
  hatch,
  prismCorners,
  prismSide,
} from "../vocabulary/Worldview/Worldview"
import { FragmentedEarth, FIELD_TO, GLOBE_OF_RING } from "../vocabulary/FragmentedEarth/FragmentedEarth"
import { Noosphere } from "../vocabulary/Noosphere/Noosphere"

const PX = 0.48
type P = { x: number; y: number }
/** Distance from p to the triangle's nearest side. */
const toSides = (p: P, tri: readonly P[]) =>
  Math.min(
    ...tri.map((a, i) => {
      const b = tri[(i + 1) % 3]!
      const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / ((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
      const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      return Math.hypot(p.x - q.x, p.y - q.y)
    }),
  )
const insideTri = (p: P, tri: readonly P[]) => {
  const s = tri.map((a, i) => {
    const b = tri[(i + 1) % 3]!
    return Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x))
  })
  return s.every((v) => v >= 0) || s.every((v) => v <= 0)
}

describe("Worldview — the construction", () => {
  test("the prism is equilateral, apex up, centred on its bounding box (f3391: 245 px side, apex 253, base 467)", () => {
    const [apex, right, left] = prismCorners()
    const side = Math.hypot(right.x - left.x, right.y - left.y)
    expect(side).toBeCloseTo(WV.side, 9)
    expect(Math.hypot(apex.x - left.x, apex.y - left.y)).toBeCloseTo(side, 9)
    expect(apex.y + left.y).toBeCloseTo(0, 9)
    expect(360 - apex.y * PX).toBeCloseTo(253, -0.5)
    expect(360 - left.y * PX).toBeCloseTo(467, -0.5)
  })

  test("the beam enters the left side and the spectrum leaves the right, on the sides (f3391: 590,335 · 686,331)", () => {
    const tri = prismCorners()
    const e = prismSide(WV.beamAt, -1)
    const o = prismSide(WV.bowAt, 1)
    expect(toSides(e, tri)).toBeLessThan(1e-9)
    expect(toSides(o, tri)).toBeLessThan(1e-9)
    expect(Math.abs(640 + e.x * PX - 590)).toBeLessThan(4)
    expect(Math.abs(640 + o.x * PX - 686)).toBeLessThan(4)
  })

  test("the spectrum ends on the eye's arc, centred on its axis, fanned to ±bowHalf", () => {
    const e = eyeArc()
    expect(WV.eye.x - e.x).toBeCloseTo(200 * WV.eye.scale, 9)
    // clean: the four boundaries split the fan in thirds, top to bottom
    const ys = [0, 1, 2, 3].map((k) => bowOffset(1, k, 0, 0))
    expect(ys[0]).toBeCloseTo(WV.bowHalf, 9)
    expect(ys[3]).toBeCloseTo(-WV.bowHalf, 9)
    expect(ys[0]! - ys[1]!).toBeCloseTo(ys[1]! - ys[2]!, 9)
    // and it starts as (almost) a point at the prism
    expect(Math.abs(bowOffset(0, 0, 0, 0) - bowOffset(0, 3, 0, 0))).toBeLessThan(0.1 * WV.bowHalf)
  })

  test("distortion waves the ribbon; the multipolar shred makes it wilder", () => {
    const dev = (d: number, s: number) =>
      Math.max(...Array.from({ length: 50 }, (_, i) => Math.abs(bowOffset(i / 49, 1, d, s) - bowOffset(i / 49, 1, 0, 0))))
    expect(dev(0, 1)).toBe(0)
    expect(dev(1, 0)).toBeGreaterThan(8)
    expect(dev(1, 1)).toBeGreaterThan(dev(1, 0))
  })

  test("the eye is video-01's, set at the film's scale: lids 198 px, the slim iris, no pupil", () => {
    const w = new Worldview()
    void [...w.walk()]
    expect(Math.abs(230 * w.eye.scale.value * PX - 198)).toBeLessThan(1)
    expect(w.eye.iris.radiusY.value * w.eye.scale.value * PX).toBeCloseTo(29, 0)
    expect(w.eye.pupil.opacity.value).toBe(0)
  })
})

describe("Worldview — the clipping the lens rests on", () => {
  const tri = prismCorners()
  test("hatch: every segment runs side to side, through the inside", () => {
    for (const phi of [0, Math.PI / 3, Math.PI / 2]) {
      const segs = hatch(tri, phi, 40)
      expect(segs.length).toBeGreaterThan(5)
      for (const [a, b] of segs) {
        expect(toSides(a!, tri)).toBeLessThan(1e-6)
        expect(toSides(b!, tri)).toBeLessThan(1e-6)
        expect(insideTri({ x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }, tri)).toBe(true)
      }
    }
  })

  test("clipCircle: a circle inside is whole; one across a side keeps only its inside runs", () => {
    const whole = clipCircle({ x: 0, y: -50 }, 40, tri)
    expect(whole.length).toBe(1)
    expect(whole[0]!.length).toBe(73)
    const cut = clipCircle({ x: 0, y: tri[1].y }, 60, tri)
    expect(cut.length).toBe(1)
    for (const p of cut[0]!) expect(insideTri(p, tri)).toBe(true)
  })
})

describe("Worldview — the states", () => {
  test("lens and source take names at construction and read as indices", () => {
    const w = new Worldview({ lens: "cube", source: "fragmented" })
    expect(w.lens.value).toBe(LENS.cube)
    expect(w.source.value).toBe(SOURCE.fragmented)
  })

  test("lens: each content is wholly there at its index and cross-fades between", () => {
    const w = new Worldview({ lens: LENS.lattice })
    void [...w.walk()]
    const there = () => w.lensSlots.map((s) => s.there.value)
    expect(there()).toEqual([0, 0, 0, 0, 1, 0])
    w.lens.value = 4.5
    expect(there()[4]).toBeCloseTo(0.5, 9)
    expect(there()[5]).toBeCloseTo(0.5, 9)
    // the default lens face is the Noosphere (f3451)
    expect(w.lensSlots[LENS.noosphere]!.members.some((m) => m instanceof Noosphere)).toBe(true)
  })

  test("distortion: the spectrum's pure colours at 0, the film's pastels at 1", () => {
    const w = new Worldview()
    void [...w.walk()]
    const tint = (k: number) => w.bands[k]![10]!.tint.value
    const same = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
      expect(a.r).toBeCloseTo(b.r, 9)
      expect(a.g).toBeCloseTo(b.g, 9)
      expect(a.b).toBeCloseTo(b.b, 9)
    }
    for (let k = 0; k < 3; k++) same(tint(k), SPECTRUM[k]!)
    w.distortion.value = 1
    for (let k = 0; k < 3; k++) same(tint(k), PASTEL[k]!)
  })

  test("prism: 0 sends the light straight to the eye with no spectrum; 1 into the prism", () => {
    const w = new Worldview({ prism: 0 })
    void [...w.walk()]
    const tipX = () => Math.max(...w.beams[w.beams.length / 4 - 1]!.outlines[0]!.points.map((p) => p.x))
    expect(tipX()).toBeGreaterThan(WV.eye.x - 400)
    expect(w.bands[0]![5]!.opacity.value).toBe(0)
    w.prism.value = 1
    expect(tipX()).toBeCloseTo(prismSide(WV.beamAt, -1).x, 6)
    expect(w.bands[0]![5]!.opacity.value).toBeGreaterThan(0.5)
  })

  test("reverse: looking at the lens, the light is gone", () => {
    const w = new Worldview({ reverse: 1 })
    void [...w.walk()]
    expect(w.beams.every((b) => b.opacity.value === 0)).toBe(true)
    expect(w.bands.flat().every((b) => b.opacity.value === 0)).toBe(true)
  })

  test("strings and pullers: one hand, then as many as pull", () => {
    const w = new Worldview()
    void [...w.walk()]
    const there = () => w.puppeteers.map((p) => (p.parent as unknown as { there: { value: number } }).there.value)
    expect(there().every((v) => v === 0)).toBe(true)
    w.strings.value = 1
    expect(there()).toEqual([1, 0, 0, 0, 0])
    w.pullers.value = 3
    expect(there()).toEqual([1, 1, 1, 0, 0])
  })

  test("source: the bare Earth is the fragmented one with its band folded away", () => {
    const w = new Worldview()
    void [...w.walk()]
    expect(w.fragmented.decoration.value).toBe(0)
    w.source.value = SOURCE.fragmented
    expect(w.fragmented.decoration.value).toBe(1)
    // the globe stays the film's size through the swap (106 px)
    expect(w.fragmented.globe.value * w.fragmented.radius.value * PX).toBeCloseTo(106, 0)
    expect(w.radiant.globe.value * w.radiant.radius.value).toBeCloseTo(WV.source.r, 9)
  })
})

describe("FragmentedEarth", () => {
  test("one size: the globe, the field-lines' reach and the bolts follow the ring", () => {
    const f = new FragmentedEarth({ radius: 200 })
    void [...f.walk()]
    expect(f.globe.value).toBe(GLOBE_OF_RING)
    expect(f.reach).toBeCloseTo(200 * FIELD_TO, 9)
    f.radius.value = 300
    expect(f.ring.radius.value).toBe(300)
    expect(f.reach).toBeCloseTo(300 * FIELD_TO, 9)
    const last = f.fields[0]!.points.at(-1)!
    expect(Math.hypot(last.x, last.y)).toBeCloseTo(300 * FIELD_TO, 6)
  })

  test("decoration: the bare globe at 0, the whole band at 1", () => {
    const f = new FragmentedEarth({ decoration: 0 })
    void [...f.walk()]
    expect(f.ring.opacity.value).toBe(0)
    expect(f.fields[0]!.opacity.value).toBe(0)
    expect(f.bolts.fillOpacity.value).toBe(0)
    f.decoration.value = 1
    expect(f.ring.opacity.value).toBe(1)
    expect(f.fields[0]!.opacity.value).toBeCloseTo(0.8, 9)
    expect(f.bolts.fillOpacity.value).toBe(1)
  })
})
