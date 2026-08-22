/**
 * Analytic view-dependent silhouette of a cylinder — pure math, no three.
 *
 * The cylinder is axis-aligned along local +Y with radius r; its mantle
 * point at angle θ is P(θ, y) = (r·cosθ, y, r·sinθ) with outward surface
 * normal n(θ) = (cosθ, 0, sinθ). A mantle generator line lies on the
 * silhouette exactly when the view ray from camera C grazes the surface:
 * n · (P − C) = 0. Since n has no Y component this reduces to the 2D
 * condition in the XZ plane:
 *
 *   r − (Cx·cosθ + Cz·sinθ) = 0
 *
 * Writing the camera's XZ offset as d = |(Cx, Cz)| at azimuth
 * φ = atan2(Cz, Cx), the condition becomes d·cos(θ − φ) = r, so
 *
 *   θ = φ ± acos(r / d),   requiring d > r.
 *
 * The camera height Cy never appears: the two silhouette generators are
 * exact vertical lines from cap to cap, valid under perspective from any
 * height. When d ≤ r the camera is inside (or on) the mantle's radius and
 * no silhouette generator exists — the caller hides the mantle lines.
 *
 * This is TASTE's "SDF as technique" clause #2 (analytic silhouettes for
 * parametric primitives) and the Chapter-8 resolution of the standing
 * "perspective-dependent silhouette as real stroke geometry" problem for
 * the cylinder case.
 */

export interface SilhouetteAngles {
  /** Generator azimuth φ − acos(r/d), radians. */
  thetaA: number
  /** Generator azimuth φ + acos(r/d), radians. */
  thetaB: number
}

/**
 * The two mantle-generator azimuths as seen from a camera at local-space
 * XZ offset (camX, camZ), or undefined when the camera is within the
 * cylinder's radius (degenerate: no silhouette).
 */
export const silhouetteAngles = (
  camX: number,
  camZ: number,
  radius: number,
): SilhouetteAngles | undefined => {
  const d = Math.hypot(camX, camZ)
  if (!(d > radius)) return undefined
  const phi = Math.atan2(camZ, camX)
  const spread = Math.acos(radius / d)
  return { thetaA: phi - spread, thetaB: phi + spread }
}

/** A point on the mantle generator at azimuth θ, height y (local space). */
export const generatorPoint = (
  theta: number,
  radius: number,
  y: number,
): [number, number, number] => [radius * Math.cos(theta), y, radius * Math.sin(theta)]
