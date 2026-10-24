/**
 * MeaningSphere — the sphere of meaning (a whiteboard study, 2026-10-24).
 * Two drawings made one solid:
 *
 *   DIABOLIC → SYMBOLIC   arrows rising up both sides, from the diabolic
 *                         (thrown apart: parasitic virality) to the symbolic
 *                         (thrown together: symbiotic communion);
 *   IDOLIC → ICONIC       a flat disk with arrows radiating outward in it —
 *                         BREADTH OF DISTRIBUTION — and from its centre one
 *                         arrow straight up — DEPTH OF MEANING.
 *
 * The build idea: put the disk inside the sphere. Arrows leave the bottom
 * pole (the diabolic, the idol), run outward over the surface to the
 * equator (breadth), and gather again at the top pole, meeting in the
 * symbolic, the icon: the one centre all of it rises to. The equator is
 * the disk; the axis through it is the depth.
 *
 * THE STATES, each one number so it scrubs and the automaton walks it:
 *   `depth`    0 IDOLIC … 1 ICONIC. At 0 the sphere is flattened into its
 *              equatorial disk: breadth without depth, twice the arrows
 *              (2 × `meridians`, every other one fading as depth grows), each
 *              spreading from the centre and vanishing at the rim; nothing
 *              returns. At 1 the disk has risen into the sphere: the flow
 *              comes back together at the top, and the red axis of depth
 *              stands through the north pole.
 *   `reading`  0 RISING … 1 GIVING — the arrows' direction is ambiguous,
 *              and the one symbol holds both readings.
 *              Rising (the drawing's arrows): the diabolic spreads from below
 *              (divergent), the symbolic gathers above (convergent).
 *              Giving: the symbolic pours out from above (it nourishes) and
 *              every vector converges onto the diabolic below (it
 *              extracts). The flow reverses along the meridians: on the way
 *              every arrow sweeps to the equator, shrinks to a point there
 *              and comes out turned round.
 * Solve et coagula, Logos and Eros — differentiating and bringing together,
 * positively or negatively polarised — are the sphere's two motions
 * (diverging from one pole, converging on the other); nothing more literal.
 *
 * THE EQUATOR (`metabolic`) is drawn dashed: a "metabolic" middle is only
 * a placeholder (the diabolic, metabolised, becoming symbolic), so it is
 * marked as open, not settled. An arrow changes colour as it crosses it:
 * blue below (diabolic, cold), red above (symbolic, warm).
 *
 * CONSTRUCTION. The surface is an ellipsoid of revolution about the pole
 * axis (local y): equatorial radius R, polar half-height R·max(FLAT, depth)
 * eased — a sphere at depth 1, the disk at 0. A meridian at longitude φ is
 * walked by u ∈ [0, 1], south pole to north. Everything lives in `ball`,
 * the solid's own frame (turned by `spin` + `turn`·time, leaned by
 * `pitch`), so the camera's orbit sees real geometry. What faces the eye is
 * drawn bright, the far side dim (the horizon of an ellipsoid is the
 * sphere's, under the affine map that makes it one — tangency is affine);
 * the limb is that horizon, a real curve in 3-D.
 *
 * The arrows are pure f(time, reading, depth): `arrows` per meridian, evenly
 * phased, neighbouring meridians staggered by half a phase — a symmetric
 * pattern, never random. All lines of one tint and side are ONE Polylines
 * (per-loop opacity), so the whole symbol is twelve strokes and two discs.
 */

