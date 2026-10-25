/**
 * six-paths.test.ts — the six paths on an octahedron: three orthogonal axes
 * through one centre, the perceptions one face and the expressions the
 * opposite one; the hexagram when that face meets the eye; the flow inward
 * on the perceptions and outward on the expressions; three walkable axes and
 * a clock.
 */

import { describe, expect, test } from "bun:test"
import { PAIRS, SixPaths, modeWeights, orient, pairWeight, turnAt, vertexOf } from "../vocabulary/SixPaths/SixPaths"
import { gatherStateSpace } from "../src/automaton"

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)
const dot = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => a.x * b.x + a.y * b.y + a.z * b.z

describe("SixPaths geometry", () => {
  test("three orthogonal axes, the immanent one vertical, each pair at the two ends of its own", () => {
    for (let i = 0; i < 3; i++) {
      const p = vertexOf(i, false)
      const e = vertexOf(i, true)
      near(dot(p, p), 1)
      near(p.x + e.x, 0), near(p.y + e.y, 0), near(p.z + e.z, 0)
      for (let j = i + 1; j < 3; j++) near(dot(p, vertexOf(j, false)), 0)
    }
    expect(PAIRS[2]!.axis).toEqual({ x: 0, y: 1, z: 0 })
    expect(PAIRS.map((p) => [p.perception, p.expression])).toEqual([
      ["Science", "Technology"],
      ["Mysticism", "Magic"],
      ["Spirituality", "Religion"],
    ])
  })

  test("the hexagram: turned, the perception face's normal points at the eye and its six vertices make a regular star", () => {
    const { yaw, pitch } = turnAt(1)
    const n = orient({ x: 1, y: 1, z: 1 }, yaw, pitch)
    near(n.x, 0), near(n.y, 0)
    near(n.z, Math.sqrt(3))
    // The six vertices seen along z: all at one radius, 60° apart, the two faces alternating.
    const seen = [0, 1, 2].flatMap((i) => [false, true].map((x) => ({ v: orient(vertexOf(i, x), yaw, pitch), x })))
    const r = seen.map(({ v }) => Math.hypot(v.x, v.y))
    for (const k of r) near(k, Math.sqrt(2 / 3))
    const byAngle = seen.map(({ v, x }) => ({ a: Math.atan2(v.y, v.x), x })).sort((p, q) => p.a - q.a)
    for (let k = 0; k < 6; k++) {
      expect(byAngle[k]!.x).not.toBe(byAngle[(k + 1) % 6]!.x)
      const gap = (byAngle[(k + 1) % 6]!.a - byAngle[k]!.a + 2 * Math.PI) % (2 * Math.PI)
      near(gap, Math.PI / 3)
    }
    // Spirituality is the rising triangle's apex, straight up.
    const top = orient(vertexOf(2, false), yaw, pitch)
    near(top.x, 0)
    expect(top.y).toBeGreaterThan(0)
  })

  test("mode lights one half of the flow, focus one pair", () => {
    expect(modeWeights(0)).toEqual({ perception: 1, expression: 0 })
    expect(modeWeights(0.5)).toEqual({ perception: 1, expression: 1 })
    expect(modeWeights(1)).toEqual({ perception: 0, expression: 1 })
    for (let i = 0; i < 3; i++) near(pairWeight(0, i), 1)
    near(pairWeight(2, 1), 1)
    expect(pairWeight(2, 0)).toBeLessThan(0.2)
    expect(pairWeight(2, 2)).toBeLessThan(0.2)
  })

  test("the chevrons run inward on the perceptions and outward on the expressions", () => {
    const m = new SixPaths({ radius: 100 })
    void m.parts
    const tips = (i: number) => m.arrows[i]!.loops.map((l) => l[1]!)
    // Perception only: every chevron on the perception half of its axis, its tip ahead of its arms toward the centre.
    m.mode.value = 0
    for (const t of [0.3, 1.7, 4.1]) {
      m.time.value = t
      for (let i = 0; i < 3; i++) {
        const end = m.at(vertexOf(i, false))
        const loops = m.arrows[i]!.loops
        expect(loops.length).toBeGreaterThan(0)
        for (const l of loops) {
          const tip = l[1]!
          const arm = l[0]!
          expect(dot(tip, end)).toBeGreaterThan(0)
          expect(dot(arm, end)).toBeGreaterThan(dot(tip, end)) // arms trail outward: it points in
        }
      }
    }
    // Expression only: on the other half, pointing out.
    m.mode.value = 1
    m.time.value = 2.2
    for (let i = 0; i < 3; i++) {
      const end = m.at(vertexOf(i, true))
      for (const l of m.arrows[i]!.loops) {
        expect(dot(l[1]!, end)).toBeGreaterThan(0)
        expect(dot(l[0]!, end)).toBeLessThan(dot(l[1]!, end))
      }
      expect(tips(i).length).toBeGreaterThan(0)
    }
  })

  test("mode, focus and view are walkable axes, and time is the clock", () => {
    const m = new SixPaths()
    const space = gatherStateSpace([m])
    expect(space.axes.map((a) => a.id).sort()).toEqual(["focus", "mode", "view"])
    expect(space.axes.find((a) => a.id === "mode")!.positions.map((p) => p.name)).toEqual(["perception", "whole", "expression"])
    expect(space.axes.find((a) => a.id === "focus")!.positions.map((p) => p.name)).toEqual(["all", "causal", "trans-causal", "immanent"])
    expect(space.axes.find((a) => a.id === "view")!.positions.map((p) => p.name)).toEqual(["upright", "hexagram"])
    expect(space.clocks).toContain(m.time)
    const held = new SixPaths()
    held.view.follow(m.view)
    expect(gatherStateSpace([held]).axes.map((a) => a.id).sort()).toEqual(["focus", "mode"])
  })
})
