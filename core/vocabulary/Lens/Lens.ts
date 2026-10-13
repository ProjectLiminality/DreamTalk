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
import type { View } from "../../src/geometry/hiddenline"
import { atArcLength, smooth } from "../../src/geometry/flowmap"
import { MorphCurves, morphPhases } from "../Morph/MorphCurves"
import { Road } from "../Road/Road"
import { Truck } from "../Truck/Truck"

export interface LensOptions {
  /** The scene's observer — the lens's contour lines and `inside` are camera-relative. */
  observer?: Observer
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

  protected seen!: { observer?: Observer }

  /** The near face's centre now, lens-local. */
  nearCenter(): Vec3Like {
    const k = this.lift.value
    return { x: this.liftX.value * k, y: this.liftY.value * k, z: this.liftZ.value * k }
  }

  /** Is the window open at all — the near face off the far one? */
  protected opened(): number {
    return Math.min(1, this.lift.value * 25) * this.opacity.value
  }

  far = new Circle({ radius: this.radius, tint: this.tint, stroke: this.stroke, opacity: this.opacity, creation: this.creation })
  sideA = new Line({ tint: this.tint, stroke: this.stroke, opacity: this.opacity })
  sideB = new Line({ tint: this.tint, stroke: this.stroke, opacity: this.opacity })
  disc = new Circle({
    radius: this.radius,
    tint: BLACK,
    stroke: 0,
    fillOpacity: 1,
    opacity: derive(() => this.opened()),
    x: derive(() => this.nearCenter().x),
    y: derive(() => this.nearCenter().y),
    z: derive(() => this.nearCenter().z),
  })
  near = new Circle({
    radius: this.radius,
    tint: this.tint,
    stroke: this.stroke,
    opacity: derive(() => this.opened()),
    x: derive(() => this.nearCenter().x),
    y: derive(() => this.nearCenter().y),
    z: derive(() => this.nearCenter().z),
  })

  constructor(overrides: Overrides & LensOptions = {}) {
    const { observer, ...rest } = overrides
    super({ tint: WHITE, ...rest })
    this.seen = { observer }
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
    return [this.radius.value, c.x, c.y, c.z, ...("eye" in v ? [v.eye.x, v.eye.y, v.eye.z] : [v.toward.x, v.toward.y, v.toward.z, 9])]
  }

  /**
   * The two contour lines of the oblique cylinder from the far rim to the
   * near one, lens-local: the generators A(θ) → A(θ) + L along which the
   * surface's normal is perpendicular to the view ray. Found by a sign
   * scan over θ and bisection; none while the faces coincide.
   */
  sides(): Vec3Like[][] {
    const L = this.nearCenter()
    if (Math.hypot(L.x, L.y, L.z) < 1e-6) return []
    const r = this.radius.value
    const v = this.view()
    const f = (th: number) => {
      const a = { x: r * Math.cos(th), y: r * Math.sin(th), z: 0 }
      const t = { x: -Math.sin(th), y: Math.cos(th), z: 0 }
      const n = { x: t.y * L.z - t.z * L.y, y: t.z * L.x - t.x * L.z, z: t.x * L.y - t.y * L.x }
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
      return [a, { x: a.x + L.x, y: a.y + L.y, z: a.z + L.z }]
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
    return Math.hypot(q.x - c.x, q.y - c.y) < this.radius.value
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
  /** The concrete symbol's scale (a Truck is 650 long). */
  symbolScale = scalar(0.21)
  /** How far the road curves across the window, radians (0 = straight). */
  bend = angle(0.5)

  private flow!: { source: FlowSource; opts: FlowLensOptions }

  constructor(source: FlowSource, overrides: Overrides & FlowLensOptions = {}) {
    const { slots, dotRadius, dotTint, concreteSymbol, lineTint, symbolHalfHeight, ...rest } = overrides
    super(rest)
    this.flow = { source, opts: { slots, dotRadius, dotTint, concreteSymbol, lineTint, symbolHalfHeight, observer: rest.observer as Observer | undefined } }
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

  /** A point of the flow at fraction s, carried up into the near face. */
  private lifted(s: number): Vec3Like {
    const { points, lengths } = this.local()
    const p = atArcLength(points, lengths, s * lengths.at(-1)!)
    const c = this.nearCenter()
    return { x: p.x + c.x, y: p.y + c.y, z: p.z + c.z }
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
    const { opts } = this.flow
    const K = opts.slots ?? 4
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
        scale: this.symbolScale,
        stroke: 0,
        // In the near lane, following the road's curve, standing ON it: the
        // symbol's origin is its middle, so it rises by its half height.
        x: derive(() => road.pointAt((st().c - 0.5) * span(), lane()).x),
        z: derive(() => road.pointAt((st().c - 0.5) * span(), lane()).z),
        h: derive(() => road.headingAt((st().c - 0.5) * span())),
        y: derive(() => (opts.symbolHalfHeight ?? 116) * this.symbolScale.value),
        fillOpacity: derive(() => (st().active ? morphPhases(st().ck).fillIn : 0)),
        opacity: derive(() => (st().active && morphPhases(st().ck).fillIn > 0 ? shown() : 0)),
      }),
    )
    const ground = new Group({
      members: [road, ...trucks],
      x: derive(() => this.nearCenter().x),
      y: derive(() => this.nearCenter().y),
      z: derive(() => this.nearCenter().z),
      p: this.tilt,
      h: this.heading,
    })
    // Paint order is occlusion order: the line/road first, then the
    // trucks' solid fills over it, then the particles and their outlines.
    this.add(chord)
    this.add(
      new MorphCurves([chord], [road], {
        observer,
        morph: derive(() => morphPhases(this.concrete.value).morph),
        opacity: derive(() => shown()),
        stroke: this.stroke,
      }),
    )
    this.add(ground)

    // The abstract particles in the near face, and each one's morph.
    const R = opts.dotRadius ?? 9
    const dots = states.map((st, k) => {
      // On the line while the flow is abstract; settling onto the road's
      // near lane as the road forms, so a dot at the window's edge rides
      // the road beside the trucks rather than hovering in the lens plane.
      const at = () => {
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
        radius: R,
        tint: opts.dotTint ?? BLUE,
        stroke: 0,
        fillOpacity: derive(() => 1 - morphPhases(st().ck).fillOut),
        opacity: derive(() => (st().active ? st().fade * shown() : 0)),
        x: derive(() => at().x),
        y: derive(() => at().y),
        z: derive(() => at().z),
      })
    })
    for (const d of dots) this.add(d)
    states.forEach((st, k) =>
      this.add(
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
  }
}
