/**
 * Field — the particle field that carries the InterBrain film's mood.
 *
 * The film's ground is never empty black: behind the symbols runs a field
 * of soft streaks, and its colour IS the chapter's argument. Red, it is
 * FRAGMENTATION — "the human family … divided against itself" (0:20):
 * short, blurred red streaks flying out of a vanishing point at the viewer
 * (f556, f736, f1036). When the oscillating ball leaves the line between
 * the two pathological attractors along the orthogonal axis — "the third
 * attractor of wholeness … the natural state of unity in which the paradox
 * is resolved" (4:29–5:14) — the field stops, turns white, and a starburst
 * of cyan accelerates out of the centre while the cylinder flies through it
 * (f1561 → f1576 → f1591 → f1606 → f1621; again f11611 → f11661).
 *
 * ONE holon, three looks of the same machinery (seeded particles, each a
 * pure function of time, drawn as a handful of soft-edged Polylines):
 *
 *   warp   the field: particles on straight radial paths out of the focus,
 *          their depth falling linearly with time, so their screen radius
 *          r = ρ·reach / z grows as 1/z — the perspective "warp" in which a
 *          streak crawls near the vanishing point and races at the frame's
 *          edge. A streak is the particle's own path over a short exposure.
 *   burst  the ray-burst ring around a symbol (f12706, f12721 the liminal
 *          eye; f12016, f12136 the InterBrain sphere): thin streaks born at
 *          the rim of a circle (`radius`), travelling out and fading.
 *   swarm  the red swarm round a symbol that is being captured or is
 *          dissolving (f46 the eye, f6586 the book and tower, f6826 the
 *          boxed web): short curly strands wandering about a shape — each
 *          strand is the last fraction of a second of its particle's wander,
 *          so the curl is real motion, not a drawn squiggle. `dissolve`
 *          blows them outward and away.
 *
 * WHOLENESS IS ONE NUMBER (0..1) — the state the film morphs through:
 *
 *   0     red, fragmented: wide blurred streaks, their directions a little
 *         off the radial (things not quite pointing the same way).
 *   0.5   white: the field holds its breath — every streak shrinks to a dot.
 *   1     cyan, whole: a wave of acceleration has spread from the centre
 *         out (`WAVE_REACH`); inside it the streaks are long, crisp and
 *         exactly radial, and the dots beyond it are still waiting (f1621:
 *         streaks in the middle, dots at the rim).
 *
 * Wholeness changes colour, focus (softness), streak length and alignment —
 * never a particle's PHASE, so turning the field whole never makes a
 * particle jump: every particle stays on its own path at its own place.
 *
 * PURE AND SCRUBBABLE (TASTE; the `geometry/flower.ts` principle): no
 * simulation state. Particle i's angle, lateral radius, speed and phase are
 * seeded hashes of i (`hashUnit`); its place at `time` is a closed formula.
 * Scrub `time` back and the field runs back; render twice and the pixels
 * agree. `time` is a clock (src/automaton.ts) — in free play it keeps
 * running. `speed` scales the clock; change it while still, or advance
 * `time` faster instead, since a jump in speed re-phases every particle.
 *
 * CHEAP: the whole field is BINS × LAYERS Polylines (src/parts/polylines.ts,
 * many lines as one stroke) — 16 draws whatever the count. A particle falls
 * into one of BINS brightness bins (its depth / its age), each bin a core
 * stroke plus three wider, fainter strokes of the same lines. Ribbons
 * composite by MAX, so the three nest into one soft-edged streak with a
 * bright core — the blurred look of the film without a blur pass.
 *
 * The field draws in its own plane in its own coordinates; `reach` is the
 * radius it fills (at the default framing — 0.48 px per unit at 720p —
 * 1600 units clears the corners).
 */

import { RED, WHITE, seen, type Color } from "../../src/constants"
import type { Overrides } from "../../src/holon"
import { choice, completion, derive, length, scalar } from "../../src/params"
import { Stroke, type Vec3Like } from "../../src/parts/primitives"
import { Polylines, deriveLoops } from "../../src/parts/polylines"
import { hashUnit, type Vec2 } from "../../src/geometry/flower"
import { smooth } from "../../src/geometry/flowmap"
import { clamp01, lerp } from "../../src/math"
import { axis, type StateSpace } from "../../src/automaton"
import type { Anim } from "../../src/anim"

