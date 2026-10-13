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
 *   "travel"  a pair alike enough to fly into each other (a dot into a
 *             truck, a shape into a moved or scaled copy): strokes chained,
 *             flying rigidly on gentle arcs and bending late; small details
 *             flying whole or condensing.
 *   "neutral" two shapes that share nothing (a truck and a pallet): no
 *             direct flight could make sense of that, so the morph goes
 *             THROUGH A NEUTRAL FORM — the first condenses into a circle
 *             facing the camera, the circle is held a beat, the second
 *             grows out of it (the word route's line, for solids; David's
 *             grain ladder: "a sphere is very neutral"). Chosen when the
 *             pair's `dissimilarity` is above `neutralAbove`.
 *
 * The camera is found by itself (a SolidDrawing's or Word's observer), or
 * pass `observer`. All of MorphCurves' and MorphToWord's options pass
 * through for when a route needs tuning.
 */

import { together, type Anim } from "../../src/anim"
import type { Observer } from "../../src/dream"
import type { Holon } from "../../src/holon"
import { Line, Stroke, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { chainCurves, planMorphDetailed } from "../../src/geometry/correspond"
import { SolidDrawing } from "../../src/parts/soliddrawing"
import { Word } from "../Word/Word"
import { MorphCurves, MorphMany, curvesOf, type MorphCurvesOptions, type MorphManyOptions } from "./MorphCurves"
import { MorphToWord, type WordMorphOptions } from "./MorphToWord"

export type MorphRoute = "word" | "point" | "gather" | "travel" | "neutral"

export interface MorphAnyOptions extends Omit<MorphCurvesOptions, "observer">, Omit<WordMorphOptions, "observer" | "order" | "snap" | "stagger" | "arc" | "minor" | "lag"> {
  observer?: Observer
  /** Choose the route instead of letting the shapes decide. */
  route?: MorphRoute
  /**
   * How unlike two shapes must be (similarity's residual, see
   * `dissimilarity`) before "travel" goes through the neutral form.
   * Default 0.03.
   */
  neutralAbove?: number
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

/**
 * How unlike two shapes are: plan the direct flight (chained strokes,
 * details) and measure how far, on average, each piece must still BEND
 * after its best rigid fit — relative to the pair's size. A shape and a
 * moved or scaled copy of itself: ~0. A truck and a pallet: 0.05–0.11.
 */
export const dissimilarity = (a: Holon, b: Holon, normal?: Vec3Like): number => {
  const ca = curvesOf(a)
  const cb = curvesOf(b)
  const all = [...ca.flat(), ...cb.flat()]
  if (!all.length) return 0
  const diag = (ps: Vec3Like[]) => {
    const span = (k: "x" | "y" | "z") => Math.max(...ps.map((p) => p[k])) - Math.min(...ps.map((p) => p[k]))
    return Math.hypot(span("x"), span("y"), span("z"))
  }
  const size = diag(all) || 1
  const sa = chainCurves(ca, diag(ca.flat()) * 0.004).curves
  const sb = chainCurves(cb, diag(cb.flat()) * 0.004).curves
  const plan = planMorphDetailed(sa, sb, { minor: 0.25, normal })
  let sum = 0
  let n = 0
  for (const p of plan.pieces) {
    if (p.condense) continue
    for (const r of p.motion.residual) {
      sum += Math.hypot(r.x, r.y, r.z)
      n++
    }
  }
  return n ? sum / n / size : 0
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
  let chosen: MorphRoute = route
  if (route === "travel" && !opts.route) {
    // A dot is already neutral: only two shapes of several strokes each
    // can be too unlike to fly straight into each other.
    const ca = curvesOf(a)
    const cb = curvesOf(target)
    const n = observer ? viewNormal(observer) : undefined
    if (ca.length > 1 && cb.length > 1 && dissimilarity(a, target, n) > (opts.neutralAbove ?? 0.03)) chosen = "neutral"
  }
  if (chosen === "neutral") return throughNeutral(a, target, observer, rest, verb)
  const settings = { ...routeOptions(route), ...rest, observer, opacity: 0 }
  const there = new MorphCurves([a], [target], settings)
  const back = new MorphCurves([target], [a], settings)
  const anim = MorphMany(there, verb)
  return { ...anim, route, there: () => anim, back: () => MorphMany(back, verb), holons: [there, back] }
}

/** Toward the camera (perspective direction is close enough for ordering). */
const viewNormal = (o: Observer): Vec3Like => ({
  x: Math.sin(o.phi.value) * Math.cos(o.theta.value),
  y: Math.sin(o.theta.value),
  z: Math.cos(o.phi.value) * Math.cos(o.theta.value),
})

/**
 * a → a camera-facing circle → b: the neutral route. The circle stands at
 * a's centre, its radius a third of the smaller shape's extent; it is a
 * derived Line laid in the camera's right/up plane, so it stays a circle
 * on screen however the camera stands when the morph plays. Held a beat
 * between the halves, like the word route's line.
 */
const throughNeutral = (
  a: Holon,
  b: Holon,
  observer: Observer | undefined,
  rest: Partial<MorphCurvesOptions>,
  verb: MorphManyOptions,
): MorphResult => {
  const box = (cs: Vec3Like[][]) => {
    const ps = cs.flat()
    const lo = { x: Infinity, y: Infinity, z: Infinity }
    const hi = { x: -Infinity, y: -Infinity, z: -Infinity }
    for (const p of ps)
      for (const k of ["x", "y", "z"] as const) {
        lo[k] = Math.min(lo[k], p[k])
        hi[k] = Math.max(hi[k], p[k])
      }
    return { c: { x: (lo.x + hi.x) / 2, y: (lo.y + hi.y) / 2, z: (lo.z + hi.z) / 2 }, d: Math.hypot(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z) }
  }
  const A = box(curvesOf(a))
  const B = box(curvesOf(b))
  const r = Math.min(A.d, B.d) / 6
  const centre = A.c
  const tint = a instanceof Stroke ? a.tint.value : undefined
  const circle = new Line({ opacity: 0, ...(tint ? { tint } : {}), ...(a instanceof Stroke ? { stroke: a.stroke } : {}) })
  const basis = () => {
    if (!observer) return { r: { x: 1, y: 0, z: 0 }, u: { x: 0, y: 1, z: 0 } }
    const back = viewNormal(observer)
    const right = { x: Math.cos(observer.phi.value), y: 0, z: -Math.sin(observer.phi.value) }
    const up = { x: back.y * right.z - back.z * right.y, y: back.z * right.x - back.x * right.z, z: back.x * right.y - back.y * right.x }
    return { r: right, u: up }
  }
  derivePoints(
    circle,
    () => (observer ? [observer.phi.value, observer.theta.value] : [0, 0]),
    () => {
      const { r: e1, u: e2 } = basis()
      return Array.from({ length: 97 }, (_, i) => {
        const t = (i % 96) / 96 * 2 * Math.PI
        return {
          x: centre.x + r * (Math.cos(t) * e1.x + Math.sin(t) * e2.x),
          y: centre.y + r * (Math.cos(t) * e1.y + Math.sin(t) * e2.y),
          z: centre.z + r * (Math.cos(t) * e1.z + Math.sin(t) * e2.z),
        }
      })
    },
  )
  const settings = { minor: 0.25, ...rest, observer, opacity: 0 }
  const aIn = new MorphCurves([a], [circle], { ...settings, order: "angular" as const })
  const outB = new MorphCurves([circle], [b], settings)
  const bIn = new MorphCurves([b], [circle], { ...settings, order: "angular" as const })
  const outA = new MorphCurves([circle], [a], settings)
  // The circle is HELD a beat between the halves.
  const two = (x: Anim, y: Anim): Anim => together([x, 0, 0.45], [y, 0.55, 1])
  const there = two(MorphMany(aIn, verb), MorphMany(outB, verb))
  return {
    ...there,
    route: "neutral",
    there: () => there,
    back: () => two(MorphMany(bIn, verb), MorphMany(outA, verb)),
    holons: [circle, aIn, outB, bIn, outA],
  }
}
