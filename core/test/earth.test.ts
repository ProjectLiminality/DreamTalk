/**
 * The Earth — its projection, its triangulation, its occluder and its data,
 * each pinned against an answer known independently of the code under test
 * (closed-form areas, the exact spherical area of the data's own rings, the
 * tangency that defines a horizon), so a wrong axis or a leaky triangulation
 * cannot hide behind a render that merely looks like a planet.
 */

import { describe, expect, test } from "bun:test"
import { Euler, Vector3 } from "three/webgpu"
import {
  angleBetween,
  densifyLonLat,
  horizonCircle,
  latLonToUnit,
  lonLatToUnits,
  meshArea,
  sphereBand,
  triangulateSphere,
  unitToLatLon,
  type SphereMesh,
  type Vec3,
} from "../src/geometry/sphere"
import { decodeRings, encodeRings, QUANTUM } from "../vocabulary/Earth/codec"
import { BORDERS_50M, LAND_50M } from "../vocabulary/Earth/naturalEarth"
import { Earth, geography, placeFrame, Place } from "../vocabulary/Earth/Earth"
import { EarthView, FlyTo, Focus, followEarth, viewDistance, viewPose, zoomForSpan } from "../vocabulary/Earth/EarthView"
import { cities, countries, countryMesh, graticuleLines, lakeGeometry, regionOf, riverGeometry } from "../vocabulary/Earth/features"
import { ALPS_10M } from "../vocabulary/Earth/packs/alps10m"
import { textWidth } from "../vocabulary/Earth/Labels"
import { Choropleth, sampleSeries, tableDomain } from "../vocabulary/Earth/Choropleth"
import { PointData } from "../vocabulary/Earth/PointData"
import { Connection } from "../vocabulary/Earth/Connection"
import { GHOST_FLOOR } from "../src/certainty"
import { sitePlaces } from "../vocabulary/Earth/Sites"
import { Factory } from "../vocabulary/Earth/Factory"
import { Headquarters } from "../vocabulary/Earth/Headquarters"
import { MOCK_SITES } from "../vocabulary/Earth/mockSites"
import { Surface } from "../src/parts/surface"
import { Group, Line } from "../src/parts/primitives"
import { Polylines } from "../src/parts/polylines"
import type { Holon } from "../src/holon"
import { Observer } from "../src/dream"
import { derive } from "../src/params"
import { WHITE } from "../src/constants"

const DEG = Math.PI / 180
const close = (a: Vec3, b: Vec3, digits = 9) => {
  expect(a.x).toBeCloseTo(b.x, digits)
  expect(a.y).toBeCloseTo(b.y, digits)
  expect(a.z).toBeCloseTo(b.z, digits)
}

describe("the frame", () => {
  test("the prime meridian on the equator faces the default camera (+z)", () => {
    close(latLonToUnit(0, 0), { x: 0, y: 0, z: 1 })
  })
  test("east is +x, so the map reads the right way round from outside", () => {
    close(latLonToUnit(0, 90), { x: 1, y: 0, z: 0 })
    close(latLonToUnit(0, -90), { x: -1, y: 0, z: 0 })
  })
  test("the poles are ±y", () => {
    close(latLonToUnit(90, 37), { x: 0, y: 1, z: 0 })
    close(latLonToUnit(-90, -120), { x: 0, y: -1, z: 0 })
  })
  test("lat/lon round-trips", () => {
    for (const [lat, lon] of [[48.2, 16.37], [-33.9, 151.2], [64.1, -21.9], [0, 179.9]] as const) {
      const ll = unitToLatLon(latLonToUnit(lat, lon))
      expect(ll.lat).toBeCloseTo(lat, 9)
      expect(ll.lon).toBeCloseTo(lon, 9)
    }
  })
  test("is the observer's own spherical convention: phi = lon, theta = lat looks straight down", () => {
    // three-host syncCamera: offset = (sin φ cos θ, sin θ, cos φ cos θ)
    const phi = 12 * DEG
    const theta = 49 * DEG
    const offset = { x: Math.sin(phi) * Math.cos(theta), y: Math.sin(theta), z: Math.cos(phi) * Math.cos(theta) }
    close(offset, latLonToUnit(49, 12))
  })
})

describe("densifyLonLat", () => {
  test("no step longer than the bound, every input point kept", () => {
    const line = [-123, 49, -95, 49] // the 49th parallel: one straight lon/lat segment
    const dense = densifyLonLat(line, 0.5)
    expect(dense.slice(0, 2)).toEqual([-123, 49])
    expect(dense.slice(-2)).toEqual([-95, 49])
    const pts = lonLatToUnits(dense)
    for (let i = 1; i < pts.length; i++) expect(angleBetween(pts[i - 1]!, pts[i]!) / DEG).toBeLessThan(0.5)
  })
  test("follows the parallel, not the great circle (the 49th stays at 49)", () => {
    const dense = densifyLonLat([-123, 49, -95, 49], 0.5)
    for (let i = 1; i < dense.length; i += 2) expect(dense[i]).toBeCloseTo(49, 12)
  })
})

