/**
 * Correspond — N curves becoming M curves, as pure geometry.
 *
 * geometry/morph.ts is one outline into one outline, index by index,
 * because that is what pydeation did and the corpus is scored against it.
 * This module is the general case David asked for (2026-10-13): "N
 * splines as input can turn into M other splines as output … if we have
 * many small splines we group them to fill some segment, and if we have
 * one long one it can be that other segment of the M target splines."
 * Many connection lines across a map become ONE circle — each line a
 * complementary piece of the circumference, not all of them on top of
 * each other. One circle becomes the thirty-odd visible edges of a truck.
 *
 *
 * THE MODEL: TWO TAPES
 *
 * Lay the sources end to end into one tape, and the targets end to end
 * into another. Normalise both to length 1. A correspondence is then
 * nothing but a MONOTONE MAP from one tape to the other — and the honest
 * one is the identity (plus, for a cyclic ordering, a rotation offset):
 * the point 37% of the way along the sources lands 37% of the way along
 * the targets. Cut both tapes at the UNION of their curve boundaries and
 * every piece lies inside exactly one source curve and exactly one target
 * curve. That is the whole partition:
 *
 *   - a source that is 8% of the source ink becomes 8% of the target ink
 *     (length is preserved up to the one global scale between the
 *     totals — the only scale there can honestly be);
 *   - many small sources GROUP into one long target; one long source
 *     SPLITS across several short targets; both happen in the same
 *     morph without either being special-cased;
 *   - at most N + M − 1 pieces (N + M with a rotation), and every target
 *     is covered exactly once — complementary, never stacked.
 *
 * What remains is a choice of ORDER (which curve goes where on each
 * tape, and which way round it runs). That is the strategy:
 *
 *   "nearest"  (default) each source laid on the target tape where its
 *              share lies nearest it (a min-travel assignment over the
 *              angular target tape, see nearestSlots), then the same
 *              rotation search. Scattered lines each land on the part of
 *              the circle nearest them — arcs that all converge on one
 *              place (a group's relations, an Earth's connections) no
 *              longer cross on their way. Judged against "angular" by
 *              crossed paths, then travel; where angular is as good (the
 *              shapes ring one centre) the result IS angular's.
 *   "angular"  curves sorted by the angle of their midpoint
 *              about the common centre, read in a plane (the view plane
 *              when a normal is given), each oriented to sweep counter-
 *              clockwise; then the target tape is ROTATED to the offset
 *              that minimises total travel. Arcs on the left land on the
 *              left of the circle; the circle's pieces fly outward to the
 *              truck's edges in the direction they already face. This is
 *              what keeps pieces from crossing.
 *   "sweep"    sorted by midpoint projection onto an axis, oriented
 *              along it — a left-to-right reading, no rotation.
 *   "sweep-angular"  two stages: "sweep" decides WHICH share of the
 *              source ink each target gets (lengths exactly as "sweep"),
 *              then each target gathers its share "angular"-ly about
 *              itself, with its own best rotation. Many curves into a
 *              row of shapes (a symbol into the letters of its word):
 *              the left of the symbol becomes the first letter, and each
 *              letter closes around itself without its pieces crossing.
 *   "given"    the caller's order and the curves' own directions,
 *              untouched — order-preserving along a path (a route's legs
 *              becoming a route's legs).
 *
 * And one knob for the length/piece-count trade-off:
 *
 *   snap       a fraction of the tape. A target boundary that falls
 *              within `snap` of a source boundary moves onto it, so a
 *              source is not shaved into a sliver to fill a target
 *              exactly — it is GROUPED whole. 0 (default) is exact length
 *              proportion; larger values trade length fidelity for fewer,
 *              whole pieces.
 *
 *
 * INTERPOLATION
 *
 * Each piece is a sub-polyline of its source and of its target, both
 * walked by arc length over a common parameter whose breakpoints are the
 * UNION of both sides' own vertices (plus a uniform fill). So u = 0 is
 * the sources exactly, corner for corner, and u = 1 is the targets
 * exactly — a morph must start where the shapes are and land where they
 * are, to the pixel, or the handover pops. In between, each point travels
 * a straight line in 3D. Everything is world-space 3D; nothing here knows
 * or cares that most scenes happen to be flat.
 *
 * Pure: `planMorph` is a function of the curves and the options, and
 * `blendPlan` a function of the plan and u. Deterministic — no random
 * numbers, no hash-order iteration, ties broken by index.
 */

import type { Vec3Like } from "../parts/primitives"

/** A curve: a polyline in 3D. A closed curve ends on its first point. */
export type Curve = readonly Vec3Like[]

export type CorrespondOrder = "angular" | "sweep" | "sweep-angular" | "nearest" | "given"

export interface CorrespondOptions {
  /** How curves are ordered on each tape. Default "nearest" (which falls back to "angular" where that crosses no more paths). */
  order?: CorrespondOrder
  /**
   * The plane "angular" reads angles in, as its normal — pass the
   * direction toward the camera so pieces sort as they are SEEN. Default
   * +Z (the flat scene's view).
   */
  normal?: Vec3Like
  /** The direction "sweep" reads along. Default +X. */
  axis?: Vec3Like
  /** Snap target boundaries onto source boundaries within this tape fraction. Default 0. */
  snap?: number
  /**
   * Search the target tape's rotation offset for least travel. Default
   * true for "angular" (a cyclic order has no natural start), false
   * otherwise.
   */
  rotate?: boolean
}

/**
 * One piece of a correspondence: the arc-length interval [from0 → from1]
 * of source curve `source` becomes [to0 → to1] of target curve `target`.
 * An interval may run BACKWARD (from0 > from1) — that is how a curve's
 * orientation is carried without copying it reversed.
 */
export interface MorphPiece {
  source: number
  from: readonly [number, number]
  target: number
  to: readonly [number, number]
}

export interface Correspondence {
  pieces: MorphPiece[]
  /** The target tape's rotation against the source tape, in [0, 1). */
  offset: number
  /** Mean squared travel at the chosen offset (diagnostic). */
  cost: number
}

// ─── Arc length ─────────────────────────────────────────────────────

const sub = (a: Vec3Like, b: Vec3Like): Vec3Like => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a: Vec3Like, b: Vec3Like): number => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec3Like, b: Vec3Like): Vec3Like => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const norm = (a: Vec3Like): Vec3Like => {
  const l = Math.hypot(a.x, a.y, a.z) || 1
  return { x: a.x / l, y: a.y / l, z: a.z / l }
}
const dist2 = (a: Vec3Like, b: Vec3Like): number =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2

/** Cumulative arc length: out[i] = distance along the curve to point i. */
export const cumulative = (c: Curve): number[] => {
  const out = [0]
  for (let i = 1; i < c.length; i++) out.push(out[i - 1]! + Math.sqrt(dist2(c[i - 1]!, c[i]!)))
  return out
}

