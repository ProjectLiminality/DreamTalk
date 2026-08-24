/**
 * The live layer's contract (EDITOR-V4.md, the five numbered rules).
 *
 * Everything here is pure logic — no DOM, no host — because that is the
 * point of putting the overlay in its own store: the rules about what
 * snaps back and what persists are testable without a browser.
 */

import { describe, expect, test } from "bun:test"
import { Timeline } from "../src/timeline"
import { scalar, angle, completion, derive, type Param, type ParamValue } from "../src/params"
import {
  Overrides,
  clampTheta,
  dollyRadius,
  easeInOut,
  lerpPose,
  shortestAngle,
  THETA_LIMIT,
  type Pose,
} from "../editor/overrides"

const anyParam = (p: Param<number>) => p as unknown as Param<ParamValue>

describe("the live layer — the overlay itself", () => {
  test("rule 1: the overlay sits ABOVE apply(t), not inside it", () => {
    const p = scalar(0)
    const tl = new Timeline([{ anim: p.to(10, { easing: "linear" }), start: 0, duration: 1 }])
    const ov = new Overrides(tl)
    ov.set(anyParam(p), 4)

    // apply() alone is the pure timeline — the Dream never sees the layer.
    tl.apply(0.5)
    expect(p.value).toBe(5)
    // The editor's frame path adds one step after it.
    ov.apply()
    expect(p.value).toBe(4)
    // …and the next frame's apply() wipes it, which is why the overlay
    // must be re-applied every frame rather than written once.
    tl.apply(0.5)
    expect(p.value).toBe(5)
  })

  test("rule 2: an override on an ANIMATED param clears when the playhead moves", () => {
    const p = scalar(0)
    const tl = new Timeline([{ anim: p.to(10, { easing: "linear" }), start: 0, duration: 1 }])
    const ov = new Overrides(tl)
    ov.set(anyParam(p), 4)
    expect(ov.has(anyParam(p))).toBe(true)

    const cleared = ov.clearOnTimeMove()
    expect(cleared).toEqual([anyParam(p)])
    expect(ov.has(anyParam(p))).toBe(false)
    expect(ov.size).toBe(0)

    // …and the value snaps back to the timeline on the very next frame.
    tl.apply(1)
    ov.apply()
    expect(p.value).toBe(10)
  })

  test("rule 3: an override the timeline never touches PERSISTS across time moves", () => {
    const animated = scalar(0)
    const untouched = scalar(0)
    const tl = new Timeline([
      { anim: animated.to(10, { easing: "linear" }), start: 0, duration: 1 },
    ])
    const ov = new Overrides(tl)
    ov.set(anyParam(animated), 4)
    ov.set(anyParam(untouched), 7)

    expect(ov.animates(anyParam(animated))).toBe(true)
    expect(ov.animates(anyParam(untouched))).toBe(false)

    const cleared = ov.clearOnTimeMove()
    expect(cleared).toEqual([anyParam(animated)])
    expect(ov.size).toBe(1)
    expect(ov.get(anyParam(untouched))).toBe(7)

    // There is nothing to snap back to, so it keeps applying — forever.
    tl.apply(2)
    ov.apply()
    expect(animated.value).toBe(10)
    expect(untouched.value).toBe(7)
    ov.clearOnTimeMove()
    tl.apply(3)
    ov.apply()
    expect(untouched.value).toBe(7)
  })

  test("a bound param rejects an override — animate its source instead", () => {
    const source = scalar(2)
    const follower = scalar(0)
    follower.name = "follower"
    follower.follow(derive(() => source.value * 3))
    const ov = new Overrides(new Timeline([]))
    expect(() => ov.set(anyParam(follower), 99)).toThrow(/derived binding/)
    expect(ov.size).toBe(0)
    expect(follower.value).toBe(6)
  })

  test("values are clamped by the param's own semantics", () => {
    const c = completion(0)
    const ov = new Overrides(new Timeline([]))
    ov.set(anyParam(c), 4)
    expect(ov.get(anyParam(c))).toBe(1)
    ov.apply()
    expect(c.value).toBe(1)
  })

  test("delete / release / clearAll drop overrides regardless of animation", () => {
    const a = scalar(0)
    const b = scalar(0)
    const tl = new Timeline([{ anim: a.to(1, { easing: "linear" }), start: 0, duration: 1 }])
    const ov = new Overrides(tl)
    ov.set(anyParam(a), 5)
    ov.set(anyParam(b), 6)

    expect(ov.delete(anyParam(a))).toBe(true)
    expect(ov.delete(anyParam(a))).toBe(false)
    ov.set(anyParam(a), 5)
    ov.release([anyParam(a), anyParam(b)])
    expect(ov.size).toBe(0)

    ov.set(anyParam(b), 6)
    ov.clearAll()
    expect(ov.size).toBe(0)
  })

  test("subscribers hear every change, and nothing else", () => {
    const p = scalar(0)
    const ov = new Overrides(new Timeline([]))
    let beats = 0
    const stop = ov.subscribe(() => beats++)
    ov.set(anyParam(p), 1)
    expect(beats).toBe(1)
    ov.delete(anyParam(p))
    expect(beats).toBe(2)
    ov.delete(anyParam(p)) // no-op, no beat
    expect(beats).toBe(2)
    ov.clearAll() // already empty, no beat
    expect(beats).toBe(2)
    stop()
    ov.set(anyParam(p), 2)
    expect(beats).toBe(2)
  })

  test("the whole frame path, in order: apply(t) -> overlay -> read", () => {
    const x = scalar(0)
    const phi = angle(0)
    const tl = new Timeline([{ anim: x.to(100, { easing: "linear" }), start: 0, duration: 1 }])
    const ov = new Overrides(tl)
    const frame = (t: number) => {
      tl.apply(t)
      ov.apply()
      return { x: x.value, phi: phi.value }
    }
    // Playing, untouched: the timeline is truth.
    expect(frame(0.25).x).toBe(25)
    // Tweak WHILE PLAYING: it takes effect on the very next frame.
    ov.set(anyParam(x), 999)
    ov.set(anyParam(phi), 1.2)
    expect(frame(0.5)).toEqual({ x: 999, phi: 1.2 })
    // Time moves: x snaps back, phi (never animated) does not.
    ov.clearOnTimeMove()
    expect(frame(0.75)).toEqual({ x: 75, phi: 1.2 })
  })
})