/** Does the mesh cover direction p? (Spherical point-in-triangle, any triangle.) */
const covers = (mesh: SphereMesh, p: Vec3): boolean => {
  const P = mesh.positions
  const v = (i: number): Vec3 => ({ x: P[3 * i]!, y: P[3 * i + 1]!, z: P[3 * i + 2]! })
  const det = (a: Vec3, b: Vec3, c: Vec3) =>
    a.x * (b.y * c.z - b.z * c.y) - a.y * (b.x * c.z - b.z * c.x) + a.z * (b.x * c.y - b.y * c.x)
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = v(mesh.indices[t]!)
    const b = v(mesh.indices[t + 1]!)
    const c = v(mesh.indices[t + 2]!)
    const s = Math.sign(det(a, b, c))
    if (s === 0) continue
    if (Math.sign(det(p, b, c)) === s && Math.sign(det(a, p, c)) === s && Math.sign(det(a, b, p)) === s) return true
  }
  return false
}

const capRing = (lat: number, n = 360): Vec3[] =>
  Array.from({ length: n }, (_, i) => latLonToUnit(lat, -180 + (360 * i) / n))

describe("triangulateSphere", () => {
  test("a polar cap (wrapping the pole, crossing five cube faces) has its closed-form area", () => {
    // Everything north of 30°N: 2π(1 − sin 30°) = π.
    const mesh = triangulateSphere([{ outer: capRing(30), holes: [] }])
    expect(meshArea(mesh)).toBeCloseTo(Math.PI, 2)
    expect(Math.abs(meshArea(mesh) - Math.PI) / Math.PI).toBeLessThan(1e-3)
  })
  test("a hole is subtracted", () => {
    // North of 30° minus north of 60°: π − 2π(1 − sin 60°).
    const mesh = triangulateSphere([{ outer: capRing(30), holes: [capRing(60)] }])
    const want = Math.PI - 2 * Math.PI * (1 - Math.sin(60 * DEG))
    expect(Math.abs(meshArea(mesh) - want) / want).toBeLessThan(1e-3)
    expect(covers(mesh, latLonToUnit(45, 10))).toBe(true)
    expect(covers(mesh, latLonToUnit(75, 10))).toBe(false)
  })
  test("every vertex is on the unit sphere and every edge is short (the sphere is hugged)", () => {
    const mesh = triangulateSphere([{ outer: capRing(-10), holes: [] }], 64)
    const P = mesh.positions
    for (let i = 0; i < P.length; i += 3) expect(Math.hypot(P[i]!, P[i + 1]!, P[i + 2]!)).toBeCloseTo(1, 5)
    let longest = 0
    for (let t = 0; t < mesh.indices.length; t += 3) {
      for (const [i, j] of [[0, 1], [1, 2], [2, 0]] as const) {
        const a = mesh.indices[t + i]! * 3
        const b = mesh.indices[t + j]! * 3
        longest = Math.max(
          longest,
          angleBetween({ x: P[a]!, y: P[a + 1]!, z: P[a + 2]! }, { x: P[b]!, y: P[b + 1]!, z: P[b + 2]! }),
        )
      }
    }
    // A cell is ~1.4° across at 64 a face; its diagonal, stretched most at
    // the cube's corners, stays under 2.5° — a chord sagging ≤ 2.4e-4·R.
    expect(longest / DEG).toBeLessThan(2.5)
  })
})

describe("horizonCircle", () => {
  const R = 400
  const eye = { x: 300, y: 500, z: 900 }
  const h = horizonCircle(eye, R)!
  test("every sight line to the circle grazes the sphere (is tangent to it)", () => {
    const u = { x: 1, y: 0, z: 0 }
    // A point on the circle: centre + radius · (a unit vector ⟂ normal).
    const n = h.normal
    const d = u.x * n.x + u.y * n.y + u.z * n.z
    const t = { x: u.x - d * n.x, y: u.y - d * n.y, z: u.z - d * n.z }
    const l = Math.hypot(t.x, t.y, t.z)
    const p = { x: h.centre.x + (t.x / l) * h.radius, y: h.centre.y + (t.y / l) * h.radius, z: h.centre.z + (t.z / l) * h.radius }
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(R, 6)
    // (p − eye) ⟂ p: the ray touches the sphere at p.
    expect((p.x - eye.x) * p.x + (p.y - eye.y) * p.y + (p.z - eye.z) * p.z).toBeCloseTo(0, 4)
  })
  test("in front of its plane ⇔ visible, by an independent ray test", () => {
    const dist = Math.hypot(eye.x, eye.y, eye.z)
    for (let i = 0; i < 500; i++) {
      const p = latLonToUnit(-90 + ((i * 37) % 180), -180 + ((i * 113) % 360))
      const q = { x: p.x * R, y: p.y * R, z: p.z * R }
      const inFront = q.x * h.normal.x + q.y * h.normal.y + q.z * h.normal.z > (R * R) / dist
      // Ray eye → q hits the sphere first at q iff the nearer root is q itself.
      const dx = q.x - eye.x
      const dy = q.y - eye.y
      const dz = q.z - eye.z
      const a = dx * dx + dy * dy + dz * dz
      const b = 2 * (eye.x * dx + eye.y * dy + eye.z * dz)
      const c = eye.x ** 2 + eye.y ** 2 + eye.z ** 2 - R * R
      const t0 = (-b - Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a)
      const visible = t0 > 1 - 1e-9
      if (Math.abs(q.x * h.normal.x + q.y * h.normal.y + q.z * h.normal.z - (R * R) / dist) > 1e-6) {
        expect(inFront).toBe(visible)
      }
    }
  })
  test("orthographic: the plane through the centre, a great circle", () => {
    const o = horizonCircle({ x: 0, y: 0, z: 5 }, R, true)!
    close(o.centre, { x: 0, y: 0, z: 0 })
    expect(o.radius).toBe(R)
  })
  test("no horizon from inside", () => {
    expect(horizonCircle({ x: 0, y: 0, z: 100 }, R)).toBeUndefined()
  })
})

