import { describe, expect, test } from "bun:test"
import { GestureController } from "../src/gesture/controller"
import { GrabController } from "../src/gesture/grab"
import { grabStrength, type Hand, type HandFrame, type Joint } from "../src/gesture/hand"

/**
 * A whole synthetic hand: palm centred at (x, y, z), hand size `s`.
 * `open` 1 = fingers stretched, 0 = a fist; `pinch` 0 = thumb and index
 * apart, 1 = touching (the index and thumb tips close on the point just
 * above-left of the palm, thumb travelling ⅓ as far).
 */
const hand = (id: number, side: "left" | "right", x: number, y: number, o: { open?: number; pinch?: number; z?: number; s?: number } = {}): Hand => {
  const s = o.s ?? 0.1
  const open = o.open ?? 1
  const z = o.z ?? 0
  const j: Joint[] = Array.from({ length: 21 }, () => [x, y, z] as Joint)
  // wrist below the palm, finger roots above it
  j[0] = [x, y + 0.5 * s, z]
  const roots: [number, number][] = [[5, -0.3], [9, -0.1], [13, 0.1], [17, 0.3]]
  for (const [i, dx] of roots) j[i] = [x + dx * s, y - 0.5 * s, z]
  // fingertips ~1.2 s from the palm centre when stretched (real proportions),
  // ~0.45 s in a fist; the palm centre sits 0.3 s above the given point
  const reach = (0.45 + 0.75 * open) * s
  for (const [i, dx] of roots) j[i + 3] = [x + dx * s, y - 0.3 * s - Math.sqrt(Math.max(0, reach * reach - (dx * s) ** 2)), z]
  // pinch: the index tip and thumb tip close on a contact point (out front);
  // without a pinch the index curls with the other fingers (a fist curls all four)
  const contact = { x: x - 0.4 * s, y: y - 0.9 * s }
  const gap = 1.0 * s * (1 - (o.pinch ?? 0))
  if ((o.pinch ?? 0) > 0 || open >= 1) j[8] = [contact.x + 0.75 * gap * 0.7, contact.y - 0.75 * gap * 0.7, z]
  j[4] = [contact.x - 0.25 * gap * 0.7, contact.y + 0.25 * gap * 0.7, z]
  return { id, side, confidence: 1, joints: j, scale: s }
}

const frame = (t: number, ...hands: Hand[]): HandFrame => ({ t, source: "test", hands })

describe("grab strength", () => {
  test("an open hand is 0, a fist is 1, scale-free", () => {
    expect(grabStrength(hand(1, "right", 0.5, 0.5, { open: 1 }))).toBeLessThan(0.2)
    expect(grabStrength(hand(1, "right", 0.5, 0.5, { open: 0 }))).toBeGreaterThan(0.85)
    expect(grabStrength(hand(1, "right", 0.5, 0.5, { open: 0, s: 0.3 }))).toBeCloseTo(grabStrength(hand(1, "right", 0.5, 0.5, { open: 0 })), 9)
  })
})

