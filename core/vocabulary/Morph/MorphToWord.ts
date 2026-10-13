/**
 * MorphToWord — a symbol becoming its written word, and back.
 *
 * "Words are symbols of symbols, twice removed from reality. DreamTalk
 * symbols are the universal layer beneath language." (CLAUDE.md, Current
 * Horizons #4.) So the word is not a label beside the symbol: the
 * symbol's own lines BECOME the letters, by arc length (MorphCurves), the
 * symbol's fill fading as its outline leaves and the word's ink filling
 * in as the letters land — and the same in reverse.
 *
 *     m = MorphToWord(this.truck, "truck", { observer: this.observer })
 *     // stage what it built — a Dream's holons are its declared fields:
 *     word = m.word; toWord = m.toWord; toSymbol = m.toSymbol
 *     …
 *     this.play(m.there(), 3.5)
 *     this.play(m.back(), 3.5)
 *
 * The word appears where the symbol is, as wide as the symbol is (`size`
 * overrides), facing the camera when an observer is given. The pieces
 * are shared out along the READING direction and gathered round each
 * letter (`order: "sweep-angular"`, the camera's right as the axis): the
 * symbol's left becomes the first letter, its right the last, and each
 * letter closes around itself. Pass `order: "angular"` for one radial
 * gathering instead.
 */

import type { Anim } from "../../src/anim"
import type { Observer } from "../../src/dream"
import type { Holon, Overrides } from "../../src/holon"
import { Stroke, type Vec3Like } from "../../src/parts/primitives"
import type { Color } from "../../src/constants"
import { wordOutline } from "../../src/geometry/glyphs"
import { ARIMO } from "../../src/geometry/fonts/arimo"
import type { CorrespondOrder } from "../../src/geometry/correspond"
import { Word } from "../Word/Word"
import { MorphCurves, MorphMany, curvesOf } from "./MorphCurves"

export interface WordMorphOptions {
  observer?: Observer
  /** The word's em size; default: the word as wide as the symbol (× `fit`). */
  size?: number
  /** Word width / symbol width when sizing automatically. Default 0.9. */
  fit?: number
  /** The word's ink. Default the symbol's tint. */
  tint?: Color
  /** Piece order (MorphCurves). Default "sweep" along the reading direction. */
  order?: CorrespondOrder
  /** Where the word stands. Default the centre of the symbol's curves. */
  at?: Vec3Like
  /** Overrides for the Word (stroke, …). */
  word?: Overrides
  /** Travel as a point-wise lerp with this `lag` instead of rigid flight (MorphCurves). */
  lag?: number
  /** MorphCurves' `snap` — keep whole strokes whole. Default 0.04. */
  snap?: number
  /** Letters arrive one after another over this fraction of the morph. Default 0.35. */
  stagger?: number
  /** How far the strokes' paths bow. Default 0.15. */
  arc?: number
}

export interface WordMorph {
  /** The written word — staged hidden; the morph shows it. */
  word: Word
  /** The symbol's curves → the word's. */
  toWord: MorphCurves
  /** The word's curves → the symbol's. */
  toSymbol: MorphCurves
  /** The morph there, as an Anim (MorphMany: fill out → travel → fill in). */
  there(): Anim
  /** And back. */
  back(): Anim
}

/** The camera's right on screen (the reading direction), or +x without one. */
const readingAxis = (o?: Observer): Vec3Like =>
  o ? { x: Math.cos(o.phi.value), y: 0, z: -Math.sin(o.phi.value) } : { x: 1, y: 0, z: 0 }

/**
 * Build the word and both morphers for `symbol` ↔ `text`. Reads the
 * symbol's curves NOW (construction time — the declaration's pose) to
 * place and size the word; the morphs themselves read them live.
 */
export const MorphToWord = (symbol: Holon, text: string, opts: WordMorphOptions = {}): WordMorph => {
  const { observer } = opts
  const curves = curvesOf(symbol)
  const pts = curves.flat()
  const axis = readingAxis(observer)
  const centre =
    opts.at ??
    (pts.length
      ? (() => {
          const lo = { x: Infinity, y: Infinity, z: Infinity }
          const hi = { x: -Infinity, y: -Infinity, z: -Infinity }
          for (const p of pts) {
            lo.x = Math.min(lo.x, p.x)
            lo.y = Math.min(lo.y, p.y)
            lo.z = Math.min(lo.z, p.z)
            hi.x = Math.max(hi.x, p.x)
            hi.y = Math.max(hi.y, p.y)
            hi.z = Math.max(hi.z, p.z)
          }
          return { x: (lo.x + hi.x) / 2, y: (lo.y + hi.y) / 2, z: (lo.z + hi.z) / 2 }
        })()
      : { x: 0, y: 0, z: 0 })
  const along = pts.map((p) => p.x * axis.x + p.y * axis.y + p.z * axis.z)
  const symbolWidth = along.length ? Math.max(...along) - Math.min(...along) : 100
  const unit = wordOutline(text, ARIMO, { size: 1 }).flat()
  const unitWidth = unit.length ? Math.max(...unit.map((p) => p.x)) - Math.min(...unit.map((p) => p.x)) : 1
  const size = opts.size ?? ((opts.fit ?? 0.9) * symbolWidth) / Math.max(1e-6, unitWidth)
  const tint = opts.tint ?? (symbol instanceof Stroke ? symbol.tint.value : undefined)
  const word = new Word(text, {
    observer,
    size,
    x: centre.x,
    y: centre.y,
    z: centre.z,
    opacity: 0,
    ...(tint ? { tint } : {}),
    ...opts.word,
  })
  const order = opts.order ?? "sweep-angular"
  const morphOpts = {
    observer,
    opacity: 0,
    order,
    axis,
    // Whole strokes to whole letters where the lengths allow (snap), the
    // letters arriving one after another in reading order (stagger), each
    // stroke flying as a body on a gentle arc.
    snap: opts.snap ?? 0.04,
    stagger: opts.stagger ?? 0.35,
    arc: opts.arc ?? 0.15,
    ...(opts.lag !== undefined ? { lag: opts.lag, travel: "lerp" as const } : {}),
    ...(symbol instanceof Stroke ? { stroke: symbol.stroke } : {}),
  }
  const toWord = new MorphCurves([symbol], [word], morphOpts)
  const toSymbol = new MorphCurves([word], [symbol], morphOpts)
  return {
    word,
    toWord,
    toSymbol,
    there: () => MorphMany(toWord),
    back: () => MorphMany(toSymbol),
  }
}
