/**
 * Flow-map geometry — the pure layout under vocabulary/FlowMap.
 *
 * An organisation drawn as nested circles: a GROUP circle of radius R holding
 * its MEMBERS as small circles, PARTNERS (suppliers, customers) as small
 * circles around it. Everything here is a pure function of plain numbers, so
 * the holon is a pure function of its params and the tests can pin layouts
 * without a renderer.
 *
 * GRAIN — revealing a categorical dimension. With N categories, each gets a
 * disc that, at grain g, SHRINKS IN FROM THE GROUP'S OWN CIRCUMFERENCE: at
 * g = 0 every disc is the group circle itself; at g = 1 it is a smaller disc
 * internally tangent to the group circle at its own direction. The tangent
 * point never moves (|centre| + radius = R for every g), which is what makes
 * the disc read as peeling off the rim rather than appearing from nowhere.
 * Two categories land on the vesica piscis — each centre on the other's
 * circumference (d = r/2, r = 2R/3).
 */

export interface Vec2 {
  x: number
  y: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Disc {
  x: number
  y: number
  radius: number
}

/** A category's direction: the first at the top, the rest round the clock. */
export const categoryDirection = (i: number, n: number): Vec2 => {
  const a = Math.PI / 2 - (2 * Math.PI * i) / Math.max(1, n)
  return { x: Math.cos(a), y: Math.sin(a) }
}

/**
 * Centre offset as a fraction of the category radius at full grain. 1/2 is
 * the vesica (each centre on the other's rim); more categories need a wider
 * spread for every overlap region to keep some room (three makes a Venn).
 */
const spreadFor = (n: number): number => (n <= 1 ? 0.25 : n === 2 ? 0.5 : 0.62)

/** The category discs at grain g ∈ [0, 1], group radius R. */
export const categoryDiscs = (n: number, R: number, g: number): Disc[] => {
  const s = spreadFor(n)
  const rc = R / (1 + s)
  const d = s * rc
  const out: Disc[] = []
  for (let i = 0; i < n; i++) {
    const dir = categoryDirection(i, n)
    out.push({ x: dir.x * d * g, y: dir.y * d * g, radius: R + (rc - R) * g })
  }
  return out
}

/** Sunflower packing of n points inside a disc — even, deterministic, rotation-free. */
export const phyllotaxis = (n: number, radius: number): Vec2[] => {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const out: Vec2[] = []
  for (let i = 0; i < n; i++) {
    const r = radius * Math.sqrt((i + 0.5) / n)
    const a = Math.PI / 2 + i * golden
    out.push({ x: r * Math.cos(a), y: r * Math.sin(a) })
  }
  return out
}

/**
 * Which discs a point is CLEARLY inside, or undefined when it sits within
 * `margin` of any disc's rim (a member there would straddle a boundary).
 */
const membership = (p: Vec2, discs: readonly Disc[], margin: number): boolean[] | undefined => {
  const out: boolean[] = []
  for (const d of discs) {
    const dist = Math.hypot(p.x - d.x, p.y - d.y)
    if (Math.abs(dist - d.radius) < margin) return undefined
    out.push(dist < d.radius)
  }
  return out
}

const sameSet = (a: readonly boolean[], b: readonly boolean[]): boolean =>
  a.every((v, i) => v === b[i])

/**
 * `count` evenly spread points inside one REGION of the categorised picture —
 * the points clearly inside exactly the discs flagged in `set` (and the group
 * circle). Candidates on a fine hex grid; seeds by farthest-point sampling
 * from the region's centroid; then a few Lloyd steps so the points settle
 * centroidally, inset from the rims rather than hugging them. Deterministic.
 */
export const regionSlots = (
  set: readonly boolean[],
  discs: readonly Disc[],
  R: number,
  count: number,
  margin: number,
): Vec2[] => {
  if (count <= 0) return []
  const step = R / 22
  const cand: Vec2[] = []
  const reach = R - margin
  for (let j = -30; j <= 30; j++) {
    const y = j * step * (Math.sqrt(3) / 2)
    const shift = (j & 1) * step * 0.5
    for (let i = -30; i <= 30; i++) {
      const p = { x: i * step + shift, y }
      if (Math.hypot(p.x, p.y) > reach) continue
      const m = membership(p, discs, margin)
      if (m && sameSet(m, set)) cand.push(p)
    }
  }
  if (cand.length === 0) {
    // An empty region (a three-way overlap squeezed shut): gather round the
    // mean of its discs' centres rather than vanish.
    const sel = discs.filter((_, i) => set[i])
    const c = sel.length
      ? { x: sel.reduce((s, d) => s + d.x, 0) / sel.length, y: sel.reduce((s, d) => s + d.y, 0) / sel.length }
      : { x: 0, y: 0 }
    return phyllotaxis(count, margin * Math.sqrt(count)).map((p) => ({ x: p.x + c.x, y: p.y + c.y }))
  }
  const cx = cand.reduce((s, p) => s + p.x, 0) / cand.length
  const cy = cand.reduce((s, p) => s + p.y, 0) / cand.length
  const d2 = (a: Vec2, b: Vec2) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2
  // Farthest-point seeds, the first nearest the centroid.
  let first = 0
  for (let i = 1; i < cand.length; i++) if (d2(cand[i]!, { x: cx, y: cy }) < d2(cand[first]!, { x: cx, y: cy })) first = i
  const seeds: Vec2[] = [cand[first]!]
  const nearest = cand.map((p) => d2(p, cand[first]!))
  while (seeds.length < Math.min(count, cand.length)) {
    let best = 0
    for (let i = 1; i < cand.length; i++) if (nearest[i]! > nearest[best]!) best = i
    seeds.push(cand[best]!)
    for (let i = 0; i < cand.length; i++) nearest[i] = Math.min(nearest[i]!, d2(cand[i]!, cand[best]!))
  }
  // Lloyd: each seed moves to the centroid of the candidates it owns.
  let pts = seeds
  for (let iter = 0; iter < 12; iter++) {
    const sx = pts.map(() => 0)
    const sy = pts.map(() => 0)
    const n = pts.map(() => 0)
    for (const c of cand) {
      let k = 0
      for (let i = 1; i < pts.length; i++) if (d2(c, pts[i]!) < d2(c, pts[k]!)) k = i
      sx[k]! += c.x
      sy[k]! += c.y
      n[k]! += 1
    }
    pts = pts.map((p, i) => (n[i]! > 0 ? { x: sx[i]! / n[i]!, y: sy[i]! / n[i]! } : p))
  }
  // A region in two pieces (the side lunes left over by two discs) can pull
  // a centroid into the gap between them: snap any point that left its
  // region back to the nearest candidate of its own.
  pts = pts.map((p) => {
    const m = membership(p, discs, margin)
    if (m && sameSet(m, set) && Math.hypot(p.x, p.y) <= reach) return p
    let k = 0
    for (let i = 1; i < cand.length; i++) if (d2(cand[i]!, p) < d2(cand[k]!, p)) k = i
    return cand[k]!
  })
  // More members than candidates: the rest stack on the last slots (never in practice).
  while (pts.length < count) pts.push(pts[pts.length % Math.max(1, seeds.length)]!)
  return pts
}

/** A deterministic hash of an integer into [0, 1). */
const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * A region's members as one compact HONEYCOMB cluster round the region's
 * deepest point (the spot farthest from every rim). Evenly relaxed points
 * follow a region's shape — in a crescent they line up along its curve and
 * the picture reads as a face; a tight hexagonal cluster reads as what it
 * is, a set of entities. The lattice is turned per region (deterministic),
 * so no two clusters line up. Undefined when the region cannot hold the
 * cluster — the caller falls back to `regionSlots`.
 */
export const regionCluster = (
  set: readonly boolean[],
  discs: readonly Disc[],
  R: number,
  count: number,
  margin: number,
  pitch: number,
  turn: number,
): Vec2[] | undefined => {
  if (count <= 0) return []
  const reach = R - margin
  const inRegion = (p: Vec2): boolean => {
    if (Math.hypot(p.x, p.y) > reach) return false
    const m = membership(p, discs, margin)
    return !!m && sameSet(m, set)
  }
  // The deepest point: the fine-grid point of the region with most clearance.
  const step = R / 40
  let deep: Vec2 | undefined
  let best = -Infinity
  for (let j = -40; j <= 40; j++) {
    for (let i = -40; i <= 40; i++) {
      const p = { x: i * step, y: j * step }
      if (!inRegion(p)) continue
      let clear = R - Math.hypot(p.x, p.y)
      for (const d of discs) clear = Math.min(clear, Math.abs(Math.hypot(p.x - d.x, p.y - d.y) - d.radius))
      if (clear > best + 1e-9) {
        best = clear
        deep = p
      }
    }
  }
  if (!deep) return undefined
  const a = 0.35 + hash(turn * 17 + 1) * (Math.PI / 3)
  const ux = { x: Math.cos(a) * pitch, y: Math.sin(a) * pitch }
  const uy = { x: Math.cos(a + Math.PI / 3) * pitch, y: Math.sin(a + Math.PI / 3) * pitch }
  const nodes: { p: Vec2; d: number; k: number }[] = []
  let k = 0
  for (let j = -8; j <= 8; j++)
    for (let i = -8; i <= 8; i++) {
      const p = { x: deep.x + i * ux.x + j * uy.x, y: deep.y + i * ux.y + j * uy.y }
      if (inRegion(p)) nodes.push({ p, d: Math.hypot(p.x - deep.x, p.y - deep.y), k: k++ })
      else k++
    }
  if (nodes.length < count) return undefined
  nodes.sort((x, y) => x.d - y.d || x.k - y.k)
  const chosen = nodes.slice(0, count).map((n) => n.p)
  // Centre the cluster on the deepest point, if that keeps it inside.
  const cx = chosen.reduce((s, p) => s + p.x, 0) / count - deep.x
  const cy = chosen.reduce((s, p) => s + p.y, 0) / count - deep.y
  const moved = chosen.map((p) => ({ x: p.x - cx, y: p.y - cy }))
  return moved.every(inRegion) ? moved : chosen
}

/**
 * Assign each item one slot, nearest pairs first (global greedy) — so a
 * member's two layouts are as close as the slots allow and the transition
 * between them travels little and crosses little. Returns slot index per item.
 */
export const assignNearest = (items: readonly Vec2[], slots: readonly Vec2[]): number[] => {
  const pairs: { i: number; s: number; d: number }[] = []
  items.forEach((p, i) =>
    slots.forEach((q, s) => pairs.push({ i, s, d: (p.x - q.x) ** 2 + (p.y - q.y) ** 2 })),
  )
  pairs.sort((a, b) => a.d - b.d || a.i - b.i || a.s - b.s)
  const out = items.map(() => -1)
  const taken = new Set<number>()
  for (const { i, s } of pairs) {
    if (out[i] !== -1 || taken.has(s)) continue
    out[i] = s
    taken.add(s)
  }
  return out
}

/**
 * Both layouts of the members — `flat` (uncategorised: one sunflower in the
 * group circle) and `categorised` (each member in the region of exactly its
 * own categories at full grain). Computed once; the holon interpolates.
 */
export const memberLayouts = (
  categoriesOf: readonly (readonly number[])[],
  nCategories: number,
  R: number,
  memberRadius: number,
): { flat: Vec2[]; categorised: Vec2[] } => {
  const n = categoriesOf.length
  const discs = categoryDiscs(nCategories, R, 1)
  const margin = memberRadius * 1.9
  const categorised: Vec2[] = new Array(n)
  // Group members by their exact category set, regions in first-seen order.
  const regions = new Map<string, number[]>()
  categoriesOf.forEach((cats, i) => {
    const key = [...new Set(cats)].sort((a, b) => a - b).join(",")
    const list = regions.get(key) ?? []
    list.push(i)
    regions.set(key, list)
  })
  let regionIndex = 0
  for (const members of regions.values()) {
    const set = discs.map((_, k) => categoriesOf[members[0]!]!.includes(k))
    // Within a region, data order reads round the region from its first slot.
    const cluster = regionCluster(set, discs, R, members.length, margin, memberRadius * 5, regionIndex++)
    const slots = cluster ?? regionSlots(set, discs, R, members.length, margin)
    members.forEach((m, j) => (categorised[m] = slots[j]!))
  }
  // The flat sunflower, each member taking the petal nearest its categorised
  // home — so the grain transition is a short glide, not a shuffle.
  const petals = phyllotaxis(n, R * 0.68)
  const pick = assignNearest(categorised, petals)
  const flat = pick.map((s) => petals[s]!)
  return { flat, categorised }
}

export type PartnerSide = "in" | "out" | "both"

/**
 * Partners round the group: suppliers ("in") on the left — value enters from
 * there — customers ("out") on the right, two-way partners ("both") top and
 * bottom, alternating. Each side's partners fan evenly about its direction.
 */
export const partnerLayout = (sides: readonly PartnerSide[], R: number): Vec2[] => {
  const ring = R * 1.36
  const spacing = 0.34
  const groups: Record<string, number[]> = { in: [], out: [], top: [], bottom: [] }
  let alt = 0
  sides.forEach((s, i) => {
    if (s === "in") groups.in!.push(i)
    else if (s === "out") groups.out!.push(i)
    else groups[alt++ % 2 === 0 ? "top" : "bottom"]!.push(i)
  })
  const centre: Record<string, number> = { in: Math.PI, out: 0, top: Math.PI / 2, bottom: -Math.PI / 2 }
  const out: Vec2[] = new Array(sides.length)
  for (const [side, members] of Object.entries(groups)) {
    const k = members.length
    members.forEach((m, j) => {
      const a = centre[side]! + (j - (k - 1) / 2) * spacing
      out[m] = { x: ring * Math.cos(a), y: ring * Math.sin(a) }
    })
  }
  return out
}

/**
 * Where a flow's channel runs: a quadratic arc from A to B, bowed sideways by
 * `bend` of its in-plane length (so flows overlaid in one plane separate
 * instead of coinciding), and lifted by `lift` in y at its middle (the
 * staged stack fans a gap's flows apart this way). The bow is in the picture's plane, whatever depth
 * the two ends sit at — flat or staged, the channel is the same shape.
 */
export const flowPoint = (a: Vec3, b: Vec3, u: number, bend: number, lift = 0): Vec3 => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const cx = (a.x + b.x) / 2 - dy * bend
  const cy = (a.y + b.y) / 2 + dx * bend + lift
  const cz = (a.z + b.z) / 2
  const v = 1 - u
  return {
    x: v * v * a.x + 2 * v * u * cx + u * u * b.x,
    y: v * v * a.y + 2 * v * u * cy + u * u * b.y,
    z: v * v * a.z + 2 * v * u * cz + u * u * b.z,
  }
}

