/**
 * Choropleth — a value per country, painted on the Earth.
 *
 * A plain table in, the planet coloured out: `data` maps an ISO alpha-2 code
 * to one value per period (`null` where there is none). Each country gets
 * its own sheet on the sphere (features.ts `countryMesh`, 1:10m inside any
 * detail pack), tinted along a scale from `low` to `high` by its value at
 * `period`.
 *
 *   - `period` is CONTINUOUS: 3.4 is four tenths of the way from the fourth
 *     period to the fifth, values interpolated between them, so a year of
 *     months animates as one smooth param (`choropleth.period.to(11)`).
 *   - MISSING DATA IS GHOSTED, in DreamTalk's own language for uncertainty
 *     (src/certainty.ts): a country with no value for a period is drawn in
 *     `missing` at `ghost(0)` — faint, never gone — and a country whose data
 *     begins or ends crossfades between the two as the period passes.
 *   - The scale is linear over `domain` (the table's own min..max unless
 *     given), or `curve: "sqrt"` for skewed quantities.
 *
 * It is a data LAYER: give it to an Earth's `layers` (not `places`), which
 * composites it over the land and under the lakes, coasts and borders —
 * the lines stay drawn over the data.
 */

import type { Overrides } from "../../src/holon"
import { Null } from "../../src/parts/primitives"
import { Surface } from "../../src/parts/surface"
import { color, completion, derive, scalar } from "../../src/params"
import { rgb, type Color } from "../../src/constants"
import { ghost } from "../../src/certainty"
import { countryMesh, countries, regionOf } from "./features"
import type { Earth } from "./Earth"

/** A country's value over the periods; `null` where the table has none. */
export type Series = readonly (number | null)[]

export class Choropleth extends Null {
  static sovereign = true
  /** ISO alpha-2 → one value per period. Construction-time. */
  data: Readonly<Record<string, Series>> = {}
  /** Period labels (optional; the readout of a scene). */
  periods: readonly string[] = []
  /** Scale domain; unset = the table's own min..max. */
  domain: readonly [number, number] | undefined = undefined
  /** "linear" or "sqrt" (for skewed quantities). */
  curve: "linear" | "sqrt" = "linear"

  /** Which period is shown — continuous; animate it. */
  period = scalar(0)
  /**
   * The colour of the scale's two ends — a deep, quiet ramp by default, so
   * the coasts, borders and anything drawn over the data stay the
   * brightest things on the map (strokes composite by MAX).
   */
  low = color(rgb(0x03, 0x08, 0x10))
  high = color(rgb(0x00, 0x38, 0x70))
  /** The colour of a country with no value. */
  missing = color(rgb(0x30, 0x30, 0x30))
  /** The whole layer's strength (0 = gone). */
  strength = completion(1)

  /** The sheet per country, by ISO. */
  sheets = new Map<string, Surface>()
  /** Codes in the table the data set does not know. */
  unknown: string[] = []

  private earth?: Earth
  private dom?: readonly [number, number]

  constructor(overrides: Overrides = {}) {
    super(overrides)
  }

  /** The Earth adopting this layer hands itself over (Earth `layers`). */
  seatOn(earth: Earth): void {
    this.earth = earth
  }

  /** The table's value of a country at a (continuous) period, and how sure it is (0..1). */
  sample(iso: string, period = this.period.value): { value: number; sure: number } {
    return sampleSeries(this.data[iso] ?? [], period)
  }

  /** A value's place on the scale, 0..1. */
  level(value: number): number {
    const [lo, hi] = this.domain ?? (this.dom ??= tableDomain(this.data))
    const t = hi > lo ? Math.max(0, Math.min(1, (value - lo) / (hi - lo))) : 0
    return this.curve === "sqrt" ? Math.sqrt(t) : t
  }

  protected override compose(): void {
    const earth = this.earth
    if (!earth) throw new Error("Choropleth: give it to an Earth's `layers`")
    const known = new Set(countries().map((c) => c.iso))
    const region = regionOf(earth.packs)
    const r = earth.radius.value
    for (const iso of Object.keys(this.data)) {
      if (!known.has(iso)) {
        this.unknown.push(iso)
        continue
      }
      const mesh = countryMesh(iso, region)
      const scaled = new Float32Array(mesh.positions.length)
      for (let i = 0; i < scaled.length; i++) scaled[i] = mesh.positions[i]! * r
      const sheet = this.add(
        new Surface({
          tint: derive((): Color => {
            const { value, sure } = this.sample(iso)
            const c = mix(this.low.value, this.high.value, this.level(value))
            return mix(this.missing.value, c, sure)
          }),
          fillOpacity: derive(() => this.strength.value * ghost(this.sample(iso).sure)),
        }),
      )
      sheet.positions = scaled
      sheet.indices = mesh.indices
      this.sheets.set(iso, sheet)
    }
  }
}

const mix = (a: Color, b: Color, t: number): Color => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
})

/**
 * A series at a continuous period: values interpolated between the two
 * periods around it; where one side is missing, the present side's value
 * held and `sure` falling to 0 across the gap — the crossfade into ghost.
 */
export const sampleSeries = (series: Series, period: number): { value: number; sure: number } => {
  if (series.length === 0) return { value: 0, sure: 0 }
  const p = Math.max(0, Math.min(series.length - 1, period))
  const i = Math.floor(p)
  const f = p - i
  const a = series[i] ?? null
  const b = series[Math.min(series.length - 1, i + 1)] ?? null
  if (a !== null && b !== null) return { value: a + (b - a) * f, sure: 1 }
  if (a !== null) return { value: a, sure: 1 - f }
  if (b !== null) return { value: b, sure: f }
  return { value: 0, sure: 0 }
}

/** The min..max of every value in a table. */
export const tableDomain = (data: Readonly<Record<string, Series>>): [number, number] => {
  let lo = Infinity
  let hi = -Infinity
  for (const s of Object.values(data)) {
    for (const v of s) {
      if (v === null) continue
      lo = Math.min(lo, v)
      hi = Math.max(hi, v)
    }
  }
  return Number.isFinite(lo) ? [lo, hi] : [0, 1]
}
