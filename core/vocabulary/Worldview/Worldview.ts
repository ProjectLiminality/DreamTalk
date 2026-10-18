/**
 * Worldview — the lens we look through: the Earth on the left, a white beam
 * of light into a prism (an outlined triangle) in the middle, and a rainbow
 * out of the prism into an Eye on the right.
 *
 * THE CONCEPT (InterBrain film, 10:56–11:39). "We can never interact with
 * reality directly … we condense it into a representation we can navigate,
 * a worldview … we can only ever look through this lens, never directly at
 * it." The direct path from the world to the eye is crossed out (f3331);
 * the prism appears between them (f3361) and the light the eye receives is
 * the spectrum the lens makes of it (f3391), in a feedback loop — the
 * worldview shapes what we see and what we see shapes the worldview. Then
 * the lens is MANIPULATED (11:44, f3511–f3541): the world fragmented, a
 * narrative cube in the prism, the spectrum smeared into a pastel ribbon, a
 * "?" at the eye, a puppeteer's strings on the prism; MULTIPOLAR (f4561):
 * several fists pull, the rainbow shreds, many "?"; HEALED (ch5, ch8): the
 * eye looks AT the lens (f7606), the lens is a lattice (f7681), the world
 * a radiant DreamTalk symbol through a flower-of-life prism (f11806).
 *
 * It is NOT vocabulary/Lens (a magnifier) — same word, different symbol.
 *
 * IMPORTS, never redraws: the source is vocabulary/Earth (bare),
 * vocabulary/FragmentedEarth or vocabulary/DreamTalkSymbol (or any symbol
 * a scene hands in); the eye is video-01's vocabulary/Eye; the bolts
 * between pulling fists are vocabulary/Conflict.
 *
 * GEOMETRY, measured on f3391 (1280×720, the default eye's 0.48 px/unit),
 * local units with the origin at the centre of the prism's bounding box:
 *
 *   prism      equilateral, side 510 (245 px), apex up
 *   source     centre (−802, −61), the globe's radius 221 (106 px)
 *   eye        apex (1044, −52), gazing −x, scale 1.793 (lids 198 px);
 *              the iris is the film's: 15.7 × 33.7, no black pupil. The
 *              film opens the lids to 29.2° where video-01's Eye stops at
 *              22.5° (its `opening` is a completion, 0..1) — not yet met
 *   beam       enters the prism's left side 0.62 of the way up, 42 wide
 *              where it leaves the globe, white toward the prism and dark
 *              toward the world (f3391's brightness: 44 at the limb,
 *              full from a third of the way along)
 *   spectrum   leaves the right side 0.64 up and fans to ±82 about the eye's
 *              axis at its eyeball arc, red / green / blue top to bottom
 *              (238,79,75 · 88,236,52 · 12,163,246), darkening over its
 *              last fifth
 *
 * STATES — each one number, so it scrubs and the automaton walks it:
 *
 *   light       the beam and the spectrum (0 none, f3256)
 *   prism       the lens between: 0 the light runs straight to the eye
 *               (f3331), 1 it runs into the prism and the spectrum leaves
 *               it (f3376)
 *   direct      the two bracket arrows world → eye and back (f3301)
 *   crossed     both crossed out ✗, a "?" at the eye (f3331)
 *   loop        the feedback loop round the lens (f3391)
 *   lens        what the prism holds, in the film's order: 0 empty · 1 earth
 *               (the world in the lens, f3376) · 2 noosphere (the
 *               Noosphere's lattice sphere in the prism's place, f3451 — or
 *               any holon handed in as `lensFace`) · 3 cube (a narrative in
 *               a blue ring on a blue grid, f3541) · 4 lattice (f7681) ·
 *               5 flower (f11806); between two integers the two cross-fade
 *   distortion  the clean spectrum (0) smeared into a pastel ribbon (1),
 *               a "?" rising at the eye (f3541)
 *   strings     the puppeteer's strings on the prism (f3541)
 *   pullers     how many pull (1..5): from 2 the beams split, the ribbon
 *               shreds, bolts strike between the fists, the "?" multiply
 *               (f4561)
 *   reverse     the eye looks AT the lens: the light goes, an arrow runs
 *               from the eye to the prism (f7606)
 *   source      what the light comes from: 0 the Earth · 1 the fragmented
 *               Earth (f3541) · 2 the radiant DreamTalk symbol (f11806) ·
 *               3 face (any holon handed in as `sourceFace`, f7726)
 */

