/**
 * SOPLoop — Sales & Operations Planning as one figure-eight.
 *
 * From David's whiteboard (2026-10-13): an infinity sign, DEMAND on the left
 * (blue — Sales) and SUPPLY on the right (red — Operations), "S&OP" at the
 * crossing where the two meet. It is a balancing loop: what is forecast to
 * be sold and what can be made are reconciled at the crossing, again and
 * again. So value runs round it continuously — particles on the stream
 * machinery FlowMap uses (src/geometry/flowmap.ts `streamArc`, arc-length
 * spacing at a world speed), a pure function of `time`.
 *
 * THE DEGREES OF FREEDOM (params; walkable via stateSpace()):
 *
 *   focus   −1 … 1   the demand side (−1) or the supply side (+1) in
 *                    focus: the other lobe recedes (fainter, thinner).
 *   round   0 → 1    the two lobes become ONE loop — integrated planning.
 *                    A figure-eight's lobes run opposite ways, so the left
 *                    lobe first flips over through depth (the whole figure
 *                    tips back to show it), then the untwisted loop
 *                    relaxes into a circle, half blue, half red
 *                    (geometry/lemniscate.ts).
 *   certainty per side — each side's `certainty` (src/certainty.ts): a
 *                    demand forecast is conjecture until it lands, and is
 *                    drawn as a superposition; particles take the
 *                    certainty of the side they are on.
 *   labels  0 → 1    side names, their functions, and "S&OP".
 *
 * Plain data in (`SOPLoopData`), generic by default: Demand/Sales,
 * Supply/Operations.
 */

import { Circle, Group, Line, Null, type Vec3Like } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { bipolar, completion, derive, length, scalar, type Readable } from "../../src/params"
import { BLUE, RED, WHITE, type Color } from "../../src/constants"
import type { Holon } from "../../src/holon"
import { certainty } from "../../src/certainty"
import { together, type Anim } from "../../src/anim"
import { toggle, axis, type StateSpace } from "../../src/automaton"
import { arcTable, atArcLength, smooth, streamArc } from "../../src/geometry/flowmap"
import { loopPoint, onLeftLobe } from "../../src/geometry/lemniscate"

export interface SOPSide {
  /** What the side IS ("Demand"). */
  label: string
  /** Who owns it ("Sales"). */
  role?: string
  tint?: Color
  /** Is this side's knowledge data (1) or conjecture (0)? */
  certainty?: number
}

export interface SOPLoopData {
  left: SOPSide
  right: SOPSide
  /** What sits at the crossing. */
  centre?: string
}

export const MOCK_SOP: SOPLoopData = {
  left: { label: "Demand", role: "Sales", tint: BLUE, certainty: 0.35 },
  right: { label: "Supply", role: "Operations", tint: RED },
  centre: "S&OP",
}

/** One side of the loop — its lobe, its names; its certainty is the side's knowledge. */
export class SOPSideHolon extends Group {
  certainty = certainty(1)
  lobe!: Line
  name?: Text
  role?: Text
}

const mix = (a: Color, b: Color, u: number): Color => ({
  r: a.r + (b.r - a.r) * u,
  g: a.g + (b.g - a.g) * u,
  b: a.b + (b.b - a.b) * u,
})

/** A particle: it declares a certainty, read from the side it is passing through. */
class SOPParticle extends Group {
  certainty = certainty(1)
}

