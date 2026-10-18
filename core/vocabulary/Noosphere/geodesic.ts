/**
 * geodesic.ts — the Noosphere's geometry as pure functions: the geodesic
 * sphere (an icosahedron, each face cut into ν² triangles, pushed onto the
 * sphere), its flower of life, and the flat disk that breaks into six.
 *
 * THE GEODESIC SPHERE. Class-I subdivision of the icosahedron at frequency
 * ν: every face (A, B, C) is the triangular grid A·(ν−i−j)/ν + B·i/ν + C·j/ν,
 * normalised onto the unit sphere; shared edge points are merged: 10ν² + 2
 * vertices, 30ν² edges, 20ν² faces. ν = 2 is the InterBrain sphere (f11941:
 * its centre node's six neighbours ≈ 30° away), ν = 7 the narrative /
 * vision sphere (f5716: ≈ 9.8°).
 *
 * THE FLOWER OF LIFE ON IT. The planar flower of life is circles of radius d
 * centred on a triangular lattice of spacing d: each circle runs through its
 * six neighbours. On the geodesic sphere the same figure is, for every face
 * (A, B, C) and each of its corners C, the arc of the small circle about C
 * that runs from A to B — the 60° of C's circle that lies across the face's
 * far edge. Two faces share each edge, so every edge carries two such arcs
 * bulging toward each other: the vesica "petal" the film draws between two
 * neighbouring nodes (f11941, f5716). Each arc ends exactly on the two
 * vertices (its radius is interpolated from |CA| to |CB|, which differ by
 * the geodesic's small irregularity).
 *
 * VISIBILITY is decided per sample in the observer's frame: a point is
 * near when its z (towards the camera, after the spin/pitch turn) is ≥ 0.
 * The lattice keeps both faces (near bright, far dim — f2236); the flower
 * keeps the near face only (f5716, f11941 read as opaque balls).
 */

import { rotHPB } from "../../src/parts/curves"
import type { Vec3Like } from "../../src/parts/primitives"

export type V3 = [number, number, number]

export interface Geodesic {
  /** Unit vectors. The first 12 are the icosahedron's own vertices. */
  vertices: V3[]
  /** Index pairs, i < j. */
  edges: [number, number][]
  /** Index triples, counter-clockwise seen from outside. */
  faces: [number, number, number][]
}

const PHI = (1 + Math.sqrt(5)) / 2

const unit = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
}
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** The icosahedron: 12 vertices (cyclic (0, ±1, ±φ)), 20 outward faces. */
export const icosahedron = (): { vertices: V3[]; faces: [number, number, number][] } => {
  const vertices: V3[] = []
  for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) vertices.push([0, s1, s2 * PHI], [s1, s2 * PHI, 0], [s2 * PHI, 0, s1])
  const faces: [number, number, number][] = []
  const near = (a: V3, b: V3) => Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) - 2) < 1e-9
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      for (let k = j + 1; k < 12; k++) {
        const [a, b, c] = [vertices[i]!, vertices[j]!, vertices[k]!]
        if (!near(a, b) || !near(b, c) || !near(a, c)) continue
        // Outward winding: (b − a) × (c − a) points away from the centre.
        const n = cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]])
        faces.push(dot(n, a) > 0 ? [i, j, k] : [i, k, j])
      }
  return { vertices: vertices.map(unit), faces }
}

const cache = new Map<number, Geodesic>()