import { Circle, Group, Line, Null, Shape, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { completion, derive, length, scalar } from "../../src/params"
import { BLACK, PI, TAU, WHITE, seen, type Color } from "../../src/constants"
import type { Holon, Overrides } from "../../src/holon"
import type { Observer } from "../../src/dream"
import { clamp01, lerp } from "../../src/math"
import { presence } from "../../src/certainty"
import { ease } from "../../src/timeline"
import { together, restage, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { axis, toggle, type StateSpace } from "../../src/automaton"
import { hexPack } from "../../src/geometry/flower"
import { Recede } from "../../src/parts/recede"
import { Earth } from "../Earth/Earth"
import { Eye } from "../Eye/Eye"
import { FragmentedEarth } from "../FragmentedEarth/FragmentedEarth"
import { DreamTalkSymbol } from "../DreamTalkSymbol/DreamTalkSymbol"
import { Conflict } from "../Conflict/Conflict"
import { Puppeteer } from "../Puppeteer/Puppeteer"
import { Noosphere } from "../Noosphere/Noosphere"
import { Narrative } from "../Narrative/Narrative"

type P = { x: number; y: number }
const v3 = (p: P): Vec3Like => ({ x: p.x, y: p.y, z: 0 })

// --- the construction (f3391 unless stated; see header) ------------------

export const WV = {
  side: 510,
  source: { x: -802, y: -61, r: 221 },
  eye: { x: 1044, y: -52, scale: 1.793, irisX: 15.7, irisY: 33.7 },
  /** Where the beam enters / the spectrum leaves, as a share of the height up the side. */
  beamAt: 0.62,
  bowAt: 0.64,
  beamHalf: 21,
  bowHalf: 82,
  /** f3541: the fragmented Earth's ring (180 px) and the globe in it. */
  fragmentedRing: 375,
  /** f11806: the DreamTalk symbol's red ring (175 px). */
  radiantRing: 365,
  /** f3376: the world in the lens — r 42 px, at the prism's (640, 385). */
  lensEarth: { y: -52, r: 88 },
  /** f3541: the narrative (the `Narrative` symbol) — blue ring r 50 px about
   *  (640, 386), the cube's front 61 px, its back 0.66 of it (deeper than
   *  the standalone's 0.72); the blue grid 39 px apart. */
  narrative: { y: -55, ring: 104, cube: 128, back: 0.66, grid: 81 },
  /** f7681: the lattice's rows. f11806: the flower's circles. */
  latticeDivisions: 15,
  /** f3451: the Noosphere's lattice in the prism's place, r 123 px. */
  noosphere: { r: 256, y: 8 },
  flowerSpacing: 64,
  /** f3541: the hand's width (113 px) and its grip (638, 187 px). f4561:
   *  the side hands' grips (≈ 527 and 760, 200 px), leaning in ≈ 24°; two
   *  further slots further out for more pullers. */
  handWidth: 235,
  pullerSlots: [
    { x: -4, y: 360, b: 0, length: 320 },
    { x: -235, y: 333, b: 0.42, length: 360 },
    { x: 250, y: 333, b: -0.42, length: 360 },
    { x: -470, y: 290, b: 0.72, length: 480 },
    { x: 485, y: 290, b: -0.72, length: 480 },
  ],
  /** f4561: the bolts between the hands. */
  fistSpacing: 302,
  /** f4561: the bolts between fists, at y 531, 94 long. */
  boltY: 531,
  boltSize: 94,
  /** The "?" marks: f3331 (grey, by the crossed path), f3541 (the first
   *  doubt), f4561 (three more). */
  doubtCrossed: { x: 948, y: 135 },
  doubts: [
    { x: 892, y: 183 },
    { x: 1017, y: 79 },
    { x: 1048, y: -181 },
    { x: 867, y: -271 },
  ],
  doubtSize: 150,
} as const

/** The prism's height and corners: apex up, centred on its bounding box. */
export const prismCorners = (side: number = WV.side): [P, P, P] => {
  const h = (side * Math.sqrt(3)) / 2
  return [
    { x: 0, y: h / 2 },
    { x: side / 2, y: -h / 2 },
    { x: -side / 2, y: -h / 2 },
  ]
}

/** A point `at` of the way up the prism's left (−1) or right (+1) side. */
export const prismSide = (at: number, side: -1 | 1, s: number = WV.side): P => {
  const [apex, right, left] = prismCorners(s)
  const base = side < 0 ? left : right
  return { x: lerp(base.x, apex.x, at), y: lerp(base.y, apex.y, at) }
}

/** Where the light touches the eye (its iris, on the axis). */
export const eyeTip = (): P => ({ x: WV.eye.x - 193 * WV.eye.scale, y: WV.eye.y })
/** The eyeball arc on the eye's axis — where the spectrum ends. */
export const eyeArc = (): P => ({ x: WV.eye.x - 200 * WV.eye.scale, y: WV.eye.y })

/** The segment of the line p + t·d (t ≥ 0) inside a convex polygon, or none. */
export const clipRay = (p: P, d: P, poly: readonly P[]): [number, number] | undefined => {
  let t0 = -Infinity
  let t1 = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    // inward normal of a CCW / CW polygon: use the centroid's side
    const nx = -(b.y - a.y)
    const ny = b.x - a.x
    const c = poly.reduce((s, q) => ({ x: s.x + q.x / poly.length, y: s.y + q.y / poly.length }), { x: 0, y: 0 })
    const sgn = Math.sign(nx * (c.x - a.x) + ny * (c.y - a.y)) || 1
    const num = sgn * (nx * (p.x - a.x) + ny * (p.y - a.y))
    const den = sgn * (nx * d.x + ny * d.y)
    if (Math.abs(den) < 1e-12) {
      if (num < 0) return undefined
      continue
    }
    const t = -num / den
    if (den > 0) t0 = Math.max(t0, t)
    else t1 = Math.min(t1, t)
  }
  return t0 < t1 ? [t0, t1] : undefined
}

/** Lines of one family at angle `phi`, `spacing` apart through `origin`,
 *  clipped to a convex polygon. */
export const hatch = (poly: readonly P[], phi: number, spacing: number, origin: P = { x: 0, y: 0 }): Vec3Like[][] => {
  const d = { x: Math.cos(phi), y: Math.sin(phi) }
  const n = { x: -d.y, y: d.x }
  const reach = Math.max(...poly.map((q) => Math.hypot(q.x - origin.x, q.y - origin.y)))
  const out: Vec3Like[][] = []
  const k = Math.ceil(reach / spacing)
  for (let i = -k; i <= k; i++) {
    const p = { x: origin.x + n.x * i * spacing - d.x * reach * 2, y: origin.y + n.y * i * spacing - d.y * reach * 2 }
    const seg = clipRay(p, d, poly)
    if (!seg || seg[1] - seg[0] < 1e-6) continue
    out.push([v3({ x: p.x + d.x * seg[0], y: p.y + d.y * seg[0] }), v3({ x: p.x + d.x * seg[1], y: p.y + d.y * seg[1] })])
  }
  return out
}

const inside = (q: P, poly: readonly P[]): boolean => {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    const c = Math.sign((b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x))
    if (c === 0) continue
    if (s === 0) s = c
    else if (c !== s) return false
  }
  return true
}

