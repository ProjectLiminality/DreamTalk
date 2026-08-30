/**
 * Packing bricks along a footprint — pure math.
 *
 * Ported from TheWall/TheWall.py (the Python-in-C4D original; line
 * citations refer to it). The wall's slots are NOT evenly spaced: a
 * square brick of a fixed size, laid flat and kept perpendicular to a
 * curving footprint, needs more arc-length on a convex bend and less on
 * a concave one. The original solved this exactly — walk the curve,
 * and for each new brick bisect for the smallest parameter at which its
 * oriented square STOPS overlapping its predecessor (:103-147). Two
 * squares in the ground plane are convex quads, so overlap is a
 * separating-axis test over their four edge normals (:86-101).
 *
 * ## What dies in the port
 *
 * The original computed this inside TheWall's generator and smuggled
 * the answer to the per-clone MindVirusJourney generators through a
 * hidden C4D spline named "PackingLUT", one t value per point's X
 * coordinate (:975-1000) — a blackboard, because a C4D generator has
 * no other way to talk to its siblings. Here the packing is just a
 * function returning data, and the wall holon OWNS the array. Same
 * arithmetic, no blackboard.
 *
 * ## The plane
 *
 * The original packed in C4D's XZ ground plane (the footprint spline
 * is created with its plane parameter set to XZ, TheWall.py:1600). The
 * framework's ground plane is XZ as well — the wall stands UP in +y —
 * so footprints here are Vec2 {x, z} in that plane, and rows stack
 * along +y.
 */

/** A point in the footprint (ground) plane. */
export interface Vec2 {
  x: number
  z: number
}

/** A slot in the wall: where one brick sits and how it is turned. */
export interface Slot {
  /** Normalized position along the footprint. */
  t: number
  /** Brick centre in the ground plane. */
  position: Vec2
  /** Outward normal (tangent × up) — the approach direction (:1268). */
  normal: Vec2
  /** Unit tangent along the footprint. */
  tangent: Vec2
  /** Row index, 0 = bottom. */
  row: number
  /** Index along the row, in packing order. */
  column: number
}

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z })
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z })
const mul = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, z: a.z * k })
const length = (a: Vec2): number => Math.hypot(a.x, a.z)

const normalize = (v: Vec2): Vec2 => {
  const l = length(v)
  return l < 1e-9 ? { x: 0, z: 1 } : { x: v.x / l, z: v.z / l }
}

// ---------------------------------------------------------------------------
// Footprint sampling — an arc-length LUT over a polyline (:332-347)
// ---------------------------------------------------------------------------

/** A footprint as sampled points plus its cumulative arc length. */
export interface Footprint {
  points: Vec2[]
  cumulative: number[]
  totalLength: number
  closed: boolean
}

/** Build the arc-length LUT for a polyline footprint (:333-345). */
export const buildFootprint = (points: Vec2[], closed = true): Footprint => {
  const pts = closed && points.length > 1 ? [...points, points[0]!] : [...points]
  const cumulative = [0]
  for (let i = 1; i < pts.length; i++) {
    cumulative.push(cumulative[i - 1]! + length(sub(pts[i]!, pts[i - 1]!)))
  }
  return { points: pts, cumulative, totalLength: cumulative[cumulative.length - 1]!, closed }
}

/** The source's "is this footprint worth anything" threshold (:337). */
const MIN_TOTAL_LENGTH = 0.001

