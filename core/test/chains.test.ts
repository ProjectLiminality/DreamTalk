/**
 * P-5 tests — the labelled chains, the fills that occlude, and the two
 * claims about the deck this chapter makes against the recon report.
 *
 * The chapter's lesson, stated once: a claim that is only in prose gets
 * believed and inherited. The recon report's "#A9A9A9 dimmed state" was
 * carried into a chapter brief and into P-1's palette section before
 * anyone counted the colours in the file, and there are none. So the
 * refutation is pinned here as arithmetic over the shipped asset
 * modules rather than asserted in a report — if a future decode ever
 * produces a grey, these tests fail rather than the report quietly
 * becoming wrong.
 */

import { describe, expect, test } from "bun:test"
import { Slide, SlideFill, hexToColor } from "../vocabulary/Slides/Slides"
import {
  slide15,
  slide22,
  slide23,
  slide24,
  slide25,
  slide29,
  slide30,
} from "../vocabulary/Slides/assets/pl02/index"
import type { SlideData } from "../src/geometry/keynote"

const CHAPTER: SlideData[] = [slide15, slide22, slide23, slide24, slide25, slide29, slide30]

describe("P-5 — the dimmed palette does not exist", () => {
  /**
   * THE CHAPTER'S FIRST RESULT, and the reason it is not the chapter it
   * was briefed as. The recon report §5 asks for a "Dimmed-state colour
   * #A9A9A9 — needed by slides 15, 29, others; the greying-out of an
   * earlier chain element is a ChangeColor to #A9A9A9, which should join
   * the vocabulary's named colours."
   *
   * Counting instead of believing: the deck's whole palette across
   * these seven slides is white, black, and the two accents, which are
   * `constants.ts`'s BLUE and RED to the byte.
   */
  test("no drawable carries a colour outside the deck's four", () => {
    const PALETTE = new Set(["#ffffff", "#000000", "#00a2ff", "#ff644e"])
    const seen = new Set<string>()
    for (const data of CHAPTER) {
      for (const shape of data.shapes) {
        if (shape.stroke) seen.add(shape.stroke.toLowerCase())
        if (shape.fill) seen.add(shape.fill.toLowerCase())
      }
    }
    expect(seen.size).toBeGreaterThan(0)
    for (const hex of seen) expect(PALETTE.has(hex)).toBe(true)
    // The specific claim, stated as its own assertion so a failure names
    // the thing that was refuted rather than a set difference.
    expect(seen.has("#a9a9a9")).toBe(false)
  })

  /**
   * The other half of the premise. A dimmed state expressed as opacity
   * would show as a fractional `opacity` on some drawable; every one of
   * them is fully opaque, so there is no dimming in that spelling either.
   */
  test("every drawable is fully opaque — no opacity-dimmed variants", () => {
    let n = 0
    for (const data of CHAPTER) {
      for (const shape of data.shapes) {
        expect(shape.opacity ?? 1).toBe(1)
        n++
      }
      for (const text of data.texts) {
        expect(text.opacity ?? 1).toBe(1)
        n++
      }
    }
    expect(n).toBeGreaterThan(100)
  })

  /**
   * And the mechanism. A `ChangeColor` build is what the recon's account
   * requires; the deck declares no such effect anywhere in the chapter.
   * Every build here is one of the two P-3 already implements, which is
   * why this chapter owes no new build type.
   */
  test("every build in the chapter is a dissolve — no ChangeColor", () => {
    const effects = new Set<string>()
    let builds = 0
    for (const data of CHAPTER) {
      for (const build of data.builds) {
        effects.add(build.effect)
        builds++
      }
    }
    expect(builds).toBe(18)
    expect([...effects].sort()).toEqual(["apple:dissolve", "apple:dissolve character"])
  })
})