describe("the data (Natural Earth 1:50m, packed)", () => {
  const land = decodeRings(LAND_50M)
  const borders = decodeRings(BORDERS_50M)
  test("everything the generator wrote is there", () => {
    expect(land.length).toBe(1422)
    expect(land.reduce((n, r) => n + r.coords.length / 2, 0)).toBe(60669)
    expect(borders.length).toBe(393)
    expect(borders.reduce((n, r) => n + r.coords.length / 2, 0)).toBe(19758)
  })
  test("every coordinate is a real lon/lat on the 1/1000° grid", () => {
    for (const r of [...land, ...borders]) {
      for (let i = 0; i < r.coords.length; i += 2) {
        const lon = r.coords[i]!
        const lat = r.coords[i + 1]!
        expect(Math.abs(lon)).toBeLessThanOrEqual(180)
        expect(Math.abs(lat)).toBeLessThanOrEqual(90)
        expect(Math.abs(lon * QUANTUM - Math.round(lon * QUANTUM))).toBeLessThan(1e-6)
      }
    }
  })
  test("the codec round-trips exactly", () => {
    const rings = land.slice(0, 50).map((r) => ({ meta: r.meta, coords: [...r.coords] }))
    const back = decodeRings(encodeRings(rings))
    expect(back.map((r) => [r.meta, ...r.coords])).toEqual(rings.map((r) => [r.meta, ...r.coords]))
  })
  test("the triangulated land has the data's own exact spherical area", () => {
    // Independent of the triangulation: the ring-integral area of every
    // densified ring, holes subtracted (exact for lon/lat-linear edges).
    let exact = 0
    for (const r of land) {
      const c = densifyLonLat(r.coords, 0.5)
      let s = 0
      const n = c.length / 2
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        s += (c[2 * j]! - c[2 * i]!) * DEG * (2 + Math.sin(c[2 * i + 1]! * DEG) + Math.sin(c[2 * j + 1]! * DEG))
      }
      exact += Math.abs(s / 2) * (r.meta & 16 ? -1 : 1)
    }
    const meshed = geography().land.reduce((a, m) => a + meshArea(m), 0)
    expect(exact / (4 * Math.PI)).toBeCloseTo(0.2875, 3) // ~29% of the Earth is land
    expect(Math.abs(meshed - exact) / exact).toBeLessThan(1e-3)
  })
  test("land where land is, sea where sea is", () => {
    const all = geography().land
    const onLand = (lat: number, lon: number) => all.some((m) => covers(m, latLonToUnit(lat, lon)))
    expect(onLand(48.2, 16.37)).toBe(true) // Vienna
    expect(onLand(-1.3, 36.8)).toBe(true) // Nairobi
    expect(onLand(-80, 7)).toBe(true) // Antarctica, whose ring wraps the pole
    expect(onLand(-85, -170)).toBe(true) // …and across its antimeridian cut
    expect(onLand(30, -40)).toBe(false) // mid-Atlantic
    expect(onLand(43, 34)).toBe(false) // the Black Sea
    expect(onLand(0, -150)).toBe(false) // the Pacific
  })
  test("no coast stroke runs along the antimeridian cut or the pole", () => {
    for (const g of geography().coast) {
      for (let i = 1; i < g.points.length; i++) {
        const a = unitToLatLon(g.points[i - 1]!)
        const b = unitToLatLon(g.points[i]!)
        expect(a.lat <= -89.99 && b.lat <= -89.99).toBe(false)
        const onSeam = (p: { lon: number }) => Math.abs(Math.abs(p.lon) - 180) < 1e-6
        expect(onSeam(a) && onSeam(b) && Math.abs(a.lat - b.lat) > 1e-6).toBe(false)
      }
    }
  })
})

describe("Earth", () => {
  // Composed here, not by whichever test happens to run first.
  const earth = new Earth({ radius: 400 })
  void earth.parts
  test("one object: ground, occluder, land sheets, ~2,000 surface strokes", () => {
    void earth.parts
    expect(earth.ball).toBeInstanceOf(Surface)
    expect(earth.ball.solid.value).toBe(true)
    expect(earth.horizon.solid.value).toBe(true)
    expect(earth.landSheets.length).toBeGreaterThan(3)
    expect(earth.coastLines.length).toBeGreaterThan(1000)
    expect(earth.borderLines.length).toBe(393)
  })
  test("strokes lie on the sphere", () => {
    for (const line of earth.coastLines.slice(0, 100)) {
      for (const p of line.points) expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(400, 6)
    }
  })
  test("the horizon disc stands from the default eye, and follows the observer once told", () => {
    // Its own Earth: telling it an observer must not leak into the other tests.
    const earth = new Earth({ radius: 400 })
    void earth.parts
    void earth.horizon.geomVersion
    expect(earth.horizon.indices.length).toBeGreaterThan(0)
    // The default eye is a default Observer's: 1500 out on +z.
    expect(earth.horizon.positions[2]).toBeCloseTo((400 * 400) / 1500, 3)
    const observer = new Observer()
    observer.radius.value = 1500
    earth.seenFrom(observer)
    const before = earth.horizon.positions[0]
    observer.phi.value = 1
    void earth.horizon.geomVersion
    expect(earth.horizon.positions[0]).not.toBe(before)
  })
  test("latLonToLocal is the frame scaled to the radius (plus altitude)", () => {
    close(earth.latLonToLocal(0, 90, 10), { x: 410, y: 0, z: 0 })
  })
})

