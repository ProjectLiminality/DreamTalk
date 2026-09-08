/**
 * P-9's findings, pinned.
 *
 * Each test guards a claim the chapter's report makes about the DECK,
 * so that a re-emission of the slide modules, or a future edit to the
 * decoder, cannot quietly invalidate the prose. Nothing here scores a
 * frame — the fidelity numbers live in the gauntlet's summaries.
 */

import { describe, expect, test } from "bun:test"
import {
  slide16,
  slide17,
  slide18,
  slide59,
} from "../vocabulary/Slides/assets/pl02/index"
import { ACTION_SCALE_D17, DECK59_EDIT_OFFSET } from "../demo/pl02/SetPieces"
import { Slide } from "../vocabulary/Slides/Slides"

describe("P-9 — the deck's last slide exists", () => {
  // The decoder used to cut at slide_ids[:58] on the reasoning that
  // "only slides 1-58 are in the video". P-1's own +1 correction makes
  // that off by one: 58 SEGMENTS run deck 1..59, because deck 18 is real.
  // Deck 59 is the recon's row 58 — "Liminal Flow, 34 builds".
  test("deck 59 is emitted, and it is the 34-build slide", () => {
    expect(slide59.index).toBe(59)
    expect(slide59.builds.length).toBe(34)
    expect(slide59.transition?.effect).toBe("none")
  })

  test("its cascade is 33 automatic chunks between two manual ones", () => {
    const chunks = slide59.buildChunks ?? []
    expect(chunks.length).toBe(34)
    expect(chunks[0]!.automatic).toBe(false)
    expect(chunks[33]!.automatic).toBe(false)
    for (let i = 1; i <= 32; i++) expect(chunks[i]!.automatic).toBe(true)
  })

  // The interleaving is what makes deck 59 the discriminator for the
  // firing model: if chunks fired in same-effect GROUPS, this slide
  // would show a dozen small firings rather than 33 in order.
  test("its chunks interleave two effects rather than running in blocks", () => {
    const chunks = slide59.buildChunks ?? []
    const effects = chunks.slice(0, 33).map((c) => {
      const b = slide59.builds.find((x) => x.id === c.build)
      return b?.effect ?? "?"
    })
    let alternations = 0
    for (let i = 1; i < effects.length; i++) {
      if (effects[i] !== effects[i - 1]) alternations++
    }
    // A grouped reading would give a handful; the deck gives many.
    expect(alternations).toBeGreaterThan(10)
  })
})

describe("P-9 — deck 16's declared builds overstate the video", () => {
  // Fifty chunks: one manual, forty-nine automatic. The last twenty-four
  // are `Out` builds that fade every head and spoke away — and the
  // footage never reaches them, because the outgoing click truncates the
  // cascade. The settled frame f_01392 has all twelve heads present.
  test("half of deck 16's builds are Outs that undo the other half", () => {
    const ins = slide16.builds.filter((b) => b.animationType === "In")
    const outs = slide16.builds.filter((b) => b.animationType === "Out")
    expect(ins.length).toBe(26)
    expect(outs.length).toBe(24)
    // Every Out targets something an In already brought on.
    const inTargets = new Set(ins.map((b) => b.target))
    for (const out of outs) expect(inTargets.has(out.target)).toBe(true)
  })

  test("chunk 0 is the only manual one", () => {
    const chunks = slide16.buildChunks ?? []
    expect(chunks.length).toBe(50)
    expect(chunks[0]!.automatic).toBe(false)
    expect(chunks.slice(1).every((c) => c.automatic === true)).toBe(true)
  })
})

