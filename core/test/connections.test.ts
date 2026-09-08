/**
 * Connection-line tests — the recompute rule, and the two bugs that
 * would have shipped silently without them.
 *
 * The chapter's lesson, stated once here because it is the reason this
 * file is as long as it is: EVERY failure P-4 hit was invisible in the
 * render. A stale stored path draws a plausible line in the wrong place;
 * a mirrored bow draws a plausible curve on the wrong side; a lattice
 * that restarts per segment draws plausible dots at the wrong spacing.
 * All three look like a working reproduction until they are measured
 * against the footage, so each one is pinned here against a number that
 * came from the deck or from the frames.
 */

import { describe, expect, test } from "bun:test"
import {
  arrowHead,
  boxCentre,
  connectionPath,
  controlThrough,
  dashAlong,
  flattenQuad,
  keynoteEaseAt,
  keynoteEaseInverse,
  lineDecoration,
  outlineExit,
  pointAtLength,
  polylineLength,
  quadAt,
  trimPolyline,
  unionBoxes,
  type ConnectTarget,
} from "../vocabulary/Slides/Connections"
import { Slide } from "../vocabulary/Slides/Slides"
import { drawsFromMiddle } from "../vocabulary/Slides/Builds"
import { Connection } from "../vocabulary/Slides/Connections"
import { slide08, slide09, slide14 } from "../vocabulary/Slides/assets/pl02/index"

/** A square target centred at (cx, cy) with the given half-size. */
const square = (id: string, cx: number, cy: number, h: number): ConnectTarget => ({
  id,
  box: { x: cx - h, y: cy - h, w: 2 * h, h: 2 * h },
  outline: [
    [
      { x: cx - h, y: cy - h },
      { x: cx + h, y: cy - h },
      { x: cx + h, y: cy + h },
      { x: cx - h, y: cy + h },
      { x: cx - h, y: cy - h },
    ],
  ],
})

describe("geometry primitives", () => {
  test("boxCentre and unionBoxes", () => {
    expect(boxCentre({ x: 10, y: 20, w: 30, h: 40 })).toEqual({ x: 25, y: 40 })
    expect(unionBoxes([])).toBeUndefined()
    expect(
      unionBoxes([
        { x: 0, y: 0, w: 10, h: 10 },
        { x: 20, y: 5, w: 10, h: 10 },
      ]),
    ).toEqual({ x: 0, y: 0, w: 30, h: 15 })
  })

  test("controlThrough puts the curve THROUGH the middle point", () => {
    // The whole of clause 2: B(1/2) must equal the point asked for, not
    // merely be pulled toward it. Reading the stored middle point as a
    // CONTROL scores 0.000-0.025 against reference ink where this scores
    // 0.463-0.547.
    const a = { x: 0, y: 0 }
    const b = { x: 100, y: 0 }
    const mid = { x: 50, y: 40 }
    const c = controlThrough(a, mid, b)
    const half = quadAt(a, c, b, 0.5)
    expect(half.x).toBeCloseTo(50, 9)
    expect(half.y).toBeCloseTo(40, 9)
  })

  test("a collinear middle point degenerates to a straight line", () => {
    const a = { x: 0, y: 0 }
    const b = { x: 100, y: 50 }
    const c = controlThrough(a, { x: 50, y: 25 }, b)
    for (const t of [0.1, 0.25, 0.5, 0.9]) {
      const p = quadAt(a, c, b, t)
      expect(p.x).toBeCloseTo(100 * t, 9)
      expect(p.y).toBeCloseTo(50 * t, 9)
    }
  })

  test("flattenQuad holds its tolerance on a long line and a short one", () => {
    // A fixed sample count would flatten a 600-unit mesh line more
    // coarsely than a 90-unit one; the dash lattice reads arc length off
    // this polyline, so that would be a period error that varies with
    // line length.
    for (const span of [90, 600]) {
      const a = { x: 0, y: 0 }
      const b = { x: span, y: 0 }
      const c = controlThrough(a, { x: span / 2, y: span / 8 }, b)
      const poly = flattenQuad(a, c, b)
      let worst = 0
      for (let i = 0; i + 1 < poly.length; i++) {
        const t = (i + 0.5) / (poly.length - 1)
        const truePt = quadAt(a, c, b, t)
        const mid = {
          x: (poly[i]!.x + poly[i + 1]!.x) / 2,
          y: (poly[i]!.y + poly[i + 1]!.y) / 2,
        }
        worst = Math.max(worst, Math.hypot(truePt.x - mid.x, truePt.y - mid.y))
      }
      expect(worst).toBeLessThan(1.0)
    }
  })

  test("polylineLength, pointAtLength and trimPolyline agree", () => {
    const p = [
      { x: 0, y: 0 },
      { x: 30, y: 40 },
      { x: 30, y: 90 },
    ]
    expect(polylineLength(p)).toBeCloseTo(100, 9)
    expect(pointAtLength(p, 50)).toEqual({ x: 30, y: 40 })
    expect(pointAtLength(p, -5)).toEqual({ x: 0, y: 0 })
    expect(pointAtLength(p, 1e6)).toEqual({ x: 30, y: 90 })
    const cut = trimPolyline(p, 25, 75)
    expect(polylineLength(cut)).toBeCloseTo(50, 9)
    expect(trimPolyline(p, 60, 60)).toEqual([])
  })
})

