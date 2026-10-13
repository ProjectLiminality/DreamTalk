/**
 * The viewer's camera — orbit, pan and dolly as a LAYER over the authored one.
 *
 * David (2026-10-13): "I can always rotate around the object and look at it
 * from all sides when the timeline is paused in the editor, and by default
 * in the state machine all the time." One mechanism for every scene: 2D-
 * authored, orthographic (FlowMap), perspective, rigs that BIND the observer
 * (EarthView), scenes whose song moves the camera.
 *
 * WHERE IT LIVES. Not in the observer's values (a bound param cannot be
 * written, and a song rewrites the unbound ones every frame) and not in the
 * host's three.js camera (half the vocabulary reads the observer to know
 * where the eye is — Earth's horizon disc, a Lens, a Truck's hidden lines, a
 * Grain's facing — and would disagree with the picture). It lives in the
 * observer's READINGS: `Param.bias` (an offset) and `Param.gate` (a factor),
 * which sit over whatever the timeline, a binding or a rig produces. So the
 * effective pose is one pose, read the same by the host, the picker and
 * every view-dependent holon, and the authored camera keeps moving
 * underneath it.
 *
 * WHAT IT IS. A delta: Δphi, Δtheta (the orbit), a dolly factor (radius in
 * perspective, zoom in orthographic), and a world-space pan of the focus. A
 * `glide` eases the delta to a target (C4D ease, `RETURN_SECONDS`) — reset is
 * a glide to zero, framing a holon a glide to the delta that centres it.
 * Release = delta zero = every bias 0 and gate 1: the pure timeline, exactly.
 *
 * KEEP-OUTS. Orbiting about a focus on a surface (an Earth close-up) can
 * swing the eye inside the solid. A holon may declare `keepOut()`
 * (Holon): world-space spheres the viewer's eye must stay outside. After
 * each write the layer checks the effective eye and, if it is inside one,
 * slides it radially out onto the sphere's shell — re-expressed as the
 * orbit/dolly that puts it there, so the gesture continues from where the
 * eye actually is (the camera rolls over the surface, it never passes
 * through). Perspective only: an orthographic eye has no position that
 * matters to the picture.
 *
 * Nothing in a Dream creates one. Exports, the gauntlet and render-song
 * never see it.
 */

import { orthoHalfHeight, type Observer } from "./dream"
import type { Holon } from "./holon"
import { C4D_SMOOTHING, c4dEaseWith } from "./timeline"

export interface ViewDelta {
  /** Orbit: added to the observer's azimuth / elevation (radians). */
  phi: number
  theta: number
  /** ln of the dolly factor: > 0 further away (radius × e^d; ortho zoom ÷ e^d). */
  dolly: number
  /** Pan: added to the focus point, world units. */
  x: number
  y: number
  z: number
}

/** A world-space sphere the viewer's eye must stay outside (Holon.keepOut). */
export interface KeepOut {
  center: { x: number; y: number; z: number }
  radius: number
}

/**
 * The keep-outs declared under these roots, as a per-frame reading: the
 * declaring holons are found once (a walk of a big scene is not a per-frame
 * cost), their spheres read on every call (they move with their holons).
 */
export const keepOutsOf = (roots: readonly Holon[]): (() => KeepOut[]) => {
  const declarers: Holon[] = []
  for (const r of roots) for (const h of r.walk()) if (h.keepOut() !== undefined) declarers.push(h)
  return () => declarers.flatMap((h) => h.keepOut() ?? [])
}

export const ZERO_VIEW: ViewDelta = { phi: 0, theta: 0, dolly: 0, x: 0, y: 0, z: 0 }

/** A full drag across the viewport turns the view once around (C4D's feel). */
export const ORBIT_PER_WIDTH = 2 * Math.PI
/** A wheel notch multiplies the distance, so the feel is the same at every scale. */
export const DOLLY_PER_NOTCH = 0.0015
/** How long a reset / frame / release glide takes. */
export const RETURN_SECONDS = 0.4
/** Just shy of the poles, where lookAt's up flips and the picture spins. */
export const THETA_LIMIT = Math.PI / 2 - (5 * Math.PI) / 180
/** How much of the frame's height a framed holon fills. */
const FRAME_FILL = 0.6

