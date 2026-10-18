/**
 * Conflict — the white lightning bolt ⚡ of the InterBrain film: the sign
 * that two things are at war. It stands BETWEEN two things (freedom ⚡
 * order, f346, and turns to point at one, f436), RADIATES around a
 * pathology (Chaos: bolts flying outward from a red circle; Oppression:
 * bolts striking inward at a blue square, f541), and sits around the
 * noosphere and inside the war machine.
 *
 * It is one glyph — the high-voltage arrow: a thick slanted stroke, a jog
 * back across, a thinner stroke down to an arrowhead. The Web3 video's
 * blue node rings its globe with the same glyph (same chirality, same
 * proportions at 30 px; demo/web3/YinYang.ts), so both films import this.
 * The outline was traced off f_00346 at full resolution (163 px long),
 * vertices fitted to the frame's antialiased coverage (IoU 0.976).
 *
 * ONE SIZE: `size` is the bolt's length, tail to tip. The glyph is stated
 * in units of it, about the centre of its bounding box (the point the film
 * turns it about, f346 → f436, and grows it from, f264–f267).
 *
 * ONE IMPLEMENTATION OF THE RING: `count` bolts sit at angles
 * `phase + i·τ/count`, `radius` from the centre, on a circle (Chaos) or on
 * a square (`ring: "square"` — Oppression's bolts stand at the corners of
 * a square, f541), and each points at its own angle + `direction`. So
 *   one bolt   count 1, radius 0, phase 0: `direction` is simply where
 *              the tip points (default −τ/4, down, as at f346);
 *   radiating  direction 0  — every tip points away from the centre;
 *   striking   direction π  — every tip points at the centre.
 *
 * STATE: `spread` (0..1) — the ring gathered at the centre (0) or flown
 * out to its radius (1): "the bolts explode out" (f535–f541). Walkable
 * when the ring has more than one bolt.
 *
 * CREATE is the film's strike: each bolt is revealed from its middle
 * outward along its length (f264: a dot at the centre; f265: the jog
 * alone; f266: almost to both ends; f267: whole) — `creation` is the
 * revealed share of the length, a slab clip of the outline.
 */

