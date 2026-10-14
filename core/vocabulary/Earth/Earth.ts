/**
 * Earth — the planet as one programmatic object: a true 3D sphere, its
 * land filled ON the sphere, its coastlines and country borders as strokes
 * lying on the surface, ready to draw on, zoom into, and build upon.
 *
 * THE SPHERE ITSELF, NOT A PICTURE OF ONE
 *
 * DreamTalk's first globe (Web3's, since retired into this one) projected
 * lon/lat flat to a disc each frame and folded its far half onto the limb
 * in 2D — a picture of a sphere for one camera that never moved. The
 * Earth is the sphere itself: every vertex is a point in 3D, the camera is
 * the scene's observer wherever it goes, and the far side is hidden
 * because it IS behind the planet, by depth, per pixel, on the GPU (solid
 * Surfaces, parts/surface.ts). Web3 now sets this Earth on its flat pages
 * through `parts/recede.ts`.
 *
 * HOW THE FAR SIDE IS HIDDEN — EXACTLY
 *
 * A point on a sphere is visible from an eye exactly when it lies in front
 * of the HORIZON PLANE — the plane of the circle where sight lines graze
 * the surface (p·ĉ > R²/d; geometry/sphere.ts `horizonCircle`). So the
 * occluder is that plane, filled as a solid disc out to the horizon circle
 * and rebuilt from the camera every frame it moves. It is exact for
 * everything ON the surface, and — unlike the ball itself as an occluder —
 * it is flat: a ball is steep in depth near its silhouette, which forces
 * a choice between eating the inner half of every front stroke (a
 * ribbon's quad has its line's depth across its whole width) and letting
 * the far side's coasts leak through at the limb. Measured, not guessed:
 * a slope-biased ball showed Brazil's hidden coast as a bright arc on the
 * limb of the framed-Europe view; the horizon disc shows nothing there.
 *
 * The disc needs the eye: `seenFrom(observer)` (EarthView's `followEarth`
 * calls it). Until told, the Earth assumes the framework's DEFAULT observer
 * (perspective, 1500 out on +z) — exact for any scene that never moves the
 * camera, and close for a front-on one. The BALL stays, sunk 1% under the surface, as the ground:
 * it hides what is underground — a building rising out of the earth — and
 * is far enough down never to touch a stroke on the surface.
 *
 * WHAT IT IS MADE OF (attach order is composite order)
 *
 *   ball     the ground — a solid Surface of `sea` colour, 1% under.
 *   horizon  the occluding disc, `sea` colour (needs `seenFrom`).
 *   land     the landmass as triangle sheets on the sphere (one per LOD
 *            rank), `land` colour × `landOpacity`.
 *   coast    the shoreline, one Line per run of land boundary.
 *   borders  admin-0 land boundaries, one Line each.
 *   limb     the silhouette circle as a stroke (off unless `limbStroke`).
 *   places   whatever the scene anchors in the Earth's frame (`Place`s,
 *            and the `Connection` arcs between them).
 *
 * `sea` defaults to black: on the black page the Earth is ONLY its land and
 * lines, and yet it occludes.
 *
 * THE DATA IS THE WORLD'S, NOT OURS
 *
 * Natural Earth 1:50m (public domain), packed into `naturalEarth.ts` by
 * `gen-data.ts` from a pinned release — see that script for source,
 * licence, and why coast strokes are derived from the land polygons (one
 * dataset: fill and shore can never disagree). Nothing is hand-drawn.
 *
 * DRAWING ON
 *
 * `coastDraw` and `borderDraw` are each ONE param shared by every Line of
 * their set, so the whole shoreline draws on together (every run from its
 * own start, all finishing as one) and the borders can arrive separately —
 * later, as the camera descends, the way a web map reveals them. `Create`
 * runs coast → land → borders; scenes usually drive the three directly.
 *
 * LOD
 *
 * Every ring carries Natural Earth's `min_zoom`, the cartographers' own
 * rank of when a feature earns its place. `detail` is the map zoom the
 * Earth is drawn for: a feature ranked above it fades out over one zoom
 * level. 2 is a clean whole-globe (continents and the major islands); 4
 * shows every islet in the 50m data. A rank fades over the half-level
 * below its min_zoom, so a half-integer `detail` is always crisp. `EarthView` can drive it from the
 * camera so islands arrive as you descend.
 *
 * SIZE AND COST
 *
 * ~1,600 coast runs, ~390 borders, ~76k land triangles, ~80k line points.
 * Built once per process (the decoded, densified, triangulated geography
 * is memoised; ~150 ms), static thereafter: rotating the Earth or flying
 * the camera re-uploads nothing.
 */

import { Euler, Matrix4, Vector3 } from "three/webgpu"
import { Holon, type Overrides } from "../../src/holon"
import { derivePoints, Line, Null, type Vec3Like } from "../../src/parts/primitives"
import { Surface } from "../../src/parts/surface"
import { color, completion, derive, length, paramEpoch, scalar } from "../../src/params"
import { together, type Anim } from "../../src/anim"
import { RED, rgb, WHITE } from "../../src/constants"
import type { Observer } from "../../src/dream"
import { localView, toWorld, viewOf, type View } from "../../src/geometry/frames"
import type { KeepOut } from "../../src/view"
import { axis, toggle, type Axis, type StateSpace } from "../../src/automaton"
import {
  angleBetween,
  densifyLonLat,
  horizonCircle,
  sphereBand,
  tangentFrame,
  latLonToUnit,
  lonLatToUnits,
  sphereMesh,
  triangulateSphere,
  type SphereMesh,
  type SpherePolygon,
  type Vec3,
} from "../../src/geometry/sphere"
import { decodeRings, type DetailPack, type Ring } from "./codec"
import { BORDERS_50M, LAND_50M } from "./naturalEarth"
import {
  cities,
  countries,
  countryMesh,
  graticuleLines,
  insideOf,
  lakeGeometry,
  mergeMeshes,
  outsideOf,
  regionOf,
  riverGeometry,
  type Region,
} from "./features"
import { billboard, LabelLayout, makeLabel, type Label } from "./Labels"