/**
 * Pull an endpoint in from an entity's centre to its rim (plus a gap), along
 * the in-plane direction to the other end — arrows touch circles, they don't
 * pierce them.
 */
export const trimToRim = (from: Vec3, toward: Vec3, rim: number): Vec3 => {
  const dx = toward.x - from.x
  const dy = toward.y - from.y
  const L = Math.hypot(dx, dy)
  if (L < 1e-9) return from
  const k = Math.min(rim, L * 0.45) / L
  return { x: from.x + dx * k, y: from.y + dy * k, z: from.z }
}

/** Depth of each slice of the stage stack, centred on 0. `open[k]` opens the gap before slice k+1. */
export const sliceDepths = (open: readonly number[], gap: number, expand: number): number[] => {
  const z = [0]
  for (const o of open) z.push(z[z.length - 1]! + gap * expand * o)
  const mid = (z[0]! + z[z.length - 1]!) / 2
  return z.map((v) => v - mid)
}

/** Sample a parametric curve into points with cumulative arc lengths. */
export const arcTable = (f: (u: number) => Vec3, n: number): { points: Vec3[]; lengths: number[] } => {
  const points: Vec3[] = []
  const lengths: number[] = []
  let total = 0
  for (let i = 0; i <= n; i++) {
    const p = f(i / n)
    if (i > 0) {
      const q = points[i - 1]!
      total += Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)
    }
    points.push(p)
    lengths.push(total)
  }
  return { points, lengths }
}