const ease = (u: number): number => c4dEaseWith(u, C4D_SMOOTHING, C4D_SMOOTHING)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const isZero = (d: ViewDelta) => d.phi === 0 && d.theta === 0 && d.dolly === 0 && d.x === 0 && d.y === 0 && d.z === 0
const lerp = (a: ViewDelta, b: ViewDelta, k: number): ViewDelta => ({
  phi: a.phi + (b.phi - a.phi) * k,
  theta: a.theta + (b.theta - a.theta) * k,
  dolly: a.dolly + (b.dolly - a.dolly) * k,
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
  z: a.z + (b.z - a.z) * k,
})

/** The observer's params a view layer biases. */
const biased = (o: Observer) => [o.phi, o.theta, o.x, o.y, o.z]

export class ViewLayer {
  readonly observer: Observer
  delta: ViewDelta = { ...ZERO_VIEW }
  /** The solids the eye stays out of — read on every apply. */
  keepOuts: () => readonly KeepOut[] = () => []
  #glide: { from: ViewDelta; to: ViewDelta; start: number; seconds: number } | undefined

  constructor(observer: Observer) {
    this.observer = observer
  }

  /** Is the viewer anywhere but on the authored camera (or gliding)? */
  get active(): boolean {
    return this.#glide !== undefined || !isZero(this.delta)
  }

  get gliding(): boolean {
    return this.#glide !== undefined
  }

  // --- gestures (pixel deltas in the viewport's CSS box) --------------------

  /** Orbit by a drag of (dx, dy) over a viewport `width` px wide. */
  orbit(dx: number, dy: number, width: number): void {
    this.#glide = undefined
    const d = this.delta
    d.phi -= (dx / (width || 1)) * ORBIT_PER_WIDTH
    // Elevation is clamped on the EFFECTIVE pose, not the delta alone.
    const authored = this.#authored().theta
    d.theta = clamp(authored + d.theta + (dy / (width || 1)) * ORBIT_PER_WIDTH, -THETA_LIMIT, THETA_LIMIT) - authored
  }

  /** Pan the focus so the picture follows the cursor, (dx, dy) px over a viewport `height` px tall. */
  pan(dx: number, dy: number, height: number): void {
    this.#glide = undefined
    const w = this.worldPerPixel(height)
    const { right, up } = this.#basis()
    const d = this.delta
    d.x += (-dx * right.x + dy * up.x) * w
    d.y += (-dx * right.y + dy * up.y) * w
    d.z += (-dx * right.z + dy * up.z) * w
  }

  /** Dolly by a wheel delta (positive = away). */
  dolly(deltaY: number): void {
    this.#glide = undefined
    this.delta.dolly = clamp(this.delta.dolly + deltaY * DOLLY_PER_NOTCH, -8, 8)
  }

  /**
   * Glide to frame a screen box (the holon's `boundsOf`, in the same
   * pixels as `size`): its centre to the middle, its height to FRAME_FILL.
   */
  frameBox(box: { minX: number; minY: number; maxX: number; maxY: number }, size: { width: number; height: number }, now: number): void {
    const cx = (box.minX + box.maxX) / 2 - size.width / 2
    const cy = (box.minY + box.maxY) / 2 - size.height / 2
    const extent = Math.max(box.maxY - box.minY, (box.maxX - box.minX) * (size.height / size.width), 1)
    const w = this.worldPerPixel(size.height)
    const { right, up } = this.#basis()
    const to = { ...this.delta }
    to.x += (cx * right.x - cy * up.x) * w
    to.y += (cx * right.y - cy * up.y) * w
    to.z += (cx * right.z - cy * up.z) * w
    to.dolly = clamp(this.delta.dolly + Math.log(extent / (FRAME_FILL * size.height)), -8, 8)
    this.glideTo(to, now)
  }

  /** Back to the authored camera — eased, never a cut. */
  reset(now: number, seconds = RETURN_SECONDS): void {
    if (!this.active) return
    this.glideTo({ ...ZERO_VIEW }, now, seconds)
  }

  glideTo(to: ViewDelta, now: number, seconds = RETURN_SECONDS): void {
    this.#glide = { from: { ...this.delta }, to, start: now, seconds }
  }

  /** Advance a glide to `now` (ms). Call once per frame before `apply`. */
  step(now: number): void {
    const g = this.#glide
    if (!g) return
    const u = (now - g.start) / 1000 / g.seconds
    if (u >= 1) {
      this.delta = { ...g.to }
      this.#glide = undefined
      return
    }
    this.delta = lerp(g.from, g.to, ease(Math.max(0, u)))
  }

  // --- the layer ------------------------------------------------------------

