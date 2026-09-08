import { describe, expect, test } from "bun:test"
import type { Dream } from "../src/dream"
import type { Holon } from "../src/holon"
import type { ParamValue } from "../src/params"
import {
  BOUNDARIES,
  PL02_DURATION,
  ProjectLiminalityDream,
} from "../demo/pl02/ProjectLiminality"
import { Arc01Dream } from "../demo/pl02/Arc01"
import { Mesh01Dream } from "../demo/pl02/Mesh01"
import { Density01Dream } from "../demo/pl02/Density01"
import { Chain01Dream } from "../demo/pl02/Chain01"
import { SetPiecesDream } from "../demo/pl02/SetPieces"
import { Web01Dream } from "../demo/pl02/Web01"
import { Fractal01Dream } from "../demo/pl02/Fractal01"

/**
 * The PL02 song's BOUNDARY TABLE and its COMPOSITION INVISIBILITY — the
 * two things assembling a film can get wrong that no chapter's own
 * gauntlet would catch.
 *
 * THE SONG IS NOT A `DreamSong`, AND THAT CHANGES WHAT MUST BE PROVEN.
 *
 * ORIGINS' chapters run on local clocks and the song places each at an
 * offset, so its test proves "chapter in song at V == chapter standalone
 * at V − t0" — an alignment claim, true only to 1e-9 because shifting a
 * clip's start is float arithmetic.
 *
 * Every PL02 chapter already runs on the VIDEO's clock (P-3's
 * convention, kept by all seven), so the song borrows their clips at
 * offset ZERO. There is no shift, so there is no float slack, and the
 * property is the stronger one: a chapter's state in the song must be
 * EXACTLY its standalone state at the SAME time. That is asserted with
 * `toEqual` rather than a tolerance, and if it ever needs a tolerance
 * the composition has stopped being invisible.
 */

/** The seven chapters, and the decks each one builds. */
const CHAPTERS = [
  ["Arc01", Arc01Dream, [2, 3, 4, 5, 6]],
  ["Mesh01", Mesh01Dream, [7, 8, 9, 14]],
  ["Density01", Density01Dream, [11, 12, 13]],
  ["Chain01", Chain01Dream, [15, 22, 23, 24, 25, 29, 30]],
  ["SetPieces", SetPiecesDream, [16, 17, 18, 59]],
  ["Web01", Web01Dream, [45, 46, 47, 48, 49, 50, 51, 52, 53]],
  ["Fractal01", Fractal01Dream, [43, 44, 54, 55, 56, 57, 58]],
] as const

/**
 * The video's own boundaries, RESTATED here rather than imported, so
 * this test fails if ProjectLiminality.ts's table is edited: a
 * transcription shared with the thing it tests would prove nothing.
 *
 * `[deck, t0]`, 60 rows, the last being the closing return to deck 1.
 * The six corrected rows are marked with the chapter that measured them.
 */
const TABLE: readonly (readonly [number, number])[] = [
  [1, 0.0],
  [2, 0.6],
  [3, 20.2],
  [4, 45.8],
  [5, 98.0],
  [6, 119.4],
  [7, 134.8],
  [8, 162.8],
  [9, 171.2],
  [10, 193.8],
  [11, 199.4],
  [12, 214.4],
  [13, 216.4], // P-6's MagicMove01 measured this glide's onset; recon 217.0
  [14, 219.4],
  [15, 225.2], // P-5
  [16, 262.2], // P-5
  [17, 279.4],
  [18, 292.0], // P-9 — the recon's 82.6s "segment 17" is two slides
  [19, 362.0],
  [20, 369.4],
  [21, 375.2],
  [22, 428.2],
  [23, 445.8],
  [24, 452.0],
  [25, 490.2], // P-5's own onsets (490.108-490.115); recon said 490.6
  [26, 503.6],
  [27, 510.2],
  [28, 517.6],
  [29, 526.6],
  [30, 539.6],
  [31, 546.2],
  [32, 553.8],
  [33, 572.6],
  [34, 590.6],
  [35, 599.6],
  [36, 601.4],
  [37, 606.0],
  [38, 608.4],
  [39, 610.6],
  [40, 613.8],
  [41, 618.6],
  [42, 627.2],
  [43, 639.4],
  [44, 675.4],
  [45, 690.6],
  [46, 710.6],
  [47, 722.4],
  [48, 728.8],
  [49, 733.2],
  [50, 739.0],
  [51, 744.0],
  [52, 749.4],
  [53, 765.2],
  [54, 793.4],
  [55, 799.8], // P-8 — the Viterbi's near-identical-pair failure
  [56, 827.8],
  [57, 846.8],
  [58, 851.0],
  [59, 861.0],
  [1, 893.8], // P-1's closing correction: the film returns to deck 1
]

