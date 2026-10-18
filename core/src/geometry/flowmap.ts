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
 * THE HEX LATTICE — the flower of life's points: every node of a hexagonal
 * grid of spacing `pitch`, one primitive vector along `axis`, one node at
 * `anchor`, within `reach` of the anchor. With the anchor on a mirror line
 * and a lattice vector along it, the lattice is symmetric about that line.
 */
export const hexLattice = (anchor: Vec2, axis: Vec2, pitch: number, reach: number): Vec2[] => {
  const al = Math.hypot(axis.x, axis.y) || 1
  const u = { x: (axis.x / al) * pitch, y: (axis.y / al) * pitch }
  // The second vector at 60° from the first.
  const c = Math.cos(Math.PI / 3)
  const sn = Math.sin(Math.PI / 3)
  const v = { x: u.x * c - u.y * sn, y: u.x * sn + u.y * c }
  const n = Math.ceil(reach / (pitch * 0.85)) + 1
  const out: Vec2[] = []
  for (let j = -n; j <= n; j++)
    for (let i = -n; i <= n; i++) {
      const p = { x: anchor.x + i * u.x + j * v.x, y: anchor.y + i * u.y + j * v.y }
      if (Math.hypot(p.x - anchor.x, p.y - anchor.y) <= reach + 1e-9) out.push(p)
    }
  return out
}

/** The reflection of p across the line through the origin along `axis`. */
const mirror = (p: Vec2, axis: Vec2): Vec2 => {
  const l = Math.hypot(axis.x, axis.y) || 1
  const a = { x: axis.x / l, y: axis.y / l }
  const d = p.x * a.x + p.y * a.y
  return { x: 2 * d * a.x - p.x, y: 2 * d * a.y - p.y }
}

/**
 * Seat `count` things on lattice `nodes`, nearest to `focus` first, taken in
 * MIRROR PAIRS across `axis` (a node with its reflection) so the seating is
 * symmetric whenever the count allows; an odd count takes the nearest
 * on-axis node as its single. Deterministic. Undefined when there are too
 * few nodes.
 */
export const latticeSeats = (nodes: readonly Vec2[], count: number, focus: readonly Vec2[], axis: Vec2): Vec2[] | undefined => {
  if (count <= 0) return []
  if (nodes.length < count) return undefined
  const eps = 1e-6
  const key = (p: Vec2) => Math.min(...focus.map((f) => Math.hypot(p.x - f.x, p.y - f.y)))
  const angle = (p: Vec2) => Math.atan2(p.y, p.x)
  const order = nodes.map((p, i) => ({ p, i, k: key(p) })).sort((a, b) => a.k - b.k || angle(a.p) - angle(b.p) || a.i - b.i)
  const used = new Set<number>()
  const find = (q: Vec2) => order.find((o) => !used.has(o.i) && Math.hypot(o.p.x - q.x, o.p.y - q.y) < eps)
  const groups: Vec2[][] = []
  for (const o of order) {
    if (used.has(o.i)) continue
    used.add(o.i)
    const m = mirror(o.p, axis)
    if (Math.hypot(m.x - o.p.x, m.y - o.p.y) < eps) {
      groups.push([o.p])
      continue
    }
    const twin = find(m)
    if (twin) {
      used.add(twin.i)
      groups.push([o.p, twin.p])
    } else groups.push([o.p])
  }
  // Parity decides the singles: an on-axis node is taken only while an ODD
  // number of seats remains (so the rest can always go in mirror pairs);
  // singles passed over wait at the end. Half a pair only if nothing else.
  const seats: Vec2[] = []
  const deferred: Vec2[] = []
  for (const grp of groups) {
    const need = count - seats.length
    if (need === 0) break
    if (grp.length === 1) {
      if (need % 2 === 1) seats.push(grp[0]!)
      else deferred.push(grp[0]!)
    } else if (need >= 2) seats.push(...grp)
    else deferred.push(grp[0]!.x >= grp[1]!.x ? grp[0]! : grp[1]!)
  }
  while (seats.length < count && deferred.length) seats.push(deferred.shift()!)
  return seats.length === count ? seats : undefined
}

