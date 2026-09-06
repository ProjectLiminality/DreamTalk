/**
 * Outline — the boundary of a triangulated flat shape, recovered as
 * closed loops of points.
 *
 * The problem this solves is specific and recurring: some of our
 * geometry arrives already triangulated, with its silhouette implicit.
 * Glyphs are the first case (three-text hands us triangles, never the
 * contours HarfBuzz shaped them from), and the 2021 look needs the
 * contours: a letter mid-Write is an OUTLINE being traced, not a solid
 * being wiped — refs/video-01/frames5/f0577 shows the first `t` of
 * "trans-perspectival" as a hook of stroke, and f0591 shows the last
 * `a` as a bare ring. Without the boundary there is nothing to draw.
 *
 * The recovery is exact for a manifold triangulation, and it is pure
 * combinatorics — no geometry predicates, no tolerance beyond the weld:
 *
 *   1. WELD. Triangulators emit the same corner many times. Snap
 *      positions to a lattice and let each lattice cell elect one
 *      representative index; every triangle is rewritten in terms of
 *      representatives. Without this every triangle looks like an
 *      island and every edge looks like a boundary.
 *   2. COUNT. Tally undirected edges over all triangles. An edge shared
 *      by two triangles is interior; an edge belonging to exactly one
 *      is on the boundary. (Verified on the "trans-perspectival" glyph
 *      buffer: 3041 triangles, 6095 distinct edges, 3028 interior,
 *      3067 boundary, zero edges with a count above two.)
 *   3. CHAIN. On a manifold boundary every vertex carries exactly two
 *      boundary edges, so walking from any unvisited vertex and always
 *      taking the unused edge closes a loop with no choices to make.
 *      A letter yields one loop per contour — `a` gives two, its
 *      silhouette and its counter, which is exactly right: the 2021
 *      pen traced both.
 *
 * Degenerate input degrades rather than throws: a vertex with an odd
 * number of boundary edges (non-manifold, or a weld that fused two
 * distinct corners) simply ends its walk, yielding an open chain that
 * the caller can still draw.
 */

import type { Vec3Like } from "./primitives"

/** A recovered boundary: a closed ring of points, first point NOT repeated. */
export type Loop = Vec3Like[]

/**
 * The weld lattice, in the same units as the incoming positions. Glyph
 * geometry at size 50 carries coordinates of order 10, and its
 * duplicate corners are bit-identical or within a float epsilon of it,
 * so a micron-scale cell separates "the same corner" from "two corners"
 * with orders of magnitude to spare.
 */
export const WELD_PRECISION = 1e-3

/** Undirected edge key for a representative pair. */
const edgeKey = (a: number, b: number): number =>
  a < b ? a * 0x8000000 + b : b * 0x8000000 + a

/**
 * Boundary loops of a triangulated shape.
 *
 * @param positions flat xyz triples (the `position` attribute's array)
 * @param indices   triangle corner indices into `positions`
 * @param triangles optional predicate: keep only triangles it accepts,
 *                  which is how one glyph's contours are extracted from
 *                  a buffer holding a whole line of them
 */
export const boundaryLoops = (
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  triangles?: (triangleIndex: number) => boolean,
): Loop[] => {
  const vertexCount = Math.floor(positions.length / 3)
  if (vertexCount === 0 || indices.length < 3) return []

  // 1. WELD — one representative index per occupied lattice cell.
  const cells = new Map<string, number>()
  const rep = new Int32Array(vertexCount)
  const inv = 1 / WELD_PRECISION
  for (let i = 0; i < vertexCount; i++) {
    const x = Math.round(positions[i * 3]! * inv)
    const y = Math.round(positions[i * 3 + 1]! * inv)
    const z = Math.round(positions[i * 3 + 2]! * inv)
    const key = `${x},${y},${z}`
    const existing = cells.get(key)
    if (existing === undefined) {
      cells.set(key, i)
      rep[i] = i
    } else {
      rep[i] = existing
    }
  }

  // 2. COUNT — undirected edge multiplicity over the kept triangles,
  // keeping the DIRECTION each boundary edge is traversed in by its own
  // triangle. Three-text emits triangles wound consistently, so an edge
  // walked a → b has the filled interior on its left; carrying that
  // direction through the chaining is what lets `insetLoops` know which
  // way "inward" is without any nesting analysis.
  const counts = new Map<number, number>()
  const directed = new Map<number, number>()
  const triangleCount = Math.floor(indices.length / 3)
  for (let t = 0; t < triangleCount; t++) {
    if (triangles && !triangles(t)) continue
    const a = rep[indices[t * 3]!]!
    const b = rep[indices[t * 3 + 1]!]!
    const c = rep[indices[t * 3 + 2]!]!
    if (a === b || b === c || c === a) continue // degenerate sliver
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ] as const) {
      const key = edgeKey(u, v)
      counts.set(key, (counts.get(key) ?? 0) + 1)
      directed.set(key, u)
    }
  }

  // Boundary successors: for a boundary edge u → v, the next edge out of
  // v. On a manifold boundary this successor is unique.
  const next = new Map<number, number>()
  for (const [key, count] of counts) {
    if (count !== 1) continue
    const lo = Math.floor(key / 0x8000000)
    const hi = key - lo * 0x8000000
    const from = directed.get(key)!
    const to = from === lo ? hi : lo
    next.set(from, to)
  }
  if (next.size === 0) return []

  // 3. CHAIN — follow successors until the walk returns to its start.
  const point = (i: number): Vec3Like => ({
    x: positions[i * 3]!,
    y: positions[i * 3 + 1]!,
    z: positions[i * 3 + 2]!,
  })
  const visited = new Set<number>()
  const loops: Loop[] = []
  for (const start of next.keys()) {
    if (visited.has(start)) continue
    const loop: Loop = []
    let current: number | undefined = start
    while (current !== undefined && !visited.has(current)) {
      visited.add(current)
      loop.push(point(current))
      current = next.get(current)
    }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
}

