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

import { together, type Anim } from "../../src/anim"
import type { Observer } from "../../src/dream"
import type { Holon, Overrides } from "../../src/holon"
import { Line, Null, Stroke, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import type { Color } from "../../src/constants"
import { wordOutline } from "../../src/geometry/glyphs"
import { ARIMO } from "../../src/geometry/fonts/arimo"
import type { CorrespondOrder } from "../../src/geometry/correspond"
import { Word } from "../Word/Word"
import { MorphCurves, MorphMany, curvesOf, signatureOf } from "./MorphCurves"

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
  /** Morph into THIS word (already declared) instead of building one. */
  into?: Word
  /** Travel as a point-wise lerp with this `lag` instead of rigid flight (MorphCurves). */
  lag?: number
  /** MorphCurves' `snap` — keep whole strokes whole. Default 0.04. */
  snap?: number
  /** Letters arrive one after another over this fraction of the morph. Default 0.35. */
  stagger?: number
  /** How far the strokes' paths bow. Default 0.15. */
  arc?: number
  /** Details threshold (MorphCurves `minor`). Default 0.25. */
  minor?: number
  /**
   * "line" (default): through the word's baseline — the symbol settles into
   * one line, the letters rise from it. "none": straight from the symbol's
   * strokes to the letters.
   */
  via?: "line" | "none"
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
  /** Everything it built, for the scene to stage (a Dream's holons are its declared fields). */
  holons: Holon[]
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
  const word = opts.into ?? new Word(text, {
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
  // Reading order follows the camera as it is WHEN THE MORPH RUNS (a scene
  // sets its camera in unfold, after this is built).
  const liveAxis = () => readingAxis(observer)
  const morphOpts = {
    observer,
    opacity: 0,
    order,
    axis: liveAxis,
    // Whole strokes to whole letters where the lengths allow (snap), the
    // letters arriving one after another in reading order (stagger), each
    // stroke flying as a body on a gentle arc.
    snap: opts.snap ?? 0.04,
    stagger: opts.stagger ?? 0.35,
    // The symbol's small closed details (wheels, windows) fly whole onto
    // the word's (an i's dot, a counter) or condense where they are.
    minor: opts.minor ?? 0.25,
    arc: opts.arc ?? 0.15,
    ...(opts.lag !== undefined ? { lag: opts.lag, travel: "lerp" as const } : {}),
    ...(symbol instanceof Stroke ? { stroke: symbol.stroke } : {}),
  }
  if ((opts.via ?? "line") === "none") {
    const toWord = new MorphCurves([symbol], [word], morphOpts)
    const toSymbol = new MorphCurves([word], [symbol], morphOpts)
    return {
      word,
      toWord,
      toSymbol,
      holons: [word, toWord, toSymbol],
      there: () => MorphMany(toWord),
      back: () => MorphMany(toSymbol),
    }
  }
  // VIA THE LINE: the symbol is squashed flat onto the word's baseline —
  // every point slides straight across onto the line through its centre
  // along the reading direction, nothing turns or flies — so the overlapping
  // flattened strokes ARE the line; then the letters rise from it. The
  // middle of the morph is a single clean line: the essence held for a
  // beat between the thing and its name.
  const along0 = (p: Vec3Like, a: Vec3Like) => (p.x - centre.x) * a.x + (p.y - centre.y) * a.y + (p.z - centre.z) * a.z
  const flat = new Null()
  // (The symbol's curves read live, each point projected onto the baseline.)
  Object.assign(flat, {
    // What moves its curves: the symbol's, and the reading direction.
    curveSignature: (): number[] => {
      const a = liveAxis()
      return [...signatureOf(symbol), a.x, a.y, a.z]
    },
    worldCurves: (): Vec3Like[][] => {
      const a = liveAxis()
      return curvesOf(symbol).map((c) =>
        c.map((p) => {
          const s = along0(p, a)
          return { x: centre.x + a.x * s, y: centre.y + a.y * s, z: centre.z + a.z * s }
        }),
      )
    },
  })
  // The line spans what the squash covers, and follows the camera (it lies
  // along the camera's right, the way the word does), level on screen
  // whatever the view.
  const line = new Line({
    opacity: 0,
    ...(tint ? { tint } : {}),
    ...(symbol instanceof Stroke ? { stroke: symbol.stroke } : {}),
  })
  derivePoints(
    line,
    () => {
      const a = liveAxis()
      return [a.x, a.y, a.z]
    },
    () => {
      const a = liveAxis()
      const s = curvesOf(symbol).flat().map((p) => along0(p, a))
      const lo = s.length ? Math.min(...s) : -symbolWidth / 2
      const hi = s.length ? Math.max(...s) : symbolWidth / 2
      return [
        { x: centre.x + a.x * lo, y: centre.y + a.y * lo, z: centre.z + a.z * lo },
        { x: centre.x + a.x * hi, y: centre.y + a.y * hi, z: centre.z + a.z * hi },
      ]
    },
  )
  // Point for point, straight, all at once: a calm settling, not a flight.
  const squashOpts = { ...morphOpts, pairwise: true, travel: "lerp" as const, lag: 0, chain: false }
  const toLine = new MorphCurves([symbol], [flat], squashOpts)
  const lineToWord = new MorphCurves([line], [word], morphOpts)
  const wordToLine = new MorphCurves([word], [line], morphOpts)
  const lineToSymbol = new MorphCurves([flat], [symbol], squashOpts)
  // The line is HELD for a beat between the two halves; it stands in for
  // the flattened strokes the moment they are flat, and gives way to them
  // as the symbol stands up again.
  const half2 = (a: Anim, b: Anim): Anim => together([a, 0, 0.45], [b, 0.53, 1])
  return {
    word,
    toWord: toLine,
    toSymbol: lineToSymbol,
    holons: [word, line, flat, toLine, lineToWord, wordToLine, lineToSymbol],
    there: () => half2(together([MorphMany(toLine), 0, 1], [line.opacity.to(1), 0.98, 1]), MorphMany(lineToWord)),
    back: () => half2(MorphMany(wordToLine), together([line.opacity.to(0), 0, 0.02], [MorphMany(lineToSymbol), 0, 1])),
  }
}
