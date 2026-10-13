/**
 * MorphCurves — N curves becoming M curves, in 3D. The universal morph.
 *
 * `MorphShape` (Morph.ts) is one closed outline into one, index by index:
 * pydeation's morph, reproduced exactly, kept as it is for the corpus.
 * This is the general verb: any set of holons' curves into any other
 * set's, partitioned by arc length (src/geometry/correspond.ts). Twelve
 * scattered arcs become one circle, each arc a complementary piece of the
 * circumference; one circle becomes the visible 3D edges of a truck
 * (vocabulary/Truck), and back.
 *
 *     dotToTruck = new MorphCurves([this.dot], [this.truck], { observer: this.observer })
 *     …
 *     this.stage(this.dotToTruck)
 *     this.play(MorphMany(this.dotToTruck), 4)
 *
 *
 * WHAT A HOLON OFFERS AS CURVES (`curvesOf`)
 *
 *   - anything with `worldCurves()` — a SolidDrawing (the Truck) answers
 *     its VISIBLE edges for the current camera; any holon may implement
 *     it (and `curveSignature()` to make change-detection cheap);
 *   - a morphable Stroke (Circle, Ellipse, Square, Polygon, Rectangle,
 *     Line) — its own outline, as Morph reads it (worldOutlineOf);
 *   - any other composite — every descendant Line with ink.
 *
 *
 * THREE CHANNELS, ONE VERB
 *
 *   1. FILL OUT   the sources' interiors go transparent; only their
 *                 outlines remain ("dot → outline").
 *   2. OUTLINES   the morpher takes over from the sources (they hide in
 *                 the same instant — at u = 0 the pieces ARE the sources,
 *                 so nothing moves), and the pieces travel, each its own
 *                 Line, each blending its source holon's tint into its
 *                 target holon's ("outline → pieces → edges").
 *   3. FILL IN    the targets appear exactly where the pieces landed (at
 *                 u = 1 the pieces ARE the targets), and their interiors
 *                 fill in.
 *
 * `fadeOut` / `fadeIn` are the fractions of the clip the two fill phases
 * take (default 0.2 each, 0 when a side has no fill to fade). Stage the
 * TARGETS hidden (opacity 0), as with Morph — the verb shows them.
 *
 * Deterministic and pure in t: the correspondence is a function of the
 * curves (planned once per input change), the frame a lerp of the plan.
 * The curves are read live, so a camera that moves DURING a morph onto a
 * view-dependent target re-plans — move the camera before or after.
 */

import { together, type Anim, type Windowed } from "../../src/anim"
import type { Observer } from "../../src/dream"
import { Holon, type Overrides } from "../../src/holon"
import { completion, paramEpoch } from "../../src/params"
import { WHITE, type Color } from "../../src/constants"
import { derive } from "../../src/params"
import { Line, Stroke, type Vec3Like } from "../../src/parts/primitives"
import { SolidDrawing, derivePoints, toLocal, toWorld, viewOf } from "../../src/parts/soliddrawing"
import { worldOutlineOf } from "../../src/geometry/morph"
import {
  blendPlan,
  planMorph,
  type CorrespondOptions,
  type MorphPlan,
} from "../../src/geometry/correspond"

// ─── Curves of a holon ──────────────────────────────────────────────

/** A holon that states its own curves (world space). */
export interface CurveBearing {
  worldCurves(): Vec3Like[][]
  /** Numbers that change whenever worldCurves() would — optional, a speed-up. */
  curveSignature?(): number[]
}

const bearsCurves = (h: unknown): h is CurveBearing =>
  typeof (h as { worldCurves?: unknown }).worldCurves === "function"

/** The world-space curves a holon offers a morph. See the header. */
export const curvesOf = (h: Holon): Vec3Like[][] => {
  if (bearsCurves(h)) return h.worldCurves()
  if (h instanceof Stroke) {
    const o = worldOutlineOf(h)
    if (o) return [o]
  }
  const out: Vec3Like[][] = []
  for (const n of h.walk())
    if (n !== h && n instanceof Line && n.points.length >= 2) out.push(n.points.map((p) => toWorld(n, p)))
  return out
}

