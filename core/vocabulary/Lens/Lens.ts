/**
 * Lens — a circle that lifts toward the camera and becomes a magnifying
 * glass: magnification BY PROXIMITY.
 *
 * At rest it is a circle lying on the scene (the far face). Lifted, its
 * near face rises toward the camera along `liftX/Y/Z`; the two faces are
 * the same size in the world, so the near one is bigger on screen only
 * because it is closer — the perspective IS the magnification, nothing
 * is scaled. Between them stand the two contour lines of the oblique
 * cylinder they bound, solved for the camera every frame (where the view
 * ray grazes the surface joining A(θ) on the far rim to A(θ) + lift on
 * the near one). The near face is filled black: it is a window, and what
 * lies behind it is hidden.
 *
 *     lens = new Lens({ observer: this.observer, x: -250, radius: 110 })
 *     this.play(lens.lift.to(1), 2)
 *
 * `inside(p)` answers whether a world point is SEEN within the near face
 * — what a holon showing through the lens trims itself to (Road's
 * `bound`). `FlowLens` (below) is the lens set on a flow, which is where
 * the abstract becomes concrete: the flow's line becomes a road and its
 * dots become trucks, inside the near face, continuously.
 *
 * The lens lies in its local XY plane, looking out along +z.
 */

import { BLACK, BLUE, WHITE, type Color } from "../../src/constants"
import type { Observer } from "../../src/dream"
import type { Holon, Overrides } from "../../src/holon"
import { angle, completion, derive, length, paramEpoch, scalar } from "../../src/params"
import { Circle, Group, Line, Stroke, type Vec3Like } from "../../src/parts/primitives"
import { derivePoints, localView, toLocal, toWorld, viewOf } from "../../src/parts/soliddrawing"
import { rotHPB } from "../../src/parts/curves"
import { clip } from "../../src/clip"
import type { View } from "../../src/geometry/hiddenline"
import { atArcLength, smooth } from "../../src/geometry/flowmap"
import { MorphCurves, morphPhases } from "../Morph/MorphCurves"
import { axis, toggle, type StateSpace } from "../../src/automaton"
import { certainty } from "../../src/certainty"
import { together, type Anim } from "../../src/anim"
import { Road } from "../Road/Road"
import { Truck } from "../Truck/Truck"

export interface LensOptions {
  /** The scene's observer — the lens's contour lines and `inside` are camera-relative. */
  observer?: Observer
  /**
   * What else, clicked in free play, opens and closes the lens (its own far
   * face always does) — the flow's line, so "click the arrow, the lens
   * opens". A handle nearer the click than the owner of another axis wins
   * (src/automaton.ts), so the line itself, not its whole group.
   */
  handles?: () => Holon[]
}

export class Lens extends Stroke {
  /** The faces' radius (both — the near one only LOOKS bigger). */
  radius = length(110)
  /** 0 = lying on the scene, 1 = lifted to (liftX, liftY, liftZ). */
  lift = completion(0)
  /** Where the near face's centre goes at lift 1, lens-local. */
  liftX = scalar(260)
  liftY = scalar(300)
  liftZ = scalar(800)
  /**
   * Extra magnification of the near face, reached at lift 1. Under
   * perspective 1 is right — closeness magnifies; an ORTHOGRAPHIC camera
   * has no closeness, so there the lens says it outright (the near face
   * and everything seen in it grow by this factor).
   */
  zoom = scalar(1)

  protected seen!: { observer?: Observer; handles?: () => Holon[] }

  /** The near face's centre now, lens-local. */
  nearCenter(): Vec3Like {
    const k = this.lift.value
    return { x: this.liftX.value * k, y: this.liftY.value * k, z: this.liftZ.value * k }
  }

  /** The near face's scale against the far one now (1 → zoom with lift). */
  nearScale(): number {
    return 1 + (this.zoom.value - 1) * this.lift.value
  }

