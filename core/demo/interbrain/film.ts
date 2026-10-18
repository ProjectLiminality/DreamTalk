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
  /**
   * The title card in video seconds, measured from frames5 (peak luminance
   * of the centred words, ±0.1 s): [fade-in starts, fully up, fade-out
   * starts, gone].
   */
  card: readonly [number, number, number, number]
}

export const CHAPTERS: readonly FilmChapter[] = [
  { title: "In Search of the\nThird Attractor", start: 0, end: 333, card: [11.7, 12.6, 16.7, 17.5] },
  { title: "The Ancient Arms Race", start: 333, end: 638, card: [333.5, 335.1, 340.9, 341.8] },
  { title: "The Vicious Cycle", start: 638, end: 971, card: [638.3, 638.9, 643.1, 643.7] },
  { title: "Going Upstream", start: 971, end: 1395, card: [971.3, 972.2, 975.9, 976.9] },
  { title: "Fixing the Lens", start: 1395, end: 1593, card: [1395.7, 1396.4, 1400.5, 1401.6] },
  { title: "Introducing the InterBrain", start: 1593, end: 2070, card: [1593.5, 1594.5, 1599.9, 1601.1] },
  { title: "Breaking the Spell", start: 2070, end: 2446, card: [2073.5, 2074.4, 2082.3, 2083.3] },
  { title: "A New Beginning", start: 2446, end: 2835, card: [2446.3, 2448.3, 2454.5, 2455.1] },
] as const

/** The whole film, seconds. */
export const FILM_DURATION = 2835

/** The film's serif (the cards and labels are Times, not the framework's Arimo). */
export const SERIF = "Times-Roman"
export const SERIF_ITALIC = "Times-Italic"

/**
 * The film's card, measured on frames5 against this renderer's Times
 * (fitted on four cards, which agree to 1%): "The Ancient Arms Race" is
 * 644 px wide and its ink 46 px tall (ascender top to baseline), the
 * frame's 1500-unit height being 720 px — a 66 px em, 138 units.
 */
export const CARD_SIZE = 138
/** ch1's two lines sit 89 px apart, baseline to baseline: 89 / 66.2 px. */
export const CARD_LINE_HEIGHT = 1.34
/** Ascender top above the baseline, in em (this renderer's Times; film: 46 / 66.2 px). */
const INK_TOP = 0.69
/**
 * The ink block's centre (first ascender top to last baseline) sits at
 * y = 363 px of the 720 px frame on every card, one line or two.
 */
const CARD_CENTRE = -(363 - 360) * (1500 / 720)

/**
 * The chapter's title card at its measured place, in the chapter's LOCAL
 * time: the words dissolve up, hold, and dissolve out exactly over the
 * chapter's measured `card` span. Text anchors on its first baseline, so
 * the baseline is dropped by half the ink height (and lifted by half the extra lines) to centre the block as the film does.
 * Leaves the dream's cursor where it found it.
 */
export function titleCard(dream: Dream, chapter: FilmChapter, size = CARD_SIZE): Text {
  const [fadeIn, up, fadeOut, gone] = chapter.card.map((t) => t - chapter.start)
  const lines = chapter.title.split("\n").length
  const y = CARD_CENTRE - (INK_TOP * size) / 2 + ((lines - 1) * CARD_LINE_HEIGHT * size) / 2
  const card = new Text({ content: chapter.title, font: SERIF, size, tint: WHITE, lineHeight: CARD_LINE_HEIGHT, y })
  dream.wait(fadeIn!)
  dream.play(FadeIn(card), up! - fadeIn!)
  dream.wait(fadeOut! - up!)
  dream.play(FadeOut(card), gone! - fadeOut!)
  dream.wait(-gone!)
  return card
}

/** Local seconds of video time `t` inside `chapter`. */
export const local = (chapter: FilmChapter, t: number): number => t - chapter.start
