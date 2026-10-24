/**
 * Hidden line — the visible outline of a set of solids, as real 3D curves.
 *
 * TASTE's standing open problem is "perspective-dependent silhouette
 * extraction as real stroke geometry". The Cylinder answered it for one
 * primitive, inside the renderer (render/silhouette.ts, three-host's
 * syncCylinder), where nothing else can read it. A morph that lands on a
 * truck needs the truck's visible edges AS DATA — world-space polylines
 * it can partition and fly pieces onto — so this module states the same
 * idea as a pure function over plain data, for solids composed of boxes
 * and capped cylinders (what a platonic truck, a house, a crate, a
 * wheel, a cylinder-and-box machine is made of). CPU, by the split rule:
 * deciding WHAT lines exist is symbolic work.
 *
 * The curves are NOT drawn onto a plane. They are the solids' own edges
 * and contour generators in 3D, of which only the visible spans are
 * kept. Rotate the camera and the same edges stand where they belong in
 * space; only which spans are visible, and where the cylinders' contour
 * generators sit, depend on the eye.
 *
 *
 * WHAT IS DRAWN (the line-drawing rule)
 *
 *   An EDGE between two faces is drawn where at least one of its faces
 *   faces the eye. Both facing → a crease between two visible faces;
 *   one facing → a silhouette; neither → the back of the solid, hidden
 *   by the solid itself (every solid here is convex, so that is exact).
 *   A cylinder's cap rim is the edge between its cap and its mantle,
 *   decided point by point around the rim.
 *
 *   A CONTOUR GENERATOR is drawn on every cylinder the eye is outside of:
 *   the two mantle lines where the view ray grazes the surface,
 *   θ = φ ± acos(r / d) (render/silhouette.ts, the same formula, reused).
 *
 *   OCCLUSION BY OTHER SOLIDS is a ray test from each sample toward the
 *   eye against every other solid (slab test for boxes, quadric + caps for
 *   cylinders). Edges are sampled, cut into visible runs, and each
 *   visible/hidden transition is refined by bisection — so a wheel's rim
 *   ends exactly where the body's edge crosses it on screen.
 *
 * Solids may touch but should not interpenetrate: intersection curves
 * between two solids are not computed (none of the shapes this serves
 * needs one — a truck's wheels touch its chassis, they do not pierce it).
 *
 *
 * FILLS
 *
 * Every face that faces the eye is returned as a closed planar polygon
 * with its solid's fill colour, sorted BACK TO FRONT by solid depth — the
 * painter's order. A holon that draws them in that order (and its lines
 * after all of them) gets fills that occlude correctly between convex,
 * non-interpenetrating solids, with the host's fills unchanged.
 */

import type { Color } from "../constants"
import type { Vec3Like } from "../parts/primitives"
import { silhouetteAngles } from "../render/silhouette"
import { meshHits, meshLines, prepareMesh } from "./meshlines"

export type Axis = "x" | "y" | "z"

export interface Box {
  kind: "box"
  center: Vec3Like
  /** Full extents along x, y, z. */
  size: Vec3Like
  /** Fill colour of its visible faces; omit for an unfilled (see-through) solid. */
  fill?: Color
}

export interface CylinderSolid {
  kind: "cylinder"
  center: Vec3Like
  radius: number
  /** Full length along its axis. */
  height: number
  axis: Axis
  fill?: Color
}

/**
 * A flat rectangle lying ON a face — a window, a windshield, a grille.
 * Not a solid: it occludes nothing; its four edges are drawn when its
 * face (outward `normal`, axis-aligned) faces the viewer and nothing else
 * hides them. `size` has a zero extent along the normal.
 */
export interface Panel {
  kind: "panel"
  center: Vec3Like
  size: Vec3Like
  normal: Vec3Like
  fill?: Color
}

/**
 * Any closed (or open) triangle mesh — a sphere, cone, torus, lathe or
 * extrusion from geometry/meshes.ts, or anything else. Drawn by its
 * creases (faces meeting at more than `crease` radians, default 0.6) and
 * its smooth contours (geometry/meshlines.ts); it occludes everything,
 * itself included. Its fill is returned as triangles (`Drawing.surfaces`)
 * for a depth-writing Surface rather than as painter faces.
 */