describe("Place", () => {
  test("its local axes land on east / up / south at (lat, lon)", () => {
    for (const [lat, lon] of [[48.1, 14.2], [-33.9, 151.2], [0, 0], [70, -100]] as const) {
      const { pos, hpb } = placeFrame(lat, lon, 400)
      const e = new Euler(hpb[1], hpb[0], hpb[2], "ZXY")
      const up = new Vector3(0, 1, 0).applyEuler(e)
      const east = new Vector3(1, 0, 0).applyEuler(e)
      close(up, latLonToUnit(lat, lon))
      close(pos, { x: up.x * 400, y: up.y * 400, z: up.z * 400 }, 6)
      // East is toward increasing longitude along the parallel.
      const step = latLonToUnit(lat, lon + 0.001)
      const here = latLonToUnit(lat, lon)
      const d = new Vector3(step.x - here.x, step.y - here.y, step.z - here.z).normalize()
      expect(east.dot(d)).toBeCloseTo(1, 5)
    }
  })
  test("a Place adopted by an Earth sits on its surface and turns with it", () => {
    const place = new Place({ lat: 48.1, lon: 14.2 })
    const earth = new Earth({ radius: 250, places: [place] })
    void earth.parts
    expect(place.parent).toBe(earth)
    expect(Math.hypot(place.x.value, place.y.value, place.z.value)).toBeCloseTo(250, 6)
    // Composite order: places are the Earth's LAST parts (drawn over the land).
    expect(earth.parts[earth.parts.length - 1]).toBe(place)
  })
  test("mock sites: one headquarters in Austria, ten production sites of two kinds", () => {
    const hq = MOCK_SITES.filter((s) => s.kind === "hq")
    expect(hq.length).toBe(1)
    expect(hq[0]!.lat).toBeGreaterThan(46.4)
    expect(hq[0]!.lat).toBeLessThan(49)
    expect(hq[0]!.lon).toBeGreaterThan(9.5)
    expect(hq[0]!.lon).toBeLessThan(17.2)
    expect(MOCK_SITES.filter((s) => s.kind !== "hq").length).toBe(10)
    const places = sitePlaces(MOCK_SITES, { sunk: true })
    expect(places[0]!.members[0]).toBeInstanceOf(Headquarters)
    expect(places[1]!.members[0]).toBeInstanceOf(Factory)
    for (const p of places) expect(p.altitude.value).toBeLessThan(0)
  })

  test("a Factory's worldCurves are its VISIBLE edges in world space, for its observer's view", () => {
    const observer = new Observer()
    observer.phi.value = 0.6
    observer.theta.value = 0.4
    const f = new Factory({ x: 50, size: 100, seenBy: () => observer })
    const curves = f.worldCurves()
    expect(curves.length).toBeGreaterThan(0)
    const near = nearCurves(curves)
    // Seen from above, front and right: the near foot of the hall is drawn
    // (shifted by x = 50 into world space); the far foot is behind the hall.
    expect(near({ x: 50, y: 0, z: 30 })).toBeLessThan(0.5)
    expect(near({ x: 50, y: 0, z: -30 })).toBeGreaterThan(5)
    // The same frame asks again: the same array (memoised).
    expect(f.worldCurves()).toBe(curves)
  })

  test("a building's ink is ONE Polylines per pen (a fleet of buildings is a few strokes, not thousands)", () => {
    const strokes = (h: Holon) => h.parts.filter((p) => p instanceof Line || p instanceof Polylines)
    const f = new Factory({ size: 100 })
    void f.parts
    expect(strokes(f).map((p) => p.constructor.name)).toEqual(["Polylines"])
    expect((strokes(f)[0] as Polylines).loops.length).toBe(2 + 9)
    const hq = new Headquarters({ size: 100, floors: 4 })
    void hq.parts
    // Both prisms' edges in one; the thinner floor rings in another.
    expect(strokes(hq).map((p) => p.constructor.name)).toEqual(["Polylines", "Polylines"])
    expect((strokes(hq)[1] as Polylines).loops.length).toBe(3)
  })

  test("a Headquarters' worldCurves: visible edges of both prisms and the floor lines on the faces it shows", () => {
    const observer = new Observer()
    observer.phi.value = 0.6
    observer.theta.value = 0.4
    const hq = new Headquarters({ size: 100, floors: 4, seenBy: () => observer })
    const near = nearCurves(hq.worldCurves())
    // Podium 100 × 22 × 70; tower 42 wide, 115 tall on top of it; floors every 28.75.
    expect(near({ x: 0, y: 0, z: 35 })).toBeLessThan(0.5) // the podium's near foot
    expect(near({ x: 0, y: 0, z: -35 })).toBeGreaterThan(5) // its far foot, behind it
    expect(near({ x: 0, y: 22 + 28.75, z: 21 })).toBeLessThan(0.5) // a floor line on the near face
    expect(near({ x: 0, y: 22 + 28.75, z: -21 })).toBeGreaterThan(5) // the same floor round the back
    expect(near({ x: 21, y: 22 + 57.5, z: 0 })).toBeLessThan(0.5) // the right face is turned to the eye too
  })
})

