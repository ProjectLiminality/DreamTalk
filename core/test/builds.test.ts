/**
 * P-3 — the two dominant Keynote builds, and the opening arc's schedule.
 *
 * What these pin, in order of how expensive the bug would be:
 *
 *   1. The BUILD/SCHEDULE division. A build's duration comes from the
 *      deck and its onset from the footage; the tests assert the first
 *      and let the scene own the second, so a future edit cannot quietly
 *      start tuning durations to make onsets land.
 *   2. Absolute clip placement. The scene's builds OVERLAP — the eagle's
 *      icon starts fading before its line has finished drawing — and a
 *      forward-only cursor silently pushed every build 0.6s late. That
 *      bug produced a scene that looked plausible and scored fine on
 *      settled frames, so it needs a test rather than an eye.
 *   3. Reaching what actually draws. A DottedLine draws nothing itself;
 *      its dashes do. Opacity set on the parent changes no pixel, which
 *      is how four connection lines survived a page cut and stayed on
 *      screen for seventy seconds.
 *   4. The pre-build state, which is P-2's slide-32 lesson from the
 *      other side: a Slide composes FINISHED, so anything a build brings
 *      in must be pushed back to nothing or the page over-draws.
 */

import { describe, expect, test } from "bun:test"
import { Slide } from "../vocabulary/Slides/Slides"
import {
  DISSOLVE,
  DISSOLVE_CHARACTER,
  LINE_DRAW,
  MOTION_PATH,
  SUPPORTED,
  drawsReversed,
  motionEndpoint,
  motionIsStraight,
  unsupportedBuilds,
} from "../vocabulary/Slides/Builds"
import { Arc01Dream } from "../demo/pl02/Arc01"
import { DottedLine, Line } from "../src/parts/primitives"
import {
  slide02,
  slide03,
  slide04,
  slide05,
  slide06,
} from "../vocabulary/Slides/assets/pl02/index"
import type { KeyBuild } from "../src/geometry/keynote"

describe("the deck names the chapter's two builds", () => {
  test("dissolve character and LineDrawForLine dominate the opening arc", () => {
    const counts = new Map<string, number>()
    for (const s of [slide02, slide03, slide04, slide05, slide06]) {
      for (const b of s.builds) counts.set(b.effect, (counts.get(b.effect) ?? 0) + 1)
    }
    // Read off the deck, not chosen: these are the census the chapter
    // was scoped from.
    expect(counts.get(DISSOLVE_CHARACTER)).toBe(15)
    expect(counts.get(DISSOLVE)).toBe(5)
    expect(counts.get(LINE_DRAW)).toBe(4)
    expect(counts.get("apple:action-motion-path")).toBe(1)
  })

  test("every build in the arc declares All at Once — the delivery that makes dissolve and dissolve character identical", () => {
    for (const s of [slide02, slide03, slide04, slide05]) {
      for (const b of s.builds) expect(b.delivery).toBe("All at Once")
    }
  })

  test("every build in the arc declares a 1.0s duration", () => {
    for (const s of [slide02, slide03, slide04, slide05]) {
      for (const c of s.buildChunks ?? []) expect(c.duration).toBe(1)
    }
  })

  test("nothing in the arc is silently dropped", () => {
    for (const data of [slide02, slide03, slide04, slide05, slide06]) {
      expect(unsupportedBuilds(data.builds)).toEqual([])
    }
    // An effect the chapter does NOT implement must be reported, so a
    // build that does nothing cannot look like a build that never was.
    expect(SUPPORTED.has("apple:action-scale")).toBe(false)
    expect(unsupportedBuilds([{ ...slide03.builds[0]!, effect: "apple:action-scale" }])).toHaveLength(1)
  })

  test("slide 3's motion path is the declared straight run, read not derived", () => {
    const record = slide03.builds.find((b) => b.effect === MOTION_PATH)!
    expect(record.target).toBe("4516215") // the "Story" label
    expect(record.animationType).toBe("Action")
    expect(motionIsStraight(record)).toBe(true)

    // The deck states (-1.388, -229.910) slide units. The label sits at
    // y 485.569, so it lands at 255.66 — video row 170, against the
    // reference's glyph band at rows 158-189 in f_00201.
    const end = motionEndpoint(record)!
    expect(end.x).toBeCloseTo(-1.3881216, 6)
    expect(end.y).toBeCloseTo(-229.91022, 5)
  })

  test("an Action build's target is neither pre-hidden nor held back by the cut", () => {
    const page = new Slide({ data: slide03 })
    void page.parts
    const record = slide03.builds.find((b) => b.effect === MOTION_PATH)!
    const label = page.buildTargets(record)[0]!
    // The label is on screen throughout — the motion moves it, it does
    // not bring it on. Pre-hiding it would blank a drawable the footage
    // shows for the whole segment.
    const hidden = new Set(page.preBuild().tracks.map((t) => t.param.owner))
    // Its own dissolve DOES pre-hide it; what must not happen is the
    // Action build adding a second, contradictory reset.
    expect(page.preBuild().tracks.filter((t) => t.param.owner === label)).toHaveLength(1)
    expect(hidden.has(label)).toBe(true)
  })
})