describe("P-9 — deck 17's action-scale and its declared travels", () => {
  // The six motion paths are READ, not fitted: each declares its full
  // translation, one per compass point.
  test("six motion paths, each declaring a travel", () => {
    const paths = slide17.builds.filter((b) => b.effect === "apple:action-motion-path")
    expect(paths.length).toBe(6)
    for (const p of paths) {
      const els = (p as { motionPath?: readonly unknown[] }).motionPath
      expect(els).toBeDefined()
      expect(els!.length).toBeGreaterThan(0)
    }
  })

  // The scale declares NO factor — which is the whole reason P-4, P-7
  // and P-8 had to treat this build class the way they did.
  test("the action-scale declares a duration and an ease but no factor", () => {
    const scale = slide17.builds.find((b) => b.effect === "apple:action-scale")
    expect(scale).toBeDefined()
    expect(scale!.id).toBe("4579766")
    expect(scale!.duration).toBe(1)
    expect(scale!.acceleration).toBe("kEaseBoth")
    expect((scale as unknown as Record<string, unknown>).factor).toBeUndefined()
  })

  // The START size is declared, which is what makes the factor
  // measurable rather than fitted: only one number is free.
  test("the scaled group's declared box is 292.5 slide units", () => {
    const group = slide17.groups.find((g) => g.id === "4567058")
    expect(group).toBeDefined()
    expect(group!.members.length).toBe(26)
    let x0 = Infinity
    let x1 = -Infinity
    for (const id of group!.members) {
      const shape = slide17.shapes.find((s) => s.id === id)
      if (!shape) continue
      for (const sub of shape.subpaths) {
        for (let i = 0; i + 1 < sub.length; i += 2) {
          x0 = Math.min(x0, sub[i]!)
          x1 = Math.max(x1, sub[i]!)
        }
      }
    }
    expect(x1 - x0).toBeCloseTo(292.5, 0)
  })

  test("the measured factor is the one the scene fires", () => {
    expect(ACTION_SCALE_D17).toBeCloseTo(3.0932, 4)
  })
})

describe("P-9 — the boundary correction: deck 17 cannot draw deck 18's tableau", () => {
  // The proof that the three-tower tableau at 293.8-362.0 belongs to
  // deck 18 and not to deck 17 is GEOMETRIC, not correlational: deck
  // 17's shapes do not reach where the footage puts the outer towers.
  const spanX = (data: typeof slide17): [number, number] => {
    let x0 = Infinity
    let x1 = -Infinity
    for (const s of data.shapes) {
      for (const sub of s.subpaths) {
        for (let i = 0; i + 1 < sub.length; i += 2) {
          x0 = Math.min(x0, sub[i]!)
          x1 = Math.max(x1, sub[i]!)
        }
      }
    }
    return [x0, x1]
  }

  test("deck 18 reaches the outer towers and deck 17 does not", () => {
    const [a0, a1] = spanX(slide17)
    const [b0, b1] = spanX(slide18)
    // In video px (x 2/3): deck 17 spans 329.7..950.4, deck 18 spans
    // 234.9..1045.1. The footage puts the left outer tower's ink at
    // x ~= 235 and the right at ~= 1040 — outside deck 17 on BOTH
    // sides, which is why the three-tower tableau cannot be deck 17's
    // and why the segment boundary is 292.0 rather than 344.8.
    expect(a0 * (2 / 3)).toBeCloseTo(329.7, 0)
    expect(a1 * (2 / 3)).toBeCloseTo(950.4, 0)
    expect(b0 * (2 / 3)).toBeLessThan(a0 * (2 / 3) - 90)
    expect(b1 * (2 / 3)).toBeGreaterThan(a1 * (2 / 3) + 90)
  })

  // Deck 18 is the slide with no thumbnail — the one that shifted every
  // recon index from 18 on. Its five builds are what the chapter times.
  test("deck 18 carries the mass-hypnosis pair and a FadeThruColor", () => {
    const texts = slide18.texts.map((t) => t.content)
    expect(texts).toContain("mass-hypnosis")
    // The trailing space is the deck's, not a typo.
    expect(texts).toContain("mass-psychosis ")
    expect(slide18.transition?.effect).toBe("com.apple.iWork.Keynote.BLTFadeThruColor")
    expect(slide18.transition?.duration).toBe(1.5)
    expect(slide18.builds.length).toBe(5)
  })
})