/**
 * Offset a loop INWARD — toward the filled side — by `amount`.
 *
 * This is what Sketch & Toon's `clipping = "inside"` does, and video-01's
 * text is drawn with exactly that (scene/scene.py:462-463 wraps every
 * letter as `Spline(..., thickness=TEXT_THICKNESS, clipping="inside")`).
 * A clipped stroke shows only the half of its width that falls within
 * the shape, so a written letter is never fatter than its own
 * letterform — which is why refs/video-01/frames5/f0583's `l` stem
 * measures 6.5px, the fill's own 5.2px plus antialiasing, and not the
 * 10px a centred 5px stroke would add.
 *
 * We have no stencil in the ribbon pipeline, so the same result comes
 * from geometry: pull the contour in by half the stroke width and let
 * the ribbon straddle THAT, and its outer edge lands back on the
 * original contour. `boundaryLoops` hands over loops whose traversal
 * keeps the interior on the left, so inward is simply the left normal —
 * no nesting analysis, and counters come out right for free because
 * their loops run the other way around.
 *
 * The offset is a per-vertex miter of the two adjacent edge normals,
 * capped at 3x so a needle-sharp corner (a serif, an apex) cannot fling
 * a point across the glyph. Loops thinner than 2 * amount would fold
 * through themselves; they are returned unmoved instead, which is the
 * honest degradation — a stem narrower than the pen is simply filled by
 * the pen.
 */
export const insetLoop = (loop: Loop, amount: number): Loop => {
  const n = loop.length
  if (n < 3 || amount === 0) return loop
  const MITER_CAP = 3
  const normals: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    const a = loop[i]!
    const b = loop[(i + 1) % n]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    normals.push(len > 1e-9 ? { x: -dy / len, y: dx / len } : { x: 0, y: 0 })
  }
  const out: Loop = []
  for (let i = 0; i < n; i++) {
    const p = loop[i]!
    // The edges meeting at p are the one arriving (i-1) and leaving (i).
    const a = normals[(i - 1 + n) % n]!
    const b = normals[i]!
    let mx = a.x + b.x
    let my = a.y + b.y
    const len = Math.hypot(mx, my)
    if (len < 1e-9) {
      out.push({ x: p.x, y: p.y, z: p.z })
      continue
    }
    mx /= len
    my /= len
    // Miter length: 1 / cos(half angle) = 1 / (m · n).
    const scale = Math.min(1 / Math.max(mx * b.x + my * b.y, 1e-3), MITER_CAP)
    out.push({ x: p.x + mx * amount * scale, y: p.y + my * amount * scale, z: p.z })
  }
  // Fold check, edge by edge. Offsetting a boundary inward keeps every
  // edge pointing the way it did — until the shape runs out of room,
  // at which point the edge's two ends cross and it turns around. That
  // reversal is the exact signature of the fold, and it is local, so it
  // catches the case an area comparison cannot: a unit square inset by
  // 0.8 comes back as a unit square's worth of corners at 0.2..0.8,
  // mirrored, with a perfectly plausible area and the same winding.
  //
  // A folded loop is returned UNMOVED. The pen then straddles the true
  // contour and simply fills the stem, which is what an inside-clipped
  // stroke does on a stem narrower than itself anyway.
  for (let i = 0; i < n; i++) {
    const a0 = loop[i]!
    const b0 = loop[(i + 1) % n]!
    const a1 = out[i]!
    const b1 = out[(i + 1) % n]!
    const dot = (b0.x - a0.x) * (b1.x - a1.x) + (b0.y - a0.y) * (b1.y - a1.y)
    if (dot < 0) return loop
  }
  return out
}

/**
 * Rotate a ring so it begins at its topmost point (ties broken to the
 * left), keeping its winding.
 *
 * A traced letter has to start where the 2021 pen started, because a
 * partially drawn contour is a partially drawn contour — the reference's
 * `a`, un-drawn back to a third, is the TOP arc of its bowl
 * (refs/video-01/frames5/f0591), not an arbitrary third of the ring.
 * C4D began each stroke at its spline's first point, which is the font's
 * own contour start, and three-text hands us triangles rather than
 * contours, so the point itself cannot be recovered from the geometry.
 * The topmost point is the closest STABLE stand-in: it is where most
 * Latin outlines in this class of font begin, it is defined for every
 * loop, and it is independent of how the boundary walk happened to
 * start.
 */
export const startAtTop = (loop: Loop): Loop => {
  if (loop.length < 2) return loop
  let best = 0
  for (let i = 1; i < loop.length; i++) {
    const a = loop[i]!
    const b = loop[best]!
    if (a.y > b.y || (a.y === b.y && a.x < b.x)) best = i
  }
  if (best === 0) return loop
  return [...loop.slice(best), ...loop.slice(0, best)]
}

/**
 * A loop as a drawable polyline: the ring with its first point repeated
 * at the end, so a stroke closes on itself.
 */
export const closeLoop = (loop: Loop): Vec3Like[] =>
  loop.length === 0 ? [] : [...loop, loop[0]!]

/**
 * Signed area of a loop projected on XY. Its MAGNITUDE is the loop's
 * enclosed area — what separates a glyph's silhouette from its counter.
 * Its sign is not meaningful here: the chain walk starts wherever the
 * adjacency map hands it a vertex and so picks up either winding.
 */
export const loopArea = (loop: Loop): number => {
  let sum = 0
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!
    const b = loop[(i + 1) % loop.length]!
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}
