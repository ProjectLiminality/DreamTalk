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
 *   modelViewMatrix · instanceStart      instanceStart, ALREADY view-space
 *   modelViewMatrix · instanceEnd        instanceEnd,   ALREADY view-space
 *   userData.widthPx  (per mesh)         instanceWidthPx (per segment)
 *   userData.drawn                       instanceDrawn
 *   userData.erased                      instanceErased
 *   userData.tint                        instanceTint (vec3)
 *   userData.fade                        instanceFade
 *
 * WHY VIEW-SPACE, NOT WORLD (the transform crux, Option 1 done exactly).
 * The per-mesh shader's first act is `modelViewMatrix · local`, giving a
 * VIEW-space endpoint — and every line after it (near-plane trim on
 * view-space z, projection, NDC, pixel math) is a pure function of that
 * view-space point. So if the batch stores the endpoints ALREADY in view
 * space, the shader math from the near-trim onward is CHARACTER-FOR-
 * CHARACTER the per-mesh shader.
 *
 * The design's precision caveat is about baking WORLD positions —
 * `viewMatrix·(worldMatrix·local)` with the inner product split across
 * CPU (f64) and GPU (f32) can differ in the last ulp from the per-mesh
 * `(view·world)·local` composed as one f32 mat4. We sidestep it by
 * composing `mv = matrixWorldInverse · matrixWorld` EXACTLY as three does
 * (Matrix4.multiplyMatrices — that is literally three's own line,
 * ModelNode.js:155) and baking `mv · local`. The per-mesh path then does
 * the identical multiply, only on the GPU: three uploads that same `mv`
 * as a uniform and the shader computes `mv · local`. The only residual
 * difference is CPU-f64 `mv·local` then f32-store vs GPU-f32 `mv·local` —
 * the same ONE multiply either way, which the byte-identity gate
 * measures (instancing-result.md). If it drifts, `Math.fround` on the
 * baked components collapses the store-precision gap; measurement first.
 *
 * HIDING A SEGMENT. A batch draws all `instanceCount` instances every
 * frame; there is no per-instance skip. A slot that must draw nothing
 * (a hidden stroke, an unused over-allocated tail) sets instanceFade = 0,
 * so the fragment stage returns vec4(0,0,0,0). Under MAX blending a
 * zero-alpha, zero-color contribution changes no channel — it is a true
 * no-op, byte-exact, the same as if the instance were not submitted.
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
  constructor() {
    super()
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

    // Per-instance style, in place of RibbonMaterial's userData nodes.
    const widthPx = float(attribute("instanceWidthPx"))
    const drawn = float(attribute("instanceDrawn"))
    const erased = float(attribute("instanceErased"))
    const tint = vec3(attribute("instanceTint"))
    const fade = float(attribute("instanceFade"))

    const halfWidth = (w: ReturnType<typeof float>) => w.mul(screenDPR).mul(0.5)
    // pad(): stroke half-width + AA skirt + 1px guard — ribbon.ts's pad().
    const pad = (w: ReturnType<typeof float>) => halfWidth(w).add(AA_PX).add(1.0)

    this.vertexNode = Fn(() => {
      const corner = attribute("position").xy
      // ALREADY view-space (baked mv·local at pack time) — the per-mesh
      // shader's `modelViewMatrix · local` is exactly this, done on CPU.
      const start = vec4(vec3(attribute("instanceStart")), 1.0).toVar()
      const end = vec4(vec3(attribute("instanceEnd")), 1.0).toVar()
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

/** The one batch material every RibbonBatch shares. Lazy — importing this
 *  module stays side-effect free (like sharedRibbonMaterial). */
let shared: RibbonBatchMaterial | undefined
export const sharedRibbonBatchMaterial = (): RibbonBatchMaterial =>
  (shared ??= new RibbonBatchMaterial())

/** Floats per segment in the interleaved position buffer: start xyz + end xyz. */
const POS_STRIDE = 6
/** Floats per segment in the interleaved distance buffer: start + end. */
const DIST_STRIDE = 2

/**
 * A stroke's reservation inside a batch: a contiguous run of instance
 * slots. `maxSegments` is the slot's capacity (over-allocated so a stroke
 * whose segment count breathes — the section curve — never has to move);
 * `count` is how many are live this frame. Slots [count, maxSegments) are
 * kept hidden (fade 0) so they draw nothing.
 */
export interface BatchSlot {
  offset: number
  maxSegments: number
  count: number
}

/**
 * One InstancedBufferGeometry holding many strokes' segments, drawn once.
 *
 * Layout mirrors RibbonStroke's per-mesh geometry exactly (the same unit
 * quad + index shared across instances, the same interleaved position and
 * distance buffers) plus the per-instance style attributes. Strokes claim
 * contiguous slices via `reserve`; each frame the host writes a stroke's
 * baked view-space segments and style into its slice with `writeSlot` and
 * hides it with `hideSlot`.
 */
export class RibbonBatch {
  readonly mesh: THREE.Mesh
  readonly material: RibbonBatchMaterial
  readonly geometry: THREE.InstancedBufferGeometry
  /** High-water mark of reserved slots — the buffers' capacity in segments. */
  private capacity = 0
  /** Next free offset when reserving; slots are never freed individually,
   *  they are hidden (this matches the corpus: strokes join at attach and
   *  stay for the scene's life). */
  private cursor = 0

  private posBuf!: THREE.InstancedInterleavedBuffer
  private distBuf!: THREE.InstancedInterleavedBuffer
  private widthAttr!: THREE.InstancedBufferAttribute
  private drawnAttr!: THREE.InstancedBufferAttribute
  private erasedAttr!: THREE.InstancedBufferAttribute
  private fadeAttr!: THREE.InstancedBufferAttribute
  private tintAttr!: THREE.InstancedBufferAttribute

  constructor(initialCapacity = 256) {
    this.material = sharedRibbonBatchMaterial()
    this.geometry = new THREE.InstancedBufferGeometry()
    // The unit quad, shared by every instance — identical to RibbonStroke.
    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3),
    )
    this.geometry.setIndex([0, 2, 1, 2, 3, 1])
    this.allocate(Math.max(1, initialCapacity))
    this.geometry.instanceCount = 0
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.frustumCulled = false
    this.mesh.visible = false
  }

  /** (Re)allocate the interleaved + per-instance buffers to `segments`
   *  capacity, preserving existing data. */
  private allocate(segments: number): void {
    const old = this.capacity
    const cap = Math.max(1, segments)
    const pos = new Float32Array(cap * POS_STRIDE)
    const dist = new Float32Array(cap * DIST_STRIDE)
    const width = new Float32Array(cap)
    const drawn = new Float32Array(cap)
    const erased = new Float32Array(cap)
    const fade = new Float32Array(cap)
    const tint = new Float32Array(cap * 3)
    if (old > 0) {
      pos.set(this.posBuf.array as Float32Array)
      dist.set(this.distBuf.array as Float32Array)
      width.set(this.widthAttr.array as Float32Array)
      drawn.set(this.drawnAttr.array as Float32Array)
      erased.set(this.erasedAttr.array as Float32Array)
      fade.set(this.fadeAttr.array as Float32Array)
      tint.set(this.tintAttr.array as Float32Array)
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
    this.widthAttr = new THREE.InstancedBufferAttribute(width, 1)
    this.drawnAttr = new THREE.InstancedBufferAttribute(drawn, 1)
    this.erasedAttr = new THREE.InstancedBufferAttribute(erased, 1)
    this.fadeAttr = new THREE.InstancedBufferAttribute(fade, 1)
    this.tintAttr = new THREE.InstancedBufferAttribute(tint, 3)
    this.geometry.setAttribute("instanceWidthPx", this.widthAttr)
    this.geometry.setAttribute("instanceDrawn", this.drawnAttr)
    this.geometry.setAttribute("instanceErased", this.erasedAttr)
    this.geometry.setAttribute("instanceFade", this.fadeAttr)
    this.geometry.setAttribute("instanceTint", this.tintAttr)
    this.capacity = cap
  }

  /**
   * Reserve a contiguous slot of `maxSegments` for a stroke, growing the
   * buffers if needed. Returns the slot; the stroke keeps it for life.
   */
  reserve(maxSegments: number): BatchSlot {
    const cap = Math.max(1, maxSegments)
    const offset = this.cursor
    this.cursor += cap
    if (this.cursor > this.capacity) {
      // Grow generously (double past the need) so a burst of reservations
      // at attach does not reallocate once per stroke.
      this.allocate(1 << Math.ceil(Math.log2(this.cursor)))
    }
    // A fresh slot starts hidden (fade 0) so unwritten tails draw nothing.
    for (let i = offset; i < offset + cap; i++) this.fadeAttr.array[i] = 0
    this.fadeAttr.needsUpdate = true
    if (offset + cap > this.geometry.instanceCount) this.geometry.instanceCount = offset + cap
    this.mesh.visible = this.geometry.instanceCount > 0
    return { offset, maxSegments: cap, count: 0 }
  }

  /**
   * Grow a slot that has outgrown its reservation by RELOCATING it to a
   * fresh, larger run at the end of the buffers (the old run is hidden and
   * abandoned — a small permanent gap). Breathing strokes (the section
   * curve) are few and settle, so relocation is rare; correctness first.
   * Returns the new slot; the caller must adopt it.
   */
  private relocate(slot: BatchSlot, needSegments: number): BatchSlot {
    // Hide the abandoned run so its stale segments draw nothing.
    for (let i = 0; i < slot.maxSegments; i++) this.fadeAttr.array[slot.offset + i] = 0
    this.fadeAttr.needsUpdate = true
    // Round up so a breathing stroke does not relocate every frame.
    return this.reserve(1 << Math.ceil(Math.log2(Math.max(2, needSegments))))
  }

  /**
   * Write a stroke's live segments into its slot: baked VIEW-space
   * endpoints + arc-length distances and its per-segment style. Any slot
   * instances past `count` are hidden (fade 0). If `count` exceeds the
   * slot's capacity the slot is relocated to a larger run and the NEW slot
   * is returned; the caller MUST adopt the returned slot (it may differ).
   */
  writeSlot(
    slot: BatchSlot,
    positions: Float32Array,
    distances: Float32Array,
    count: number,
    widthPx: number,
    drawn: number,
    erased: number,
    tintR: number,
    tintG: number,
    tintB: number,
    fade: number,
  ): BatchSlot {
    if (count > slot.maxSegments) slot = this.relocate(slot, count)
    const n = Math.min(count, slot.maxSegments)
    const posArr = this.posBuf.array as Float32Array
    const distArr = this.distBuf.array as Float32Array
    posArr.set(positions.subarray(0, n * POS_STRIDE), slot.offset * POS_STRIDE)
    distArr.set(distances.subarray(0, n * DIST_STRIDE), slot.offset * DIST_STRIDE)
    for (let i = 0; i < n; i++) {
      const s = slot.offset + i
      this.widthAttr.array[s] = widthPx
      this.drawnAttr.array[s] = drawn
      this.erasedAttr.array[s] = erased
      this.tintAttr.array[s * 3] = tintR
      this.tintAttr.array[s * 3 + 1] = tintG
      this.tintAttr.array[s * 3 + 2] = tintB
      this.fadeAttr.array[s] = fade
    }
    // Hide the unused tail of the slot (segment count shrank, or a slot
    // over-allocated for its max) — fade 0 draws nothing.
    for (let i = n; i < slot.maxSegments; i++) this.fadeAttr.array[slot.offset + i] = 0
    slot.count = n
    this.markDirty()
    return slot
  }

  /** Hide a whole slot (a stroke gone invisible / empty this frame). */
  hideSlot(slot: BatchSlot): void {
    if (slot.count === 0) return
    for (let i = 0; i < slot.maxSegments; i++) this.fadeAttr.array[slot.offset + i] = 0
    slot.count = 0
    this.fadeAttr.needsUpdate = true
  }

  private markDirty(): void {
    this.posBuf.needsUpdate = true
    this.distBuf.needsUpdate = true
    this.widthAttr.needsUpdate = true
    this.drawnAttr.needsUpdate = true
    this.erasedAttr.needsUpdate = true
    this.fadeAttr.needsUpdate = true
    this.tintAttr.needsUpdate = true
  }
}
