/**
 * RoleMap layout — pure: where every person of an organisation stands, by
 * their distance from the centre of decision.
 *
 * THE ARRANGEMENT (TASTE.md § Aesthetic: never random). Concentric rings,
 * ring k at radius k·gap (ring 0, the centre, a small circle of its own).
 * On a ring, people stand at EQUAL angles. A ring whose roles name a site
 * is cut into equal SECTORS, one per site, the first sector's middle at
 * 45° (so with four sites the dividers fall on the axes and the sites sit
 * on the diagonals), its people evenly spaced and centred in their sector.
 * A ring without sites spreads its people evenly round the whole circle,
 * offset by half a step so that, when the step divides a sector, every
 * sector holds the same share and no one stands on a divider.
 *
 * THE SHARED-SERVICE CLUSTER. When a role centralises, its people gather
 * on a triangular (hex) lattice round one point: the lattice points nearest
 * that point, taken in whole symmetric shells. Centred on a lattice NODE the
 * shells are 1, 6, 6, 6, 12 …; centred on a lattice TRIANGLE they are 3, 3,
 * 6, 6, 3+3 …; whichever centring a count completes is used (12 = 3+3+6, a
 * three-fold flower), the node otherwise.
 */

export type P2 = { x: number; y: number }

export interface RoleSpec {
  id: string
  label: string
  /** Distance from the centre of decision: 0 the centre, then outwards. */
  ring: number
  /** How many people hold it (default 1). */
  count?: number
  /** The site it belongs to (one of `sites`); unset: the whole ring. */
  site?: string
  /** 1 a seat solidly held; less — at risk, drawn ghosted. */
  certainty?: number
  /** Why it is at risk, said when the risk is shown. */
  risk?: string
}

/** One person: which role, which of its holders, where. */
export interface Seat {
  role: number
  index: number
  ring: number
  /** Angle on its ring (radians, 0 = +x, counter-clockwise). */
  angle: number
  p: P2
}

const TAU = Math.PI * 2

/** The middle of site sector s of S, in radians. */
export const sectorMiddle = (s: number, S: number): number => Math.PI / 4 + (TAU * s) / S

/** The dividers between S sectors, in radians (none for fewer than two). */
export const sectorDividers = (S: number): number[] =>
  S < 2 ? [] : Array.from({ length: S }, (_, s) => sectorMiddle(s, S) - Math.PI / S)

/** Ring k's radius: the centre ring a small circle, the rest k·gap. */
export const ringRadius = (k: number, gap: number): number => (k === 0 ? gap * 0.32 : k * gap)

export const polar = (r: number, a: number): P2 => ({ x: r * Math.cos(a), y: r * Math.sin(a) })

/**
 * Every person's seat. `sites` orders the sectors; a site a role names but
 * `sites` lacks is an error (the data is inconsistent, not the picture).
 */
