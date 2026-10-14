import { BLACK, BLUE } from "../../src/constants"
import { color, length } from "../../src/params"
import type { Solid } from "../../src/geometry/hiddenline"
import type { Mesh } from "../../src/geometry/meshes"
import type { Vec3Like } from "../../src/parts/primitives"
import { SolidDrawing } from "../../src/parts/soliddrawing"

/**
 * A film reel, platonic — the semi-finished product: a big roll of film
 * wound on a core, lying on its side. The roll is a thick-walled ring
 * turned on a lathe (one closed mesh, `mesh` solids in
 * src/geometry/hiddenline.ts) whose rims are softened by a 45° chamfer —
 * film wound tight never has a sharp edge — and whose hole shows; the
 * cardboard core stands proud of both faces as two short tubes. The
 * mantle's contours are smooth-surface contour generators, solved for the
 * camera; the faces' rims and the chamfers are creases.
 *
 * Drawn as its visible 3D edges and fills (src/parts/soliddrawing.ts) — a
 * morph target, like the Truck (vocabulary/Grain, vocabulary/Morph).
 *
 * The axis runs along x, up is +y. The origin is the middle of the roll.
 * `width` is the roll's width (the film's), `diameter` the wound roll's;
 * the core is a fixed proportion of the diameter.
 */
export class FilmReel extends SolidDrawing {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true
  /**
   * The local axis this symbol must NOT be seen along (a reel seen along its spindle is a disc, and
   * reads as nothing). A carrier that turns symbols along a flow (FlowMap)
   * keeps this axis well off the view direction.
   */
  static spindle = { x: 1, y: 0, z: 0 }
  /** The film's colour — the material's category. */
  material = color(BLUE)
  /** The core's fill — black, i.e. solid on the ground. */
  body = color(BLACK)
  /** The wound roll's diameter. */
  diameter = length(200)
  /** The roll's width along its axis — the film's width. */
  width = length(190)

  constructor(overrides: ConstructorParameters<typeof SolidDrawing>[0] = {}) {
    super({ lineSlots: 72, faceSlots: 2, ...overrides })
  }

  solids(): Solid[] {
    const { roll, cores } = reelMeshes(this.diameter.value / 2, this.width.value)
    return [
      { kind: "mesh", positions: roll.positions, triangles: roll.triangles, fill: this.material.value },
      ...cores.map((c): Solid => ({ kind: "mesh", positions: c.positions, triangles: c.triangles, fill: this.body.value })),
    ]
  }
}

/**
 * The reel's meshes, built once per shape and SHARED by every reel of it —
 * hidden-line preparation and shared drawings (SolidDrawing `shareViews`)
 * are keyed on the arrays themselves.
 */
const REELS = new Map<string, { roll: Mesh; cores: Mesh[] }>()
const reelMeshes = (R: number, W: number): { roll: Mesh; cores: Mesh[] } => {
  const key = `${R}|${W}`
  let m = REELS.get(key)
  if (m) return m
  const rc = R * 0.26 // the core's outer radius = the roll's hole
  const f = Math.min(R * 0.08, W * 0.12) // the chamfer
  const c45 = Math.SQRT1_2
  // A closed profile (radius, along the axis), counter-clockwise: out
  // along one face, the chamfer, the mantle, the chamfer, in along the
  // other face, and back through the hole.
  const roll: [number, number][] = [
    [rc, -W / 2],
    [R - f, -W / 2],
    [R - f + f * c45, -W / 2 + f - f * c45],
    [R, -W / 2 + f],
    [R, W / 2 - f],
    [R - f + f * c45, W / 2 - f + f * c45],
    [R - f, W / 2],
    [rc, W / 2],
  ]
  // The core: a cardboard tube standing out of the hole on both sides (two
  // stubs touching the faces — solids touch, never interpenetrate).
  const stub = R * 0.1
  const ri = rc * 0.7
  const tube = (y0: number, y1: number): [number, number][] => [
    [ri, y0],
    [rc, y0],
    [rc, y1],
    [ri, y1],
  ]
  m = {
    roll: alongX(ring(roll, 48)),
    cores: [tube(-W / 2 - stub, -W / 2), tube(W / 2, W / 2 + stub)].map((t) => alongX(ring(t, 48))),
  }
  REELS.set(key, m)
  return m
}

/** A lathe's +y axis turned onto +x (a rotation, so the winding holds). */
const alongX = (m: Mesh): Mesh => ({
  positions: m.positions.map((p) => ({ x: p.y, y: -p.x, z: p.z })),
  triangles: m.triangles,
})

/**
 * A lathe of a CLOSED profile (radius, along the axis) about +y — a ring
 * solid, its last profile point joined back to its first, so the surface
 * is one closed manifold (meshes.ts latheMesh is for open profiles with
 * caps). Counter-clockwise from outside when the profile runs
 * counter-clockwise in (radius, y), as latheMesh winds.
 */
const ring = (profile: readonly [number, number][], segments: number): Mesh => {
  const positions: Vec3Like[] = []
  const triangles: [number, number, number][] = []
  for (const [r, y] of profile)
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * 2 * Math.PI
      positions.push({ x: r * Math.cos(a), y, z: -r * Math.sin(a) })
    }
  const n = profile.length
  for (let i = 0; i < n; i++) {
    const lo = i * segments
    const hi = ((i + 1) % n) * segments
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments
      triangles.push([lo + j, lo + j1, hi + j1])
      triangles.push([lo + j, hi + j1, hi + j])
    }
  }
  return { positions, triangles }
}