/** How far a point is from the nearest of some polylines — for testing what a curve set draws. */
const nearCurves = (curves: { x: number; y: number; z: number }[][]) => (q: { x: number; y: number; z: number }) =>
  Math.min(
    ...curves.flatMap((c) =>
      c.slice(1).map((b, i) => {
        const a = c[i]!
        const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
        const L2 = ab.x ** 2 + ab.y ** 2 + ab.z ** 2 || 1
        const t = Math.max(0, Math.min(1, ((q.x - a.x) * ab.x + (q.y - a.y) * ab.y + (q.z - a.z) * ab.z) / L2))
        return Math.hypot(a.x + ab.x * t - q.x, a.y + ab.y * t - q.y, a.z + ab.z * t - q.z)
      }),
    ),
  )

describe("EarthView", () => {
  const fov = (53.13 * Math.PI) / 180
  test("zoom 0 frames the whole disc at `fill` of the half-height", () => {
    const d = viewDistance(400, 0, 0.8, fov)
    // The disc's angular radius asin(R/d) is atan(0.8 · tan(fov/2)).
    expect(Math.asin(400 / d)).toBeCloseTo(Math.atan(0.8 * Math.tan(fov / 2)), 9)
  })
  test("each zoom step halves the altitude", () => {
    const a1 = viewDistance(400, 1, 0.8, fov) - 400
    const a2 = viewDistance(400, 2, 0.8, fov) - 400
    expect(a1 / a2).toBeCloseTo(2, 9)
  })
  test("zoomForSpan frames the span's edge at the frame's edge", () => {
    const zoom = zoomForSpan(400, 17, 0.8, fov)
    const d = viewDistance(400, zoom, 0.8, fov)
    // A ground point 17° away, seen from above the target, subtends fov/2.
    const s = 17 * DEG
    expect(Math.atan((400 * Math.sin(s)) / (d - 400 * Math.cos(s)))).toBeCloseTo(fov / 2, 6)
    expect(zoom).toBeGreaterThan(1)
  })
  test("the camera looks at the ground point, from above it at tilt 0, from the south when tilted", () => {
    const earth = new Earth({ radius: 400 })
    const view = new EarthView({ lat: 48, lon: 14, zoom: 2 })
    const pose = viewPose(earth, view, fov)
    const up = latLonToUnit(48, 14)
    close(pose.focus, { x: up.x * 400, y: up.y * 400, z: up.z * 400 }, 6)
    close(pose.dir, up, 9)
    view.tilt.value = 40
    const tilted = viewPose(earth, view, fov)
    expect(Math.acos(tilted.dir.dot(new Vector3(up.x, up.y, up.z))) / DEG).toBeCloseTo(40, 6)
    // Leaning south: the eye's latitude drops below the target's.
    const eye = tilted.focus.clone().add(tilted.dir.clone().multiplyScalar(tilted.distance))
    expect(unitToLatLon(eye).lat).toBeLessThan(48)
  })
})

describe("the optional layers", () => {
  test("a country's sheet has the country's real area (Austria 83,879 km², Egypt ~1.0M km²)", () => {
    const R_KM = 6371.0088
    const at = meshArea(countryMesh("AT")) * R_KM * R_KM
    expect(Math.abs(at - 83879) / 83879).toBeLessThan(0.03)
    const eg = meshArea(countryMesh("EG")) * R_KM * R_KM
    expect(Math.abs(eg - 1_001_450) / 1_001_450).toBeLessThan(0.03)
  })
  test("ISO codes are Natural Earth's own, with the -99 quirk resolved (France is FR)", () => {
    const isos = new Set(countries().map((c) => c.iso))
    for (const iso of ["FR", "NO", "AT", "EG", "DE", "JP", "BR"]) expect(isos.has(iso)).toBe(true)
    expect(isos.has("-99")).toBe(false)
    expect(() => countryMesh("XX")).toThrow()
  })
  test("the graticule: major lines every step, a finer ranked set between, all on the sphere", () => {
    const lines = graticuleLines(15)
    const major = lines.filter((l) => l.rank === 0)
    expect(major.length).toBe(24 + 11) // 24 meridians, 11 parallels (no poles)
    expect(lines.length).toBe(72 + 35)
    for (const l of lines) for (const p of l.points) expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 9)
    // A parallel stays at its latitude.
    const p30 = lines.find((l) => Math.abs(unitToLatLon(l.points[0]!).lat - 30) < 1e-9)!
    for (const p of p30.points) expect(unitToLatLon(p).lat).toBeCloseTo(30, 9)
  })
  test("lakes and rivers decode, ranked, and lakes fill where lakes are", () => {
    const lakes = lakeGeometry()
    expect(lakes.shores.length).toBe(465)
    expect(riverGeometry().length).toBe(894)
    const meshes = [...lakes.sheets.values()]
    const onLake = (lat: number, lon: number) => meshes.some((m) => covers(m, latLonToUnit(lat, lon)))
    expect(onLake(-1, 33)).toBe(true) // Lake Victoria
    expect(onLake(47.6, 9.3)).toBe(true) // Lake Constance
    expect(onLake(48.2, 16.37)).toBe(false) // Vienna
  })
  test("an Earth builds only what it is asked for, and lights up only listed countries", () => {
    const plain = new Earth()
    void plain.parts
    expect(plain.countryLabels.length + plain.cityLabels.length).toBe(0)
    expect(() => plain.country("AT")).toThrow()
    expect(plain.graticuleOpacity.value).toBe(0)
    expect(plain.lakeOpacity.value).toBe(0)
    expect(plain.riverOpacity.value).toBe(0)
    const rich = new Earth({ highlight: ["AT"], labels: { countries: 3, cities: 3 } })
    void rich.parts
    expect(rich.country("AT").fillOpacity.value).toBe(0)
    expect(rich.countryLabels.length).toBeGreaterThan(50)
    expect(rich.cityLabels.length).toBeGreaterThan(20)
    expect(cities().filter((c) => c.capital).length).toBe(200)
  })
})

