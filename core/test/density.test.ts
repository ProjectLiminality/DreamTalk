/**
 * P-10 — the density peak, and the firing model it settled.
 *
 * Deck slide 11 is the campaign's discriminator for how a Keynote build
 * chunk fires, because it is the only slide carrying BOTH automatic
 * cases under otherwise identical declarations: same `automatic: true`,
 * same `chunkId`, same slide, one click each. The only field that
 * differs between its 35 stepping dissolves and its 70 simultaneous
 * line-draws is `referent`.
 *
 * These tests pin three separable things:
 *
 *   1. the CENSUS — the structural facts the chapter read off the deck,
 *      so a regenerated module that changed any of them fails loudly;
 *   2. the RULE — `firingTimes`, against the arithmetic the footage
 *      measured, including the two cases that would look identical if
 *      the rule were wrong in the obvious way;
 *   3. the MEASUREMENTS — the numbers that came from the frames, kept
 *      here as the record of what was measured rather than as inputs.
 *
 * The rule is tested on SYNTHETIC chunk lists as well as the deck's,
 * because deck 11's own list has a convenient shape (one long run of
 * each case) that could hide an off-by-one a mixed list would catch.
 */

import { describe, expect, test } from "bun:test"
import { firingTimes, SCORED } from "../demo/pl02/Density01"
import type { KeyBuildChunk } from "../src/geometry/keynote"
import { slide09, slide11, slide12, slide13 } from "../vocabulary/Slides/assets/pl02/index"
import { Slide } from "../vocabulary/Slides/Slides"

/** A chunk, with only the fields the firing model reads. */
const chunk = (
  build: string,
  duration: number,
  automatic: boolean,
  referent: boolean,
): KeyBuildChunk => ({ build, duration, delay: 0, automatic, referent, chunkId: 1 })

describe("deck 11 — the census the chapter's reading rests on", () => {
  test("105 builds in 105 chunks, two of them clicks", () => {
    expect(slide11.builds.length).toBe(105)
    expect(slide11.buildChunks?.length).toBe(105)
    const clicks = (slide11.buildChunks ?? [])
      .map((c, i) => (c.automatic ? -1 : i))
      .filter((i) => i >= 0)
    expect(clicks).toEqual([0, 35])
  })

  test("the two cascades split exactly on `referent`", () => {
    const chunks = slide11.buildChunks ?? []
    const byId = new Map(slide11.builds.map((b) => [b.id, b]))
    // chunks 0-34 are the dissolves and every one is referent: true
    for (let i = 0; i < 35; i++) {
      expect(byId.get(chunks[i]!.build)?.effect).toBe("apple:dissolve")
      expect(chunks[i]!.referent).toBe(true)
    }
    // chunks 35-104 are the line draws: the click, then 69 followers
    for (let i = 35; i < 105; i++) {
      expect(byId.get(chunks[i]!.build)?.effect).toBe(
        "com.apple.iWork.Keynote.LineDrawForLine",
      )
      expect(chunks[i]!.referent).toBe(i === 35)
    }
  })

  test("70 connection lines, every one quadratic with a simple-arrow head", () => {
    const conns = slide11.shapes.filter((s) => s.isConnectionLine)
    expect(conns.length).toBe(70)
    for (const c of conns) {
      expect(c.lineType).toBe("kTSDConnectionLineTypeQuadratic")
      expect(c.lineEnds?.head?.identifier).toBe("simple arrow")
      expect(c.lineEnds?.head?.isFilled).toBe(true)
      // P-4's dispatch is built for tails and filled circles; deck 11
      // uses neither, and this records that so a renderer that stopped
      // handling them would not be caught HERE and must be caught there.
      expect(c.lineEnds?.tail).toBeUndefined()
    }
  })

  test("all 70 outsets are 10/10 — the value P-4 corrected P-1's claim to", () => {
    const conns = slide11.shapes.filter((s) => s.isConnectionLine)
    for (const c of conns) expect(c.outset).toEqual({ from: 10, to: 10 })
  })

  test("no build declares a `direction`, so all 70 take the absent default", () => {
    for (const b of slide11.builds) {
      expect((b as { direction?: number }).direction).toBeUndefined()
    }
  })

  test("35 top-level groups, each a node, and every build target resolves", () => {
    const shapeIds = new Set(slide11.shapes.map((s) => s.id))
    const groupIds = new Set((slide11.groups ?? []).map((g) => g.id))
    const nested = new Set<string>()
    for (const g of slide11.groups ?? []) for (const m of g.members) nested.add(m)
    const tops = [...groupIds].filter((id) => !nested.has(id))
    expect(tops.length).toBe(35)
    for (const b of slide11.builds) {
      expect(shapeIds.has(b.target) || groupIds.has(b.target)).toBe(true)
    }
  })

  test("the 70 lines join 35 distinct endpoints, all of them groups", () => {
    const groupIds = new Set((slide11.groups ?? []).map((g) => g.id))
    const ends = new Set<string>()
    for (const c of slide11.shapes.filter((s) => s.isConnectionLine)) {
      // Both endpoints are optional in the model — 31 of the 489
      // in-scope lines declare neither — so that all 70 of deck 11's
      // resolve is a claim, and it is the claim P-4's recompute rule
      // needs: zero of them fall through to a stored path.
      const from = c.connects?.from
      const to = c.connects?.to
      expect(from).toBeDefined()
      expect(to).toBeDefined()
      if (!from || !to) continue
      ends.add(from)
      ends.add(to)
    }
    expect(ends.size).toBe(35)
    for (const e of ends) expect(groupIds.has(e)).toBe(true)
  })
})

