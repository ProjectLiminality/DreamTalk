/**
 * globe.ts — a point on a sphere, spun and orthographically projected to a
 * disc, with the two things a drawn globe needs that a bare projection does
 * not: which points face the camera, and how a coastline that crosses the
 * limb is kept a usable shape.
 *
 * The globe recurs in four shots of the Liminal Consulting Web3 video
 * (docs/reports/web3-recon.md, shots 1/3/13/15). This file is the pure maths —
 * lon/lat in, screen point out — and knows nothing about drawing;
 * `vocabulary/Globe/` turns it into strokes and fills. Split that way for the
 * usual reason: the projection is testable in closed form (the point at
 * lon = spin, lat = 0 lands dead centre; a pole lands at ±R on the y axis)
 * and the drawing is not.
 *
 * THE MODEL
 *
 * A unit sphere. Longitude λ and latitude φ (radians) place a point
 *
 *     x = cos φ · sin λ',   y = sin φ,   z = cos φ · cos λ'      (λ' = λ + spin)
 *
 * so +z points at the camera and `spin` turns the globe about its polar
 * (y) axis — the reference's slow rotation. A small `tilt` then leans the
 * pole toward or away from the camera (rotation about x), because the
 * reference globes are not dead-on: shot 1's Australia sits low, its north
 * pole tipped away. Orthographic projection is just (x, y) scaled by the
 * radius; z is kept only to answer "is this point on the near face?".
 *
 * `spin` and `tilt` are the ONLY inputs beyond the coordinate — the holon
 * makes `spin` its one animating param, so the whole globe is a pure
 * function of one number and scrubs backwards exactly (the FourierTrace
 * `turn` / FlowerText `settle` shape).
 *
 * THE LIMB CLAMP
 *
 * A coastline ring runs from the near face round to the far face and back.
 * For a FILLED continent the ring must stay CLOSED (the even-odd fill needs
 * closed loops), but its far-face half must not paint over the near face. So
 * a back-face point (z < 0) is pushed straight out to the silhouette circle —
 * projected onto the limb along its own screen direction — which folds the
 * far half flat against the globe's edge where it is invisible behind the
 * near half, while keeping the ring closed and its near half exact. A wholly
 * back-face continent collapses to a sliver on the limb, which is correct: it
 * is on the far side and should not be seen.
 *
 * For an OUTLINE continent there is no fill to keep closed, so the honest
 * thing is to DROP the far-face points and keep only the near-face arcs —
 * `frontArcs` below — giving clean coastlines with no ghost lines raking
 * across the sphere.
 */

/** A point in the packing/screen plane. x right, y up. */
export interface Vec2 {
  x: number
  y: number
}

/** A projected sphere point: screen position plus its camera-facing z. */
export interface Projected {
  x: number
  y: number
  /** > 0 on the near face (toward the camera), < 0 on the far face. */
  z: number
}

/**
 * Project a lon/lat (DEGREES) onto the sphere of the given radius, after
 * spinning by `spin` about the pole and leaning by `tilt` about the screen x
 * axis (both radians). Returns screen x/y and the camera-facing z.
 */
export const projectLatLon = (
  lonDeg: number,
  latDeg: number,
  radius: number,
  spin: number,
  tilt: number,
): Projected => {
  const lon = (lonDeg * Math.PI) / 180 + spin
  const lat = (latDeg * Math.PI) / 180
  const cosLat = Math.cos(lat)
  const x = cosLat * Math.sin(lon)
  const y0 = Math.sin(lat)
  const z0 = cosLat * Math.cos(lon)
  // Lean the pole about the screen x axis.
  const y = y0 * Math.cos(tilt) - z0 * Math.sin(tilt)
  const z = y0 * Math.sin(tilt) + z0 * Math.cos(tilt)
  return { x: x * radius, y: y * radius, z }
}

/**
 * Project a whole ring, clamping every far-face point onto the limb circle so
 * the ring stays CLOSED and its far half folds flat against the silhouette
 * (see the header's limb-clamp note). For FILLED continents.
 *
 * A point already on the near face passes through. A far-face point is pushed
 * to radius `radius` along its own screen direction; if it sits exactly on the
 * axis (no screen direction), it is dropped to the pole nearest its sign.
 */
export const clampedRing = (
  ring: readonly number[],
  radius: number,
  spin: number,
  tilt: number,
): Vec2[] => {
  const out: Vec2[] = []
  for (let i = 0; i + 1 < ring.length; i += 2) {
    const p = projectLatLon(ring[i]!, ring[i + 1]!, radius, spin, tilt)
    if (p.z >= 0) {
      out.push({ x: p.x, y: p.y })
    } else {
      const len = Math.hypot(p.x, p.y)
      if (len < 1e-9) out.push({ x: 0, y: p.y >= 0 ? radius : -radius })
      else out.push({ x: (p.x / len) * radius, y: (p.y / len) * radius })
    }
  }
  return out
}

/**
 * Split a ring into its NEAR-FACE arcs — the maximal runs of consecutive
 * points with z ≥ 0, each arc an open polyline. For OUTLINE continents, where
 * the far half is simply not drawn.
 *
 * Where an arc begins or ends, the crossing point is interpolated onto the
 * limb so the coastline meets the silhouette cleanly rather than stopping
 * short. A ring that never leaves the near face returns as one arc; one wholly
 * on the far face returns none.
 */
export const frontArcs = (
  ring: readonly number[],
  radius: number,
  spin: number,
  tilt: number,
): Vec2[][] => {
  const n = ring.length / 2
  if (n < 2) return []
  const pts: Projected[] = []
  for (let i = 0; i + 1 < ring.length; i += 2) {
    pts.push(projectLatLon(ring[i]!, ring[i + 1]!, radius, spin, tilt))
  }

  // The point where the segment a→b crosses z = 0, snapped to the limb.
  const crossing = (a: Projected, b: Projected): Vec2 => {
    const t = a.z / (a.z - b.z) // a.z ≥ 0 > b.z (or the reverse), so t ∈ [0,1]
    const x = a.x + (b.x - a.x) * t
    const y = a.y + (b.y - a.y) * t
    const len = Math.hypot(x, y)
    if (len < 1e-9) return { x, y }
    return { x: (x / len) * radius, y: (y / len) * radius }
  }

  const arcs: Vec2[][] = []
  let current: Vec2[] | null = null
  // Walk the ring as a CLOSED loop so an arc that straddles the seam (the
  // ring's first/last vertex) is one arc, not two.
  for (let k = 0; k <= n; k++) {
    const a = pts[k % n]!
    const b = pts[(k + 1) % n]!
    const aFront = a.z >= 0
    const bFront = b.z >= 0
    if (aFront) {
      if (!current) current = [{ x: a.x, y: a.y }]
      else current.push({ x: a.x, y: a.y })
    }
    if (aFront && !bFront) {
      // Leaving the near face: end the arc on the limb.
      current!.push(crossing(a, b))
      arcs.push(current!)
      current = null
    } else if (!aFront && bFront) {
      // Entering the near face: start a fresh arc on the limb.
      current = [crossing(a, b)]
    }
  }
  if (current && current.length > 1) arcs.push(current)
  // Merge a seam-straddling pair (an arc that ended at k=n and one that began
  // at k=0 are the same arc) — cheap and keeps coastlines unbroken.
  if (arcs.length >= 2) {
    const first = arcs[0]!
    const last = arcs[arcs.length - 1]!
    const a = last[last.length - 1]!
    const b = first[0]!
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) {
      arcs[0] = last.slice(0, -1).concat(first)
      arcs.pop()
    }
  }
  return arcs.filter((a) => a.length >= 2)
}