/** Position + tangent at normalized t, via the arc-length LUT (:348-368). */
export const sampleFootprint = (fp: Footprint, t: number): { position: Vec2; tangent: Vec2 } => {
  if (fp.totalLength < MIN_TOTAL_LENGTH) {
    return { position: fp.points[0] ?? { x: 0, z: 0 }, tangent: { x: 0, z: 1 } }
  }
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t
  const target = clamped * fp.totalLength

  let lo = 0
  let hi = fp.cumulative.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (fp.cumulative[mid]! < target) lo = mid
    else hi = mid
  }
  const segLen = fp.cumulative[hi]! - fp.cumulative[lo]!
  const frac = segLen > 0 ? (target - fp.cumulative[lo]!) / segLen : 0
  const a = fp.points[lo]!
  const b = fp.points[hi]!
  return {
    position: add(a, mul(sub(b, a), frac)),
    tangent: segLen > 0 ? normalize(sub(b, a)) : { x: 0, z: 1 },
  }
}

/** Outward normal at a tangent: tangent × up, in the ground plane (:373). */
export const normalAt = (tangent: Vec2): Vec2 => normalize({ x: -tangent.z, z: tangent.x })

// ---------------------------------------------------------------------------
// The oriented square and the SAT overlap test (:370-401)
// ---------------------------------------------------------------------------

/** The four corners of a brick-sized square centred on the footprint at t
 *  and turned to face along its normal (:370-383). */
export const squareAt = (
  fp: Footprint,
  t: number,
  brickSize: number,
): { center: Vec2; corners: Vec2[] } => {
  const { position, tangent } = sampleFootprint(fp, t)
  const normal = normalAt(tangent)
  const half = brickSize / 2
  const ht = mul(tangent, half)
  const hn = mul(normal, half)
  return {
    center: position,
    corners: [
      sub(sub(position, ht), hn),
      sub(add(position, ht), hn),
      add(add(position, ht), hn),
      add(sub(position, ht), hn),
    ],
  }
}

/** Projection extent of a quad onto an axis (:385-388). */
const projectOnto = (corners: Vec2[], axis: Vec2): { min: number; max: number } => {
  let min = Infinity
  let max = -Infinity
  for (const c of corners) {
    const d = c.x * axis.x + c.z * axis.z
    if (d < min) min = d
    if (d > max) max = d
  }
  return { min, max }
}

/** The source's degenerate-edge guard (:395) and its contact slop (:400). */
const MIN_AXIS_LENGTH = 0.0001
const CONTACT_SLOP = 0.01

/**
 * Separating-axis test for two convex quads in the ground plane
 * (:390-401). Only the first two edges of each quad are tested — for a
 * rectangle the other two are parallel to them, so four axes suffice.
 */
export const squaresOverlap = (a: Vec2[], b: Vec2[]): boolean => {
  for (const corners of [a, b]) {
    for (let i = 0; i < 2; i++) {
      const edge = sub(corners[(i + 1) % 4]!, corners[i]!)
      const axis = { x: -edge.z, z: edge.x }
      const l = length(axis)
      if (l < MIN_AXIS_LENGTH) continue
      const unit = mul(axis, 1 / l)
      const pa = projectOnto(a, unit)
      const pb = projectOnto(b, unit)
      if (pa.max <= pb.min + CONTACT_SLOP || pb.max <= pa.min + CONTACT_SLOP) return false
    }
  }
  return true
}

// ---------------------------------------------------------------------------
// The bisection search (:103-147)
// ---------------------------------------------------------------------------

/** Search bracket, as multiples of the brick size (:107-108). */
const MIN_ARC_RATIO = 0.3
const MAX_ARC_RATIO = 3.0
/** Bisection stopping distance in world units, and its iteration cap (:104). */
const BISECTION_TOLERANCE = 0.0001
const MAX_ITERATIONS = 50
/** Attempts to push the upper bracket out when it still overlaps (:132). */
const MAX_BRACKET_EXPANSIONS = 10

/**
 * The smallest t greater than prevT at which a brick just clears its
 * predecessor (:103-147). Returns undefined when the footprint runs out.
 */
