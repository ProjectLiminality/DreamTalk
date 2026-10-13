/**
 * Connection — a relation between two places on the Earth, drawn as a
 * great-circle arc that rises off the surface and comes back down.
 *
 * Its pen starts at its FIRST place and lands on the second, so a set of
 * them drawing on together reads as the relation's direction: every
 * subsidiary reporting home to its headquarters. The arc follows the great
 * circle (the shortest way across the planet), lifted by a sine bump whose
 * height grows with the distance it spans, so a long reach arches higher
 * than a short one and none of them lie flat on the borders beneath.
 *
 * A Line, living in the Earth's own frame (an Earth adopts it through
 * `places`, beside the Places it joins), so it turns with the planet and is
 * hidden by its horizon like everything else. It also states its curve in
 * WORLD space (`worldCurves`) — what MorphCurves/MorphMany read — so many
 * connections can later gather into one circle.
 */

import type { Holon, Overrides } from "../../src/holon"
import { Line, type Vec3Like } from "../../src/parts/primitives"
import { scalar } from "../../src/params"
import { toWorld } from "../../src/parts/soliddrawing"
import { latLonToUnit } from "../../src/geometry/sphere"
import type { Place } from "./Earth"

/** Points per arc — enough that the chord between two never shows its corner. */
const SEGMENTS = 96

/**
 * Points along the great circle from (lat0, lon0) to (lat1, lon1) at
 * `radius`, lifted by `base + rise · angle · radius · sin(πs)`.
 */
export const greatCircleArc = (
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  radius: number,
  rise: number,
  base = 0,
  segments = SEGMENTS,
): Vec3Like[] => {
  const a = latLonToUnit(from.lat, from.lon)
  const b = latLonToUnit(to.lat, to.lon)
  const omega = Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)))
  const sinO = Math.sin(omega)
  const pts: Vec3Like[] = []
  for (let i = 0; i <= segments; i++) {
    const s = i / segments
    // Slerp; a degenerate (coincident) pair stays at the one point.
    const ka = sinO < 1e-9 ? 1 - s : Math.sin((1 - s) * omega) / sinO
    const kb = sinO < 1e-9 ? s : Math.sin(s * omega) / sinO
    const r = radius + base + rise * omega * radius * Math.sin(Math.PI * s)
    pts.push({ x: (a.x * ka + b.x * kb) * r, y: (a.y * ka + b.y * kb) * r, z: (a.z * ka + b.z * kb) * r })
  }
  return pts
}

export class Connection extends Line {
  /** Peak lift as a fraction of the arc's own length (angle × radius). */
  rise = scalar(0.2)
  /** Lift at the two ends, scene units — clear of the surface's own strokes. */
  base = scalar(0.6)

  /**
   * The two places joined, first → second (the pen's direction). A plain
   * array, not holon fields: the Places belong to the Earth, not to this.
   */
  ends: Place[] = []

  constructor(overrides: Overrides = {}) {
    super(overrides)
    const [from, to] = this.ends
    if (!from || !to) throw new Error("Connection: needs ends: [from, to]")
    let key = ""
    let memo: Vec3Like[] = []
    Object.defineProperty(this, "points", {
      configurable: true,
      enumerable: true,
      get: (): Vec3Like[] => {
        const k = [from.lat.value, from.lon.value, to.lat.value, to.lon.value, from.radius.value, this.rise.value, this.base.value].join(",")
        if (k !== key) {
          key = k
          memo = greatCircleArc(
            { lat: from.lat.value, lon: from.lon.value },
            { lat: to.lat.value, lon: to.lon.value },
            from.radius.value,
            this.rise.value,
            this.base.value,
          )
          this.geomVersion++
        }
        return memo
      },
      set: () => {},
    })
  }

  /** Numbers that move whenever `worldCurves()` would — the morph's cheap dirty key. */
  curveSignature(): number[] {
    const out = [this.points.length, this.geomVersion]
    for (let n: Holon | undefined = this; n; n = n.parent) {
      out.push(n.x.value, n.y.value, n.z.value, n.h.value, n.p.value, n.b.value, n.scale.value)
    }
    return out
  }

  /** The arc in world space — what a morph reads (MorphCurves `curvesOf`). */
  worldCurves(): Vec3Like[][] {
    return [this.points.map((p) => toWorld(this, p))]
  }
}
