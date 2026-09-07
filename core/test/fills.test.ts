/**
 * The fill-and-colour grammar — pydeation's `Fill` / `UnFill` /
 * `ChangeColor` and the three composite verbs, plus the annular sector
 * they are first used on (O-4: Scene02 and Scene04).
 *
 * Every number here is recomputed from the source's own statement — the
 * transparency values from `fill_animate`, the window shares from each
 * composite animator — rather than copied off the implementation.
 */

import { describe, expect, test } from "bun:test"
import {
  AnnularSector,
  annularSectorFill,
  annularSectorPolyline,
  Circle,
  Ellipse,
  Group,
  Line,
  Stroke,
} from "../src/parts/primitives"
import {
  ChangeColor,
  DEFAULT_FILL_OPACITY,
  DrawThenFillCompletely,
  Fill,
  UnDrawThenUnFill,
  UnFill,
  UnFillThenUnDraw,
} from "../src/verbs"
import { Dream } from "../src/dream"
import { BLUE, GREEN, PI, RED, WHITE } from "../src/constants"
import type { Anim } from "../src/anim"

/** Every track an Anim carries that targets one named param. */
const tracksFor = (anim: Anim, name: string) =>
  anim.tracks.filter((t) => t.param.name === name)

describe("Fill / UnFill drive the wash, and only the wash", () => {
  test("the default fill is 1 − FILLER_TRANSPARENCY, i.e. 1 − 0.93", () => {
    // constants.py:47 states the transparency; fillOpacity is its complement.
    expect(DEFAULT_FILL_OPACITY).toBeCloseTo(1 - 0.93, 12)
    const shape = new Circle()
    const [track] = tracksFor(Fill(shape), "fillOpacity")
    expect(track).toBeDefined()
    expect(track!.values[0]).toBeCloseTo(1 - 0.93, 12)
  })

  test("solid:true forces transparency to 0, i.e. an opaque wash", () => {
    // object.py:475-477 — `if solid: transparency = 0`.
    const [track] = tracksFor(Fill(new Circle(), { solid: true }), "fillOpacity")
    expect(track!.values[0]).toBe(1)
  })

  test("an explicit transparency is read in the source's own units", () => {
    // Scene03's `Fill(global_system, transparency=1)` means fully clear.
    const [clear] = tracksFor(Fill(new Circle(), { transparency: 1 }), "fillOpacity")
    expect(clear!.values[0]).toBe(0)
    const [half] = tracksFor(Fill(new Circle(), { transparency: 0.5 }), "fillOpacity")
    expect(half!.values[0]).toBeCloseTo(0.5, 12)
  })

  test("UnFill is Fill with transparency hard-coded to 1", () => {
    // animator.py:383-396.
    const [track] = tracksFor(UnFill(new Circle()), "fillOpacity")
    expect(track!.values[0]).toBe(0)
  })

  test("neither verb touches `creation` — the outline is a separate surface", () => {
    expect(tracksFor(Fill(new Circle()), "creation")).toHaveLength(0)
    expect(tracksFor(UnFill(new Circle()), "creation")).toHaveLength(0)
  })

  test("both run holon-deep, reaching every Stroke under a Group", () => {
    const a = new Circle()
    const b = new Ellipse()
    const group = new Group({ members: [a, b] })
    expect(tracksFor(Fill(group), "fillOpacity")).toHaveLength(2)
  })
})

describe("ChangeColor moves both surfaces at once", () => {
  test("it animates tint, which the wash and the sketch line share", () => {
    // animator.py:319-320 — `if fill_color is None: fill_color = color`,
    // then ChangeFillColor and ChangeSketchColor over the same (0, 1).
    const shape = new Circle({ tint: WHITE })
    const [track] = tracksFor(ChangeColor(shape, GREEN), "tint")
    expect(track).toBeDefined()
    expect(track!.values[0]).toEqual(GREEN)
    expect(track!.relStart).toBe(0)
    expect(track!.relStop).toBe(1)
  })

  test("it reaches a whole group, one track per stroke", () => {
    const group = new Group({ members: [new Circle(), new Circle(), new Circle()] })
    expect(tracksFor(ChangeColor(group, RED), "tint")).toHaveLength(3)
  })
})

