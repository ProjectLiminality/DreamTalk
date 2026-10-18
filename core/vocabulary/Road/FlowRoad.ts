/**
 * FlowRoad — a flow made concrete: its channel becomes a road, each of
 * its particles a truck riding it.
 *
 *     road = new FlowRoad(source, { seenBy: () => this.observer })
 *     …
 *     this.play(this.road.concrete.to(1), 3)   // lines → roads
 *
 * `source` is any FLOW SOURCE (vocabulary/Lens: `path()` in `frame`'s
 * space, `particles()` as arc-length fractions or −1, `certainty?()`) — a
 * FlowMap `Flow`, a `Stream`. One `concrete` param walks it:
 *
 *   0          nothing of its own: the flow's own line and dots show.
 *   0 → 0.2    the dots' fill fades (the source reads `dotFill()`).
 *   0.2 → 0.8  the MORPH: the line splits into the road's two edges, each
 *              dot's ring becomes its truck (by arc length, flying as a
 *              body — the universal morph's plan and travel). From here
 *              the source hides its own line and dots (`abstractShown()`).
 *   0.8 → 1    the trucks' fill comes up — solid, the cargo in `cargo`.
 *
 * Particles and trucks are ONE TO ONE: truck j stands where particle j is
 * (the same arc-length place, so the same speed), on the road, facing
 * along it, upright to `up`. It is reversible and the flow never stops:
 * everything is a function of the source's state and `concrete`.
 *
 * CHEAP BY CONSTRUCTION, for twenty flows of a dozen trucks in an
 * orthographic view: a truck's drawing depends only on the direction it
 * is seen from, in its own frame — so drawings (hidden-line removal on the
 * Truck's solids) and the dot→truck morph plans are made once per view
 * bucket and SHARED by every FlowRoad; and a whole fleet draws as one
 * Polylines (all edges), one more for the road, and two Surfaces (cargo,
 * body) — four meshes per flow, however many trucks.
 *
 * Its certainty follows the source's (FlowContent-style): a conjectural
 * flow's road and trucks ghost with it.
 */

import { BLACK, BLUE, WHITE, type Color } from "../../src/constants"
import type { Observer } from "../../src/dream"
import type { Overrides } from "../../src/holon"
import { certainty } from "../../src/certainty"
import { color, completion, derive, length, paramEpoch } from "../../src/params"
import { Group, type Vec3Like } from "../../src/parts/primitives"
import { Polylines, deriveLoops } from "../../src/parts/polylines"
import { Surface } from "../../src/parts/surface"
import { toLocal, toWorld, viewOf } from "../../src/geometry/frames"
import { hiddenLineDrawing, type Drawing } from "../../src/geometry/hiddenline"
import { blendTravel, chainCurves, planMorph, type MorphPlan } from "../../src/geometry/correspond"
import { atArcLength, smooth } from "../../src/geometry/flowmap"
import { morphPhases } from "../Morph/MorphCurves"
import type { FlowSource } from "../Lens/Lens"
import { Truck } from "../Truck/Truck"

export interface FlowRoadOptions {
  /** Who sees it — the trucks draw their visible edges for this camera. */
  seenBy?: () => Observer
  /** "Up" for the road and its trucks, in the source's frame. Default +y. */
  up?: Vec3Like
  /** The ink of road and trucks. Default white. */
  lineTint?: Color
  /** The source's dot colour — what a truck's ink starts from. Default blue. */
  dotTint?: Color | (() => Color)
  /** View-bucket size, radians (shared drawings and plans). Default 0.1. */
  bucket?: number
}

// ─── Shared across every FlowRoad ───────────────────────────────────

/** View-bucket size, radians: ≈ 6° — a truck a few dozen pixels long is drawn as seen from at most 3° off, which no eye can tell. */
const BUCKET = 0.1
/** Native truck dimensions (vocabulary/Truck): 650 long, its middle 116 above the ground. */
const TRUCK_LENGTH = 650
const TRUCK_HALF_HEIGHT = 116
const TEMPLATE = new Truck()
/**
 * The fleet's level of detail: the Truck without its wheel hubs — under a
 * pixel at fleet size, and 70% of its hidden-line cost (8.4 → 2.6 ms a view).
 */