export interface MeshSolid {
  kind: "mesh"
  positions: Vec3Like[]
  triangles: [number, number, number][]
  fill?: Color
  crease?: number
  /** false: an occluder only — it hides what lies behind it (and keeps its
   *  fill) but draws no lines of its own, so another drawing can draw them
   *  in its own pen (vocabulary/Parody: one body, two inks). Default true. */
  lines?: boolean
}

export type Solid = Box | CylinderSolid | Panel | MeshSolid

/**
 * Where the drawing is seen from. `eye` is a perspective camera position;
 * `toward` is an orthographic view, the unit direction FROM the scene
 * TOWARD the viewer.
 */
import type { View } from "./frames"
/** Where a view sees from — defined with the frame maths (frames.ts). */
export type { View }

export interface Face {
  /** Closed polygon (last point repeats the first), planar. */
  points: Vec3Like[]
  fill: Color
  /** Which solid it belongs to (index into the input). */
  solid: number
}

export interface Drawing {
  /** Visible edge and contour spans, open or closed polylines. */
  lines: Vec3Like[][]
  /** Visible faces of filled solids, back to front. */
  faces: Face[]
  /**
   * Filled meshes, whole (view-independent): their triangles for an
   * opaque, depth-writing Surface — the GPU hides what is behind them.
   */
  surfaces?: { solid: number; positions: Vec3Like[]; triangles: [number, number, number][]; fill: Color }[]
}

export interface HiddenLineOptions {
  /** Rim samples per full circle. Default 96. */
  rimSegments?: number
  /** Samples per straight edge (for occlusion). Default 48. */
  edgeSamples?: number
}

// ─── Vectors ────────────────────────────────────────────────────────

const v = (x: number, y: number, z: number): Vec3Like => ({ x, y, z })
const add = (a: Vec3Like, b: Vec3Like): Vec3Like => v(a.x + b.x, a.y + b.y, a.z + b.z)
const sub = (a: Vec3Like, b: Vec3Like): Vec3Like => v(a.x - b.x, a.y - b.y, a.z - b.z)
const mul = (a: Vec3Like, k: number): Vec3Like => v(a.x * k, a.y * k, a.z * k)
const dot = (a: Vec3Like, b: Vec3Like): number => a.x * b.x + a.y * b.y + a.z * b.z
const lerp = (a: Vec3Like, b: Vec3Like, t: number): Vec3Like => add(a, mul(sub(b, a), t))
const comp = (a: Vec3Like, axis: Axis): number => a[axis]

/** The direction from point p toward the viewer (unnormalised for perspective). */
const towardViewer = (view: View, p: Vec3Like): Vec3Like =>
  "eye" in view ? sub(view.eye, p) : view.toward

/** Does the plane through p with outward normal n face the viewer? */
const facing = (view: View, p: Vec3Like, n: Vec3Like): boolean => dot(n, towardViewer(view, p)) > 1e-9

// ─── Cylinder frame ─────────────────────────────────────────────────

/**
 * A cylinder's frame (eu, ea, ev): ea along the axis, and (eu, ev) such
 * that the mantle point at θ is c + r(cosθ·eu + sinθ·ev). Chosen so the
 * "y" axis reproduces render/silhouette.ts's parameterisation exactly
 * (eu = +x, ev = +z), which is what lets its formula be reused verbatim.
 */
const frameOf = (axis: Axis): [Vec3Like, Vec3Like, Vec3Like] =>
  axis === "y"
    ? [v(1, 0, 0), v(0, 1, 0), v(0, 0, 1)]
    : axis === "x"
      ? [v(0, 1, 0), v(1, 0, 0), v(0, 0, 1)]
      : [v(1, 0, 0), v(0, 0, 1), v(0, 1, 0)]

const rimPoint = (c: CylinderSolid, theta: number, side: 1 | -1): Vec3Like => {
  const [eu, ea, ev] = frameOf(c.axis)
  return add(
    add(c.center, mul(ea, (side * c.height) / 2)),
    add(mul(eu, c.radius * Math.cos(theta)), mul(ev, c.radius * Math.sin(theta))),
  )
}

const mantleNormal = (c: CylinderSolid, theta: number): Vec3Like => {
  const [eu, , ev] = frameOf(c.axis)
  return add(mul(eu, Math.cos(theta)), mul(ev, Math.sin(theta)))
}