describe("P-5 — the firing model, settled on deck slide 15", () => {
  /**
   * P-1 recorded the firing model as OPEN: two fields claim to say when
   * a build fires and they disagree deck-wide on 330 chunks. P-4
   * confirmed `automatic` on deck slide 8 (a cascade from one click);
   * P-3 read deck slide 2's seven separated events as fitting
   * `eventTrigger` instead.
   *
   * Deck slide 15 discriminates because it is the only slide in reach
   * carrying BOTH flag values, and this test pins that property — it is
   * the reason the slide can settle anything.
   */
  test("deck slide 15 carries both automatic values, and one eventTrigger", () => {
    const chunks = slide15.buildChunks ?? []
    expect(chunks.length).toBe(9)
    expect(chunks.filter((c) => c.automatic).length).toBe(4)
    expect(chunks.filter((c) => !c.automatic).length).toBe(5)
    // `eventTrigger` is 1 on every build, so it distinguishes nothing
    // among these nine and cannot be the field that carries the firing.
    const triggers = new Set(slide15.builds.map((b) => b.eventTrigger))
    expect([...triggers]).toEqual([1])
  })

  /**
   * THE RULE, against the measured onsets.
   *
   * A chunk marked `automatic: true` fires one DECLARED DURATION after
   * its predecessor; a chunk marked `automatic: false` waits for a
   * click. The nine onsets below were each obtained by inverting the
   * deck's own declared 1.0s smoothstep through that target's own
   * ink-mask ramp in refs/pitch/pl02/frames5, solving only for the
   * offset (P-3's method); every fit's standard deviation is <= 0.030s
   * against the reference's 0.2s frame interval.
   *
   * The separation is total: the four automatic gaps are 0.995, 0.990,
   * 0.992 and 1.008 against a declared 1.0, and the four manual gaps are
   * 2.471, 4.072, 10.879 and 8.773.
   */
  const MEASURED: Record<string, number> = {
    "5286898": 226.310,
    "5161707": 228.781,
    "5291410": 229.776,
    "5286946": 230.766,
    "5068320": 234.838,
    "5161127": 245.717,
    "5161126": 246.709,
    "5287000": 247.717,
    "5071095": 256.490,
  }

  test("an automatic chunk fires one declared duration after its predecessor", () => {
    const chunks = slide15.buildChunks ?? []
    let checked = 0
    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i]!
      if (!chunk.automatic) continue
      const gap = MEASURED[chunk.build]! - MEASURED[chunks[i - 1]!.build]!
      // Within 0.05s of the declared duration — a quarter of the frame
      // interval, so the claim is not resolving finer than the evidence.
      expect(Math.abs(gap - chunk.duration)).toBeLessThan(0.05)
      checked++
    }
    expect(checked).toBe(4)
  })

  test("a manual chunk waits much longer than its duration", () => {
    const chunks = slide15.buildChunks ?? []
    let checked = 0
    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i]!
      if (chunk.automatic) continue
      const gap = MEASURED[chunk.build]! - MEASURED[chunks[i - 1]!.build]!
      // Every manual gap is more than twice the declared duration; the
      // smallest measured is 2.471 against 1.0. The two populations do
      // not overlap, which is what makes the flag readable at all.
      expect(gap).toBeGreaterThan(chunk.duration * 2)
      checked++
    }
    expect(checked).toBe(4)
  })

  /**
   * Chunk order IS firing order, element for element — the property P-1
   * established on the archives and P-4 confirmed on slide 8. It holds
   * here across nine builds spanning thirty seconds, which is a much
   * longer lever than either.
   */
  test("chunk order is the measured firing order", () => {
    const chunks = (slide15.buildChunks ?? []).map((c) => c.build)
    const byOnset = [...chunks].sort((a, b) => MEASURED[a]! - MEASURED[b]!)
    expect(byOnset).toEqual(chunks)
  })

  /**
   * Deck slide 29's three builds are all `automatic: false` and their
   * measured gaps are 2.09 and 2.38 seconds — clicks, exactly as the
   * flag says. A second slide showing the manual branch, so the rule
   * does not rest on one.
   */
  test("deck slide 29's three manual chunks are all clicks", () => {
    const chunks = slide29.buildChunks ?? []
    expect(chunks.length).toBe(3)
    expect(chunks.every((c) => !c.automatic)).toBe(true)
    const measured: Record<string, number> = {
      "5358100": 531.401,
      "5358098": 533.495,
      "5358099": 535.870,
    }
    expect(chunks.map((c) => c.build)).toEqual(["5358100", "5358098", "5358099"])
    for (let i = 1; i < chunks.length; i++) {
      const gap = measured[chunks[i]!.build]! - measured[chunks[i - 1]!.build]!
      expect(gap).toBeGreaterThan(chunks[i]!.duration * 2)
    }
  })

  /**
   * THE EXCEPTION, pinned rather than hidden. On deck slide 25 chunk 4
   * is `automatic: true` and so should fire one second after chunk 3, at
   * ~494.6; it is measured at 490.109, simultaneous with chunk 1. The
   * test asserts the exception exists so that a later chapter cannot
   * read the rule above as unqualified — and so that if a re-measure
   * ever moves it, the change is visible.
   */
  test("deck slide 25 is the rule's one measured exception", () => {
    const chunks = slide25.buildChunks ?? []
    expect(chunks.length).toBe(4)
    const fourth = chunks[3]!
    expect(fourth.automatic).toBe(true)
    const measured: Record<string, number> = {
      "4707179": 490.108,
      "4709394": 490.115,
      "4707194": 493.624,
      "4706910": 490.109,
    }
    const gap = measured[fourth.build]! - measured[chunks[2]!.build]!
    // Negative: it fires BEFORE the chunk it follows in the list.
    expect(gap).toBeLessThan(0)
  })
})

