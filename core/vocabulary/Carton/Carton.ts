import { BLACK, RED } from "../../src/constants"
import { color, length } from "../../src/params"
import type { Solid } from "../../src/geometry/hiddenline"
import { SolidDrawing } from "../../src/parts/soliddrawing"

/**
 * A carton, platonic — products shipped by the box: a folded corrugated
 * box, closed, its two top flaps meeting in a seam down the middle and a
 * strip of tape across it, a label on its side. The seam and the tape are
 * what say CARTON rather than block.
 *
 * Drawn as its visible 3D edges and fills (src/parts/soliddrawing.ts) — a
 * morph target (vocabulary/Grain).
 *
 * Length along x, up +y, depth z; origin at the middle of the bounding
 * box. 200 × 140 × 120 by default.
 */
export class Carton extends SolidDrawing {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true
  /** The board's colour — the product's category. */
  material = color(RED)
  /** The tape and label — black. */
  body = color(BLACK)
  /** Along x. */
  width = length(200)
  /** Up. */
  height = length(140)
  /** Along z. */
  depth = length(120)

  constructor(overrides: ConstructorParameters<typeof SolidDrawing>[0] = {}) {
    super({ lineSlots: 36, faceSlots: 12, ...overrides })
  }

  solids(): Solid[] {
    const W = this.width.value
    const H = this.height.value
    const D = this.depth.value
    const tape = Math.min(W, D) * 0.16
    return [
      { kind: "box", center: { x: 0, y: -1, z: 0 }, size: { x: W, y: H - 2, z: D }, fill: this.material.value },
      // The tape: over the seam and down both ends (a strip as thin as paint).
      { kind: "box", center: { x: 0, y: H / 2 - 1, z: 0 }, size: { x: W, y: 2, z: tape }, fill: this.body.value },
      // The flaps' seam, under the tape's edges: drawn as the tape's own edges.
      // The label on the front face.
      { kind: "panel", center: { x: W * 0.18, y: -H * 0.1, z: D / 2 }, size: { x: W * 0.36, y: H * 0.34, z: 0 }, normal: { x: 0, y: 0, z: 1 } },
    ]
  }
}
