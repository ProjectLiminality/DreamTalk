/**
 * Even-odd triangulation of a whole drawing — pure math.
 *
 * A gear is an ANNULUS: a toothed rim and an inner circle, two separate
 * closed subpaths, with nothing in the data marking the second as a hole
 * in the first. Filling each loop on its own — a fan from its centroid,
 * which is what `FillShape` does and which is correct for one convex
 * loop — floods the gear to its centre, where the reference leaves a
 * black disc carrying the icon. The hole is not a property of either
 * loop; it is a property of the two of them TOGETHER, and so is the
 * triangulation.
 *
 * The rule is SVG's own `fill-rule: evenodd`, which is what these
 * drawings were authored under: a point is inside when a ray from it
 * crosses the subpaths an odd number of times. Rim alone → 1 crossing →
 * inside. Rim and inner circle → 2 → outside. That is the hole, and it
 * falls out of the rule rather than being detected.
 *
 * ## The method: trapezoid decomposition, not ear clipping
 *
 * Ear clipping is the usual answer, but it needs the holes bridged into
 * the outer contour first, and bridging is where that approach goes
 * wrong: choosing mutually non-crossing bridges is a search with real
 * degenerate cases (a hole inside a hole, an island inside a hole, two
 * holes that see the same vertex), and a bad bridge is a silent visual
 * bug rather than a crash. A scanline decomposition has no such choice
 * to make.
 *
 * Sweep in y. Between two consecutive vertex heights no edge starts,
 * ends, or crosses another, so the arrangement's topology is CONSTANT
 * across that band: every edge spanning the band cuts it into a fixed
 * left-to-right sequence of regions, and each region is uniformly inside
 * or outside. So:
 *
 *   1. Take every distinct vertex y as a scanline. The bands between
 *      adjacent scanlines are the slabs.
 *   2. In each slab, intersect every edge that spans it with the slab's
 *      TOP and BOTTOM, and sort those pairs by their midline x.
 *   3. Walk them left to right toggling parity (even-odd). A span
 *      between crossing i and crossing i+1 is inside exactly when i is
 *      even.
 *   4. Emit each inside span as a trapezoid — its four corners are two
 *      x-pairs already computed — cut into two triangles.
 *
 * Sorting by the MIDLINE rather than by either end is what makes step 3
 * sound: two edges spanning a slab cannot cross inside it (a crossing
 * would be a vertex, and every vertex is a scanline), so their order at
 * the midline is their order everywhere in the slab, top and bottom
 * alike. The trapezoids are therefore non-overlapping and their union is
 * exactly the even-odd region, up to the polygon's own vertices.
 *
 * ## Why the degenerate cases are not special cases
 *
 * Nested holes, islands inside holes and touching vertices need no code
 * of their own here, because none of them is visible to the sweep: the
 * sweep never asks which loop an edge belongs to, never asks whether one
 * loop contains another, and never asks a loop for its orientation. It
 * sees one flat bag of edges and a parity count. Depth of nesting is
 * just a higher crossing count, and the parity is right at every depth.
 * A vertex shared by two loops is a scanline like any other.
 *
 * The one thing the sweep must be careful about is the half-open edge
 * convention (below), which is what keeps a vertex from being counted
 * twice.
 *
 * ## What it costs
 *
 * O(n²) in the worst case — n slabs, and each slab sorts up to n edges.
 * That is the honest bound and it is fine for what this fills: a gear
 * is a few hundred points, and the result is cached by shapeKey and
 * rebuilt only when the geometry actually changes. A sweep-line status
 * structure would make it O(n log n); it is not worth the complexity
 * until a drawing arrives that needs it.
 */

import type { Vec3Like } from "../parts/index"

/** The triangulation, in `FillShape.setPolygon`'s own two-part form. */
export interface Triangulation {
  points: Vec3Like[]
  indices: number[]
}

/** An edge spanning some slab, as its two endpoints in sweep order. */
interface Edge {
  /** Lower endpoint. */
  y0: number
  x0: number
  /** Upper endpoint. */
  y1: number
  x1: number
}

/** Points nearer than this are the same point — the sweep's zero. */
const EPS = 1e-9

/** x where an edge crosses height y. Callers only ask within [y0, y1]. */
const xAt = (e: Edge, y: number): number =>
  e.x0 + ((e.x1 - e.x0) * (y - e.y0)) / (e.y1 - e.y0)

