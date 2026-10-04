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
  //
  // But a reversed edge is not always a fold. A font's tessellation
  // leaves short edges right beside its sharp corners (Arimo's `r`: a
  // 0.35-unit edge next to a 104° turn), and offsetting the corner
  // carries it past its neighbour, flipping that one edge — a local
  // swallowtail, not a shape running out of room. Refusing the whole
  // contour for it left `r e a m` straddling their true outlines, half a
  // pen bolder than `D` (the mirror e2e caught it). So a reversed edge is
  // first TRIMMED — its two ends merged where the offset lines either
  // side of it meet, which is where the true offset corner is — and the
  // loop is refused when trimming eats a real share of it (or it runs out
  // of points) — the square inset past its middle reverses every edge it
  // has — or when what survives the trim comes closer to the outline
  // than the offset itself: that is a stem narrower than the pen whose
  // end edges flipped, a fold the trim must not paper over (the Quote's
  // pen is wider than Arimo's stems; trimming those left notched
  // half-insets where the whole contour should straddle).
  const pts = out.map((p, i) => ({ p, o: loop[i]!, k: i, cut: false }))
  const reversedAt = (i: number): boolean => {
    const m = pts.length
    const a = pts[i]!
    const b = pts[(i + 1) % m]!
    return (b.o.x - a.o.x) * (b.p.x - a.p.x) + (b.o.y - a.o.y) * (b.p.y - a.p.y) < 0
  }
  let trimmed = 0
  for (let i = 0; i < pts.length; ) {
    if (!reversedAt(i)) {
      i++
      continue
    }
    trimmed++
    if (trimmed > n / 4 || pts.length <= 3) return loop
    const m = pts.length
    const j = (i + 1) % m
    const corner = trimCorner(pts, i, j)
    // No offset point moves further from its source corner than the
    // capped miter allows; a trim that would is not a swallowtail.
    const reach = amount * MITER_CAP
    if (
      !corner ||
      Math.hypot(corner.x - pts[i]!.o.x, corner.y - pts[i]!.o.y) > reach ||
      Math.hypot(corner.x - pts[j]!.o.x, corner.y - pts[j]!.o.y) > reach
    ) {
      return loop
    }
    pts[i] = { p: corner, o: pts[i]!.o, k: pts[i]!.k, cut: true }
    pts.splice(j, 1)
    // The merged point makes new edges on both sides; recheck from the
    // edge arriving at it.
    i = Math.max(0, (j === 0 ? i - 1 : i) - 1)
  }
  if (trimmed === 0) return out
  // The fold test for a trimmed loop, asked of the TRIMMED points: a
  // swallowtail's trim lands on the true offset corner, the offset's own
  // distance from every edge, while a collapsed stem end lands mid-stem,
  // closer to both sides than the pen's half. (Untrimmed points keep the
  // miter's own small approximations near curves, as they always have.)
  // A point's own two edges are left out.
  const CLEARANCE = 0.9
  for (const { p, k, cut } of pts) {
    if (!cut) continue
    for (let e = 0; e < n; e++) {
      if (e === k || (e + 1) % n === k) continue
      if (segmentDistance(p, loop[e]!, loop[(e + 1) % n]!) < amount * CLEARANCE) return loop
    }
  }
  return pts.map(({ p }) => p)
}

/**
 * The deepest inset a loop takes without folding, up to `amount`, and
 * the inset loop at that depth.
 *
 * Sketch & Toon's `clipping = "inside"` shows only the part of the pen
 * that falls inside the letter, so a written letter is NEVER fatter than
 * its letterform: where a stem is narrower than the pen, the clipped pen
 * simply fills the stem. The geometric version of that: pull the contour
 * in as far as it will go (the full half-pen when it can — exactly
 * `insetLoop` — else the deepest depth that still does not fold), and
 * have the caller draw that contour's pen at TWICE that depth, so its
 * outer edge lands on the outline either way. Refusing a contour outright
 * and letting the full pen straddle the outline instead made exactly the
 * letters with thin stems bolder than their neighbours (the creator-mode
 * calculator: a bold `1` beside a thin `5`).
 */
