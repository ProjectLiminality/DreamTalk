/**
 * Meshes — closed triangle meshes for the shapes a line drawing is made of,
 * as plain data for hidden-line drawing (geometry/hiddenline.ts, `mesh`
 * solids): sphere, cone (and frustum), torus, lathe, extrusion.
 *
 * Conventions: triangles wind COUNTER-CLOCKWISE seen from outside (their
 * normal points out); every generator returns a closed manifold unless
 * stated; the axis of revolution / extrusion is local +Y. Deterministic:
 * the same arguments give the same arrays, index for index.
 */

import type { Vec3Like } from "../parts/primitives"

export interface Mesh {
  positions: Vec3Like[]
  triangles: [number, number, number][]
}

/**
 * A surface of revolution about +Y: `profile` is a list of (radius, y)
 * from bottom to top; a radius of 0 is a pole (one vertex). Ends whose
 * radius is not 0 are closed with flat caps when `caps` (default true).
 */
export const latheMesh = (profile: readonly [number, number][], segments = 48, caps = true): Mesh => {
  const positions: Vec3Like[] = []
  const triangles: [number, number, number][] = []
  const rings: number[][] = []
  for (const [r, y] of profile) {
    if (r <= 1e-9) {
      positions.push({ x: 0, y, z: 0 })
      rings.push([positions.length - 1])
      continue
    }
    const ring: number[] = []
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * 2 * Math.PI
      positions.push({ x: r * Math.cos(a), y, z: -r * Math.sin(a) })
      ring.push(positions.length - 1)
    }
    rings.push(ring)
  }
  // Ring j at angle a has outward normal (cos a, 0, -sin a); going round
  // with a increasing, then up the profile, a quad (lo j, lo j+1, hi j+1,
  // hi j) is counter-clockwise from outside.
  for (let i = 0; i + 1 < rings.length; i++) {
    const lo = rings[i]!
    const hi = rings[i + 1]!
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments
      if (lo.length === 1 && hi.length === 1) continue
      if (lo.length === 1) triangles.push([lo[0]!, hi[j1]!, hi[j]!])
      else if (hi.length === 1) triangles.push([lo[j]!, lo[j1]!, hi[0]!])
      else {
        triangles.push([lo[j]!, lo[j1]!, hi[j1]!])
        triangles.push([lo[j]!, hi[j1]!, hi[j]!])
      }
    }
  }
  if (caps) {
    const cap = (ring: number[], y: number, up: boolean) => {
      if (ring.length === 1) return
      positions.push({ x: 0, y, z: 0 })
      const c = positions.length - 1
      for (let j = 0; j < segments; j++) {
        const j1 = (j + 1) % segments
        triangles.push(up ? [c, ring[j]!, ring[j1]!] : [c, ring[j1]!, ring[j]!])
      }
    }
    cap(rings[0]!, profile[0]![1], false)
    cap(rings[rings.length - 1]!, profile[profile.length - 1]![1], true)
  }
  return { positions, triangles }
}

/** A sphere of radius r about the origin. */
export const sphereMesh = (r: number, segments = 48, rings = 24): Mesh => {
  const profile: [number, number][] = []
  for (let i = 0; i <= rings; i++) {
    const t = -Math.PI / 2 + (i / rings) * Math.PI
    profile.push([r * Math.cos(t), r * Math.sin(t)])
  }
  profile[0]![0] = 0
  profile[rings]![0] = 0
  return latheMesh(profile, segments)
}

/** A cone (r1 = 0) or frustum along +Y from y = −h/2 (radius r0) to +h/2 (radius r1). */
export const coneMesh = (r0: number, r1: number, h: number, segments = 48): Mesh =>
  latheMesh(
    [
      [r0, -h / 2],
      [r1, h / 2],
    ],
    segments,
  )

/** A torus about +Y: ring radius R, tube radius r. */
export const torusMesh = (R: number, r: number, segments = 64, tube = 24): Mesh => {
  const positions: Vec3Like[] = []
  const triangles: [number, number, number][] = []
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * 2 * Math.PI
    for (let j = 0; j < tube; j++) {
      const b = (j / tube) * 2 * Math.PI
      const rr = R + r * Math.cos(b)
      positions.push({ x: rr * Math.cos(a), y: r * Math.sin(b), z: -rr * Math.sin(a) })
    }
  }
  const at = (i: number, j: number) => (i % segments) * tube + (j % tube)
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < tube; j++) {
      const a = at(i, j)
      const b = at(i + 1, j)
      const c = at(i + 1, j + 1)
      const d = at(i, j + 1)
      triangles.push([a, b, c], [a, c, d])
    }
  return { positions, triangles }
}

/**
 * A prism: the polygon (x, z pairs, counter-clockwise seen from +Y)
 * extruded from y = −h/2 to +h/2, capped. Concave polygons are capped by
 * ear clipping.
 */
export const extrudeMesh = (polygon: readonly [number, number][], h: number): Mesh => {
  const n = polygon.length
  const positions: Vec3Like[] = []
  for (const [x, z] of polygon) positions.push({ x, y: -h / 2, z })
  for (const [x, z] of polygon) positions.push({ x, y: h / 2, z })
  const triangles: [number, number, number][] = []
  // Sides: polygon CCW seen from +Y (in x, −z… see below) — orient by area.
  let area = 0
  for (let i = 0; i < n; i++) {
    const [x0, z0] = polygon[i]!
    const [x1, z1] = polygon[(i + 1) % n]!
    area += x0 * z1 - x1 * z0
  }
  // Seen from +Y looking down, x right and z DOWN the page: a positive
  // x·z area runs clockwise there. Normalise so the walk below is CCW.
  const order = area > 0 ? [...Array(n).keys()].reverse() : [...Array(n).keys()]
  for (let k = 0; k < n; k++) {
    const i = order[k]!
    const j = order[(k + 1) % n]!
    triangles.push([i, j, j + n], [i, j + n, i + n])
  }
  // Caps by ear clipping, in the CCW (seen from +Y) order.
  const ears = (ids: number[]): [number, number, number][] => {
    const out: [number, number, number][] = []
    const v = [...ids]
    const P = (k: number) => polygon[k % n]!
    const cross = (a: number, b: number, c: number) => {
      const [ax, az] = P(a)
      const [bx, bz] = P(b)
      const [cx, cz] = P(c)
      // In (x, −z) — the plane seen from +Y with up = −z.
      return (bx - ax) * (-(cz) + az) - (-(bz) + az) * (cx - ax)
    }
    const inside = (p: number, a: number, b: number, c: number) =>
      cross(a, b, p) > 0 && cross(b, c, p) > 0 && cross(c, a, p) > 0
    let guard = 0
    while (v.length > 3 && guard++ < 10000) {
      let cut = false
      for (let k = 0; k < v.length; k++) {
        const a = v[(k + v.length - 1) % v.length]!
        const b = v[k]!
        const c = v[(k + 1) % v.length]!
        if (cross(a, b, c) <= 0) continue
        if (v.some((p) => p !== a && p !== b && p !== c && inside(p, a, b, c))) continue
        out.push([a, b, c])
        v.splice(k, 1)
        cut = true
        break
      }
      if (!cut) break
    }
    if (v.length === 3) out.push([v[0]!, v[1]!, v[2]!])
    return out
  }
  for (const [a, b, c] of ears(order)) {
    triangles.push([a + n, b + n, c + n]) // top, facing +Y
    triangles.push([a, c, b]) // bottom, facing −Y
  }
  return { positions, triangles }
}