// ─── Ray tests ──────────────────────────────────────────────────────

/**
 * Does the segment o + t·d, t ∈ (tMin, tMax), hit the solid? Boxes by
 * the slab method; cylinders by the mantle quadric clipped to the height
 * plus the two cap discs.
 */
const hits = (s: Solid, o: Vec3Like, d: Vec3Like, tMin: number, tMax: number): boolean => {
  if (s.kind === "panel") return false
  if (s.kind === "mesh") return meshHits(prepared(s), o, d, tMin, tMax)
  if (s.kind === "box") {
    let lo = tMin
    let hi = tMax
    for (const a of ["x", "y", "z"] as const) {
      const half = comp(s.size, a) / 2
      const mn = comp(s.center, a) - half
      const mx = comp(s.center, a) + half
      const oa = comp(o, a)
      const da = comp(d, a)
      if (Math.abs(da) < 1e-15) {
        if (oa < mn || oa > mx) return false
        continue
      }
      let t0 = (mn - oa) / da
      let t1 = (mx - oa) / da
      if (t0 > t1) [t0, t1] = [t1, t0]
      lo = Math.max(lo, t0)
      hi = Math.min(hi, t1)
      if (lo > hi) return false
    }
    return true
  }
  const [eu, ea, ev] = frameOf(s.axis)
  const rel = sub(o, s.center)
  const ou = dot(rel, eu)
  const oa = dot(rel, ea)
  const ov = dot(rel, ev)
  const du = dot(d, eu)
  const da = dot(d, ea)
  const dv = dot(d, ev)
  const h = s.height / 2
  const r2 = s.radius * s.radius
  // Mantle.
  const A = du * du + dv * dv
  if (A > 1e-15) {
    const B = 2 * (ou * du + ov * dv)
    const C = ou * ou + ov * ov - r2
    const disc = B * B - 4 * A * C
    if (disc >= 0) {
      const sq = Math.sqrt(disc)
      for (const t of [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]) {
        if (t > tMin && t < tMax && Math.abs(oa + t * da) <= h) return true
      }
    }
  }
  // Caps.
  if (Math.abs(da) > 1e-15) {
    for (const side of [h, -h]) {
      const t = (side - oa) / da
      if (t > tMin && t < tMax) {
        const pu = ou + t * du
        const pv = ov + t * dv
        if (pu * pu + pv * pv <= r2) return true
      }
    }
  }
  return false
}

/**
 * Is point p (on solid `self`) hidden from the viewer? By any OTHER solid
 * — and, for a mesh, by itself too (a torus hides its own far side): the
 * test then starts toward the viewer by about a facet and a half, because a
 * smooth contour lies a little OFF the polygonal surface and its ray would
 * otherwise graze the neighbouring facets.
 */
const occluded = (solids: readonly Solid[], self: number, view: View, p: Vec3Like): boolean => {
  const me = solids[self]
  const selfTest = me?.kind === "mesh"
  if ("eye" in view) {
    const d = sub(view.eye, p)
    const dl = Math.hypot(d.x, d.y, d.z) || 1
    for (let i = 0; i < solids.length; i++) {
      if (i === self) {
        if (!selfTest) continue
        const eps = prepared(me as MeshSolid).facet * 1.5
        if (hits(me!, p, d, eps / dl, 1)) return true
        continue
      }
      if (hits(solids[i]!, p, d, 1e-6, 1)) return true
    }
    return false
  }
  for (let i = 0; i < solids.length; i++) {
    if (i === self) {
      if (!selfTest) continue
      const eps = prepared(me as MeshSolid).facet * 1.5
      if (hits(me!, p, view.toward, eps, Number.POSITIVE_INFINITY)) return true
      continue
    }
    if (hits(solids[i]!, p, view.toward, 1e-6, Number.POSITIVE_INFINITY)) return true
  }
  return false
}

/** A mesh solid's preparation (cached on its positions array). */
const prepared = (s: MeshSolid) => prepareMesh(s, s.crease ?? DEFAULT_CREASE)
const DEFAULT_CREASE = 0.6

// ─── Visible runs along a parametric edge ───────────────────────────

/**
 * Cut a parametric curve s ∈ [0, 1] → point into its visible spans.
 * `drawn(s)` is the line-drawing rule at s; occlusion by the other solids
 * is added here. Transitions are refined by bisection. `closed` joins a
 * run that wraps the parameter seam into one.
 */