  /** The near face's radius now. */
  nearRadius(): number {
    return this.radius.value * this.nearScale()
  }

  /** Is the window open at all — the near face off the far one? */
  protected opened(): number {
    return Math.min(1, this.lift.value * 25) * this.opacity.value
  }

  far = new Circle({ radius: this.radius, tint: this.tint, stroke: this.stroke, opacity: this.opacity, creation: this.creation })
  sideA = new Line({ tint: this.tint, stroke: this.stroke, opacity: this.opacity })
  sideB = new Line({ tint: this.tint, stroke: this.stroke, opacity: this.opacity })
  disc = new Circle({
    radius: derive(() => this.nearRadius()),
    tint: BLACK,
    stroke: 0,
    fillOpacity: 1,
    opacity: derive(() => this.opened()),
    x: derive(() => this.nearCenter().x),
    y: derive(() => this.nearCenter().y),
    z: derive(() => this.nearCenter().z),
  })
  near = new Circle({
    radius: derive(() => this.nearRadius()),
    tint: this.tint,
    stroke: this.stroke,
    opacity: derive(() => this.opened()),
    x: derive(() => this.nearCenter().x),
    y: derive(() => this.nearCenter().y),
    z: derive(() => this.nearCenter().z),
  })

  constructor(overrides: Overrides & LensOptions = {}) {
    const { observer, handles, ...rest } = overrides
    super({ tint: WHITE, ...rest })
    this.seen = { observer, handles }
    for (const [i, side] of [this.sideA, this.sideB].entries())
      derivePoints(side, () => this.sideKey(), () => this.sides()[i] ?? [])
  }

  /** The view, lens-local. */
  protected view(): View {
    const epoch = paramEpoch()
    if (this.viewMemo && this.viewMemo.epoch === epoch) return this.viewMemo.view
    const view = this.viewNow()
    this.viewMemo = { epoch, view }
    return view
  }
  private viewMemo?: { epoch: number; view: View }

  private viewNow(): View {
    const v: View = this.seen.observer ? viewOf(this.seen.observer) : { eye: { x: 0, y: 0, z: 1500 } }
    return localView(this, v)
  }

  private sideKey(): number[] {
    const v = this.view()
    const c = this.nearCenter()
    return [this.radius.value, this.nearRadius(), c.x, c.y, c.z, ...("eye" in v ? [v.eye.x, v.eye.y, v.eye.z] : [v.toward.x, v.toward.y, v.toward.z, 9])]
  }

  /**
   * The two contour lines of the oblique cylinder from the far rim to the
   * near one, lens-local: the generators A(θ) → A(θ) + L along which the
   * surface's normal is perpendicular to the view ray. Found by a sign
   * scan over θ and bisection; none while the faces coincide.
   */
  sides(): Vec3Like[][] {
    const L = this.nearCenter()
    if (Math.hypot(L.x, L.y, L.z) < 1e-6 && Math.abs(this.nearScale() - 1) < 1e-9) return []
    const r = this.radius.value
    const r2 = this.nearRadius()
    const v = this.view()
    // The ruling from A(θ) on the far rim to B(θ) = L + (r2/r)·A(θ) on the
    // near one (an oblique cylinder, or a cone frustum when zoomed).
    const f = (th: number) => {
      const a = { x: r * Math.cos(th), y: r * Math.sin(th), z: 0 }
      const t = { x: -Math.sin(th), y: Math.cos(th), z: 0 }
      const D = { x: L.x + (r2 - r) * Math.cos(th), y: L.y + (r2 - r) * Math.sin(th), z: L.z }
      const n = { x: t.y * D.z - t.z * D.y, y: t.z * D.x - t.x * D.z, z: t.x * D.y - t.y * D.x }
      const d = "eye" in v ? { x: v.eye.x - a.x, y: v.eye.y - a.y, z: v.eye.z - a.z } : v.toward
      return n.x * d.x + n.y * d.y + n.z * d.z
    }
    const N = 360
    const roots: number[] = []
    let prev = f(0)
    for (let i = 1; i <= N; i++) {
      const th = (i / N) * 2 * Math.PI
      const cur = f(th)
      if ((prev < 0) !== (cur < 0)) {
        let lo = ((i - 1) / N) * 2 * Math.PI
        let hi = th
        for (let k = 0; k < 30; k++) {
          const m = (lo + hi) / 2
          if ((f(lo) < 0) === (f(m) < 0)) lo = m
          else hi = m
        }
        roots.push((lo + hi) / 2)
      }
      prev = cur
    }
    return roots.slice(0, 2).map((th) => {
      const a = { x: r * Math.cos(th), y: r * Math.sin(th), z: 0 }
      return [a, { x: L.x + r2 * Math.cos(th), y: L.y + r2 * Math.sin(th), z: L.z }]
    })
  }

