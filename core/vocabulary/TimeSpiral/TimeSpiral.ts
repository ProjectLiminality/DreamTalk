/**
 * TimeSpiral — the three forms of time as one figure.
 *
 *   KRONOS   linear time: the vertical arrow, and the flat plane it stands
 *            on (the horizontal base, profound ↔ profane).
 *   AION     cyclic time: a circle, a turn that comes round again.
 *   SPIRAL   Kronos and Aion together: a helix winding up the vertical,
 *            narrow at the bottom and widening as it rises. Each turn is one
 *            aeon, one hero's journey; one of them is held by a red ring.
 *   KAIROS   the quality of the moment: the unchanging centre the spiral
 *            turns round, the axis itself. Past, present and future RHYME
 *            on it rather than mirror: successive turns are similar, not
 *            identical.
 *
 * Above, a star: fate as a pulling force (the arrow of Kronos points at
 * it). From below, an arrow: destiny as a pushing force. The base line runs
 * from the profound world (left, where Kairos moments come more readily) to
 * the profane (right, the depth of integration).
 *
 * THE STATES, each one number so it scrubs and the automaton walks it:
 *   `time`   0 KRONOS: the helix collapsed onto the axis, a straight line ·
 *            1 AION: every turn at one height and one radius, a circle ·
 *            2 SPIRAL: the circle stretched up and down the axis into the
 *            widening helix.
 *   `rhyme`  0 MIRROR: every turn a scaled copy of the last · 1 RHYME: each
 *            turn its own. The variation is deterministic: turn k is an
 *            ellipse (eccentricity RHYME.ellipse) tilted by RHYME.tilt, both
 *            oriented at k × the golden angle — every turn kin to its
 *            neighbours and none ever repeated. It takes effect only as the
 *            spiral opens (pure Kronos and pure Aion have nothing to rhyme).
 *   `now`    a clock (seconds): the present moment, a white point, travels
 *            the curve — up the line, round the circle, up the spiral — and
 *            its Kairos, a red point, is its projection onto the centre.
 *
 * REAL 3D: everything lives in `body`, leaned toward the eye; the helix is a
 * real helix, its near half drawn bright and its far half dim (split live
 * against the eye, so an orbit keeps it right). Dots, the star and the
 * words turn to face the eye.
 *
 * CONSTRUCTION, in units of H = `height` (the axis's half-length; the axis
 * centre at the origin): the base plane at y = −1, its rim radius BASE.rim;
 * the helix SPIRAL.turns turns from y = SPIRAL.bottom to SPIRAL.top, its
 * radius SPIRAL.r0 → SPIRAL.r1 linearly with the turn; Aion's circle at
 * y = 0, radius SPIRAL.aion; the ring round turn SPIRAL.aeon at RING × that
 * turn's radius. Pure: `spiralPoint(s, time, rhyme)`.
 */

