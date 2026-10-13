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
  triangulateSphere,
  unitToLatLon,
  type SphereMesh,
  type Vec3,
} from "../src/geometry/sphere"
import { decodeRings, encodeRings, QUANTUM } from "../vocabulary/Earth/codec"
import { BORDERS_50M, LAND_50M } from "../vocabulary/Earth/naturalEarth"
import { Earth, geography, placeFrame, Place } from "../vocabulary/Earth/Earth"
import { EarthView, viewDistance, viewPose, zoomForSpan } from "../vocabulary/Earth/EarthView"
import { sitePlaces } from "../vocabulary/Earth/Sites"
import { Factory } from "../vocabulary/Earth/Factory"
import { Headquarters } from "../vocabulary/Earth/Headquarters"
import { MOCK_SITES } from "../vocabulary/Earth/mockSites"
import { Surface } from "../src/parts/surface"
import { Observer } from "../src/dream"

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
  const earth = new Earth({ radius: 400 })
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
})

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
