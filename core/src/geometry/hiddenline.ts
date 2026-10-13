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

export type Solid = Box | CylinderSolid

/**
 * Where the drawing is seen from. `eye` is a perspective camera position;
 * `toward` is an orthographic view, the unit direction FROM the scene
 * TOWARD the viewer.
 */
export type View = { eye: Vec3Like } | { toward: Vec3Like }

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

/** Is point p (on solid `self`) hidden from the viewer by any OTHER solid? */
const occluded = (solids: readonly Solid[], self: number, view: View, p: Vec3Like): boolean => {
  const scale = 1e-7
  if ("eye" in view) {
    const d = sub(view.eye, p)
    for (let i = 0; i < solids.length; i++) if (i !== self && hits(solids[i]!, p, d, 1e-6 + scale, 1)) return true
    return false
  }
  for (let i = 0; i < solids.length; i++)
    if (i !== self && hits(solids[i]!, p, view.toward, 1e-6, Number.POSITIVE_INFINITY)) return true
  return false
}

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
  const wrap = (s: number) => at(((s % 1) + 1) % 1)
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

/** Distance of a solid from the viewer — the painter's sort key. */
const depthOf = (view: View, s: Solid): number =>
  "eye" in view ? Math.hypot(...[sub(s.center, view.eye)].map((d) => [d.x, d.y, d.z]).flat()) : -dot(s.center, view.toward)

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

  solids.forEach((s, si) => {
    const depth = depthOf(view, s)
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

  faces.sort((a, b) => b.depth - a.depth || a.solid - b.solid)
  return { lines, faces: faces.map(({ points, fill, solid }) => ({ points, fill, solid })) }
}