/** The point at arc length `s` (clamped) along a curve with cumulative `cum`. */
export const pointAt = (c: Curve, cum: readonly number[], s: number): Vec3Like => {
  if (c.length === 0) return { x: 0, y: 0, z: 0 }
  const total = cum[cum.length - 1]!
  if (c.length === 1 || total <= 0) return c[0]!
  const t = Math.min(total, Math.max(0, s))
  let lo = 0
  let hi = cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid]! <= t) lo = mid
    else hi = mid
  }
  const span = cum[hi]! - cum[lo]!
  const u = span > 0 ? (t - cum[lo]!) / span : 0
  const a = c[lo]!
  const b = c[hi]!
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u }
}

// ─── Ordering ───────────────────────────────────────────────────────

/** A curve's place on its tape: its index, direction, and weight. */
interface Slot {
  index: number
  reversed: boolean
  length: number
}

/** The arc-length-weighted centre of a set of curves (vertex mean if all are points). */
const centreOf = (curves: readonly Curve[]): Vec3Like => {
  let wx = 0
  let wy = 0
  let wz = 0
  let w = 0
  for (const c of curves) {
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1]!
      const b = c[i]!
      const l = Math.sqrt(dist2(a, b))
      wx += ((a.x + b.x) / 2) * l
      wy += ((a.y + b.y) / 2) * l
      wz += ((a.z + b.z) / 2) * l
      w += l
    }
  }
  if (w > 0) return { x: wx / w, y: wy / w, z: wz / w }
  const pts = curves.flat()
  if (!pts.length) return { x: 0, y: 0, z: 0 }
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    z: pts.reduce((s, p) => s + p.z, 0) / pts.length,
  }
}

/** An orthonormal basis (e1, e2) of the plane with this normal. */
const planeBasis = (normal: Vec3Like): [Vec3Like, Vec3Like] => {
  const n = norm(normal)
  // Prefer world +Y as the plane's "up" so a flat XY scene keeps its own
  // axes (e1 = +X, e2 = +Y for n = +Z); fall back when n is near ±Y.
  const up = Math.abs(n.y) < 0.99 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: -1 }
  const e1 = norm(cross(up, n))
  const e2 = cross(n, e1)
  return [e1, e2]
}

/**
 * Order and orient one side's curves. Returns tape slots in tape order.
 * The mid-key is circular for "angular" (a cyclic order) and linear for
 * "sweep"; ties break by index, so the result is deterministic.
 */
