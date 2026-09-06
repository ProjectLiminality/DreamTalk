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

/** One transport frame — what `,` / `.` nudge the playhead by. */
export const FRAME_SECONDS = 1 / 30

/** The shortest run_time an edge-drag can ask for (ops.ts enforces it too). */
export const MIN_RUN_TIME = 0.1

/**
 * Frame-step math for the transport: `,` / `.` move the playhead by
 * exactly one frame (shift: one second), clamped to the scene's span.
 * Pure, so the step is testable without a browser.
 */
export const stepTime = (
  t: number,
  direction: 1 | -1,
  duration: number,
  big = false,
): number => Math.min(duration, Math.max(0, t + direction * (big ? 1 : FRAME_SECONDS)))

export interface ClipRow {
  clip: Clip
  index: number
  label: string
  /** The holons this clip animates, first one first — drives the glyph. */
  holons: Holon[]
  /** Sub-spans within the clip, from the tracks' own windows. */
  windows: { start: number; stop: number; count: number }[]
  /**
   * The clip's windows form a CASCADE — many small overlapping spans
   * marching across the row, which is what a domino (an Axes drawing its
   * forty-seven grid lines in sequence) produces. Drawn as forty-seven
   * hairlines it is exactly the per-parameter lane dump the spec forbids;
   * drawn as one swept band it says the true thing ("these staggered
   * one after another") in one mark.
   */
  cascade: boolean
}

/**
 * Past this many distinct sub-windows a clip is a cascade, not a
 * composition: nobody reads thirty bars, and the structure they encode
 * ("each part starts a little after the last") is better said once.
 */
const CASCADE_THRESHOLD = 6

/** One row's height and the air under it, in CSS pixels. */
const ROW_HEIGHT = 19
const ROW_GAP = 3

/**
 * How many rows are laid out one-per-line before the timeline PACKS them.
 *
 * The vertical axis wants to be order (Keynote's build list), and for a
 * scene of a handful of clips it is. But S01 has eleven, which at one row
 * per line is 242px of bar for a 132px region — the later clips simply
 * fall off the bottom, and a build list you have to scroll to see the end
 * of has stopped being a picture of the scene.
 *
 * Past the threshold, rows are packed into the fewest lines that keep
 * them from overlapping (a clip goes on the first line whose last row
 * ends before it starts). Since clips are laid out on a shared time axis
 * and mostly run in sequence, that collapses a chain of eleven into two
 * or three lines while keeping every row's position and width exactly
 * true. Order is still readable — it runs left to right, which is what
 * the time axis already meant.
 */
const PACK_ABOVE = 6

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
      // The SYMBOL, not the leaf that happens to own the param. An Axes
      // animates through its forty-seven grid Lines, and a row reading
      // "Line creation" names something nobody wrote — `Axes` is the
      // thing the scene put on stage and the name the code uses.
      const subject = owner.root ?? owner
      holons.push(subject)
      const name = classNameOf(subject)
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

  const spans = [...windows.values()].sort((a, b) => a.start - b.start || a.stop - b.stop)
  const cascade = spans.length > CASCADE_THRESHOLD
  return {
    clip,
    index,
    label: verb ? `${subject} ${verb}` : subject,
    holons,
    // A cascade collapses to its own envelope: where the first sub-span
    // starts and the last one ends, which is the honest summary of what
    // the staggered set does.
    windows: cascade
      ? [
          {
            start: spans[0]!.start,
            stop: spans[spans.length - 1]!.stop,
            count: spans.length,
          },
        ]
      : spans,
    cascade,
  }
}

export interface TimelineHandle {
  /** Highlight the row for a clip (or none). */
  select(clip: Clip | null): void
  /** Move the playhead — called every painted frame. */
  setPlayhead(t: number): void
  /** The rows as built, in order — headless driving and verification. */
  readonly rows: readonly ClipRow[]
  dispose(): void
}

export interface TimelineOpts {
  /** Clicking a row: selects the clip (and, in main.ts, its code line). */
  onSelect: (row: ClipRow) => void
  /** Clicking the ruler or dragging the playhead — scrub to that time. */
  onScrub: (t: number) => void
  /**
   * Releasing a drag of a row's RIGHT EDGE: commit the new duration in
   * seconds (min MIN_RUN_TIME, rounded to the centisecond). The drag
   * itself is a live preview only — the row resizes and a readout rides
   * the cursor; Escape cancels without calling this. Absent, rows have
   * no resize grip at all (the player mounts no timeline anyway).
   */
  onResize?: (row: ClipRow, seconds: number) => void
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

  /**
   * The time axis runs 0..duration — but a scene may legitimately start
   * BEFORE zero. S04 opens with a negative lead (`wait(START_OFFSET)` with
   * a negative offset), so its first clip starts at t < 0 and, laid out
   * naively, hangs off the left edge where it cannot be read or clicked.
   * The axis therefore spans from the earliest clip to the duration, and
   * `origin` is where t=0 falls within it.
   */
  const earliest = clips.reduce((min, c) => Math.min(min, c.start), 0)
  const origin = earliest
  const span = (duration > 0 ? duration : 1) - origin
  /** A time in seconds → its fraction along the drawn axis. */
  const frac = (t: number): number => (t - origin) / span