const chainOf = (h: Holon): number[] => {
  const out: number[] = []
  for (let n: Holon | undefined = h; n; n = n.parent)
    out.push(n.x.value, n.y.value, n.z.value, n.h.value, n.p.value, n.b.value, n.scale.value)
  return out
}

/**
 * Numbers that move whenever `curvesOf(h)` would — the dirty key. Cheap
 * for the cases that have a cheap answer, exact (the curves themselves)
 * for the rest.
 */
const signatureOf = (h: Holon): number[] => {
  if (bearsCurves(h) && h.curveSignature) return h.curveSignature()
  if (h instanceof SolidDrawing) return [...h.signature(), ...chainOf(h)]
  if (h instanceof Line) return [h.geomVersion, h.drawStart.value, h.drawReversed.value ? 1 : 0, ...chainOf(h)]
  if (h instanceof Stroke && !bearsCurves(h)) {
    const nums = [...h.params.values()].map((p) => p.value).filter((x): x is number => typeof x === "number")
    if (worldOutlineOf(h, 8)) return [...nums, ...chainOf(h)]
  }
  return curvesOf(h).flatMap((c) => c.flatMap((p) => [p.x, p.y, p.z]))
}

/** A shape's fingerprint: FNV-1a over its points rounded to 1e-3. */
const hashCurves = (cs: Vec3Like[][]): string => {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  const mixIn = (v: number) => {
    const k = Math.round(v * 1000) | 0
    h1 = Math.imul(h1 ^ k, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ (k + 0x9e3779b9), 0x85ebca6b) >>> 0
  }
  for (const c of cs) {
    mixIn(c.length)
    for (const p of c) {
      mixIn(p.x)
      mixIn(p.y)
      mixIn(p.z)
    }
  }
  return `${cs.length}:${h1.toString(36)}${h2.toString(36)}`
}

const sameKey = (a: readonly number[] | undefined, b: readonly number[]): boolean =>
  !!a && a.length === b.length && a.every((x, i) => x === b[i])

const mix = (a: Color, b: Color, t: number): Color => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
})

const tintOf = (h: Holon | undefined): Color => (h instanceof Stroke ? h.tint.value : WHITE)

// ─── The holon ──────────────────────────────────────────────────────

export interface MorphCurvesOptions extends CorrespondOptions {
  /**
   * The scene's observer. With it, "angular" ordering reads angles in the
   * VIEW plane, so pieces sort as they are seen — what keeps a 3D morph
   * from crossing on screen.
   */
  observer?: Observer
  /** Piece slots. Default: twice the curves on both sides at construction, at least 32. */
  capacity?: number
  /** Uniform sample spacing over each piece, world units (see planMorph). */
  step?: number
  /**
   * Plan the shapes relative to their own centroids and cache the plans
   * by shape — for morphs whose ends mostly MOVE (particles on a flow):
   * the correspondence is then computed once per distinct pair of shapes,
   * not once per frame. The ordering's centre becomes the pair's midpoint
   * rather than the common centroid; for one source and one target that
   * is the same morph. Default false.
   */
  relative?: boolean
  /**
   * How long pieces keep the shape they left with before taking the one
   * they arrive at (blendPlan's `lag`): 0 = every point on a straight line,
   * 0.5 = pieces fly as pieces and become their targets on arrival.
   * Default 0.5.
   */
  lag?: number
}

/**
 * The morph in flight: a pool of Lines, one per piece, whose points are
 * the plan blended at `morph`. It is never itself filled — fill is the
 * sources' and targets' own channel (see the verb).
 */
export class MorphCurves extends Stroke {
  /** 0 = the sources' curves, 1 = the targets'. */
  morph = completion(0)

