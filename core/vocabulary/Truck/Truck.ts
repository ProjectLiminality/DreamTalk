import { BLACK, BLUE } from "../../src/constants"
import { color } from "../../src/params"
import type { Solid } from "../../src/geometry/hiddenline"
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
 * truck's position grows out from its centre. 640 long, 268 tall, 180
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
  /** The body's fill (cab, hood, wheels) — black, i.e. solid on the ground. */
  body = color(BLACK)

  solids(): Solid[] {
    const cargo = this.cargo.value
    const body = this.body.value
    // Built on the ground (y = 0) from the rear of the trailer (x = 0),
    // then centred.
    const R = 34 // wheel radius
    const W = 26 // wheel width
    const floor = 2 * R // the bodies sit on the wheel tops
    const raw: Solid[] = [
      // Trailer: 440 × 200 × 180.
      { kind: "box", center: { x: 220, y: floor + 100, z: 0 }, size: { x: 440, y: 200, z: 180 }, fill: cargo },
      // Cab: 110 × 150 × 170, a gap of 20 behind it.
      { kind: "box", center: { x: 515, y: floor + 75, z: 0 }, size: { x: 110, y: 150, z: 170 }, fill: body },
      // Hood: 70 × 80 × 160.
      { kind: "box", center: { x: 605, y: floor + 40, z: 0 }, size: { x: 70, y: 80, z: 160 }, fill: body },
    ]
    const wheel = (x: number, z: number): Solid => ({
      kind: "cylinder",
      center: { x, y: R, z },
      radius: R,
      height: W,
      axis: "z",
      fill: body,
    })
    for (const x of [60, 140]) for (const z of [-77, 77]) raw.push(wheel(x, z))
    for (const z of [-72, 72]) raw.push(wheel(560, z))
    // Centre on the bounding box: x 0…640, y 0…268, z ±90.
    const cx = 320
    const cy = (floor + 200) / 2
    return raw.map((s) => ({ ...s, center: { x: s.center.x - cx, y: s.center.y - cy, z: s.center.z } }))
  }
}
