/**
 * SixPaths — the six paths of deepening one's relationship with reality
 * (Forrest Landry, Immanent Metaphysics). Three pairs, each a PERCEPTION and
 * its EXPRESSION:
 *
 *   CAUSAL        Science (the mapping of causal process)
 *                 · Technology (the application of that mapping)
 *   TRANS-CAUSAL  Mysticism (perception of the trans-causal)
 *                 · Magic (its expression) — the conjugate of the causal pair
 *   IMMANENT      Spirituality (the integration of the world into the self)
 *                 · Religion (the integration of the self into the world)
 *                 — the core between the two outer branches
 *
 * THE FIGURE is a regular octahedron: three mutually orthogonal axes through
 * one centre, a pair on each, its perception at one end and its expression
 * at the other. The immanent pair stands on the VERTICAL (Spirituality
 * above, Religion below); the two outer branches lie on the HORIZONTAL plane
 * (Science · Technology on x, Mysticism · Magic on z), the conjugates a
 * quarter turn apart. The three perceptions are then one face of the
 * octahedron and the three expressions the opposite face: two parallel
 * triangles. Looked at down the line joining their centres (`view` 1) they
 * are the HEXAGRAM — perception the rising triangle (its apex Spirituality),
 * expression the descending one (its apex Religion), each pair's axis a
 * diameter of the star. Nothing is projected flat: it is the solid, turned.
 *
 * THE FLOW (`time`, a clock): chevrons run along every half-axis — inward on
 * the perceptions (the world taken in toward the centre), outward on the
 * expressions (the centre given back to the world).
 *
 * THE STATES, each one number so it scrubs and the automaton walks it:
 *   `mode`   0 PERCEPTION … ½ the whole circulation … 1 EXPRESSION: which
 *            half of the flow runs, and which triangle (and which names) is lit.
 *   `focus`  0 all · 1 causal · 2 trans-causal · 3 immanent: one pair lit,
 *            the others dimmed (between two, the light passes over).
 *   `view`   0 upright (the horizontal plane seen from a little above) …
 *            1 the hexagram (the perception face turned to the eye).
 *
 * COLOUR, one per pair: the causal BLUE (the cool, objective branch), the
 * trans-causal RED (the warm one), the immanent WHITE (the vertical, as in
 * Triad). A perception's vertex is a RING (it receives), an expression's a
 * filled DISC (it gives).
 *
 * CONSTRUCTION, in units of ρ = `radius` (the octahedron's circumradius):
 * vertices at ±ρ on each axis; the turn is yaw then pitch, at `view` 1 the
 * yaw −π/4 and pitch atan(1/√2) that bring (1, 1, 1)/√3 onto the eye's axis.
 * Every line of one kind is one Polylines; all of it is a pure function of
 * (time, mode, focus, view, the eye), memoised per frame.
 */