describe("gesture controller", () => {
  const run = (frames: HandFrame[]) => {
    const c = new GestureController()
    return frames.map((f) => c.update(f))
  }
  const pinchTake = (dx = 0) => {
    const fs: HandFrame[] = []
    let t = 0
    for (let k = 0; k < 30; k++, t += 1 / 60) fs.push(frame(t, hand(1, "right", 0.5, 0.5)))
    for (let k = 0; k <= 10; k++, t += 1 / 60) fs.push(frame(t, hand(1, "right", 0.5, 0.5, { pinch: k / 10 })))
    for (let k = 1; k <= 20; k++, t += 1 / 60) fs.push(frame(t, hand(1, "right", 0.5 + (dx * k) / 20, 0.5, { pinch: 1 })))
    for (let k = 0; k <= 10; k++, t += 1 / 60) fs.push(frame(t, hand(1, "right", 0.5 + dx, 0.5, { pinch: 1 - k / 10 })))
    return fs
  }

  test("a pinch that does not travel is one click, where the cursor hovered", () => {
    const out = run(pinchTake(0))
    const clicks = out.filter((i) => i.click)
    expect(clicks.length).toBe(1)
    const hovered = out[29]!.cursor
    expect(Math.hypot(clicks[0]!.click!.x - hovered.x, clicks[0]!.click!.y - hovered.y)).toBeLessThan(0.003)
    expect(out.some((i) => i.drag)).toBe(false)
  })

  test("a pinch that travels is a drag (a scrub on a handle) — and no click", () => {
    const out = run(pinchTake(0.2))
    expect(out.filter((i) => i.press).length).toBe(1)
    expect(out.some((i) => i.click)).toBe(false)
    const drags = out.filter((i) => i.drag)
    expect(drags.at(-1)!.drag!.dx).toBeGreaterThan(0.15)
    expect(out.filter((i) => i.dragEnd).length).toBe(1)
  })

  test("a fist never clicks — it grabs", () => {
    const fs: HandFrame[] = []
    let t = 0
    for (let k = 0; k <= 20; k++, t += 1 / 60) fs.push(frame(t, hand(1, "right", 0.5, 0.5, { open: 1 - k / 20, pinch: k / 20 })))
    for (let k = 0; k < 20; k++, t += 1 / 60) fs.push(frame(t, hand(1, "right", 0.5, 0.5, { open: 0, pinch: 1 })))
    const out = run(fs)
    expect(out.some((i) => i.click || i.press)).toBe(false)
    expect(out.at(-1)!.grab.holding).toBe(true)
  })

  test("deterministic: the same take, the same intents", () => {
    expect(JSON.stringify(run(pinchTake(0.1)))).toBe(JSON.stringify(run(pinchTake(0.1))))
  })
})

describe("grab", () => {
  test("one closed hand moving right turns the scene by its travel; release carries momentum that dies away", () => {
    const g = new GrabController()
    let t = 0
    let orbit = 0
    for (let k = 0; k <= 30; k++, t += 1 / 60) orbit += g.update([hand(1, "right", 0.3 + (0.3 * k) / 30, 0.5, { open: 0 })], t).orbit.x
    expect(orbit).toBeCloseTo(0.3, 6)
    // let go: the turn carries on, then dies away
    const after: number[] = []
    for (let k = 0; k < 120; k++, t += 1 / 60) after.push(g.update([hand(1, "right", 0.6, 0.5, { open: 1 })], t).orbit.x)
    expect(after[0]!).toBeGreaterThan(0)
    expect(after.reduce((a, b) => a + b, 0)).toBeLessThan(0.2) // a natural coast, not a fling
    expect(Math.abs(after.at(-1)!)).toBeLessThan(1e-4)
  })

  test("two closed hands spreading apart dolly in; turning the pair turns the scene", () => {
    const g = new GrabController()
    let t = 0
    let dolly = 0
    let turn = 0
    for (let k = 0; k <= 30; k++, t += 1 / 60) {
      const half = 0.1 + (0.1 * k) / 30 // spread from 0.2 to 0.4 apart
      const a = (0.25 * Math.PI * k) / 30 // and turn the pair by 45°
      const d = g.update(
        [
          hand(1, "left", 0.5 - half * Math.cos(a), 0.5 - half * Math.sin(a), { open: 0 }),
          hand(2, "right", 0.5 + half * Math.cos(a), 0.5 + half * Math.sin(a), { open: 0 }),
        ],
        t,
      )
      dolly += d.dolly
      turn += d.orbit.x
    }
    expect(dolly).toBeCloseTo(-Math.log(2), 6) // twice as far apart → closer by ×2
    expect(turn).toBeCloseTo(1 / 8, 6) // 45° = an eighth of a full turn
  })
})