const orderCurves = (
  curves: readonly Curve[],
  lengths: readonly number[],
  order: CorrespondOrder,
  centre: Vec3Like,
  basis: [Vec3Like, Vec3Like],
  axis: Vec3Like,
): Slot[] => {
  if (order === "given") return curves.map((_, i) => ({ index: i, reversed: false, length: lengths[i]! }))
  const keyed = curves.map((c, i) => {
    if (order === "sweep") {
      const a = dot(c[0] ?? centre, axis)
      const b = dot(c[c.length - 1] ?? centre, axis)
      const cum = cumulative(c)
      const mid = dot(pointAt(c, cum, cum[cum.length - 1]! / 2), axis)
      return { index: i, reversed: b < a, key: mid }
    }
    // angular: unwrap the angle along the curve, measure its sweep.
    const ang = (p: Vec3Like) => {
      const d = sub(p, centre)
      return Math.atan2(dot(d, basis[1]), dot(d, basis[0]))
    }
    let prev = c.length ? ang(c[0]!) : 0
    const start = prev
    let unwrapped = prev
    const cum = cumulative(c)
    const half = cum[cum.length - 1]! / 2
    let midAngle = start
    let midSet = false
    for (let k = 1; k < c.length; k++) {
      const a = ang(c[k]!)
      let d = a - prev
      if (d > Math.PI) d -= 2 * Math.PI
      if (d < -Math.PI) d += 2 * Math.PI
      const before = unwrapped
      unwrapped += d
      prev = a
      if (!midSet && cum[k]! >= half) {
        const span = cum[k]! - cum[k - 1]!
        const f = span > 0 ? (half - cum[k - 1]!) / span : 0
        midAngle = before + d * f
        midSet = true
      }
    }
    const sweep = unwrapped - start
    const reversed = sweep < -1e-9
    const key = ((midAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    return { index: i, reversed, key }
  })
  keyed.sort((a, b) => a.key - b.key || a.index - b.index)
  return keyed.map(({ index, reversed }) => ({ index, reversed, length: lengths[index]! }))
}

/**
 * "nearest": the source curves laid on the tape so each one's share of the
 * (angularly ordered) target tape lies as near it as the shares allow —
 * scattered lines each land on the part of the circle nearest them, not
 * on the part their angle round the common centre happens to point at.
 *
 * The cost of an order is, per source, its share's weight × (its ink's
 * centre to the share's centre² + its ends to the share's ends², the
 * cheaper orientation). Searched from two seeds — each source at its
 * nearest tape position, and the angular order — by swapping neighbours
 * while any swap is cheaper (variable-width shares on a cycle are not a
 * plain matching problem; this local search is O(n) a pass). The tape's rotation is scanned with each
 * order and searched again, finely, by the caller.
 */
const nearestSlots = (
  curves: readonly Curve[],
  lengths: readonly number[],
  tgtAt: (u: number) => Vec3Like,
  /** Another order to start from (the angular one); the cheaper result wins. */
  seed?: readonly number[],
): Slot[] => {
  const n = curves.length
  const total = lengths.reduce((a, b) => a + b, 0)
  const w = lengths.map((l) => (total > 0 ? l / total : 1 / n))
  const cums = curves.map(cumulative)
  const cen = curves.map((c, i) => pointAt(c, cums[i]!, lengths[i]! / 2))
  const mid = curves.map((c) => centreOf([c]))
  const head = curves.map((c) => c[0]!)
  const tail = curves.map((c) => c[c.length - 1]!)
  // The target tape, sampled; prefix sums give any interval's centre in O(1).
  const F = 1024
  const table = Array.from({ length: F }, (_, j) => tgtAt((j + 0.5) / F))
  const px = [0]
  const py = [0]
  const pz = [0]
  for (let j = 0; j < 2 * F; j++) {
    const q = table[j % F]!
    px.push(px[j]! + q.x)
    py.push(py[j]! + q.y)
    pz.push(pz[j]! + q.z)
  }
  const at = (u: number) => table[Math.min(F - 1, Math.floor(mod1(u) * F))]!
  const meanOn = (u0: number, wd: number): Vec3Like => {
    const a = Math.floor(mod1(u0) * F)
    const k = Math.min(F, Math.max(1, Math.round(wd * F)))
    return { x: (px[a + k]! - px[a]!) / k, y: (py[a + k]! - py[a]!) / k, z: (pz[a + k]! - pz[a]!) / k }
  }
  const pieceCost = (i: number, u0: number): number => {
    const wd = w[i]!
    const m = meanOn(u0, wd)
    const A = at(u0)
    const B = at(u0 + wd)
    const ends = Math.min(dist2(head[i]!, A) + dist2(tail[i]!, B), dist2(tail[i]!, A) + dist2(head[i]!, B))
    // Judged by where the ink is (its mass centre) and by its middle: a
    // long bent arc is not only its chord's midpoint.
    return wd * (dist2(mid[i]!, m) + dist2(cen[i]!, m) + ends / 2)
  }
  const costOf = (order: readonly number[], delta: number): number => {
    let c = 0
    let u = delta
    for (const i of order) {
      c += pieceCost(i, u)
      u += w[i]!
    }
    return c
  }
  // The rotation: a coarse scan, then a fine one around its best.
  const bestDelta = (order: readonly number[]): [number, number] => {
    let best = 0
    let bestC = Infinity
    const scan = (from: number, to: number, step: number) => {
      const centre = best
      for (let j = from; j <= to; j += step) {
        const d = mod1(centre + j / F)
        const c = costOf(order, d)
        if (c < bestC - 1e-12) {
          bestC = c
          best = d
        }
      }
    }
    scan(0, F - 16, 16)
    scan(-14, 14, 2)
    return [best, bestC]
  }
  // Each source's nearest place on the tape.
  const pref = mid.map((c) => {
    let best = 0
    let bd = Infinity
    for (let j = 0; j < F; j++) {
      const d = dist2(c, table[j]!)
      if (d < bd) {
        bd = d
        best = j
      }
    }
    return best / F
  })
  // Improve by swapping neighbours on the tape while any swap is cheaper —
  // each swap re-costs only its two pieces, so a pass is O(n).
  const improve = (start: readonly number[]): [number[], number, number] => {
    const order = [...start]
    let [delta, cost] = bestDelta(order)
    for (let pass = 0; pass < 8; pass++) {
      let improved = false
      let u = delta
      for (let k = 0; k + 1 < n; k++) {
        const a = order[k]!
        const b = order[k + 1]!
        const before = pieceCost(a, u) + pieceCost(b, u + w[a]!)
        const after = pieceCost(b, u) + pieceCost(a, u + w[b]!)
        if (after < before - 1e-12 * Math.max(1, before)) {
          order[k] = b
          order[k + 1] = a
          improved = true
        }
        u += w[order[k]!]!
      }
      ;[delta, cost] = bestDelta(order)
      if (!improved) break
    }
    return [order, delta, cost]
  }
  const candidates = [improve([...Array(n).keys()].sort((a, b) => pref[a]! - pref[b]! || a - b))]
  if (seed && seed.length === n) candidates.push(improve(seed))
  const [order, delta] = candidates.reduce((a, b) => (b[2] < a[2] - 1e-9 * Math.max(1, a[2]) ? b : a))
  // Each curve oriented so its start meets its share's start.
  const slots: Slot[] = []
  let u = delta
  for (const i of order) {
    const A = at(u)
    const B = at(u + w[i]!)
    const reversed = dist2(tail[i]!, A) + dist2(head[i]!, B) < dist2(head[i]!, A) + dist2(tail[i]!, B) - 1e-12
    slots.push({ index: i, reversed, length: lengths[i]! })
    u += w[i]!
  }
  return slots
}

// ─── The tapes ──────────────────────────────────────────────────────

/** Normalised boundaries of a tape: b[0] = 0 … b[n] = 1. */
const tapeBounds = (slots: readonly Slot[]): number[] => {
  const total = slots.reduce((s, x) => s + x.length, 0)
  const out = [0]
  let acc = 0
  for (const s of slots) {
    acc += total > 0 ? s.length / total : 1 / slots.length
    out.push(acc)
  }
  out[out.length - 1] = 1
  return out
}

/** Which slot a tape position u ∈ [0, 1) falls in. */
const slotAt = (bounds: readonly number[], u: number): number => {
  let lo = 0
  let hi = bounds.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (bounds[mid]! <= u) lo = mid
    else hi = mid
  }
  return lo
}

/** Arc length along the real curve for a tape position inside slot k. */
const arcOf = (slot: Slot, bounds: readonly number[], k: number, u: number): number => {
  const w = bounds[k + 1]! - bounds[k]!
  const f = w > 0 ? Math.min(1, Math.max(0, (u - bounds[k]!) / w)) : 0
  const s = f * slot.length
  return slot.reversed ? slot.length - s : s
}

/** A tape as a sampler: position u ∈ [0, 1] → point. */
const tapeSampler = (curves: readonly Curve[], slots: readonly Slot[], bounds: readonly number[]) => {
  const cums = curves.map(cumulative)
  return (u: number): Vec3Like => {
    const uu = Math.min(1 - 1e-12, Math.max(0, u))
    const k = slotAt(bounds, uu)
    const slot = slots[k]!
    return pointAt(curves[slot.index]!, cums[slot.index]!, arcOf(slot, bounds, k, uu))
  }
}

const mod1 = (u: number): number => ((u % 1) + 1) % 1

/**
 * The correspondence between N source curves and M target curves.
 * Empty on either side yields no pieces. See the header for the model.
 */
export const correspond = (
  sources: readonly Curve[],
  targets: readonly Curve[],
  opts: CorrespondOptions = {},
): Correspondence => {
  if (opts.order === "sweep-angular") return sweepThenGather(sources, targets, opts)
  // One source curve has one place on the tape — nearest IS angular.
  const one = sources.filter((c) => c.length > 0).length <= 1
  if ((opts.order ?? "nearest") === "nearest" && one) return correspondTapes(sources, targets, { ...opts, order: "angular" })
  if ((opts.order ?? "nearest") === "nearest") {
    // Never worse than the angular order it refines: both are planned and
    // judged by what the eye reads — paths that CROSS first, travel second.
    // Where the shapes ring one centre the two agree and angular stands;
    // where they do not (arcs converging on one place), the nearest
    // assignment uncrosses them.
    const near = correspondTapes(sources, targets, { ...opts, order: "nearest" })
    const ang = correspondTapes(sources, targets, { ...opts, order: "angular" })
    const xn = crossingsOf(near, sources, targets, opts.normal)
    const xa = crossingsOf(ang, sources, targets, opts.normal)
    return xn < xa || (xn === xa && near.cost < ang.cost * 0.98) ? near : ang
  }
  return correspondTapes(sources, targets, opts)
}

/**
 * How many pieces' paths cross, as seen along `normal`: each piece drawn as
 * the straight segment from its source middle to its target middle.
 */
export const crossingsOf = (
  c: Correspondence,
  sources: readonly Curve[],
  targets: readonly Curve[],
  normal: Vec3Like = { x: 0, y: 0, z: 1 },
): number => {
  const [e1, e2] = planeBasis(normal)
  const sCum = sources.map(cumulative)
  const tCum = targets.map(cumulative)
  const flat = (p: Vec3Like): [number, number] => [dot(p, e1), dot(p, e2)]
  const segs = c.pieces.map((p) => [
    flat(pointAt(sources[p.source]!, sCum[p.source]!, (p.from[0] + p.from[1]) / 2)),
    flat(pointAt(targets[p.target]!, tCum[p.target]!, (p.to[0] + p.to[1]) / 2)),
  ])
  const side = (a: [number, number], b: [number, number], q: [number, number]) =>
    (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])
  let n = 0
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) {
      const [a, b] = segs[i]!
      const [p, q] = segs[j]!
      if (side(a!, b!, p!) * side(a!, b!, q!) < 0 && side(p!, q!, a!) * side(p!, q!, b!) < 0) n++
    }
  return n
}

