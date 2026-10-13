import { YELLOW } from "../../src/constants"
import { color, integer } from "../../src/params"
import type { Solid } from "../../src/geometry/hiddenline"
import { SolidDrawing } from "../../src/parts/soliddrawing"

/**
 * A stack of sheets, platonic — a finished product sold flat (cut
 * sheets, labels on their liner, square metres): thin slabs lying on each
 * other, each a little off the one below, so every sheet's edge shows on
 * the stack's sides.
 *
 * Drawn as its visible 3D edges and fills (src/parts/soliddrawing.ts) —
 * a morph target, like the Truck (vocabulary/Grain).
 *
 * The sheets lie in xz, up is +y. The origin is the middle of the
 * bounding box. 200 by 140, 10 per sheet.
 */
export class SheetStack extends SolidDrawing {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true
  /** The sheets' colour — the product's category. */
  material = color(YELLOW)
  /** How many sheets. */
  sheets = integer(6)

  constructor(overrides: ConstructorParameters<typeof SolidDrawing>[0] = {}) {
    super({ lineSlots: 120, faceSlots: 48, ...overrides })
  }

  solids(): Solid[] {
    const n = Math.max(1, Math.round(this.sheets.value))
    const t = 10
    const mat = this.material.value
    // A fixed, irregular shuffle: the stack was squared by hand.
    const jog = [
      [0, 0],
      [5, -3],
      [-3, 4],
      [4, 2],
      [-5, -2],
      [2, 5],
      [-2, -5],
      [5, 3],
    ]
    const jogs = Array.from({ length: n }, (_, i) => jog[i % jog.length]!)
    // Centred on the bounding box, jogs included.
    const mid = (k: 0 | 1) => (Math.min(...jogs.map((j) => j[k]!)) + Math.max(...jogs.map((j) => j[k]!))) / 2
    const cx = mid(0)
    const cz = mid(1)
    return jogs.map(([dx, dz], i): Solid => ({
      kind: "box",
      center: { x: dx! - cx, y: i * t + t / 2 - (n * t) / 2, z: dz! - cz },
      size: { x: 200, y: t, z: 140 },
      fill: mat,
    }))
  }
}
