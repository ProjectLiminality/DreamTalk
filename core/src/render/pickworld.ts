/**
 * pickworld.ts — the geometry of picking in 3D: nearest ink to a point,
 * first ink along a ray. Pure maths over plain numbers; the host
 * (three-host.ts pickNear / pickRay) supplies the visible ink.
 *
 * Boxes are [minX, minY, minZ, maxX, maxY, maxZ]. A local box under a world
 * matrix becomes the world box of its 8 transformed corners — it contains
 * every transformed point of the local box (an affine map keeps convex
 * hulls), so a cull against it never hides reachable ink.
 */

// Distances are Math.sqrt of a sum of squares, not Math.hypot: the same
// value to the last bits that matter here, several times faster in V8.

/** The world box of a local box (6 floats at `o`) under a column-major 4×4 `m`, written to `out` at `oo`. */
export const worldBox = (box: ArrayLike<number>, o: number, m: ArrayLike<number>, out: Float32Array | Float64Array, oo = 0): void => {
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  if (!(box[o]! <= box[o + 3]!)) {
    out.set([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], oo)
    return
  }
  for (let c = 0; c < 8; c++) {
    const x = c & 1 ? box[o + 3]! : box[o]!
    const y = c & 2 ? box[o + 4]! : box[o + 1]!
    const z = c & 4 ? box[o + 5]! : box[o + 2]!
    const wx = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!
    const wy = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!
    const wz = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!
    if (wx < minX) minX = wx
    if (wy < minY) minY = wy
    if (wz < minZ) minZ = wz
    if (wx > maxX) maxX = wx
    if (wy > maxY) maxY = wy
    if (wz > maxZ) maxZ = wz
  }
  out[oo] = minX
  out[oo + 1] = minY
  out[oo + 2] = minZ
  out[oo + 3] = maxX
  out[oo + 4] = maxY
  out[oo + 5] = maxZ
}

/** Distance from a point to a box (0 inside). */
export const boxDistance = (b: ArrayLike<number>, o: number, x: number, y: number, z: number): number => {
  const dx = Math.max(b[o]! - x, 0, x - b[o + 3]!)
  const dy = Math.max(b[o + 1]! - y, 0, y - b[o + 4]!)
  const dz = Math.max(b[o + 2]! - z, 0, z - b[o + 5]!)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * Where the segment origin + t·dir, t ∈ [0, tMax], first comes within `pad`
 * of the box: the entry t, or NaN if it never does. (Slab test on the box
 * grown by pad — conservative: a grown box contains every point within pad
 * of the box.)
 */
export const rayNearBox = (
  b: ArrayLike<number>,
  o: number,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  tMax: number,
  pad: number,
): number => {
  if (!(b[o]! <= b[o + 3]!)) return NaN
  let t0 = 0
  let t1 = tMax
  const origin = [ox, oy, oz]
  const dir = [dx, dy, dz]
  for (let k = 0; k < 3; k++) {
    const lo = b[o + k]! - pad
    const hi = b[o + 3 + k]! + pad
    const d = dir[k]!
    const q = origin[k]!
    if (Math.abs(d) < 1e-12) {
      if (q < lo || q > hi) return NaN
      continue
    }
    let a = (lo - q) / d
    let c = (hi - q) / d
    if (a > c) [a, c] = [c, a]
    if (a > t0) t0 = a
    if (c < t1) t1 = c
    if (t0 > t1) return NaN
  }
  return t0
}

/** The farthest any point of the box is from (x, y, z). */
export const boxFarthest = (b: ArrayLike<number>, o: number, x: number, y: number, z: number): number => {
  const dx = Math.max(Math.abs(b[o]! - x), Math.abs(b[o + 3]! - x))
  const dy = Math.max(Math.abs(b[o + 1]! - y), Math.abs(b[o + 4]! - y))
  const dz = Math.max(Math.abs(b[o + 2]! - z), Math.abs(b[o + 5]! - z))
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/** Nearest point of segment ab to p: [distance, u ∈ [0, 1]]. */
export const pointSegment = (
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): [number, number] => {
  const dx = bx - ax
  const dy = by - ay
  const dz = bz - az
  const lenSq = dx * dx + dy * dy + dz * dz
  const u = lenSq > 1e-18 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / lenSq)) : 0
  const ex = px - (ax + dx * u)
  const ey = py - (ay + dy * u)
  const ez = pz - (az + dz * u)
  return [Math.sqrt(ex * ex + ey * ey + ez * ez), u]
}

/**
 * Closest approach of the ray o + t·d (|d| = 1, t ∈ [0, tMax]) and the
 * segment ab: [distance, t on the ray, u on the segment].
 */
