import { describe, expect, test } from "bun:test"
import { Dream } from "../src/dream"
import { Holon } from "../src/holon"
import { DreamSong, type ChapterSpec } from "../src/song"
import { crossfade, magicMove, slide } from "../src/transitions"
import { InterBrainSongDream } from "../demo/interbrain/InterBrainSong"

/**
 * LAZY CONSTRUCTION (song.ts) — a song whose chapters all declare spans
 * may construct only the chapters near the playhead. The load-bearing
 * invariant: at every t, every chapter that stands holds exactly the values
 * the eager composite gives it — same params, same gates, same observer
 * mirror — however the playhead got there, and however many times the
 * chapter was dropped and built again.
 */

class Box extends Holon {}

/** A chapter of `span` seconds: a box that walks, and one that only stands (glided by a magic move). */
const chapter = (span: number, to: number) =>
  class extends Dream {
    box = new Box()
    still = new Box()
    unfold(): void {
      this.observer.radius.value = 800 + to
      this.stage(this.still)
      this.wait(-0.5) // a clip that spills before the cut
      this.play(this.box.x.to(to), span)
      this.play(this.observer.radius.to(900 + to), 0.5)
    }
  }
const A = chapter(30, 10)
const B = chapter(25, 20)
const C = chapter(40, 30)
const D = chapter(30, 40)

const SPECS: ChapterSpec[] = [
  { scene: A, span: 30 },
  [{ scene: B, span: 25 }, crossfade(1)],
  [{ scene: C, span: 40 }, magicMove(2)],
  [{ scene: D, span: 30 }, slide(1.5)],
]

/** Every value a chapter's trees hold, in walk order — its params and their gates. */
const snap = (dream: Dream): unknown[] =>
  dream.roots.flatMap((r) => [...r.walk()]).flatMap((h) => [...h.params].map(([n, p]) => [n, p.value, p.gate]))

/** What the song shows at t: the observer mirror, the drawn chapters, the fading layers, each standing chapter's values. */
const state = (song: DreamSong, t: number, chapters: readonly number[]) => {
  song.applyAt(t)
  return {
    observer: [...song.observer.params].map(([n, p]) => [n, p.value]),
    live: chapters.filter((i) => song.chapters[i]!.dream.roots.some((r) => song.liveRoots.has(r))),
    layers: song.layerFades.map((l) => l.opacity),
    values: chapters.map((i) => snap(song.chapters[i]!.dream)),
  }
}

describe("DreamSong lazy construction", () => {
  test("windows and duration are known without constructing a chapter", () => {
    const lazy = new DreamSong(SPECS, { lazy: true })
    const eager = new DreamSong(SPECS)
    expect(lazy.duration).toBe(eager.duration)
    expect(lazy.chapters.map((c) => [c.offset, c.span])).toEqual(eager.chapters.map((c) => [c.offset, c.span]))
    expect(lazy.constructed).toEqual([])
    expect(lazy.roots).toEqual([])
  })

  test("a lazy song needs every span declared", () => {
    expect(() => new DreamSong([A, { scene: B, span: 3 }], { lazy: true })).toThrow(/declare its span/)
  })

  test("only the resident chapters (and `keep` more) stand", () => {
    const song = new DreamSong(SPECS, { lazy: true, keep: 1 })
    song.applyAt(5)
    expect(song.constructed).toEqual([0])
    song.applyAt(60) // C live (B closed 6 s ago); kept: A
    expect(song.constructed).toEqual([0, 2])
    song.applyAt(120)
    // Resident at 120: D; kept: the most recent one before (C).
    expect(song.residentAt(120)).toEqual([3])
    expect(song.constructed).toEqual([2, 3])
    const none = new DreamSong(SPECS, { lazy: true, keep: 0 })
    none.applyAt(5)
    none.applyAt(120)
    expect(none.constructed).toEqual([3])
    // roots: the song's own (none) and the standing chapters'.
    expect(none.roots).toEqual(none.chapters[3]!.dream.roots)
  })

  test("every standing chapter equals the eager composite, at every t, forward and backward", () => {
    const eager = new DreamSong(SPECS)
    const lazy = new DreamSong(SPECS, { lazy: true, keep: 0 })
    const ts: number[] = []
    for (let t = -1; t < eager.duration + 1; t += 0.25) ts.push(t)
    // Every transition window, finely.
    for (const c of eager.chapters) for (let u = -0.05; u < 2.1; u += 0.05) ts.push(c.offset + u)
    const order = [...ts, ...[...ts].reverse(), 120, 3, 55, 29.5, 84.5, 1, 100]
    for (const t of order) {
      const resident = lazy.residentAt(t)
      const want = state(eager, t, resident)
      const got = state(lazy, t, resident)
      expect([t, got]).toEqual([t, want])
      // Reading `dream` above constructs nothing beyond the resident ones.
      expect(lazy.constructed).toEqual(resident)
    }
  })

  test("eager() before the first build is the composite as it always was; after, it refuses", () => {
    const song = new DreamSong(SPECS, { lazy: true })
    song.eager()
    expect(song.lazy).toBe(false)
    expect(song.constructed).toEqual([0, 1, 2, 3])
    expect(song.build().params.length).toBe(new DreamSong(SPECS).build().params.length)
    const built = new DreamSong(SPECS, { lazy: true })
    built.applyAt(0)
    expect(() => built.eager()).toThrow(/already built/)
  })

  test("the soundtrack is the song's own score and does not construct chapters", () => {
    const song = new DreamSong(SPECS, { lazy: true })
    expect(song.soundtrack.events).toEqual([])
    expect(song.constructed).toEqual([])
  })
})

describe("InterBrain, lazily constructed", () => {
  test("its standing chapters equal the eager film's at the jumps, forward and backward", () => {
    const eager = new InterBrainSongDream({ lazy: false })
    const lazy = new InterBrainSongDream()
    expect(lazy.lazy).toBe(true)
    expect(lazy.duration).toBe(eager.duration)
    expect(lazy.narration.lines.length).toBe(eager.narration.lines.length)
    for (const t of [100, 1000, 1700, 2300, 120, 332.5, 333.2, 1594, 2834, 1000]) {
      const resident = lazy.residentAt(t)
      expect([t, state(lazy, t, resident)]).toEqual([t, state(eager, t, resident)])
      expect(lazy.constructed.length).toBeLessThanOrEqual(resident.length + 1)
    }
  }, 120_000)
})