import { Circle, Group, Line, Null, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { Polylines, deriveLoops } from "../../src/parts/polylines"
import { angle, color, completion, derive, integer, length, scalar } from "../../src/params"
import { BLUE, RED, TAU, WHITE, type Color } from "../../src/constants"
import { eased, restage, together, type Anim } from "../../src/anim"
import { toggle, type Axis, type StateSpace } from "../../src/automaton"
import type { Observer } from "../../src/dream"
import type { Overrides } from "../../src/holon"
import { liveView, localView, viewOf, type View } from "../../src/geometry/frames"
import { facingTurn } from "../Noosphere/geodesic"

/** The construction, in units of the radius R. */
export const MEANING = {
  /** The disk's thickness at depth 0 (a hair, so its two faces stay apart). */
  flat: 0.004,
  /** An arrow's length along its meridian, in path units (pole to pole = 1). */
  length: 0.085,
  /** The arrowhead's arm, × R. */
  head: 0.055,
  /** The arrowhead's half-angle. */
  spread: 0.45,
  /** Where along the path an arrow fades in and out (its own birth and death). */
  fade: 0.07,
  /** The axis of depth: from the centre to this far past the north pole, × R. */
  axis: 1.32,
  /** The poles' discs, × R. */
  pole: 0.032,
  /** The equator's dashes (a multiple of the meridians, so the pattern holds). */
  dashes: 72,
  /** Samples along a meridian, and along one arrow. */
  samples: 64,
  arrowSamples: 8,
} as const

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (u: number) => u * u * (3 - 2 * u)
const ramp = (v: number, a: number, b: number) => smooth(clamp01((v - a) / (b - a)))
const lerp = (a: number, b: number, u: number) => a + (b - a) * u
const frac = (v: number) => v - Math.floor(v)

/** The surface's two radii at a depth: equatorial a, polar b (× R). */
export const radii = (depth: number): { a: number; b: number } => ({ a: 1, b: Math.max(MEANING.flat, smooth(clamp01(depth))) })

/** A meridian's point at path u (0 the south pole … 1 the north) and longitude phi. */
export const meridianPoint = (u: number, phi: number, a: number, b: number): Vec3Like => {
  const th = -Math.PI / 2 + Math.PI * u
  const c = Math.cos(th)
  return { x: a * c * Math.cos(phi), y: b * Math.sin(th), z: a * c * Math.sin(phi) }
}

/** Where an arrow's ends are drawn: path position x, read rising (0) or giving (1). */
export const readAt = (x: number, reading: number): number => lerp(x, 1 - x, reading)

/** One drawn run: its points, its tint (0 blue, 1 red), its side, its opacity. */
interface Run {
  pts: Vec3Like[]
  red: boolean
  near: boolean
  op: number
}

/** The ten strokes' loops and opacities, one frame's worth. */
type Bins = Record<"guideBlue" | "guideRed" | "arrowBlue" | "arrowRed", { near: Vec3Like[][]; far: Vec3Like[][]; nearOp: number[]; farOp: number[] }>
const emptyBins = (): Bins => {
  const b = () => ({ near: [] as Vec3Like[][], far: [] as Vec3Like[][], nearOp: [] as number[], farOp: [] as number[] })
  return { guideBlue: b(), guideRed: b(), arrowBlue: b(), arrowRed: b() }
}

export class MeaningSphere extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The sphere's radius — the symbol's one size. */
  radius = length(360)
  /** Meridians of the sphere (construction); the disk shows twice as many. */
  meridians = integer(12)
  /** Arrows on each meridian at once (construction). */
  arrows = integer(3)

  // --- the states -----------------------------------------------------------
  /** 0 idolic (the flat disk: breadth) … 1 iconic (the sphere: breadth and depth). */
  depth = completion(1)
  /** 0 rising (diabolic spreads, symbolic gathers) … 1 giving (symbolic gives, diabolic takes). */
  reading = completion(0)
  /** The equator, the open "metabolic?" middle (0 hides it). */
  metabolic = completion(1)

  // --- motion ---------------------------------------------------------------
  /** Scene seconds: the flow's clock (runs in free play). */
  time = scalar(0)
  /** Path lengths (pole to pole) per second. */
  speed = scalar(0.07)
  /** The solid's turn about its pole, radians per second of `time`. */
  turn = scalar(0.08)
  /** The solid's turn about its pole (at rest, no meridian hides behind the
   *  axis of depth), and the pole's lean toward the eye. */
  spin = angle(Math.PI / 24)
  pitch = angle(0.42)

  // --- the look -------------------------------------------------------------
  symbolicTint = color(RED)
  diabolicTint = color(BLUE)
  lineTint = color(WHITE)
  /** The guides' (meridians') pen and brightness. */
  guideStroke = length(0.9)
  guideOpacity = completion(0.32)
  arrowStroke = length(2.2)
  /** The far side's share of the near side's brightness. */
  backOpacity = completion(0.28)

  /** The solid's own frame. */
  ball!: Group
  guidesBlue!: Polylines
  guidesRed!: Polylines
  arrowsBlue!: Polylines
  arrowsRed!: Polylines
  equator!: Polylines
  limb!: Line
  axisLine!: Line
  north!: Circle
  south!: Circle

  constructor(overrides: Overrides = {}) {
    super(overrides)
  }

  /** The eye the symbol is seen from (`seenFrom`), else the live or default eye. */
  eye?: () => View
  seenFrom(observer: Observer): void {
    this.eye = () => viewOf(observer)
  }
  /** The eye in the ball's own frame. */
  ballView(): View {
    return localView(this.ball, this.eye?.() ?? liveView() ?? { eye: { x: 0, y: 0, z: 1500 } })
  }

  /** How far the symbol reaches from its centre (the axis's arrow above the north pole). */
  get reach(): number {
    return this.radius.value * MEANING.axis
  }

  protected override compose(): void {
    const R = () => this.radius.value
    const M = Math.max(1, Math.round(this.meridians.value))
    const K = Math.max(1, Math.round(this.arrows.value))
    const cr = () => this.creation.value
    const s = () => smooth(clamp01(this.depth.value))

    this.ball = this.add(new Group())
    this.ball.h.follow(derive(() => this.spin.value + this.turn.value * this.time.value))
    this.ball.p.follow(this.pitch)
    const ballAdd = <T extends Null>(h: T) => (this.ball.attach(h), h)

    // The eye in the ball's frame, in the unit sphere the ellipsoid maps to.
    const eyeKey = () => {
      const v = this.ballView()
      const e = "eye" in v ? v.eye : v.toward
      return `${"eye" in v ? "p" : "o"}${e.x.toFixed(2)},${e.y.toFixed(2)},${e.z.toFixed(2)}`
    }
    /** Does the ellipsoid's surface at local point p (units of R) face the eye? */
    const facing = () => {
      const v = this.ballView()
      const { a, b } = radii(this.depth.value)
      if ("eye" in v) {
        const e = { x: v.eye.x / (R() * a), y: v.eye.y / (R() * b), z: v.eye.z / (R() * a) }
        return (p: Vec3Like) => (p.x / a) * e.x + (p.y / b) * e.y + (p.z / a) * e.z > 1
      }
      const d = { x: v.toward.x / a, y: v.toward.y / b, z: v.toward.z / a }
      return (p: Vec3Like) => (p.x / a) * d.x + (p.y / b) * d.y + (p.z / a) * d.z > 0
    }
    const scaled = (p: Vec3Like): Vec3Like => ({ x: p.x * R(), y: p.y * R(), z: p.z * R() })

    /** Split a sampled path (with its u per point) into runs by hemisphere and side. */
    const split = (pts: Vec3Like[], us: number[], op: number, sees: (p: Vec3Like) => boolean, out: Run[], above = 1) => {
      let cur: Run | undefined
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!
        const b = pts[i]!
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }
        const red = (us[i - 1]! + us[i]!) / 2 > 0.5
        const near = sees(mid)
        if (!cur || cur.red !== red || cur.near !== near) {
          if (cur && cur.pts.length >= 2) out.push(cur)
          cur = { pts: [scaled(a)], red, near, op: red ? op * above : op }
        }
        cur.pts.push(scaled(b))
      }
      if (cur && cur.pts.length >= 2) out.push(cur)
    }
    /** Path samples from u0 to u1, with the equator inserted so a colour turns exactly there. */
    const samplesOf = (u0: number, u1: number, n: number): number[] => {
      const us: number[] = []
      for (let i = 0; i <= n; i++) us.push(lerp(u0, u1, i / n))
      const lo = Math.min(u0, u1)
      const hi = Math.max(u0, u1)
      if (lo < 0.5 && hi > 0.5) {
        us.push(0.5)
        us.sort((p, q) => (u1 >= u0 ? p - q : q - p))
      }
      return us
    }
    const bin = (bins: Bins, runs: Run[], kind: "guide" | "arrow") => {
      for (const r of runs) {
        const b = bins[`${kind}${r.red ? "Red" : "Blue"}`]
        if (r.near) b.near.push(r.pts), b.nearOp.push(r.op)
        else b.far.push(r.pts), b.farOp.push(r.op)
      }
    }

    // THE FRAME'S LINES, all at once (one key: every input that moves them).
    let memo: { key: string; v: Bins } | undefined
    const frame = (): Bins => {
      const key = `${R()},${this.depth.value},${this.reading.value},${this.time.value},${this.speed.value},${cr()},${eyeKey()}`
      if (memo?.key === key) return memo.v
      const bins = emptyBins()
      const { a, b } = radii(this.depth.value)
      const sees = facing()
      const depth = s()
      const c = cr()
      // Above the equator only as much as there is depth: the idol never
      // returns — its arrows slide off the disk's rim.
      // THE MERIDIANS (guides): drawn on from the south pole as Create runs;
      // the disk's extra meridians (odd) fade as the depth grows.
      const reach = clamp01(c * 1.25)
      const guides: Run[] = []
      for (let k = 0; k < 2 * M; k++) {
        const thin = k % 2 === 1 ? 1 - depth : 1
        if (thin <= 0.001 || reach <= 0) continue
        const phi = (k / (2 * M)) * TAU
        const us = samplesOf(0, reach, Math.max(2, Math.round(MEANING.samples * reach)))
        // Above the equator a meridian is there only as much as the depth.
        const lower = us.filter((u) => u <= 0.5)
        const top = us.filter((u) => u >= 0.5)
        if (lower.length >= 2) split(lower.map((u) => meridianPoint(u, phi, a, b)), lower, thin, sees, guides)
        if (top.length >= 2 && depth > 0.001) split(top.map((u) => meridianPoint(u, phi, a, b)), top, thin * depth, sees, guides)
      }
      bin(bins, guides, "guide")
      // THE ARROWS: once the sphere is drawn.
      const shown = ramp(c, 0.75, 1)
      if (shown > 0) {
        const arrowRuns: Run[] = []
        const L = MEANING.length
        const flow = this.time.value * this.speed.value
        const r = this.reading.value
        const sizeOf = Math.abs(1 - 2 * r) // the arrow shrinks to a point as it turns round
        for (let k = 0; k < 2 * M; k++) {
          const thin = k % 2 === 1 ? 1 - depth : 1
          if (thin <= 0.001) continue
          const phi = (k / (2 * M)) * TAU
          // Staggered by half a phase on alternate meridians of the sphere.
          const stagger = (Math.floor(k / 2) % 2) / (2 * K) + (k % 2) / (4 * K)
          for (let j = 0; j < K; j++) {
            // x: where the arrow's TAIL is along its own flow, 0 … 1 + L.
            const x = frac(flow + j / K + stagger) * (1 + L) - L
            const x0 = Math.max(0, x)
            const x1 = Math.min(1, x + L)
            if (x1 - x0 < 1e-4) continue
            const env = ramp(x + L / 2, 0, MEANING.fade) * (1 - ramp(x + L / 2, 1 - MEANING.fade, 1))
            const u0 = readAt(x0, r)
            const u1 = readAt(x1, r)
            const op = env * thin * shown
            if (op < 0.004) continue
            const us = samplesOf(u0, u1, MEANING.arrowSamples)
            split(us.map((u) => meridianPoint(u, phi, a, b)), us, op, sees, arrowRuns, depth)
            // The head at the drawn tip (x1's end), opening back along the flow.
            if (x + L > 1 || sizeOf < 0.02) continue
            const tip = meridianPoint(u1, phi, a, b)
            const eps = 0.004
            const back = meridianPoint(clamp01(u1 + (u1 > u0 ? -eps : eps)), phi, a, b)
            let tx = back.x - tip.x
            let ty = back.y - tip.y
            let tz = back.z - tip.z
            const tl = Math.hypot(tx, ty, tz) || 1
            ;(tx /= tl), (ty /= tl), (tz /= tl)
            // East along the parallel: the head lies in the surface's tangent plane.
            const ex = -Math.sin(phi)
            const ez = Math.cos(phi)
            // A newborn arrow grows its head as it leaves the pole.
            const h = MEANING.head * Math.min(1, sizeOf * 1.5) * ramp(x + L, 0, 1.5 * L)
            const ca = Math.cos(MEANING.spread) * h
            const sa = Math.sin(MEANING.spread) * h
            const left = { x: tip.x + tx * ca + ex * sa, y: tip.y + ty * ca, z: tip.z + tz * ca + ez * sa }
            const right = { x: tip.x + tx * ca - ex * sa, y: tip.y + ty * ca, z: tip.z + tz * ca - ez * sa }
            const headOp = op * (u1 > 0.5 ? depth : 1)
            if (headOp >= 0.004) arrowRuns.push({ pts: [scaled(left), scaled(tip), scaled(right)], red: u1 > 0.5, near: sees(tip), op: headOp })
          }
        }
        bin(bins, arrowRuns, "arrow")
      }
      memo = { key, v: bins }
      return bins
    }
    const frameKey = () => [R(), this.depth.value, this.reading.value, this.time.value, this.speed.value, cr(), eyeKey()]
    // Seen through the disk nothing is hidden: the far side is dim only as
    // much as there is depth to be behind.
    const back = () => lerp(1, this.backOpacity.value, s())
    const pair = (bins: () => Bins[keyof Bins], tint: () => Color, pen: () => number, gain: () => number) => {
      const near = ballAdd(new Polylines({ tint: derive(tint), stroke: derive(pen), opacity: derive(gain), loopOpacity: () => bins().nearOp }))
      deriveLoops(near, frameKey, () => bins().near)
      const far = ballAdd(new Polylines({ tint: derive(tint), stroke: derive(pen), opacity: derive(() => gain() * back()), loopOpacity: () => bins().farOp }))
      deriveLoops(far, frameKey, () => bins().far)
      return near
    }
    const blue = () => this.diabolicTint.value
    const red = () => this.symbolicTint.value
    this.guidesBlue = pair(() => frame().guideBlue, blue, () => this.guideStroke.value, () => this.guideOpacity.value)
    this.guidesRed = pair(() => frame().guideRed, red, () => this.guideStroke.value, () => this.guideOpacity.value)
    this.arrowsBlue = pair(() => frame().arrowBlue, blue, () => this.arrowStroke.value, () => 1)
    this.arrowsRed = pair(() => frame().arrowRed, red, () => this.arrowStroke.value, () => 1)

    // THE EQUATOR: the disk's rim, dashed — the open "metabolic?" middle.
    const shapeKey = () => [R(), this.depth.value, eyeKey()]
    const equatorNow = () => {
      const sees = facing()
      const near: Vec3Like[][] = []
      const far: Vec3Like[][] = []
      const n = MEANING.dashes
      for (let i = 0; i < n; i++) {
        const dash = Array.from({ length: 4 }, (_, q) => meridianPoint(0.5, ((i + (q / 3) * 0.5) / n) * TAU, 1, 1))
        ;(sees(dash[1]!) ? near : far).push(dash.map(scaled))
      }
      return { near, far }
    }
    const equatorGain = () => this.metabolic.value * 0.7 * ramp(cr(), 0.4, 0.6)
    this.equator = ballAdd(new Polylines({ tint: this.lineTint, stroke: 1.1, opacity: derive(equatorGain) }))
    deriveLoops(this.equator, shapeKey, () => equatorNow().near)
    const equatorFar = ballAdd(new Polylines({ tint: this.lineTint, stroke: 1.1, opacity: derive(() => equatorGain() * back()) }))
    deriveLoops(equatorFar, shapeKey, () => equatorNow().far)

    // THE LIMB: the eye's horizon on the ellipsoid — the sphere's horizon
    // (in the unit sphere the ellipsoid maps to) mapped back.
    this.limb = ballAdd(new Line({ tint: this.lineTint, stroke: 1.2, opacity: derive(() => 0.55 * ramp(cr(), 0.5, 0.9)) }))
    derivePoints(this.limb, shapeKey, () => {
      const v = this.ballView()
      const { a, b } = radii(this.depth.value)
      let t: [number, number, number]
      let k = 0
      if ("eye" in v) {
        const e: [number, number, number] = [v.eye.x / (R() * a), v.eye.y / (R() * b), v.eye.z / (R() * a)]
        const d = Math.hypot(...e)
        if (d <= 1) return []
        t = [e[0] / d, e[1] / d, e[2] / d]
        k = 1 / d
      } else {
        const e: [number, number, number] = [v.toward.x / a, v.toward.y / b, v.toward.z / a]
        const d = Math.hypot(...e) || 1
        t = [e[0] / d, e[1] / d, e[2] / d]
      }
      const ref: [number, number, number] = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
      let p: [number, number, number] = [t[1] * ref[2] - t[2] * ref[1], t[2] * ref[0] - t[0] * ref[2], t[0] * ref[1] - t[1] * ref[0]]
      const pl = Math.hypot(...p)
      p = [p[0] / pl, p[1] / pl, p[2] / pl]
      const w: [number, number, number] = [t[1] * p[2] - t[2] * p[1], t[2] * p[0] - t[0] * p[2], t[0] * p[1] - t[1] * p[0]]
      const rr = Math.sqrt(1 - k * k)
      return Array.from({ length: 129 }, (_, i) => {
        const g = (i / 128) * TAU
        const q = [0, 1, 2].map((j) => t[j]! * k + (p[j]! * Math.cos(g) + w[j]! * Math.sin(g)) * rr)
        return { x: q[0]! * a * R(), y: q[1]! * b * R(), z: q[2]! * a * R() }
      })
    })

    // THE AXIS OF DEPTH: from the disk's centre straight up through the
    // north pole — as long as there is depth.
    this.axisLine = ballAdd(new Line({ tint: this.symbolicTint, stroke: 2.4, arrowEnd: true, arrowSize: 1.5 }))
    this.axisLine.opacity.follow(derive(() => ramp(s(), 0.05, 0.4)))
    derivePoints(this.axisLine, () => [R(), this.depth.value], () => [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: Math.max(1e-3, s() * MEANING.axis * R()), z: 0 },
    ])

    // THE POLES: the diabolic (blue) below, the symbolic (red) above — the
    // centre the flow rises to — each a disc turned to the eye.
    const pole = (north: boolean) => {
      const disc = ballAdd(
        new Circle({
          radius: derive(() => MEANING.pole * R()),
          tint: north ? this.symbolicTint : this.diabolicTint,
          stroke: 0,
          fillOpacity: 1,
        }),
      )
      const at = () => (north ? 1 : -1) * radii(this.depth.value).b * R()
      disc.y.follow(derive(at))
      const turn = () => {
        const v = this.ballView()
        const d = "eye" in v ? [v.eye.x, v.eye.y - at(), v.eye.z] : [v.toward.x, v.toward.y, v.toward.z]
        const l = Math.hypot(d[0]!, d[1]!, d[2]!) || 1
        return facingTurn([d[0]! / l, d[1]! / l, d[2]! / l])
      }
      disc.h.follow(derive(() => turn().h))
      disc.p.follow(derive(() => turn().p))
      disc.opacity.follow(
        derive(() => {
          const sees = facing()
          const side = sees({ x: 0, y: north ? radii(this.depth.value).b : -radii(this.depth.value).b, z: 0 }) ? 1 : back()
          return side * ramp(cr(), north ? 0.8 : 0, north ? 1 : 0.15) * (north ? s() : 1)
        }),
      )
      return disc
    }
    this.south = pole(false)
    this.north = pole(true)
  }

  /** The flow draws itself on: from the south pole the meridians spread to
   *  the equator and gather at the north, then the depth's arrow rises and
   *  the arrows begin to run. */
  override createAnim(): Anim {
    void this.parts
    return together(eased("smooth", this.creation.sequence(0, 1)), restage(this.axisLine.creation.sequence(0, 1), 0.7, 1))
  }

  override unCreateAnim(): Anim {
    return this.creation.to(0)
  }

  /** Walkable (src/automaton.ts): depth (idolic ↔ iconic) and the reading
   *  (rising ↔ giving); the flow's clock runs in free play. No keys are
   *  declared: the player assigns digits, and a weaving scene rekeys. */
  override stateSpace(): StateSpace | undefined {
    void this.parts
    const handles = [this]
    const free = (p: { isBound: boolean }) => !p.isBound
    const axes = [
      free(this.depth) && toggle("depth", this.depth, { off: ["idolic", 0], on: ["iconic", 1], duration: 3, handles }),
      free(this.reading) && toggle("reading", this.reading, { off: ["rising", 0], on: ["giving", 1], duration: 2.5, handles }),
    ].filter((a): a is Axis => !!a)
    return { axes, clocks: this.time.isBound ? [] : [this.time] }
  }
}