export const insetLoopDeepest = (
  loop: Loop,
  amount: number,
  others: readonly Loop[] = [],
): { loop: Loop; depth: number } => {
  if (amount <= 0) return { loop, depth: 0 }
  // A depth FITS when the inset curve keeps that distance from the
  // outline — the pen of twice the depth then stays inside. Not folding
  // is not enough: a stem's two sides can cross past its centreline with
  // no edge reversing, and the pen would poke out the far side. A small
  // tail (2%) may sit closer: the miter-capped needle corners, by design.
  const outer = loopArea(loop) > 0 // interior on the left: inside the ring
  const within = (p: Vec3Like): boolean => {
    let inside = false
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[i]!
      const b = loop[j]!
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
        inside = !inside
      }
    }
    return inside
  }
  // `strictOwn` off: the contour's own folding is left to insetLoop's
  // guards, as it always was (the full-depth path — a contour accepted
  // there before is accepted unchanged); on: the bisection, choosing a
  // depth itself, also holds the contour clear of its own outline.
  const fits = (inset: Loop, depth: number, strictOwn: boolean): boolean => {
    if (inset === loop) return false
    let close = 0
    for (const p of inset) {
      // Every point on the filled side: inside an outline, outside a
      // counter. A capped miter at a needle tip can flip across.
      if (strictOwn && within(p) !== outer) return false
      // Clear of the glyph's OTHER contours too: a bowl narrower than the
      // pen lets the outline's inset cross its counter's, and the pen
      // would paint inside the hole.
      let own = Infinity
      for (let e = 0; strictOwn && e < loop.length && own >= depth * 0.95; e++) {
        own = Math.min(own, segmentDistance(p, loop[e]!, loop[(e + 1) % loop.length]!))
      }
      let other = Infinity
      for (const ring of others) {
        for (let e = 0; e < ring.length && other >= depth * 0.95; e++) {
          other = Math.min(other, segmentDistance(p, ring[e]!, ring[(e + 1) % ring.length]!))
        }
      }
      if ((own < depth * 0.95 || other < depth * 0.95) && ++close > inset.length * 0.02) return false
    }
    return true
  }
  const full = insetLoop(loop, amount)
  if (fits(full, amount, false)) return { loop: full, depth: amount }
  // Bisect for the deepest depth that fits (12 halvings: within 1/4096
  // of the half-pen — far below a pixel).
  let lo = 0
  let hi = amount
  let best: Loop = loop
  for (let k = 0; k < 12; k++) {
    const mid = (lo + hi) / 2
    const inset = insetLoop(loop, mid)
    if (fits(inset, mid, true)) {
      lo = mid
      best = inset
    } else {
      hi = mid
    }
  }
  return lo > 0 ? { loop: best, depth: lo } : { loop, depth: 0 }
}

/** Distance from p to the segment a–b (in the plane). */
const segmentDistance = (p: Vec3Like, a: Vec3Like, b: Vec3Like): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

/**
 * Where the offset edges either side of the reversed edge i→j meet — the
 * corner the offset curve actually has once the swallowtail is cut off —
 * or undefined when those neighbours are parallel and never meet.
 */
const trimCorner = (pts: { p: Vec3Like }[], i: number, j: number): Vec3Like | undefined => {
  const m = pts.length
  const a0 = pts[(i - 1 + m) % m]!.p
  const a1 = pts[i]!.p
  const b0 = pts[j]!.p
  const b1 = pts[(j + 1) % m]!.p
  const dax = a1.x - a0.x
  const day = a1.y - a0.y
  const dbx = b1.x - b0.x
  const dby = b1.y - b0.y
  const den = dax * dby - day * dbx
  if (Math.abs(den) < 1e-12) return undefined
  const s = ((b0.x - a0.x) * dby - (b0.y - a0.y) * dbx) / den
  return { x: a0.x + dax * s, y: a0.y + day * s, z: a1.z }
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