/** Longest step a stroke takes along the surface, degrees (chord sag ~1e-5·R). */
const MAX_STEP = 0.5
/** Grid cells per cube face for the land triangulation (sphere.ts). */
const CELLS_PER_FACE = 64
/**
 * How far under `radius` the ball (the ground) sits, as a fraction of it.
 * Deep enough that its steep flanks near the silhouette never reach a
 * stroke lying on the surface (a ribbon spills ~1.5 px sideways at its
 * line's depth; 1% of R is several pixels at every zoom the data holds);
 * shallow enough that anything sunk to rise is hidden by it.
 */
export const BALL_INSET = 0.01
/** Segments of the horizon disc and limb circle. */
const HORIZON_SEGMENTS = 256

/** The LOD ranks Natural Earth uses (min_zoom × 2), 0…8. */
const RANKS = 9

/** One ring of geography, decoded and densified: its rank and unit points. */
interface GeoLine {
  rank: number
  /** Border class (codec BORDER_CLASSES), or -1 for coast. */
  cls: number
  points: Vec3[]
  /**
   * The feature's mean width on the unit sphere (2·area / perimeter of
   * its ring, radians) — Infinity for borders. What the outline's
   * screen-size LOD reads (see `fineness`).
   */
  width: number
}

/** Mean width 2A/P of a closed lon/lat ring (dense, degrees) on the unit sphere. */
const ringWidth = (dense: ArrayLike<number>, pts: readonly Vec3[]): number => {
  const D = Math.PI / 180
  const n = dense.length / 2
  let a = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    a += (dense[2 * j]! - dense[2 * i]!) * D * (2 + Math.sin(dense[2 * i + 1]! * D) + Math.sin(dense[2 * j + 1]! * D))
  }
  let perimeter = 0
  for (let i = 0; i < pts.length; i++) perimeter += angleBetween(pts[i]!, pts[(i + 1) % pts.length]!)
  return perimeter > 0 ? (2 * Math.abs(a / 2)) / perimeter : 0
}

interface Geography {
  /** Land meshes on the unit sphere, one per LOD rank (empty where none). */
  land: SphereMesh[]
  coast: GeoLine[]
  borders: GeoLine[]
  ball: SphereMesh
}

const memo = new Map<string, Geography>()

/**
 * Decode and build the geography once per process (per set of detail
 * packs). Coast runs are the land rings with the dataset's ARTEFACT edges
 * removed: the cut along the antimeridian (a polygon split at ±180 has a
 * straight edge there that is no shore) and Antarctica's walk along the
 * pole at −90. Each surviving run is a Line; an uncut ring stays one
 * closed loop.
 *
 * With packs, every layer is 1:50m outside the packs' cells and the pack's
 * 1:10m inside them: fills meet exactly along the cell lines, strokes are
 * cut where they cross the region's edge (features.ts Region).
 */
export const geography = (region: Region = regionOf()): Geography => {
  const hit = memo.get(region.key)
  if (hit) return hit
  const byRank: SpherePolygon[][][] = [Array.from({ length: RANKS }, () => [])]
  const coast: GeoLine[] = []
  const takeLand = (rings: readonly Ring[], polys: SpherePolygon[][], part: (pts: Vec3[]) => Vec3[][]) => {
    let rankOfOuter = 0
    for (const ring of rings) {
      const rank = Math.min(RANKS - 1, ring.meta & 15)
      const hole = (ring.meta & 16) !== 0
      const dense = densifyLonLat(ring.coords, MAX_STEP)
      const pts = lonLatToUnits(dense)
      if (hole) {
        const list = polys[rankOfOuter]!
        if (list.length) (list[list.length - 1]!.holes as Vec3[][]).push(pts)
      } else {
        rankOfOuter = rank
        polys[rank]!.push({ outer: pts, holes: [] })
      }
      const width = ringWidth(dense, pts)
      for (const run of shoreRuns(dense, pts)) {
        for (const points of part(run)) coast.push({ rank: hole ? rankOfOuter : rank, cls: -1, points, width })
      }
    }
  }
  takeLand(decodeRings(LAND_50M), byRank[0]!, (pts) => outsideOf(region, pts))
  for (const pack of region.packs) {
    const polys: SpherePolygon[][] = Array.from({ length: RANKS }, () => [])
    byRank.push(polys)
    takeLand(decodeRings(pack.land, pack.quantum), polys, (pts) => insideOf(region, pts))
  }
  const borders: GeoLine[] = []
  const takeBorders = (rings: readonly Ring[], part: (pts: Vec3[]) => Vec3[][]) => {
    for (const line of rings) {
      for (const points of part(lonLatToUnits(densifyLonLat(line.coords, MAX_STEP)))) {
        borders.push({ rank: Math.min(RANKS - 1, line.meta & 15), cls: (line.meta >> 4) & 7, points, width: Infinity })
      }
    }
  }
  takeBorders(decodeRings(BORDERS_50M), (pts) => outsideOf(region, pts))
  for (const pack of region.packs) takeBorders(decodeRings(pack.borders, pack.quantum), (pts) => insideOf(region, pts))
  const land = Array.from({ length: RANKS }, (_, rank) =>
    mergeMeshes(
      byRank.map((polys, k) =>
        triangulateSphere(polys[rank]!, CELLS_PER_FACE, k === 0 ? region.outside : region.inside),
      ),
    ),
  )
  const geo: Geography = { land, coast, borders, ball: sphereMesh() }
  memo.set(region.key, geo)
  return geo
}

