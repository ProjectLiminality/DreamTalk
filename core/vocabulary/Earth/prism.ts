/**
 * prism.ts — the one construction both building symbols share: a 2D
 * profile in the XY plane, extruded along z, drawn as a LINE DRAWING with
 * true hidden lines.
 *
 * A prism's ink is its two profile loops and one rib per profile vertex
 * joining them — exactly the edges a line drawing of the solid has. Its
 * body is a black solid `Surface` that writes depth (parts/surface.ts), so
 * the edges on its far side vanish behind its own near faces at any angle
 * the camera takes, and whatever stands behind the building is covered.
 *
 * The body is INSET a little toward its centre: an edge drawn exactly on a
 * face would fight that face for depth (a ribbon's quad carries its line's
 * depth across its whole width), so the faces sit just behind the edges
 * that bound them — and still far in front of the edges behind.
 */

import { ShapeUtils, Vector2 } from "three/webgpu"
import type { Holon } from "../../src/holon"
import { Line, type Null, type Vec3Like } from "../../src/parts/primitives"
import { Surface } from "../../src/parts/surface"
import { rgb } from "../../src/constants"

export type P2 = readonly [number, number]

/** How far a body shrinks toward its centre behind its own edges. */
const BODY_INSET = 0.03

/** The black of a building's body — the page, so a building is its edges. */
export const BODY = rgb(0, 0, 0)

/** What a prism is drawn with — params (or literals) bound into every part. */
export interface Ink {
  tint: unknown
  stroke: unknown
  body: unknown
}

/**
 * Compose a prism into `owner`: `profile` (XY, open ring, any winding, may
 * be concave) extruded from z = −depth/2 to +depth/2, shifted by `offset`.
 */
export const prism = (
  owner: Null,
  profile: readonly P2[],
  depth: number,
  ink: Ink,
  offset: Vec3Like = { x: 0, y: 0, z: 0 },
): void => {
  const add = <T extends Holon>(h: T): T => owner.attach(h)
  const z0 = -depth / 2 + offset.z
  const z1 = depth / 2 + offset.z
  const at = ([x, y]: P2, z: number): Vec3Like => ({ x: x + offset.x, y: y + offset.y, z })

  // The body first, so its depth is in place before any ink composites.
  const body = add(new Surface({ solid: true, tint: ink.body }))
  const n = profile.length
  const xs = profile.map((p) => p[0])
  const ys = profile.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2 + offset.x
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2 + offset.y
  const cz = offset.z
  const k = 1 - BODY_INSET
  const positions: number[] = []
  for (const z of [z0, z1]) {
    for (const p of profile) {
      const q = at(p, z)
      positions.push(cx + (q.x - cx) * k, cy + (q.y - cy) * k, cz + (q.z - cz) * k)
    }
  }
  const indices: number[] = []
  const caps = ShapeUtils.triangulateShape(profile.map(([x, y]) => new Vector2(x, y)), [])
  for (const [a, b, c] of caps) indices.push(a!, b!, c!, a! + n, b! + n, c! + n)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    indices.push(i, j, j + n, i, j + n, i + n)
  }
  body.positions = new Float32Array(positions)
  body.indices = new Uint32Array(indices)

  const style = { tint: ink.tint, stroke: ink.stroke }
  for (const z of [z1, z0]) {
    add(new Line({ ...style, points: [...profile.map((p) => at(p, z)), at(profile[0]!, z)] }))
  }
  for (const p of profile) add(new Line({ ...style, points: [at(p, z1), at(p, z0)] }))
}

/** An axis-aligned w × h rectangle standing on y = 0. */
export const rect = (w: number, h: number): P2[] => [
  [-w / 2, 0],
  [w / 2, 0],
  [w / 2, h],
  [-w / 2, h],
]
