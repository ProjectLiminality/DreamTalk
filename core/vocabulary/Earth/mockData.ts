/**
 * Mock data — PLACEHOLDER tables for the Earth's data layers (?scene=earth-data).
 * Invented and generic on purpose (this repo is public): a value per
 * European country for twelve months, a few gaps to show how missing data
 * is ghosted, point series for eight cities, and flows into one hub. A real
 * dataset is the same shape (Choropleth `data`, PointData `rows`, plain
 * lat/lon pairs for flows) and swaps in wherever these are passed.
 */

import type { Series } from "./Choropleth"
import type { PointRow } from "./PointData"

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const

/** A deterministic 0..1 from a string — so the mock never changes between runs. */
const hash = (s: string): number => {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return ((h >>> 0) % 10007) / 10007
}

const COUNTRIES = [
  "AT", "DE", "FR", "IT", "ES", "PT", "NL", "BE", "CH", "PL", "CZ", "SK", "HU", "SI", "HR", "RO",
  "BG", "GR", "DK", "SE", "NO", "FI", "IE", "GB", "RS", "BA", "UA", "BY", "LT", "LV", "EE", "TR",
]

/** A seasonal value per country per month, with deliberate gaps. */
export const MOCK_CHOROPLETH: Record<string, Series> = Object.fromEntries(
  COUNTRIES.map((iso) => {
    const base = 20 + 80 * hash(iso)
    const phase = hash(iso + "phase") * 12
    const series: (number | null)[] = MONTHS.map((_, m) => Math.round(base * (1 + 0.35 * Math.sin(((m + phase) / 12) * 2 * Math.PI))))
    // Gaps: one country reports late, one stops, one has a hole.
    if (iso === "NO") for (let m = 0; m < 5; m++) series[m] = null
    if (iso === "UA") for (let m = 7; m < 12; m++) series[m] = null
    if (iso === "PL") series[5] = series[6] = null
    return [iso, series]
  }),
)

const city = (name: string, lat: number, lon: number): PointRow => {
  const base = 30 + 70 * hash(name)
  return {
    name,
    lat,
    lon,
    values: MONTHS.map((_, m) => Math.round(base * (1 + 0.4 * Math.sin(((m + hash(name + "p") * 12) / 12) * 2 * Math.PI)))),
  }
}

/** Point series for eight generic places. */
export const MOCK_POINTS: PointRow[] = [
  city("P1", 48.2, 16.4),
  city("P2", 52.5, 13.4),
  city("P3", 48.9, 2.4),
  city("P4", 45.5, 9.2),
  city("P5", 40.4, -3.7),
  city("P6", 50.1, 14.4),
  city("P7", 47.5, 19.0),
  city("P8", 59.3, 18.1),
]

/** Flows from those places into a hub, with a volume 0..1 each. */
export const MOCK_HUB = { lat: 50.1, lon: 8.7 }
export const MOCK_FLOWS: { from: number; volume: number }[] = [
  { from: 0, volume: 1 },
  { from: 2, volume: 0.6 },
  { from: 3, volume: 0.8 },
  { from: 4, volume: 0.35 },
  { from: 6, volume: 0.5 },
  { from: 7, volume: 0.25 },
]
