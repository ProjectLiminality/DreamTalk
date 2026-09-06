/**
 * Direct manipulation math (editor/manipulate.ts) — the plane the drag
 * lives on, the two projections' rays, the parent-frame conversion and
 * shift's axis constraint. Pure arithmetic, no GPU, no DOM: the same
 * functions the editor calls per pointer event, pinned as bare math.
 */

import { describe, expect, test } from "bun:test"
import {
  MoveGesture,
  applyMat3,
  cameraFrameOf,
  constrainDominant,
  intersectPlane,
  invertUpper3x3,
  movable,
  pointerRay,
  type CameraLike,
} from "../editor/manipulate"
import { derive, scalar } from "../src/params"

/** Col-major world matrix from three basis columns and a position. */
const matrixOf = (
  right: [number, number, number],
  up: [number, number, number],
  back: [number, number, number],
  position: [number, number, number],
): number[] => [...right, 0, ...up, 0, ...back, 0, ...position, 1]

const IDENTITY = matrixOf([1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 0])

/** The editor's stock rig: at +z looking back toward the origin. */
const FOV = (53.13 * Math.PI) / 180
const ASPECT = 16 / 9
const perspective = (z = 1000): CameraLike => ({
  matrixWorld: { elements: matrixOf([1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, z]) },
  fov: 53.13,
  aspect: ASPECT,
})
const orthographic = (z = 1000, halfW = 800, halfH = 450): CameraLike => ({
  matrixWorld: { elements: matrixOf([1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, z]) },
  isOrthographicCamera: true,
  left: -halfW,
  right: halfW,
  top: halfH,
  bottom: -halfH,
})

describe("cameraFrameOf", () => {
  test("reads basis, position and projection shape", () => {
    const frame = cameraFrameOf(perspective(1000))
    expect(frame.position).toEqual({ x: 0, y: 0, z: 1000 })
    expect(frame.forward).toEqual({ x: -0, y: -0, z: -1 })
    expect(frame.orthographic).toBe(false)
    expect(frame.fovY).toBeCloseTo(FOV, 10)
    const ortho = cameraFrameOf(orthographic())
    expect(ortho.orthographic).toBe(true)
    expect(ortho.halfWidth).toBe(800)
    expect(ortho.halfHeight).toBe(450)
  })
})

describe("view-plane intersection, perspective", () => {
  const frame = cameraFrameOf(perspective(1000))
  const plane = { x: 0, y: 0, z: 0 }

  test("the centre ray lands on the origin", () => {
    const hit = intersectPlane(pointerRay(frame, { x: 0, y: 0 }), plane, frame.forward)
    expect(hit!.x).toBeCloseTo(0, 9)
    expect(hit!.y).toBeCloseTo(0, 9)
    expect(hit!.z).toBeCloseTo(0, 9)
  })

  test("the frustum edge lands at distance * tan(fov/2)", () => {
    // tan(53.13/2 degrees) is 0.5 by construction of the stock fov.
    const right = intersectPlane(pointerRay(frame, { x: 1, y: 0 }), plane, frame.forward)
    expect(right!.x).toBeCloseTo(1000 * Math.tan(FOV / 2) * ASPECT, 6)
    expect(right!.y).toBeCloseTo(0, 6)
    const top = intersectPlane(pointerRay(frame, { x: 0, y: 1 }), plane, frame.forward)
    expect(top!.y).toBeCloseTo(1000 * Math.tan(FOV / 2), 6)
  })

  test("a nearer plane shrinks the same pointer travel (depth matters)", () => {
    const near = { x: 0, y: 0, z: 200 } // 800 from the camera, not 1000
    const hit = intersectPlane(pointerRay(frame, { x: 1, y: 0 }), near, frame.forward)
    expect(hit!.x).toBeCloseTo(800 * Math.tan(FOV / 2) * ASPECT, 6)
  })

  test("a plane behind the camera is unreachable", () => {
    const behind = { x: 0, y: 0, z: 2000 }
    expect(intersectPlane(pointerRay(frame, { x: 0, y: 0 }), behind, frame.forward)).toBeUndefined()
  })
})

describe("view-plane intersection, orthographic", () => {
  const frame = cameraFrameOf(orthographic(1000, 800, 450))

  test("NDC maps linearly across the frustum, depth-independent", () => {
    for (const z of [0, 500]) {
      const hit = intersectPlane(
        pointerRay(frame, { x: 0.5, y: -0.5 }),
        { x: 0, y: 0, z },
        frame.forward,
      )
      expect(hit!.x).toBeCloseTo(400, 9)
      expect(hit!.y).toBeCloseTo(-225, 9)
      expect(hit!.z).toBeCloseTo(z, 9)
    }
  })

  test("a ray parallel to the plane misses", () => {
    const ray = { origin: { x: 0, y: 0, z: 0 }, dir: { x: 1, y: 0, z: 0 } }
    expect(intersectPlane(ray, { x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: 1 })).toBeUndefined()
  })
})

