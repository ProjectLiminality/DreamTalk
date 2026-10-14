import { BLACK, GREEN } from "../../src/constants"
import { color, length } from "../../src/params"
import { translateSolid, type Solid } from "../../src/geometry/hiddenline"
import { SolidDrawing } from "../../src/parts/soliddrawing"

/**
 * A roll of labels, platonic — a converted product sold by the roll: a
 * narrow wound roll standing on its edge, its core showing on the face,
 * and the liner unwinding from the bottom along the ground with the
 * labels on it, each a little rectangle. The tail of labels is what tells
 * it from a reel of film.
 *
 * Drawn as its visible 3D edges and fills (src/parts/soliddrawing.ts) — a
 * morph target (vocabulary/Grain).
 *
 * The roll's axis is z (its face toward +z), up +y, the tail runs to +x;
 * origin at the middle of the bounding box.
 */
export class LabelRoll extends SolidDrawing {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true
  /**
   * The local axis this symbol must NOT be seen along (a roll seen along its axis is a disc, and
   * reads as nothing). A carrier that turns symbols along a flow (FlowMap)
   * keeps this axis well off the view direction.
   */
  static spindle = { x: 0, y: 0, z: 1 }
  /** The labels' colour — the product's category. */
  material = color(GREEN)
  /** The core — black. */
  body = color(BLACK)
  /** The wound roll's diameter. */
  diameter = length(140)
  /** The roll's width along its axis (the liner's width). */
  width = length(56)

  constructor(overrides: ConstructorParameters<typeof SolidDrawing>[0] = {}) {
    super({ lineSlots: 48, faceSlots: 16, ...overrides })
  }

  solids(): Solid[] {
    const R = this.diameter.value / 2
    const W = this.width.value
    const mat = this.material.value
    const body = this.body.value
    const tail = R * 1.6
    const liner = 3
    const raw: Solid[] = [
      { kind: "cylinder", center: { x: 0, y: R + liner, z: 0 }, radius: R, height: W, axis: "z", fill: mat },
      // The core: a disc on each face, thin as paint, and the hole's ring.
      { kind: "cylinder", center: { x: 0, y: R + liner, z: W / 2 + 0.5 }, radius: R * 0.32, height: 1, axis: "z", fill: body },
      { kind: "cylinder", center: { x: 0, y: R + liner, z: -W / 2 - 0.5 }, radius: R * 0.32, height: 1, axis: "z", fill: body },
      // The liner, unwinding along the ground from under the roll.
      { kind: "box", center: { x: tail / 2, y: liner / 2, z: 0 }, size: { x: tail, y: liner, z: W }, fill: mat },
    ]
    // The labels on the liner: flat rectangles, lying face up.
    for (let k = 0; k < 3; k++)
      raw.push({ kind: "panel", center: { x: R * 0.55 + k * R * 0.42, y: liner, z: 0 }, size: { x: R * 0.32, y: 0, z: W * 0.7 }, normal: { x: 0, y: 1, z: 0 } })
    // Centre on the bounding box: x from −R to tail, y 0 … 2R + liner.
    const cx = (tail - R) / 2
    const cy = (2 * R + liner) / 2
    return raw.map((s) => translateSolid(s, { x: -cx, y: -cy, z: 0 }))
  }
}
