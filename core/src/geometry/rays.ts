/**
 * Rays cast in a plane, and what they hit — pure math.
 *
 * The geometry half of the RayCaster (vocabulary/Eye/RayCaster.ts,
 * ONTOLOGY.md 2026-09-16 "the eyes perceive"): a fan of rays leaves a
 * point, each travels until it meets a collider's outline and STOPS
 * there, and the impact sends out a shockwave that is all energy at the
 * hit and dissipates as it spreads (ease-OUT).
 *
 * The plane is the xy plane through the emitter (the first constraint
 * the transmission names: "constrain to a PLANE → rays radial-outward in
 * that plane"); colliders are read as their outlines seen in that plane
 * (their x and y — a figure standing in the plane, which every corpus
 * use is, meets them exactly). Casting from surface normals and in 3D are
 * the transmission's "later", not this.
 */

export interface Vec2 {
  x: number
  y: number
}

/**
 * The fan's ray angles. A fan spanning a full turn (|last − first| ≈ 2π,
 * the isotropic default) spreads `steps` rays evenly WITHOUT repeating
 * the seam ray; any narrower fan includes both ends, so three rays across
 * an eye's opening are its two edges and its centre.
 */
export const fanAngles = (first: number, last: number, steps: number): number[] => {
  const n = Math.max(0, Math.floor(steps))
  if (n === 0) return []
  if (n === 1) return [(first + last) / 2]
  const span = last - first
  const fullTurn = Math.abs(Math.abs(span) - 2 * Math.PI) < 1e-9
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(first + (span * i) / (fullTurn ? n : n - 1))
  return out
}

/**
 * Where a ray from `origin` at `angle` first meets any of the polylines,
 * within `reach`: the distance along the ray and the point, or undefined
 * if it meets nothing. Each polyline is walked segment by segment (a
 * closed outline repeats its first point, so its closing edge is there).
 */
export const castRay = (
  origin: Vec2,
  angle: number,
  polylines: readonly (readonly Vec2[])[],
  reach: number,
): { distance: number; point: Vec2 } | undefined => {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  let best = Infinity
  for (const line of polylines) {
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i]!
      const b = line[i + 1]!
      const ex = b.x - a.x
      const ey = b.y - a.y
      const den = dx * ey - dy * ex
      if (Math.abs(den) < 1e-12) continue // parallel: grazing never stops a ray
      const ax = a.x - origin.x
      const ay = a.y - origin.y
      const t = (ax * ey - ay * ex) / den // along the ray
      const u = (ax * dy - ay * dx) / den // along the segment
      if (t > 1e-9 && u >= 0 && u <= 1 && t < best) best = t
    }
  }
  if (!(best <= reach)) return undefined
  return { distance: best, point: { x: origin.x + dx * best, y: origin.y + dy * best } }
}

/**
 * The shockwave at progress `s` ∈ [0, 1] since impact: its radius as a
 * fraction of the full ring, rushing out first and slowing as it goes
 * (ease-out quadratic), and its strength, full at the hit and gone at the
 * end. Outside [0, 1] there is no wave.
 */
export const shockwave = (s: number): { radius: number; strength: number } => {
  if (!(s > 0) || s >= 1) return { radius: s >= 1 ? 1 : 0, strength: 0 }
  return { radius: 1 - (1 - s) * (1 - s), strength: 1 - s }
}
