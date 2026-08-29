/**
 * MindVirus — a manipulative narrative that controls and extracts
 * energy. The eye sees; the cube entraps. (TheWall/MindVirus/
 * MindVirus.py, rebuilt on the real parts — the PNG-as-eye ImagePlane
 * hack dies here: the eye is the parametric MolochEye.)
 *
 * ## Anatomy
 *
 *  - `molochEye` at the creature's face, drawn in the local xy plane,
 *    gazing along local +z — the FORWARD direction (the original's
 *    "z-"; the axis flips with the C4D→host handedness, the creature's
 *    face still leads its motion).
 *  - `cube`, a FoldableCube pitched −PI/2 so its open top points AFT:
 *    at fold 1 the four walls trail behind like a jellyfish's bell,
 *    the bottom face becomes the creature's front, and the eye rides
 *    its center (z = +2, the original's 2-unit lift off the face).
 *  - `cable`, the trail Cable — given this creature's own pure path,
 *    so the whole composite stays f(t).
 *
 * ## The jellyfish pulse (MindVirus.py:1060-1125, thrust_pulse)
 *
 * Three phases over one pulse, timed 30% / 20% / 50% of its span with
 * 5% / 55% / 40% of its distance:
 *
 *   OPEN    fold 1 → 0.1   the bell spreads, almost no headway
 *   THRUST  fold 0.1 → 1   the bell snaps shut, the burst of speed
 *   GLIDE   fold stays 1   coasting on momentum
 *
 * Each phase eases with the C4D default tangents (the original's
 * per-phase ScalarAnimations). The profile lives in two pure functions
 * — pulseFold(u) and pulseDistance(u) — that BOTH spellings of motion
 * share: `thrustPulse()` samples them into an Anim (the free-swimming
 * ability), and a `journey` derives the whole transform from `clock`
 * through them (the pure-timeline spelling the trail needs: DECISIONS
 * 2026-08-29, "a trail of a pure motion is itself pure"). One profile,
 * two addresses; they cannot drift apart.
 *
 * In journey mode x/y/z/h/p and fold FOLLOW the clock (derived
 * bindings); animate `clock` linearly and everything else is geometry.
 * thrustPulse() is for a free creature — its tracks would collide with
 * the journey's bindings, so use one spelling per scene.
 */

import { Holon } from "../holon"
import { bipolar, derive, scalar } from "../params"
import { state } from "../params"
import { eased, together, type Anim } from "../anim"
import { ease } from "../timeline"
import { type Vec3Like } from "./index"
import { FoldableCube } from "./foldablecube"
import { Cable } from "./cable"
import { MolochEye } from "./molocheye"
import { PI } from "../constants"

export interface PulseShares {
  /** Time fraction of the OPEN phase (0.30 in the source). */
  open: number
  /** Time fraction of the THRUST phase (0.20 in the source). */
  thrust: number
  /**
   * Optional dwell at full spread between open and thrust — the bell
   * held wide. Not in the source's thrust_pulse, but the reference
   * render's exit pulse visibly holds its bell open for ~0.5s before
   * the final snap; distance drifts a slow 5% share through it.
   */
  hold?: number
}

export const PULSE_SHARES: PulseShares = { open: 0.3, thrust: 0.2 }
/** Distance fractions per phase — open/thrust/glide = 5% / 55% / 40%. */
export const PULSE_DISTANCE_SHARES = { open: 0.05, thrust: 0.55 }
export const PULSE_MIN_FOLD = 0.1

/** The bell over one pulse: fold as a pure function of pulse phase u. */
export const pulseFold = (
  u: number,
  shares: PulseShares = PULSE_SHARES,
  minFold: number = PULSE_MIN_FOLD,
): number => {
  const openEnd = shares.open
  const holdEnd = openEnd + (shares.hold ?? 0)
  const thrustEnd = holdEnd + shares.thrust
  if (u <= 0) return 1
  if (u < openEnd) return 1 + (minFold - 1) * ease("smooth", u / openEnd)
  if (u < holdEnd) return minFold
  if (u < thrustEnd) return minFold + (1 - minFold) * ease("smooth", (u - holdEnd) / shares.thrust)
  return 1
}