/** Is the lon/lat step a → b an artefact of the lon/lat cut, not a shore? */
const artefact = (lonA: number, latA: number, lonB: number, latB: number): boolean =>
  (Math.abs(lonA) === 180 && Math.abs(lonB) === 180) || (latA <= -89.999 && latB <= -89.999)

/**
 * Split a closed land ring (dense lon/lat + its unit points) into shore
 * runs at its artefact edges. A ring with none comes back as one CLOSED
 * loop (first point repeated last).
 */
const shoreRuns = (dense: number[], pts: Vec3[]): Vec3[][] => {
  const n = pts.length
  const cut: boolean[] = []
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    cut.push(artefact(dense[2 * i]!, dense[2 * i + 1]!, dense[2 * j]!, dense[2 * j + 1]!))
  }
  const firstCut = cut.indexOf(true)
  if (firstCut < 0) {
    const loop = pts.slice()
    const a = loop[0]!
    const b = loop[loop.length - 1]!
    if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > 1e-12) loop.push(a)
    return [loop]
  }
  // Walk once round the ring starting just after a cut, so no run wraps.
  const runs: Vec3[][] = []
  let run: Vec3[] = []
  for (let k = 1; k <= n; k++) {
    const i = (firstCut + k) % n
    run.push(pts[i]!)
    if (cut[i]) {
      if (run.length >= 2) runs.push(run)
      run = []
    }
  }
  if (run.length >= 2) runs.push(run)
  return runs
}

/**
 * A feature of rank r (min_zoom × 2) is fully drawn once `detail` reaches
 * its min_zoom and gone half a zoom level before — one rank step, so at any
 * half-integer `detail` every feature is wholly in or wholly out (no
 * half-lit islands at rest), and a descending camera fades each rank in
 * over the half-level that brings it.
 */
export const lod = (rank: number, detail: number): number =>
  Math.max(0, Math.min(1, 2 * (detail - rank / 2) + 1))

const scaled = (points: readonly Vec3[], r: number): Vec3Like[] =>
  points.map((p) => ({ x: p.x * r, y: p.y * r, z: p.z * r }))

const scaledMesh = (mesh: SphereMesh, r: number): Float32Array => {
  const out = new Float32Array(mesh.positions.length)
  for (let i = 0; i < out.length; i++) out[i] = mesh.positions[i]! * r
  return out
}

/** The quiet grey borders default to — present, never louder than the shore. */
export const BORDER_GREY = rgb(0x8c, 0x8c, 0x8c)

