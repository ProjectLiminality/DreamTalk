/**
 * Cable — ONE holon whose IDENTITY is the rendered face (a tapered tube
 * with sliding contour rings) and whose CONTEXT supplies the
 * control-polyline SOURCE (DECISIONS 2026-08-29, the cable verdict).
 * This file ships TWO sources: `trail` — kinematic position history,
 * used by the standalone MindVirus — and `tether` — the XPBD chain of
 * TheWall. The trail needs no baking (a trail of a pure motion is
 * itself pure); the tether is the case Ch 6 exists for, and bakes.
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
 *
 * ## The tether source (TheWall.py:1404-1560)
 *
 * A tether is a chain of 21 particles pinned between a fixed anchor
 * (the spawn point) and a MOVING tip (the flying creature), sagging
 * under gravity, draping over the creature's folding cube. It is
 * history-dependent, so `tether()` does the one thing ONTOLOGY
 * sanctions: at build time it simulates the whole scene span once and
 * bakes the 21 tracks (bake.ts), after which the cable's geometry at
 * clock t is a table lookup — pure, scrub-safe both directions.
 *
 * The wall's cables render DIFFERENTLY from the swimming trail: the
 * original draws them as a camera-facing quad strip with no contour
 * rings, tapering 0.3 → 1.0 from anchor to tip (:783-829) — the
 * opposite end from the trail's taper, because here the thin end is the
 * one left behind. Setting `rings = false` and `taper` accordingly is
 * all the difference amounts to; the same silhouette-edge tube draws
 * both. The spine is Catmull-Rom ×3 through the baked particles
 * (:757-781), exactly the source's subdivision.
 */

import { Holon } from "../holon"
import { bool, color, completion, length, scalar } from "../params"
import { Line, Stroke, type Vec3Like } from "./index"
import { invRotHPB } from "./curves"
import { TAU, WHITE } from "../constants"
import { bake, type BakedTrack } from "../bake"
import {
  CABLE_PARTICLES,
  CABLE_SLACK,
  colliderScale,
  foldableCubeFaces,
  settleParams,
  step as xpbdStep,
  straightState,
  XPBD_ACTIVATION,
  type CableState,
  type Frame,
  type StepConfig,
} from "../geometry/xpbd"
import type { Vec3 } from "../geometry/journey"

export type PathFn = (time: number) => Vec3Like
/** A holon that can state its own position at an arbitrary time. */
export interface TrailCarrier {
  pathAt(time: number): Vec3Like
}

/**
 * Everything the tether needs to know about its moving end at one
 * instant — the creature's pose, and how far along its flight it is.
 * The tip is a PURE function of time (it is a journey), which is
 * precisely why the tether can be baked at all.
 */
export interface TetherTip {
  /** The tip's world position (the pinned last particle). */
  position: Vec3
  /** Unit direction the cable ENTERS the tip: −(flight tangent) (:1480). */
  direction: Vec3
  /** The creature's orientation, for the collision cube (:1495-1499). */
  frame: Frame
  /** The cube's fold, −1…1 (:1512). */
  fold: number
  /** The creature's scale — the cube's size multiplier (:1512). */
  scale: number
  /** Journey completion 0…1: drives settle, collider fade, activation. */
  completion: number
  /** Distance travelled along the flight path so far — sets the rest
   *  length via the slack factor (:1472-1474). */
  travelled: number
}

export type TetherTipFn = (time: number) => TetherTip

export interface TetherOptions {
  /** Rest length multiplier on the distance travelled (:1473). */
  slack?: number
  /** Simulation AND sample rate. The source steps at 30 (:1476). */
  bakeFps?: number
  /** Scene seconds to bake. */
  duration: number
  /** Particles in the chain (:1427). */
  particles?: number
  /** The direction the cable departs the anchor — the spawn vector. */
  anchorDir?: Vec3
  /** The collision cube's edge length (the creature's brick size). */
  cubeSize?: number
}

const CTRL_POINTS = 12
const SMOOTH_BLEND = 0.5
const SMOOTH_ITERATIONS = 3
const TUBE_SAMPLES = 48
const RING_SEGMENTS = 16
const TRAVEL_SAMPLES_PER_SEC = 120
/** The source subdivides the tether's 21 particles ×3 (:766, :781). */
const TETHER_SUBDIVISIONS = 3
/** The tether's stroke width at the anchor, as a fraction of `width`
 *  (:800-803 — 0.3 at the anchor, 1.0 at the tip). */
