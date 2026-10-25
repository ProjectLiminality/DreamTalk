/**
 * Totality — the cross, its third axis, and the tunnel down it.
 */

import { describe, expect, test } from "bun:test"
import { TUNNEL, Totality, icon } from "../vocabulary/Totality/Totality"

const made = () => {
  const t = new Totality()
  void t.parts
  return t
}

describe("Totality", () => {
  test("one similarity maps the tunnel onto itself", () => {
    const a = 300
    const L = TUNNEL.depth * a
    for (const k of [0, 0.5, 1, 3.25, 9]) {
      const p = icon(k, a)
      const n = icon(k + 1, a)
      // Scaled q about the vanishing point (0, 0, −L), turned one step.
      expect(n.z + L).toBeCloseTo(TUNNEL.q * (p.z + L))
      expect(n.arm).toBeCloseTo(TUNNEL.q * p.arm)
      expect(n.turn - p.turn).toBeCloseTo(TUNNEL.turn)
    }
    expect(icon(0, a)).toEqual({ z: -0, arm: a, turn: 0 })
  })

  test("the flow loops: a period later every icon stands where it stood", () => {
    const t = made()
    t.through.value = 1
    const pose = () => t.icons.map((l) => [l.z.value, l.scale.value, l.b.value, l.there.value])
    t.fall.value = 1
    const before = pose()
    t.fall.value = 1 + TUNNEL.period
    const after = pose()
    for (let i = 0; i < before.length; i++) for (let j = 0; j < 4; j++) expect(after[i]![j]!).toBeCloseTo(before[i]![j]!, 6)
    // Just before the wrap, icon i is where icon i + 1 starts (its turn an eighth short of a quarter: the same cross).
    t.fall.value = TUNNEL.period - 1e-6
    const end = pose()
    t.fall.value = 0
    const start = pose()
    for (let i = 0; i + 1 < start.length; i++) {
      expect(end[i]![0]!).toBeCloseTo(start[i + 1]![0]!, 3)
      expect(end[i]![1]!).toBeCloseTo(start[i + 1]![1]!, 3)
    }
    // The newest icon opens out of the cross: not there at the wrap.
    expect(start[0]![3]!).toBe(0)
  })

  test("flat at 0: no third axis, no icons, the cross in the drawing's plane", () => {
    const t = made()
    expect(t.axis.opacity.value).toBe(0)
    for (const l of t.icons) expect(l.there.value).toBe(0)
    expect([t.body.h.value, t.body.p.value, t.body.z.value]).toEqual([0, 0, 0])
    for (const p of [...t.horizontal.points, ...t.vertical.points]) expect(p.z).toBe(0)
  })

  test("through: face-on again at 1, the eye come into the intersection", () => {
    const t = made()
    t.through.value = 1
    expect(t.body.h.value).toBeCloseTo(0)
    expect(t.body.p.value).toBeCloseTo(0)
    // The default eye stands at 1500 on +z.
    expect(t.body.z.value).toBeCloseTo(0.62 * 1500)
    expect(t.axis.points.at(-1)!.z).toBeCloseTo(-TUNNEL.depth * 300)
  })

  test("the plane: the bar opens into a disc of the arm's radius", () => {
    const t = made()
    t.plane.value = 1
    for (const p of t.horizontal.points) {
      expect(p.y).toBe(0)
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(300)
    }
  })

  test("axes: through · plane, each from the flat cross only", () => {
    const t = made()
    const axes = t.stateSpace()!.axes
    expect(axes.map((a) => [a.id, a.key])).toEqual([["through", "t"], ["plane", "p"]])
    expect(axes.every((a) => a.when!())).toBe(true)
    t.plane.value = 0.5
    expect(axes[0]!.when!()).toBe(false)
    t.plane.value = 0
    t.through.value = 0.5
    expect(axes[1]!.when!()).toBe(false)
    expect(t.stateSpace()!.clocks).toEqual([t.fall])
  })
})