export class Earth extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The sphere's radius in scene units. Construction-time (geometry is built at it); animate `scale` to resize. */
  radius = length(400)

  /** The ocean — the ball's colour. Black by default: on black, the Earth is its land. */
  sea = color(rgb(0, 0, 0))
  /** The landmass fill colour. */
  land = color(WHITE)
  /** The landmass fill's opacity — 0 leaves the Earth as line art. */
  landOpacity = completion(1)

  /**
   * LIGHT ON THE LAND: the land's colour falls off radially from a place on
   * the surface — `land × (1 − lightFalloff · smoothstep(0, lightReach, |p − c|))`,
   * c at (lightLat, lightLon). An insight lighting the world from one point
   * and spreading (Web3's LightSpread). Off at `lightFalloff` 0 (the
   * default); `lightReach` 0 means the sheet's own extent.
   */
  lightLat = scalar(0)
  lightLon = scalar(0)
  lightFalloff = completion(0)
  lightReach = length(0)

  /** Shoreline stroke: colour, pixel width, opacity, and its shared draw-on. */
  coastTint = color(WHITE)
  coastStroke = length(1.5)
  coastOpacity = completion(1)
  coastDraw = completion(1)

  /** Country borders: colour, pixel width, opacity, and their shared draw-on. */
  borderTint = color(BORDER_GREY)
  borderStroke = length(1)
  borderOpacity = completion(1)
  borderDraw = completion(1)

  /** The map zoom the Earth is drawn for (Natural Earth min_zoom): see LOD above. */
  detail = scalar(2)

  /** The silhouette circle as a stroke — 0 (the default) draws none. Needs `seenFrom`. */
  limbTint = color(rgb(0x30, 0x30, 0x30))
  limbStroke = length(0)
  limbOpacity = completion(1)
  limbDraw = completion(1)

  // --- Optional layers: each off by default, each ranked for LOD ---------

  /** Lat/lon lines every `graticuleStep`° (a finer set arrives at map zoom 3). 0 opacity = off. */
  graticuleTint = color(rgb(0x2a, 0x2a, 0x2a))
  graticuleStroke = length(0.8)
  graticuleOpacity = completion(0)
  /** Degrees between major graticule lines — construction-time. */
  graticuleStep = 15

  /** Lakes: their water (`lake`, default the sea's black) and their shores (the coast's pen). */
  lake = color(rgb(0, 0, 0))
  lakeOpacity = completion(0)

  /**
   * Major rivers and lake centrelines. A light blue on purpose: strokes
   * composite by MAX, so a river shows over a lit country only where it is
   * brighter than the fill in some channel — this one clears the red and
   * the blue highlights both, and still reads as water on the dim land.
   */
  riverTint = color(rgb(0x5a, 0xa8, 0xe0))
  riverStroke = length(1)
  riverOpacity = completion(0)
  riverDraw = completion(1)

  /**
   * Countries to be able to light up, by ISO alpha-2 ("AT", "EG", …).
   * Construction-time: each listed country gets its own sheet on the
   * sphere, reached by `country(iso)` — animate its `fillOpacity` and
   * `tint`. Only the listed ones are triangulated.
   */
  highlight: string[] = []

  /**
   * Regional 1:10m detail packs (codec.ts DetailPack, e.g. packs/alps10m.ts).
   * Construction-time: inside a pack's box every layer is drawn from 1:10m,
   * everywhere else from 1:50m — for the close views 1:50m cannot hold.
   * A scene imports only the packs it needs, so the default bundle stays
   * the 1:50m world.
   */
  packs: DetailPack[] = []

  /**
   * Labels to build — construction-time, none by default. `countries`:
   * build country names with Natural Earth min_label up to this; `cities`:
   * city names with min_zoom up to this. Each still fades in by `detail`
   * and out toward the horizon; `labelOpacity` dims them all.
   */
  labels: { countries?: number; cities?: number } = {}
  labelTint = color(rgb(0xb0, 0xb0, 0xb0))
  labelOpacity = completion(1)
  /**
   * DAY AND NIGHT. The sun stands over (sunLat, sunLon); the night side —
   * every point more than 90° from it — is covered by `nightTint` at
   * `nightOpacity`, softened across a twilight band of `twilight` degrees
   * so dusk is a gradient, not a cut. The terminator (the day/night great
   * circle) is its own stroke. Both off by default.
   */
  sunLat = scalar(0)
  sunLon = scalar(0)
  nightTint = color(rgb(0, 0, 0))
  nightOpacity = completion(0)
  /** Width of the twilight band, degrees (construction-time). */
  twilight = 12
  terminatorTint = color(rgb(0x8c, 0x78, 0x50))
  terminatorStroke = length(1)
  terminatorOpacity = completion(0)

  /**
   * ATMOSPHERE: a hatched halo outside the limb — the silhouettes of a few
   * slightly larger spheres, fading outward, so the planet's edge glows in
   * lines rather than in a blur. `atmosphereWidth` is the halo's depth as
   * a fraction of the radius. Needs the eye (`seenFrom`).
   */
  atmosphereTint = color(rgb(0x2a, 0x5a, 0x8c))
  atmosphereOpacity = completion(0)
  atmosphereWidth = scalar(0.03)

  /** Label text height in screen pixels (720-line reference); cities are drawn at 0.85 of it. */
  labelSize = length(11)
  /**
   * Added to `detail` for labels only. Natural Earth's min_label assumes a
   * web map whose world is 1024 px across; a framed globe is ~600, so names
   * come in half a level later than the land they sit on.
   */
  labelBias = scalar(-0.5)

  /**
   * Holons to anchor on the surface — usually `Place`s, which seat their
   * contents at a lat/lon facing outward. Adopted at construction (the
   * Group pattern), so they turn with the Earth.
   */
  places: Holon[] = []

  /**
   * Data layers that lie ON the land — a Choropleth's country sheets.
   * Adopted like places, but composited with the fills: over the land and
   * its highlights, under the lakes and every stroke, so coasts and
   * borders stay drawn over the data.
   */
  layers: Holon[] = []

  ball!: Surface
  horizon!: Surface
  limb!: Line
  landSheets: Surface[] = []
  coastLines: Line[] = []
  borderLines: Line[] = []
  graticuleLines: Line[] = []
  lakeSheets: Surface[] = []
  lakeShores: Line[] = []
  riverLines: Line[] = []
  nightSheets: Surface[] = []
  terminator!: Line
  atmosphereRings: Line[] = []
  countryLabels: Label[] = []
  cityLabels: Label[] = []
  private countrySheets = new Map<string, Surface>()

  /** The sheet of a country listed in `highlight` — its `fillOpacity` and `tint` light it up. */
  country(iso: string): Surface {
    void this.parts
    const sheet = this.countrySheets.get(iso)
    if (!sheet) throw new Error(`Earth: country '${iso}' is not in highlight: [${this.highlight.join(", ")}]`)
    return sheet
  }

  constructor(overrides: Overrides = {}) {
    super(overrides)
    for (const held of [...this.layers, ...this.places]) {
      // Anything anchored on the Earth may ask to be seated: a Place binds
      // its radius, a data layer learns the planet it draws on.
      ;(held as Partial<Seated>).seatOn?.(this)
      this.add(held)
    }
  }

  protected override compose(): void {
    const region = regionOf(this.packs)
    const geo = geography(region)
    const r = this.radius.value

    this.ball = this.add(new Surface({ solid: true, tint: this.sea }))
    this.ball.positions = scaledMesh(geo.ball, r * (1 - BALL_INSET))
    this.ball.indices = geo.ball.indices

    // The occluder: the horizon plane, filled to the horizon circle,
    // rebuilt whenever the eye moves relative to the Earth.
    this.horizon = this.add(new Surface({ solid: true, tint: this.sea }))
    deriveSurface(this.horizon, () => this.horizonKey(), () => {
      const h = this.horizonNow()
      return h ? discMesh(h) : { positions: new Float32Array(0), indices: new Uint32Array(0) }
    })

    geo.land.forEach((mesh, rank) => {
      if (mesh.indices.length === 0) return
      const sheet = this.add(
        new Surface({
          tint: this.land,
          fillOpacity: derive(() => this.landOpacity.value * lod(rank, this.detail.value)),
          fillFalloff: this.lightFalloff,
          fillFalloffRadius: this.lightReach,
          fillFalloffX: derive(() => this.latLonToLocal(this.lightLat.value, this.lightLon.value).x),
          fillFalloffY: derive(() => this.latLonToLocal(this.lightLat.value, this.lightLon.value).y),
          fillFalloffZ: derive(() => this.latLonToLocal(this.lightLat.value, this.lightLon.value).z),
        }),
      )
      sheet.positions = scaledMesh(mesh, r)
      sheet.indices = mesh.indices
      this.landSheets.push(sheet)
    })

    // The highlighted countries over the land, then the lakes over both —
    // a lit country's lakes stay water.
    for (const iso of this.highlight) {
      const mesh = countryMesh(iso, region)
      const sheet = this.add(new Surface({ tint: RED, fillOpacity: 0 }))
      sheet.positions = scaledMesh(mesh, r)
      sheet.indices = mesh.indices
      this.countrySheets.set(iso, sheet)
    }
    // Data layers (re-adopted here: attach order is composite order).
    for (const layer of this.layers) this.add(layer)
    const lakes = lakeGeometry(region)
    for (const [rank, mesh] of [...lakes.sheets].sort((a, b) => a[0] - b[0])) {
      if (mesh.indices.length === 0) continue
      const sheet = this.add(
        new Surface({
          tint: this.lake,
          fillOpacity: derive(() => this.lakeOpacity.value * lod(rank, this.detail.value)),
        }),
      )
      sheet.positions = scaledMesh(mesh, r)
      sheet.indices = mesh.indices
      this.lakeSheets.push(sheet)
    }
    // Night over everything filled: a full-strength cap beyond the twilight,
    // then thin bands across it whose opacity falls toward the day side.
    const sun = () => latLonToUnit(this.sunLat.value, this.sunLon.value)
    const sunKey = () => `${this.sunLat.value},${this.sunLon.value}`
    const anti = (): Vec3 => {
      const p = sun()
      return { x: -p.x, y: -p.y, z: -p.z }
    }
    const tw = (this.twilight * Math.PI) / 180
    const BANDS = 12
    const bands: [number, number, number][] = [[0, Math.PI / 2 - tw / 2, 1]]
    for (let k = 0; k < BANDS; k++) {
      const a0 = Math.PI / 2 - tw / 2 + (tw * k) / BANDS
      bands.push([a0, a0 + tw / BANDS, 1 - (k + 0.5) / BANDS])
    }
    for (const [a0, a1, weight] of bands) {
      const sheet = this.add(
        new Surface({ tint: this.nightTint, fillOpacity: derive(() => this.nightOpacity.value * weight) }),
      )
      deriveSurface(sheet, sunKey, () => {
        const m = sphereBand(anti(), a0, a1)
        return { positions: scaledMesh(m, r), indices: m.indices }
      })
      this.nightSheets.push(sheet)
    }

    const strokes = new Null()
    this.add(strokes)
    // The graticule lies under every other stroke.
    for (const g of graticuleLines(this.graticuleStep)) {
      this.graticuleLines.push(
        addTo(
          strokes,
          new Line({
            points: scaled(g.points, r),
            tint: this.graticuleTint,
            stroke: this.graticuleStroke,
            opacity: derive(() => this.graticuleOpacity.value * lod(g.rank, this.detail.value)),
          }),
        ),
      )
    }
    const fineness = this.finenessGauge()
    const lineOf = (g: GeoLine, kind: "coast" | "border"): Line => {
      const coast = kind === "coast"
      const presence = coast ? this.coastOpacity : this.borderOpacity
      return new Line({
        points: scaled(g.points, r),
        tint: coast ? this.coastTint : this.borderTint,
        stroke: coast ? this.coastStroke : this.borderStroke,
        creation: coast ? this.coastDraw : this.borderDraw,
        opacity: derive(
          () => presence.value * lod(g.rank, this.detail.value) * (coast ? fineness(g.width) : 1),
        ),
      })
    }
    for (const g of geo.coast) this.coastLines.push(addTo(strokes, lineOf(g, "coast")))
    for (const g of lakes.shores) {
      this.lakeShores.push(
        addTo(
          strokes,
          new Line({
            points: scaled(g.points, r),
            tint: this.coastTint,
            stroke: this.coastStroke,
            creation: this.coastDraw,
            opacity: derive(() => this.lakeOpacity.value * this.coastOpacity.value * lod(g.rank, this.detail.value)),
          }),
        ),
      )
    }
    for (const g of riverGeometry(region)) {
      this.riverLines.push(
        addTo(
          strokes,
          new Line({
            points: scaled(g.points, r),
            tint: this.riverTint,
            stroke: this.riverStroke,
            creation: this.riverDraw,
            opacity: derive(() => this.riverOpacity.value * lod(g.rank, this.detail.value)),
          }),
        ),
      )
    }
    for (const g of geo.borders) this.borderLines.push(addTo(strokes, lineOf(g, "border")))
    this.terminator = addTo(
      strokes,
      new Line({ tint: this.terminatorTint, stroke: this.terminatorStroke, opacity: this.terminatorOpacity }),
    )
    derivePoints(this.terminator, () => [sunKey()], () => {
      const c = sun()
      return circlePoints({ centre: { x: 0, y: 0, z: 0 }, normal: c, radius: r * 1.0005 })
    })

    // The atmosphere: silhouettes of slightly larger spheres, fading out.
    const RINGS = 7
    for (let k = 1; k <= RINGS; k++) {
      const f = k / RINGS
      const ring = this.add(
        new Line({
          tint: this.atmosphereTint,
          stroke: 1,
          opacity: derive(() => this.atmosphereOpacity.value * Math.pow(1 - f + 1 / RINGS, 1.6)),
        }),
      )
      derivePoints(ring, () => [this.horizonKey(), this.atmosphereWidth.value], () => {
        const e = this.localEye()
        if (!e) return []
        const h = horizonCircle(e.point, r * (1 + this.atmosphereWidth.value * f), e.orthographic)
        return h ? circlePoints(h) : []
      })
      this.atmosphereRings.push(ring)
    }

    // The limb: the horizon circle, lifted a hair toward the eye so the
    // disc it rims never covers its own edge.
    this.limb = this.add(
      new Line({
        tint: this.limbTint,
        stroke: this.limbStroke,
        opacity: this.limbOpacity,
        creation: this.limbDraw,
      }),
    )
    derivePoints(this.limb, () => [this.horizonKey()], () => {
      const h = this.horizonNow()
      if (!h) return []
      const lift = r * 0.002
      return circlePoints({
        ...h,
        centre: {
          x: h.centre.x + h.normal.x * lift,
          y: h.centre.y + h.normal.y * lift,
          z: h.centre.z + h.normal.z * lift,
        },
      })
    })

    // Labels, over every stroke and under the places.
    const { countries: maxCountry, cities: maxCity } = this.labels
    if (maxCountry !== undefined || maxCity !== undefined) {
      const board = billboard(this)
      const layout = new LabelLayout(this, board)
      const labels = new Null()
      this.add(labels)
      if (maxCountry !== undefined) {
        for (const c of countries()) {
          if (!(c.minLabel <= maxCountry)) continue
          this.countryLabels.push(
            addTo(labels, makeLabel(this, board, layout, {
              lat: c.labelLat, lon: c.labelLon, text: c.name.toUpperCase(), rank: Math.round(c.minLabel * 2), kind: "country",
            })),
          )
        }
      }
      if (maxCity !== undefined) {
        for (const c of cities()) {
          if (!(c.minZoom <= maxCity)) continue
          this.cityLabels.push(
            addTo(labels, makeLabel(this, board, layout, {
              lat: c.lat, lon: c.lon, text: c.name, rank: Math.round(c.minZoom * 2), kind: "city",
              capital: c.capital, population: c.population,
            })),
          )
        }
      }
    }

    // The places were adopted at construction (so a scene animating one
    // finds the Earth as its root before anything is composed); adopting
    // them again moves them to the END of the part list, because attach
    // order is composite order and a building must draw over the land.
    for (const place of this.places) this.add(place)
  }

  /**
   * SCREEN-SIZE LOD for shorelines: a feature narrower on screen than a
   * few pen widths keeps its fill and loses its outline. A 1.5 px stroke
   * round a 3 px island draws both shores as one doubled line — the
   * Dalmatian islands and the narrowest fjord tongues read as smudges, not
   * coasts. So an outline fades out between 4 and 2 stroke widths of the
   * feature's mean width (2·area/perimeter) at the eye's distance, as a web
   * map drops the outlines of what it can only show as a speck.
   *
   * ~1,600 shorelines ask every frame, so the gauge is built once over the
   * raw params (no proxy reads, no allocation): it re-measures the screen
   * scale only when a number that moves it has moved.
   */
  private finenessGauge(): (width: number) => number {
    const earth = this
    const own = [this.x, this.y, this.z, this.h, this.p, this.b, this.scale, this.radius]
    const pen = this.coastStroke
    const radius = this.radius
    const key: number[] = []
    let pxPerUnit = 1
    let lastPen = Number.NaN
    let lo = 0
    let hi = 0
    let seenEpoch = Number.NaN
    const remeasure = (): void => {
      // Nothing any param says has changed since the last call (paramEpoch
      // moves on every write): the ~1,600 shorelines after the first in a
      // frame answer from here.
      const epoch = paramEpoch()
      if (epoch === seenEpoch) return
      seenEpoch = epoch
      let i = 0
      let moved = false
      const o = earth.seer
      const at = (v: number) => {
        if (key[i] !== v) {
          key[i] = v
          moved = true
        }
        i++
      }
      if (o) {
        at(o.x.value); at(o.y.value); at(o.z.value); at(o.phi.value); at(o.theta.value)
        at(o.radius.value); at(o.zoom.value); at(o.fov.value); at(o.orthographic.value ? 1 : 0)
      }
      for (const p of own) at(p.value)
      // Every whole above the Earth moves its screen scale too (a parent
      // that scales or recedes it, parts/recede.ts).
      at(chainAt(earth, at))
      if (key.length !== i) {
        key.length = i
        moved = true
      }
      const w = Math.max(0.5, pen.value)
      if (!moved && w === lastPen) return
      lastPen = w
      const local = earth.localEye()
      const fov = o ? o.fov.value : (53.13 * Math.PI) / 180
      if (!local || local.orthographic) pxPerUnit = Infinity
      else {
        const altitude = Math.max(1e-6, Math.hypot(local.point.x, local.point.y, local.point.z) - radius.value)
        pxPerUnit = 360 / (altitude * Math.tan(fov / 2))
      }
      // In unit-sphere radians: the outline is gone below `lo`, whole above `hi`.
      lo = (2 * w) / (radius.value * pxPerUnit)
      hi = (4 * w) / (radius.value * pxPerUnit)
    }
    return (width: number): number => {
      if (!Number.isFinite(width)) return 1
      remeasure()
      if (width >= hi) return 1
      if (width <= lo) return 0
      const t = (width - lo) / (hi - lo)
      return t * t * (3 - 2 * t)
    }
  }

  /** The observer's vertical field of view — set by `seenFrom`. */
  lens?: () => number

  /** The observer the Earth was told about (`seenFrom`). */
  seer?: Observer

  /** Where the eye is, in world space (frames.ts View) — set by `seenFrom`. */
  eye?: () => View

  /**
   * Let the Earth know the camera, so it can hide its far side exactly
   * (the horizon disc) and draw its limb. The eye is the observer's view
   * as frames.ts `viewOf` states it — the one restatement of the host's
   * camera — so a camera change (the viewer's orbit layer, a tilt)
   * reaches the Earth through the same function as everything else.
   */
  seenFrom(observer: Observer): void {
    this.lens = () => observer.fov.value
    this.seer = observer
    this.eye = () => viewOf(observer)
  }

  /**
   * The eye in the Earth's own frame (through every transform above it):
   * a point, or — orthographic — a direction toward the viewer.
   */
  localEye(): { point: Vec3; orthographic: boolean } | undefined {
    const v = localView(this, this.eye?.() ?? DEFAULT_VIEW)
    return "eye" in v ? { point: v.eye, orthographic: false } : { point: v.toward, orthographic: true }
  }

  private horizonKey(): string {
    const e = this.localEye()
    return e ? `${e.point.x},${e.point.y},${e.point.z},${e.orthographic},${this.radius.value}` : "none"
  }

  private horizonNow(): ReturnType<typeof horizonCircle> {
    const e = this.localEye()
    return e ? horizonCircle(e.point, this.radius.value, e.orthographic) : undefined
  }

  /**
   * THE EARTH AS A VISUAL AUTOMATON (src/automaton.ts): the planet's own
   * degrees of freedom as walkable axes, each a key in free play —
   *
   *   n  time        day → dusk → night: the sun over Europe, the
   *                  terminator across it, Europe in the dark (a time of
   *                  day is the sun's place AND the night shown: one axis)
   *   d  land        the white globe ↔ the dim map (where borders read)
   *   b  borders     off ↔ on
   *   w  water       lakes and rivers off ↔ on
   *   g  graticule   off ↔ on
   *   a  atmosphere  off ↔ on
   *   l  labels      off ↔ on (only when labels were built)
   *
   * Every transition is the automaton's own: interruptible, reversible, a
   * pure function of its event log. A scene's timeline can take the same
   * paths (`this.play(earth.stateAxis("time").to("night"), 2.4)`).
   */
  override stateSpace(): StateSpace {
    void this.parts
    // A scene that drives a param (follows it, or shares a param it moves
    // itself) OWNS it: the walk offers only axes whose params are all free.
    const free = (...ps: { isBound: boolean }[]) => ps.every((p) => !p.isBound)
    const axes: Axis[] = []
    if (free(this.sunLat, this.sunLon, this.nightOpacity, this.terminatorOpacity)) {
      axes.push(
        axis(
          "time",
          this,
          {
            day: { sunLat: 12, sunLon: 15, nightOpacity: 0, terminatorOpacity: 0 },
            dusk: { sunLat: 12, sunLon: -75, nightOpacity: 0.92, terminatorOpacity: 0.9 },
            night: { sunLat: 12, sunLon: -165, nightOpacity: 0.92, terminatorOpacity: 0.9 },
          },
          { key: "n", duration: 2.4 },
        ),
      )
    }
    if (free(this.land)) {
      axes.push(axis("land", this, { globe: { land: WHITE }, map: { land: rgb(0x0e, 0x0e, 0x0e) } }, { key: "d" }))
    }
    if (free(this.borderOpacity)) axes.push(toggle("borders", this.borderOpacity, { key: "b" }))
    if (free(this.lakeOpacity, this.riverOpacity)) {
      axes.push(axis("water", this, { dry: { lakeOpacity: 0, riverOpacity: 0 }, wet: { lakeOpacity: 1, riverOpacity: 1 } }, { key: "w" }))
    }
    if (free(this.graticuleOpacity)) axes.push(toggle("graticule", this.graticuleOpacity, { key: "g", on: ["on", 0.6] }))
    if (free(this.atmosphereOpacity)) axes.push(toggle("atmosphere", this.atmosphereOpacity, { key: "a" }))
    if (this.countryLabels.length + this.cityLabels.length > 0 && free(this.labelOpacity)) {
      axes.push(toggle("labels", this.labelOpacity, { key: "l" }))
    }
    return { axes }
  }

  /**
   * The viewer's eye may not go underground (src/view.ts KeepOut): a free
   * orbit around a point on the surface rolls over the ground instead of
   * passing through the planet into black. The shell is 2% above the
   * surface — clear of every stroke and of the buildings standing on it.
   */
  override keepOut(): KeepOut[] {
    let scale = 1
    for (let h: Holon | undefined = this; h; h = h.parent) scale *= h.scale.value
    return [{ center: toWorld(this, { x: 0, y: 0, z: 0 }), radius: this.radius.value * Math.abs(scale) * 1.02 }]
  }

  /** A point on (or `altitude` above) the surface, in the Earth's local space. */
  latLonToLocal(lat: number, lon: number, altitude = 0): Vec3Like {
    const p = latLonToUnit(lat, lon)
    const k = this.radius.value + altitude
    return { x: p.x * k, y: p.y * k, z: p.z * k }
  }

  /**
   * Draw on: the limb (if it has a stroke), the shore, the land flooding
   * in behind it, the borders last. Every set is one shared param, so this
   * is four tracks however many Lines the world has.
   */
  override createAnim(): Anim {
    return together(
      [this.limbDraw.sequence(0, 1), 0, 0.3],
      [this.coastDraw.sequence(0, 1), 0.1, 0.6],
      [this.landOpacity.sequence(0, 1), 0.45, 0.85],
      [this.borderDraw.sequence(0, 1), 0.6, 1],
    )
  }

  override unCreateAnim(): Anim {
    return together(
      [this.borderDraw.to(0), 0, 0.4],
      [this.landOpacity.to(0), 0.15, 0.55],
      [this.coastDraw.to(0), 0.4, 0.9],
      [this.limbDraw.to(0), 0.7, 1],
    )
  }
}

