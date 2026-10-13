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
 *   "angular"  (default) curves sorted by the angle of their midpoint
 *              about the common centre, read in a plane (the view plane
 *              when a normal is given), each oriented to sweep counter-
 *              clockwise; then the target tape is ROTATED to the offset
 *              that minimises total travel. Arcs on the left land on the
 *              left of the circle; the circle's pieces fly outward to the
 *              truck's edges in the direction they already face. This is
 *              what keeps pieces from crossing.
 *   "sweep"    sorted by midpoint projection onto an axis, oriented
 *              along it — a left-to-right reading, no rotation.
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

export type CorrespondOrder = "angular" | "sweep" | "given"

export interface CorrespondOptions {
  /** How curves are ordered on each tape. Default "angular". */
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
  const order = opts.order ?? "angular"
  const rotate = opts.rotate ?? order === "angular"
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
  const sSlots = orderCurves(src, srcLen, order, centre, basis, axis).filter((s) => keepS(s.index))
  const tSlots = orderCurves(tgt, tgtLen, order, centre, basis, axis).filter((s) => keepT(s.index))
  const S = tapeBounds(sSlots)
  const T = tapeBounds(tSlots)

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

// ─── The plan: pieces resampled pairwise ────────────────────────────

/** One piece, both ends resampled to the same count — ready to lerp. */
export interface PlannedPiece {
  source: number
  target: number
  from: Vec3Like[]
  to: Vec3Like[]
  /** Is the target end longer than the source end? (see blendPlan's lag) */
  grows: boolean
}

export interface MorphPlan {
  pieces: PlannedPiece[]
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
    return {
      source: p.source,
      target: p.target,
      from: ss.map((s) => pointAt(src, sCum[p.source]!, a + (b - a) * s)),
      to: ss.map((s) => pointAt(tgt, tCum[p.target]!, c + (d - c) * s)),
      grows: Math.abs(d - c) > Math.abs(b - a),
    }
  })
  return { pieces, correspondence }
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
export const blendPlan = (plan: MorphPlan, u: number, lag = 0): Vec3Like[][] => {
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
