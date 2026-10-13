import { BLACK, RED } from "../../src/constants"
import { choice, color } from "../../src/params"
import { translateSolid, type Solid } from "../../src/geometry/hiddenline"
import { SolidDrawing } from "../../src/parts/soliddrawing"
import { choices, type StateSpace } from "../../src/automaton"

/** What stands on the pallet. */
export const PALLET_LOADS = ["sacks", "octabin", "none"] as const
export type PalletLoad = (typeof PALLET_LOADS)[number]

/**
 * A pallet, platonic — raw material as it arrives: a deck on three
 * stringers (the fork openings are what say PALLET), loaded with three
 * layers of flat sacks or one octabin under its lid.
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
    super({ lineSlots: 88, faceSlots: 20, ...overrides })
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
    // Built on the ground (y = 0) from the corner (x = 0, z = 0): a deck
    // on three blocks-in-a-row (stringers) across its depth, so the long
    // side shows the two fork openings — the silhouette that says PALLET,
    // in four solids (a particle may be a pallet, hundreds at once).
    const leg = 22 // the stringers' height and width
    const deck = 8
    const top = leg + deck // 30
    const raw: Solid[] = []
    // The wood is UNFILLED: it hides lines all the same (hidden-line
    // occlusion is geometric), and what lies behind it is black ground.
    // Filled, its long low parts sort in front of the load by the
    // painter's rule and black out the sacks' faces.
    for (const x of [0, L / 2 - leg / 2, L - leg]) raw.push(box(x, x + leg, 0, leg, 0, D, undefined))
    raw.push(box(0, L, leg, top, 0, D, undefined))

    const load = this.load.value as PalletLoad
    if (load === "sacks") {
      // Three layers of two flat sacks, each layer laid a little off the
      // one below — a hand-stacked load, not a wall; six sacks, so a flow
      // of pallets stays light.
      const h = 40
      const gap = 3
      const jog = [0, 5, -3]
      const inset = 6
      for (let layer = 0; layer < 3; layer++) {
        const y0 = top + layer * h
        const j = jog[layer]!
        for (const [x0, x1] of [[inset, L / 2 - gap / 2], [L / 2 + gap / 2, L - inset]] as const)
          raw.push(box(x0 + j, x1 + j, y0, y0 + h, inset - j / 2, D - inset - j / 2, mat))
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
    return raw.map((s) => translateSolid(s, { x: -cx, y: -cy, z: -cz }))
  }

  /** Walkable (src/automaton.ts): what is loaded — sacks · octabin · empty, in PALLET_LOADS order. */
  override stateSpace(): StateSpace | undefined {
    if (this.load.isBound) return undefined
    return { axes: [choices("load", this.load, { duration: 0.5, handles: [this] })] }
  }
}