describe("the composite verbs carry the source's own window shares", () => {
  /** The one window a composite gives the tracks of one param. */
  const window = (anim: Anim, name: string): [number, number] => {
    const [track] = tracksFor(anim, name)
    if (!track) throw new Error(`no ${name} track`)
    return [track.relStart, track.relStop]
  }

  test("DrawThenFillCompletely: draw (0, 0.6), fill (0.5, 1)", () => {
    // animator.py:498-514.
    const anim = DrawThenFillCompletely(new Circle())
    expect(window(anim, "creation")).toEqual([0, 0.6])
    expect(window(anim, "fillOpacity")).toEqual([0.5, 1])
  })

  test("DrawThenFillCompletely fills SOLID, not to the faint default", () => {
    const [track] = tracksFor(DrawThenFillCompletely(new Circle()), "fillOpacity")
    expect(track!.values[0]).toBe(1)
  })

  test("UnFillThenUnDraw: unfill (0, 0.6) leads, undraw (0.5, 1) follows", () => {
    // animator.py:534-550 — the interior goes FIRST.
    const anim = UnFillThenUnDraw(new Circle())
    expect(window(anim, "fillOpacity")).toEqual([0, 0.6])
    expect(window(anim, "creation")).toEqual([0.5, 1])
  })

  test("UnDrawThenUnFill is NOT the mirror — its overlap is 0.3, not 0.1", () => {
    // animator.py:516-532: (undraw, (0, 0.6)), (unfill, (0.3, 1)).
    const anim = UnDrawThenUnFill(new Circle())
    expect(window(anim, "creation")).toEqual([0, 0.6])
    expect(window(anim, "fillOpacity")).toEqual([0.3, 1])
    // stated as the asymmetry it is: the two orders overlap differently
    const mirror = UnFillThenUnDraw(new Circle())
    const overlap = (a: Anim, lead: string, follow: string) =>
      window(a, lead)[1] - window(a, follow)[0]
    expect(overlap(anim, "creation", "fillOpacity")).toBeCloseTo(0.3, 12)
    expect(overlap(mirror, "fillOpacity", "creation")).toBeCloseTo(0.1, 12)
  })

  test("all three restage rather than window, so the ease keeps its full-span shape", () => {
    // pydeation's composites assemble at full span and rescale afterwards,
    // leaving the tangent lengths stated against the WHOLE span (anim.ts:
    // Track.smoothingWindow). Every track a composite emits carries it.
    for (const anim of [
      DrawThenFillCompletely(new Circle()),
      UnFillThenUnDraw(new Circle()),
      UnDrawThenUnFill(new Circle()),
    ]) {
      for (const track of anim.tracks) expect(track.smoothingWindow).toBe(1)
    }
  })
})

describe("the wash is genuinely independent of the outline", () => {
  test("UnFillThenUnDraw empties the shape while its outline still stands", () => {
    class D extends Dream {
      shape = new Circle({ fillOpacity: 1 })
      unfold() {
        this.play(UnFillThenUnDraw(this.shape), 10)
      }
    }
    const dream = new D()
    dream.build()
    // At 60% of the span the wash has just finished and the outline,
    // whose own window runs 50-100%, is still most of the way there.
    dream.applyAt(6)
    expect(dream.shape.fillOpacity.value).toBeCloseTo(0, 6)
    expect(dream.shape.creation.value).toBeGreaterThan(0.5)
    dream.applyAt(10)
    expect(dream.shape.creation.value).toBeCloseTo(0, 6)
  })
})

