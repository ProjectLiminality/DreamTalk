import { YELLOW } from "../../src/constants"
import { color, integer } from "../../src/params"
import { solidBounds, translateSolid, type Solid } from "../../src/geometry/hiddenline"
import { SolidDrawing } from "../../src/parts/soliddrawing"

/**
 * A coin, platonic — value as money: a disc lying flat, its face a hair
 * proud inside the rim (one ring line), or a small stack of
 * them, each a little off the one below. The stack is what a flow of
 * money looks like up close; one coin is the unit.
 *
 * Drawn as its visible 3D edges and fills (src/parts/soliddrawing.ts) — a
 * morph target, so a particle in a flow can become the money it stands
 * for (vocabulary/Grain), and back.
 *
 * Lying in xz, up is +y. The origin is the middle of the bounding box.
 * Each coin is 100 across and 9 thick.
 */
export class Coin extends SolidDrawing {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true
  /** The metal's colour — the currency's category. */
  material = color(YELLOW)
  /** How many coins in the stack. */
  count = integer(1)

  constructor(overrides: ConstructorParameters<typeof SolidDrawing>[0] = {}) {
    super({ lineSlots: 40, faceSlots: 16, ...overrides })
  }

  solids(): Solid[] {
    const n = Math.max(1, Math.round(this.count.value))
    const R = 50
    const t = 9
    const jog = [
      [0, 0],
      [4, -3],
      [-3, 3],
      [3, 4],
      [-4, -2],
    ]
    const out: Solid[] = []
    const h = n * t + 1.5
    for (let i = 0; i < n; i++) {
      const [dx, dz] = jog[i % jog.length]!
      out.push({ kind: "cylinder", center: { x: dx!, y: i * t + t / 2 - h / 2, z: dz! }, radius: R, height: t, axis: "y", fill: this.material.value })
    }
    // The top coin's face: a disc a hair proud, inside the rim.
    const [tx, tz] = jog[(n - 1) % jog.length]!
    out.push({ kind: "cylinder", center: { x: tx!, y: n * t + 0.75 - h / 2, z: tz! }, radius: R * 0.8, height: 1.5, axis: "y", fill: this.material.value })
    // Centred on the bounding box, the stack's jogs included.
    const lo = { x: Infinity, z: Infinity }
    const hi = { x: -Infinity, z: -Infinity }
    for (const s of out) {
      const b = solidBounds(s)
      lo.x = Math.min(lo.x, b.lo.x)
      lo.z = Math.min(lo.z, b.lo.z)
      hi.x = Math.max(hi.x, b.hi.x)
      hi.z = Math.max(hi.z, b.hi.z)
    }
    return out.map((s) => translateSolid(s, { x: -(lo.x + hi.x) / 2, y: 0, z: -(lo.z + hi.z) / 2 }))
  }
}
