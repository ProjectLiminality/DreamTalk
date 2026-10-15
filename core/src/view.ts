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
 * WHAT IT IS. A delta: Δphi, Δtheta (the orbit), Δtilt (the roll about the
 * view axis — a hand holding the scene turns it on every axis), a dolly
 * factor (radius in perspective, zoom in orthographic), and a world-space
 * pan of the focus. `place` sets the delta that puts the eye at any pose. A
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

import { ZOOM_REFERENCE_WIDTH, orthoHalfHeight, type Observer } from "./dream"
import type { Holon } from "./holon"
import { C4D_SMOOTHING, c4dEaseWith } from "./timeline"
import { clamp } from "./math"

export interface ViewDelta {
  /** Orbit: added to the observer's azimuth / elevation (radians). */
  phi: number
  theta: number
  /** Roll about the view axis, added to the observer's tilt (radians). */
  tilt: number
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

/** Rotate v about the unit axis k by angle a (Rodrigues). */
const rotate = (v: { x: number; y: number; z: number }, k: { x: number; y: number; z: number }, a: number) => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const dot = k.x * v.x + k.y * v.y + k.z * v.z
  return {
    x: v.x * c + (k.y * v.z - k.z * v.y) * s + k.x * dot * (1 - c),
    y: v.y * c + (k.z * v.x - k.x * v.z) * s + k.y * dot * (1 - c),
    z: v.z * c + (k.x * v.y - k.y * v.x) * s + k.z * dot * (1 - c),
  }
}

export const ZERO_VIEW: ViewDelta = { phi: 0, theta: 0, tilt: 0, dolly: 0, x: 0, y: 0, z: 0 }

type V = { x: number; y: number; z: number }
const dot = (a: V, b: V) => a.x * b.x + a.y * b.y + a.z * b.z
/** The short way round from a to b. */
const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a))

/**
 * A camera pose: the eye, and its right / up / back unit vectors (world) —
 * the host's camera exactly (render/three-host.ts syncCamera: spherical
 * about the focus, looking at it with +y up, then rolled by tilt).
 */
export interface Pose {
  eye: V
  right: V
  up: V
  back: V
}

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
const isZero = (d: ViewDelta) => d.phi === 0 && d.theta === 0 && d.tilt === 0 && d.dolly === 0 && d.x === 0 && d.y === 0 && d.z === 0
const lerp = (a: ViewDelta, b: ViewDelta, k: number): ViewDelta => ({
  phi: a.phi + (b.phi - a.phi) * k,
  theta: a.theta + (b.theta - a.theta) * k,
  tilt: a.tilt + (b.tilt - a.tilt) * k,
  dolly: a.dolly + (b.dolly - a.dolly) * k,
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
  z: a.z + (b.z - a.z) * k,
})