import { Circle, Group, Line, Null, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { Polylines, deriveLoops } from "../../src/parts/polylines"
import { Text } from "../../src/parts/text"
import { angle, completion, derive, length, scalar } from "../../src/params"
import { BLUE, RED, WHITE } from "../../src/constants"
import { restage, together, type Anim } from "../../src/anim"
import { axis, toggle, type Axis, type StateSpace } from "../../src/automaton"
import type { Observer } from "../../src/dream"
import type { Overrides } from "../../src/holon"
import { Create } from "../../src/verbs"
import { liveView, localView, viewOf, type View } from "../../src/geometry/frames"
import { facingTurn } from "../Noosphere/geodesic"

/** The three pairs: their axis (unit, the perception's end), names and tint. */
export const PAIRS = [
  { id: "causal", axis: { x: 1, y: 0, z: 0 }, perception: "Science", expression: "Technology", tint: BLUE },
  { id: "trans-causal", axis: { x: 0, y: 0, z: 1 }, perception: "Mysticism", expression: "Magic", tint: RED },
  { id: "immanent", axis: { x: 0, y: 1, z: 0 }, perception: "Spirituality", expression: "Religion", tint: WHITE },
] as const

/** The construction, × ρ. */
export const PATHS = {
  /** The names: their gap from the vertex, their size, a glyph's mean advance (× size). */
  gap: 0.07,
  type: 0.1,
  glyph: 0.46,
  /** The vertices' discs and rings. */
  vertex: 0.045,
  /** The centre's disc. */
  centre: 0.03,
  /** A chevron's arm, and its half-angle. */
  head: 0.07,
  spread: 0.55,
  /** Chevrons on each half-axis at once. */
  chevrons: 3,
  /** Half-axis lengths per second. */
  speed: 0.22,
  /** Where along a half-axis a chevron fades in and out. */
  fade: 0.18,
  /** Upright: yaw and pitch. Hexagram: yaw −π/4, pitch atan(1/√2). */
  upright: { yaw: -Math.PI / 4 - 0.42, pitch: 0.3 },
  hexagram: { yaw: -Math.PI / 4, pitch: Math.atan(1 / Math.SQRT2) },
} as const

const QUIET = { r: 0.5, g: 0.5, b: 0.53 }
/** A pair out of focus keeps this share of its light. */
const DIM = 0.1

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (u: number) => u * u * (3 - 2 * u)
const ramp = (v: number, a: number, b: number) => smooth(clamp01((v - a) / (b - a)))
const lerp = (a: number, b: number, u: number) => a + (b - a) * u
const frac = (v: number) => v - Math.floor(v)
const scale = (p: Vec3Like, k: number): Vec3Like => ({ x: p.x * k, y: p.y * k, z: p.z * k })

/** The figure's turn at a `view`: yaw about the vertical, then pitch toward the eye. */
export const turnAt = (view: number): { yaw: number; pitch: number } => {
  const u = smooth(clamp01(view))
  return { yaw: lerp(PATHS.upright.yaw, PATHS.hexagram.yaw, u), pitch: lerp(PATHS.upright.pitch, PATHS.hexagram.pitch, u) }
}
/** Turn a point of the figure (yaw, then pitch; +pitch tips the top toward the eye). */
export const orient = (p: Vec3Like, yaw: number, pitch: number): Vec3Like => {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const x = p.x * cy + p.z * sy
  const z = -p.x * sy + p.z * cy
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  return { x, y: p.y * cp - z * sp, z: p.y * sp + z * cp }
}

/** How lit each half of the flow is at a `mode`: perception, expression. */
export const modeWeights = (mode: number): { perception: number; expression: number } => ({
  perception: clamp01(2 - 2 * mode),
  expression: clamp01(2 * mode),
})
/** How lit pair i (0 causal, 1 trans-causal, 2 immanent) is at a `focus`. */
export const pairWeight = (focus: number, i: number): number => {
  const all = clamp01(1 - focus)
  const on = clamp01(1 - Math.abs(focus - (i + 1)))
  return DIM + (1 - DIM) * Math.max(all, on)
}

/** The six vertices, unit: [pair][0 perception, 1 expression]. */
export const vertexOf = (pair: number, expression: boolean): Vec3Like => scale(PAIRS[pair]!.axis, expression ? -1 : 1)

type Bins = { loops: Vec3Like[][]; op: number[] }[]

export class SixPaths extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The octahedron's circumradius — the symbol's one size. */
  radius = length(300)

  // --- the states -----------------------------------------------------------
  /** 0 perception … ½ the circulation … 1 expression. */
  mode = completion(0.5)
  /** 0 all · 1 causal · 2 trans-causal · 3 immanent. */
  focus = scalar(0)
  /** 0 upright … 1 the hexagram. */
  view = completion(0)

  // --- motion and look ------------------------------------------------------
  /** Scene seconds: the flow's clock (runs in free play). */
  time = scalar(0)
  /** A further turn about the vertical, added to the view's own. */
  spin = angle(0)
  arrowStroke = length(2.4)
  axisStroke = length(1.3)
  edgeStroke = length(1.6)

  body!: Group
  axes!: Line[]
  perceptionFace!: Polylines
  expressionFace!: Polylines
  band!: Polylines
  arrows!: Polylines[]
  vertices!: Circle[]
  centre!: Circle
  labels!: Text[]
  words!: Group

  constructor(overrides: Overrides = {}) {
    super(overrides)
  }

  /** The eye the symbol is seen from (`seenFrom`), else the live or default eye. */
  eye?: () => View
  seenFrom(observer: Observer): void {
    this.eye = () => viewOf(observer)
  }
  /** The eye in the body's frame. */
  bodyView(): View {
    return localView(this.body, this.eye?.() ?? liveView() ?? { eye: { x: 0, y: 0, z: 1500 } })
  }

  /** How far the symbol reaches from its centre (its labels). */
  get reach(): number {
    return this.radius.value * (1 + PATHS.gap + PATHS.type * 4)
  }

  /** A unit point of the figure, turned and scaled, in the body's frame. */
  at(p: Vec3Like): Vec3Like {
    const { yaw, pitch } = turnAt(this.view.value)
    return scale(orient(p, yaw + this.spin.value, pitch), this.radius.value)
  }

  protected override compose(): void {
    const R = () => this.radius.value
    const N = PAIRS.length
    this.body = this.add(new Group())
    const bodyAdd = <T extends Null>(h: T) => (this.body.attach(h), h)

    const eyeKey = () => {
      const v = this.bodyView()
      const e = "eye" in v ? v.eye : v.toward
      return `${"eye" in v ? "p" : "o"}${e.x.toFixed(2)},${e.y.toFixed(2)},${e.z.toFixed(2)}`
    }
    /** The unit direction from p toward the eye (body frame). */
    const toEye = (p: Vec3Like): Vec3Like => {
      const v = this.bodyView()
      const d = "eye" in v ? { x: v.eye.x - p.x, y: v.eye.y - p.y, z: v.eye.z - p.z } : v.toward
      const l = Math.hypot(d.x, d.y, d.z) || 1
      return { x: d.x / l, y: d.y / l, z: d.z / l }
    }
    const shapeKey = () => [R(), this.view.value, this.spin.value]

    // THE THREE AXES: one per pair, perception's end to expression's.
    this.axes = PAIRS.map((pair, i) => {
      const l = bodyAdd(new Line({ tint: pair.tint, stroke: this.axisStroke }))
      l.opacity.follow(derive(() => 0.45 * pairWeight(this.focus.value, i)))
      derivePoints(l, shapeKey, () => [this.at(vertexOf(i, false)), this.at(vertexOf(i, true))])
      return l
    })

    // THE OCTAHEDRON: the perception face, the expression face, and the
    // band of six edges between them.
    const face = (expression: boolean) => {
      const f = bodyAdd(new Polylines({ tint: WHITE, stroke: this.edgeStroke }))
      f.opacity.follow(
        derive(() => {
          const w = modeWeights(this.mode.value)
          return 0.12 + 0.48 * (expression ? w.expression : w.perception)
        }),
      )
      deriveLoops(f, shapeKey, () => {
        const vs = [0, 1, 2, 0].map((i) => this.at(vertexOf(i, expression)))
        return [vs]
      })
      return f
    }
    this.perceptionFace = face(false)
    this.expressionFace = face(true)
    this.band = bodyAdd(new Polylines({ tint: QUIET, stroke: derive(() => this.edgeStroke.value * 0.6), opacity: 0.4 }))
    deriveLoops(this.band, shapeKey, () => {
      const loops: Vec3Like[][] = []
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j) loops.push([this.at(vertexOf(i, false)), this.at(vertexOf(j, true))])
      return loops
    })

    // THE FLOW: chevrons on every half-axis, inward on the perceptions,
    // outward on the expressions; one Polylines per pair.
    let memo: { key: string; v: Bins } | undefined
    const flowNow = (): Bins => {
      const key = `${R()},${this.view.value},${this.spin.value},${this.mode.value},${this.focus.value},${this.time.value},${eyeKey()}`
      if (memo?.key === key) return memo.v
      const bins: Bins = PAIRS.map(() => ({ loops: [], op: [] }))
      const w = modeWeights(this.mode.value)
      const K = PATHS.chevrons
      const flow = this.time.value * PATHS.speed
      const h = PATHS.head * R()
      for (let i = 0; i < N; i++) {
        const pw = pairWeight(this.focus.value, i)
        for (const expression of [false, true]) {
          const gain = (expression ? w.expression : w.perception) * pw
          if (gain < 0.004) continue
          const end = this.at(vertexOf(i, expression))
          for (let k = 0; k < K; k++) {
            // s: the tip's distance from the centre, 0 … 1 (inward for a perception).
            const run = frac(flow + k / K)
            const s = expression ? run : 1 - run
            const env = ramp(run, 0, PATHS.fade) * (1 - ramp(run, 1 - PATHS.fade, 1))
            const op = gain * env
            if (op < 0.004) continue
            const tip = scale(end, s)
            // The way it travels, and the arms' plane turned to the eye.
            const l = Math.hypot(end.x, end.y, end.z) || 1
            const d = scale(end, (expression ? 1 : -1) / l)
            const e = toEye(tip)
            let n = { x: d.y * e.z - d.z * e.y, y: d.z * e.x - d.x * e.z, z: d.x * e.y - d.y * e.x }
            const nl = Math.hypot(n.x, n.y, n.z)
            if (nl < 0.05) continue // the axis points at the eye: a chevron would be a dot
            n = scale(n, 1 / nl)
            const ca = Math.cos(PATHS.spread) * h
            const sa = Math.sin(PATHS.spread) * h
            const arm = (sign: number): Vec3Like => ({
              x: tip.x - d.x * ca + sign * n.x * sa,
              y: tip.y - d.y * ca + sign * n.y * sa,
              z: tip.z - d.z * ca + sign * n.z * sa,
            })
            bins[i]!.loops.push([arm(1), tip, arm(-1)])
            bins[i]!.op.push(op)
          }
        }
      }
      memo = { key, v: bins }
      return bins
    }
    const flowKey = () => [R(), this.view.value, this.spin.value, this.mode.value, this.focus.value, this.time.value, eyeKey()]
    this.arrows = PAIRS.map((pair, i) => {
      const p = bodyAdd(new Polylines({ tint: pair.tint, stroke: this.arrowStroke, loopOpacity: () => flowNow()[i]!.op }))
      deriveLoops(p, flowKey, () => flowNow()[i]!.loops)
      return p
    })

    // THE VERTICES: a ring where a pair perceives, a disc where it expresses,
    // each turned to the eye.
    const facing = (h: Null, where: () => Vec3Like) => {
      const turn = () => {
        const e = toEye(where())
        return facingTurn([e.x, e.y, e.z])
      }
      h.x.follow(derive(() => where().x))
      h.y.follow(derive(() => where().y))
      h.z.follow(derive(() => where().z))
      h.h.follow(derive(() => turn().h))
      h.p.follow(derive(() => turn().p))
    }
    const lit = (i: number, expression: boolean) => () => {
      const w = modeWeights(this.mode.value)
      return pairWeight(this.focus.value, i) * (0.35 + 0.65 * (expression ? w.expression : w.perception))
    }
    this.vertices = []
    for (let i = 0; i < N; i++)
      for (const expression of [false, true]) {
        const c = bodyAdd(
          new Circle({
            radius: derive(() => PATHS.vertex * R()),
            tint: PAIRS[i]!.tint,
            stroke: expression ? 0 : 2,
            fillOpacity: expression ? 1 : 0,
            opacity: derive(lit(i, expression)),
          }),
        )
        facing(c, () => this.at(vertexOf(i, expression)))
        this.vertices.push(c)
      }
    this.centre = bodyAdd(new Circle({ radius: derive(() => PATHS.centre * R()), tint: WHITE, stroke: 0, fillOpacity: 1 }))
    facing(this.centre, () => ({ x: 0, y: 0, z: 0 }))

    // THE NAMES, beyond their vertices — pushed out from the centre as the
    // eye sees it, by the gap plus the word's own half-extent that way.
    this.labels = []
    const holders: Group[] = []
    const size = () => PATHS.type * R()
    const beyond = (v: Vec3Like, chars: number): Vec3Like => {
      const p = this.at(v)
      const e = toEye(p)
      const along = p.x * e.x + p.y * e.y + p.z * e.z
      let r = { x: p.x - along * e.x, y: p.y - along * e.y, z: p.z - along * e.z }
      const rl = Math.hypot(r.x, r.y, r.z)
      r = rl > 1e-6 ? scale(r, 1 / rl) : { x: 0, y: 1, z: 0 }
      // The eye's own right and up, to measure the word's box along r.
      let right = { x: e.z, y: 0, z: -e.x }
      right = scale(right, 1 / (Math.hypot(right.x, right.z) || 1))
      const up = { x: e.y * right.z - e.z * right.y, y: e.z * right.x - e.x * right.z, z: e.x * right.y - e.y * right.x }
      const ux = Math.abs(r.x * right.x + r.y * right.y + r.z * right.z)
      const uy = Math.abs(r.x * up.x + r.y * up.y + r.z * up.z)
      const halfW = (PATHS.glyph * chars * size()) / 2
      const halfH = 0.42 * size()
      const reach = Math.min(ux > 1e-3 ? halfW / ux : Infinity, uy > 1e-3 ? halfH / uy : Infinity)
      const d = PATHS.gap * R() + reach
      return { x: p.x + r.x * d, y: p.y + r.y * d, z: p.z + r.z * d }
    }
    for (let i = 0; i < N; i++)
      for (const expression of [false, true]) {
        const pair = PAIRS[i]!
        const content = expression ? pair.expression : pair.perception
        const t = new Text({
          content,
          font: "Times-Roman",
          size: derive(size),
          tint: pair.tint,
          y: derive(() => -0.35 * size()),
          opacity: derive(lit(i, expression)),
        })
        const g = new Group({ members: [t] })
        facing(g, () => beyond(vertexOf(i, expression), content.length))
        holders.push(g)
        this.labels.push(t)
      }
    this.words = bodyAdd(new Group({ members: holders }))
  }

  /** The three axes draw out from the centre, the two faces and the band
   *  between them, the vertices land, the names write, the flow begins. */
  override createAnim(): Anim {
    void this.parts
    return together(
      restage(Create(this.centre), 0, 0.15),
      ...this.axes.map((a, i) => restage(Create(a), 0.05 + 0.08 * i, 0.4 + 0.08 * i)),
      restage(Create(this.perceptionFace), 0.35, 0.65),
      restage(Create(this.expressionFace), 0.4, 0.7),
      restage(Create(this.band), 0.5, 0.75),
      ...this.vertices.map((v) => restage(Create(v), 0.45, 0.7)),
      ...this.labels.map((t, i) => restage(Create(t), 0.55 + 0.03 * i, 0.85 + 0.025 * i)),
      ...this.arrows.map((a) => restage(Create(a), 0.85, 1)),
    )
  }

  /** Walkable (src/automaton.ts): mode (perception · whole · expression),
   *  focus (all · causal · trans-causal · immanent) and view (upright ·
   *  hexagram); the flow's clock runs in free play. No keys are declared:
   *  the player assigns digits, and a weaving scene rekeys. */
  override stateSpace(): StateSpace | undefined {
    void this.parts
    const handles = () => [this.centre, ...this.vertices, ...this.labels]
    const free = (p: { isBound: boolean }) => !p.isBound
    const axes = [
      free(this.mode) && axis("mode", this, { perception: { mode: 0 }, whole: { mode: 0.5 }, expression: { mode: 1 } }, { duration: 2, handles }),
      free(this.focus) &&
        axis("focus", this, { all: { focus: 0 }, causal: { focus: 1 }, "trans-causal": { focus: 2 }, immanent: { focus: 3 } }, { duration: 1.4, handles }),
      free(this.view) && toggle("view", this.view, { off: ["upright", 0], on: ["hexagram", 1], duration: 2.5, handles }),
    ].filter((a): a is Axis => !!a)
    return { axes, clocks: this.time.isBound ? [] : [this.time] }
  }
}
