/**
 * The pinch cursor — clicking in free air where the fingers meet.
 *
 * David (2026-10-15): "the equivalent of hovering the pen over the
 * reMarkable … so you can see where you would click … when I do the
 * pinching motion, the point doesn't move … I can trigger a click without
 * moving the cursor."
 *
 * THE BIAS. Pinching, the thumb moves far less than the index finger, so the
 * fingers do not meet at their midpoint but much nearer the thumb. A cursor
 * at the midpoint would therefore slide toward the thumb during every pinch
 * and click somewhere else than it hovered. The hover point is instead a
 * WEIGHTED point between thumb tip and index tip, plus a small offset in
 * hand sizes:
 *
 *     hover = w·thumb + (1 − w)·index + o·scale
 *
 * with (w, o) chosen so that, just before a pinch, the hover point already
 * IS where the fingers are about to meet. Defaults suit a typical hand
 * (thumb travels ~⅓ as far as the index → w ≈ 0.75); `fitCalibration`
 * fits them per user from a handful of recorded pinches (least squares).
 *
 * THE ONSET. Whatever residue the bias leaves, the click lands where the
 * cursor was just BEFORE the fingers started to close: on press the cursor
 * locks to the hover point `lookback` seconds earlier (from a short history),
 * and while pinched it moves only by how far the hand has travelled since
 * the press — so a drag starts exactly where the click did. On release it
 * hands back to the live hover point over `handback` seconds, no jump.
 *
 * HYSTERESIS + SMOOTHING. Pinched below `on` (thumb–index gap in hand sizes),
 * released only above `off`, so a gap hovering at the threshold cannot
 * chatter; the hover point runs through a One-Euro filter. Everything is
 * timed on the frame clock: a replay gives the same clicks.
 */

import { OneEuro, OneEuro2, type OneEuroOpts } from "./oneeuro"
import { J, pinchGap, type Hand } from "./hand"

export interface PinchCalibration {
  /** Thumb weight in the hover point (1 − w on the index tip). */
  w: number
  /** Offset in hand sizes (screen x, y). */
  ox: number
  oy: number
}

export const DEFAULT_CALIBRATION: PinchCalibration = { w: 0.75, ox: 0, oy: 0 }

export interface PinchOpts {
  calibration?: PinchCalibration
  /** Gap (hand sizes) below which the fingers are pinched. */
  on?: number
  /** Gap above which a pinch is released (> on: hysteresis). */
  off?: number
  /** Gap at which the approach begins to show (the gold point starts to grow). */
  approach?: number
  /** Seconds before the press whose hover point the click takes. */
  lookback?: number
  /** Seconds the cursor takes to hand back to the hover point after release. */
  handback?: number
  filter?: OneEuroOpts
}

/** One pinch onset, as calibration needs it (all in screen units). */
export interface PinchSample {
  /** Thumb and index tips `lookback` before the press. */
  thumb: { x: number; y: number }
  index: { x: number; y: number }
  /** Where the fingers met: their midpoint at the pinch's closest gap. */
  contact: { x: number; y: number }
  scale: number
}

export interface CursorState {
  /** Is a hand being tracked? */
  tracked: boolean
  /** The cursor, screen units [0,1]². */
  x: number
  y: number
  /**
   * Its depth: the hover point's z in the box's width units, + toward the
   * screen, 0 at the box's centre — where a spatial cursor stands in front
   * of or behind the focus. Smoothed and locked through a pinch like x, y.
   */
  z: number
  /** 0 fingers apart … 1 touching — the hover glyph grows with it. */
  approach: number
  pinched: boolean
  /** This frame began a pinch (a click / drag start). */
  pressed: boolean
  /** This frame ended one. */
  released: boolean
  /**
   * On RELEASE, the completed pinch as calibration needs it: the tips just
   * before the press, and where they actually met (the closest gap).
   */
  sample?: PinchSample
}

const xy = (j: readonly number[]) => ({ x: j[0]!, y: j[1]! })