describe("AnnularSector — the ring arc", () => {
  test("its four pieces are separate strokes with independent pens", () => {
    // The reference draws the inner and outer arcs in lockstep, which one
    // pen walking a closed loop cannot do (parts/primitives.ts).
    const ring = new AnnularSector()
    const strokes = [...ring.walk()].filter((h) => h instanceof Stroke && h !== ring)
    expect(strokes).toHaveLength(4)
    // Four INDEPENDENT completions: a shared param would collapse the
    // deep verbs' four tracks into one step.
    const ids = new Set(strokes.map((s) => (s as Stroke).creation.id))
    expect(ids.size).toBe(4)
  })

  test("tint IS shared, so one ChangeColor turns the whole ring", () => {
    const ring = new AnnularSector({ tint: BLUE })
    const strokes = [...ring.walk()].filter((h): h is Stroke => h instanceof Stroke && h !== ring)
    for (const s of strokes) expect(s.tint).toBe(ring.tint)
    // One track per stroke, all pointing at the same param.
    const tracks = tracksFor(ChangeColor(ring, RED), "tint")
    expect(new Set(tracks.map((t) => t.param.id)).size).toBe(1)
  })

  test("the radial edges span innerRadius → radius at each end angle", () => {
    const ring = new AnnularSector({
      radius: 200,
      innerRadius: 100,
      startAngle: -PI / 3,
      endAngle: PI / 3,
    })
    void ring.parts // the edges are stated in compose(), which runs on first access
    const at = (line: Line, i: number) => line.points[i]!
    for (const [line, angle] of [
      [ring.edgeStart, -PI / 3],
      [ring.edgeEnd, PI / 3],
    ] as const) {
      expect(Math.hypot(at(line, 0).x, at(line, 0).y)).toBeCloseTo(100, 9)
      expect(Math.hypot(at(line, 1).x, at(line, 1).y)).toBeCloseTo(200, 9)
      expect(Math.atan2(at(line, 1).y, at(line, 1).x)).toBeCloseTo(angle, 9)
    }
  })

  test("symmetrical=True is spelled as ±angle/2 — the source's own rule", () => {
    // object.py:826-831. A 2π/3 sweep straddles zero by ±π/3, which is
    // what lets three of them tile a disc from three headings.
    const sweep = (2 * PI) / 3
    const ring = new AnnularSector({ startAngle: -sweep / 2, endAngle: sweep / 2 })
    expect(ring.endAngle.value - ring.startAngle.value).toBeCloseTo(sweep, 12)
    expect(ring.startAngle.value + ring.endAngle.value).toBeCloseTo(0, 12)
    // and three of them, 2π/3 apart, close the circle exactly
    expect(3 * sweep).toBeCloseTo(2 * PI, 12)
  })

  test("C4D's defaults: radius 200, inner radius 100", () => {
    // pydeation sets radius=200 (object.py:773) and never touches the
    // inner radius; f_00380 measures 200.5px outer and 101.5px inner.
    const ring = new AnnularSector()
    expect(ring.radius.value).toBe(200)
    expect(ring.innerRadius.value).toBe(100)
  })
})

describe("the annular sector's two geometries", () => {
  test("the outline is a closed loop of both arcs, first point = last", () => {
    const pts = annularSectorPolyline(200, 100, -PI / 3, PI / 3, 8)
    expect(pts[0]!.x).toBeCloseTo(pts.at(-1)!.x, 12)
    expect(pts[0]!.y).toBeCloseTo(pts.at(-1)!.y, 12)
    // every point sits on one radius or the other
    for (const p of pts) {
      const r = Math.hypot(p.x, p.y)
      expect(Math.min(Math.abs(r - 200), Math.abs(r - 100))).toBeLessThan(1e-9)
    }
  })

  test("the wash is a STRIP, not a fan — no triangle crosses the hole", () => {
    // fill.ts fans on vertex 0, which for a ring would sweep straight
    // across the middle. Every triangle here must stay in the annulus:
    // its centroid's radius lies between the two radii.
    const { points, indices } = annularSectorFill(200, 100, -PI / 3, PI / 3, 16)
    expect(indices.length % 3).toBe(0)
    expect(indices.length / 3).toBe(16 * 2)
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [points[indices[i]!]!, points[indices[i + 1]!]!, points[indices[i + 2]!]!]
      const cx = (a.x + b.x + c.x) / 3
      const cy = (a.y + b.y + c.y) / 3
      const r = Math.hypot(cx, cy)
      expect(r).toBeGreaterThan(99)
      expect(r).toBeLessThan(201)
    }
  })

  test("the wash covers the sector's area, to within the segment count", () => {
    const [r, ri, span, n] = [200, 100, (2 * PI) / 3, 64]
    const { points, indices } = annularSectorFill(r, ri, -span / 2, span / 2, n)
    let area = 0
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [points[indices[i]!]!, points[indices[i + 1]!]!, points[indices[i + 2]!]!]
      area += Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2
    }
    // exact annular sector area = (span/2)(R² − r²)
    const exact = (span / 2) * (r * r - ri * ri)
    expect(area / exact).toBeCloseTo(1, 3)
  })
})