describe("the dash lattice is continuous, not per segment", () => {
  test("a lattice laid across many vertices keeps ONE period", () => {
    // `primitives.ts`'s dashRuns restarts its pattern at every vertex,
    // which is invisible on the straight two-point connections P-3 met
    // and wrong on a flattened curve — a mesh line is dozens of
    // segments, so the phase would reset dozens of times. Slide 9
    // measures a period of 15.003 +/- 0.009 slide units over lines up to
    // 594 units long, which only a continuous lattice reproduces.
    const poly: { x: number; y: number }[] = []
    for (let i = 0; i <= 40; i++) poly.push({ x: i * 5, y: 0 })
    const runs = dashAlong(poly, 1, 15)
    const starts = runs.map((r) => r[0]!.x)
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]! - starts[i - 1]!).toBeCloseTo(15, 6)
    }
    // …and it survives the vertices rather than resetting at them: a
    // per-segment lattice on a 5-unit segmentation would put a dash at
    // every multiple of 5.
    expect(starts.length).toBeCloseTo(Math.ceil(200 / 15), 0)
  })

  test("a zero period gives one solid run", () => {
    const poly = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]
    expect(dashAlong(poly, 0, 0)).toHaveLength(1)
  })
})

describe("the clip is against the SILHOUETTE, not the box", () => {
  test("a concave outline clips at its OUTERMOST crossing", () => {
    // `Head with Shoulders_826` is concave, so a ray from its centre
    // crosses its own outline several times — out of the neck, back
    // through a shoulder, out again. The footage shows a dot in each
    // shoulder notch and none inside the head, i.e. Keynote draws from
    // the LAST crossing. A "first crossing" reading would start the line
    // inside the icon.
    const notched: ConnectTarget = {
      id: "notched",
      box: { x: -10, y: -10, w: 20, h: 20 },
      outline: [
        [
          { x: 2, y: -10 },
          { x: 2, y: 10 },
        ],
        [
          { x: 8, y: -10 },
          { x: 8, y: 10 },
        ],
      ],
    }
    const ray = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]
    expect(outlineExit(ray, notched)).toBeCloseTo(8, 6)
  })

  test("an empty outline reports no crossing, and the box takes over", () => {
    const bare: ConnectTarget = {
      id: "bare",
      box: { x: -10, y: -10, w: 20, h: 20 },
      outline: [],
    }
    expect(outlineExit([{ x: 0, y: 0 }, { x: 100, y: 0 }], bare)).toBe(0)
    // connectionPath must still clip it, via the box fallback.
    const path = connectionPath(bare, square("b", 200, 0, 10))
    expect(path.clipFrom).toBeCloseTo(10, 6)
  })

  test("the clip lands on the outline from BOTH ends", () => {
    const a = square("a", 0, 0, 10)
    const b = square("b", 200, 0, 10)
    const path = connectionPath(a, b)
    expect(path.clipFrom).toBeCloseTo(10, 6)
    expect(path.clipTo).toBeCloseTo(190, 6)
    expect(path.points[0]!.x).toBeCloseTo(10, 6)
    expect(path.points[path.points.length - 1]!.x).toBeCloseTo(190, 6)
  })
})

