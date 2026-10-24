/**
 * Triad — the triangle of the two naive opposites and the one without an
 * opposite (holons/RealTalk, the 2026-10-24 whiteboard: SIGNAL.md §1, and the
 * second drawing that reads the same triangle as the EGO).
 *
 *   HORIZONTAL  two poles at the base, mirror images of each other, acting as
 *               if they were enemies: the hot one, spirit fleeing matter (RED,
 *               light, lowercase good) and the cold one, matter devouring
 *               spirit, rigid and static (BLUE, shadow, lowercase evil).
 *               Under them lowercase life (red) and death (blue) in a
 *               samsaric back-and-forth: the coil drawn under the base.
 *   VERTICAL    capital-L Life, Reality: no opposite — binary, real or not
 *               there at all. The plane below is the gradual stuff.
 *
 * REAL 3D — the reason for the symbol. In a flat drawing horizontal and
 * vertical are interchangeable; in space a horizontal PLANE and a vertical
 * LINE normal to it are not. So the drawing is read as what it is: a 3D
 * figure seen exactly edge-on. `unfold` 0 is the board (every z collapsed to
 * the drawing's plane); 1 opens the third dimension (z × 1) and leans it
 * toward the eye:
 *
 *   the base edge          IS the horizontal plane seen edge-on — it opens
 *                          into the plane's rim, a circle, the base its
 *                          diameter (the two poles opposite on it);
 *   the coil under it      IS a helix round the vertical axis seen edge-on —
 *                          it opens into the wheel turning under the plane,
 *                          red on the hot pole's side, blue on the cold's;
 *   the apex               rises on the plane's normal — the vertical line,
 *                          drawn from the plane's centre, appears.
 *
 * THE TWO READINGS (`reading`): 0 — the apex is Life itself, a white point
 * on the vertical. 1 — the triangle is the ego: an eye opens at its apex
 * (the god that holds good and evil in one — the `Eye`, gazing down into
 * the triangle, its lids a small triangle in the apex), and Life is no longer
 * a corner but the WHOLE that holds the drama: the triangle's circumscribed
 * sphere. One construction carries both: the sphere through the three
 * corners meets the plane exactly in the plane's rim (the rim lies on it),
 * and the coil fits inside it — the whole holds everything.
 *
 * THE DANCE runs on the symbol's own clock (`dance`, seconds): the wheel
 * turns, life and death trading places through it endlessly, each keeping
 * its pole's side. Seen edge-on, the coil scrolls.
 *
 * CONSTRUCTION, in units of ρ = `radius` (the triangle's circumradius = the
 * sphere's radius), the sphere's centre at the origin: the triangle is
 * equilateral, apex (0, ρ, 0), poles (∓ρ√3/2, −ρ/2, 0); the plane y = −ρ/2,
 * its rim radius ρ√3/2 (on the sphere: 3/4 + 1/4 = 1); the coil radius ρ/2,
 * from DANCE.top to DANCE.bottom below the plane, DANCE.turns turns — its
 * lowest ring within the sphere (0.5 ≤ √(1 − 0.84²) = 0.54).
 */