const correspondTapes = (
  sources: readonly Curve[],
  targets: readonly Curve[],
  opts: CorrespondOptions,
): Correspondence => {
  const order = opts.order ?? "angular"
  const rotate = opts.rotate ?? (order === "angular" || order === "nearest")
  const snap = Math.max(0, opts.snap ?? 0)
  const src = sources.filter((c) => c.length > 0)
  const tgt = targets.filter((c) => c.length > 0)
  const srcIdx = sources.flatMap((c, i) => (c.length > 0 ? [i] : []))
  const tgtIdx = targets.flatMap((c, i) => (c.length > 0 ? [i] : []))
  if (!src.length || !tgt.length) return { pieces: [], offset: 0, cost: 0 }

  const srcLen = src.map((c) => cumulative(c).at(-1)!)
  const tgtLen = tgt.map((c) => cumulative(c).at(-1)!)
  const centre = centreOf([...src, ...tgt])
  const basis = planeBasis(opts.normal ?? { x: 0, y: 0, z: 1 })
  const axis = norm(opts.axis ?? { x: 1, y: 0, z: 0 })
  // A zero-length curve carries no ink, so it takes no share of the tape —
  // unless EVERY curve on that side is a point (a dot growing into a
  // shape), where each point takes an equal share instead.
  const keep = (lens: number[]) => (lens.some((l) => l > 0) ? (i: number) => lens[i]! > 0 : () => true)
  const keepS = keep(srcLen)
  const keepT = keep(tgtLen)
  const tSlots = orderCurves(tgt, tgtLen, order === "nearest" ? "angular" : order, centre, basis, axis).filter((s) => keepT(s.index))
  const T = tapeBounds(tSlots)
  const sSlots =
    order === "nearest"
      ? nearestSlots(
          src,
          srcLen,
          tapeSampler(tgt, tSlots, T),
          orderCurves(src, srcLen, "angular", centre, basis, axis).map((s) => s.index),
        ).filter((s) => keepS(s.index))
      : orderCurves(src, srcLen, order, centre, basis, axis).filter((s) => keepS(s.index))
  const S = tapeBounds(sSlots)

  // ROTATION — the offset δ such that source tape u meets target tape
  // u + δ. Scanned on a fine grid (cost Σ|src(u) − tgt(u+δ)|² over K
  // samples), then refined by a golden-section pass around the best cell.
  const srcAt = tapeSampler(src, sSlots, S)
  const tgtAt = tapeSampler(tgt, tSlots, T)
  const K = 128
  const costAt = (delta: number): number => {
    let c = 0
    for (let k = 0; k < K; k++) {
      const u = (k + 0.5) / K
      c += dist2(srcAt(u), tgtAt(mod1(u + delta)))
    }
    return c / K
  }
  let offset = 0
  let cost = costAt(0)
  if (rotate) {
    const F = 8 * K
    const table = Array.from({ length: F }, (_, j) => tgtAt((j + 0.5) / F))
    // Source sample k sits on table cell 8k, so table[(8k + j) % F] is the
    // target at exactly (source position + j/F).
    const srcSamples = Array.from({ length: K }, (_, k) => srcAt((8 * k + 0.5) / F))
    let best = 0
    let bestCost = Infinity
    for (let j = 0; j < F; j++) {
      let c = 0
      for (let k = 0; k < K; k++) c += dist2(srcSamples[k]!, table[(8 * k + j) % F]!)
      if (c < bestCost - 1e-9) {
        bestCost = c
        best = j
      }
    }
    // Golden-section refinement within ±1 grid cell.
    let a = best / F - 1 / F
    let b = best / F + 1 / F
    const g = (Math.sqrt(5) - 1) / 2
    for (let it = 0; it < 24; it++) {
      const c1 = b - g * (b - a)
      const c2 = a + g * (b - a)
      if (costAt(mod1(c1)) <= costAt(mod1(c2))) b = c2
      else a = c1
    }
    offset = mod1((a + b) / 2)
    cost = costAt(offset)
    if (cost > costAt(best / F)) {
      offset = best / F
      cost = costAt(offset)
    }
  }

  // BOUNDARIES in source-tape coordinates. Target boundary j sits at
  // T[j] − δ; unwrapped so the sequence stays increasing over one turn.
  const tb: number[] = []
  for (let j = 0; j < T.length - 1; j++) tb.push(T[j]! - offset)
  // SNAP: a target boundary within `snap` of a source boundary moves onto
  // it, provided the targets keep a strictly increasing order (no target
  // collapses to nothing).
  if (snap > 0) {
    for (let j = 0; j < tb.length; j++) {
      const b = tb[j]!
      let bestS = b
      let bestD = snap
      for (let k = 0; k < S.length; k++) {
        for (const n of [-1, 0, 1]) {
          const s = S[k]! + n
          const d = Math.abs(s - b)
          if (d < bestD) {
            bestD = d
            bestS = s
          }
        }
      }
      const prev = j > 0 ? tb[j - 1]! : tb[tb.length - 1]! - 1
      const next = j < tb.length - 1 ? tb[j + 1]! : tb[0]! + 1
      if (bestS > prev + 1e-9 && bestS < next - 1e-9) tb[j] = bestS
    }
  }
  const cuts = new Set<number>()
  for (const s of S.slice(0, -1)) cuts.add(s)
  for (const b of tb) cuts.add(mod1(b))
  const sorted = [...cuts].sort((a, b) => a - b)
  // Merge cuts that coincide to float noise — a sliver there is not a piece.
  const uniq: number[] = []
  for (const c of sorted) if (!uniq.length || c - uniq[uniq.length - 1]! > 1e-9) uniq.push(c)
  if (uniq.length && 1 - uniq[uniq.length - 1]! < 1e-9) uniq.pop()
  if (!uniq.length || uniq[0]! > 1e-9) uniq.unshift(0)

  // The target-tape coordinate of source-tape position u, honouring snaps:
  // piecewise linear between the (unwrapped) snapped boundaries.
  const tbFull = [...tb, tb[0]! + 1]
  const targetPos = (u: number): { k: number; t: number } => {
    // find j with tbFull[j] <= u' < tbFull[j+1], u' = u shifted into range
    let uu = u
    while (uu < tbFull[0]!) uu += 1
    while (uu >= tbFull[0]! + 1) uu -= 1
    let j = 0
    while (j < tbFull.length - 2 && tbFull[j + 1]! <= uu) j++
    const w = tbFull[j + 1]! - tbFull[j]!
    const f = w > 0 ? (uu - tbFull[j]!) / w : 0
    return { k: j, t: T[j]! + f * (T[j + 1]! - T[j]!) }
  }

  // Piece ends that should be exact curve ends land on exactly 0 / L, so
  // u = 0 and u = 1 reproduce endpoints bit-for-bit.
  const clean = (v: number, L: number) => {
    const e = 1e-9 * Math.max(1, L)
    return Math.abs(v) < e ? 0 : Math.abs(v - L) < e ? L : v
  }
  const pieces: MorphPiece[] = []
  for (let i = 0; i < uniq.length; i++) {
    const u0 = uniq[i]!
    const u1 = i + 1 < uniq.length ? uniq[i + 1]! : 1
    if (u1 - u0 <= 1e-12) continue
    const mid = (u0 + u1) / 2
    const ks = slotAt(S, mid)
    const sSlot = sSlots[ks]!
    const tMid = targetPos(mid)
    const kt = tMid.k
    const tSlot = tSlots[kt]!
    // End positions on the target tape, measured within the SAME target
    // slot (a piece never crosses a target boundary, by construction).
    const t0 = targetPos(u0 + 1e-12)
    const t1 = targetPos(u1 - 1e-12)
    const tStart = t0.k === kt ? t0.t : T[kt]!
    const tEnd = t1.k === kt ? t1.t : T[kt + 1]!
    const sL = sSlot.length
    const tL = tSlot.length
    pieces.push({
      source: srcIdx[sSlot.index]!,
      from: [clean(arcOf(sSlot, S, ks, u0), sL), clean(arcOf(sSlot, S, ks, u1), sL)],
      target: tgtIdx[tSlot.index]!,
      to: [
        clean(arcOf(tSlot, T, kt, Math.max(T[kt]!, tStart)), tL),
        clean(arcOf(tSlot, T, kt, Math.min(T[kt + 1]!, tEnd)), tL),
      ],
    })
  }
  return { pieces, offset, cost }
}