/** A circle's runs inside a convex polygon, as polylines. */
export const clipCircle = (c: P, r: number, poly: readonly P[], n = 72): Vec3Like[][] => {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }
  })
  const ins = pts.map((q) => inside(q, poly))
  const out0 = ins.indexOf(false)
  if (out0 < 0) return [[...pts, pts[0]!].map(v3)]
  const runs: Vec3Like[][] = []
  let run: Vec3Like[] = []
  for (let k = 1; k <= n; k++) {
    const i = (out0 + k) % n
    if (ins[i]) run.push(v3(pts[i]!))
    else {
      if (run.length > 1) runs.push(run)
      run = []
    }
  }
  return runs
}

// --- the spectrum ----------------------------------------------------------

/** The film's spectrum, top to bottom (f3391), and its smeared pastels (f3541). */
export const SPECTRUM: readonly Color[] = [seen(238, 79, 75), seen(88, 236, 52), seen(12, 163, 246)]
export const PASTEL: readonly Color[] = [seen(148, 104, 102), seen(148, 184, 132), seen(88, 128, 150)]
const mix = (a: Color, b: Color, u: number): Color => ({ r: lerp(a.r, b.r, u), g: lerp(a.g, b.g, u), b: lerp(a.b, b.b, u) })

/** Strips along the light (enough for the smear's waves and the fades). */
export const BOW_STRIPS = 36
const BEAM_STRIPS = 28

