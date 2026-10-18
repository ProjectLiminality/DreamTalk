/**
 * Dialectic — the freedom-order dialectic as the InterBrain film stages it
 * in chapter 1 (0:56–5:14) and recalls in 3, 4 and 7: the two Attractors
 * facing each other, the Conflict between them, the endless oscillation,
 * and the third axis out of it (docs/reports/interbrain-vocabulary.md §4.1,
 * "Freedom / Order", "The endless oscillation", "The third attractor").
 *
 * WHY A SECOND HOLON, NOT A PARAM OF ATTRACTOR. An Attractor is one pole and
 * is a symbol on its own — Chaos alone in the equations (f601, f976), the
 * censorship square against Chaos (f4786), David's 2024 `ThirdAttractor`
 * face. This is the ARRANGEMENT of two of them with what passes between,
 * and the film reuses the arrangement whole (f346 → f1530; f1741; f4636;
 * f11611). A composition the film repeats is a holon; the poles stay the
 * one implementation, imported.
 *
 * THE STATES — each one number the film scrubs through:
 *
 *   `conflict`  0..1  the bolt between the two values strikes in (f264–f267,
 *                     f346): "complementary qualities become conflicting".
 *   `armed`     0..1  both values become blue triangles (f380 crossfade).
 *   `attack`   −1..1  who attacks whom — the bolt and both triangles turn
 *                     together (f391 → f405 → f420): +1 "freedom becomes an
 *                     attack on order" (freedom's apex up, the bolt pointing
 *                     at order), −1 "order becomes an attack on freedom";
 *                     0 the bolt points down, both apexes right (f405).
 *   `chaos`, `oppression`  0..1  each pole's pathology (Attractor's own,
 *                     promoted): "freedom times fragmentation equals chaos"
 *                     (f496), "order times fragmentation equals oppression" (f530).
 *   `swing`     0..1  the oscillation is there: the glowing ball between the
 *                     poles and the two pulls on it (f660, f1336).
 *   `phase`     angle the ball's place: x = A·sin(phase). "The closer we come
 *                     to chaos, the stronger the impulse for order" (2:09) —
 *                     so the blue arrow toward order is long when the ball is
 *                     near freedom, and the red one long near order.
 *   `trace`     0..1  the sine the ball has written hangs beneath it (f736,
 *                     f781, f1051) — the cycle's history, newest at the ball.
 *   `gaze`      0..1  the domesticated eye (MolochEye, iris 0) under the
 *                     ball (f1306): the fragmented perspective it is seen from.
 *   `third`     0..1  the orthogonal degree of freedom (4:29): the ball
 *                     stills at the centre, a cross of axes appears, the
 *                     founding Cylinder and the liminal eye (MolochEye, iris
 *                     1) above (f1381); an arrow rises to the cylinder
 *                     (f1501) and the ball travels up it into the cylinder
 *                     (f1516, f1530) — "the third attractor of wholeness".
 *
 * MEASURED (1280×720) in units of R = `size`, the circle's radius:
 *   `span`     pole centre to centre of the composition — 3.5R in the
 *              dialectic (f346: ±295 px at R 84.5 px), 5.05R once the third
 *              axis is in view (f1501: ±278 px at R 55 px). A param.
 *   SWING      A = 0.55·span·R; each pull's arrow reaches its pole's near
 *              edge times its weight (f1336: blue 0.85, red 0.25 at s = −0.6)
 *   BALL       a 0.09R dot in the golden glow (glow.ts — the halo IS the look)
 *   TRACE      one period of the sine per 3.5R of hang, 1.5 periods kept
 *   GAZE       eye h = 0.66R (width 4h = 150 px at R 55), centre 1.27R below
 *   CROSS      the axes ±(span − 1.05)R across, 4R up (f1381)
 *   CYLINDER   centre 6.9R up, radius 0.89R, length 2.1R, axis horizontal (f1501)
 *   LIMINAL    the liminal eye's centre 8.7R up, same size as the gaze
 *   ARROW      from the ball to 5.47R up, the cylinder's foot (f1501)
 */

