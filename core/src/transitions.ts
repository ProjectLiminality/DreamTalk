/**
 * Transitions — the vocabulary of chapter boundaries.
 *
 * ONTOLOGY.md "Magic Move: one operator, self-similar across levels":
 * a transition is an OVERLAP WINDOW between two chapters — the incoming
 * chapter's offset starts `duration` before the outgoing one ends, both
 * evaluate inside the window, and everything stays a pure f(t)
 * (EDITOR-V3 load-bearing decision 3: transitions compose timelines,
 * they never introduce sequencer state).
 *
 * This module is the pure half: the transition specs, the root-matching
 * rules, and the sampling arithmetic. DreamSong (song.ts) owns the
 * composition — where the windows sit and when each rule applies.
 */

import { C4D_SMOOTHING, c4dEaseWith } from "./timeline"
import { isColor, type Color } from "./constants"
import type { Holon } from "./holon"
import type { Param, ParamValue } from "./params"

/**
 * A per-boundary transition, stated on the INCOMING chapter of a
 * DreamSong's chapter list:
 *
 *   chapters: [S01, [S02, magicMove(1.5)], [S03, crossfade(1)], S04]
 *
 * `cut` (the default — a bare chapter says it implicitly) is a zero
 * overlap; the other two open a `duration`-second window in which both
 * chapters are live.
 */
export interface Transition {
  kind: "cut" | "crossfade" | "magicMove"
  /** Overlap in seconds — how long before A's end B's offset begins. */
  duration: number
}

/** The default boundary: B starts exactly when A ends. */
export const cut: Transition = { kind: "cut", duration: 0 }

/** A pure opacity ramp both ways across the overlap. */
export const crossfade = (duration: number): Transition => ({ kind: "crossfade", duration })

/**
 * Keynote's deepest trick, ontologically cleaned up: match holons across
 * A's state and B's state; matched pairs glide (transform, tint, stroke,
 * eased C4D-smooth), unmatched A builds out over the window's first 40%,
 * unmatched B builds in over its final 40%. The observer always matches
 * itself, so the camera glides between the scenes' perspectives.
 */
export const magicMove = (duration: number): Transition => ({ kind: "magicMove", duration })

/** The fraction of a magic-move window the build-out/in ramps occupy. */
export const BUILD_FRACTION = 0.4

/** The C4D auto-tangent ease every glide samples with (timeline.ts). */
export const smooth = (u: number): number => c4dEaseWith(u, C4D_SMOOTHING, C4D_SMOOTHING)

/** Build-out opacity factor for unmatched-A holons at window progress u. */
export const buildOut = (u: number): number => 1 - smooth(Math.min(u / BUILD_FRACTION, 1))

/** Build-in opacity factor for unmatched-B holons at window progress u. */
export const buildIn = (u: number): number =>
  smooth(Math.max((u - (1 - BUILD_FRACTION)) / BUILD_FRACTION, 0))

/**
 * The params a matched pair interpolates: the standard transform every
 * holon carries, plus the stroke face (tint, stroke width) where both
 * sides have it. Creation/erasure/opacity stay each side's own — a glide
 * moves and recolors, it does not redraw; true shape morphs come later.
 */
export const MATCHED_PARAM_NAMES = [
  "x",
  "y",
  "z",
  "h",
  "p",
  "b",
  "scale",
  "tint",
  "stroke",
] as const

/** Value lerp for the glide — numbers, colors, and (step-at-1) booleans. */
export const lerpParamValue = (a: ParamValue, b: ParamValue, u: number): ParamValue => {
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * u
  if (typeof a === "boolean" || typeof b === "boolean") return u >= 1 ? b : a
  if (isColor(a) && isColor(b)) {
    return {
      r: a.r + (b.r - a.r) * u,
      g: a.g + (b.g - a.g) * u,
      b: a.b + (b.b - a.b) * u,
    } satisfies Color
  }
  throw new Error("cannot interpolate between mismatched value types")
}

/**
 * The identity a root holon carries: the name of the Dream field that
 * holds it (the same field-name identity the editor outline reads).
 * Anonymous roots (built in arrays, or staged unnamed) answer undefined.
 */
export const rootIdentityOf = (owner: object, root: Holon): string | undefined => {
  for (const [key, value] of Object.entries(owner)) {
    if (value === root) return key
  }
  return undefined
}

export interface RootMatch {
  /** Matched A/B root pairs, in A's structural order. */
  pairs: [Holon, Holon][]
  /** A's unmatched roots — they build out. */
  outs: Holon[]
  /** B's unmatched roots — they build in. */
  ins: Holon[]
}

/**
 * Match two scenes' root holons for a magic move.
 *
 * First pass — identity: same class AND same Dream-field name. Second
 * pass — structure: the k-th remaining A root of a class pairs with the
 * k-th remaining B root of the same class. What survives both passes is
 * unmatched: A's build out, B's build in.
 *
 * The structural pass deliberately declines to pair two roots that BOTH
 * carry authored identities, because those identities differ — the
 * identity pass would have taken them otherwise. A DreamWeaving that
 * named one `moloch` and the other `labyrinth` has said they are
 * different things, and a fallback that matched them anyway would
 * override the author's own word with an accident of declaration order.
 * Structure is for the ANONYMOUS — compose()-generated parts, roots
 * built in arrays — where no name was ever written to contradict.
 */
export const matchRoots = (
  aOwner: object,
  aRoots: readonly Holon[],
  bOwner: object,
  bRoots: readonly Holon[],
): RootMatch => {
  const pairs: [Holon, Holon][] = []
  const outs = [...aRoots]
  const ins = [...bRoots]

  const take = (a: Holon, j: number): void => {
    pairs.push([a, ins[j]!])
    outs.splice(outs.indexOf(a), 1)
    ins.splice(j, 1)
  }

  for (const a of [...outs]) {
    const id = rootIdentityOf(aOwner, a)
    if (!id) continue
    const j = ins.findIndex(
      (b) => b.constructor === a.constructor && rootIdentityOf(bOwner, b) === id,
    )
    if (j >= 0) take(a, j)
  }
  for (const a of [...outs]) {
    const named = rootIdentityOf(aOwner, a) !== undefined
    const j = ins.findIndex(
      (b) =>
        b.constructor === a.constructor &&
        !(named && rootIdentityOf(bOwner, b) !== undefined),
    )
    if (j >= 0) take(a, j)
  }
  return { pairs, outs, ins }
}

export interface ParamPair {
  a: Param<ParamValue>
  b: Param<ParamValue>
}

/**
 * The interpolable params of a matched pair: every MATCHED_PARAM_NAMES
 * entry both sides carry and neither side has delegated to a derived
 * binding (a bound param cannot be written; its source animates it).
 */
export const matchedParams = (a: Holon, b: Holon): ParamPair[] => {
  const pairs: ParamPair[] = []
  for (const name of MATCHED_PARAM_NAMES) {
    const pa = a.params.get(name)
    const pb = b.params.get(name)
    if (pa && pb && !pa.isBound && !pb.isBound) pairs.push({ a: pa, b: pb })
  }
  return pairs
}