/**
 * A boundary of the spectrum at u ∈ [0, 1] along it (0 the prism, 1 the
 * eye): boundary k ∈ {0..3} (top → bottom) as an offset across the fan
 * about its centre line. Clean, the four boundaries split a straight fan in
 * thirds; `distortion` waves the whole ribbon and lets the boundaries wander
 * apart; `shred` (the multipolar pull) makes the ribbon broader and wilder.
 */
export const bowOffset = (u: number, k: number, distortion: number, shred: number): number => {
  // smeared, the ribbon leaves the prism already broad (f3541: ≈ 30 px)
  const start = 0.03 + 0.3 * distortion
  const half = WV.bowHalf * (start + (1 - start) * u) * (1 + 0.8 * shred * distortion)
  const clean = half * (1 - (2 * k) / 3)
  const env = Math.sqrt(u) * distortion
  const wave = env * (14 + 22 * shred) * Math.sin(TAU * (u * 2.4 + 0.15))
  const wander = env * (9 + 16 * shred) * Math.sin(TAU * (u * (3.3 + 0.7 * k) + k * 0.37))
  return clean + wave + wander
}

/** A flat wash of a closed outline (a Shape: its outline is never ink). */
const wash = (pts: readonly P[], tint: Color, fillOpacity: number | ReturnType<typeof derive<number>>): Shape =>
  new Shape({ tint, fillOpacity, outlines: [new Line({ points: [...pts, pts[0]!].map(v3) })] })
const circlePoints = (c: P, r: number, n = 96): P[] =>
  Array.from({ length: n }, (_, i) => ({ x: c.x + Math.cos((i / n) * TAU) * r, y: c.y + Math.sin((i / n) * TAU) * r }))

class Slot extends Group {
  there = presence(1)
}

export const LENS = { empty: 0, earth: 1, noosphere: 2, cube: 3, lattice: 4, flower: 5 } as const
export const SOURCE = { earth: 0, fragmented: 1, radiant: 2, face: 3 } as const
export type LensName = keyof typeof LENS
export type SourceName = keyof typeof SOURCE

/** The share of index `k` in a scrubbing index `v` (a tent, 1 at k). */
const tent = (v: number, k: number) => clamp01(1 - Math.abs(v - k))