/** Where an untold Earth assumes the camera is: a default Observer's pose (dream.ts). */
const DEFAULT_VIEW: View = { eye: { x: 0, y: 0, z: 1500 } }

/**
 * Feed every ancestor's transform to a cache key (`at`), returning the
 * chain's depth — so a cache keyed on an Earth also notices a parent that
 * moves, turns or scales it.
 */
export const chainAt = (holon: Holon, at: (v: number) => void): number => {
  let depth = 0
  for (let n = holon.parent; n; n = n.parent) {
    at(n.x.value); at(n.y.value); at(n.z.value); at(n.h.value); at(n.p.value); at(n.b.value); at(n.scale.value)
    depth++
  }
  return depth
}

type Circle3 = NonNullable<ReturnType<typeof horizonCircle>>

const circlePoints = (c: Circle3): Vec3Like[] => {
  const { u, w } = tangentFrame(c.normal)
  const pts: Vec3Like[] = []
  for (let i = 0; i <= HORIZON_SEGMENTS; i++) {
    const a = (i / HORIZON_SEGMENTS) * Math.PI * 2
    const cs = Math.cos(a) * c.radius
    const sn = Math.sin(a) * c.radius
    pts.push({
      x: c.centre.x + u.x * cs + w.x * sn,
      y: c.centre.y + u.y * cs + w.y * sn,
      z: c.centre.z + u.z * cs + w.z * sn,
    })
  }
  return pts
}

