/**
 * gen-data.ts — regenerate the Earth's geography from its public source.
 *
 *   bun vocabulary/Earth/gen-data.ts                 fetch from the source below
 *   bun vocabulary/Earth/gen-data.ts --from <dir>    use already-downloaded GeoJSON
 *
 * Writes `naturalEarth.ts` beside this file. Nothing in the Earth is drawn
 * by hand: every coastline, every border, every island is Natural Earth.
 *
 * THE SOURCE
 *
 * Natural Earth (https://www.naturalearthdata.com), the public-domain world
 * dataset made by the North American Cartographic Information Society and
 * volunteer cartographers — "Free vector and raster map data … in the
 * public domain. No permission is needed to use Natural Earth." The files
 * are fetched from the project's own repository at a PINNED release tag,
 * so a regeneration reproduces the committed data byte for byte:
 *
 *   nvkelso/natural-earth-vector @ v5.1.2, geojson/
 *     ne_50m_land.geojson                       → the landmass (fill + coast)
 *     ne_50m_admin_0_boundary_lines_land.geojson → the country borders
 *
 * WHY THESE TWO LAYERS AND NOT THREE
 *
 * The coastline is not stored. Natural Earth's coastline layer IS the
 * boundary of its land layer (the 50m files share every vertex), so the
 * Earth derives its coast strokes from the land rings and drops only the
 * edges that are artefacts of storing a sphere in lon/lat — the cut along
 * the antimeridian and Antarctica's run along the pole (Earth.ts). One
 * dataset, so fill and stroke can never disagree about where the shore is.
 *
 * WHY 1:50m, AND HOW THE LOD WORKS
 *
 * 1:110m is a sketch of the world (Austria is ~20 vertices); 1:50m holds up
 * from the whole globe down to a framed Europe. Within it, every feature
 * carries Natural Earth's own `min_zoom` — the cartographers' ranking of
 * when a feature earns its place on the map (the big continents 0, the
 * smallest islets 4). That rank is kept per ring, so the Earth's `detail`
 * param can bring small islands in as the camera descends, the way a web
 * map does, without a second dataset.
 *
 * WHAT IS KEPT PER RING (the `meta` byte, codec.ts)
 *
 *   land:     bits 0–3 rank = min_zoom × 2 (0…8)   bit 4 hole
 *   borders:  bits 0–3 rank = min_zoom × 2         bits 4–6 class:
 *             0 international · 1 disputed · 2 indefinite ·
 *             3 line of control · 4 indeterminate frontier
 */

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { BORDER_CLASSES, encodeRings } from "./codec"

const TAG = "v5.1.2"
const BASE = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${TAG}/geojson`
const LAND = "ne_50m_land.geojson"
const BORDERS = "ne_50m_admin_0_boundary_lines_land.geojson"
const LAKES = "ne_50m_lakes.geojson"
const RIVERS = "ne_50m_rivers_lake_centerlines.geojson"
const COUNTRIES = "ne_50m_admin_0_countries.geojson"
const PLACES = "ne_50m_populated_places_simple.geojson"

const here = dirname(fileURLToPath(import.meta.url))
const fromAt = process.argv.indexOf("--from")
const fromDir = fromAt >= 0 ? process.argv[fromAt + 1] : undefined

type Position = [number, number]
interface Feature {
  properties: Record<string, unknown>
  geometry: { type: string; coordinates: unknown }
}

const load = async (name: string): Promise<Feature[]> => {
  const text = fromDir
    ? readFileSync(join(fromDir, name), "utf8")
    : await fetch(`${BASE}/${name}`).then((r) => {
        if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`)
        return r.text()
      })
  return (JSON.parse(text) as { features: Feature[] }).features
}

const rankOf = (p: Record<string, unknown>): number => {
  const z = Number(p.min_zoom ?? p.MIN_ZOOM ?? 0)
  return Math.max(0, Math.min(15, Math.round(z * 2)))
}

