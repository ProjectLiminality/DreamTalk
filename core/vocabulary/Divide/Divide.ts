/**
 * Divide — the S that splits a whole into two lobes.
 *
 * THE CONCEPT. Wherever the films set two principles side by side as two
 * phases of one whole, they draw the yin-yang's S between them:
 *
 *   - the Web3 film's thesis (demo/web3/YinYang.ts): centralised │
 *     decentralised, the S inside the big circle, turning;
 *   - the InterBrain film's medicine (18:27–19:02): Engineering │ Gardening
 *     (f5581, f5611) — the S across the whole frame, a blue square grid on
 *     the one side, a red flower-of-life field on the other — and Narrative
 *     Engineering │ Vision Gardening (f5821);
 *   - the open S-arc between two spheres (f2251, f5851, f6961), an arrow
 *     across its waist from the one lobe to the other;
 *   - DreamWeaving (36:22, f10951, f11071): the same arc from a cluster of
 *     DreamTalk symbols up to the DreamSong — closed by the circle in
 *     f11071.
 *
 * ONE GEOMETRY. Every one of those is the same curve: two half-circles
 * stitched where they touch. Lobe A (radius split·R) is centred on the
 * axis behind the waist, lobe B (the rest) in front of it; the S runs under
 * A's centre to the touching point, then over B's centre to B's rim. At
 * split ½ it is the classic two R/2 semicircles; as the split moves, the S
 * leans with it (the Web3 spin's exchange). `turn` rotates the axis.
 *
 * MEASURED. f5851 (and f10951, the identical arc): lower lobe centre
 * (533, 465), upper (745, 255), both r ≈ 155 px, touching at the frame's
 * centre — the axis at +45°, every arc a true semicircle (182°, 181°). On
 * f5581 the same S, larger (r ≈ 380 px, the waist at the centre, axis
 * +45°), clipped by the frame: so "the frame-wide divide" is not a second
 * curve, only a bigger R. Lobe A is the engineered, blue side (lower-left),
 * lobe B the gardened, red side (upper-right), in every frame.
 *
 * THE HALF-FIELDS (f5581). Each side may hold a field, laid in the holon's
 * own (unrotated) frame and clipped to its side of the S: `none`, `grid`
 * (the engineered square grid — lines 124 px apart, BLUE) or `flower`
 * (the flower of life — circles of 115 px on a triangular lattice of the
 * same spacing, columns vertical, RED). Both are very dim on the film
 * (brightest strokes ≈ (8, 31, 47) and (40, 20, 21)), hence `fieldOpacity`.
 * The side of a point: inside lobe A's disc → A; inside lobe B's → B;
 * otherwise the side of the axis line A's half of the disc lies on.
 *
 * PARTS: `curve` (the S, a Line — draws on as one stroke), `outer` (the
 * enclosing circle, f11071 — 0 hides it), `arrow` (across the waist, along
 * the axis from A to B, `arrowLength`·R long, centred on the touching
 * point: f5851 thick, f6961 thin), and the two fields (Polylines).
 *
 * PURE: every point is a closed function of the params; nothing simulates.
 */

import { Circle, Line, Null, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { Polylines, deriveLoops } from "../../src/parts/polylines"
import { angle, choice, color, completion, integer, length, scalar } from "../../src/params"
import { BLUE, RED, TAU, WHITE } from "../../src/constants"
import { restage, together, type Anim } from "../../src/anim"
import { axis, type StateSpace } from "../../src/automaton"
import type { Overrides } from "../../src/holon"

export const FIELDS = ["none", "grid", "flower"] as const
export type FieldKind = (typeof FIELDS)[number]

/** f5851: the arrow across the waist, ≈ 100 px of the S's 310 px R. */
export const ARROW_LENGTH = 0.32
/** f5581, in units of R (760 px): grid spacing 124 px, flower radius 115 px. */
export const GRID_CELL = 124 / 760
export const FLOWER_CELL = 115 / 760
/** f5851 / f10951 / f5581: the axis from lobe A (lower-left) to lobe B. */
export const FILM_TURN = TAU / 8

interface P {
  x: number
  y: number
}

/**
 * The divider as one polyline, local and UNROTATED, for lobe A's share
 * `split` of the diameter 2R: lobe A (radius split·R, centred at (−rB, 0))
 * from its rim point (−R, 0) under its centre to the touching point, then
 * lobe B (the rest, centred at (rA, 0)) over its centre to (R, 0).
 */
export const sCurve = (split: number, R: number, segments = 48): Vec3Like[] => {
  const pts: Vec3Like[] = []
  const rb = split * R
  const rr = R - rb
  for (let i = 0; i <= segments; i++) {
    const a = Math.PI + (i / segments) * Math.PI // 180° → 360°
    pts.push({ x: -rr + Math.cos(a) * rb, y: Math.sin(a) * rb, z: 0 })
  }
  for (let i = 1; i <= segments; i++) {
    const a = Math.PI - (i / segments) * Math.PI // 180° → 0°
    pts.push({ x: rb + Math.cos(a) * rr, y: Math.sin(a) * rr, z: 0 })
  }
  return pts
}

/** The S rotated by `turn` about the centre of the whole. */
export const turnedCurve = (split: number, R: number, turn: number, segments = 48): Vec3Like[] => {
  const c = Math.cos(turn)
  const s = Math.sin(turn)
  return sCurve(split, R, segments).map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: 0 }))
}