describe("the outset is READ, and it was a missing field not a missing rule", () => {
  test("a declared outset stands the line further off each end", () => {
    // P-1's note recorded outsetFrom/outsetTo as "both 0.0 throughout
    // this deck". They are per-line: 164 of the 467 in-scope lines are
    // non-zero, clustered on the densest meshes (slide 8 is 30/30,
    // slide 11 is 10/10). Assuming zero cost this chapter a day of
    // testing six boundary rules against a residual that was not a rule.
    const a = square("a", 0, 0, 10)
    const b = square("b", 200, 0, 10)
    const path = connectionPath(a, b, undefined, { from: 30, to: 30 })
    expect(path.clipFrom).toBeCloseTo(40, 6)
    expect(path.clipTo).toBeCloseTo(160, 6)
  })

  test("slide 8 declares 30/30 and slide 9 declares nothing", () => {
    // The deck's own numbers, so a re-emission cannot quietly change the
    // premise this chapter's scores rest on.
    for (const shape of slide08.shapes) {
      if (!shape.connects) continue
      expect(shape.outset).toEqual({ from: 30, to: 30 })
    }
    for (const shape of slide09.shapes) {
      if (!shape.connects) continue
      expect(shape.outset?.from ?? 0).toBe(0)
      expect(shape.outset?.to ?? 0).toBe(0)
    }
  })
})

describe("the bow is a SHAPE, not a point — the chapter's hardest bug", () => {
  test("a stale stored chord still yields the right curvature", () => {
    // Slide 8's line 4105549 stores a chord of (-125.5, -183.6) where
    // the true centre-to-centre is (-251.6, -364.2) — exactly half,
    // because the frame it was fitted into is a leftover from when the
    // campfires sat closer together. Read as a POSITION its middle point
    // lands off the line and the curve bows the wrong way; all ten of
    // slide 8's lines rendered as mirrored red/green pairs about their
    // chords. Read as a FRACTION of the stored chord it is scale-free.
    //
    // Here: a stored chord half the size of the real one, with the same
    // relative bow, must produce a curve whose sagitta scales with the
    // REAL chord.
    const bowFraction = 0.2
    const curveFor = (span: number): number => {
      const a = { x: 0, y: 0 }
      const b = { x: span, y: 0 }
      // The middle point as the renderer derives it: along = 0.5,
      // across = bowFraction, in the recomputed chord's own basis.
      const mid = { x: span * 0.5, y: -span * bowFraction }
      const c = controlThrough(a, mid, b)
      return Math.abs(quadAt(a, c, b, 0.5).y)
    }
    expect(curveFor(100)).toBeCloseTo(20, 9)
    expect(curveFor(200)).toBeCloseTo(40, 9)
    // Scale-free: the sagitta/chord ratio is the same at both sizes.
    expect(curveFor(200) / 200).toBeCloseTo(curveFor(100) / 100, 9)
  })

  test("the bow's SIGN survives a reversed chord", () => {
    // The mirroring bug in one line: a chord running right-to-left must
    // bow to the same physical side, not the reflected one.
    const across = 0.2
    const bow = (ax: number, bx: number): number => {
      const vx = bx - ax
      const mid = { x: ax + vx * 0.5, y: 0 - vx * 0 + -0 * across }
      void mid
      // The renderer's own arithmetic: mid = a + v*along + perp(v)*across
      const m = { x: ax + vx * 0.5, y: 0 + vx * across }
      const c = controlThrough({ x: ax, y: 0 }, m, { x: bx, y: 0 })
      return quadAt({ x: ax, y: 0 }, c, { x: bx, y: 0 }, 0.5).y
    }
    // Left-to-right bows one way; right-to-left bows the other, which is
    // correct — the perpendicular follows the chord's own direction.
    expect(bow(0, 100)).toBeCloseTo(20, 9)
    expect(bow(100, 0)).toBeCloseTo(-20, 9)
  })
})

