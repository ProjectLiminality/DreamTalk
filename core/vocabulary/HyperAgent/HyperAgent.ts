/**
 * HyperAgent — the collective agent many minds become. ONE holon, two
 * poles, one number between them (`love`):
 *
 *   WAR (love 0) — "all agents of fragmentation self-organize into a war
 *     machine, a collective hyper-agent rooted in fear and in service to
 *     war" (13:59–14:12). Built by divide and conquer, recursively: "the
 *     divided and conquered divide and conquer" (12:43). Two domesticated
 *     minds in their triangles with a bolt between them (f3616); a third
 *     above them makes a triangle of three (f3661); the puppeteer's hands
 *     at the top triangle's lower corners hold the two below by strings to
 *     their heads (f3676); and the whole is the unit of the next level
 *     (f3781, f3871). At the apex, above every level, the domesticated eye
 *     — "the spirit of fragmentation" (13:38, f4141) — and "Power" climbing
 *     both flanks (f4351). With no recursion at all it is the small icon,
 *     the eye in its triangle, "War Machine" (f2506, f2566).
 *   LOVE (love 1) — "a collective hyper-agent grounded in love … that
 *     knows no enemies" (42:26–42:36): the same minds, liminal, in a
 *     flower of life of circles around the liminal eye (f13111).
 *
 * The film morphs the one into the other (f13006 → f13111) and so does
 * `love`, in two halves:
 *   0 → ½  in place: the bolts and the hands let go, every triangle rounds
 *          into its circle and every mind turns liminal; the eye's cube
 *          gives way to the Vision (f13051, f13066).
 *   ½ → 1  the gathering: the minds leave the pyramid for the hexagonal
 *          lattice round the eye, all one size; each mind's own circle
 *          grows into its circle of the flower, the eye's frame becomes the
 *          centre circle, and the flower's rim closes round them (f13096).
 *
 * THE RECURSION (`depth`, symbolic — structure is fixed at compose, TASTE's
 * CPU side). A level-k unit of side s is the Sierpinski split of its
 * triangle: the top half-triangle holds ONE mind (at the root: the eye),
 * the two lower ones hold level-(k−1) units, the inverted middle holds the
 * bolt, and the hands stand at the top half's lower corners holding the
 * head mind of each lower unit. A level-0 unit is one mind. So a root of
 * depth d has 2^(d+1) − 2 minds under the eye: 14 at depth 3, the film's
 * War Machine (f4351). Every triangle drawn is a Mind's own frame (David's
 * `MolochConsciousness`) or the eye's: the union of them IS the pyramid.
 *
 * COMPOSED, NEVER REDRAWN: the minds are `Mind`, the eye is `MolochEye`
 * (its `iris`), the bolts are `Conflict`, the hands are `Puppeteer`, the
 * eye's frame is Mind's own triangle↔circle outline (`frameOutline`). Only
 * the flower's circles and the "Power" flanks are this holon's lines.
 *
 * MEASURED in units of s, the whole pyramid's side (`size`), off f4351
 * (s = 690 px) and f3676 (a depth-1 unit, s = 510 px); origin at the
 * pyramid's mid-height (the frame's centre in f4351), so the flower of
 * f13111, centred on the frame, is centred on it too:
 *
 *   BOLT      a bolt's length 0.22 of its unit's side (f4351 root 140/690,
 *             level-2 75/345; f3676 120/510) at the middle's centroid
 *   FIST      a hand 0.135 of its unit's side wide (f3676 70/510, f4351
 *             90/690), its grip GRIP = 0.04 of the side above the corner
 *   EYE_WAR   the eye's lens half-height 0.145 of its triangle's side
 *             (f4351: 50 px in 345; f2506 the same)
 *   LATTICE   the flower's spacing a = 0.178·s (f13111: the rim's 336 px
 *             radius is (1 + √3)·a, a = 123 px; the pyramid 690 px)
 *   EYE_LOVE  the eye's half-height in the flower, 0.054·s (37 px)
 *   BUST_LOVE a mind's bust in the flower, 0.48·a (60 px)
 *   POWER     the flank arrows (f4351): tail (−0.620, −0.352)·s, head
 *             (−0.246, 0.278)·s, mirrored; the word at (∓0.514, 0)·s,
 *             0.041·s high
 */