/**
 * Triangles covering the even-odd interior of a set of closed subpaths.
 *
 * Each subpath is a closed polyline; a repeated final point (the form
 * `Sketch` and the SVG importer produce) is accepted and ignored, since
 * the loop is closed by definition rather than by that repetition.
 * Subpaths with fewer than three distinct points contribute nothing —
 * an open stroke has no interior, and neither does a degenerate one.
 *
 * The result is flat in z: these are drawings, and a wash is a plane.
 * The z of the output is taken from the first point given, so a drawing
 * that sits off the z=0 plane washes in its own plane.
 */
export const evenOddTriangulation = (
  subpaths: readonly (readonly Vec3Like[])[],
): Triangulation => {
  const edges: Edge[] = []
  const ys: number[] = []
  let z = 0
  let seenAny = false

  for (const raw of subpaths) {
    // Drop a repeated closing point, then any consecutive duplicates:
    // a zero-length edge has no direction and would only pollute the
    // scanline set.
    const loop: Vec3Like[] = []
    for (const p of raw) {
      const last = loop[loop.length - 1]
      if (last && Math.abs(last.x - p.x) < EPS && Math.abs(last.y - p.y) < EPS) continue
      loop.push(p)
    }
    const first = loop[0]
    const last = loop[loop.length - 1]
    if (first && last && loop.length > 1 && Math.abs(last.x - first.x) < EPS && Math.abs(last.y - first.y) < EPS) {
      loop.pop()
    }
    if (loop.length < 3) continue
    if (!seenAny) {
      z = loop[0]!.z
      seenAny = true
    }
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i]!
      const b = loop[(i + 1) % loop.length]!
      // HORIZONTAL EDGES ARE DROPPED, and must be. Under the half-open
      // convention below a horizontal edge spans no slab, so it can
      // contribute no crossing; keeping it would only risk a divide by
      // zero in `xAt`. Its endpoints still register as scanlines (they
      // are endpoints of the neighbouring edges too), so the shape it
      // bounds is unaffected.
      if (Math.abs(a.y - b.y) < EPS) continue
      edges.push(a.y < b.y ? { y0: a.y, x0: a.x, y1: b.y, x1: b.x } : { y0: b.y, x0: b.x, y1: a.y, x1: a.x })
      ys.push(a.y, b.y)
    }
  }

  const points: Vec3Like[] = []
  const indices: number[] = []
  if (edges.length === 0) return { points, indices }

  // The scanlines: every distinct vertex height, in order. Adjacent
  // pairs are the slabs.
  ys.sort((a, b) => a - b)
  const lines: number[] = []
  for (const y of ys) {
    const prev = lines[lines.length - 1]
    if (prev === undefined || y - prev > EPS) lines.push(y)
  }

  for (let s = 0; s + 1 < lines.length; s++) {
    const yLo = lines[s]!
    const yHi = lines[s + 1]!
    const mid = (yLo + yHi) / 2

    // An edge belongs to this slab when it spans the slab's whole
    // height. The test is on the MIDLINE and is half-open in the
    // standard way — `y0 <= mid < y1` — which is what makes a vertex
    // where two edges meet count once rather than twice or zero times:
    // the edge below the vertex ends there and is excluded, the edge
    // above it starts there and is included.
    const spans: { xLo: number; xHi: number; xMid: number }[] = []
    for (const e of edges) {
      if (e.y0 > mid || e.y1 <= mid) continue
      spans.push({ xLo: xAt(e, yLo), xHi: xAt(e, yHi), xMid: xAt(e, mid) })
    }
    // Two edges spanning a slab cannot cross within it, so the midline
    // order is the order at both the top and the bottom.
    spans.sort((a, b) => a.xMid - b.xMid)

    // Even-odd: the span from crossing 2k to crossing 2k+1 is interior.
    for (let i = 0; i + 1 < spans.length; i += 2) {
      const l = spans[i]!
      const r = spans[i + 1]!
      // A trapezoid of zero width paints nothing — two loops meeting at
      // a point, or a tangency.
      if (r.xLo - l.xLo < EPS && r.xHi - l.xHi < EPS) continue
      const base = points.length
      points.push(
        { x: l.xLo, y: yLo, z },
        { x: r.xLo, y: yLo, z },
        { x: r.xHi, y: yHi, z },
        { x: l.xHi, y: yHi, z },
      )
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }

  return { points, indices }
}
