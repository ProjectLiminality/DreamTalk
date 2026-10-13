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
 *
 * A FLOW. With `particles` (construction-time, a pool), the relation carries
 * traffic: short dashes travel the arc from its first place to its second,
 * by FlowMap's own stream maths (geometry/flowmap.ts `streamArc`,
 * `streamFade`, `arcTable`, `atArcLength`) — positions a pure function of
 * `time`, faded in and out at the arc's ends and at its draw front, so a
 * flow only runs where its line has been drawn. `volume` 0…1 is the flow's
 * strength: how many of the pool are on the arc at once, and how heavy each
 * dash is. `time` is a CLOCK — it advances with the timeline, and on its own
 * in free play (stateSpace clocks).
 */

import type { Holon, Overrides } from "../../src/holon"
import { derivePoints, Line, type Vec3Like } from "../../src/parts/primitives"
import { color, derive, scalar } from "../../src/params"
import { WHITE } from "../../src/constants"
import { atArcLength, streamArc, streamFade } from "../../src/geometry/flowmap"
import type { StateSpace } from "../../src/automaton"
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

  /** Dashes in the flow's pool; 0 = a plain relation line. Construction-time. */
  particles = 0
  /** The flow's strength, 0…1: dashes on the arc at once, and their weight. */
  volume = scalar(1)
  /** The flow's clock, seconds. */
  time = scalar(0)
  /** How fast traffic travels: arc lengths per second. */
  pace = scalar(0.22)
  /** A dash's length, as a fraction of the arc. */
  dash = scalar(0.035)
  /** The traffic's colour — bright against the relation's own (dimmer) line. */
  particleTint = color(WHITE)

  /** The dashes, in pool order. */
  flow: Line[] = []

  constructor(overrides: Overrides = {}) {
    super(overrides)
    const [from, to] = this.ends
    if (!from || !to) throw new Error("Connection: needs ends: [from, to]")
    derivePoints(
      this,
      () => [from.lat.value, from.lon.value, to.lat.value, to.lon.value, from.radius.value, this.rise.value, this.base.value],
      () =>
        greatCircleArc(
          { lat: from.lat.value, lon: from.lon.value },
          { lat: to.lat.value, lon: to.lon.value },
          from.radius.value,
          this.rise.value,
          this.base.value,
        ),
    )

    // The flow: n dashes circulating a loop at least as long as the arc;
    // those past its end are in the pipe, hidden (streamArc's model).
    const n = Math.max(0, Math.round(this.particles))
    let table: { key: number; points: Vec3Like[]; lengths: number[] } | undefined
    const arc = () => {
      void this.points
      if (!table || table.key !== this.geomVersion) {
        const pts = this.points
        const lengths = [0]
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1]!
          const b = pts[i]!
          lengths.push(lengths[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z))
        }
        table = { key: this.geomVersion, points: pts, lengths }
      }
      return table
    }
    // One phase per relation, from its ends, so neighbouring flows do not
    // march in step.
    const seed = Math.abs(Math.sin(from.lat.value * 12.9898 + to.lon.value * 78.233) * 43758.5453) % 1
    for (let j = 0; j < n; j++) {
      const at = () => {
        const { lengths } = arc()
        const L = lengths[lengths.length - 1] ?? 0
        const live = Math.max(1, n * Math.max(0.05, Math.min(1, this.volume.value)))
        const spacing = L / live
        const s = streamArc(j, n, spacing, this.pace.value * L, this.time.value, seed)
        return { s, L, fade: streamFade(s, L, this.creation.value) }
      }
      const dash = new Line({
        tint: this.particleTint,
        stroke: derive(() => this.stroke.value * (1.4 + this.volume.value)),
        opacity: derive(() => this.opacity.value * at().fade),
      })
      derivePoints(dash, () => [this.time.value, this.pace.value, this.volume.value, this.dash.value, this.geomVersion], () => {
        const { points, lengths } = arc()
        const { s, L } = at()
        if (!(L > 0) || s > L) return []
        const d = this.dash.value * L
        const out: Vec3Like[] = []
        for (let k = 0; k <= 5; k++) out.push(atArcLength(points, lengths, Math.max(0, s - d + (d * k) / 5)))
        return out
      })
      this.flow.push(this.add(dash))
    }
  }

  /** A flow keeps moving in free play: its clock runs with wall time. */
  override stateSpace(): StateSpace | undefined {
    return this.particles > 0 ? { axes: [], clocks: [this.time] } : undefined
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