/**
 * The cyan of wholeness, measured on the film (f1621, the brightest 0.5 % of
 * the starburst's streak cores: rgb 170 235 240). Not in the red/blue/white
 * palette because the film's wholeness is not blue: it is the cyan the red
 * field turns into, and only the Field carries it.
 */
export const CYAN: Color = seen(170, 238, 242)

export const FIELD_MODES = ["warp", "burst", "swarm"] as const
export type FieldMode = (typeof FIELD_MODES)[number]

/** Brightness bins (one stroke set each) and the soft layers per bin. */
export const BINS = 4
export const LAYERS = 4
/** Each bin's alpha and width, dimmest/farthest first. */
const BIN_ALPHA = [0.3, 0.52, 0.76, 1]
const BIN_WIDTH = [0.6, 0.78, 1, 1.25]

/** Warp depth range (arbitrary units: screen radius = ρ·reach / z). */
export const Z_NEAR = 1
export const Z_FAR = 4
/** Seconds for a warp particle to travel far → near at speed 1. */
const WARP_PERIOD = 5
/** Lateral radius range at z = 1, in units of `reach`. */
const RHO_MIN = 0.06
const RHO_MAX = 1.5
/** Exposure of a warp streak, seconds of its own path (red state). */
const EXPOSURE = 0.25
/** Streak length at the white pause, as a fraction of the red length. */
const PAUSE_STRETCH = 0.15
/** Inside the wave of wholeness, as a multiple of the red length. */
const WHOLE_STRETCH = 4
/** How far the wave has spread at wholeness 1, in units of `reach`. */
export const WAVE_REACH = 0.5
/** The red field's misalignment: max angle off the radial, radians. */
const JITTER = 0.32

/** Burst: seconds for a ray to travel out, at speed 1. */
const BURST_PERIOD = 1.6
/** Swarm: seconds of wander a strand shows, and its samples. */
const STRAND_SPAN = 0.15
const STRAND_POINTS = 6

/** The field's colour along wholeness: red → white → cyan. */
export const fieldColor = (wholeness: number): Color => {
  const w = clamp01(wholeness)
  const [a, b, u] = w < 0.5 ? [RED, WHITE, w / 0.5] : [WHITE, CYAN, (w - 0.5) / 0.5]
  return { r: lerp(a.r, b.r, u), g: lerp(a.g, b.g, u), b: lerp(a.b, b.b, u) }
}

/**
 * The soft layers, core first: width (× `stroke`) and alpha at fragmentation
 * (red) and at wholeness (cyan). Ribbons composite by MAX, so the four nest
 * into one streak whose light falls off from the centreline — a stepped
 * gaussian. Red is OUT OF FOCUS (f736 at 1:1: a ~16 px dim body with a thin
 * brighter thread down its middle); cyan is IN FOCUS (f1621: a bright ~3 px
 * core in a narrow teal halo). Alphas are LINEAR light (the host encodes
 * for display), which is why the red body's 0.13 reads as the film's dim
 * (100, 35, 25) and not as a twentieth of it.
 */
const LAYER_RED = [
  { width: 0.6, alpha: 0.3 },
  { width: 2.2, alpha: 0.14 },
  { width: 3.8, alpha: 0.06 },
  { width: 5.6, alpha: 0.022 },
]
const LAYER_WHOLE = [
  { width: 1, alpha: 1 },
  { width: 1.8, alpha: 0.5 },
  { width: 2.8, alpha: 0.25 },
  { width: 4, alpha: 0.1 },
]