describe("P-5 — opaque fills occlude", () => {
  /**
   * The capability this chapter had to add. 413 of the deck's drawables
   * carry a flat fill, and on a black stage a black fill paints nothing
   * of its own — its whole visible effect is to hide what is behind it.
   */
  test("the chapter's slides carry the fills that do the occluding", () => {
    const filled = CHAPTER.flatMap((d) => d.shapes.filter((s) => s.fill))
    expect(filled.length).toBe(22)
    // Twenty-one black occluders and one white notebook.
    expect(filled.filter((s) => s.fill === "#000000").length).toBe(21)
    expect(filled.filter((s) => s.fill === "#ffffff").length).toBe(1)
  })

  /**
   * A filled shape composes a `SlideFill` ALONGSIDE its outline, not
   * instead of it. The two carry different colours — a white-stroked,
   * black-filled head is the deck's common case — which is the whole
   * reason the interior is a holon of its own.
   */
  test("a black-filled head composes a fill and keeps its white stroke", () => {
    const page = new Slide({ data: slide24 })
    void page.parts
    const parts = page.byId.get("5314453")
    expect(parts).toBeDefined()
    const fills = parts!.filter((p) => p instanceof SlideFill)
    expect(fills.length).toBe(1)
    expect((fills[0] as SlideFill).tint.value).toEqual(hexToColor("#000000"))
    // The outline is still there, and it is white.
    const strokes = parts!.filter((p) => !(p instanceof SlideFill))
    expect(strokes.length).toBeGreaterThan(0)
  })

  /**
   * THE HOLE. `Notebook_109` on deck slide 24 is ONE white-filled
   * drawable of two closed subpaths — an outer laptop silhouette and an
   * inner screen rectangle — and the reference draws a white frame
   * around a BLACK screen (f_02351). The interior is therefore even-odd
   * across both loops, which is what a parent holon with one closed
   * `Line` child per subpath gets from the host; filling each loop on
   * its own paints a solid white slab.
   */
  test("the notebook's two subpaths become one even-odd fill, not two", () => {
    const shape = slide24.shapes.find((s) => s.id === "5315089")!
    expect(shape.fill).toBe("#ffffff")
    expect(shape.subpaths.length).toBe(2)
    expect(shape.closed).toEqual([1, 1])
    const page = new Slide({ data: slide24 })
    void page.parts
    const fills = page.byId.get("5315089")!.filter((p) => p instanceof SlideFill)
    // ONE fill holon carrying BOTH loops — not two fills.
    expect(fills.length).toBe(1)
    const fill = fills[0] as SlideFill
    expect(fill.loops.length).toBe(2)
  })

  /**
   * Every loop a `SlideFill` carries must close on itself, because the
   * host reads a drawing's interior only from closed children — an open
   * loop silently contributes nothing and the fill would be wrong in a
   * way no frame shows directly.
   */
  test("every composed fill loop closes on itself", () => {
    for (const data of CHAPTER) {
      const page = new Slide({ data })
      void page.parts
      for (const parts of page.byId.values()) {
        for (const part of parts) {
          if (!(part instanceof SlideFill)) continue
          for (const loop of part.loops) {
            expect(loop.length).toBeGreaterThanOrEqual(4)
            const first = loop[0]!
            const last = loop[loop.length - 1]!
            expect(Math.hypot(last.x - first.x, last.y - first.y)).toBeLessThan(1e-6)
          }
        }
      }
    }
  })

  /**
   * The head silhouette is CONCAVE — a ray from its centre can cross its
   * outline more than once — which is why the interior needs even-odd
   * triangulation rather than the centroid fan the host's single-Line
   * wash path uses. Pinned because it is the geometric fact the whole
   * construction rests on, and it is not obvious from the data.
   */
  test("a head icon's outline is concave, so a fan would be wrong", () => {
    const shape = slide24.shapes.find((s) => s.id === "5314453")!
    const flat = shape.subpaths[0]!
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ x: flat[i]!, y: flat[i + 1]! })
    const signs = new Set<boolean>()
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!
      const b = pts[(i + 1) % pts.length]!
      const c = pts[(i + 2) % pts.length]!
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
      if (Math.abs(cross) > 1e-6) signs.add(cross > 0)
    }
    expect(signs.size).toBe(2)
  })

  /**
   * Deck slide 23 stacks TWO copies of one composition, and the upper
   * copy's black-filled heads are what hide the lower copy's inner
   * circle and rectangle. Nothing marks the lower copy hidden — both are
   * live drawables at opacity 1.0 — so this is pinned as the reason the
   * fill is load-bearing rather than cosmetic.
   */
  test("deck slide 23's two stacked copies are both live", () => {
    const lower = slide23.shapes.filter((s) => s.id.startsWith("5313"))
    const upper = slide23.shapes.filter((s) => s.id.startsWith("5315"))
    expect(lower.length).toBe(7)
    expect(upper.length).toBe(5)
    for (const shape of [...lower, ...upper]) expect(shape.opacity ?? 1).toBe(1)
    // The upper copy's heads are the occluders, and they come LATER in
    // the deck's own z-order — which is the composition order, so the
    // stacking reproduces by construction.
    const ids = slide23.shapes.map((s) => s.id)
    expect(ids.indexOf("5315457")).toBeGreaterThan(ids.indexOf("5313778"))
    expect(slide23.shapes.find((s) => s.id === "5315457")!.fill).toBe("#000000")
    // And the shapes the lower copy contributes that the upper does not
    // cover with a stroke of its own: the blue circle and the red box
    // inside the two heads.
    expect(slide23.shapes.find((s) => s.id === "5313777")!.stroke).toBe("#00a2ff")
    expect(slide23.shapes.find((s) => s.id === "5313755")!.stroke).toBe("#ff644e")
  })
})

