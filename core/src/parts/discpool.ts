/**
 * DiscPool — many filled discs (particles) as ONE fill mesh.
 *
 * A flow's particle is a filled disc; hundreds of them as hundreds of fills
 * are hundreds of draws (plus, uncertain, six echo fills each). A DiscPool
 * is one Surface — a transparent sheet — holding all its members' discs,
 * each at its member's place, size and colour, each at its own opacity
 * through the Surface's per-vertex `alphas` and `colors`:
 *
 *   - a member is any holon whose ORIGIN is the disc's centre (a Grain, a
 *     particle's carrier); its own seen opacity (certainty.ts seenOpacity:
 *     its fade, the presence and the certainty ghost of its whole chain)
 *     over the pool's (which the host already applies to the sheet), times
 *     the disc's `fill`, is the disc's alpha — so a fiber's focus, a
 *     receding side, a conjectured stage all reach their own discs;
 *   - a disc faces the camera (`face: "camera"`, a Grain's dot) or lies in
 *     its member's own XY plane (`"plane"`, a flat particle on a tipped
 *     figure), exactly as its separate fill would have;
 *   - an uncertain disc keeps its own PROBABILITY CLOUD: the host's echo
 *     recipe (render/superposition.ts — ECHOES discs orbiting
 *     CLOUD_PX·(1 − c) pixels off, a little larger, faint and breathing) is
 *     drawn into the same mesh right after it, at its own seed, so the
 *     discs of a pool shimmer independently. The cloud's clock is `time`
 *     (scene seconds), 0 without one;
 *   - a disc at zero is left out of the mesh.
 *
 * The discs are drawn in member order within the one mesh, so where two
 * overlap at partial opacity the later composites over the earlier — as
 * their separate fills did, in attach order.
 *
 * The camera that faces its discs and sizes its clouds is `observer` if
 * given, else the host's LIVE eye (frames.ts liveObserver — whatever it is
 * rendering with now), else the framework's default eye (tests).
 *
 * Place it in a frame that holds its members (a flow, a figure) and `join`
 * each member with its look. One implementation for every particle
 * population: Grain's dots (vocabulary/Grain `DotPool` is this), SOPLoop's
 * particles.
 */

import type { Color } from "../constants"
import type { Observer } from "../dream"
import type { Holon, Overrides } from "../holon"
import { certaintyOf, seenOpacity } from "../certainty"
import { derive, memoReads, type Readable } from "../params"
import { orthoHalfHeight } from "../dream"
import { liveObserver, localView, toLocal, toWorld, viewOf } from "../geometry/frames"
import { CLOUD_PX, ECHOES, echoBreath, echoOffset } from "../render/superposition"
import { WHITE } from "../constants"
import { Surface } from "./surface"
import type { Vec3Like } from "./primitives"

/** How a member's disc looks, read every frame. */
export interface DiscLook {
  /** Radius, in the member's own units. */
  radius: () => number
  /** Colour. */
  tint: () => Color
  /** How much of the disc's fill shows, beyond the member's seen opacity. Default 1. */
  fill?: () => number
  /** Facing the camera (default) or lying in the member's own XY plane. */
  face?: "camera" | "plane"
  /** Snap a camera-facing disc's view direction (a Grain's view grid). */
  snap?: (k: Vec3Like) => Vec3Like
}

/** Disc vertices (one centre + this many around). */
const SEGMENTS = 48

/** A holon's scale in the world: the product of every scale up its chain. */
const worldScale = (h: Holon): number => {
  let s = 1
  for (let n: Holon | undefined = h; n; n = n.parent) s *= Math.abs(n.scale.value)
  return s
}

export class DiscPool extends Surface {
  private crowd!: { members: { holon: Holon; look: DiscLook }[]; observer?: Observer; time?: Readable<number> }
  // The seen-opacity readers (certainty.ts), made at the first build — the
  // tree is final by then.
  private seen?: { pool: Readable<number>; members: Map<Holon, Readable<number>> }