/** The sub-polyline of a curve between arc lengths a → b (b < a walks it backward). */
const subCurve = (c: Curve, cum: readonly number[], a: number, b: number): Vec3Like[] => {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const pts = [pointAt(c, cum, lo)]
  for (let i = 0; i < c.length; i++) if (cum[i]! > lo + 1e-9 && cum[i]! < hi - 1e-9) pts.push(c[i]!)
  pts.push(pointAt(c, cum, hi))
  return a <= b ? pts : pts.reverse()
}

/**
 * "sweep-angular": the sweep's shares, then each target gathering its own
 * share angularly (see CorrespondOrder). Every piece of the result still
 * lies inside one source curve and one target curve, and every target is
 * covered exactly once, so it is a correspondence like any other.
 */
const sweepThenGather = (
  sources: readonly Curve[],
  targets: readonly Curve[],
  opts: CorrespondOptions,
): Correspondence => {
  const first = correspond(sources, targets, { ...opts, order: "sweep" })
  const cums = sources.map(cumulative)
  const pieces: MorphPiece[] = []
  let cost = 0
  const byTarget = new Map<number, MorphPiece[]>()
  for (const p of first.pieces) byTarget.set(p.target, [...(byTarget.get(p.target) ?? []), p])
  for (const [t, share] of [...byTarget].sort((a, b) => a[0] - b[0])) {
    // The share as curves of its own, remembering where each came from.
    const subs = share.map((p) => subCurve(sources[p.source]!, cums[p.source]!, p.from[0], p.from[1]))
    const local = correspond(subs, [targets[t]!], { ...opts, order: "angular", rotate: true })
    cost += local.cost
    for (const q of local.pieces) {
      const origin = share[q.source]!
      // Arc length along the sub-curve → along the original source curve.
      const [a, b] = origin.from
      const dir = b >= a ? 1 : -1
      pieces.push({
        source: origin.source,
        from: [a + dir * q.from[0], a + dir * q.from[1]],
        target: t,
        to: q.to,
      })
    }
  }
  return { pieces: mergeContiguous(pieces), offset: first.offset, cost: byTarget.size ? cost / byTarget.size : 0 }
}

/**
 * Pieces that continue each other on BOTH sides — the same source curve,
 * the next stretch of it, onto the same target curve, the next stretch of
 * it — were one stroke all along: join them.
 */
const mergeContiguous = (pieces: MorphPiece[]): MorphPiece[] => {
  const out: MorphPiece[] = []
  const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
  for (const p of pieces) {
    const q = out[out.length - 1]
    if (
      q &&
      q.source === p.source &&
      q.target === p.target &&
      near(q.from[1], p.from[0]) &&
      near(q.to[1], p.to[0]) &&
      Math.sign(q.from[1] - q.from[0]) === Math.sign(p.from[1] - p.from[0]) &&
      Math.sign(q.to[1] - q.to[0]) === Math.sign(p.to[1] - p.to[0])
    ) {
      out[out.length - 1] = { ...q, from: [q.from[0], p.from[1]], to: [q.to[0], p.to[1]] }
      continue
    }
    out.push(p)
  }
  return out
}

// ─── The plan: pieces resampled pairwise ────────────────────────────

/** One piece, both ends resampled to the same count — ready to lerp. */
export interface PlannedPiece {
  source: number
  target: number
  from: Vec3Like[]
  to: Vec3Like[]
  /** Is the target end longer than the source end? (see blendPlan's lag) */
  grows: boolean
  /**
   * The piece as a RIGID body (see blendTravel): its two centroids, the
   * turn (radians, about the plan's normal) and scale that best carry the
   * source shape onto the target's, and what is left over — the residual
   * deformation, per point.
   */
  motion: { cs: Vec3Like; ct: Vec3Like; turn: number; scale: number; rel: Vec3Like[]; residual: Vec3Like[] }
  /**
   * A DETAIL with nothing to become (planMorphDetailed): "out" shrinks to
   * its own centre and fades early (`target` is −1); "in" grows from its
   * centre and fades in late (`source` is −1). Absent: an ordinary piece.
   */
  condense?: "out" | "in"
}

export interface MorphPlan {
  pieces: PlannedPiece[]
  /** The plane the travel turns in (its normal) and the plan's centre. */
  normal: Vec3Like
  centre: Vec3Like
  correspondence: Correspondence
}

export interface PlanOptions extends CorrespondOptions {
  /**
   * Uniform sample spacing, in world units, laid over each piece on top
   * of both sides' own vertices. Default: the longer tape / 400.
   */
  step?: number
}

/** The sub-polyline parameter breakpoints of [a → b] on a curve: its own vertices inside. */
const vertexBreaks = (cum: readonly number[], a: number, b: number): number[] => {
  const out: number[] = []
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const span = b - a
  if (Math.abs(span) < 1e-12) return out
  for (const s of cum) if (s > lo + 1e-9 && s < hi - 1e-9) out.push((s - a) / span)
  return out
}

/**
 * Resolve a correspondence into paired polylines. `planMorph` is the
 * expensive half (ordering, rotation search, cutting) and runs once per
 * input change; `blendPlan` is the per-frame half and is a lerp.
 */