/** Where the two lobes touch, unrotated: (rA − rB, 0). */
export const waist = (split: number, R: number): number => split * R - (R - split * R)

/** Is `p` (the holon's frame) on lobe A's side of the S? (see header) */
export const onSideA = (p: P, split: number, R: number, turn: number): boolean => {
  const c = Math.cos(turn)
  const s = Math.sin(turn)
  const x = p.x * c + p.y * s
  const y = -p.x * s + p.y * c
  const ra = split * R
  const rb = R - ra
  if (Math.hypot(x + rb, y) < ra) return true
  if (Math.hypot(x - ra, y) < rb) return false
  return y > 0
}

/**
 * Cut a polyline into the runs that lie on the wanted side, each cut
 * point found by bisection along its segment (so a run ends ON the S).
 */
export const clipRuns = (pts: readonly P[], inside: (p: P) => boolean): Vec3Like[][] => {
  const runs: Vec3Like[][] = []
  let run: Vec3Like[] | null = null
  const edge = (a: P, b: P, aIn: boolean): P => {
    let lo = 0
    let hi = 1
    for (let k = 0; k < 14; k++) {
      const m = (lo + hi) / 2
      const q = { x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m }
      if (inside(q) === aIn) lo = m
      else hi = m
    }
    const m = (lo + hi) / 2
    return { x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m }
  }
  let prev: P | null = null
  let prevIn = false
  for (const p of pts) {
    const pin = inside(p)
    if (prev && pin !== prevIn) {
      const q = edge(prev, p, prevIn)
      if (run) {
        run.push({ x: q.x, y: q.y, z: 0 })
        if (run.length > 1) runs.push(run)
        run = null
      } else run = [{ x: q.x, y: q.y, z: 0 }]
    }
    if (pin) {
      if (!run) run = []
      run.push({ x: p.x, y: p.y, z: 0 })
    }
    prev = p
    prevIn = pin
  }
  if (run && run.length > 1) runs.push(run)
  return runs
}

/** The square grid: lines `cell` apart filling the square of half-size `reach`. */
export const gridLines = (cell: number, reach: number): P[][] => {
  const out: P[][] = []
  const n = Math.ceil(reach / cell)
  const step = cell / 6
  const m = Math.ceil((2 * reach) / step)
  for (let k = -n; k <= n; k++) {
    const v = (k + 0.5) * cell
    if (Math.abs(v) > reach) continue
    out.push(Array.from({ length: m + 1 }, (_, i) => ({ x: v, y: -reach + i * step })))
    out.push(Array.from({ length: m + 1 }, (_, i) => ({ x: -reach + i * step, y: v })))
  }
  return out
}

/** The flower of life: circles of radius `cell` centred on a triangular
 *  lattice of the same spacing (columns vertical), those reaching into the
 *  square of half-size `reach`. */
export const flowerCircles = (cell: number, reach: number, samples = 48): P[][] => {
  const out: P[][] = []
  const dx = cell * Math.cos(TAU / 12)
  const nx = Math.ceil((reach + cell) / dx)
  const ny = Math.ceil((reach + cell) / cell) + 1
  for (let i = -nx; i <= nx; i++) {
    for (let j = -ny; j <= ny; j++) {
      const cx = i * dx
      const cy = (j + (Math.abs(i) % 2) / 2) * cell
      if (Math.abs(cx) > reach + cell || Math.abs(cy) > reach + cell) continue
      out.push(
        Array.from({ length: samples + 1 }, (_, k) => {
          const a = (k / samples) * TAU
          return { x: cx + Math.cos(a) * cell, y: cy + Math.sin(a) * cell }
        }),
      )
    }
  }
  return out
}