describe("P-9 — the images arrive as traced strokes, not as a ceiling", () => {
  // `TSD.ImageArchive.tracedPath` is Keynote's own vectorization. Four
  // lightning glyphs on deck 17 and two on deck 18 now draw as ordinary
  // shapes, which is what lifted decks 2/3/17/18 off their coverage_ref
  // ceiling.
  test("deck 17's four images and deck 18's two draw", () => {
    expect(slide17.images?.length ?? 0).toBe(4)
    expect(slide18.images?.length ?? 0).toBe(2)
    for (const img of slide17.images ?? []) {
      expect(slide17.shapes.some((s) => s.id === img.id)).toBe(true)
    }
    for (const img of slide18.images ?? []) {
      expect(slide18.shapes.some((s) => s.id === img.id)).toBe(true)
    }
  })

  test("the lightning glyph is a closed polygon, not a box", () => {
    const bolt = slide18.shapes.find((s) => s.id === (slide18.images ?? [])[0]?.id)
    expect(bolt).toBeDefined()
    expect(bolt!.subpaths.length).toBe(1)
    // A rectangle would be five points; the trace is far richer.
    expect(bolt!.subpaths[0]!.length / 2).toBeGreaterThan(20)
    expect(bolt!.closed?.[0]).toBe(1)
  })
})

describe("P-9 — deck 59 disagrees with its own footage, and it is the deck that moved", () => {
  // Recorded, NOT applied. See the SetPieces header: applying it would
  // be fitting geometry to the footage, which the campaign forbids.
  test("the edit offset is carried but the scene does not use it", () => {
    expect(DECK59_EDIT_OFFSET).toBeCloseTo(141.56, 2)
  })

  // The three strings the footage shows are in NO slide of the deck.
  // Guarded here so that a future re-emission which "finds" them is
  // treated as the surprise it would be.
  test("deck 59 carries none of the three labels the video draws", () => {
    const texts = slide59.texts.map((t) => t.content).join(" ")
    expect(texts).not.toContain("Liminal Flow")
    expect(texts).not.toContain("Collective")
    expect(texts).not.toContain("Syntropy")
  })

  // The horizon rectangle is the landmark the offset was measured on:
  // declared top edge y = 433.039 slide units = 288.7 video px, where
  // the footage holds it at 194 for the whole segment.
  test("the horizon's declared top edge is 94 video px below the footage", () => {
    let y0 = Infinity
    for (const s of slide59.shapes) {
      let lo = Infinity
      let hi = -Infinity
      for (const sub of s.subpaths) {
        for (let i = 1; i < sub.length; i += 2) {
          lo = Math.min(lo, sub[i]!)
          hi = Math.max(hi, sub[i]!)
        }
      }
      // the horizon is the full-width rectangle
      if (hi - lo > 800) y0 = Math.min(y0, lo)
    }
    expect(y0 * (2 / 3)).toBeCloseTo(288.7, 0)
    expect(y0 * (2 / 3) - DECK59_EDIT_OFFSET * (2 / 3)).toBeCloseTo(194.0, 0)
  })
})

describe("P-9 — a group scale reaches its members", () => {
  // The trap this test exists for: routing a group's action-scale
  // through the adopting `Group` holon looks obviously right and scales
  // NOTHING, because that holon's members are already the Slide's own
  // parts. `Slide` bakes geometry into points and leaves every holon at
  // the origin, so the member-wise flattening IS the scale about one
  // centre.
  test("buildTargets flattens the scale onto every drawable", () => {
    const page = new Slide({ data: slide17, scaleFactors: { "4579766": ACTION_SCALE_D17 } })
    void page.parts
    const record = slide17.builds.find((b) => b.id === "4579766")!
    const targets = page.buildTargets(record)
    expect(targets.length).toBeGreaterThan(20)
    for (const t of targets) {
      expect(t.x.value).toBeCloseTo(0, 6)
      expect(t.y.value).toBeCloseTo(0, 6)
    }
    expect(page.build(record).tracks.length).toBe(targets.length)
  })

  test("an unmeasured scale still contributes nothing", () => {
    const page = new Slide({ data: slide17 })
    void page.parts
    const record = slide17.builds.find((b) => b.id === "4579766")!
    expect(page.build(record).tracks.length).toBe(0)
  })
})