export const seats = (roles: readonly RoleSpec[], sites: readonly string[], gap: number): Seat[] => {
  const out: Seat[] = []
  const rings = [...new Set(roles.map((r) => r.ring))].sort((a, b) => a - b)
  for (const k of rings) {
    const R = ringRadius(k, gap)
    const onRing = roles.map((r, i) => ({ r, i })).filter(({ r }) => r.ring === k)
    const sited = onRing.filter(({ r }) => r.site !== undefined)
    const free = onRing.filter(({ r }) => r.site === undefined)
    for (const { r } of sited)
      if (!sites.includes(r.site!)) throw new Error(`RoleMap: role '${r.id}' names an unknown site '${r.site}' (sites: ${sites.join(", ")})`)
    if (sited.length && free.length)
      throw new Error(`RoleMap: ring ${k} mixes sited and unsited roles — give every role on it a site, or none`)
    if (sited.length) {
      const S = sites.length
      const headcount = (site: string) => sited.filter(({ r }) => r.site === site).reduce((a, { r }) => a + (r.count ?? 1), 0)
      // One step for every sector — the fullest sector's, a step clear of
      // its dividers — so a sector of two and one of three space alike.
      const step = TAU / S / (Math.max(...sites.map(headcount)) + 1)
      sites.forEach((site, s) => {
        const here = sited.filter(({ r }) => r.site === site)
        const n = headcount(site)
        let j = 0
        for (const { r, i } of here)
          for (let c = 0; c < (r.count ?? 1); c++, j++) {
            const a = sectorMiddle(s, S) + (j - (n - 1) / 2) * step
            out.push({ role: i, index: c, ring: k, angle: a, p: polar(R, a) })
          }
      })
    } else {
      const n = free.reduce((a, { r }) => a + (r.count ?? 1), 0)
      // The centre: its few stand side by side (2: the first left of it, the second right).
      // Outer rings: half a step off the axes, so sectors share them evenly.
      const offset = k === 0 ? (n === 2 ? Math.PI : Math.PI / 2) : sites.length > 1 && n % sites.length === 0 ? Math.PI / n : Math.PI / 2
      let j = 0
      for (const { r, i } of free)
        for (let c = 0; c < (r.count ?? 1); c++, j++) {
          const a = offset + (TAU * j) / n
          out.push({ role: i, index: c, ring: k, angle: a, p: polar(n === 1 && k === 0 ? 0 : R, a) })
        }
    }
  }
  return out
}

/**
 * `n` points of a triangular lattice of spacing `d` round the origin, in
 * whole symmetric shells where the count allows (see header). Ordered from
 * the middle out, and within a shell by angle from straight up — so the
 * first to arrive take the middle.
 */
export const hexCluster = (n: number, d: number): P2[] => {
  if (n <= 0) return []
  const h = (Math.sqrt(3) / 2) * d
  const pick = (centre: P2) => {
    const pts: P2[] = []
    const K = Math.ceil(Math.sqrt(n)) + 2
    for (let r = -K; r <= K; r++)
      for (let q = -K; q <= K; q++) pts.push({ x: d * (q + r / 2) - centre.x, y: h * r - centre.y })
    const dist = (p: P2) => Math.round(Math.hypot(p.x, p.y) * 1e6)
    const ang = (p: P2) => (Math.atan2(p.x, p.y) + TAU) % TAU
    pts.sort((a, b) => dist(a) - dist(b) || ang(a) - ang(b))
    // Whole shells: does n end exactly at a shell boundary?
    const whole = n === pts.length || dist(pts[n - 1]!) !== dist(pts[n]!)
    return { pts: pts.slice(0, n), whole }
  }
  const node = pick({ x: 0, y: 0 })
  if (node.whole) return node.pts
  // A triangle's centroid: (d/2, h/3) from a node.
  const tri = pick({ x: d / 2, y: h / 3 })
  return tri.whole ? tri.pts : node.pts
}

/** The shortest signed turn from angle a to angle b. */
export const turn = (a: number, b: number): number => {
  let t = (b - a) % TAU
  if (t > Math.PI) t -= TAU
  if (t < -Math.PI) t += TAU
  return t
}

/**
 * A person gliding from its ring seat into its cluster slot at progress s
 * (0 … 1): ALONG its ring to the cluster's angle (never across the centre),
 * carrying its slot in the ring's own frame (turned with it, so it never
 * strays off the ring on the way) and settling into it as it arrives.
 */
export const glide = (seat: Seat, R: number, clusterAngle: number, slot: P2, s: number): P2 => {
  const a = seat.angle + turn(seat.angle, clusterAngle) * s
  const on = polar(R, a)
  const w = s * s * (3 - 2 * s)
  const c = Math.cos(a - clusterAngle)
  const n = Math.sin(a - clusterAngle)
  return { x: on.x + (slot.x * c - slot.y * n) * w, y: on.y + (slot.x * n + slot.y * c) * w }
}