/**
 * A REGION's members on the hex lattice: the region is the part of the
 * group circle clearly inside exactly the discs flagged in `set`. Its axis
 * is the sum of its categories' directions (a lone category's own
 * direction; the overlap's bisector; the space outside every disc takes the
 * first category's line, its two lunes mirror images). The lattice is laid
 * along that axis, anchored on it as near the region's deepest point as the
 * axis allows; seats go nearest that deepest point (and its mirror) first,
 * in mirror pairs. The pitch starts at `pitch` and tightens until the
 * region holds its members, no closer than `minPitch` — past that, a
 * phyllotaxis spiral round the deepest point.
 */
export const regionSeats = (
  set: readonly boolean[],
  discs: readonly Disc[],
  dirs: readonly Vec2[],
  R: number,
  count: number,
  margin: number,
  pitch: number,
  minPitch: number,
): Vec2[] => {
  if (count <= 0) return []
  const reach = R - margin
  const inRegion = (p: Vec2): boolean => {
    if (Math.hypot(p.x, p.y) > reach) return false
    const m = membership(p, discs, margin)
    return !!m && sameSet(m, set)
  }
  let axis = dirs.reduce((a, d, i) => (set[i] ? { x: a.x + d.x, y: a.y + d.y } : a), { x: 0, y: 0 })
  if (Math.hypot(axis.x, axis.y) < 1e-9) axis = dirs[0] ?? { x: 0, y: 1 }
  const al = Math.hypot(axis.x, axis.y)
  axis = { x: axis.x / al, y: axis.y / al }
  // The region's deepest point: most clearance from every rim.
  const step = R / 48
  let deep: Vec2 = { x: 0, y: 0 }
  let best = -Infinity
  for (let j = -48; j <= 48; j++)
    for (let i = -48; i <= 48; i++) {
      const p = { x: i * step, y: j * step }
      if (!inRegion(p)) continue
      let clear = R - Math.hypot(p.x, p.y)
      for (const d of discs) clear = Math.min(clear, Math.abs(Math.hypot(p.x - d.x, p.y - d.y) - d.radius))
      if (clear > best + 1e-9) {
        best = clear
        deep = p
      }
    }
  const focus = [deep, mirror(deep, axis)]
  const t = deep.x * axis.x + deep.y * axis.y
  const anchor = { x: axis.x * t, y: axis.y * t }
  for (let q = pitch; q >= minPitch; q *= 0.92) {
    const nodes = hexLattice(anchor, axis, q, 2 * R).filter(inRegion)
    const seats = latticeSeats(nodes, count, focus, axis)
    if (seats) return seats
  }
  // Too many for the lattice at any legible pitch: a sunflower round the
  // deepest point (phyllotaxis — still a named pattern, never scatter).
  return phyllotaxis(count, minPitch * 0.5 * Math.sqrt(count)).map((p) => ({ x: p.x + deep.x, y: p.y + deep.y }))
}

/**
 * The uncategorised picture: the whole group circle seated on the flower of
 * life — the hex lattice round the centre, symmetric about the vertical,
 * its pitch chosen so the members fill the circle — so the grain transition
 * reads lattice → lattice.
 */
