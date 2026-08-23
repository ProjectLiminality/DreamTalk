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

/**
 * The four members of C4D's auto-tangent family the 2021 corpus uses.
 * `smooth` is the default (smoothing 0.25 both sides); `easeIn` is
 * pydeation's `smoothing_right=0` (eased in, leaves at full speed) and
 * `easeOut` its `smoothing_left=0` (starts at full speed, arrives
 * eased). `linear` has no tangents at all.
 *
 * The numbers are stated relative to the WHOLE PLAY SPAN, not to the
 * track's own window — which is how C4D receives them, because
 * pydeation hands `make_keyframes` a tangent length in seconds
 * (`smoothing * run_time`) while the keyframes themselves are placed at
 * the sub-window's edges (scene/scene.py:990). A track that occupies
 * half its span therefore eases over a tangent HALF ITS OWN LENGTH
 * again — measurably so: Scene 05's axes, drawn over the first half of
 * a 2s span, fit a normalized smoothing of ~0.5, not 0.25, and 0.25
 * runs them visibly ahead of the reference through the whole first
 * second. The Timeline does that renormalization, where absolute time
 * lives.
 */
export type Easing = "smooth" | "linear" | "easeIn" | "easeOut"

/** Tangent lengths per easing name, as fractions of the whole play span. */
export const SMOOTHING: Record<Easing, { left: number; right: number }> = {
  smooth: { left: 0.25, right: 0.25 },
  linear: { left: 0, right: 0 },
  // pydeation's smoothing_right = 0 zeroes the ARRIVING tangent.
  easeIn: { left: 0.25, right: 0 },
  // pydeation's smoothing_left = 0 zeroes the DEPARTING tangent.
  easeOut: { left: 0, right: 0.25 },
}

export interface Track {
  param: Param<ParamValue>
  /** 'to': animate current → value. 'by': current → current + offset. 'sequence': explicit waypoints. */
  mode: "to" | "by" | "sequence"
  values: ParamValue[]
  /** Normalized window within the enclosing span. */
  relStart: number
  relStop: number
  easing: Easing
  /**
   * The fraction of the play span the easing's tangent lengths are
   * stated against. Undefined — the ordinary case — means "this track's
   * own window", i.e. the ease keeps its stated shape however the track
   * is windowed. `restage()` sets it to the WIDER window the tangents
   * were actually stated against, which stretches the ease.
   *
   * The distinction is pydeation's, and it is measurable. C4D receives a
   * tangent length in SECONDS (`smoothing * run_time * rel_duration`),
   * and whether `rel_duration` tracks the window depends on HOW the
   * window was applied. Passed to a plain animator
   * (`Draw(circle, rel_start_point=1/3)`) it reaches the Animation's own
   * constructor and the tangent shrinks with the window — the ordinary
   * case. Applied as a GROUP RESCALE — which is what every composite
   * animator does, building its choreography first and rescaling it by
   * `rel_end_point` afterwards (animator.py:868, 915) — `rel_duration`
   * is left stale at 1 and the tangent keeps its full-span length. That
   * is `restage()`. Scene 05's axes, windowed the rescale way over half
   * a 2s span, fit a normalized smoothing of 0.5 (sse 1.5e-4 across
   * four reference frames) where 0.25 runs them visibly ahead; its
   * circle and rectangle, windowed the animator way, keep 0.25.
   */
  smoothingWindow?: number
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

/**
 * An Anim re-staged into a sub-window of its span, keeping the easing
 * tangents it was built with — pydeation's group rescale, which is how
 * every composite animator applies `rel_start_point` / `rel_end_point`
 * (CreateAxes, UnCreateAxes, CreateEye, Write, …): the choreography is
 * assembled at full span and squeezed afterwards, and the tangents,
 * already fixed in seconds, do not squeeze with it.
 *
 * The difference from the bare `[anim, a, b]` tuple is only the ease's
 * shape (see `Track.smoothingWindow`); the timing is identical.
 */
export const restage = (anim: Anim, a: number, b: number): Anim => ({
  tracks: anim.tracks.map((t) => ({
    ...rescaled(t, a, b),
    smoothingWindow: (t.smoothingWindow ?? t.relStop - t.relStart) || 1,
  })),
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

/**
 * Re-stamp the easing of every track an Anim carries — pydeation's
 * `smoothing_left` / `smoothing_right`, which are passed to an ANIMATOR
 * (`Create(axes, smoothing_right=0)`) and reach every keyframe it
 * generates, however deeply the animator nests its groups. The verbs
 * build their tracks with the default ease, so this is where a scene
 * states the exception. Sub-windows are untouched: easing is a shape,
 * not a schedule.
 */
export const eased = (easing: Easing, ...items: Windowed[]): Anim => ({
  tracks: together(...items).tracks.map((t) => ({ ...t, easing })),
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
