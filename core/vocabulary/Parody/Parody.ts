/**
 * Parody — the real and its counterfeit in the same place: a ring, whole
 * and continuous (a torus, red), and the same ring made of discrete cubes
 * (blue). One number, `parody` 0..1, turns the one into the other.
 *
 * THE IDEA. Evil as a parody of good, illusion as a parody of truth: what
 * occupies the niche the real would occupy, alike on the surface and
 * inverted underneath. So the two share everything that shows from afar —
 * the centre, the radius, the band's width, the colour of its place — and
 * differ in what shows close up: the torus is ONE continuous body, round in
 * section; the parody is N separate bodies, square in section, straight
 * where the real one curves. Face-on, at a distance, both read as a ring.
 * Turned, the counterfeit shows: blocks with gaps between them.
 *
 * THE CONSTRUCTION is one mesh (src/geometry/meshes.ts's idiom), a pure
 * function of `parody` (`parodyMesh`), drawn by its creases and smooth
 * contours with hidden lines removed (SolidDrawing). The ring is cut into
 * `count` segments; with `spread` the counterfeit starts at the top and
 * runs down both sides, piece by piece. Along its own progress, each
 * segment's
 *
 *   spine   bends from its arc of the ring (each arc touching the next:
 *           the whole torus) to a straight edge of length `CUBE`·R — the
 *           gaps open between the pieces;
 *   section squares from the tube's circle to the cube's square
 *           (a superellipse whose exponent runs 2 → ∞), the same width.
 *
 * At exactly 0 there are no cuts: the torus is closed, no seams. Past 0
 * each piece is capped, so the first thing that shows is the crack — the
 * continuous thing broken into parts. At 1 every piece is a cube.
 *
 * TWO INKS, ONE BODY. A piece is the real's (red) until it is half turned,
 * then the counterfeit's (blue). The mesh is split by ink
 * (`parodyHalves`) into two SolidDrawings, each drawing its own pieces and
 * holding the other half as an occluder only (a mesh solid with
 * `lines: false`), so the hidden lines are those of the one body.
 *
 * In the ring's own plane (XY, facing +z, the camera's default), a cube
 * sits at the top, and the arrangement is the dihedral symmetry of
 * `count` — never anything else.
 */

import { BLACK, BLUE, RED } from "../../src/constants"
import { color, completion, integer, length, scalar } from "../../src/params"
import { toggle, type StateSpace } from "../../src/automaton"
import type { Overrides } from "../../src/holon"
import type { Observer } from "../../src/dream"
import type { Solid } from "../../src/geometry/hiddenline"
import type { Mesh } from "../../src/geometry/meshes"
import { Null, type Vec3Like } from "../../src/parts/primitives"
import { SolidDrawing, type SolidDrawingOptions } from "../../src/parts/soliddrawing"

/** The proportions, in units of the ring's radius R. */
export const PARODY = {
  /** The cube's edge — and so the tube's diameter (the band is one width). */
  cube: 0.38,
  /** Samples along each segment's spine, and round each section (a multiple of 8, so the square's corners are samples). */
  spine: 6,
  section: 32,
  /** The meshes kept per instance: `parody` is quantised to 1/STEPS. */
  steps: 240,
} as const

const smooth = (u: number) => u * u * (3 - 2 * u)

/** The section's radius at angle b: a superellipse of exponent p (2 the circle, ∞ the square), half-width h. */
const sectionRadius = (b: number, p: number, h: number): number => {
  const c = Math.abs(Math.cos(b))
  const s = Math.abs(Math.sin(b))
  const m = Math.max(c, s)
  if (!Number.isFinite(p)) return h / m
  return h / (m * Math.pow(Math.pow(c / m, p) + Math.pow(s / m, p), 1 / p))
}

/** Each segment's own progress at `u`: with `spread` > 0 the counterfeit
 *  starts at the top and runs down both sides at once (segment i's angular
 *  distance from the top decides when), meeting at the bottom. */
export const segmentProgress = (n: number, u: number, spread: number): number[] =>
  Array.from({ length: n }, (_, i) => {
    const k = Math.min(i, n - i) / (n / 2)
    return Math.min(1, Math.max(0, u * (1 + spread) - spread * k))
  })