describe("P-5 — the chapter's pages compose", () => {
  test("every build in the chapter finds its target", () => {
    for (const data of CHAPTER) {
      const page = new Slide({ data })
      void page.parts
      expect(page.missingBuildTargets()).toEqual([])
    }
  })

  test("no build in the chapter is unsupported", () => {
    for (const data of CHAPTER) {
      const page = new Slide({ data })
      void page.parts
      expect(page.unsupported()).toEqual([])
    }
  })

  /**
   * The chapter's connection lines all recompute from their endpoints —
   * none falls through to a stored path, which P-4 established is stale
   * a quarter of the time.
   */
  test("no connection line falls through to a stored path", () => {
    for (const data of CHAPTER) {
      const page = new Slide({ data })
      void page.parts
      expect(page.stalePaths()).toEqual([])
    }
  })

  /**
   * The two chain slides are the same tableau 280 seconds apart, and
   * deck 30 adds exactly one thing: the red box around "non-local". Its
   * single build is that box. Pinned because it makes the pair a check
   * that the geometry is stable across a re-entry rather than tuned per
   * segment.
   */
  test("deck 30 is deck 15's tableau plus one red box", () => {
    expect(slide30.builds.length).toBe(1)
    const target = slide30.builds[0]!.target
    const box = slide30.shapes.find((s) => s.id === target)
    expect(box).toBeDefined()
    expect(box!.stroke).toBe("#ff644e")
    const texts15 = slide15.texts.map((t) => t.content).sort()
    const texts30 = slide30.texts.map((t) => t.content).sort()
    expect(texts30).toEqual(texts15)
  })
})
