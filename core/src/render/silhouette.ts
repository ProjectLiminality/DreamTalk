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

/**
 * A cap circle as a polyline that STARTS on a silhouette generator and
 * runs the way Sketch & Toon drew it in 2021.
 *
 * The 2021 cylinder is a C4D parametric solid; its wireframe look is
 * entirely S&T contour lines, and S&T chains contour segments that touch.
 * On a cylinder the cap borders touch the two mantle generators, so the
 * pen has only two places it can start on a cap — and the reference says
 * which, unambiguously, in the first second of video-01 Scene 01:
 *
 *   - f0031 (0.2s into a 3s draw) lights 68 pixels at screen (529-534,
 *     273-286). Projecting the cap under the calibrated camera, that is
 *     cap angle 121.4 degrees — exactly thetaB, the LEFT generator — and
 *     f0032/33/34/35 extend from it toward INCREASING angle (132, 142, …).
 *   - f0038 shows the bottom cap opening from (740, 430), which is cap
 *     angle 309.5 degrees — thetaA, the right generator — and running
 *     toward DECREASING angle to (634, 442) at 174 degrees.
 *
 * Both caps therefore sweep the NEAR half of the mantle first (the arc
 * between the two generators that faces the camera) and the far half
 * second. Read as one pen path the whole cylinder is: top cap round from
 * thetaB, down the right generator, bottom cap round from thetaA, back up
 * the left generator — the contour closing on itself, which is precisely
 * what a chained S&T contour does.
 *
 * `startAngle` is where the pen begins; `reversed` runs it the other way.
 * The output's first and last point coincide, so arc-length draw-on covers
 * the circle exactly once.
 */
export const capPolylineFrom = (
  radius: number,
  y: number,
  startAngle: number,
  reversed: boolean,
  segments = 128,
): [number, number, number][] => {
  const pts: [number, number, number][] = []
  for (let i = 0; i <= segments; i++) {
    const step = (i / segments) * Math.PI * 2
    const a = startAngle + (reversed ? -step : step)
    pts.push([Math.cos(a) * radius, y, Math.sin(a) * radius])
  }
  return pts
}

/**
 * An ARC of a cap circle, from `startAngle` sweeping `sweep` radians
 * (signed — negative walks toward decreasing local angle). Same circle,
 * same convention as capPolylineFrom, but open: the contour of a cylinder
 * cap is BROKEN at the two silhouette generators, and S&T strokes the
 * pieces separately (see capArcs below).
 */
export const capArc = (
  radius: number,
  y: number,
  startAngle: number,
  sweep: number,
  segments = 64,
): [number, number, number][] => {
  const pts: [number, number, number][] = []
  for (let i = 0; i <= segments; i++) {
    const a = startAngle + (sweep * i) / segments
    pts.push([Math.cos(a) * radius, y, Math.sin(a) * radius])
  }
  return pts
}

/**
 * The two arcs one cap contributes to the contour, split at the
 * silhouette generators, walked the way the 2021 reference walks them.
 *
 * Why a split at all: the generators are where the cap's contour meets
 * the mantle's, so on the rendered contour graph each cap is TWO edges,
 * not one loop — and video-01's Scene 06 shows S&T treating them as two
 * strokes outright. Its 2s cylinder Create (refs/video-01/frames5,
 * f0494-f0504) draws the near cap's near-facing arc to completion, then
 * FREEZES it (the near half-plane's lit-pixel count is 1880/1881/1881
 * across f0498/f0499/f0500) while the far cap draws in full, and only
 * afterwards comes back for the near cap's far-facing arc. A single
 * closed cap stroke cannot do that.
 *
 * Direction: BOTH caps walk toward DECREASING local angle. The near cap
 * starts at thetaB and so runs its near-facing arc first (thetaB is
 * phi + spread, and decreasing walks it back through the camera azimuth
 * phi); the far cap starts at thetaA and so runs its far-facing arc
 * first. Both readings are direct: in f0495-f0498 the near ellipse grows
 * from its lower junction up its camera-facing side, and in f0499-f0501
 * the far ellipse grows from its upper junction over its away-facing
 * side.
 *
 * `startAngle` is the generator the cap's pen begins on; the first arc
 * returned is the one it draws first, the second the one it returns for.
 */
export const capArcs = (
  radius: number,
  y: number,
  startAngle: number,
  /** The angular gap to the OTHER generator, walking with decreasing angle. */
  firstSweep: number,
  segments = 64,
): { first: [number, number, number][]; second: [number, number, number][] } => ({
  first: capArc(radius, y, startAngle, firstSweep, segments),
  second: capArc(radius, y, startAngle + firstSweep, -(Math.PI * 2 + firstSweep), segments),
})