  // References, not parts (registering them would reparent them).
  private ends!: {
    sources: Holon[]
    targets: Holon[]
    opts: MorphCurvesOptions
  }
  private planMemo?: {
    key: number[]
    plan: MorphPlan
    srcOwner: number[]
    tgtOwner: number[]
    offset?: { from: Vec3Like; to: Vec3Like }
  }
  private relativePlans = new Map<string, MorphPlan>()
  private frameMemo?: { plan: MorphPlan; u: number; offset?: { from: Vec3Like; to: Vec3Like }; curves: Vec3Like[][]; version: number }
  private restMemo?: { key: number[]; curves: Vec3Like[][]; owners: number[]; version: number }
  private frames = 0
  private planEpoch = -1
  private curvesEpoch = -1
  private curvesMemo?: { curves: Vec3Like[][]; version: number }

  constructor(sources: Holon[], targets: Holon[], options: MorphCurvesOptions & Overrides = {}) {
    const { observer, capacity, step, lag, relative, order, normal, axis, snap, rotate, ...rest } = options
    super(rest)
    if (!sources.length || !targets.length)
      throw new Error(
        `MorphCurves: needs at least one source and one target holon (got ${sources.length} → ${targets.length}). ` +
          `A morph carries curves from somewhere to somewhere; to make something appear from nothing, Create it.`,
      )
    this.ends = { sources, targets, opts: { observer, capacity, step, lag, relative, order, normal, axis, snap, rotate } }
  }

