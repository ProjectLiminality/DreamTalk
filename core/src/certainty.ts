/**
 * Certainty — what the data says, and what we are only painting.
 *
 * A universal visual language for knowledge (David, 2026-10-13): anything
 * driven by real data is drawn SOLID; anything mocked or merely conceptual —
 * "painting a picture" — is GHOSTED. Potentiality versus actuality: the
 * ghost is the wave function before the data collapses it. The more of a
 * picture that turns solid over a holon's git history, the more of the
 * knowledge has crystallised.
 *
 * Certainty is a holon-level ability, opt-in by declaration:
 *
 *     class Flow extends Null {
 *       certainty = certainty(0.2)   // conjecture
 *     }
 *
 * It is a completion param (0 = pure conjecture, 1 = hard data) that the
 * renderer recognises. Unlike `opacity`, which is per leaf, certainty
 * INHERITS: a leaf is as certain as the product of every certainty on it
 * and above it, so ghosting a whole branch is one param on the branch,
 * and a branch inside a ghosted whole stays ghosted however solid it
 * claims to be. A holon with no certainty anywhere above it is untouched —
 * `seenOpacity` hands the host its own opacity param back, so every scene
 * that never declares one renders exactly as it did.
 *
 * What a ghost LOOKS like is one function, `ghost(c)`: today translucency
 * with a floor, so even pure conjecture stays legible. The "quantum blur"
 * David wants later (a Heisenberg shimmer — the microscopic state unknown,
 * only the macroscopic one known) is drawn by the renderer itself:
 * render/superposition.ts gives every uncertain stroke and fill a small
 * cloud of breathing echoes that crystallise onto it as c → 1. `wobble()`
 * is the positional counterpart a holon can add to its own moving parts.
 */

import type { Holon } from "./holon"
import { completion, noteReads, paramEpoch, quietEpoch, trackReads, type Param, type Readable, type Reads } from "./params"

const CERTAINTIES = new WeakSet<Param<number>>()

/** Declare a holon's certainty: 1 = driven by real data, 0 = pure conjecture. */
export const certainty = (v = 1): Param<number> => {
  const p = completion(v)
  CERTAINTIES.add(p)
  return p
}

export const isCertainty = (p: unknown): p is Param<number> =>
  typeof p === "object" && p !== null && CERTAINTIES.has(p as Param<number>)

const PRESENCES = new WeakSet<Param<number>>()

/**
 * Declare a holon's PRESENCE: 1 there, 0 gone — for everything under it at
 * once. Opacity is per leaf; presence, like certainty, INHERITS (a product
 * down the tree), so one param fades a whole picture — strokes, fills,
 * text, particles — e.g. to blend one view into another. Unlike certainty
 * it is plain: no ghost floor, no blur.
 */
export const presence = (v = 1): Param<number> => {
  const p = completion(v)
  PRESENCES.add(p)
  return p
}

export const isPresence = (p: unknown): p is Param<number> =>
  typeof p === "object" && p !== null && PRESENCES.has(p as Param<number>)

/**
 * A host mounting a tree asks for the chain of every holon in it, parent
 * before child (three-host.ts mountChapter) — each one a walk to the root
 * over every param on the way. Inside `withChainMemo` the tree stands
 * still, so a chain is its holon's own params followed by its parent's
 * chain, kept for the pass: the same params in the same order, nearest
 * first. Outside it nothing is kept (a tree may still be growing).
 */
let chainMemo: { certainties: Map<Holon, Param<number>[]>; presences: Map<Holon, Param<number>[]> } | undefined
export const withChainMemo = <T>(fn: () => T): T => {
  if (chainMemo) return fn()
  chainMemo = { certainties: new Map(), presences: new Map() }
  try {
    return fn()
  } finally {
    chainMemo = undefined
  }
}
const chainOf = (holon: Holon, kind: (p: unknown) => boolean, memo: Map<Holon, Param<number>[]> | undefined): Param<number>[] => {
  if (!memo) {
    const out: Param<number>[] = []
    for (let node: Holon | undefined = holon; node; node = node.parent) {
      for (const p of node.params.values()) if (kind(p)) out.push(p as Param<number>)
    }
    return out
  }
  const hit = memo.get(holon)
  if (hit) return hit
  const out: Param<number>[] = []
  for (const p of holon.params.values()) if (kind(p)) out.push(p as Param<number>)
  const parent = holon.parent
  if (parent) for (const p of chainOf(parent, kind, memo)) out.push(p)
  memo.set(holon, out)
  return out
}

