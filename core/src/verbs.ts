/**
 * The classic animation verbs, operating on the standard params.
 * Abilities belong to objects, not stuntman classes — these are just
 * convenient spellings of param animations, applied holon-deep.
 */

import { together, type Anim } from "./anim"
import type { Holon } from "./holon"

const deep = (holon: Holon, f: (h: Holon) => Anim): Anim =>
  together(...[...holon.walk()].map(f))

/** Emerge from nothing: draw-on 0 → 1, holon-deep. */
export const Create = (holon: Holon): Anim =>
  deep(holon, (h) => h.creation.sequence(0, 1))

export const UnCreate = (holon: Holon): Anim =>
  deep(holon, (h) => h.creation.to(0))

export const Draw = Create

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