/** The point at arc length s along a sampled curve (clamped to its ends). */
export const atArcLength = (points: readonly Vec3[], lengths: readonly number[], s: number): Vec3 => {
  const n = points.length
  if (n === 1 || s <= 0) return points[0]!
  if (s >= lengths[n - 1]!) return points[n - 1]!
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (lengths[mid]! <= s) lo = mid
    else hi = mid
  }
  const span = lengths[hi]! - lengths[lo]!
  const u = span > 0 ? (s - lengths[lo]!) / span : 0
  const a = points[lo]!
  const b = points[hi]!
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u }
}

/**
 * Where particle j of a stream is, as ARC LENGTH along its channel: n
 * particles `spacing` apart circulate a loop of length n·spacing at `speed`
 * units per second, `phase` (in spacings) offsetting the whole stream. Those
 * past the channel's current length L are "in the pipe" — hidden — so a
 * short channel carries few at the same spacing. Pure f(time).
 */
export const streamArc = (j: number, n: number, spacing: number, speed: number, time: number, phase: number): number => {
  const cycle = n * spacing
  if (!(cycle > 0)) return 0
  const v = (time * speed + (j + phase) * spacing) % cycle
  return v < 0 ? v + cycle : v
}

/**
 * How visible a particle at arc length s is on a channel of length L drawn
 * to `shown` of its length: soft at both ends and at the draw front, 0 in
 * the pipe beyond L.
 */