const SOLIDS = TEMPLATE.solids().filter((s) => !(s.kind === "cylinder" && s.radius < 20))
/** Which fill group each solid is in: 0 = cargo (the trailer, blue by default), 1 = body. */
const GROUP = SOLIDS.map((s) => (s.fill && s.fill.b > 0.5 ? 0 : 1))

interface Seen {
  drawing: Drawing
  /** The drawing's edges chained into strokes (the morph's targets). */
  strokes: Vec3Like[][]
  /** Faces as triangle fans per group: flat local xyz, and triangles. */
  faces: { positions: number[]; triangles: number[] }[]
  /** The dot → truck plans, by dot radius (truck units). */
  plans: Map<number, MorphPlan>
  toward: Vec3Like
}
const SEEN = new Map<string, Seen>()
const SEEN_MAX = 2048

/**
 * Douglas–Peucker in 3D: a symbol a few dozen pixels long needs no
 * 48-segment wheel — within `tol` (truck units) of the original, a
 * fraction of a pixel at fleet size, and a tenth of the points.
 */
const simplify = (pts: readonly Vec3Like[], tol: number): Vec3Like[] => {
  if (pts.length <= 2) return [...pts]
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack: [number, number][] = [[0, pts.length - 1]]
  const t2 = tol * tol
  while (stack.length) {
    const [i, j] = stack.pop()!
    const a = pts[i]!
    const b = pts[j]!
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
    const L2 = dot(ab, ab)
    let far = -1
    let fd = t2
    for (let k = i + 1; k < j; k++) {
      const p = pts[k]!
      const ap = { x: p.x - a.x, y: p.y - a.y, z: p.z - a.z }
      const u = L2 > 0 ? Math.max(0, Math.min(1, dot(ap, ab) / L2)) : 0
      const d = (ap.x - ab.x * u) ** 2 + (ap.y - ab.y * u) ** 2 + (ap.z - ab.z * u) ** 2
      if (d > fd) {
        fd = d
        far = k
      }
    }
    if (far >= 0) {
      keep[far] = 1
      stack.push([i, far], [far, j])
    }
  }
  return pts.filter((_, k) => keep[k])
}
/** Within this many truck units (≈ 0.1 px at fleet size). */
const TOL = 2.5

const seenFrom = (az: number, el: number, step: number): Seen => {
  const key = `${step}|${az}|${el}`
  let s = SEEN.get(key)
  if (s) return s
  const A = az * step
  const E = el * step
  const toward = { x: Math.cos(E) * Math.sin(A), y: Math.sin(E), z: Math.cos(E) * Math.cos(A) }
  const drawing = hiddenLineDrawing(SOLIDS, { toward })
  const strokes = chainCurves(drawing.lines as Vec3Like[][], TRUCK_LENGTH * 0.004).curves.map((c) => simplify(c, TOL))
  const faces = [0, 1].map((g) => {
    const positions: number[] = []
    const triangles: number[] = []
    for (const f of drawing.faces) {
      if (GROUP[f.solid] !== g) continue
      const ring = simplify(f.points, TOL)
      const n = ring.length - 1
      if (n < 3) continue
      const base = positions.length / 3
      for (let i = 0; i < n; i++) positions.push(ring[i]!.x, ring[i]!.y, ring[i]!.z)
      for (let i = 1; i + 1 < n; i++) triangles.push(base, base + i, base + i + 1)
    }
    return { positions, triangles }
  })
  s = { drawing, strokes, faces, plans: new Map(), toward }
  if (SEEN.size >= SEEN_MAX) SEEN.delete(SEEN.keys().next().value!)
  SEEN.set(key, s)
  return s
}