  /** Is this WORLD point seen within the near face? */
  inside(world: Vec3Like): boolean {
    const p = toLocal(this, world)
    const c = this.nearCenter()
    const v = this.view()
    let q: Vec3Like
    if ("eye" in v) {
      const dz = p.z - v.eye.z
      if (Math.abs(dz) < 1e-9) return false
      const t = (c.z - v.eye.z) / dz
      q = { x: v.eye.x + (p.x - v.eye.x) * t, y: v.eye.y + (p.y - v.eye.y) * t, z: c.z }
    } else {
      if (Math.abs(v.toward.z) < 1e-9) return false
      const t = (c.z - p.z) / v.toward.z
      q = { x: p.x + v.toward.x * t, y: p.y + v.toward.y * t, z: c.z }
    }
    return Math.hypot(q.x - c.x, q.y - c.y) < this.nearRadius()
  }

  /**
   * The walkable state space (src/automaton.ts): one axis, closed ↔ open,
   * fired by clicking the lens or its `handles` (key "o"). The opening is
   * a verb (`openVia`), reversible: clicking again mid-flight retargets
   * smoothly from wherever it is.
   */
  override stateSpace(): StateSpace {
    const { closed, open } = this.openPositions()
    return {
      axes: [
        axis("lens", this, { closed, open }, {
          label: "lens",
          key: "o",
          duration: this.openDuration(),
          handles: () => [this.far, ...(this.seen.handles?.() ?? [])],
          via: (from, to) => this.openVia(to === "open"),
        }),
      ],
    }
  }

  /** The two positions of the lens axis. */
  protected openPositions(): { closed: Record<string, number>; open: Record<string, number> } {
    return { closed: { lift: 0 }, open: { lift: 1 } }
  }

  /** How long the opening takes, seconds. */
  protected openDuration(): number {
    return 2.4
  }

  /** The opening (or closing) as a verb. */
  protected openVia(opening: boolean): Anim {
    return this.lift.to(opening ? 1 : 0)
  }

  /** Numbers that move whenever `inside` would answer differently. */
  insideKey(): number[] {
    return this.sideKey()
  }
}

// ─── The lens on a flow ─────────────────────────────────────────────

/**
 * What a FlowLens reads from a flow: its path (in `frame`'s local space,
 * or world space without one) and each particle's place along it, as a
 * fraction of arc length (−1 = hidden). `Stream` (vocabulary/Stream) and
 * FlowMap's `Flow` both answer it.
 */
export interface FlowSource {
  path(): Vec3Like[]
  particles(): number[]
  /** The holon the path is stated in (FlowMap's `stack`; a Stream itself). */
  frame?: Holon
  /**
   * How sure the data behind this flow is (src/certainty.ts), read live —
   * FlowMap: its stage's × its flow's. What the lens SHOWS of the flow (the
   * line, dots, road, trucks) carries it; the lens itself, an instrument,
   * stays crisp. Omitted: certain.
   */
  certainty?: () => number
}