/** Flatten a coordinate list, dropping consecutive repeats (on the layer's grid). */
const flat = (pts: Position[], quantum = 1000): number[] => {
  const out: number[] = []
  let lx = NaN
  let ly = NaN
  for (const [x, y] of pts) {
    const qx = Math.round(x * quantum)
    const qy = Math.round(y * quantum)
    if (qx === lx && qy === ly) continue
    out.push(qx / quantum, qy / quantum)
    lx = qx
    ly = qy
  }
  return out
}

const land = await load(LAND)
const landRings: { meta: number; coords: number[] }[] = []
for (const f of land) {
  const rank = rankOf(f.properties)
  const g = f.geometry
  const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Position[][][]
  for (const poly of polys) {
    poly.forEach((ring, i) => {
      const coords = flat(ring)
      if (coords.length >= 8) landRings.push({ meta: rank | (i > 0 ? 16 : 0), coords })
    })
  }
}

const borders = await load(BORDERS)
const borderLines: { meta: number; coords: number[] }[] = []
for (const f of borders) {
  const cls = BORDER_CLASSES.indexOf(f.properties.FEATURECLA as (typeof BORDER_CLASSES)[number])
  if (cls < 0) throw new Error(`unknown border class '${String(f.properties.FEATURECLA)}'`)
  const g = f.geometry
  const lines = (g.type === "LineString" ? [g.coordinates] : g.coordinates) as Position[][]
  for (const line of lines) {
    const coords = flat(line)
    if (coords.length >= 4) borderLines.push({ meta: rankOf(f.properties) | (cls << 4), coords })
  }
}

const count = (rs: { coords: number[] }[]) => rs.reduce((n, r) => n + r.coords.length / 2, 0)
const landB64 = encodeRings(landRings)
const bordersB64 = encodeRings(borderLines)

const out = `/**
 * Natural Earth 1:50m, packed — GENERATED by gen-data.ts. Do not edit.
 *
 * Source: Natural Earth (public domain), nvkelso/natural-earth-vector @ ${TAG}
 *   ${LAND}: ${landRings.length} rings, ${count(landRings)} points
 *   ${BORDERS}: ${borderLines.length} lines, ${count(borderLines)} points
 * Format: codec.ts (1/1000-degree grid, zigzag varint deltas, base64).
 */

export const NE_TAG = ${JSON.stringify(TAG)}

/** Land polygons: outer rings, each followed by its holes. */
export const LAND_50M = ${JSON.stringify(landB64)}

/** Admin-0 land boundaries, as open lines. */
export const BORDERS_50M = ${JSON.stringify(bordersB64)}
`
writeFileSync(join(here, "naturalEarth.ts"), out)
console.log(
  `naturalEarth.ts: land ${landRings.length} rings / ${count(landRings)} pts, ` +
    `borders ${borderLines.length} lines / ${count(borderLines)} pts, ${(out.length / 1024).toFixed(0)} KB`,
)

// --- The features: lakes, rivers, country fills, labels ----------------------
//
// A second file, so the land and borders above stay byte-identical. Every
// layer is optional at draw time (Earth params default off) and ranked by
// Natural Earth's own min_zoom / min_label, like the rest.

/** Polygons as rings: outer (meta bit 0 clear) followed by its holes (bit 0 set). */
const polygonRings = (g: Feature["geometry"], meta: number, quantum: number) => {
  const out: { meta: number; coords: number[] }[] = []
  const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Position[][][]
  for (const poly of polys) {
    poly.forEach((ring, i) => {
      const coords = flat(ring, quantum)
      if (coords.length >= 8) out.push({ meta: meta * 2 + (i > 0 ? 1 : 0), coords })
    })
  }
  return out
}

const LAKE_Q = 1000
const RIVER_Q = 500
const COUNTRY_Q = 200

const lakeRings = (await load(LAKES)).flatMap((f) => polygonRings(f.geometry, rankOf(f.properties), LAKE_Q))
const riverLines = (await load(RIVERS)).flatMap((f) => {
  const g = f.geometry
  if (!g) return []
  const lines = (g.type === "LineString" ? [g.coordinates] : g.coordinates) as Position[][]
  return lines.map((l) => ({ meta: rankOf(f.properties), coords: flat(l, RIVER_Q) })).filter((l) => l.coords.length >= 4)
})