/** The dot (a ring facing the camera, on the ground under the truck's middle) → the truck, planned once per view and radius. */
const planFor = (seen: Seen, radius: number): MorphPlan => {
  const r = Math.round(radius * 4) / 4
  let plan = seen.plans.get(r)
  if (plan) return plan
  const n = seen.toward
  // A basis of the plane facing the camera.
  const up = Math.abs(n.y) < 0.99 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: -1 }
  const e1 = norm(cross(up, n))
  const e2 = cross(n, e1)
  const ring = Array.from({ length: 49 }, (_, i) => {
    const a = (i / 48) * 2 * Math.PI
    const c = Math.cos(a) * r
    const s = Math.sin(a) * r
    return { x: e1.x * c + e2.x * s, y: -TRUCK_HALF_HEIGHT + e1.y * c + e2.y * s, z: e1.z * c + e2.z * s }
  })
  // Coarse samples: a fleet's truck is a few dozen pixels.
  const total = seen.strokes.reduce((a, c) => a + c.slice(1).reduce((l, p, i) => l + Math.hypot(p.x - c[i]!.x, p.y - c[i]!.y, p.z - c[i]!.z), 0), 0)
  plan = planMorph([ring], seen.strokes, { normal: n, step: total / 160 })
  seen.plans.set(r, plan)
  return plan
}

/** The loops' key while nothing is drawn (concrete still in the dots' fade): constant, so nothing recomputes. */
const IDLE: readonly number[] = [-1]

const cross = (a: Vec3Like, b: Vec3Like): Vec3Like => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const dot = (a: Vec3Like, b: Vec3Like): number => a.x * b.x + a.y * b.y + a.z * b.z
const norm = (a: Vec3Like): Vec3Like => {
  const l = Math.hypot(a.x, a.y, a.z) || 1
  return { x: a.x / l, y: a.y / l, z: a.z / l }
}
const mix = (a: Color, b: Color, u: number): Color => ({ r: a.r + (b.r - a.r) * u, g: a.g + (b.g - a.g) * u, b: a.b + (b.b - a.b) * u })

/**
 * The idle maker: every FlowRoad, weakly; in the browser's idle time each
 * prepares what its trucks will need. Outside a browser nothing runs.
 */
const idleRoads = (() => {
  const watched = new Set<WeakRef<FlowRoad>>()
  const idle = (globalThis as { requestIdleCallback?: (cb: (d: { timeRemaining(): number }) => void) => number })
    .requestIdleCallback
  let scheduled = false
  const tick = (deadline: { timeRemaining(): number }) => {
    scheduled = false
    const hasTime = (ms = 6) => deadline.timeRemaining() > ms
    for (const ref of watched) {
      if (!hasTime()) break
      const road = ref.deref()
      if (!road) watched.delete(ref)
      else road.prepare(hasTime)
    }
    schedule()
  }
  const schedule = () => {
    if (scheduled || !idle || !watched.size) return
    scheduled = true
    setTimeout(() => idle.call(globalThis, tick), 16)
  }
  return {
    watch(r: FlowRoad) {
      if (!idle) return
      watched.add(new WeakRef(r))
      schedule()
    },
  }
})()

// ─── The holon ──────────────────────────────────────────────────────

/** One truck this frame: where it stands (local), its frame, its scale, how it is seen. */
interface Rider {
  at: Vec3Like
  fwd: Vec3Like
  up: Vec3Like
  side: Vec3Like
  scale: number
  /** The view bucket it is seen from (its drawing: `seenFrom(az, el, step)`). */
  az: number
  el: number
  step: number
}
const seenOf = (r: Rider): Seen => seenFrom(r.az, r.el, r.step)

export class FlowRoad extends Group {
  /** 0 = the abstract flow (nothing of its own) … 1 = road and trucks. */
  concrete = completion(0)
  /** How sure the flow is — follows the source's; inherited by everything drawn. */
  certainty = certainty(1)
  /** A truck's length (it is scaled to it). */
  truckLength = length(36)
  /** The road's width, edge to edge. */
  width = length(24)
  /** The source's dot radius — the ring a truck grows from. */
  dotRadius = length(6)
  /** The trailer's fill: the stage's material colour, if it has one. */
  cargo = color(BLUE)
  /** The ink's width, road and trucks alike. */
  stroke = length(2)

