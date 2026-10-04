/**
 * Angles of a polyline, and the marks that annotate them — pure math.
 *
 * The geometry half of the GeometrySketch ability (vocabulary/
 * GeometrySketch, ONTOLOGY.md 2026-09-16): find a shape's SHARP corners
 * and draw what a geometer draws on them — the little square in a right
 * angle, an arc across every other one. Works on any polyline, in 3D:
 * a square, a pentagon, a hand-drawn zigzag, a figure tilted out of the
 * screen.
 *
 * ## What counts as a corner
 *
 * A vertex where the pen TURNS by at least `minTurn` (20° by default).
 * A curve sampled for the screen turns by a few degrees per vertex (a
 * 128-gon circle, 2.8°; a rounded rectangle's 8-segment corner fan,
 * 11.25°), so curves and rounded corners carry no marks — they have no
 * sharp angle to show — while every regular polygon up to the 18-gon
 * (turn 20°) does.
 *
 * ## Which side is "the angle"
 *
 * The interior. For a closed outline that is decided by the outline's own
 * orientation: the plane normal by Newell's method, then a corner is
 * convex where the pen turns left about that normal (interior < 180°) and
 * reflex where it turns right (interior > 180° — the arc then sweeps the
 * long way round, inside the shape). An open polyline has no inside, so
 * each corner shows its smaller angle.
 */

export interface Vec3Like {
  x: number
  y: number
  z: number
}

/** One sharp corner of a polyline. */
export interface Corner {
  /** The vertex. */
  at: Vec3Like
  /** Unit direction from the vertex toward the previous point. */
  u: Vec3Like
  /** Unit direction from the vertex toward the next point. */
  v: Vec3Like
  /**
   * Unit direction perpendicular to `u` in the corner's plane, on the
   * interior side: sweeping `u` toward `w` by `interior` radians lands on
   * `v`.
   */
  w: Vec3Like
  /** The interior angle in radians, (0, 2π). */
  interior: number
  /** Within RIGHT_ANGLE_TOLERANCE of 90°. */
  right: boolean
  /** The shorter of the two edges meeting here — how much room a mark has. */
  reach: number
}

/** A turn smaller than this is a curve being sampled, not a corner. */
export const SHARP_TURN = (20 * Math.PI) / 180

/** How close to 90° a corner must be to take the right-angle square. */
export const RIGHT_ANGLE_TOLERANCE = (1 * Math.PI) / 180

/** A mark never takes more than this share of the shorter adjacent edge. */
export const MARK_ROOM = 0.35

const sub = (a: Vec3Like, b: Vec3Like): Vec3Like => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a: Vec3Like, b: Vec3Like): number => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec3Like, b: Vec3Like): Vec3Like => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const len = (a: Vec3Like): number => Math.hypot(a.x, a.y, a.z)
const scale = (a: Vec3Like, k: number): Vec3Like => ({ x: a.x * k, y: a.y * k, z: a.z * k })
const norm = (a: Vec3Like): Vec3Like => {
  const l = len(a)
  return l > 0 ? scale(a, 1 / l) : { x: 0, y: 0, z: 0 }
}

/**
 * The plane normal of a closed outline by Newell's method — robust to
 * collinear runs, and oriented so the outline runs counter-clockwise when
 * seen from its tip.
 */
const newellNormal = (pts: readonly Vec3Like[]): Vec3Like => {
  let nx = 0
  let ny = 0
  let nz = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    nx += (a.y - b.y) * (a.z + b.z)
    ny += (a.z - b.z) * (a.x + b.x)
    nz += (a.x - b.x) * (a.y + b.y)
  }
  return norm({ x: nx, y: ny, z: nz })
}

/**
 * The sharp corners of a polyline, in walk order. `closed` defaults to
 * whether the last point returns to the first (the shape outlines this
 * framework hands around repeat their first point to close).
 */
