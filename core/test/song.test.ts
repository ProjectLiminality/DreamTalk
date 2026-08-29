import { describe, expect, test } from "bun:test"
import { Dream } from "../src/dream"
import { DreamSong } from "../src/song"
import { Holon } from "../src/holon"

/**
 * Two minimal chapters. A drives its box's x over 0..2s (duration 2);
 * B carries a leading NEGATIVE wait (the S04/S08 pattern: source ink
 * before the chapter's own t = 0) and drives its box's y and opacity.
 */
class BoxA extends Holon {}
class BoxB extends Holon {}

class ChapterA extends Dream {
  box = new BoxA()
  unfold(): void {
    this.set(...this.observer.dolly(500))
    this.play(this.box.x.to(10, { easing: "linear" }), 2)
  }
}

class ChapterB extends Dream {
  box = new BoxB()
  unfold(): void {
    this.set(...this.observer.dolly(900))
    this.wait(-1)
    this.play(this.box.y.to(8, { easing: "linear" }), 2)
    this.play(this.box.opacity.to(0.5, { easing: "linear" }), 1)
  }
}

const makeSong = () => new DreamSong([{ scene: ChapterA, span: 4 }, ChapterB])

const chapterBoxes = (song: DreamSong): { a: BoxA; b: BoxB } => ({
  a: (song.chapters[0]!.dream as ChapterA).box,
  b: (song.chapters[1]!.dream as ChapterB).box,
})

describe("DreamSong composition", () => {
  test("chapters land at cumulative offsets; spans default to the chapter's own duration", () => {
    const song = makeSong()
    expect(song.chapters.map((c) => c.offset)).toEqual([0, 4])
    // ChapterB's own duration: wait(-1) + 2 + 1 = 2 net cursor... its
    // clips run -1..2, its cursor ends at 2 — duration 2.
    expect(song.chapters[1]!.span).toBe(2)
    expect(song.duration).toBe(6)
  })

  test("a chapter's clips are shifted by its offset — including negative local starts", () => {
    const song = makeSong()
    const { a, b } = chapterBoxes(song)
    const tl = song.build()
    // ChapterA's 2s ramp sits at 0..2 of the song.
    expect(tl.valueAt(a.x, 1)).toBe(5)
    expect(tl.valueAt(a.x, 3)).toBe(10) // holds through A's 4s window
    // ChapterB's y ramp ran -1..1 locally, so 3..5 globally: its ink
    // starts one second BEFORE its cut at 4.
    expect(tl.valueAt(b.y, 3)).toBe(0)
    expect(tl.valueAt(b.y, 4)).toBe(4)
    expect(tl.valueAt(b.y, 5)).toBe(8)
  })

  test("chapterAt: half-open windows, cuts on the boundary, clamped at the ends", () => {
    const song = makeSong()
    expect(song.chapterAt(-1)).toBe(song.chapters[0]!)
    expect(song.chapterAt(0)).toBe(song.chapters[0]!)
    expect(song.chapterAt(3.999)).toBe(song.chapters[0]!)
    expect(song.chapterAt(4)).toBe(song.chapters[1]!)
    expect(song.chapterAt(99)).toBe(song.chapters[1]!)
  })

  test("only the active chapter is visible; spilled clips evaluate hidden", () => {
    const song = makeSong()
    const { a, b } = chapterBoxes(song)
    song.applyAt(3.5) // inside A's window; B's spill is already animating
    expect(a.opacity.value).toBe(1)
    expect(a.x.value).toBe(10)
    expect(b.y.value).toBe(2) // evaluated…
    expect(b.opacity.value).toBe(0) // …but hidden
    song.applyAt(4.5) // past the cut
    expect(b.opacity.value).toBe(1) // undriven-at-this-t opacity back to default
    expect(a.opacity.value).toBe(0)
  })

  test("a chapter's own opacity animation wins over the visibility default while active", () => {
    const song = makeSong()
    const { b } = chapterBoxes(song)
    song.applyAt(5.5) // B active, its opacity ramp (local 1..2 → global 5..6) half done
    expect(b.opacity.value).toBeCloseTo(0.75, 10)
  })

  test("the active chapter's observer is mirrored onto the song's", () => {
    const song = makeSong()
    song.applyAt(1)
    expect(song.observer.radius.value).toBe(500)
    song.applyAt(5)
    expect(song.observer.radius.value).toBe(900)
  })

  test("purity: the same t yields the same values regardless of sampling order", () => {
    const song = makeSong()
    const { a, b } = chapterBoxes(song)
    const sample = (t: number) => {
      song.applyAt(t)
      return [a.x.value, a.opacity.value, b.y.value, b.opacity.value, song.observer.radius.value]
    }
    const forward = [1, 3.5, 4.5, 5.5].map(sample)
    const backward = [5.5, 4.5, 3.5, 1].map(sample).reverse()
    expect(backward).toEqual(forward)
    // …and against a fresh instance, so no accumulated state hides anywhere.
    const fresh = makeSong()
    const { a: fa, b: fb } = chapterBoxes(fresh)
    fresh.applyAt(3.5)
    expect([fa.x.value, fb.y.value, fb.opacity.value]).toEqual([
      forward[1]![0]!,
      forward[1]![2]!,
      forward[1]![3]!,
    ])
  })

  test("an explicit span longer than the chapter holds; total duration is the sum of spans", () => {
    const song = new DreamSong([
      { scene: ChapterA, span: 10 },
      { scene: ChapterB, span: 3 },
    ])
    expect(song.duration).toBe(13)
    const { a } = chapterBoxes(song)
    song.applyAt(9)
    expect(a.x.value).toBe(10) // held final frame
    expect(a.opacity.value).toBe(1) // still the visible one
  })
})
