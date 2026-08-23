/**
 * Analytic cylinder–plane section curve — pure math, no three.
 *
 * The cylinder is axis-aligned along local +Y, radius r, height h,
 * centered at the origin (caps at y = ±h/2 — matching the host's cap
 * polylines). The cutting plane is given in cylinder-local space by a
 * point p0 and a normal n. In the 2021 source this curve was drawn by
 * Sketch & Toon's "line intersection" mode (`intersects_with`,
 * object.py:118/183); here we construct the mathematical truth directly.
 *
 * Writing the normal as n = (nx, ny, nz), ρ = |(nx, nz)|, α = atan2(nz, nx)
 * and d = n·p0, a mantle point P(θ, y) = (r·cosθ, y, r·sinθ) lies on the
 * plane iff  r·ρ·cos(θ − α) + ny·y = d,  so with u = θ − α:
 *
 *   y(u) = (d − r·ρ·cos u) / ny          (ny ≠ 0)
 *
 * — the mantle trace is a full ellipse when |y(u)| ≤ h/2 everywhere.
 * Where it would leave the height bounds the curve is clipped by the
 * caps: the plane meets a cap plane in a straight line, whose chord
 * across the cap disk closes the section (a "truncated" ellipse). The
 * limits are the family video-01 needs: plane ⊥ axis → circle (S06
 * mid-turn), plane ∥ axis → rectangle of two generators + two cap
 * chords (S06's lengthwise cut), tilted → ellipse, possibly truncated
 * (S03's sweeping cut, S06's morph in between).
 */

export interface Vec3 {
  x: number
  y: number
  z: number
}

export type SectionKind =
  | "circle" // plane ⊥ axis, within height bounds
  | "ellipse" // tilted plane, mantle-only (untruncated)
  | "truncated" // tilted plane clipped by one or both caps
  | "rectangle" // plane ∥ axis: two generators + two cap chords
  | "line" // plane ∥ axis, exactly tangent to the mantle
  | "empty" // no intersection

export interface Section {
  kind: SectionKind
  /**
   * The section polyline in cylinder-local space. Closed curves repeat
   * the first point at the end; "line" is open; "empty" has no points.
   */
  points: Vec3[]
  closed: boolean
}

const EPS = 1e-9

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** A point on the mantle at azimuth θ, height y. */
export const mantlePoint = (theta: number, radius: number, y: number): Vec3 => ({
  x: radius * Math.cos(theta),
  y,
  z: radius * Math.sin(theta),
})

const empty: Section = { kind: "empty", points: [], closed: false }

/**
 * The section curve of the cylinder (radius, height, axis Y, centered)
 * with the plane through `planePoint` with normal `planeNormal` (both
 * cylinder-local). `segments` is the sample count a full 2π mantle
 * sweep would get; arcs receive their proportional share.
 */
export const cylinderPlaneSection = (
  radius: number,
  height: number,
  planePoint: Vec3,
  planeNormal: Vec3,
  segments = 96,
): Section => {
  const halfH = height / 2
  const mag = Math.hypot(planeNormal.x, planeNormal.y, planeNormal.z)
  if (!(mag > EPS) || !(radius > EPS) || !(height > EPS)) return empty

  // Normalize, and flip so ny ≥ 0 — the plane is unoriented.
  const flip = planeNormal.y < 0 ? -1 : 1
  const nx = (flip * planeNormal.x) / mag
  const ny = (flip * planeNormal.y) / mag
  const nz = (flip * planeNormal.z) / mag
  const d = nx * planePoint.x + ny * planePoint.y + nz * planePoint.z

  const rho = Math.hypot(nx, nz)
  const alpha = Math.atan2(nz, nx)

  // Plane ⊥ axis: a circle at constant height (or nothing).
  if (rho < EPS) {
    const y = d / ny
    if (Math.abs(y) > halfH + EPS) return empty
    const points: Vec3[] = []
    for (let i = 0; i <= segments; i++) {
      points.push(mantlePoint((i / segments) * 2 * Math.PI, radius, clamp(y, -halfH, halfH)))
    }
    return { kind: "circle", points, closed: true }
  }

  // Plane ∥ axis: cos u = d / (r·ρ) picks the generator azimuths.
  if (ny < EPS) {
    const c = d / (radius * rho)
    if (c > 1 + EPS || c < -1 - EPS) return empty
    if (Math.abs(c) > 1 - EPS) {
      // Tangent: a single generator line.
      const theta = alpha + (c > 0 ? 0 : Math.PI)
      return {
        kind: "line",
        points: [mantlePoint(theta, radius, -halfH), mantlePoint(theta, radius, halfH)],
        closed: false,
      }
    }
    const u = Math.acos(c)
    const thetaA = alpha - u
    const thetaB = alpha + u
    // Generator up, chord across the top cap, generator down, chord back.
    const points: Vec3[] = [
      mantlePoint(thetaA, radius, -halfH),
      mantlePoint(thetaA, radius, halfH),
      mantlePoint(thetaB, radius, halfH),
      mantlePoint(thetaB, radius, -halfH),
      mantlePoint(thetaA, radius, -halfH),
    ]
    return { kind: "rectangle", points, closed: true }
  }

  // General tilt. Height bounds translate to bounds on cos u:
  //   y(u) ≤ +h/2  ⇔  cos u ≥ cTop,    y(u) ≥ −h/2  ⇔  cos u ≤ cBot.
  const cTop = (d - ny * halfH) / (radius * rho)
  const cBot = (d + ny * halfH) / (radius * rho)
  if (cTop > 1 - EPS || cBot < -1 + EPS) return empty // mantle never entered
  const clippedTop = cTop > -1 // some u has y(u) > h/2
  const clippedBot = cBot < 1 // some u has y(u) < −h/2
  const aTop = Math.acos(clamp(cTop, -1, 1)) // valid |u| upper bound
  const aBot = Math.acos(clamp(cBot, -1, 1)) // valid |u| lower bound

  const yAt = (u: number): number =>
    clamp((d - radius * rho * Math.cos(u)) / ny, -halfH, halfH)
  const at = (u: number): Vec3 => mantlePoint(alpha + u, radius, yAt(u))

  if (!clippedTop && !clippedBot) {
    // Full ellipse on the mantle.
    const points: Vec3[] = []
    for (let i = 0; i <= segments; i++) points.push(at(-Math.PI + (i / segments) * 2 * Math.PI))
    return { kind: "ellipse", points, closed: true }
  }

  // Truncated: two mirrored mantle arcs u ∈ ±[aBot, aTop], joined by a
  // top-cap chord (if the top clips) and a bottom-cap chord (if the
  // bottom clips); when a cap doesn't clip the arcs meet at u = 0 / ±π.
  const span = aTop - aBot
  const arcSteps = Math.max(2, Math.round((segments * span) / (2 * Math.PI)))
  const points: Vec3[] = []
  const push = (p: Vec3): void => {
    const prev = points[points.length - 1]
    if (prev && Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z) < 1e-7) return
    points.push(p)
  }
  for (let i = 0; i <= arcSteps; i++) push(at(aBot + (span * i) / arcSteps))
  // At u = ±aTop the curve sits on the top cap edge; the straight chord
  // between them lies in both the cutting plane and the cap plane.
  // (Where a cap doesn't clip, the arcs meet at u = 0 / ±π and the
  // seam point dedupes away.)
  for (let i = arcSteps; i >= 0; i--) push(at(-(aBot + (span * i) / arcSteps)))
  points.push(points[0]!) // bottom-cap chord (or coincident point) closes it
  return { kind: "truncated", points, closed: true }
}