export const flowerSeats = (count: number, R: number, margin: number, pitch: number, minPitch: number): Vec2[] => {
  if (count <= 0) return []
  const reach = R * 0.78 - margin
  const axis = { x: 0, y: 1 }
  // The pitch at which `count` hex cells (√3/2 · pitch² each) fill a disc of
  // 0.62 R — the members FILL the group circle — no tighter than `pitch`.
  const fill = R * 0.62 * Math.sqrt((2 * Math.PI) / (Math.sqrt(3) * count))
  for (let q = Math.max(pitch, fill); q >= minPitch; q *= 0.92) {
    const nodes = hexLattice({ x: 0, y: 0 }, axis, q, reach)
    const seats = latticeSeats(nodes, count, [{ x: 0, y: 0 }], axis)
    if (seats) return seats
  }
  return phyllotaxis(count, reach)
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
  const dirs = discs.map((_, i) => categoryDirection(i, nCategories))
  const margin = memberRadius * 1.9
  const pitch = memberRadius * 4.2
  const minPitch = memberRadius * 2.6
  const categorised: Vec2[] = new Array(n)
  // Group members by their exact category set, regions in first-seen order.
  const regions = new Map<string, number[]>()
  categoriesOf.forEach((cats, i) => {
    const key = [...new Set(cats)].sort((a, b) => a - b).join(",")
    const list = regions.get(key) ?? []
    list.push(i)
    regions.set(key, list)
  })
  for (const members of regions.values()) {
    const set = discs.map((_, k) => categoriesOf[members[0]!]!.includes(k))
    const seats = regionSeats(set, discs, dirs, R, members.length, margin, pitch, minPitch)
    members.forEach((m, j) => (categorised[m] = seats[j]!))
  }
  // The flat flower of life, each member taking the seat nearest its
  // categorised home — so the grain transition is a short glide, lattice to
  // lattice, not a shuffle.
  const seats = flowerSeats(n, R, margin, pitch, minPitch)
  const pick = assignNearest(categorised, seats)
  const flat = pick.map((s) => seats[s]!)
  return { flat, categorised }
}

export type PartnerSide = "in" | "out" | "both"

/**
 * PARTNERS ON ONE RING — every CLASS its own regular polygon (David,
 * 2026-10-18): n partners sit on an n-slot ring (equal steps, slot 0 at
 * 180°), and a class of k partners takes every (n/k)-th slot — so each
 * class is spread equidistantly round the WHOLE circle, and the classes
 * interleave into one uniform n-gon. Six raw suppliers, six finished
 * buyers, three semi-in and three semi-out make an 18-gon: two hexagons
 * (20° apart) and two triangles. The offsets are found by a small search
 * (largest classes first, in data order), so the packing is exact whenever
 * one exists — every class size must divide n. When none exists, `exact`
 * is false and each class keeps as even a spread as the free slots allow.
 * In the stage stack each slice shows only the classes that act there, so
 * each layer keeps its own polygon.
 */
export const partnerRing = (classes: readonly string[], R: number): { points: Vec2[]; exact: boolean } => classRing(classes, R * 1.36)

/**
 * The slot solver behind partnerRing, for any ring: n things on n equal
 * slots of a ring of radius `ring` (slot 0 at `start`, default 180°), each class a regular
 * polygon — a class of one sits on a slot, a class of two is a diameter.
 * Exact when every class size divides n and the classes interleave.
 */
export const classRing = (classes: readonly string[], ring: number, start = Math.PI): { points: Vec2[]; exact: boolean } => {
  const n = classes.length
  if (n === 0) return { points: [], exact: true }
  const order: string[] = []
  for (const c of classes) if (!order.includes(c)) order.push(c)
  const size = (c: string) => classes.filter((x) => x === c).length
  // Largest first (the hexagons before the triangles), then data order.
  const keys = [...order].sort((a, b) => size(b) - size(a) || order.indexOf(a) - order.indexOf(b))
  const slotOf = new Map<string, number[]>()
  const used = new Array<boolean>(n).fill(false)
  const place = (i: number): boolean => {
    if (i === keys.length) return true
    const c = keys[i]!
    const k = size(c)
    if (n % k !== 0) return false
    const step = n / k
    for (let off = 0; off < step; off++) {
      const slots = Array.from({ length: k }, (_, j) => off + j * step)
      if (slots.some((x) => used[x])) continue
      for (const x of slots) used[x] = true
      slotOf.set(c, slots)
      if (place(i + 1)) return true
      for (const x of slots) used[x] = false
    }
    return false
  }
  let exact = place(0)
  if (!exact) {
    // No exact packing: each class, largest first, takes the free slots
    // nearest its own even spread.
    slotOf.clear()
    used.fill(false)
    for (const c of keys) {
      const k = size(c)
      const want = Array.from({ length: k }, (_, j) => Math.round((j * n) / k) % n)
      const got: number[] = []
      for (const w of want) {
        let best = -1
        for (let d = 0; d < n && best < 0; d++)
          for (const x of [(w + d) % n, (w - d + n) % n]) if (!used[x] && best < 0) best = x
        used[best] = true
        got.push(best)
      }
      slotOf.set(c, got)
    }
    exact = false
  }
  const next = new Map<string, number>()
  const points = classes.map((c) => {
    const i = next.get(c) ?? 0
    next.set(c, i + 1)
    const a = start + (2 * Math.PI * slotOf.get(c)![i]!) / n
    return { x: ring * Math.cos(a), y: ring * Math.sin(a) }
  })
  return { points, exact }
}

