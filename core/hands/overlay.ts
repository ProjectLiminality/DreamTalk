/**
 * overlay.ts — a small window onto the hands: the source's status line and
 * its skeletons, seen from the front, in the corner of the page.
 *
 * Quiet by design (TASTE: flat red / blue / white on black): the right hand
 * blue, the left red, the thumb–index span white while it closes. A dot
 * marks a session recording hand frames. `?skeleton=full` also lays the
 * skeletons over the whole viewport, mapped by toNdc — what the interaction
 * layer sees.
 */

import { BONES, J, toNdc, type HandFrame } from "../src/hands"

const BLUE = "#00A2FF"
const RED = "#FF644E"

export interface HandsOverlay {
  draw(frame: HandFrame | undefined): void
  status(text: string): void
  recording(on: boolean): void
  dispose(): void
}

export const mountOverlay = (parent: HTMLElement, opts: { full?: boolean } = {}): HandsOverlay => {
  const box = document.createElement("div")
  box.className = "dt-hands"
  box.style.cssText =
    "position:fixed;left:12px;bottom:12px;z-index:50;width:200px;font:11px/1.4 -apple-system,system-ui,sans-serif;" +
    "color:#aaa;background:rgba(0,0,0,.72);border:1px solid #333;border-radius:6px;padding:6px;pointer-events:none"
  const mini = document.createElement("canvas")
  mini.width = 376
  mini.height = 240
  mini.style.cssText = "width:188px;height:120px;display:block"
  const line = document.createElement("div")
  line.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:4px"
  const dot = document.createElement("span")
  dot.textContent = "● "
  dot.style.cssText = `color:${RED};display:none`
  const text = document.createElement("span")
  line.append(dot, text)
  box.append(mini, line)
  parent.append(box)

  let full: HTMLCanvasElement | undefined
  if (opts.full) {
    full = document.createElement("canvas")
    full.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:49;pointer-events:none"
    parent.append(full)
  }

  const paint = (c: HTMLCanvasElement, frame: HandFrame | undefined, lw: number) => {
    const g = c.getContext("2d")
    if (!g) return
    g.clearRect(0, 0, c.width, c.height)
    if (!frame) return
    const px = (p: [number, number, number]) => {
      const n = toNdc(p, frame.box)
      return [((n[0] + 1) / 2) * c.width, ((1 - n[1]) / 2) * c.height] as const
    }
    for (const h of frame.hands) {
      const pts = h.joints.map(px)
      g.strokeStyle = h.side === "right" ? BLUE : RED
      g.lineWidth = lw
      g.globalAlpha = 0.4 + 0.6 * h.confidence
      g.beginPath()
      for (const [a, b] of BONES) {
        g.moveTo(pts[a]![0], pts[a]![1])
        g.lineTo(pts[b]![0], pts[b]![1])
      }
      g.stroke()
      const t = pts[J.thumbTip]!
      const i = pts[J.indexTip]!
      g.strokeStyle = "#fff"
      g.globalAlpha = Math.min(1, 0.2 + (h.pinch ?? 0))
      g.beginPath()
      g.moveTo(t[0], t[1])
      g.lineTo(i[0], i[1])
      g.stroke()
      g.globalAlpha = 1
    }
  }

  return {
    draw(frame) {
      paint(mini, frame, 2)
      if (full) {
        const w = Math.round(innerWidth * devicePixelRatio)
        const h = Math.round(innerHeight * devicePixelRatio)
        if (full.width !== w || full.height !== h) {
          full.width = w
          full.height = h
        }
        paint(full, frame, 2 * devicePixelRatio)
      }
    },
    status(s) {
      text.textContent = s
    },
    recording(on) {
      dot.style.display = on ? "inline" : "none"
    },
    dispose() {
      box.remove()
      full?.remove()
    },
  }
}
