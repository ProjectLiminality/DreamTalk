/**
 * Text — filled glyphs that Write themselves on per letter.
 *
 * The 2021 pipeline (vocabulary report §2.10): C4D text spline, every
 * letter wrapped as its own stroke, `Write` = per-letter domino of
 * DrawThenFillCompletely — each letter's outline draws over the first
 * 60% of its window, its solid fill fades in over the last 50%;
 * `UnWrite` runs the mirror. Here the letters are `three-text` glyph
 * geometry drawn through our own TSL node material (render/text.ts —
 * see its header for why troika lost the coin toss under WebGPU); the
 * whole cascade is a pure function of
 * ONE param, `creation`: each glyph owns a static domino window and
 * derives its outline-draw and fill phases from where the write front
 * sits inside it. Write is therefore just `creation` 0 → 1 — but on a
 * LINEAR track: pydeation's Domino already carries the global easing
 * (inverse-smoothstep midpoints + cosine-breathing durations), so the
 * default smooth param easing would double-ease the cascade.
 *
 * Why the cascade lives in the shader rather than in per-letter part
 * holons: the letters are not independent geometry here — they are
 * vertex ranges of one glyph buffer, tagged by glyph index. Making
 * each a Holon would buy nothing the shader does not already do per
 * vertex, and would cost a draw call per letter. The per-letter TIMING stays pure
 * CPU data (writeWindows / letterWindows below), so it is inspectable,
 * testable, and identical on both sides of the divide.
 *
 * Verbatim 2021 timing (animator.py Write/Domino): rel_overlap 0.7,
 * global_smoothing 0.7, rel_duration "dynamic" = 1 / (n·(1−0.7) + 1).
 */

import { Holon } from "../holon"
import { color, completion, length, type Param, type ParamValue } from "../params"
import { WHITE } from "../constants"
import { dominoWindows } from "./index"
import type { Anim, Track } from "../anim"

/** pydeation Write(): Domino(rel_overlap=0.7, global_smoothing=0.7). */
export const WRITE_REL_OVERLAP = 0.7
export const WRITE_GLOBAL_SMOOTHING = 0.7
/** DrawThenFillCompletely: draw occupies [0, 0.6] of a letter's window… */
export const DRAW_WINDOW: readonly [number, number] = [0, 0.6]
/** …and the solid fill fades in over [0.5, 1] (they overlap by design). */
export const FILL_WINDOW: readonly [number, number] = [0.5, 1]

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/**
 * The per-letter domino windows for a glyph count, exactly as the 2021
 * Write dealt them: the dynamic relative duration derived from the
 * overlap, then the shared domino algebra (parts/index dominoWindows).
 */
export const writeWindows = (glyphCount: number): [number, number][] =>
  dominoWindows(
    glyphCount,
    1 / (glyphCount * (1 - WRITE_REL_OVERLAP) + 1),
    WRITE_GLOBAL_SMOOTHING,
  )

/**
 * One letter's sub-phases from its local window progress p ∈ [0, 1]:
 * `draw` sweeps the outline on, `fill` fades the solid glyph in.
 * Pure — the TSL fragment stage re-derives exactly this, and the tests
 * pin it so the two cannot drift.
 */
export const writePhases = (p: number): { draw: number; fill: number } => ({
  draw: clamp01((p - DRAW_WINDOW[0]) / (DRAW_WINDOW[1] - DRAW_WINDOW[0])),
  fill: clamp01((p - FILL_WINDOW[0]) / (FILL_WINDOW[1] - FILL_WINDOW[0])),
})

/**
 * The letters the domino runs over: non-whitespace characters, in
 * order. The renderer dominoes over the shaper's actual renderable
 * glyphs (whitespace never produces one), so for plain Latin text
 * these counts agree; a font ligature can fuse two letters into one
 * glyph — one domino step, accepted (the 2021 C4D letters had none).
 */
export const letters = (content: string): string[] =>
  [...content].filter((c) => !/\s/.test(c))

export const letterCount = (content: string): number => letters(content).length

/** One letter's place in the cascade — what per-letter access returns. */
export interface Letter {
  /** The character itself. */
  char: string
  /** Its index among the renderable glyphs (whitespace excluded). */
  index: number
  /** Its domino window within `creation` ∈ [0, 1]. */
  window: [number, number]
}