/**
 * A site focus's neighbours round the site, the WHOLE fiber symmetric
 * (David). Few (≤ `single`): ONE ring, each class its own regular polygon,
 * interleaved (classRing) — 3 neighbours an equilateral triangle, 4 a
 * square. Many: sites on an inner ring, partners on an outer, each turned so
 * the vertical is a mirror axis of both (odd counts point up, even counts sit
 * flat; two make a level diameter). Points in input order; `outer` is the
 * outermost ring's radius.
 */
export const fiberRings = (
  entities: readonly { cls: string; site: boolean }[],
  R: number,
  single = 12,
): { points: Vec2[]; outer: number } => {
  const start = (k: number) => Math.PI / 2 + (k > 0 && k % 2 === 0 ? Math.PI / k : 0)
  // Wide enough that neighbours never crowd: ~0.32 R of arc apiece.
  const radius = (k: number) => Math.max(R * 0.42, (k * R * 0.32) / (2 * Math.PI))
  const n = entities.length
  const sites = entities.filter((e) => e.site)
  const others = entities.filter((e) => !e.site)
  if (n <= single || sites.length === 0 || others.length === 0) {
    const ring = radius(n)
    return { points: classRing(entities.map((e) => e.cls), ring, start(n)).points, outer: ring }
  }
  const ri = radius(sites.length)
  const ro = Math.max(ri + R * 0.36, radius(others.length))
  const inner = classRing(sites.map((e) => e.cls), ri, start(sites.length)).points
  const outer = classRing(others.map((e) => e.cls), ro, start(others.length)).points
  let i = 0
  let o = 0
  return { points: entities.map((e) => (e.site ? inner[i++]! : outer[o++]!)), outer: ro }
}

/** The partners' seats on the ring (see partnerRing). */
export const partnerLayout = (classes: readonly string[], R: number): Vec2[] => partnerRing(classes, R).points

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

/**
 * A yaw for a symbol with a SPINDLE (a reel's axis — the axis it must not be
 * seen along): start from `base` (the channel's heading + the 3/4 offset)
 * and step out through small turns until the spindle, turned by the yaw
 * about y, sits at least `minAngle` off the view direction on the ground
 * plane (both as lines — either end of the spindle counts). The nearest
 * clear yaw wins; with no view on the ground (looking straight down) base
 * stands. Pure.
 */
export const clearYaw = (
  base: number,
  spindle: { x: number; z: number },
  view: { x: number; z: number },
  minAngle = (35 * Math.PI) / 180,
): number => {
  const vl = Math.hypot(view.x, view.z)
  const sl = Math.hypot(spindle.x, spindle.z)
  if (vl < 1e-6 || sl < 1e-6) return base
  const limit = Math.cos(minAngle)
  const along = (yaw: number) => {
    // Ry(yaw) applied to the spindle: (x cos + z sin, −x sin + z cos).
    const x = spindle.x * Math.cos(yaw) + spindle.z * Math.sin(yaw)
    const z = -spindle.x * Math.sin(yaw) + spindle.z * Math.cos(yaw)
    return Math.abs((x * view.x + z * view.z) / (vl * sl))
  }
  let best = base
  let bestCos = along(base)
  if (bestCos <= limit) return base
  for (let k = 1; k <= 8; k++) {
    for (const yaw of [base + k * 0.15, base - k * 0.15]) {
      const c = along(yaw)
      if (c <= limit) return yaw
      if (c < bestCos) {
        bestCos = c
        best = yaw
      }
    }
  }
  return best
}