/** Every presence on this holon and above it. */
export const presencesOf = (holon: Holon): Param<number>[] => chainOf(holon, isPresence, chainMemo?.presences)

/** The ink pure conjecture keeps — a ghost is faint, never gone. */
export const GHOST_FLOOR = 0.28

/** How much of its ink a thing of certainty `c` shows. ghost(1) = 1 exactly. */
export const ghost = (c: number): number => {
  const k = c <= 0 ? 0 : c >= 1 ? 1 : c
  return GHOST_FLOOR + (1 - GHOST_FLOOR) * k
}

/** Every certainty on this holon and above it, nearest first. */
export const certaintiesOf = (holon: Holon): Param<number>[] => chainOf(holon, isCertainty, chainMemo?.certainties)

/** The certainty a holon is drawn with — the product down its chain. */
export const certaintyOf = (holon: Holon): number => {
  let c = 1
  for (const p of certaintiesOf(holon)) c *= p.value
  return c
}

/**
 * A leaf's inherited certainty as a live reading — or undefined when nothing
 * on or above it declares one (the renderer then adds no blur at all).
 */
export const seenCertainty = (holon: Holon): Readable<number> | undefined => {
  const chain = certaintiesOf(holon)
  if (chain.length === 0) return undefined
  return {
    get value() {
      let c = 1
      for (const p of chain) c *= p.value
      return c
    },
  }
}

/**
 * The opacity the renderer should draw a leaf with: its own fade times its
 * inherited presence times the ghost of its inherited certainty. With no
 * certainty and no presence anywhere above it, this IS `holon.opacity`
 * (same object), so nothing changes for anyone who never asked. The chain is captured once — a built holon's parents
 * are final — and read live, so certainty animates like any param.
 */
export const seenOpacity = (holon: Holon): Readable<number> => {
  const chain = certaintiesOf(holon)
  const there = presencesOf(holon)
  if (chain.length === 0 && there.length === 0) return holon.opacity
  const own = holon.opacity
  // Memoised per param change (paramEpoch): every leaf reads this every frame.
  // The memo keeps the reads it was computed from and replays them (READS,
  // params.ts), so a tracked reading stays transparent.
  let epoch = -1
  let seen = 0
  let reads: Reads = { deps: [], opaque: false }
  return {
    get value() {
      const now = quietEpoch()
      if (now !== epoch) {
        epoch = now
        reads = { deps: [], opaque: false }
        seen = trackReads(reads, () => {
          let c = 1
          for (const p of chain) c *= p.value
          let k = 1
          for (const p of there) k *= p.value
          return own.value * k * ghost(c)
        })
      }
      noteReads(reads.deps, reads.opaque)
      return seen
    },
  }
}

/**
 * Positional uncertainty — the hook for the quantum blur. A smooth,
 * deterministic offset (a few incommensurate sines, so it never visibly
 * loops) whose amplitude is `amp · (1 − c)`: certain things hold still,
 * conjectured ones hover where they might be. Pure f(seed, t, c).
 */
export const wobble = (
  seed: number,
  t: number,
  c: number,
  amp: number,
): { x: number; y: number } => {
  const u = (1 - (c <= 0 ? 0 : c >= 1 ? 1 : c)) * amp
  if (u === 0) return { x: 0, y: 0 }
  const s = seed * 12.9898
  const x = Math.sin(t * 1.7 + s) * 0.6 + Math.sin(t * 2.9 + s * 1.3) * 0.4
  const y = Math.sin(t * 2.3 + s * 0.7) * 0.6 + Math.sin(t * 3.7 + s * 1.9) * 0.4
  return { x: x * u, y: y * u }
}
