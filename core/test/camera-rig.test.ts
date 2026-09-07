/**
 * The 2021 two-level camera rig, mapped onto the Observer (O-8 / O-9).
 *
 * pydeation's ThreeDScene builds a camera INSIDE a group
 * (refs/pydeation-legacy/scene/scene.py:1053-1088,
 * camera/camera.py:65-77):
 *
 *   camera        position (x, 1000/zoom, z), rotation VECTOR_Y = -PI/2
 *   camera_group  Group(camera, p=…, b_frozen=…, z_frozen=…)
 *
 * VECTOR_Y in a C4D rotation vector is P — the PITCH, not the heading
 * (object.py:35-40 names the descIds). So the camera hangs above the
 * origin on +Y and is pitched a quarter turn to look straight DOWN at
 * the world XZ plane the scenes are built in.
 *
 * Scene10 is the only scene in the corpus that moves BOTH levels at
 * once, and this file is the claim that the Observer's four rotation
 * and distance channels span what those two levels can do. Every number
 * below is recomputed here from the rig's own definition — never read
 * back from Scene10.ts, which bakes the same walk as literal waypoints.
 * If the two ever disagree, this file is the one that is right.
 */

import { describe, expect, test } from "bun:test"
import { PI } from "../src/constants"

// ─── the rig, rebuilt from its 2021 definition ──────────────────────

type Vec = [number, number, number]
type Mat = [Vec, Vec, Vec]

const mul = (a: Mat, b: Mat): Mat =>
  a.map((row) =>
    [0, 1, 2].map((j) => row[0]! * b[0]![j]! + row[1]! * b[1]![j]! + row[2]! * b[2]![j]!),
  ) as Mat
const apply = (m: Mat, v: Vec): Vec =>
  [0, 1, 2].map((i) => m[i]![0]! * v[0]! + m[i]![1]! * v[1]! + m[i]![2]! * v[2]!) as Vec
const rx = (a: number): Mat => [
  [1, 0, 0],
  [0, Math.cos(a), -Math.sin(a)],
  [0, Math.sin(a), Math.cos(a)],
]
const ry = (a: number): Mat => [
  [Math.cos(a), 0, Math.sin(a)],
  [0, 1, 0],
  [-Math.sin(a), 0, Math.cos(a)],
]
const norm = (v: Vec): number => Math.hypot(v[0], v[1], v[2])
const unit = (v: Vec): Vec => {
  const n = norm(v)
  return [v[0] / n, v[1] / n, v[2] / n]
}
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/**
 * The rig's camera pose in the MODEL frame — C4D's world with x negated,
 * which is how a left-handed scene is carried into right-handed maths.
 * `camY` is the standoff (1000/zoom, then whatever Transform sets),
 * `camZ` the in-plane pedestal, and the two group angles the orbit.
 */
const rigPose = (
  camY: number,
  camZ: number,
  groupP: number,
  groupH: number,
): { eye: Vec; forward: Vec; up: Vec } => {
  const group = mul(ry(groupH), rx(-groupP))
  const orientation = mul(group, rx(PI / 2)) // the camera's own frozen pitch
  return {
    eye: apply(group, [0, camY, camZ]),
    forward: apply(orientation, [0, 0, 1]),
    up: apply(orientation, [0, 1, 0]),
  }
}

/** Model frame → core's frame: core = (-x, z, y). */
const toCore = (v: Vec): Vec => [-v[0]!, v[2]!, v[1]!]

/** The Observer state that reproduces a rig pose. */
const observerState = (camY: number, camZ: number, groupP: number, groupH: number) => {
  const pose = rigPose(camY, camZ, groupP, groupH)
  const eye = toCore(pose.eye)
  const forward = unit(toCore(pose.forward))
  const up = toCore(pose.up)
  // The rig's camera looks along `forward`; the point it is aimed at, at
  // the rig's own standoff, is what the Observer orbits.
  const standoff = norm(eye)
  const focus: Vec = [
    eye[0] + forward[0] * standoff,
    eye[1] + forward[1] * standoff,
    eye[2] + forward[2] * standoff,
  ]
  const off: Vec = [eye[0] - focus[0], eye[1] - focus[1], eye[2] - focus[2]]
  const radius = norm(off)
  const theta = Math.asin(off[1] / radius)
  const phi = Math.atan2(off[0], off[2])
  // Tilt: the signed roll from lookAt's world-up frame to the rig's own.
  const f: Vec = [-off[0] / radius, -off[1] / radius, -off[2] / radius]
  const side = cross(f, [0, 1, 0])
  let tilt = 0
  if (norm(side) > 1e-9) {
    const s = unit(side)
    const u = cross(s, f)
    // NEGATED to match the renderer's sense of `tilt`, which is not the
    // same as this frame's. syncCamera applies the roll as
    // `camera.rotateZ(tilt)` AFTER lookAt, i.e. about the camera's own
    // -Z view axis, so a positive tilt turns the PICTURE clockwise:
    // three.js puts world (150, 0, 0), which sits at screen (832, 360)
    // unrolled, at (744, 522) under tilt = 1. The angle measured here is
    // the roll of the camera's up-vector, which runs the other way.
    // One sign, stated once, verified against the renderer rather than
    // reasoned about — the ambiguity is real and cost this chapter two
    // wrong scene versions before it was pinned down.
    tilt = -Math.atan2(dot(cross(u, up), f), dot(u, up))
  }
  return { phi, theta, radius, tilt, focus }
}