export const findNextBrickT = (
  fp: Footprint,
  brickSize: number,
  prevT: number,
  prevCorners: Vec2[],
): number | undefined => {
  const total = fp.totalLength
  let tLo = prevT + (brickSize * MIN_ARC_RATIO) / total
  let tHi = Math.min(prevT + (brickSize * MAX_ARC_RATIO) / total, 1)
  if (tLo >= 1) return undefined

  let overlapsLo = squaresOverlap(prevCorners, squareAt(fp, tLo, brickSize).corners)
  if (!overlapsLo) {
    // Already clear at the minimum step: the true contact point is behind
    // it, so search the whole gap from just past prevT (:118-124).
    tHi = tLo
    tLo = prevT + BISECTION_TOLERANCE / total
    overlapsLo = squaresOverlap(prevCorners, squareAt(fp, tLo, brickSize).corners)
    if (!overlapsLo) return tHi
  }

  if (squaresOverlap(prevCorners, squareAt(fp, tHi, brickSize).corners)) {
    // Push the bracket out until it clears (:130-138).
    let cleared = false
    for (let i = 0; i < MAX_BRACKET_EXPANSIONS; i++) {
      tHi = Math.min(tHi + brickSize / total, 1)
      if (!squaresOverlap(prevCorners, squareAt(fp, tHi, brickSize).corners)) {
        cleared = true
        break
      }
    }
    if (!cleared) return undefined
  }

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const tMid = (tLo + tHi) / 2
    if (squaresOverlap(prevCorners, squareAt(fp, tMid, brickSize).corners)) tLo = tMid
    else tHi = tMid
    if ((tHi - tLo) * total < BISECTION_TOLERANCE) break
  }
  return tHi
}

/** Past this t a closed footprint checks against its FIRST brick (:171). */
const WRAP_CHECK_T = 0.9

/**
 * Walk the footprint placing bricks that exactly touch without
 * overlapping (:149-179). Deterministic: same footprint, same answer.
 */
export const packFootprint = (fp: Footprint, brickSize: number): number[] => {
  if (fp.totalLength < MIN_TOTAL_LENGTH) return [0]

  const ts = [0]
  const firstCorners = squareAt(fp, 0, brickSize).corners

  for (;;) {
    const prevT = ts[ts.length - 1]!
    const prevCorners = squareAt(fp, prevT, brickSize).corners
    const nextT = findNextBrickT(fp, brickSize, prevT, prevCorners)
    if (nextT === undefined || nextT >= 1) break
    // A closed footprint must not overlap itself where it comes round.
    if (fp.closed && nextT > WRAP_CHECK_T) {
      if (squaresOverlap(squareAt(fp, nextT, brickSize).corners, firstCorners)) break
    }
    ts.push(nextT)
  }
  return ts
}

// ---------------------------------------------------------------------------
// Slots — the wall's own data (replacing the PackingLUT blackboard)
// ---------------------------------------------------------------------------

export interface PackingConfig {
  brickSize: number
  rowCount: number
  /**
   * The brick's own footprint extends this far forward of the creature's
   * origin along the normal, so the slot is pushed BACK by it to centre
   * the brick on the footprint (:1270-1272 — the source's literal 50,
   * i.e. half of its 100-unit cube).
   */
  originOffset?: number
}

/** Every slot of a packed wall, ordered by row then by t. */
export interface Packing {
  /** The packing parameters, ascending — one per column (:1000). */
  ts: number[]
  slots: Slot[]
  /** Bricks per row. */
  rowLength: number
  footprint: Footprint
}

/**
 * Pack a footprint and lay out every slot of every row (:1259-1281).
 *
 * Rows are the same packing repeated at increasing height; the wall's
 * rows are CENTRED on y = 0 exactly as the cloner's grid was (:1276).
 */
