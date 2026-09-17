/**
 * Ribbon instancing (optimization A) — the INSTANCE-DATA EQUALITY gate.
 *
 * The per-mesh RibbonStroke path (ribbon.ts) is the byte-identity ORACLE.
 * The batch (ribbon-batch.ts) must feed the shader the SAME numbers, only
 * from per-instance attributes instead of per-mesh userData + a per-mesh
 * modelView. This file pins that equality without a GPU, the way
 * ribbon-width.test.ts and cull.test.ts pin their contracts headless:
 *
 *   1. TRANSFORM. The batch bakes VIEW-space endpoints on the CPU
 *      (`packViewSegments(mv, …)`). The oracle stores LOCAL endpoints and
 *      the shader multiplies by the per-mesh `modelViewMatrix` — which
 *      three computes as `matrixWorldInverse · matrixWorld`
 *      (Matrix4.multiplyMatrices, ModelNode.js). So the batch's baked
 *      positions must equal that same `mv` applied to the oracle's local
 *      positions. Same one multiply; the only residual is CPU-f64-then-
 *      f32-store vs GPU-f32, which the rendered gauntlet confirms.
 *   2. DISTANCES stay LOCAL (drawn/erased are stated in local arc length),
 *      so the batch's distances must be byte-identical to the oracle's
 *      `packSegments(local).distances`.
 *   3. STYLE. drawn/erased/tint/fade/width the batch writes per instance
 *      must equal what the oracle's `style()` wrote to userData.
 *   4. PACKING. A stroke's slice lands at its reserved offset; a stroke
 *      that outgrows its slot relocates correctly; a hidden stroke's slot
 *      draws nothing (fade 0).
 */

import { describe, expect, test } from "bun:test"
import * as THREE from "three/webgpu"
import { RibbonStroke, RIBBON_KEYS } from "../src/render/ribbon"
import { RibbonBatch } from "../src/render/ribbon-batch"
import { packSegments } from "../src/render/ribbon-math"

const v3 = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z)

/** A modelView built EXACTLY as three builds it (ModelNode.js:155). */
const modelView = (worldMatrix: THREE.Matrix4, camera: THREE.Camera): THREE.Matrix4 => {
  camera.updateMatrixWorld(true)
  return new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, worldMatrix)
}

describe("packViewSegments — the transform matches the oracle's modelView", () => {
  test("baked positions == mv · (oracle local positions), distances stay local", () => {
    const ribbon = new RibbonStroke(3)
    // A 3-point open polyline (resample leaves it — perSegment ≤ 1 for a
    // 2-segment line at target 128 gives perSegment 64, so it subdivides;
    // we compare against the ribbon's OWN resampled points, the oracle).
    ribbon.setPoints([v3(0, 0, 0), v3(100, 50, -20), v3(200, 0, 40)])
    const local = ribbon.worldPoints() // the subdivided local array
    const oracle = packSegments(local)

    // A non-trivial world transform + a camera off-axis.
    const world = new THREE.Matrix4().compose(
      new THREE.Vector3(30, -10, 5),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -0.7, 0.1, "ZXY")),
      new THREE.Vector3(1.5, 1.5, 1.5),
    )
    const camera = new THREE.PerspectiveCamera(53.13, 16 / 9, 1, 100000)
    camera.position.set(200, 300, 600)
    camera.lookAt(0, 0, 0)
    const mv = modelView(world, camera)

    const count = oracle.count
    const pos = new Float32Array(count * 6)
    const dist = new Float32Array(count * 2)
    const n = ribbon.packViewSegments(mv, pos, dist, new THREE.Vector3())
    expect(n).toBe(count)

    // Positions: the batch's baked view-space == mv applied to the oracle's
    // local positions, to f32.
    const scratch = new THREE.Vector3()
    for (let i = 0; i < count; i++) {
      // oracle start/end (local) → view via the same mv.
      scratch.set(oracle.positions[i * 6]!, oracle.positions[i * 6 + 1]!, oracle.positions[i * 6 + 2]!)
      scratch.applyMatrix4(mv)
      expect(pos[i * 6]!).toBeCloseTo(scratch.x, 4)
      expect(pos[i * 6 + 1]!).toBeCloseTo(scratch.y, 4)
      expect(pos[i * 6 + 2]!).toBeCloseTo(scratch.z, 4)
      scratch.set(
        oracle.positions[i * 6 + 3]!,
        oracle.positions[i * 6 + 4]!,
        oracle.positions[i * 6 + 5]!,
      )
      scratch.applyMatrix4(mv)
      expect(pos[i * 6 + 3]!).toBeCloseTo(scratch.x, 4)
      expect(pos[i * 6 + 4]!).toBeCloseTo(scratch.y, 4)
      expect(pos[i * 6 + 5]!).toBeCloseTo(scratch.z, 4)
    }

    // Distances: byte-identical to the oracle's local arc length.
    for (let i = 0; i < count * 2; i++) {
      expect(dist[i]!).toBe(oracle.distances[i]!)
    }
  })

  test("identity modelView leaves local positions unchanged (baked == local)", () => {
    const ribbon = new RibbonStroke(2)
    ribbon.setPoints([v3(-50, 0, 0), v3(50, 0, 0)])
    const local = ribbon.worldPoints()
    const oracle = packSegments(local)
    const pos = new Float32Array(oracle.count * 6)
    const dist = new Float32Array(oracle.count * 2)
    ribbon.packViewSegments(new THREE.Matrix4(), pos, dist, new THREE.Vector3())
    for (let i = 0; i < oracle.count * 6; i++) expect(pos[i]!).toBeCloseTo(oracle.positions[i]!, 5)
  })

  test("an empty stroke packs zero segments", () => {
    const ribbon = new RibbonStroke(2)
    ribbon.setPoints([])
    const pos = new Float32Array(6)
    const dist = new Float32Array(2)
    expect(ribbon.packViewSegments(new THREE.Matrix4(), pos, dist, new THREE.Vector3())).toBe(0)
  })
})

