/**
 * The LIVE LAYER (EDITOR-V4.md, "The one architectural idea").
 *
 *     value(param, t) = liveOverride(param) ?? timeline.valueAt(param, t)
 *
 * A temporary value that overlays the timeline and yields to it when time
 * advances. Four gestures are the same mechanism wearing different
 * clothes: tweaking an animated parameter, flying the camera around a
 * paused scene, scrubbing without losing what you were inspecting, and
 * (later) dragging an object in the viewport.
 *
 * The contract, verbatim from the spec:
 *
 *  1. `Timeline.apply(t)` writes into params as today. The live layer sits
 *     ABOVE it: this map, consulted AFTER apply, every frame.
 *  2. An override is cleared when the playhead MOVES — play, or a scrub to
 *     a different t. "Editing while paused is exploration; time is truth."
 *  3. An override on a param the timeline never touches is NOT cleared by
 *     time — there is nothing to snap back to. It persists until committed
 *     to code or explicitly reverted.
 *  4. Committing to code (EDITOR.md's `setOverride` op) is the existing
 *     persisted path and is untouched. This is the *live* half.
 *  5. The Observer is a Holon like any other, so flying the camera is just
 *     overrides on phi/theta/radius/x/y. No special case here.
 *
 * And the invariant that makes it safe: this store lives on the EDITOR,
 * never in the Dream. The gauntlet and export construct their own Dream
 * and sample the pure timeline — they cannot see an override, because
 * nothing in core/src knows this file exists.
 *
 * Why an overlay rather than a write into the param: params are rewritten
 * by `Timeline.apply(t)` every frame, so a value written into one is
 * destroyed on the next. The editor got away with it only by pausing
 * first. With the overlay, tweaking-while-playing and snap-back both fall
 * out for free.
 *
 * The overlay's own invariant, which cost a bug to learn: releasing an
 * override must leave NO trace. `apply()` does write into the param (the
 * one place the layer touches the scene, so that the renderer, the picker
 * and the inspector need know nothing about it) — and a param the timeline
 * never animates has nothing to rewrite it on the next frame. So every
 * entry remembers what it displaced, and every release puts it back. Flying
 * the camera hits this immediately: most scenes never animate radius/x/y,
 * so without the restore a flown dolly would quietly become permanent.
 */

import type { Param, ParamValue } from "../src/params"
import type { Timeline } from "../src/timeline"

/** Why an override exists — only for reporting; the rules do not branch on it. */
export type OverrideOrigin = "param" | "observer"

export interface OverrideEntry {
  param: Param<ParamValue>
  value: ParamValue
  origin: OverrideOrigin
  /**
   * What the param held the moment the override was first taken. Needed
   * because `apply()` writes into the param, and a param the timeline
   * never touches has nothing to rewrite it: without this, releasing such
   * an override would leave its last live value behind forever, silently
   * turning a temporary tweak into a permanent one.
   */
  displaced: ParamValue
}

export class Overrides {
  /**
   * The set of params this Dream's timeline animates. Rule 2 applies to
   * exactly these; rule 3 to everything else. Held as a Set so the
   * per-frame path never scans an array.
   */
  readonly #animated: Set<Param<ParamValue>>
  readonly #entries = new Map<Param<ParamValue>, OverrideEntry>()
  readonly #listeners = new Set<(o: Overrides) => void>()

  constructor(timeline: Timeline) {
    this.#animated = new Set(timeline.params)
  }

  /** Does the timeline animate this param? (Rule 2 vs. rule 3.) */
  animates(param: Param<ParamValue>): boolean {
    return this.#animated.has(param as Param<ParamValue>)
  }

  get size(): number {
    return this.#entries.size
  }

  has(param: Param<ParamValue>): boolean {
    return this.#entries.has(param as Param<ParamValue>)
  }

  get(param: Param<ParamValue>): ParamValue | undefined {
    return this.#entries.get(param as Param<ParamValue>)?.value
  }