  // --- The ruler: whole seconds, and only as many as fit -------------------
  //
  // A tick every second is right for a 26s scene at 900px and wrong for a
  // 300s one, so the step is chosen against the available width — the
  // smallest of 1/2/5/10/30s that keeps ticks at least ~54px apart.
  const width = ruler.clientWidth || 900
  const step = [1, 2, 5, 10, 30, 60].find((s) => (s / span) * width >= 54) ?? 60
  for (let t = Math.ceil(origin / step) * step; t <= duration + 1e-6; t += step) {
    const tick = document.createElement("div")
    tick.className = "tick"
    tick.style.left = `${frac(t) * 100}%`
    const label = document.createElement("span")
    label.textContent = `${t.toFixed(0)}s`
    tick.appendChild(label)
    ruler.appendChild(tick)
  }

  // --- The rows -----------------------------------------------------------
  const spanning = clips.filter((c) => c.duration > 0)
  const packing = spanning.length > PACK_ABOVE
  /** The end time of the last row placed on each line, for packing. */
  const lineEnds: number[] = []
  /**
   * How many lines a packed timeline uses. One line is technically enough
   * for a strictly sequential scene, but it reads as a filmstrip: every
   * row abuts its neighbours and the eye loses the boundaries. Dealing the
   * rows round-robin across a few lines restores the gaps that make each
   * clip a distinct object, while still fitting the bar. Order stays
   * legible because the time axis carries it.
   */
  const PACK_LINES = 3
  /** Which line a clip goes on: its own, or the first one it fits in. */
  const lineFor = (clip: Clip, ordinal: number): number => {
    if (!packing) return ordinal
    // Prefer the line whose last row ended longest ago — that is the one
    // that leaves the widest visible gap before this row starts.
    let best = -1
    let bestEnd = Infinity
    for (let line = 0; line < PACK_LINES; line++) {
      const end = lineEnds[line] ?? -Infinity
      // A hair of slack, so two clips that merely abut do not stack.
      if (clip.start >= end - 1e-9 && end < bestEnd) {
        best = line
        bestEnd = end
      }
    }
    // Everything is occupied at this instant (genuinely overlapping
    // clips): open a further line rather than draw one row over another.
    if (best < 0) best = lineEnds.length
    lineEnds[best] = clip.start + clip.duration
    return best
  }

  // --- Resizing a row's right edge (the run_time literal, made a handle) ---
  //
  // The drag is a LIVE PREVIEW: the block resizes and a small readout
  // rides the cursor, but nothing is written until release — at which
  // point main.ts turns it into one setRunTime op and the reload
  // round-trip re-lays the whole bar out against the file's new truth.
  // Escape (capture phase, so the editor's own Escape ladder never sees
  // it) reverts the preview and writes nothing.
  interface Resizing {
    row: ClipRow
    el: HTMLElement
    grip: HTMLElement
    pointerId: number
    /** The live preview's seconds — what a release commits. */
    seconds: number
  }
  let resizing: Resizing | null = null
  const readout = document.createElement("div")
  readout.className = "resize-readout"
  container.appendChild(readout)

  const previewWidth = (el: HTMLElement, seconds: number) => {
    el.style.width = `${(seconds / span) * 100}%`
  }

