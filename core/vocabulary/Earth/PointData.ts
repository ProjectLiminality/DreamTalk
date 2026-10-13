/**
 * PointData — values at places on the Earth, drawn standing on it.
 *
 * A plain table in: each row a lat/lon and either one value or one per
 * period (`null` where there is none). Two ways to stand a value on the
 * ground, chosen at construction:
 *
 *   - "column": a square column rising from the ground, height ∝ value —
 *     drawn as lines with true hidden lines (a black body inset behind its
 *     edges, as the Factory and Headquarters are), so a field of columns
 *     reads as solids, not a tangle.
 *   - "circle": a disc lying on the ground, AREA ∝ value (radius ∝ √value),
 *     the cartographer's proportional symbol.
 *
 * `period` is continuous like the Choropleth's (values interpolated), a gap
 * in the data is ghosted the same way (src/certainty.ts `ghost`), and
 * `strength` 0 → 1 raises every column out of the ground together — the
 * Create of a data layer. The scale's domain is the table's own max
 * unless given; zero stands at the ground.
 *
 * Give it to an Earth's `places`: every row is a `Place`, seated on the
 * planet, turning with it.
 */

import type { Holon, Overrides } from "../../src/holon"
import { Circle, derivePoints, Line, Null, type Vec3Like } from "../../src/parts/primitives"
import { Surface } from "../../src/parts/surface"
import { color, completion, derive, length, scalar } from "../../src/params"
import { rgb, WHITE } from "../../src/constants"
import { ghost } from "../../src/certainty"
import { sampleSeries, type Series } from "./Choropleth"
import { deriveSurface, Place, type Earth } from "./Earth"

/** One row of point data. */
export interface PointRow {
  name?: string
  lat: number
  lon: number
  /** One value, or one per period. */
  values: number | Series
}

/** How far a column's body shrinks behind its edges (as prism.ts). */
const BODY_INSET = 0.04

export class PointData extends Null {
  static sovereign = true
  /** The table. Construction-time. */
  rows: readonly PointRow[] = []
  /** "column" (height ∝ value) or "circle" (area ∝ value). Construction-time. */
  style: "column" | "circle" = "column"
  /** Scale maximum; unset = the table's own largest value. */
  max: number | undefined = undefined

  /** Which period is shown — continuous. */
  period = scalar(0)
  /** All columns' rise, 0 (in the ground) → 1. */
  strength = completion(1)
  /** The tallest column (or the largest disc's radius), scene units. */
  size = length(40)
  /** A column's footprint, scene units. */
  width = length(4)
  tint = color(WHITE)
  stroke = length(1.3)
  /** A disc's wash under its outline. */
  fillOpacity = completion(0.25)

  /** One Place per row, in row order. */
  spots: Place[] = []

  constructor(overrides: Overrides = {}) {
    super(overrides)
    const peak = this.max ?? Math.max(1e-9, ...this.rows.flatMap((r) => (typeof r.values === "number" ? [r.values] : r.values.filter((v): v is number => v !== null))))
    for (const row of this.rows) {
      const series: Series = typeof row.values === "number" ? [row.values] : row.values
      const at = () => sampleSeries(series, this.period.value)
      const level = () => Math.max(0, at().value) / peak
      const presence = derive(() => (this.strength.value > 0 ? ghost(at().sure) : 0))
      const symbol = this.style === "column" ? this.column(level, presence) : this.disc(level, presence)
      const spot = new Place({ lat: row.lat, lon: row.lon, members: [symbol] })
      this.spots.push(spot)
      this.add(spot)
    }
  }

  /** The Earth adopting this layer seats every row on it. */
  seatOn(earth: Earth): void {
    for (const spot of this.spots) spot.seatOn(earth)
  }

  private column(level: () => number, presence: ReturnType<typeof derive<number>>): Holon {
    const group = new Null()
    const add = <T extends Holon>(h: T): T => (group as unknown as { add(h: T): T }).add(h)
    const h = () => this.size.value * this.strength.value * level()
    const w = () => this.width.value / 2
    const key = () => [h(), w()]
    const corner = (sx: number, sz: number, y: number): Vec3Like => ({ x: sx * w(), y, z: sz * w() })
    const ring = (y: number): Vec3Like[] =>
      [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([sx, sz]) => corner(sx!, sz!, y))

    // The body first, so its depth is in place before the edges composite.
    const body = add(new Surface({ solid: true, tint: rgb(0, 0, 0), opacity: derive(() => (h() > 1e-6 ? 1 : 0)) }))
    deriveSurface(body, () => key().join(","), () => {
      const k = 1 - BODY_INSET
      const H = h()
      const positions: number[] = []
      for (const y of [H * BODY_INSET / 2, H * (1 - BODY_INSET / 2)]) {
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) positions.push(sx * w() * k, y, sz * w() * k)
      }
      // Bottom, top, and the four sides.
      const indices = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4
        indices.push(i, j, j + 4, i, j + 4, i + 4)
      }
      return { positions: new Float32Array(positions), indices: new Uint32Array(indices) }
    })
    const ink = { tint: this.tint, stroke: this.stroke, opacity: derive(() => (h() > 1e-6 ? presence.value : 0)) }
    const top = add(new Line(ink))
    derivePoints(top, key, () => ring(h()))
    const foot = add(new Line(ink))
    derivePoints(foot, key, () => ring(0))
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const edge = add(new Line(ink))
      derivePoints(edge, key, () => [corner(sx, sz, 0), corner(sx, sz, h())])
    }
    return group
  }

  private disc(level: () => number, presence: ReturnType<typeof derive<number>>): Holon {
    // A Circle lies in its XY plane; p = −π/2 lays it on the Place's ground
    // (normal +y), a hair above it.
    return new Circle({
      radius: derive(() => this.size.value * this.strength.value * Math.sqrt(level())),
      tint: this.tint,
      stroke: this.stroke,
      fillOpacity: this.fillOpacity,
      opacity: presence,
      p: -Math.PI / 2,
      y: 0.3,
    })
  }
}