/** The observer's params a view layer biases. */
const biased = (o: Observer) => [o.phi, o.theta, o.tilt, o.x, o.y, o.z]

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
    if (this.#surfaceOrbit(dx, dy, width)) return
    const d = this.delta
    d.phi -= (dx / (width || 1)) * ORBIT_PER_WIDTH
    // Elevation is clamped on the EFFECTIVE pose, not the delta alone.
    const authored = this.#authored().theta
    d.theta = clamp(authored + d.theta + (dy / (width || 1)) * ORBIT_PER_WIDTH, -THETA_LIMIT, THETA_LIMIT) - authored
  }

  /**
   * SURFACE ORBIT. When the focus sits on (inside) a keep-out — an Earth
   * close-up, its focus on the ground — orbiting about the focus would
   * swing the eye into the solid at once, and the keep-out would pin it
   * there. So the whole view turns about the keep-out's CENTRE instead,
   * eye and focus together, by the angle that moves the ground under the
   * focus as far as the cursor moved: the planet glides beneath the view
   * (Google Earth's drag), the height above it held. Vertical drags carry
   * the view over the poles' latitudes up to the elevation limit.
   */
  #surfaceOrbit(dx: number, dy: number, width: number): boolean {
    const o = this.observer
    if (o.orthographic.value) return false
    const f = { x: o.x.value, y: o.y.value, z: o.z.value }
    const s = this.keepOuts().find((k) => Math.hypot(f.x - k.center.x, f.y - k.center.y, f.z - k.center.z) <= k.radius)
    if (!s) return false
    const c = s.center
    const ground = Math.max(Math.hypot(f.x - c.x, f.y - c.y, f.z - c.z), 1e-6)
    // The drag as a direction on the ground: the focus travels AGAINST the
    // cursor (the ground follows it), so the turn is about the axis normal
    // to both the surface normal and that travel, by the angle that covers
    // the cursor's distance at the ground.
    const w = this.worldPerPixel(width * (9 / 16))
    const phi = o.phi.value
    const theta = o.theta.value
    const r = o.radius.value / (o.zoom.value || 1)
    const eye = {
      x: f.x + r * Math.sin(phi) * Math.cos(theta),
      y: f.y + r * Math.sin(theta),
      z: f.z + r * Math.cos(phi) * Math.cos(theta),
    }
    const { right, up } = this.#basis()
    const n = { x: (f.x - c.x) / ground, y: (f.y - c.y) / ground, z: (f.z - c.z) / ground }
    let t = { x: -dx * right.x + dy * up.x, y: -dx * right.y + dy * up.y, z: -dx * right.z + dy * up.z }
    const tn = t.x * n.x + t.y * n.y + t.z * n.z
    t = { x: t.x - tn * n.x, y: t.y - tn * n.y, z: t.z - tn * n.z }
    const tl = Math.hypot(t.x, t.y, t.z)
    if (tl < 1e-9) return true
    const axisK = {
      x: (n.y * t.z - n.z * t.y) / tl,
      y: (n.z * t.x - n.x * t.z) / tl,
      z: (n.x * t.y - n.y * t.x) / tl,
    }
    const angle = (Math.hypot(dx, dy) * w) / ground
    const turn = (p: { x: number; y: number; z: number }) => {
      const v = rotate({ x: p.x - c.x, y: p.y - c.y, z: p.z - c.z }, axisK, angle)
      return { x: c.x + v.x, y: c.y + v.y, z: c.z + v.z }
    }
    const f2 = turn(f)
    const e2 = turn(eye)
    const v = { x: e2.x - f2.x, y: e2.y - f2.y, z: e2.z - f2.z }
    const len = Math.hypot(v.x, v.y, v.z) || 1
    const theta2 = Math.asin(clamp(v.y / len, -1, 1))
    if (Math.abs(theta2) > THETA_LIMIT) return true // over the pole: hold
    const phi2 = Math.atan2(v.x, v.z)
    const d = this.delta
    d.phi += Math.atan2(Math.sin(phi2 - phi), Math.cos(phi2 - phi))
    d.theta += theta2 - theta
    d.x += f2.x - f.x
    d.y += f2.y - f.y
    d.z += f2.z - f.z
    return true
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

  /**
   * Glide to frame a WORLD-space sphere — a holon's ink bounds — exactly,
   * from wherever the view stands: its centre becomes the focus, and the
   * distance (perspective) or zoom (orthographic) is the one at which it
   * fills FRAME_FILL of the frame's height. The orbit is kept.
   */
  frameSphere(center: { x: number; y: number; z: number }, radius: number, now: number): void {
    const o = this.observer
    const raw = (p: { value: number; bias: number; gate: number }) => (p.value - p.bias) / (p.gate || 1)
    const to = { ...this.delta }
    to.x = center.x - raw(o.x)
    to.y = center.y - raw(o.y)
    to.z = center.z - raw(o.z)
    const R = Math.max(radius, 1e-3)
    const zoomRaw = raw(o.zoom) || 1
    if (o.orthographic.value) {
      const z = ZOOM_REFERENCE_WIDTH / (2 * (16 / 9) * (R / FRAME_FILL))
      to.dolly = clamp(Math.log(zoomRaw / z), -8, 8)
    } else {
      const want = R / (FRAME_FILL * Math.tan(o.fov.value / 2))
      to.dolly = clamp(Math.log(want / (raw(o.radius) / zoomRaw)), -8, 8)
    }
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
    o.tilt.bias = d.tilt
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

  /** The effective camera's pose, from the observer's readings (what the host draws). */
  pose(): Pose {
    const o = this.observer
    const phi = o.phi.value
    const theta = o.theta.value
    const t = o.tilt.value
    const r = o.orthographic.value ? o.radius.value : o.radius.value / (o.zoom.value || 1)
    const back = { x: Math.sin(phi) * Math.cos(theta), y: Math.sin(theta), z: Math.cos(phi) * Math.cos(theta) }
    const { right: r0, up: u0 } = this.#basis()
    const c = Math.cos(t)
    const s = Math.sin(t)
    return {
      eye: { x: o.x.value + back.x * r, y: o.y.value + back.y * r, z: o.z.value + back.z * r },
      right: { x: r0.x * c + u0.x * s, y: r0.y * c + u0.y * s, z: r0.z * c + u0.z * s },
      up: { x: -r0.x * s + u0.x * c, y: -r0.y * s + u0.y * c, z: -r0.z * s + u0.z * c },
      back,
    }
  }

  /**
   * Put the effective camera at a pose — the inverse of `pose()`: the
   * orbit and roll that face it that way, the focus at the same distance
   * ahead of the eye it is now (the dolly is kept). What a hand holding the
   * scene writes every frame (demo/handplay.ts). Takes effect at `apply`.
   */
  place(p: Pose): void {
    this.#glide = undefined
    const o = this.observer
    const r = o.orthographic.value ? o.radius.value : o.radius.value / (o.zoom.value || 1)
    const phi = Math.atan2(p.back.x, p.back.z)
    const theta = Math.asin(clamp(p.back.y, -1, 1))
    const r0 = { x: Math.cos(phi), y: 0, z: -Math.sin(phi) }
    const u0 = { x: -Math.sin(theta) * Math.sin(phi), y: Math.cos(theta), z: -Math.sin(theta) * Math.cos(phi) }
    const tilt = Math.atan2(dot(p.right, u0), dot(p.right, r0))
    // Against the AUTHORED readings (value − bias), so placing twice before an
    // apply is placing once; angles the short way from the delta's own, so
    // the orbit stays continuous through ±π.
    const d = this.delta
    const raw = (q: { value: number; bias: number }) => q.value - q.bias
    d.phi += turn(raw(o.phi) + d.phi, phi)
    d.theta = theta - raw(o.theta)
    d.tilt += turn(raw(o.tilt) + d.tilt, tilt)
    d.x = p.eye.x - p.back.x * r - raw(o.x)
    d.y = p.eye.y - p.back.y * r - raw(o.y)
    d.z = p.eye.z - p.back.z * r - raw(o.z)
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
