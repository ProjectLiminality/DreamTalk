/**
 * The minimal timeline (EDITOR-V4 "The minimal timeline — Keynote's
 * model, not keyframes").
 *
 * Keynote asks two questions about an animation: how long does it take,
 * and does it go WITH the previous thing or AFTER it. It never shows a
 * keyframe. `AnimationGroup` already encodes exactly that — `together`,
 * `chain`, and windowed sub-spans `[anim, a, b]` — so the UI's whole job
 * is to make the structure already in the code visible, and to make the
 * one number that is genuinely a UI decision (run_time) editable.
 *
 *   one row per play() clip, in order
 *   row WIDTH is its run_time — the row IS the duration, not a label
 *   nested windows drawn as bars inside the row, read-only
 *   NO per-parameter lanes
 *
 * That last line is a prohibition, not an omission: "If a scene needs
 * that, the answer is better composition in code, not a keyframe editor."
 *
 * ## What a row is labelled
 *
 * Derived from the clip's own tracks: the distinct holon classes it
 * touches, and the params it moves on them. `Cylinder p`, `Eye · Eye
 * creation`, `Axes creation`. This is honest — it is READ from the
 * timeline rather than parsed from source text — and it is what a human
 * asks of a row ("which thing moves here?"). Truncated hard, because a
 * clip that animates eleven params has a label no width can hold; the
 * count then stands in for the list.
 *
 * ## Nested windows
 *
 * A clip's tracks each carry [relStart, relStop] within the span. Tracks
 * that share a window came from the same `together(...)` member or the
 * same slot of a `chain(...)`, so grouping the tracks BY WINDOW recovers
 * the composition the scene wrote — without re-parsing anim.ts's algebra
 * and without needing the code. A clip whose tracks all span [0,1] is a
 * plain parallel group and draws one full-width bar; a `chain` of three
 * draws three bars at thirds. That is exactly the picture Keynote shows.
 */

import type { Clip } from "../src/timeline"
import type { Holon } from "../src/holon"
import { classNameOf } from "./classname"
import { thumbnailFor } from "./thumbnails"

export interface ClipRow {
  clip: Clip
  index: number
  label: string
  /** The holons this clip animates, first one first — drives the glyph. */
  holons: Holon[]
  /** Sub-spans within the clip, from the tracks' own windows. */
  windows: { start: number; stop: number; count: number }[]
}

/** Round a window bound so tracks that agree do not disagree by 1e-16. */
const q = (v: number): number => Math.round(v * 1e6) / 1e6

/**
 * A clip's structure, read from its tracks. Both halves — the label and
 * the sub-windows — come from the same single pass.
 */
export const describeClip = (clip: Clip, index: number): ClipRow => {
  const holons: Holon[] = []
  const seen = new Set<Holon>()
  const classNames: string[] = []
  const paramNames: string[] = []
  const windows = new Map<string, { start: number; stop: number; count: number }>()

  for (const track of clip.anim.tracks) {
    const owner = track.param.owner as Holon | undefined
    if (owner && typeof owner === "object" && "parts" in owner && !seen.has(owner)) {
      seen.add(owner)
      holons.push(owner)
      const name = classNameOf(owner)
      if (!classNames.includes(name)) classNames.push(name)
    }
    const pname = track.param.name
    if (pname && !paramNames.includes(pname)) paramNames.push(pname)

    const start = q(track.relStart)
    const stop = q(track.relStop)
    const key = `${start}:${stop}`
    const hit = windows.get(key)
    if (hit) hit.count++
    else windows.set(key, { start, stop, count: 1 })
  }

  // The label: what moves, then how. Two classes read fine; more is a
  // count, because the alternative is an ellipsis that says less.
  const subject =
    classNames.length === 0
      ? "—"
      : classNames.length <= 2
        ? classNames.join(" · ")
        : `${classNames[0]} +${classNames.length - 1}`
  const verb =
    paramNames.length === 0
      ? ""
      : paramNames.length <= 2
        ? paramNames.join(" ")
        : `${paramNames.length} params`

  return {
    clip,
    index,
    label: verb ? `${subject} ${verb}` : subject,
    holons,
    windows: [...windows.values()].sort((a, b) => a.start - b.start || a.stop - b.stop),
  }
}

export interface TimelineHandle {
  /** Highlight the row for a clip (or none). */
  select(clip: Clip | null): void
  /** Move the playhead — called every painted frame. */
  setPlayhead(t: number): void
  dispose(): void
}

export interface TimelineOpts {
  /** Clicking a row: selects the clip (and, in main.ts, its code line). */
  onSelect: (row: ClipRow) => void
  /** Clicking the ruler or dragging the playhead — scrub to that time. */
  onScrub: (t: number) => void
  signal: AbortSignal
}

/**
 * Mount the clip rows into a container.
 *
 * Layout: every row is absolutely positioned along one shared time axis,
 * so the geometry IS the timing — a 3s clip is three times the width of
 * a 1s clip and starts where the previous one ended. Rows stack
 * vertically in clip order rather than packing, because Keynote's build
 * list is a LIST: the vertical axis is order, the horizontal is time.
 */
