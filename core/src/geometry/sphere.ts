/**
 * sphere.ts — geography on a true 3D sphere: lat/lon to points, curves
 * that hug the surface, and polygons triangulated ON the sphere.
 *
 * The sphere itself, not a picture of one (the flat Web3 Globe that
 * projected lon/lat to a disc was retired into the Earth, 2026-10-13):
 * every point it returns is a 3D point in the Earth's own frame, the camera
 * is whatever the scene's observer is, and what is hidden is decided by
 * depth against the solid ball (vocabulary/Earth), not by a projection trick.
 *
 * THE FRAME
 *
 *     x = cos φ · sin λ      y = sin φ      z = cos φ · cos λ
 *
 * on the unit sphere — north pole +y, the prime meridian on the equator at
 * +z (facing the default camera, which sits on +z), east toward +x so a map
 * reads the right way round from outside. It is also the observer's own
 * spherical convention (three-host syncCamera: offset = (sin φ cos θ,
 * sin θ, cos φ cos θ)), which is why a camera looks straight down at
 * (lat, lon) with theta = lat and phi = lon.
 *
 * CURVES THAT HUG THE SPHERE
 *
 * A stroke between two surface points is a straight CHORD through the
 * ball; long chords dive under the surface and vanish behind it. So every
 * curve is densified first. In LON/LAT, not along great circles: Natural
 * Earth's segments are straight in lon/lat (the 49th-parallel border is a
 * line of latitude, not a great circle — read as great circles it would
 * bow ~2.6 degrees north across the prairies). `densifyLonLat` cuts every
 * step down to `maxStep` degrees; a chord that short sags R·(1 − cos ½θ),
 * 1e-5·R at half a degree — far below a pixel at any zoom the data holds.
 *
 * POLYGONS TRIANGULATED ON THE SPHERE
 *
 * A filled continent cannot be triangulated in lon/lat and wrapped: the
 * triangles would be huge (Eurasia in one fan) and their flat interiors
 * would sink hundreds of kilometres under the surface. `triangulateSphere`
 * instead works the way a cube-map does:
 *
 *   1. Each ring is clipped to the six faces of the cube around the sphere
 *      — in 3D, against planes through the centre, which cut the sphere in
 *      great circles. Clipping is exact for any ring, including the ones
 *      that wrap a pole (Antarctica) or span half the world (Afro-Eurasia).
 *   2. On its face, a ring is carried into the face's GNOMONIC plane
 *      (central projection, u = p·e₁ / p·n). The gnomonic projection maps
 *      great circles to straight lines, so the face's polygon is the
 *      spherical one with no bending to approximate.
 *   3. The face is cut into an equi-angular G × G grid of cells and each
 *      piece of each ring is clipped to its cell, then ear-clipped. Every
 *      triangle therefore lives inside one cell, a degree or so across —
 *      which bounds how far its flat interior can sag below the sphere.
 *   4. Each vertex is projected back out onto the unit sphere.
 *
 * The grid lines are themselves great circles, and the same cell boundary
 * is computed the same way from both sides — including across cube edges,
 * where two faces' grids meet point for point (the grid is symmetric) — so
 * neighbouring cells share their boundary vertices and the surface has no
 * T-junction cracks. Sag is bounded by the cell: at G = 64 a cell spans at
 * most ~1.4 degrees, and a triangle's interior sits at most ~1.5e-4·R below
 * the sphere — inside the depth margin the Earth gives its ball.
 */

import { ShapeUtils, Vector2 } from "three/webgpu"

/** A point in 3D — data, not a param. */
export interface Vec3 {
  x: number
  y: number
  z: number
}

const DEG = Math.PI / 180

/** Unit-sphere point for a latitude/longitude in DEGREES (the frame above). */
export const latLonToUnit = (lat: number, lon: number): Vec3 => {
  const phi = lat * DEG
  const lam = lon * DEG
  const c = Math.cos(phi)
  return { x: c * Math.sin(lam), y: Math.sin(phi), z: c * Math.cos(lam) }
}

