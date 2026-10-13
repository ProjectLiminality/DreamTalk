import { BLACK, RED } from "../../src/constants"
import { choice, color } from "../../src/params"
import type { Solid } from "../../src/geometry/hiddenline"
import { SolidDrawing } from "../../src/parts/soliddrawing"

/** What stands on the pallet. */
export const PALLET_LOADS = ["sacks", "octabin", "none"] as const
export type PalletLoad = (typeof PALLET_LOADS)[number]

/**
 * A pallet, platonic — raw material as it arrives: a deck on nine blocks
 * and three runners (the fork openings are what say PALLET), loaded with
 * three layers of flat sacks or one octabin under its lid.
 *
 * Drawn as its visible 3D edges and fills (src/parts/soliddrawing.ts), so
 * it is a morph target like the Truck: a dot in a flow can become the
 * pallet it stands for (vocabulary/Grain).
 *
 * Length runs along x, up is +y, depth is z. The origin is the middle of
 * the bounding box. 240 long, 160 deep, 150 tall with sacks (200 with an
 * octabin, 30 bare).
 *
 * The material — sacks or bin — takes `material`; the bin's lid takes
 * `body` (black). The wood is drawn as lines only: on the black ground
 * that reads as solid from above, and it never paints over the load.
 */
export class Pallet extends SolidDrawing {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true
  /** The load's colour — the material's category. */
  material = color(RED)
  /** The octabin lid's fill — black, i.e. solid on the ground. */
  body = color(BLACK)
  /** What is loaded: flat sacks in three layers, one octabin, or nothing. */
  load = choice("sacks", PALLET_LOADS)

  constructor(overrides: ConstructorParameters<typeof SolidDrawing>[0] = {}) {
    super({ lineSlots: 200, faceSlots: 64, ...overrides })
  }

  solids(): Solid[] {
    const body = this.body.value
    const mat = this.material.value
    const L = 240
    const D = 160
    const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, fill: typeof body | undefined): Solid => ({
      kind: "box",
      center: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 },
      size: { x: x1 - x0, y: y1 - y0, z: z1 - z0 },
      fill,
    })
    // Built on the ground (y = 0) from the corner (x = 0, z = 0).
    const runner = 6 // the bottom boards
    const block = 18 // the blocks between
    const deck = 6
    const top = runner + block + deck // 30
    const raw: Solid[] = []
    const bw = 22 // block / runner width
    const along = [0, L / 2 - bw / 2, L - bw]
    const across = [0, D / 2 - bw / 2, D - bw]
    // The wood is UNFILLED: it hides lines all the same (hidden-line
    // occlusion is geometric), and what lies behind it is black ground and
    // black wood. Filled, its long low parts sort in front of the load by
    // the painter's rule and black out the sacks' faces.
    for (const z of across) raw.push(box(0, L, 0, runner, z, z + bw, undefined))
    for (const z of across) for (const x of along) raw.push(box(x, x + bw, runner, runner + block, z, z + bw, undefined))
    // The deck: five boards across the runners, unfilled likewise.
    const boards = 5
    const bd = (D - (boards - 1) * 4) / boards
    for (let k = 0; k < boards; k++) raw.push(box(0, L, runner + block, top, k * (bd + 4), k * (bd + 4) + bd, undefined))

    const load = this.load.value as PalletLoad
    if (load === "sacks") {
      // Three layers of four flat sacks, two by two, each layer laid a
      // little off the one below — a hand-stacked load, not a wall.
      const h = 40
      const gap = 3
      const jog = [0, 4, -2]
      for (let layer = 0; layer < 3; layer++) {
        const y0 = top + layer * h
        const j = jog[layer]!
        const inset = 6
        for (const [x0, x1] of [[inset, L / 2 - gap / 2], [L / 2 + gap / 2, L - inset]] as const)
          for (const [z0, z1] of [[inset, D / 2 - gap / 2], [D / 2 + gap / 2, D - inset]] as const)
            raw.push(box(x0 + j, x1 + j, y0, y0 + h, z0 - j / 2, z1 - j / 2, mat))
      }
    } else if (load === "octabin") {
      // A bulk bin with its lid, the lid a little proud of the walls.
      const H = 150
      raw.push(box(8, L - 8, top, top + H, 8, D - 8, mat))
      raw.push(box(4, L - 4, top + H, top + H + 14, 4, D - 4, body))
      raw.push({ kind: "panel", center: { x: L / 2, y: top + H * 0.55, z: D - 8 }, size: { x: 90, y: 54, z: 0 }, normal: { x: 0, y: 0, z: 1 } })
    }
    // Centre on the bounding box.
    let y1 = 0
    for (const s of raw) if (s.kind === "box") y1 = Math.max(y1, s.center.y + s.size.y / 2)
    const cx = L / 2
    const cy = y1 / 2
    const cz = D / 2
    return raw.map((s) => ({ ...s, center: { x: s.center.x - cx, y: s.center.y - cy, z: s.center.z - cz } }))
  }
}
