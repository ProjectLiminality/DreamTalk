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

// Same @types/three lag as ribbon.ts: UserDataNode misses the typed
// Node<...> surface — the graph is verified when the shader builds.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { userData } = TSLTyped as any

/** The per-mesh value slots the shared fill material reads (FillShape
 *  owns the writes). */
const FILL_KEYS = {
  tint: "dtFillTint",
  fade: "dtFillFade",
} as const

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

/** A flat ellipse as a triangle fan around its center. */
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
  }

  /** Sync visibility/opacity/color from the owning holon. */
  style(opacity: number, tint: Color): void {
    this.mesh.userData[FILL_KEYS.fade] = opacity
    ;(this.mesh.userData[FILL_KEYS.tint] as THREE.Color).setRGB(tint.r, tint.g, tint.b)
    this.mesh.visible = opacity > 0
  }
}