  private road!: { source: FlowSource; opts: FlowRoadOptions }
  private pathMemo?: { raw: readonly Vec3Like[]; key: number[]; points: Vec3Like[]; lengths: number[] }
  private memo?: { epoch: number; value: { points: Vec3Like[]; lengths: number[]; riders: Rider[] } }

  constructor(source: FlowSource, overrides: Overrides & FlowRoadOptions = {}) {
    const { seenBy, up, lineTint, dotTint, bucket, ...rest } = overrides
    super(rest)
    this.road = { source, opts: { seenBy, up, lineTint, dotTint, bucket } }
    if (source.certainty && !this.certainty.isBound) this.certainty.follow(derive(() => source.certainty!()))
    idleRoads.watch(this)
  }

  /**
   * Make, in idle time, the drawings and morph plans the trucks will need —
   * while the flow is still abstract or wherever a truck turns into a view
   * not yet seen — so the morph's first frame does not pay for them. Pure
   * caching: what a frame shows is unchanged. Stops when `hasTime` says so.
   */
  prepare(hasTime: (ms?: number) => boolean): void {
    for (const r of this.state().riders) {
      if (!hasTime()) return
      if (r.scale <= 0) continue
      const seen = seenFrom(r.az, r.el, r.step)
      // A plan (~5–8 ms) only when it fits in what is left of the idle
      // period — never pushing into the next frame.
      if (!hasTime(10)) return
      planFor(seen, this.ringRadius())
    }
  }

  /** The dot's radius in truck units — one plan per view, whatever a truck's growth at the ends. */
  private ringRadius(): number {
    return (this.dotRadius.value * TRUCK_LENGTH) / Math.max(1e-6, this.truckLength.value)
  }

  /** The source's line and dots: shown (1) until the morph begins, then hidden (0). */
  abstractShown(): number {
    return morphPhases(this.concrete.value).morph > 0 ? 0 : 1
  }

  /** How much of the source's dots' fill shows: fading over the first fifth of `concrete`. */
  dotFill(): number {
    return 1 - morphPhases(this.concrete.value).fillOut
  }

