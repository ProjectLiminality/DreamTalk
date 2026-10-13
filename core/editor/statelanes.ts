/**
 * State lanes — the song drawn as what it is: a path through its state
 * space (docs/reports/editor-automaton.md).
 *
 * Under the clip rows, one lane per AXIS the scene's holons declare
 * (Holon.stateSpace()). Every authored clip that moves an axis is a block
 * on that axis's lane, labelled from → to in the axis's own position
 * names (`uncategorised → categorised`), so reading the lanes left to right
 * reads the song as a walk. A click seeks to the block (selects its clip);
 * dragging its right edge retimes the clip (the same setRunTime op as the
 * rows). A walked-but-uncaptured transition is a GHOST block at the
 * playhead until ⌘K writes it or Escape lets it go.
 *
 * Not the per-parameter lanes timeline.ts forbids: a lane is a NAMED
 * dimension a holon chose to expose — grain, a stage, the stack — never a
 * param. A scene that declares no state space draws no lanes at all.
 *
 * The derivation is pure (axisSegments): positions are read off the
 * timeline at each clip's ends by nearest match, the same rule the
 * automaton uses to read where an axis stands.
 */

import type { Axis } from "../src/automaton"
import type { Param, ParamValue } from "../src/params"
import type { Clip, Timeline } from "../src/timeline"
import { isColor } from "../src/constants"
import { MIN_RUN_TIME } from "./timeline"
import type { WalkGhost } from "./walk"

export interface AxisSegment {
  clip: Clip
  start: number
  duration: number
  from: string
  to: string
}

export interface AxisLane {
  axis: Axis
  segments: AxisSegment[]
}

const vec = (v: ParamValue): number[] | undefined =>
  typeof v === "number" ? [v] : isColor(v) ? [v.r, v.g, v.b] : undefined

const distance = (a: ParamValue, b: ParamValue): number => {
  const x = vec(a)
  const y = vec(b)
  return x && y ? x.reduce((s, xi, i) => s + Math.abs(xi - y[i]!), 0) : a === b ? 0 : 1
}

/** The position whose values lie nearest the timeline's at t. */
export const positionAt = (axis: Axis, timeline: Timeline, t: number): string => {
  let best = axis.positions[0]!.name
  let bestD = Infinity
  for (const pos of axis.positions) {
    let d = 0
    for (const [p, v] of pos.values) d += distance(timeline.valueAt(p, t), v)
    if (d < bestD) {
      bestD = d
      best = pos.name
    }
  }
  return best
}

/**
 * Every authored move along every axis: a clip is a block on an axis's
 * lane when it animates one of the axis's params AND the value actually
 * changes across the clip (a clip that merely holds a param is not a
 * transition). Axes the song never moves get no lane.
 */
export const axisSegments = (
  axes: readonly Axis[],
  clips: readonly Clip[],
  timeline: Timeline,
): AxisLane[] => {
  const lanes: AxisLane[] = []
  for (const axis of axes) {
    const params = new Set<Param<ParamValue>>(axis.params())
    const segments: AxisSegment[] = []
    for (const clip of clips) {
      if (clip.duration <= 0) continue
      if (!clip.anim.tracks.some((tr) => params.has(tr.param as Param<ParamValue>))) continue
      const end = clip.start + clip.duration
      const moved = [...params].some(
        (p) => distance(timeline.valueAt(p, clip.start), timeline.valueAt(p, end)) > 1e-6,
      )
      if (!moved) continue
      segments.push({
        clip,
        start: clip.start,
        duration: clip.duration,
        from: positionAt(axis, timeline, clip.start),
        to: positionAt(axis, timeline, end),
      })
    }
    if (segments.length) lanes.push({ axis, segments })
  }
  return lanes
}

/**
 * A block's caption: the move — or, on a block too narrow to say it (under
 * WIDE of the bar), only where it goes, which is what the eye reads a
 * path by. The tooltip always carries both.
 */
export const blockLabel = (from: string, to: string, fraction = 1): string =>
  from === to ? `~ ${to}` : fraction < WIDE ? to : `${from} → ${to}`

const WIDE = 0.12

// --- The lanes, mounted -------------------------------------------------------

export interface StateLanesOpts {
  axes: readonly Axis[]
  lanes: AxisLane[]
  /** The timeline's own axis: where t = origin sits, and the span drawn. */
  origin: number
  span: number
  /** A block clicked: seek to (select) its clip. */
  onSeek: (clip: Clip) => void
  /** A block's right edge released: retime its clip. */
  onResize?: (clip: Clip, seconds: number) => void
  signal: AbortSignal
}

export interface StateLanesHandle {
  setPlayhead(t: number): void
  /** The walk's uncaptured transitions, drawn at t. */
  setGhosts(ghosts: readonly WalkGhost[], t: number): void
  /** How many lanes are drawn (authored + ghost-only). */
  readonly count: number
}

