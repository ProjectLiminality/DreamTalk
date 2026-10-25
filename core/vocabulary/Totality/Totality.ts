/**
 * Totality — horizontality, verticality and totality.
 *
 *   HORIZONTALITY  the horizontal axis (x), white.
 *   VERTICALITY    the vertical axis (y), white.
 *   TOTALITY       their intersection, which is orthogonal to both: the
 *                  third axis (z, red), the line one looks THROUGH the cross
 *                  along. Verticality ends in totality (the vertical meets
 *                  the horizontal there) but does not lead there: totality
 *                  is not further up, it is the other direction.
 *
 * `through` 0 is the cross face-on, flat: x and y. Toward 1 the figure
 * turns to show what the flat cross hid — the third axis growing back from
 * the intersection, and down it the icons: the cross repeating, smaller and
 * smaller, receding — then turns back face-on and comes toward the eye
 * until the eye stands in the intersection and looks down the line. There,
 * the icons are a self-similar tunnel: each the cross inside its ring (the
 * circle through its four tips), each a turn of an eighth from the one
 * before, so the arms of the + and the × alternate and the rings nest
 * toward one vanishing point. Finite (TUNNEL.levels icons) but reading as
 * endless: on the symbol's own clock (`fall`) every icon slides one level
 * deeper per TUNNEL.period, turning its eighth as it goes, and a new one
 * opens out of the cross — the same picture again, endlessly.
 *
 * CONSTRUCTION (a = `size`, the arm): icon k (continuous, k + the clock's
 * fraction) is the cross scaled q^k about the vanishing point (0, 0, −L),
 * L = TUNNEL.depth · a — so it stands at z = −L(1 − q^k), arm a·q^k,
 * turned k·π/4 about z: one similarity maps the tunnel onto itself, which
 * is why the flow loops seamlessly.
 *
 * THE SECOND READING (`plane`): horizontality as a plane, verticality as
 * the line normal to it. The horizontal bar is the plane seen edge-on: it
 * opens into a disc (its rim, radius a) as the figure leans toward the eye,
 * and the vertical stands on its centre, normal to it. Walkable only from
 * the flat cross, as `through` is (one third dimension at a time).
 */

