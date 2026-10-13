import { BLACK, GREEN } from "../../src/constants"
import { color } from "../../src/params"
import type { Solid } from "../../src/geometry/hiddenline"
import { SolidDrawing } from "../../src/parts/soliddrawing"

/**
 * A stand-up pouch, platonic — the finished product: a tall flat body on
 * a wider gusseted base, a sealed band across the top, the zip a line
 * just under it. Standing up is what says POUCH
 * rather than sachet.
 *
 * Drawn as its visible 3D edges and fills (src/parts/soliddrawing.ts) —
 * a morph target, like the Truck (vocabulary/Grain).
 *
 * The face looks along +z, up is +y. The origin is the middle of the
 * bounding box. 120 wide, 186 tall, 48 deep at the base, 24 above it.
 */
export class Pouch extends SolidDrawing {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true
  /** The film's colour — the product's category. */
  material = color(GREEN)
  /** The seal's fill — black, i.e. solid on the ground. */
  body = color(BLACK)

  constructor(overrides: ConstructorParameters<typeof SolidDrawing>[0] = {}) {
    super({ lineSlots: 40, faceSlots: 12, ...overrides })
  }

  solids(): Solid[] {
    const mat = this.material.value
    const body = this.body.value
    const W = 120
    const box = (x0: number, x1: number, y0: number, y1: number, hz: number, fill: typeof mat): Solid => ({
      kind: "box",
      center: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: 0 },
      size: { x: x1 - x0, y: y1 - y0, z: 2 * hz },
      fill,
    })
    // Built on the ground (y = 0), centred on x and z: the base, the body
    // narrowing in depth above it, the sealed band.
    const raw: Solid[] = [
      box(-W / 2, W / 2, 0, 30, 24, mat), // the gusseted base
      box(-W / 2, W / 2, 30, 168, 12, mat), // the body
      box(-W / 2 + 2, W / 2 - 2, 168, 186, 4, body), // the seal
    ]
    // The zip, a line just under the seal, flat on the face.
    raw.push({ kind: "panel", center: { x: 0, y: 154, z: 12 }, size: { x: W - 12, y: 2, z: 0 }, normal: { x: 0, y: 0, z: 1 } })
    return raw.map((s) => (s.kind === "mesh" ? s : { ...s, center: { x: s.center.x, y: s.center.y - 93, z: s.center.z } }))
  }
}
