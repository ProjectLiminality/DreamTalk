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
 * LESSON (ribbon.ts, still law): animated material values are TSL
 * uniform nodes, never plain material props — tint and fade here.
 */

import * as THREE from "three/webgpu"
import { uniform } from "three/tsl"
import type { Color } from "../constants"
import type { Vec3Like } from "../parts/index"

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
  /** Fill color (same working-space semantics as the ribbon tint). */
  readonly tint = uniform(new THREE.Color(1, 1, 1))
  /** Fill opacity — creation (fill-in) × fade, resolved by the host. */
  readonly fade = uniform(1)

  constructor(renderOrder: number) {
    this.material = new THREE.MeshBasicNodeMaterial()
    this.material.transparent = true
    this.material.depthWrite = false
    this.material.side = THREE.DoubleSide
    this.material.colorNode = this.tint
    this.material.opacityNode = this.fade
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
    this.mesh.visible = false
  }

  /** Replace the shape: a convex polygon, triangulated as a fan on vertex 0. */
  setPolygon(pts: readonly Vec3Like[]): void {
    if (pts.length < 3) return
    const positions = new Float32Array(pts.length * 3)
    for (let i = 0; i < pts.length; i++) {
      positions[i * 3] = pts[i]!.x
      positions[i * 3 + 1] = pts[i]!.y
      positions[i * 3 + 2] = pts[i]!.z
    }
    const indices: number[] = []
    for (let i = 1; i < pts.length - 1; i++) indices.push(0, i, i + 1)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    this.mesh.geometry.dispose()
    this.mesh.geometry = geometry
  }

  /** Sync visibility/opacity/color from the owning holon. */
  style(opacity: number, tint: Color): void {
    this.fade.value = opacity
    this.tint.value.setRGB(tint.r, tint.g, tint.b)
    this.mesh.visible = opacity > 0
  }
}