describe("the draw direction is centre-outward", () => {
  const build = (over: Partial<KeyBuild> = {}): KeyBuild => ({
    id: "x",
    target: "y",
    effect: LINE_DRAW,
    animationType: "In",
    duration: 1,
    delay: 0,
    delivery: "All at Once",
    ...over,
  })

  test("a line stored outer-to-inner draws reversed", () => {
    // Slide 2's eagle line: stored (523,282) -> (777,455) in slide units,
    // i.e. away from the canvas centre first. The footage draws it from
    // the centre out, so the sweep must run against the stored order.
    expect(
      drawsReversed(build(), { start: { x: -400, y: 200 }, end: { x: -150, y: 60 } }, { x: 0, y: 0 }),
    ).toBe(true)
  })

  test("a line stored inner-to-outer draws forward", () => {
    expect(
      drawsReversed(build(), { start: { x: -150, y: 60 }, end: { x: -400, y: 200 } }, { x: 0, y: 0 }),
    ).toBe(false)
  })

  test("all four of slide 2's connection lines draw centre-outward", () => {
    const page = new Slide({ data: slide02 })
    void page.parts
    const d2 = (p: { x: number; y: number }): number => p.x * p.x + p.y * p.y

    const storedOrders: boolean[] = []
    for (const record of slide02.builds.filter((b) => b.effect === LINE_DRAW)) {
      const line = page.buildTargets(record)[0] as DottedLine
      expect(line).toBeInstanceOf(DottedLine)
      void line.parts

      const pts = line.points
      storedOrders.push(d2(pts[0]!) < d2(pts[pts.length - 1]!))

      // The dash the sweep opens with must be the one nearest the page's
      // centre, which after the frame change is the origin — whatever
      // order the deck happened to store the path in.
      // A dash is a Line holding its own two world points; its holon
      // transform stays at the origin, so the geometry is in `points`.
      const where = (d: Line): number => d2(d.points[0]!)

      const anim = page.build(record)
      let firstDash = anim.tracks[0]!
      for (const t of anim.tracks) if (t.relStart < firstDash.relStart) firstDash = t
      const opener = firstDash.param.owner as Line
      const others = line.dashes.filter((d) => d !== opener)
      expect(where(opener)).toBeLessThan(Math.max(...others.map(where)))
    }

    // And the stored order genuinely disagrees with itself across the
    // four — three outer-to-inner, one inner-to-outer — which is why a
    // direction has to be resolved rather than assumed.
    expect(new Set(storedOrders).size).toBe(2)
  })
})

describe("builds reach what actually draws", () => {
  test("a dissolve on a DottedLine drives its DASHES, not the parent", () => {
    const page = new Slide({ data: slide02 })
    void page.parts
    const line = page.strokes.find((s) => s instanceof DottedLine) as DottedLine
    void line.parts
    expect(line.dashes.length).toBeGreaterThan(0)

    // The renderer reads opacity per drawn primitive with no inheritance,
    // so a page hide must touch every dash. If this regresses, four
    // connection lines stay on screen after their slide is cut away.
    const owners = new Set(page.visible(false).tracks.map((t) => t.param.owner))
    for (const dash of line.dashes) expect(owners.has(dash)).toBe(true)
  })

  test("preBuild pushes In targets back to nothing, and leaves Out targets alone", () => {
    const page = new Slide({ data: slide04 })
    void page.parts
    const tracks = page.preBuild().tracks
    // Slide 4 is four In dissolves on four labels.
    expect(tracks.length).toBe(4)
    for (const t of tracks) expect(t.values[0]).toBe(0)

    // Slide 5's three builds are all Out — nothing to pre-hide.
    const out = new Slide({ data: slide05 })
    void out.parts
    expect(out.preBuild().tracks.length).toBe(0)
  })

  test("cutIn lights everything except a pending In target", () => {
    const page = new Slide({ data: slide04 })
    void page.parts
    const lit = new Set(page.cutIn().tracks.map((t) => t.param.owner))
    // The four built labels stay dark…
    for (const record of slide04.builds) {
      for (const target of page.buildTargets(record)) expect(lit.has(target)).toBe(false)
    }
    // …and the shapes, which no build touches, come on.
    expect(lit.size).toBeGreaterThan(0)
  })

  test("a LineDrawForLine target is lit by the cut — its draw front hides it, not its alpha", () => {
    const page = new Slide({ data: slide02 })
    void page.parts
    const lineBuild = slide02.builds.find((b) => b.effect === LINE_DRAW)!
    const line = page.buildTargets(lineBuild)[0] as DottedLine
    void line.parts
    const lit = new Set(page.cutIn().tracks.map((t) => t.param.owner))
    // Every dash is made visible; the draw front is what withholds it.
    for (const dash of line.dashes) expect(lit.has(dash)).toBe(true)
  })
})