/** What a FlowLens shows of its flow: as certain as the flow is, however crisp the lens. */
export class FlowContent extends Group {
  certainty = certainty(1)
}

export interface FlowLensOptions extends LensOptions {
  /** How many particles the near face can hold at once. Default 4. */
  slots?: number
  /** The particle's radius in the near face (the flow's dot radius). Default 9. */
  dotRadius?: number
  /** The particle's colour. Default BLUE. */
  dotTint?: Color
  /** What a particle becomes. Default a Truck. */
  concreteSymbol?: (overrides: Overrides) => Holon
  /** The flow's line colour. Default WHITE. */
  lineTint?: Color
  /** Half the concrete symbol's height in its own units — how far it rises to stand on the road. Default 116 (a Truck). */
  symbolHalfHeight?: number
  /** The concrete symbol's native length in its own units. Default 650 (a Truck). */
  symbolLength?: number
  /**
   * Ride the flow: the lens's far face sits on the flow's point at this
   * fraction of its arc length, following it as the flow moves (a FlowMap
   * expanding into its stack). Omit to place the lens yourself.
   */
  at?: number
  /**
   * The frame whose ground the concrete world lies on when `align` is 1:
   * its +y is up, and the road runs along the flow. FlowMap's `stack` —
   * so a road in the lens lies in the same 3D plane as the flow it
   * magnifies.
   */
  alignTo?: Holon
}

/**
 * A Lens set on a flow — "the abstract (noosphere) made concrete
 * (biosphere)". Lifted, its near face shows the flow beneath it, a copy
 * carried up toward the camera (so at first it is simply the same line
 * and dots, magnified by proximity). Then `concrete` 0 → 1: the line
 * becomes a Road (MorphCurves, line → edges and dashes) and every dot in
 * the window becomes a Truck driving along it — dots arrive at the rim as
 * dots, become trucks as they cross the middle, and leave as dots again,
 * so the flow stays continuous. Back to 0 and it is all abstract again.
 *
 * The concrete world lies on a ground plane through the near face's
 * centre, turned by `heading` and tipped toward the viewer by `tilt`, and
 * is trimmed to the near face.
 */
export class FlowLens extends Lens {
  /** 0 = the abstract flow (line, dots), 1 = the concrete one (road, trucks). */
  concrete = completion(0)
  /** The ground plane's tip toward the viewer, radians (0 = edge-on, π/2 = face-on). */
  tilt = angle(0.72)
  /** The road's turn within the ground, radians. */
  heading = angle(-0.32)
  /** The concrete symbol's length, as a fraction of the lens's radius — so any lens holds the same picture. */
  symbolSize = scalar(0.98)
  /**
   * 0 = the concrete ground tipped toward the viewer by `tilt`/`heading`;
   * 1 = lying in `alignTo`'s ground, the road along the flow. In between,
   * a blend — so a lens can turn with a map as it tilts into its stack.
   */
  align = completion(0)
  /** How far the road curves across the window, radians (0 = straight). */
  bend = angle(0.5)

  /**
   * The lens's own axis, plus — when it lies over a map's ground (`alignTo`)
   * — the ground it shows: tipped toward the viewer, or aligned with the map.
   */
  override stateSpace(): StateSpace {
    const base = super.stateSpace()
    if (!this.flow?.opts.alignTo || this.align.isBound) return base
    return {
      axes: [
        ...base.axes,
        toggle("lens.align", this.align, {
          label: "lens ground",
          off: ["tipped", 0],
          on: ["aligned", 1],
          duration: 1.2,
          handles: () => [this.far],
        }),
      ],
    }
  }

  private flow!: { source: FlowSource; opts: FlowLensOptions }

