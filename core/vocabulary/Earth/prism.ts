/**
 * prism.ts — the one construction both building symbols share: a 2D
 * profile in the XY plane, extruded along z, drawn as a LINE DRAWING with
 * true hidden lines.
 *
 * A prism's ink is its two profile loops and one rib per profile vertex
 * joining them — exactly the edges a line drawing of the solid has. Its
 * body is a black solid `Surface` that writes depth (parts/surface.ts), so
 * the edges on its far side vanish behind its own near faces at any angle
 * the camera takes, and whatever stands behind the building is covered.
 * The ink of every prism of a `Building` is ONE `Polylines` (one mesh, one
 * draw) — a fleet of buildings is a few dozen strokes, not thousands.
 *
 * The body is INSET a little toward its centre: an edge drawn exactly on a
 * face would fight that face for depth (a ribbon's quad carries its line's
 * depth across its whole width), so the faces sit just behind the edges
 * that bound them — and still far in front of the edges behind.
 */

import { ShapeUtils, Vector2 } from "three/webgpu"
import type { Observer } from "../../src/dream"
import type { Holon } from "../../src/holon"
import { Null, type Vec3Like } from "../../src/parts/primitives"
import { Polylines } from "../../src/parts/polylines"
import { Surface } from "../../src/parts/surface"
import { rgb } from "../../src/constants"
import { paramEpoch } from "../../src/params"
import { hiddenLineDrawing, type MeshSolid } from "../../src/geometry/hiddenline"
import { meshHits, prepareMesh } from "../../src/geometry/meshlines"
import { localView, toWorld, viewOf, type View } from "../../src/geometry/frames"

export type P2 = readonly [number, number]

/** How far a body shrinks toward its centre behind its own edges. */
const BODY_INSET = 0.03

/** The black of a building's body — the page, so a building is its edges. */
export const BODY = rgb(0, 0, 0)

/** What a prism is drawn with — params (or literals) bound into every part. */
export interface Ink {
  tint: unknown
  stroke: unknown
  body: unknown
}

/**
 * Compose a prism into `owner`: `profile` (XY, open ring, any winding, may
 * be concave) extruded from z = −depth/2 to +depth/2, shifted by `offset`.
 * Returns the prism's SHAPE in the owner's space — what a `Building` reads
 * for its visible edges (a morph target): its exact (un-inset) mesh, finely
 * subdivided (the hidden-line pass scales its self-occlusion margin by the
 * mean facet, which a bare prism's few big triangles would make a large
 * fraction of the building), and the edges it draws, as segments.
 */
export const prism = (
  owner: Null,
  profile: readonly P2[],
  depth: number,
  ink: Ink,
  offset: Vec3Like = { x: 0, y: 0, z: 0 },
): PrismShape => {
  const add = <T extends Holon>(h: T): T => owner.attach(h)
  const z0 = -depth / 2 + offset.z
  const z1 = depth / 2 + offset.z
  const at = ([x, y]: P2, z: number): Vec3Like => ({ x: x + offset.x, y: y + offset.y, z })

  // The body first, so its depth is in place before any ink composites.
  const body = add(new Surface({ solid: true, tint: ink.body }))
  const n = profile.length
  const xs = profile.map((p) => p[0])
  const ys = profile.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2 + offset.x
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2 + offset.y
  const cz = offset.z
  const k = 1 - BODY_INSET
  const positions: number[] = []
  for (const z of [z0, z1]) {
    for (const p of profile) {
      const q = at(p, z)
      positions.push(cx + (q.x - cx) * k, cy + (q.y - cy) * k, cz + (q.z - cz) * k)
    }
  }
  const indices: number[] = []
  const caps = ShapeUtils.triangulateShape(profile.map(([x, y]) => new Vector2(x, y)), [])
  for (const [a, b, c] of caps) indices.push(a!, b!, c!, a! + n, b! + n, c! + n)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    indices.push(i, j, j + n, i, j + n, i + n)
  }
  body.positions = new Float32Array(positions)
  body.indices = new Uint32Array(indices)

  const loops: Vec3Like[][] = []
  const edges: Segment[] = []
  for (const z of [z1, z0]) {
    const loop = [...profile.map((p) => at(p, z)), at(profile[0]!, z)]
    loops.push(loop)
    for (let i = 1; i < loop.length; i++) edges.push([loop[i - 1]!, loop[i]!])
  }
  for (const p of profile) {
    loops.push([at(p, z1), at(p, z0)])
    edges.push([at(p, z1), at(p, z0)])
  }
  const triangles = Array.from({ length: indices.length / 3 }, (_, t): Tri => [indices[3 * t]!, indices[3 * t + 1]!, indices[3 * t + 2]!])
  return { mesh: { kind: "mesh", ...subdivide([z0, z1].flatMap((z) => profile.map((p) => at(p, z))), triangles, 3) }, edges, loops, ink }
}