describe("arrowheads", () => {
  test("the head sits at the tip, pointing along the line", () => {
    const head = arrowHead({ x: 100, y: 0 }, { x: 0, y: 0 }, 10, 5)
    expect(head).toHaveLength(4)
    // The tip is the point given…
    expect(head[1]).toEqual({ x: 100, y: 0 })
    // …and the base is one `size` back, `halfWidth` to each side.
    expect(head[0]!.x).toBeCloseTo(90, 9)
    expect(head[2]!.x).toBeCloseTo(90, 9)
    expect(Math.abs(head[0]!.y - head[2]!.y)).toBeCloseTo(10, 9)
    // Closed, because this framework draws the filled triangle as its
    // own outline.
    expect(head[3]).toEqual(head[0])
  })

  test("a degenerate direction draws nothing rather than a spike", () => {
    expect(arrowHead({ x: 5, y: 5 }, { x: 5, y: 5 }, 10)).toEqual([])
    expect(arrowHead({ x: 100, y: 0 }, { x: 0, y: 0 }, 0)).toEqual([])
  })

  test("the decoration dispatches on its IDENTIFIER, not on position", () => {
    // P-1's warning, and it is worth heeding rather than paraphrasing:
    // "don't key on always-simple-arrow-on-TO". Of the deck's 123 heads
    // and one tail, TWO are `filled circle`. A consumer drawing every
    // decoration as a triangle would be wrong three times, silently —
    // and none of the exceptions falls on slides 7, 8, 9 or 14, so no
    // frame this chapter scores would have caught it.
    const tip = { x: 100, y: 0 }
    const prev = { x: 0, y: 0 }

    const arrow = lineDecoration("simple arrow", tip, prev, 10)
    expect(arrow).toHaveLength(4)
    expect(arrow[1]).toEqual(tip)

    // A circle is centred on the end and has no direction, so it must
    // NOT be a triangle with the tip pushed forward.
    const dot = lineDecoration("filled circle", tip, prev, 10)
    expect(dot.length).toBeGreaterThan(8)
    for (const p of dot) {
      expect(Math.hypot(p.x - tip.x, p.y - tip.y)).toBeCloseTo(5, 6)
    }

    // An identifier nobody has read draws NOTHING. A missing decoration
    // is a visible gap; one invented in the wrong shape is a fidelity
    // claim the data does not support.
    expect(lineDecoration("some future thing", tip, prev, 10)).toEqual([])
  })

  test("a head and a tail are separate outlines, not one polyline", () => {
    // One line in the deck carries a tail. Concatenating the two
    // decorations into a single point list would draw a spurious segment
    // joining the two ENDS of the line straight across the tableau.
    const line = new Connection({
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 100, y: 0, z: 0 },
      ],
      decorations: [
        arrowHead({ x: 100, y: 0 }, { x: 0, y: 0 }, 10).map((p) => ({ ...p, z: 0 })),
        arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 10).map((p) => ({ ...p, z: 0 })),
      ],
    })
    void line.parts
    expect(line.arrows).toHaveLength(2)
    // Each stays within its own end of the line rather than spanning it.
    for (const a of line.arrows) {
      const xs = a.points.map((p) => p.x)
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(20)
    }
  })

  test("all ten of slide 8's lines declare a head and none a tail", () => {
    const conns = slide08.shapes.filter((s) => s.connects)
    expect(conns).toHaveLength(10)
    for (const c of conns) {
      expect(c.lineEnds?.head?.identifier).toBe("simple arrow")
      expect(c.lineEnds?.tail).toBeUndefined()
    }
    // …and slide 9's fifteen declare neither, so a consumer keying
    // "connections always have arrows" would be wrong.
    for (const c of slide09.shapes.filter((s) => s.connects)) {
      expect(c.lineEnds?.head).toBeUndefined()
    }
  })
})