export const raySegment = (
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  tMax: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): [number, number, number] => {
  const ex = bx - ax
  const ey = by - ay
  const ez = bz - az
  const wx = ox - ax
  const wy = oy - ay
  const wz = oz - az
  const b = dx * ex + dy * ey + dz * ez
  const c = ex * ex + ey * ey + ez * ez
  const d = dx * wx + dy * wy + dz * wz
  const e = ex * wx + ey * wy + ez * wz
  const denom = c - b * b // a = 1
  let t: number
  let u: number
  if (c < 1e-18) {
    // a point
    t = Math.max(0, Math.min(tMax, -d))
    u = 0
  } else {
    t = denom > 1e-12 ? (b * e - c * d) / denom : 0
    t = Math.max(0, Math.min(tMax, t))
    u = Math.max(0, Math.min(1, (e + b * t) / c))
    // re-project t for the clamped u
    t = Math.max(0, Math.min(tMax, (ax + ex * u - ox) * dx + (ay + ey * u - oy) * dy + (az + ez * u - oz) * dz))
  }
  const qx = ox + dx * t - (ax + ex * u)
  const qy = oy + dy * t - (ay + ey * u)
  const qz = oz + dz * t - (az + ez * u)
  return [Math.sqrt(qx * qx + qy * qy + qz * qz), t, u]
}

/** Nearest point of triangle abc to p (Ericson, Real-Time Collision Detection 5.1.5): [distance, x, y, z]. */
export const pointTriangle = (
  p: readonly [number, number, number],
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
): [number, number, number, number] => {
  const sub = (u: readonly number[], v: readonly number[]) => [u[0]! - v[0]!, u[1]! - v[1]!, u[2]! - v[2]!]
  const dot = (u: number[], v: number[]) => u[0]! * v[0]! + u[1]! * v[1]! + u[2]! * v[2]!
  const done = (x: number, y: number, z: number): [number, number, number, number] => {
    const ex = p[0] - x
    const ey = p[1] - y
    const ez = p[2] - z
    return [Math.sqrt(ex * ex + ey * ey + ez * ez), x, y, z]
  }
  const ab = sub(b, a)
  const ac = sub(c, a)
  const ap = sub(p, a)
  const d1 = dot(ab, ap)
  const d2 = dot(ac, ap)
  if (d1 <= 0 && d2 <= 0) return done(a[0], a[1], a[2])
  const bp = sub(p, b)
  const d3 = dot(ab, bp)
  const d4 = dot(ac, bp)
  if (d3 >= 0 && d4 <= d3) return done(b[0], b[1], b[2])
  const vc = d1 * d4 - d3 * d2
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3)
    return done(a[0] + ab[0]! * v, a[1] + ab[1]! * v, a[2] + ab[2]! * v)
  }
  const cp = sub(p, c)
  const d5 = dot(ab, cp)
  const d6 = dot(ac, cp)
  if (d6 >= 0 && d5 <= d6) return done(c[0], c[1], c[2])
  const vb = d5 * d2 - d1 * d6
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6)
    return done(a[0] + ac[0]! * w, a[1] + ac[1]! * w, a[2] + ac[2]! * w)
  }
  const va = d3 * d6 - d5 * d4
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6))
    return done(b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w)
  }
  const denom = 1 / (va + vb + vc)
  const v = vb * denom
  const w = vc * denom
  return done(a[0] + ab[0]! * v + ac[0]! * w, a[1] + ab[1]! * v + ac[1]! * w, a[2] + ab[2]! * v + ac[2]! * w)
}

/** Ray o + t·d against triangle abc (Möller–Trumbore, two-sided): t, or undefined. */
export const rayTriangle = (
  o: readonly [number, number, number],
  d: readonly [number, number, number],
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
): number | undefined => {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const p = [d[1] * e2[2]! - d[2] * e2[1]!, d[2] * e2[0]! - d[0] * e2[2]!, d[0] * e2[1]! - d[1] * e2[0]!]
  const det = e1[0]! * p[0]! + e1[1]! * p[1]! + e1[2]! * p[2]!
  if (Math.abs(det) < 1e-12) return undefined
  const inv = 1 / det
  const s = [o[0] - a[0], o[1] - a[1], o[2] - a[2]]
  const u = (s[0]! * p[0]! + s[1]! * p[1]! + s[2]! * p[2]!) * inv
  if (u < 0 || u > 1) return undefined
  const q = [s[1]! * e1[2]! - s[2]! * e1[1]!, s[2]! * e1[0]! - s[0]! * e1[2]!, s[0]! * e1[1]! - s[1]! * e1[0]!]
  const v = (d[0] * q[0]! + d[1] * q[1]! + d[2] * q[2]!) * inv
  if (v < 0 || u + v > 1) return undefined
  const t = (e2[0]! * q[0]! + e2[1]! * q[1]! + e2[2]! * q[2]!) * inv
  return t >= 0 ? t : undefined
}