describe("flying the observer — the pose maths", () => {
  test("theta is clamped short of both poles", () => {
    expect(clampTheta(Math.PI)).toBeCloseTo(THETA_LIMIT, 12)
    expect(clampTheta(-Math.PI)).toBeCloseTo(-THETA_LIMIT, 12)
    expect(clampTheta(0.3)).toBe(0.3)
    expect(THETA_LIMIT).toBeLessThan(Math.PI / 2)
  })

  test("the return tween takes the SHORT way round in azimuth", () => {
    expect(shortestAngle(0.1)).toBeCloseTo(0.1, 12)
    expect(shortestAngle(2 * Math.PI - 0.1)).toBeCloseTo(-0.1, 12)
    expect(shortestAngle(-2 * Math.PI + 0.1)).toBeCloseTo(0.1, 12)
    // A flight that wrapped past PI unwinds forward, not all the way back.
    const from: Pose = { phi: 3.0, theta: 0, radius: 1000, x: 0, y: 0 }
    const to: Pose = { phi: -3.0, theta: 0, radius: 1000, x: 0, y: 0 }
    const mid = lerpPose(from, to, 0.5)
    expect(Math.abs(mid.phi)).toBeGreaterThan(3.0)
  })

  test("the return tween is eased and lands exactly on the timeline pose", () => {
    const from: Pose = { phi: 1, theta: 0.5, radius: 2000, x: 100, y: -50 }
    const to: Pose = { phi: 0, theta: 0, radius: 1000, x: 0, y: 0 }
    expect(lerpPose(from, to, 0)).toEqual(from)
    const end = lerpPose(from, to, 1)
    expect(end.phi).toBeCloseTo(to.phi, 9)
    expect(end.theta).toBeCloseTo(to.theta, 9)
    expect(end.radius).toBeCloseTo(to.radius, 9)
    expect(end.x).toBeCloseTo(to.x, 9)
    expect(end.y).toBeCloseTo(to.y, 9)

    // Eased, not linear: the middle of the tween is past the midpoint in
    // neither direction, and the ends leave/arrive slowly.
    expect(easeInOut(0)).toBe(0)
    expect(easeInOut(1)).toBe(1)
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 12)
    expect(easeInOut(0.1)).toBeLessThan(0.1)
    expect(easeInOut(0.9)).toBeGreaterThan(0.9)
    // Monotone, so the view never doubles back mid-return.
    let prev = -1
    for (let i = 0; i <= 20; i++) {
      const v = lerpPose(from, to, i / 20).theta
      expect(v).toBeLessThanOrEqual(prev < 0 ? Infinity : prev + 1e-12)
      prev = v
    }
  })

  test("radius interpolates geometrically — a dolly reads as ratios", () => {
    const from: Pose = { phi: 0, theta: 0, radius: 100, x: 0, y: 0 }
    const to: Pose = { phi: 0, theta: 0, radius: 400, x: 0, y: 0 }
    // Half-eased is the geometric mean, not the arithmetic one (250).
    expect(lerpPose(from, to, 0.5).radius).toBeCloseTo(200, 9)
  })

  test("dolly multiplies the radius, so it feels the same at every scale", () => {
    expect(dollyRadius(1000, 0)).toBe(1000)
    expect(dollyRadius(1000, 100)).toBeGreaterThan(1000)
    expect(dollyRadius(1000, -100)).toBeLessThan(1000)
    // Same notch, same RATIO, near and far.
    const near = dollyRadius(100, 200) / 100
    const far = dollyRadius(10000, 200) / 10000
    expect(near).toBeCloseTo(far, 12)
    // Never through the focus point.
    expect(dollyRadius(1, -100000)).toBeGreaterThan(0)
  })
})
