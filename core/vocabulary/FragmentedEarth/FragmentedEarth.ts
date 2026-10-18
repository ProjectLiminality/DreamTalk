/**
 * FragmentedEarth — the planet under narrative warfare: the Earth inside a
 * blue ring, a blue triangular grid in the band between them, a ring of
 * white lightning bolts striking in at the globe, and red field-lines
 * spiralling outward past the ring.
 *
 * ONE SYMBOL, TWO FILMS. It was the Web3 video's blue (Web2) node, drawn
 * inside `demo/web3/YinYang.ts` as the yin-yang's left lobe; the InterBrain
 * film shows the very same construction as the fragmented Earth — the
 * source of the manipulated worldview (f3511, f3541), and of the
 * domesticated eye's world (ch1). Popped out so both import it
 * (docs/TASTE.md, "One symbol, one implementation"); the bolts are
 * vocabulary/Conflict.
 *
 * ONE SIZE: `radius` is the blue ring's. Everything else is a share of it
 * (measured on the Web3 frames at full resolution, 14.4 s):
 *
 *   globe        `globe` × radius (0.46)
 *   grid         three families of four lines, 60° apart, GRID_SPACING ×
 *                radius apart, laid only in the band globe < r < ring
 *   bolts        wide end at BOLT_OUTER × radius, BOLT_LENGTH × radius long,
 *                eight, tips inward
 *   field-lines  eight spiral arcs from 0.9 × radius out to 1.6 × radius,
 *                each sweeping 0.16 of a turn
 *
 * PRESENCE: one number, `decoration` (0..1) — the band blooms around the
 * bare globe: the grid and ring with it, the field-lines from 0.2, the
 * bolts from 0.3 (YinYang's `divide`). The globe turns on `spin` and leans
 * on `tilt` (the Earth's h and p); `limb` rings it with its white
 * silhouette, as the InterBrain film draws every globe. It is set on the page (parts/recede.ts),
 * so it needs the eye: `seenFrom`.
 */

import { Circle, Group, Line, Null, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { color, completion, derive, length, scalar, angle } from "../../src/params"
import { WHITE, TAU, rgb, seen } from "../../src/constants"
import type { Overrides } from "../../src/holon"
import type { Observer } from "../../src/dream"
import { clamp01 } from "../../src/math"
import { Recede } from "../../src/parts/recede"
import { Earth } from "../Earth/Earth"
import { Conflict } from "../Conflict/Conflict"

/** The globe's radius as a share of the ring (Web3 f14.4 s). */
export const GLOBE_OF_RING = 0.46
/** The grid's line spacing, as a share of the ring's radius. */
export const GRID_SPACING = 0.42
/** The bolts: wide end at 0.78 of the ring, 0.24 of it long. */
export const BOLT_OUTER = 0.78
export const BOLT_LENGTH = 0.24
const BOLT_COUNT = 8
const FIELD_COUNT = 8
/** The field-lines' reach, as shares of the ring, and their sweep. */
export const FIELD_FROM = 0.9
export const FIELD_TO = 1.6
const FIELD_SWEEP = TAU * 0.16
/** Colours sampled from the full-resolution Web3 frames (14.4 s). */
export const BLUE_RING = seen(2, 148, 246)
const BLUE_LATTICE = seen(40, 120, 190)
const RED_FIELD = seen(212, 76, 60)
/** The Earth's own limb tint, kept while the limb is off. */
const LIMB_OFF = rgb(0x30, 0x30, 0x30)
/** The radius the Earth is built at; `scale` sizes it. */
const EARTH_R = 33

/**
 * One grid line's two pieces inside the band r0 < |p| < r1: the line runs
 * along angle `phi`, offset `c` from the centre. A line that clears the
 * inner circle is split at its middle so every line is two pieces.
 */
export const gridPieces = (phi: number, c: number, r0: number, r1: number): [Vec3Like[], Vec3Like[]] => {
  const dx = Math.cos(phi)
  const dy = Math.sin(phi)
  const at = (s: number) => ({ x: -dy * c + dx * s, y: dx * c + dy * s, z: 0 })
  const so = Math.sqrt(Math.max(r1 * r1 - c * c, 0))
  const si = Math.abs(c) < r0 ? Math.sqrt(r0 * r0 - c * c) : 0
  return [
    [at(-so), at(-si)],
    [at(si), at(so)],
  ]
}

/** One field-line: a spiral arc bowing outward from near the globe. Starts at
 *  angle `a0` and radius `r0`, sweeps `dTheta` while growing to `r1`. */
export const fieldLine = (a0: number, r0: number, r1: number, dTheta: number, segments = 16): Vec3Like[] => {
  const pts: Vec3Like[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const a = a0 + dTheta * t
    const r = r0 + (r1 - r0) * t
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: 0 })
  }
  return pts
}