const LANE = 16

export const mountStateLanes = (container: HTMLElement, opts: StateLanesOpts): StateLanesHandle => {
  const { origin, span, signal } = opts
  const frac = (t: number) => (t - origin) / span
  const root = document.createElement("div")
  root.className = "statelanes"
  container.appendChild(root)

  const blocks: { seg: AxisSegment; el: HTMLElement }[] = []
  const laneEls = new Map<string, HTMLElement>()
  let ghostKey = ""

  const laneFor = (axis: Axis): HTMLElement => {
    const hit = laneEls.get(axis.id)
    if (hit) return hit
    const lane = document.createElement("div")
    lane.className = "lane"
    lane.dataset.axis = axis.id
    const label = document.createElement("span")
    label.className = "lanelabel"
    label.textContent = axis.label
    lane.appendChild(label)
    root.appendChild(lane)
    laneEls.set(axis.id, lane)
    return lane
  }

  for (const { axis, segments } of opts.lanes) {
    const lane = laneFor(axis)
    for (const seg of segments) {
      const el = document.createElement("div")
      el.className = "stateblock"
      el.style.left = `${frac(seg.start) * 100}%`
      el.style.width = `${(seg.duration / span) * 100}%`
      el.textContent = blockLabel(seg.from, seg.to, seg.duration / span)
      el.title = `${axis.label}: ${seg.from} → ${seg.to} · ${seg.duration.toFixed(2)}s at ${seg.start.toFixed(2)}s`
      el.addEventListener(
        "pointerdown",
        (e) => {
          e.stopPropagation()
          opts.onSeek(seg.clip)
        },
        { signal },
      )
      if (opts.onResize) {
        const grip = document.createElement("div")
        grip.className = "grip"
        grip.title = "drag to change this transition's duration"
        el.appendChild(grip)
        let drag: { id: number; seconds: number } | null = null
        grip.addEventListener(
          "pointerdown",
          (e) => {
            if (e.button !== 0) return
            e.stopPropagation()
            drag = { id: e.pointerId, seconds: seg.duration }
            el.classList.add("resizing")
            try {
              grip.setPointerCapture(e.pointerId)
            } catch {}
          },
          { signal },
        )
        grip.addEventListener(
          "pointermove",
          (e) => {
            if (!drag || e.pointerId !== drag.id) return
            const rect = root.getBoundingClientRect()
            if (rect.width <= 0) return
            const at = origin + ((e.clientX - rect.left) / rect.width) * span
            drag.seconds = Math.max(MIN_RUN_TIME, Math.round((at - seg.start) * 100) / 100)
            el.style.width = `${(drag.seconds / span) * 100}%`
            el.title = `${drag.seconds.toFixed(2)}s`
          },
          { signal },
        )
        const end = (commit: boolean) => {
          if (!drag) return
          const d = drag
          drag = null
          el.classList.remove("resizing")
          if (commit && Math.round(seg.duration * 100) / 100 !== d.seconds) opts.onResize!(seg.clip, d.seconds)
          else el.style.width = `${(seg.duration / span) * 100}%`
        }
        grip.addEventListener("pointerup", () => end(true), { signal })
        grip.addEventListener("pointercancel", () => end(false), { signal })
      }
      lane.appendChild(el)
      blocks.push({ seg, el })
    }
  }

  const byId = new Map(opts.axes.map((a) => [a.id, a]))

  return {
    get count() {
      return laneEls.size
    },
    setPlayhead(t: number) {
      for (const { seg, el } of blocks) el.classList.toggle("active", t >= seg.start && t < seg.start + seg.duration)
    },
    setGhosts(ghosts, t) {
      const key = ghosts.map((g) => `${g.axis}:${g.from}:${g.to}:${g.progress < 1 ? 1 : 0}`).join() + `@${t}`
      if (key === ghostKey) return
      ghostKey = key
      for (const el of Array.from(root.querySelectorAll(".stateblock.ghost"))) el.remove()
      for (const g of ghosts) {
        const axis = byId.get(g.axis)
        if (!axis) continue
        const el = document.createElement("div")
        el.className = `stateblock ghost${g.progress < 1 ? " going" : ""}`
        el.style.left = `${frac(t) * 100}%`
        el.style.width = `${(g.seconds / span) * 100}%`
        el.textContent = blockLabel(g.from, g.to, g.seconds / span)
        el.title = `walked, not written — ⌘K writes it here, Esc lets it go`
        laneFor(axis).appendChild(el)
      }
      // A lane that only ever held a ghost goes when its ghost does.
      for (const [id, lane] of laneEls) {
        if (!lane.querySelector(".stateblock")) {
          lane.remove()
          laneEls.delete(id)
        }
      }
    },
  }
}

/** The lanes' height in CSS px — the timeline grows to show them. */
export const lanesHeight = (count: number): number => (count ? count * LANE + 8 : 0)