export class Worldview extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  light = completion(1)
  prism = completion(1)
  direct = completion(0)
  crossed = completion(0)
  loop = completion(0)
  lens = scalar(LENS.empty)
  distortion = completion(0)
  strings = completion(0)
  pullers = scalar(1)
  reverse = completion(0)
  source = scalar(SOURCE.earth)

  /** The prism's ink. */
  prismStroke = length(3)
  /** The Earth's turn and lean (every source globe shares them). */
  spin = scalar(0)
  tilt = scalar(0.2)

  /** Construction data: what `source` 3 shows, and what `lens` 2 holds
   *  (by default the Noosphere). */
  sourceFace?: Holon = undefined
  lensFace?: Holon = undefined
  /**
   * Construction-time: the optional globes to build — `radiant` (source 2)
   * and `lens` (lens 1, the world in the lens). Each is a whole Earth; a
   * scene that never visits one leaves it out and its slot stays empty
   * (the film's eight worldviews reach the radiant once and the lens Earth
   * once). Both by default. The source Earth (0–1) is always built.
   */
  globes: readonly ("radiant" | "lens")[] = ["radiant", "lens"]

  // parts
  fragmented!: FragmentedEarth
  /** Undefined unless `globes` holds "radiant". */
  radiant!: DreamTalkSymbol
  eye!: Eye
  prismLine!: Line
  beams: Shape[] = []
  bands: Shape[][] = []
  lensSlots: Slot[] = []
  sourceSlots: Slot[] = []
  puppeteers: Puppeteer[] = []
  doubts: Text[] = []

  private recedes: Recede[] = []
  private observer?: Observer

  constructor(overrides: Overrides = {}) {
    const o = { ...overrides }
    if (typeof o.lens === "string") o.lens = LENS[o.lens as LensName]
    if (typeof o.source === "string") o.source = SOURCE[o.source as SourceName]
    super(o)
  }

  /** Tell the globes where the eye is (any scene whose camera is not the default). */
  seenFrom(observer: Observer): void {
    this.observer = observer
    for (const r of this.recedes) r.seenFrom(observer)
    this.fragmented?.seenFrom(observer)
    this.radiant?.seenFrom(observer)
  }

  /** The multipolar share: 0 one puller, 1 from two. */
  private get multi(): number {
    return clamp01(this.pullers.value - 1)
  }

  override stateSpace(): StateSpace {
    void this.parts
    const handles = () => [this.prismLine]
    return {
      axes: [
        toggle("distortion", this.distortion, { key: "z", off: ["clear", 0], on: ["distorted", 1], handles }),
        toggle("strings", this.strings, { key: "j", off: ["free", 0], on: ["pulled", 1], handles }),
        toggle("pullers", this.pullers, { key: "u", off: ["unipolar", 1], on: ["multipolar", 3], handles }),
        toggle("reverse", this.reverse, { key: "v", off: ["through", 0], on: ["at", 1], handles }),
        axis(
          "lens",
          this,
          Object.fromEntries(
            Object.entries(LENS)
              .map(([n, v]) => [n, { lens: v }]),
          ),
          { key: "k", handles },
        ),
        axis(
          "source",
          this,
          Object.fromEntries(
            Object.entries(SOURCE)
              .filter(([n]) => n !== "face" || this.sourceFace)
              .map(([n, v]) => [n, { source: v }]),
          ),
          { key: "e", handles: () => [this.prismLine] },
        ),
      ],
    }
  }

  protected override compose(): void {
    const tri = prismCorners()
    const S = WV.source
    const src = this.source

    // ---- the light: beams (world → prism, or straight to the eye) -------
    const beamOn = () => this.light.value * (1 - this.reverse.value)
    for (let j = 0; j < 4; j++) {
      const spreadY = (j - 1.5) * 62
      const tip = (): P => {
        const t = eyeTip()
        const e = prismSide(WV.beamAt, -1)
        const p = this.prism.value
        return { x: lerp(t.x, e.x, p), y: lerp(t.y, e.y, p) + (j - 1.5) * 8 * this.multi * p }
      }
      const tail = (): { c: P; half: number } => {
        const t = tip()
        const dy = spreadY * this.multi
        const c0 = { x: S.x, y: S.y + dy * 0.6 }
        const dx = t.x - c0.x
        const dyy = t.y - c0.y
        const L = Math.hypot(dx, dyy)
        // the limb point facing the tip
        return { c: { x: S.x + (dx / L) * S.r * 0.97, y: S.y + dy + (dyy / L) * S.r * 0.97 }, half: WV.beamHalf * (j === 0 ? 1 : 0.8) }
      }
      const present = () => (j === 0 ? 1 : this.multi)
      for (let i = 0; i < BEAM_STRIPS; i++) {
        const u0 = i / BEAM_STRIPS
        const u1 = (i + 1) / BEAM_STRIPS
        const outline = new Line()
        derivePoints(
          outline,
          () => [this.prism.value, this.pullers.value],
          () => {
            const t = tip()
            const { c, half } = tail()
            const dx = t.x - c.x
            const dy = t.y - c.y
            const L = Math.hypot(dx, dy) || 1
            const n = { x: -dy / L, y: dx / L }
            // u = 0 at the world, 1 at the tip
            const at = (u: number, s: number): Vec3Like => {
              const w = half * (1 - u)
              return { x: c.x + dx * u + n.x * w * s, y: c.y + dy * u + n.y * w * s, z: 0 }
            }
            return [at(u0, 1), at(u1, 1), at(u1, -1), at(u0, -1), at(u0, 1)]
          },
        )
        // dark at the world, full from a third of the way along (f3391)
        const bright = ease("smooth", clamp01((u0 + u1) / 2 / 0.38))
        const strip = new Shape({
          tint: WHITE,
          outlines: [outline],
          opacity: derive(() => beamOn() * present() * (0.12 + 0.88 * bright)),
        })
        this.beams.push(this.add(strip))
      }
    }

    // ---- the spectrum ----------------------------------------------------
    const bowOn = () => this.light.value * this.prism.value * (1 - this.reverse.value)
    for (let k = 0; k < 3; k++) {
      const band: Shape[] = []
      for (let i = 0; i < BOW_STRIPS; i++) {
        const u0 = i / BOW_STRIPS
        const u1 = (i + 1) / BOW_STRIPS
        const outline = new Line()
        derivePoints(
          outline,
          () => [this.distortion.value, this.pullers.value],
          () => {
            const o = prismSide(WV.bowAt, 1)
            const e = eyeArc()
            const d = this.distortion.value
            const sh = this.multi
            const at = (u: number, b: number): Vec3Like => ({
              x: lerp(o.x, e.x, u),
              y: lerp(o.y, e.y, u) + bowOffset(u, b, d, sh),
              z: 0,
            })
            return [at(u0, k), at(u1, k), at(u1, k + 1), at(u0, k + 1), at(u0, k)]
          },
        )
        const um = (u0 + u1) / 2
        const fade = 1 - 0.85 * ease("smooth", clamp01((um - 0.8) / 0.2))
        const strip = new Shape({
          outlines: [outline],
          tint: derive(() => mix(SPECTRUM[k]!, PASTEL[k]!, this.distortion.value)),
          opacity: derive(() => {
            const d = this.distortion.value
            // the shredded ribbon is patchy: its strips come and go (f4561)
            const patch = 1 - 0.55 * this.multi * d * (0.5 + 0.5 * Math.sin(TAU * (um * 5.3 + k * 0.29)))
            return bowOn() * fade * (1 - 0.25 * d) * patch
          }),
        })
        band.push(this.add(strip))
      }
      this.bands.push(band)
    }

    // ---- the source ------------------------------------------------------
    const globeAt = (r: number) => r / EARTH_R
    // The bare Earth IS the fragmented one with its band folded away.
    this.fragmented = new FragmentedEarth({
      radius: WV.fragmentedRing,
      globe: S.r / WV.fragmentedRing,
      spin: this.spin,
      tilt: this.tilt,
      decoration: derive(() => clamp01(src.value)),
      limb: 1,
      boltLength: 0.155,
      boltTint: seen(170, 170, 170),
      // The source globe is S.r (133 px at scale 1): half the full mesh.
      resolution: 0.5,
    })
    if (this.globes.includes("radiant")) {
      this.radiant = new DreamTalkSymbol({ radius: WV.radiantRing, globe: S.r / WV.radiantRing, spin: this.spin, tilt: this.tilt, resolution: 0.5 })
    }
    // 0 → 1: the bare Earth gathers its fragmented band (one globe, the
    // FragmentedEarth's own); 1 → 2 cross-fades to the radiant symbol;
    // 2 → 3 to the face handed in. A globe is a solid, which a presence does
    // not fade, so the absent one is folded away (scale 0) at the midpoint.
    const sources: [Holon, () => number, () => boolean][] = [
      [this.fragmented, () => (src.value <= 1 ? 1 : tent(src.value, 1)), () => src.value < 1.5],
    ]
    if (this.radiant) sources.push([this.radiant, () => tent(src.value, 2), () => src.value >= 1.5 && src.value < 2.5])
    if (this.sourceFace) sources.push([this.sourceFace, () => clamp01(src.value - 2), () => src.value >= 2.5])
    for (const [h, there, shown] of sources) {
      const slot = this.add(new Slot({ x: S.x, y: S.y, members: [h] }))
      slot.there.follow(src.map(() => there()))
      slot.scale.follow(src.map(() => (shown() ? 1 : 0)))
      this.sourceSlots.push(slot)
    }

    // ---- the puppeteers (f3541, f4561) ------------------------------------
    // vocabulary/Puppeteer, its grip measured per slot: the first straight
    // above the apex, the rest out to either side, leaning in so their
    // strings run at the prism. The strings hang long; the prism's black
    // body (below) cuts them where they meet its sides.
    WV.pullerSlots.forEach((g, s) => {
      const hand = new Puppeteer({ size: WV.handWidth, x: g.x, y: g.y, b: g.b, length: g.length })
      void hand.parts
      for (const group of [hand.back, hand.front]) {
        for (const line of group.members as Line[]) line.creation.follow(this.strings.map((v) => clamp01(v * 1.6 - 0.6)))
      }
      const slot = this.add(new Slot({ members: [hand] }))
      slot.there.follow(
        derive(() => clamp01(this.strings.value * 1.6) * (s === 0 ? 1 : clamp01(this.pullers.value - s))),
      )
      this.puppeteers.push(hand)
    })
    // The prism's body: black, so the strings stop at its sides.
    this.add(wash([...tri], BLACK, derive(() => this.prism.value)))

    // ---- the lens contents (under the prism's outline) -------------------
    const lens = this.lens
    const lensSlot = (k: number, members: Holon[], solid = false): Slot => {
      const slot = this.add(new Slot({ members }))
      slot.there.follow(lens.map((v) => tent(v, k)))
      if (solid) slot.scale.follow(lens.map((v) => (tent(v, k) > 0.5 ? 1 : 0)))
      this.lensSlots[k] = slot
      return slot
    }
    lensSlot(LENS.empty, [])
    if (this.globes.includes("lens")) {
      const e = new Earth({
        radius: EARTH_R,
        land: WHITE,
        coastOpacity: 0,
        borderOpacity: 0,
        mapLines: false,
        // the world in the lens is small (49 px at scale 1)
        resolution: 0.25,
        limbTint: WHITE,
        limbStroke: 1.2,
        h: this.spin,
        p: this.tilt,
        scale: globeAt(WV.lensEarth.r),
      })
      const r = new Recede({ members: [e], reach: WV.lensEarth.r, y: WV.lensEarth.y })
      this.recedes.push(r)
      if (this.observer) r.seenFrom(this.observer)
      lensSlot(LENS.earth, [r], true)
    } else lensSlot(LENS.earth, [])
    {
      const N = WV.narrative
      const grid: Holon[] = []
      for (const phi of [PI / 2, PI / 6, (5 * PI) / 6]) {
        for (const seg of hatch(tri, phi, N.grid, { x: 0, y: N.y })) {
          grid.push(new Line({ points: seg, tint: GRID_BLUE, stroke: 1, opacity: 0.8 }))
        }
      }
      // The Narrative symbol itself, its ring the measured N.ring (128 · 0.813 = 104).
      const narrative = new Narrative({ size: N.cube, y: N.y, perspective: N.back, ringTint: RING_BLUE, stroke: 2.6, ringStroke: 3 })
      lensSlot(LENS.cube, [...grid, narrative])
    }
    {
      const lines: Holon[] = []
      const h = (WV.side * Math.sqrt(3)) / 2
      const spacing = h / WV.latticeDivisions
      for (const phi of [0, PI / 3, (2 * PI) / 3]) {
        // through a corner, so the rows meet the sides at the lattice's own points
        for (const seg of hatch(tri, phi, spacing, tri[2])) lines.push(new Line({ points: seg, tint: LATTICE_BLUE, stroke: 1.2 }))
      }
      lensSlot(LENS.lattice, [wash([...tri], LATTICE_BLUE, 0.06), ...lines])
    }
    {
      const circles: Holon[] = []
      const sp = WV.flowerSpacing
      const grown = prismCorners(WV.side + 4 * sp)
      for (const c of hexPack([grown], { spacing: sp })) {
        for (const run of clipCircle(c, sp, tri)) circles.push(new Line({ points: run, tint: FLOWER_RED, stroke: 1.1 }))
      }
      lensSlot(LENS.flower, circles)
    }


    // ---- the prism -------------------------------------------------------
    this.prismLine = this.add(
      new Line({
        points: [tri[0], tri[2], tri[1], tri[0]].map(v3),
        tint: WHITE,
        stroke: this.prismStroke,
        creation: derive(() => this.prism.value),
      }),
    )

    // f3451: the prism becomes the Noosphere's lattice (or the face handed
    // in) — over the prism, on a black disc, so only the prism's corners
    // show past it.
    lensSlot(
      LENS.noosphere,
      this.lensFace
        ? [this.lensFace]
        : [
            wash(circlePoints({ x: 0, y: WV.noosphere.y }, WV.noosphere.r), BLACK, 1),
            new Noosphere({ radius: WV.noosphere.r, y: WV.noosphere.y }),
          ],
    )
    // bolts between neighbouring fists (f4561): between centre and left, centre and right
    for (const side of [-1, 1]) {
      const bolt = new Conflict({
        size: WV.boltSize,
        x: side * WV.fistSpacing * 0.5,
        y: WV.boltY,
        fillOpacity: derive(() => this.strings.value * clamp01(this.pullers.value - (side < 0 ? 1 : 2))),
      })
      this.add(bolt)
    }

    // ---- the eye ---------------------------------------------------------
    this.eye = this.add(
      new Eye({ x: WV.eye.x, y: WV.eye.y, scale: WV.eye.scale, b: PI }),
    )
    // The film's eye (f3256–f11806) is video-01's with a slimmer iris and no
    // black pupil; set on its parts, not redrawn.
    this.eye.iris.radiusX.value = WV.eye.irisX
    this.eye.iris.radiusY.value = WV.eye.irisY
    this.eye.pupil.opacity.value = 0

    // ---- the paths and arrows -------------------------------------------
    const arrow = (pts: P[], creation: () => number, stroke = 1.8): Line => {
      const l = new Line({ points: pts.map(v3), tint: WHITE, stroke, arrowEnd: true })
      l.creation.follow(derive(creation))
      return this.add(l)
    }
    // f3301: world → eye over the top, eye → world under the bottom
    arrow([{ x: -802, y: 192 }, { x: -802, y: 296 }, { x: 815, y: 296 }, { x: 815, y: 125 }], () => this.direct.value)
    arrow([{ x: 819, y: -229 }, { x: 819, y: -360 }, { x: -796, y: -360 }, { x: -796, y: -302 }], () => this.direct.value)
    for (const y of [296, -360]) {
      const x = new Group({ y, b: PI / 4, members: [] })
      for (const [a, b] of [
        [{ x: -53, y: 0 }, { x: 53, y: 0 }],
        [{ x: 0, y: -53 }, { x: 0, y: 53 }],
      ] as [P, P][]) {
        const arm = new Line({ points: [v3(a), v3(b)], tint: CROSS_RED, stroke: 3.2 })
        arm.creation.follow(this.crossed.map((v) => v))
        x.attach(arm)
      }
      this.add(x)
    }
    // f3391: the feedback loop — up out of the lens, and from the eye back into it
    arrow([{ x: 31, y: 73 }, { x: 31, y: 271 }], () => this.loop.value)
    arrow([{ x: 819, y: -229 }, { x: 819, y: -360 }, { x: 31, y: -360 }, { x: 31, y: -177 }], () => this.loop.value)
    // f7606: the eye looks at the lens
    arrow([{ x: eyeTip().x - 30, y: WV.eye.y }, { x: 215, y: WV.eye.y }], () => this.reverse.value, 2.2)

    // ---- the doubts ------------------------------------------------------
    const doubt = (p: P, tint: Color, opacity: () => number): Text => {
      const t = new Text({ content: "?", font: "Times-Roman", size: WV.doubtSize, tint, x: p.x, y: p.y })
      t.opacity.follow(derive(opacity))
      this.doubts.push(this.add(t))
      return t
    }
    doubt(WV.doubtCrossed, seen(205, 205, 205), () => this.crossed.value)
    WV.doubts.forEach((p, i) =>
      doubt(p, WHITE, () =>
        i === 0
          ? clamp01((this.distortion.value - 0.5) / 0.5) * (1 - this.reverse.value)
          : this.distortion.value * clamp01(this.multi * 3 - (i - 1)) * (1 - this.reverse.value),
      ),
    )
  }

  /** The world and the eye come up, the prism draws on, the light runs. */
  override createAnim(): Anim {
    void this.parts
    return together(
      restage(Create(this.fragmented), 0, 0.5),
      restage(Create(this.eye), 0.1, 0.6),
      restage(this.prism.sequence(0, this.prism.value), 0.3, 0.8),
      restage(this.light.sequence(0, this.light.value), 0.6, 1),
    )
  }
}

/** The radius the Earths are built at; `scale` sizes them. */
const EARTH_R = 100
const GRID_BLUE = seen(40, 120, 190)
const RING_BLUE = seen(2, 148, 246)
const LATTICE_BLUE = seen(40, 160, 240)
const FLOWER_RED = seen(150, 60, 52)
const CROSS_RED = seen(226, 62, 72)
