import { YELLOW } from "../../src/constants"
import { color, length } from "../../src/params"
import type { Solid } from "../../src/geometry/hiddenline"
import type { Mesh } from "../../src/geometry/meshes"
import { SolidDrawing } from "../../src/parts/soliddrawing"
import { loft } from "../Pouch/Pouch"

/**
 * A sack, platonic — bulk raw material by the bag (granulate, powder): a
 * filled woven bag standing on its square-ish foot, its belly round with
 * what it holds, gathered and stitched closed at the top. One lofted mesh
 * (Pouch's lens-section loft, here fat — a full bag is nearly round): the
 * stitched top a crease ridge, the side seams creases, the belly smooth
 * contours solved for the camera.
 *
 * Drawn as its visible 3D edges and fills (src/parts/soliddrawing.ts) — a
 * morph target (vocabulary/Grain). A Pallet stacks flat sacks; this is
 * one sack, standing.
 *
 * Face along +z, up +y; origin at the middle of its height. `width` 130,
 * `height` 170 by default.
 */
export class Sack extends SolidDrawing {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true
  /** The bag's colour — the material's category. */
  material = color(YELLOW)
  /** Across the face. */
  width = length(130)
  /** Foot to the stitched top. */
  height = length(170)

  constructor(overrides: ConstructorParameters<typeof SolidDrawing>[0] = {}) {
    super({ lineSlots: 48, faceSlots: 2, ...overrides })
  }

  solids(): Solid[] {
    const mesh = sackMesh(this.width.value, this.height.value)
    return [{ kind: "mesh", positions: mesh.positions, triangles: mesh.triangles, fill: this.material.value }]
  }
}

/** The sack's mesh, centred, built once per shape and shared by every sack of it (see Pouch). */
const SACKS = new Map<string, Mesh>()
const sackMesh = (W: number, H: number): Mesh => {
  const key = `${W}|${H}`
  let m = SACKS.get(key)
  if (m) return m
  const D = W * 0.8
  const mesh = loft(
    [
      [0, W * 0.44, D * 0.4],
      [H * 0.04, W * 0.49, D * 0.49],
      [H * 0.3, W / 2, D / 2],
      [H * 0.6, W * 0.49, D * 0.46],
      [H * 0.78, W * 0.44, D * 0.32],
      // Gathered: the bag pinches in, then the stitched band.
      [H * 0.88, W * 0.36, D * 0.1],
      [H * 0.9, W * 0.37, D * 0.12],
      [H * 0.94, W * 0.37, D * 0.06],
      [H, W * 0.36, D * 0.03],
    ],
    40,
  )
  m = { positions: mesh.positions.map((p) => ({ x: p.x, y: p.y - H / 2, z: p.z })), triangles: mesh.triangles }
  SACKS.set(key, m)
  return m
}
