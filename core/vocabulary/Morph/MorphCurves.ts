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
 *   - any other composite — what it shows: every visible descendant with
 *     curves of its own (a primitive's outline, a Line, a CurveBearing).
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
import { completion, paramEpoch, type Param } from "../../src/params"
import { WHITE, type Color } from "../../src/constants"
import { derive } from "../../src/params"
import { Line, Stroke, type Vec3Like } from "../../src/parts/primitives"
import { SolidDrawing, derivePoints, toLocal, toWorld, viewOf } from "../../src/parts/soliddrawing"
import { worldOutlineOf } from "../../src/geometry/morph"
import {
  blendPlan,
  blendTravel,
  chainCurves,
  pieceAlphas,
  planMorphDetailed,
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

/**
 * The world-space curves a holon offers a morph, each with the PART it was
 * read from — whose tint a piece leaving or arriving there wears (a
 * MindVirus's cube is blue, its eye white, the creature itself has no
 * colour). See the header for what counts.
 */
export const partCurvesOf = (h: Holon): { curve: Vec3Like[]; part: Holon }[] => {
  if (bearsCurves(h)) return h.worldCurves().map((curve) => ({ curve, part: h }))
  if (h instanceof Stroke) {
    const o = worldOutlineOf(h)
    if (o) return [{ curve: o, part: h }]
  }
  // A composite: what it SHOWS — every visible descendant that offers
  // curves of its own (worldCurves, or a primitive's outline), not
  // descending into one that already answered for its subtree.
  const out: { curve: Vec3Like[]; part: Holon }[] = []
  const visit = (n: Holon) => {
    if (n !== h) {
      // Hidden only by ITS OWN declaration: a part whose opacity/creation is
      // its whole's own param (a Word's contours, bound to the Word) is
      // as visible as the whole — which a morph target, staged hidden,
      // is not yet, and must still offer. And by its DECLARED value
      // (defaultValue), not its current one: a morph hides its source's
      // parts as it leaves — they are still its shape.
      const own = (k: "opacity" | "creation") => n[k] !== h[k] && n[k] !== n.parent?.[k]
      const seen =
        !(own("opacity") && n.opacity.defaultValue <= 0) && !(own("creation") && n.creation.defaultValue <= 0)
      if (bearsCurves(n)) {
        if (seen) for (const curve of n.worldCurves()) out.push({ curve, part: n })
        return
      }
      if (n instanceof Stroke && seen) {
        const o = n instanceof Line ? (n.points.length >= 2 ? n.points.map((p) => toWorld(n, p)) : undefined) : worldOutlineOf(n)
        if (o) out.push({ curve: o, part: n })
      }
    }
    for (const c of n.parts) visit(c)
  }
  visit(h)
  return out
}

/** The world-space curves a holon offers a morph (`partCurvesOf` without the parts). */
export const curvesOf = (h: Holon): Vec3Like[][] => partCurvesOf(h).map((c) => c.curve)

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

export interface MorphCurvesOptions extends Omit<CorrespondOptions, "axis"> {
  /**
   * The direction "sweep" and `stagger` read along — or a function of the
   * moment (the camera's right, which moves with the camera). Default +X.
   */
  axis?: Vec3Like | (() => Vec3Like)
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
  /**
   * How pieces travel. "rigid" (default): each flies as a body on a gentle
   * arc, turning and scaling toward its target's pose, and bends into its
   * exact shape only near the end (geometry/correspond.ts blendTravel).
   * "lerp": every point on its own straight line, shaped by `lag`.
   */
  travel?: "rigid" | "lerp"
  /** Rigid travel: spread the piece starts over this fraction, in order along `axis`. Default 0. */
  stagger?: number
  /** Rigid travel: how far paths bow (fraction of their length). Default 0.2. */
  arc?: number
  /** Rigid travel: when, in its flight, a piece starts bending into shape. Default 0.5. */
  bend?: number
  /**
   * Join each side's curves that meet end to end into longer strokes
   * before matching (chainCurves) — fewer, longer pieces. Default true.
   */
  chain?: boolean
  /**
   * Details (planMorphDetailed): a closed curve shorter than this fraction
   * of its side's longest is a DETAIL — it flies whole onto a target
   * detail, or condenses where it is (shrinks and fades; grows and fades
   * in) — instead of being shredded into stroke fragments. 0 = off
   * (default); MorphToWord uses 0.25.
   */
  minor?: number
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
    srcOwner: Holon[]
    tgtOwner: Holon[]
    offset?: { from: Vec3Like; to: Vec3Like }
  }
  private relativePlans = new Map<string, MorphPlan>()
  private frameMemo?: { plan: MorphPlan; u: number; offset?: { from: Vec3Like; to: Vec3Like }; curves: Vec3Like[][]; version: number }
  private restMemo?: { key: number[]; curves: Vec3Like[][]; owners: Holon[]; version: number }
  private frames = 0
  private planEpoch = -1
  private curvesEpoch = -1
  private curvesMemo?: { curves: Vec3Like[][]; version: number }

  constructor(sources: Holon[], targets: Holon[], options: MorphCurvesOptions & Overrides = {}) {
    const { observer, capacity, step, lag, relative, order, normal, axis, snap, rotate, travel, stagger, arc, bend, chain, minor, ...rest } = options
    super(rest)
    if (!sources.length || !targets.length)
      throw new Error(
        `MorphCurves: needs at least one source and one target holon (got ${sources.length} → ${targets.length}). ` +
          `A morph carries curves from somewhere to somewhere; to make something appear from nothing, Create it.`,
      )
    this.ends = { sources, targets, opts: { observer, capacity, step, lag, relative, order, normal, axis, snap, rotate, travel, stagger, arc, bend, chain, minor } }
  }

  /** The current plan — re-planned only when an input's curves change. */
  plan(): { plan: MorphPlan; srcOwner: Holon[]; tgtOwner: Holon[]; offset?: { from: Vec3Like; to: Vec3Like } } {
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
      ...((a) => (a ? [a.x, a.y, a.z] : []))(this.axisNow()),
    ]
    if (this.planMemo && sameKey(this.planMemo.key, key)) return this.planMemo
    const srcOwner: Holon[] = []
    const tgtOwner: Holon[] = []
    let src = sources.flatMap((h) => partCurvesOf(h).map((c) => (srcOwner.push(c.part), c.curve)))
    let tgt = targets.flatMap((h) => partCurvesOf(h).map((c) => (tgtOwner.push(c.part), c.curve)))
    if (opts.chain ?? true) {
      // Strokes, not shards: join each side's curves that meet end to end.
      // A chain wears its first member's colour.
      const tolOf = (cs: Vec3Like[][]) => {
        const pts = cs.flat()
        if (!pts.length) return 0
        const span = (k: "x" | "y" | "z") => Math.max(...pts.map((p) => p[k])) - Math.min(...pts.map((p) => p[k]))
        return Math.hypot(span("x"), span("y"), span("z")) * 0.004
      }
      const cs = chainCurves(src, tolOf(src))
      const ct = chainCurves(tgt, tolOf(tgt))
      const so = cs.members.map((m) => srcOwner[m[0]!]!)
      const to = ct.members.map((m) => tgtOwner[m[0]!]!)
      src = cs.curves
      tgt = ct.curves
      srcOwner.length = 0
      srcOwner.push(...so)
      tgtOwner.length = 0
      tgtOwner.push(...to)
    }
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
        plan = planMorphDetailed(rs, rt, { ...opts, axis: this.axisNow(), normal })
        if (this.relativePlans.size > 256) this.relativePlans.delete(this.relativePlans.keys().next().value!)
        this.relativePlans.set(shapeKey, plan)
      }
      this.planMemo = { key, plan, srcOwner, tgtOwner, offset: { from: cs, to: ct } }
      return this.planMemo
    }
    const plan = planMorphDetailed(src, tgt, { ...opts, axis: this.axisNow(), normal })
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
      const owners: Holon[] = []
      const curves = side.flatMap((h) => partCurvesOf(h).map((c) => (owners.push(c.part), c.curve)))
      this.restMemo = { key, curves, owners, version: ++this.frames }
      return this.restMemo
    }
    const { plan, offset } = this.plan()
    const f = this.frameMemo
    if (f && f.plan === plan && f.u === u && f.offset === offset) return f
    const o = this.ends.opts
    const curves =
      (o.travel ?? "rigid") === "rigid"
        ? blendTravel(plan, u, { stagger: o.stagger, axis: this.axisNow(), arc: o.arc, bend: o.bend, offset })
        : blendPlan(plan, u, o.lag ?? 0.5, offset)
    this.frameMemo = { plan, u, offset, curves, version: ++this.frames }
    return this.frameMemo
  }

  /** The tint of piece i: its source part's blended into its target part's. */
  private pieceTint(i: number): Color {
    const u = this.morph.value
    if (u <= 0 || u >= 1) {
      void this.curves() // the rest memo names the owners
      const owner = this.restMemo?.owners[i]
      return owner === undefined ? WHITE : tintOf(owner)
    }
    const { plan, srcOwner, tgtOwner } = this.plan()
    const p = plan.pieces[i]
    if (!p) return WHITE
    // A condensing detail keeps its own side's colour.
    if (p.source < 0) return tintOf(tgtOwner[p.target])
    if (p.target < 0) return tintOf(srcOwner[p.source])
    return mix(
      tintOf(srcOwner[p.source]),
      tintOf(tgtOwner[p.target]),
      u,
    )
  }

  /** The reading axis now (a function of the moment, or a constant). */
  private axisNow(): Vec3Like | undefined {
    const a = this.ends.opts.axis
    return typeof a === "function" ? a() : a
  }

  /** Piece i's opacity: 1, or a condensing detail's fade (pieceAlphas). */
  private pieceAlpha(i: number): number {
    const u = this.morph.value
    if (u <= 0 || u >= 1) return 1
    const o = this.ends.opts
    const { plan } = this.plan()
    if (!plan.pieces.some((p) => p.condense)) return 1
    const epoch = paramEpoch()
    if (this.alphaMemo?.epoch !== epoch || this.alphaMemo.plan !== plan) {
      this.alphaMemo = { epoch, plan, alphas: pieceAlphas(plan, u, { stagger: o.stagger, axis: this.axisNow() }) }
    }
    return this.alphaMemo.alphas[i] ?? 1
  }
  private alphaMemo?: { epoch: number; plan: MorphPlan; alphas: number[] }

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
        opacity: derive(() => this.opacity.value * this.pieceAlpha(i)),
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