/** One layer's look along wholeness: width (× stroke), alpha, tint. */
export const layerLook = (
  layer: number,
  wholeness: number,
  sharp = 0,
): { width: number; alpha: number; tint: Color } => {
  // In focus: as wholeness brings it, or as `sharp` insists (a swarm is red AND crisp).
  const f = Math.max(smooth(0.3, 1, wholeness), clamp01(sharp))
  const a = LAYER_RED[layer]!
  const b = LAYER_WHOLE[layer]!
  const c = fieldColor(wholeness)
  // The core thread is the colour lifted toward white; the halos are the
  // colour deepened (c², as glow.ts's aura: light that travelled further
  // keeps its hue and loses its white).
  const tint =
    layer === 0
      ? { r: lerp(c.r, 1, 0.2 * (1 - f)), g: lerp(c.g, 1, 0.2 * (1 - f)), b: lerp(c.b, 1, 0.2 * (1 - f)) }
      : { r: lerp(c.r, c.r * c.r, 0.6), g: lerp(c.g, c.g * c.g, 0.6), b: lerp(c.b, c.b * c.b, 0.6) }
  return { width: lerp(a.width, b.width, f), alpha: lerp(a.alpha, b.alpha, f), tint }
}

/** Everything a field's geometry is a pure function of. */
export interface FieldState {
  mode: FieldMode
  time: number
  wholeness: number
  /** Fraction of the particles shown (a stable subset: lower keeps a subset of higher). */
  density: number
  speed: number
  focusX: number
  focusY: number
  /** warp: the radius filled; burst: how far rays travel past the rim; swarm: the cloud's spread. */
  reach: number
  /** burst: the rim the rays leave; swarm: the default circle the swarm hugs. */
  radius: number
  /** swarm: 0 = hugging the shape, 1 = blown away. */
  dissolve: number
  count: number
  seed: number
  /** swarm: the shape's outlines (closed polylines); default a circle of `radius`. */
  shape?: readonly (readonly Vec2[])[]
}

/** One streak: its polyline and its brightness bin. */
export interface Streak {
  points: Vec2[]
  bin: number
}

const fract = (x: number): number => x - Math.floor(x)
const binOf = (brightness: number): number => Math.min(BINS - 1, Math.floor(brightness * BINS))
/** Brightness below which a streak is not drawn at all. */
const CUTOFF = 0.05

/** The particle's stable hashes: channel c of particle i. */
const H = (i: number, c: number, seed: number) => hashUnit(i, c, seed)

/** Is particle i in the shown subset? The subset is nested: lower density ⊂ higher. */
const shown = (i: number, s: FieldState) => H(i, 0, s.seed) < s.density

/**
 * WARP — the depth of particle i at `time` and its screen radius.
 * z falls linearly from Z_FAR to Z_NEAR over the period, then wraps.
 */
export const warpParticle = (i: number, s: FieldState): { theta: number; rho: number; phase: number; z: number } => {
  const theta = H(i, 1, s.seed) * Math.PI * 2
  const rho = RHO_MIN + (RHO_MAX - RHO_MIN) * Math.pow(H(i, 2, s.seed), 0.75)
  const rate = 0.75 + 0.5 * H(i, 3, s.seed)
  const phase = fract(H(i, 4, s.seed) + (s.time * s.speed * rate) / WARP_PERIOD)
  return { theta, rho, phase, z: Z_FAR + (Z_NEAR - Z_FAR) * phase }
}

/** How far the wave of wholeness has spread (units of reach), 0 before w = 0.5. */
export const waveFront = (wholeness: number): number => Math.max(0, (wholeness - 0.5) / 0.5) * WAVE_REACH