/** Headway over one pulse: distance fraction as a pure function of u. */
export const pulseDistance = (
  u: number,
  shares: PulseShares = PULSE_SHARES,
  distance: { open: number; thrust: number } = PULSE_DISTANCE_SHARES,
): number => {
  const openEnd = shares.open
  const holdShare = shares.hold ?? 0
  const holdEnd = openEnd + holdShare
  const thrustEnd = holdEnd + shares.thrust
  const { open, thrust } = distance
  // With a hold, its slow drift takes 5% and the thrust yields it back.
  const hold = holdShare > 0 ? 0.05 : 0
  if (u <= 0) return 0
  if (u >= 1) return 1
  if (u < openEnd) return open * ease("smooth", u / openEnd)
  if (u < holdEnd) return open + hold * ((u - openEnd) / holdShare)
  if (u < thrustEnd)
    return open + hold + (thrust - hold) * ease("smooth", (u - holdEnd) / shares.thrust)
  return open + thrust + (1 - open - thrust) * ease("smooth", (u - thrustEnd) / (1 - thrustEnd))
}

/** h/p that point the creature's local +z along `dir` (no roll). */
export const headingFor = (dir: Vec3Like): { h: number; p: number } => ({
  h: Math.atan2(dir.x, Math.hypot(dir.y, dir.z)),
  p: Math.atan2(-dir.y, dir.z),
})

/** Local +z in world space for the standard rotation params. */
export const forwardFor = (h: number, p: number, b = 0): Vec3Like => {
  const v = { x: Math.sin(h), y: -Math.cos(h) * Math.sin(p), z: Math.cos(h) * Math.cos(p) }
  return {
    x: v.x * Math.cos(b) - v.y * Math.sin(b),
    y: v.x * Math.sin(b) + v.y * Math.cos(b),
    z: v.z,
  }
}

/** One pulse of a journey: swim from wherever the previous pulse ended
 *  to `to`, over [start, start + duration]. */
export interface PulseSpec {
  start: number
  duration: number
  to: Vec3Like
  shares?: PulseShares
  /**
   * Distance split override (default 5/55/40). The source's physics
   * gives a long decelerating coast when drag is low — a pulse whose
   * thrust carries little and whose glide carries most is that coast.
   */
  distanceShares?: { open: number; thrust: number }
  /**
   * Face this way instead of the travel direction — heading lags
   * velocity in the source's physics (a momentum dash carries the
   * creature sideways while it keeps facing forward).
   */
  heading?: Vec3Like
}

/** A whole swim as data — the pure-timeline spelling of the creature's
 *  motion. Position/heading/fold all derive from it and `clock`. */
export interface Journey {
  origin: Vec3Like
  pulses: PulseSpec[]
}

interface Segment {
  start: number
  end: number
  from: Vec3Like
  to: Vec3Like
  dir: Vec3Like
  headingDir: Vec3Like
  shares: PulseShares
  distanceShares: { open: number; thrust: number }
}

const lerp3 = (a: Vec3Like, b: Vec3Like, u: number): Vec3Like => ({
  x: a.x + (b.x - a.x) * u,
  y: a.y + (b.y - a.y) * u,
  z: a.z + (b.z - a.z) * u,
})

const normDir = (v: Vec3Like, fallback: Vec3Like): Vec3Like => {
  const l = Math.hypot(v.x, v.y, v.z)
  return l < 1e-9 ? fallback : { x: v.x / l, y: v.y / l, z: v.z / l }
}

export class MindVirus extends Holon {
  /** ONTOLOGY.md: a sovereign symbol (pre-pop-out) — cast, not asset. */
  static sovereign = true

  /** −1 wrapped around a victim … +1 open, trailing its bell. */
  fold = bipolar(1)
  /** The creature's reading of scene time — journey mode's one input. */
  clock = scalar(0)

  /** States for agentic behavior (the source's States class). */
  override states = {
    idle: state({ fold: 1 }),
    hunting: state({ fold: 0.5 }),
    attached: state({ fold: -1 }),
  }

  /** The control mechanism — the real MolochEye, gazing forward.
   *  height 17.3 ≈ the source's 35-unit image plane: the PNG maps
   *  h = 819px of 1660 to the plane height, so h = 35 · 819/1660. */
  molochEye = new MolochEye({ height: 17.3, stroke: 2, z: 2 })

  /** The narrative container, open top aft. */
  cube = new FoldableCube({ fold: this.fold, p: -PI / 2, stroke: 2.5 })

  /** The trail — installed onto this creature's pure path in journey
   *  mode (empty until then). Width 4 is the original's sweep radius. */
  cable = new Cable({ clock: this.clock, width: 4.8, taper: 0.1, stroke: 2 })

  /** Assign to swim: the pure-timeline spelling of the whole motion. */
  journey?: Journey

  private _segments?: Segment[]

