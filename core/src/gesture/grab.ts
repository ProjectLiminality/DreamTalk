/**
 * Grab the whole scene — David: "the hands should be able to grab the entire
 * scene basically and turn it, move it as a whole."
 *
 *   one closed hand   — moving it TURNS the scene (the view orbits with the
 *                       hand, as if the scene were held), its depth (z)
 *                       dollies;
 *   two closed hands  — spreading them apart scales up (dolly in), turning
 *                       the pair turns the scene (orbit by the angle), their
 *                       midpoint moving pans — visionOS's two-handed
 *                       manipulation.
 *   release           — the motion carries on and dies away (momentum with
 *                       an exponential decay), so letting go feels natural.
 *
 * Pure: frames in, view deltas out, timed on the frame clock (replay-exact).
 * The deltas are in SCREEN units (x, y ∈ [0,1]) and natural-log dolly; the
 * host maps them onto its ViewLayer (orbit/pan/dolly), whose keep-outs and
 * surface orbit apply as to any other gesture.
 */

import { grabStrength, palm, type Hand } from "./hand"

export interface GrabDelta {
  /** Turn by a drag of this many screen widths / heights (orbit). */
  orbit: { x: number; y: number }
  /** Move the focus by a drag of this many screen widths / heights (pan). */
  pan: { x: number; y: number }
  /** ln of the distance factor (> 0 further away). */
  dolly: number
  /** Is a hand holding the scene (vs. momentum or nothing)? */
  holding: boolean
}

export interface GrabOpts {
  /** Grab strength above which a hand holds… */
  on?: number
  /** …and below which it lets go (hysteresis). */
  off?: number
  /** Momentum's time constant after release, seconds. */
  decay?: number
  /** How strongly one hand's depth dollies (ln-factor per screen width of z travel). */
  depthGain?: number
}

const ZERO = (): GrabDelta => ({ orbit: { x: 0, y: 0 }, pan: { x: 0, y: 0 }, dolly: 0, holding: false })

export class GrabController {
  readonly on: number
  readonly off: number
  readonly decay: number
  readonly depthGain: number
  #holding = new Set<number>()
  #prev = new Map<number, { x: number; y: number; z: number }>()
  #pair?: { d: number; a: number; mx: number; my: number }
  /** Velocity of the last held motion (per second), for momentum. */
  #vel: GrabDelta = ZERO()
  #t?: number
  #wasHolding = false

  constructor(opts: GrabOpts = {}) {
    this.on = opts.on ?? 0.7
    this.off = opts.off ?? 0.45
    this.decay = opts.decay ?? 0.25
    this.depthGain = opts.depthGain ?? 4
  }

  /** Which of these hands are holding (after this frame's hysteresis)? */
  holders(hands: readonly Hand[]): Hand[] {
    return hands.filter((h) => this.#holding.has(h.id))
  }

  isHolding(id: number): boolean {
    return this.#holding.has(id)
  }

  update(hands: readonly Hand[], t: number): GrabDelta {
    const dt = this.#t === undefined ? 0 : Math.max(0, t - this.#t)
    this.#t = t
    for (const h of hands) {
      // A natural pinch (the other fingers curled, the index out front to
      // meet the thumb) reads ~0.4 here, a fist 1: curl alone tells them apart.
      const g = grabStrength(h)
      if (this.#holding.has(h.id) ? g < this.off : g > this.on) {
        if (this.#holding.has(h.id)) this.#holding.delete(h.id)
        else this.#holding.add(h.id)
        this.#prev.delete(h.id)
        this.#pair = undefined
      }
    }
    // Hands that vanished let go.
    for (const id of [...this.#holding]) if (!hands.some((h) => h.id === id)) {
      this.#holding.delete(id)
      this.#prev.delete(id)
      this.#pair = undefined
    }
    const held = hands.filter((h) => this.#holding.has(h.id))
    const out = ZERO()
    const was = this.#wasHolding
    this.#wasHolding = held.length > 0
    if (held.length === 0) {
      // Momentum: the last motion, decaying.
      if (dt > 0) {
        const k = Math.exp(-dt / this.decay)
        const v = this.#vel
        v.orbit.x *= k
        v.orbit.y *= k
        v.pan.x *= k
        v.pan.y *= k
        v.dolly *= k
        out.orbit = { x: v.orbit.x * dt, y: v.orbit.y * dt }
        out.pan = { x: v.pan.x * dt, y: v.pan.y * dt }
        out.dolly = v.dolly * dt
      }
      return out
    }
    out.holding = true
    if (!was) this.#vel = ZERO()
    if (held.length === 1) {
      const h = held[0]!
      const p = palm(h)
      const prev = this.#prev.get(h.id)
      this.#prev.set(h.id, { x: p[0], y: p[1], z: p[2] })
      if (prev) {
        // The scene follows the hand: a hand moving right turns the scene's
        // front to the right — the view orbits the other way.
        out.orbit = { x: p[0] - prev.x, y: p[1] - prev.y }
        out.dolly = (p[2] - prev.z) * this.depthGain
      }
    } else {
      const [a, b] = held as [Hand, Hand]
      const pa = palm(a)
      const pb = palm(b)
      const d = Math.hypot(pb[0] - pa[0], pb[1] - pa[1])
      const ang = Math.atan2(pb[1] - pa[1], pb[0] - pa[0])
      const mx = (pa[0] + pb[0]) / 2
      const my = (pa[1] + pb[1]) / 2
      const prev = this.#pair
      this.#pair = { d, a: ang, mx, my }
      if (prev && prev.d > 1e-6 && d > 1e-6) {
        out.dolly = -Math.log(d / prev.d) // apart = closer
        let da = ang - prev.a
        da = Math.atan2(Math.sin(da), Math.cos(da))
        // A turn of the pair turns the scene: one full width of orbit is a full turn.
        out.orbit = { x: da / (2 * Math.PI), y: 0 }
        out.pan = { x: mx - prev.mx, y: my - prev.my }
      }
    }
    if (dt > 0) {
      // Momentum takes a smoothed velocity: one frame's is too jittery to fling with.
      const v = this.#vel
      const k = 0.5
      v.orbit.x += k * (out.orbit.x / dt - v.orbit.x)
      v.orbit.y += k * (out.orbit.y / dt - v.orbit.y)
      v.pan.x += k * (out.pan.x / dt - v.pan.x)
      v.pan.y += k * (out.pan.y / dt - v.pan.y)
      v.dolly += k * (out.dolly / dt - v.dolly)
    }
    return out
  }
}
