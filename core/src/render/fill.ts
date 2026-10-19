/**
 * Flat filled shapes — the sanctioned entry of fills into the host
 * (PLAN Ch 9 vocabulary: the Eye's iris and pupil, arrowheads on
 * axes). Deliberately minimal: a convex polygon triangulated as a fan,
 * flat color, straight-alpha NORMAL blending (unlike the strokes' max
 * blending — a fill must be able to COVER what is behind it: the black
 * pupil sits on the colored iris). Edges rely on the renderer's MSAA;
 * the crisp-AA budget stays with the stroke pipeline.
 *
 * Ordering: with depth writes off everywhere, stacking is explicit —
 * every fill carries a renderOrder from the host's attach sequence, so
 * fills composite over the strokes and over earlier fills in
 * declaration order (iris first, pupil on top).
 *
 * LESSON (ribbon.ts, still law): animated material values flow through
 * TSL nodes, never plain material props — tint and fade here. And as in
 * ribbon.ts, ONE material serves every fill: tint/fade are OBJECT-updated
 * userData reference nodes, so identical fills stop costing one WGSL
 * NodeBuilder build each (the r185 node cache keys by node identity).
 */

import * as THREE from "three/webgpu"
import * as TSLTyped from "three/tsl"
import type { Color } from "../constants"
import type { Vec3Like } from "../parts/index"
import { evenOddTriangulation } from "../geometry/evenodd"

// Same @types/three lag as ribbon.ts: UserDataNode misses the typed
// Node<...> surface — the graph is verified when the shader builds.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { userData, positionLocal, smoothstep, float, max, attribute } = TSLTyped as any

/** The per-mesh value slots the shared fill material reads (FillShape
 *  owns the writes). */
const FILL_KEYS = {
  tint: "dtFillTint",
  fade: "dtFillFade",
  falloff: "dtFillFalloff",
  radius: "dtFillFalloffRadius",
  at: "dtFillFalloffAt",
} as const

/**
 * EVEN-ODD FILLS, by their exact subpaths (FillShape.setPolygons). The
 * sweep is O(n²) and a song repeats its drawings — InterBrain's third
 * chapter washes 4,691 drawings of 327 distinct shapes, and residency
 * mounts them again on every return — so one triangulation serves every
 * drawing with the same coordinates, as the very arrays setPolygon would
 * have built (Float32 positions, three's own Uint16/Uint32 index choice):
 * byte-identical, and the meshes share them instead of each holding a copy.
 * Keyed by the exact coordinates (a hash, then a full compare); bounded:
 * least-recently-used shapes go once the cached floats pass the budget.
 */