// Countries: one table row each (ISO alpha-2, name, label point, label rank);
// every ring's meta is its row index (× 2, + hole).
const countries = await load(COUNTRIES)
const countryTable: [string, string, number, number, number][] = []
const countryRings: { meta: number; coords: number[] }[] = []
countries.forEach((f, i) => {
  const p = f.properties
  const iso = String(p.ISO_A2_EH ?? p.ISO_A2)
  countryTable.push([
    iso === "-99" ? String(p.ADM0_A3) : iso,
    String(p.NAME_EN ?? p.NAME),
    Math.round(Number(p.LABEL_X) * 1000) / 1000,
    Math.round(Number(p.LABEL_Y) * 1000) / 1000,
    Number(p.MIN_LABEL),
  ])
  countryRings.push(...polygonRings(f.geometry, i, COUNTRY_Q))
})

// Cities: every national capital, and every place Natural Earth ranks as
// worth a label by zoom 4 — about 240, the cities a world map names.
const cityTable: [string, number, number, number, number, number][] = (await load(PLACES))
  .filter((f) => f.properties.adm0cap === 1 || Number(f.properties.min_zoom) <= 4)
  .map((f) => {
    const p = f.properties
    return [
      String(p.name),
      Math.round(Number(p.longitude) * 1000) / 1000,
      Math.round(Number(p.latitude) * 1000) / 1000,
      Number(p.min_zoom),
      p.adm0cap === 1 ? 1 : 0,
      Number(p.pop_max) || 0,
    ]
  })

const features = `/**
 * Natural Earth 1:50m features, packed — GENERATED by gen-data.ts. Do not edit.
 *
 * Source: Natural Earth (public domain), nvkelso/natural-earth-vector @ ${TAG}
 *   ${LAKES}: ${lakeRings.length} rings, ${count(lakeRings)} points (1/${LAKE_Q}°)
 *   ${RIVERS}: ${riverLines.length} lines, ${count(riverLines)} points (1/${RIVER_Q}°)
 *   ${COUNTRIES}: ${countryTable.length} countries, ${countryRings.length} rings, ${count(countryRings)} points (1/${COUNTRY_Q}°)
 *   ${PLACES}: ${cityTable.length} cities (capitals + min_zoom ≤ 4)
 * Format: codec.ts (zigzag varint deltas, base64) on each layer's grid.
 */

export const LAKE_Q = ${LAKE_Q}
export const RIVER_Q = ${RIVER_Q}
export const COUNTRY_Q = ${COUNTRY_Q}

/** Lakes: meta = rank × 2 + hole. */
export const LAKES_50M = ${JSON.stringify(encodeRings(lakeRings, LAKE_Q))}

/** Rivers and lake centrelines: meta = rank. */
export const RIVERS_50M = ${JSON.stringify(encodeRings(riverLines, RIVER_Q))}

/** Country polygons: meta = row in COUNTRIES × 2 + hole. */
export const COUNTRY_RINGS_50M = ${JSON.stringify(encodeRings(countryRings, COUNTRY_Q))}

/** [ISO alpha-2 (or ADM0_A3 where NE has none), name, label lon, label lat, min_label]. */
export const COUNTRIES: readonly (readonly [string, string, number, number, number])[] = ${JSON.stringify(countryTable)}

/** [name, lon, lat, min_zoom, capital, population (pop_max)]. */
export const CITIES: readonly (readonly [string, number, number, number, number, number])[] = ${JSON.stringify(cityTable)}
`
writeFileSync(join(here, "naturalEarthFeatures.ts"), features)
console.log(
  `naturalEarthFeatures.ts: lakes ${lakeRings.length}/${count(lakeRings)}, rivers ${riverLines.length}/${count(riverLines)}, ` +
    `countries ${countryTable.length} (${count(countryRings)} pts), cities ${cityTable.length}, ${(features.length / 1024).toFixed(0)} KB`,
)