  private segments(): Segment[] {
    if (this._segments) return this._segments
    const j = this.journey
    if (!j) return []
    const pulses = [...j.pulses].sort((a, b) => a.start - b.start)
    const segs: Segment[] = []
    let from = j.origin
    let dir: Vec3Like = { x: 0, y: 0, z: 1 }
    for (const p of pulses) {
      dir = normDir({ x: p.to.x - from.x, y: p.to.y - from.y, z: p.to.z - from.z }, dir)
      segs.push({
        start: p.start,
        end: p.start + p.duration,
        from,
        to: p.to,
        dir,
        headingDir: p.heading ? normDir(p.heading, dir) : dir,
        shares: p.shares ?? PULSE_SHARES,
        distanceShares: p.distanceShares ?? PULSE_DISTANCE_SHARES,
      })
      from = p.to
    }
    this._segments = segs
    return segs
  }

  /** World position at an arbitrary journey time — the trail's source. */
  pathAt(time: number): Vec3Like {
    const segs = this.segments()
    if (segs.length === 0) return { x: this.x.value, y: this.y.value, z: this.z.value }
    let pos = segs[0]!.from
    for (const seg of segs) {
      if (time <= seg.start) return pos
      if (time < seg.end) {
        const u = (time - seg.start) / (seg.end - seg.start)
        return lerp3(seg.from, seg.to, pulseDistance(u, seg.shares, seg.distanceShares))
      }
      pos = seg.to
    }
    return pos
  }

  /** Travel direction at time t: each pulse's course, the turn spread
   *  over the WHOLE pulse — momentum re-aims the creature gradually,
   *  the way the source's physics did (heading lags velocity). */
  headingAt(time: number): Vec3Like {
    const segs = this.segments()
    if (segs.length === 0) return forwardFor(this.h.value, this.p.value, this.b.value)
    let dir = segs[0]!.headingDir
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]!
      if (time <= seg.start) return dir
      if (time < seg.end) {
        const u = (time - seg.start) / (seg.end - seg.start)
        return normDir(lerp3(dir, seg.headingDir, ease("smooth", u)), seg.headingDir)
      }
      dir = seg.headingDir
    }
    return dir
  }

  /** Bell state at time t: pulsing inside a pulse, closed between. */
  foldAt(time: number): number {
    for (const seg of this.segments()) {
      if (time >= seg.start && time < seg.end) {
        return pulseFold((time - seg.start) / (seg.end - seg.start), seg.shares)
      }
    }
    return 1
  }

  protected override compose(): void {
    if (!this.journey || this.journey.pulses.length === 0) return
    this.x.follow(derive(() => this.pathAt(this.clock.value).x))
    this.y.follow(derive(() => this.pathAt(this.clock.value).y))
    this.z.follow(derive(() => this.pathAt(this.clock.value).z))
    this.h.follow(derive(() => headingFor(this.headingAt(this.clock.value)).h))
    this.p.follow(derive(() => headingFor(this.headingAt(this.clock.value)).p))
    this.fold.follow(derive(() => this.foldAt(this.clock.value)))
    this.cable.trail((t) => this.pathAt(t), { since: 0 })
  }

  /**
   * The free-swimming ability: one three-phase pulse along the current
   * heading, as an Anim over fold and position. Dense linear waypoints
   * sampled from the SAME profile the journey derives from — the
   * onePen reading: one shared shape, exactly reproduced.
   */
  thrustPulse(distance = 100, shares: PulseShares = PULSE_SHARES): Anim {
    const STEPS = 60
    const dir = forwardFor(this.h.value, this.p.value, this.b.value)
    const x0 = this.x.value
    const y0 = this.y.value
    const z0 = this.z.value
    const folds: number[] = []
    const xs: number[] = []
    const ys: number[] = []
    const zs: number[] = []
    for (let k = 0; k <= STEPS; k++) {
      const u = k / STEPS
      folds.push(pulseFold(u, shares))
      const d = distance * pulseDistance(u, shares)
      xs.push(x0 + dir.x * d)
      ys.push(y0 + dir.y * d)
      zs.push(z0 + dir.z * d)
    }
    return eased(
      "linear",
      together(
        this.fold.sequence(...folds),
        this.x.sequence(...xs),
        this.y.sequence(...ys),
        this.z.sequence(...zs),
      ),
    )
  }

  /** Wrap the bell the other way — around a victim (the source's wrap()). */
  wrap(completion = -1): Anim {
    return this.fold.to(completion)
  }
}
