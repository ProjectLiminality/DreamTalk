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

/** Flatten a coordinate list, dropping consecutive repeats (on the 1/1000 grid). */
const flat = (pts: Position[]): number[] => {
  const out: number[] = []
  let lx = NaN
  let ly = NaN
  for (const [x, y] of pts) {
    const qx = Math.round(x * 1000)
    const qy = Math.round(y * 1000)
    if (qx === lx && qy === ly) continue
    out.push(qx / 1000, qy / 1000)
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