const VIDEO_END = 903.4

/** Every param of every holon a dream DECLARES, keyed by field + index. */
const snapshot = (dream: Dream): Map<string, ParamValue> => {
  const out = new Map<string, ParamValue>()
  const seen = new Set<Holon>()
  const record = (holon: Holon, path: string) => {
    if (seen.has(holon)) return
    seen.add(holon)
    for (const [name, param] of holon.params) out.set(`${path}.${name}`, param.value)
  }
  const fields = Object.keys(dream as unknown as Record<string, unknown>).sort()
  for (const field of fields) {
    const value = (dream as unknown as Record<string, unknown>)[field]
    const holons = Array.isArray(value) ? value : [value]
    let j = 0
    for (const item of holons) {
      if (!isHolon(item)) continue
      for (const holon of item.walk()) record(holon, `${field}/${j++}`)
    }
  }
  for (const [name, param] of dream.observer.params) out.set(`obs.${name}`, param.value)
  return out
}

/** Duck-typed: `Holon` is not exported as a value from every entry point. */
const isHolon = (v: unknown): v is Holon =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as Holon).walk === "function" &&
  (v as Holon).params instanceof Map

describe("ProjectLiminality — the whole film at the video's boundaries", () => {
  test("the boundary table is the video's, 60 rows, and the film is 903.4s", () => {
    expect(BOUNDARIES).toHaveLength(TABLE.length)
    expect(BOUNDARIES.map((b) => [b.deck, b.t0])).toEqual(
      TABLE.map(([deck, t0]) => [deck, t0]),
    )
    expect(PL02_DURATION).toBe(VIDEO_END)
    const song = new ProjectLiminalityDream()
    expect(song.duration).toBeCloseTo(VIDEO_END, 9)
  })

  test("the boundaries are strictly increasing and tile the film with no gap", () => {
    let prev = -1
    for (const { t0 } of BOUNDARIES) {
      expect(t0).toBeGreaterThan(prev)
      prev = t0
    }
    expect(BOUNDARIES[0]!.t0).toBe(0)
    expect(BOUNDARIES[BOUNDARIES.length - 1]!.t0).toBeLessThan(VIDEO_END)
  })

  test("all 59 decks appear once, plus the closing return to deck 1", () => {
    const decks = BOUNDARIES.map((b) => b.deck)
    // The closing row is deck 1 a second time; every other deck once.
    expect(decks[decks.length - 1]).toBe(1)
    const content = decks.slice(0, -1)
    expect(content).toEqual(Array.from({ length: 59 }, (_, i) => i + 1))
  })

  test("the six corrected boundaries carry the chapter that measured them", () => {
    // Each correction overrides `analysis/segments.json` (with the +1
    // shift), and each is a measurement a chapter made with an
    // instrument built for the question. The recon's values are stated
    // so a regression to them is visible as a diff, not just a number.
    const byDeck = new Map(
      BOUNDARIES.slice(0, -1).map((b) => [b.deck, b] as const),
    )
    expect(byDeck.get(15)!.t0).toBe(225.2) // recon 227.0
    expect(byDeck.get(16)!.t0).toBe(262.2) // recon 263.0
    expect(byDeck.get(18)!.t0).toBe(292.0) // recon 362.0 — deck 18 is 70s
    expect(byDeck.get(55)!.t0).toBe(799.8) // recon 816.0
    for (const deck of [15, 16, 18, 55]) {
      expect(byDeck.get(deck)!.note).toBeDefined()
    }
    // Deck 18's window really is seventy seconds (P-9's finding).
    expect(byDeck.get(19)!.t0 - byDeck.get(18)!.t0).toBeCloseTo(70.0, 9)
    // Deck 54 holds only ~6.4s, not the recon's 22.6 (P-8's finding).
    expect(byDeck.get(55)!.t0 - byDeck.get(54)!.t0).toBeCloseTo(6.4, 9)
  })

  /**
   * COMPOSITION INVISIBILITY, the assembly's actual result.
   *
   * Sample the song and the standalone chapter at the SAME video
   * seconds — no shift, because the chapters are already in video time —
   * and require every param of every holon the chapter declares to be
   * exactly equal.
   *
   * Opacity is excluded for the same reason ORIGINS excludes it: pages
   * outside their own windows are driven dark, and a page that the song
   * shows while the standalone chapter does not (or the reverse, where
   * chapters overlap in time) legitimately differs. Everything the
   * visibility gating does not touch — geometry, creation fronts, tints,
   * transforms, the observer — must match.
   */
  for (const [key, Scene, decks] of CHAPTERS) {
    test(`${key} in-song is identical to ${key} standalone at the same t`, () => {
      const song = new ProjectLiminalityDream()
      const solo = new Scene()
      // Sample inside each of the chapter's own decks, at the settled
      // middle of that deck's window — where the chapter is on screen
      // and the film should be showing exactly what the chapter shows.
      const rows = BOUNDARIES.slice(0, -1)
      const times: number[] = []
      for (const deck of decks) {
        const i = rows.findIndex((b) => b.deck === deck)
        const t0 = rows[i]!.t0
        const t1 = i + 1 < rows.length ? rows[i + 1]!.t0 : VIDEO_END
        times.push(t0 + (t1 - t0) * 0.5)
      }
      // The song's OWN instance of this chapter — the one whose clips it
      // borrowed, and so the one carrying the holons the song drives.
      // `build()` is what runs `unfold`, and `unfold` is what fills
      // `chapterDreams`, so the list is empty until the song is built.
      song.build()
      const i = CHAPTERS.findIndex(([k]) => k === key)
      const inSongChapter = song.chapterDreams[i]!
      expect(inSongChapter.constructor.name).toBe(Scene.name)

      for (const t of times) {
        song.applyAt(t)
        solo.applyAt(t)
        const inSong = snapshot(inSongChapter)
        const standalone = snapshot(solo)
        expect([...inSong.keys()]).toEqual([...standalone.keys()])
        for (const [path, value] of standalone) {
          if (path.endsWith(".opacity")) continue
          expect([path, inSong.get(path)]).toEqual([path, value])
        }
      }
    })
  }

  test("purity: sampling the film backwards is identical to forwards", () => {
    const times = [0.4, 10.4, 108.8, 206.8, 290.6, 401.6, 563.2, 657.4, 796.6, 879.6, 899.8]
    const forward = new ProjectLiminalityDream()
    const shots: Map<string, ParamValue>[] = []
    for (const t of times) {
      forward.applyAt(t)
      shots.push(snapshot(forward))
    }
    const backward = new ProjectLiminalityDream()
    for (let i = times.length - 1; i >= 0; i--) {
      backward.applyAt(times[i]!)
      const now = snapshot(backward)
      for (const [path, value] of shots[i]!) {
        expect([path, now.get(path)]).toEqual([path, value])
      }
    }
  })

  /**
   * EXACTLY ONE TABLEAU IS ON SCREEN AT A TIME — the assembly's own
   * structural claim, and the thing no chapter's gauntlet can see.
   *
   * A chapter hides the outgoing page when it cuts to the next, which
   * is right over its own contiguous run; but its LAST page is meant to
   * hold to the end, and a chapter whose decks are not contiguous in
   * film order (SetPieces owns 16-18 and 59) has decks in between that
   * belong to other chapters. Measured before the song's gate, at video
   * 700, SEVEN pages were drawing at once. This is the assertion that
   * keeps that fixed.
   *
   * Counted on LEAF drawables — a holon with parts draws nothing itself
   * (a `Connection` parents one `Line` per dash), so a container's own
   * opacity says nothing about what is on screen.
   */
  test("exactly one deck is drawing at every sampled instant", () => {
    const song = new ProjectLiminalityDream()
    song.build()

    const leaves = (page: Holon): number => {
      let n = 0
      for (const h of page.walk()) {
        if (h.parts.length > 0) continue
        const opacity = (h as unknown as { opacity?: { value: number } }).opacity
        const creation = (h as unknown as { creation?: { value: number } }).creation
        if (creation !== undefined && creation.value > 0.01 && (opacity?.value ?? 1) > 0.01) n++
      }
      return n
    }

    /** Every page the film can draw, paired with the deck it is. */
    const allPages: { deck: number; page: Holon }[] = []
    for (const page of (song as unknown as { pages: { data: { index: number } }[] }).pages) {
      allPages.push({ deck: page.data.index, page: page as unknown as Holon })
    }
    for (const dream of song.chapterDreams) {
      const pages = (dream as unknown as { pages?: { data: { index: number } }[] }).pages ?? []
      const extra = (dream as unknown as { liminality?: { data: { index: number } } }).liminality
      for (const page of [...pages, ...(extra ? [extra] : [])]) {
        allPages.push({ deck: page.data.index, page: page as unknown as Holon })
      }
    }

    // Sampled just BEFORE each segment closes rather than at its middle.
    //
    // A segment's own t0 is where the TRANSITION into it begins, not
    // where its tableau arrives: the chapters cut a page in at its
    // SETTLED arrival, so the first ~1-2s of every segment is the
    // crossing, which the film renders as the black gap a cut leaves
    // (the Origins precedent's dead air). The middle is past that on a
    // long segment and inside it on a short one — deck 13's window is
    // 216.4-219.4 and its tableau arrives at 218.4, so its midpoint of
    // 217.9 is still in the glide. The last settled instant is past the
    // crossing on every segment, which is the property the sample needs.
    const rows = BOUNDARIES
    for (const [i, row] of rows.entries()) {
      const t1 = i + 1 < rows.length ? rows[i + 1]!.t0 : VIDEO_END
      const t = Number((t1 - 0.2).toFixed(4))
      song.applyAt(t)
      const drawing = allPages.filter(({ page }) => leaves(page) > 0).map(({ deck }) => deck)
      // Deck 1 is staged once and drawn twice (head and close), so the
      // set of DECKS drawing is a single deck at every instant.
      expect([t, [...new Set(drawing)]]).toEqual([t, [row.deck]])
    }
  })

  /**
   * NEVER TWO TABLEAUX AT ONCE, anywhere — the same claim swept densely
   * rather than at 60 chosen instants.
   *
   * Where the segment-middle test asserts WHICH deck is up, this one
   * asserts only that no two ever are, on a 0.2s grid across the whole
   * film (the reference's own frame interval). It is the assertion that
   * would have caught the pre-gate state at any of 4,500 places rather
   * than at the ones a table happened to name.
   *
   * ZERO decks drawing is allowed and expected: those are the
   * transition crossings, which the film renders as cuts and so as
   * black. See the header's "THE TRANSITIONS ARE CUTS".
   *
   * ONE INSTANT IS EXEMPT AND IT IS DOCUMENTED. Chain01 cuts deck 25 in
   * at its own declared 490.6 while its deck-25 builds are measured at
   * 490.108-490.115, so from 490.2 the incoming builds light deck 25
   * while deck 24 is still up. Nothing is visibly wrong, because deck 25
   * IS deck 24 plus an arrow and a "?" — the InterLogos mesh is
   * identical in both — so the overlap draws the same mesh twice. The
   * boundary table follows the measurement (490.2); the chapter's own
   * cut-in is left alone, because scene files are the chapters'.
   */
  test("no two decks ever draw at once, on a 0.2s grid across the film", () => {
    const song = new ProjectLiminalityDream()
    song.build()
    const pages: { deck: number; page: Holon }[] = []
    for (const page of (song as unknown as { pages: { data: { index: number } }[] }).pages) {
      pages.push({ deck: page.data.index, page: page as unknown as Holon })
    }
    for (const dream of song.chapterDreams) {
      const own = (dream as unknown as { pages?: { data: { index: number } }[] }).pages ?? []
      const extra = (dream as unknown as { liminality?: { data: { index: number } } }).liminality
      for (const page of [...own, ...(extra ? [extra] : [])]) {
        pages.push({ deck: page.data.index, page: page as unknown as Holon })
      }
    }
    const draws = (page: Holon): boolean => {
      for (const h of page.walk()) {
        if (h.parts.length > 0) continue
        const opacity = (h as unknown as { opacity?: { value: number } }).opacity
        const creation = (h as unknown as { creation?: { value: number } }).creation
        if (creation !== undefined && creation.value > 0.01 && (opacity?.value ?? 1) > 0.01) {
          return true
        }
      }
      return false
    }
    /** The documented deck-24/25 overlap — see the header. */
    const EXEMPT = (t: number, decks: Set<number>) =>
      t >= 490.2 && t < 490.6 && decks.size === 2 && decks.has(24) && decks.has(25)

    for (let f = 0; f * 0.2 <= VIDEO_END; f++) {
      const t = Number((f * 0.2).toFixed(1))
      song.applyAt(t)
      const decks = new Set(pages.filter(({ page }) => draws(page)).map(({ deck }) => deck))
      expect([t, decks.size <= 1 || EXEMPT(t, decks)]).toEqual([t, true])
    }
  }, 120000)

  test("deck 59's three deleted labels are reconstructed, sized from the deck", () => {
    const song = new ProjectLiminalityDream()
    const labels = (song as unknown as { labels: { content: string }[] }).labels
    expect(labels.map((l) => l.content)).toEqual([
      "Liminal Flow",
      "Collective\nIntelligence",
      "Syntropy",
    ])
    // Dark before their measured onsets, lit after — the builds are at
    // 875.8, 878.2 and 883.0 with a 1.0s ramp each.
    const opacity = () =>
      (song as unknown as { labels: { opacity: { value: number } }[] }).labels.map(
        (l) => l.opacity.value,
      )
    song.applyAt(875.0)
    expect(opacity()).toEqual([0, 0, 0])
    song.applyAt(877.0)
    expect(opacity()[0]).toBe(1)
    expect(opacity()[1]).toBe(0)
    song.applyAt(890.0)
    expect(opacity()).toEqual([1, 1, 1])
    // They leave with deck 59 when the film returns to the title card.
    song.applyAt(895.0)
    expect(opacity()).toEqual([0, 0, 0])
  })

  test("the film's last clip parks on 903.4 so the closing card is held", () => {
    const song = new ProjectLiminalityDream()
    const last = song.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
    expect(last).toBeCloseTo(VIDEO_END, 9)
    // …and the closing cut-in really is at 893.8.
    expect(song.clips.some((c) => Math.abs(c.start - 893.8) < 1e-9)).toBe(true)
  })
})