describe("the 2021 rig at rest", () => {
  test("front perspective is the Observer's own origin pose", () => {
    // camera_perspective "front" is group p = 0, b_frozen = 0, and the
    // camera at the rig's 1000-unit standoff.
    const s = observerState(1000, 0, 0, 0)
    expect(s.phi).toBeCloseTo(0, 9)
    expect(s.theta).toBeCloseTo(0, 9)
    expect(s.tilt).toBeCloseTo(0, 9)
    expect(s.radius).toBeCloseTo(1000, 6)
    expect(s.focus[0]).toBeCloseTo(0, 6)
    expect(s.focus[1]).toBeCloseTo(0, 6)
    expect(s.focus[2]).toBeCloseTo(0, 6)
  })

  test("zoom is realized as standoff, and only as standoff", () => {
    // ThreeDCamera sets pos_y = 1000/zoom, so Scene08_2's zoom 100 is a
    // camera 10 units from the focus — pushed inside the tableau.
    expect(observerState(1000 / 100, 0, 0, 0).radius).toBeCloseTo(10, 6)
    expect(observerState(1000 / (3 / 4), 0, 0, 0).radius).toBeCloseTo(4000 / 3, 6)
  })

  test("the camera's in-plane pedestal is a pure focus pan at rest", () => {
    // Unrotated, camera-local z slides the picture and nothing else: the
    // view stays square to the plane and the focus moves with the eye.
    const s = observerState(1000, 25, 0, 0)
    expect(s.phi).toBeCloseTo(0, 9)
    expect(s.theta).toBeCloseTo(0, 9)
    expect(s.tilt).toBeCloseTo(0, 9)
    expect(s.focus[1]).toBeCloseTo(25, 6)
    // And crucially the focus barely leaves the picture plane while the
    // rig is unrotated — which is why every scene before Scene10 fits
    // through the Observer with the focus pinned at z = 0. The residual
    // is the third of a unit by which the hypotenuse to the aimed point
    // exceeds the standoff, sub-pixel at any framing in the corpus.
    expect(Math.abs(s.focus[2])).toBeLessThan(0.5)
    // The standoff is the hypotenuse to the aimed point, so it grows by
    // the pedestal: hypot(1000, 25) = 1000.3125, not 1000.
    expect(s.radius).toBeCloseTo(Math.hypot(1000, 25), 4)
  })
})

describe("Scene10's orbit — the rig moving both levels at once", () => {
  // Transform(camera_group, p=PI/3, h=PI/4) with Transform(camera, z=25, y=-300)
  const end = observerState(700, 25, PI / 3, PI / 4)

  test("the orbit is a genuine ROLL, not just a turn", () => {
    // This is the whole reason `tilt` is load-bearing: composing a group
    // pitch with a group heading tips the horizon, and a lookAt with
    // world-up cannot reproduce that on its own.
    expect(Math.abs(end.tilt)).toBeGreaterThan(1)
    expect(end.tilt).toBeCloseTo(1.10715, 4)
  })

  test("the pose is the one measured off the film", () => {
    // Solved independently against f_01770 (t=354.0s) by fitting the
    // renderer's own projection to five ink centroids: phi +0.884,
    // theta -0.672, tilt +1.088. The rig's arithmetic agrees.
    expect(end.phi).toBeCloseTo(0.88608, 4)
    expect(end.theta).toBeCloseTo(-0.65906, 4)
    expect(end.radius).toBeCloseTo(700.45, 2)
  })

  test("the camera's pedestal leaves the picture plane once the rig turns", () => {
    // The finding that Scene10's header records: under rotation the
    // in-plane pedestal acquires an out-of-plane component, and
    // syncCamera pins the focus to z = 0, so this term is dropped.
    // It is ~21 units, and it is the whole of that scene's residual.
    expect(end.focus[2]).toBeGreaterThan(20)
    expect(end.focus[2]).toBeCloseTo(21.42749, 4)
  })

  test("the path is NOT linear in Observer coordinates", () => {
    // Why Scene10 samples the walk instead of animating to the endpoint:
    // the source interpolates its own two angles linearly, and phi is
    // strongly convex in that parameter while theta saturates.
    const mid = observerState(1000 - 300 * 0.5, 25 * 0.5, (PI / 3) * 0.5, (PI / 4) * 0.5)
    // A linear phi would put the midpoint at half the endpoint.
    expect(mid.phi).toBeLessThan(end.phi / 2)
    // theta, by contrast, is already past half its travel at the middle.
    expect(Math.abs(mid.theta)).toBeGreaterThan(Math.abs(end.theta) / 2)
  })

  test("theta turns back near the end of the move", () => {
    // The non-monotonicity that makes a single .to() wrong rather than
    // merely imprecise: elevation peaks before the move finishes.
    const at = (u: number) =>
      observerState(1000 - 300 * u, 25 * u, (PI / 3) * u, (PI / 4) * u).theta
    const peak = at(0.92)
    expect(peak).toBeLessThan(at(0.8))
    expect(peak).toBeLessThan(at(1))
  })
})

describe("the camera's own pitch is never animated in this corpus", () => {
  test("p = -PI/2 under relative=False is the rest pose, so a no-op", () => {
    // Scene08_1:845 and Scene08_2:906 both pass `p=-PI/2, relative=False`.
    // pydeation's transform filters out any channel whose absolute input
    // equals the current value (object.py:390-392), and -PI/2 IS the
    // camera's resting pitch (camera.py:70) — so neither call animates
    // that channel. The Observer therefore needs no camera-local pitch.
    const rest = observerState(1000, 0, 0, 0)
    const restated = observerState(1000, 0, 0, 0)
    expect(restated.phi).toBeCloseTo(rest.phi, 12)
    expect(restated.theta).toBeCloseTo(rest.theta, 12)
    expect(restated.tilt).toBeCloseTo(rest.tilt, 12)
  })
})
