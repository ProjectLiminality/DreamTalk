/**
 * Build-time CSG by signed distance — pure math.
 *
 * TASTE allows SDF in exactly three places; this module is the third,
 * build-time CSG. Nothing here is rendered: a shape is a function from a
 * point to its signed distance (negative inside), solids combine with
 * `max` (intersection) and `min` (union), and what the framework draws is
 * still mesh and stroke. The module exists so a composite can be DERIVED
 * from its parts — and proven to equal what it claims to be.
 *
 * ## The founding derivation (ONTOLOGY.md 2026-09-16)
 *
 * A cylinder is what a square and a circle are both partial views of. Put
 * the square in the side view (the xy plane) and push it straight back
 * through depth: a square PRISM. Lay the circle in the ground plane (xz)
 * and push it straight up: a circular prism. Their intersection —
 *
 *     max(squarePrism(w, h)(p), circlePrism(r)(p))
 *
 * — is a cylinder of radius r and height h, standing on the y axis, as
 * long as the profile is at least as wide as the circle (w ≥ 2r). Narrower,
 * and the two flat sides of the profile shave the mantle: still the
 * intersection, no longer a cylinder. `squareCircleCylinder` states both.
 *
 * This is why the derivation, not the numbers, is the point: change the
 * profile from rectangle to square, or the circle's radius, and the
 * cylinder that follows is still exactly their intersection.
 */

/** A solid as its signed distance: negative inside, zero on the surface. */
export type Sdf = (x: number, y: number, z: number) => number

/**
 * A w × h rectangle in the xy plane (the side view), centred on the
 * origin, extruded along z without end. Exact box distance in xy.
 */
export const squarePrism =
  (width: number, height: number): Sdf =>
  (x, y) => {
    const qx = Math.abs(x) - width / 2
    const qy = Math.abs(y) - height / 2
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
    return outside + Math.min(Math.max(qx, qy), 0)
  }

/** A circle of radius r in the xz plane (the top view), extruded along y. */
export const circlePrism =
  (radius: number): Sdf =>
  (x, _y, z) =>
    Math.hypot(x, z) - radius

/** A finite cylinder of radius r and height h on the y axis — exact. */
export const cylinder =
  (radius: number, height: number): Sdf =>
  (x, y, z) => {
    const dr = Math.hypot(x, z) - radius
    const dy = Math.abs(y) - height / 2
    return Math.min(Math.max(dr, dy), 0) + Math.hypot(Math.max(dr, 0), Math.max(dy, 0))
  }

/** Intersection: inside all of them. (A bound, not the exact distance — exact in sign.) */
export const intersect =
  (...solids: Sdf[]): Sdf =>
  (x, y, z) => {
    let d = -Infinity
    for (const s of solids) d = Math.max(d, s(x, y, z))
    return d
  }

/** Union: inside any of them. */
export const union =
  (...solids: Sdf[]): Sdf =>
  (x, y, z) => {
    let d = Infinity
    for (const s of solids) d = Math.min(d, s(x, y, z))
    return d
  }

/**
 * The square ∩ circle derivation, in closed form: the cylinder the
 * intersection IS — radius from the circle, height from the profile —
 * and whether it is one at all (`exact`: the profile spans the circle, so
 * its flat sides never cut the mantle).
 */
export const squareCircleCylinder = (
  profileWidth: number,
  profileHeight: number,
  circleRadius: number,
): { radius: number; height: number; exact: boolean } => ({
  radius: circleRadius,
  height: profileHeight,
  exact: profileWidth >= 2 * circleRadius,
})
