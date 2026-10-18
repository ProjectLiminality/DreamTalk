/**
 * Resonance — the dashed cyan rings that travel out round a mind, a tribe,
 * a DreamNode: resonance made visible.
 *
 * IMPORTING THIS MODULE TEACHES EVERY STROKE `.resonate()` (the one
 * sanctioned side-effect import, the ability pattern: DECISIONS.md
 * 2026-09-07; vocabulary/Morph/README.md §"The template"; GeometrySketch is
 * the nearest sibling, and this file copies its shape).
 *
 *     import "../../vocabulary/Resonance/Resonance"
 *     const { resonance, anim } = mind.frame.resonate({ amount: 1 })
 *     this.stage(resonance)
 *     this.play(together(anim, resonance.time.by(4, { easing: "linear" })), 4)
 *
 * THE CONCEPT. "Inspiring visions travel faster and further" (20:19): round
 * every liminal mind of the ancient tribe the rings run out (f6106, f6121);
 * in the liminal web a node's resonance spreads through its neighbours
 * (f10321, f11161, f11221, f11371) — "those who resonate … the best measure
 * for the coherence of the song" (37:14).
 *
 * THE LOOK, read off the frames. A ring is not a line: it is a band of
 * short RADIAL ticks, each its own length — a sound wave wrapped round a
 * circle (f6106: round a mind of radius R the band runs 1.55R–1.97R, ticks
 * from a tenth to half of R). It is born at the rim and travels out; as it
 * travels it thins, its ticks shorten and fall away and it fades (f6121: far
 * out, a sparse dotted ring). Cyan — the wholeness cyan of the Field.
 *
 * ABILITY + HOLON, like GeometrySketch. The rings are scene state (strokes,
 * a clock), so they live in a holon, `Resonance`, that sits in the arena as
 * a sibling of what it rings, centred on it. The graft `.resonate()` builds
 * one for any shape with an outline (circles above all; a square or polygon
 * rings by its mean radius): centre and radius are read from the shape's
 * WORLD outline every frame, so the rings follow it as it moves or grows.
 * A group — a tribe, a web — is rung by placing a Resonance yourself
 * (`new Resonance({ radius, x, y })`): the group has no outline of its own.
 *
 * PURE AND SCRUBBABLE (the Field principle): ring k's age at `time` is
 * fract(time·speed/PERIOD + k/rings); every tick's angle, length and
 * survival are seeded hashes of (tick, ring, the ring's generation), so a
 * ring keeps its waveform for its whole life and a new one is drawn at
 * every rebirth. Scrub `time` back and the rings run back.
 *
 * PARAMS
 *   amount   0..1  how strongly it resonates: the rings' brightness AND how
 *                  far they travel (further and brighter — 20:19). 0 none.
 *   rings    integer  rings alive at once, evenly staggered (default 3)
 *   dash     integer  ticks round a fresh ring (default 140)
 *   speed    scalar   multiplies the clock (a ring lives PERIOD/speed s)
 *   tint     colour   CYAN
 *   radius   length   the rim the rings are born at
 *   reach    scalar   how far a ring travels at full amount, in radii (2.2)
 *   band     scalar   a fresh ring's longest tick, in radii (0.45)
 *   time     clock    seconds; advance it linearly and the rings travel
 */

import { Stroke, type Vec3Like } from "../../src/parts/primitives"
import { Polylines, deriveLoops } from "../../src/parts/polylines"
import { color, completion, derive, integer, length, scalar } from "../../src/params"
import { TAU } from "../../src/constants"
import { clamp01 } from "../../src/math"
import { Create } from "../../src/verbs"
import type { Overrides } from "../../src/holon"
import type { Anim } from "../../src/anim"
import type { StateSpace } from "../../src/automaton"
import { axis } from "../../src/automaton"
import { hashUnit } from "../../src/geometry/flower"
import { outlineOf, worldOutlineOf } from "../../src/geometry/morph"
import { CYAN } from "../Field/Field"