type Segment = readonly [Vec3Like, Vec3Like]

/** A prism as hidden-line removal sees it (its closed mesh, its edges), and its ink (loops + pen). */
export interface PrismShape {
  mesh: MeshSolid
  edges: Segment[]
  /** The edges as polylines: the two profile loops and the ribs — what `Building.shape` inks. */
  loops: Vec3Like[][]
  ink: Ink
}

/** A line lying ON a face (outward `normal`): seen where that face faces the eye and nothing hides it. */
export interface FaceLine {
  points: Vec3Like[]
  normal: Vec3Like
}

/** hiddenline.ts's default crease angle — the key its prepared meshes are cached under. */
const CREASE = 0.6

/**
 * A building made of prisms — and a MORPH TARGET: `worldCurves()` answers
 * its VISIBLE edges in world space, seen from `seenBy`'s observer, so
 * Morph(truck, building) lands on what the camera shows, not on the edges
 * its body hides. A subclass composes its prisms through `prism()` and
 * hands their shapes (and any lines lying on their faces) to `shape()`.
 */
export class Building extends Null {
  /** The observer whose view decides which edges `worldCurves()` sees (default: the default eye). */
  seenBy: (() => Observer) | undefined = undefined

  private shapes: PrismShape[] = []
  private faceLines: FaceLine[] = []
  private shapeVersion = 0
  private curves?: { epoch: number; key: number[]; curves: Vec3Like[][] }

  /**
   * State what the building is made of (call from compose, after its
   * prisms): inks them as ONE Polylines per pen (tint + stroke).
   */
  protected shape(shapes: PrismShape[], faceLines: FaceLine[] = []): void {
    this.shapes = shapes
    this.faceLines = faceLines
    this.shapeVersion++
    const pens: { tint: unknown; stroke: unknown; loops: Vec3Like[][] }[] = []
    for (const s of shapes) {
      const pen = pens.find((p) => p.tint === s.ink.tint && p.stroke === s.ink.stroke)
      if (pen) pen.loops.push(...s.loops)
      else pens.push({ tint: s.ink.tint, stroke: s.ink.stroke, loops: [...s.loops] })
    }
    for (const { tint, stroke, loops } of pens) this.attach(new Polylines({ tint, stroke, loops }))
  }

  private view(): View {
    const obs = this.seenBy?.()
    return obs ? viewOf(obs) : { eye: { x: 0, y: 0, z: 1500 } }
  }

  /** Numbers that move whenever `worldCurves()` would — the local view, the shape and the transform chain. */
  curveSignature(): number[] {
    void this.parts
    const v = localView(this, this.view())
    const out = "eye" in v ? [0, v.eye.x, v.eye.y, v.eye.z] : [1, v.toward.x, v.toward.y, v.toward.z]
    out.push(this.shapeVersion)
    for (let n: Holon | undefined = this; n; n = n.parent) {
      out.push(n.x.value, n.y.value, n.z.value, n.h.value, n.p.value, n.b.value, n.scale.value)
    }
    return out
  }

  /** The visible edges in WORLD space — what a morph lands on (MorphCurves `curvesOf`). */
  worldCurves(): Vec3Like[][] {
    void this.parts
    const epoch = paramEpoch()
    const m = this.curves
    if (m?.epoch === epoch) return m.curves
    const key = this.curveSignature()
    if (m && m.key.length === key.length && m.key.every((x, i) => x === key[i])) {
      m.epoch = epoch
      return m.curves
    }
    const view = localView(this, this.view())
    const toward = (p: Vec3Like): Vec3Like => {
      const d = "eye" in view ? { x: view.eye.x - p.x, y: view.eye.y - p.y, z: view.eye.z - p.z } : view.toward
      const l = Math.hypot(d.x, d.y, d.z) || 1
      return { x: d.x / l, y: d.y / l, z: d.z / l }
    }
    const meshes = this.shapes.map((s) => s.mesh)
    const lifts = this.shapes.map((s) => ({ facet: prepareMesh(s.mesh, CREASE).facet, edges: s.edges }))
    // The drawing lifts each point toward the eye along its own sight line
    // (so a ribbon never sinks into a fill); a morph wants the edge itself.
    const onEdge = (p: Vec3Like): Vec3Like => unlift(p, toward(p), lifts)
    const local = hiddenLineDrawing(meshes, view).lines.map((l) => l.map(onEdge))
    local.push(...visibleRuns(this.faceLines, meshes, view, toward))
    const curves = local.map((l) => l.map((p) => toWorld(this, p)))
    this.curves = { epoch, key, curves }
    return curves
  }
}