interface EvenOddShape {
  /** The subpaths flattened: per subpath its length, then x, y, z per point. */
  key: Float64Array
  positions: Float32Array
  index: Uint16Array | Uint32Array
  extent: number
}
const EVEN_ODD_BUDGET_FLOATS = 2_000_000
const evenOddShapes = new Map<number, EvenOddShape[]>()
let evenOddFloats = 0
const shapeFloats = (e: EvenOddShape): number => e.key.length + e.positions.length + e.index.length
const evenOddShape = (subpaths: readonly (readonly Vec3Like[])[]): EvenOddShape | undefined => {
  let n = 0
  for (const loop of subpaths) n += 1 + loop.length * 3
  const key = new Float64Array(n)
  let k = 0
  for (const loop of subpaths) {
    key[k++] = loop.length
    for (const p of loop) {
      key[k++] = p.x
      key[k++] = p.y
      key[k++] = p.z
    }
  }
  const words = new Uint32Array(key.buffer)
  let h = 0x811c9dc5 ^ n
  for (let i = 0; i < words.length; i++) h = Math.imul(h ^ words[i]!, 0x01000193)
  const bucket = evenOddShapes.get(h)
  const same = (e: EvenOddShape): boolean => {
    if (e.key.length !== n) return false
    for (let i = 0; i < n; i++) if (!Object.is(e.key[i], key[i])) return false
    return true
  }
  const hit = bucket?.find(same)
  if (hit) {
    // Refresh recency: a Map iterates in insertion order.
    evenOddShapes.delete(h)
    evenOddShapes.set(h, bucket!)
    return hit.positions.length === 0 ? undefined : hit
  }
  const { points, indices } = evenOddTriangulation(subpaths)
  const positions = new Float32Array(indices.length === 0 ? 0 : points.length * 3)
  let extent = 0
  if (indices.length > 0) {
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i]!.x
      positions[i * 3 + 1] = points[i]!.y
      positions[i * 3 + 2] = points[i]!.z
    }
    for (const p of points) extent = Math.max(extent, Math.hypot(p.x, p.y))
  }
  // three's own index typing (BufferGeometry.setIndex of a plain array).
  const indexed = new THREE.BufferGeometry().setIndex(indices).index
  const shape: EvenOddShape = {
    key,
    positions,
    index: (indexed?.array as Uint16Array | Uint32Array | undefined) ?? new Uint16Array(0),
    extent,
  }
  if (bucket) {
    bucket.push(shape)
    evenOddShapes.delete(h)
    evenOddShapes.set(h, bucket)
  } else evenOddShapes.set(h, [shape])
  evenOddFloats += shapeFloats(shape)
  for (const [kh, list] of evenOddShapes) {
    if (evenOddFloats <= EVEN_ODD_BUDGET_FLOATS || kh === h) break
    evenOddShapes.delete(kh)
    for (const e of list) evenOddFloats -= shapeFloats(e)
  }
  return indices.length === 0 ? undefined : shape
}

/** The one fill material every FillShape shares. Lazy so importing this
 *  module stays side-effect free. */
let shared: THREE.MeshBasicNodeMaterial | undefined
const sharedFillMaterial = (): THREE.MeshBasicNodeMaterial => {
  if (!shared) {
    shared = new THREE.MeshBasicNodeMaterial()
    shared.transparent = true
    shared.depthWrite = false
    shared.side = THREE.DoubleSide
    shared.colorNode = userData(FILL_KEYS.tint, "color")
    shared.opacityNode = userData(FILL_KEYS.fade, "float")
  }
  return shared
}

/**
 * The fill material with a per-VERTEX opacity (Surface `alphas`): the
 * shared material's, times the vertex's `alpha` attribute. Used only by a
 * mesh that carries alphas, so every other fill keeps its exact bytes.
 */
let sharedAlpha: THREE.MeshBasicNodeMaterial | undefined
const sharedAlphaFillMaterial = (): THREE.MeshBasicNodeMaterial => {
  if (!sharedAlpha) {
    const m = new THREE.MeshBasicNodeMaterial()
    m.transparent = true
    m.depthWrite = false
    m.side = THREE.DoubleSide
    m.colorNode = userData(FILL_KEYS.tint, "color")
    m.opacityNode = userData(FILL_KEYS.fade, "float").mul(attribute("alpha", "float"))
    sharedAlpha = m
  }
  return sharedAlpha
}

/**
 * The same with a per-VERTEX colour too (Surface `colors`): the tint times
 * the vertex's `dtColor` attribute — many particles in their own colours
 * as one mesh (DiscPool). The vertex colours are the tints' own values,
 * read exactly as `style` hands a tint to the shared material.
 */
let sharedColorAlpha: THREE.MeshBasicNodeMaterial | undefined
const sharedColorAlphaFillMaterial = (): THREE.MeshBasicNodeMaterial => {
  if (!sharedColorAlpha) {
    const m = new THREE.MeshBasicNodeMaterial()
    m.transparent = true
    m.depthWrite = false
    m.side = THREE.DoubleSide
    m.colorNode = userData(FILL_KEYS.tint, "color").mul(attribute("dtColor", "vec3"))
    m.opacityNode = userData(FILL_KEYS.fade, "float").mul(attribute("alpha", "float"))
    sharedColorAlpha = m
  }
  return sharedColorAlpha
}

