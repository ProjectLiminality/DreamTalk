/**
 * RibbonBatch — one InstancedBufferGeometry, one draw, for MANY strokes.
 *
 * This is optimization A (PLAN Ch 4 / thewall-profile #5): the render
 * ceiling on TheWall is per-object WebGPU submission — 3,776 ribbon
 * meshes each rebinding its own `userData` uniform buffer before its
 * draw (hump-diagnosis.md). The floor and the hump are the SAME cost at
 * two magnitudes. Collapsing the strokes into one instanced draw removes
 * it at the root.
 *
 * THE ONE INVARIANT: byte-identity with the per-mesh RibbonStroke path
 * (ribbon.ts), which stays the oracle. Every value the per-mesh shader
 * reads reaches the same math here — only its SOURCE changes:
 *
 *   per-mesh (ribbon.ts)                 batch (here)
 *   ─────────────────────────────────────────────────────────────────
 *   instanceStart/End (local)            instanceStart/End — the SAME
 *                                        floats, copied from the stroke's
 *                                        own buffers
 *   modelViewMatrix (uniform, f32)       the stroke's row of the TABLE:
 *                                        the same f32 matrix
 *   modelViewMatrix · local (GPU)        mv · local (GPU) — the same line
 *   userData.widthPx/drawn/erased/fade   the row's style vec4
 *   userData.tint                        the row's tint vec4
 *
 * THE TABLE (optimization G, 2026-10-04). A's first build baked every
 * segment into VIEW space on the CPU each frame (`mv · local` in f64, then
 * an f32 store) and wrote the style into every segment — ~480k segments
 * re-packed per frame on TheWall, because the camera moves every frame:
 * 25–37 ms, the largest cost left in the frame. Now the segments stay
 * LOCAL and carry only their stroke's index; what changes per frame is
 * per STROKE — its modelView and its style — and lives in a small
 * read-only storage table (6 vec4 a stroke). Segment buffers are written
 * only when a stroke's polyline changes, and uploaded by range.
 *
 * This is also CLOSER to the oracle than the bake was: the oracle's
 * shader multiplies its f32 `modelViewMatrix` uniform — three composes it
 * as `matrixWorldInverse · matrixWorld` in f64 (ModelNode) and uploads it
 * as f32 — by the f32 local endpoint, on the GPU. The table holds that
 * same f32 matrix, composed the same way, and the shader does that same
 * multiply on those same inputs. The bake's residual (CPU f64 multiply,
 * f32 store) is gone.
 *
 * HIDING. A batch draws all `instanceCount` instances every frame; there
 * is no per-instance skip. Row 0 of the table is a permanently hidden
 * stroke (fade 0): an unused or abandoned slot's segments point at it. A
 * stroke hidden this frame sets its own row's fade to 0. Either way the
 * fragment stage returns vec4(0,0,0,0), and under MAX blending a zero-
 * alpha, zero-colour contribution changes no channel — a true no-op,
 * byte-exact, the same as if the instance were not submitted.
 */

import * as THREE from "three/webgpu"
import * as TSLTyped from "three/tsl"

/** Same @types/three TSL lag as ribbon.ts — verified when the shader
 *  builds; the module's exports stay typed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TSL = TSLTyped as any
const {
  Fn,
  If,
  attribute,
  int,
  mat4,
  storage,
  cameraProjectionMatrix,
  clamp,
  float,
  length,
  max,
  min,
  mix,
  screenCoordinate,
  screenDPR,
  screenSize,
  smoothstep,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL

/** Must match ribbon.ts AA_PX exactly — the AA band is part of the math. */
const AA_PX = 1.0

/** Per-quad varyings — constant across the quad, exactly as ribbon.ts.
 *  Distinct property names so the two materials never alias. */