/** Latitude/longitude in DEGREES of a (not necessarily unit) direction. */
export const unitToLatLon = (p: Vec3): { lat: number; lon: number } => {
  const r = Math.hypot(p.x, p.y, p.z) || 1
  return {
    lat: Math.asin(Math.max(-1, Math.min(1, p.y / r))) / DEG,
    lon: Math.atan2(p.x, p.z) / DEG,
  }
}

/** The angle between two directions, radians. */
export const angleBetween = (a: Vec3, b: Vec3): number => {
  // atan2 of |a×b| and a·b — accurate at both tiny and near-π angles,
  // where acos(a·b) loses half its digits.
  const cx = a.y * b.z - a.z * b.y
  const cy = a.z * b.x - a.x * b.z
  const cz = a.x * b.y - a.y * b.x
  return Math.atan2(Math.hypot(cx, cy, cz), a.x * b.x + a.y * b.y + a.z * b.z)
}

/**
 * Densify a lon/lat polyline (flat [lon, lat, …] DEGREES) so no step
 * exceeds `maxStep` degrees, interpolating linearly in lon/lat — the way
 * the data was drawn (see the header). Returns a new flat array; the input
 * points are all kept.
 */
export const densifyLonLat = (coords: ArrayLike<number>, maxStep: number): number[] => {
  const out: number[] = []
  const n = coords.length / 2
  for (let i = 0; i < n; i++) {
    const lon = coords[2 * i]!
    const lat = coords[2 * i + 1]!
    if (i > 0) {
      const plon = coords[2 * i - 2]!
      const plat = coords[2 * i - 1]!
      // The step's length on the sphere, near enough: the lon run shrinks
      // with latitude.
      const dl = (lon - plon) * Math.cos(((lat + plat) / 2) * DEG)
      const steps = Math.ceil(Math.hypot(dl, lat - plat) / maxStep)
      for (let s = 1; s < steps; s++) {
        const u = s / steps
        out.push(plon + (lon - plon) * u, plat + (lat - plat) * u)
      }
    }
    out.push(lon, lat)
  }
  return out
}

/** Flat lon/lat DEGREES → unit-sphere points. */
export const lonLatToUnits = (coords: ArrayLike<number>): Vec3[] => {
  const pts: Vec3[] = []
  for (let i = 0; i + 1 < coords.length; i += 2) pts.push(latLonToUnit(coords[i + 1]!, coords[i]!))
  return pts
}

// --- Triangulation on the sphere -------------------------------------------

/** One polygon: an outer ring and its holes, as unit-sphere points (open or closed). */
export interface SpherePolygon {
  outer: readonly Vec3[]
  holes: readonly (readonly Vec3[])[]
}

/** A triangle mesh on the unit sphere. */
export interface SphereMesh {
  /** Flat xyz, unit length. */
  positions: Float32Array
  indices: Uint32Array
}

/** A cube face: its outward normal and the two in-plane axes of its gnomonic chart. */
interface Face {
  n: Vec3
  e1: Vec3
  e2: Vec3
}

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z

const FACES: readonly Face[] = [
  { n: v(0, 0, 1), e1: v(1, 0, 0), e2: v(0, 1, 0) },
  { n: v(0, 0, -1), e1: v(-1, 0, 0), e2: v(0, 1, 0) },
  { n: v(1, 0, 0), e1: v(0, 0, -1), e2: v(0, 1, 0) },
  { n: v(-1, 0, 0), e1: v(0, 0, 1), e2: v(0, 1, 0) },
  { n: v(0, 1, 0), e1: v(1, 0, 0), e2: v(0, 0, -1) },
  { n: v(0, -1, 0), e1: v(1, 0, 0), e2: v(0, 0, 1) },
]

/**
 * Sutherland–Hodgman against one plane through the origin: keep the side
 * where m·p ≥ 0. The ring is cyclic (no repeated closing point).
 */
const clipPlane = (ring: Vec3[], m: Vec3): Vec3[] => {
  const n = ring.length
  if (n === 0) return ring
  const out: Vec3[] = []
  for (let i = 0; i < n; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % n]!
    const da = dot(m, a)
    const db = dot(m, b)
    if (da >= 0) out.push(a)
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db)
      out.push(v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t))
    }
  }
  return out
}