  const endResize = (revert: boolean): Resizing | null => {
    if (!resizing) return null
    const r = resizing
    resizing = null
    try {
      r.grip.releasePointerCapture(r.pointerId)
    } catch {}
    r.el.classList.remove("resizing")
    readout.style.display = "none"
    if (revert) previewWidth(r.el, r.row.clip.duration)
    return r
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (resizing && e.code === "Escape") {
        e.stopPropagation()
        endResize(true)
      }
    },
    { signal: opts.signal, capture: true },
  )

  let index = 0
  let lines = 0
  for (const clip of clips) {
    // A zero-duration clip is a `set()` — an instant, not a span. It is
    // real and worth showing, but it is not a row with a width; it draws
    // as a mark on the ruler instead.
    if (clip.duration <= 0) {
      const mark = document.createElement("div")
      mark.className = "setmark"
      mark.style.left = `${frac(clip.start) * 100}%`
      mark.title = `set() at ${clip.start.toFixed(2)}s`
      ruler.appendChild(mark)
      continue
    }
    const row = describeClip(clip, index)
    const el = document.createElement("div")
    el.className = "cliprow"
    el.style.left = `${frac(clip.start) * 100}%`
    el.style.width = `${(clip.duration / span) * 100}%`
    // The vertical axis is ORDER (Keynote's build list); the horizontal is
    // time. A short scene gets one row per line, top to bottom in play
    // order; a long one packs (see PACK_ABOVE), where left-to-right still
    // carries the order because the time axis already did.
    const line = lineFor(clip, index)
    lines = Math.max(lines, line + 1)
    el.style.top = `${line * (ROW_HEIGHT + ROW_GAP)}px`
    index++
    el.title = `${row.label} · ${clip.duration.toFixed(2)}s at ${clip.start.toFixed(2)}s`

    // Sub-windows first, so the label sits over them.
    for (const w of row.windows) {
      // A window covering the whole span adds nothing over the row's own
      // edges — drawing it would just double every border.
      if (w.start <= 0 && w.stop >= 1 && row.windows.length === 1 && !row.cascade) continue
      const bar = document.createElement("div")
      bar.className = row.cascade ? "window cascade" : "window"
      bar.style.left = `${w.start * 100}%`
      bar.style.width = `${Math.max(0.5, (w.stop - w.start) * 100)}%`
      if (row.cascade) bar.title = `${w.count} staggered sub-spans (a domino)`
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
    // A row narrower than its own label shows the glyph alone rather than
    // one clipped letter and a full stop ("C."), which reads as damage.
    // The full label is always in the tooltip, and in the inspector once
    // the row is selected.
    const fraction = clip.duration / span
    // ~14% of a 900px bar is ~126px — about where a glyph, a label and a
    // duration stop fighting each other for the same twenty pixels.
    if (fraction > 0.14) {
      const text = document.createElement("span")
      text.className = "cliplabel"
      text.textContent = row.label
      face.appendChild(text)
    }
    if (fraction > 0.05) {
      const secs = document.createElement("span")
      secs.className = "clipsecs"
      secs.textContent = `${clip.duration.toFixed(clip.duration % 1 === 0 ? 0 : 1)}s`
      face.appendChild(secs)
    }
    el.appendChild(face)

    el.addEventListener(
      "pointerdown",
      (e) => {
        e.stopPropagation()
        opts.onSelect(row)
      },
      { signal: opts.signal },
    )

    if (opts.onResize) {
      const grip = document.createElement("div")
      grip.className = "grip"
      grip.title = "drag to change this clip's duration"
      el.appendChild(grip)
      grip.addEventListener(
        "pointerdown",
        (e) => {
          if (e.button !== 0) return
          e.stopPropagation()
          resizing = { row, el, grip, pointerId: e.pointerId, seconds: clip.duration }
          el.classList.add("resizing")
          try {
            grip.setPointerCapture(e.pointerId)
          } catch {}
        },
        { signal: opts.signal },
      )
      grip.addEventListener(
        "pointermove",
        (e) => {
          if (!resizing || e.pointerId !== resizing.pointerId) return
          const rect = container.getBoundingClientRect()
          if (rect.width <= 0) return
          const at = origin + ((e.clientX - rect.left) / rect.width) * span
          const seconds = Math.max(MIN_RUN_TIME, Math.round((at - clip.start) * 100) / 100)
          resizing.seconds = seconds
          previewWidth(el, seconds)
          readout.textContent = `${seconds.toFixed(2)}s`
          readout.style.display = "block"
          readout.style.left = `${Math.max(0, Math.min(rect.width, e.clientX - rect.left))}px`
        },
        { signal: opts.signal },
      )
      grip.addEventListener(
        "pointerup",
        (e) => {
          if (!resizing || e.pointerId !== resizing.pointerId) return
          // The preview stays up while the op round-trips — the reload
          // re-lays the bar out from the rewritten file either way.
          const r = endResize(false)
          if (r && Math.round(clip.duration * 100) / 100 !== r.seconds)
            opts.onResize!(r.row, r.seconds)
        },
        { signal: opts.signal },
      )
      grip.addEventListener("pointercancel", () => endResize(true), { signal: opts.signal })
    }
    container.appendChild(el)
    rows.push({ row, el })
  }

  // The stack's own height, so the container scrolls when a scene has more
  // clips than the bar is tall rather than clipping them silently.
  const stack = document.createElement("div")
  stack.className = "clipstack"
  stack.style.height = `${Math.max(1, lines) * (ROW_HEIGHT + ROW_GAP)}px`
  container.insertBefore(stack, container.firstChild)

  // --- The playhead -------------------------------------------------------
  const playhead = document.createElement("div")
  playhead.className = "playhead"
  container.appendChild(playhead)

  const timeAt = (clientX: number): number => {
    const rect = container.getBoundingClientRect()
    if (rect.width <= 0) return 0
    return Math.max(0, Math.min(duration, origin + ((clientX - rect.left) / rect.width) * span))
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
        opts.onScrub(
          Math.max(0, Math.min(duration, origin + ((e.clientX - rect.left) / rect.width) * span)),
        )
    },
    { signal: opts.signal },
  )

  return {
    get rows() {
      return rows.map((r) => r.row)
    },
    select(clip: Clip | null) {
      for (const { row, el } of rows) el.classList.toggle("selected", row.clip === clip)
    },
    setPlayhead(t: number) {
      playhead.style.left = `${frac(Math.max(origin, Math.min(duration, t))) * 100}%`
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