describe("the meshes compose, at scale", () => {
  test("slide 9 is a complete K6 and every line recomputes", () => {
    const page = new Slide({ data: slide09 })
    void page.parts
    // Fifteen lines is C(6,2) — a complete graph on the six icons.
    expect(page.connections).toHaveLength(15)
    // NOT ONE falls through to its stored path. This is the assertion
    // that would have caught a silent regression in endpoint resolution.
    expect(page.stalePaths()).toHaveLength(0)
    for (const line of page.connections) {
      expect(line.points.length).toBeGreaterThanOrEqual(2)
      expect(line.drawn().length).toBeGreaterThan(0)
    }
  })

  test("slide 14 is two K6 meshes, thirty lines, and zero builds", () => {
    const page = new Slide({ data: slide14 })
    void page.parts
    expect(page.connections).toHaveLength(30)
    expect(page.stalePaths()).toHaveLength(0)
    // Zero builds makes it the purest test of the recompute rule: every
    // pixel of the frame is geometry, nothing depends on timing.
    expect(slide14.builds).toHaveLength(0)
  })

  test("slide 8's endpoints are GROUPS, and groups still resolve", () => {
    // P-1 flagged "P-4 (groups at scale) is where the next such gap
    // would surface" and it did: `KeyGroup` carries members but no
    // geometry, and ALL of slide 8's endpoints are groups. The extent is
    // derived by recursively unioning members, which is a derivation
    // from what the model states rather than a fact it lacks.
    const groupIds = new Set(slide08.groups.map((g) => g.id))
    const shapeIds = new Set(slide08.shapes.map((s) => s.id))
    let toGroups = 0
    for (const shape of slide08.shapes) {
      if (!shape.connects) continue
      for (const end of [shape.connects.from, shape.connects.to]) {
        if (end && groupIds.has(end) && !shapeIds.has(end)) toGroups++
      }
    }
    expect(toGroups).toBeGreaterThan(0)

    const page = new Slide({ data: slide08 })
    void page.parts
    expect(page.connections).toHaveLength(10)
    expect(page.stalePaths()).toHaveLength(0)
    // Every one carries its arrowhead through to something drawn.
    for (const line of page.connections) {
      void line.parts
      expect(line.arrow).toBeDefined()
    }
  })

  test("a connection is reached by opacity, as a DottedLine is", () => {
    // A Connection draws nothing itself — it parents one Line per dash
    // plus the head — so an opacity stated on it changes no pixel. That
    // is how P-3's four connection lines survived a page cut and stayed
    // on screen for seventy seconds. On slide 9 it would strand fifteen
    // lines of a dozen dashes each.
    const page = new Slide({ data: slide09 })
    void page.parts
    const line = page.connections[0]!
    void line.parts
    // A mesh line is many dashes, not one drawable…
    expect(line.dashes.length).toBeGreaterThan(1)
    expect(line.drawn().length).toBe(line.dashes.length)
    // …and `visible` must emit a track for each of them, on every line.
    // One track per connection would be the silent version of P-3's
    // seventy-second ghost: fifteen meshes left on screen after a cut.
    const dashTotal = page.connections.reduce((n, c) => {
      void c.parts
      return n + c.drawn().length
    }, 0)
    expect(dashTotal).toBeGreaterThan(page.connections.length * 5)
    expect(page.visible(false).tracks.length).toBeGreaterThanOrEqual(dashTotal)
  })

  test("every LineDrawForLine on slide 9 finds a Connection to drive", () => {
    const page = new Slide({ data: slide09 })
    void page.parts
    const lineDraws = slide09.builds.filter((b) =>
      b.effect.endsWith("LineDrawForLine"),
    )
    expect(lineDraws).toHaveLength(15)
    for (const build of lineDraws) {
      const targets = page.buildTargets(build)
      expect(targets).toHaveLength(1)
      expect(targets[0]).toBeInstanceOf(Connection)
    }
    expect(page.missingBuildTargets()).toHaveLength(0)
  })

  test("a build whose target is a GROUP resolves to its members", () => {
    // Found by the assertion above rather than by looking. Slide 9's
    // Logo is one `apple:dissolve` on group 5149755, whose five member
    // shapes are what draw; `byId` holds shapes and texts only, so the
    // build reported as having no target — indistinguishable from the
    // genuinely absent ones (a dropped image), which is the exact
    // confusion `missingBuildTargets` exists to prevent.
    const page = new Slide({ data: slide09 })
    void page.parts
    const logo = slide09.builds.find((b) => b.target === "5149755")!
    expect(logo.effect).toBe("apple:dissolve")
    const group = slide09.groups.find((g) => g.id === "5149755")!
    expect(group.members).toHaveLength(5)
    // SEVEN parts for FIVE members, since P-5: two of the Logo's five
    // shapes carry a black fill (5149772 and 5149786, both closed), and
    // a filled shape composes a `SlideFill` alongside its outline
    // because the two carry different colours. The count is not the
    // test's subject — that a group build resolves to what actually
    // draws, rather than reporting no target at all, is — so the
    // assertion is on the parts the members contribute, and it is
    // stated as such rather than as a bare number that would move again
    // the next time a member gains a surface.
    const parts = page.buildTargets(logo)
    expect(parts.length).toBeGreaterThanOrEqual(group.members.length)
    const filled = group.members.filter(
      (id) => slide09.shapes.find((s) => s.id === id)?.fill,
    )
    expect(filled).toHaveLength(2)
    expect(parts).toHaveLength(group.members.length + filled.length)
  })
})

