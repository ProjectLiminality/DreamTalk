/**
 * The selection affordance — C4D-flavoured, minimal, and strictly
 * OUTSIDE the render.
 *
 * It is drawn on its own 2D canvas stacked over the WebGPU stage, never
 * into the scene: no holon is added, no material is touched, no frame the
 * renderer produces contains a pixel of it. That is what makes it
 * impossible for the affordance to reach a gauntlet screenshot — the
 * gauntlet drives the /demo/ page, which has no marquee canvas at all,
 * and even here the render surface itself stays clean.
 *
 * The mark itself: four corner ticks in DreamTalk BLUE around the
 * selection's screen bounds. Corners rather than a full box because a
 * closed rectangle competes with the strokes it surrounds; ticks read as
 * "this region", the way C4D's selection bracket does, and leave the
 * artwork legible through them.
 */

import type * as THREE from "three/webgpu"

/** Selection blue — TASTE's canonical #00A2FF. */
const BLUE = "#00a2ff"
/** Tick arm length in canvas pixels. */
const TICK = 14
/** Breathing room between the ink and the mark. */
const PAD = 8
/** The smallest mark that still reads as one — a thin line, a bare Null. */
const MIN_SIZE = 22

export class Marquee {
  readonly canvas: HTMLCanvasElement
  /** Opt-out: with the affordance off, nothing is ever painted. */
  enabled = true

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  clear(): void {
    const ctx = this.canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  /**
   * Paint the mark around `bounds`, given in the RENDER's pixel space
   * (the host measures against its own drawing buffer). The marquee
   * canvas carries the same nominal size, so the mapping is the identity;
   * `renderSize` is taken explicitly anyway so the two can diverge.
   */
  draw(bounds: THREE.Box3 | undefined, renderWidth: number, renderHeight: number): void {
    this.clear()
    if (!this.enabled || !bounds) return
    const ctx = this.canvas.getContext("2d")
    if (!ctx) return
    const sx = this.canvas.width / (renderWidth || this.canvas.width)
    const sy = this.canvas.height / (renderHeight || this.canvas.height)

    let x0 = bounds.min.x * sx - PAD
    let y0 = bounds.min.y * sy - PAD
    let x1 = bounds.max.x * sx + PAD
    let y1 = bounds.max.y * sy + PAD
    // A degenerate box — a Null with no ink, or a dead-straight line whose
    // bounds are one pixel tall — still deserves a mark. MIN_SIZE keeps
    // both arms of every corner visible whatever the selection's shape.
    if (x1 - x0 < MIN_SIZE) {
      const cx = (x0 + x1) / 2
      x0 = cx - MIN_SIZE / 2
      x1 = cx + MIN_SIZE / 2
    }
    if (y1 - y0 < MIN_SIZE) {
      const cy = (y0 + y1) / 2
      y0 = cy - MIN_SIZE / 2
      y1 = cy + MIN_SIZE / 2
    }
    // Clip to the frame. A grid line 5000 units long has its true corners
    // far off screen, and a mark nobody can see is not an affordance — so
    // the bracket runs along the frame edge where the selection leaves it,
    // exactly as a viewport-clipped selection bracket does in C4D.
    const margin = 2
    const left = Math.max(x0, margin)
    const right = Math.min(x1, this.canvas.width - margin)
    const top = Math.max(y0, margin)
    const bottom = Math.min(y1, this.canvas.height - margin)
    if (right <= left || bottom <= top) return

    ctx.save()
    ctx.strokeStyle = BLUE
    ctx.lineWidth = 2
    ctx.lineCap = "butt"
    const arm = Math.min(TICK, (right - left) / 3, (bottom - top) / 3)
    const corner = (px: number, py: number, dx: number, dy: number) => {
      ctx.beginPath()
      ctx.moveTo(px + dx * arm, py)
      ctx.lineTo(px, py)
      ctx.lineTo(px, py + dy * arm)
      ctx.stroke()
    }
    corner(left, top, 1, 1)
    corner(right, top, -1, 1)
    corner(right, bottom, -1, -1)
    corner(left, bottom, 1, -1)
    ctx.restore()
  }
}
