import { describe, expect, test } from "bun:test"
import * as THREE from "three"
import { CHUNK, mayReach, segmentBoxes } from "../src/render/pickcull"

/** A seeded random in [0, 1). */
const random = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

describe("pick culling never hides reachable ink", () => {
  test("every point inside a box projects inside its corners' rectangle (perspective, many views)", () => {
    const rnd = random(11)
    const W = 1280
    const H = 760
    let checked = 0
    for (let trial = 0; trial < 300; trial++) {
      const camera = new THREE.PerspectiveCamera(20 + rnd() * 60, W / H, 1, 100_000)
      camera.position.set((rnd() - 0.5) * 4000, (rnd() - 0.5) * 4000, 500 + rnd() * 4000)
      camera.lookAt((rnd() - 0.5) * 400, (rnd() - 0.5) * 400, (rnd() - 0.5) * 400)
      camera.updateMatrixWorld(true)
      const model = new THREE.Matrix4().compose(
        new THREE.Vector3((rnd() - 0.5) * 600, (rnd() - 0.5) * 600, (rnd() - 0.5) * 600),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6)),
        new THREE.Vector3(0.2 + rnd() * 3, 0.2 + rnd() * 3, 0.2 + rnd() * 3),
      )
      const mvp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(model)
      const box = new Float32Array([-rnd() * 200, -rnd() * 200, -rnd() * 200, rnd() * 200, rnd() * 200, rnd() * 200])
      for (let k = 0; k < 40; k++) {
        const p = new THREE.Vector3(
          box[0]! + rnd() * (box[3]! - box[0]!),
          box[1]! + rnd() * (box[4]! - box[1]!),
          box[2]! + rnd() * (box[5]! - box[2]!),
        ).applyMatrix4(model)
        const ndc = p.clone().project(camera)
        if (!Number.isFinite(ndc.x) || ndc.z > 1) continue // behind: toScreen skips it too
        const px = ((ndc.x + 1) / 2) * W
        const py = ((1 - ndc.y) / 2) * H
        expect(mayReach(box, 0, mvp.elements, W, H, px, py, 0)).toBe(true)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(5000)
  })

  test("a box well away from the cursor is culled; a box behind the eye never is", () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 1, 10_000)
    camera.position.set(0, 0, 1000)
    camera.updateMatrixWorld(true)
    const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    const box = new Float32Array([-10, -10, -10, 10, 10, 10]) // at the origin: the screen's centre
    expect(mayReach(box, 0, vp.elements, 800, 800, 400, 400, 0)).toBe(true)
    expect(mayReach(box, 0, vp.elements, 800, 800, 20, 20, 7)).toBe(false)
    const behind = new Float32Array([-10, -10, 1990, 10, 10, 2010])
    expect(mayReach(behind, 0, vp.elements, 800, 800, 20, 20, 0)).toBe(true)
  })

  test("segment boxes cover their chunks and are rebuilt only when the buffer changes", () => {
    const key = {}
    const n = CHUNK * 2 + 5
    const a = new Float32Array(n * 6).map((_, i) => (i % 7) - 3 + i * 0.01)
    const b1 = segmentBoxes(key, a, 1, n)
    expect(b1.chunks.length).toBe(3 * 6)
    expect(segmentBoxes(key, a, 1, n)).toBe(b1)
    a[0] = -999
    const b2 = segmentBoxes(key, a, 2, n)
    expect(b2).not.toBe(b1)
    expect(b2.whole[0]).toBe(-999)
  })
})
