/**
 * features.ts — the Earth's optional layers, as geometry: lakes, rivers,
 * country polygons, the graticule. Decoded and built lazily, once per
 * process each, from `naturalEarthFeatures.ts` (gen-data.ts).
 *
 * Everything here is pure data on the UNIT sphere; Earth.ts scales it to
 * its radius and turns it into holons. Each layer carries Natural Earth's
 * own rank (min_zoom × 2) so the Earth's `detail` brings it in the way it
 * brings in islands.
 */

import {
  densifyLonLat,
  lonLatToUnits,
  triangulateSphere,
  type SphereMesh,
  type SpherePolygon,
  type Vec3,
} from "../../src/geometry/sphere"
import { decodeRings, type Ring } from "./codec"
import {
  CITIES,
  COUNTRIES,
  COUNTRY_Q,
  COUNTRY_RINGS_50M,
  LAKE_Q,
  LAKES_50M,
  RIVER_Q,
  RIVERS_50M,
} from "./naturalEarthFeatures"

/** Longest step a stroke takes along the surface, degrees (as the coast). */
const MAX_STEP = 0.5
/** Grid cells per cube face for sheets (as the land). */
const CELLS_PER_FACE = 64

/** A polyline on the unit sphere with its LOD rank. */
export interface RankedLine {
  rank: number
  points: Vec3[]
}

/** Group meta-coded rings (meta = key × 2 + hole) into polygons per key. */
const polygonsByKey = (rings: readonly Ring[]): Map<number, SpherePolygon[]> => {
  const out = new Map<number, SpherePolygon[]>()
  for (const ring of rings) {
    const key = ring.meta >> 1
    const pts = lonLatToUnits(densifyLonLat(ring.coords, MAX_STEP))
    const list = out.get(key) ?? []
    if (ring.meta & 1) {
      const last = list[list.length - 1]
      if (last) (last.holes as Vec3[][]).push(pts)
    } else list.push({ outer: pts, holes: [] })
    out.set(key, list)
  }
  return out
}

const closed = (pts: Vec3[]): Vec3[] => [...pts, pts[0]!]

// --- Lakes -------------------------------------------------------------------

export interface Lakes {
  /** Lake surfaces, one mesh per rank. */
  sheets: Map<number, SphereMesh>
  /** Lake shores (outer rings and island rings), closed. */
  shores: RankedLine[]
}

let lakes: Lakes | undefined
export const lakeGeometry = (): Lakes => {
  if (lakes) return lakes
  const rings = decodeRings(LAKES_50M, LAKE_Q)
  const sheets = new Map<number, SphereMesh>()
  for (const [rank, polys] of polygonsByKey(rings)) sheets.set(rank, triangulateSphere(polys, CELLS_PER_FACE))
  const shores = rings.map((r) => ({
    rank: r.meta >> 1,
    points: closed(lonLatToUnits(densifyLonLat(r.coords, MAX_STEP))),
  }))
  lakes = { sheets, shores }
  return lakes
}

// --- Rivers ------------------------------------------------------------------

let rivers: RankedLine[] | undefined
export const riverGeometry = (): RankedLine[] =>
  (rivers ??= decodeRings(RIVERS_50M, RIVER_Q).map((r) => ({
    rank: r.meta,
    points: lonLatToUnits(densifyLonLat(r.coords, MAX_STEP)),
  })))

// --- Countries ---------------------------------------------------------------

/** One country's table row (gen-data.ts). */
export interface Country {
  iso: string
  name: string
  labelLon: number
  labelLat: number
  minLabel: number
}

export const countries = (): Country[] =>
  COUNTRIES.map(([iso, name, labelLon, labelLat, minLabel]) => ({ iso, name, labelLon, labelLat, minLabel }))

let countryPolys: Map<number, SpherePolygon[]> | undefined
const countryMeshes = new Map<string, SphereMesh>()

/**
 * A country's territory triangulated on the unit sphere, by ISO alpha-2
 * (or Natural Earth's ADM0_A3 where it has no alpha-2). Built on first
 * ask and remembered — only the countries a scene highlights are paid for.
 */
export const countryMesh = (iso: string): SphereMesh => {
  const hit = countryMeshes.get(iso)
  if (hit) return hit
  const row = COUNTRIES.findIndex((c) => c[0] === iso)
  if (row < 0) throw new Error(`Earth: no country '${iso}' in Natural Earth 1:50m`)
  countryPolys ??= polygonsByKey(decodeRings(COUNTRY_RINGS_50M, COUNTRY_Q))
  const mesh = triangulateSphere(countryPolys.get(row) ?? [], CELLS_PER_FACE)
  countryMeshes.set(iso, mesh)
  return mesh
}

// --- Cities ------------------------------------------------------------------

export interface City {
  name: string
  lon: number
  lat: number
  minZoom: number
  capital: boolean
}

export const cities = (): City[] =>
  CITIES.map(([name, lon, lat, minZoom, capital]) => ({ name, lon, lat, minZoom, capital: capital === 1 }))

// --- Graticule ---------------------------------------------------------------

/**
 * Meridians and parallels every `step` degrees as surface curves, plus a
 * finer set every `step / 3` ranked to arrive at map zoom 3 — the grid
 * densifies as the eye descends. Meridians run pole to pole; parallels
 * stop short of the poles, where they would be points.
 */
export const graticuleLines = (step = 15): RankedLine[] => {
  const out: RankedLine[] = []
  const fine = step / 3
  const along = (coords: number[]) => lonLatToUnits(densifyLonLat(coords, MAX_STEP))
  for (let lon = -180; lon < 180 - 1e-9; lon += fine) {
    const major = Math.abs(lon / step - Math.round(lon / step)) < 1e-9
    out.push({ rank: major ? 0 : 6, points: along([lon, -90, lon, 90]) })
  }
  for (let lat = -90 + fine; lat < 90 - 1e-9; lat += fine) {
    const major = Math.abs(lat / step - Math.round(lat / step)) < 1e-9
    const coords: number[] = []
    for (let lon = -180; lon <= 180; lon += 90) coords.push(lon, lat)
    out.push({ rank: major ? 0 : 6, points: along(coords) })
  }
  return out
}
