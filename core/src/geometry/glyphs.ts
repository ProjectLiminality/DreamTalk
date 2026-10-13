/**
 * Glyphs — a written word as closed curves, synchronously.
 *
 * The outlines come from a font baked as data (scripts/font2ts.ts →
 * src/geometry/fonts/*.ts), so laying out a word is a pure function of
 * the string, the face and the size: no async shaping, no renderer. What
 * it gives up for that: no kerning and no complex-script shaping — glyphs
 * advance by their own widths, which is exact for the Latin words a
 * symbol ↔ word morph names.
 *
 * Every contour comes back CLOSED (last point = first), in the XY plane,
 * the word's bounding box centred on the origin. Outer contours and
 * counters (the hole of an "o") are both just contours — a fill across
 * them by EVEN-ODD (the host's drawing wash) makes the holes right
 * without knowing which is which.
 */

import type { Vec3Like } from "../parts/primitives"

/** A baked face: per code point, [advance, contours as flat [x, y, on, …]]. */
export interface FontData {
  unitsPerEm: number
  ascender: number
  descender: number
  glyphs: Record<number, [number, number[][]]>
}

export interface WordOptions {
  /** The em size in scene units (a capital is ~0.7 of it). Default 100. */
  size?: number
  /** Extra space between letters, in ems. Default 0. */
  tracking?: number
  /** Quadratic segments' flattening tolerance, in ems. Default 0.004. */
  tolerance?: number
}

type P = { x: number; y: number }

/** One TrueType contour (on/off points, cyclic) flattened to a closed polyline. */
export const flattenContour = (flat: readonly number[], tol: number): P[] => {
  const pts: { x: number; y: number; on: boolean }[] = []
  for (let i = 0; i + 2 < flat.length; i += 3) pts.push({ x: flat[i]!, y: flat[i + 1]!, on: flat[i + 2] === 1 })
  const n = pts.length
  if (n === 0) return []
  // Start on an on-curve point (or the implied one between two controls).
  let s = pts.findIndex((p) => p.on)
  const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  let start: P
  if (s < 0) {
    start = mid(pts[0]!, pts[1 % n]!)
    s = 0
  } else start = { x: pts[s]!.x, y: pts[s]!.y }
  const out: P[] = [start]
  let cur = start
  const quad = (c: P, e: P) => {
    const len = Math.hypot(c.x - cur.x, c.y - cur.y) + Math.hypot(e.x - c.x, e.y - c.y)
    const k = Math.max(2, Math.min(24, Math.ceil(Math.sqrt(len / Math.max(1e-9, tol)) / 2)))
    for (let j = 1; j <= k; j++) {
      const t = j / k
      const u = 1 - t
      out.push({ x: u * u * cur.x + 2 * u * t * c.x + t * t * e.x, y: u * u * cur.y + 2 * u * t * c.y + t * t * e.y })
    }
    cur = e
  }
  // Walk once round, from the start, back to it.
  const allOff = !pts.some((p) => p.on)
  for (let k = 1; k <= n; k++) {
    const p = pts[(s + k) % n]!
    const isLast = k === n
    if (p.on) {
      cur = { x: p.x, y: p.y }
      out.push(cur)
      continue
    }
    if (allOff && isLast) {
      quad(p, start)
      continue
    }
    const next = pts[(s + k + 1) % n]!
    const end = isLast ? start : next.on ? { x: next.x, y: next.y } : mid(p, next)
    quad(p, end)
    if (next.on && !isLast) k++ // consumed
  }
  const a = out[0]!
  const b = out[out.length - 1]!
  if (Math.hypot(a.x - b.x, a.y - b.y) > 1e-9) out.push({ ...a })
  else out[out.length - 1] = { ...a }
  return out
}

/**
 * The word's contours, laid out left to right, the whole word's bounding
 * box centred on the origin, in scene units. Characters the face lacks are
 * skipped (with a space's advance).
 */
export const wordOutline = (text: string, font: FontData, opts: WordOptions = {}): Vec3Like[][] => {
  const size = opts.size ?? 100
  const k = size / font.unitsPerEm
  const tol = (opts.tolerance ?? 0.004) * font.unitsPerEm
  const tracking = (opts.tracking ?? 0) * font.unitsPerEm
  const space = font.glyphs[32]?.[0] ?? font.unitsPerEm * 0.28
  const contours: P[][] = []
  let pen = 0
  for (const ch of text) {
    const g = font.glyphs[ch.codePointAt(0)!]
    if (!g) {
      pen += space + tracking
      continue
    }
    for (const c of g[1]) contours.push(flattenContour(c, tol).map((p) => ({ x: p.x + pen, y: p.y })))
    pen += g[0] + tracking
  }
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const c of contours)
    for (const p of c) {
      x0 = Math.min(x0, p.x)
      x1 = Math.max(x1, p.x)
      y0 = Math.min(y0, p.y)
      y1 = Math.max(y1, p.y)
    }
  const cx = Number.isFinite(x0) ? (x0 + x1) / 2 : 0
  const cy = Number.isFinite(y0) ? (y0 + y1) / 2 : 0
  return contours.map((c) => c.map((p) => ({ x: (p.x - cx) * k, y: (p.y - cy) * k, z: 0 })))
}