/** The horizon disc as a triangle fan — a hair oversized, so its rim is past the sphere's. */
const discMesh = (c: Circle3): { positions: Float32Array; indices: Uint32Array } => {
  const rim = circlePoints({ ...c, radius: c.radius * 1.0005 })
  const positions = new Float32Array((rim.length + 1) * 3)
  positions.set([c.centre.x, c.centre.y, c.centre.z], 0)
  rim.forEach((p, i) => positions.set([p.x, p.y, p.z], (i + 1) * 3))
  const indices = new Uint32Array(HORIZON_SEGMENTS * 3)
  for (let i = 0; i < HORIZON_SEGMENTS; i++) indices.set([0, i + 1, i + 2], i * 3)
  return { positions, indices }
}

/**
 * Give a Surface DERIVED geometry: rebuilt whenever `key` changes, read
 * through its `geomVersion` (the host's dirty check reads that first, then
 * the arrays) — the Surface twin of a derived Line's `points`.
 */
export const deriveSurface = (
  surface: Surface,
  key: () => string,
  build: () => { positions: Float32Array; indices: Uint32Array },
): void => {
  let last: string | undefined
  let version = surface.geomVersion
  Object.defineProperty(surface, "geomVersion", {
    configurable: true,
    enumerable: true,
    get() {
      const k = key()
      if (k !== last) {
        last = k
        const m = build()
        surface.positions = m.positions // each setter bumps the version below
        surface.indices = m.indices
      }
      return version
    },
    set(v: number) {
      version = v
    },
  })
}

