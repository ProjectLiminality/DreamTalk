import { describe, expect, test } from "bun:test"
import { DEFAULT_CALIBRATION, PinchCursor, fitCalibration, type PinchSample } from "../src/gesture/pinch"
import { OneEuro } from "../src/gesture/oneeuro"
import type { Hand, Joint } from "../src/gesture/hand"

/**
 * A synthetic hand closing a pinch onto `contact`: the thumb travels
 * `ratio` as far as the index (real hands: ~⅓), from a gap of `gap` hand
 * sizes, along `dir`. u = 0 open … 1 touching. Other joints sit around the
 * palm — only the tips matter here.
 */
const handAt = (contact: { x: number; y: number }, u: number, opts: { ratio?: number; gap?: number; dir?: number; scale?: number; jitter?: number; seed?: number } = {}): Hand => {
  const ratio = opts.ratio ?? 1 / 3
  const scale = opts.scale ?? 0.1
  const gap = (opts.gap ?? 1) * scale
  const dir = opts.dir ?? -Math.PI / 4
  const open = 1 - u
  // index travels gap/(1+ratio), thumb gap·ratio/(1+ratio), opposite sides of the contact.
  const ia = (gap / (1 + ratio)) * open
  const ta = ((gap * ratio) / (1 + ratio)) * open
  const ux = Math.cos(dir)
  const uy = Math.sin(dir)
  let s = opts.seed ?? 1
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * (opts.jitter ?? 0)
  const joints: Joint[] = Array.from({ length: 21 }, (_, i) => [contact.x + 0.05 + i * 0.001, contact.y + 0.1, 0] as Joint)
  joints[4] = [contact.x - ux * ta + rnd(), contact.y - uy * ta + rnd(), 0]
  joints[8] = [contact.x + ux * ia + rnd(), contact.y + uy * ia + rnd(), 0]
  return { id: 1, side: "right", confidence: 1, joints, scale }
}

/** Hover still at `contact` for `hold` s, then close over `close` s, at 60 fps. Returns the click point. */
const pinchAt = (cursor: PinchCursor, contact: { x: number; y: number }, opts: Parameters<typeof handAt>[2] = {}, t0 = 0) => {
  let t = t0
  const dt = 1 / 60
  for (; t < t0 + 0.5; t += dt) cursor.update(handAt(contact, 0, opts), t)
  let click: { x: number; y: number } | undefined
  let sample: PinchSample | undefined
  for (let k = 0; k <= 12; k++, t += dt) {
    const u = k / 12
    const s = cursor.update(handAt(contact, u * u * (3 - 2 * u), opts), t)
    if (s.pressed) {
      click = { x: s.x, y: s.y }
      sample = s.sample
    }
  }
  // open again
  for (let k = 0; k <= 12; k++, t += dt) cursor.update(handAt(contact, 1 - k / 12, opts), t)
  return { click: click!, sample: sample!, t }
}

describe("One-Euro", () => {
  test("smooths a trembling rest, follows a reach, and is deterministic on the frame clock", () => {
    const run = () => {
      const f = new OneEuro({ minCutoff: 1, beta: 0.5 })
      const out: number[] = []
      let s = 7
      for (let i = 0; i < 120; i++) {
        const noise = ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 0.01
        const x = (i < 60 ? 0 : (i - 60) * 0.02) + noise
        out.push(f.filter(x, i / 60))
      }
      return out
    }
    const a = run()
    expect(run()).toEqual(a) // same samples, same clock → same output
    const restJitter = Math.max(...a.slice(30, 60)) - Math.min(...a.slice(30, 60))
    expect(restJitter).toBeLessThan(0.004) // raw jitter span is ~0.01
    expect(Math.abs(a[119]! - 59 * 0.02)).toBeLessThan(0.15) // keeps up with the reach
  })
})

