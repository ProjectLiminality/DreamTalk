/**
 * Surface — a triangle mesh, the one primitive that is an AREA in 3D.
 *
 * Every other fill the host knows is flat: an ellipse, a rectangle, a
 * closed Line, a drawing's even-odd interior — all triangulated in their
 * own plane. A filled continent on a sphere is none of those; it is a
 * curved sheet, and the only honest way to hand it to the renderer is as
 * the triangles themselves. So a Surface carries them: `positions` (flat
 * xyz, local space) and `indices` (triangles), computed by whoever knows
 * the shape (vocabulary/Earth triangulates land ON the sphere,
 * geometry/sphere.ts).
 *
 * It washes like any Stroke — `tint` × `fillOpacity` × `opacity`, the
 * filler material — and draws no line (`stroke` 0). Two kinds:
 *
 *   - a SHEET (the default): transparent, composited in attach order like
 *     every other fill, and DEPTH-TESTED — so it disappears behind a solid.
 *   - a SOLID (`solid: true`): opaque, and it WRITES DEPTH. This is how a
 *     scene gets real occlusion without giving up the black-background
 *     compositing everything else relies on: nothing else in the host
 *     writes depth, so a solid is the only thing anything can be behind.
 *     Lines, fills and sheets behind it are hidden by the GPU, per pixel,
 *     at their true 3D depth — the Earth's far side is hidden by its own
 *     ball, not by clipping in 2D. A solid is pushed back a hair in depth
 *     (slope-scaled, fill.ts) so ink lying ON it — a coastline on the
 *     ball, an edge on a building's face — always wins.
 *
 * Geometry is data, not params: assign new arrays and bump `geomVersion`
 * (the setter does it) for the host to rebuild the mesh.
 */

import { bool, completion, length, scalar } from "../params"
import { Stroke } from "./primitives"

const MESH: unique symbol = Symbol("Surface.mesh")

export class Surface extends Stroke {
  /** Opaque and depth-writing — an occluder (see the class note). */
  solid = bool(false)
  /**
   * When a SOLID composites. "first" (the default): before every
   * transparent stroke and fill, so all of them depth-test against it.
   * "inOrder": at its place in attach order, like a fill — it covers what
   * was attached before it, and what comes after depth-tests against it.
   * A 3D globe set on a flat page (parts/recede.ts) needs the second.
   */
  composite: "first" | "inOrder" = "first"
  /**
   * Where the radial light (`fillFalloff`, `fillFalloffRadius`) stands, in
   * local space: a sheet is lit by its 3D distance from this point — land
   * lit from a place on a globe. Unused while `fillFalloff` stays 0.
   */
  fillFalloffX = scalar(0)
  fillFalloffY = scalar(0)
  fillFalloffZ = scalar(0)
  /** A surface draws no line; its wash is the whole of it. */
  override stroke = length(0)
  /** Washed by default — a surface IS its fill. */
  override fillOpacity = completion(1)

  /** Bumped whenever `positions`/`indices` change (the host's dirty check). */
  geomVersion = 0

  /** Flat xyz, local space. */
  get positions(): Float32Array {
    return this[MESH].positions
  }
  set positions(p: Float32Array) {
    this[MESH].positions = p
    this.geomVersion++
  }

  /** Triangles, three indices each, into `positions`. */
  get indices(): Uint32Array {
    return this[MESH].indices
  }
  set indices(i: Uint32Array) {
    this[MESH].indices = i
    this.geomVersion++
  }

  /** Symbol-keyed backing — a Proxy'd holon cannot reach #-private fields
   *  (holon.ts), and off `Object.keys` the field scan never sees it. */
  [MESH]: { positions: Float32Array; indices: Uint32Array } = {
    positions: new Float32Array(0),
    indices: new Uint32Array(0),
  }
}