export class FragmentedEarth extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The blue ring's radius — the symbol's one size. */
  radius = length(150)
  /** The globe's radius as a share of the ring. */
  globe = scalar(GLOBE_OF_RING)
  /** The band around the globe: 0 the bare Earth, 1 fragmented. */
  decoration = completion(1)
  /** The Earth's turn about its pole and its pole's lean (h, p). */
  spin = scalar(0)
  tilt = angle(0.12)
  /** The globe's silhouette as a white line (the InterBrain film's, f3541): 0 none. */
  limb = completion(0)
  /** The bolts: their length as a share of the ring, and their colour — the
   *  Web3 node's are white and 0.24 long; the InterBrain film's smaller and
   *  grey (f3541: 28 px of a 180 px ring, ≈ 170 grey). */
  boltLength = scalar(BOLT_LENGTH)
  boltTint = color(WHITE)

  earth!: Earth
  globeOnPage!: Recede
  grid: Line[] = []
  ring!: Circle
  bolts!: Conflict
  fields: Line[] = []

  private observer?: Observer

  constructor(overrides: Overrides = {}) {
    super(overrides)
    // Built here, not in compose, so a scene can turn it from the first frame.
    this.earth = new Earth({
      radius: EARTH_R,
      land: WHITE,
      coastOpacity: 0,
      borderOpacity: 0,
      mapLines: false,
      h: this.spin,
      p: this.tilt,
      limbStroke: derive(() => 1.4 * this.limb.value),
      limbTint: derive(() => (this.limb.value > 0 ? WHITE : LIMB_OFF)),
    })
  }

  /** Tell the Earth where the eye is (any scene whose camera is not the default). */
  seenFrom(observer: Observer): void {
    this.observer = observer
    this.globeOnPage?.seenFrom(observer)
  }

  /** How far the symbol reaches from its centre — the field-lines' tips. */
  get reach(): number {
    return this.radius.value * FIELD_TO
  }

  protected override compose(): void {
    const ring = () => this.radius.value
    const gr = () => ring() * this.globe.value
    const d = this.decoration
    const key = () => [this.radius.value, this.globe.value]

    this.earth.scale.follow(this.radius.map(() => gr() / EARTH_R))
    this.globeOnPage = this.add(new Recede({ members: [this.earth], reach: EARTH_R }))
    this.globeOnPage.reach.follow(this.radius.map(() => gr()))
    if (this.observer) this.globeOnPage.seenFrom(this.observer)

    // The grid: three families of four lines, 60° apart, only in the band.
    for (let f = 0; f < 3; f++) {
      const phi = (f * Math.PI) / 3
      for (let k = 0; k < 4; k++) {
        const c = (k - 1.5) * GRID_SPACING
        for (const piece of [0, 1] as const) {
          const line = new Line({ tint: BLUE_LATTICE, stroke: 1, opacity: 0 })
          derivePoints(line, key, () => gridPieces(phi, c * ring(), gr(), ring())[piece])
          line.opacity.follow(d.map((v) => clamp01(v) * 0.85))
          this.grid.push(this.add(line))
        }
      }
    }

    // The bounding blue ring.
    this.ring = this.add(new Circle({ tint: BLUE_RING, stroke: 2.4, opacity: 0 }))
    this.ring.radius.follow(this.radius.map(() => ring()))
    this.ring.opacity.follow(d.map((v) => clamp01(v)))

    // Lightning bolts in the band, one on each axis and diagonal, striking
    // at the globe: a ring of Conflict, its tips inward (direction π).
    this.bolts = this.add(
      new Conflict({
        count: BOLT_COUNT,
        direction: TAU / 2,
        size: derive(() => ring() * this.boltLength.value),
        radius: derive(() => ring() * (BOLT_OUTER - this.boltLength.value / 2)),
        tint: this.boltTint,
        fillOpacity: derive(() => clamp01((d.value - 0.3) / 0.7)),
      }),
    )

    // Red field-line spirals sweeping outward past the ring.
    for (let i = 0; i < FIELD_COUNT; i++) {
      const a0 = (i / FIELD_COUNT) * TAU
      const line = new Line({ tint: RED_FIELD, stroke: 1.4, opacity: 0 })
      derivePoints(line, key, () => fieldLine(a0, ring() * FIELD_FROM, ring() * FIELD_TO, FIELD_SWEEP))
      line.opacity.follow(d.map((v) => clamp01((v - 0.2) / 0.8) * 0.8))
      this.fields.push(this.add(line))
    }
  }
}
