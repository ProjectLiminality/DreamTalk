/**
 * Anims — pure descriptions of motion.
 *
 * An Anim is data: a set of tracks, each targeting one Param over a
 * normalized [relStart, relStop] window within the span play() gives it.
 * Nothing here executes anything — the Timeline samples it as f(t).
 *
 * The nesting algebra (windows renormalizing into parent windows) is a
 * faithful port of pydeation's AnimationGroup relative-time algebra
 * (animation/animation.py: rescale_relative_run_time / rescale_other).
 */

import type { Param, ParamValue } from "./params"

export type Easing = "smooth" | "linear"

export interface Track {
  param: Param<ParamValue>
  /** 'to': animate current → value. 'by': current → current + offset. 'sequence': explicit waypoints. */
  mode: "to" | "by" | "sequence"
  values: ParamValue[]
  /** Normalized window within the enclosing span. */
  relStart: number
  relStop: number
  easing: Easing
}

export interface Anim {
  tracks: Track[]
}

/** An Anim occupying a sub-window of the enclosing span: [anim, relStart, relStop]. */
export type Windowed = Anim | [Anim, number, number]

const rescaled = (track: Track, a: number, b: number): Track => ({
  ...track,
  relStart: a + (b - a) * track.relStart,
  relStop: a + (b - a) * track.relStop,
})

const windows = (items: Windowed[]): { anim: Anim; a: number; b: number }[] =>
  items.map((item) =>
    Array.isArray(item)
      ? { anim: item[0], a: item[1], b: item[2] }
      : { anim: item, a: 0, b: 1 },
  )

/** Parallel composition — all children share the span (optionally sub-windowed). */
export const together = (...items: Windowed[]): Anim => ({
  tracks: windows(items).flatMap(({ anim, a, b }) =>
    anim.tracks.map((t) => rescaled(t, a, b)),
  ),
})

/** Sequential composition — children divide the span equally (or by given weights). */
export const chain = (...items: Windowed[]): Anim => {
  const ws = windows(items)
  const n = ws.length
  return {
    tracks: ws.flatMap(({ anim, a, b }, i) => {
      const lo = i / n
      const hi = (i + 1) / n
      // child's own sub-window nests inside its slot
      const start = lo + (hi - lo) * a
      const stop = lo + (hi - lo) * b
      return anim.tracks.map((t) => rescaled(t, start, stop))
    }),
  }
}
