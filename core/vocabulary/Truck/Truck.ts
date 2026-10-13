import { BLACK, BLUE } from "../../src/constants"
import { color } from "../../src/params"
import { translateSolid, type Solid } from "../../src/geometry/hiddenline"
import { SolidDrawing } from "../../src/parts/soliddrawing"

/**
 * A truck, platonic: a box trailer of blue cargo, a cab, a hood, six
 * wheels — drawn as its visible 3D edges and a fill colour, the way the
 * camera sees it from wherever it is (src/parts/soliddrawing.ts).
 *
 * Made for the dot→truck morph (vocabulary/Morph, MorphCurves): a blue
 * particle flowing along a supply line becomes the truck it stands for,
 * and back. Its edges are real 3D curves, so when the camera turns after
 * the morph the lines stay where they belong in space.
 *
 * Length runs along local +x (the cab at +x), up is +y, the width is z.
 * The origin is the middle of the truck's bounding box, so a dot at the
 * truck's position grows out from its centre. 650 long, 232 tall, 188
 * wide.
 *
 * The body and wheels are filled BLACK — on the black ground that reads
 * as nothing, but it makes the truck SOLID: the cab hides the cargo's
 * blue behind it, a wheel hides the trailer behind it.
 */
export class Truck extends SolidDrawing {
  /** ONTOLOGY.md: a sovereign symbol (pre-pop-out) — cast, not asset. */
  static sovereign = true
  /** The cargo's colour — the trailer's fill. */
  cargo = color(BLUE)
  /** The body's fill (cab, hood, chassis, wheels) — black, i.e. solid on the ground. */
  body = color(BLACK)

  constructor(overrides: ConstructorParameters<typeof SolidDrawing>[0] = {}) {
    // Room for every visible span of 25 parts from any side.
    super({ lineSlots: 160, faceSlots: 64, ...overrides })
  }

  solids(): Solid[] {
    const cargo = this.cargo.value
    const body = this.body.value
    // Built on the ground (y = 0) from the rear of the trailer (x = 0),
    // then centred. The silhouette is what says TRUCK: a tall cargo box,
    // a shorter cab with its windows, a low hood, a bumper, and round
    // wheels standing under it all on a chassis rail.
    const R = 30 // wheel radius
    const W = 22 // wheel width
    const floor = 62 // the bodies' underside, just above the wheel tops
    const box = (x0: number, x1: number, y0: number, y1: number, hz: number, fill: typeof body): Solid => ({
      kind: "box",
      center: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: 0 },
      size: { x: x1 - x0, y: y1 - y0, z: 2 * hz },
      fill,
    })
    const raw: Solid[] = [
      box(0, 420, floor, 232, 88, cargo), // the trailer
      box(20, 640, 44, floor, 56, body), // the chassis rail, between the wheels
      box(440, 560, floor, 212, 82, body), // the cab
      box(560, 640, floor, 140, 74, body), // the hood, low
      box(640, 650, 48, 76, 80, body), // the bumper
    ]
    // Windows: one each side of the cab, the windshield above the hood,
    // the grille on the hood's face — flat panels, drawn when their face is.
    for (const side of [-1, 1])
      raw.push({ kind: "panel", center: { x: 505, y: 172, z: side * 82 }, size: { x: 66, y: 50, z: 0 }, normal: { x: 0, y: 0, z: side } })
    raw.push({ kind: "panel", center: { x: 560, y: 176, z: 0 }, size: { x: 0, y: 48, z: 124 }, normal: { x: 1, y: 0, z: 0 } })
    raw.push({ kind: "panel", center: { x: 640, y: 108, z: 0 }, size: { x: 0, y: 40, z: 96 }, normal: { x: 1, y: 0, z: 0 } })
    // Wheels: a short cylinder each, a hub proud of its outer face.
    const wheel = (x: number, z: number) => {
      const side = Math.sign(z)
      raw.push({ kind: "cylinder", center: { x, y: R, z }, radius: R, height: W, axis: "z", fill: body })
      raw.push({ kind: "cylinder", center: { x, y: R, z: z + side * (W / 2 + 2) }, radius: 11, height: 4, axis: "z", fill: body })
    }
    for (const x of [70, 140]) for (const z of [-77, 77]) wheel(x, z)
    for (const x of [500, 600]) for (const z of [-70, 70]) wheel(x, z)
    // Centre on the bounding box: x 0…650, y 0…232, z ±94.
    const cx = 325
    const cy = 116
    return raw.map((s) => translateSolid(s, { x: -cx, y: -cy, z: 0 }))
  }
}