export const planMorph = (
  sources: readonly Curve[],
  targets: readonly Curve[],
  opts: PlanOptions = {},
): MorphPlan => {
  const correspondence = correspond(sources, targets, opts)
  const sCum = sources.map(cumulative)
  const tCum = targets.map(cumulative)
  const totalS = sCum.reduce((s, c) => s + c.at(-1)!, 0)
  const totalT = tCum.reduce((s, c) => s + c.at(-1)!, 0)
  const step = opts.step ?? Math.max(totalS, totalT, 1e-6) / 400
  const n3 = norm(opts.normal ?? { x: 0, y: 0, z: 1 })
  const pieces = correspondence.pieces.map((p) => {
    const [a, b] = p.from
    const [c, d] = p.to
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b - a), Math.abs(d - c)) / step))
    const params = new Set<number>()
    for (let i = 0; i <= n; i++) params.add(i / n)
    for (const s of vertexBreaks(sCum[p.source]!, a, b)) params.add(s)
    for (const s of vertexBreaks(tCum[p.target]!, c, d)) params.add(s)
    const ss = [...params].sort((x, y) => x - y)
    const src = sources[p.source]!
    const tgt = targets[p.target]!
    const from = ss.map((s) => pointAt(src, sCum[p.source]!, a + (b - a) * s))
    const to = ss.map((s) => pointAt(tgt, tCum[p.target]!, c + (d - c) * s))
    return {
      source: p.source,
      target: p.target,
      from,
      to,
      grows: Math.abs(d - c) > Math.abs(b - a),
      motion: rigidFit(from, to, n3),
    }
  })
  const all = pieces.flatMap((q) => [q.motion.cs, q.motion.ct])
  const centre = all.length
    ? all.reduce((acc, q) => ({ x: acc.x + q.x / all.length, y: acc.y + q.y / all.length, z: acc.z + q.z / all.length }), { x: 0, y: 0, z: 0 })
    : { x: 0, y: 0, z: 0 }
  return { pieces, correspondence, normal: n3, centre }
}

/** Rotate v about the unit axis n by angle a (Rodrigues). */
const rotateAbout = (v: Vec3Like, n: Vec3Like, a: number): Vec3Like => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const k = dot(n, v) * (1 - c)
  const x = cross(n, v)
  return { x: v.x * c + x.x * s + n.x * k, y: v.y * c + x.y * s + n.y * k, z: v.z * c + x.z * s + n.z * k }
}

/**
 * The similarity (turn about n, uniform scale) that best carries a
 * piece's source points onto its target points, centroid to centroid
 * (2D Procrustes in the plane of n), and the residual it leaves.
 */
const rigidFit = (from: readonly Vec3Like[], to: readonly Vec3Like[], n: Vec3Like): PlannedPiece["motion"] => {
  const mean = (ps: readonly Vec3Like[]) =>
    ps.reduce((a, q) => ({ x: a.x + q.x / ps.length, y: a.y + q.y / ps.length, z: a.z + q.z / ps.length }), { x: 0, y: 0, z: 0 })
  const cs = mean(from)
  const ct = mean(to)
  const rel = from.map((q) => sub(q, cs))
  const relT = to.map((q) => sub(q, ct))
  const [e1, e2] = planeBasis(n)
  let d = 0
  let c = 0
  let ss = 0
  let tt = 0
  rel.forEach((q, i) => {
    const r = relT[i]!
    const xs = dot(q, e1)
    const ys = dot(q, e2)
    const xt = dot(r, e1)
    const yt = dot(r, e2)
    d += xs * xt + ys * yt
    c += xs * yt - ys * xt
    ss += dot(q, q)
    tt += dot(r, r)
  })
  // The turn is capped: a piece that would have to spin round to fit
  // (a mirrored match) tumbles, which reads as noise. Past ±60° the bend
  // does the rest — still exact at the end, since the residual is
  // measured against the capped pose.
  const fit = ss > 1e-12 && Math.hypot(c, d) > 1e-12 ? Math.atan2(c, d) : 0
  const turn = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, fit))
  // Growth is capped (×2): a letter that would fly at three times its
  // size to become a long edge reads as a giant glyph, not as a stroke
  // becoming an edge — it flies small and the bend grows it. Shrinking is
  // not: a truck's edge bound for a dot shrinks as it flies, so every
  // piece travels at its smaller size. Exact at the end either way.
  const scale = ss > 1e-12 && tt > 1e-12 ? Math.min(2, Math.max(1 / 50, Math.sqrt(tt / ss))) : 1
  const residual = to.map((q, i) => {
    const r = rotateAbout(rel[i]!, n, turn)
    return sub(q, { x: ct.x + r.x * scale, y: ct.y + r.y * scale, z: ct.z + r.z * scale })
  })
  return { cs, ct, turn, scale, rel, residual }
}

export interface TravelOptions {
  /**
   * Fraction of the morph over which piece starts are spread, in order of
   * `axis` (reading order for a word): 0 = all together. Default 0.
   */
  stagger?: number
  /** The direction the stagger reads along. Default the plane's first axis. */
  axis?: Vec3Like
  /** How far a piece's path bows, as a fraction of its length (away from the centre). Default 0.2. */
  arc?: number
  /** When, in a piece's own flight, it starts bending into its exact shape. Default 0.5. */
  bend?: number
  /** Translations for a relative plan's two ends. */
  offset?: { from: Vec3Like; to: Vec3Like }
}

/**
 * The morphed curves at completion u — RIGID THEN DEFORM. Each piece flies
 * as a body: its centroid along a gentle arc (bowing away from the plan's
 * centre, so neighbours fan out instead of crossing), turning and scaling
 * steadily toward its target's pose; only in the last part of its flight
 * (`bend`) does it bend from that pose into its exact target shape. A
 * piece is a contiguous stretch of a curve, so it stays one polyline the
 * whole way. With `stagger`, pieces leave one after another along `axis`.
 * Exact at both ends: u = 0 is the sources, u = 1 the targets, point for
 * point — so the handover to the real shapes cannot be seen.
 */