const visibleRuns = (
  at: (s: number) => Vec3Like,
  drawn: (s: number) => boolean,
  solids: readonly Solid[],
  self: number,
  view: View,
  samples: number,
  closed: boolean,
  straight: boolean,
): Vec3Like[][] => {
  const ok = (s: number) => drawn(s) && !occluded(solids, self, view, at(s))
  const n = samples
  const vis: boolean[] = []
  for (let i = 0; i <= n; i++) vis.push(ok(i / n))
  if (closed) vis[n] = vis[0]!
  if (vis.every((x) => x)) {
    const pts = straight ? [at(0), at(1)] : Array.from({ length: n + 1 }, (_, i) => at(i / n))
    if (closed) pts[pts.length - 1] = pts[0]!
    return [pts]
  }
  if (!vis.some((x) => x)) return []
  const refine = (a: number, b: number): number => {
    // vis(a) !== vis(b); return the transition point.
    const va = ok(a)
    let lo = a
    let hi = b
    for (let it = 0; it < 18; it++) {
      const m = (lo + hi) / 2
      if (ok(m) === va) lo = m
      else hi = m
    }
    return (lo + hi) / 2
  }
  // Runs as parameter intervals.
  const runs: [number, number][] = []
  let start: number | undefined = vis[0] ? 0 : undefined
  for (let i = 1; i <= n; i++) {
    if (vis[i] && !vis[i - 1]) start = refine((i - 1) / n, i / n)
    if (!vis[i] && vis[i - 1]) {
      runs.push([start!, refine((i - 1) / n, i / n)])
      start = undefined
    }
  }
  if (start !== undefined) runs.push([start, 1])
  // A closed curve's run touching both ends of the parameter is one run.
  if (closed && runs.length > 1 && runs[0]![0] === 0 && runs[runs.length - 1]![1] === 1) {
    const last = runs.pop()!
    runs[0] = [last[0] - 1, runs[0]![1]]
  }
  // Only a closed curve's parameter wraps; an open edge's s = 1 is its far end.
  const wrap = (s: number) => at(closed && (s < 0 || s > 1) ? ((s % 1) + 1) % 1 : s)
  return runs
    .filter(([a, b]) => b - a > 1e-6)
    .map(([a, b]) => {
      if (straight) return [wrap(a), wrap(b)]
      const pts = [wrap(a)]
      for (let i = Math.ceil(a * n + 1e-9); i < b * n - 1e-9; i++) pts.push(wrap(i / n))
      pts.push(wrap(b))
      return pts
    })
}

// ─── Per-solid edges and faces ──────────────────────────────────────

interface BoxFace {
  n: Vec3Like
  corners: [Vec3Like, Vec3Like, Vec3Like, Vec3Like]
}

const boxFaces = (b: Box): BoxFace[] => {
  const { center: c, size } = b
  const hx = size.x / 2
  const hy = size.y / 2
  const hz = size.z / 2
  const P = (sx: number, sy: number, sz: number) => v(c.x + sx * hx, c.y + sy * hy, c.z + sz * hz)
  return [
    { n: v(1, 0, 0), corners: [P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)] },
    { n: v(-1, 0, 0), corners: [P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1)] },
    { n: v(0, 1, 0), corners: [P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1)] },
    { n: v(0, -1, 0), corners: [P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)] },
    { n: v(0, 0, 1), corners: [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)] },
    { n: v(0, 0, -1), corners: [P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), P(1, -1, -1)] },
  ]
}