/** Earth composes its stroke sets into a plain Null. */
const addTo = <T extends Holon>(parent: Holon, child: T): T =>
  parent.attach(child)

/** Something an Earth seats when it adopts it (Place, data layers). */
export interface Seated {
  seatOn(earth: Earth): void
}

/**
 * A spot on the Earth: holds its members at (lat, lon), lifted `altitude`
 * above the surface, turned so their local +y points straight up out of
 * the ground, +x east and +z south. Anything built standing on y = 0 then
 * stands on the planet.
 *
 * `altitude` is the param to animate for things that RISE: start a
 * building sunk below the surface (−height) and lift it to 0 — the ball
 * hides whatever is still underground, so it emerges from the earth
 * rather than scaling up from a point.
 *
 * Position and orientation are DERIVED (x/y/z/h/p/b follow lat, lon,
 * altitude and the Earth's radius), so a Place is moved by its lat/lon,
 * never by its transform.
 */
export class Place extends Null {
  lat = scalar(0)
  lon = scalar(0)
  altitude = scalar(0)
  /** The planet's radius — bound by the Earth that adopts this place. */
  radius = length(400)
  members: Holon[] = []

  constructor(overrides: Overrides = {}) {
    super(overrides)
    for (const m of this.members) this.add(m)
    const frame = (): { pos: Vec3Like; hpb: [number, number, number] } =>
      placeFrame(this.lat.value, this.lon.value, this.radius.value + this.altitude.value)
    this.x.follow(derive(() => frame().pos.x))
    this.y.follow(derive(() => frame().pos.y))
    this.z.follow(derive(() => frame().pos.z))
    this.h.follow(derive(() => frame().hpb[0]))
    this.p.follow(derive(() => frame().hpb[1]))
    this.b.follow(derive(() => frame().hpb[2]))
  }

