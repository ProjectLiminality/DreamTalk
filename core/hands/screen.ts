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

import { dist, J, toNdc, type HandFrame } from "../src/hands"

export interface ScreenHand {
  id: number
  side: "left" | "right"
  confidence: number
  joints: [number, number, number][]
  scale: number
  pinch?: number
  grab?: number
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
      }
    }),
  }
}