import { Circle, Group, Line, Null, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import type { Observer } from "../../src/dream"
import { liveView, localView, viewOf, type View } from "../../src/geometry/frames"
import { facingTurn } from "../Noosphere/geodesic"
import { completion, derive, length, scalar } from "../../src/params"
import { presence } from "../../src/certainty"
import { restage, together, type Anim } from "../../src/anim"
import { toggle, type StateSpace } from "../../src/automaton"
import type { Overrides } from "../../src/holon"
import { BLUE, PI, RED, WHITE } from "../../src/constants"
import { Create } from "../../src/verbs"
import { Eye } from "../Eye/Eye"

/** The coil under the plane, in units of ρ (see header). */
export const DANCE = {
  radius: 0.5,
  top: -0.58,
  bottom: -0.84,
  turns: 2,
  /** Seconds the wheel takes to turn once. */
  period: 9,
} as const

/** The 3D lean, unfolded: pitched toward the eye, turned a little. */
export const LEAN = { p: 0.42, h: -0.4 } as const

/** The pole's and the apex's dots, × ρ. */
const DOT = 0.034
/** The eye at the apex: its lids' length, × ρ (the Eye's lids are 230 long). */
const EYE = 0.4

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const phase = (v: number, a: number, b: number) => clamp01((v - a) / (b - a))
const smooth = (u: number) => u * u * (3 - 2 * u)
const lerp = (a: number, b: number, u: number) => a + (b - a) * u

const QUIET = { r: 0.55, g: 0.55, b: 0.58 }

/** A holder whose presence fades all it holds. */
class Layer extends Group {
  there = presence(1)
}

export class Triad extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The triangle's circumradius — the sphere's — the symbol's one size. */
  radius = length(400)
  /** 0 the drawing (flat, edge-on) … 1 the 3D figure it is (see header). */
  unfold = completion(0)
  /** 0 Life the apex … 1 the ego: the eye at the apex, Life the whole sphere. */
  reading = completion(0)
  /** The dance's clock, seconds (keeps running in free play). */
  dance = scalar(0)

  body!: Group
  edges!: Line[]
  rim!: Line
  axis!: Line
  sphere!: Line
  life!: Line[]
  death!: Line[]
  hot!: Circle
  cold!: Circle
  apex!: Circle
  eye!: Eye
  seer!: Layer

  constructor(overrides: Overrides = {}) {
    super(overrides)
  }

  /** The eye the symbol is seen from (`seenFrom`), else the live eye. */
  view?: () => View
  seenFrom(observer: Observer): void {
    this.view = () => viewOf(observer)
  }
  /** The eye in the body's frame (the lean included). */
  private localView(): View {
    return localView(this.body, this.view?.() ?? liveView() ?? { eye: { x: 0, y: 0, z: 1500 } })
  }
  private viewKey(): number[] {
    const v = this.localView()
    const p = "eye" in v ? v.eye : v.toward
    return [Math.round(p.x * 100), Math.round(p.y * 100), Math.round(p.z * 100), "eye" in v ? 1 : 0]
  }

  /** How far the symbol reaches from its centre: the sphere. */
  get reach(): number {
    return this.radius.value
  }

  protected override compose(): void {
    const R = () => this.radius.value
    const depth = () => smooth(this.unfold.value)
    const whole = () => smooth(phase(this.reading.value, 0, 0.7))
    const opening = () => smooth(phase(this.reading.value, 0.3, 1))
    // Every point of the figure, its third dimension unfolded by `depth`.
    const at = (x: number, y: number, z: number): Vec3Like => ({ x, y, z: z * depth() })
    const half = () => (R() * Math.sqrt(3)) / 2
    const base = () => -R() / 2
    const live = (...extra: (() => number)[]) => () => [R(), depth(), ...extra.map((f) => f())]

    // The whole leans toward the eye as it unfolds: a rotation of real
    // geometry, so the plane shows its face and the camera may orbit it.
    this.body = this.add(new Group())
    this.body.p.follow(this.unfold.map(() => LEAN.p * depth()))
    this.body.h.follow(this.unfold.map(() => LEAN.h * depth()))

    // THE SPHERE (reading 1): Life as the whole — its outline is the
    // silhouette the eye sees (a circle facing it), exact in perspective.
    this.sphere = new Line({ tint: WHITE, stroke: 2, opacity: derive(() => whole()) })
    derivePoints(this.sphere, () => [...live()(), ...this.viewKey()], () => {
      const v = this.localView()
      const r = R()
      let n: Vec3Like
      let cr = r
      let c = 0
      if ("eye" in v) {
        const d = Math.hypot(v.eye.x, v.eye.y, v.eye.z) || 1
        n = { x: v.eye.x / d, y: v.eye.y / d, z: v.eye.z / d }
        if (d > r) (cr = r * Math.sqrt(1 - (r * r) / (d * d))), (c = (r * r) / d)
      } else n = v.toward
      // Folded, the drawing's plane: the circumcircle itself.
      const k = depth()
      const m = { x: n.x * k, y: n.y * k, z: lerp(1, n.z, k) }
      const ml = Math.hypot(m.x, m.y, m.z) || 1
      const w = { x: m.x / ml, y: m.y / ml, z: m.z / ml }
      cr = lerp(r, cr, k)
      c *= k
      // An orthonormal pair across w.
      const up = Math.abs(w.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }
      let a = { x: up.y * w.z - up.z * w.y, y: up.z * w.x - up.x * w.z, z: up.x * w.y - up.y * w.x }
      const al = Math.hypot(a.x, a.y, a.z) || 1
      a = { x: a.x / al, y: a.y / al, z: a.z / al }
      const b = { x: w.y * a.z - w.z * a.y, y: w.z * a.x - w.x * a.z, z: w.x * a.y - w.y * a.x }
      const N = 160
      const pts: Vec3Like[] = []
      for (let i = 0; i <= N; i++) {
        const t = (2 * PI * i) / N + PI / 2
        const ca = Math.cos(t) * cr
        const sb = Math.sin(t) * cr
        pts.push({ x: w.x * c + a.x * ca + b.x * sb, y: w.y * c + a.y * ca + b.y * sb, z: w.z * c + a.z * ca + b.z * sb })
      }
      return pts
    })

    // THE PLANE's rim: the base edge, opened. Drawn from the hot pole round.
    this.rim = new Line({ tint: QUIET, stroke: 1.6 })
    derivePoints(this.rim, live(), () => {
      const N = 128
      const pts: Vec3Like[] = []
      for (let i = 0; i <= N; i++) {
        const t = PI + (2 * PI * i) / N
        pts.push(at(half() * Math.cos(t), base(), half() * Math.sin(t)))
      }
      return pts
    })

    // THE VERTICAL: from the plane's centre up its normal to the apex —
    // there only once there is a plane for it to be normal to.
    this.axis = new Line({ tint: WHITE, stroke: 1.6, opacity: derive(() => depth()) })
    derivePoints(this.axis, live(), () => [at(0, base(), 0), at(0, R(), 0)])

    // THE TRIANGLE: the base (the horizontal), then the two sides up to the apex.
    const corners = () => ({
      hot: at(-half(), base(), 0),
      cold: at(half(), base(), 0),
      top: at(0, R(), 0),
    })
    const side = (a: "hot" | "cold" | "top", b: "hot" | "cold" | "top") => {
      const l = new Line({ tint: WHITE, stroke: 2.4 })
      derivePoints(l, live(), () => {
        const c = corners()
        return [c[a], c[b]]
      })
      return l
    }
    this.edges = [side("hot", "cold"), side("hot", "top"), side("cold", "top")]

    // THE DANCE: a helix round the vertical under the plane, split where it
    // crosses from one pole's side to the other's — red by the hot pole,
    // blue by the cold. A fixed pool of runs per colour, each derived.
    const turns = DANCE.turns
    const runs = () => {
      const r = DANCE.radius * R()
      const y0 = DANCE.top * R()
      const y1 = DANCE.bottom * R()
      const phi = (2 * PI * this.dance.value) / DANCE.period
      // Breakpoints: where cos θ = 0, θ = 2πs + φ.
      const cuts: number[] = [0]
      const k0 = Math.ceil((phi - PI / 2) / PI)
      for (let k = k0; ; k++) {
        const s = (PI / 2 + k * PI - phi) / (2 * PI)
        if (s >= turns) break
        if (s > 0) cuts.push(s)
      }
      cuts.push(turns)
      const red: Vec3Like[][] = []
      const blue: Vec3Like[][] = []
      for (let i = 0; i + 1 < cuts.length; i++) {
        const a = cuts[i]!
        const b = cuts[i + 1]!
        if (b - a < 1e-6) continue
        const steps = Math.max(2, Math.ceil((b - a) * 72))
        const pts: Vec3Like[] = []
        for (let j = 0; j <= steps; j++) {
          const s = lerp(a, b, j / steps)
          const th = 2 * PI * s + phi
          pts.push(at(r * Math.cos(th), lerp(y0, y1, s / turns), -r * Math.sin(th)))
        }
        const mid = Math.cos(2 * PI * ((a + b) / 2) + phi)
        ;(mid < 0 ? red : blue).push(pts)
      }
      return { red, blue }
    }
    let memo: { key: string; v: ReturnType<typeof runs> } | undefined
    const runsNow = () => {
      const key = `${R()}|${depth()}|${this.dance.value}`
      if (memo?.key !== key) memo = { key, v: runs() }
      return memo.v
    }
    const pool = (which: "red" | "blue") =>
      Array.from({ length: 2 * turns + 1 }, (_, i) => {
        const l = new Line({ tint: which === "red" ? RED : BLUE, stroke: 2 })
        derivePoints(l, live(() => this.dance.value), () => runsNow()[which][i] ?? [])
        return l
      })
    this.life = pool("red")
    this.death = pool("blue")

    // THE POLES and THE APEX: dots that face the eye wherever it stands
    // (a disc in 3D: from the side it would be a sliver).
    const dot = (tint: typeof RED, where: () => Vec3Like, opacity?: () => number) => {
      const c = new Circle({ tint, stroke: 0, fillOpacity: 1, opacity: opacity ? derive(opacity) : 1 })
      c.radius.follow(this.radius.map(() => DOT * R()))
      c.x.follow(this.unfold.map(() => where().x))
      c.y.follow(this.unfold.map(() => where().y))
      c.z.follow(this.unfold.map(() => where().z))
      const turn = () => {
        const v = this.localView()
        const p = where()
        const d = "eye" in v ? [v.eye.x - p.x, v.eye.y - p.y, v.eye.z - p.z] : [v.toward.x, v.toward.y, v.toward.z]
        const l = Math.hypot(d[0]!, d[1]!, d[2]!) || 1
        return facingTurn([d[0]! / l, d[1]! / l, d[2]! / l])
      }
      c.h.follow(this.unfold.map(() => turn().h))
      c.p.follow(this.unfold.map(() => turn().p))
      return c
    }
    this.hot = dot(RED, () => corners().hot)
    this.cold = dot(BLUE, () => corners().cold)
    this.apex = dot(WHITE, () => corners().top, () => 1 - whole())

    // THE EYE at the apex (reading 1): the sovereign Eye, gazing down into
    // the triangle, its lids nesting in the apex; it opens with the reading.
    const s = (EYE * 300) / 230
    this.eye = new Eye({ tint: WHITE, stroke: 2, b: -PI / 2, opening: derive(() => opening()) })
    this.eye.scale.follow(this.radius.map(() => (s * R()) / 300))
    this.eye.y.follow(this.radius.map(() => R()))
    this.seer = new Layer({ members: [this.eye] })
    this.seer.there.follow(this.reading.map(() => smooth(phase(this.reading.value, 0.15, 0.6))))

    this.body.attach(this.sphere)
    this.body.attach(this.rim)
    for (const l of [...this.life, ...this.death]) this.body.attach(l)
    this.body.attach(this.axis)
    for (const e of this.edges) this.body.attach(e)
    this.body.attach(this.seer)
    for (const d of [this.hot, this.cold, this.apex]) this.body.attach(d)
  }

  /** The triangle draws (base first, then up both sides to the apex), the
   *  poles and the apex land, the coil and the plane's rim draw under it,
   *  then the vertical and the sphere where they are shown. */
  override createAnim(): Anim {
    void this.parts
    const [baseEdge, left, right] = this.edges
    return together(
      restage(Create(baseEdge!), 0, 0.35),
      restage(Create(left!), 0.25, 0.6),
      restage(Create(right!), 0.25, 0.6),
      restage(Create(this.hot), 0.15, 0.4),
      restage(Create(this.cold), 0.15, 0.4),
      restage(Create(this.apex), 0.5, 0.7),
      restage(Create(this.rim), 0.45, 0.9),
      ...[...this.life, ...this.death].map((l) => restage(Create(l), 0.55, 1)),
      restage(Create(this.axis), 0.6, 0.9),
      restage(Create(this.sphere), 0.6, 1),
      restage(Create(this.eye), 0.7, 1),
    )
  }

  /** Walkable: `u` opens the drawing into 3D and folds it back; `w` reads
   *  the triangle as the ego, Life as the whole. The dance is a clock. */
  override stateSpace(): StateSpace | undefined {
    void this.parts
    const axes = []
    if (!this.unfold.isBound)
      axes.push(toggle("unfold", this.unfold, { key: "u", off: ["drawn", 0], on: ["3D", 1], duration: 2.4, handles: () => [...this.edges, this.rim] }))
    if (!this.reading.isBound)
      axes.push(toggle("reading", this.reading, { key: "w", off: ["apex", 0], on: ["whole", 1], duration: 2.2, handles: () => [this.apex, this.eye, this.sphere] }))
    return { axes, clocks: this.dance.isBound ? [] : [this.dance] }
  }
}