const vStartPx = varyingProperty("vec2", "dtBatchStartPx")
const vEndPx = varyingProperty("vec2", "dtBatchEndPx")
const vDist = varyingProperty("vec2", "dtBatchDist")
const vWidthPx = varyingProperty("float", "dtBatchWidthPx")
const vDrawn = varyingProperty("float", "dtBatchDrawn")
const vErased = varyingProperty("float", "dtBatchErased")
const vTint = varyingProperty("vec3", "dtBatchTint")
const vFade = varyingProperty("float", "dtBatchFade")

/**
 * The batched ribbon material: identical blend + SDF to RibbonMaterial,
 * but every scalar the per-mesh shader read from `userData` is a
 * per-instance attribute, and the segment endpoints arrive ALREADY in
 * view space (baked with the same modelView the per-mesh mesh would use).
 */
export class RibbonBatchMaterial extends THREE.NodeMaterial {
  /** The per-stroke table this material reads (see RibbonBatch). */
  readonly table: THREE.StorageBufferAttribute

  constructor(table: THREE.StorageBufferAttribute) {
    super()
    this.table = table
    // Blend state — byte-identical to RibbonMaterial (ribbon.ts).
    this.transparent = true
    this.depthWrite = false
    this.side = THREE.DoubleSide
    this.blending = THREE.CustomBlending
    this.blendEquation = THREE.MaxEquation
    this.blendSrc = THREE.OneFactor
    this.blendDst = THREE.OneFactor
    this.blendEquationAlpha = THREE.MaxEquation
    this.blendSrcAlpha = THREE.OneFactor
    this.blendDstAlpha = THREE.OneFactor

    // The stroke's row of the table, in place of RibbonMaterial's
    // per-mesh modelViewMatrix and userData nodes: four mv columns, then
    // (widthPx, drawn, erased, fade), then (tint, —).
    const rows = storage(table, "vec4", table.count).toReadOnly()
    const row = int(attribute("instanceStroke")).mul(TABLE_VEC4)
    const mv = mat4(
      rows.element(row),
      rows.element(row.add(1)),
      rows.element(row.add(2)),
      rows.element(row.add(3)),
    )
    const style = rows.element(row.add(4))
    const widthPx = style.x
    const drawn = style.y
    const erased = style.z
    const fade = style.w
    const tint = rows.element(row.add(5)).xyz

    const halfWidth = (w: ReturnType<typeof float>) => w.mul(screenDPR).mul(0.5)
    // pad(): stroke half-width + AA skirt + 1px guard — ribbon.ts's pad().
    const pad = (w: ReturnType<typeof float>) => halfWidth(w).add(AA_PX).add(1.0)

    this.vertexNode = Fn(() => {
      const corner = attribute("position").xy
      // The per-mesh shader's own line: modelView · local, on the GPU.
      const start = mv.mul(vec4(attribute("instanceStart"), 1.0)).toVar()
      const end = mv.mul(vec4(attribute("instanceEnd"), 1.0)).toVar()
      const distStart = float(attribute("instanceDistanceStart")).toVar()
      const distEnd = float(attribute("instanceDistanceEnd")).toVar()

      // Near-plane trim — verbatim from ribbon.ts (view-space z: front is
      // negative), arc-length distances trimmed alongside.
      const nearAlpha = (from: ReturnType<typeof vec4>, to: ReturnType<typeof vec4>) => {
        const a = cameraProjectionMatrix.element(2).element(2)
        const b = cameraProjectionMatrix.element(3).element(2)
        const nearEstimate = a
          .greaterThan(0.0)
          .select(b.negate().div(a.add(1.0)), b.mul(-0.5).div(a))
        return nearEstimate.sub(from.z).div(to.z.sub(from.z))
      }
      const perspective = cameraProjectionMatrix.element(2).element(3).equal(-1.0)
      If(perspective, () => {
        If(start.z.lessThan(0.0).and(end.z.greaterThan(0.0)), () => {
          const alpha = nearAlpha(start, end)
          end.assign(vec4(mix(start.xyz, end.xyz, alpha), end.w))
          distEnd.assign(mix(distStart, distEnd, alpha))
        }).ElseIf(end.z.lessThan(0.0).and(start.z.greaterThanEqual(0.0)), () => {
          const alpha = nearAlpha(end, start)
          start.assign(vec4(mix(end.xyz, start.xyz, alpha), start.w))
          distStart.assign(mix(distEnd, distStart, alpha))
        })
      })

      const clipStart = cameraProjectionMatrix.mul(start)
      const clipEnd = cameraProjectionMatrix.mul(end)
      const ndcStart = clipStart.xyz.div(clipStart.w)
      const ndcEnd = clipEnd.xyz.div(clipEnd.w)

      const half = screenSize.mul(0.5)
      const startPx = vec2(
        ndcStart.x.add(1.0).mul(half.x),
        float(1.0).sub(ndcStart.y).mul(half.y),
      ).toVar()
      const endPx = vec2(
        ndcEnd.x.add(1.0).mul(half.x),
        float(1.0).sub(ndcEnd.y).mul(half.y),
      ).toVar()
      vStartPx.assign(startPx)
      vEndPx.assign(endPx)
      vDist.assign(vec2(distStart, distEnd))
      vWidthPx.assign(widthPx)
      vDrawn.assign(drawn)
      vErased.assign(erased)
      vTint.assign(tint)
      vFade.assign(fade)

      const delta = endPx.sub(startPx)
      const lenPx = length(delta)
      const dir = lenPx.greaterThan(1e-6).select(delta.div(max(lenPx, 1e-6)), vec2(1.0, 0.0))
      const perp = vec2(dir.y.negate(), dir.x)

      const p = pad(widthPx)
      const along = mix(p.negate(), lenPx.add(p), corner.y)
      const targetPx = startPx.add(dir.mul(along)).add(perp.mul(corner.x.mul(p)))

      const clip = corner.y.greaterThan(0.5).select(clipEnd, clipStart).toVar()
      const targetNdc = vec2(
        targetPx.x.div(half.x).sub(1.0),
        float(1.0).sub(targetPx.y.div(half.y)),
      )
      clip.x.assign(targetNdc.x.mul(clip.w))
      clip.y.assign(targetNdc.y.mul(clip.w))
      return clip
    })()

    this.fragmentNode = Fn(() => {
      const startPx = vec2(vStartPx)
      const endPx = vec2(vEndPx)
      const delta = endPx.sub(startPx)
      const lenPx = length(delta)
      const dir = lenPx.greaterThan(1e-6).select(delta.div(max(lenPx, 1e-6)), vec2(1.0, 0.0))

      const rel = screenCoordinate.xy.sub(startPx)
      const u = rel.dot(dir)
      const v = rel.x.mul(dir.y).sub(rel.y.mul(dir.x))

      const distStart = vDist.x
      const distEnd = vDist.y
      const pxPerUnit = lenPx.div(max(distEnd.sub(distStart), 1e-7))
      const uFront = vDrawn.sub(distStart).mul(pxPerUnit).toVar()
      uFront.lessThan(0.0).discard()

      const uTail = vErased.sub(distStart).mul(pxPerUnit).toVar()
      uTail.greaterThan(lenPx).discard()

      const uBegin = max(uTail, 0.0)
      const uEnd = max(min(lenPx, uFront), uBegin)
      const d = length(vec2(u.sub(clamp(u, uBegin, uEnd)), v))

      const hw = vWidthPx.mul(screenDPR).mul(0.5)
      const coverage = smoothstep(hw.sub(AA_PX), hw.add(AA_PX), d).oneMinus()
      const a = coverage.mul(vFade)
      return vec4(vTint.mul(a), a)
    })()
  }
}

