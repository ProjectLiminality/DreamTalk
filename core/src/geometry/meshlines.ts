/**
 * Mesh lines — the line drawing of an arbitrary triangle mesh for a view:
 * its feature lines, as 3D polylines, before occlusion.
 *
 *   CREASES — edges whose two faces meet at more than `crease` (a box's
 *     edges, a cone's rim, a star prism's spikes). Drawn where at least one
 *     of the two faces faces the viewer (the same rule as a box's edges).
 *   CONTOURS — on the smooth parts, where the surface turns away from the
 *     viewer: the zero set of g(p) = n(p)·(eye − p), with n interpolated
 *     from CORNER normals (each corner's normal averages only the faces
 *     across which the surface is smooth there). Found per triangle, where
 *     g changes sign along an edge, and chained across shared edges — so a
 *     sphere's outline is a smooth curve, not a stair of polygon edges
 *     (Hertzmann & Zorin's smooth silhouettes).
 *   BOUNDARIES — edges of an open mesh, drawn where their face faces.
 *
 * Occlusion is not here: hiddenline.ts cuts these into visible runs with
 * the same ray test as every solid, against every solid INCLUDING this
 * mesh (a torus hides its own far side), through a per-mesh BVH.
 *
 * Preparation (normals, adjacency, BVH) depends only on the mesh and is
 * cached on its `positions` array, so a holon that keeps its mesh pays it
 * once; the per-view work is one pass over the triangles.
 */

import type { Vec3Like } from "../parts/primitives"

export interface MeshData {
  positions: readonly Vec3Like[]
  triangles: readonly (readonly [number, number, number])[]
}

type V = Vec3Like
const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a: V, b: V) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: V, b: V): V => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const len = (a: V) => Math.hypot(a.x, a.y, a.z)
const lerp = (a: V, b: V, t: number): V => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t })

interface BVHNode {
  lo: V
  hi: V
  /** Leaf: triangle indices; inner: children. */
  tris?: number[]
  left?: BVHNode
  right?: BVHNode
}

export interface PreparedMesh {
  mesh: MeshData
  faceN: V[]
  /** Per triangle, the three corner normals (smooth across non-crease edges). */
  cornerN: [V, V, V][]
  /** Vertices where the surface is not smooth (a cone's apex). */
  singular: Set<number>
  /** Undirected edge → its triangles (1 = boundary, 2 = interior). */
  edges: Map<string, { a: number; b: number; tris: number[] }>
  bvh: BVHNode
  /** The mesh's size (bounding-box diagonal), for tolerances. */
  size: number
  /** Mean edge length — the facet scale a contour can sit off the polygon by. */
  facet: number
  centroid: V
}

const cache = new WeakMap<object, Map<number, PreparedMesh>>()

