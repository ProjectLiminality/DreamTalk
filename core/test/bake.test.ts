/**
 * bake.test.ts — the stateful→pure bridge.
 *
 * The whole point of baking is that what comes out is a FUNCTION of t.
 * These tests pin exactly that: sampleAt is order-independent, direction
 * independent, and identical on repeat — the properties scrubbing, the
 * gauntlet and Magic Move all depend on.
 */

import { describe, expect, test } from "bun:test"
import { bake, makeTrack, trackBytes, type Simulation } from "../src/bake"

/** A counter whose state depends on its whole history — the honest
 *  shape of the problem baking solves. */
const counter = (): Simulation<{ n: number; sum: number }> => ({
  width: 2,
  init: () => ({ n: 0, sum: 0 }),
  step: (s) => ({ n: s.n + 1, sum: s.sum + s.n }),
  sample: (s, out, off) => {
    out[off] = s.n
    out[off + 1] = s.sum
  },
})

describe("the bake", () => {
  test("covers both endpoints: round(duration·fps) + 1 frames", () => {
    const t = bake(counter(), { fps: 30, duration: 2 })
    expect(t.frames).toBe(61)
    expect(t.width).toBe(2)
    expect(t.data.length).toBe(122)
  })

  test("frame 0 is init(), and the last frame sits at duration", () => {
    const t = bake(counter(), { fps: 10, duration: 1 })
    expect(Array.from(t.sampleAt(0))).toEqual([0, 0])
    expect(Array.from(t.sampleAt(1))).toEqual([10, 45])
  })

  test("the data is Float32 — the storage the GPU wants", () => {
    const t = bake(counter(), { fps: 10, duration: 1 })
    expect(t.data).toBeInstanceOf(Float32Array)
    expect(trackBytes(t)).toBe(11 * 2 * 4)
  })

  test("a zero-duration bake is one frame, the initial state", () => {
    const t = bake(counter(), { fps: 30, duration: 0 })
    expect(t.frames).toBe(1)
    expect(Array.from(t.sampleAt(5))).toEqual([0, 0])
  })

  test("it rejects nonsense", () => {
    expect(() => bake(counter(), { fps: 0, duration: 1 })).toThrow()
    expect(() => bake(counter(), { fps: 30, duration: -1 })).toThrow()
  })
})

describe("sampleAt is f(t)", () => {
  const track = bake(counter(), { fps: 10, duration: 2 })

  test("linear interpolation between frames", () => {
    // n runs 0,1,2,… so midway between frames 3 and 4 is 3.5.
    expect(track.sampleAt(0.35)[0]).toBeCloseTo(3.5, 5)
    expect(track.sampleAt(0.31)[0]).toBeCloseTo(3.1, 5)
  })

  test("clamped outside the baked span", () => {
    expect(Array.from(track.sampleAt(-5))).toEqual(Array.from(track.sampleAt(0)))
    expect(Array.from(track.sampleAt(99))).toEqual(Array.from(track.sampleAt(2)))
  })

  test("scrub-safe: backwards reproduces forwards, exactly", () => {
    const forward: number[][] = []
    for (let i = 0; i <= 40; i++) forward.push(Array.from(track.sampleAt(i / 20)))
    const backward: number[][] = []
    for (let i = 40; i >= 0; i--) backward.unshift(Array.from(track.sampleAt(i / 20)))
    expect(backward).toEqual(forward)
  })

  test("order-independent: random access equals sequential access", () => {
    const times = [1.7, 0.2, 2.0, 0.95, 0.0, 1.3, 0.5]
    const shuffled = times.map((t) => Array.from(track.sampleAt(t)))
    const sorted = [...times].sort((a, b) => a - b)
    const inOrder = new Map(sorted.map((t) => [t, Array.from(track.sampleAt(t))]))
    times.forEach((t, i) => expect(shuffled[i]).toEqual(inOrder.get(t)!))
  })

  test("repeatable: the same t always gives the same numbers", () => {
    for (let k = 0; k < 5; k++) expect(Array.from(track.sampleAt(1.234))).toEqual(Array.from(track.sampleAt(1.234)))
  })

  test("it writes into a caller's buffer when given one", () => {
    const out = new Float32Array(2)
    const returned = track.sampleAt(1, out)
    expect(returned).toBe(out)
    expect(out[0]).toBeCloseTo(10, 5)
  })

  test("nothing of the simulator survives the bake", () => {
    expect(Object.keys(track).sort()).toEqual([
      "data",
      "duration",
      "fps",
      "frames",
      "sampleAt",
      "width",
    ])
  })
})

describe("makeTrack", () => {
  test("wraps existing samples with the same contract", () => {
    const t = makeTrack(new Float32Array([0, 10, 20]), 3, 1, 2, 1)
    expect(t.sampleAt(0.25)[0]).toBeCloseTo(5, 5)
    expect(t.sampleAt(1)[0]).toBeCloseTo(20, 5)
  })

  test("a single-frame track is constant", () => {
    const t = makeTrack(new Float32Array([7]), 1, 1, 30, 0)
    expect(t.sampleAt(0)[0]).toBe(7)
    expect(t.sampleAt(100)[0]).toBe(7)
  })
})

describe("baking a real stateful sim", () => {
  test("the baked chain equals the simulated chain at every stored frame", async () => {
    const { straightState, step: xstep, CABLE_PARTICLES } = await import("../src/geometry/xpbd")
    const anchor = { x: 0, y: 0, z: 0 }
    const tip = { x: 400, y: 0, z: 0 }
    const config = { anchor, tip, dt: 1 / 30, restLength: 26 }

    const track = bake(
      {
        width: CABLE_PARTICLES * 3,
        init: () => straightState(anchor, tip),
        step: (s: ReturnType<typeof straightState>) => xstep(s, config),
        sample: (s: ReturnType<typeof straightState>, out: Float32Array, off: number) => {
          s.positions.forEach((p, i) => {
            out[off + i * 3] = p.x
            out[off + i * 3 + 1] = p.y
            out[off + i * 3 + 2] = p.z
          })
        },
      },
      { fps: 30, duration: 1 },
    )

    let s = straightState(anchor, tip)
    for (let f = 1; f <= 30; f++) {
      s = xstep(s, config)
      const sampled = track.sampleAt(f / 30)
      s.positions.forEach((p, i) => {
        expect(sampled[i * 3]!).toBeCloseTo(p.x, 2)
        expect(sampled[i * 3 + 1]!).toBeCloseTo(p.y, 2)
      })
    }
  })
})
