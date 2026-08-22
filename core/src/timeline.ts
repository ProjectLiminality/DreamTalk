/**
 * The Timeline — evaluation as a pure function of t.
 *
 * play() clips are resolved ONCE, chronologically per param, into absolute
 * segments with concrete waypoints. Initial values come from the timeline
 * (the param's value at the end of its previous segment), never from live
 * scene state — this is the deliberate correction of pydeation's
 * get_current_value() (see SYNTAX-TS.md, philosophy #7: time is sampled,
 * never accumulated).
 *
 * Hold rules:
 *  - before its first segment, a param holds that segment's initial value
 *    (an object not yet Created is undrawn);
 *  - between segments, it holds the previous segment's end;
 *  - after the last, it holds the last end;
 *  - with no segments at all, its declared default.
 */

import { isColor, type Color } from "./constants"
import type { Anim, Easing } from "./anim"
import type { Param, ParamValue } from "./params"

export interface Clip {
  anim: Anim
  start: number
  duration: number
}

interface Segment {
  t0: number
  t1: number
  /** Concrete waypoints spanning t0..t1 (equally spaced). Always >= 2. */
  waypoints: ParamValue[]
  easing: Easing
}

const ease = (easing: Easing, u: number): number =>
  easing === "linear" ? u : u * u * (3 - 2 * u) // smoothstep ≈ C4D auto-tangents

const lerpValue = (a: ParamValue, b: ParamValue, u: number): ParamValue => {
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * u
  if (typeof a === "boolean" || typeof b === "boolean") return u >= 1 ? b : a
  if (isColor(a) && isColor(b)) {
    return {
      r: a.r + (b.r - a.r) * u,
      g: a.g + (b.g - a.g) * u,
      b: a.b + (b.b - a.b) * u,
    } satisfies Color
  }
  throw new Error("cannot interpolate between mismatched value types")
}

export class Timeline {
  readonly duration: number
  readonly params: Param<ParamValue>[]
  private readonly segments = new Map<Param<ParamValue>, Segment[]>()

  constructor(clips: Clip[], minDuration = 0) {
    // Gather every track instance with its absolute window.
    interface Placed {
      param: Param<ParamValue>
      t0: number
      t1: number
      mode: "to" | "by" | "sequence"
      values: ParamValue[]
      easing: Easing
    }
    const placed: Placed[] = []
    let end = 0
    for (const clip of clips) {
      end = Math.max(end, clip.start + clip.duration)
      for (const track of clip.anim.tracks) {
        placed.push({
          param: track.param,
          t0: clip.start + track.relStart * clip.duration,
          t1: clip.start + track.relStop * clip.duration,
          mode: track.mode,
          values: track.values,
          easing: track.easing,
        })
      }
    }
    this.duration = Math.max(end, minDuration)

    // Resolve chronologically per param.
    const byParam = new Map<Param<ParamValue>, Placed[]>()
    for (const p of placed) {
      const list = byParam.get(p.param) ?? []
      list.push(p)
      byParam.set(p.param, list)
    }
    for (const [param, list] of byParam) {
      list.sort((a, b) => a.t0 - b.t0 || a.t1 - b.t1)
      const segs: Segment[] = []
      let prevEnd: ParamValue = param.defaultValue
      let first = true
      for (const p of list) {
        let waypoints: ParamValue[]
        switch (p.mode) {
          case "to":
            waypoints = [prevEnd, param.clamp(p.values[0]!)]
            break
          case "by": {
            if (typeof prevEnd !== "number" || typeof p.values[0] !== "number") {
              throw new Error(`'.by()' needs numeric values on '${param.name ?? param.id}'`)
            }
            waypoints = [prevEnd, param.clamp(prevEnd + p.values[0])]
            break
          }
          case "sequence":
            waypoints = p.values.map((v) => param.clamp(v))
            break
        }
        segs.push({ t0: p.t0, t1: p.t1, waypoints, easing: p.easing })
        prevEnd = waypoints[waypoints.length - 1]!
        first = false
      }
      void first
      this.segments.set(param, segs)
    }
    this.params = [...this.segments.keys()]
  }

  /** The value of one param at time t — pure, order-independent. */
  valueAt<T extends ParamValue>(param: Param<T>, t: number): T {
    const segs = this.segments.get(param as Param<ParamValue>)
    if (!segs || segs.length === 0) return param.defaultValue
    const firstSeg = segs[0]!
    if (t < firstSeg.t0) return firstSeg.waypoints[0]! as T
    let active: Segment | undefined
    let lastEnded: Segment | undefined
    for (const seg of segs) {
      if (t >= seg.t0 && t <= seg.t1) active = seg
      if (seg.t1 <= t && (!lastEnded || seg.t1 >= lastEnded.t1)) lastEnded = seg
    }
    if (active) {
      const span = active.t1 - active.t0
      const u = span <= 0 ? 1 : (t - active.t0) / span
      const n = active.waypoints.length - 1
      if (u >= 1) return active.waypoints[n]! as T
      const scaled = u * n
      const i = Math.min(Math.floor(scaled), n - 1)
      const local = ease(active.easing, scaled - i)
      return lerpValue(active.waypoints[i]!, active.waypoints[i + 1]!, local) as T
    }
    if (lastEnded) return lastEnded.waypoints[lastEnded.waypoints.length - 1]! as T
    return firstSeg.waypoints[0]! as T
  }

  /** Write the values at time t into every touched param's live value. */
  apply(t: number): void {
    for (const param of this.params) {
      param.value = this.valueAt(param, t)
    }
  }
}