  /** Bind this place to an Earth's radius (the Earth calls this on adoption). */
  seatOn(earth: Earth): void {
    this.radius.follow(derive(() => earth.radius.value))
  }
}

const scratch = { m: new Matrix4(), e: new Euler(), x: new Vector3(), y: new Vector3(), z: new Vector3() }

/**
 * Where a place sits and how it is turned: position at distance `r` along
 * (lat, lon), and the h/p/b that carry local axes onto east / up / south.
 * The host composes h/p/b as three's 'ZXY' Euler (three-host: rotation.set
 * (p, h, b, "ZXY")), so the basis is decomposed in that order.
 */
export const placeFrame = (
  lat: number,
  lon: number,
  r: number,
): { pos: Vec3Like; hpb: [number, number, number] } => {
  const up = latLonToUnit(lat, lon)
  const lam = (lon * Math.PI) / 180
  scratch.x.set(Math.cos(lam), 0, -Math.sin(lam)) // east
  scratch.y.set(up.x, up.y, up.z)
  scratch.z.crossVectors(scratch.x, scratch.y) // east × up = south
  scratch.m.makeBasis(scratch.x, scratch.y, scratch.z)
  scratch.e.setFromRotationMatrix(scratch.m, "ZXY")
  return {
    pos: { x: up.x * r, y: up.y * r, z: up.z * r },
    hpb: [scratch.e.y, scratch.e.x, scratch.e.z],
  }
}