export const mountTimeline = (
  container: HTMLElement,
  ruler: HTMLElement,
  clips: readonly Clip[],
  duration: number,
  opts: TimelineOpts,
): TimelineHandle => {
  container.textContent = ""
  ruler.textContent = ""
  const rows: { row: ClipRow; el: HTMLElement }[] = []
  const span = duration > 0 ? duration : 1

  // --- The ruler: whole seconds, and only as many as fit -------------------
  //
  // A tick every second is right for a 26s scene at 900px and wrong for a
  // 300s one, so the step is chosen against the available width — the
  // smallest of 1/2/5/10/30s that keeps ticks at least ~54px apart.
  const width = ruler.clientWidth || 900
  const step = [1, 2, 5, 10, 30, 60].find((s) => (s / span) * width >= 54) ?? 60
  for (let t = 0; t <= span + 1e-6; t += step) {
    const tick = document.createElement("div")
    tick.className = "tick"
    tick.style.left = `${(t / span) * 100}%`
    const label = document.createElement("span")
    label.textContent = `${t.toFixed(0)}s`
    tick.appendChild(label)
    ruler.appendChild(tick)
  }

  // --- The rows -----------------------------------------------------------
  let index = 0
  for (const clip of clips) {
    // A zero-duration clip is a `set()` — an instant, not a span. It is
    // real and worth showing, but it is not a row with a width; it draws
    // as a mark on the ruler instead.
    if (clip.duration <= 0) {
      const mark = document.createElement("div")
      mark.className = "setmark"
      mark.style.left = `${(clip.start / span) * 100}%`
      mark.title = `set() at ${clip.start.toFixed(2)}s`
      ruler.appendChild(mark)
      continue
    }
    const row = describeClip(clip, index++)
    const el = document.createElement("div")
    el.className = "cliprow"
    el.style.left = `${(clip.start / span) * 100}%`
    el.style.width = `${(clip.duration / span) * 100}%`
    el.title = `${row.label} · ${clip.duration.toFixed(2)}s at ${clip.start.toFixed(2)}s`

    // Sub-windows first, so the label sits over them.
    for (const w of row.windows) {
      // A window covering the whole span adds nothing over the row's own
      // edges — drawing it would just double every border.
      if (w.start <= 0 && w.stop >= 1 && row.windows.length === 1) continue
      const bar = document.createElement("div")
      bar.className = "window"
      bar.style.left = `${w.start * 100}%`
      bar.style.width = `${Math.max(0.5, (w.stop - w.start) * 100)}%`
      el.appendChild(bar)
    }

    const face = document.createElement("div")
    face.className = "clipface"
    const first = row.holons[0]
    if (first) {
      const img = document.createElement("img")
      img.className = "thumb"
      img.src = thumbnailFor(first, 14)
      img.width = 14
      img.height = 14
      img.alt = ""
      face.appendChild(img)
    }
    const text = document.createElement("span")
    text.className = "cliplabel"
    text.textContent = row.label
    face.appendChild(text)
    const secs = document.createElement("span")
    secs.className = "clipsecs"
    secs.textContent = `${clip.duration.toFixed(clip.duration % 1 === 0 ? 0 : 1)}s`
    face.appendChild(secs)
    el.appendChild(face)

    el.addEventListener(
      "pointerdown",
      (e) => {
        e.stopPropagation()
        opts.onSelect(row)
      },
      { signal: opts.signal },
    )
    container.appendChild(el)
    rows.push({ row, el })
  }

  // --- The playhead -------------------------------------------------------
  const playhead = document.createElement("div")
  playhead.className = "playhead"
  container.appendChild(playhead)

  const timeAt = (clientX: number): number => {
    const rect = container.getBoundingClientRect()
    if (rect.width <= 0) return 0
    return Math.max(0, Math.min(span, ((clientX - rect.left) / rect.width) * span))
  }

  // Scrubbing on the track itself — clicking empty timeline moves time,
  // which is what every editor in the world does and costs one handler.
  let scrubbing = false
  const startScrub = (e: PointerEvent) => {
    if (e.button !== 0) return
    scrubbing = true
    container.setPointerCapture(e.pointerId)
    opts.onScrub(timeAt(e.clientX))
  }
  container.addEventListener("pointerdown", startScrub, { signal: opts.signal })
  container.addEventListener(
    "pointermove",
    (e) => {
      if (scrubbing) opts.onScrub(timeAt(e.clientX))
    },
    { signal: opts.signal },
  )
  const endScrub = (e: PointerEvent) => {
    if (!scrubbing) return
    scrubbing = false
    container.releasePointerCapture(e.pointerId)
  }
  container.addEventListener("pointerup", endScrub, { signal: opts.signal })
  container.addEventListener("pointercancel", endScrub, { signal: opts.signal })
  ruler.addEventListener(
    "pointerdown",
    (e) => {
      const rect = ruler.getBoundingClientRect()
      if (rect.width > 0)
        opts.onScrub(Math.max(0, Math.min(span, ((e.clientX - rect.left) / rect.width) * span)))
    },
    { signal: opts.signal },
  )

  return {
    select(clip: Clip | null) {
      for (const { row, el } of rows) el.classList.toggle("selected", row.clip === clip)
    },
    setPlayhead(t: number) {
      playhead.style.left = `${(Math.max(0, Math.min(span, t)) / span) * 100}%`
      // A row is ACTIVE while the playhead is inside it — the timeline
      // answering "what is happening right now" without being asked.
      for (const { row, el } of rows) {
        const inside = t >= row.clip.start && t < row.clip.start + row.clip.duration
        el.classList.toggle("active", inside)
      }
    },
    dispose() {
      rows.length = 0
    },
  }
}