  constructor(overrides: Overrides & { observer?: Observer; time?: Readable<number> } = {}) {
    const { observer, time, ...rest } = overrides
    super(rest)
    this.crowd = { members: [], observer, time }
    // The colours ride the vertices; the sheet's own tint is white.
    this.tint.follow(derive(() => WHITE))
    const now = memoReads(() => this.build())
    let last: unknown
    let version = 0
    Object.defineProperty(this, "geomVersion", {
      configurable: true,
      get: () => {
        const m = now()
        if (m !== last) {
          last = m
          version++
        }
        return version
      },
      set() {},
    })
    Object.defineProperty(this, "positions", { configurable: true, get: () => now().positions, set() {} })
    Object.defineProperty(this, "indices", { configurable: true, get: () => now().indices, set() {} })
    Object.defineProperty(this, "alphas", { configurable: true, get: () => now().alphas, set() {} })
    Object.defineProperty(this, "colors", { configurable: true, get: () => now().colors, set() {} })
  }

  /** A member's disc joins the pool, drawn after those already in it. */
  join(holon: Holon, look: DiscLook): void {
    this.crowd.members.push({ holon, look })
  }

  /** The members, in drawing order. */
  get members(): readonly Holon[] {
    return this.crowd.members.map((m) => m.holon)
  }

