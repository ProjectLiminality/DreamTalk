import { describe, expect, test } from "bun:test"
import { Observer } from "../src/dream"
import { derive, scalar } from "../src/params"
import { RETURN_SECONDS, THETA_LIMIT, ViewLayer } from "../src/view"

describe("the viewer's camera layer", () => {
  test("bias and gate sit over a BOUND reading and leave it intact", () => {
    const src = scalar(0.3)
    const o = new Observer()
    o.phi.follow(derive(() => src.value))
    o.phi.bias = 0.5
    expect(o.phi.value).toBeCloseTo(0.8, 12)
    src.value = 0.1 // the rig keeps moving underneath
    expect(o.phi.value).toBeCloseTo(0.6, 12)
    o.phi.bias = 0
    expect(o.phi.value).toBe(0.1)
  })

  test("orbit, pan, dolly — and release is the authored camera exactly", () => {
    const o = new Observer()
    o.theta.value = 0.2
    const before = [o.phi.value, o.theta.value, o.radius.value, o.zoom.value, o.x.value, o.y.value, o.z.value]
    const v = new ViewLayer(o)
    v.orbit(320, 0, 1280) // a quarter of the width: a quarter turn
    v.apply()
    expect(o.phi.value).toBeCloseTo(-Math.PI / 2, 9)
    v.dolly(200)
    v.apply()
    expect(o.radius.value).toBeCloseTo(1500 * Math.exp(0.3), 6)
    v.pan(100, 0, 720)
    v.apply()
    // Turned a quarter, screen-right is world −z: dragging right moves the focus +z... away from the drag.
    expect(Math.abs(o.z.value)).toBeGreaterThan(1)
    expect(Math.abs(o.x.value)).toBeLessThan(1e-9)
    v.release()
    expect([o.phi.value, o.theta.value, o.radius.value, o.zoom.value, o.x.value, o.y.value, o.z.value]).toEqual(before)
  })

  test("orthographic dolly is zoom; elevation never crosses a pole", () => {
    const o = new Observer()
    o.orthographic.value = true
    const v = new ViewLayer(o)
    v.dolly(-400)
    v.orbit(0, 100000, 1280)
    v.apply()
    expect(o.zoom.value).toBeCloseTo(Math.exp(0.6), 9)
    expect(o.radius.value).toBe(1500)
    expect(o.theta.value).toBeCloseTo(THETA_LIMIT, 9)
    // A song that raises its own camera cannot push the effective pose over.
    o.theta.value = 0.5
    v.apply()
    expect(o.theta.value).toBeCloseTo(THETA_LIMIT, 9)
  })

  test("reset glides back on the C4D ease — continuous, then exactly home", () => {
    const o = new Observer()
    const v = new ViewLayer(o)
    v.orbit(640, 0, 1280)
    v.apply()
    const start = o.phi.value
    v.reset(1000)
    let prev = start
    for (let ms = 1000; ms <= 1000 + RETURN_SECONDS * 1000; ms += 10) {
      v.step(ms)
      v.apply()
      expect(Math.abs(o.phi.value - prev)).toBeLessThan(0.15) // no jump (π over 0.4 s, 10 ms steps: peak ≈ 0.12)
      prev = o.phi.value
    }
    v.step(1000 + RETURN_SECONDS * 1000 + 1)
    v.apply()
    expect(o.phi.value).toBe(0)
    expect(v.active).toBe(false)
  })

  test("framing a box centres it and fits it", () => {
    const o = new Observer()
    const v = new ViewLayer(o)
    // A small box up and to the right of centre.
    v.frameBox({ minX: 900, maxX: 1000, minY: 100, maxY: 200 }, { width: 1280, height: 720 }, 0)
    v.step(RETURN_SECONDS * 1000 + 1)
    v.apply()
    expect(o.x.value).toBeGreaterThan(0)
    expect(o.y.value).toBeGreaterThan(0)
    expect(o.radius.value).toBeLessThan(1500)
  })

  test("a keep-out: an orbit about a focus on the ground rolls over it, never under", () => {
    const o = new Observer()
    // An Earth of radius 400 at the origin; the focus is on its surface
    // (top), the eye 200 above it looking straight down-ish.
    o.y.value = 400
    o.theta.value = 1.2
    o.radius.value = 200
    const v = new ViewLayer(o)
    v.keepOuts = () => [{ center: { x: 0, y: 0, z: 0 }, radius: 420 }]
    const eye = () => {
      const r = o.radius.value / o.zoom.value
      return {
        x: o.x.value + r * Math.sin(o.phi.value) * Math.cos(o.theta.value),
        y: o.y.value + r * Math.sin(o.theta.value),
        z: o.z.value + r * Math.cos(o.phi.value) * Math.cos(o.theta.value),
      }
    }
    let prev = eye()
    for (let i = 0; i < 60; i++) {
      v.orbit(0, -40, 1280) // keep tilting the eye down past the horizon
      v.apply()
      const e = eye()
      expect(Math.hypot(e.x, e.y, e.z)).toBeGreaterThanOrEqual(420 - 1e-6)
      // It slides: each step moves the eye about one orbit step's arc (0.2 rad
      // at its distance from the focus), never a jump through the solid.
      const r = o.radius.value / o.zoom.value
      expect(Math.hypot(e.x - prev.x, e.y - prev.y, e.z - prev.z)).toBeLessThan(0.3 * r)
      prev = e
    }
    // Releasing still lands exactly on the authored camera.
    v.release()
    expect([o.theta.value, o.radius.value]).toEqual([1.2, 200])
  })

  test("surface orbit: a drag over a close-up glides the planet beneath the view, height held", () => {
    const o = new Observer()
    // An Earth of radius 400 at the origin, the focus on its surface (top),
    // the eye 200 above looking down at a slant.
    o.y.value = 400
    o.theta.value = 1.2
    o.radius.value = 200
    const v = new ViewLayer(o)
    v.keepOuts = () => [{ center: { x: 0, y: 0, z: 0 }, radius: 408 }]
    v.apply()
    const read = () => {
      const r = o.radius.value / o.zoom.value
      const f = { x: o.x.value, y: o.y.value, z: o.z.value }
      const e = {
        x: f.x + r * Math.sin(o.phi.value) * Math.cos(o.theta.value),
        y: f.y + r * Math.sin(o.theta.value),
        z: f.z + r * Math.cos(o.phi.value) * Math.cos(o.theta.value),
      }
      return { f, e, fr: Math.hypot(f.x, f.y, f.z), er: Math.hypot(e.x, e.y, e.z) }
    }
    const h0 = read().er
    let prev = read().f
    for (let i = 0; i < 40; i++) {
      v.orbit(30, i < 20 ? 0 : 15, 1280) // sideways, then also forward
      v.apply()
      const now = read()
      expect(now.fr).toBeCloseTo(400, 6) // the focus stays on the ground
      expect(now.er).toBeCloseTo(h0, 6) // the eye keeps its height
      expect(now.er).toBeGreaterThan(408) // never inside
      // The ground under the focus moves smoothly (no jumps).
      expect(Math.hypot(now.f.x - prev.x, now.f.y - prev.y, now.f.z - prev.z)).toBeLessThan(40)
      prev = now.f
    }
    // It really travelled across the surface.
    expect(Math.hypot(prev.x, prev.y - 400, prev.z)).toBeGreaterThan(200)
    v.release()
    expect([o.x.value, o.y.value, o.z.value, o.theta.value]).toEqual([0, 400, 0, 1.2])
  })
})