const TETHER_TAPER_MIN = 0.3

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
  private _baked?: BakedTrack
  private _bakedScratch?: Float32Array
  /** Completions per baked frame — the tether fades in with the flight. */
  private _bakedVisible?: Float32Array

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

  /**
   * Install the tether source: simulate the XPBD chain over the whole
   * scene span RIGHT NOW and keep only the samples.
   *
   * This call is the bake. It is synchronous and eager because that is
   * the honest spelling of "at build time, never during playback": when
   * `tether()` returns, no simulator remains inside the cable — just a
   * table and an interpolator. Call it from `compose()`/`unfold()`.
   *
   * `anchor` is the fixed end (the spawn point); `tip` states the
   * creature's pose at any time, purely.
   */
  tether(anchor: Vec3, tip: TetherTipFn, opts: TetherOptions): this {
    void this.parts // compose() installs the derived-points accessors
    const particles = opts.particles ?? CABLE_PARTICLES
    const slack = opts.slack ?? CABLE_SLACK
    const fps = opts.bakeFps ?? 30
    const duration = opts.duration
    const cubeSize = opts.cubeSize ?? 100
    const anchorDir = opts.anchorDir

    const frames = Math.max(1, Math.round(duration * fps) + 1)
    const visible = new Float32Array(frames)

    const track = bake<CableState>(
      {
        width: particles * 3,
        init: () => straightState(anchor, tip(0).position, particles),
        step: (state, frame, time, dt) => {
          const t = tip(time)
          visible[frame] = t.completion
          // Below the activation threshold the source does not simulate
          // at all — it REWRITES the chain as a straight line with zero
          // velocity every frame (:1456-1463). Reproduced exactly: the
          // tether is taut while the creature is still leaving.
          if (t.completion <= XPBD_ACTIVATION) return straightState(anchor, t.position, particles)

          const settle = settleParams(t.completion)
          const cs = colliderScale(t.completion)
          const restLength = Math.max(t.travelled * slack, 1) / (particles - 1)
          const config: StepConfig = {
            anchor,
            tip: t.position,
            dt,
            restLength,
            drag: settle.drag,
            stiffness: settle.stiffness,
            dirStrength: settle.dirStrength,
            anchorDir,
            tipDir: t.direction,
            faces:
              cs > 0.01
                ? foldableCubeFaces(t.position, t.frame, t.fold, t.scale * cs, cubeSize)
                : undefined,
          }
          return xpbdStep(state, config)
        },
        sample: (state, out, offset) => {
          for (let i = 0; i < particles; i++) {
            const p = state.positions[i]!
            out[offset + i * 3] = p.x
            out[offset + i * 3 + 1] = p.y
            out[offset + i * 3 + 2] = p.z
          }
        },
      },
      { fps, duration },
    )
    visible[0] = tip(0).completion

    this._baked = track
    this._bakedVisible = visible
    this._bakedScratch = new Float32Array(track.width)
    return this
  }

  /** Bytes this cable's bake occupies (0 if it is a trail). */
  get bakedBytes(): number {
    return this._baked?.data.byteLength ?? 0
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

  /**
   * The tube around an explicit spine — the tether's rendering.
   *
   * Same silhouette-edge construction the trail uses, but the width
   * profile runs the OTHER way: the source's stroke tapers 0.3 at the
   * anchor to 1.0 at the tip (:800-803), because for a tether the thin
   * end is the one left behind at the spawn point. No rings: the wall's
   * cables are plain tapered ribbons.
   */
  private tubeFrom(spine: readonly Vec3Like[], empty: CableGeometry): CableGeometry {
    if (spine.length < 2) return empty
    const view = this.view
    const a: Vec3Like[] = []
    const b: Vec3Like[] = []
    let lastNormal: Vec3Like = { x: 0, y: 1, z: 0 }
    for (let i = 0; i < spine.length; i++) {
      const p0 = spine[Math.max(0, i - 1)]!
      const p1 = spine[Math.min(spine.length - 1, i + 1)]!
      const tan = norm(sub(p1, p0)) ?? { x: 1, y: 0, z: 0 }
      const n = norm(cross(tan, view)) ?? lastNormal
      lastNormal = n
      const f = i / (spine.length - 1)
      const r = this.width.value * (TETHER_TAPER_MIN + (1 - TETHER_TAPER_MIN) * f)
      a.push(this.toLocal(add(spine[i]!, mul(n, r))))
      b.push(this.toLocal(sub(spine[i]!, mul(n, r))))
    }
    return { a, b, rings: this.ringLines.map(() => []) }
  }

  /** The baked tether's spine at clock t: the sampled particles,
   *  Catmull-Rom ×3 as the source subdivides them (:757-781). */
  private tetherSpine(): Vec3Like[] | undefined {
    const track = this._baked
    const visible = this._bakedVisible
    if (!track || !visible) return undefined
    const T = this.clock.value
    // Completion at t, read off the same frame grid — below
    // CABLE_VISIBLE_FROM the original draws nothing at all (:1420).
    const u = Math.min(Math.max(T * track.fps, 0), visible.length - 1)
    const completion = visible[Math.round(u)]!
    if (completion <= 0.02) return undefined

    const flat = track.sampleAt(T, this._bakedScratch)
    const n = flat.length / 3
    const particles: Vec3Like[] = []
    for (let i = 0; i < n; i++) {
      particles.push({ x: flat[i * 3]!, y: flat[i * 3 + 1]!, z: flat[i * 3 + 2]! })
    }
    // 21 particles × 3 subdivisions = 61 spine points, the source's
    // resolution exactly (subdivide_catmull_rom(positions, 3)).
    return catmullRomResample(particles, (n - 1) * (TETHER_SUBDIVISIONS + 1) + 1)
  }

  private computeGeometry(): CableGeometry {
    const empty: CableGeometry = { a: [], b: [], rings: this.ringLines.map(() => []) }
    if (this._baked) {
      const spine = this.tetherSpine()
      return spine ? this.tubeFrom(spine, empty) : empty
    }
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
