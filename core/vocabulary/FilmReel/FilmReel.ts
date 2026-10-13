import { BLACK, BLUE } from "../../src/constants"
import { color, length } from "../../src/params"
import type { Solid } from "../../src/geometry/hiddenline"
import { SolidDrawing } from "../../src/parts/soliddrawing"

/**
 * A film reel, platonic — the semi-finished product: a big roll of film
 * wound on a core, lying on its side. The roll is one capped cylinder;
 * the core shows on each face as a ring and stands proud of it as a stub,
 * which is what tells a ROLL from a drum.
 *
 * Drawn as its visible 3D edges and fills (src/parts/soliddrawing.ts) —
 * a morph target, like the Truck (vocabulary/Grain, vocabulary/Morph).
 *
 * The axis runs along x, up is +y. The origin is the middle of the
 * bounding box. `width` is the roll's width (the film's), `diameter` the
 * wound roll's; the core is a fixed proportion of the diameter.
 */
export class FilmReel extends SolidDrawing {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true
  /** The film's colour — the material's category. */
  material = color(BLUE)
  /** The core's fill — black, i.e. solid on the ground. */
  body = color(BLACK)
  /** The wound roll's diameter. */
  diameter = length(200)
  /** The roll's width along its axis — the film's width. */
  width = length(190)

  constructor(overrides: ConstructorParameters<typeof SolidDrawing>[0] = {}) {
    super({ lineSlots: 48, faceSlots: 16, ...overrides })
  }

  solids(): Solid[] {
    const R = this.diameter.value / 2
    const W = this.width.value
    const core = R * 0.26
    const stub = R * 0.12
    const body = this.body.value
    const out: Solid[] = [
      { kind: "cylinder", center: { x: 0, y: 0, z: 0 }, radius: R, height: W, axis: "x", fill: this.material.value },
    ]
    for (const side of [-1, 1]) {
      // The core's end face (a disc thin as paint, touching the roll) and
      // the stub standing out of it.
      out.push({ kind: "cylinder", center: { x: side * (W / 2 + 0.5), y: 0, z: 0 }, radius: core * 1.35, height: 1, axis: "x", fill: body })
      out.push({ kind: "cylinder", center: { x: side * (W / 2 + 1 + stub / 2), y: 0, z: 0 }, radius: core, height: stub, axis: "x", fill: body })
    }
    return out
  }
}
