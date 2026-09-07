import { describe, expect, test } from "bun:test"
import type { Dream } from "../src/dream"
import type { Holon } from "../src/holon"
import type { ParamValue } from "../src/params"
import {
  ORIGINS_DURATION,
  ORIGINS_T0,
  OriginsPitchDream,
} from "../demo/origins/OriginsPitch"
import { Scene00Dream } from "../demo/origins/Scene00"
import { Scene01Dream } from "../demo/origins/Scene01"
import { Scene02Dream } from "../demo/origins/Scene02"
import { Scene03Dream } from "../demo/origins/Scene03"
import { Scene04Dream } from "../demo/origins/Scene04"
import { Scene05Dream } from "../demo/origins/Scene05"
import { Scene06Dream } from "../demo/origins/Scene06"
import { Scene07Dream } from "../demo/origins/Scene07"
import { Scene07_1Dream } from "../demo/origins/Scene07_1"
import { Scene08Dream } from "../demo/origins/Scene08"
import { Scene09Dream } from "../demo/origins/Scene09"
import { Scene10Dream } from "../demo/origins/Scene10"
import { Scene11Dream } from "../demo/origins/Scene11"
import { Scene12Dream } from "../demo/origins/Scene12"

/**
 * The ORIGINS song's OFFSETS — the one thing assembling a song can get
 * wrong that no individual scene's gauntlet would catch.
 *
 * Every chapter here was scored standalone against the reference frames
 * at a particular alignment (its t0 in video time, taken from the scene
 * file's own header). The song's whole job is to place each chapter at
 * that t0 and change nothing else. So the property under test is
 * exactly that: a chapter's in-song state at video time V must be
 * IDENTICAL, param for param, to its standalone state at V − t0.
 *
 * The comparison is to 1e-9, not to the bit. song.ts places a chapter's
 * clips by shifting their starts, so the song evaluates a clip at
 * (t0 + local) against a start shifted by t0, where the standalone
 * evaluates at local against an unshifted one — the same number in
 * exact arithmetic and a float apart in this one (o07's tint lands
 * 2e-14 off, o08's creation front 1.4e-14). Anything a misplaced
 * chapter could cause is enormously larger: one video frame is 1/30s
 * and the smallest boundary distinction in the table is 0.05s.
 */

/** The chapter classes in film order, paired with their scored t0s. */
const CHAPTERS = [
  ["o00", Scene00Dream],
  ["o01", Scene01Dream],
  ["o02", Scene02Dream],
  ["o03", Scene03Dream],
  ["o04", Scene04Dream],
  ["o05", Scene05Dream],
  ["o06", Scene06Dream],
  ["o07", Scene07Dream],
  ["o07_1", Scene07_1Dream],
  ["o08", Scene08Dream],
  ["o09", Scene09Dream],
  ["o10", Scene10Dream],
  ["o11", Scene11Dream],
  ["o12", Scene12Dream],
] as const

/**
 * The video's own boundaries, restated here rather than imported, so
 * the test fails if OriginsPitch.ts's table is edited: a transcription
 * this file shares with the thing it tests would prove nothing.
 */
const T0 = [
  0, 13.0, 71.0, 96.0, 125.0, 142.0, 154.0, 233.0, 280.7, 292.8, 320.85, 345.8,
  360.2, 371.2,
]
const VIDEO_END = 377.888

/**
 * Every param of every holon a scene DECLARES, keyed by field name and
 * position in that field's subtree.
 *
 * Keyed off the scene's own fields rather than `dream.roots` on
 * purpose. `roots` discovers owners by walking the dream's clips, and a
 * chapter inside a song has had its clips borrowed onto the song's
 * timeline — so the same scene yields its roots in a different ORDER
 * (and a different count of separately-rooted trees) in the two
 * contexts, which would make a positional key compare unlike things.
 * The declared fields are the same names on both instances, so this
 * addresses the same holon in each.
 */
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
    if (!isHolon(value)) continue
    let j = 0
    for (const holon of value.walk()) record(holon, `${field}/${j++}`)
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

/**
 * Equal to 1e-9 — structurally for the compound params (colours,
 * vectors, point arrays), by value for the rest. See the header for why
 * this is a tolerance and not `toEqual`.
 */
const near = (a: unknown, b: unknown): boolean => {
  if (typeof a === "number" && typeof b === "number") {
    return Number.isNaN(a) ? Number.isNaN(b) : Math.abs(a - b) < 1e-9
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => near(v, b[i]))
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object)
    const kb = Object.keys(b as object)
    if (ka.length !== kb.length) return false
    return ka.every(
      (k) =>
        kb.includes(k) &&
        near((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    )
  }
  return a === b
}

