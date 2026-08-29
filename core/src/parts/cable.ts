/**
 * Cable — ONE holon whose IDENTITY is the rendered face (a tapered tube
 * with sliding contour rings) and whose CONTEXT supplies the
 * control-polyline SOURCE (DECISIONS 2026-08-29, the cable verdict).
 * This file ships the `trail` source — kinematic position history —
 * used by the standalone MindVirus; the XPBD `tether` source arrives
 * with the TheWall layer (and with it Ch 6 baking, which the trail does
 * NOT need: a trail of a pure motion is itself pure).
 *
 * ## The trail is a pure function of t
 *
 * The carrier hands the cable its position as f(time) — for MindVirus,
 * the closed-form journey path. The trail at clock T is then simply
 * {position(T − s) : s ∈ [0, window]}: sampling the carrier's own past,
 * exact and pure. NO recorded history, NO frame-order dependence —
 * scrubbing backwards reproduces identical geometry, which
 * core/test/cable.test.ts pins. (The C4D original needed a Tracer
 * object smuggled to the document root to survive generator rebuilds;
 * that whole apparatus dissolves here.)
 *
 * ## Construction (from MindVirus.py's generator, re-read as geometry)
 *
 * The original samples ~12 control points from the tracer history,
 * smooths them progressively toward the tail (:816-885), hands them to
 * a Bezier spline, sweeps a circle along it (r = 4, tapered), and
 * slices contour rings every `contour_step` of arc length, phase-offset
 * by the creature's travel so they SLIDE as it swims (:656-814). Ported
 * faithfully, minus the mesh archaeology:
 *
 *  - 12 control points at equal time spacing over the window (the
 *    tracer recorded one point per frame, so equal-index sampling WAS
 *    equal-time sampling), head first;
 *  - the same progressive 3-neighbour smoothing (blend 0.5·(0.3+0.7·t),
 *    3 iterations, both ends pinned);
 *  - Catmull-Rom through the smoothed points (standing in for C4D's
 *    auto-tangent Bezier), resampled to the tube polyline.
 *
 * The TUBE renders as its two silhouette edges: polylines offset
 * ±radius(s) from the spine, perpendicular to both the local tangent
 * and the view direction. This is the honest reading of what Sketch &
 * Toon showed — constant-pixel outline strokes around world-space
 * geometry, so the taper and the perspective thinning are the
 * GEOMETRY's doing, not a per-point stroke width (which the TSL ribbon
 * does not have, and here does not need). `view` is the direction
 * toward the camera (+z default — the front-view rig); a live
 * camera-fed silhouette is the render hook to ask for when a scene
 * orbits while a cable is on screen.
 *
 * The RINGS are world-fixed mile-markers: ring m sits where the
 * carrier's cumulative travel crossed m · ringStep. As the creature
 * advances, new rings are born at the head and the old ones recede
 * down the tube — the original's `ref_offset % step` sliding, restated
 * without the modulo. Each ring is a full circle around the spine in
 * the plane perpendicular to the local tangent; the original culled
 * back-facing halves (billboard-ish arcs), but at tube radii a closed
 * ring seen near edge-on projects to the same thin ellipse — the
 * cleanest DreamTalk-native construction, chosen over a camera-coupled
 * arc. Radius follows the tube's local taper.
 */

import { Holon } from "../holon"
import { bool, color, completion, length, scalar } from "../params"
import { Line, Stroke, type Vec3Like } from "./index"
import { invRotHPB } from "./curves"
import { TAU, WHITE } from "../constants"

export type PathFn = (time: number) => Vec3Like
/** A holon that can state its own position at an arbitrary time. */
export interface TrailCarrier {
  pathAt(time: number): Vec3Like
}

const CTRL_POINTS = 12
const SMOOTH_BLEND = 0.5
const SMOOTH_ITERATIONS = 3
const TUBE_SAMPLES = 48
const RING_SEGMENTS = 16
const TRAVEL_SAMPLES_PER_SEC = 120

// -- dumb vec3 helpers (module-local; not worth a Param in sight) -----------

