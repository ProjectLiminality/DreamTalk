/**
 * timespiral.test.ts — the three forms of time: Kronos the line, Aion the
 * circle, the spiral both; turns that mirror or rhyme; the present moment
 * and its Kairos on the centre; the walkable axes and the clock.
 */

import { describe, expect, test } from "bun:test"
import { KAIROS, RHYME, SPIRAL, TimeSpiral, kairosBearings, momentAt, spiralPoint, starOutline, turnRadius } from "../vocabulary/TimeSpiral/TimeSpiral"
import { derive } from "../src/params"

const near = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps)
const radial = (p: { x: number; z: number }) => Math.hypot(p.x, p.z)
const samples = Array.from({ length: SPIRAL.turns * 24 + 1 }, (_, i) => i / 24)

describe("TimeSpiral geometry", () => {
  test("Kronos is the straight line: every point on the axis, rising bottom to top", () => {
    for (const s of samples) near(radial(spiralPoint(s, 0, 1)), 0)
    near(spiralPoint(0, 0, 1).y, SPIRAL.bottom)
    near(spiralPoint(SPIRAL.turns, 0, 1).y, SPIRAL.top)
  })

  test("Aion is one circle: every turn at height 0 and Aion's radius, whatever the rhyme", () => {
    for (const rhyme of [0, 1])
      for (const s of samples) {
        const p = spiralPoint(s, 1, rhyme)
        near(p.y, 0)
        near(radial(p), SPIRAL.aion)
      }
  })

  test("the spiral widens as it rises; mirrored, every turn is the same turn scaled", () => {
    for (let s = 0; s < SPIRAL.turns; s += 0.25) {
      const p = spiralPoint(s, 2, 0)
      near(radial(p), turnRadius(s))
      expect(spiralPoint(s + 0.25, 2, 0).y).toBeGreaterThan(p.y)
    }
    expect(turnRadius(SPIRAL.turns)).toBeGreaterThan(turnRadius(0) * 5)
  })

  test("rhymed, the turns are kin but never identical — and never random", () => {
    // The shape of a turn relative to its own radius, sampled at the same phases.
    const shape = (k: number) => Array.from({ length: 12 }, (_, j) => radial(spiralPoint(k + j / 12, 2, 1)) / turnRadius(k + j / 12))
    const shapes = Array.from({ length: SPIRAL.turns }, (_, k) => shape(k))
    for (const sh of shapes) for (const r of sh) expect(Math.abs(r - 1)).toBeLessThanOrEqual(RHYME.ellipse + 1e-9)
    for (let a = 0; a < shapes.length; a++)
      for (let b = a + 1; b < shapes.length; b++) expect(shapes[a]!.some((r, j) => Math.abs(r - shapes[b]![j]!) > 0.01)).toBe(true)
    // Deterministic: the same call, the same point.
    expect(spiralPoint(2.37, 2, 1)).toEqual(spiralPoint(2.37, 2, 1))
  })

  test("the present moment travels once up the whole curve per turns × period, fading at the ends", () => {
    near(momentAt(0).s, 0)
    near(momentAt(SPIRAL.period).s, 1)
    near(momentAt(SPIRAL.period * SPIRAL.turns).s, 0)
    expect(momentAt(0).fade).toBe(0)
    expect(momentAt(SPIRAL.period * 2.5).fade).toBe(1)
  })

  test("the star: eight points, four long, closed", () => {
    const s = starOutline(10)
    expect(s.length).toBe(17)
    near(s[0]!.y, 10)
    near(s[16]!.x, s[0]!.x)
    expect(s.filter((p) => Math.abs(Math.hypot(p.x, p.y) - 10) < 1e-9).length).toBe(5)
  })
})

describe("TimeSpiral symbol", () => {
  test("Kairos is the moment's projection onto the centre; the curve splits near/far against the eye", () => {
    const t = new TimeSpiral({ height: 100, now: SPIRAL.period * 2.3 })
    void t.parts
    near(t.kairos.x.value, 0)
    near(t.kairos.z.value, 0)
    near(t.kairos.y.value, t.moment.y.value)
    expect(t.near.loops.length).toBeGreaterThan(0)
    expect(t.far.loops.length).toBeGreaterThan(0)
    const pts = [...t.near.loops, ...t.far.loops].flat().length
    expect(pts).toBeGreaterThan(SPIRAL.turns * SPIRAL.samples)
  })

  test("the curve rebuilds only when its key changes, and quickly when it does", () => {
    const t = new TimeSpiral({ height: 100 })
    void t.parts
    const v0 = t.near.geomVersion
    t.now.value = 3
    expect(t.near.geomVersion).toBe(v0)
    const t0 = performance.now()
    for (let i = 0; i < 60; i++) {
      t.rhyme.value = i / 60
      void t.near.loops
      void t.far.loops
    }
    expect((performance.now() - t0) / 60).toBeLessThan(2)
  })

  test("three walkable axes, time (kronos · aion · spiral), rhyme (mirror ↔ rhyme) and moments; now is a clock", () => {
    const t = new TimeSpiral()
    const space = t.stateSpace()!
    expect(space.axes.map((a) => a.id)).toEqual(["time", "rhyme", "moments"])
    expect(space.axes[2]!.positions.map((p) => p.name)).toEqual(["none", "kairos"])
    expect(space.axes[0]!.positions.map((p) => p.name)).toEqual(["kronos", "aion", "spiral"])
    expect(space.axes[1]!.positions.map((p) => p.name)).toEqual(["mirror", "rhyme"])
    expect(space.clocks).toEqual([t.now])
    const driven = new TimeSpiral()
    driven.time.follow(derive(() => 1))
    driven.rhyme.follow(derive(() => 1))
    driven.now.follow(derive(() => 0))
    driven.moments.follow(derive(() => 0))
    expect(driven.stateSpace()).toBeUndefined()
  })

  test("the Kairos moments: likelier toward the profound, never on the profane, mirror-symmetric", () => {
    const b = kairosBearings()
    const left = b.filter((t) => Math.cos(t) < 0).length
    expect(left).toBeGreaterThan(b.length - left)
    // Symmetric about the base line (θ ↔ 2π − θ), and none at the profane pole (θ = 0).
    for (let i = 0; i < b.length; i++) expect(b[i]! + b[b.length - 1 - i]!).toBeCloseTo(2 * Math.PI, 6)
    for (const t of b) expect(Math.cos(t)).toBeLessThan(0.5)
    const t = new TimeSpiral()
    void t.parts
    expect(t.kairosMoments.loops.length).toBe(0)
    t.moments.value = 1
    expect(t.kairosMoments.loops.length).toBe(SPIRAL.turns * KAIROS.perTurn)
  })
})
