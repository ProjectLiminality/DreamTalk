/**
 * Triad — the figure, and its `view` reading: the camera through three eyes.
 */

import { describe, expect, test } from "bun:test"
import { Triad, VIEWS } from "../vocabulary/Triad/Triad"
import { Observer } from "../src/dream"
import { toWorld } from "../src/geometry/frames"

const rigged = () => {
  const triad = new Triad()
  void triad.parts
  triad.unfold.value = 1
  const o = new Observer()
  triad.rig(o, { radius: 1300 })
  return { triad, o }
}

const back = (o: Observer) => {
  const phi = o.phi.value
  const theta = o.theta.value
  return { x: Math.sin(phi) * Math.cos(theta), y: Math.sin(theta), z: Math.cos(phi) * Math.cos(theta) }
}

describe("Triad", () => {
  test("axes: unfold · reading, and view only once rigged", () => {
    const plain = new Triad()
    void plain.parts
    expect(plain.stateSpace()!.axes.map((a) => a.id)).toEqual(["unfold", "reading"])
    const { triad } = rigged()
    const axes = triad.stateSpace()!.axes
    expect(axes.map((a) => a.id)).toEqual(["unfold", "reading", "view"])
    const view = axes[2]!
    expect(view.positions.map((p) => p.name)).toEqual(["orbit", "below", "side", "above"])
    expect(view.escape).toBe("orbit")
    // Walkable only in 3D.
    expect(view.when!()).toBe(true)
    triad.unfold.value = 0
    expect(view.when!()).toBe(false)
  })

  test("at home the rig is exactly the observer's pose", () => {
    const { o } = rigged()
    expect([o.x.value, o.y.value, o.z.value, o.phi.value, o.theta.value, o.tilt.value]).toEqual([0, 0, 0, 0, 0, 0])
    expect(o.radius.value).toBe(1300)
    expect(o.fov.value).toBe(new Observer().fov.value)
  })

  test("each eye stands where VIEWS says, looking where it says", () => {
    const { triad, o } = rigged()
    const R = triad.radius.value
    for (const name of ["below", "above"] as const) {
      triad.below.value = name === "below" ? 1 : 0
      triad.above.value = name === "above" ? 1 : 0
      const V = VIEWS[name]
      const F = toWorld(triad.body, { x: V.at[0] * R, y: V.at[1] * R, z: V.at[2] * R })
      const E = toWorld(triad.body, { x: V.eye[0] * R, y: V.eye[1] * R, z: V.eye[2] * R })
      expect(o.x.value).toBeCloseTo(F.x)
      expect(o.y.value).toBeCloseTo(F.y)
      expect(o.z.value).toBeCloseTo(F.z)
      const b = back(o)
      const r = o.radius.value
      expect(o.x.value + b.x * r).toBeCloseTo(E.x)
      expect(o.y.value + b.y * r).toBeCloseTo(E.y)
      expect(o.z.value + b.z * r).toBeCloseTo(E.z)
      expect(o.fov.value).toBeCloseTo(V.fov)
    }
  })

  test("from below the eye looks up; from above, straight down the vertical", () => {
    const { triad, o } = rigged()
    triad.below.value = 1
    expect(o.theta.value).toBeLessThan(-0.9)
    triad.below.value = 0
    triad.above.value = 1
    // The view axis IS the figure's vertical (its world image).
    const c = toWorld(triad.body, { x: 0, y: 0, z: 0 })
    const u = toWorld(triad.body, { x: 0, y: 1, z: 0 })
    const L = Math.hypot(u.x - c.x, u.y - c.y, u.z - c.z)
    const b = back(o)
    expect(b.x).toBeCloseTo((u.x - c.x) / L)
    expect(b.y).toBeCloseTo((u.y - c.y) / L)
    expect(b.z).toBeCloseTo((u.z - c.z) / L)
  })

  test("the side eye's gaze swings along the base with the dance", () => {
    const { triad, o } = rigged()
    triad.side.value = 1
    const R = triad.radius.value
    const xs: number[] = []
    for (const t of [0, 2.25, 6.75]) {
      triad.dance.value = t
      xs.push(o.x.value)
    }
    const hot = toWorld(triad.body, { x: -VIEWS.side.swing * R * Math.sqrt(3) / 2, y: VIEWS.side.at[1] * R, z: 0 })
    const cold = toWorld(triad.body, { x: VIEWS.side.swing * R * Math.sqrt(3) / 2, y: VIEWS.side.at[1] * R, z: 0 })
    expect(xs[1]).toBeCloseTo(cold.x)
    expect(xs[2]).toBeCloseTo(hot.x)
  })

  test("crossfades are continuous: a small step moves the camera a little", () => {
    const { triad, o } = rigged()
    let prev: number[] | undefined
    for (let i = 0; i <= 100; i++) {
      const u = i / 100
      triad.below.value = 1 - u
      triad.above.value = u
      const now = [o.x.value, o.y.value, o.z.value, o.phi.value, o.theta.value, o.tilt.value, Math.log(o.radius.value)]
      if (prev) for (let k = 0; k < now.length; k++) expect(Math.abs(now[k]! - prev[k]!)).toBeLessThan(k < 3 ? 30 : 0.12)
      prev = now
    }
  })

  test("the eye turns down to the one below, and only then", () => {
    const { triad } = rigged()
    expect(triad.eye.h.value).toBe(0)
    triad.below.value = 1
    const [, by, bz] = VIEWS.below.eye
    expect(triad.eye.h.value).toBeCloseTo(Math.atan2(1 - by, bz))
  })
})