describe("the firing model — `referent` read with `automatic`", () => {
  test("a run of referent:true chunks steps by each declared duration", () => {
    const chunks = [
      chunk("a", 0.3, false, true),
      chunk("b", 0.3, true, true),
      chunk("c", 0.3, true, true),
      chunk("d", 0.3, true, true),
    ]
    const at = firingTimes(chunks, [{ chunk: 0, at: 100 }])
    expect(at.get("a")).toBeCloseTo(100.0, 6)
    expect(at.get("b")).toBeCloseTo(100.3, 6)
    expect(at.get("c")).toBeCloseTo(100.6, 6)
    expect(at.get("d")).toBeCloseTo(100.9, 6)
  })

  test("a run of referent:false chunks all fires at the referent's instant", () => {
    const chunks = [
      chunk("a", 2.25, false, true),
      chunk("b", 2.25, true, false),
      chunk("c", 2.25, true, false),
      chunk("d", 2.25, true, false),
    ]
    const at = firingTimes(chunks, [{ chunk: 0, at: 210.2 }])
    for (const id of ["a", "b", "c", "d"]) {
      expect(at.get(id)).toBeCloseTo(210.2, 6)
    }
  })

  test("followers do not advance the clock for a later step", () => {
    // THE OFF-BY-ONE THIS FILE EXISTS FOR. If a `referent: false` chunk
    // updated the running time (or its duration), the step after a run
    // of followers would measure from the LAST follower rather than from
    // the referent they all share — which on deck 16's shape is the
    // difference between one 2.0s step and twelve of them.
    const chunks = [
      chunk("click", 2.0, false, true),
      chunk("with1", 2.0, true, false),
      chunk("with2", 2.0, true, false),
      chunk("step", 2.0, true, true),
    ]
    const at = firingTimes(chunks, [{ chunk: 0, at: 0 }])
    expect(at.get("click")).toBeCloseTo(0, 6)
    expect(at.get("with1")).toBeCloseTo(0, 6)
    expect(at.get("with2")).toBeCloseTo(0, 6)
    expect(at.get("step")).toBeCloseTo(2.0, 6)
  })

  test("deck 11: the 35 nodes step 0.30s apart, spanning the measured 10.2s", () => {
    const at = firingTimes(slide11.buildChunks ?? [], [
      { chunk: 0, at: 199.4 },
      { chunk: 35, at: 210.2 },
    ])
    const chunks = slide11.buildChunks ?? []
    const nodes = chunks.slice(0, 35).map((c) => at.get(c.build)!)
    expect(nodes[0]).toBeCloseTo(199.4, 6)
    expect(nodes[34]).toBeCloseTo(209.6, 6)
    // MEASURED, per node, from the footage: 199.40 .. 209.60, and a
    // least-squares step of 0.3000 against a declared 0.30 (ratio
    // 1.0000, residual sd 0.050s — a quarter of one frame interval).
    expect(nodes[34]! - nodes[0]!).toBeCloseTo(10.2, 6)
    for (let i = 1; i < 35; i++) {
      expect(nodes[i]! - nodes[i - 1]!).toBeCloseTo(0.3, 6)
    }
  })

  test("deck 11: all 70 lines fire at one instant, not over 157 seconds", () => {
    const at = firingTimes(slide11.buildChunks ?? [], [
      { chunk: 0, at: 199.4 },
      { chunk: 35, at: 210.2 },
    ])
    const chunks = slide11.buildChunks ?? []
    const lines = chunks.slice(35).map((c) => at.get(c.build)!)
    expect(lines.length).toBe(70)
    for (const t of lines) expect(t).toBeCloseTo(210.2, 6)
    // The reading this refutes: 69 steps of 2.25s is 155.25s, which
    // would put the last line at 365.45 — a hundred and fifty seconds
    // after the segment ends, on a slide whose lines are all visibly
    // drawn by t=212.6. MEASURED: the 70 onsets span 211.20-211.60, a
    // least-squares step of 0.0007s against the declared 2.25.
    expect(Math.max(...lines) - Math.min(...lines)).toBe(0)
  })

  test("the cascade fits the segment, where a step-every-time rule cannot", () => {
    const at = firingTimes(slide11.buildChunks ?? [], [
      { chunk: 0, at: 199.4 },
      { chunk: 35, at: 210.2 },
    ])
    const last = Math.max(...[...at.values()])
    const declared = slide11.buildChunks!.at(-1)!.duration
    // The whole slide, last build included, is over well inside the
    // segment's own end (deck 11's last held frame is 213.4).
    expect(last + declared).toBeLessThan(213.5)
  })
})