  constructor(source: FlowSource, overrides: Overrides & FlowLensOptions = {}) {
    const { slots, dotRadius, dotTint, concreteSymbol, lineTint, symbolHalfHeight, symbolLength, at, alignTo, ...rest } = overrides
    const riding =
      at === undefined
        ? {}
        : {
            x: derive(() => worldOn(source, at).x),
            y: derive(() => worldOn(source, at).y),
            z: derive(() => worldOn(source, at).z),
          }
    super({ ...riding, ...rest })
    this.flow = { source, opts: { slots, dotRadius, dotTint, concreteSymbol, lineTint, symbolHalfHeight, symbolLength, at, alignTo, observer: rest.observer as Observer | undefined } }
  }

  /** The flow's path in lens-local space, with arc lengths, and the window under the far face. */
  private local(): { points: Vec3Like[]; lengths: number[]; s0: number; s1: number } {
    const epoch = paramEpoch()
    if (this.localMemo && this.localEpoch === epoch) return this.localMemo.value
    this.localEpoch = epoch
    const { source } = this.flow
    const frame = source.frame
    const path = source.path()
    // Memoised on everything it reads: the path and both frames' placement.
    const o = toWorld(this, { x: 0, y: 0, z: 0 })
    const ex = toWorld(this, { x: 1, y: 0, z: 0 })
    const ey = toWorld(this, { x: 0, y: 1, z: 0 })
    const fo = frame ? toWorld(frame, { x: 0, y: 0, z: 0 }) : o
    const fx = frame ? toWorld(frame, { x: 1, y: 0, z: 0 }) : ex
    const fy = frame ? toWorld(frame, { x: 0, y: 1, z: 0 }) : ey
    const key = [this.radius.value, o, ex, ey, fo, fx, fy, ...path].map((p) => (typeof p === "number" ? `${p}` : `${p.x},${p.y},${p.z}`)).join("|")
    if (this.localMemo?.key === key) return this.localMemo.value
    const points = path.map((p) => toLocal(this, frame ? toWorld(frame, p) : p))
    const lengths = [0]
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!
      const b = points[i]!
      lengths.push(lengths[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z))
    }
    const L = lengths.at(-1)!
    const r = this.radius.value
    let s0 = -1
    let s1 = -1
    const N = 600
    for (let i = 0; i <= N; i++) {
      const p = atArcLength(points, lengths, (i / N) * L)
      if (Math.hypot(p.x, p.y) < r) {
        if (s0 < 0) s0 = i / N
        s1 = i / N
      }
    }
    const value = { points, lengths, s0, s1 }
    this.localMemo = { key, value }
    return value
  }
  private localEpoch = -1
  private localMemo?: { key: string; value: { points: Vec3Like[]; lengths: number[]; s0: number; s1: number } }

  // Open = lifted AND concrete: the abstract flow lifts into the window,
  // then becomes road and trucks; closing goes back the same way.
  protected override openPositions(): { closed: Record<string, number>; open: Record<string, number> } {
    return { closed: { lift: 0, concrete: 0 }, open: { lift: 1, concrete: 1 } }
  }

  protected override openDuration(): number {
    return 5
  }

  protected override openVia(opening: boolean): Anim {
    return opening
      ? together([this.lift.to(1), 0, 0.45], [this.concrete.to(1), 0.5, 1])
      : together([this.concrete.to(0), 0, 0.5], [this.lift.to(0), 0.55, 1])
  }

  /** A point of the flow at fraction s, carried up into the near face (and scaled with it). */
  private lifted(s: number): Vec3Like {
    const { points, lengths } = this.local()
    const p = atArcLength(points, lengths, s * lengths.at(-1)!)
    const c = this.nearCenter()
    const k = this.nearScale()
    return { x: c.x + p.x * k, y: c.y + p.y * k, z: c.z + p.z * k }
  }

  /**
   * The concrete ground's orientation, lens-local, as h/p/b: the view-
   * tipped basis (tilt, heading) blended by `align` into the aligned one
   * (up = alignTo's +y, x = the flow's direction across the window, made
   * perpendicular to up), orthonormalised, then decomposed in rotHPB's
   * order (M = Rz(b)·Rx(p)·Ry(h): p = asin(ey.z), b = atan2(−ey.x, ey.y),
   * h = atan2(−ex.z, ez.z)).
   */
  groundTurn(): { h: number; p: number; b: number } {
    // Per frame: h, p and b each ask, and so does every toWorld through the ground.
    const epoch = paramEpoch()
    if (this.turnMemo?.epoch === epoch) return this.turnMemo.turn
    const turn = this.groundTurnNow()
    this.turnMemo = { epoch, turn }
    return turn
  }
  private turnMemo?: { epoch: number; turn: { h: number; p: number; b: number } }

  private groundTurnNow(): { h: number; p: number; b: number } {
    const a = this.align.value
    const frame = this.flow.opts.alignTo
    if (a <= 0 || !frame) return { h: this.heading.value, p: this.tilt.value, b: 0 }
    const viewX = rotHPB({ x: 1, y: 0, z: 0 }, this.tilt.value, this.heading.value, 0)
    const viewY = rotHPB({ x: 0, y: 1, z: 0 }, this.tilt.value, this.heading.value, 0)
    const o = toLocal(this, toWorld(frame, { x: 0, y: 0, z: 0 }))
    const u = toLocal(this, toWorld(frame, { x: 0, y: 1, z: 0 }))
    const up = norm3({ x: u.x - o.x, y: u.y - o.y, z: u.z - o.z })
    const { points, lengths, s0, s1 } = this.local()
    const L = lengths.at(-1)!
    const sm = s0 >= 0 ? (s0 + s1) / 2 : 0.5
    const pa = atArcLength(points, lengths, Math.max(0, sm - 0.01) * L)
    const pb = atArcLength(points, lengths, Math.min(1, sm + 0.01) * L)
    let t = { x: pb.x - pa.x, y: pb.y - pa.y, z: pb.z - pa.z }
    const tu = dot3(t, up)
    t = norm3({ x: t.x - up.x * tu, y: t.y - up.y * tu, z: t.z - up.z * tu })
    const mix3 = (p: Vec3Like, q: Vec3Like) => norm3({ x: p.x + (q.x - p.x) * a, y: p.y + (q.y - p.y) * a, z: p.z + (q.z - p.z) * a })
    const ex = mix3(viewX, t)
    let ey = mix3(viewY, up)
    const d = dot3(ex, ey)
    ey = norm3({ x: ey.x - ex.x * d, y: ey.y - ex.y * d, z: ey.z - ex.z * d })
    const ez = { x: ex.y * ey.z - ex.z * ey.y, y: ex.z * ey.x - ex.x * ey.z, z: ex.x * ey.y - ex.y * ey.x }
    return {
      p: Math.asin(Math.max(-1, Math.min(1, ey.z))),
      b: Math.atan2(-ey.x, ey.y),
      h: Math.atan2(-ex.z, ez.z),
    }
  }

  /** Which particle (if any) slot k shows, and where across the window it is, c ∈ [0, 1]. */
  private slot(k: number, K: number): { c: number } | undefined {
    const { s0, s1 } = this.local()
    if (s0 < 0 || s1 <= s0) return undefined
    const ps = this.flow.source.particles()
    for (let i = k; i < ps.length; i += K) {
      const s = ps[i]!
      if (s >= s0 && s <= s1) return { c: (s - s0) / (s1 - s0) }
    }
    return undefined
  }

  protected override compose(): void {
    const { opts, source } = this.flow
    const K = opts.slots ?? 4
    // Everything below is the flow's, not the lens's: it ghosts with the flow
    // (gathered in paint order, handed to one FlowContent at the end).
    const content: Holon[] = []
    const observer = opts.observer
    const shown = () => this.opened()

    // The abstract line in the near face: the flow's span under the far
    // face, lifted. Never drawn itself — the morpher draws it (at rest it
    // IS this line).
    const chord = new Line({ tint: opts.lineTint ?? WHITE, stroke: 0 })
    derivePoints(
      chord,
      () => [...this.insideKey(), this.lift.value],
      () => {
        const { s0, s1 } = this.local()
        if (s0 < 0) return []
        return Array.from({ length: 33 }, (_, i) => this.lifted(s0 + ((s1 - s0) * i) / 32))
      },
    )

    // The concrete world: a ground through the near face's centre.
    const road = new Road({
      tint: opts.lineTint ?? WHITE,
      stroke: 0,
      length: derive(() => this.radius.value * 3),
      width: derive(() => this.radius.value * 0.55),
      dash: derive(() => this.radius.value * 0.12),
      bend: this.bend,
      horizon: 1,
      bound: (p) => this.inside(p),
      boundKey: () => this.insideKey(),
    })
    const concreteOf = (overrides: Overrides) =>
      (opts.concreteSymbol ?? ((o: Overrides) => new Truck({ observer, viewBucket: 0.01, ...o })))(overrides)
    const span = () => this.radius.value * 1.85
    // The symbol's own scale: `symbolSize` radii long, whatever its native length.
    const symbolScale = () => (this.symbolSize.value * this.radius.value) / (opts.symbolLength ?? 650)
    // The near lane: a quarter of the road's width toward the viewer.
    const lane = () => -this.radius.value * 0.55 * 0.25
    const states = Array.from({ length: K }, (_, k) => {
      let memoEpoch = -1
      let memo = { active: false, c: 0, ck: 0, fade: 0 }
      return () => {
        if (memoEpoch === paramEpoch()) return memo
        memoEpoch = paramEpoch()
        const sl = this.slot(k, K)
        if (!sl) return (memo = { active: false, c: 0, ck: 0, fade: 0 })
        const { c } = sl
        // Concrete only across the middle: dots arrive and leave as dots.
        const bump = smooth(0.2, 0.42, c) * smooth(0.84, 0.62, c)
        const fade = smooth(0, 0.05, c) * smooth(1, 0.95, c)
        return (memo = { active: true, c, ck: this.concrete.value * bump, fade })
      }
    })
    const trucks = states.map((st) =>
      concreteOf({
        scale: derive(() => symbolScale()),
        stroke: 0,
        // In the near lane, following the road's curve, standing ON it: the
        // symbol's origin is its middle, so it rises by its half height.
        x: derive(() => road.pointAt((st().c - 0.5) * span(), lane()).x),
        z: derive(() => road.pointAt((st().c - 0.5) * span(), lane()).z),
        h: derive(() => road.headingAt((st().c - 0.5) * span())),
        y: derive(() => (opts.symbolHalfHeight ?? 116) * symbolScale()),
        fillOpacity: derive(() => (st().active ? morphPhases(st().ck).fillIn : 0)),
        opacity: derive(() => (st().active && morphPhases(st().ck).fillIn > 0 ? shown() : 0)),
      }),
    )
    const ground = new Group({
      members: [road, ...trucks],
      x: derive(() => this.nearCenter().x),
      y: derive(() => this.nearCenter().y),
      z: derive(() => this.nearCenter().z),
      h: derive(() => this.groundTurn().h),
      p: derive(() => this.groundTurn().p),
      b: derive(() => this.groundTurn().b),
      scale: derive(() => this.nearScale()),
    })
    // Paint order is occlusion order: the line/road first, then the
    // trucks' solid fills over it, then the particles and their outlines.
    content.push(chord)
    content.push(
      new MorphCurves([chord], [road], {
        observer,
        morph: derive(() => morphPhases(this.concrete.value).morph),
        opacity: derive(() => shown()),
        stroke: this.stroke,
      }),
    )
    content.push(ground)

    // The abstract particles in the near face, and each one's morph.
    const R = opts.dotRadius ?? 9
    const dots = states.map((st, k) => {
      // On the line while the flow is abstract; settling onto the road's
      // near lane as the road forms, so a dot at the window's edge rides
      // the road beside the trucks rather than hovering in the lens plane.
      let atEpoch = -1
      let atMemo: Vec3Like = { x: 0, y: 0, z: 0 }
      const at = () => (atEpoch === paramEpoch() ? atMemo : ((atEpoch = paramEpoch()), (atMemo = atNow())))
      const atNow = (): Vec3Like => {
        const sl = this.slot(k, K)
        const { s0, s1 } = this.local()
        const c = sl ? sl.c : 0
        const onLine = this.lifted(s0 + (s1 - s0) * c)
        const w = morphPhases(this.concrete.value).morph
        if (w <= 0) return onLine
        const onRoad = toLocal(this, toWorld(ground, road.pointAt((c - 0.5) * span(), lane())))
        return {
          x: onLine.x + (onRoad.x - onLine.x) * w,
          y: onLine.y + (onRoad.y - onLine.y) * w,
          z: onLine.z + (onRoad.z - onLine.z) * w,
        }
      }
      return new Circle({
        radius: derive(() => R * this.nearScale()),
        tint: opts.dotTint ?? BLUE,
        stroke: 0,
        fillOpacity: derive(() => 1 - morphPhases(st().ck).fillOut),
        opacity: derive(() => (st().active ? st().fade * shown() : 0)),
        x: derive(() => at().x),
        y: derive(() => at().y),
        z: derive(() => at().z),
      })
    })
    content.push(...dots)
    states.forEach((st, k) =>
      content.push(
        new MorphCurves([dots[k]!], [trucks[k]!], {
          observer,
          morph: derive(() => morphPhases(st().ck).morph),
          opacity: derive(() => (st().active ? st().fade * shown() : 0)),
          stroke: this.stroke,
          capacity: 200,
          relative: true,
        }),
      ),
    )
    const flowContent = new FlowContent({ members: content, certainty: derive(() => source.certainty?.() ?? 1) })
    // Seen only through the near face: the road's geometry is trimmed to it
    // (`bound`), and this keeps every pixel of ink — a stroke's width, an
    // echo's spread, a glow — inside the window too (src/clip.ts).
    clip(flowContent, () => this.disc)
    this.add(flowContent)
  }
}