  /**
   * Write the delta into the observer's readings. Call after the timeline's
   * apply (the host's `beforeSync`) — elevation is clamped against the
   * authored value of THIS frame, so a song's own camera move cannot push
   * the effective pose over a pole.
   */
  apply(): void {
    const o = this.observer
    const a = this.#authored()
    const d = this.delta
    o.phi.bias = d.phi
    o.theta.bias = clamp(a.theta + d.theta, -THETA_LIMIT, THETA_LIMIT) - a.theta
    o.x.bias = d.x
    o.y.bias = d.y
    o.z.bias = d.z
    const k = Math.exp(d.dolly)
    if (o.orthographic.value) {
      o.radius.gate = 1
      o.zoom.gate = 1 / k
    } else {
      o.radius.gate = k
      o.zoom.gate = 1
      this.#keepOut()
    }
  }

  /** Slide an eye that ended inside a keep-out onto its shell (see KEEP-OUTS). */
  #keepOut(): void {
    const spheres = this.keepOuts()
    if (spheres.length === 0) return
    const o = this.observer
    const f = { x: o.x.value, y: o.y.value, z: o.z.value }
    const zoom = o.zoom.value || 1
    let phi = o.phi.value
    let theta = o.theta.value
    let r = o.radius.value / zoom
    const eye = () => ({
      x: f.x + r * Math.sin(phi) * Math.cos(theta),
      y: f.y + r * Math.sin(theta),
      z: f.z + r * Math.cos(phi) * Math.cos(theta),
    })
    let moved = false
    for (const s of spheres) {
      const e = eye()
      const d = { x: e.x - s.center.x, y: e.y - s.center.y, z: e.z - s.center.z }
      const len = Math.hypot(d.x, d.y, d.z)
      if (len >= s.radius) continue
      const u = len > 1e-9 ? { x: d.x / len, y: d.y / len, z: d.z / len } : { x: 0, y: 1, z: 0 }
      const p = { x: s.center.x + u.x * s.radius - f.x, y: s.center.y + u.y * s.radius - f.y, z: s.center.z + u.z * s.radius - f.z }
      const dist = Math.hypot(p.x, p.y, p.z)
      if (dist < 1e-9) continue
      phi = Math.atan2(p.x, p.z)
      theta = clamp(Math.asin(clamp(p.y / dist, -1, 1)), -THETA_LIMIT, THETA_LIMIT)
      r = dist
      moved = true
    }
    if (!moved) return
    // Re-express the corrected eye as this layer's own delta, so the next
    // gesture starts from it: the short way round in azimuth.
    const dPhi = Math.atan2(Math.sin(phi - o.phi.value), Math.cos(phi - o.phi.value))
    const kR = (r * zoom) / (o.radius.value || 1)
    this.delta.phi += dPhi
    this.delta.theta += theta - o.theta.value
    this.delta.dolly += Math.log(kR)
    o.phi.bias += dPhi
    o.theta.bias += theta - o.theta.value
    o.radius.gate *= kR
  }

  /** Every bias 0, every gate 1 — the authored camera, exactly. */
  release(): void {
    this.#glide = undefined
    this.delta = { ...ZERO_VIEW }
    const o = this.observer
    for (const p of biased(o)) p.bias = 0
    o.radius.gate = 1
    o.zoom.gate = 1
  }

  /** World units per CSS pixel at the focus, for a viewport `height` px tall. */
  worldPerPixel(height: number): number {
    const o = this.observer
    const h = height || 1
    if (o.orthographic.value) return (2 * orthoHalfHeight(o.zoom.value || 1, 16 / 9)) / h
    const r = o.radius.value / (o.zoom.value || 1)
    return (2 * r * Math.tan(o.fov.value / 2)) / h
  }

  /** The observer's pose without this layer (readings minus bias). */
  #authored(): { phi: number; theta: number } {
    const o = this.observer
    return { phi: o.phi.value - o.phi.bias, theta: o.theta.value - o.theta.bias }
  }

  /** The effective camera's right and up, world space (dream.ts spherical convention). */
  #basis() {
    const o = this.observer
    const phi = o.phi.value
    const theta = o.theta.value
    return {
      right: { x: Math.cos(phi), y: 0, z: -Math.sin(phi) },
      up: { x: -Math.sin(theta) * Math.sin(phi), y: Math.cos(theta), z: -Math.sin(theta) * Math.cos(phi) },
    }
  }
}