/** The frequency-ν geodesic sphere (memoised: it is pure). */
export const geodesic = (frequency: number): Geodesic => {
  const nu = Math.max(1, Math.round(frequency))
  const hit = cache.get(nu)
  if (hit) return hit
  const ico = icosahedron()
  const vertices: V3[] = []
  const index = new Map<string, number>()
  const vid = (v: V3): number => {
    const u = unit(v)
    const key = u.map((c) => Math.round(c * 1e6)).join(",")
    let i = index.get(key)
    if (i === undefined) {
      i = vertices.length
      vertices.push(u)
      index.set(key, i)
    }
    return i
  }
  // The 12 originals first, so vertex i < 12 is a five-valent pole.
  ico.vertices.forEach(vid)
  const faces: [number, number, number][] = []
  for (const [ia, ib, ic] of ico.faces) {
    const [A, B, C] = [ico.vertices[ia]!, ico.vertices[ib]!, ico.vertices[ic]!]
    const P = (i: number, j: number) =>
      vid([0, 1, 2].map((k) => (A[k]! * (nu - i - j) + B[k]! * i + C[k]! * j) / nu) as V3)
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nu - i; j++) {
        faces.push([P(i, j), P(i + 1, j), P(i, j + 1)])
        if (i + j < nu - 1) faces.push([P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)])
      }
  }
  const seen = new Set<string>()
  const edges: [number, number][] = []
  for (const f of faces)
    for (let k = 0; k < 3; k++) {
      const a = f[k]!
      const b = f[(k + 1) % 3]!
      const e: [number, number] = a < b ? [a, b] : [b, a]
      const key = `${e[0]},${e[1]}`
      if (!seen.has(key)) {
        seen.add(key)
        edges.push(e)
      }
    }
  const g = { vertices, edges, faces }
  cache.set(nu, g)
  return g
}

/** The mean angle (radians) between neighbouring vertices — the flower's
 *  spacing on the unit sphere. */
export const meanEdgeAngle = (g: Geodesic): number =>
  g.edges.reduce((s, [a, b]) => s + Math.acos(Math.min(1, dot(g.vertices[a]!, g.vertices[b]!))), 0) / g.edges.length

/** Turn a unit vector into the observer's frame: spin about the pole (y),
 *  then lean the pole by `pitch` — the Earth's (and Regenaissance's) h/p. */
export const orient = (v: V3, spin: number, pitch: number): V3 => {
  const r = rotHPB({ x: v[0], y: v[1], z: v[2] }, pitch, spin, 0)
  return [r.x, r.y, r.z]
}

/** Split a sampled 3-D polyline (observer frame) into its runs on one side
 *  of z = 0 (`near`: z ≥ 0), each projected to the page at `radius`; the
 *  limb crossings are interpolated onto z = 0. */
export const sideRuns = (pts: readonly V3[], near: boolean, radius: number): Vec3Like[][] => {
  const keep = (p: V3) => (near ? p[2] >= 0 : p[2] < 0)
  const P = (p: V3): Vec3Like => ({ x: p[0] * radius, y: p[1] * radius, z: 0 })
  const cut = (a: V3, b: V3): V3 => {
    const t = a[2] / (a[2] - b[2])
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0]
  }
  const runs: Vec3Like[][] = []
  let cur: Vec3Like[] | undefined
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    if (keep(p)) {
      if (!cur) {
        cur = []
        if (i > 0) cur.push(P(cut(pts[i - 1]!, p)))
        runs.push(cur)
      }
      cur.push(P(p))
    } else if (cur) {
      cur.push(P(cut(pts[i - 1]!, p)))
      cur = undefined
    }
  }
  return runs.filter((r) => r.length >= 2)
}

/**
 * The geodesic LATTICE (f2056, f2236): every edge a straight chord — the
 * film's sphere is faceted, its limb a polygon — split at the limb into
 * its near and far parts.
 */
export const latticeLoops = (
  g: Geodesic,
  radius: number,
  spin: number,
  pitch: number,
): { near: Vec3Like[][]; far: Vec3Like[][] } => {
  const near: Vec3Like[][] = []
  const far: Vec3Like[][] = []
  const turned = g.vertices.map((v) => orient(v, spin, pitch))
  for (const [a, b] of g.edges) {
    const seg = [turned[a]!, turned[b]!]
    near.push(...sideRuns(seg, true, radius))
    far.push(...sideRuns(seg, false, radius))
  }
  return { near, far }
}

