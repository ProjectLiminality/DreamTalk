/**
 * screen.ts — a hand frame as the gesture layer reads it (src/gesture/hand.ts):
 * x ∈ [0, 1] left → right as the user sees the screen, y ∈ [0, 1] top →
 * bottom, z + toward the screen, `scale` the wrist → middle-knuckle span.
 *
 * The source's comfortable box (HandFrame.box) is what spans the screen:
 * x over its width, y over its height (so the cursor reaches every edge from
 * any source), z in units of its width. Structural, so this module needs
 * nothing from the gesture layer, and the gesture layer nothing from here.
 */

import { dist, J, toNdc, type HandFrame, type Vec3 } from "../src/hands"

export interface ScreenHand {
  id: number
  side: "left" | "right"
  confidence: number
  joints: [number, number, number][]
  scale: number
  pinch?: number
  grab?: number
  /** Thumb–index gap and the least-curled fingertip's reach from the palm, in hand sizes, measured in millimetres (x and y stretch differently on screen). */
  gap: number
  reach: number
}

/** The palm centre (wrist and the four finger roots) and the farthest of the four fingertips from it, in hand sizes. */
const reachOf = (j: readonly Vec3[], size: number): number => {
  const roots = [J.wrist, J.indexMcp, J.middleMcp, J.ringMcp, J.pinkyMcp]
  const c: Vec3 = [0, 0, 0]
  for (const i of roots) for (let k = 0; k < 3; k++) c[k]! += j[i]![k]! / roots.length
  let r = 0
  for (const i of [J.indexTip, J.middleTip, J.ringTip, J.pinkyTip]) r = Math.max(r, dist(j[i]!, c))
  return r / size
}

export interface ScreenFrame {
  t: number
  source: string
  hands: ScreenHand[]
  /** The box's width over its height: how much wider a screen unit of x is than one of y. */
  aspect: number
}

export const screenFrame = (f: HandFrame): ScreenFrame => {
  const zUnit = f.box.size[0] / f.box.size[2]
  return {
    t: f.t,
    source: f.source,
    aspect: f.box.size[0] / f.box.size[1],
    hands: f.hands.map((h) => {
      const size = dist(h.joints[J.wrist]!, h.joints[J.middleMcp]!) || 1
      const joints = h.joints.map((p): [number, number, number] => {
        const n = toNdc(p, f.box)
        return [(n[0] + 1) / 2, (1 - n[1]) / 2, -n[2] / 2 / zUnit]
      })
      return {
        id: h.id,
        side: h.side,
        confidence: h.confidence,
        joints,
        scale: dist(joints[J.wrist]!, joints[J.middleMcp]!),
        ...(h.pinch === undefined ? {} : { pinch: h.pinch }),
        ...(h.grab === undefined ? {} : { grab: h.grab }),
        gap: dist(h.joints[J.thumbTip]!, h.joints[J.indexTip]!) / size,
        reach: reachOf(h.joints, size),
      }
    }),
  }
}