import { Circle, Group, Line, Null, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { Polylines, deriveLoops } from "../../src/parts/polylines"
import { Text } from "../../src/parts/text"
import type { Observer } from "../../src/dream"
import { liveView, localView, viewOf, type View } from "../../src/geometry/frames"
import { rotHPB } from "../../src/parts/curves"
import { facingTurn } from "../Noosphere/geodesic"
import { completion, derive, length, scalar } from "../../src/params"
import { restage, together, type Anim } from "../../src/anim"
import { axis, toggle, type Axis, type StateSpace } from "../../src/automaton"
import type { Holon, Overrides } from "../../src/holon"
import { PI, RED, WHITE } from "../../src/constants"
import { Create } from "../../src/verbs"

/** The helix, in units of H (see header). */
export const SPIRAL = {
  turns: 5,
  bottom: -0.86,
  top: 0.86,
  r0: 0.07,
  r1: 0.62,
  /** Aion's circle radius (≈ the middle turn's). */
  aion: 0.345,
  /** The turn the red ring holds (0 the lowest). */
  aeon: 2,
  /** Seconds the present moment takes to go once round. */
  period: 7,
  /** Samples per turn. */
  samples: 96,
} as const

/** The rhyme's two variations, and the golden angle that orients them per turn. */
export const RHYME = {
  ellipse: 0.13,
  tilt: 0.1,
  golden: PI * (3 - Math.sqrt(5)),
} as const

/** The base plane and its line, × H. */
export const BASE = { y: -1, rim: 0.72, line: 1.02 } as const
/** The ring round the held aeon, × that turn's radius. */
export const RING = 1.32

/** The lean toward the eye. */
export const LEAN = { p: 0.45, h: -0.4 } as const

const DOT = 0.026
const WORD = 0.068
const QUIET = { r: 0.55, g: 0.55, b: 0.58 }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (u: number) => u * u * (3 - 2 * u)
const lerp = (a: number, b: number, u: number) => a + (b - a) * u

/** How far each form is present at `time` (0 kronos · 1 aion · 2 spiral). */
export const forms = (time: number) => {
  const spiral = smooth(clamp01(time - 1))
  return {
    /** The circle's presence: the radius opens from the line. */
    round: smooth(clamp01(time)),
    /** The helix's: the circle stretches along the axis. */
    spiral,
    /** The height spread: full on the line and in the spiral, none in the circle. */
    rise: time <= 1 ? 1 - smooth(clamp01(time)) : spiral,
  }
}

/** The helix's own radius at turn-parameter s (no rhyme), × H. */
export const turnRadius = (s: number): number => lerp(SPIRAL.r0, SPIRAL.r1, s / SPIRAL.turns)

/**
 * The curve at s ∈ [0, turns] (s counts turns from the bottom), × H, for a
 * `time` and a `rhyme`. Turn k's ellipse and tilt are oriented at
 * k·golden — the angle that never comes back round.
 */
export const spiralPoint = (s: number, time: number, rhyme: number): Vec3Like => {
  const f = forms(time)
  const R = f.round * lerp(SPIRAL.aion, turnRadius(s), f.spiral)
  const y = lerp(0, lerp(SPIRAL.bottom, SPIRAL.top, s / SPIRAL.turns), f.rise)
  const th = 2 * PI * s
  const psi = RHYME.golden * s
  const v = clamp01(rhyme) * f.spiral
  const r = R * (1 + v * RHYME.ellipse * Math.cos(2 * (th - psi)))
  return { x: r * Math.cos(th), y: y + v * RHYME.tilt * R * Math.cos(th - psi), z: r * Math.sin(th) }
}

/** Where the present moment is on the curve at clock `now`: s ∈ [0, turns), and its fade at the two ends. */
export const momentAt = (now: number): { s: number; fade: number } => {
  const T = SPIRAL.turns
  const s = (((now / SPIRAL.period) % T) + T) % T
  return { s, fade: clamp01(Math.min(s / 0.35, (T - s) / 0.35)) }
}

/** The 8-pointed star (four long rays, four short), closed, × its size. */
export const starOutline = (size: number): Vec3Like[] => {
  const pts: Vec3Like[] = []
  for (let i = 0; i <= 16; i++) {
    const a = PI / 2 + (i * PI) / 8
    const r = i % 2 === 1 ? 0.2 : i % 4 === 0 ? 1 : 0.55
    pts.push({ x: size * r * Math.cos(a), y: size * r * Math.sin(a), z: 0 })
  }
  return pts
}

export class TimeSpiral extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** H: the axis's half-length, the symbol's one size. */
  height = length(380)
  /** 0 kronos (a line) · 1 aion (a circle) · 2 spiral (both). */
  time = scalar(2)
  /** 0 mirror (identical turns) … 1 rhyme (each turn its own). */
  rhyme = completion(1)
  /** The words' presence. */
  labels = completion(1)
  /** The present moment's clock, seconds (keeps running in free play). */
  now = scalar(0)

  body!: Group
  axisLine!: Line
  star!: Line
  rim!: Line
  base!: Line
  destiny!: Line
  near!: Polylines
  far!: Polylines
  ring!: Line
  moment!: Circle
  kairos!: Circle
  radius!: Line
  words!: Text[]

  constructor(overrides: Overrides = {}) {
    super(overrides)
  }

  /** The eye the symbol is seen from (`seenFrom`), else the live eye. */
  view?: () => View
  seenFrom(observer: Observer): void {
    this.view = () => viewOf(observer)
  }
  private localView(frame: Holon = this.body): View {
    return localView(frame, this.view?.() ?? liveView() ?? { eye: { x: 0, y: 0, z: 1500 } })
  }
  private viewKey(): number[] {
    const v = this.localView()
    const p = "eye" in v ? v.eye : v.toward
    return [Math.round(p.x * 10), Math.round(p.y * 10), Math.round(p.z * 10), "eye" in v ? 1 : 0]
  }

  /** How far the symbol reaches from its centre: the star. */
  get reach(): number {
    return 1.35 * this.height.value
  }

  protected override compose(): void {
    const H = () => this.height.value
    const f = () => forms(this.time.value)
    const sc = (p: Vec3Like): Vec3Like => ({ x: p.x * H(), y: p.y * H(), z: p.z * H() })

    this.body = this.add(new Group({ p: LEAN.p, h: LEAN.h }))

    /** Turn a holon at point `at` (of `frame`, its parent) to face the eye. */
    const facing = <T extends Holon>(h: T, at: () => Vec3Like, frame: Holon = this.body): T => {
      const turn = () => {
        const v = this.localView(frame)
        const q = at()
        const d = "eye" in v ? [v.eye.x - q.x, v.eye.y - q.y, v.eye.z - q.z] : [v.toward.x, v.toward.y, v.toward.z]
        const l = Math.hypot(d[0]!, d[1]!, d[2]!) || 1
        return facingTurn([d[0]! / l, d[1]! / l, d[2]! / l])
      }
      h.x.follow(derive(() => at().x))
      h.y.follow(derive(() => at().y))
      h.z.follow(derive(() => at().z))
      h.h.follow(derive(() => turn().h))
      h.p.follow(derive(() => turn().p))
      return h
    }

    // THE BASE: Kronos's plane, its rim, and the line from the profound to the profane.
    this.rim = new Line({ tint: QUIET, stroke: 1.4 })
    derivePoints(this.rim, () => [H()], () =>
      Array.from({ length: 129 }, (_, i) => {
        const t = PI + (2 * PI * i) / 128
        return sc({ x: BASE.rim * Math.cos(t), y: BASE.y, z: BASE.rim * Math.sin(t) })
      }),
    )
    this.base = new Line({ tint: WHITE, stroke: 2, arrowStart: true, arrowEnd: true })
    derivePoints(this.base, () => [H()], () => [sc({ x: -BASE.line, y: BASE.y, z: 0 }), sc({ x: BASE.line, y: BASE.y, z: 0 })])

    // THE AXIS: Kronos's arrow, rising from the plane's centre toward the star;
    // in the spiral it is Kairos, the centre every turn comes round.
    this.axisLine = new Line({ tint: WHITE, stroke: 2.2, arrowEnd: true })
    derivePoints(this.axisLine, () => [H()], () => [sc({ x: 0, y: BASE.y, z: 0 }), sc({ x: 0, y: 1.06, z: 0 })])

    // FATE: the star above, pulling.
    this.star = new Line({ tint: WHITE, stroke: 1.6, fillOpacity: 1 })
    derivePoints(this.star, () => [H()], () => starOutline(0.1 * H()))
    facing(this.star, () => sc({ x: 0, y: 1.24, z: 0 }))

    // DESTINY: the arrow from below, pushing (on the profane side, as drawn).
    this.destiny = new Line({ tint: WHITE, stroke: 2, arrowEnd: true })
    derivePoints(this.destiny, () => [H()], () => [sc({ x: 0.9, y: -0.72, z: 0 }), sc({ x: 0.9, y: -0.3, z: 0 })])

    // THE CURVE: near runs bright, far runs dim, grown from the bottom as it draws.
    const runs = () => {
      const T = SPIRAL.turns
      const grow = Math.max(this.near.creation.value, this.far.creation.value)
      const end = T * grow
      const v = this.localView()
      const front = (p: Vec3Like) =>
        "eye" in v ? p.x * (v.eye.x - p.x) + p.z * (v.eye.z - p.z) >= 0 : p.x * v.toward.x + p.z * v.toward.z >= 0
      const near: Vec3Like[][] = []
      const far: Vec3Like[][] = []
      const N = Math.max(2, Math.ceil(end * SPIRAL.samples))
      let run: Vec3Like[] = []
      let side: boolean | undefined
      for (let i = 0; i <= N && end > 0; i++) {
        const p = sc(spiralPoint((end * i) / N, this.time.value, this.rhyme.value))
        const s = front(p)
        if (side !== undefined && s !== side) {
          run.push(p)
          ;(side ? near : far).push(run)
          run = [p]
        } else run.push(p)
        side = s
      }
      if (run.length > 1) (side ? near : far).push(run)
      return { near, far }
    }
    let memo: { key: string; v: ReturnType<typeof runs> } | undefined
    const runsNow = () => {
      const key = [H(), this.time.value, this.rhyme.value, this.near.creation.value, this.far.creation.value, ...this.viewKey()].join("|")
      if (memo?.key !== key) memo = { key, v: runs() }
      return memo.v
    }
    const curveKey = () => [H(), this.time.value, this.rhyme.value, this.near.creation.value, this.far.creation.value, ...this.viewKey()]
    this.near = new Polylines({ tint: WHITE, stroke: 2.4 })
    this.far = new Polylines({ tint: WHITE, stroke: 1.5, opacity: 0.38 })
    deriveLoops(this.near, curveKey, () => runsNow().near)
    deriveLoops(this.far, curveKey, () => runsNow().far)

    // THE AEON: a red ring round one turn (Aion's circle, once it is only a circle).
    const aeonS = SPIRAL.aeon + 0.5
    const ringR = () => RING * lerp(SPIRAL.aion, turnRadius(aeonS), f().spiral)
    const ringY = () => lerp(0, lerp(SPIRAL.bottom, SPIRAL.top, aeonS / SPIRAL.turns), f().rise)
    this.ring = new Line({ tint: RED, stroke: 2, opacity: derive(() => f().round) })
    derivePoints(this.ring, () => [H(), this.time.value], () =>
      Array.from({ length: 129 }, (_, i) => {
        const t = PI + (2 * PI * i) / 128
        return sc({ x: ringR() * Math.cos(t), y: ringY(), z: ringR() * Math.sin(t) })
      }),
    )

    // THE PRESENT MOMENT and its Kairos on the centre, joined by the radius.
    const at = () => {
      const m = momentAt(this.now.value)
      return { ...m, p: sc(spiralPoint(m.s, this.time.value, this.rhyme.value)) }
    }
    const centre = () => ({ x: 0, y: at().p.y, z: 0 })
    const dot = (tint: typeof RED, where: () => Vec3Like, opacity: () => number) => {
      const c = new Circle({ tint, stroke: 0, fillOpacity: 1, opacity: derive(opacity) })
      c.radius.follow(this.height.map(() => DOT * H()))
      return facing(c, where)
    }
    this.radius = new Line({ tint: RED, stroke: 1.2, opacity: derive(() => 0.7 * f().round * at().fade) })
    derivePoints(this.radius, () => [H(), this.time.value, this.rhyme.value, this.now.value], () => [centre(), at().p])
    this.kairos = dot(RED, centre, () => f().round * at().fade)
    this.moment = dot(WHITE, () => at().p, () => at().fade)

    // THE WORDS: sparse, turned to the eye — held outside the lean (at the
    // leaned point), so they stand upright rather than roll with the body.
    const page = this.add(new Group())
    const word = (content: string, where: Vec3Like, shown: () => number = () => 1, tint = WHITE) => {
      const t = new Text({ content, tint, opacity: derive(() => this.labels.value * shown()) })
      t.size.follow(this.height.map(() => WORD * H()))
      return facing(t, () => rotHPB(sc(where), LEAN.p, LEAN.h, 0), page)
    }
    this.words = [
      word("Kronos", { x: 0.2, y: 1.0, z: 0 }),
      word("fate", { x: -0.22, y: 1.21, z: 0 }),
      word("Aion", { x: -(RING * SPIRAL.aion + 0.17), y: -0.03, z: 0 }, () => f().round, RED),
      word("Kairos", { x: 0.17, y: -0.95, z: 0 }, () => f().spiral, RED),
      word("destiny", { x: 0.9, y: -0.2, z: 0 }),
      word("profound", { x: -BASE.line - 0.2, y: -0.98, z: 0 }),
      word("profane", { x: BASE.line + 0.19, y: -1.02, z: 0 }),
    ]

    for (const h of [this.rim, this.base, this.far, this.ring, this.axisLine, this.radius, this.near, this.destiny, this.star, this.kairos, this.moment])
      this.body.attach(h)
    for (const w of this.words) page.attach(w)
  }

  /** The base and the axis draw, the spiral rises out of the plane turn by
   *  turn, the ring closes round its aeon, the star and the words arrive. */
  override createAnim(): Anim {
    void this.parts
    return together(
      restage(Create(this.base), 0, 0.25),
      restage(Create(this.rim), 0.05, 0.35),
      restage(Create(this.axisLine), 0.15, 0.45),
      restage(Create(this.near), 0.3, 0.85),
      restage(Create(this.far), 0.3, 0.85),
      restage(Create(this.ring), 0.7, 0.95),
      restage(Create(this.star), 0.45, 0.6),
      restage(Create(this.destiny), 0.5, 0.7),
      restage(Create(this.kairos), 0.85, 1),
      restage(Create(this.moment), 0.85, 1),
      restage(Create(this.radius), 0.85, 1),
      ...this.words.map((w, i) => restage(Create(w), 0.55 + 0.05 * i, 0.75 + 0.04 * i)),
    )
  }

  /** Walkable: `time` kronos · aion · spiral; `rhyme` mirror ↔ rhyme. `now` is a clock. */
  override stateSpace(): StateSpace | undefined {
    void this.parts
    const axes: Axis[] = []
    if (!this.time.isBound)
      axes.push(axis("time", this, { kronos: { time: 0 }, aion: { time: 1 }, spiral: { time: 2 } }, { duration: 2.6, handles: () => [this.axisLine, this.ring] }))
    if (!this.rhyme.isBound)
      axes.push(toggle("rhyme", this.rhyme, { off: ["mirror", 0], on: ["rhyme", 1], duration: 2.2, handles: () => [this.near, this.far] }))
    if (!axes.length && this.now.isBound) return undefined
    return { axes, clocks: this.now.isBound ? [] : [this.now] }
  }
}
