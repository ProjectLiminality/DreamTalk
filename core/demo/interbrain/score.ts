/**
 * score.ts — the authoring helpers the InterBrain chapter scenes share:
 * place a clip at a VIDEO time, and fade a whole tableau in and out by one
 * number.
 *
 * A chapter is written against the film's clock (song time = video time,
 * film.ts), so every beat reads as the frame number it was measured on:
 * `this.at(96, 1.2, d.chaos.to(1))` is "Chaos strikes at 1:36". The helper
 * converts to the chapter's local time and moves the dream's cursor there —
 * forwards or back (Dream.wait accepts a negative step, as titleCard uses),
 * so beats may be stated in any order; each param's clips resolve
 * chronologically in the timeline anyway.
 *
 * A TABLEAU is a `Layer` (Figure's: a Group whose `presence` every leaf
 * inherits) holding the holons of one shot. Fading the layer fades the shot
 * without claiming any member's own opacity — the holons keep their params
 * for their states.
 */

import { Dream } from "../../src/dream"
import { eased, together, type Anim } from "../../src/anim"
import type { Holon } from "../../src/holon"
import type { Param } from "../../src/params"
import { Layer } from "../../vocabulary/Figure/Figure"
import { CHAPTERS, titleCard, type FilmChapter } from "./film"

/** Default observer: 720 px across 1500 units at z = 0. */
export const PX = 720 / 1500
/** Frame pixels (from the 1280×720 frame's centre, y up) → scene units. */
export const px = (v: number): number => v / PX

/**
 * The card's em in units: f61's "In Search of the" is ≈420 px wide, 7.2 em of
 * Times — a 58 px em (film.ts's default 34 units sets it at 16 px).
 */
export const TITLE_SIZE = px(58)

export abstract class ChapterDream extends Dream {
  /** Which chapter (index into CHAPTERS). */
  protected abstract readonly chapterIndex: number
  /** The cursor in VIDEO seconds. */
  #now = 0

  protected get chapter(): FilmChapter {
    return CHAPTERS[this.chapterIndex]!
  }

  /** Move the cursor to video time `t`. */
  protected go(t: number): void {
    const local = t - this.chapter.start
    this.wait(local - this.#now)
    this.#now = local
  }

  /** Play `anims` together from video time `t` for `dur` seconds. */
  protected at(t: number, dur: number, ...anims: Anim[]): void {
    this.go(t)
    this.play(together(...anims), dur)
    this.#now += dur
  }

  /** Instant values at video time `t`. */
  protected setAt(t: number, ...anims: Anim[]): void {
    this.go(t)
    this.set(...anims)
  }

  /** A tableau: holons faded as one. Hidden until `show` brings it up. */
  protected tableau(...members: Holon[]): Layer {
    return new Layer({ members })
  }

  /** Fade `layer` up over [t0, t0+fi] and away over [t1−fo, t1]. */
  protected show(layer: Layer, t0: number, t1: number, fi = 1, fo = 1): void {
    this.at(t0, fi, layer.presence.sequence(0, 1))
    this.at(t1 - fo, fo, layer.presence.to(0))
  }

  /** Run a clock param at an even pace from `t0` to `t1`, `rate` units a second, from `from`; returns where it ends. */
  protected clock(param: Param<number>, t0: number, t1: number, from: number, rate: number): number {
    const to = from + (t1 - t0) * rate
    this.at(t0, t1 - t0, eased("linear", param.sequence(from, to)))
    return to
  }

  /** The title card, then the chapter's own beats; the duration is the window's, exactly. */
  unfold(): void {
    this.go(this.chapter.start)
    titleCard(this, this.chapter, TITLE_SIZE)
    this.beats()
    this.go(this.chapter.end)
  }

  protected abstract beats(): void
}