/** Prepare (or fetch) a mesh for drawing with a crease angle (radians). */
export const prepareMesh = (mesh: MeshData, crease: number): PreparedMesh => {
  const byCrease = cache.get(mesh.positions) ?? new Map<number, PreparedMesh>()
  const hit = byCrease.get(crease)
  if (hit && hit.mesh.triangles === mesh.triangles) return hit
  const P = mesh.positions
  const T = mesh.triangles
  const faceN: V[] = []
  const area: number[] = []
  for (const [a, b, c] of T) {
    const n = cross(sub(P[b]!, P[a]!), sub(P[c]!, P[a]!))
    const l = len(n) || 1
    faceN.push({ x: n.x / l, y: n.y / l, z: n.z / l })
    area.push(l / 2)
  }
  const around: number[][] = P.map(() => [])
  T.forEach((t, i) => t.forEach((v) => around[v]!.push(i)))
  const cos = Math.cos(crease)
  const edges = new Map<string, { a: number; b: number; tris: number[] }>()
  T.forEach((t, i) => {
    for (let k = 0; k < 3; k++) {
      const u = t[k]!
      const w = t[(k + 1) % 3]!
      const key = u < w ? `${u},${w}` : `${w},${u}`
      const e = edges.get(key)
      if (e) e.tris.push(i)
      else edges.set(key, { a: Math.min(u, w), b: Math.max(u, w), tris: [i] })
    }
  })
  // CORNER normals: one smooth normal per vertex per smoothing group (the
  // faces at the vertex within `crease` of this face), area-weighted — so
  // two triangles sharing an edge agree on where a contour crosses it, and
  // the contour is one continuous curve. EXCEPT at a singular corner: a
  // cone's apex, where the group's normals fan out (their mean is short —
  // under 0.985 of unit) because the surface is not smooth there. Its
  // average would tilt toward the axis and pull the contour off the tip,
  // so such a corner keeps its own face's normal (along a cone's generator
  // the normal is constant to the tip).
  // SINGULAR vertices: walk each vertex's fan of faces, joining neighbours
  // across SMOOTH edges (dihedral within `crease`) — a smooth fan. Where a
  // fan's normals turn right round the vertex (their mean is short: under
  // 0.9 of unit), the surface is not smooth there however gently each
  // neighbour meets the next: a cone's apex. A fillet beside a mantle
  // bends its normals one way, a little, and is not singular.
  const singular = new Set<number>()
  const smoothAcross = (f: number, g: number) => dot(faceN[f]!, faceN[g]!) >= cos
  around.forEach((fs, v) => {
    if (fs.length < 3) return
    const seen = new Set<number>()
    for (const start of fs) {
      if (seen.has(start)) continue
      const fan: number[] = []
      const stack = [start]
      seen.add(start)
      while (stack.length) {
        const f = stack.pop()!
        fan.push(f)
        // Neighbours around v: faces sharing an edge (v, w) with f.
        for (const g of fs) {
          if (seen.has(g)) continue
          const shared = T[g]!.filter((x) => T[f]!.includes(x)).length
          if (shared >= 2 && smoothAcross(f, g)) {
            seen.add(g)
            stack.push(g)
          }
        }
      }
      if (fan.length < 3) continue
      let u = { x: 0, y: 0, z: 0 }
      for (const f of fan) u = { x: u.x + faceN[f]!.x, y: u.y + faceN[f]!.y, z: u.z + faceN[f]!.z }
      if (len(u) / fan.length < 0.9) singular.add(v)
    }
  })
  const cornerN = T.map((t, i) =>
    t.map((v) => {
      if (singular.has(v)) return faceN[i]!
      let s = { x: 0, y: 0, z: 0 }
      for (const f of around[v]!)
        if (dot(faceN[f]!, faceN[i]!) >= cos)
          s = { x: s.x + faceN[f]!.x * area[f]!, y: s.y + faceN[f]!.y * area[f]!, z: s.z + faceN[f]!.z * area[f]! }
      const l = len(s) || 1
      return { x: s.x / l, y: s.y / l, z: s.z / l }
    }) as [V, V, V],
  )
  // BVH: median split on the longest axis of the centroids, leaves ≤ 4.
  const cent = T.map(([a, b, c]) => ({
    x: (P[a]!.x + P[b]!.x + P[c]!.x) / 3,
    y: (P[a]!.y + P[b]!.y + P[c]!.y) / 3,
    z: (P[a]!.z + P[b]!.z + P[c]!.z) / 3,
  }))
  const build = (ids: number[]): BVHNode => {
    const lo = { x: Infinity, y: Infinity, z: Infinity }
    const hi = { x: -Infinity, y: -Infinity, z: -Infinity }
    for (const i of ids)
      for (const v of T[i]!) {
        const p = P[v]!
        lo.x = Math.min(lo.x, p.x)
        lo.y = Math.min(lo.y, p.y)
        lo.z = Math.min(lo.z, p.z)
        hi.x = Math.max(hi.x, p.x)
        hi.y = Math.max(hi.y, p.y)
        hi.z = Math.max(hi.z, p.z)
      }
    if (ids.length <= 4) return { lo, hi, tris: ids }
    const ext = { x: hi.x - lo.x, y: hi.y - lo.y, z: hi.z - lo.z }
    const ax = ext.x >= ext.y && ext.x >= ext.z ? "x" : ext.y >= ext.z ? "y" : "z"
    const sorted = [...ids].sort((p, q) => cent[p]![ax] - cent[q]![ax] || p - q)
    const m = sorted.length >> 1
    return { lo, hi, left: build(sorted.slice(0, m)), right: build(sorted.slice(m)) }
  }
  const bvh = build(T.map((_, i) => i))
  const size = Math.hypot(bvh.hi.x - bvh.lo.x, bvh.hi.y - bvh.lo.y, bvh.hi.z - bvh.lo.z) || 1
  const centroid = P.reduce((a, p) => ({ x: a.x + p.x / P.length, y: a.y + p.y / P.length, z: a.z + p.z / P.length }), { x: 0, y: 0, z: 0 })
  let edgeSum = 0
  for (const e of edges.values()) edgeSum += len(sub(P[e.a]!, P[e.b]!))
  const facet = edges.size ? edgeSum / edges.size : size / 100
  const prepared: PreparedMesh = { mesh, faceN, cornerN, singular, edges, bvh, size, facet, centroid }
  byCrease.set(crease, prepared)
  cache.set(mesh.positions, byCrease)
  return prepared
}