const warpStreaks = (s: FieldState, out: Streak[]): void => {
  const w = clamp01(s.wholeness)
  const organised = smooth(0.25, 0.75, w)
  const W = waveFront(w)
  const dzdt = ((Z_FAR - Z_NEAR) / WARP_PERIOD) * s.speed
  for (let i = 0; i < s.count; i++) {
    if (!shown(i, s)) continue
    const p = warpParticle(i, s)
    const r = (p.rho * s.reach) / p.z
    const rn = r / s.reach
    if (rn > 1.1) continue
    // Streak length: red → a dot at the pause → long inside the wave.
    const inWave = smooth(W, W - 0.35, rn)
    const stretch = w <= 0.5 ? lerp(1, PAUSE_STRETCH, w / 0.5) : lerp(PAUSE_STRETCH, WHOLE_STRETCH, inWave)
    const rate = 0.75 + 0.5 * H(i, 3, s.seed)
    const zTail = Math.min(Z_FAR, p.z + dzdt * rate * EXPOSURE * stretch)
    const rTail = (p.rho * s.reach) / zTail
    // Brightness: fades in out of the distance, brighter as it nears.
    const near = (Z_FAR / p.z - 1) / (Z_FAR / Z_NEAR - 1)
    const b = smooth(0, lerp(0.3, 0.08, organised), p.phase) * (0.3 + 0.7 * Math.sqrt(near)) * smooth(1.1, 0.95, rn)
    if (b < CUTOFF) continue
    const dir = p.theta + (1 - organised) * (H(i, 5, s.seed) - 0.5) * 2 * JITTER
    const hx = s.focusX + r * Math.cos(p.theta)
    const hy = s.focusY + r * Math.sin(p.theta)
    const len = r - rTail
    out.push({
      points: [
        { x: hx - len * Math.cos(dir), y: hy - len * Math.sin(dir) },
        { x: hx, y: hy },
      ],
      bin: binOf(b),
    })
  }
}

/** BURST — rays born just inside the rim, travelling out and fading. */
const burstStreaks = (s: FieldState, out: Streak[]): void => {
  for (let i = 0; i < s.count; i++) {
    if (!shown(i, s)) continue
    const theta = H(i, 1, s.seed) * Math.PI * 2
    const rate = 0.7 + 0.6 * H(i, 3, s.seed)
    const p = fract(H(i, 4, s.seed) + (s.time * s.speed * rate) / BURST_PERIOD)
    const far = 0.35 + 0.65 * H(i, 2, s.seed) // how far this ray gets
    const r0 = s.radius * (0.55 + 0.4 * H(i, 6, s.seed))
    const r = r0 + s.reach * far * Math.pow(p, 0.8)
    const len = s.reach * (0.025 + 0.06 * p) * (0.5 + H(i, 7, s.seed))
    const b = smooth(0, 0.08, p) * Math.pow(1 - p, 0.6) * (0.45 + 0.55 * H(i, 8, s.seed))
    if (b < CUTOFF) continue
    const c = Math.cos(theta)
    const sn = Math.sin(theta)
    const rt = Math.max(r0, r - len)
    out.push({
      points: [
        { x: s.focusX + rt * c, y: s.focusY + rt * sn },
        { x: s.focusX + r * c, y: s.focusY + r * sn },
      ],
      bin: binOf(b),
    })
  }
}

/** The outline a swarm hugs, sampled by arc length: point and outward normal. */
const outlineSampler = (s: FieldState): ((u: number) => { p: Vec2; n: Vec2 }) => {
  const loops = s.shape?.filter((l) => l.length > 1)
  if (!loops || loops.length === 0) {
    return (u) => {
      const a = u * Math.PI * 2
      return { p: { x: s.focusX + s.radius * Math.cos(a), y: s.focusY + s.radius * Math.sin(a) }, n: { x: Math.cos(a), y: Math.sin(a) } }
    }
  }
  const segs: { a: Vec2; b: Vec2; at: number; len: number }[] = []
  let total = 0
  let cx = 0
  let cy = 0
  let k = 0
  for (const loop of loops) {
    for (let j = 1; j < loop.length; j++) {
      const a = loop[j - 1]!
      const b = loop[j]!
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      segs.push({ a, b, at: total, len })
      total += len
      cx += a.x
      cy += a.y
      k++
    }
  }
  cx /= k
  cy /= k
  return (u) => {
    const target = u * total
    let lo = 0
    let hi = segs.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (segs[mid]!.at <= target) lo = mid
      else hi = mid - 1
    }
    const g = segs[lo]!
    const f = g.len > 0 ? (target - g.at) / g.len : 0
    const p = { x: s.focusX + g.a.x + (g.b.x - g.a.x) * f, y: s.focusY + g.a.y + (g.b.y - g.a.y) * f }
    // Outward: away from the shape's centre (robust for any winding).
    const ox = p.x - s.focusX - cx
    const oy = p.y - s.focusY - cy
    const on = Math.hypot(ox, oy) || 1
    return { p, n: { x: ox / on, y: oy / on } }
  }
}

