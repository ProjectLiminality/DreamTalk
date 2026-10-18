/**
 * Field — the InterBrain film's particle field, pinned: the warp is a true
 * perspective (screen radius ∝ 1/depth, streaks radial from the focus once
 * whole), the field is a pure function of its state (scrubbable, seeded),
 * density thins a NESTED subset, wholeness walks red → white → cyan with
 * the white pause as dots, the burst leaves its rim, and a dissolved swarm
 * is gone.
 */

import { describe, expect, test } from "bun:test"
import {
  BINS,
  CYAN,
  Field,
  LAYERS,
  WAVE_REACH,
  Z_FAR,
  Z_NEAR,
  fieldColor,
  fieldStreaks,
  layerLook,
  warpParticle,
  waveFront,
  type FieldState,
} from "../vocabulary/Field/Field"
import { RED, WHITE } from "../src/constants"

const base = (o: Partial<FieldState> = {}): FieldState => ({
  mode: "warp",
  time: 3.2,
  wholeness: 0,
  density: 1,
  speed: 1,
  focusX: 0,
  focusY: 0,
  reach: 1600,
  radius: 200,
  dissolve: 0,
  count: 600,
  seed: 7,
  ...o,
})

const len = (s: { points: { x: number; y: number }[] }) => {
  const a = s.points[0]!
  const b = s.points.at(-1)!
  return Math.hypot(b.x - a.x, b.y - a.y)
}

describe("wholeness: the one state", () => {
  test("colour endpoints are the palette red, white at the pause, the film's cyan", () => {
    expect(fieldColor(0)).toEqual(RED)
    expect(fieldColor(0.5)).toEqual(WHITE)
    const c = fieldColor(1)
    expect(c.r).toBeCloseTo(CYAN.r, 12)
    expect(c.g).toBeCloseTo(CYAN.g, 12)
    expect(c.b).toBeCloseTo(CYAN.b, 12)
  })

  test("the red field is out of focus, the whole field in focus: halos narrow, the core brightens", () => {
    const red = layerLook(LAYERS - 1, 0)
    const whole = layerLook(LAYERS - 1, 1)
    expect(whole.width).toBeLessThan(red.width)
    expect(layerLook(0, 1).alpha).toBeGreaterThan(layerLook(0, 0).alpha)
    // `sharp` brings a red swarm into focus without changing its colour.
    expect(layerLook(LAYERS - 1, 0, 1).width).toBeCloseTo(whole.width, 12)
    // Layers nest: each halo wider and fainter than the one inside it.
    for (let l = 1; l < LAYERS; l++) {
      for (const w of [0, 1]) {
        expect(layerLook(l, w).width).toBeGreaterThan(layerLook(l - 1, w).width)
        expect(layerLook(l, w).alpha).toBeLessThan(layerLook(l - 1, w).alpha)
      }
    }
  })

  test("the white pause shrinks every streak; wholeness stretches those inside the wave", () => {
    // Over the streaks well inside the wave's full reach (heads within 0.1·reach).
    const mean = (w: number) => {
      const s = fieldStreaks(base({ wholeness: w })).filter((x) => Math.hypot(x.points[1]!.x, x.points[1]!.y) < 0.1 * 1600)
      return s.reduce((a, x) => a + len(x), 0) / s.length
    }
    expect(mean(0.5)).toBeLessThan(mean(0) * 0.25)
    expect(mean(1)).toBeGreaterThan(mean(0) * 2)
    expect(waveFront(0.5)).toBe(0)
    expect(waveFront(1)).toBeCloseTo(WAVE_REACH, 12)
  })

  test("wholeness never moves a particle's head (no phase jump when the field turns)", () => {
    const red = fieldStreaks(base({ wholeness: 0, count: 200 }))
    const whole = fieldStreaks(base({ wholeness: 1, count: 200 }))
    const heads = (xs: typeof red) => new Set(xs.map((s) => `${s.points.at(-1)!.x.toFixed(6)},${s.points.at(-1)!.y.toFixed(6)}`))
    const r = heads(red)
    const shared = [...heads(whole)].filter((h) => r.has(h)).length
    expect(shared).toBeGreaterThan(Math.min(r.size, whole.length) * 0.8)
  })
})