describe("RibbonBatch — packing, offsets, relocation, hiding", () => {
  test("a two-stroke batch places each slice at its reserved offset with the right style", () => {
    const batch = new RibbonBatch(8)
    const rA = new RibbonStroke(4)
    rA.setPoints([v3(0, 0, 0), v3(10, 0, 0), v3(10, 10, 0)])
    const rB = new RibbonStroke(6)
    rB.setPoints([v3(0, 0, 0), v3(-5, 0, 0)])

    const slotA = batch.reserve(rA.geometry.instanceCount)
    const slotB = batch.reserve(rB.geometry.instanceCount)
    expect(slotB.offset).toBe(slotA.offset + slotA.maxSegments)

    const mv = new THREE.Matrix4() // identity — bake == local for a clean read
    const scratch = new THREE.Vector3()
    const packStroke = (
      r: RibbonStroke,
      slot: ReturnType<typeof batch.reserve>,
      width: number,
      drawn: number,
      erased: number,
      tint: [number, number, number],
      fade: number,
    ) => {
      const count = r.geometry.instanceCount
      const pos = new Float32Array(count * 6)
      const dist = new Float32Array(count * 2)
      const n = r.packViewSegments(mv, pos, dist, scratch)
      return batch.writeSlot(slot, pos, dist, n, width, drawn, erased, tint[0], tint[1], tint[2], fade)
    }
    packStroke(rA, slotA, 4, 12, 0, [1, 0, 0], 1)
    packStroke(rB, slotB, 6, 3, 0, [0, 0.5, 1], 0.8)

    const geom = batch.geometry
    const width = geom.getAttribute("instanceWidthPx").array as Float32Array
    const fade = geom.getAttribute("instanceFade").array as Float32Array
    const tint = geom.getAttribute("instanceTint").array as Float32Array
    const drawn = geom.getAttribute("instanceDrawn").array as Float32Array

    // Slice A: its own width/drawn/tint/fade at every instance in its run.
    for (let i = slotA.offset; i < slotA.offset + slotA.count; i++) {
      expect(width[i]!).toBe(4)
      expect(drawn[i]!).toBe(12)
      expect(fade[i]!).toBe(1)
      expect(tint[i * 3]!).toBe(1)
    }
    // Slice B: its own values, at its own offset — no bleed from A.
    for (let i = slotB.offset; i < slotB.offset + slotB.count; i++) {
      expect(width[i]!).toBe(6)
      expect(drawn[i]!).toBe(3)
      expect(fade[i]!).toBeCloseTo(0.8, 6)
      expect(tint[i * 3 + 2]!).toBe(1)
    }
    // instanceCount covers both runs.
    expect(geom.instanceCount).toBeGreaterThanOrEqual(slotB.offset + slotB.count)
  })

  test("baked view positions land at the slot's own offset (a stroke packs at the right place)", () => {
    const batch = new RibbonBatch(16)
    const rA = new RibbonStroke(2)
    rA.setPoints([v3(0, 0, 0), v3(1, 0, 0)])
    const slotA = batch.reserve(rA.geometry.instanceCount)
    const rB = new RibbonStroke(2)
    rB.setPoints([v3(7, 8, 9), v3(7, 8, 9)]) // degenerate but non-empty count
    // Give B a real geometry so it has segments.
    rB.setPoints([v3(100, 0, 0), v3(200, 0, 0)])
    const slotB = batch.reserve(rB.geometry.instanceCount)

    const mv = new THREE.Matrix4()
    const scratch = new THREE.Vector3()
    const pack = (r: RibbonStroke, slot: ReturnType<typeof batch.reserve>) => {
      const count = r.geometry.instanceCount
      const pos = new Float32Array(count * 6)
      const dist = new Float32Array(count * 2)
      const n = r.packViewSegments(mv, pos, dist, scratch)
      return batch.writeSlot(slot, pos, dist, n, 2, count, 0, 1, 1, 1, 1)
    }
    pack(rA, slotA)
    pack(rB, slotB)
    const posArr = (
      batch.geometry.getAttribute("instanceStart") as THREE.InterleavedBufferAttribute
    ).data.array as Float32Array
    // B's first segment start (world x = 100) sits at slotB.offset's stride.
    const stride = 6
    // resamplePolyline splits a 2-pt line into SUBDIVISION pieces, so B's
    // FIRST baked start is its first point (100, 0, 0).
    expect(posArr[slotB.offset * stride]!).toBeCloseTo(100, 3)
  })

  test("a stroke that outgrows its slot relocates to a larger run", () => {
    const batch = new RibbonBatch(4)
    const r = new RibbonStroke(2)
    r.setPoints([v3(0, 0, 0), v3(1, 0, 0)]) // subdivides to ~128 segments
    // Reserve a deliberately TOO-SMALL slot (2 segments).
    let slot = batch.reserve(2)
    const oldOffset = slot.offset
    const count = r.geometry.instanceCount
    expect(count).toBeGreaterThan(2)
    const pos = new Float32Array(count * 6)
    const dist = new Float32Array(count * 2)
    const n = r.packViewSegments(new THREE.Matrix4(), pos, dist, new THREE.Vector3())
    slot = batch.writeSlot(slot, pos, dist, n, 2, 1, 0, 1, 1, 1, 1)
    // The slot moved to a fresh, larger run that can hold all n segments.
    expect(slot.maxSegments).toBeGreaterThanOrEqual(n)
    expect(slot.offset).not.toBe(oldOffset)
    expect(slot.count).toBe(n)
    // The abandoned run is hidden (fade 0 at the old offset).
    const fade = batch.geometry.getAttribute("instanceFade").array as Float32Array
    expect(fade[oldOffset]!).toBe(0)
  })

  test("hiding a slot sets every instance's fade to 0 (draws nothing)", () => {
    const batch = new RibbonBatch(8)
    const r = new RibbonStroke(3)
    r.setPoints([v3(0, 0, 0), v3(10, 0, 0)])
    const slot = batch.reserve(r.geometry.instanceCount)
    const count = r.geometry.instanceCount
    const pos = new Float32Array(count * 6)
    const dist = new Float32Array(count * 2)
    const n = r.packViewSegments(new THREE.Matrix4(), pos, dist, new THREE.Vector3())
    batch.writeSlot(slot, pos, dist, n, 3, 1, 0, 1, 1, 1, 1)
    const fade = batch.geometry.getAttribute("instanceFade").array as Float32Array
    expect(fade[slot.offset]!).toBe(1)
    batch.hideSlot(slot)
    for (let i = 0; i < slot.maxSegments; i++) expect(fade[slot.offset + i]!).toBe(0)
    expect(slot.count).toBe(0)
  })

  test("a varying-segment stroke re-packs correctly frame to frame (shrink then grow)", () => {
    const batch = new RibbonBatch(512)
    const r = new RibbonStroke(2)
    // Frame 1: many points.
    r.setPoints(Array.from({ length: 40 }, (_, i) => v3(i * 5, 0, 0)))
    let slot = batch.reserve(r.geometry.instanceCount + 32) // headroom
    const write = () => {
      const count = r.geometry.instanceCount
      const pos = new Float32Array(count * 6)
      const dist = new Float32Array(count * 2)
      const n = r.packViewSegments(new THREE.Matrix4(), pos, dist, new THREE.Vector3())
      slot = batch.writeSlot(slot, pos, dist, n, 2, count, 0, 1, 1, 1, 1)
      return n
    }
    const n1 = write()
    // Frame 2: fewer points → fewer segments; the tail must hide.
    r.setPoints([v3(0, 0, 0), v3(50, 0, 0)])
    const n2 = write()
    const fade = batch.geometry.getAttribute("instanceFade").array as Float32Array
    // The live count shrank; instances past the new count are hidden.
    expect(slot.count).toBe(n2)
    if (n2 < n1) expect(fade[slot.offset + n2]!).toBe(0)
    // Frame 3: back to many points (within headroom) → live again.
    r.setPoints(Array.from({ length: 40 }, (_, i) => v3(i * 5, 0, 0)))
    const n3 = write()
    expect(slot.count).toBe(n3)
    expect(fade[slot.offset]!).toBe(1)
  })
})
