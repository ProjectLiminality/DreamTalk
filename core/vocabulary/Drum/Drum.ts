import { BLACK, BLUE } from "../../src/constants"
import { color } from "../../src/params"
import { translateSolid, type Solid } from "../../src/geometry/hiddenline"
import { SolidDrawing } from "../../src/parts/soliddrawing"

/**
 * A drum, platonic — liquids and additives by the barrel: a standing
 * cylinder girded by two rolling hoops (bands a little wider than the
 * body, touching it, never through it), its lid with the bung. The hoops
 * are what say DRUM rather than can.
 *
 * Drawn as its visible 3D edges and fills (src/parts/soliddrawing.ts) — a
 * morph target (vocabulary/Grain).
 *
 * Axis y; origin at the middle. 120 across, 176 tall.
 */
export class Drum extends SolidDrawing {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true
  /** The steel's colour — the content's category. */
  material = color(BLUE)
  /** The bung — black. */
  body = color(BLACK)

  constructor(overrides: ConstructorParameters<typeof SolidDrawing>[0] = {}) {
    super({ lineSlots: 48, faceSlots: 16, ...overrides })
  }

  solids(): Solid[] {
    const R = 60
    const H = 176
    const band = 6
    const mat = this.material.value
    // Body segments between the hoops, the hoops proud of the body —
    // stacked, each touching the next.
    const cuts = [0, H * 0.33 - band / 2, H * 0.33 + band / 2, H * 0.67 - band / 2, H * 0.67 + band / 2, H]
    const out: Solid[] = []
    for (let i = 0; i + 1 < cuts.length; i++) {
      const hoop = i % 2 === 1
      const y0 = cuts[i]!
      const y1 = cuts[i + 1]!
      out.push({ kind: "cylinder", center: { x: 0, y: (y0 + y1) / 2 - H / 2, z: 0 }, radius: hoop ? R + 3 : R, height: y1 - y0, axis: "y", fill: mat })
    }
    // The bung on the lid, off centre.
    out.push({ kind: "cylinder", center: { x: R * 0.5, y: H / 2 + 2, z: 0 }, radius: 9, height: 4, axis: "y", fill: this.body.value })
    // Centred on the bounding box, bung included.
    return out.map((s) => translateSolid(s, { x: 0, y: -2, z: 0 }))
  }
}
