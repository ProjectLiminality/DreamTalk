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
  cellOfPoint,
  cellsInBox,
  densifyLonLat,
  lonLatToUnits,
  splitRuns,
  triangulateSphere,
  type SphereMesh,
  type SpherePolygon,
  type Vec3,
} from "../../src/geometry/sphere"
import { decodeRings, type DetailPack, type Ring } from "./codec"
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

// --- Regions: where 1:10m packs replace 1:50m ------------------------------

/**
 * The cells a set of detail packs covers, and the two questions every layer
 * asks of it: which cells to triangulate from which dataset, and which side
 * of the region a point is on. The empty region (no packs) changes nothing.
 */
export interface Region {
  key: string
  packs: readonly DetailPack[]
  /** Triangulate 1:50m here (outside every pack). */
  outside: ((cell: number) => boolean) | undefined
  /** Triangulate a pack's 1:10m here. */
  inside: (cell: number) => boolean
  /** Is a surface point inside the region? */
  contains: (p: Vec3) => boolean
}

const regions = new Map<string, Region>()
export const regionOf = (packs: readonly DetailPack[] = []): Region => {
  const key = packs.map((p) => p.name).join("+")
  const hit = regions.get(key)
  if (hit) return hit
  const cells = new Set<number>()
  for (const pack of packs) for (const c of cellsInBox(pack.box, CELLS_PER_FACE)) cells.add(c)
  const region: Region = {
    key,
    packs,
    outside: packs.length ? (c) => !cells.has(c) : undefined,
    inside: (c) => cells.has(c),
    contains: (p) => cells.size > 0 && cells.has(cellOfPoint(p, CELLS_PER_FACE)),
  }
  regions.set(key, region)
  return region
}

/** The 1:50m part of a line outside the region (all of it when there is none). */
export const outsideOf = (region: Region, pts: Vec3[]): Vec3[][] =>
  region.packs.length ? splitRuns(pts, region.contains).outside : [pts]

/** The 1:10m part of a pack's line inside the region. */
export const insideOf = (region: Region, pts: Vec3[]): Vec3[][] => splitRuns(pts, region.contains).inside

/** Several meshes as one. */
export const mergeMeshes = (meshes: readonly SphereMesh[]): SphereMesh => {
  const nP = meshes.reduce((n, m) => n + m.positions.length, 0)
  const nI = meshes.reduce((n, m) => n + m.indices.length, 0)
  const positions = new Float32Array(nP)
  const indices = new Uint32Array(nI)
  let p = 0
  let i = 0
  for (const m of meshes) {
    positions.set(m.positions, p)
    const base = p / 3
    for (let k = 0; k < m.indices.length; k++) indices[i + k] = m.indices[k]! + base
    p += m.positions.length
    i += m.indices.length
  }
  return { positions, indices }
}

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

const lakeMemo = new Map<string, Lakes>()
export const lakeGeometry = (region: Region = regionOf()): Lakes => {
  const hit = lakeMemo.get(region.key)
  if (hit) return hit
  const sheets = new Map<number, SphereMesh[]>()
  const shores: RankedLine[] = []
  const take = (rings: readonly Ring[], keep: ((c: number) => boolean) | undefined, part: (pts: Vec3[]) => Vec3[][]) => {
    for (const [rank, polys] of polygonsByKey(rings)) {
      const list = sheets.get(rank) ?? []
      list.push(triangulateSphere(polys, CELLS_PER_FACE, keep))
      sheets.set(rank, list)
    }
    for (const r of rings) {
      for (const points of part(closed(lonLatToUnits(densifyLonLat(r.coords, MAX_STEP))))) {
        shores.push({ rank: r.meta >> 1, points })
      }
    }
  }
  take(decodeRings(LAKES_50M, LAKE_Q), region.outside, (pts) => outsideOf(region, pts))
  for (const pack of region.packs) take(decodeRings(pack.lakes, pack.quantum), region.inside, (pts) => insideOf(region, pts))
  const out: Lakes = { sheets: new Map([...sheets].map(([k, v]) => [k, mergeMeshes(v)])), shores }
  lakeMemo.set(region.key, out)
  return out
}

// --- Rivers ------------------------------------------------------------------

const riverMemo = new Map<string, RankedLine[]>()
export const riverGeometry = (region: Region = regionOf()): RankedLine[] => {
  const hit = riverMemo.get(region.key)
  if (hit) return hit
  const out: RankedLine[] = []
  const take = (rings: readonly Ring[], part: (pts: Vec3[]) => Vec3[][]) => {
    for (const r of rings) {
      for (const points of part(lonLatToUnits(densifyLonLat(r.coords, MAX_STEP)))) out.push({ rank: r.meta, points })
    }
  }
  take(decodeRings(RIVERS_50M, RIVER_Q), (pts) => outsideOf(region, pts))
  for (const pack of region.packs) take(decodeRings(pack.rivers, pack.quantum), (pts) => insideOf(region, pts))
  riverMemo.set(region.key, out)
  return out
}

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
export const countryMesh = (iso: string, region: Region = regionOf()): SphereMesh => {
  const key = `${iso}@${region.key}`
  const hit = countryMeshes.get(key)
  if (hit) return hit
  const row = COUNTRIES.findIndex((c) => c[0] === iso)
  if (row < 0) throw new Error(`Earth: no country '${iso}' in Natural Earth 1:50m`)
  countryPolys ??= polygonsByKey(decodeRings(COUNTRY_RINGS_50M, COUNTRY_Q))
  const parts = [triangulateSphere(countryPolys.get(row) ?? [], CELLS_PER_FACE, region.outside)]
  for (const pack of region.packs) {
    const packRow = pack.countryIsos.indexOf(iso)
    if (packRow < 0) continue
    const polys = polygonsByKey(decodeRings(pack.countries, pack.quantum)).get(packRow) ?? []
    parts.push(triangulateSphere(polys, CELLS_PER_FACE, region.inside))
  }
  const mesh = parts.length === 1 ? parts[0]! : mergeMeshes(parts)
  countryMeshes.set(key, mesh)
  return mesh
}

// --- Cities ------------------------------------------------------------------

export interface City {
  name: string
  lon: number
  lat: number
  minZoom: number
  capital: boolean
  population: number
}

export const cities = (): City[] =>
  CITIES.map(([name, lon, lat, minZoom, capital, population]) => ({
    name,
    lon,
    lat,
    minZoom,
    capital: capital === 1,
    population,
  }))

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