/** vec4s per stroke in the table: mv columns ×4, style, tint. */
const TABLE_VEC4 = 6

/** Floats per segment in the interleaved position buffer: start xyz + end xyz. */
const POS_STRIDE = 6
/** Floats per segment in the interleaved distance buffer: start + end. */
const DIST_STRIDE = 2

/**
 * A stroke's reservation inside a batch: a contiguous run of instance
 * slots and its row in the table. `maxSegments` is the run's capacity
 * (over-allocated so a stroke whose segment count breathes — the section
 * curve — rarely has to move); `count` is how many are live.
 */
export interface BatchSlot {
  offset: number
  maxSegments: number
  count: number
  /** The stroke's row in the table (≥ 1; row 0 is the hidden stroke). */
  row: number
  /** The polyline last copied in — a new array means the shape changed. */
  points?: unknown
}

/** What a stroke hands the batch each frame. */
export interface BatchStroke {
  /** Its polyline's identity: a new array means new geometry (ribbon.ts setPoints). */
  points: unknown
  /** Its own interleaved LOCAL segment buffers (stride 6 and 2) and live count. */
  positions: ArrayLike<number>
  distances: ArrayLike<number>
  count: number
}

/**
 * The per-stroke table and the one material that reads it, SHARED by all
 * of a host's batches. A host batches ribbons in runs (one per stretch of
 * attach order no fill interrupts — three-host.ts), so a scene with many
 * fills has many batches; sharing means each extra batch is only a
 * geometry and a draw on the same pipeline, never another material to
 * build or another table to upload.
 */