import { Circle, Group, Line, Null, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import type { Observer } from "../../src/dream"
import { liveView, localView, viewOf, type View } from "../../src/geometry/frames"
import { completion, derive, length, scalar } from "../../src/params"
import { presence } from "../../src/certainty"
import { restage, together, type Anim } from "../../src/anim"
import { toggle, type StateSpace } from "../../src/automaton"
import type { Overrides } from "../../src/holon"
import { PI, RED, WHITE } from "../../src/constants"
import { Create } from "../../src/verbs"

/** The tunnel, in units of the arm a (see header). */
export const TUNNEL = {
  /** Icons drawn down the line. */
  levels: 14,
  /** Each icon's scale against the one before. */
  q: 0.64,
  /** The vanishing point's depth behind the cross, × a. */
  depth: 3,
  /** The turn from one icon to the next. */
  turn: PI / 4,
  /** Seconds an icon takes to slide one level deeper. */
  period: 4,
} as const

/** The turn that shows the third axis (mid-`through`), and how close the eye comes. */
export const TURN = { h: 0.85, p: -0.32, approach: 0.62 } as const
/** The lean that shows the plane (`plane` 1). */
export const LEAN = { p: 0.45 } as const

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const phase = (v: number, a: number, b: number) => clamp01((v - a) / (b - a))
const smooth = (u: number) => u * u * (3 - 2 * u)

/** A holder whose presence fades all it holds. */
class Layer extends Group {
  there = presence(1)
}

/** Icon k's place in the tunnel: its depth, arm and turn, for an arm `a`. */
export const icon = (k: number, a: number): { z: number; arm: number; turn: number } => {
  const s = Math.pow(TUNNEL.q, k)
  return { z: -TUNNEL.depth * a * (1 - s), arm: a * s, turn: k * TUNNEL.turn }
}

export class Totality extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The arm: half the cross's span, the symbol's one size. */
  size = length(300)
  /** 0 the flat cross … 1 the eye in the intersection, looking down the third axis. */
  through = completion(0)
  /** 0 the bar … 1 horizontality as a plane, verticality its normal. */
  plane = completion(0)
  /** The tunnel's clock, seconds (keeps running in free play). */
  fall = scalar(0)

  body!: Group
  horizontal!: Line
  vertical!: Line
  axis!: Line
  icons!: Layer[]

  constructor(overrides: Overrides = {}) {
    super(overrides)
  }

  /** The eye the symbol is seen from (`seenFrom`), else the live eye. */
  view?: () => View
  seenFrom(observer: Observer): void {
    this.view = () => viewOf(observer)
  }

  /** How far the symbol reaches from its centre: the arm. */
  get reach(): number {
    return this.size.value
  }

  protected override compose(): void {
    const a = () => this.size.value
    const thr = () => smooth(this.through.value)
    // The turn rises and falls: face-on at both ends, the third axis shown between.
    const bump = () => Math.sin(PI * thr())
    const lean = () => smooth(this.plane.value)
    // The third axis and its icons come out of the intersection in the first half.
    const spread = () => smooth(phase(this.through.value, 0, 0.5))
    const reveal = () => smooth(phase(this.through.value, 0.08, 0.45))
    // How far the eye stands from the symbol (perspective), for the approach.
    const eyeDistance = () => {
      const v = localView(this, this.view?.() ?? liveView() ?? { eye: { x: 0, y: 0, z: 1500 } })
      return "eye" in v ? Math.hypot(v.eye.x, v.eye.y, v.eye.z) : 0
    }

    this.body = this.add(new Group())
    this.body.h.follow(this.through.map(() => TURN.h * bump()))
    this.body.p.follow(this.through.map(() => TURN.p * bump() + LEAN.p * lean()))
    this.body.z.follow(this.through.map(() => TURN.approach * eyeDistance() * thr()))

    // HORIZONTALITY: the bar — the plane's rim seen edge-on, opened by `plane`.
    this.horizontal = new Line({ tint: WHITE, stroke: 2.6 })
    derivePoints(this.horizontal, () => [a(), lean()], () => {
      const N = lean() > 0 ? 128 : 1
      if (N === 1) return [{ x: -a(), y: 0, z: 0 }, { x: a(), y: 0, z: 0 }]
      const pts: Vec3Like[] = []
      for (let i = 0; i <= N; i++) {
        const t = PI + (2 * PI * i) / N
        pts.push({ x: a() * Math.cos(t), y: 0, z: a() * Math.sin(t) * lean() })
      }
      return pts
    })
    // VERTICALITY: the vertical, through the intersection.
    this.vertical = new Line({ tint: WHITE, stroke: 2.6 })
    derivePoints(this.vertical, () => [a()], () => [{ x: 0, y: -a(), z: 0 }, { x: 0, y: a(), z: 0 }])
    // TOTALITY: the third axis, from the intersection back to the vanishing point.
    this.axis = new Line({ tint: RED, stroke: 2.6, opacity: derive(() => reveal()) })
    derivePoints(this.axis, () => [a(), spread()], () => [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -TUNNEL.depth * a() * spread() }])

    // THE ICONS: a fixed pool, each a unit cross in its unit ring, carried
    // down the line by its transform alone (no geometry rebuilt per frame).
    const level = (i: number) => {
      const k = () => i + ((this.fall.value / TUNNEL.period) % 1 + 1) % 1
      const arms = [
        new Line({ tint: WHITE, stroke: 1.8, points: [{ x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] }),
        new Line({ tint: WHITE, stroke: 1.8, points: [{ x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 }] }),
      ]
      const ring = new Circle({ tint: WHITE, stroke: 1.4, radius: 1, opacity: 0.7 })
      const l = new Layer({ members: [...arms, ring] })
      const at = () => icon(k(), a())
      l.z.follow(this.fall.map(() => at().z * spread()))
      l.scale.follow(this.fall.map(() => at().arm))
      l.b.follow(this.fall.map(() => at().turn))
      // Opening out of the cross (the first level), thinning with depth, there once revealed.
      l.there.follow(this.fall.map(() => reveal() * smooth(Math.min(1, k())) * Math.pow(0.86, k())))
      return l
    }
    this.icons = Array.from({ length: TUNNEL.levels }, (_, i) => level(i))

    for (const l of this.icons) this.body.attach(l)
    this.body.attach(this.axis)
    this.body.attach(this.horizontal)
    this.body.attach(this.vertical)
  }

  /** The horizontal draws out from the centre's left, then the vertical; the
   *  third axis and its icons where they are shown. */
  override createAnim(): Anim {
    void this.parts
    return together(
      restage(Create(this.horizontal), 0, 0.55),
      restage(Create(this.vertical), 0.4, 0.95),
      restage(Create(this.axis), 0.6, 1),
    )
  }

  /** Walkable: `t` looks through the cross down the third axis and back;
   *  `p` opens the bar into the plane. Each from the flat cross only. The
   *  tunnel's flow is a clock. */
  override stateSpace(): StateSpace | undefined {
    void this.parts
    const axes = []
    if (!this.through.isBound)
      axes.push(toggle("through", this.through, { key: "t", off: ["cross", 0], on: ["through", 1], duration: 4, escape: "cross", handles: () => [this.horizontal, this.vertical], when: () => this.plane.value < 0.01 }))
    if (!this.plane.isBound)
      axes.push(toggle("plane", this.plane, { key: "p", off: ["bar", 0], on: ["plane", 1], duration: 2.2, handles: () => [this.horizontal], when: () => this.through.value < 0.01 }))
    return { axes, clocks: this.fall.isBound ? [] : [this.fall] }
  }
}
