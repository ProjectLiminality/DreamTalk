/**
 * Comment markers — where a note was left, shown on the thing itself.
 *
 * Creator mode's comment mode (demo/creatorpanel.ts) anchors a note to a
 * holon AND to the t it was made at. So the marker is too: a small, calm
 * disc at the top-right of the holon's ink, there only while the song
 * stands within NEAR of that t, and only for notes still open. Resolve one
 * and its disc goes; reopen it and it comes back. The presentation never
 * carries them — they exist only in creator mode, on a DOM overlay, never
 * in the Dream, so a capture cannot either.
 *
 * Several notes on one holon at one moment share one disc with a count.
 * Clicking a disc does what clicking the comment's time in the panel does:
 * select that holon and stand at that t.
 */

import type { Holon } from "../src/holon"
import type { Comment } from "../editor/comments"
import { resolvePath } from "../editor/selection"
import { bufferToClient, type PixelBox } from "../editor/creator"

/** How close (s) the song must stand to a note's t for its disc to show. */
export const NEAR = 0.5

const STYLE = `
.dt-cmarks { position: fixed; inset: 0; pointer-events: none; z-index: 58; }
.dt-cmark { position: absolute; transform: translate(-50%, -50%); min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 9px; background: rgba(245,245,240,.92); color: #151515; box-sizing: border-box;
  font: 600 10px/18px -apple-system, system-ui, sans-serif; text-align: center; cursor: pointer;
  pointer-events: auto; box-shadow: 0 0 0 1px rgba(255,199,84,.55), 0 1px 6px rgba(0,0,0,.45);
  opacity: 0; animation: dt-cmark-in .35s ease-out forwards; }
.dt-cmark:hover { box-shadow: 0 0 0 1.5px rgba(255,199,84,.95), 0 1px 8px rgba(0,0,0,.5); }
@keyframes dt-cmark-in { to { opacity: 1 } }
`

/** The open notes standing at `t`, grouped by the holon they resolve to now. */
export const marksAt = (
  roots: readonly Holon[],
  comments: readonly Comment[],
  t: number,
): Map<Holon, Comment[]> => {
  const out = new Map<Holon, Comment[]>()
  for (const c of comments) {
    if (c.resolved || !c.path || Math.abs(c.t - t) > NEAR) continue
    const holon = resolvePath(roots, c.path)
    if (!holon) continue
    const list = out.get(holon)
    if (list) list.push(c)
    else out.set(holon, [c])
  }
  return out
}

export interface CommentMarks {
  set(comments: readonly Comment[]): void
}

export const mountCommentMarks = (opts: {
  canvas: HTMLCanvasElement
  roots: readonly Holon[]
  boundsOf: (holon: Holon) => PixelBox | undefined
  now: () => number
  /** Shown only while this holds — creator mode. */
  active: () => boolean
  onPick: (comment: Comment) => void
  signal: AbortSignal
}): CommentMarks => {
  if (!document.getElementById("dt-cmark-style")) {
    const style = document.createElement("style")
    style.id = "dt-cmark-style"
    style.textContent = STYLE
    document.head.append(style)
  }
  const layer = document.createElement("div")
  layer.className = "dt-cmarks"
  document.body.append(layer)
  let comments: readonly Comment[] = []
  /** One disc per holon, kept across frames so its fade-in plays once. */
  const discs = new Map<Holon, HTMLDivElement>()

  const paint = () => {
    const live = opts.active() ? marksAt(opts.roots, comments, opts.now()) : new Map<Holon, Comment[]>()
    const rect = opts.canvas.getBoundingClientRect()
    for (const [holon, disc] of discs)
      if (!live.has(holon)) {
        disc.remove()
        discs.delete(holon)
      }
    for (const [holon, notes] of live) {
      const box = opts.boundsOf(holon)
      if (!box) continue
      const r = bufferToClient(box, rect, opts.canvas)
      let disc = discs.get(holon)
      if (!disc) {
        disc = document.createElement("div")
        disc.className = "dt-cmark"
        layer.append(disc)
        discs.set(holon, disc)
      }
      const first = notes[0]!
      disc.textContent = String(notes.length)
      disc.title = notes.map((n) => n.text).join("\n—\n")
      disc.dataset.ids = notes.map((n) => n.id).join(",")
      disc.onclick = () => opts.onPick(first)
      disc.style.left = `${r.x + r.w + 4}px`
      disc.style.top = `${r.y - 4}px`
    }
  }

  let raf = 0
  const tick = () => {
    paint()
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  opts.signal.addEventListener("abort", () => {
    cancelAnimationFrame(raf)
    layer.remove()
  })

  return {
    set: (next) => {
      comments = next
      paint()
    },
  }
}
