/**
 * The transform gizmo's math (docs/EDITOR-VOICE-COMMENTS.md step 2).
 *
 * Two pure layers, pinned as bare functions the way manipulate.test.ts pins
 * the move: AxisGesture (editor/manipulate.ts) — the ray/plane sweep that
 * turns pointer travel into a signed distance along ONE axis, in the param's
 * own units — and the handle geometry + hit-test (editor/gizmo.ts) that
 * decide which handle a press grabs. No GPU, no DOM.
 */

import { describe, expect, test } from "bun:test"
import { AxisGesture, cameraFrameOf, worldAxisOf, type CameraLike } from "../editor/manipulate"
import { distanceToSegment, handleGeometry, hitHandle } from "../editor/gizmo"

const matrixOf = (
  right: [number, number, number],
  up: [number, number, number],
  back: [number, number, number],
  position: [number, number, number],
): number[] => [...right, 0, ...up, 0, ...back, 0, ...position, 1]

const IDENTITY = matrixOf([1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 0])
const ASPECT = 16 / 9
const orthographic = (z = 1000, halfW = 800, halfH = 450): CameraLike => ({
  matrixWorld: { elements: matrixOf([1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, z]) },
  isOrthographicCamera: true,
  left: -halfW,
  right: halfW,
  top: halfH,
  bottom: -halfH,
})

describe("worldAxisOf", () => {
  test("reads the parent's basis column, scale and all", () => {
    const scaled = matrixOf([2, 0, 0], [0, 3, 0], [0, 0, 4], [5, 6, 7])
    expect(worldAxisOf(scaled, 0)).toEqual({ x: 2, y: 0, z: 0 })
    expect(worldAxisOf(scaled, 1)).toEqual({ x: 0, y: 3, z: 0 })
    expect(worldAxisOf(scaled, 2)).toEqual({ x: 0, y: 0, z: 4 })
  })
})

describe("AxisGesture (ortho — pointer travel maps to exact frustum units)", () => {
  const frame = cameraFrameOf(orthographic(1000, 800, 450))

  test("x-axis: the swept x is base + world travel along x", () => {
    // World x axis, identity parent → 1 param unit per world unit.
    const g = AxisGesture.create(frame, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 10)!
    // NDC 0.5 in x → world x = 0.5 * 800 = 400.
    expect(g.value(frame, { x: 0.5, y: 0 })!).toBeCloseTo(410, 6)
    // Motion purely in y contributes nothing to an x-axis drag.
    expect(g.value(frame, { x: 0, y: -0.7 })!).toBeCloseTo(10, 6)
  })

  test("y-axis: only vertical pointer travel moves it", () => {
    const g = AxisGesture.create(frame, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 0)!
    expect(g.value(frame, { x: 0, y: 0.5 })!).toBeCloseTo(225, 6) // 0.5 * 450
    expect(g.value(frame, { x: 0.9, y: 0 })!).toBeCloseTo(0, 6)
  })

  test("the grab point anchors the sweep — no jump on the first event", () => {
    const grab = { x: 0.3, y: 0 }
    const g = AxisGesture.create(frame, grab, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 42)!
    expect(g.value(frame, grab)!).toBeCloseTo(42, 9)
  })

  test("a scaled parent axis divides the world sweep into local units", () => {
    // Parent scales x by 2 → the same world travel is HALF the local delta.
    const worldAxis = worldAxisOf(matrixOf([2, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 0]), 0)
    const g = AxisGesture.create(frame, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, worldAxis, 0)!
    // NDC 0.5 → world x 400 → local 200 (÷ parent scale 2).
    expect(g.value(frame, { x: 0.5, y: 0 })!).toBeCloseTo(200, 6)
  })

  test("perUnit converts a world sweep into a param's own units (rotate/scale)", () => {
    const perUnit = Math.PI / 400 // radians per world unit
    const g = AxisGesture.create(frame, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 0, perUnit)!
    // 400 of world x travel → PI radians.
    expect(g.value(frame, { x: 0.5, y: 0 })!).toBeCloseTo(Math.PI, 6)
  })

  test("refuses a degenerate axis and an axis pointing straight at the camera", () => {
    expect(AxisGesture.create(frame, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0)).toBeUndefined()
    // The z axis is the view direction here — no in-plane sweep is honest.
    expect(AxisGesture.create(frame, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, 0)).toBeUndefined()
  })
})

describe("handle geometry + hit-test (editor/gizmo.ts)", () => {
  test("distanceToSegment: on the line is 0, off it is the perpendicular", () => {
    expect(distanceToSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0, 9)
    expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3, 9)
    // Past the end clamps to the endpoint.
    expect(distanceToSegment({ x: 13, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3, 9)
  })

  test("handles get a fixed on-screen length whatever the projected axis", () => {
    // Two axes: one long-projected, one nearly zero (edge-on).
    const geo = handleGeometry({ x: 100, y: 100 }, [
      { x: 300, y: 0 },
      { x: 0, y: 4 },
      { x: 0, y: 0 },
    ])
    // x tip: clamped to the max arm (62), pointing right.
    expect(geo.tips[0]!.x).toBeCloseTo(162, 6)
    expect(geo.tips[0]!.y).toBeCloseTo(100, 6)
    // y tip: floored at the min arm (26), pointing down.
    expect(geo.tips[1]!.y).toBeCloseTo(126, 6)
    // A degenerate axis still gets a grabbable stub.
    expect(Math.hypot(geo.tips[2]!.x - 100, geo.tips[2]!.y - 100)).toBeGreaterThan(20)
  })

  test("hitHandle grabs the nearest handle within tolerance, else null", () => {
    const geo = handleGeometry({ x: 0, y: 0 }, [
      { x: 100, y: 0 }, // x → right
      { x: 0, y: 100 }, // y → down
      { x: -100, y: 0 }, // z → left
    ])
    expect(hitHandle(geo, 40, 1)).toBe(0) // on the x arm
    expect(hitHandle(geo, 1, 40)).toBe(1) // on the y arm
    expect(hitHandle(geo, -40, 1)).toBe(2) // on the z arm
    expect(hitHandle(geo, 40, 40)).toBeNull() // in between, too far from any
  })
})