export const cornersOf = (
  points: readonly Vec3Like[],
  opts: { closed?: boolean; minTurn?: number } = {},
): Corner[] => {
  if (points.length < 3) return []
  // Repeated points carry no direction; drop them before reading turns.
  let extent = 0
  for (const p of points) extent = Math.max(extent, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))
  const eps = Math.max(extent, 1) * 1e-9
  const pts: Vec3Like[] = []
  for (const p of points) {
    const last = pts[pts.length - 1]
    if (!last || len(sub(p, last)) > eps) pts.push(p)
  }
  const returns = pts.length > 2 && len(sub(pts[0]!, pts[pts.length - 1]!)) <= eps
  const closed = opts.closed ?? returns
  if (returns) pts.pop()
  const n = pts.length
  if (n < 3) return []
  const minTurn = opts.minTurn ?? SHARP_TURN
  const plane = closed ? newellNormal(pts) : undefined
  if (plane && len(plane) === 0) return [] // a closed outline with no area

  const corners: Corner[] = []
  const first = closed ? 0 : 1
  const last = closed ? n - 1 : n - 2
  for (let i = first; i <= last; i++) {
    const at = pts[i]!
    const prev = pts[(i - 1 + n) % n]!
    const next = pts[(i + 1) % n]!
    const toPrev = sub(prev, at)
    const toNext = sub(next, at)
    const u = norm(toPrev)
    const v = norm(toNext)
    const small = Math.acos(Math.max(-1, Math.min(1, dot(u, v))))
    if (Math.PI - small < minTurn) continue
    // The corner's own plane: the outline's for a closed shape, else the
    // one the two edges span (an open spike folding straight back has
    // none, and no angle worth marking).
    const normal = plane ?? norm(cross(u, v))
    if (len(normal) === 0) continue
    let interior = small
    if (plane) {
      const turnsLeft = dot(cross(scale(toPrev, -1), toNext), plane) >= 0
      if (!turnsLeft) interior = 2 * Math.PI - small
    }
    // w ⟂ u in the plane, on the side the interior sweeps toward.
    let w = norm(cross(normal, u))
    const landed = {
      x: Math.cos(interior) * u.x + Math.sin(interior) * w.x,
      y: Math.cos(interior) * u.y + Math.sin(interior) * w.y,
      z: Math.cos(interior) * u.z + Math.sin(interior) * w.z,
    }
    if (dot(landed, v) < 1 - 1e-6) w = scale(w, -1)
    corners.push({
      at,
      u,
      v,
      w,
      interior,
      right: Math.abs(interior - Math.PI / 2) < RIGHT_ANGLE_TOLERANCE,
      reach: Math.min(len(toPrev), len(toNext)),
    })
  }
  return corners
}

/**
 * The mark for one corner, as a polyline: the right-angle square (three
 * points, an open L closing the corner) or an arc of radius `size` swept
 * across the interior. `size` shrinks to MARK_ROOM of the shorter
 * adjacent edge so a mark never overruns a small figure.
 */
export const angleMark = (corner: Corner, size: number, segments = 32): Vec3Like[] => {
  const s = Math.min(size, corner.reach * MARK_ROOM)
  const { at, u, v, w } = corner
  const along = (d: Vec3Like, k: number): Vec3Like => ({
    x: at.x + d.x * k,
    y: at.y + d.y * k,
    z: at.z + d.z * k,
  })
  if (corner.right) {
    const a = along(u, s)
    return [a, { x: a.x + v.x * s, y: a.y + v.y * s, z: a.z + v.z * s }, along(v, s)]
  }
  // Long arcs (reflex corners) get proportionally more segments.
  const steps = Math.max(4, Math.ceil((segments * corner.interior) / Math.PI))
  const out: Vec3Like[] = []
  for (let k = 0; k <= steps; k++) {
    const phi = (corner.interior * k) / steps
    const c = Math.cos(phi)
    const sn = Math.sin(phi)
    out.push({
      x: at.x + (u.x * c + w.x * sn) * s,
      y: at.y + (u.y * c + w.y * sn) * s,
      z: at.z + (u.z * c + w.z * sn) * s,
    })
  }
  return out
}
