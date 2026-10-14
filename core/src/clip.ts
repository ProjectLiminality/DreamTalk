/**
 * Clip — a holon's ink seen only through a window.
 *
 * Geometry can trim itself (Road's `bound` keeps the road's points inside
 * a lens), but ink is wider than its points: a stroke's width, a soft
 * echo's spread, a glow's aura all overhang a trimmed end. A CLIP is the
 * renderer's half of the same promise: a holon declares that its subtree
 * is seen only within a DISC — any Circle-like holon (one with a `radius`
 * param), its local XY disc as it appears on screen — and the host drops
 * every fragment of that subtree's strokes, fills, echoes and halos that
 * falls outside it.
 *
 *     clip(content, () => this.disc)    // the lens's near face
 *
 * A clip INHERITS: a holon is clipped by the nearest clip declared on it
 * or above it. A scene that declares none renders exactly as before — the
 * host never even switches a material.
 */

import type { Holon } from "./holon"

/** The disc a subtree is seen through: a holon with a `radius`, in its own XY plane. */
export interface ClipRegion {
  readonly disc: () => Holon
}

const CLIPS = new WeakMap<Holon, ClipRegion>()

/** Declare that `holon`'s whole subtree is seen only within `disc`'s disc. */
export const clip = (holon: Holon, disc: () => Holon): ClipRegion => {
  const region: ClipRegion = { disc }
  CLIPS.set(holon, region)
  return region
}

/** The clip a holon is drawn under — the nearest on it or above it — or undefined. */
export const clipOf = (holon: Holon): ClipRegion | undefined => {
  for (let node: Holon | undefined = holon; node; node = node.parent) {
    const region = CLIPS.get(node)
    if (region) return region
  }
  return undefined
}

/**
 * Is a screen point inside a clip's ellipse (centre `c`, semi-axes `u`, `v`
 * in pixels)? The coverage the shaders compute, as a pure function: 1 well
 * inside, 0 well outside, a one-pixel ramp across the rim.
 */
export const clipCoverage = (
  p: { x: number; y: number },
  c: { x: number; y: number },
  u: { x: number; y: number },
  v: { x: number; y: number },
): number => {
  const dx = p.x - c.x
  const dy = p.y - c.y
  const det = u.x * v.y - u.y * v.x
  if (Math.abs(det) < 1e-9) return 0
  const a = (dx * v.y - dy * v.x) / det
  const b = (u.x * dy - u.y * dx) / det
  const r = Math.hypot(a, b)
  const px = Math.min(Math.hypot(u.x, u.y), Math.hypot(v.x, v.y))
  return Math.min(1, Math.max(0, (1 - r) * px + 0.5))
}