/** Sutherland–Hodgman in a gnomonic chart against u (axis 0) or v (axis 1) ≥ / ≤ k. */
const clipAxis = (ring: number[], axis: 0 | 1, k: number, keepAbove: boolean): number[] => {
  const n = ring.length / 2
  if (n === 0) return ring
  const out: number[] = []
  const side = (i: number): number => (keepAbove ? ring[2 * i + axis]! - k : k - ring[2 * i + axis]!)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const da = side(i)
    const db = side(j)
    if (da >= 0) out.push(ring[2 * i]!, ring[2 * i + 1]!)
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db)
      const u = ring[2 * i]! + (ring[2 * j]! - ring[2 * i]!) * t
      const w = ring[2 * i + 1]! + (ring[2 * j + 1]! - ring[2 * i + 1]!) * t
      // Snap the clipped coordinate to the line exactly, so both cells that
      // share this boundary place the vertex on it identically.
      out.push(axis === 0 ? k : u, axis === 1 ? k : w)
    }
  }
  return out
}

/** Signed area of a flat 2D ring. */
const area2 = (ring: number[]): number => {
  let a = 0
  const n = ring.length / 2
  for (let i = 0, j = n - 1; i < n; j = i++) {
    a += ring[2 * j]! * ring[2 * i + 1]! - ring[2 * i]! * ring[2 * j + 1]!
  }
  return a / 2
}

/** Drop a repeated closing point and consecutive duplicates from a 3D ring. */
const openRing = (ring: readonly Vec3[]): Vec3[] => {
  const out: Vec3[] = []
  for (const p of ring) {
    const q = out[out.length - 1]
    if (q && Math.abs(p.x - q.x) + Math.abs(p.y - q.y) + Math.abs(p.z - q.z) < 1e-12) continue
    out.push(p)
  }
  while (out.length > 1) {
    const a = out[0]!
    const b = out[out.length - 1]!
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) < 1e-12) out.pop()
    else break
  }
  return out
}

/** The equi-angular grid lines of a face: tan of evenly spaced angles in [−π/4, π/4]. */
const gridLines = (g: number): number[] => {
  const lines: number[] = []
  for (let i = 0; i <= g; i++) {
    // Exactly ±1 at the face edges (tan(π/4) is not exactly 1 in floats),
    // and exactly antisymmetric, so neighbouring faces' grids coincide.
    if (i === 0) lines.push(-1)
    else if (i === g) lines.push(1)
    else if (2 * i === g) lines.push(0)
    else if (2 * i < g) lines.push(-Math.tan(Math.PI / 4 - (i * Math.PI) / (2 * g)))
    else lines.push(Math.tan((i * Math.PI) / (2 * g) - Math.PI / 4))
  }
  return lines
}

/**
 * Triangulate polygons on the unit sphere (see the header). `cellsPerFace`
 * is G, the grid density per cube face: higher hugs the sphere more tightly
 * at the cost of more triangles. Holes are honoured.
 */