import { Circle, Line, Null, derivePoints } from "../../src/parts/primitives"
import { bipolar, completion, derive, length, scalar } from "../../src/params"
import { BLUE, PI, RED, WHITE, rgb, type Color } from "../../src/constants"
import { clamp01, lerp } from "../../src/math"
import { ease } from "../../src/timeline"
import { restage, together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { axis, type StateSpace } from "../../src/automaton"
import { glow } from "../../src/glow"
import { Layer } from "../Figure/Figure"
import { Conflict } from "../Conflict/Conflict"
import { Cylinder } from "../Cylinder/Cylinder"
import { MolochEye } from "../MolochEye/MolochEye"
import { ATTRACTOR, Attractor } from "./Attractor"

/** The arrangement, in units of R (see header). */
export const DIALECTIC = {
  span: 3.5,
  swing: 0.55,
  ball: 0.09,
  /** The between-bolt's length (f346: 163 px at R 84.5). */
  bolt: 1.93,
  tracePeriod: 3.5,
  traceSpan: 3 * PI,
  eye: 0.66,
  gazeY: -1.27,
  crossUp: 4,
  crossInset: 1.05,
  cylinderY: 6.9,
  cylinderRadius: 0.89,
  cylinderLength: 2.1,
  liminalY: 8.7,
  arrowTip: 5.47,
  /** The cylinder turned about the vertical so its left cap shows (f1501: the cap's ellipse 0.3 of its height). */
  cylinderTurn: -0.32,
} as const

/** The ball's light: warm white (f1501's core). */
const BALL: Color = rgb(255, 246, 220)
/** The trace's grey (f781). */
const TRACE: Color = rgb(150, 150, 150)

/** u in [a, b] → 0..1, smoothed. */
const ramp = (u: number, a: number, b: number): number => ease("smooth", clamp01((u - a) / (b - a)))

/**
 * The third axis's readings at `third` = t: how still the ball is (its swing
 * gone), the cross's presence, the cylinder's and the liminal eye's, the
 * rising arrow's draw-on, and how far up the ball has travelled (0 the line,
 * 1 the cylinder's centre).
 */
export const thirdAt = (t: number) => ({
  still: ramp(t, 0, 0.2),
  cross: ramp(t, 0.05, 0.2) * (1 - ramp(t, 0.35, 0.5)),
  liminal: ramp(t, 0.05, 0.2),
  cylinder: ramp(t, 0.1, 0.35),
  arrow: ramp(t, 0.35, 0.5),
  rise: ramp(t, 0.55, 1),
})

/**
 * The two pulls on the ball at s = x/A ∈ [−1, 1] (−1 beside freedom): the
 * weight of the impulse toward order (blue) and toward freedom (red). The
 * closer to one pole, the stronger the pull to the other (2:09–2:14).
 */
export const pullsAt = (s: number): { order: number; freedom: number } => ({
  order: clamp01((1 - s) / 2),
  freedom: clamp01((1 + s) / 2),
})

/** A Layer that glows (glow.ts — authored, inherited by its members). */
class Glowing extends Layer {
  glow = glow(1)
}

export class Dialectic extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** R — each pole's circle radius; every measure derives from it. */
  size = length(176)
  /** Pole centre distance from the middle, in units of R (3.5 the dialectic, 5.05 with the third axis). */
  span = scalar(DIALECTIC.span)
  /** The bolt between the two values: 0 none … 1 struck. */
  conflict = completion(0)
  /** Both values as triangles (the attack). */
  armed = completion(0)
  /** −1 order attacks freedom … +1 freedom attacks order; 0 the bolt points down. */
  attack = bipolar(0)
  /** Freedom's pathology (Chaos). */
  chaos = completion(0)
  /** Order's pathology (Oppression). */
  oppression = completion(0)
  /** The poles' labels. */
  labels = completion(1)
  /** The oscillation: the ball and its pulls. */
  swing = completion(0)
  /** The ball's place on its cycle: x = A·sin(phase). Advance it linearly and the ball shuttles. */
  phase = scalar(0)
  /** The sine trace beneath the ball. */
  trace = completion(0)
  /** The domesticated eye under the ball. */
  gaze = completion(0)
  /** The third axis: 0 none … 1 the ball inside the cylinder. */
  third = completion(0)
  /** Pen width in screen px. */
  stroke = length(2.3)

  freedom!: Attractor
  order!: Attractor
  bolt!: Conflict
  ball!: Circle
  orb!: Glowing
  toOrder!: Line
  toFreedom!: Line
  pulls!: Layer
  traceLine!: Line
  traceLayer!: Layer
  eye!: MolochEye
  gazeLayer!: Layer
  crossX!: Line
  crossY!: Line
  crossLayer!: Layer
  cylinder!: Cylinder
  cylinderLayer!: Layer
  liminal!: MolochEye
  liminalLayer!: Layer
  arrow!: Line
  arrowLayer!: Layer

  /** R and the span in units. */
  private get R(): number {
    return this.size.value
  }
  private get D(): number {
    return this.span.value * this.size.value
  }
  /** The swing's amplitude. */
  private get A(): number {
    return DIALECTIC.swing * this.D
  }

  /** The ball's place now (local units). */
  ballAt(): { x: number; y: number } {
    const th = thirdAt(this.third.value)
    return {
      x: this.A * Math.sin(this.phase.value) * (1 - th.still),
      y: th.rise * DIALECTIC.cylinderY * this.R,
    }
  }

  protected override compose(): void {
    const R = () => this.R
    const stroke = this.stroke
    const th = () => thirdAt(this.third.value)

    this.freedom = this.add(
      new Attractor({
        kind: "chaos",
        size: derive(R),
        x: derive(() => -this.D),
        pathology: derive(() => this.chaos.value),
        armed: derive(() => this.armed.value),
        // Rest up; at attack 0 it points right, at −1 down (f391 → f405 → f420).
        aim: derive(() => ((this.attack.value - 1) * PI) / 2),
        label: derive(() => this.labels.value),
        stroke,
      }),
    )
    this.order = this.add(
      new Attractor({
        kind: "oppression",
        size: derive(R),
        x: derive(() => this.D),
        pathology: derive(() => this.oppression.value),
        armed: derive(() => this.armed.value),
        aim: derive(() => ((1 - this.attack.value) * PI) / 2),
        label: derive(() => this.labels.value),
        stroke,
      }),
    )

    // The bolt between: points down at rest, at order when freedom attacks.
    this.bolt = this.add(
      new Conflict({
        size: derive(() => DIALECTIC.bolt * R()),
        direction: derive(() => -PI / 2 + (this.attack.value * PI) / 2),
        creation: derive(() => this.conflict.value),
      }),
    )

    // The pulls on the ball: each arrow reaches toward its pole's near edge, weighted.
    const pull = (side: -1 | 1) => () => {
      const b = this.ballAt()
      const s = this.A > 0 ? b.x / this.A : 0
      const w = side > 0 ? pullsAt(s).order : pullsAt(s).freedom
      const edge = side * (this.D - R())
      const start = b.x + side * DIALECTIC.ball * R() * 1.5
      const reach = Math.max(0, (edge - start) * side) * w
      return [
        { x: start, y: b.y, z: 0 },
        { x: start + side * Math.max(reach, 1e-3), y: b.y, z: 0 },
      ]
    }
    const pullKey = () => [this.phase.value, this.third.value, this.size.value, this.span.value]
    this.toOrder = new Line({ tint: BLUE, stroke, arrowEnd: true })
    derivePoints(this.toOrder, pullKey, pull(1))
    this.toFreedom = new Line({ tint: RED, stroke, arrowEnd: true })
    derivePoints(this.toFreedom, pullKey, pull(-1))
    this.pulls = this.add(
      new Layer({ presence: derive(() => this.swing.value * (1 - th().still)), members: [this.toOrder, this.toFreedom] }),
    )

    // The trace: the ball's history, hanging beneath it, newest at the ball.
    this.traceLine = new Line({ tint: TRACE, stroke: derive(() => 0.6 * this.stroke.value) })
    derivePoints(
      this.traceLine,
      () => [this.phase.value, this.size.value, this.span.value],
      () => {
        const ph = this.phase.value
        const hang = Math.min(Math.max(ph, 0), DIALECTIC.traceSpan)
        const n = 96
        const k = (DIALECTIC.tracePeriod * this.R) / (2 * PI)
        const pts = []
        for (let i = 0; i <= n; i++) {
          const u = (hang * i) / n
          pts.push({ x: this.A * Math.sin(ph - u), y: -u * k, z: 0 })
        }
        if (pts.length < 2 || hang <= 0) pts.push({ x: pts[0]!.x, y: -1e-3, z: 0 })
        return pts
      },
    )
    this.traceLayer = this.add(
      new Layer({ presence: derive(() => this.trace.value * (1 - th().still)), members: [this.traceLine] }),
    )

    // The domesticated eye under the ball.
    const eyeH = () => DIALECTIC.eye * R()
    this.eye = new MolochEye({ height: derive(eyeH), y: derive(() => DIALECTIC.gazeY * R()), stroke })
    this.gazeLayer = this.add(new Layer({ presence: derive(() => this.gaze.value), members: [this.eye] }))

    // The third axis: the cross of the two degrees of freedom (f1381).
    this.crossX = new Line({ tint: WHITE, stroke: derive(() => 0.6 * this.stroke.value) })
    derivePoints(
      this.crossX,
      () => [this.size.value, this.span.value],
      () => {
        const w = this.D - DIALECTIC.crossInset * R()
        return [
          { x: -w, y: 0, z: 0 },
          { x: w, y: 0, z: 0 },
        ]
      },
    )
    this.crossY = new Line({ tint: WHITE, stroke: derive(() => 0.6 * this.stroke.value) })
    derivePoints(
      this.crossY,
      () => [this.size.value],
      () => [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: DIALECTIC.crossUp * R(), z: 0 },
      ],
    )
    this.crossLayer = this.add(new Layer({ presence: derive(() => th().cross), members: [this.crossX, this.crossY] }))

    // The founding cylinder, lying along x and turned a little so its left cap shows (f1501).
    // (b lays its axis along x; the layer's h turns it about the vertical —
    // an h on the cylinder itself would only spin it about its own axis.)
    this.cylinder = new Cylinder({
      radius: derive(() => DIALECTIC.cylinderRadius * R()),
      height: derive(() => DIALECTIC.cylinderLength * R()),
      b: PI / 2,
      tint: WHITE,
      stroke,
    })
    this.cylinderLayer = this.add(
      new Layer({
        y: derive(() => DIALECTIC.cylinderY * R()),
        h: DIALECTIC.cylinderTurn,
        presence: derive(() => th().cylinder),
        members: [this.cylinder],
      }),
    )

    // The liminal eye above it.
    this.liminal = new MolochEye({
      height: derive(eyeH),
      y: derive(() => DIALECTIC.liminalY * R()),
      iris: 1,
      stroke,
    })
    this.liminalLayer = this.add(new Layer({ presence: derive(() => th().liminal), members: [this.liminal] }))

    // The arrow up the third axis: drawn from the ball to the cylinder's foot;
    // as the ball rises its tail follows the ball and the tip stays (f1516).
    this.arrow = new Line({ tint: WHITE, stroke: derive(() => 1.6 * this.stroke.value), arrowEnd: true })
    derivePoints(
      this.arrow,
      () => [this.third.value, this.size.value],
      () => {
        const t = th()
        const tip = DIALECTIC.arrowTip * R()
        // Never degenerate: the host builds the arrowhead from the line it
        // first sees (three-host.ts), so an unrevealed arrow is a short stub.
        const tail = Math.min(this.ballAt().y + 0.12 * R(), tip - 0.05 * R())
        return [
          { x: 0, y: tail, z: 0 },
          { x: 0, y: lerp(tail, tip, Math.max(t.arrow, 0.05)), z: 0 },
        ]
      },
    )
    this.arrowLayer = this.add(
      new Layer({
        presence: derive(() => {
          const t = th()
          return t.arrow * (1 - ramp(this.ballAt().y / (DIALECTIC.arrowTip * this.R), 0.85, 1))
        }),
        members: [this.arrow],
      }),
    )

    // The ball, last: it rides over everything, in its golden glow.
    this.ball = new Circle({
      radius: derive(() => DIALECTIC.ball * R()),
      tint: BALL,
      fillOpacity: 1,
      stroke: 0,
      x: derive(() => this.ballAt().x),
      y: derive(() => this.ballAt().y),
    })
    this.orb = this.add(new Glowing({ presence: derive(() => this.swing.value), members: [this.ball] }))
  }

  /** Walkable (src/automaton.ts): the poles' pathologies and the third axis; the phase runs as a clock. */
  override stateSpace(): StateSpace | undefined {
    const axes = []
    if (!this.chaos.isBound) axes.push(axis("chaos", this, { freedom: { chaos: 0 }, chaos: { chaos: 1 } }, { duration: 1.4, handles: [this.freedom] }))
    if (!this.oppression.isBound)
      axes.push(axis("oppression", this, { order: { oppression: 0 }, oppression: { oppression: 1 } }, { duration: 1.4, handles: [this.order] }))
    if (!this.third.isBound) axes.push(axis("third", this, { fragmented: { third: 0 }, whole: { third: 1 } }, { duration: 4, handles: [this] }))
    return { axes, clocks: this.phase.isBound ? [] : [this.phase] }
  }

  /** Freedom draws, then order (f300 → f330); the rest appear as their states show them. */
  override createAnim(): Anim {
    void this.parts
    return together(
      restage(Create(this.freedom), 0, 0.6),
      restage(Create(this.order), 0.4, 1),
      restage(this.cylinder.creation.sequence(0, 1), 0, 1),
    )
  }
}