describe("parent-frame conversion", () => {
  test("identity passes a delta through untouched", () => {
    const inv = invertUpper3x3(IDENTITY)!
    expect(applyMat3(inv, { x: 3, y: -4, z: 5 })).toEqual({ x: 3, y: -4, z: 5 })
  })

  test("a rotated parent receives the delta in its own axes", () => {
    // Parent rotated +90° about z: local x points at world y — so a world
    // step along +x reads, inside the parent, as a step along -y.
    const rot = matrixOf([0, 1, 0], [-1, 0, 0], [0, 0, 1], [50, 60, 70])
    const inv = invertUpper3x3(rot)!
    const local = applyMat3(inv, { x: 10, y: 0, z: 0 })
    expect(local.x).toBeCloseTo(0, 9)
    expect(local.y).toBeCloseTo(-10, 9)
  })

  test("a scaled parent divides the delta by its scale", () => {
    const scaled = matrixOf([2, 0, 0], [0, 2, 0], [0, 0, 2], [0, 0, 0])
    const inv = invertUpper3x3(scaled)!
    expect(applyMat3(inv, { x: 10, y: 6, z: 0 })).toEqual({ x: 5, y: 3, z: 0 })
  })

  test("a degenerate (zero-scale) parent has no inverse", () => {
    expect(invertUpper3x3(matrixOf([0, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 0]))).toBeUndefined()
  })
})

describe("MoveGesture", () => {
  test("perspective: target = base + the plane delta", () => {
    const frame = cameraFrameOf(perspective(1000))
    const gesture = MoveGesture.create(frame, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, IDENTITY, 10, 20)!
    const target = gesture.target(frame, { x: 0.2, y: 0.1 }, false)!
    expect(target.x).toBeCloseTo(10 + 1000 * 0.2 * Math.tan(FOV / 2) * ASPECT, 6)
    expect(target.y).toBeCloseTo(20 + 1000 * 0.1 * Math.tan(FOV / 2), 6)
  })

  test("orthographic: pointer travel maps to exactly the frustum's units", () => {
    const frame = cameraFrameOf(orthographic(1000, 800, 450))
    const gesture = MoveGesture.create(frame, { x: -0.5, y: 0 }, { x: 7, y: 7, z: 0 }, IDENTITY, 0, 0)!
    const target = gesture.target(frame, { x: 0.5, y: -0.2 }, false)!
    expect(target.x).toBeCloseTo(800, 9)
    expect(target.y).toBeCloseTo(-90, 9)
  })

  test("the grab point anchors the delta — no jump on the first event", () => {
    const frame = cameraFrameOf(perspective(1000))
    const grab = { x: 0.3, y: -0.4 }
    const gesture = MoveGesture.create(frame, grab, { x: 0, y: 0, z: 0 }, IDENTITY, 5, 5)!
    expect(gesture.target(frame, grab, false)).toEqual({ x: 5, y: 5 })
  })

  test("the delta arrives in the parent's frame", () => {
    const frame = cameraFrameOf(orthographic(1000, 800, 450))
    const rotatedParent = matrixOf([0, 1, 0], [-1, 0, 0], [0, 0, 1], [0, 0, 0])
    const gesture = MoveGesture.create(frame, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, rotatedParent, 0, 0)!
    const target = gesture.target(frame, { x: 0.25, y: 0 }, false)! // +200 world x
    expect(target.x).toBeCloseTo(0, 9)
    expect(target.y).toBeCloseTo(-200, 9)
  })

  test("shift constrains to the dominant LOCAL axis", () => {
    const frame = cameraFrameOf(orthographic(1000, 800, 450))
    const gesture = MoveGesture.create(frame, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, IDENTITY, 0, 0)!
    // 320 of x-travel, 45 of y — shift keeps x, zeroes y.
    const target = gesture.target(frame, { x: 0.4, y: 0.1 }, true)!
    expect(target.x).toBeCloseTo(320, 9)
    expect(target.y).toBeCloseTo(0, 9)
    // …and the other way round when y dominates.
    const tall = gesture.target(frame, { x: 0.05, y: -0.6 }, true)!
    expect(tall.x).toBeCloseTo(0, 9)
    expect(tall.y).toBeCloseTo(-270, 9)
  })

  test("refuses a plane behind the camera and a degenerate parent", () => {
    const frame = cameraFrameOf(perspective(1000))
    expect(
      MoveGesture.create(frame, { x: 0, y: 0 }, { x: 0, y: 0, z: 2000 }, IDENTITY, 0, 0),
    ).toBeUndefined()
    const degenerate = matrixOf([0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0])
    expect(
      MoveGesture.create(frame, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, degenerate, 0, 0),
    ).toBeUndefined()
  })
})

describe("constrainDominant", () => {
  test("keeps the larger component, zeroes the other, x wins ties", () => {
    expect(constrainDominant(10, 3)).toEqual([10, 0])
    expect(constrainDominant(3, -10)).toEqual([0, -10])
    expect(constrainDominant(-5, 5)).toEqual([-5, 0])
  })
})

describe("movable (decision 1: bound x/y refuse the drag)", () => {
  test("free x/y move; a bound axis refuses", () => {
    const free = { x: scalar(0), y: scalar(0) }
    expect(movable(free)).toBe(true)
    const boundX = { x: scalar(0), y: scalar(0) }
    boundX.x.follow(derive(() => 42))
    expect(movable(boundX)).toBe(false)
    const boundY = { x: scalar(0), y: scalar(0) }
    boundY.y.follow(derive(() => 7))
    expect(movable(boundY)).toBe(false)
  })
})