/**
 * The SOLID material (parts/surface.ts `solid`): opaque and depth-writing —
 * the one thing in the host that anything can be behind. It renders in
 * three's opaque pass, before every transparent stroke and fill, so they
 * all depth-test against it. Never used by a shape that does not ask.
 *
 * Pushed back by a small CONSTANT depth bias only, against rounding where
 * ink lies exactly on a solid. Not slope-scaled: a slope bias grows without
 * bound toward a curved solid's silhouette, and on the Earth it let the far
 * side's coasts leak through as an arc along the limb. Ink that lies ON a
 * solid keeps clear of it geometrically instead (the Earth's ground sits
 * under its surface; a building's body is inset from its edges).
 */
let sharedSolid: THREE.MeshBasicNodeMaterial | undefined
const sharedSolidMaterial = (): THREE.MeshBasicNodeMaterial => {
  if (!sharedSolid) {
    const m = new THREE.MeshBasicNodeMaterial()
    m.transparent = false
    m.depthWrite = true
    m.side = THREE.DoubleSide
    m.polygonOffset = true
    m.polygonOffsetFactor = 0
    m.polygonOffsetUnits = 2
    m.colorNode = userData(FILL_KEYS.tint, "color")
    sharedSolid = m
  }
  return sharedSolid
}

/**
 * The same solid composited IN ATTACH ORDER (Surface `composite:
 * "inOrder"`): still opaque in colour and still depth-writing, but drawn
 * in the transparent pass at its renderOrder instead of before it — so it
 * covers what was attached before it (a bloom behind a globe) and
 * whatever is attached after it depth-tests against it as usual. Opacity
 * stays 1, so normal blending writes exactly the solid's colour.
 */
let sharedSolidInOrder: THREE.MeshBasicNodeMaterial | undefined
const sharedSolidInOrderMaterial = (): THREE.MeshBasicNodeMaterial => {
  if (!sharedSolidInOrder) {
    const m = new THREE.MeshBasicNodeMaterial()
    m.transparent = true
    m.depthWrite = true
    m.side = THREE.DoubleSide
    m.polygonOffset = true
    m.polygonOffsetFactor = 0
    m.polygonOffsetUnits = 2
    m.colorNode = userData(FILL_KEYS.tint, "color")
    sharedSolidInOrder = m
  }
  return sharedSolidInOrder
}

/**
 * The radial light for a CURVED sheet (a Surface): r is the 3D distance
 * from a local-space point (`Surface.fillFalloffX/Y/Z`), not from the
 * origin in the plane — land lit from a place on the globe. Its own
 * material, so the flat radial fill above is untouched.
 */
let sharedSurfaceGradient: THREE.MeshBasicNodeMaterial | undefined
const sharedSurfaceGradientMaterial = (): THREE.MeshBasicNodeMaterial => {
  if (!sharedSurfaceGradient) {
    const m = new THREE.MeshBasicNodeMaterial()
    m.transparent = true
    m.depthWrite = false
    m.side = THREE.DoubleSide
    const r = positionLocal.sub(userData(FILL_KEYS.at, "vec3")).length()
    const radius = max(userData(FILL_KEYS.radius, "float"), float(1e-6))
    const light = float(1).sub(userData(FILL_KEYS.falloff, "float").mul(smoothstep(0, radius, r)))
    m.colorNode = userData(FILL_KEYS.tint, "color").mul(light)
    m.opacityNode = userData(FILL_KEYS.fade, "float")
    sharedSurfaceGradient = m
  }
  return sharedSurfaceGradient
}

