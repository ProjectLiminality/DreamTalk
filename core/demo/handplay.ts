/**
 * Hands in the player and the paused editor — the gesture layer
 * (src/gesture) wired to a host: the pinch cursor hovers, a pinch clicks the
 * symbol part under it (its axis fires), a pinch-and-drag on a handle scrubs
 * that axis, a double pinch frames, and closed hands grab the whole scene
 * through the view layer (keep-outs and surface orbit included).
 *
 * THE CURSOR. Like the reMarkable's pen hovering above the glass: a small
 * gold point where a pinch would land, growing as the fingers approach,
 * solid when they touch. It drives the host's own hover affordance (the
 * golden glow), so a symbol part lights up before it is clicked.
 *
 * FRAMES IN. Any HandFrame source — the webcam, a Leap, a recorded take, the
 * simulator (src/hands) — subscribes, or frames are pushed (`push`, the
 * harness's `window.__dtHands.push`). Every decision runs on the frame's own
 * clock, so a replay clicks the same parts at the same moments.
 *
 * CALIBRATION. `calibrate()` asks for a few pinches at gold rings around the
 * screen and fits this user's thumb bias (pinch.ts fitCalibration), stored
 * in this browser (localStorage) and applied at once.
 */

import { GestureController, type Intent } from "../src/gesture/controller"
import { DEFAULT_CALIBRATION, fitCalibration, type PinchCalibration, type PinchSample } from "../src/gesture/pinch"
import type { HandFrame } from "../src/gesture/hand"
import { DOLLY_PER_NOTCH, type ViewLayer } from "../src/view"
import { GOLD, cssOf } from "../src/constants"
import { beginOverlay, makeOverlay } from "../editor/overlay"

/** What a host offers the hands — the GameLoop in the player, the walk + view in the editor. */
export interface HandTarget {
  /** May the hands act now (free play on; editor paused)? */
  live(): boolean
  hoverAt(clientX: number, clientY: number): unknown
  /** A click, with the host's double-click rule (a double pinch frames). */
  click(clientX: number, clientY: number): unknown
  axisAt(clientX: number, clientY: number): string | undefined
  axisIndex(id: string): { i: number; n: number }
  scrubAxis(id: string, u: number): void
  settleAxis(id: string): void
  view(): ViewLayer | undefined
  /** The view or a pose changed: a host that only paints on demand repaints. */
  changed?(): void
}

export interface HandSource {
  subscribe(fn: (frame: HandFrame) => void): () => void
}

/** How far the hand travels (screen widths) to scrub one position along an axis. */
const SCRUB_STEP = 0.25
const CALIBRATION_KEY = "dreamtalk.pinch-calibration"
/** Where calibration asks for pinches: spread over the screen. */
const CALIBRATION_TARGETS = [
  { x: 0.5, y: 0.5 },
  { x: 0.25, y: 0.3 },
  { x: 0.75, y: 0.3 },
  { x: 0.25, y: 0.7 },
  { x: 0.75, y: 0.7 },
  { x: 0.5, y: 0.2 },
]

const loadCalibration = (): PinchCalibration => {
  try {
    const raw = localStorage.getItem(CALIBRATION_KEY)
    if (raw) {
      const c = JSON.parse(raw) as PinchCalibration
      if ([c.w, c.ox, c.oy].every(Number.isFinite)) return c
    }
  } catch {}
  return { ...DEFAULT_CALIBRATION }
}

export interface HandPlay {
  /** Feed one frame (any source). Returns the intents it produced. */
  push(frame: HandFrame): Intent
  /** Ask for pinches at gold rings and fit this user's thumb bias. */
  calibrate(): Promise<PinchCalibration>
  readonly controller: GestureController
}