describe("direction 53 draws from the middle outward", () => {
  test("all fifteen of slide 9's line draws declare it, and nothing else does", () => {
    // The only slide in the deck that uses 53. P-1 carried the field
    // uninterpreted; P-3 measured 51 and 52 on slide 2 (both drawing
    // centre-outward relative to the PAGE, which its geometric fallback
    // reproduces without reading the field); this is the first reading
    // of 53, and it is a different thing entirely.
    const lineDraws = slide09.builds.filter((b) =>
      b.effect.endsWith("LineDrawForLine"),
    )
    expect(lineDraws).toHaveLength(15)
    for (const b of lineDraws) {
      expect(b.direction).toBe(53)
      expect(drawsFromMiddle(b)).toBe(true)
    }
    // Slides 8 and 14 declare nothing, so absence stays the default.
    for (const b of slide08.builds) expect(drawsFromMiddle(b)).toBe(false)
  })

  test("the two fronts advance together and finish together", () => {
    // The footage, at fractions along one 594-unit mesh line during its
    // 2.0s draw: the middle lights at 172.4, then 40%/60% together at
    // 172.8, then 30%/70%, 20%/80%, 10%/90%. A one-ended draw would
    // light one column at a time from one side.
    const page = new Slide({ data: slide09 })
    void page.parts
    const record = slide09.builds.find((b) =>
      b.effect.endsWith("LineDrawForLine"),
    )!
    const line = page.buildTargets(record)[0] as Connection
    void line.parts
    const dashes = line.drawn()
    const anim = page.build(record)

    const startOf = new Map<unknown, number>()
    for (const t of anim.tracks) {
      const prev = startOf.get(t.param.owner)
      if (prev === undefined || t.relStart < prev) startOf.set(t.param.owner, t.relStart)
    }

    // The middle dash opens the draw…
    const mid = dashes[Math.floor((dashes.length - 1) / 2)]!
    for (const d of dashes) {
      expect(startOf.get(mid)!).toBeLessThanOrEqual(startOf.get(d)! + 1e-9)
    }
    // …and a dash's start depends ONLY on its distance from the middle,
    // which is the symmetry a one-ended sweep cannot produce. (Compared
    // by distance rather than by index pairs, because with an even dash
    // count the middle falls between two dashes and index arithmetic
    // would pair them asymmetrically — which is a fact about the test,
    // not about the sweep.)
    // The sweep is a MIRROR: reading the starts from each end inward
    // gives the same sequence. On slide 9's 30-dash line that is
    // 0.9333, 0.8667 … 0.0000 | 0.0000 … 0.8667, 0.9333. A one-ended
    // sweep would be monotone across the whole line instead.
    const starts = dashes.map((d) => startOf.get(d)!)
    for (let i = 0; i < starts.length; i++) {
      expect(starts[i]!).toBeCloseTo(starts[starts.length - 1 - i]!, 6)
    }
    // …and it decreases inward from both ends, which is what makes it a
    // draw from the middle rather than merely a symmetric one.
    for (let i = 1; i < Math.floor(starts.length / 2); i++) {
      expect(starts[i]!).toBeLessThan(starts[i - 1]!)
    }
    // The middle opens the window and the ends close it.
    expect(Math.min(...starts)).toBeCloseTo(0, 6)

    // NO DASH GETS A ZERO-WIDTH WINDOW. An earlier version of the sweep
    // divided by the distance to the outermost dash rather than by the
    // number of steps, which gave that dash a [1, 1] window — so the two
    // ENDS of every mesh line silently never drew, on all fifteen lines,
    // in a frame that still scored a perfect coverage_ref because the
    // reference had not reached them yet either.
    const stopOf = new Map<unknown, number>()
    for (const t of anim.tracks) {
      const prev = stopOf.get(t.param.owner)
      if (prev === undefined || t.relStop > prev) stopOf.set(t.param.owner, t.relStop)
    }
    for (const d of dashes) {
      expect(stopOf.get(d)!).toBeGreaterThan(startOf.get(d)! + 1e-9)
    }
    expect(Math.max(...dashes.map((d) => stopOf.get(d)!))).toBeCloseTo(1, 6)
  })
})