/**
 * The ring at `u` (0 the torus, 1 the cubes), radius R, `n` segments, in
 * the XY plane about +z; `spread` as segmentProgress. Pure; every triangle
 * wound outward. Neighbouring segments that are both still whole share
 * their seam ring, so the real stays one closed body wherever it is left.
 */
export const parodyMesh = (R: number, n: number, u: number, spread = 0): Mesh & { segment: number[] } => {
  const ts = segmentProgress(n, u, spread)
  const M = PARODY.spine
  const K = PARODY.section
  const h = (PARODY.cube * R) / 2
  const positions: Vec3Like[] = []
  const triangles: [number, number, number][] = []
  /** Per triangle, the segment it belongs to. */
  const segment: number[] = []
  let current = 0
  const tri = (t: [number, number, number]) => {
    triangles.push(t)
    segment.push(current)
  }
  const half = Math.PI / n
  /** The spine at v ∈ [−1, 1] of segment i, at weight w: its point and the radial direction there. */
  const spine = (i: number, v: number, w: number): { P: Vec3Like; N: Vec3Like } => {
    const th = Math.PI / 2 + 2 * half * i
    const ph = th + v * half
    const arc = { x: R * Math.cos(ph), y: R * Math.sin(ph) }
    const straight = { x: R * Math.cos(th) - Math.sin(th) * v * h, y: R * Math.sin(th) + Math.cos(th) * v * h }
    const nx = (1 - w) * Math.cos(ph) + w * Math.cos(th)
    const ny = (1 - w) * Math.sin(ph) + w * Math.sin(th)
    const l = Math.hypot(nx, ny) || 1
    return {
      P: { x: (1 - w) * arc.x + w * straight.x, y: (1 - w) * arc.y + w * straight.y, z: 0 },
      N: { x: nx / l, y: ny / l, z: 0 },
    }
  }
  /** The section at weight w: a superellipse of exponent 2 → ∞, half-width h. */
  const sectionAt = (w: number) => {
    const p = w >= 1 ? Infinity : 2 / (1 - w)
    return Array.from({ length: K }, (_, k) => {
      const b = (k / K) * 2 * Math.PI
      const r = sectionRadius(b, p, h)
      return { a: r * Math.cos(b), z: r * Math.sin(b) }
    })
  }
  const ring = (P: Vec3Like, N: Vec3Like, section: { a: number; z: number }[]): number => {
    const start = positions.length
    for (const { a, z } of section) positions.push({ x: P.x + N.x * a, y: P.y + N.y * a, z })
    return start
  }
  // A quad strip between two rings, wound so its normal points away from the spine.
  const strip = (r0: number, r1: number) => {
    for (let k = 0; k < K; k++) {
      const a = r0 + k
      const b = r0 + ((k + 1) % K)
      const c = r1 + ((k + 1) % K)
      const d = r1 + k
      tri([a, c, b])
      tri([a, d, c])
    }
  }
  // A cap: a fan from the end's centre, facing out of the body.
  const cap = (centre: Vec3Like, r0: number, flip: boolean) => {
    const c = positions.length
    positions.push(centre)
    for (let k = 0; k < K; k++) {
      const a = r0 + k
      const b = r0 + ((k + 1) % K)
      tri(flip ? [c, a, b] : [c, b, a])
    }
  }
  const whole = (i: number) => ts[((i % n) + n) % n]! <= 0
  const joined = (i: number) => whole(i) && whole(i + 1)
  let first = -1
  let last = -1
  for (let i = 0; i < n; i++) {
    current = i
    const w = smooth(ts[i]!)
    const section = sectionAt(w)
    const rings: number[] = []
    for (let j = 0; j <= M; j++) {
      if (j === 0 && i > 0 && joined(i - 1)) rings.push(last)
      else if (j === M && i === n - 1 && joined(i)) rings.push(first)
      else {
        const { P, N } = spine(i, -1 + (2 * j) / M, w)
        rings.push(ring(P, N, section))
      }
    }
    if (i === 0) first = rings[0]!
    last = rings[M]!
    for (let r = 0; r < M; r++) strip(rings[r]!, rings[r + 1]!)
    if (!joined(i - 1)) cap(spine(i, -1, w).P, rings[0]!, true)
    if (!joined(i)) cap(spine(i, 1, w).P, rings[M]!, false)
  }
  return { positions, triangles, segment }
}