describe("Focus and FlyTo", () => {
  const earth = new Earth()
  const observer = new Observer()
  const view = new EarthView()
  test("Focus moves lat, lon, zoom and tilt together over the clip", () => {
    const a = Focus(view, { lat: 48, lon: 16, zoom: 3, tilt: 30 })
    expect(a.tracks.map((t) => t.param)).toEqual([view.lat, view.lon, view.zoom, view.tilt])
    for (const t of a.tracks) expect([t.relStart, t.relStop]).toEqual([0, 1])
  })
  test("a span is solved to the zoom that frames it", () => {
    const a = Focus(view, { lat: 48, lon: 16, span: 10 }, { earth, observer })
    const zoom = a.tracks.find((t) => t.param === view.zoom)!.values[0] as number
    expect(zoom).toBeCloseTo(zoomForSpan(400, 10, view.fill.value, observer.fov.value), 9)
  })
  test("FlyTo rises in the first half and descends onto the target in the second", () => {
    const a = FlyTo(view, { lat: 27, lon: 31, zoom: 3, tilt: 30, pullBack: 2 })
    const zooms = a.tracks.filter((t) => t.param === view.zoom)
    expect(zooms.map((t) => [t.relStart, t.relStop, t.values[0]])).toEqual([[0, 0.5, 1], [0.5, 1, 3]])
    const tilts = a.tracks.filter((t) => t.param === view.tilt)
    expect(tilts.map((t) => t.values[0])).toEqual([0, 30])
  })
})

describe("light on the land", () => {
  test("every land sheet is lit from (lightLat, lightLon), off by default", () => {
    const earth = new Earth({ radius: 300 })
    void earth.parts
    for (const s of earth.landSheets) expect(s.fillFalloff.value).toBe(0)
    earth.lightLat.value = 48.2
    earth.lightLon.value = 16.4
    earth.lightFalloff.value = 0.8
    earth.lightReach.value = 120
    const c = earth.latLonToLocal(48.2, 16.4)
    for (const s of earth.landSheets) {
      expect(s.fillFalloff.value).toBe(0.8)
      expect(s.fillFalloffRadius.value).toBe(120)
      close({ x: s.fillFalloffX.value, y: s.fillFalloffY.value, z: s.fillFalloffZ.value }, c, 9)
    }
  })
})

describe("day, night and air", () => {
  test("a sphere band has its closed-form area (a cap of angle a: 2π(1 − cos a))", () => {
    const c = latLonToUnit(10, 20)
    const cap = sphereBand(c, 0, Math.PI / 3)
    expect(Math.abs(meshArea(cap) - 2 * Math.PI * (1 - Math.cos(Math.PI / 3))) / Math.PI).toBeLessThan(2e-3)
    const ring = sphereBand(c, Math.PI / 3, Math.PI / 2)
    const want = 2 * Math.PI * (Math.cos(Math.PI / 3) - Math.cos(Math.PI / 2))
    expect(Math.abs(meshArea(ring) - want) / want).toBeLessThan(2e-3)
  })
  test("the night lies opposite the sun; the terminator is the great circle between", () => {
    const earth = new Earth({ radius: 200 })
    void earth.parts
    expect(earth.nightOpacity.value).toBe(0)
    expect(earth.terminatorOpacity.value).toBe(0)
    expect(earth.atmosphereOpacity.value).toBe(0)
    earth.sunLat.value = 23
    earth.sunLon.value = -40
    const sun = latLonToUnit(23, -40)
    // The full-strength night cap: every vertex more than 90° − twilight/2 from the sun's antipode… i.e. on the night side.
    const core = earth.nightSheets[0]!
    void core.geomVersion
    const P = core.positions
    for (let i = 0; i < P.length; i += 3) {
      const d = (P[i]! * sun.x + P[i + 1]! * sun.y + P[i + 2]! * sun.z) / 200
      expect(d).toBeLessThan(Math.sin((earth.twilight / 2) * DEG) + 1e-6)
    }
    for (const p of earth.terminator.points) {
      expect(Math.abs(p.x * sun.x + p.y * sun.y + p.z * sun.z)).toBeLessThan(1e-6)
    }
  })
  test("the atmosphere rings stand outside the limb, each a larger sphere's silhouette", () => {
    const earth = new Earth({ radius: 200, atmosphereOpacity: 1 })
    void earth.parts
    const radii = earth.atmosphereRings.map((l) => Math.hypot(l.points[0]!.x, l.points[0]!.y, l.points[0]!.z))
    for (let k = 1; k < radii.length; k++) expect(radii[k]!).toBeGreaterThan(radii[k - 1]!)
    expect(radii[0]!).toBeGreaterThan(200)
    expect(radii[radii.length - 1]!).toBeCloseTo(200 * 1.03, 6)
  })
})