export const packSlots = (fp: Footprint, config: PackingConfig): Packing => {
  const { brickSize, rowCount } = config
  const originOffset = config.originOffset ?? brickSize / 2
  const ts = packFootprint(fp, brickSize)

  const slots: Slot[] = []
  for (let row = 0; row < rowCount; row++) {
    for (let column = 0; column < ts.length; column++) {
      const t = ts[column]!
      const { position, tangent } = sampleFootprint(fp, t)
      const normal = normalAt(tangent)
      slots.push({
        t,
        position: add(position, mul(normal, originOffset)),
        normal,
        tangent,
        row,
        column,
      })
    }
  }
  return { ts, slots, rowLength: ts.length, footprint: fp }
}

/** Height of a row above the wall's centre (:1276). */
export const rowHeight = (row: number, rowCount: number, spacing: number): number =>
  (row - (rowCount - 1) / 2) * spacing

// ---------------------------------------------------------------------------
// Footprint shapes
// ---------------------------------------------------------------------------

/** How finely a parametric footprint is sampled into a polyline. */
export const FOOTPRINT_SAMPLES = 360

/**
 * Reflect a footprint about the XY plane (negate z). The C4D-authored
 * scenes present MIRRORED through this host: the host's azimuth
 * convention is the C4D rig turned 180° about Y (DECISIONS 2026-08-30),
 * and a reflection — provably not expressible as any phi offset — is
 * what maps one handedness onto the other. Scenes authored against the
 * C4D rig apply this ONCE at the scene boundary; measured on the
 * TheWall benchmark it is worth +0.79 coverage_ref in the cable phase
 * (0.62 → 0.927 mean, chamfer 13px → sub-pixel; thewall-port.md).
 */
export const reflectedZ = (footprint: Footprint): Footprint => {
  // points already carry the duplicated closing vertex when closed —
  // strip it so buildFootprint's own closure does not double it.
  const raw = footprint.closed ? footprint.points.slice(0, -1) : footprint.points
  return buildFootprint(
    raw.map((p) => ({ x: p.x, z: -p.z })),
    footprint.closed,
  )
}

/** A circle in the ground plane — TheLabyrinth.py's footprint (r = 1000). */
export const circleFootprint = (radius: number, samples = FOOTPRINT_SAMPLES): Footprint => {
  const points: Vec2[] = []
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2
    points.push({ x: Math.cos(a) * radius, z: Math.sin(a) * radius })
  }
  return buildFootprint(points, true)
}

export interface FlowerConfig {
  /** C4D's Flower spline "Inner Radius" (TheWall.py:1595 — 500). */
  innerRadius: number
  /** C4D's "Outer Radius" (:1596 — 1000). */
  outerRadius: number
  /** C4D's "Petals" (:1597 — 5). */
  petals: number
  samples?: number
}

/**
 * The 5-petal flower footprint of TheWall.py's __main__ (:1592-1598) —
 * the scene that tests BOTH convex and concave curvature, which is the
 * whole point of the SAT packing.
 *
 * C4D's Flower primitive interpolates a smooth closed curve through
 * `petals` outer lobes and `petals` inner valleys; the smooth radial
 * oscillation between the two radii is
 *
 *   r(a) = mid + amp · cos(petals · a),  mid = (outer+inner)/2,
 *                                        amp = (outer−inner)/2
 *
 * which is the same family of curve, sampled analytically rather than
 * read out of a C4D cache. It reproduces the lobe count, both radii and
 * the alternating curvature exactly; the petal WAISTS of C4D's cubic
 * interpolation are a little narrower than a cosine's. Slot counts are
 * therefore close to, not bit-identical with, the 2021 render's.
 */
export const flowerFootprint = (config: FlowerConfig): Footprint => {
  const { innerRadius, outerRadius, petals } = config
  const samples = config.samples ?? FOOTPRINT_SAMPLES
  const mid = (outerRadius + innerRadius) / 2
  const amp = (outerRadius - innerRadius) / 2
  const points: Vec2[] = []
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2
    const r = mid + amp * Math.cos(petals * a)
    points.push({ x: Math.cos(a) * r, z: Math.sin(a) * r })
  }
  return buildFootprint(points, true)
}
