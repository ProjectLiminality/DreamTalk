import { describe, expect, test } from "bun:test"
import { Observer } from "../src/dream"
import { ViewLayer, type Pose } from "../src/view"
import { applyT, handBasis, holdPose, PoseFilter, type Basis, type V } from "../src/gesture/hold"

const v = (x: number, y: number, z: number): V => ({ x, y, z })
const sub = (a: V, b: V) => v(a.x - b.x, a.y - b.y, a.z - b.z)
/** A world point as the eye of this pose sees it (camera coordinates). */
const seen = (p: Pose, x: V) => applyT([p.right, p.up, p.back], sub(x, p.eye))
/** Rotation by angle a about unit axis k, as a basis. */
const rot = (k: V, a: number): Basis => {
  const r = (e: V) => {
    const c = Math.cos(a)
    const s = Math.sin(a)
    const d = k.x * e.x + k.y * e.y + k.z * e.z
    return v(e.x * c + (k.y * e.z - k.z * e.y) * s + k.x * d * (1 - c), e.y * c + (k.z * e.x - k.x * e.z) * s + k.y * d * (1 - c), e.z * c + (k.x * e.y - k.y * e.x) * s + k.z * d * (1 - c))
  }
  return [r(v(1, 0, 0)), r(v(0, 1, 0)), r(v(0, 0, 1))]
}
const close = (a: V, b: V, digits = 6) => {
  expect(a.x).toBeCloseTo(b.x, digits)
  expect(a.y).toBeCloseTo(b.y, digits)
  expect(a.z).toBeCloseTo(b.z, digits)
}

/** An oblique camera: the view layer's pose of an orbited, rolled observer. */
const camera = (): Pose => {
  const o = new Observer()
  o.phi.value = 0.7
  o.theta.value = 0.3
  o.tilt.value = 0.2
  o.x.value = 40
  return new ViewLayer(o).pose()
}

describe("holding the scene in one hand", () => {
  const points = [v(0, 0, 0), v(300, -120, 50), v(-80, 400, -260), v(10, 10, 900)]
  const pivot = v(60, -30, 120)

  test("rotation equivariance: a hand turned by R turns what the eye sees by R about the grab point", () => {
    const cam = camera()
    const grab = handBasis([0, -1, 0], [0, 0, -1]) // palm down, fingers toward the screen
    for (const [axis, angle] of [[v(0, 1, 0), 0.6], [v(1, 0, 0), -0.4], [v(0, 0, 1), 0.9], [v(0.6, 0.8, 0), 1.2]] as const) {
      const R = rot(axis, angle)
      const now: Basis = [applyR(R, grab[0]), applyR(R, grab[1]), applyR(R, grab[2])]
      const held = holdPose(cam, pivot, pivot, grab, now)
      const c0 = seen(cam, pivot)
      close(seen(held, pivot), c0) // the grab point stays where it was
      for (const x of points) close(sub(seen(held, x), c0), applyR(R, sub(seen(cam, x), c0)))
    }
  })

  test("travel: the grabbed point follows the hand, the world translates with it", () => {
    const cam = camera()
    const B = handBasis([0, -1, 0], [0, 0, -1])
    const d = v(50, -20, 80)
    const held = holdPose(cam, pivot, v(pivot.x + d.x, pivot.y + d.y, pivot.z + d.z), B, B)
    for (const x of points) close(seen(held, x), seen(cam, v(x.x + d.x, x.y + d.y, x.z + d.z)))
  })

  test("the view layer places any pose it can read back (roll included)", () => {
    const o = new Observer()
    o.theta.value = 0.1
    const layer = new ViewLayer(o)
    const want = holdPose(layer.pose(), v(0, 0, 0), v(0, 0, 0), handBasis([0, -1, 0], [0, 0, -1]), handBasis([0.3, -0.9, 0.2], [0.2, 0.25, -0.95]))
    layer.place(want)
    layer.place(want) // twice before an apply is once
    layer.apply()
    const got = layer.pose()
    close(got.eye, want.eye, 4)
    close(got.right, want.right, 9)
    close(got.up, want.up, 9)
    close(got.back, want.back, 9)
    layer.release()
    expect(o.tilt.value).toBe(0)
  })

  test("the pose filter is still for a still hand and follows a turning one", () => {
    const f = new PoseFilter()
    const B = handBasis([0, -1, 0], [0, 0, -1])
    let out = f.update(0, v(0.5, 0.5, 0), B)
    for (let k = 1; k <= 60; k++) out = f.update(k / 60, v(0.5, 0.5, 0), B)
    close(out.basis[2], B[2], 9)
    const R = rot(v(0, 1, 0), 0.8)
    const T: Basis = [applyR(R, B[0]), applyR(R, B[1]), applyR(R, B[2])]
    for (let k = 61; k <= 90; k++) out = f.update(k / 60, v(0.5, 0.5, 0), T)
    close(out.basis[2], T[2], 3)
  })
})

function applyR(R: Basis, a: V): V {
  return v(R[0].x * a.x + R[1].x * a.y + R[2].x * a.z, R[0].y * a.x + R[1].y * a.y + R[2].y * a.z, R[0].z * a.x + R[1].z * a.y + R[2].z * a.z)
}

describe("a held view has no pole", () => {
  test("turned over the top — the eye past vertical, the picture upside down — it is placed exactly", () => {
    const o = new Observer()
    const layer = new ViewLayer(o)
    const grab = handBasis([0, -1, 0], [0, 0, -1])
    const start = layer.pose()
    for (const a of [1.2, 1.5, 1.565, 1.6, 2.4, Math.PI - 0.05]) {
      // The hand tips about the camera's x axis: the scene turns over.
      const R = rot(v(1, 0, 0), a)
      const now: Basis = [applyR(R, grab[0]), applyR(R, grab[1]), applyR(R, grab[2])]
      const want = holdPose(start, v(0, 0, 0), v(0, 0, 0), grab, now)
      layer.place(want)
      layer.apply()
      const got = layer.pose()
      close(got.back, want.back, 6)
      close(got.up, want.up, 6)
      close(got.right, want.right, 6)
    }
    layer.release()
    expect([o.phi.value, o.theta.value, o.tilt.value]).toEqual([0, 0, 0])
  })
})