  private build(): { positions: Float32Array; indices: Uint32Array; alphas: Float32Array; colors: Float32Array } {
    // The camera: the one given, else the one the host renders with now
    // (frames.ts live eye) — so the clouds are sized right with no wiring.
    const o = this.crowd.observer ?? liveObserver()
    const view = localView(this, o ? viewOf(o) : { eye: { x: 0, y: 0, z: 1500 } })
    const scale = worldScale(this) || 1
    this.seen ??= { pool: seenOpacity(this), members: new Map() }
    const poolSeen = this.seen.pool.value
    const empty = { positions: new Float32Array(0), indices: new Uint32Array(0), alphas: new Float32Array(0), colors: new Float32Array(0) }
    if (poolSeen <= 0) return empty
    const seenOf = (h: Holon): number => {
      let r = this.seen!.members.get(h)
      if (!r) this.seen!.members.set(h, (r = seenOpacity(h)))
      return r.value
    }
    const pos: number[] = []
    const idx: number[] = []
    const alpha: number[] = []
    const col: number[] = []
    const n = SEGMENTS
    const t = this.crowd.time?.value ?? 0
    // Units per screen pixel in this frame, at a point (a 720-high frame).
    const upp = (c: Vec3Like): number => {
      if (!o) return 1
      if (o.orthographic.value) return (2 * orthoHalfHeight(o.zoom.value || 1, 16 / 9)) / 720 / scale
      const v = viewOf(o)
      if (!("eye" in v)) return 1
      const p = toWorld(this, c)
      const d = Math.hypot(v.eye.x - p.x, v.eye.y - p.y, v.eye.z - p.z)
      return (2 * d * Math.tan(o.fov.value / 2)) / 720 / scale
    }
    const disc = (c: Vec3Like, u: Vec3Like, w: Vec3Like, r: number, a: number, tint: Color) => {
      const base = pos.length / 3
      pos.push(c.x, c.y, c.z)
      alpha.push(a)
      col.push(tint.r, tint.g, tint.b)
      for (let i = 0; i < n; i++) {
        const th = (i / n) * 2 * Math.PI
        const x = Math.cos(th) * r
        const y = Math.sin(th) * r
        pos.push(c.x + u.x * x + w.x * y, c.y + u.y * x + w.y * y, c.z + u.z * x + w.z * y)
        alpha.push(a)
        col.push(tint.r, tint.g, tint.b)
      }
      for (let i = 0; i < n; i++) idx.push(base, base + 1 + i, base + 1 + ((i + 1) % n))
    }
    this.crowd.members.forEach(({ holon: h, look }, mi) => {
      const fill = look.fill ? look.fill() : 1
      if (fill <= 0) return
      const a = (seenOf(h) * fill) / poolSeen
      if (a <= 0) return
      const c = toLocal(this, toWorld(h, { x: 0, y: 0, z: 0 }))
      let u: Vec3Like
      let w: Vec3Like
      if (look.face === "plane") {
        // The member's own x and y axes, carried into the pool's frame.
        const ex = toLocal(this, toWorld(h, { x: 1, y: 0, z: 0 }))
        const ey = toLocal(this, toWorld(h, { x: 0, y: 1, z: 0 }))
        const lx = Math.hypot(ex.x - c.x, ex.y - c.y, ex.z - c.z) || 1
        const ly = Math.hypot(ey.x - c.x, ey.y - c.y, ey.z - c.z) || 1
        u = { x: (ex.x - c.x) / lx, y: (ex.y - c.y) / lx, z: (ex.z - c.z) / lx }
        w = { x: (ey.x - c.x) / ly, y: (ey.y - c.y) / ly, z: (ey.z - c.z) / ly }
      } else {
        // Facing the viewer from the disc's own place: u ⟂ up and the
        // view, w up on screen (a Grain's dot rule, in the pool's frame).
        const d = "eye" in view ? { x: view.eye.x - c.x, y: view.eye.y - c.y, z: view.eye.z - c.z } : view.toward
        const l = Math.hypot(d.x, d.y, d.z) || 1
        let k = { x: d.x / l, y: d.y / l, z: d.z / l }
        if (look.snap) k = look.snap(k)
        u = { x: k.z, y: 0, z: -k.x }
        const lu = Math.hypot(u.x, u.z)
        u = lu > 1e-6 ? { x: u.x / lu, y: 0, z: u.z / lu } : { x: 1, y: 0, z: 0 }
        w = { x: k.y * u.z - k.z * u.y, y: k.z * u.x - k.x * u.z, z: k.x * u.y - k.y * u.x }
      }
      const r = (look.radius() * worldScale(h)) / scale
      const tint = look.tint()
      disc(c, u, w, r, a, tint)
      // Its probability cloud, right after it (superposition.ts's recipe).
      const sure = certaintyOf(h)
      const doubt = 1 - (sure <= 0 ? 0 : sure >= 1 ? 1 : sure)
      if (doubt <= 0) return
      // The offsets are on SCREEN: along the view's right and up at the disc.
      const d = "eye" in view ? { x: view.eye.x - c.x, y: view.eye.y - c.y, z: view.eye.z - c.z } : view.toward
      const l = Math.hypot(d.x, d.y, d.z) || 1
      const k = { x: d.x / l, y: d.y / l, z: d.z / l }
      let sx = { x: k.z, y: 0, z: -k.x }
      const ls = Math.hypot(sx.x, sx.z)
      sx = ls > 1e-6 ? { x: sx.x / ls, y: 0, z: sx.z / ls } : { x: 1, y: 0, z: 0 }
      const sy = { x: k.y * sx.z - k.z * sx.y, y: k.z * sx.x - k.x * sx.z, z: k.x * sx.y - k.y * sx.x }
      const unit = upp(c)
      const seed = mi + 1
      for (let e = 0; e < ECHOES; e++) {
        const off = echoOffset(e, seed, t, CLOUD_PX * doubt)
        const ox = off.x * unit
        const oy = off.y * unit
        const ce = { x: c.x + sx.x * ox + sy.x * oy, y: c.y + sx.y * ox + sy.y * oy, z: c.z + sx.z * ox + sy.z * oy }
        disc(ce, u, w, r * (1 + 0.9 * doubt), a * doubt * 0.24 * echoBreath(e, seed, t), tint)
      }
    })
    return { positions: new Float32Array(pos), indices: new Uint32Array(idx), alphas: new Float32Array(alpha), colors: new Float32Array(col) }
  }
}