describe("the warp is a perspective", () => {
  test("screen radius = ρ·reach / z, z falling linearly from Z_FAR to Z_NEAR", () => {
    const s = base()
    for (const i of [0, 5, 17]) {
      const p = warpParticle(i, s)
      expect(p.z).toBeCloseTo(Z_FAR + (Z_NEAR - Z_FAR) * p.phase, 12)
      // dz/dt is constant: a later time is a smaller depth unless it wrapped.
      const later = warpParticle(i, { ...s, time: s.time + 0.01 })
      if (later.phase > p.phase) expect(later.z).toBeLessThan(p.z)
    }
  })

  test("whole, every streak lies on a ray from the focus (tail, head and focus collinear)", () => {
    const fx = 120
    const fy = -80
    for (const s of fieldStreaks(base({ wholeness: 1, focusX: fx, focusY: fy }))) {
      const [a, b] = [s.points[0]!, s.points[1]!]
      const cross = (a.x - fx) * (b.y - fy) - (a.y - fy) * (b.x - fx)
      expect(Math.abs(cross) / Math.max(1, Math.hypot(b.x - fx, b.y - fy))).toBeLessThan(1e-6 * 1600)
      // and the head is the outer end
      expect(Math.hypot(b.x - fx, b.y - fy)).toBeGreaterThanOrEqual(Math.hypot(a.x - fx, a.y - fy) - 1e-9)
    }
  })
})

describe("pure and scrubbable", () => {
  test("the same state draws the same field; scrubbing back returns it", () => {
    const a = fieldStreaks(base({ time: 4 }))
    fieldStreaks(base({ time: 9 }))
    expect(fieldStreaks(base({ time: 4 }))).toEqual(a)
  })

  test("density thins a nested subset — lowering it never reshuffles", () => {
    const heads = (d: number) =>
      new Set(fieldStreaks(base({ density: d, wholeness: 1 })).map((s) => `${s.points[1]!.x},${s.points[1]!.y}`))
    const full = heads(1)
    const half = heads(0.5)
    expect(half.size).toBeLessThan(full.size)
    for (const h of half) expect(full.has(h)).toBe(true)
    expect(fieldStreaks(base({ density: 0 }))).toHaveLength(0)
  })

  test("every streak falls in a brightness bin", () => {
    for (const mode of ["warp", "burst", "swarm"] as const) {
      for (const s of fieldStreaks(base({ mode, reach: mode === "warp" ? 1600 : 200 }))) {
        expect(s.bin).toBeGreaterThanOrEqual(0)
        expect(s.bin).toBeLessThan(BINS)
      }
    }
  })
})

describe("burst and swarm share the machinery", () => {
  test("burst rays leave from near the rim and travel outward", () => {
    const R = 200
    for (const s of fieldStreaks(base({ mode: "burst", radius: R, reach: 300, count: 400 }))) {
      const [a, b] = [s.points[0]!, s.points[1]!]
      expect(Math.hypot(a.x, a.y)).toBeGreaterThanOrEqual(R * 0.55 - 1e-9)
      expect(Math.hypot(b.x, b.y)).toBeGreaterThanOrEqual(Math.hypot(a.x, a.y))
      expect(Math.hypot(b.x, b.y)).toBeLessThanOrEqual(R * 0.95 + 300 + 1e-9)
    }
  })

  test("a swarm hugs its shape; dissolved, it is gone", () => {
    const square = [[{ x: -100, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }, { x: -100, y: 100 }, { x: -100, y: -100 }]]
    const hug = fieldStreaks(base({ mode: "swarm", shape: square, reach: 20, count: 200 }))
    expect(hug.length).toBeGreaterThan(0)
    for (const s of hug) {
      const p = s.points[0]!
      // within spread + wander of the square's outline
      const d = Math.max(Math.abs(p.x), Math.abs(p.y))
      expect(Math.abs(d - 100)).toBeLessThan(20 * 2.5)
    }
    expect(fieldStreaks(base({ mode: "swarm", shape: square, dissolve: 1 }))).toHaveLength(0)
  })
})

describe("the holon", () => {
  test("BINS × LAYERS Polylines, a wholeness axis and a clock", () => {
    const f = new Field()
    void f.parts
    expect(f.layers).toHaveLength(BINS)
    for (const row of f.layers) expect(row).toHaveLength(LAYERS)
    const space = f.stateSpace()
    expect(space.clocks).toEqual([f.time])
    expect(space.axes.map((a) => a.id)).toEqual(["wholeness"])
  })

  test("creation thins the field in; a faded field computes nothing", () => {
    const f = new Field({ count: 300 })
    void f.parts
    const drawn = () => f.layers.flat().reduce((n, l) => n + l.loops.length, 0) / LAYERS
    f.creation.value = 0
    expect(drawn()).toBe(0)
    f.creation.value = 1
    const all = drawn()
    expect(all).toBeGreaterThan(0)
    f.opacity.value = 0
    expect(drawn()).toBe(0)
  })

  test("a swarm is near-crisp by default; the warp follows wholeness", () => {
    expect(new Field({ mode: "swarm" }).sharp.value).toBeGreaterThan(0)
    expect(new Field().sharp.value).toBe(0)
  })
})