const filled = (h: Holon): number =>
  Math.max(0, ...fillParams(h).map((p) => p.value))

/**
 * A holon's own surfaces: its param of `key`, and every descendant's that
 * is a param of its OWN (not bound — a bound one follows its source). A
 * composite's parts do not inherit opacity in the host, so a verb that
 * hides or shows a whole must address each of them.
 */
export const ownParams = (h: Holon, key: "opacity" | "fillOpacity"): Param<number>[] => {
  const out = new Set<Param<number>>()
  for (const n of h.walk()) {
    if (key === "fillOpacity" && !(n instanceof Stroke)) continue
    const p = (n as unknown as Record<string, Param<number>>)[key]
    if (p && !p.isBound) out.add(p)
  }
  return [...out]
}
const fillParams = (h: Holon) => ownParams(h, "fillOpacity")

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
  // Leaving: every surface the source owns goes — its fills first, then
  // (as the pieces take over) its lines.
  for (const s of shape.sources) {
    if (a > 0) for (const f of fillParams(s)) items.push([f.to(0), 0, a])
    if (!opts.copy) for (const o of ownParams(s, "opacity")) items.push([o.to(0), a, a + eps])
  }
  // Arriving: the whole comes up; each part returns to what it was
  // DECLARED as (a part hidden by design stays hidden) — destination
  // values read at construction, per the verb rule (DECISIONS 2026-09-07).
  for (const t of shape.targets) {
    for (const o of ownParams(t, "opacity")) items.push([o.to(o === t.opacity ? 1 : o.value), b - eps, b])
    for (const f of fillParams(t))
      if (f.value > 0) items.push([f.sequence(0, f.value), b - eps, b < 1 ? 1 : b])
  }
  return together(...items)
}