const sub = (a: Vec3Like, b: Vec3Like): Vec3Like => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const add = (a: Vec3Like, b: Vec3Like): Vec3Like => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const mul = (a: Vec3Like, k: number): Vec3Like => ({ x: a.x * k, y: a.y * k, z: a.z * k })
const cross = (a: Vec3Like, b: Vec3Like): Vec3Like => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const len = (a: Vec3Like): number => Math.hypot(a.x, a.y, a.z)
const norm = (a: Vec3Like): Vec3Like | undefined => {
  const l = len(a)
  return l < 1e-9 ? undefined : mul(a, 1 / l)
}

/** The original's progressive smoothing (MindVirus.py:844-885): both ends
 *  pinned (index 0 is attached to the creature), blend growing toward the
 *  tail so the head tracks and the tail flows. */
export const smoothControlPoints = (
  points: readonly Vec3Like[],
  smoothing = SMOOTH_BLEND,
  iterations = SMOOTH_ITERATIONS,
): Vec3Like[] => {
  if (points.length < 3) return [...points]
  let result = [...points]
  for (let it = 0; it < iterations; it++) {
    const out: Vec3Like[] = [result[0]!]
    for (let i = 1; i < result.length - 1; i++) {
      const t = i / (result.length - 1)
      const blend = smoothing * (0.3 + 0.7 * t)
      const avg = mul(add(add(result[i - 1]!, result[i]!), result[i + 1]!), 1 / 3)
      out.push(add(result[i]!, mul(sub(avg, result[i]!), blend)))
    }
    out.push(result[result.length - 1]!)
    result = out
  }
  return result
}

/** Uniform Catmull-Rom through the control points, resampled to `count`
 *  points (endpoints duplicated for the boundary tangents). */
