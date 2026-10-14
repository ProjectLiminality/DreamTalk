/**
 * Glow — the one look of ATTENTION: "this is selected / hovered / attended
 * to" (David, 2026-10-13: "a generic golden glow that can be used anywhere
 * as the visual expression of this thing being selected").
 *
 * A glow is a soft golden halo that follows a holon's actual ink — every
 * stroke, every fill's edge, in 2D and 3D, from any camera — drawn by the
 * same soft-echo machinery that draws uncertainty (render/echo.ts). Being
 * looked at does not change a thing, so the light is ADDITIONAL: the halo
 * lies around the ink, never on it, and the ink keeps its own colour.
 *
 * Two ways in, one picture:
 *
 *  - the INTERACTION layer — `host.attend(channel, holon, amount)`: the
 *    editor's selection and hover, creator mode's dot, the game loop's
 *    handles. It lives in the host, never in the Dream, so no capture,
 *    export or gauntlet frame can carry it (nothing there calls attend).
 *  - an AUTHORED glow — a scene that wants the light as an effect declares
 *    it like certainty, and animates it like any param:
 *
 *        class Beacon extends Circle {
 *          glow = glow(0)            // this.play(beacon.glow.to(1), 1)
 *        }
 *
 * Intensity is one number: 0 = none, HOVER = a faint invitation, 1 =
 * selected. A glow INHERITS down the tree as a max — glowing a whole
 * glows all its parts — and a holon with no glow anywhere above it, and
 * no attention, gets no halo at all: not a hidden one, none.
 */

import type { Holon } from "./holon"
import { completion, type Param, type Readable } from "./params"

const GLOWS = new WeakSet<Param<number>>()

/** Declare an authored glow: 0 = none, 1 = full attention. */
export const glow = (v = 0): Param<number> => {
  const p = completion(v)
  GLOWS.add(p)
  return p
}

export const isGlow = (p: unknown): p is Param<number> =>
  typeof p === "object" && p !== null && GLOWS.has(p as Param<number>)

/** The intensities the interaction layer speaks in. */
export const HOVER = 0.4
export const SELECTED = 1

/** Every glow on this holon and above it, nearest first. */
export const glowsOf = (holon: Holon): Param<number>[] => {
  const out: Param<number>[] = []
  for (let node: Holon | undefined = holon; node; node = node.parent) {
    for (const p of node.params.values()) if (isGlow(p)) out.push(p as Param<number>)
  }
  return out
}

/**
 * A leaf's inherited authored glow as a live reading (the max down its
 * chain) — or undefined when nothing on or above it declares one.
 */
export const seenGlow = (holon: Holon): Readable<number> | undefined => {
  const chain = glowsOf(holon)
  if (chain.length === 0) return undefined
  return {
    get value() {
      let g = 0
      for (const p of chain) if (p.value > g) g = p.value
      return g
    },
  }
}

/**
 * The breath of a glow — a slow swell in [1 − depth, 1], pure f(t). A held
 * glow breathes; `breathe(t, 0)` is exactly 1.
 */
export const breathe = (t: number, depth = 0.18): number =>
  1 - depth * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 3.2))