describe("OriginsPitch — the twelve scenes at the video's boundaries", () => {
  test("the boundary table is the video's, and the song is the video's length", () => {
    expect([...ORIGINS_T0]).toEqual(T0)
    expect(ORIGINS_DURATION).toBe(VIDEO_END)
    const song = new OriginsPitchDream()
    expect(song.duration).toBeCloseTo(VIDEO_END, 9)
    expect(song.chapters).toHaveLength(CHAPTERS.length)
  })

  test("each chapter sits at its scored t0, and the spans tile the video with no gap", () => {
    const song = new OriginsPitchDream()
    const bounds = [...T0, VIDEO_END]
    for (const [i, chapter] of song.chapters.entries()) {
      expect(chapter.dream.constructor.name).toBe(CHAPTERS[i]![1].name)
      expect(chapter.offset).toBeCloseTo(bounds[i]!, 9)
      // Contiguous: this window ends exactly where the next begins.
      expect(chapter.offset + chapter.span).toBeCloseTo(bounds[i + 1]!, 9)
    }
  })

  test("chapterAt picks the film's cut at every boundary, on both sides", () => {
    const song = new OriginsPitchDream()
    for (const [i, t0] of T0.entries()) {
      expect(song.chapterAt(t0)).toBe(song.chapters[i]!)
      if (i > 0) expect(song.chapterAt(t0 - 1e-6)).toBe(song.chapters[i - 1]!)
    }
    expect(song.chapterAt(VIDEO_END)).toBe(song.chapters[CHAPTERS.length - 1]!)
  })

  /**
   * The offset test proper, one chapter at a time: sample the song at
   * video times spread across the chapter's window and the standalone
   * scene at the same times minus its t0, and require every param of
   * every holon to agree.
   *
   * Opacity is the exception and it is excluded deliberately: the song
   * forces opacity = 0 on inactive chapters (song.ts's visibility
   * gating), so a spilled clip's opacity legitimately differs from the
   * standalone's. Everything the gating does NOT touch — geometry,
   * creation fronts, tints, transforms, the observer — must match, and
   * that is what fixes the alignment.
   */
  for (const [i, [key, Scene]] of CHAPTERS.entries()) {
    test(`${key} in-song equals ${key} standalone, shifted by its t0`, () => {
      const song = new OriginsPitchDream()
      const solo = new Scene()
      const t0 = T0[i]!
      const end = (i + 1 < T0.length ? T0[i + 1]! : VIDEO_END) - t0
      // Five samples across the window, plus the window's own edges.
      const locals = [0, end * 0.25, end * 0.5, end * 0.75, end - 1e-6]
      for (const local of locals) {
        song.applyAt(t0 + local)
        solo.applyAt(local)
        const inSong = snapshot(song.chapters[i]!.dream)
        const standalone = snapshot(solo)
        expect([...inSong.keys()]).toEqual([...standalone.keys()])
        for (const [path, value] of standalone) {
          if (path.endsWith(".opacity")) continue
          expect([path, near(inSong.get(path)!, value)]).toEqual([path, true])
        }
      }
    })
  }

  test("the closing card's play sits at video 372.05, the six landmarks' alignment", () => {
    // Scene12's header measures the closing logo's play — the 4s
    // composite Create — beginning at video 372.05, over-determined by
    // six landmarks. Its t0 moved from 370.05 to 371.2 so Scene11's
    // fade could finish; the LEAD_IN absorbed the difference, so the
    // play must not have moved.
    const solo = new Scene12Dream()
    const clips = solo.clips
    expect(clips).toHaveLength(1)
    expect(clips[0]!.start).toBeCloseTo(0.85, 9)
    expect(clips[0]!.duration).toBe(4)
    expect(T0[13]! + clips[0]!.start).toBeCloseTo(372.05, 9)
    // …and it still ends on the video's last frame, holding 1.838s.
    expect(T0[13]! + solo.duration).toBeCloseTo(VIDEO_END, 9)
  })

  test("Scene11's fade completes inside its own window — the reason o12 moved", () => {
    // The boundary decision this song applies: Scene11's last clip ends
    // at its local 11.0 (video 371.2), so the cut to the closing card
    // cannot fall before that without truncating the fade.
    const solo = new Scene11Dream()
    const last = solo.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
    expect(last).toBeCloseTo(11, 9)
    expect(T0[12]! + last).toBeCloseTo(371.2, 9)
    expect(T0[13]).toBeCloseTo(371.2, 9)
  })

  test("purity: sampling the song backwards is bit-identical to forwards", () => {
    const song = new OriginsPitchDream()
    // One time inside each chapter, including both sides of the two
    // large slacks (o06→o07 and o11→o12).
    const times = [6, 40, 80, 110, 133, 148, 200, 236, 250, 285, 300, 330, 350, 365, 374]
    const sample = (t: number) => {
      song.applyAt(t)
      return song.chapters.map((c) => [...snapshot(c.dream).values()])
    }
    const forward = times.map(sample)
    const backward = [...times].reverse().map(sample).reverse()
    expect(backward).toEqual(forward)
  })
})