export const blendTravel = (plan: MorphPlan, u: number, opts: TravelOptions = {}): Vec3Like[][] => {
  const t = Math.min(1, Math.max(0, u))
  const stagger = Math.min(0.9, Math.max(0, opts.stagger ?? 0))
  const arc = opts.arc ?? 0.2
  const bend = Math.min(0.99, Math.max(0, opts.bend ?? 0.5))
  const n = norm(plan.normal)
  const of = opts.offset?.from ?? { x: 0, y: 0, z: 0 }
  const ot = opts.offset?.to ?? { x: 0, y: 0, z: 0 }
  const add = (a: Vec3Like, b: Vec3Like): Vec3Like => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
  const centre = add(plan.centre, { x: (of.x + ot.x) / 2, y: (of.y + ot.y) / 2, z: (of.z + ot.z) / 2 })
  const axis = norm(opts.axis ?? planeBasis(n)[0])
  const keys = plan.pieces.map((p) => dot(add(p.motion.ct, ot), axis))
  const lo = Math.min(...keys)
  const hi = Math.max(...keys)
  const smooth = (e0: number, e1: number, x: number) => {
    const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
    return k * k * (3 - 2 * k)
  }
  return plan.pieces.map((p, i) => {
    const k = hi > lo ? (keys[i]! - lo) / (hi - lo) : 0
    const e = stagger > 0 ? Math.min(1, Math.max(0, (t - k * stagger) / (1 - stagger))) : t
    if (e <= 0) return p.from.map((q) => add(q, of))
    if (e >= 1) return p.to.map((q) => add(q, ot))
    if (p.condense) {
      // A detail that does not fly: it condenses where it is.
      const c = p.condense === "out" ? add(p.motion.cs, of) : add(p.motion.ct, ot)
      const pts = p.condense === "out" ? p.from.map((q) => add(q, of)) : p.to.map((q) => add(q, ot))
      const k = p.condense === "out" ? 1 - smooth(0, 0.6, e) : smooth(0.4, 1, e)
      return pts.map((q) => ({ x: c.x + (q.x - c.x) * k, y: c.y + (q.y - c.y) * k, z: c.z + (q.z - c.z) * k }))
    }
    const { rel, residual, turn, scale } = p.motion
    const cs = add(p.motion.cs, of)
    const ct = add(p.motion.ct, ot)
    // The centroid's path: a quadratic arc bowing away from the centre.
    const mid = { x: (cs.x + ct.x) / 2, y: (cs.y + ct.y) / 2, z: (cs.z + ct.z) / 2 }
    const chord = sub(ct, cs)
    let bow = cross(n, chord)
    const bl = Math.hypot(bow.x, bow.y, bow.z)
    if (bl > 1e-12) {
      const k2 = (arc * Math.hypot(chord.x, chord.y, chord.z)) / bl
      bow = { x: bow.x * k2, y: bow.y * k2, z: bow.z * k2 }
      if (dot(bow, sub(mid, centre)) < 0) bow = { x: -bow.x, y: -bow.y, z: -bow.z }
    }
    const ctrl = add(mid, bow)
    const a = (1 - e) * (1 - e)
    const b2 = 2 * (1 - e) * e
    const c2 = e * e
    const c = { x: a * cs.x + b2 * ctrl.x + c2 * ct.x, y: a * cs.y + b2 * ctrl.y + c2 * ct.y, z: a * cs.z + b2 * ctrl.z + c2 * ct.z }
    const sc = Math.pow(scale, e)
    const w = smooth(bend, 1, e)
    return rel.map((r, j) => {
      const q = rotateAbout(r, n, turn * e)
      const d = residual[j]!
      return { x: c.x + q.x * sc + d.x * w, y: c.y + q.y * sc + d.y * w, z: c.z + q.z * sc + d.z * w }
    })
  })
}

/**
 * A plan with no partition at all: curve i becomes curve i, point for
 * point (the two must have the same number of points). For a morph that
 * is a deformation of ONE drawing rather than a re-drawing — a symbol
 * squashed flat onto its baseline, and stood up again.
 */
export const planPairwise = (sources: readonly Curve[], targets: readonly Curve[], normal?: Vec3Like): MorphPlan => {
  const n3 = norm(normal ?? { x: 0, y: 0, z: 1 })
  const pieces: PlannedPiece[] = []
  sources.forEach((c, i) => {
    const t = targets[i]
    if (!t || t.length !== c.length || c.length < 2) return
    const from = [...c]
    const to = [...t]
    pieces.push({ source: i, target: i, from, to, grows: false, motion: rigidFit(from, to, n3) })
  })
  const all = pieces.flatMap((q) => [q.motion.cs, q.motion.ct])
  const centre = all.length
    ? all.reduce((a, q) => ({ x: a.x + q.x / all.length, y: a.y + q.y / all.length, z: a.z + q.z / all.length }), { x: 0, y: 0, z: 0 })
    : { x: 0, y: 0, z: 0 }
  return { pieces, correspondence: { pieces: [], offset: 0, cost: 0 }, normal: n3, centre }
}

/**
 * Each piece's opacity at u: 1 for a piece that flies; a condensing detail
 * fades out early ("out") or in late ("in"), with the same stagger.
 */
export const pieceAlphas = (plan: MorphPlan, u: number, opts: TravelOptions = {}): number[] => {
  const t = Math.min(1, Math.max(0, u))
  const stagger = Math.min(0.9, Math.max(0, opts.stagger ?? 0))
  const n = norm(plan.normal)
  const axis = norm(opts.axis ?? planeBasis(n)[0])
  const keys = plan.pieces.map((p) => dot(p.motion.ct, axis))
  const lo = Math.min(...keys)
  const hi = Math.max(...keys)
  const smooth = (e0: number, e1: number, x: number) => {
    const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
    return k * k * (3 - 2 * k)
  }
  return plan.pieces.map((p, i) => {
    if (!p.condense) return 1
    const k = hi > lo ? (keys[i]! - lo) / (hi - lo) : 0
    const e = stagger > 0 ? Math.min(1, Math.max(0, (t - k * stagger) / (1 - stagger))) : t
    return p.condense === "out" ? 1 - smooth(0.1, 0.6, e) : smooth(0.4, 0.9, e)
  })
}

/**
 * Plan with DETAILS. On each side, a closed curve shorter than `minor` ×
 * that side's longest curve is a detail (a wheel, a hub, a window; an
 * i's dot, a small counter). The large curves correspond as usual; details
 * pair up in order along `axis`, each pair a whole closed curve flying
 * onto another; the details left over CONDENSE — a source's shrinks to
 * its centre and fades, a target's grows from its centre — rather than
 * being shredded into fragments of strokes they have nothing to do with.
 * `minor` 0 (default) is planMorph unchanged.
 */
export const planMorphDetailed = (
  sources: readonly Curve[],
  targets: readonly Curve[],
  opts: PlanOptions & { minor?: number } = {},
): MorphPlan => {
  const minor = opts.minor ?? 0
  if (minor <= 0) return planMorph(sources, targets, opts)
  const isClosed = (c: Curve) => c.length > 3 && Math.sqrt(dist2(c[0]!, c[c.length - 1]!)) <= 1e-9
  const lens = (cs: readonly Curve[]) => cs.map((c) => cumulative(c).at(-1)!)
  const split = (cs: readonly Curve[]) => {
    const L = lens(cs)
    const max = Math.max(0, ...L)
    const major: number[] = []
    const small: number[] = []
    cs.forEach((c, i) => (isClosed(c) && L[i]! < minor * max ? small : major).push(i))
    return { major, small }
  }
  const S = split(sources)
  const T = split(targets)
  const n3 = norm(opts.normal ?? { x: 0, y: 0, z: 1 })
  const axis = norm(opts.axis ?? planeBasis(n3)[0])
  const base = planMorph(
    S.major.map((i) => sources[i]!),
    T.major.map((j) => targets[j]!),
    opts,
  )
  const pieces: PlannedPiece[] = base.pieces.map((p) => ({ ...p, source: S.major[p.source]!, target: T.major[p.target]! }))
  const centroid = (c: Curve) => c.reduce((a, q) => ({ x: a.x + q.x / c.length, y: a.y + q.y / c.length, z: a.z + q.z / c.length }), { x: 0, y: 0, z: 0 })
  const byAxis = (cs: readonly Curve[], ids: number[]) => [...ids].sort((a, b) => dot(centroid(cs[a]!), axis) - dot(centroid(cs[b]!), axis) || a - b)
  const sm = byAxis(sources, S.small)
  const tm = byAxis(targets, T.small)
  const pairs = Math.min(sm.length, tm.length)
  // Spread the pairing evenly when one side has more details than the
  // other, so the leftovers are spread too, not bunched at one end.
  const pick = (ids: number[], k: number) => ids[Math.floor(((k + 0.5) * ids.length) / pairs)]!
  const usedS = new Set<number>()
  const usedT = new Set<number>()
  for (let k = 0; k < pairs; k++) {
    const si = sm.length > tm.length ? pick(sm, k) : sm[k]!
    const ti = tm.length > sm.length ? pick(tm, k) : tm[k]!
    usedS.add(si)
    usedT.add(ti)
    const one = planMorph([sources[si]!], [targets[ti]!], { ...opts, order: "angular", rotate: true, snap: 0 })
    for (const p of one.pieces) pieces.push({ ...p, source: si, target: ti })
  }
  const still = (c: Curve, ctr: Vec3Like) => c.map(() => ({ ...ctr }))
  for (const si of sm) {
    if (usedS.has(si)) continue
    const c = [...sources[si]!]
    const ctr = centroid(c)
    const to = still(c, ctr)
    pieces.push({ source: si, target: -1, from: c, to, grows: false, motion: rigidFit(c, to, n3), condense: "out" })
  }
  for (const ti of tm) {
    if (usedT.has(ti)) continue
    const c = [...targets[ti]!]
    const ctr = centroid(c)
    const from = still(c, ctr)
    pieces.push({ source: -1, target: ti, from, to: c, grows: true, motion: rigidFit(from, c, n3), condense: "in" })
  }
  const all = pieces.flatMap((q) => [q.motion.cs, q.motion.ct])
  const centre = all.reduce((a, q) => ({ x: a.x + q.x / all.length, y: a.y + q.y / all.length, z: a.z + q.z / all.length }), { x: 0, y: 0, z: 0 })
  return { pieces, correspondence: base.correspondence, normal: n3, centre }
}