describe("label declutter", () => {
  test("is deterministic, and a weaker name yields to a stronger one it overprints", () => {
    const build = () => {
      const earth = new Earth({ labels: { countries: 6, cities: 5 } })
      const observer = new Observer()
      const view = new EarthView({ lat: 48, lon: 12, zoom: 2, tilt: 30 })
      followEarth(observer, earth, view, { detail: 2 })
      void earth.parts
      return earth
    }
    const a = build()
    const b = build()
    const op = (e: Earth) => [...e.countryLabels, ...e.cityLabels].map((l) => (l.parts[0] as unknown as { opacity: { value: number } }).opacity.value)
    const oa = op(a)
    expect(oa).toEqual(op(b))
    const shown = oa.filter((o) => o > 0.5).length
    const partly = oa.filter((o) => o > 0.02 && o < 0.98).length
    expect(shown).toBeGreaterThan(15)
    // Without decluttering, every in-range name on the near face would be at full presence;
    // with it, some yield (fully or in part).
    expect(oa.filter((o) => o === 0).length + partly).toBeGreaterThan(0)
  })
})

describe("1:10m detail packs", () => {
  const region = regionOf([ALPS_10M])
  test("a pack replaces whole grid cells inside its box, and nothing outside it", () => {
    const vienna = latLonToUnit(48.2, 16.37)
    const paris = latLonToUnit(48.85, 2.35)
    expect(region.contains(vienna)).toBe(true)
    expect(region.contains(paris)).toBe(false)
    expect(regionOf().contains(vienna)).toBe(false)
  })
  test("the 1:50m and 1:10m land meet without gap or overlap (world land area unchanged to 0.05%)", () => {
    const plain = geography().land.reduce((a, m) => a + meshArea(m), 0)
    const packed = geography(region).land.reduce((a, m) => a + meshArea(m), 0)
    expect(Math.abs(packed - plain) / plain).toBeLessThan(5e-4)
  })
  test("inside the pack the strokes are 1:10m — denser — and outside they are untouched", () => {
    const pts = (g: ReturnType<typeof geography>, inside: boolean) =>
      [...g.coast, ...g.borders].reduce(
        (n, l) => n + l.points.filter((p) => region.contains(p) === inside).length,
        0,
      )
    expect(pts(geography(region), true)).toBeGreaterThan(2 * pts(geography(), true))
    // Outside, only the cut ends at the region's edge differ.
    expect(Math.abs(pts(geography(region), false) - pts(geography(), false))).toBeLessThan(200)
  })
  test("a country lit across the seam keeps its true area (Austria, 1:10m inside)", () => {
    const R_KM = 6371.0088
    const at = meshArea(countryMesh("AT", region)) * R_KM * R_KM
    expect(Math.abs(at - 83879) / 83879).toBeLessThan(0.02)
  })
})

describe("the Earth under a parent", () => {
  test("keepOut: the viewer's shell, 2% above the ground, in world space through every parent", () => {
    const earth = new Earth({ radius: 100 })
    const parent = new Group({ members: [earth], x: 30, y: -20, scale: 2 })
    void parent.parts
    const [k] = earth.keepOut()
    close(k!.center, { x: 30, y: -20, z: 0 }, 9)
    expect(k!.radius).toBeCloseTo(100 * 2 * 1.02, 9)
  })
  test("the screen-size shoreline LOD notices a parent that scales the Earth", () => {
    const earth = new Earth({ radius: 400 })
    const parent = new Group({ members: [earth] })
    const observer = new Observer()
    observer.radius.value = 1500
    earth.seenFrom(observer)
    void parent.parts
    void earth.parts
    // Every shoreline's outline, as the gauge rates it.
    const tiny = earth.coastLines
    earth.detail.value = 10
    parent.scale.value = 0.5
    const before = tiny.map((l) => l.opacity.value)
    parent.scale.value = 2 // four times bigger on screen: more outlines earn their pen
    const after = tiny.map((l) => l.opacity.value)
    expect(after.reduce((a, b) => a + b, 0)).toBeGreaterThan(before.reduce((a, b) => a + b, 0))
  })
})

