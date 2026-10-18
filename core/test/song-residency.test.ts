import { describe, expect, test } from "bun:test"
import { Dream } from "../src/dream"
import { Holon } from "../src/holon"
import {
  DreamSong,
  RESIDENT_AHEAD,
  RESIDENT_BEHIND,
  liveChapters,
  residentChapters,
  type ChapterWindow,
} from "../src/song"
import { crossfade, magicMove } from "../src/transitions"
import { Web3Dream } from "../demo/web3/Web3Song"

/**
 * RESIDENCY (song.ts) — which chapters a host keeps mounted. The one
 * load-bearing invariant: every chapter the song DRAWS at t (liveRoots) is
 * resident at t, so lazily mounting chapters can never cost a pixel. And the
 * set is a pure function of t: how the playhead got there cannot matter.
 */

// Three cut chapters: [0, 4), [4, 6), [6, 16).
const CUTS: ChapterWindow[] = [
  { offset: 0, span: 4 },
  { offset: 4, span: 2 },
  { offset: 6, span: 10 },
]
// A 1 s transition into the second: [0, 4) then [3, 6).
const OVERLAP: ChapterWindow[] = [
  { offset: 0, span: 4 },
  { offset: 3, span: 3 },
]

describe("liveChapters", () => {
  test("cuts: the chapter whose half-open window holds t, clamped at both ends", () => {
    expect(liveChapters(CUTS, -5)).toEqual([0])
    expect(liveChapters(CUTS, 0)).toEqual([0])
    expect(liveChapters(CUTS, 3.999)).toEqual([0])
    expect(liveChapters(CUTS, 4)).toEqual([1])
    expect(liveChapters(CUTS, 6)).toEqual([2])
    expect(liveChapters(CUTS, 99)).toEqual([2])
    expect(liveChapters([], 1)).toEqual([])
  })

  test("a transition's overlap: the chapter it leaves draws too, until its own window ends", () => {
    expect(liveChapters(OVERLAP, 2.999)).toEqual([0])
    expect(liveChapters(OVERLAP, 3)).toEqual([0, 1])
    expect(liveChapters(OVERLAP, 3.999)).toEqual([0, 1])
    expect(liveChapters(OVERLAP, 4)).toEqual([1])
  })
})

describe("residentChapters", () => {
  test("live, plus the next one `ahead` seconds before its cut, plus the last one `behind` seconds after", () => {
    // ahead 1, behind 0.5
    expect(residentChapters(CUTS, 2.999, 1, 0.5)).toEqual([0])
    expect(residentChapters(CUTS, 3, 1, 0.5)).toEqual([0, 1])
    expect(residentChapters(CUTS, 4, 1, 0.5)).toEqual([0, 1])
    expect(residentChapters(CUTS, 4.499, 1, 0.5)).toEqual([0, 1])
    // At 5 chapter 2 is 1 s away: mounted ahead, while 0 has been gone 1 s.
    expect(residentChapters(CUTS, 4.5, 1, 0.5)).toEqual([1])
    expect(residentChapters(CUTS, 5, 1, 0.5)).toEqual([1, 2])
    expect(residentChapters(CUTS, 6.4, 1, 0.5)).toEqual([1, 2])
    expect(residentChapters(CUTS, 6.5, 1, 0.5)).toEqual([2])
  })

  test("the defaults: mount twelve seconds ahead, keep two behind", () => {
    expect(RESIDENT_AHEAD).toBe(12)
    expect(RESIDENT_BEHIND).toBe(2)
    const long: ChapterWindow[] = [
      { offset: 0, span: 100 },
      { offset: 100, span: 100 },
    ]
    expect(residentChapters(long, 87.999)).toEqual([0])
    expect(residentChapters(long, 88)).toEqual([0, 1])
    expect(residentChapters(long, 101.999)).toEqual([0, 1])
    expect(residentChapters(long, 102)).toEqual([1])
  })

  test("live is always resident, for every window layout and t", () => {
    for (const windows of [CUTS, OVERLAP]) {
      for (let t = -2; t < 20; t += 0.125) {
        const resident = residentChapters(windows, t, 0, 0)
        for (const i of liveChapters(windows, t)) expect(resident).toContain(i)
      }
    }
  })

  test("pure in t: the same t answers the same however it was reached", () => {
    const ts = [5, 0.5, 15, 3.2, 4.4, 6.1, 5, 0.5]
    const first = new Map<number, number[]>()
    for (const t of ts) {
      const r = residentChapters(CUTS, t, 1, 0.5)
      if (first.has(t)) expect(r).toEqual(first.get(t)!)
      else first.set(t, r)
    }
  })
})

/** Three tiny chapters, the second entered by a crossfade, the third by a magic move. */
class Box extends Holon {}
const chapter = (span: number) =>
  class extends Dream {
    box = new Box()
    unfold(): void {
      this.play(this.box.x.to(10), span)
    }
  }
const A = chapter(4)
const B = chapter(3)
const C = chapter(5)

/** The chapters whose roots the song draws at t. */
const drawn = (song: DreamSong, t: number): number[] => {
  song.applyAt(t)
  return song.chapters.flatMap((c, i) => (c.dream.roots.some((r) => song.liveRoots.has(r)) ? [i] : []))
}

describe("DreamSong.residentAt", () => {
  test("is residentChapters over the song's own windows", () => {
    const song = new DreamSong([A, [B, crossfade(1)], [C, magicMove(1.5)]])
    for (let t = -1; t < song.duration + 3; t += 0.25) {
      expect(song.residentAt(t)).toEqual(residentChapters(song.chapters, t))
    }
  })

  test("every chapter the song draws is resident — across cuts, crossfades and magic moves", () => {
    const song = new DreamSong([A, [B, crossfade(1)], C, [A, magicMove(1.5)]])
    for (let t = -1; t < song.duration + 1; t += 0.05) {
      const resident = song.residentAt(t)
      for (const i of drawn(song, t)) expect(resident).toContain(i)
    }
  })

  test("Web3 (crossfades, dissolves, two pushes): what draws is always resident", () => {
    const song = new Web3Dream()
    const edges = song.chapters.flatMap((c) => [c.offset - 1e-6, c.offset, c.offset + 1e-6, c.offset + c.span - 1e-6, c.offset + c.span])
    const grid = Array.from({ length: Math.ceil(song.duration * 2) }, (_, k) => k / 2)
    for (const t of [...edges, ...grid]) {
      const resident = song.residentAt(t)
      for (const i of drawn(song, t)) expect(resident).toContain(i)
    }
  })
})