/**
 * Join curves that meet end to end into longer ones — the truck's edges
 * meet at its corners, and a morph of a few long strokes reads calmer than
 * one of many short ones. Greedy and deterministic: from each unused curve
 * in index order, extend at either end by the curve whose end lies within
 * `tol` and turns least. Closed curves stay as they are. `members` says
 * which input curves each output curve is made of, in order.
 */
export const chainCurves = (curves: readonly Curve[], tol: number): { curves: Vec3Like[][]; members: number[][] } => {
  const closed = (c: Curve) => c.length > 3 && Math.sqrt(dist2(c[0]!, c[c.length - 1]!)) <= 1e-9
  const used = new Set<number>()
  const out: Vec3Like[][] = []
  const members: number[][] = []
  const dir = (a: Vec3Like, b: Vec3Like) => norm(sub(b, a))
  for (let i = 0; i < curves.length; i++) {
    if (used.has(i)) continue
    used.add(i)
    let chain = [...curves[i]!]
    const m = [i]
    if (chain.length < 2 || closed(chain)) {
      out.push(chain)
      members.push(m)
      continue
    }
    for (const atEnd of [true, false]) {
      for (;;) {
        const tip = atEnd ? chain[chain.length - 1]! : chain[0]!
        const prev = atEnd ? chain[chain.length - 2]! : chain[1]!
        const heading = dir(prev, tip)
        let best = -1
        let bestRev = false
        let bestTurn = -Infinity
        for (let j = 0; j < curves.length; j++) {
          if (used.has(j)) continue
          const c = curves[j]!
          if (c.length < 2 || closed(c)) continue
          for (const rev of [false, true]) {
            const start = rev ? c[c.length - 1]! : c[0]!
            const next = rev ? c[c.length - 2]! : c[1]!
            if (Math.sqrt(dist2(start, tip)) > tol) continue
            // Both directions point outward from the tip, at either end.
            const straight = dot(heading, dir(start, next))
            if (straight > bestTurn + 1e-12) {
              bestTurn = straight
              best = j
              bestRev = rev
            }
          }
        }
        if (best < 0) break
        used.add(best)
        const c = bestRev ? [...curves[best]!].reverse() : [...curves[best]!]
        if (atEnd) {
          chain = [...chain, ...c.slice(1)]
          m.push(best)
        } else {
          chain = [...[...c].reverse().slice(0, -1), ...chain]
          m.unshift(best)
        }
      }
    }
    out.push(chain)
    members.push(m)
  }
  return { curves: out, members }
}

/**
 * The morphed curves at completion u ∈ [0, 1]: one polyline per piece.
 *
 * `lag` ∈ [0, 1] separates a piece's JOURNEY from its BECOMING: its
 * centroid travels with u, but its shape (the points about that centroid)
 * changes on a curve of its own, so that EVERY PIECE TRAVELS AT ITS
 * SMALLER SIZE. A piece that grows (an arc of the dot becoming a truck's
 * edge) keeps its old shape for the journey and becomes its target on
 * arrival — u^(1 + 3·lag); a piece that shrinks takes its small new shape
 * first and then travels — 1 − (1 − u)^(1 + 3·lag). The morph back is
 * then the time-reverse of the morph there, and long edges never slide
 * across each other at full length. 0 is the plain straight-line lerp of
 * every point. Both ends are exact for any lag (u = 0 → sources, u = 1 →
 * targets).
 */
export const blendPlan = (
  plan: MorphPlan,
  u: number,
  lag = 0,
  /** Translations to apply to the plan's two ends (a relative plan's placement). */
  offset?: { from: Vec3Like; to: Vec3Like },
): Vec3Like[][] => {
  if (offset) {
    const { from: a, to: b } = offset
    const moved: MorphPlan = {
      ...plan,
      correspondence: plan.correspondence,
      pieces: plan.pieces.map((p) => ({
        ...p,
        from: p.from.map((q) => ({ x: q.x + a.x, y: q.y + a.y, z: q.z + a.z })),
        to: p.to.map((q) => ({ x: q.x + b.x, y: q.y + b.y, z: q.z + b.z })),
      })),
    }
    return blendPlan(moved, u, lag)
  }
  const t = Math.min(1, Math.max(0, u))
  const k = Math.min(1, Math.max(0, lag))
  const g = 1 + 3 * k
  const mean = (ps: readonly Vec3Like[]): Vec3Like => {
    let x = 0
    let y = 0
    let z = 0
    for (const p of ps) {
      x += p.x
      y += p.y
      z += p.z
    }
    const n = ps.length || 1
    return { x: x / n, y: y / n, z: z / n }
  }
  return plan.pieces.map(({ from, to, grows }) => {
    const v = k <= 0 ? t : grows ? Math.pow(t, g) : 1 - Math.pow(1 - t, g)
    if (v === t)
      return from.map((p, i) => {
        const q = to[i]!
        return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: p.z + (q.z - p.z) * t }
      })
    const a = mean(from)
    const b = mean(to)
    const c = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
    return from.map((p, i) => {
      const q = to[i]!
      const ox = p.x - a.x + (q.x - b.x - (p.x - a.x)) * v
      const oy = p.y - a.y + (q.y - b.y - (p.y - a.y)) * v
      const oz = p.z - a.z + (q.z - b.z - (p.z - a.z)) * v
      return { x: c.x + ox, y: c.y + oy, z: c.z + oz }
    })
  })
}

/** Total arc length of a set of curves. */
export const totalLength = (curves: readonly Curve[]): number =>
  curves.reduce((s, c) => s + cumulative(c).at(-1)!, 0)