export class BatchTable {
  attr: THREE.StorageBufferAttribute
  material: RibbonBatchMaterial
  /** Rows handed out (row 0 is the hidden stroke). */
  private rows = 1
  /** Every mesh drawing with the material — re-pointed when it is rebuilt. */
  private readonly meshes: THREE.Mesh[] = []

  constructor(initialRows = 64) {
    this.attr = new THREE.StorageBufferAttribute(new Float32Array(Math.max(2, initialRows) * TABLE_VEC4 * 4), 4)
    this.material = new RibbonBatchMaterial(this.attr)
  }

  get array(): Float32Array {
    return this.attr.array as Float32Array
  }

  adopt(mesh: THREE.Mesh): void {
    this.meshes.push(mesh)
    mesh.material = this.material
  }

  /** A fresh row, growing the table (and rebuilding its material) if full. */
  reserveRow(): number {
    const row = this.rows++
    if (this.rows * TABLE_VEC4 > this.attr.count) {
      const next = new Float32Array((1 << Math.ceil(Math.log2(this.rows))) * TABLE_VEC4 * 4)
      next.set(this.attr.array as Float32Array)
      this.attr = new THREE.StorageBufferAttribute(next, 4)
      this.material.dispose()
      this.material = new RibbonBatchMaterial(this.attr)
      for (const mesh of this.meshes) mesh.material = this.material
    }
    return row
  }
}

/**
 * One InstancedBufferGeometry holding many strokes' segments, drawn once.
 *
 * Layout mirrors RibbonStroke's per-mesh geometry exactly (the same unit
 * quad + index shared across instances, the same interleaved local
 * position and distance buffers) plus one per-instance stroke index; the
 * per-stroke values live in the table. Strokes claim a run via `reserve`;
 * each frame the host writes a stroke with `writeStroke` (its geometry
 * only if it changed, its table row always) or hides it with `hideStroke`.
 */
export class RibbonBatch {
  readonly mesh: THREE.Mesh
  readonly geometry: THREE.InstancedBufferGeometry
  /** The table (and material) this batch shares with its siblings. */
  readonly shared: BatchTable
  /** High-water mark of reserved slots — the buffers' capacity in segments. */
  private capacity = 0
  /** Next free offset when reserving; runs are never freed, only hidden. */
  private cursor = 0

  private posBuf!: THREE.InstancedInterleavedBuffer
  private distBuf!: THREE.InstancedInterleavedBuffer
  private strokeAttr!: THREE.InstancedBufferAttribute
  /**
   * This frame's dirty instance extent [lo, hi), uploaded as ONE range per
   * buffer at `flush()`. Hundreds of small ranges (TheWall's ~470 moving
   * cables) cost far more as separate writeBuffer calls than one span.
   */
  private dirtyLo = Infinity
  private dirtyHi = -Infinity