/** A flat ellipse as a triangle fan around its center. */
/**
 * The radial-light fill (Stroke.fillFalloff): the same flat fill, its
 * colour scaled by 1 − falloff · smoothstep(0, R, r), r the distance from
 * the mesh's local origin. A material of its own, used ONLY by fills that
 * ask for a falloff — every other fill keeps the shared flat material
 * above, so nothing that does not use it can render a different byte.
 */
let sharedGradient: THREE.MeshBasicNodeMaterial | undefined
const sharedGradientFillMaterial = (): THREE.MeshBasicNodeMaterial => {
  if (!sharedGradient) {
    const m = new THREE.MeshBasicNodeMaterial()
    m.transparent = true
    m.depthWrite = false
    m.side = THREE.DoubleSide
    const r = positionLocal.xy.length()
    const radius = max(userData(FILL_KEYS.radius, "float"), float(1e-6))
    const light = float(1).sub(userData(FILL_KEYS.falloff, "float").mul(smoothstep(0, radius, r)))
    m.colorNode = userData(FILL_KEYS.tint, "color").mul(light)
    m.opacityNode = userData(FILL_KEYS.fade, "float")
    sharedGradient = m
  }
  return sharedGradient
}

export const ellipsePolygon = (
  radiusX: number,
  radiusY: number,
  segments = 64,
): Vec3Like[] => {
  const pts: Vec3Like[] = [{ x: 0, y: 0, z: 0 }]
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push({ x: Math.cos(a) * radiusX, y: Math.sin(a) * radiusY, z: 0 })
  }
  return pts
}

export class FillShape {
  readonly mesh: THREE.Mesh
  readonly material: THREE.MeshBasicNodeMaterial

  constructor(renderOrder: number) {
    this.material = sharedFillMaterial()
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
    this.mesh.visible = false
    this.mesh.userData[FILL_KEYS.tint] = new THREE.Color(1, 1, 1)
    this.mesh.userData[FILL_KEYS.fade] = 1
  }

  /** The farthest point of the current shape from its local origin. */
  private extent = 0

  /**
   * Switch this fill to the radial-light material (Stroke.fillFalloff).
   * Called once, at attach, for a fill that will ever use a falloff.
   */
  useGradient(): void {
    this.mesh.material = sharedGradientFillMaterial()
    this.mesh.userData[FILL_KEYS.falloff] = 0
    this.mesh.userData[FILL_KEYS.radius] = 0
  }

  /** Switch this fill to the opaque, depth-writing solid material (once, at attach);
   *  `inOrder` composites it at its renderOrder (see sharedSolidInOrderMaterial). */
  useSolid(inOrder = false): void {
    this.mesh.material = inOrder ? sharedSolidInOrderMaterial() : sharedSolidMaterial()
  }

  /** Switch this fill to the curved sheet's radial light (once, at attach). */
  useSurfaceGradient(): void {
    this.mesh.material = sharedSurfaceGradientMaterial()
    this.mesh.userData[FILL_KEYS.falloff] = 0
    this.mesh.userData[FILL_KEYS.radius] = 0
    this.mesh.userData[FILL_KEYS.at] = new THREE.Vector3()
  }

  /** Where a curved sheet's light stands this frame, local space. */
  setGradientAt(x: number, y: number, z: number): void {
    ;(this.mesh.userData[FILL_KEYS.at] as THREE.Vector3).set(x, y, z)
  }

  /** The falloff this frame; a radius of 0 means the shape's own extent. */
  setGradient(falloff: number, radius: number): void {
    this.mesh.userData[FILL_KEYS.falloff] = falloff
    this.mesh.userData[FILL_KEYS.radius] = radius > 0 ? radius : this.extent
  }