  /** The path in this holon's space, with arc lengths, and every visible particle's truck. Once per frame. */
  private state(): { points: Vec3Like[]; lengths: number[]; riders: Rider[] } {
    const epoch = paramEpoch()
    if (this.memo?.epoch === epoch) return this.memo.value
    const { source, opts } = this.road
    const frame = source.frame
    // The source frame → this space, as ONE affine map read once a frame
    // (four points through the chains), not every path point through world
    // space — a flow deep in a FlowMap's stack walks a long chain of derived
    // transforms each time.
    const direct = !frame || frame === this.parent
    const via = (p: Vec3Like) => toLocal(this, toWorld(frame!, p))
    const A = direct ? undefined : (() => {
      const o = via({ x: 0, y: 0, z: 0 })
      const d = (q: Vec3Like) => ({ x: q.x - o.x, y: q.y - o.y, z: q.z - o.z })
      return { o, ex: d(via({ x: 1, y: 0, z: 0 })), ey: d(via({ x: 0, y: 1, z: 0 })), ez: d(via({ x: 0, y: 0, z: 1 })) }
    })()
    const here = (p: Vec3Like): Vec3Like =>
      A
        ? {
            x: A.o.x + p.x * A.ex.x + p.y * A.ey.x + p.z * A.ez.x,
            y: A.o.y + p.x * A.ex.y + p.y * A.ey.y + p.z * A.ez.y,
            z: A.o.z + p.x * A.ex.z + p.y * A.ey.z + p.z * A.ez.z,
          }
        : p
    // The path and its arc lengths, kept while the source's array and the map stand.
    const raw = source.path()
    const mapKey = A ? [A.o, A.ex, A.ey, A.ez].flatMap((v) => [v.x, v.y, v.z]) : []
    const pc = this.pathMemo
    let points: Vec3Like[]
    let lengths: number[]
    if (pc && pc.raw === raw && pc.key.length === mapKey.length && pc.key.every((v, i) => v === mapKey[i])) {
      points = pc.points
      lengths = pc.lengths
    } else {
      points = raw.map(here)
      lengths = [0]
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]!
        const b = points[i]!
        lengths.push(lengths[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z))
      }
      this.pathMemo = { raw, key: mapKey, points, lengths }
    }
    // Up, in this space (the source frame's `up` carried over).
    const u0 = opts.up ?? { x: 0, y: 1, z: 0 }
    const o = here({ x: 0, y: 0, z: 0 })
    const u1 = here(u0)
    const upHere = norm({ x: u1.x - o.x, y: u1.y - o.y, z: u1.z - o.z })
    // The camera, in this space: a direction (orthographic) or an eye.
    const obs = opts.seenBy?.()
    const view = obs ? viewOf(obs) : { eye: { x: 0, y: 0, z: 1500 } }
    const origin = toLocal(this, { x: 0, y: 0, z: 0 })
    const towardHere =
      "toward" in view
        ? norm(((p) => ({ x: p.x - origin.x, y: p.y - origin.y, z: p.z - origin.z }))(toLocal(this, view.toward)))
        : undefined
    const eyeHere = "eye" in view ? toLocal(this, view.eye) : undefined
    const step = opts.bucket ?? BUCKET
    const L = lengths.at(-1)!
    const scale0 = this.truckLength.value / TRUCK_LENGTH
    const riders: Rider[] = []
    for (const s of source.particles()) {
      if (s < 0 || L <= 0) continue
      const a = s * L
      const at = atArcLength(points, lengths, a)
      const pa = atArcLength(points, lengths, Math.max(0, a - L * 0.01))
      const pb = atArcLength(points, lengths, Math.min(L, a + L * 0.01))
      const fwd0 = norm({ x: pb.x - pa.x, y: pb.y - pa.y, z: pb.z - pa.z })
      // Upright: up made perpendicular to the road's direction.
      const k = dot(upHere, fwd0)
      const up = norm({ x: upHere.x - fwd0.x * k, y: upHere.y - fwd0.y * k, z: upHere.z - fwd0.z * k })
      const fwd = fwd0
      const side = cross(fwd, up)
      // Out of the station and back in: trucks grow from and shrink into the ends.
      const scale = scale0 * smooth(0, 0.04, s) * smooth(1, 0.96, s)
      const toward = towardHere ?? norm({ x: eyeHere!.x - at.x, y: eyeHere!.y - at.y, z: eyeHere!.z - at.z })
      const t = { x: dot(toward, fwd), y: dot(toward, up), z: dot(toward, side) }
      const az = Math.round(Math.atan2(t.x, t.z) / step)
      const el = Math.round(Math.asin(Math.max(-1, Math.min(1, t.y))) / step)
      riders.push({ at, fwd, up, side, scale, az, el, step })
    }
    const value = { points, lengths, riders }
    this.memo = { epoch, value }
    return value
  }

  protected override compose(): void {
    const { opts } = this.road
    const ink = opts.lineTint ?? WHITE
    const dotTint = () => (typeof opts.dotTint === "function" ? opts.dotTint() : (opts.dotTint ?? BLUE))
    const phase = () => morphPhases(this.concrete.value)
    const drawn = () => (phase().morph > 0 ? 1 : 0)

    // The road: the flow's line splitting into two edges as the morph runs.
    const road = new Polylines({ tint: ink, stroke: this.stroke, opacity: derive(drawn) })
    deriveLoops(road, () => (drawn() ? [paramEpoch()] : IDLE), () => {
      if (!drawn()) return []
      const { points } = this.state()
      const m = phase().morph
      const w = (this.width.value / 2) * m
      const u0 = this.state().riders[0]?.up
      const upHere = u0 ?? { x: 0, y: 1, z: 0 }
      const edge = (sign: number) =>
        points.map((p, i) => {
          const a = points[Math.max(0, i - 1)]!
          const b = points[Math.min(points.length - 1, i + 1)]!
          const f = norm({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z })
          const side = norm(cross(f, upHere))
          return { x: p.x + side.x * w * sign, y: p.y + side.y * w * sign, z: p.z + side.z * w * sign }
        })
      return [edge(-1), edge(1)]
    })

    // The fleet's ink: every truck (or every dot on its way to one) as one stroke.
    const fleet = new Polylines({
      tint: derive((): Color => mix(dotTint(), ink, phase().morph)),
      stroke: this.stroke,
      opacity: derive(drawn),
    })
    deriveLoops(fleet, () => (drawn() ? [paramEpoch()] : IDLE), () => {
      if (!drawn()) return []
      const m = phase().morph
      const out: Vec3Like[][] = []
      for (const r of this.state().riders) {
        if (r.scale <= 0) continue
        const curves =
          m >= 1 ? seenOf(r).strokes : blendTravel(planFor(seenOf(r), this.ringRadius()), m)
        // Inlined place(): the hot loop of a riding fleet.
        const k = r.scale
        const h = TRUCK_HALF_HEIGHT * k
        const ox = r.at.x + r.up.x * h
        const oy = r.at.y + r.up.y * h
        const oz = r.at.z + r.up.z * h
        const f = r.fwd
        const u = r.up
        const sd = r.side
        for (const c of curves) {
          const line = new Array<Vec3Like>(c.length)
          for (let i = 0; i < c.length; i++) {
            const q = c[i]!
            const x = q.x * k
            const y = q.y * k
            const z = q.z * k
            line[i] = { x: ox + x * f.x + y * u.x + z * sd.x, y: oy + x * f.y + y * u.y + z * sd.y, z: oz + x * f.z + y * u.z + z * sd.z }
          }
          out.push(line)
        }
      }
      return out
    })

    // The fills: cargo and body, every truck's visible faces in one solid Surface each.
    const fillOf = (g: number, tint: () => Color) => {
      const surface = new Surface({
        solid: true,
        tint: derive((): Color => {
          const c = tint()
          const k = phase().fillIn
          return { r: c.r * k, g: c.g * k, b: c.b * k }
        }),
        fillOpacity: derive(() => (phase().fillIn > 0 ? 1 : 0)),
        opacity: derive(() => (phase().fillIn > 0 ? 1 : 0)),
      })
      let epoch = -1
      let version = 0
      let positions = new Float32Array(0)
      let indices = new Uint32Array(0)
      const refresh = () => {
        const e = paramEpoch()
        if (e === epoch) return
        epoch = e
        const riders = phase().fillIn > 0 ? this.state().riders.filter((r) => r.scale > 0) : []
        let nv = 0
        let nt = 0
        for (const r of riders) {
          nv += seenOf(r).faces[g]!.positions.length
          nt += seenOf(r).faces[g]!.triangles.length
        }
        if (nv === 0 && positions.length === 0) return
        positions = new Float32Array(nv)
        indices = new Uint32Array(nt)
        let v = 0
        let t = 0
        for (const r of riders) {
          const f = seenOf(r).faces[g]!
          const base = v / 3
          const k = r.scale
          const h = TRUCK_HALF_HEIGHT * k
          const ox = r.at.x + r.up.x * h
          const oy = r.at.y + r.up.y * h
          const oz = r.at.z + r.up.z * h
          const P = f.positions
          for (let i = 0; i < P.length; i += 3) {
            const x = P[i]! * k
            const y = P[i + 1]! * k
            const z = P[i + 2]! * k
            positions[v++] = ox + x * r.fwd.x + y * r.up.x + z * r.side.x
            positions[v++] = oy + x * r.fwd.y + y * r.up.y + z * r.side.y
            positions[v++] = oz + x * r.fwd.z + y * r.up.z + z * r.side.z
          }
          for (const q of f.triangles) indices[t++] = base + q
        }
        version++
      }
      Object.defineProperty(surface, "geomVersion", { configurable: true, get: () => (refresh(), version), set() {} })
      Object.defineProperty(surface, "positions", { configurable: true, get: () => (refresh(), positions), set() {} })
      Object.defineProperty(surface, "indices", { configurable: true, get: () => (refresh(), indices), set() {} })
      return surface
    }
    // Paint order: fills first, so the edges draw over them.
    this.add(fillOf(0, () => this.cargo.value))
    this.add(fillOf(1, () => BLACK))
    this.add(road)
    this.add(fleet)
  }
}
