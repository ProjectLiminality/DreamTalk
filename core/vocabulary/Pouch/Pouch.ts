import { BLACK, GREEN } from "../../src/constants"
import { color, length } from "../../src/params"
import type { Solid } from "../../src/geometry/hiddenline"
import type { Mesh } from "../../src/geometry/meshes"
import type { Vec3Like } from "../../src/parts/primitives"
import { SolidDrawing } from "../../src/parts/soliddrawing"

/**
 * A stand-up pouch, platonic — the finished product. Its shape is the
 * film's own: two flat sheets sealed at the sides and the top, so the
 * cross-section is a LENS — sharp side seams, bellied faces — that opens
 * wide at the gusseted foot it stands on and closes to nothing at the
 * sealed top. One lofted mesh (src/geometry/hiddenline.ts `mesh` solids):
 * the seams are creases, the bellies smooth contours solved for the
 * camera, so turn it and its outline slides round its curves as a real
 * pouch's does. The gusset's fold above the foot, the zip a ridge
 * across both faces, a sealed band across the top.
 *
 * Drawn as its visible 3D edges and fills (src/parts/soliddrawing.ts) —
 * a morph target, like the Truck (vocabulary/Grain).
 *
 * The face looks along +z, up is +y. The origin is the middle of the
 * bounding box. `width` 120 and `height` 186 by default; the foot is 0.4
 * of the width deep.
 */
export class Pouch extends SolidDrawing {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true
  /** The film's colour — the product's category. */
  material = color(GREEN)
  /** The seal's fill — black, i.e. solid on the ground. */
  body = color(BLACK)
  /** Across the face. */
  width = length(120)
  /** Foot to the top of the seal. */
  height = length(186)

  constructor(overrides: ConstructorParameters<typeof SolidDrawing>[0] = {}) {
    super({ lineSlots: 48, faceSlots: 2, ...overrides })
  }

  // Built once per shape: hidden-line preparation is keyed on the arrays.
  private meshMemo?: { key: string; body: Mesh; seal: Mesh }

  solids(): Solid[] {
    const W = this.width.value
    const H = this.height.value
    const key = `${W}|${H}`
    if (this.meshMemo?.key !== key) {
      const seal = H * 0.1
      const top = H - seal
      const D = W * 0.4
      // (height, half-width, half-depth) from the foot up: a rounded foot,
      // the belly easing toward the sealed top.
      const rings: [number, number, number][] = [
        [0, W * 0.47, D * 0.42],
        [H * 0.02, W * 0.495, D * 0.49],
        [H * 0.06, W / 2, D / 2],
        // The gusset's fold: straight up, then a crease where the faces
        // turn in — the "smile" every stand-up pouch has above its foot.
        [H * 0.16, W / 2, D / 2],
        [H * 0.18, W / 2, D * 0.42],
        [H * 0.4, W / 2, D * 0.36],
        [H * 0.6, W / 2, D * 0.26],
        // The zip: a ridge across both faces (two creases).
        [H * 0.76, W * 0.495, D * 0.15],
        [H * 0.775, W * 0.495, D * 0.19],
        [H * 0.79, W * 0.495, D * 0.13],
        [top - H * 0.02, W * 0.49, D * 0.05],
        [top, W * 0.49, D * 0.02],
      ]
      this.meshMemo = {
        key,
        body: loft(rings, 40),
        seal: loft([[top, W * 0.49, D * 0.02], [H, W * 0.49, D * 0.02]], 40),
      }
    }
    const { body, seal } = this.meshMemo!
    const off = (m: Mesh): Vec3Like[] => m.positions.map((p) => ({ x: p.x, y: p.y - H / 2, z: p.z }))
    return [
      { kind: "mesh", positions: this.offset(body, off), triangles: body.triangles, fill: this.material.value },
      { kind: "mesh", positions: this.offset(seal, off), triangles: seal.triangles, fill: this.body.value },
    ]
  }

  // The centred positions, kept with their mesh (same arrays every call).
  private centred = new WeakMap<Mesh, Vec3Like[]>()
  private offset(m: Mesh, f: (m: Mesh) => Vec3Like[]): Vec3Like[] {
    let p = this.centred.get(m)
    if (!p) this.centred.set(m, (p = f(m)))
    return p
  }
}

/**
 * A closed loft through LENS cross-sections (two arcs meeting at sharp
 * side seams): ring k at height y with half-width w and half-depth d,
 * capped flat at both ends. Counter-clockwise from outside, like
 * meshes.ts (a ring point at angle a sits at (w cos a, −d·sin a·|sin a|)).
 */
export const loft = (rings: readonly [number, number, number][], segments: number): Mesh => {
  const positions: Vec3Like[] = []
  const triangles: [number, number, number][] = []
  const idx: number[][] = []
  for (const [y, w, d] of rings) {
    const ring: number[] = []
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * 2 * Math.PI
      const s = Math.sin(a)
      positions.push({ x: w * Math.cos(a), y, z: -d * s * Math.abs(s) })
      ring.push(positions.length - 1)
    }
    idx.push(ring)
  }
  for (let i = 0; i + 1 < idx.length; i++) {
    const lo = idx[i]!
    const hi = idx[i + 1]!
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments
      triangles.push([lo[j]!, lo[j1]!, hi[j1]!])
      triangles.push([lo[j]!, hi[j1]!, hi[j]!])
    }
  }
  const cap = (ring: number[], y: number, up: boolean) => {
    positions.push({ x: 0, y, z: 0 })
    const c = positions.length - 1
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments
      triangles.push(up ? [c, ring[j]!, ring[j1]!] : [c, ring[j1]!, ring[j]!])
    }
  }
  cap(idx[0]!, rings[0]![0], false)
  cap(idx[idx.length - 1]!, rings[rings.length - 1]![0], true)
  return { positions, triangles }
}