  /**
   * Replace the shape. With no `indices` the points are read as a CONVEX
   * polygon and triangulated as a fan on vertex 0 — the original
   * contract, which every existing caller uses. A shape that is not
   * convex passes its own triangle list instead: the annular sector's
   * wash is a strip between two arcs, and a fan from its first point
   * would sweep triangles straight across the hole.
   */
  setPolygon(pts: readonly Vec3Like[], triangles?: readonly number[]): void {
    if (pts.length < 3) return
    const positions = new Float32Array(pts.length * 3)
    for (let i = 0; i < pts.length; i++) {
      positions[i * 3] = pts[i]!.x
      positions[i * 3 + 1] = pts[i]!.y
      positions[i * 3 + 2] = pts[i]!.z
    }
    const indices: number[] = []
    if (triangles) {
      indices.push(...triangles)
    } else {
      for (let i = 1; i < pts.length - 1; i++) indices.push(0, i, i + 1)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    this.mesh.geometry.dispose()
    this.mesh.geometry = geometry
    let extent = 0
    for (const p of pts) extent = Math.max(extent, Math.hypot(p.x, p.y))
    this.extent = extent
  }

  /**
   * Replace the shape with a ready triangle mesh (parts/surface.ts) — flat
   * xyz and triangle indices, taken as they are: a surface knows its own
   * triangulation, and a curved one has no plane to triangulate in.
   */
  setMesh(positions: Float32Array, indices: Uint32Array, alphas?: Float32Array, colors?: Float32Array): void {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    // Per-vertex opacity (Surface `alphas`): its own material, once, for a
    // sheet that carries them; a sheet that never does is untouched.
    if (alphas || colors) {
      const vertices = positions.length / 3
      geometry.setAttribute("alpha", new THREE.BufferAttribute(alphas ?? new Float32Array(vertices).fill(1), 1))
      if (colors) geometry.setAttribute("dtColor", new THREE.BufferAttribute(colors, 3))
      const m = this.mesh.material
      if (colors && (m === sharedFillMaterial() || m === sharedAlphaFillMaterial())) this.mesh.material = sharedColorAlphaFillMaterial()
      else if (!colors && m === sharedFillMaterial()) this.mesh.material = sharedAlphaFillMaterial()
    }
    this.mesh.geometry.dispose()
    this.mesh.geometry = geometry
    let extent = 0
    for (let i = 0; i < positions.length; i += 3) {
      extent = Math.max(extent, Math.hypot(positions[i]!, positions[i + 1]!))
    }
    this.extent = extent
  }

  /**
   * Replace the shape with the EVEN-ODD interior of a whole drawing —
   * several closed subpaths taken together, so a gear (a toothed rim and
   * an inner circle) fills as the annulus it is instead of flooding to
   * its centre. `setPolygon` fills one loop and cannot express a hole,
   * because a hole is not a property of either loop; see
   * geometry/evenodd.ts for the rule and the sweep that realises it.
   *
   * Separate from `setPolygon` rather than folded into it: every
   * existing caller passes a single convex loop, whose fan is both
   * correct and cheaper, and the Eye's disc must keep rendering the
   * bytes it renders today.
   */
  setPolygons(subpaths: readonly (readonly Vec3Like[])[]): void {
    const shape = evenOddShape(subpaths)
    const geometry = new THREE.BufferGeometry()
    // An empty interior is an empty mesh, not a stale one: a drawing
    // whose subpaths have all opened (or emptied) must stop painting.
    if (shape) {
      // The cached arrays are shared, never written: each mesh still owns
      // its geometry (and its GPU buffers), so disposal is unchanged.
      geometry.setAttribute("position", new THREE.BufferAttribute(shape.positions, 3))
      geometry.setIndex(new THREE.BufferAttribute(shape.index, 1))
      this.extent = shape.extent
    }
    this.mesh.geometry.dispose()
    this.mesh.geometry = geometry
  }

  /** Sync visibility/opacity/color from the owning holon. */
  style(opacity: number, tint: Color): void {
    this.mesh.userData[FILL_KEYS.fade] = opacity
    ;(this.mesh.userData[FILL_KEYS.tint] as THREE.Color).setRGB(tint.r, tint.g, tint.b)
    this.mesh.visible = opacity > 0
  }
}