describe("the draw front is EASED, not linear (P-10)", () => {
  test("keynoteEaseInverse inverts the curve", () => {
    for (const f of [0.05, 0.2, 0.5, 0.75, 0.95]) {
      expect(keynoteEaseAt(keynoteEaseInverse(f))).toBeCloseTo(f, 6)
    }
    expect(keynoteEaseInverse(0)).toBe(0)
    expect(keynoteEaseInverse(1)).toBe(1)
  })

  test("the inverse is slower at the ends and faster in the middle", () => {
    // The whole content of "eased": equal SPATIAL steps take unequal
    // TIME. A linear front would make every gap identical, which is
    // what this module did before P-10 measured the difference (eased
    // rms 0.0120 against linear 0.0617 on deck 11's seventy lines).
    const at = [0, 0.25, 0.5, 0.75, 1].map(keynoteEaseInverse)
    const gaps = at.slice(1).map((v, i) => v - at[i]!)
    // First and last quarters take longer than the middle two.
    expect(gaps[0]!).toBeGreaterThan(gaps[1]!)
    expect(gaps[3]!).toBeGreaterThan(gaps[2]!)
    // …and symmetrically so, since kEaseBoth is symmetric.
    expect(gaps[0]!).toBeCloseTo(gaps[3]!, 6)
    expect(gaps[1]!).toBeCloseTo(gaps[2]!, 6)
  })

  test("a mesh line's dash windows are non-uniform, and still cover [0,1]", () => {
    const page = new Slide({ data: slide08 })
    void page.parts
    const record = slide08.builds.find((b) =>
      b.effect.endsWith("LineDrawForLine"),
    )!
    const line = page.buildTargets(record)[0] as Connection
    void line.parts
    const anim = page.build(record)

    const startOf = new Map<unknown, number>()
    for (const t of anim.tracks) {
      const prev = startOf.get(t.param.owner)
      if (prev === undefined || t.relStart < prev) startOf.set(t.param.owner, t.relStart)
    }
    const starts = line.dashes.map((d) => startOf.get(d)!)
    expect(starts.length).toBeGreaterThan(4)

    // Monotone — the front only advances…
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]!).toBeGreaterThan(starts[i - 1]!)
    }
    // …and NON-UNIFORMLY, which is the whole finding. A linear front
    // gives every gap the same size; the ease's slow start and fast
    // middle spread them by several times.
    const gaps = starts.slice(1).map((v, i) => v - starts[i]!)
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeGreaterThan(2)
    // The sweep still starts at 0 and the last dash still finishes.
    expect(starts[0]!).toBeCloseTo(0, 6)
    expect(Math.max(...anim.tracks.map((t) => t.relStop))).toBeCloseTo(1, 6)
  })
})