const dot3 = (a: Vec3Like, b: Vec3Like): number => a.x * b.x + a.y * b.y + a.z * b.z
const norm3 = (a: Vec3Like): Vec3Like => {
  const l = Math.hypot(a.x, a.y, a.z) || 1
  return { x: a.x / l, y: a.y / l, z: a.z / l }
}

/**
 * The flow's point at fraction `at` of its arc length, in world space. Memoised per
 * frame (paramEpoch): the lens's x, y and z each ask, and every toWorld
 * through the lens asks again — unmemoised, a lens riding a FlowMap's
 * flow re-walked the whole path through the stack's frame thousands of
 * times a frame (lens-flowmap: seconds per frame).
 */
const worldOnMemo = new WeakMap<FlowSource, Map<number, { epoch: number; at: Vec3Like }>>()
const worldOn = (source: FlowSource, at: number): Vec3Like => {
  const epoch = paramEpoch()
  let memo = worldOnMemo.get(source)
  if (!memo) worldOnMemo.set(source, (memo = new Map()))
  const hit = memo.get(at)
  if (hit && hit.epoch === epoch) return hit.at
  const p = worldOnNow(source, at)
  memo.set(at, { epoch, at: p })
  return p
}
const worldOnNow = (source: FlowSource, at: number): Vec3Like => {
  const frame = source.frame
  const pts = source.path().map((p) => (frame ? toWorld(frame, p) : p))
  const lengths = [0]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    lengths.push(lengths[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z))
  }
  return atArcLength(pts, lengths, Math.min(1, Math.max(0, at)) * lengths.at(-1)!)
}