/** A creation track with LINEAR easing — see the module header. */
const linearCreation = (param: Param<number>, values: number[]): Anim => {
  const track: Track = {
    param: param as Param<ParamValue>,
    mode: "sequence",
    values,
    relStart: 0,
    relStop: 1,
    easing: "linear",
  }
  return { tracks: [track] }
}

/**
 * Text — content is data (like Line.points), look is params. `size` is
 * the font size (the 2021 `height`, default 50 — "trans-perspectival");
 * `stroke` is the 2021 TEXT_THICKNESS (5), kept because the vocabulary
 * records it and an outlined variant may want it — the current glyph
 * renderer draws filled letterforms and does not read it; `font`
 * optionally overrides the renderer's default font URL (bundled Arimo
 * — Helvetica/Arial-class; see the open font question in the
 * vocabulary report's Risks).
 */
export class Text extends Holon {
  content = "Text"
  font: string | undefined = undefined
  size = length(50)
  tint = color(WHITE)
  stroke = length(5)
  /**
   * The UN-write front — the same forward domino as `creation`, running
   * a second time to take the letters away.
   *
   * pydeation's UnWrite is `Domino(UnFillThenUnDraw, …)`
   * (animator.py:128-140): the SAME cascade order as Write, with each
   * letter's own animation reversed inside its window. So un-writing is
   * NOT `creation` running backwards — that would take the last letter
   * first — and video-01's f0778-f0782 show the reference losing
   * "dialectical" while "thinking" still stands, i.e. first letter out
   * first. A separate forward front is the honest reading, and it is
   * the same word the Stroke family already uses for a front that
   * consumes in draw direction (`erasure`).
   */
  erasure = completion(0)

  /** The letters of `content` with their domino windows, in order. */
  get letters(): Letter[] {
    const chars = letters(this.content)
    const windows = writeWindows(chars.length)
    return chars.map((char, index) => ({ char, index, window: windows[index]! }))
  }

  /**
   * One letter's live write progress at the current `creation` — the
   * same p the shader computes for that glyph. Useful for binding other
   * holons to a letter's arrival (and for the harness's frame checks).
   */
  letterProgress(index: number): number {
    const letter = this.letters[index]
    if (!letter) return 0
    const [start, stop] = letter.window
    return clamp01((this.creation.value - start) / Math.max(stop - start, 1e-6))
  }

  /** The draw/fill phases of one letter right now. */
  letterPhases(index: number): { draw: number; fill: number } {
    return writePhases(this.letterProgress(index))
  }

  /** One letter's live UN-write progress at the current `erasure`. */
  letterErasure(index: number): number {
    const letter = this.letters[index]
    if (!letter) return 0
    const [start, stop] = letter.window
    return clamp01((this.erasure.value - start) / Math.max(stop - start, 1e-6))
  }

  /**
   * The draw/fill phases of one letter under BOTH fronts — what the
   * shader actually shows. The write front raises the letter's phase and
   * the erase front lowers it back down through fill and then draw, so
   * the two compose as min(write, 1 − erase) and the letter's own
   * sub-phases are the ordinary writePhases() of that composed progress
   * (render/text.ts re-derives exactly this per fragment).
   */
  letterPhasesNow(index: number): { draw: number; fill: number } {
    return writePhases(Math.min(this.letterProgress(index), 1 - this.letterErasure(index)))
  }

  /** Create(text) IS Write — the domino lives in the glyph shader. */
  override createAnim(): Anim {
    return linearCreation(this.creation, [0, 1])
  }

  /** UnCreate(text) IS UnWrite — the erase front, not creation reversed. */
  override unCreateAnim(): Anim {
    return linearCreation(this.erasure, [0, 1])
  }
}

/** The classic verb spellings (per-letter domino draw-then-fill). */
export const Write = (text: Text): Anim => linearCreation(text.creation, [0, 1])

/** UnWrite: the same forward domino — fill recedes, then the outline retracts. */
export const UnWrite = (text: Text): Anim => linearCreation(text.erasure, [0, 1])