export const mountHands = (opts: {
  target: HandTarget
  signal: AbortSignal
  source?: HandSource
}): HandPlay => {
  const { target } = opts
  const controller = new GestureController({ pinch: { calibration: loadCalibration() } })
  const overlay = makeOverlay("dt-hand-cursor", 70)
  document.body.append(overlay)
  opts.signal.addEventListener("abort", () => overlay.remove())

  let scrub: { id: string; i: number; n: number; moved: boolean } | undefined
  let calibration: { k: number; samples: PinchSample[]; done: (c: PinchCalibration) => void } | undefined
  const client = (p: { x: number; y: number }) => ({ x: p.x * window.innerWidth, y: p.y * window.innerHeight })

  const paint = (it: Intent) => {
    const ctx = beginOverlay(overlay)
    if (!ctx) return
    const gold = (a: number) => cssOf(GOLD, a)
    if (calibration) {
      const tg = CALIBRATION_TARGETS[calibration.k]!
      const p = client(tg)
      ctx.strokeStyle = gold(0.9)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(p.x, p.y, 18, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.fillStyle = gold(0.8)
      ctx.font = "13px monospace"
      ctx.fillText(`pinch on the ring  ${calibration.k + 1} / ${CALIBRATION_TARGETS.length}`, p.x - 90, p.y + 40)
    }
    const c = it.cursor
    if (!c.tracked || it.grab.holding) return
    const p = client(c)
    // The pen above the glass: small and faint far off, larger and brighter
    // as the fingers close, solid when they touch.
    const r = 3 + 7 * c.approach
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, 2 * Math.PI)
    if (c.pinched) {
      ctx.fillStyle = gold(0.95)
      ctx.fill()
    } else {
      ctx.fillStyle = gold(0.15 + 0.45 * c.approach)
      ctx.fill()
      ctx.strokeStyle = gold(0.5 + 0.5 * c.approach)
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }

  const push = (frame: HandFrame): Intent => {
    const it = controller.update(frame)
    if (!target.live()) {
      paint(it)
      return it
    }
    const c = it.cursor
    if (c.tracked && !it.grab.holding) {
      const p = client(c)
      target.hoverAt(p.x, p.y)
    }
    if (calibration) {
      if (it.press && c.sample) {
        calibration.samples.push(c.sample)
        calibration.k++
        if (calibration.k >= CALIBRATION_TARGETS.length) {
          const fit = fitCalibration(calibration.samples)
          controller.cursor.calibration = fit
          try {
            localStorage.setItem(CALIBRATION_KEY, JSON.stringify(fit))
          } catch {}
          const done = calibration.done
          calibration = undefined
          done(fit)
        }
      }
    } else {
      if (it.press) {
        const p = client(it.press)
        const id = target.axisAt(p.x, p.y)
        scrub = id ? { id, ...target.axisIndex(id), moved: false } : undefined
      }
      if (it.drag && scrub) {
        scrub.moved = true
        target.scrubAxis(scrub.id, scrub.i + it.drag.dx / SCRUB_STEP)
      }
      if (it.dragEnd) {
        if (scrub?.moved) target.settleAxis(scrub.id)
        scrub = undefined
      }
      if (it.click) {
        const p = client(it.click)
        target.click(p.x, p.y)
        scrub = undefined
      }
    }
    // Grab: the scene in the hands, through the view layer like any gesture.
    const view = target.view()
    const g = it.grab
    if (view && (g.orbit.x || g.orbit.y || g.pan.x || g.pan.y || g.dolly)) {
      const W = window.innerWidth
      const H = window.innerHeight
      if (g.orbit.x || g.orbit.y) view.orbit(g.orbit.x * W, g.orbit.y * W, W)
      if (g.pan.x || g.pan.y) view.pan(g.pan.x * W, g.pan.y * H, H)
      if (g.dolly) view.dolly(g.dolly / DOLLY_PER_NOTCH)
      target.changed?.()
    }
    paint(it)
    return it
  }

  const unsubscribe = opts.source?.subscribe(push)
  if (unsubscribe) opts.signal.addEventListener("abort", unsubscribe)

  return {
    push,
    controller,
    calibrate: () =>
      new Promise<PinchCalibration>((resolve) => {
        calibration = { k: 0, samples: [], done: resolve }
      }),
  }
}