export const streamFade = (s: number, L: number, shown: number): number => {
  if (s > L) return 0
  const edge = Math.min(22, L / 4)
  return smooth(0, edge, s) * smooth(L, L - edge, s) * smooth(0, edge, shown * L - s)
}

/** Smoothstep — the soft edge every fade here uses. */
export const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/**
 * The single h/p/b turn of Ry(−heading)·Rx(−pitch)·Ry(φ)·Rx(−θ) — a carrier
 * that cancels a stack turned Rx(pitch)·Ry(heading) and then faces an
 * observer at azimuth φ, elevation θ — decomposed in the host's composition
 * order Rz(b)·Rx(p)·Ry(h) (three's 'ZXY'). One group instead of four. Pure.
 */
export const facingAngles = (heading: number, pitch: number, phi: number, theta: number): { h: number; p: number; b: number } => {
  type M = number[] // row-major 3×3
  const ry = (a: number): M => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)]
  const rx = (a: number): M => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)]
  const mul = (a: M, b: M): M => {
    const o: M = new Array(9).fill(0)
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) o[i * 3 + j]! += a[i * 3 + k]! * b[k * 3 + j]!
    return o
  }
  const m = mul(mul(mul(ry(-heading), rx(-pitch)), ry(phi)), rx(-theta))
  // ZXY: m32 = sin(p); h from (−m31, m33); b from (−m12, m22).
  const m32 = Math.max(-1, Math.min(1, m[7]!))
  const p = Math.asin(m32)
  if (Math.abs(m32) < 0.9999999) return { h: Math.atan2(-m[6]!, m[8]!), p, b: Math.atan2(-m[1]!, m[4]!) }
  return { h: 0, p, b: Math.atan2(m[3]!, m[0]!) }
}