export const catmullRomResample = (ctrl: readonly Vec3Like[], count: number): Vec3Like[] => {
  if (ctrl.length < 2) return [...ctrl]
  const P = (i: number): Vec3Like => ctrl[Math.min(ctrl.length - 1, Math.max(0, i))]!
  const out: Vec3Like[] = []
  const segments = ctrl.length - 1
  for (let k = 0; k < count; k++) {
    const u = (k / (count - 1)) * segments
    const j = Math.min(Math.floor(u), segments - 1)
    const t = u - j
    const [p0, p1, p2, p3] = [P(j - 1), P(j), P(j + 1), P(j + 2)]
    const t2 = t * t
    const t3 = t2 * t
    out.push({
      x: 0.5 * (2 * p1.x + (p2.x - p0.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (3 * p1.x - p0.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * (2 * p1.y + (p2.y - p0.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (3 * p1.y - p0.y - 3 * p2.y + p3.y) * t3),
      z: 0.5 * (2 * p1.z + (p2.z - p0.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (3 * p1.z - p0.z - 3 * p2.z + p3.z) * t3),
    })
  }
  return out
}

interface CableGeometry {
  a: Vec3Like[]
  b: Vec3Like[]
  rings: Vec3Like[][]
}

export class Cable extends Stroke {
  /** Tube radius at the head, world units (the original's r=4 sweep at
   *  its end scale — measured against the mp4 in the wall report). */
  width = length(2.5)
  /** Tail radius as a fraction of the head radius. */
  taper = completion(0.06)
  /** Arc-length distance between contour rings (contour_step 30). */
  ringStep = length(30)
  /** Trail length in SECONDS of the carrier's past. */
  window = scalar(6)
  /** The cable's reading of scene time — bind it to the carrier's clock. */
  clock = scalar(0)
  /** Contour rings on/off. */
  rings = bool(true)
  override tint = color(WHITE)

  /** Direction toward the camera (world), for the silhouette offset. */
  view: Vec3Like = { x: 0, y: 0, z: 1 }
  /** Ring pool size — oldest rings drop out beyond this. */
  maxRings = 64

  /** The tube's two silhouette edges, head → tail. */
  edgeA = new Line({ tint: this.tint, stroke: this.stroke })
  edgeB = new Line({ tint: this.tint, stroke: this.stroke })
  /** The ring pool (compose()) — inactive rings carry empty polylines. */
  ringLines: Line[] = []

  private _path?: PathFn
  private _since = 0
  private _memoKey?: number[]
  private _memo?: CableGeometry

  /** Install the trail source: the carrier's position as pure f(time).
   *  `since` is the carrier's birth time (the trail never reaches
   *  further back); `window` here sets the param's default. */
  trail(source: PathFn | TrailCarrier, opts: { since?: number; window?: number } = {}): this {
    void this.parts // compose() installs the derived-points accessors
    this._path = typeof source === "function" ? source : (t: number) => source.pathAt(t)
    this._since = opts.since ?? 0
    if (opts.window !== undefined) {
      this.window.defaultValue = opts.window
      this.window.value = opts.window
    }
    return this
  }

  protected override compose(): void {
    const derivedLine = (line: Line, pick: (g: CableGeometry) => Vec3Like[]): void => {
      const cable = this
      Object.defineProperty(line, "points", {
        configurable: true,
        enumerable: true,
        get(): Vec3Like[] {
          return pick(cable.geometry())
        },
        set(_v: Vec3Like[]) {},
      })
    }
    derivedLine(this.edgeA, (g) => g.a)
    derivedLine(this.edgeB, (g) => g.b)
    for (let i = 0; i < this.maxRings; i++) {
      const ring = this.add(new Line({ tint: this.tint, stroke: this.stroke }))
      this.ringLines.push(ring)
      derivedLine(ring, (g) => g.rings[i] ?? [])
    }
  }

  /** Everything the geometry depends on — the memo key. Ancestor
   *  transforms are in it because the world-space trail is stated in
   *  the cable's local frame (the carrier usually IS the parent). */
  private geometryKey(): number[] {
    const key = [
      this.clock.value,
      this.width.value,
      this.taper.value,
      this.ringStep.value,
      this.window.value,
      this.rings.value ? 1 : 0,
      this._since,
    ]
    for (let node: Holon | undefined = this.parent; node; node = node.parent) {
      key.push(node.x.value, node.y.value, node.z.value, node.h.value, node.p.value, node.b.value, node.scale.value)
    }
    return key
  }

  /** World → the cable's parent frame, down the ancestor chain in the
   *  host's own transform order (translate → rotate → scale, inverted). */
  private toLocal(v: Vec3Like): Vec3Like {
    const chain: Holon[] = []
    for (let node: Holon | undefined = this.parent; node; node = node.parent) chain.push(node)
    let out = v
    for (let i = chain.length - 1; i >= 0; i--) {
      const anc = chain[i]!
      out = sub(out, { x: anc.x.value, y: anc.y.value, z: anc.z.value })
      out = invRotHPB(out, anc.p.value, anc.h.value, anc.b.value)
      const s = anc.scale.value
      if (s !== 1) out = mul(out, 1 / s)
    }
    return out
  }

  private geometry(): CableGeometry {
    const key = this.geometryKey()
    if (this._memo && this._memoKey && key.length === this._memoKey.length && key.every((v, i) => v === this._memoKey![i])) {
      return this._memo
    }
    this._memoKey = key
    this._memo = this.computeGeometry()
    return this._memo
  }

  private computeGeometry(): CableGeometry {
    const empty: CableGeometry = { a: [], b: [], rings: this.ringLines.map(() => []) }
    const path = this._path
    if (!path) return empty
    const T = this.clock.value
    const t0 = Math.max(this._since, T - this.window.value)
    const span = T - t0
    if (span <= 1e-4) return empty

    // The spine: control points head-first, smoothed, Catmull-Rom.
    const raw: Vec3Like[] = []
    for (let i = 0; i < CTRL_POINTS; i++) raw.push(path(T - (i / (CTRL_POINTS - 1)) * span))
    const pts = catmullRomResample(smoothControlPoints(raw), TUBE_SAMPLES)

    // Arc length from the head; degenerate (motionless) trails vanish.
    const cum: number[] = [0]
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + len(sub(pts[i]!, pts[i - 1]!)))
    const total = cum[cum.length - 1]!
    if (total < 1e-6) return empty

    // Tangents (head→tail sense), silhouette normals, tapered radii.
    const view = this.view
    const tangents: Vec3Like[] = []
    const normals: Vec3Like[] = []
    let lastNormal: Vec3Like = { x: 0, y: 1, z: 0 }
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[Math.max(0, i - 1)]!
      const p1 = pts[Math.min(pts.length - 1, i + 1)]!
      const tan = norm(sub(p1, p0)) ?? { x: 1, y: 0, z: 0 }
      tangents.push(tan)
      const n = norm(cross(tan, view)) ?? lastNormal
      lastNormal = n
      normals.push(n)
    }
    const radiusAt = (arcFrac: number): number =>
      this.width.value * (1 - (1 - this.taper.value) * arcFrac)

    const a: Vec3Like[] = []
    const b: Vec3Like[] = []
    for (let i = 0; i < pts.length; i++) {
      const r = radiusAt(cum[i]! / total)
      a.push(this.toLocal(add(pts[i]!, mul(normals[i]!, r))))
      b.push(this.toLocal(sub(pts[i]!, mul(normals[i]!, r))))
    }

    // Rings: world-fixed travel milestones every ringStep.
    const rings: Vec3Like[][] = this.ringLines.map(() => [])
    const step = this.ringStep.value
    if (this.rings.value && step > 0) {
      const K = Math.min(900, Math.max(2, Math.ceil((T - this._since) * TRAVEL_SAMPLES_PER_SEC)))
      const times: number[] = []
      const travel: number[] = [0]
      let prev = path(this._since)
      times.push(this._since)
      for (let k = 1; k < K; k++) {
        const tk = this._since + ((T - this._since) * k) / (K - 1)
        const p = path(tk)
        times.push(tk)
        travel.push(travel[k - 1]! + len(sub(p, prev)))
        prev = p
      }
      const travelAt = (t: number): number => {
        if (t <= times[0]!) return 0
        for (let k = 1; k < K; k++) {
          if (times[k]! >= t) {
            const u = (t - times[k - 1]!) / (times[k]! - times[k - 1]! || 1)
            return travel[k - 1]! + u * (travel[k]! - travel[k - 1]!)
          }
        }
        return travel[K - 1]!
      }
      const timeAtTravel = (d: number): number => {
        for (let k = 1; k < K; k++) {
          if (travel[k]! >= d) {
            const u = (d - travel[k - 1]!) / (travel[k]! - travel[k - 1]! || 1)
            return times[k - 1]! + u * (times[k]! - times[k - 1]!)
          }
        }
        return times[K - 1]!
      }
      const dHead = travel[K - 1]!
      const dTail = travelAt(t0)
      const mMax = Math.floor(dHead / step)
      const mMin = Math.max(1, Math.ceil(dTail / step))
      for (let j = 0; j < this.ringLines.length; j++) {
        const m = mMax - j
        if (m < mMin) break
        const tau = timeAtTravel(m * step)
        // Position within the window, 0 = head — the tube's own parameter.
        const f = Math.min(1, Math.max(0, (T - tau) / span))
        const u = f * (pts.length - 1)
        const i = Math.min(Math.floor(u), pts.length - 2)
        const w = u - i
        const center = add(mul(pts[i]!, 1 - w), mul(pts[i + 1]!, w))
        const tan = norm(add(mul(tangents[i]!, 1 - w), mul(tangents[i + 1]!, w))) ?? tangents[i]!
        const n = norm(cross(tan, view)) ?? normals[i]!
        const m2 = norm(cross(tan, n)) ?? { x: 0, y: 1, z: 0 }
        const arcFrac = (cum[i]! + w * (cum[i + 1]! - cum[i]!)) / total
        const r = radiusAt(arcFrac)
        const ring: Vec3Like[] = []
        for (let s = 0; s <= RING_SEGMENTS; s++) {
          const th = (s / RING_SEGMENTS) * TAU
          ring.push(this.toLocal(add(center, add(mul(n, r * Math.cos(th)), mul(m2, r * Math.sin(th))))))
        }
        rings[j] = ring
      }
    }
    return { a, b, rings }
  }
}