export class PinchCursor {
  calibration: PinchCalibration
  readonly on: number
  readonly off: number
  readonly approachAt: number
  readonly lookback: number
  readonly handback: number
  readonly #filter: OneEuro2
  readonly #depth: OneEuro
  /** Recent (t, hover, thumb, index, scale) — enough for the lookback. */
  #history: { t: number; hover: { x: number; y: number; z: number }; thumb: { x: number; y: number }; index: { x: number; y: number }; scale: number }[] = []
  #pinched = false
  #lock?: { at: { x: number; y: number; z: number }; from: { x: number; y: number; z: number } }
  /** The pinch in progress, for its calibration sample. */
  #pending?: { sample: PinchSample; gap: number }
  #handback?: { from: { x: number; y: number; z: number }; t: number }
  #last: CursorState = { tracked: false, x: 0.5, y: 0.5, z: 0, approach: 0, pinched: false, pressed: false, released: false }

  constructor(opts: PinchOpts = {}) {
    this.calibration = opts.calibration ?? { ...DEFAULT_CALIBRATION }
    // David's hand over the Leap (2026-10-15, ~6k frames): pinched 0.15–0.22,
    // his relaxed hand 0.32–0.45, open 0.6–0.8; the gap jitters < 0.006 a
    // frame. A release must come before the relaxed hand: off 0.30.
    this.on = opts.on ?? 0.25
    this.off = opts.off ?? 0.3
    this.approachAt = opts.approach ?? 0.65
    this.lookback = opts.lookback ?? 0.1
    this.handback = opts.handback ?? 0.15
    this.#filter = new OneEuro2(opts.filter ?? { minCutoff: 1.5, beta: 8 })
    this.#depth = new OneEuro(opts.filter ?? { minCutoff: 1.5, beta: 8 })
  }

  /** The raw (unfiltered) hover point of a hand under the current calibration. */
  hoverOf(hand: Hand): { x: number; y: number } {
    const { w, ox, oy } = this.calibration
    const T = hand.joints[J.thumbTip]!
    const I = hand.joints[J.indexTip]!
    return { x: w * T[0] + (1 - w) * I[0] + ox * hand.scale, y: w * T[1] + (1 - w) * I[1] + oy * hand.scale }
  }

