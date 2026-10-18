/**
 * film.ts — what every InterBrain chapter shares: where the chapters sit in
 * the film, and the title card each one opens with.
 *
 * Song time = video time (like Web3Song): chapter k's scene starts at its
 * own local t = 0 and InterBrainSong places it at CHAPTERS[k].start, so
 * reference frame refs/interbrain/frames5/f_N sits at song t = (N − 1)/5.
 * The windows are the YouTube chapter list (refs/interbrain/IB14_InterBrain
 * .info.json); every beat inside them is measured from frames5 and the
 * transcript (docs/reports/interbrain-vocabulary.md §0–§2).
 */

import type { Dream } from "../../src/dream"
import { Text } from "../../src/parts/text"
import { FadeIn, FadeOut } from "../../src/verbs"
import { WHITE } from "../../src/constants"

export interface FilmChapter {
  title: string
  /** Video seconds where the chapter opens. */
  start: number
  /** Video seconds where the next one opens. */
  end: number
  /** Video seconds the title card is fully up, and when it is gone (measured). */
  card: readonly [number, number]
}

export const CHAPTERS: readonly FilmChapter[] = [
  { title: "In Search of the\nThird Attractor", start: 0, end: 333, card: [12, 17.5] },
  { title: "The Ancient Arms Race", start: 333, end: 638, card: [336, 342.5] },
  { title: "The Vicious Cycle", start: 638, end: 971, card: [641, 646.5] },
  { title: "Going Upstream", start: 971, end: 1395, card: [973, 978.5] },
  { title: "Fixing The Lens", start: 1395, end: 1593, card: [1397.5, 1402.5] },
  { title: "Introducing the InterBrain", start: 1593, end: 2070, card: [1596, 1602.5] },
  { title: "Breaking the Spell", start: 2070, end: 2446, card: [2075, 2081] },
  { title: "A New Beginning", start: 2446, end: 2835, card: [2448, 2454.5] },
] as const

/** The whole film, seconds. */
export const FILM_DURATION = 2835

/** The film's serif (the cards and labels are Times, not the framework's Arimo). */
export const SERIF = "Times-Roman"
export const SERIF_ITALIC = "Times-Italic"

/**
 * The chapter's title card at its measured place, in the chapter's LOCAL
 * time: the words fade up (the film dissolves them in over ≈1 s), hold,
 * and fade out. Leaves the dream's cursor where it found it.
 */
export function titleCard(dream: Dream, chapter: FilmChapter, size = 34): Text {
  const [up, gone] = chapter.card
  const at = up - chapter.start
  const card = new Text({ content: chapter.title, font: SERIF, size, tint: WHITE, lineHeight: 1.25 })
  dream.wait(Math.max(0, at - 1))
  dream.play(FadeIn(card), 1)
  dream.wait(Math.max(0, gone - up - 1))
  dream.play(FadeOut(card), 1)
  dream.wait(-(Math.max(0, at - 1) + 1 + Math.max(0, gone - up - 1) + 1))
  return card
}

/** Local seconds of video time `t` inside `chapter`. */
export const local = (chapter: FilmChapter, t: number): number => t - chapter.start