/** The look, in units of the rim radius (see header; f6106, f6121). */
export const RESONANCE = {
  /** Seconds a ring lives at speed 1. */
  period: 3,
  /** Where a fresh ring's band is centred, past the rim (f6106: the band 1.55–1.97R). */
  birth: 0.6,
  /** The shortest tick, as a share of the band's. */
  minTick: 0.2,
  /** Of a ring's ticks, the share still standing when it dies (sparser far out, f6121). */
  survive: 0.35,
} as const

/** A ring's look at age a ∈ [0,1): band length, tick survival, brightness. */
export const ringAt = (a: number, band = 0.45): { band: number; keep: number; alpha: number } => {
  const u = clamp01(a)
  return {
    band: band * (1 - 0.8 * u),
    keep: 1 - (1 - RESONANCE.survive) * u,
    // Fades in over its first tenth (born from the rim, not popped), out over its life.
    alpha: clamp01(u / 0.06) * (1 - u) ** 0.9,
  }
}

/** Everything the rings' geometry is a function of. */
export interface ResonanceState {
  time: number
  speed: number
  rings: number
  dash: number
  radius: number
  reach: number
  amount: number
  band: number
}

/** Ring k's age in [0,1) and generation (how many times it has been reborn). */
export const ringAge = (s: ResonanceState, k: number): { age: number; gen: number } => {
  const v = (s.time * s.speed) / RESONANCE.period + k / Math.max(1, s.rings)
  const gen = Math.floor(v)
  return { age: v - gen, gen }
}

/** Ring k's ticks: radial segments in the holon's plane. */
export const ringTicks = (s: ResonanceState, k: number): Vec3Like[][] => {
  const { age, gen } = ringAge(s, k)
  const look = ringAt(age, s.band)
  const R = s.radius
  const travel = s.reach * (0.35 + 0.65 * clamp01(s.amount))
  const mid = R * (1 + RESONANCE.birth + travel * age)
  const seed = 1009 * k + 7919 * gen + 3
  const n = Math.max(3, Math.round(s.dash))
  const out: Vec3Like[][] = []
  for (let i = 0; i < n; i++) {
    if (hashUnit(i, 2, seed) > look.keep) continue
    const a = ((i + 0.6 * (hashUnit(i, 0, seed) - 0.5)) / n) * TAU
    const len = R * look.band * (RESONANCE.minTick + (1 - RESONANCE.minTick) * hashUnit(i, 1, seed))
    const r0 = mid - len / 2
    const r1 = mid + len / 2
    const c = Math.cos(a)
    const sn = Math.sin(a)
    out.push([
      { x: c * r0, y: sn * r0, z: 0 },
      { x: c * r1, y: sn * r1, z: 0 },
    ])
  }
  // Never empty (the host keeps a stroke it first sees with geometry).
  if (out.length === 0) out.push([{ x: mid, y: 0, z: 0 }, { x: mid + 1e-3, y: 0, z: 0 }])
  return out
}

/** Can this shape resonate? It must carry one outline (a circle, square, polygon, line…). */
export const isResonant = (shape: unknown): shape is Stroke => shape instanceof Stroke && outlineOf(shape) !== undefined

/** A shape's world-space centre and mean radius, read off its outline. */
const ringOf = (shape: Stroke): { x: number; y: number; z: number; r: number } => {
  const pts = worldOutlineOf(shape) ?? []
  const body = pts.length > 1 ? pts.slice(0, -1) : pts
  const n = Math.max(1, body.length)
  const x = body.reduce((s, p) => s + p.x, 0) / n
  const y = body.reduce((s, p) => s + p.y, 0) / n
  const z = body.reduce((s, p) => s + p.z, 0) / n
  const r = body.reduce((s, p) => s + Math.hypot(p.x - x, p.y - y, p.z - z), 0) / n
  return { x, y, z, r }
}

export class Resonance extends Stroke {
  /** ONTOLOGY.md: a sovereign symbol — the look of resonance. */
  static sovereign = true

  /** 0 none … 1 full: brighter and further (20:19). */
  amount = completion(1)
  /** Rings alive at once. */
  rings = integer(3)
  /** Ticks round a fresh ring. */
  dash = integer(140)
  /** Multiplies the clock. */
  speed = scalar(1)
  /** The rim the rings are born at. */
  radius = length(150)
  /** How far a ring travels at full amount, in radii. */
  reach = scalar(2.2)
  /** A fresh ring's band — its longest tick — in radii (0.45 round a mind, f6106; thin round a whole group, f6121). */
  band = scalar(0.45)
  /** Seconds — a clock (src/automaton.ts); in free play it keeps running. */
  time = scalar(0)
  override tint = color(CYAN)