export class SOPLoop extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  data: SOPLoopData = MOCK_SOP

  /** Half-width of the figure-eight (tip to crossing), scene units. */
  radius = length(560)
  /** −1 demand in focus, +1 supply, 0 both. */
  focus = bipolar(0)
  /** 0 the figure-eight; 1 one circle (integrated planning). */
  round = completion(0)
  /** Seconds of flow. */
  time = scalar(0)
  /** Particle speed, scene units per second. */
  speed = scalar(110)
  /** Arc length between particles (rounded so the loop closes evenly). */
  spacing = length(60)
  /** Names: 1 shown, 0 off. */
  labels = completion(1)

  left!: SOPSideHolon
  right!: SOPSideHolon
  centre?: Text
  dots: Circle[] = []
  /** The frame that tips back while the lobe flips. */
  frame!: Group

  // Memo — plain fields (the holon is a Proxy).
  private memoKey: number[] = []
  private memoTable?: { points: Vec3Like[]; lengths: number[]; ts: number[] }

  /** The circle the loop relaxes into. */
  private circleRadius(): number {
    return this.radius.value * 0.62
  }

  /** The whole loop as an arc-length table, plus each sample's t. */
  private table() {
    const key = [this.radius.value, this.round.value]
    if (this.memoTable && key.every((v, i) => v === this.memoKey[i])) return this.memoTable
    this.memoKey = key
    const N = 240
    const ts: number[] = []
    // Start on the right lobe's tip, so the loop reads right-then-left.
    const t0 = 0
    const f = (u: number) => {
      const t = t0 + u * 2 * Math.PI
      return loopPoint(t, this.radius.value, this.circleRadius(), this.round.value)
    }
    for (let i = 0; i <= N; i++) ts.push(t0 + (i / N) * 2 * Math.PI)
    const { points, lengths } = arcTable(f, N)
    this.memoTable = { points, lengths, ts }
    return this.memoTable
  }

  /** A lobe as a polyline, opening a gap at the crossing for the centre's name. */
  private lobe(left: boolean): Vec3Like[] {
    const a = this.radius.value
    const r = this.circleRadius()
    const u = this.round.value
    const gap = a * 0.17 * (1 - smooth(0.4, 0.9, u)) * (this.data.centre ? 1 : 0)
    const out: Vec3Like[] = []
    const N = 120
    for (let i = 0; i <= N; i++) {
      const t = (left ? Math.PI / 2 : -Math.PI / 2) + (i / N) * Math.PI
      const p = loopPoint(t, a, r, u)
      if (Math.hypot(p.x, p.y, p.z) >= gap) out.push(p)
    }
    return out.length >= 2 ? out : [loopPoint(left ? Math.PI : 0, a, r, u), loopPoint(left ? Math.PI : 0, a, r, u)]
  }

  protected override compose(): void {
    const d = this.data
    const a = () => this.radius.value
    const labelSize = () => a() * 0.1

    const side = (left: boolean): SOPSideHolon => {
      const sd = left ? d.left : d.right
      const tint = sd.tint ?? (left ? BLUE : RED)
      // The side out of focus recedes.
      const presence: Readable<number> = derive(() => {
        const f = this.focus.value * (left ? -1 : 1)
        return f >= 0 ? 1 : 1 + 0.65 * f
      })
      const lobe = new Line({ tint, stroke: derive(() => 3 + 1.5 * Math.max(0, this.focus.value * (left ? -1 : 1))), opacity: presence })
      deriveLine(lobe, () => [this.radius.value, this.round.value], () => this.lobe(left))
      const named = (content: string, size: () => number, y: () => number, x: () => number, alpha: number) =>
        new Text({
          content,
          size: derive(size),
          tint: derive(() => mix(tint, WHITE, 0.15)),
          opacity: derive(() => this.labels.value * presence.value * alpha),
          x: derive(x),
          y: derive(y),
        })
      // Names move with their lobe's centre as the loop rounds.
      // Inside its lobe while there are two; outside the circle, on its own
      // side, once there is one (the centre keeps the crossing's name).
      const cx = () => {
        const w = smooth(0.5, 1, this.round.value)
        return (left ? -1 : 1) * (a() * 0.58 * (1 - w) + (this.circleRadius() + a() * 0.36) * w)
      }
      const name = named(sd.label, labelSize, () => -labelSize() * 0.35, cx, 1)
      const role = sd.role
        ? named(sd.role, () => labelSize() * 0.75, () => -a() * 0.5 - labelSize() * 0.35, cx, 0.7)
        : undefined
      const h = new SOPSideHolon({
        members: [lobe, name, ...(role ? [role] : [])],
        certainty: sd.certainty ?? 1,
      })
      h.lobe = lobe
      h.name = name
      h.role = role
      return h
    }
    this.left = side(true)
    this.right = side(false)

    const parts: Holon[] = [this.left, this.right]
    if (d.centre) {
      this.centre = new Text({
        content: d.centre,
        size: derive(() => a() * 0.13),
        tint: WHITE,
        opacity: this.labels,
        y: derive(() => -a() * 0.13 * 0.35),
      })
      parts.push(this.centre)
    }

    // --- particles round the whole loop -----------------------------------
    const leftTint = d.left.tint ?? BLUE
    const rightTint = d.right.tint ?? RED
    const total = this.table().lengths[this.table().lengths.length - 1]!
    const n = Math.max(4, Math.round(total / this.spacing.value))
    for (let j = 0; j < n; j++) {
      let memoT = Number.NaN
      let memoTable: unknown
      let memo = { x: 0, y: 0, z: 0, t: 0 }
      const cur = () => {
        const tab = this.table()
        if (memoT === this.time.value && memoTable === tab) return memo
        memoT = this.time.value
        memoTable = tab
        const L = tab.lengths[tab.lengths.length - 1]!
        const s = streamArc(j, n, L / n, this.speed.value, this.time.value, 0)
        const p = atArcLength(tab.points, tab.lengths, s)
        // The parameter there, for which side it is on.
        let i = 0
        while (i < tab.lengths.length - 2 && tab.lengths[i + 1]! < s) i++
        memo = { x: p.x, y: p.y, z: p.z, t: tab.ts[i]! }
        return memo
      }
      // How far onto the left side: by lobe, softened across the crossing.
      const leftness = () => {
        const c = cur()
        const k = smooth(-0.12, 0.12, -c.x / a())
        return onLeftLobe(c.t) ? Math.max(k, 0.5) : Math.min(k, 0.5)
      }
      const dot = new Circle({
        radius: derive(() => a() * 0.022),
        stroke: 0,
        fillOpacity: 1,
        tint: derive(() => mix(rightTint, leftTint, leftness())),
        opacity: derive(() => {
          const l = leftness()
          const f = this.focus.value
          const presence = 1 - 0.65 * Math.max(0, -f * (1 - l) + f * l) // the receding side's particles recede too
          // Through the crossing's name, the particles pass under it.
          const c = cur()
          const gap = a() * 0.15 * (1 - smooth(0.4, 0.9, this.round.value)) * (d.centre ? 1 : 0)
          return presence * smooth(gap * 0.6, gap * 1.1, Math.hypot(c.x, c.y, c.z))
        }),
      })
      const carrier = new SOPParticle({
        members: [dot],
        x: derive(() => cur().x),
        y: derive(() => cur().y),
        z: derive(() => cur().z),
      })
      carrier.certainty.follow(
        derive(() => {
          const l = leftness()
          return l * (this.left.certainty.value) + (1 - l) * this.right.certainty.value
        }),
      )
      this.dots.push(dot)
      parts.push(carrier)
    }

    // While the left lobe flips through depth, the figure tips back so the
    // flip reads as a turn, not a squash — and lies flat again after.
    this.frame = this.add(
      new Group({
        members: parts,
        p: derive(() => -0.55 * Math.sin(Math.PI * smooth(0, 0.5, this.round.value))),
      }),
    )
  }

  /** Create: the two lobes draw on together; names and particles are already there to be seen once the ink arrives. */
  override createAnim(): Anim {
    void this.parts
    return together([this.left.lobe.creation.sequence(0, 1), 0, 0.8], [this.right.lobe.creation.sequence(0, 1), 0, 0.8])
  }

  override stateSpace(): StateSpace {
    const axes = [
      axis("focus", this, { both: { focus: 0 }, demand: { focus: -1 }, supply: { focus: 1 } }, {
        key: "f",
        duration: 1.2,
        handles: () => [this.left.lobe, this.right.lobe],
      }),
      toggle("round", this.round, { key: "r", off: ["two loops", 0], on: ["one loop", 1], duration: 2.6, handles: () => (this.centre ? [this.centre] : []) }),
      toggle("labels", this.labels, { key: "l", off: ["hidden", 0], on: ["shown", 1] }),
    ]
    for (const [id, s, sd] of [["left", this.left, this.data.left], ["right", this.right, this.data.right]] as const) {
      const declared = sd.certainty ?? 1
      if (declared < 1)
        axes.push(
          toggle(`${id}.certainty`, s.certainty, {
            label: `${sd.label} certainty`,
            off: ["conjecture", declared],
            on: ["data", 1],
            duration: 2,
            handles: () => [s.lobe],
          }),
        )
    }
    return { axes, clocks: [this.time] }
  }
}

/** Derived points, recomputed when `deps` change (the FlowMap/Globe memo pattern). */
const deriveLine = (line: Line, deps: () => number[], compute: () => Vec3Like[]): void => {
  let key: number[] | undefined
  let memo: Vec3Like[] = []
  Object.defineProperty(line, "points", {
    configurable: true,
    enumerable: true,
    get() {
      const next = deps()
      if (!key || next.some((v, i) => v !== key![i])) {
        key = next
        memo = compute()
        line.geomVersion++
      }
      return memo
    },
    set(_v) {},
  })
}