export const triangulateSphere = (
  polygons: readonly SpherePolygon[],
  cellsPerFace = 64,
): SphereMesh => {
  const lines = gridLines(cellsPerFace)
  const positions: number[] = []
  const indices: number[] = []
  const g = cellsPerFace

  // The cell a coordinate falls in (clamped to the face).
  const cellOf = (c: number): number => {
    let lo = 0
    let hi = g
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (lines[mid]! <= c) lo = mid
      else hi = mid
    }
    return lo
  }

  for (const face of FACES) {
    const planes = [
      v(face.n.x - face.e1.x, face.n.y - face.e1.y, face.n.z - face.e1.z),
      v(face.n.x + face.e1.x, face.n.y + face.e1.y, face.n.z + face.e1.z),
      v(face.n.x - face.e2.x, face.n.y - face.e2.y, face.n.z - face.e2.z),
      v(face.n.x + face.e2.x, face.n.y + face.e2.y, face.n.z + face.e2.z),
    ]
    const toChart = (ring: Vec3[]): number[] => {
      const out: number[] = []
      for (const p of ring) {
        const w = dot(p, face.n)
        out.push(
          Math.max(-1, Math.min(1, dot(p, face.e1) / w)),
          Math.max(-1, Math.min(1, dot(p, face.e2) / w)),
        )
      }
      return out
    }
    const fromChart = (u: number, w: number): void => {
      const x = face.n.x + face.e1.x * u + face.e2.x * w
      const y = face.n.y + face.e1.y * u + face.e2.y * w
      const z = face.n.z + face.e1.z * u + face.e2.z * w
      const r = Math.hypot(x, y, z)
      positions.push(x / r, y / r, z / r)
    }

    for (const poly of polygons) {
      // Clip every ring to this face, in 3D, and carry it into the chart.
      const onFace = (src: readonly Vec3[]): number[] | undefined => {
        let ring = openRing(src)
        // Quick reject: no point of the ring is on this face's side at all.
        if (!ring.some((p) => dot(p, face.n) > 0)) return undefined
        for (const m of planes) ring = clipPlane(ring, m)
        if (ring.length < 3) return undefined
        const chart = toChart(ring)
        return Math.abs(area2(chart)) < 1e-14 ? undefined : chart
      }
      const outer = onFace(poly.outer)
      if (!outer) continue
      const holes = poly.holes.map(onFace).filter((h): h is number[] => h !== undefined)

      // The cells the outer ring's chart bounding box covers.
      let u0 = Infinity
      let u1 = -Infinity
      let w0 = Infinity
      let w1 = -Infinity
      for (let i = 0; i < outer.length; i += 2) {
        u0 = Math.min(u0, outer[i]!)
        u1 = Math.max(u1, outer[i]!)
        w0 = Math.min(w0, outer[i + 1]!)
        w1 = Math.max(w1, outer[i + 1]!)
      }
      const ci0 = cellOf(u0)
      const ci1 = Math.min(g - 1, cellOf(u1))
      const cj0 = cellOf(w0)
      const cj1 = Math.min(g - 1, cellOf(w1))

      for (let ci = ci0; ci <= ci1; ci++) {
        // Column strip first, so each cell clips a ring already narrowed
        // to its column (O(G·n) instead of O(G²·n)).
        const strip = (r: number[]) =>
          clipAxis(clipAxis(r, 0, lines[ci]!, true), 0, lines[ci + 1]!, false)
        const sOuter = strip(outer)
        if (sOuter.length < 6) continue
        const sHoles = holes.map(strip)
        for (let cj = cj0; cj <= cj1; cj++) {
          const cell = (r: number[]) =>
            clipAxis(clipAxis(r, 1, lines[cj]!, true), 1, lines[cj + 1]!, false)
          const cOuter = cell(sOuter)
          if (cOuter.length < 6 || Math.abs(area2(cOuter)) < 1e-14) continue
          const cHoles = sHoles.map(cell).filter((h) => h.length >= 6 && Math.abs(area2(h)) > 1e-14)
          const asV2 = (r: number[]) => {
            const pts: Vector2[] = []
            for (let i = 0; i < r.length; i += 2) pts.push(new Vector2(r[i]!, r[i + 1]!))
            return pts
          }
          const contour = asV2(cOuter)
          const holeV2 = cHoles.map(asV2)
          const faces = ShapeUtils.triangulateShape(contour, holeV2)
          const base = positions.length / 3
          for (const p of contour) fromChart(p.x, p.y)
          for (const h of holeV2) for (const p of h) fromChart(p.x, p.y)
          for (const f of faces) indices.push(base + f[0]!, base + f[1]!, base + f[2]!)
        }
      }
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) }
}

/**
 * A whole sphere as a mesh — the solid ball the Earth's back face hides
 * behind. A UV sphere: `rings` latitude bands × `segments` longitude
 * slices, unit radius.
 */
export const sphereMesh = (segments = 192, rings = 96): SphereMesh => {
  const positions: number[] = []
  const indices: number[] = []
  for (let r = 0; r <= rings; r++) {
    const lat = 90 - (180 * r) / rings
    for (let s = 0; s <= segments; s++) {
      const p = latLonToUnit(lat, -180 + (360 * s) / segments)
      positions.push(p.x, p.y, p.z)
    }
  }
  const row = segments + 1
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = r * row + s
      const b = a + row
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) }
}

