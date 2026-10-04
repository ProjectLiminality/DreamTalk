/**
 * Ribbon instancing (optimization A, table layout since G) — the
 * INSTANCE-DATA EQUALITY gate. Sections 1–3 pin the oracle-side packing
 * helpers; the RibbonBatch section pins the table design: the batch's
 * segments ARE the oracle's local floats, each stroke's row holds the
 * same f32 modelView the per-mesh uniform carries, plus its style.
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

describe("RibbonBatch — the per-stroke table (opt G): offsets, rows, relocation, hiding", () => {
  /** A stroke as the host hands it to the batch: its OWN local buffers. */
  const strokeOf = (r: RibbonStroke) => ({
    points: r.worldPoints(),
    positions: (r.geometry.getAttribute("instanceStart") as THREE.InterleavedBufferAttribute).data
      .array as Float32Array,
    distances: (r.geometry.getAttribute("instanceDistanceStart") as THREE.InterleavedBufferAttribute)
      .data.array as Float32Array,
    count: r.geometry.instanceCount,
  })
  const posOf = (b: RibbonBatch) =>
    (b.geometry.getAttribute("instanceStart") as THREE.InterleavedBufferAttribute).data.array as Float32Array
  const rowOf = (b: RibbonBatch) => b.geometry.getAttribute("instanceStroke").array as Float32Array
  const ROW = 24 // floats per table row: 4 mv columns, style, tint

  test("the segments are the oracle's own LOCAL floats, at the stroke's offset", () => {
    const batch = new RibbonBatch(16)
    const rA = new RibbonStroke(2)
    rA.setPoints([v3(0, 0, 0), v3(1, 0, 0)])
    const rB = new RibbonStroke(2)
    rB.setPoints([v3(100, 0, 0), v3(200, 0, 5)])
    let slotA = batch.reserve(rA.geometry.instanceCount)
    let slotB = batch.reserve(rB.geometry.instanceCount)
    expect(slotB.offset).toBe(slotA.offset + slotA.maxSegments)
    const mv = new THREE.Matrix4().makeTranslation(3, 4, 5)
    slotA = batch.writeStroke(slotA, strokeOf(rA), mv, 2, 1, 0, 1, 1, 1, 1)
    slotB = batch.writeStroke(slotB, strokeOf(rB), mv, 2, 1, 0, 1, 1, 1, 1)
    const own = strokeOf(rB).positions
    const pos = posOf(batch)
    for (let i = 0; i < slotB.count * 6; i++) expect(pos[slotB.offset * 6 + i]).toBe(own[i])
  })

  test("each stroke's row holds ITS modelView and style — no bleed", () => {
    const batch = new RibbonBatch(8)
    const rA = new RibbonStroke(4)
    rA.setPoints([v3(0, 0, 0), v3(10, 0, 0), v3(10, 10, 0)])
    const rB = new RibbonStroke(6)
    rB.setPoints([v3(0, 0, 0), v3(-5, 0, 0)])
    let slotA = batch.reserve(rA.geometry.instanceCount)
    let slotB = batch.reserve(rB.geometry.instanceCount)
    const mvA = new THREE.Matrix4().makeRotationZ(0.3).setPosition(1, 2, 3)
    const mvB = new THREE.Matrix4().makeScale(2, 2, 2)
    slotA = batch.writeStroke(slotA, strokeOf(rA), mvA, 4, 12, 0, 1, 0, 0, 1)
    slotB = batch.writeStroke(slotB, strokeOf(rB), mvB, 6, 3, 0, 0, 0.5, 1, 0.8)
    expect(slotA.row).not.toBe(slotB.row)
    const t = batch.tableArray
    // The table stores the matrix as f32 — exactly what the per-mesh uniform is.
    for (let i = 0; i < 16; i++) expect(t[slotA.row * ROW + i]).toBe(Math.fround(mvA.elements[i]!))
    for (let i = 0; i < 16; i++) expect(t[slotB.row * ROW + i]).toBe(Math.fround(mvB.elements[i]!))
    expect([...t.subarray(slotA.row * ROW + 16, slotA.row * ROW + 23)]).toEqual([4, 12, 0, 1, 1, 0, 0])
    expect(t[slotB.row * ROW + 16]).toBe(6)
    expect(t[slotB.row * ROW + 19]).toBeCloseTo(0.8, 6)
    // Every live instance points at its own stroke's row.
    const rows = rowOf(batch)
    for (let i = 0; i < slotA.count; i++) expect(rows[slotA.offset + i]).toBe(slotA.row)
    for (let i = 0; i < slotB.count; i++) expect(rows[slotB.offset + i]).toBe(slotB.row)
  })

  test("segments are rewritten only when the polyline changes; the row every frame", () => {
    const batch = new RibbonBatch(256)
    const r = new RibbonStroke(2)
    r.setPoints([v3(0, 0, 0), v3(1, 0, 0)])
    let slot = batch.reserve(r.geometry.instanceCount)
    slot = batch.writeStroke(slot, strokeOf(r), new THREE.Matrix4(), 2, 1, 0, 1, 1, 1, 1)
    batch.flush()
    const posAttr = (batch.geometry.getAttribute("instanceStart") as THREE.InterleavedBufferAttribute).data
    posAttr.clearUpdateRanges()
    // Same polyline, new camera: no segment upload, a new matrix in the row.
    slot = batch.writeStroke(slot, strokeOf(r), new THREE.Matrix4().makeTranslation(9, 0, 0), 2, 1, 0, 1, 1, 1, 1)
    batch.flush()
    expect(posAttr.updateRanges.length).toBe(0)
    expect(batch.tableArray[slot.row * ROW + 12]).toBe(9)
    // A new polyline: its segments go up again.
    r.setPoints([v3(0, 0, 0), v3(2, 0, 0)])
    slot = batch.writeStroke(slot, strokeOf(r), new THREE.Matrix4(), 2, 1, 0, 1, 1, 1, 1)
    batch.flush()
    expect(posAttr.updateRanges.length).toBe(1)
  })

  test("a stroke that outgrows its run relocates; the old run points at the hidden row", () => {
    const batch = new RibbonBatch(4)
    const r = new RibbonStroke(2)
    r.setPoints([v3(0, 0, 0), v3(1, 0, 0)]) // subdivides to ~128 segments
    let slot = batch.reserve(2) // deliberately too small
    const oldOffset = slot.offset
    const row = slot.row
    slot = batch.writeStroke(slot, strokeOf(r), new THREE.Matrix4(), 2, 1, 0, 1, 1, 1, 1)
    expect(slot.maxSegments).toBeGreaterThanOrEqual(r.geometry.instanceCount)
    expect(slot.offset).not.toBe(oldOffset)
    expect(slot.row).toBe(row) // same stroke, same row
    expect(slot.count).toBe(r.geometry.instanceCount)
    expect(rowOf(batch)[oldOffset]).toBe(0)
    expect(rowOf(batch)[slot.offset]).toBe(row)
  })

  test("hiding a stroke zeroes its row's fade; row 0 is always hidden", () => {
    const batch = new RibbonBatch(8)
    const r = new RibbonStroke(3)
    r.setPoints([v3(0, 0, 0), v3(10, 0, 0)])
    let slot = batch.reserve(r.geometry.instanceCount)
    slot = batch.writeStroke(slot, strokeOf(r), new THREE.Matrix4(), 3, 1, 0, 1, 1, 1, 1)
    expect(batch.tableArray[slot.row * ROW + 19]).toBe(1)
    batch.hideStroke(slot)
    expect(batch.tableArray[slot.row * ROW + 19]).toBe(0)
    expect(batch.tableArray[19]).toBe(0)
  })

  test("a breathing stroke (shrink then grow) keeps its tail on the hidden row", () => {
    const batch = new RibbonBatch(512)
    const r = new RibbonStroke(2)
    r.setPoints(Array.from({ length: 40 }, (_, i) => v3(i * 5, 0, 0)))
    let slot = batch.reserve(r.geometry.instanceCount + 32)
    const write = () => (slot = batch.writeStroke(slot, strokeOf(r), new THREE.Matrix4(), 2, 1, 0, 1, 1, 1, 1))
    write()
    const n1 = slot.count
    r.setPoints([v3(0, 0, 0), v3(50, 0, 0)])
    write()
    const n2 = slot.count
    if (n2 < n1) expect(rowOf(batch)[slot.offset + n2]).toBe(0)
    r.setPoints(Array.from({ length: 40 }, (_, i) => v3(i * 5, 0, 0)))
    write()
    expect(slot.count).toBe(n1)
    expect(rowOf(batch)[slot.offset + n1 - 1]).toBe(slot.row)
  })
})

// --- The auto-threshold (opt A integration) --------------------------------
import { ThreeHost } from "../src/render/three-host"

describe("instancing auto-threshold", () => {
  test("threshold sits in the gap between light scenes and walls", () => {
    // Measured: video01 ~572 strokes is a net loss; thewall 3,776 a 49.8x win.
    // The threshold must exclude the former and include the latter.
    expect(ThreeHost.INSTANCE_THRESHOLD).toBeGreaterThan(572)
    expect(ThreeHost.INSTANCE_THRESHOLD).toBeLessThan(3776)
  })
})