/** Does the segment o + t·d, t ∈ (tMin, tMax), hit the mesh? (Möller–Trumbore over the BVH.) */
export const meshHits = (m: PreparedMesh, o: V, d: V, tMin: number, tMax: number): boolean => {
  const P = m.mesh.positions
  const T = m.mesh.triangles
  const inv = { x: 1 / d.x, y: 1 / d.y, z: 1 / d.z }
  const boxHit = (n: BVHNode): boolean => {
    let lo = tMin
    let hi = tMax
    for (const a of ["x", "y", "z"] as const) {
      let t0 = (n.lo[a] - o[a]) * inv[a]
      let t1 = (n.hi[a] - o[a]) * inv[a]
      if (Number.isNaN(t0) || Number.isNaN(t1)) continue
      if (t0 > t1) [t0, t1] = [t1, t0]
      lo = Math.max(lo, t0)
      hi = Math.min(hi, t1)
      if (lo > hi) return false
    }
    return true
  }
  const stack: BVHNode[] = [m.bvh]
  while (stack.length) {
    const n = stack.pop()!
    if (!boxHit(n)) continue
    if (n.tris) {
      for (const i of n.tris) {
        const [a, b, c] = T[i]!
        const p0 = P[a]!
        const e1 = sub(P[b]!, p0)
        const e2 = sub(P[c]!, p0)
        const h = cross(d, e2)
        const det = dot(e1, h)
        if (Math.abs(det) < 1e-12) continue
        const f = 1 / det
        const s = sub(o, p0)
        const u = f * dot(s, h)
        if (u < 0 || u > 1) continue
        const q = cross(s, e1)
        const v = f * dot(d, q)
        if (v < 0 || u + v > 1) continue
        const t = f * dot(e2, q)
        if (t > tMin && t < tMax) return true
      }
    } else {
      stack.push(n.left!, n.right!)
    }
  }
  return false
}

/** Toward-the-viewer direction at p (perspective eye, or orthographic `toward`). */
export type Toward = (p: V) => V

/** The mesh's feature lines for a view, unoccluded: creases, contours, boundaries. */
export const meshLines = (m: PreparedMesh, toward: Toward, crease: number): V[][] => {
  const P = m.mesh.positions
  const T = m.mesh.triangles
  const lines: V[][] = []
  const facing = (i: number) => {
    const t = T[i]!
    const c = { x: (P[t[0]]!.x + P[t[1]]!.x + P[t[2]]!.x) / 3, y: (P[t[0]]!.y + P[t[1]]!.y + P[t[2]]!.y) / 3, z: (P[t[0]]!.z + P[t[1]]!.z + P[t[2]]!.z) / 3 }
    return dot(m.faceN[i]!, toward(c)) > 0
  }
  const cos = Math.cos(crease)
  // Creases and boundaries, as single segments (the caller joins nothing:
  // each is a straight edge).
  const chainable: [V, V][] = []
  for (const e of m.edges.values()) {
    const [f1, f2] = e.tris
    if (f2 === undefined) {
      if (facing(f1!)) chainable.push([P[e.a]!, P[e.b]!])
      continue
    }
    if (e.tris.length > 2) continue // non-manifold: leave it
    if (dot(m.faceN[f1!]!, m.faceN[f2]!) >= cos) continue // smooth: the contour's job
    if (facing(f1!) || facing(f2)) chainable.push([P[e.a]!, P[e.b]!])
  }
  lines.push(...chain(chainable, m.size))
  // Contours, keyed by the edge each crossing lies on, so neighbouring
  // triangles' segments meet exactly.
  const at = new Map<string, V>()
  const links: [string, string][] = []
  T.forEach((t, i) => {
    const cuts: string[] = []
    for (let k = 0; k < 3; k++) {
      const k1 = (k + 1) % 3
      const u = t[k]!
      const w = t[k1]!
      // g at both ends of the edge. An edge from a SINGULAR vertex (a
      // cone's apex) is read with its regular end's normal at both ends —
      // along a generator the normal is constant — so the two triangles
      // that share the edge agree on where the contour crosses it.
      const su = m.singular.has(u)
      const sw = m.singular.has(w)
      if (su && sw) continue
      const nu = sw ? m.cornerN[i]![k]! : su ? m.cornerN[i]![k1]! : m.cornerN[i]![k]!
      const nw = su ? m.cornerN[i]![k1]! : sw ? m.cornerN[i]![k]! : m.cornerN[i]![k1]!
      const ga = dot(nu, toward(P[u]!))
      const gb = dot(nw, toward(P[w]!))
      if (ga < 0 === gb < 0) continue
      const key = u < w ? `${u},${w}` : `${w},${u}`
      // Crossings are keyed by the edge they lie on, so neighbouring
      // triangles' segments meet exactly.
      const s = ga / (ga - gb)
      if (!at.has(key)) at.set(key, lerp(P[u]!, P[w]!, s))
      cuts.push(key)
    }
    if (cuts.length === 2) links.push([cuts[0]!, cuts[1]!])
    else if (cuts.length === 1) {
      // One crossing and a singular corner: g is constant along the edges
      // to that corner, so the zero line runs from the crossing to the
      // corner itself — a cone's contour, from its rim to its apex.
      const apex = t.find((v) => m.singular.has(v))
      if (apex !== undefined) {
        const key = `v${apex}`
        if (!at.has(key)) at.set(key, P[apex]!)
        links.push([cuts[0]!, key])
      }
    }
  })
  lines.push(...chainKeys(links, at))
  return lines
}