/** SWARM — curly strands wandering about a shape; `dissolve` blows them away. */
const swarmStreaks = (s: FieldState, out: Streak[]): void => {
  const at = outlineSampler(s)
  const spread = s.reach
  for (let i = 0; i < s.count; i++) {
    if (!shown(i, s)) continue
    const { p, n } = at(H(i, 1, s.seed))
    const side = H(i, 2, s.seed) * 2 - 1
    const off = Math.sign(side) * Math.pow(Math.abs(side), 1.6) * spread
    // The wander: two incommensurate wobbles per axis — a strand's curl.
    const w1 = 2.5 + 3 * H(i, 3, s.seed)
    const w2 = 2.5 + 3 * H(i, 4, s.seed)
    const f1 = H(i, 5, s.seed) * 6.283
    const f2 = H(i, 6, s.seed) * 6.283
    const amp = spread * (0.35 + 0.4 * H(i, 7, s.seed))
    const fly = s.dissolve * spread * (3 + 5 * H(i, 8, s.seed))
    const fade = Math.pow(1 - clamp01(s.dissolve), 0.6 + H(i, 9, s.seed))
    const b = (0.4 + 0.6 * H(i, 10, s.seed)) * fade
    if (b < CUTOFF) continue
    const points: Vec2[] = []
    for (let k = 0; k < STRAND_POINTS; k++) {
      const t = s.time * s.speed - (k / (STRAND_POINTS - 1)) * STRAND_SPAN
      const ux = amp * (Math.sin(w1 * t + f1) + 0.45 * Math.sin(2.9 * w1 * t + f2))
      const uy = amp * (Math.cos(w2 * t + f2) + 0.45 * Math.cos(3.3 * w2 * t + f1))
      const d = off + fly * (1 - (k / (STRAND_POINTS - 1)) * 0.15)
      points.push({ x: p.x + n.x * d + ux, y: p.y + n.y * d + uy })
    }
    out.push({ points, bin: binOf(b) })
  }
}

/** Every streak of the field at its state — the pure heart of the holon. */
export const fieldStreaks = (s: FieldState): Streak[] => {
  const out: Streak[] = []
  if (s.density <= 0 || s.count <= 0) return out
  if (s.mode === "warp") warpStreaks(s, out)
  else if (s.mode === "burst") burstStreaks(s, out)
  else swarmStreaks(s, out)
  return out
}

/** The streaks sorted into their bins, as the Polylines' loops. */
export const binnedLoops = (streaks: readonly Streak[]): Vec3Like[][][] => {
  const bins: Vec3Like[][][] = Array.from({ length: BINS }, () => [])
  for (const st of streaks) bins[st.bin]!.push(st.points.map((p) => ({ x: p.x, y: p.y, z: 0 })))
  return bins
}

export class Field extends Stroke {
  /** ONTOLOGY.md: a sovereign symbol — the film's ground. */
  static sovereign = true

  /** warp (the field), burst (rays round a rim), swarm (strands round a shape). */
  mode = choice("warp", FIELD_MODES)
  /** Seconds of flow — a clock; advance it linearly and the field runs. */
  time = scalar(0)
  /** Fragmentation (0, red) → the white pause (0.5) → wholeness (1, cyan). */
  wholeness = completion(0)
  /** Fraction of the particles shown (nested subsets — thinning never reshuffles). */
  density = completion(1)
  /** Multiplies the clock. */
  speed = scalar(1)
  /** The vanishing point (warp), the burst's / default swarm circle's centre. */
  focusX = scalar(0)
  focusY = scalar(0)
  /** warp: radius filled; burst: how far rays travel past the rim; swarm: the cloud's spread. */
  reach = length(1600)
  /** burst: the rim the rays leave; swarm: the circle hugged when no shape is given. */
  radius = length(200)
  /** swarm: 0 hugging, 1 blown away. */
  dissolve = completion(0)
  /**
   * In focus regardless of wholeness: 0 = the red field's blur, 1 = crisp.
   * The swarm's strands are red and near-crisp (f46), so a swarm defaults to 0.6.
   */
  sharp = completion(0)
  // `stroke` (inherited): the core width in screen px; the halos scale from it.