  /** Advance with this frame's hand (undefined: none tracked) at time t. */
  update(hand: Hand | undefined, t: number): CursorState {
    if (!hand) {
      // Losing the hand releases a pinch — never a stuck button.
      const released = this.#pinched
      this.#pinched = false
      this.#lock = undefined
      this.#history = []
      this.#filter.reset()
      this.#depth.reset()
      this.#last = { ...this.#last, tracked: false, approach: 0, pinched: false, pressed: false, released }
      return this.#last
    }
    const T = hand.joints[J.thumbTip]!
    const I = hand.joints[J.indexTip]!
    const gap = pinchGap(hand)
    const { w } = this.calibration
    const hover = { ...this.#filter.filter(this.hoverOf(hand), t), z: this.#depth.filter(w * T[2] + (1 - w) * I[2], t) }
    this.#history.push({ t, hover, thumb: xy(T), index: xy(I), scale: hand.scale })
    while (this.#history.length > 2 && this.#history[0]!.t < t - Math.max(0.5, 3 * this.lookback)) this.#history.shift()

    let pressed = false
    let released = false
    let sample: PinchSample | undefined
    if (!this.#pinched && gap < this.on) {
      this.#pinched = pressed = true
      const before = this.#at(t - this.lookback)
      this.#lock = { at: before.hover, from: hover }
      this.#handback = undefined
      this.#pending = {
        sample: { thumb: before.thumb, index: before.index, contact: { x: (T[0] + I[0]) / 2, y: (T[1] + I[1]) / 2 }, scale: before.scale },
        gap,
      }
    } else if (this.#pinched && gap > this.off) {
      this.#pinched = false
      released = true
      sample = this.#pending?.sample
      this.#pending = undefined
    }
    // While pinched, the contact is wherever the tips came CLOSEST.
    if (this.#pinched && this.#pending && gap < this.#pending.gap) {
      this.#pending.gap = gap
      this.#pending.sample.contact = { x: (T[0] + I[0]) / 2, y: (T[1] + I[1]) / 2 }
    }

    let x = hover.x
    let y = hover.y
    let z = hover.z
    if (this.#pinched && this.#lock) {
      // Locked at the pre-press hover point; a drag moves it by the hand's travel since.
      x = this.#lock.at.x + (hover.x - this.#lock.from.x)
      y = this.#lock.at.y + (hover.y - this.#lock.from.y)
      z = this.#lock.at.z + (hover.z - this.#lock.from.z)
    } else if (released) {
      this.#handback = { from: { x: this.#last.x, y: this.#last.y, z: this.#last.z }, t }
      x = this.#last.x
      y = this.#last.y
      z = this.#last.z
      this.#lock = undefined
    } else if (this.#handback) {
      const u = Math.min(1, (t - this.#handback.t) / this.handback)
      const e = u * u * (3 - 2 * u)
      x = this.#handback.from.x + (hover.x - this.#handback.from.x) * e
      y = this.#handback.from.y + (hover.y - this.#handback.from.y) * e
      z = this.#handback.from.z + (hover.z - this.#handback.from.z) * e
      if (u >= 1) this.#handback = undefined
    }
    const approach = Math.min(1, Math.max(0, (this.approachAt - gap) / (this.approachAt - this.on)))
    this.#last = { tracked: true, x, y, z, approach, pinched: this.#pinched, pressed, released, sample }
    return this.#last
  }

  /** The history sample at (or just after) time t — the oldest if t is before it. */
  #at(t: number) {
    const h = this.#history
    for (let i = h.length - 1; i >= 0; i--) if (h[i]!.t <= t) return h[i]!
    return h[0]!
  }
}

/**
 * Fit (w, o) to recorded pinch onsets: the hover point before each pinch
 * should equal where the fingers met — `contact ≈ w·thumb + (1 − w)·index
 * + o·scale` — linear in (w, ox, oy), solved by least squares. Needs ≥ 2
 * samples with the fingers apart in different directions; returns the
 * default otherwise. w is held to [0, 1].
 */
export const fitCalibration = (samples: readonly PinchSample[]): PinchCalibration => {
  // Normal equations for unknowns (w, ox, oy): rows [dx, s, 0] = cx − ix and [dy, 0, s] = cy − iy.
  const A = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  const b = [0, 0, 0]
  const add = (row: number[], rhs: number) => {
    for (let i = 0; i < 3; i++) {
      b[i]! += row[i]! * rhs
      for (let j = 0; j < 3; j++) A[i]![j]! += row[i]! * row[j]!
    }
  }
  for (const s of samples) {
    add([s.thumb.x - s.index.x, s.scale, 0], s.contact.x - s.index.x)
    add([s.thumb.y - s.index.y, 0, s.scale], s.contact.y - s.index.y)
  }
  const sol = solve3(A, b)
  if (!sol || samples.length < 2) return { ...DEFAULT_CALIBRATION }
  return { w: Math.min(1, Math.max(0, sol[0]!)), ox: sol[1]!, oy: sol[2]! }
}

/** Gaussian elimination with partial pivoting; undefined if singular. */
const solve3 = (A: number[][], b: number[]): number[] | undefined => {
  const m = A.map((r, i) => [...r, b[i]!])
  for (let c = 0; c < 3; c++) {
    let p = c
    for (let r = c + 1; r < 3; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[p]![c]!)) p = r
    if (Math.abs(m[p]![c]!) < 1e-12) return undefined
    ;[m[c], m[p]] = [m[p]!, m[c]!]
    for (let r = 0; r < 3; r++) {
      if (r === c) continue
      const f = m[r]![c]! / m[c]![c]!
      for (let k = c; k < 4; k++) m[r]![k]! -= f * m[c]![k]!
    }
  }
  return [m[0]![3]! / m[0]![0]!, m[1]![3]! / m[1]![1]!, m[2]![3]! / m[2]![2]!]
}