const key = (p: Vec3Like) => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`

/** A box's 12 edges, each with its two faces' outward normals. Deterministic order. */
const boxEdges = (b: Box): { a: Vec3Like; b: Vec3Like; n1: Vec3Like; n2: Vec3Like }[] => {
  const faces = boxFaces(b)
  const seen = new Map<string, { a: Vec3Like; b: Vec3Like; n1: Vec3Like; n2?: Vec3Like }>()
  const order: string[] = []
  for (const f of faces) {
    for (let i = 0; i < 4; i++) {
      const a = f.corners[i]!
      const c = f.corners[(i + 1) % 4]!
      const k = [key(a), key(c)].sort().join("|")
      const e = seen.get(k)
      if (e) e.n2 = f.n
      else {
        seen.set(k, { a, b: c, n1: f.n })
        order.push(k)
      }
    }
  }
  return order.map((k) => {
    const e = seen.get(k)!
    return { a: e.a, b: e.b, n1: e.n1, n2: e.n2! }
  })
}

/** A solid moved by `d`, whatever its kind (a mesh's points move; its triangles stay). */
export const translateSolid = <S extends Solid>(s: S, d: Vec3Like): S => {
  if (s.kind === "mesh") {
    const moved = translatedMeshes.get(s.positions)
    const key = `${d.x},${d.y},${d.z}`
    if (moved?.key === key) return { ...s, positions: moved.positions }
    const positions = s.positions.map((p) => ({ x: p.x + d.x, y: p.y + d.y, z: p.z + d.z }))
    // Remember it, so a holon re-centring the same mesh every call hands the
    // drawing the SAME array (meshes are data: a new array is a new shape).
    translatedMeshes.set(s.positions, { key, positions })
    return { ...s, positions }
  }
  const c = (s as Box | CylinderSolid | Panel).center
  return { ...s, center: { x: c.x + d.x, y: c.y + d.y, z: c.z + d.z } }
}
const translatedMeshes = new WeakMap<object, { key: string; positions: Vec3Like[] }>()

/** A solid's axis-aligned bounding box, whatever its kind. */
export const solidBounds = (s: Solid): { lo: Vec3Like; hi: Vec3Like } => {
  if (s.kind === "mesh") {
    const b = prepared(s).bvh
    return { lo: { ...b.lo }, hi: { ...b.hi } }
  }
  const h =
    s.kind === "cylinder"
      ? {
          x: s.axis === "x" ? s.height / 2 : s.radius,
          y: s.axis === "y" ? s.height / 2 : s.radius,
          z: s.axis === "z" ? s.height / 2 : s.radius,
        }
      : { x: s.size.x / 2, y: s.size.y / 2, z: s.size.z / 2 }
  const c = s.center
  return { lo: { x: c.x - h.x, y: c.y - h.y, z: c.z - h.z }, hi: { x: c.x + h.x, y: c.y + h.y, z: c.z + h.z } }
}

/** Distance of a solid from the viewer — the painter's sort key. */
const depthOf = (view: View, s: Solid): number => {
  const c = s.kind === "mesh" ? prepared(s).centroid : s.center
  if (!("eye" in view)) return -dot(c, view.toward)
  const d = sub(c, view.eye)
  return Math.hypot(d.x, d.y, d.z)
}

/**
 * The visible line drawing of a set of solids from a view. Pure and
 * deterministic: lines come out solid by solid, edges in a fixed order.
 */
export const hiddenLineDrawing = (
  solids: readonly Solid[],
  view: View,
  opts: HiddenLineOptions = {},
): Drawing => {
  const rimN = opts.rimSegments ?? 96
  const edgeN = opts.edgeSamples ?? 48
  const lines: Vec3Like[][] = []
  const faces: (Face & { depth: number })[] = []

  const surfaces: NonNullable<Drawing["surfaces"]> = []
  solids.forEach((s, si) => {
    const depth = depthOf(view, s)
    if (s.kind === "mesh") {
      const m = prepared(s)
      const toward = (q: Vec3Like) => towardViewer(view, q)
      const step = m.size / 160
      for (const pl of s.lines === false ? [] : meshLines(m, toward, s.crease ?? DEFAULT_CREASE)) {
        if (pl.length < 2) continue
        const cum = [0]
        for (let i = 1; i < pl.length; i++) cum.push(cum[i - 1]! + Math.hypot(pl[i]!.x - pl[i - 1]!.x, pl[i]!.y - pl[i - 1]!.y, pl[i]!.z - pl[i - 1]!.z))
        const L = cum.at(-1)!
        if (L <= 0) continue
        const at = (u: number): Vec3Like => {
          const target = Math.min(1, Math.max(0, u)) * L
          let lo = 0
          let hi = cum.length - 1
          while (hi - lo > 1) {
            const mid = (lo + hi) >> 1
            if (cum[mid]! <= target) lo = mid
            else hi = mid
          }
          const span = cum[hi]! - cum[lo]!
          return lerp(pl[lo]!, pl[hi]!, span > 0 ? (target - cum[lo]!) / span : 0)
        }
        const a = pl[0]!
        const b = pl[pl.length - 1]!
        const closed = pl.length > 3 && Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-9 * m.size
        const straight = pl.length === 2
        // Each visible point moves toward the eye along its OWN line of
        // sight, by about a facet: its projection is exactly unchanged, but
        // it can never sink into the mesh's depth-writing fill (a contour
        // grazes its surface, and a ribbon there would lose half its width).
        const lift = m.facet
        const lifted = (q: Vec3Like): Vec3Like => {
          const d = towardViewer(view, q)
          const l = Math.hypot(d.x, d.y, d.z) || 1
          return { x: q.x + (d.x / l) * lift, y: q.y + (d.y / l) * lift, z: q.z + (d.z / l) * lift }
        }
        for (const run of visibleRuns(at, () => true, solids, si, view, Math.max(straight ? edgeN : 8, Math.ceil(L / step)), closed, straight))
          lines.push(run.map(lifted))
      }
      if (s.fill) surfaces.push({ solid: si, positions: s.positions, triangles: s.triangles, fill: s.fill })
      return
    }
    if (s.kind === "panel") {
      const { center: c, size: z } = s
      if (!facing(view, c, s.normal)) return
      // The rectangle's corners: the two non-zero extents of `size`.
      const axes = (["x", "y", "z"] as const).filter((a) => Math.abs(z[a]) > 0)
      if (axes.length !== 2) return
      const [a1, a2] = axes as ["x" | "y" | "z", "x" | "y" | "z"]
      const corner = (s1: number, s2: number): Vec3Like => {
        const p = { ...c }
        p[a1] += (s1 * z[a1]) / 2
        p[a2] += (s2 * z[a2]) / 2
        return p
      }
      const ring = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)]
      for (let i = 0; i < 4; i++) {
        const a = ring[i]!
        const b = ring[(i + 1) % 4]!
        lines.push(...visibleRuns((t) => lerp(a, b, t), () => true, solids, si, view, edgeN, false, true))
      }
      if (s.fill) faces.push({ points: [...ring, ring[0]!], fill: s.fill, solid: si, depth: depth - 1e-3 })
      return
    }
    if (s.kind === "box") {
      for (const e of boxEdges(s)) {
        const mid = lerp(e.a, e.b, 0.5)
        if (!facing(view, mid, e.n1) && !facing(view, mid, e.n2)) continue
        lines.push(
          ...visibleRuns((t) => lerp(e.a, e.b, t), () => true, solids, si, view, edgeN, false, true),
        )
      }
      if (s.fill)
        for (const f of boxFaces(s))
          if (facing(view, f.corners[0], f.n))
            faces.push({ points: [...f.corners, f.corners[0]], fill: s.fill, solid: si, depth })
      return
    }
    // Cylinder.
    const [eu, ea, ev] = frameOf(s.axis)
    const rel = "eye" in view ? sub(view.eye, s.center) : view.toward
    // Contour generators.
    let gens: number[] = []
    if ("eye" in view) {
      const ang = silhouetteAngles(dot(rel, eu), dot(rel, ev), s.radius)
      if (ang) gens = [ang.thetaA, ang.thetaB]
    } else {
      const phi = Math.atan2(dot(rel, ev), dot(rel, eu))
      if (Math.hypot(dot(rel, ev), dot(rel, eu)) > 1e-9) gens = [phi - Math.PI / 2, phi + Math.PI / 2]
    }
    const mantleFacing = (theta: number, side: 1 | -1) =>
      facing(view, rimPoint(s, theta, side), mantleNormal(s, theta))
    for (const side of [1, -1] as const) {
      const capN = mul(ea, side)
      const capC = add(s.center, mul(ea, (side * s.height) / 2))
      const capFacing = facing(view, capC, capN)
      // Start the rim on a generator when there is one, so a fully visible
      // rim's seam sits where a contour line meets it.
      const t0 = gens[0] ?? 0
      lines.push(
        ...visibleRuns(
          (u) => rimPoint(s, t0 + u * 2 * Math.PI, side),
          (u) => capFacing || mantleFacing(t0 + u * 2 * Math.PI, side),
          solids,
          si,
          view,
          rimN,
          true,
          false,
        ),
      )
      if (s.fill && capFacing) {
        const pts = Array.from({ length: rimN + 1 }, (_, i) => rimPoint(s, (i / rimN) * 2 * Math.PI, side))
        pts[rimN] = pts[0]!
        faces.push({ points: pts, fill: s.fill, solid: si, depth })
      }
    }
    for (const g of gens) {
      const a = rimPoint(s, g, -1)
      const b = rimPoint(s, g, 1)
      lines.push(...visibleRuns((t) => lerp(a, b, t), () => true, solids, si, view, edgeN, false, true))
    }
    if (s.fill && gens.length === 2) {
      // The mantle's facing half: between the two generators, on the side
      // that faces the viewer — bottom rim one way, top rim back.
      let [ga, gb] = gens as [number, number]
      const midA = (ga + gb) / 2
      if (!mantleFacing(midA, 1) && !mantleFacing(midA, -1)) gb -= 2 * Math.PI
      const n = Math.max(8, Math.round((Math.abs(gb - ga) / (2 * Math.PI)) * rimN))
      const pts: Vec3Like[] = []
      for (let i = 0; i <= n; i++) pts.push(rimPoint(s, ga + ((gb - ga) * i) / n, -1))
      for (let i = n; i >= 0; i--) pts.push(rimPoint(s, ga + ((gb - ga) * i) / n, 1))
      pts.push(pts[0]!)
      faces.push({ points: pts, fill: s.fill, solid: si, depth })
    }
  })

  const order = paintOrder(solids, view, faces)
  faces.sort((a, b) => order.get(a.solid)! - order.get(b.solid)! || b.depth - a.depth)
  return {
    lines,
    faces: faces.map(({ points, fill, solid }) => ({ points, fill, solid })),
    ...(surfaces.length ? { surfaces } : {}),
  }
}

/**
 * The painter's order of the filled solids: B paints after A whenever B
 * hides any sample of A's visible faces (its corners pulled 10% toward
 * the centroid, and the centroid). Kahn's topological sort over that
 * relation, the farther solid first among the ready ones; a cycle (which
 * convex, non-interpenetrating solids should not form) falls back to
 * depth for what remains. Sorting by solid centres alone fails exactly
 * where it matters — a long chassis rail whose centre is nearer the
 * camera than the cargo box that hides it.
 */
const paintOrder = (
  solids: readonly Solid[],
  view: View,
  faces: readonly (Face & { depth: number })[],
): Map<number, number> => {
  const ids = [...new Set(faces.map((f) => f.solid))]
  const depth = new Map(faces.map((f) => [f.solid, f.depth]))
  const samples = new Map<number, Vec3Like[]>()
  for (const f of faces) {
    const ring = f.points.slice(0, -1)
    const c = ring.reduce((a, p) => add(a, mul(p, 1 / ring.length)), v(0, 0, 0))
    const step = Math.max(1, Math.floor(ring.length / 8))
    const pts = [c]
    for (let i = 0; i < ring.length; i += step) pts.push(lerp(ring[i]!, c, 0.1))
    samples.set(f.solid, [...(samples.get(f.solid) ?? []), ...pts])
  }
  const after = new Map<number, Set<number>>(ids.map((i) => [i, new Set()]))
  const indeg = new Map<number, number>(ids.map((i) => [i, 0]))
  for (const a of ids)
    for (const b of ids) {
      if (a === b) continue
      const solid = solids[b]!
      const hidden = samples.get(a)!.some((p) =>
        "eye" in view
          ? hits(solid, p, sub(view.eye, p), 1e-6, 1)
          : hits(solid, p, view.toward, 1e-6, Number.POSITIVE_INFINITY),
      )
      if (hidden && !after.get(a)!.has(b)) {
        after.get(a)!.add(b)
        indeg.set(b, indeg.get(b)! + 1)
      }
    }
  const out = new Map<number, number>()
  const remaining = new Set(ids)
  const byDepth = (x: number, y: number) => depth.get(y)! - depth.get(x)! || x - y
  while (remaining.size) {
    const ready = [...remaining].filter((i) => indeg.get(i) === 0).sort(byDepth)
    const next = ready[0] ?? [...remaining].sort(byDepth)[0]!
    out.set(next, out.size)
    remaining.delete(next)
    for (const b of after.get(next)!) indeg.set(b, indeg.get(b)! - 1)
  }
  return out
}