describe("the Earth as a visual automaton", () => {
  test("its axes, each a key, each naming only unbound params", () => {
    const earth = new Earth()
    const ids = earth.stateSpace().axes.map((a) => [a.id, a.key])
    expect(ids).toEqual([
      ["time", "n"], ["land", "d"], ["borders", "b"],
      ["water", "w"], ["graticule", "g"], ["atmosphere", "a"],
    ])
    const labelled = new Earth({ labels: { countries: 2 } })
    expect(labelled.stateSpace().axes.map((a) => a.id)).toContain("labels")
  })
  test("a position is the song's own spelling: axis.to(…) is a plain timeline move", () => {
    const earth = new Earth()
    const night = earth.stateSpace().axes.find((a) => a.id === "time")!.to("night")
    expect(night.tracks.map((t) => [t.param, t.values[0]])).toEqual([
      [earth.sunLat, 12],
      [earth.sunLon, -165],
      [earth.nightOpacity, 0.92],
      [earth.terminatorOpacity, 0.9],
    ])
  })
})

describe("label boxes are measured", () => {
  test("widths come from the face's own advances, not character counts", () => {
    expect(textWidth("MMM")).toBeGreaterThan(2.2 * textWidth("iii"))
    // Arimo: "M" advances 1706/2048 em.
    expect(textWidth("M")).toBeCloseTo(1706 / 2048, 6)
    // Tracking adds per gap between glyphs.
    expect(textWidth("AB", 0.14) - textWidth("AB")).toBeCloseTo(0.14, 9)
  })
})

describe("a scene owns what it drives", () => {
  test("an axis is offered only while its params are free (a followed land drops the land axis, nothing throws)", () => {
    const earth = new Earth()
    earth.land.follow(derive(() => WHITE))
    earth.borderOpacity.follow(derive(() => 1))
    const ids = earth.stateSpace().axes.map((a) => a.id)
    expect(ids).not.toContain("land")
    expect(ids).not.toContain("borders")
    expect(ids).toContain("time")
  })
})

describe("data layers", () => {
  test("sampleSeries interpolates between periods and crossfades into a gap", () => {
    expect(sampleSeries([10, 20, 30], 1.5)).toEqual({ value: 25, sure: 1 })
    expect(sampleSeries([10, null, 30], 0.25)).toEqual({ value: 10, sure: 0.75 })
    expect(sampleSeries([10, null, 30], 1.5)).toEqual({ value: 30, sure: 0.5 })
    expect(sampleSeries([null, null], 0.5).sure).toBe(0)
    expect(tableDomain({ A: [3, null, 9], B: [1] })).toEqual([1, 9])
  })
  test("a choropleth gives each known country a sheet on the sphere, tinted by its value, ghosted where data is missing", () => {
    const map = new Choropleth({ data: { AT: [0, 10], DE: [10, null], XX: [5] } })
    const earth = new Earth({ radius: 300, layers: [map] })
    void earth.parts
    void map.parts
    expect([...map.sheets.keys()]).toEqual(["AT", "DE"])
    expect(map.unknown).toEqual(["XX"])
    const at = map.sheets.get("AT")!
    const de = map.sheets.get("DE")!
    const same = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) =>
      expect(Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b)).toBeLessThan(1e-9)
    map.period.value = 0
    same(at.tint.value, map.low.value)
    same(de.tint.value, map.high.value)
    map.period.value = 1
    same(at.tint.value, map.high.value)
    expect(de.fillOpacity.value).toBeCloseTo(GHOST_FLOOR, 9) // DE has no value in period 1
    // Composited under the strokes: the layer sits before the stroke group.
    const parts = earth.parts
    expect(parts.indexOf(map)).toBeLessThan(parts.findIndex((p) => p === earth.coastLines[0]!.parent))
  })
  test("point data: one Place per row; a column's height is the value's share of the maximum", () => {
    const pts = new PointData({ rows: [{ lat: 48, lon: 16, values: [10, 20] }, { lat: 50, lon: 8, values: 5 }], size: 40 })
    const earth = new Earth({ radius: 300, places: [pts] })
    void earth.parts
    expect(pts.spots.length).toBe(2)
    for (const s of pts.spots) expect(Math.hypot(s.x.value, s.y.value, s.z.value)).toBeCloseTo(300, 6)
    const tallest = () => {
      const col = pts.spots[0]!.members[0]!
      return Math.max(...[...col.walk()].flatMap((h) => ((h as { points?: { y: number }[] }).points ?? []).map((p) => p.y)))
    }
    pts.period.value = 0
    expect(tallest()).toBeCloseTo(20, 6) // 10 of a max of 20 → half of 40
    pts.period.value = 1
    expect(tallest()).toBeCloseTo(40, 6)
  })
  test("a flow: particles run its arc by FlowMap's stream maths, a pure function of time, denser with volume", () => {
    const a = new Place({ lat: 48, lon: 16 })
    const b = new Place({ lat: 50, lon: 8 })
    const flow = new Connection({ ends: [a, b], particles: 10 })
    const earth = new Earth({ radius: 300, places: [a, b, flow] })
    void earth.parts
    const live = () => flow.flow.filter((d) => d.points.length > 0 && d.opacity.value > 0.01).length
    flow.time.value = 3
    const first = flow.flow.map((d) => d.points[5])
    flow.time.value = 3
    expect(flow.flow.map((d) => d.points[5])).toEqual(first)
    flow.volume.value = 1
    const full = live()
    flow.volume.value = 0.3
    expect(live()).toBeLessThan(full)
    expect(flow.stateSpace()!.clocks).toEqual([flow.time])
  })
})