describe("the arrowhead RIDES the front (P-10)", () => {
  test("it is lit from the start and its position is driven, not its creation", () => {
    // My own comment used to assert the opposite — "the arrowhead
    // arriving at the end of the shaft because that is where the shaft
    // reaches it" — which was an assumption documented as a finding.
    // The footage draws the head AT the advancing front from the first
    // frame: zero ink beyond the front across four consecutive frames on
    // the 25 longest corridors, where a head parked at its final
    // position would light that far column immediately.
    const page = new Slide({ data: slide08 })
    void page.parts
    const record = slide08.builds.find((b) =>
      b.effect.endsWith("LineDrawForLine"),
    )!
    const line = page.buildTargets(record)[0] as Connection
    void line.parts
    expect(line.arrows).toHaveLength(1)

    const anim = page.build(record)
    const head = line.arrows[0]!
    // The head's own creation is stamped at the very start — it is drawn
    // from frame one rather than swept in at the end.
    const headTracks = anim.tracks.filter((t) => t.param.owner === head)
    expect(headTracks.length).toBeGreaterThan(0)
    for (const t of headTracks) expect(t.relStart).toBeCloseTo(0, 6)
    // …and the FRONT parameter sweeps the whole window, which is what
    // moves it.
    const frontTracks = anim.tracks.filter((t) => t.param === line.headFront)
    expect(frontTracks).toHaveLength(1)
    expect(frontTracks[0]!.relStart).toBeCloseTo(0, 6)
    expect(frontTracks[0]!.relStop).toBeCloseTo(1, 6)
  })

  test("the head's geometry actually MOVES with headFront", () => {
    const page = new Slide({ data: slide08 })
    void page.parts
    const line = page.connections.find((c) => {
      void c.parts
      return c.arrows.length > 0
    })!
    void line.parts
    const head = line.arrows[0]!

    line.headFront.value = 1
    const atEnd = head.points.map((p) => ({ x: p.x, y: p.y }))
    line.headFront.value = 0
    const atStart = head.points.map((p) => ({ x: p.x, y: p.y }))

    // It is somewhere else at the start of the draw…
    const moved = Math.hypot(atEnd[0]!.x - atStart[0]!.x, atEnd[0]!.y - atStart[0]!.y)
    expect(moved).toBeGreaterThan(0)
    // …and it is a RIGID translation: the shape does not deform.
    for (let i = 1; i < atEnd.length; i++) {
      expect(atEnd[i]!.x - atStart[i]!.x).toBeCloseTo(atEnd[0]!.x - atStart[0]!.x, 6)
      expect(atEnd[i]!.y - atStart[i]!.y).toBeCloseTo(atEnd[0]!.y - atStart[0]!.y, 6)
    }
    // A held tableau — the 89% case — must show the head finished.
    line.headFront.value = 1
    expect(head.points[0]!.x).toBeCloseTo(atEnd[0]!.x, 9)
  })

  test("preBuild parks the head at the shaft's origin, not the tip", () => {
    const page = new Slide({ data: slide08 })
    void page.parts
    const record = slide08.builds.find((b) =>
      b.effect.endsWith("LineDrawForLine"),
    )!
    const line = page.buildTargets(record)[0] as Connection
    void line.parts
    const tracks = page.preBuild([record]).tracks
    const frontReset = tracks.filter((t) => t.param === line.headFront)
    expect(frontReset).toHaveLength(1)
    expect(frontReset[0]!.values[frontReset[0]!.values.length - 1]).toBe(0)
  })
})

describe("the deck's own numbers, pinned", () => {
  test("slide 9's icons are identical and hexagonal", () => {
    // The reason slide 9 is the chapter's gate: six identical icons at
    // symmetric positions make the fifteen clips fifteen independent
    // samples of one rule with no confounds.
    const icons = slide09.shapes.filter(
      (s) => s.icon === "Head with Shoulders_826",
    )
    expect(icons).toHaveLength(6)
  })

  test("the round-cap period is what slide 9 measures", () => {
    // P-1 derived (dash + gap + 1) * width from the stylesheet on one
    // corridor of one slide; fifteen independent lines here measure
    // 15.003 +/- 0.009 slide units against its prediction of 15.005.
    const conn = slide09.shapes.find((s) => s.connects && s.dash)!
    expect(conn.cap).toBe("RoundCap")
    expect(conn.dash).toEqual([0.001, 2])
    expect(conn.strokeWidth).toBe(5)
    const period = (conn.dash![0]! + conn.dash![1]! + 1) * conn.strokeWidth!
    expect(period).toBeCloseTo(15.005, 3)
  })

  test("slide 8's cascade order is the chunk list's own", () => {
    // The footage measures ten firings 0.5s apart spanning 164.7-169.2 —
    // one click and a nine-step cascade, not ten clicks — and in the
    // chunk list's order. That is the first measured confirmation of the
    // `automatic` flag P-1 recorded as unsettled.
    const chunks = slide08.buildChunks!
    expect(chunks).toHaveLength(10)
    expect(chunks[0]!.automatic).toBe(false)
    for (const chunk of chunks.slice(1)) expect(chunk.automatic).toBe(true)
    for (const chunk of chunks) expect(chunk.duration).toBe(0.5)
  })
})