describe("pinch cursor", () => {
  test("the click lands where the cursor hovered — the bias-corrected point does not slide", () => {
    const contact = { x: 0.4, y: 0.6 }
    const corrected = pinchAt(new PinchCursor(), contact)
    const naive = pinchAt(new PinchCursor({ calibration: { w: 0.5, ox: 0, oy: 0 }, lookback: 0 }), contact)
    const err = (p: { x: number; y: number }) => Math.hypot(p.x - contact.x, p.y - contact.y)
    expect(err(corrected.click)).toBeLessThan(0.002)
    // The midpoint cursor drifts toward the thumb during the closing — clearly worse.
    expect(err(naive.click)).toBeGreaterThan(5 * err(corrected.click))
  })

  test("hysteresis: one press and one release per pinch, however the gap hovers at the threshold", () => {
    const c = new PinchCursor()
    let presses = 0
    let releases = 0
    let t = 0
    for (let i = 0; i < 200; i++, t += 1 / 60) {
      // gap oscillates around `on` with a small amplitude
      const gapU = 1 - (0.25 + 0.03 * Math.sin(i)) // u such that gap ≈ on ± small
      const s = c.update(handAt({ x: 0.5, y: 0.5 }, Math.min(1, gapU)), t)
      if (s.pressed) presses++
      if (s.released) releases++
    }
    expect(presses).toBe(1)
    expect(releases).toBe(0)
  })

  test("a drag moves from the click point by the hand's travel; release hands back without a jump", () => {
    const c = new PinchCursor()
    const start = { x: 0.3, y: 0.3 }
    let t = 0
    for (; t < 0.5; t += 1 / 60) c.update(handAt(start, 0), t)
    let pressAt = { x: 0, y: 0 }
    for (let k = 0; k <= 12; k++, t += 1 / 60) {
      const s = c.update(handAt(start, k / 12), t)
      if (s.pressed) pressAt = { x: s.x, y: s.y }
    }
    // drag 0.2 to the right while pinched
    let prev = pressAt
    for (let k = 1; k <= 30; k++, t += 1 / 60) {
      const s = c.update(handAt({ x: start.x + (0.2 * k) / 30, y: start.y }, 1), t)
      expect(s.pinched).toBe(true)
      expect(Math.hypot(s.x - prev.x, s.y - prev.y)).toBeLessThan(0.03)
      prev = s
    }
    expect(prev.x - pressAt.x).toBeGreaterThan(0.15)
    // release and keep still: the cursor never jumps
    for (let k = 0; k <= 30; k++, t += 1 / 60) {
      const s = c.update(handAt({ x: start.x + 0.2, y: start.y }, Math.max(0, 1 - k / 6)), t)
      expect(Math.hypot(s.x - prev.x, s.y - prev.y)).toBeLessThan(0.03)
      prev = s
    }
  })

  test("losing the hand releases a pinch — never a stuck button", () => {
    const c = new PinchCursor()
    c.update(handAt({ x: 0.5, y: 0.5 }, 1), 0)
    expect(c.update(handAt({ x: 0.5, y: 0.5 }, 1), 0.02).pinched).toBe(true)
    const s = c.update(undefined, 0.04)
    expect(s.released).toBe(true)
    expect(s.pinched).toBe(false)
  })

  test("calibration recovers a user's own thumb weight and offset from a handful of pinches", () => {
    // This user's thumb travels half as far as the index (w = 2/3), and their fingers meet a bit to the side.
    const samples: PinchSample[] = []
    for (const [i, dir] of [-0.9, -0.6, -0.3, 0.2, 0.7].entries()) {
      const contact = { x: 0.3 + 0.1 * i, y: 0.5 }
      const h = handAt(contact, 0.6, { ratio: 1 / 2, dir })
      const shift = { x: 0.012, y: -0.006 } // the user's offset (hand size 0.1 → ox 0.12, oy −0.06)
      samples.push({
        thumb: { x: h.joints[4]![0], y: h.joints[4]![1] },
        index: { x: h.joints[8]![0], y: h.joints[8]![1] },
        contact: { x: contact.x + shift.x, y: contact.y + shift.y },
        scale: 0.1,
      })
    }
    const fit = fitCalibration(samples)
    expect(fit.w).toBeCloseTo(2 / 3, 6)
    expect(fit.ox).toBeCloseTo(0.12, 6)
    expect(fit.oy).toBeCloseTo(-0.06, 6)
    expect(fitCalibration([])).toEqual(DEFAULT_CALIBRATION)
  })

  test("deterministic: the same take gives the same clicks", () => {
    const take = () => {
      const c = new PinchCursor()
      const out = [pinchAt(c, { x: 0.2, y: 0.7 }, { jitter: 0.002, seed: 3 }).click]
      out.push(pinchAt(c, { x: 0.6, y: 0.4 }, { jitter: 0.002, seed: 9 }, 3).click)
      return out
    }
    expect(take()).toEqual(take())
  })
})