describe("decks 12 and 13 — held tableaux, and the organism dividing", () => {
  test("neither slide has a single build", () => {
    expect(slide12.builds.length).toBe(0)
    expect(slide13.builds.length).toBe(0)
    expect(slide12.buildChunks?.length ?? 0).toBe(0)
    expect(slide13.buildChunks?.length ?? 0).toBe(0)
  })

  test("both carry two K6 meshes: 30 dotted lines over 12 heads", () => {
    for (const s of [slide12, slide13]) {
      const conns = s.shapes.filter((c) => c.isConnectionLine)
      expect(conns.length).toBe(30)
      for (const c of conns) {
        expect(c.dash).toEqual([0.001, 2])
        // P-1's round-cap finding: the 0.001 dash is only visible AT ALL
        // under a round cap, and it is what makes the period derivable.
        expect(c.cap).toBe("RoundCap")
      }
      expect(s.shapes.filter((x) => x.icon === "Head with Shoulders_826").length).toBe(12)
    }
  })

  test("deck 12's two meshes are SUPERIMPOSED — six positions, twice each", () => {
    // This is what makes the run of slides read as one organism DIVIDING
    // rather than as two organisms drifting: deck 12 draws them on top of
    // one another, and the Magic Moves pull them apart. Checked as head
    // centres rather than by eye.
    const centres = slide12.shapes
      .filter((s) => s.icon === "Head with Shoulders_826")
      .map((s) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
        for (const sp of s.subpaths)
          for (let i = 0; i < sp.length; i += 2) {
            x0 = Math.min(x0, sp[i]!); x1 = Math.max(x1, sp[i]!)
            y0 = Math.min(y0, sp[i + 1]!); y1 = Math.max(y1, sp[i + 1]!)
          }
        return `${((x0 + x1) / 2).toFixed(1)},${((y0 + y1) / 2).toFixed(1)}`
      })
    expect(centres.length).toBe(12)
    expect(new Set(centres).size).toBe(6)
  })

  test("deck 13's meshes are NOT superimposed — twelve distinct positions", () => {
    const centres = slide13.shapes
      .filter((s) => s.icon === "Head with Shoulders_826")
      .map((s) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
        for (const sp of s.subpaths)
          for (let i = 0; i < sp.length; i += 2) {
            x0 = Math.min(x0, sp[i]!); x1 = Math.max(x1, sp[i]!)
            y0 = Math.min(y0, sp[i + 1]!); y1 = Math.max(y1, sp[i + 1]!)
          }
        return `${((x0 + x1) / 2).toFixed(1)},${((y0 + y1) / 2).toFixed(1)}`
      })
    // Ten distinct: the two meshes share their two inner columns, which
    // is the intermediate state between deck 12's full overlap and deck
    // 14's full separation.
    expect(new Set(centres).size).toBeGreaterThan(6)
  })
})

describe("the draw-direction flag", () => {
  test("it is off by default, so no other chapter's slides move", () => {
    expect(new Slide({ data: slide11 }).drawsInStoredOrder).toBe(false)
    expect(new Slide({ data: slide09 }).drawsInStoredOrder).toBe(false)
  })

  test("deck 11 has no declared direction for it to override", () => {
    // The flag replaces the page-centre FALLBACK only. If a future
    // regeneration gave these builds a `direction`, that would win and
    // this chapter's reading would be superseded by a read value — which
    // is the right outcome, and this test is what would surface it.
    const withDirection = slide11.builds.filter(
      (b) => (b as { direction?: number }).direction !== undefined,
    )
    expect(withDirection.length).toBe(0)
  })
})

describe("what P-10 scored", () => {
  test("the scored set covers both firing cases mid-flight", () => {
    // A settled frame cannot tell a stepping cascade from a simultaneous
    // one — both end in the same tableau. The chapter's claim rests on
    // the two mid-flight frames, and this pins that they are in the set.
    const times = SCORED.map((s) => s.at)
    expect(times).toContain(205.8) // 26 of 35 nodes — mid-STEP
    expect(times).toContain(211.2) // 70 lines together — mid-DRAW
    expect(SCORED.some((s) => s.seg === 12)).toBe(true)
    expect(SCORED.some((s) => s.seg === 13)).toBe(true)
  })
})