/** Join segments sharing endpoints (within a tolerance) into polylines. */
const chain = (segs: [V, V][], size: number): V[][] => {
  const q = (p: V) => {
    const k = 1e6 / size
    return `${Math.round(p.x * k)},${Math.round(p.y * k)},${Math.round(p.z * k)}`
  }
  const pos = new Map<string, V>()
  const links: [string, string][] = segs.map(([a, b]) => {
    const ka = q(a)
    const kb = q(b)
    if (!pos.has(ka)) pos.set(ka, a)
    if (!pos.has(kb)) pos.set(kb, b)
    return [ka, kb]
  })
  // Creases chain only through vertices of degree 2 — a box corner (degree
  // 3) ends three lines, which is how a line drawing reads — and only
  // through gentle turns.
  return chainKeys(links, pos, true)
}

/** Walk a graph of keyed links into polylines (open or closed). */
const chainKeys = (links: [string, string][], pos: Map<string, V>, straightOnly = false): V[][] => {
  const adj = new Map<string, number[]>()
  links.forEach(([a, b], i) => {
    adj.set(a, [...(adj.get(a) ?? []), i])
    adj.set(b, [...(adj.get(b) ?? []), i])
  })
  const used = new Set<number>()
  const out: V[][] = []
  const other = (i: number, k: string) => (links[i]![0] === k ? links[i]![1] : links[i]![0])
  const walk = (startLink: number, from: string): string[] => {
    const keys = [from]
    let cur = from
    let link = startLink
    for (;;) {
      used.add(link)
      const next = other(link, cur)
      keys.push(next)
      const options = (adj.get(next) ?? []).filter((j) => !used.has(j))
      if (options.length !== 1 || (adj.get(next)?.length ?? 0) !== 2) break
      if (straightOnly) {
        // A crease goes on through a gentle turn (a cone's rim is a 48-gon)
        // and ends at a real corner (more than 30°), where lines meet.
        const a = pos.get(cur)!
        const b = pos.get(next)!
        const c = pos.get(other(options[0]!, next))!
        const u = sub(b, a)
        const w = sub(c, b)
        if (dot(u, w) < Math.cos(Math.PI / 6) * len(u) * len(w)) break
      }
      cur = next
      link = options[0]!
    }
    return keys
  }
  // Start at line ends (degree ≠ 2) first, then close the loops.
  const ends = [...adj.keys()].filter((k) => adj.get(k)!.length !== 2).sort()
  for (const k of ends)
    for (const i of adj.get(k)!) if (!used.has(i)) out.push(walk(i, k).map((key) => pos.get(key)!))
  links.forEach((l, i) => {
    if (used.has(i)) return
    out.push(walk(i, l[0]).map((key) => pos.get(key)!))
  })
  return out
}