export class Divide extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** R — half the S's span (the enclosing circle's radius). */
  radius = length(400)
  /** Lobe A's share of the diameter; B has the rest. */
  split = completion(0.5)
  /** The axis from lobe A to lobe B (0: A left, B right; the film: τ/8). */
  turn = angle(0)
  tint = color(WHITE)
  stroke = length(1.6)
  /** Samples per half-circle. */
  segments = integer(48)
  /** The enclosing circle (the closed yin-yang, f11071): its draw-on. */
  outer = completion(0)
  outerTint = color(WHITE)
  outerStroke = length(1.6)
  /** The arrow across the waist, A → B: its draw-on. */
  arrow = completion(0)
  arrowLength = scalar(ARROW_LENGTH)
  arrowStroke = length(3)
  arrowHead = length(720 / 700)
  /** The half-fields: none | grid | flower (read at construction). */
  fieldA = choice("none", FIELDS)
  fieldB = choice("none", FIELDS)
  tintA = color(BLUE)
  tintB = color(RED)
  /** The fields' strength (the film's are very dim). */
  fieldOpacity = completion(0.12)
  fieldStroke = length(2)
  /** Grid spacing / flower radius, in units of R (f5581). */
  gridCell = scalar(GRID_CELL)
  flowerCell = scalar(FLOWER_CELL)
  /** Half-size of the square the fields fill, in units of R. */
  fieldReach = scalar(1)

  curve!: Line
  outerRing!: Circle
  arrowLine!: Line
  fields: Polylines[] = []

  constructor(overrides: Overrides = {}) {
    super(overrides)
  }

  /** The S, in the holon's frame (rotated). */
  points(): Vec3Like[] {
    return turnedCurve(this.split.value, this.radius.value, this.turn.value, Math.max(2, Math.round(this.segments.value)))
  }

  protected override compose(): void {
    const geomKey = () => [this.split.value, this.radius.value, this.turn.value]

    // The fields under everything.
    const field = (kind: string, tint: typeof this.tintA, sideA: boolean): void => {
      if (kind === "none") return
      const lines = new Polylines({ tint, stroke: this.fieldStroke, opacity: this.fieldOpacity })
      deriveLoops(
        lines,
        () => [...geomKey(), this.gridCell.value, this.flowerCell.value, this.fieldReach.value],
        () => {
          const R = this.radius.value
          const reach = this.fieldReach.value * R
          const src = kind === "grid" ? gridLines(this.gridCell.value * R, reach) : flowerCircles(this.flowerCell.value * R, reach)
          const inside = (p: P) =>
            Math.abs(p.x) <= reach &&
            Math.abs(p.y) <= reach &&
            onSideA(p, this.split.value, R, this.turn.value) === sideA
          return src.flatMap((pl) => clipRuns(pl, inside))
        },
      )
      this.fields.push(this.add(lines))
    }
    field(this.fieldA.value, this.tintA, true)
    field(this.fieldB.value, this.tintB, false)

    this.curve = this.add(new Line({ tint: this.tint, stroke: this.stroke }))
    derivePoints(this.curve, () => [...geomKey(), this.segments.value], () => this.points())

    this.outerRing = this.add(
      new Circle({ radius: this.radius, tint: this.outerTint, stroke: this.outerStroke, creation: this.outer }),
    )

    this.arrowLine = this.add(
      new Line({
        tint: this.tint,
        stroke: this.arrowStroke,
        arrowEnd: true,
        arrowSize: this.arrowHead,
        creation: this.arrow,
      }),
    )
    derivePoints(
      this.arrowLine,
      () => [...geomKey(), this.arrowLength.value],
      () => {
        const R = this.radius.value
        const w = waist(this.split.value, R)
        const h = (this.arrowLength.value * R) / 2
        const c = Math.cos(this.turn.value)
        const s = Math.sin(this.turn.value)
        return [
          { x: (w - h) * c, y: (w - h) * s, z: 0 },
          { x: (w + h) * c, y: (w + h) * s, z: 0 },
        ]
      },
    )
  }

  /** The fields fade up, the S draws as one stroke, then the circle and the arrow. */
  override createAnim(): Anim {
    void this.parts
    const fieldTo = this.fieldOpacity.value
    return together(
      ...this.fields.map((f) => restage(f.creation.sequence(0, 1), 0, 0.3) as Anim),
      ...(this.fieldOpacity.isBound ? [] : [restage(this.fieldOpacity.sequence(0, fieldTo), 0, 0.6) as Anim]),
      restage(this.curve.creation.sequence(0, 1), 0, 0.8),
      ...(this.outer.value > 0 && !this.outer.isBound ? [restage(this.outer.sequence(0, this.outer.value), 0.3, 1) as Anim] : []),
      ...(this.arrow.value > 0 && !this.arrow.isBound ? [restage(this.arrow.sequence(0, this.arrow.value), 0.6, 1) as Anim] : []),
    )
  }

  /** Walkable: the lobes trade sizes (A small … A large). */
  override stateSpace(): StateSpace | undefined {
    if (this.split.isBound) return undefined
    return {
      axes: [axis("split", this, { "B swells": { split: 0.125 }, even: { split: 0.5 }, "A swells": { split: 0.875 } })],
    }
  }
}
