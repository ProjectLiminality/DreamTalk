/**
 * The hand as the gesture layer reads it — a SCREEN PROJECTION of the one
 * canonical HandFrame (src/hands.ts: millimetres, device-centred, +y up,
 * +z toward the user, every source — webcam, Leap, replay, simulator). The
 * projection is hands/screen.ts `screenFrame(f)`: the source's comfortable
 * box spans the screen, so
 *
 *   x ∈ [0,1] left → right as the user sees the screen,
 *   y ∈ [0,1] top → bottom,
 *   z depth in units of the box's width, + away from the user (toward the screen),
 *   scale = wrist → middle knuckle in those units.
 *
 * Joints are MediaPipe's 21 landmarks. `t` is the source clock in seconds:
 * every filter here runs on it, so a replay is deterministic. Nothing here
 * is a second canonical frame — the gesture layer only ever reads this view.
 */

export type Joint = readonly [number, number, number]

export interface Hand {
  id: number
  side: "left" | "right"
  confidence: number
  joints: readonly Joint[]
  /** Hand size, wrist → middle MCP, in the joints' units. */
  scale: number
  pinch?: number
  grab?: number
}

export interface HandFrame {
  t: number
  source: string
  hands: readonly Hand[]
  aspect?: number
}

/** MediaPipe landmark indices used here. */
export const J = {
  wrist: 0,
  thumbTip: 4,
  indexMcp: 5,
  indexTip: 8,
  middleMcp: 9,
  middleTip: 12,
  ringMcp: 13,
  ringTip: 16,
  pinkyMcp: 17,
  pinkyTip: 20,
} as const

export const dist = (a: Joint, b: Joint): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** The palm's centre: wrist and the four finger roots, averaged. */
export const palm = (h: Hand): Joint => {
  const ids = [J.wrist, J.indexMcp, J.middleMcp, J.ringMcp, J.pinkyMcp]
  let x = 0
  let y = 0
  let z = 0
  for (const i of ids) {
    const p = h.joints[i]!
    x += p[0]
    y += p[1]
    z += p[2]
  }
  return [x / ids.length, y / ids.length, z / ids.length]
}

/**
 * How closed the hand is, 0 open … 1 fist. The device's own reading when it
 * has one (the Leap and the simulator do); otherwise the four fingertips'
 * mean distance to the palm centre, in hand sizes, mapped from open (~1.15:
 * the palm centre sits ~0.8 up the palm, the tips ~1.9) to a fist (~0.55).
 * Scale-free, so near and far hands read alike.
 */
export const grabStrength = (h: Hand): number => {
  if (h.grab !== undefined) return h.grab
  const c = palm(h)
  const tips = [J.indexTip, J.middleTip, J.ringTip, J.pinkyTip]
  let d = 0
  for (const i of tips) d += dist(h.joints[i]!, c)
  const r = d / tips.length / (h.scale || 1)
  return Math.min(1, Math.max(0, (1.15 - r) / (1.15 - 0.55)))
}