/**
 * Undo the drawing's lift: hiddenline moved each point toward the eye by
 * exactly its mesh's mean facet, along its own sight line `d`. Step back by
 * each prism's facet in turn; the step that lands on that prism's own edges
 * is the one (exact — no guessing between edges that line up in projection).
 */
const unlift = (p: Vec3Like, d: Vec3Like, shapes: readonly { facet: number; edges: readonly Segment[] }[]): Vec3Like => {
  let best = p
  let bestD = Infinity
  for (const { facet, edges } of shapes) {
    const q = { x: p.x - d.x * facet, y: p.y - d.y * facet, z: p.z - d.z * facet }
    for (const [a, b] of edges) {
      const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
      const uu = u.x * u.x + u.y * u.y + u.z * u.z || 1
      const t = Math.max(0, Math.min(1, ((q.x - a.x) * u.x + (q.y - a.y) * u.y + (q.z - a.z) * u.z) / uu))
      const e = { x: a.x + u.x * t, y: a.y + u.y * t, z: a.z + u.z * t }
      const dist = Math.hypot(e.x - q.x, e.y - q.y, e.z - q.z)
      if (dist < bestD) {
        bestD = dist
        best = e
      }
    }
  }
  return best
}

/** The runs of face lines the eye sees: their face turned toward it and no mesh in between. */
const visibleRuns = (lines: readonly FaceLine[], meshes: readonly MeshSolid[], view: View, toward: (p: Vec3Like) => Vec3Like): Vec3Like[][] => {
  if (!lines.length) return []
  const prepared = meshes.map((m) => prepareMesh(m, CREASE))
  const size = Math.max(...prepared.map((m) => m.size))
  const out: Vec3Like[][] = []
  for (const { points, normal: n } of lines) {
    let run: Vec3Like[] = []
    const seen = (q: Vec3Like): boolean => {
      const d = toward(q)
      if (d.x * n.x + d.y * n.y + d.z * n.z <= 1e-9) return false
      // Off the face a hair, so the face it lies on is not its own occluder.
      const o = { x: q.x + n.x * size * 1e-4, y: q.y + n.y * size * 1e-4, z: q.z + n.z * size * 1e-4 }
      const far = "eye" in view ? Math.hypot(view.eye.x - o.x, view.eye.y - o.y, view.eye.z - o.z) : Infinity
      return !prepared.some((m) => meshHits(m, o, d, 0, far))
    }
    const flush = () => {
      if (run.length >= 2) out.push(run)
      run = []
    }
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!
      const b = points[i]!
      const N = 24
      for (let k = i === 1 ? 0 : 1; k <= N; k++) {
        const q = { x: a.x + ((b.x - a.x) * k) / N, y: a.y + ((b.y - a.y) * k) / N, z: a.z + ((b.z - a.z) * k) / N }
        if (seen(q)) run.push(q)
        else flush()
      }
    }
    flush()
  }
  return out
}

type Tri = [number, number, number]

/** Split every triangle into four, `levels` times, sharing each edge's midpoint (the mesh stays closed). */
const subdivide = (positions: Vec3Like[], triangles: Tri[], levels: number): { positions: Vec3Like[]; triangles: Tri[] } => {
  for (let l = 0; l < levels; l++) {
    const mids = new Map<string, number>()
    const mid = (a: number, b: number): number => {
      const k = a < b ? `${a}|${b}` : `${b}|${a}`
      let m = mids.get(k)
      if (m === undefined) {
        const p = positions[a]!
        const q = positions[b]!
        m = positions.push({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2 }) - 1
        mids.set(k, m)
      }
      return m
    }
    triangles = triangles.flatMap(([a, b, c]): Tri[] => {
      const ab = mid(a, b)
      const bc = mid(b, c)
      const ca = mid(c, a)
      return [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]
    })
  }
  return { positions, triangles }
}

/** An axis-aligned w × h rectangle standing on y = 0. */
export const rect = (w: number, h: number): P2[] => [
  [-w / 2, 0],
  [w / 2, 0],
  [w / 2, h],
  [-w / 2, h],
]