  /** Every live override, in insertion order. */
  entries(): OverrideEntry[] {
    return [...this.#entries.values()]
  }

  /**
   * Overlay a value. Bound params reject (rule from PARAMETERS: a derived
   * binding is read-only — animate its source instead); the error is the
   * one `Param.value` already throws, raised here so the gesture fails at
   * the gesture, not three frames later inside the render loop.
   */
  set(param: Param<ParamValue>, value: ParamValue, origin: OverrideOrigin = "param"): void {
    if (param.isBound) {
      throw new Error(
        `Param '${param.name ?? param.id}' follows a derived binding; animate its source instead`,
      )
    }
    const existing = this.#entries.get(param as Param<ParamValue>)
    this.#entries.set(param as Param<ParamValue>, {
      param: param as Param<ParamValue>,
      value: param.clamp(value),
      origin,
      // Only the FIRST set of a run records what it displaced; every
      // subsequent one is the same gesture continuing.
      displaced: existing ? existing.displaced : param.value,
    })
    this.#notify()
  }

  /**
   * Drop one override and put back what it displaced.
   *
   * The restore is not cosmetic. `apply()` writes into the param, and a
   * param the timeline never animates has nothing to rewrite it on the
   * next frame — so dropping the entry alone would leave the live value
   * standing forever, which is precisely the "a value written into the
   * param survives" failure the live layer exists to prevent. For an
   * animated param the restore is harmless: `apply(t)` overwrites it
   * immediately with the timeline's own value.
   */
  delete(param: Param<ParamValue>): boolean {
    const entry = this.#entries.get(param as Param<ParamValue>)
    if (!entry) return false
    this.#entries.delete(param as Param<ParamValue>)
    if (!param.isBound) param.value = entry.displaced
    this.#notify()
    return true
  }

  /** Drop several at once, notifying once. */
  release(params: Iterable<Param<ParamValue>>): void {
    let changed = false
    for (const p of params) {
      const entry = this.#entries.get(p as Param<ParamValue>)
      if (!entry) continue
      this.#entries.delete(p as Param<ParamValue>)
      if (!entry.param.isBound) entry.param.value = entry.displaced
      changed = true
    }
    if (changed) this.#notify()
  }

  /** Drop everything, including the persistent ones (an explicit revert-all). */
  clearAll(): void {
    if (this.#entries.size === 0) return
    this.release([...this.#entries.keys()])
  }

  /**
   * Rule 2 + rule 3, together: the playhead moved, so overrides on params
   * the timeline animates snap back; overrides on params it never touches
   * survive, because there is nothing to snap back TO.
   *
   * `except` holds a set back from the clear — used for exactly one thing:
   * a return tween in flight. That tween IS the snap-back for the observer,
   * taking 0.4s instead of one frame, and it releases its own overrides
   * when it lands (EDITOR-V4: "interpolate back … then release").
   *
   * Returns the params that were cleared, so the caller can un-diverge
   * their rows / end their gesture without re-scanning the panel.
   */
  clearOnTimeMove(except?: ReadonlySet<Param<ParamValue>>): Param<ParamValue>[] {
    const cleared: Param<ParamValue>[] = []
    for (const [param] of this.#entries) {
      if (this.#animated.has(param) && !except?.has(param)) cleared.push(param)
    }
    // Only animated params reach here, so `apply(t)` is about to rewrite
    // every one of them — but restoring keeps the store's one invariant
    // (a released override leaves no trace) true without exception.
    for (const param of cleared) {
      const entry = this.#entries.get(param)!
      this.#entries.delete(param)
      if (!param.isBound) param.value = entry.displaced
    }
    if (cleared.length) this.#notify()
    return cleared
  }

  /**
   * The frame path's second step: called AFTER `Timeline.apply(t)`, before
   * the host reads the params to place geometry and camera. Writing into
   * the params (rather than teaching every reader about the overlay) is
   * what keeps the whole renderer, the picker and the inspector ignorant
   * of the live layer — the values they read simply ARE the live values.
   * Nothing persists: the next apply(t) rewrites every animated param.
   */
  apply(): void {
    for (const { param, value } of this.#entries.values()) {
      if (param.isBound) continue
      param.value = value
    }
  }

  subscribe(listener: (o: Overrides) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #notify(): void {
    for (const listener of this.#listeners) listener(this)
  }
}

// --- Flying the Observer: the pose, and the return tween --------------------

/** The five spherical degrees of freedom a flight touches. */
export interface Pose {
  phi: number
  theta: number
  radius: number
  x: number
  y: number
}

/** How long the view takes to fall back to the timeline's pose on play. */
export const RETURN_SECONDS = 0.4

/**
 * Theta is clamped just shy of the poles. Straight overhead the spherical
 * frame is degenerate — lookAt's +y up flips and the picture spins — which
 * is exactly what C4D's own orbit prevents. Five degrees of margin is
 * enough that no drag can reach the singularity.
 */
export const THETA_LIMIT = Math.PI / 2 - 0.087

export const clampTheta = (theta: number): number =>
  Math.max(-THETA_LIMIT, Math.min(THETA_LIMIT, theta))

/** Wrap an angle into (-PI, PI] — the short way round, for the return tween. */
export const shortestAngle = (delta: number): number => {
  const wrapped = ((delta + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
  return wrapped
}

/** The ease the return tween runs on: smooth in, smooth out, C4D-flavoured. */
export const easeInOut = (u: number): number => {
  const c = Math.max(0, Math.min(1, u))
  return c * c * (3 - 2 * c)
}

/**
 * One eased step of the return: from the flown pose toward the timeline's
 * pose at the current t. Azimuth takes the short way round so a flight that
 * wrapped past PI does not unwind the long way; radius interpolates
 * geometrically, which is what a dolly reads as (equal ratios per unit
 * time, not equal distances).
 */
export const lerpPose = (from: Pose, to: Pose, u: number): Pose => {
  const k = easeInOut(u)
  const ratio = from.radius > 0 && to.radius > 0 ? Math.pow(to.radius / from.radius, k) : 1
  return {
    phi: from.phi + shortestAngle(to.phi - from.phi) * k,
    theta: from.theta + (to.theta - from.theta) * k,
    radius: from.radius > 0 && to.radius > 0 ? from.radius * ratio : from.radius + (to.radius - from.radius) * k,
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k,
  }
}

/**
 * Orbit sensitivity: a drag across the full viewport width sweeps this
 * much azimuth. Deliberately independent of radius — C4D orbits at the
 * same angular rate whether you are close or far, because the gesture is
 * about the sphere, not the distance.
 */
export const ORBIT_PER_WIDTH = 2 * Math.PI

/** A dolly notch multiplies the radius, so the feel is the same at every scale. */
export const DOLLY_PER_NOTCH = 0.0015

export const dollyRadius = (radius: number, deltaY: number, min = 1): number =>
  Math.max(min, radius * Math.exp(deltaY * DOLLY_PER_NOTCH))