import { Circle, Line, Null, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { bool, color, completion, derive, integer, length } from "../../src/params"
import { BLUE, RED, WHITE, type Color } from "../../src/constants"
import { clamp01, lerp } from "../../src/math"
import { type Anim, restage, together } from "../../src/anim"
import { Create } from "../../src/verbs"
import type { Holon } from "../../src/holon"
import { axis, type StateSpace } from "../../src/automaton"
import { Layer } from "../Figure/Figure"
import { MIND, Mind, frameOutline } from "../Mind/Mind"
import { MolochEye } from "../MolochEye/MolochEye"
import { Conflict } from "../Conflict/Conflict"
import { Puppeteer } from "../Puppeteer/Puppeteer"

/** The construction's measures (see header). */
export const HYPER = {
  bolt: 0.22,
  fist: 0.135,
  grip: 0.04,
  eyeWar: 0.145,
  lattice: 0.178,
  eyeLove: 0.054,
  bustLove: 0.48,
  powerTail: [-0.62, -0.352] as const,
  powerHead: [-0.246, 0.278] as const,
  powerWord: [-0.514, 0] as const,
  powerSize: 0.041,
} as const

const SQRT3 = Math.sqrt(3)

/** A Mind's R for a triangle of side t: the triangle's circumradius is 1.15·R. */
export const mindRadius = (t: number): number => t / (SQRT3 * MIND.triRadius)

/** One mind's triangle. `stage` is its place in the build: 0 the leaves, k a level-k unit's head. */
export interface WarMind {
  /** Its triangle's apex and side. */
  ax: number
  ay: number
  side: number
  stage: number
  /** The root's top: the eye's place (shown as a mind only without the eye). */
  crown: boolean
}
export interface WarBolt {
  x: number
  y: number
  size: number
  stage: number
}
export interface WarHand {
  /** The corner it stands over, its unit's side, and the mind it holds. */
  x: number
  y: number
  side: number
  holds: number
  stage: number
}
export interface WarMachine {
  minds: WarMind[]
  bolts: WarBolt[]
  hands: WarHand[]
}

/** Where a mind's bust centre is, for its triangle (apex, side): the centroid, lifted by −triY·R. */
export const bustOf = (m: Pick<WarMind, "ax" | "ay" | "side">): { x: number; y: number } => {
  const R = mindRadius(m.side)
  return { x: m.ax, y: m.ay - m.side / SQRT3 - MIND.triY * R }
}

/** The top of a mind's cube (where the strings end), for its triangle. */
export const cubeTopOf = (m: Pick<WarMind, "ax" | "ay" | "side">): number => {
  const hb = MIND.bust * mindRadius(m.side)
  return bustOf(m).y + (MIND.cubeY + MIND.cubeRim / 2) * hb
}

/**
 * The divide-and-conquer construction for a root of side `s` and recursion
 * `depth`, apex at (0, H/2) (H the height), so the pyramid's mid-height is
 * the origin. The crown is minds[0].
 */
export const warMachine = (depth: number, s: number): WarMachine => {
  const out: WarMachine = { minds: [], bolts: [], hands: [] }
  const H = (s * SQRT3) / 2
  const unit = (ax: number, ay: number, side: number, k: number, root: boolean): number => {
    if (k === 0) {
      out.minds.push({ ax, ay, side, stage: 0, crown: root })
      return out.minds.length - 1
    }
    const h = (side * SQRT3) / 2
    out.minds.push({ ax, ay, side: side / 2, stage: k, crown: root })
    const head = out.minds.length - 1
    const left = unit(ax - side / 4, ay - h / 2, side / 2, k - 1, false)
    const right = unit(ax + side / 4, ay - h / 2, side / 2, k - 1, false)
    out.bolts.push({ x: ax, y: ay - (2 * h) / 3, size: HYPER.bolt * side, stage: k })
    out.hands.push({ x: ax - side / 4, y: ay - h / 2, side, holds: left, stage: k })
    out.hands.push({ x: ax + side / 4, y: ay - h / 2, side, holds: right, stage: k })
    return head
  }
  unit(0, H / 2, s, Math.max(0, Math.round(depth)), true)
  return out
}

/**
 * The flower's lattice for `n` minds, spacing a: the hexagonal lattice's
 * points round the centre, whole shells only (6, 12, 18, 30 …) — the
 * largest that `n` fills; a mind beyond it is gathered into the eye. Fewer
 * than six minds stand evenly on the first ring.
 */
export const flowerSpots = (n: number, a: number): { x: number; y: number }[] => {
  if (n <= 0) return []
  if (n < 6)
    return Array.from({ length: n }, (_, i) => ({
      x: a * Math.cos((2 * Math.PI * i) / n),
      y: a * Math.sin((2 * Math.PI * i) / n),
    }))
  const pts: { x: number; y: number; d: number; t: number }[] = []
  const R = 8
  for (let i = -R; i <= R; i++)
    for (let j = -R; j <= R; j++) {
      if (i === 0 && j === 0) continue
      const x = (i + j / 2) * a
      const y = ((j * SQRT3) / 2) * a
      pts.push({ x, y, d: Math.hypot(x, y), t: Math.atan2(y, x) })
    }
  pts.sort((p, q) => p.d - q.d || p.t - q.t)
  // Whole shells, while they fit.
  let take = 0
  let i = 0
  while (i < pts.length) {
    let j = i
    while (j < pts.length && Math.abs(pts[j]!.d - pts[i]!.d) < 1e-6 * a) j++
    if (j > n) break
    take = j
    i = j
  }
  // The lattice of f13111 is turned so its first shell lies on the horizontal and its second on the vertical.
  return pts.slice(0, take).map(({ x, y }) => ({ x, y }))
}

/**
 * Which flower spot each mind goes to (−1: gathered into the eye): the
 * nearest pairs first, so the pyramid's minds move as little as they can.
 */
export const assignSpots = (from: readonly { x: number; y: number }[], spots: readonly { x: number; y: number }[]): number[] => {
  const pairs: [number, number, number][] = []
  from.forEach((p, i) => spots.forEach((q, j) => pairs.push([Math.hypot(p.x - q.x, p.y - q.y), i, j])))
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
  const to = from.map(() => -1)
  const taken = new Set<number>()
  let left = Math.min(from.length, spots.length)
  for (const [, i, j] of pairs) {
    if (!left) break
    if (to[i] !== -1 || taken.has(j)) continue
    to[i] = j
    taken.add(j)
    left--
  }
  return to
}

/** smoothstep — every motion here eases in and out. */
const ease = (u: number): number => {
  const v = clamp01(u)
  return v * v * (3 - 2 * v)
}

const mix = (a: Color, b: Color, u: number): Color => ({
  r: lerp(a.r, b.r, u),
  g: lerp(a.g, b.g, u),
  b: lerp(a.b, b.b, u),
})

/** The two halves of the love walk (header): in place, then the gathering. */
export const loveHalves = (love: number): { turn: number; gather: number } => ({
  turn: clamp01(love * 2),
  gather: clamp01(love * 2 - 1),
})

/** Within a build of `stages` stages, how far stage `stage`'s window [w0, w1] (of the stage) is at build b. */
export const buildAt = (b: number, stages: number, stage: number, w0 = 0, w1 = 1): number =>
  clamp01((b * stages - stage - w0) / (w1 - w0))

/** Each kind's window within its stage: the bolt strikes, the head mind arrives, the hands take hold. */
const WINDOW = { leaf: [0, 1], bolt: [0, 0.4], head: [0.3, 0.7], hand: [0.6, 1] } as const

export class HyperAgent extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** s — the pyramid's side; every measure derives from it. */
  size = length(1435)
  /** The recursion: 0 the small icon (the eye in its triangle), 3 the film's War Machine. Structural. */
  depth = integer(3)
  /** 0 the war machine … 1 the hyper-agent of love. Scrubs. */
  love = completion(0)
  /** The "Power" arrows climbing both flanks (war only). */
  power = completion(1)
  /** The eye at the apex (1) or a mind there (0, the bare divide and conquer of f3661–f3781). */
  apex = completion(1)
  /** The recursive growth, leaves first, level by level (Create walks it 0 → 1). */
  build = completion(1)
  /** Pen width for the minds, hands and frames, in screen px. */
  stroke = length(2.2)
  /** Whether the flower's rim (its bounding circle) closes round the lattice. */
  rim = bool(true)

  machine!: WarMachine
  minds: Mind[] = []
  bolts: Conflict[] = []
  hands: Puppeteer[] = []
  eye!: MolochEye
  eyeFrame!: Line
  /** One flower circle per gathered mind, and the rim. */
  petals: Circle[] = []
  rimCircle!: Circle
  flanks!: Layer
  /** The presence layer of each unit, keyed by the unit (for Create's windows). */
  private windows = new Map<Holon, [number, number]>()

  /** Walkable (src/automaton.ts): war ↔ love; the eye on/off. */
  override stateSpace(): StateSpace | undefined {
    const axes = []
    if (!this.love.isBound)
      axes.push(axis("love", this, { war: { love: 0 }, love: { love: 1 } }, { duration: 4, handles: [this] }))
    if (!this.apex.isBound)
      axes.push(axis("apex", this, { mind: { apex: 0 }, eye: { apex: 1 } }, { duration: 1, handles: [this] }))
    return axes.length ? { axes } : undefined
  }

  protected override compose(): void {
    const s = this.size.value
    const D = Math.max(0, Math.round(this.depth.value))
    const S = D + 1
    const stroke = this.stroke
    const m = (this.machine = warMachine(D, s))
    const turn = () => loveHalves(this.love.value).turn
    const gather = () => ease(loveHalves(this.love.value).gather)
    const built = (stage: number, w: readonly [number, number]) => () =>
      ease(buildAt(this.build.value, S, stage, w[0], w[1]))
    const windowOf = (stage: number, w: readonly [number, number]): [number, number] => [
      (stage + w[0]) / S,
      (stage + w[1]) / S,
    ]

    // The love targets: the flower's lattice round the eye.
    const a = HYPER.lattice * s
    const busts = m.minds.map(bustOf)
    // With the eye at the apex the crown mind is never seen: it joins nothing.
    const crownSeen = this.apex.value < 0.5
    const gathering = m.minds.map((_, i) => i).filter((i) => crownSeen || !m.minds[i]!.crown)
    const spots = flowerSpots(gathering.length, a)
    const assigned = assignSpots(
      gathering.map((i) => busts[i]!),
      spots,
    )
    const spotOf = new Map<number, number>(gathering.map((i, k) => [i, assigned[k]!]))
    const loveR = (HYPER.bustLove * a) / MIND.bust

    // Composite order (attach order): the bolts; the flower's lines (rim, the eye's frame, the petals); the
    // minds, whose black busts hide the lines behind them as the film's dark halos do; the eye; the hands,
    // whose black fists hide the triangles' edges behind them (f4351); the flanks.
    const order = { bolts: [] as Layer[], lines: [] as Layer[], minds: [] as Layer[], eye: [] as Layer[], hands: [] as Layer[] }
    for (const b of m.bolts) {
      const presence = built(b.stage, WINDOW.bolt)
      const bolt = new Conflict({ size: b.size, x: b.x, y: b.y })
      this.bolts.push(bolt)
      this.windows.set(bolt, windowOf(b.stage, WINDOW.bolt))
      order.bolts.push(new Layer({ presence: derive(() => presence() * (1 - turn())), members: [bolt] }))
    }

    m.minds.forEach((w, i) => {
      const R = mindRadius(w.side)
      const at = busts[i]!
      const spot = spotOf.has(i) ? spotOf.get(i)! : -1
      const to = spot >= 0 ? spots[spot]! : { x: 0, y: 0 }
      const toScale = spot >= 0 ? loveR / R : 0.2
      const win = w.stage === 0 ? WINDOW.leaf : WINDOW.head
      const presence = built(w.stage, win)
      const mind = new Mind({
        size: R,
        stroke,
        liminal: derive(turn),
        framed: derive(() => 1 - gather()),
        x: derive(() => lerp(at.x, to.x, gather())),
        y: derive(() => lerp(at.y, to.y, gather())),
        scale: derive(() => lerp(1, toScale, gather())),
      })
      this.minds.push(mind)
      this.windows.set(mind, windowOf(w.stage, win))
      const shown = () =>
        presence() * (w.crown ? 1 - this.apex.value : 1) * (spot >= 0 || !spotOf.has(i) ? 1 : 1 - gather())
      order.minds.push(new Layer({ presence: derive(shown), members: [mind] }))

      // Its circle of the flower: born as the mind's own circle, grown to the lattice's.
      if (spot >= 0) {
        const c0 = { x: at.x, y: at.y + MIND.circleY * R }
        const petal = new Circle({
          radius: derive(() => lerp(R, a, gather())),
          x: derive(() => lerp(c0.x, to.x, gather())),
          y: derive(() => lerp(c0.y, to.y, gather())),
          tint: RED,
          stroke,
        })
        this.petals.push(petal)
        order.lines.push(new Layer({ presence: derive(() => shown() * gather()), members: [petal] }))
      }
    })

    // The crown: the eye in its triangle, which rounds into the flower's centre circle.
    const crown = m.minds[0]!
    const Re = mindRadius(crown.side)
    const cc = { x: crown.ax, y: crown.ay - crown.side / SQRT3 }
    const crownPresence = built(crown.stage, crown.stage === 0 ? WINDOW.leaf : WINDOW.head)
    const eyeH = HYPER.eyeWar * crown.side
    this.eyeFrame = new Line({ tint: derive(() => mix(BLUE, RED, turn())), stroke })
    const frameAt = (l: number, g: number): Vec3Like[] => {
      const sigma = lerp(1, a / Re, g)
      const own = lerp(MIND.triY, MIND.circleY, l) * Re
      const cx = lerp(cc.x, 0, g)
      const cy = lerp(cc.y, 0, g)
      return frameOutline(Re, l).map((p) => ({ x: cx + p.x * sigma, y: cy + (p.y - own) * sigma, z: 0 }))
    }
    derivePoints(this.eyeFrame, () => [turn(), gather()], () => frameAt(turn(), gather()))
    this.eye = new MolochEye({
      height: eyeH,
      iris: derive(turn),
      x: derive(() => lerp(cc.x, 0, gather())),
      y: derive(() => lerp(cc.y, 0, gather())),
      scale: derive(() => lerp(1, (HYPER.eyeLove * s) / eyeH, gather())),
    })
    this.windows.set(this.eye, windowOf(crown.stage, crown.stage === 0 ? WINDOW.leaf : WINDOW.head))
    this.windows.set(this.eyeFrame, windowOf(crown.stage, crown.stage === 0 ? WINDOW.leaf : WINDOW.head))
    const crowned = () => crownPresence() * this.apex.value
    order.lines.unshift(new Layer({ presence: derive(crowned), members: [this.eyeFrame] }))
    order.eye.push(new Layer({ presence: derive(crowned), members: [this.eye] }))

    // The flower's rim, closing round the outermost circles.
    const reach = spots.reduce((r, p) => Math.max(r, Math.hypot(p.x, p.y)), 0) + a
    this.rimCircle = new Circle({ radius: derive(() => reach * lerp(0.85, 1, gather())), tint: RED, stroke })
    order.lines.unshift(new Layer({ presence: derive(() => (this.rim.value ? gather() : 0)), members: [this.rimCircle] }))

    // The hands: each stands over its corner, its strings to the held mind's cube.
    for (const h of m.hands) {
      const W = HYPER.fist * h.side
      const gy = h.y + HYPER.grip * h.side
      const held = m.minds[h.holds]!
      const hand = new Puppeteer({ size: W, length: gy - cubeTopOf(held), x: h.x, y: gy, stroke })
      this.hands.push(hand)
      this.windows.set(hand, windowOf(h.stage, WINDOW.hand))
      const presence = built(h.stage, WINDOW.hand)
      order.hands.push(new Layer({ presence: derive(() => presence() * (1 - turn())), members: [hand] }))
    }
    for (const layer of [...order.bolts, ...order.lines, ...order.minds, ...order.eye, ...order.hands]) this.add(layer)

    // "Power", climbing both flanks.
    const flank = (side: -1 | 1) => {
      const [tx, ty] = HYPER.powerTail
      const [hx, hy] = HYPER.powerHead
      const arrow = new Line({
        points: [
          { x: -side * tx * s, y: ty * s, z: 0 },
          { x: -side * hx * s, y: hy * s, z: 0 },
        ],
        tint: BLUE,
        stroke: 3,
        arrowEnd: true,
      })
      const word = new Text({
        content: "Power",
        font: "Times-Roman",
        size: HYPER.powerSize * s,
        x: -side * HYPER.powerWord[0] * s,
        y: HYPER.powerWord[1] * s,
        tint: WHITE,
      })
      return [arrow, word]
    }
    const last = built(D, WINDOW.hand)
    this.flanks = this.add(
      new Layer({
        presence: derive(() => this.power.value * last() * (1 - turn())),
        members: [...flank(-1), ...flank(1)],
      }),
    )
  }

  /** The build: the leaves draw, then level by level the bolt strikes, the head mind arrives and the hands take hold. */
  override createAnim(): Anim {
    void this.parts // compose() is lazy: the parts exist once it has run
    const items = [...this.windows].map(([holon, [a, b]]) => restage(Create(holon), a, b))
    return together(this.build.sequence(0, 1), ...items)
  }
}