  /** The current plan — re-planned only when an input's curves change. */
  plan(): { plan: MorphPlan; srcOwner: number[]; tgtOwner: number[]; offset?: { from: Vec3Like; to: Vec3Like } } {
    // Same frame (no param written since), same plan — the slots ask
    // hundreds of times a frame, the key below need only be read once.
    const epoch = paramEpoch()
    if (this.planMemo && this.planEpoch === epoch) return this.planMemo
    this.planEpoch = epoch
    const { sources, targets, opts } = this.ends
    const obs = opts.observer
    const key = [
      ...sources.flatMap((h) => [-1, ...signatureOf(h)]),
      -2,
      ...targets.flatMap((h) => [-1, ...signatureOf(h)]),
      ...(obs ? [obs.phi.value, obs.theta.value, obs.orthographic.value ? 1 : 0] : []),
    ]
    if (this.planMemo && sameKey(this.planMemo.key, key)) return this.planMemo
    const srcOwner: number[] = []
    const tgtOwner: number[] = []
    const src = sources.flatMap((h, i) => curvesOf(h).map((c) => (srcOwner.push(i), c)))
    const tgt = targets.flatMap((h, i) => curvesOf(h).map((c) => (tgtOwner.push(i), c)))
    let normal = opts.normal
    if (!normal && obs) {
      const view = viewOf(obs)
      if ("toward" in view) normal = view.toward
      else {
        const pts = [...src, ...tgt].flat()
        const c = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y, z: a.z + p.z }), { x: 0, y: 0, z: 0 })
        const n = pts.length || 1
        normal = { x: view.eye.x - c.x / n, y: view.eye.y - c.y / n, z: view.eye.z - c.z / n }
      }
    }
    if (opts.relative) {
      // Plan the SHAPES, not their places: each side centred on its own
      // centroid, keyed by what it looks like there (and the view plane,
      // bucketed), and translated back at blend time. A dot and a truck
      // that only move — a particle riding a flow — plan once per shape.
      const centroid = (cs: Vec3Like[][]) => {
        const pts = cs.flat()
        const n = pts.length || 1
        return pts.reduce((a, p) => ({ x: a.x + p.x / n, y: a.y + p.y / n, z: a.z + p.z / n }), { x: 0, y: 0, z: 0 })
      }
      const cs = centroid(src)
      const ct = centroid(tgt)
      const shift = (cs2: Vec3Like[][], c: Vec3Like) => cs2.map((cv) => cv.map((p) => ({ x: p.x - c.x, y: p.y - c.y, z: p.z - c.z })))
      const rs = shift(src, cs)
      const rt = shift(tgt, ct)
      const nn = normal ? Math.hypot(normal.x, normal.y, normal.z) || 1 : 1
      const shapeKey = [
        hashCurves(rs),
        hashCurves(rt),
        ...(normal ? [normal.x / nn, normal.y / nn, normal.z / nn].map((v) => Math.round(v * 50)) : []),
      ].join("|")
      let plan = this.relativePlans.get(shapeKey)
      if (!plan) {
        plan = planMorph(rs, rt, { ...opts, normal })
        if (this.relativePlans.size > 256) this.relativePlans.delete(this.relativePlans.keys().next().value!)
        this.relativePlans.set(shapeKey, plan)
      }
      this.planMemo = { key, plan, srcOwner, tgtOwner, offset: { from: cs, to: ct } }
      return this.planMemo
    }
    const plan = planMorph(src, tgt, { ...opts, normal })
    this.planMemo = { key, plan, srcOwner, tgtOwner }
    return this.planMemo
  }

  /** The blended curves at the current `morph`, one per piece. */
  curves(): { curves: Vec3Like[][]; version: number } {
    const epoch = paramEpoch()
    if (this.curvesMemo && this.curvesEpoch === epoch) return this.curvesMemo
    this.curvesEpoch = epoch
    return (this.curvesMemo = this.curvesNow())
  }

  private curvesNow(): { curves: Vec3Like[][]; version: number } {
    const u = this.morph.value
    // AT REST (u = 0 or 1) the morph is exactly its sources' or its
    // targets' curves — drawn whole rather than as pieces, which is the
    // same ink and needs no plan. That matters when many morphers sit at
    // rest on moving inputs (a lens full of dots that are not yet trucks).
    if (u <= 0 || u >= 1) {
      const side = u <= 0 ? this.ends.sources : this.ends.targets
      const key = [u <= 0 ? 0 : 1, ...side.flatMap((h) => [-1, ...signatureOf(h)])]
      const r = this.restMemo
      if (r && sameKey(r.key, key)) return r
      const owners: number[] = []
      const curves = side.flatMap((h, i) => curvesOf(h).map((c) => (owners.push(i), c)))
      this.restMemo = { key, curves, owners, version: ++this.frames }
      return this.restMemo
    }
    const { plan, offset } = this.plan()
    const f = this.frameMemo
    if (f && f.plan === plan && f.u === u && f.offset === offset) return f
    this.frameMemo = { plan, u, offset, curves: blendPlan(plan, u, this.ends.opts.lag ?? 0.5, offset), version: ++this.frames }
    return this.frameMemo
  }

  /** The tint of piece i: its source holon's blended into its target holon's. */
  private pieceTint(i: number): Color {
    const u = this.morph.value
    if (u <= 0 || u >= 1) {
      const side = u <= 0 ? this.ends.sources : this.ends.targets
      const owner = this.restMemo?.owners[i]
      return owner === undefined ? WHITE : tintOf(side[owner])
    }
    const { plan, srcOwner, tgtOwner } = this.plan()
    const p = plan.pieces[i]
    if (!p) return WHITE
    return mix(
      tintOf(this.ends.sources[srcOwner[p.source]!]),
      tintOf(this.ends.targets[tgtOwner[p.target]!]),
      u,
    )
  }

  /** The curves in flight, world space (this holon sits at the identity). */
  worldCurves(): Vec3Like[][] {
    return this.curves().curves
  }

  protected override compose(): void {
    const { sources, targets, opts } = this.ends
    const count = (hs: Holon[]) => hs.reduce((s, h) => s + curvesOf(h).length, 0)
    const capacity = opts.capacity ?? Math.max(32, 2 * (count(sources) + count(targets)))
    for (let i = 0; i < capacity; i++) {
      const slot = new Line({
        tint: derive((): Color => this.pieceTint(i)),
        stroke: this.stroke,
        opacity: this.opacity,
        creation: this.creation,
      })
      // The curves are WORLD space; a morpher staged at the root draws them
      // as they are, one placed inside a transformed whole (a lens) carries
      // them into its own frame first.
      derivePoints(
        slot,
        () => [this.curves().version, ...(this.parent ? chainOf(this) : [])],
        () => {
          const c = this.curves().curves[i] ?? []
          return this.parent ? c.map((p) => toLocal(slot, p)) : c
        },
      )
      this.add(slot)
    }
  }

  /** The source and target holons (read-only). */
  get sources(): readonly Holon[] {
    return this.ends.sources
  }
  get targets(): readonly Holon[] {
    return this.ends.targets
  }
}