  /** The bins' layers: layers[bin][layer] (layer 0 the core). */
  layers: Polylines[][] = []

  private readonly config: { count: number; seed: number; shape?: readonly (readonly Vec2[])[] }
  private memo: { key: readonly unknown[]; bins: Vec3Like[][][] } | undefined

  constructor(
    overrides: Overrides & {
      /** Particles in the field (default: warp 1100, burst 1400, swarm 140). */
      count?: number
      seed?: number
      /** swarm: the outlines to hug, in this holon's plane (closed polylines). */
      shape?: readonly (readonly Vec2[])[]
    } = {},
  ) {
    const { count, seed, shape, ...rest } = overrides
    // A swarm is near-crisp by default (f46); the warp and burst follow wholeness.
    const swarm = (rest as { mode?: unknown }).mode === "swarm"
    super({ stroke: 3, ...(swarm ? { sharp: 0.6 } : {}), ...rest })
    const mode = this.mode.value as FieldMode
    this.config = {
      count: count ?? (mode === "warp" ? 1100 : mode === "burst" ? 1400 : 140),
      seed: seed ?? 7,
      shape,
    }
  }

  /** The state the geometry reads — `creation` thins the field in (a reveal). */
  state(): FieldState {
    return {
      mode: this.mode.value as FieldMode,
      time: this.time.value,
      wholeness: this.wholeness.value,
      // Unseen (faded out) draws nothing — and computes nothing.
      density: this.opacity.value > 0 ? this.density.value * this.creation.value : 0,
      speed: this.speed.value,
      focusX: this.focusX.value,
      focusY: this.focusY.value,
      reach: this.reach.value,
      radius: this.radius.value,
      dissolve: this.dissolve.value,
      ...this.config,
    }
  }

  private key(): readonly unknown[] {
    return [
      this.mode.value,
      this.time.value,
      this.wholeness.value,
      this.density.value,
      this.creation.value,
      this.opacity.value > 0,
      this.speed.value,
      this.focusX.value,
      this.focusY.value,
      this.reach.value,
      this.radius.value,
      this.dissolve.value,
    ]
  }

  /** The binned loops, computed once per state for all the bins' layers. */
  private bins(): Vec3Like[][][] {
    const key = this.key()
    if (!this.memo || this.memo.key.some((v, i) => v !== key[i])) {
      this.memo = { key, bins: binnedLoops(fieldStreaks(this.state())) }
    }
    return this.memo.bins
  }

  /** In free play the field keeps flowing; wholeness is its one state axis. */
  override stateSpace(): StateSpace {
    return {
      axes: [axis("wholeness", this, { fragmented: { wholeness: 0 }, whole: { wholeness: 1 } }, { duration: 3, handles: [this] })],
      clocks: [this.time],
    }
  }

  /** Create: the particles thin in (creation is the shown fraction). */
  override createAnim(): Anim {
    return this.creation.sequence(0, 1)
  }

  protected override compose(): void {
    for (let b = 0; b < BINS; b++) {
      const row: Polylines[] = []
      for (let l = 0; l < LAYERS; l++) {
        const lines = new Polylines({
          tint: derive(() => layerLook(l, this.wholeness.value, this.sharp.value).tint),
          stroke: derive(() => this.stroke.value * BIN_WIDTH[b]! * layerLook(l, this.wholeness.value, this.sharp.value).width),
          // A Polylines' opacity is its own (the host does not inherit a parent's), so the field's is multiplied in.
          opacity: derive(() => this.opacity.value * BIN_ALPHA[b]! * layerLook(l, this.wholeness.value, this.sharp.value).alpha),
        })
        deriveLoops(lines, () => this.key(), () => this.bins()[b]!)
        row.push(this.add(lines))
      }
      this.layers.push(row)
    }
  }
}