/** The point at angular distance θ from unit `c` toward tangent unit `t`. */
const along = (c: V3, t: V3, th: number): V3 => {
  const co = Math.cos(th)
  const si = Math.sin(th)
  return [c[0] * co + t[0] * si, c[1] * co + t[1] * si, c[2] * co + t[2] * si]
}
/** The unit tangent at `c` pointing toward `p`, and the angle to it. */
const toward = (c: V3, p: V3): { t: V3; th: number } => {
  const d = dot(c, p)
  const t = unit([p[0] - c[0] * d, p[1] - c[1] * d, p[2] - c[2] * d])
  return { t, th: Math.acos(Math.min(1, Math.max(-1, d))) }
}

/**
 * The LINKS between the nodes, from engineered to gardened. For each face
 * and each corner C, the link from one far vertex A to the other B:
 *   bend 0 — the straight link, the great-circle arc A→B (f5146: the
 *            narrative-engineered sphere's nodes joined by single straight
 *            links — the edges of the geodesic, mechanical);
 *   bend 1 — the arc about C from A to B, so every edge carries two arcs
 *            bulging toward each other: the FLOWER OF LIFE's petals (f5716
 *            right, f11941 — gardened, organic).
 * Between, each sample slides along the straight line between the two and
 * is pushed back onto the sphere. Trimmed where it enters either end's node
 * ring (angular radius `node`), in the unit sphere's own frame. Pure: turned
 * and projected by `nearRuns`.
 */
export const flowerArcs = (g: Geodesic, node: number, bend = 1, samples = 10): V3[][] => {
  const out: V3[][] = []
  for (const f of g.faces) {
    for (let k = 0; k < 3; k++) {
      const C = g.vertices[f[k]!]!
      const A = g.vertices[f[(k + 1) % 3]!]!
      const B = g.vertices[f[(k + 2) % 3]!]!
      const a = toward(C, A)
      const b = toward(C, B)
      const span = Math.acos(Math.min(1, Math.max(-1, dot(a.t, b.t))))
      const w = cross(C, a.t) // completes the tangent frame at C
      const sgn = dot(w, b.t) >= 0 ? 1 : -1
      const pts: V3[] = []
      for (let i = 0; i <= samples; i++) {
        const u = i / samples
        const phi = span * u * sgn
        const t: V3 = [
          a.t[0] * Math.cos(phi) + w[0] * Math.sin(phi),
          a.t[1] * Math.cos(phi) + w[1] * Math.sin(phi),
          a.t[2] * Math.cos(phi) + w[2] * Math.sin(phi),
        ]
        const q = along(C, t, a.th + (b.th - a.th) * u)
        // The straight link's point at the same share of the way.
        const om = Math.acos(Math.min(1, Math.max(-1, dot(A, B))))
        const sa = Math.sin((1 - u) * om) / Math.sin(om)
        const sb = Math.sin(u * om) / Math.sin(om)
        const l: V3 = [A[0] * sa + B[0] * sb, A[1] * sa + B[1] * sb, A[2] * sa + B[2] * sb]
        const p = bend >= 1 ? q : unit([l[0] + (q[0] - l[0]) * bend, l[1] + (q[1] - l[1]) * bend, l[2] + (q[2] - l[2]) * bend])
        if (node > 0 && (dot(p, A) > Math.cos(node) || dot(p, B) > Math.cos(node))) {
          if (pts.length >= 2) out.push(pts.splice(0))
          else pts.length = 0
          continue
        }
        pts.push(p)
      }
      if (pts.length >= 2) out.push(pts)
    }
  }
  return out
}

