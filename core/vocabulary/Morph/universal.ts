/**
 * Morph anything into anything — the route chosen by what the two are.
 *
 *     this.play(Morph(this.dot, this.truck), 4)          // a dot becomes a truck
 *     const m = Morph(this.truck, "truck")                // …or its word
 *     this.play(m, 5); this.play(m.back(), 5)            // and back
 *
 * `Morph(a, b)` returns an Anim (play it) that also carries `back()` — the
 * morph the other way — `route`, and `holons`, everything it built (the
 * morphers, a word). Those join the scene through the tracks that animate
 * them, so nothing needs staging; stage them yourself only to fix their
 * order. Declare the TARGET hidden (`opacity: 0`): the morph shows it.
 *
 * THE ROUTES (auto, or `route:` to choose)
 *
 *   "word"    b is a Word, or a string: through the line (MorphToWord) —
 *             the symbol settles into the word's baseline, the letters
 *             rise from it.
 *   "point"   one closed outline into one closed outline (a circle into a
 *             square): every point on its own path, rotated to the least
 *             travel — the classic morph, without pydeation's twist.
 *   "gather"  many curves into ONE closed curve (connection lines into a
 *             circle): a length-preserving partition, each curve a
 *             complementary arc, gathered angularly.
 *   "travel"  everything else (a dot into a truck, a truck into a pallet,
 *             3D ↔ 3D): strokes chained, flying rigidly on gentle arcs and
 *             bending late; small details flying whole or condensing.
 *
 * The camera is found by itself (a SolidDrawing's or Word's observer), or
 * pass `observer`. All of MorphCurves' and MorphToWord's options pass
 * through for when a route needs tuning.
 */

import type { Anim } from "../../src/anim"
import type { Observer } from "../../src/dream"
import type { Holon } from "../../src/holon"
import { SolidDrawing } from "../../src/parts/soliddrawing"
import { Word } from "../Word/Word"
import { MorphCurves, MorphMany, curvesOf, type MorphCurvesOptions, type MorphManyOptions } from "./MorphCurves"
import { MorphToWord, type WordMorphOptions } from "./MorphToWord"

export type MorphRoute = "word" | "point" | "gather" | "travel"

export interface MorphAnyOptions extends Omit<MorphCurvesOptions, "observer">, Omit<WordMorphOptions, "observer" | "order" | "snap" | "stagger" | "arc" | "minor" | "lag"> {
  observer?: Observer
  /** Choose the route instead of letting the shapes decide. */
  route?: MorphRoute
  /** MorphMany's: leave the source standing; the fill phases' lengths. */
  copy?: MorphManyOptions["copy"]
  fadeOut?: number
  fadeIn?: number
}

export interface MorphResult extends Anim {
  route: MorphRoute
  /** The morph there (this Anim's own tracks). */
  there(): Anim
  /** The morph back, b → a. */
  back(): Anim
  /** Everything it built. */
  holons: Holon[]
}

/** The observer a holon is drawn for, if it says. */
const viewerOf = (h: Holon): Observer | undefined =>
  h instanceof SolidDrawing || h instanceof Word ? h.observer : undefined

const closed = (c: readonly { x: number; y: number; z: number }[]) =>
  c.length > 3 && Math.hypot(c[0]!.x - c.at(-1)!.x, c[0]!.y - c.at(-1)!.y, c[0]!.z - c.at(-1)!.z) < 1e-6

/** Which route a → b takes, read off the two shapes. */
export const routeFor = (a: Holon, b: Holon | string): MorphRoute => {
  if (typeof b === "string" || b instanceof Word) return "word"
  const ca = curvesOf(a)
  const cb = curvesOf(b)
  if (ca.length === 1 && cb.length === 1 && closed(ca[0]!) && closed(cb[0]!) && !(a instanceof SolidDrawing) && !(b instanceof SolidDrawing))
    return "point"
  if (cb.length === 1 && closed(cb[0]!) && ca.length > 1 && !(b instanceof SolidDrawing)) return "gather"
  return "travel"
}

/** The route's MorphCurves settings (before the caller's overrides). */
const routeOptions = (route: MorphRoute): Partial<MorphCurvesOptions> =>
  route === "point"
    ? { travel: "lerp", lag: 0, chain: false, minor: 0, order: "angular" }
    : route === "gather"
      ? { order: "angular", snap: 0.05, minor: 0 }
      : { minor: 0.25 }

/** Morph a into b (see the header). */
export const morphAny = (a: Holon, b: Holon | string, opts: MorphAnyOptions = {}): MorphResult => {
  const route = opts.route ?? routeFor(a, b)
  const observer = opts.observer ?? viewerOf(a) ?? (typeof b === "string" ? undefined : viewerOf(b))
  const { copy, fadeOut, fadeIn, route: _r, ...rest } = opts
  const verb = { copy, fadeOut, fadeIn }
  if (route === "word") {
    const text = typeof b === "string" ? b : (b as Word).text
    const m = MorphToWord(a, text, { ...(rest as WordMorphOptions), observer, ...(b instanceof Word ? { into: b } : {}) })
    const there = m.there()
    return { ...there, route, there: () => there, back: () => m.back(), holons: m.holons }
  }
  const target = b as Holon
  const settings = { ...routeOptions(route), ...rest, observer, opacity: 0 }
  const there = new MorphCurves([a], [target], settings)
  const back = new MorphCurves([target], [a], settings)
  const anim = MorphMany(there, verb)
  return { ...anim, route, there: () => anim, back: () => MorphMany(back, verb), holons: [there, back] }
}
