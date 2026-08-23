/**
 * The classic animation verbs, operating on the standard params.
 * Abilities belong to objects, not stuntman classes — these are just
 * convenient spellings of param animations, applied holon-deep.
 *
 * Create dispatches per class: a holon that owns a choreography
 * (`createAnim()` — Eye's lids-then-iris, Axes' domino cascade)
 * creates by it; everything else draws on deep-parallel. UnDraw and
 * Erase are the video-01 asymmetry: UnDraw retracts the draw front
 * (back-to-front), Erase advances the consume front (front-to-back —
 * grids "sweep away").
 */

import { together, type Anim } from "./anim"
import type { Holon } from "./holon"
import { Stroke } from "./parts/index"

const deep = (holon: Holon, f: (h: Holon) => Anim): Anim =>
  together(...[...holon.walk()].map(f))

const none: Anim = { tracks: [] }

/**
 * Emerge from nothing. Consults the holon's own choreography
 * (`createAnim()`), recursively per part; the default is draw-on
 * 0 → 1, deep-parallel.
 */
export const Create = (holon: Holon): Anim => {
  const custom = holon.createAnim()
  if (custom) return custom
  return together(holon.creation.sequence(0, 1), ...holon.parts.map((part) => Create(part)))
}

/**
 * Retract into nothing. Consults the holon's own choreography
 * (`unCreateAnim()`) — the destructive half of the classic dispatch,
 * where UnCreateAxes erases and UnCreateEye unfills before it undraws —
 * and otherwise runs the draw front back to the start, holon-deep.
 */
export const UnCreate = (holon: Holon): Anim => {
  const custom = holon.unCreateAnim()
  if (custom) return custom
  return deep(holon, (h) => h.creation.to(0))
}

export const Draw = Create

/** The report's vocabulary: UnDraw IS the retract (completion → 0). */
export const UnDraw = UnCreate

/**
 * Consume front-to-back: the stroke disappears in draw direction — the
 * drawn front stays put while the tail retreats after it. Distinct
 * from UnDraw by design (video-01 grids erase; primitives un-draw).
 * Applies to strokes; other holons in the tree are untouched. Note:
 * an erased stroke stays consumed (erasure holds 1) — re-Creating it
 * needs its erasure animated back to 0 first.
 */
export const Erase = (holon: Holon): Anim =>
  deep(holon, (h) => (h instanceof Stroke ? h.erasure.sequence(0, 1) : none))

export const FadeIn = (holon: Holon): Anim =>
  deep(holon, (h) => h.opacity.sequence(0, 1))

export const FadeOut = (holon: Holon): Anim =>
  deep(holon, (h) => h.opacity.to(0))

export const Move = (
  holon: Holon,
  delta: { x?: number; y?: number; z?: number },
): Anim => {
  const anims: Anim[] = []
  if (delta.x !== undefined) anims.push(holon.x.by(delta.x))
  if (delta.y !== undefined) anims.push(holon.y.by(delta.y))
  if (delta.z !== undefined) anims.push(holon.z.by(delta.z))
  return together(...anims)
}

export const Scale = (holon: Holon, factor: number): Anim =>
  holon.scale.to(factor)

export const Rotate = (
  holon: Holon,
  delta: { h?: number; p?: number; b?: number },
): Anim => {
  const anims: Anim[] = []
  if (delta.h !== undefined) anims.push(holon.h.by(delta.h))
  if (delta.p !== undefined) anims.push(holon.p.by(delta.p))
  if (delta.b !== undefined) anims.push(holon.b.by(delta.b))
  return together(...anims)
}
