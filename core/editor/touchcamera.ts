/**
 * Touch for the viewer's camera — the two-finger half, shared by the
 * player's game loop and the editor's viewport (src/view.ts flies both).
 *
 *   one finger   — the host's own drag (it already orbits: pointer events)
 *   two fingers  — pinch: the span's ratio dollies (apart = closer), the
 *                  midpoint's travel pans
 *   double-tap   — `onDoubleTap` (the hosts frame what is under it)
 *
 * It listens in the CAPTURE phase and swallows a pinch's pointer events,
 * so a host's own handlers never see the second finger — no selection on
 * landing, no click on lifting — and only have to drop the drag the first
 * finger began (`onPinchStart`). The HOST sets `touch-action: none` on
 * the canvas while it is live, before any gesture: a browser decides a
 * touch's fate at first contact, so a listener setting it is too late.
 */

import { DOLLY_PER_NOTCH, type ViewLayer } from "../src/view"

export interface TouchCameraOpts {
  /** May the viewer fly right now (paused editor; game loop on)? */
  live(): boolean
  /** The layer to fly. */
  view(): ViewLayer | undefined
  /** The second finger landed: drop whatever the first one started. */
  onPinchStart?(): void
  /** The view moved — a host that only paints on demand (the paused editor) repaints. */
  onChange?(): void
  /** Two quick taps in one place (client px). */
  onDoubleTap?(clientX: number, clientY: number): void
  signal: AbortSignal
}

/** A double-tap: this soon, this near (a fingertip lands less precisely than a cursor). */
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_PX = 16
/** A tap that travelled further than this was a drag. */
const TAP_SLOP = 8

export interface TouchCamera {
  /** Is a two-finger gesture in progress? */
  readonly pinching: boolean
}

export const touchCamera = (canvas: HTMLCanvasElement, opts: TouchCameraOpts): TouchCamera => {
  const touches = new Map<number, { x: number; y: number; x0: number; y0: number }>()
  let pinch: { dist: number; mid: { x: number; y: number } } | null = null
  let lastTap: { x: number; y: number; at: number } | null = null
  const capture = { signal: opts.signal, capture: true }

  const state = () => {
    const [a, b] = [...touches.values()]
    return { dist: Math.hypot(b!.x - a!.x, b!.y - a!.y), mid: { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 } }
  }

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType !== "touch" || !opts.live() || !opts.view()) return
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY })
      if (touches.size === 2) {
        pinch = state()
        opts.onPinchStart?.()
      }
      if (touches.size >= 2) e.stopImmediatePropagation()
    },
    capture,
  )
  canvas.addEventListener(
    "pointermove",
    (e) => {
      const t = touches.get(e.pointerId)
      if (!t) return
      t.x = e.clientX
      t.y = e.clientY
      const view = opts.view()
      if (!pinch || touches.size < 2 || !view) return
      e.stopImmediatePropagation()
      const now = state()
      if (pinch.dist > 0 && now.dist > 0) view.dolly(-Math.log(now.dist / pinch.dist) / DOLLY_PER_NOTCH)
      view.pan(now.mid.x - pinch.mid.x, now.mid.y - pinch.mid.y, canvas.getBoundingClientRect().height)
      pinch = now
      opts.onChange?.()
    },
    capture,
  )
  const lift = (e: PointerEvent, cancelled: boolean) => {
    const t = touches.get(e.pointerId)
    if (!t) return
    touches.delete(e.pointerId)
    if (pinch) {
      // The gesture ends with its fingers: the one left behind neither
      // clicks nor drags until it lifts too.
      e.stopImmediatePropagation()
      if (touches.size === 0) pinch = null
      return
    }
    if (cancelled || Math.hypot(e.clientX - t.x0, e.clientY - t.y0) > TAP_SLOP) return
    const now = performance.now()
    if (lastTap && now - lastTap.at < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_PX) {
      lastTap = null
      opts.onDoubleTap?.(e.clientX, e.clientY)
      return
    }
    lastTap = { x: e.clientX, y: e.clientY, at: now }
  }
  canvas.addEventListener("pointerup", (e) => lift(e, false), capture)
  canvas.addEventListener("pointercancel", (e) => lift(e, true), capture)

  return {
    get pinching() {
      return pinch !== null
    },
  }
}