describe("missing build targets are reported, not swallowed", () => {
  test("slide 2's five image builds are named", () => {
    const page = new Slide({ data: slide02 })
    void page.parts
    const missing = page.missingBuildTargets().map((b) => b.target).sort()
    // The Vitruvian figure and the four lightning glyphs — TSD.ImageArchive,
    // which the importer skips. A build with nothing to drive must look
    // different from a build that never existed.
    expect(missing).toEqual(["4513444", "5473642", "5473703", "5473765", "5473826"])
  })

  test("slides 3-5 have no missing targets", () => {
    for (const data of [slide03, slide04, slide05]) {
      const page = new Slide({ data })
      void page.parts
      expect(page.missingBuildTargets()).toEqual([])
    }
  })
})

describe("the opening arc's schedule", () => {
  const dream = new Arc01Dream()
  const timeline = dream.build()

  test("every build clip starts at its measured onset, not at the cursor", () => {
    // The bug this pins: builds OVERLAP (the eagle icon starts fading at
    // 4.23 while its line, started at 3.2, is still drawing), and a
    // forward-only cursor pushes each clip to the end of the previous
    // one — measured as a uniform +0.6s lag across all nineteen builds.
    const starts = dream.clips
      .filter((c) => c.duration > 0)
      .map((c) => Number(c.start.toFixed(3)))
      .sort((a, b) => a - b)
    expect(starts).toEqual([
      2.4, 3.2, 4.228, 5.215, 6.233, 7.6, 8.238, 9.2, 10.22, 11.6,
      32, 33.4, 46, 115.85,
    ])
  })

  test("builds sharing an onset are ONE clip, so they run in parallel", () => {
    // Slide 4's four labels arrive together at 46.0 and the footage has
    // settled by 46.6. Played in sequence they would take four seconds.
    const at46 = dream.clips.filter((c) => Math.abs(c.start - 46) < 1e-6 && c.duration > 0)
    expect(at46.length).toBe(1)
    expect(at46[0]!.duration).toBe(1)
    expect(at46[0]!.anim.tracks.length).toBe(4)
  })

  test("a page shows nothing before its cut and everything after", () => {
    const seg4 = dream.pages[2]!
    timeline.apply(40) // inside segment 3
    for (const label of seg4.labels) expect(label.opacity.value).toBe(0)
    timeline.apply(90) // inside segment 4, after its build
    for (const label of seg4.labels) expect(label.opacity.value).toBeGreaterThan(0.99)
  })

  test("slide 5's Out builds run at 115.85, not at its cut-in", () => {
    const page = dream.pages[3]!
    const ring = page.buildTargets(slide05.builds.find((b) => b.id === "5538696")!)[0]!
    // Held through the segment…
    timeline.apply(110)
    expect(ring.opacity.value).toBeGreaterThan(0.99)
    // …and gone after the build. The first reading of this segment put
    // the builds at 98.2, where the incoming Magic Move is still
    // settling; the blue side's own mask holds flat until 115.8.
    timeline.apply(117.5)
    expect(ring.opacity.value).toBeLessThan(0.01)
  })

  test("the timeline covers the arc and stops at its end", () => {
    expect(timeline.duration).toBeGreaterThanOrEqual(134.8)
    expect(timeline.duration).toBeLessThan(140)
  })
})