/**
 * The ring split by ink: the pieces less than half turned (the real's) and
 * the rest (the counterfeit's), each its own mesh over its own vertices —
 * one body, so each half hides the other's far side.
 */
export const parodyHalves = (R: number, n: number, u: number, spread = 0): { real: Mesh; parody: Mesh } => {
  const whole = parodyMesh(R, n, u, spread)
  const ts = segmentProgress(n, u, spread)
  const pick = (keep: (i: number) => boolean): Mesh => {
    const index = new Map<number, number>()
    const positions: Vec3Like[] = []
    const triangles: [number, number, number][] = []
    whole.triangles.forEach((t, k) => {
      if (!keep(whole.segment[k]!)) return
      triangles.push(
        t.map((v) => {
          let j = index.get(v)
          if (j === undefined) {
            index.set(v, (j = positions.length))
            positions.push(whole.positions[v]!)
          }
          return j
        }) as [number, number, number],
      )
    })
    return { positions, triangles }
  }
  return { real: pick((i) => ts[i]! < 0.5), parody: pick((i) => ts[i]! >= 0.5) }
}

/** One ink's half of the ring: its own pieces drawn, the other half's only hiding. */
class ParodyHalf extends SolidDrawing {
  private half!: { owner: Parody; side: "real" | "parody" }

  constructor(owner: Parody, side: "real" | "parody", overrides: Overrides & SolidDrawingOptions) {
    super({ lineSlots: 160, ...overrides })
    this.half = { owner, side }
  }

  solids(): Solid[] {
    const { owner, side } = this.half
    const halves = owner.halves()
    const mine = halves[side]
    const other = halves[side === "real" ? "parody" : "real"]
    const out: Solid[] = []
    if (mine.triangles.length) out.push({ kind: "mesh", positions: mine.positions, triangles: mine.triangles, fill: BLACK })
    if (other.triangles.length)
      out.push({ kind: "mesh", positions: other.positions, triangles: other.triangles, fill: BLACK, lines: false })
    return out
  }
}

export class Parody extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The ring's radius (to the tube's centre). */
  radius = length(100)
  /** How many pieces the counterfeit is made of. */
  count = integer(12)
  /** 0 the real (the torus) … 1 its parody (the ring of cubes). The walkable axis. */
  parody = completion(0)
  /** 0: every piece turns at once; above 0 the counterfeit starts at the top
   *  and runs down both sides, meeting at the bottom (segmentProgress). */
  spread = scalar(2)
  /** The real's ink and the counterfeit's: a piece changes ink half-way through its turn. */
  realTint = color(RED)
  parodyTint = color(BLUE)
  /** The pen, screen px. */
  stroke = length(2.4)

  real!: ParodyHalf
  counterfeit!: ParodyHalf

  private seen!: { observer?: Observer; meshes: Map<string, { real: Mesh; parody: Mesh }> }

  constructor(overrides: Overrides & { observer?: Observer } = {}) {
    const { observer, ...rest } = overrides
    super(rest)
    this.seen = { observer, meshes: new Map() }
  }

  /** Walkable (src/automaton.ts): the real ↔ its parody. */
  override stateSpace(): StateSpace | undefined {
    if (this.parody.isBound) return undefined
    return {
      axes: [toggle("parody", this.parody, { off: ["real", 0], on: ["parody", 1], duration: 2.4, handles: [this] })],
    }
  }

  /** The two halves for the current params, kept per quantised `parody` (a new array is a new shape). */
  halves(): { real: Mesh; parody: Mesh } {
    const R = this.radius.value
    const n = Math.max(3, Math.round(this.count.value))
    const q = Math.round(this.parody.value * PARODY.steps) / PARODY.steps
    const sp = Math.max(0, this.spread.value)
    const key = `${R}|${n}|${q}|${sp}`
    const memo = this.seen.meshes
    let m = memo.get(key)
    if (!m) {
      m = parodyHalves(R, n, q, sp)
      if (memo.size > PARODY.steps + 8) memo.delete(memo.keys().next().value!)
      memo.set(key, m)
    }
    return m
  }

  protected override compose(): void {
    const observer = this.seen.observer
    this.real = this.add(new ParodyHalf(this, "real", { observer, tint: this.realTint, stroke: this.stroke }))
    this.counterfeit = this.add(new ParodyHalf(this, "parody", { observer, tint: this.parodyTint, stroke: this.stroke }))
  }
}