import { Group, Line, Null, Shape, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { angle, choice, color, completion, derive, integer, length } from "../../src/params"
import { TAU, WHITE } from "../../src/constants"
import type { Overrides } from "../../src/holon"
import type { Anim } from "../../src/anim"
import { toggle, type StateSpace } from "../../src/automaton"

/**
 * The bolt's outline, [along, across] in units of its length: `along` runs
 * tail (−½) → tip (+½), `across` is the along-axis turned a quarter
 * counter-clockwise. Traced off f_00346 (tip pointing down the frame).
 */
export const BOLT: readonly (readonly [number, number])[] = [
  [-0.5, -0.085], // tail, one corner
  [-0.5, 0.097], // tail, other corner
  [-0.02, -0.079], // inner corner of the upper stroke
  [-0.169, 0.223], // the jog's far point
  [0.32, 0.071], // lower stroke, at the arrowhead's shoulder
  [0.322, 0.154], // arrowhead shoulder
  [0.5, 0.03], // tip
  [0.322, -0.096], // arrowhead shoulder
  [0.32, -0.007], // lower stroke, at the arrowhead's shoulder
  [0.02, 0.053], // inner corner of the lower stroke
  [0.156, -0.223], // the jog's near point
]

/** The least revealed share of a bolt's length (see boltOutline). */
export const MIN_REVEAL = 1e-3

/** Where bolt `i` of `count` sits, unit radius: on a circle, or on a square's perimeter. */
export const ringSpot = (i: number, count: number, phase: number, ring: string): { x: number; y: number; a: number } => {
  const a = phase + (i / count) * TAU
  const c = Math.cos(a)
  const s = Math.sin(a)
  const k = ring === "square" ? 1 / Math.max(Math.abs(c), Math.abs(s)) : 1
  return { x: c * k, y: s * k, a }
}

/**
 * Clip a closed outline (no closing repeat) to the slab lo ≤ along ≤ hi —
 * Sutherland–Hodgman against two half-planes. Concave input is fine: the
 * result may carry zero-area bridges along the cut, which an even-odd wash
 * never paints.
 */
const clipSlab = (pts: readonly (readonly [number, number])[], lo: number, hi: number): [number, number][] => {
  const half = (input: [number, number][], inside: (u: number) => boolean, edge: number): [number, number][] => {
    const out: [number, number][] = []
    for (let i = 0; i < input.length; i++) {
      const p = input[i]!
      const q = input[(i + 1) % input.length]!
      const pin = inside(p[0])
      const qin = inside(q[0])
      if (pin) out.push(p)
      if (pin !== qin) {
        const t = (edge - p[0]) / (q[0] - p[0])
        out.push([edge, p[1] + t * (q[1] - p[1])])
      }
    }
    return out
  }
  let poly = pts.map((p) => [p[0], p[1]] as [number, number])
  poly = half(poly, (u) => u >= lo, lo)
  poly = half(poly, (u) => u <= hi, hi)
  return poly
}

/**
 * One bolt's closed outline in the holon's plane: centred at (cx, cy),
 * `size` long, tip pointing at angle `dir`, revealed over the middle
 * `reveal` share of its length. Always closed and never empty, so the host
 * keeps it as a drawing even while nothing is revealed.
 */
export const boltOutline = (cx: number, cy: number, size: number, dir: number, reveal = 1): Vec3Like[] => {
  // Never an empty interior: the host's fill cannot come back from a mesh
  // with no triangles, so an unrevealed bolt is a sub-pixel sliver.
  const r = Math.min(Math.max(reveal, MIN_REVEAL), 1)
  const uv = r >= 1 ? BOLT.map((p) => [p[0], p[1]] as [number, number]) : clipSlab(BOLT, -r / 2, r / 2)
  const dx = Math.cos(dir)
  const dy = Math.sin(dir)
  const pts = uv.map(([u, v]) => ({ x: cx + (dx * u - dy * v) * size, y: cy + (dy * u + dx * v) * size, z: 0 }))
  return [...pts, pts[0]!]
}

export class Conflict extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The bolt's length, tail to tip (f346: 163 px — 340 units at the default eye). */
  size = length(340)
  tint = color(WHITE)
  /** The wash's strength (a bolt is all wash). */
  fillOpacity = completion(1)
  /** Where each tip points: absolute for one bolt, relative to its ring angle in a ring. */
  direction = angle(-TAU / 4)

  /** How many bolts (1 = the single bolt between two things). */
  count = integer(1)
  /** The ring's radius: to each bolt's centre (on a square ring, its half-side). */
  radius = length(0)
  /** The ring's figure: "circle" (Chaos) or "square" (Oppression). */
  ring = choice("circle", ["circle", "square"])
  /** The first bolt's angle on the ring. */
  phase = angle(0)
  /** The ring gathered at the centre (0) or flown out to its radius (1). */
  spread = completion(1)

  bolts!: Group

  constructor(overrides: Overrides = {}) {
    super(overrides)
  }

  protected override compose(): void {
    const n = Math.max(1, Math.round(this.count.value))
    this.bolts = this.add(
      new Group({
        members: Array.from({ length: n }, (_, i) => {
          const outline = new Line({ tint: this.tint })
          derivePoints(
            outline,
            () => [
              this.size.value,
              this.direction.value,
              this.radius.value,
              this.ring.value,
              this.phase.value,
              this.spread.value,
              this.creation.value,
            ],
            () => {
              const spot = ringSpot(i, n, this.phase.value, this.ring.value)
              const r = this.radius.value * this.spread.value
              return boltOutline(spot.x * r, spot.y * r, this.size.value, spot.a + this.direction.value, this.creation.value)
            },
          )
          // Unrevealed, the sliver boltOutline keeps is hidden outright.
          const opacity = derive(() => (this.creation.value > 0 ? this.opacity.value : 0))
          return new Shape({ tint: this.tint, fillOpacity: this.fillOpacity, opacity, outlines: [outline] })
        }),
      }),
    )
  }

  /** The strike: every bolt revealed from its middle out (f264–f267). */
  override createAnim(): Anim {
    return this.creation.sequence(0, 1)
  }

  override unCreateAnim(): Anim {
    return this.creation.to(0)
  }

  /** Walkable (src/automaton.ts): a ring gathers and explodes out. */
  override stateSpace(): StateSpace | undefined {
    if (Math.round(this.count.value) < 2 || this.spread.isBound) return undefined
    return { axes: [toggle("spread", this.spread, { off: ["gathered", 0], on: ["radiating", 1], handles: [this] })] }
  }
}