/** A small circle of angular radius `rho` about every vertex (the nodes). */
export const nodeRings = (g: Geodesic, rho: number, samples = 20): V3[][] =>
  g.vertices.map((c) => {
    const ref: V3 = Math.abs(c[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
    const u = unit(cross(c, ref))
    const w = cross(c, u)
    return Array.from({ length: samples + 1 }, (_, i) => {
      const a = (i / samples) * 2 * Math.PI
      const t: V3 = [u[0] * Math.cos(a) + w[0] * Math.sin(a), u[1] * Math.cos(a) + w[1] * Math.sin(a), u[2] * Math.cos(a) + w[2] * Math.sin(a)]
      return along(c, t, rho)
    })
  })

/** A tangent-plane polygon about each vertex: `sides` corners at angular
 *  radius `rho` (4 → the narrative's square, many → a circle), squared to
 *  the page's up. */
export const nodeGlyphs = (g: Geodesic, rho: number, sides: number, phase = Math.PI / 4): V3[][] =>
  g.vertices.map((c) => {
    const ref: V3 = Math.abs(c[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
    const u = unit(cross(c, ref))
    const w = cross(c, u)
    return Array.from({ length: sides + 1 }, (_, i) => {
      const a = phase + (i / sides) * 2 * Math.PI
      const t: V3 = [u[0] * Math.cos(a) + w[0] * Math.sin(a), u[1] * Math.cos(a) + w[1] * Math.sin(a), u[2] * Math.cos(a) + w[2] * Math.sin(a)]
      return along(c, t, rho)
    })
  })

/** Turn every polyline and keep its near runs, projected at `radius`. */
export const nearRuns = (lines: readonly V3[][], radius: number, spin: number, pitch: number): Vec3Like[][] =>
  lines.flatMap((l) => sideRuns(l.map((p) => orient(p, spin, pitch)), true, radius))

// ---------------------------------------------------------------------------
// The flat noosphere: the whole disk and its six triangles
// ---------------------------------------------------------------------------

/** Planar point. */
export interface P2 {
  x: number
  y: number
}

/** The hexagon's radius at polar angle θ, for circumradius 1, corners at
 *  0°, 60°, … (f7441: a corner on each cut). */
export const hexRadius = (theta: number): number => {
  const s = Math.PI / 3
  const local = (((theta % s) + s) % s) - s / 2
  return Math.cos(s / 2) / Math.cos(local)
}

/** The boundary radius of the disk → hexagon morph at θ: `u` 0 the disk
 *  (radius 1), 1 the hexagon (circumradius `hex`). */
export const morphRadius = (theta: number, u: number, hex: number): number => 1 + (hex * hexRadius(theta) - 1) * u

/** Sector k (0..5) spans polar angles [k·60°, (k+1)·60°]. */
export const sectorOf = (p: P2): number => {
  const a = Math.atan2(p.y, p.x)
  return Math.min(5, Math.floor((((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 3)))
}

/** The runs of `pts` for which `inside` holds; cut ends bisected onto the boundary. */
export const insideRuns = (pts: readonly P2[], inside: (p: P2) => boolean): P2[][] => {
  const edge = (a: P2, b: P2): P2 => {
    let lo = 0, hi = 1
    const ia = inside(a)
    for (let i = 0; i < 20; i++) {
      const m = (lo + hi) / 2
      if (inside({ x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m }) === ia) lo = m
      else hi = m
    }
    return { x: a.x + (b.x - a.x) * lo, y: a.y + (b.y - a.y) * lo }
  }
  const runs: P2[][] = []
  let cur: P2[] | undefined
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    if (inside(p)) {
      if (!cur) {
        cur = []
        if (i > 0) cur.push(edge(p, pts[i - 1]!))
        runs.push(cur)
      }
      cur.push(p)
    } else if (cur) {
      cur.push(edge(pts[i - 1]!, p))
      cur = undefined
    }
  }
  return runs.filter((r) => r.length >= 2)
}

/** The triangular lattice of spacing `s` with a point at the origin and a
 *  row along +x, out to `reach`: the flower's centres (and the corners of
 *  the six triangles: hex · R is a whole number of steps). */
export const triLattice = (s: number, reach: number): P2[] => {
  const out: P2[] = []
  const n = Math.ceil(reach / s) + 1
  const h = (s * Math.sqrt(3)) / 2
  for (let j = -n * 2; j <= n * 2; j++)
    for (let i = -n * 2; i <= n * 2; i++) {
      const p = { x: (i + j / 2) * s, y: j * h }
      if (Math.hypot(p.x, p.y) <= reach + s) out.push(p)
    }
  return out
}

/**
 * The flat flower of life in sector `k`: circles of radius `s` about the
 * lattice, clipped to the sector and inside the morph boundary (radius 1 ·
 * `R` → hexagon). Each sector clips its own share, so the six pieces part
 * cleanly when the triangles drift apart.
 */
export const sectorFlower = (k: number, R: number, s: number, u: number, hex: number, samples = 30): P2[][] => {
  const a0 = (k * Math.PI) / 3
  const a1 = a0 + Math.PI / 3
  const inside = (p: P2) => {
    const r = Math.hypot(p.x, p.y)
    if (r < 1e-9) return true
    if (sectorOf(p) !== k && r > 1e-6) return false
    return r <= R * morphRadius(Math.atan2(p.y, p.x), u, hex) + 1e-9
  }
  const out: P2[][] = []
  for (const c of triLattice(s, R)) {
    // Skip circles that cannot touch this sector.
    const r = Math.hypot(c.x, c.y)
    if (r > s * 1.01) {
      const a = Math.atan2(c.y, c.x)
      const d = Math.min(...[a0, a1, (a0 + a1) / 2].map((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))))
      if (d > Math.PI / 6 + Math.asin(Math.min(1, s / r))) continue
    }
    const pts = Array.from({ length: samples + 1 }, (_, i) => {
      const t = (i / samples) * 2 * Math.PI
      return { x: c.x + s * Math.cos(t), y: c.y + s * Math.sin(t) }
    })
    out.push(...insideRuns(pts, inside))
  }
  return out
}

/** Sector k's triangle (centre, corner k, corner k+1) at circumradius `hexR`. */
export const sectorTriangle = (k: number, hexR: number): [P2, P2, P2] => {
  const a0 = (k * Math.PI) / 3
  const a1 = a0 + Math.PI / 3
  return [
    { x: 0, y: 0 },
    { x: hexR * Math.cos(a0), y: hexR * Math.sin(a0) },
    { x: hexR * Math.cos(a1), y: hexR * Math.sin(a1) },
  ]
}

/** The triangle's lattice (f7471): lines parallel to each side, `n` steps —
 *  the flower's own centre lattice, its circles straightened away. */
export const triangleGrid = (tri: readonly [P2, P2, P2], n: number): P2[][] => {
  const out: P2[][] = []
  const lerp = (a: P2, b: P2, t: number): P2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  for (let k = 0; k < 3; k++) {
    const A = tri[k]!
    const B = tri[(k + 1) % 3]!
    const C = tri[(k + 2) % 3]!
    // Lines parallel to BC, stepping from A toward BC.
    for (let i = 1; i < n; i++) {
      const t = i / n
      out.push([lerp(A, B, t), lerp(A, C, t)])
    }
  }
  return out
}

/** The sector's boundary arc (its rim) on the morph, from corner k to k+1. */
export const sectorRim = (k: number, R: number, u: number, hex: number, samples = 24): P2[] => {
  const a0 = (k * Math.PI) / 3
  return Array.from({ length: samples + 1 }, (_, i) => {
    const a = a0 + ((Math.PI / 3) * i) / samples
    const r = R * morphRadius(a, u, hex)
    return { x: r * Math.cos(a), y: r * Math.sin(a) }
  })
}

/** One field line of the vortex (f7471): a spiral arc from (a0, r0) sweeping
 *  `dTheta` while it grows to r1. */
export const spiralArc = (a0: number, r0: number, r1: number, dTheta: number, segments = 24): P2[] =>
  Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments
    const a = a0 + dTheta * t
    const r = r0 + (r1 - r0) * t
    return { x: Math.cos(a) * r, y: Math.sin(a) * r }
  })
