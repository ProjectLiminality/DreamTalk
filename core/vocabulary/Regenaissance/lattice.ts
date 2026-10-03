/**
 * lattice.ts — the noosphere's geodesic lattice as pure geometry: the 15
 * great circles of the icosahedron (Fuller's "15 great circles" — the mirror
 * planes of icosahedral symmetry), spun, leaned, projected orthographically,
 * and cut into the arcs a drawing needs.
 *
 * The reference's top globe (Regenaissance/WelcomeToTheRegenaissance.png;
 * the NoosphereAndBiosphere DreamTalk renders the same object) is a
 * transparent wireframe sphere whose every line runs whole round the ball —
 * near face bright, far face dim, both visible. Fifteen great circles cut the
 * sphere into the 120 triangles of the disdyakis triacontahedron, which is
 * the density the reference shows; nothing here is traced from pixels.
 *
 * A great circle is planar, so its near half is ONE contiguous half-ellipse
 * on screen and its far half the other — no sampling decides front/back, the
 * limb crossing is solved in closed form. The holon (Regenaissance.ts) then
 * clips both halves against the vesica, where the lattice dives behind the
 * eye: `outsideDisc` splits a polyline into its runs outside one circle.
 */

export interface P2 {
  x: number
  y: number
}

const PHI = (1 + Math.sqrt(5)) / 2

/** The icosahedron's 12 vertices (unnormalised): cyclic (0, ±1, ±φ). */
const ICOSA: [number, number, number][] = []
for (const s1 of [-1, 1]) {
  for (const s2 of [-1, 1]) {
    ICOSA.push([0, s1, s2 * PHI], [s1, s2 * PHI, 0], [s2 * PHI, 0, s1])
  }
}

const norm = (v: [number, number, number]): [number, number, number] => {
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
}

/**
 * The 15 mirror-plane NORMALS: the directions of the icosahedron's 30 edge
 * midpoints, one per ± pair. An edge joins two vertices at the minimum
 * distance (2 for the unnormalised set above).
 */
export const GREAT_CIRCLE_NORMALS: [number, number, number][] = (() => {
  const out: [number, number, number][] = []
  for (let i = 0; i < ICOSA.length; i++) {
    for (let j = i + 1; j < ICOSA.length; j++) {
      const a = ICOSA[i]!
      const b = ICOSA[j]!
      if (Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) - 2) > 1e-9) continue
      const m = norm([a[0] + b[0], a[1] + b[1], a[2] + b[2]])
      if (!out.some((n) => Math.abs(n[0] * m[0] + n[1] * m[1] + n[2] * m[2]) > 1 - 1e-9)) out.push(m)
    }
  }
  return out
})()

/** Spin about the pole (y), then lean the pole by `pitch` about screen x —
 *  Globe's convention (src/geometry/globe.ts), so the two spheres turn alike. */
const orient = (v: [number, number, number], spin: number, pitch: number): [number, number, number] => {
  const c = Math.cos(spin), s = Math.sin(spin)
  const x = v[0] * c + v[2] * s
  const z0 = -v[0] * s + v[2] * c
  const y = v[1] * Math.cos(pitch) - z0 * Math.sin(pitch)
  const z = v[1] * Math.sin(pitch) + z0 * Math.cos(pitch)
  return [x, y, z]
}

/**
 * Great circle `k`'s NEAR and FAR halves, each `samples + 1` screen points on
 * a sphere of `radius` centred at the origin. The plane's in-plane basis is
 * chosen so z(θ) = A·cos θ: the near half is θ ∈ [−π/2, π/2] exactly.
 */
export const greatCircleHalves = (
  k: number,
  radius: number,
  spin: number,
  pitch: number,
  samples = 32,
): { front: P2[]; back: P2[] } => {
  const n = orient(GREAT_CIRCLE_NORMALS[k]!, spin, pitch)
  // u: the in-plane direction of steepest toward-camera z (the camera axis
  // projected into the plane); v = n × u completes the basis. A plane facing
  // the camera dead-on (n ∥ z) is wholly a limb-less ring — any u will do.
  let u: [number, number, number] = [-n[0] * n[2], -n[1] * n[2], 1 - n[2] * n[2]]
  if (Math.hypot(u[0], u[1], u[2]) < 1e-9) u = [1, 0, 0]
  u = norm(u)
  const v: [number, number, number] = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]]
  const half = (from: number): P2[] => {
    const out: P2[] = []
    for (let i = 0; i <= samples; i++) {
      const t = from + (Math.PI * i) / samples
      const c = Math.cos(t), s = Math.sin(t)
      out.push({ x: (u[0] * c + v[0] * s) * radius, y: (u[1] * c + v[1] * s) * radius })
    }
    return out
  }
  return { front: half(-Math.PI / 2), back: half(Math.PI / 2) }
}

/**
 * The runs of `pts` lying OUTSIDE the disc (cx, cy, r) — each run an open
 * polyline whose cut ends are moved onto the circle (bisected), so a lattice
 * line meets the vesica rim exactly instead of a sample short of it.
 */
export const outsideDisc = (pts: readonly P2[], cx: number, cy: number, r: number): P2[][] => {
  const out = (p: P2) => Math.hypot(p.x - cx, p.y - cy) >= r
  const edge = (a: P2, b: P2): P2 => {
    // a outside, b inside (or vice versa): bisect for the crossing.
    let lo = 0, hi = 1
    const oa = out(a)
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2
      const p = { x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m }
      if (out(p) === oa) lo = m
      else hi = m
    }
    return { x: a.x + (b.x - a.x) * lo, y: a.y + (b.y - a.y) * lo }
  }
  const runs: P2[][] = []
  let cur: P2[] | undefined
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    if (out(p)) {
      if (!cur) {
        cur = []
        if (i > 0) cur.push(edge(p, pts[i - 1]!))
        runs.push(cur)
      }
      cur.push(p)
    } else if (cur) {
      cur.push(edge(pts[i - 1]!, p))
      cur = undefined
    }
  }
  return runs.filter((r) => r.length >= 2)
}