/** Total area of a mesh on the unit sphere (sum of flat triangle areas). */
export const meshArea = (mesh: SphereMesh): number => {
  const P = mesh.positions
  let total = 0
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i]! * 3
    const b = mesh.indices[i + 1]! * 3
    const c = mesh.indices[i + 2]! * 3
    const ux = P[b]! - P[a]!
    const uy = P[b + 1]! - P[a + 1]!
    const uz = P[b + 2]! - P[a + 2]!
    const wx = P[c]! - P[a]!
    const wy = P[c + 1]! - P[a + 1]!
    const wz = P[c + 2]! - P[a + 2]!
    total += Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 2
  }
  return total
}

/**
 * The horizon of a sphere (centre at the origin, radius `radius`) seen
 * from `eye`: the circle where sight lines graze the surface. Every point
 * of the sphere is visible exactly when it lies on the eye's side of the
 * circle's plane — p·ĉ > R²/d, ĉ the unit direction to the eye and d its
 * distance — which makes the plane, filled as a disc out to the circle,
 * an EXACT occluder for everything drawn on the surface (vocabulary/Earth).
 *
 * `orthographic` puts the eye at infinity along `eye`'s direction: the
 * plane passes through the centre and the circle is a great circle.
 * Undefined when the eye is on or inside the sphere (there is no horizon).
 */
export const horizonCircle = (
  eye: Vec3,
  radius: number,
  orthographic = false,
): { centre: Vec3; normal: Vec3; radius: number } | undefined => {
  const d = Math.hypot(eye.x, eye.y, eye.z)
  if (d < 1e-12) return undefined
  const normal = { x: eye.x / d, y: eye.y / d, z: eye.z / d }
  if (orthographic) return { centre: { x: 0, y: 0, z: 0 }, normal, radius }
  if (d <= radius) return undefined
  const k = (radius * radius) / d
  return {
    centre: { x: normal.x * k, y: normal.y * k, z: normal.z * k },
    normal,
    radius: radius * Math.sqrt(1 - (radius * radius) / (d * d)),
  }
}

/** Two unit vectors completing `n` to an orthonormal frame. */
export const tangentFrame = (n: Vec3): { u: Vec3; w: Vec3 } => {
  // Cross with whichever axis is least aligned with n.
  const a = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }
  let u = { x: a.y * n.z - a.z * n.y, y: a.z * n.x - a.x * n.z, z: a.x * n.y - a.y * n.x }
  const l = Math.hypot(u.x, u.y, u.z)
  u = { x: u.x / l, y: u.y / l, z: u.z / l }
  const w = { x: n.y * u.z - n.z * u.y, y: n.z * u.x - n.x * u.z, z: n.x * u.y - n.y * u.x }
  return { u, w }
}

/**
 * A band of the unit sphere around `centre`: every point whose angle from
 * it lies in [a0, a1] radians (a0 = 0 gives a cap). Triangulated in rings
 * no more than `step` apart and `segments` around, so it hugs the sphere
 * like the land does — the night side and its twilight bands (Earth).
 */
export const sphereBand = (centre: Vec3, a0: number, a1: number, segments = 128, step = (1.5 * Math.PI) / 180): SphereMesh => {
  const { u, w } = tangentFrame(centre)
  const rings = Math.max(1, Math.ceil((a1 - a0) / step))
  const positions: number[] = []
  const indices: number[] = []
  for (let r = 0; r <= rings; r++) {
    const a = a0 + ((a1 - a0) * r) / rings
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    for (let s = 0; s <= segments; s++) {
      const t = (s / segments) * Math.PI * 2
      const ct = Math.cos(t) * sa
      const st = Math.sin(t) * sa
      positions.push(
        centre.x * ca + u.x * ct + w.x * st,
        centre.y * ca + u.y * ct + w.y * st,
        centre.z * ca + u.z * ct + w.z * st,
      )
    }
  }
  const row = segments + 1
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const p = r * row + s
      indices.push(p, p + row, p + 1, p + 1, p + row, p + row + 1)
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) }
}