  constructor(initialCapacity = 256, shared: BatchTable = new BatchTable()) {
    this.geometry = new THREE.InstancedBufferGeometry()
    // The unit quad, shared by every instance — identical to RibbonStroke.
    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3),
    )
    this.geometry.setIndex([0, 2, 1, 2, 3, 1])
    this.allocate(Math.max(1, initialCapacity))
    this.geometry.instanceCount = 0
    this.shared = shared
    this.mesh = new THREE.Mesh(this.geometry, shared.material)
    shared.adopt(this.mesh)
    this.mesh.frustumCulled = false
    this.mesh.visible = false
    // For the gates (instancing-gate.ts, state-gate.ts): mesh → its batch.
    this.mesh.userData.dtBatch = this
  }

  /** (Re)allocate the per-instance buffers to `segments`, preserving data. */
  private allocate(segments: number): void {
    const old = this.capacity
    const cap = Math.max(1, segments)
    const pos = new Float32Array(cap * POS_STRIDE)
    const dist = new Float32Array(cap * DIST_STRIDE)
    const stroke = new Float32Array(cap) // 0 = the hidden row
    if (old > 0) {
      pos.set(this.posBuf.array as Float32Array)
      dist.set(this.distBuf.array as Float32Array)
      stroke.set(this.strokeAttr.array as Float32Array)
    }
    this.posBuf = new THREE.InstancedInterleavedBuffer(pos, POS_STRIDE, 1)
    this.geometry.setAttribute("instanceStart", new THREE.InterleavedBufferAttribute(this.posBuf, 3, 0))
    this.geometry.setAttribute("instanceEnd", new THREE.InterleavedBufferAttribute(this.posBuf, 3, 3))
    this.distBuf = new THREE.InstancedInterleavedBuffer(dist, DIST_STRIDE, 1)
    this.geometry.setAttribute(
      "instanceDistanceStart",
      new THREE.InterleavedBufferAttribute(this.distBuf, 1, 0),
    )
    this.geometry.setAttribute(
      "instanceDistanceEnd",
      new THREE.InterleavedBufferAttribute(this.distBuf, 1, 1),
    )
    this.strokeAttr = new THREE.InstancedBufferAttribute(stroke, 1)
    this.geometry.setAttribute("instanceStroke", this.strokeAttr)
    this.capacity = cap
  }

  /**
   * Reserve a run of `maxSegments` slots and a table row for a stroke,
   * growing the buffers if needed. The stroke keeps the slot for life
   * (unless it outgrows it — see writeStroke).
   */
  reserve(maxSegments: number): BatchSlot {
    const row = this.shared.reserveRow()
    return { ...this.reserveRun(maxSegments), row }
  }

  /** A fresh run of instance slots, all pointing at the hidden row. */
  private reserveRun(maxSegments: number): { offset: number; maxSegments: number; count: number } {
    const cap = Math.max(1, maxSegments)
    const offset = this.cursor
    this.cursor += cap
    if (this.cursor > this.capacity) {
      // Grow generously (double past the need) so a burst of reservations
      // at attach does not reallocate once per stroke.
      this.allocate(1 << Math.ceil(Math.log2(this.cursor)))
    }
    // A fresh run starts hidden, so unwritten tails draw nothing.
    this.pointRun(offset, cap, 0)
    if (offset + cap > this.geometry.instanceCount) this.geometry.instanceCount = offset + cap
    this.mesh.visible = this.geometry.instanceCount > 0
    return { offset, maxSegments: cap, count: 0 }
  }

  /** Point instances [offset, offset + n) at table row `row`. */
  private pointRun(offset: number, n: number, row: number): void {
    if (n <= 0) return
    const arr = this.strokeAttr.array as Float32Array
    arr.fill(row, offset, offset + n)
    this.markDirty(offset, offset + n)
  }

  /**
   * Write one stroke for this frame: its table row always (modelView +
   * style), its segments only when its polyline changed. A stroke that
   * outgrows its run is RELOCATED to a larger one at the end (the old run
   * pointed at the hidden row — a small permanent gap); the caller MUST
   * adopt the returned slot.
   *
   * `mv` is composed by the caller exactly as three composes the per-mesh
   * modelViewMatrix (matrixWorldInverse · matrixWorld, Matrix4.multiply-
   * Matrices); the table stores it as f32, which is what the uniform is.
   */
  writeStroke(
    slot: BatchSlot,
    stroke: BatchStroke,
    mv: THREE.Matrix4,
    widthPx: number,
    drawn: number,
    erased: number,
    tintR: number,
    tintG: number,
    tintB: number,
    fade: number,
  ): BatchSlot {
    const count = stroke.count
    if (count > slot.maxSegments) {
      this.pointRun(slot.offset, slot.maxSegments, 0)
      // Round up so a breathing stroke does not relocate every frame.
      const run = this.reserveRun(1 << Math.ceil(Math.log2(Math.max(2, count))))
      slot = { ...run, row: slot.row }
    }
    if (slot.points !== stroke.points || slot.count !== count) {
      const n = Math.min(count, slot.maxSegments)
      const posArr = this.posBuf.array as Float32Array
      const distArr = this.distBuf.array as Float32Array
      for (let i = 0; i < n * POS_STRIDE; i++) posArr[slot.offset * POS_STRIDE + i] = stroke.positions[i]!
      for (let i = 0; i < n * DIST_STRIDE; i++) distArr[slot.offset * DIST_STRIDE + i] = stroke.distances[i]!
      this.markDirty(slot.offset, slot.offset + n)
      // Live segments read this stroke's row; the run's tail, the hidden row.
      if (slot.count !== n || slot.points === undefined) {
        this.pointRun(slot.offset, n, slot.row)
        this.pointRun(slot.offset + n, slot.maxSegments - n, 0)
      }
      slot.points = stroke.points
      slot.count = n
    }
    const t = this.shared.array
    const base = slot.row * TABLE_VEC4 * 4
    const e = mv.elements
    for (let i = 0; i < 16; i++) t[base + i] = e[i]!
    t[base + 16] = widthPx
    t[base + 17] = drawn
    t[base + 18] = erased
    t[base + 19] = fade
    t[base + 20] = tintR
    t[base + 21] = tintG
    t[base + 22] = tintB
    this.shared.attr.needsUpdate = true
    return slot
  }

  private markDirty(lo: number, hi: number): void {
    if (lo < this.dirtyLo) this.dirtyLo = lo
    if (hi > this.dirtyHi) this.dirtyHi = hi
  }

  /**
   * Hand this frame's segment changes to the renderer as one range per
   * buffer. Call once after every stroke is written. (Reallocation inside
   * `allocate` uploads whole new buffers anyway.)
   */
  flush(): void {
    if (this.dirtyHi <= this.dirtyLo) return
    const lo = this.dirtyLo
    const n = this.dirtyHi - lo
    this.posBuf.addUpdateRange(lo * POS_STRIDE, n * POS_STRIDE)
    this.posBuf.needsUpdate = true
    this.distBuf.addUpdateRange(lo * DIST_STRIDE, n * DIST_STRIDE)
    this.distBuf.needsUpdate = true
    this.strokeAttr.addUpdateRange(lo, n)
    this.strokeAttr.needsUpdate = true
    this.dirtyLo = Infinity
    this.dirtyHi = -Infinity
  }

  /** Hide a stroke this frame: its row's fade to 0, its segments untouched. */
  hideStroke(slot: BatchSlot): void {
    this.shared.array[slot.row * TABLE_VEC4 * 4 + 19] = 0
    this.shared.attr.needsUpdate = true
  }

  /** The table, for the byte-identity gate to read (instancing-gate.ts). */
  get tableArray(): Float32Array {
    return this.shared.array
  }
}