// ─── Param-driven morphs ────────────────────────────────────────────

/**
 * The verb's three channels as a pure function of ONE completion c ∈ [0, 1]
 * — for a morph driven by a param rather than played on the timeline (a
 * lens's `concrete`, a particle's place along its path). The source's
 * fill is gone by `fadeOut`, the outlines travel in between, the target's
 * fill arrives over the last `fadeIn`. Bind `morph` to `.morph`, the
 * source's fillOpacity to `1 − fillOut`, the target's to `fillIn`.
 */
export const morphPhases = (
  c: number,
  fadeOut = 0.2,
  fadeIn = 0.2,
): { fillOut: number; morph: number; fillIn: number } => {
  const k = Math.min(1, Math.max(0, c))
  const clamp = (x: number) => Math.min(1, Math.max(0, x))
  const b = 1 - fadeIn
  return {
    fillOut: fadeOut > 0 ? clamp(k / fadeOut) : k > 0 ? 1 : 0,
    morph: b > fadeOut ? clamp((k - fadeOut) / (b - fadeOut)) : k >= 0.5 ? 1 : 0,
    fillIn: fadeIn > 0 ? clamp((k - b) / fadeIn) : k >= 1 ? 1 : 0,
  }
}

// ─── The verb ───────────────────────────────────────────────────────

export interface MorphManyOptions {
  /** Leave the sources standing (a twin departs from them). Default false. */
  copy?: boolean
  /** Fraction of the clip the sources' fill takes to fade out. Default 0.2 if any source is filled, else 0. */
  fadeOut?: number
  /** Fraction of the clip the targets' fill takes to fade in. Default 0.2 if any target is filled, else 0. */
  fadeIn?: number
}

const filled = (h: Holon): number => (h instanceof Stroke ? h.fillOpacity.value : 0)

/**
 * N curves becoming M: fill out → outlines travel → fill in. See the
 * header for the three channels. The targets' fill values are read at
 * construction (destination constants, DECISIONS 2026-09-07); everything
 * departing resolves chronologically (`.to`).
 */
export const MorphMany = (shape: MorphCurves, opts: MorphManyOptions = {}): Anim => {
  const srcFilled = shape.sources.some((h) => filled(h) > 0)
  const tgtFilled = shape.targets.some((h) => filled(h) > 0)
  const a = Math.min(0.45, Math.max(0, opts.fadeOut ?? (srcFilled ? 0.2 : 0)))
  const b = 1 - Math.min(0.45, Math.max(0, opts.fadeIn ?? (tgtFilled ? 0.2 : 0)))
  const eps = 0.01
  // Plain sub-windows (not `restage`): each phase keeps its own ease —
  // this verb has no pydeation group-rescale to be faithful to.
  const items: Windowed[] = [
    [shape.morph.sequence(0, 1), a, b],
    // The morpher takes over from the sources at `a` …
    [shape.opacity.sequence(0, 1), a, a + eps],
    // … and hands over to the targets just before `b`.
    [shape.opacity.to(0), b - eps, b],
  ]
  for (const s of shape.sources) {
    if (s instanceof Stroke && a > 0) items.push([s.fillOpacity.to(0), 0, a])
    if (!opts.copy) items.push([s.opacity.to(0), a, a + eps])
  }
  for (const t of shape.targets) {
    items.push([t.opacity.to(1), b - eps, b])
    if (t instanceof Stroke && filled(t) > 0) items.push([t.fillOpacity.sequence(0, filled(t)), b - eps, b < 1 ? 1 : b])
  }
  return together(...items)
}