  /** One Polylines per ring (each fades on its own age). */
  ringLines: Polylines[] = []
  /** The shape it rings, when grafted (`.resonate()`); undefined for a placed one. */
  readonly source?: Stroke

  constructor(overrides: Overrides = {}, source?: Stroke) {
    if (source !== undefined && !isResonant(source)) {
      const what = (source as object)?.constructor?.name ?? typeof source
      throw new Error(
        `Resonance: a ${what} has no single outline to ring. Resonance rings a shape — a Circle, ` +
          `Square, Polygon, Ellipse, Rectangle or Line (isResonant() says which). To ring a group ` +
          `(a tribe, a web), place one yourself: new Resonance({ radius, x, y }).`,
      )
    }
    const follow = source
      ? {
          x: derive(() => ringOf(source).x),
          y: derive(() => ringOf(source).y),
          z: derive(() => ringOf(source).z),
          radius: derive(() => ringOf(source).r),
        }
      : {}
    super({ stroke: 2.2, ...follow, ...overrides })
    this.source = source
  }

  state(): ResonanceState {
    return {
      time: this.time.value,
      speed: this.speed.value,
      rings: Math.max(1, Math.round(this.rings.value)),
      dash: this.dash.value,
      radius: this.radius.value,
      reach: this.reach.value,
      amount: this.amount.value,
      band: this.band.value,
    }
  }

  protected override compose(): void {
    const n = Math.max(1, Math.round(this.rings.value))
    for (let k = 0; k < n; k++) {
      const s = () => this.state()
      const lines = new Polylines({
        tint: this.tint,
        stroke: this.stroke,
        opacity: derive(() => this.opacity.value * clamp01(this.amount.value) * this.creation.value * ringAt(ringAge(s(), k).age).alpha),
      })
      deriveLoops(
        lines,
        () => {
          const st = s()
          const { age, gen } = ringAge(st, k)
          // Ticks change only as the ring moves: key on its quantised age.
          return [Math.round(age * 600), gen, st.dash, st.radius, st.reach, st.amount, st.rings, st.band]
        },
        () => ringTicks(s(), k),
      )
      this.ringLines.push(this.add(lines))
    }
  }

  /** Walkable: silent ↔ resonating; the clock runs in free play. */
  override stateSpace(): StateSpace | undefined {
    const axes = this.amount.isBound ? [] : [axis("resonance", this, { silent: { amount: 0 }, resonating: { amount: 1 } }, { duration: 1.5, handles: [this] })]
    return { axes, clocks: this.time.isBound ? [] : [this.time] }
  }

  /** The rings fade in where they already are (creation is a gain). */
  override createAnim(): Anim {
    return this.creation.sequence(0, 1)
  }

  override unCreateAnim(): Anim {
    return this.creation.to(0)
  }
}

// ─── THE GRAFT ──────────────────────────────────────────────────────

/** What `.resonate()` hands back: the rings to stage, and their fade-in. */
export interface StagedResonance {
  resonance: Resonance
  anim: Anim
}

declare module "../../src/parts/primitives" {
  interface Stroke {
    /**
     * Ring this shape with resonance — the method spelling of
     * `new Resonance(overrides, shape)` + `Create`. The rings follow the
     * shape's world centre and radius. Returns them rather than inserting
     * them: a Dream's holons are its declared fields, so the scene stages
     * it (and advances its `time`). Available only after
     * `import "vocabulary/Resonance/Resonance"`. Throws if the shape has no
     * single outline (see isResonant).
     */
    resonate(overrides?: Overrides): StagedResonance
  }
}

Object.defineProperty(Stroke.prototype, "resonate", {
  configurable: true,
  writable: true,
  enumerable: false,
  value: function resonate(this: Stroke, overrides: Overrides = {}): StagedResonance {
    const resonance = new Resonance(overrides, this)
    return { resonance, anim: Create(resonance) }
  },
})
