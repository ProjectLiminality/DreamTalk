/**
 * The TSL ribbon stroke — DreamTalk's own wide-line pipeline, replacing
 * Line2/Line2NodeMaterial (PLAN Chapter 4). This is TASTE's "SDF as
 * technique" clause #1: analytic anti-aliasing on the stroke body.
 *
 * Geometry: one instanced quad per polyline segment (the proven
 * Line2 buffer layout — interleaved instanceStart/instanceEnd plus
 * cumulative arc-length distances, packed by ribbon-math.ts). The
 * vertex stage projects both segment endpoints, expands the quad in
 * SCREEN PIXELS to width + AA skirt + cap pads (constant pixel width
 * regardless of depth — the 2021 Sketch & Toon look), and hands the
 * fragment stage the segment's screen-space endpoints as per-quad
 * varyings.
 *
 * Fragment: every value the SDF needs is CONSTANT per quad (screen
 * endpoints, arc-length window), so nothing suffers perspective
 * interpolation warp; the fragment computes its own exact pixel
 * distance to the segment capsule from screenCoordinate. Coverage is
 * an analytic smoothstep over an AA_PX band — this replaces MSAA's
 * quantized coverage with the reference's soft falloff, and round
 * caps/joins fall out of the capsule SDF for free.
 *
 * Draw-on: the `drawn` uniform is an arc length; the segment holding
 * the draw front shortens its capsule to it, so the front is a smooth
 * AA'd ROUND cap (pen tip), sub-segment continuous. Segments beyond
 * the front discard; the segment before it paints the shared cap in
 * its overlap pad, so the hand-off is seamless.
 *
 * Erase (the video-01 asymmetry): the `erased` uniform is a second
 * arc length — the consume front. The visible window is
 * [erased, drawn]: Erase advances the tail in draw direction while
 * the drawn front stays, mirroring the pen tip with a round
 * retreating tail. Segments fully consumed discard; erased = 0 is
 * bit-identical to the pre-erase pipeline.
 *
 * Overlap/blending: strokes render with MAX blending (color and
 * alpha). For same-color overlaps — adjacent-segment joins, caps on
 * closed curves, tangencies — max is exactly idempotent: no double
 * brightening, ever, at any opacity. This is the honest union
 * operator for the black-background aesthetic (everything composites
 * on black). Known limit, accepted for now: where DIFFERENT-color
 * strokes cross, max lightens per channel instead of depth
 * compositing (nearer-stroke-wins would need per-stroke coverage
 * passes or depth-aware ordering — future work, see PLAN Ch 4).
 *
 * LESSON (inherited from the dash era, still law): every animated
 * material value flows through TSL nodes, never plain material
 * properties — NodeMaterialObserver does not watch arbitrary props and
 * shares observers across identical materials, so plain props freeze
 * on static objects.
 *
 * ONE material, per-mesh values (perf, 2026-09-06): all ribbon meshes
 * share a single RibbonMaterial whose width/drawn/erased/tint/fade are
 * OBJECT-updated reference nodes reading each mesh's own `userData`.
 * Distinct-but-identical materials were the editor's TheWall boot cost:
 * the WebGPU node cache keys by node IDENTITY (Node.customCacheKey =
 * this.id, r185), so 4,700 structurally identical materials meant 4,700
 * full WGSL NodeBuilder builds deduplicating into 3 programs — ~10 s of
 * a 13.9 s boot. Sharing the material makes it ONE build. Correct by
 * the renderer's own contract: a material carrying nodes always
 * refreshes (NodeMaterialObserver.hasNode), reference nodes are
 * NodeUpdateType.OBJECT (re-read per render object, no per-frame
 * dedupe), and each mesh binds its own cloned uniform buffer, updated
 * and uploaded object-by-object before its draw.
 */

import * as THREE from "three/webgpu"
import * as TSLTyped from "three/tsl"
import type { Color } from "../constants"
import { packSegments, resamplePolyline } from "./ribbon-math"

/**
 * @types/three's TSL typings lag the runtime (mat4 has no .element(),
 * .assign() generics are narrower than the language) — the node graph
 * is instead verified when the shader builds. One local escape hatch;
 * everything the module exports stays fully typed.
 */
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
  modelViewMatrix,
  positionGeometry,
  screenCoordinate,
  screenDPR,
  screenSize,
  smoothstep,
  userData,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL

/**
 * Half-width of the analytic AA band in device pixels: coverage falls
 * from 1 to 0 over [halfWidth − AA_PX, halfWidth + AA_PX].
 *
 * The band is ABSORBED, not added: it straddles the nominal edge rather
 * than sitting outside it, so coverage is exactly 0.5 at d = halfWidth
 * and the skirt's two halves cancel. That is what makes `stroke = N`
 * deposit N pixels of ink — see the width contract on RibbonMaterial.
 * Widening this softens the edge without fattening the line; it only
 * costs the full-brightness core, which vanishes at N <= 2 * AA_PX.
 */
const AA_PX = 1.0

/** Per-quad varyings — constant across the quad (all corners assign the
 *  same value), so interpolation mode is irrelevant and the fragment
 *  stage sees them exactly. */
const vStartPx = varyingProperty("vec2", "dtRibbonStartPx")
const vEndPx = varyingProperty("vec2", "dtRibbonEndPx")
const vDist = varyingProperty("vec2", "dtRibbonDist")

/**
 * The per-mesh value slots the shared RibbonMaterial reads from each
 * stroke mesh's `userData`. RibbonStroke owns every write (style());
 * nothing else should touch them.
 *
 *  - widthPx: stroke width in CSS pixels (holon `stroke` param), as a
 *    DIAMETER — the full width of the line, not a radius.
 *  - drawn: draw front as arc length in the polyline's local units.
 *  - erased: erase (consume) front as arc length — the visible window
 *    is [erased, drawn].
 *  - tint: stroke color (working-space semantics of material.color).
 *  - fade: fade opacity, orthogonal to creation.
 *
 * THE WIDTH CONTRACT, and how to check it. `stroke = N` deposits N
 * pixels of ink: take a cross-section of the rendered line, convert
 * the samples to LINEAR light, and sum them divided by the peak — that
 * area/peak is N, verified to within 0.01px for N in 1..12
 * (core/test/ribbon-width.test.ts pins the same identity on the
 * analytic coverage the shader evaluates).
 *
 * Measure it that way and no other. Half-max width (FWHM) read off
 * sRGB pixels is NOT this number — it runs ~0.7px high here, because
 * sRGB encoding lifts the AA skirt and the half-max crossing of a
 * plateau-plus-skirt profile sits outside the nominal edge. A whole
 * round of "our lines are too fat" was chased on FWHM readings before
 * the linear-light measurement showed the renderer had been exact all
 * along and the error was in the caller's unit mapping
 * (demo/video01/palette.ts, which was missing S&T's 0.6 distance
 * attenuation).
 */
export const RIBBON_KEYS = {
  widthPx: "dtRibbonWidthPx",
  drawn: "dtRibbonDrawn",
  erased: "dtRibbonErased",
  tint: "dtRibbonTint",
  fade: "dtRibbonFade",
} as const

export class RibbonMaterial extends THREE.NodeMaterial {
  constructor() {
    super()
    this.transparent = true
    this.depthWrite = false
    // Screen-space expansion can flip winding with the segment direction.
    this.side = THREE.DoubleSide
    // Max blending: idempotent same-color overlap (see module header).
    this.blending = THREE.CustomBlending
    this.blendEquation = THREE.MaxEquation
    this.blendSrc = THREE.OneFactor
    this.blendDst = THREE.OneFactor
    this.blendEquationAlpha = THREE.MaxEquation
    this.blendSrcAlpha = THREE.OneFactor
    this.blendDstAlpha = THREE.OneFactor

    // Per-mesh values (module header): OBJECT-updated reference nodes
    // into each mesh's userData — one material, every stroke's own data.
    const widthPx = userData(RIBBON_KEYS.widthPx, "float")
    const drawn = userData(RIBBON_KEYS.drawn, "float")
    const erased = userData(RIBBON_KEYS.erased, "float")
    const tint = userData(RIBBON_KEYS.tint, "color")
    const fade = userData(RIBBON_KEYS.fade, "float")

    const halfWidth = () => widthPx.mul(screenDPR).mul(0.5)
    // Quad half-extent beyond the centerline / segment ends: stroke
    // half-width + AA skirt + 1px guard. Also the cap pad, so each
    // quad fully contains its own round caps and its share of joins.
    const pad = () => halfWidth().add(AA_PX).add(1.0)

    this.vertexNode = Fn(() => {
      // corner.x = side (−1 | +1), corner.y = end flag (0 | 1)
      const corner = positionGeometry.xy
      const start = modelViewMatrix.mul(vec4(attribute("instanceStart"), 1.0)).toVar()
      const end = modelViewMatrix.mul(vec4(attribute("instanceEnd"), 1.0)).toVar()
      const distStart = float(attribute("instanceDistanceStart")).toVar()
      const distEnd = float(attribute("instanceDistanceEnd")).toVar()

      // Trim segments crossing the near plane (view-space z: in front
      // is negative) — ported from Line2NodeMaterial, arc-length
      // distances trimmed alongside so draw-on stays true.
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

      // NDC → device pixels, y-down (screenCoordinate convention).
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

      const delta = endPx.sub(startPx)
      const lenPx = length(delta)
      // Degenerate (sub-pixel / zero-length) segments keep a valid frame.
      const dir = lenPx.greaterThan(1e-6).select(delta.div(max(lenPx, 1e-6)), vec2(1.0, 0.0))
      const perp = vec2(dir.y.negate(), dir.x)

      const p = pad()
      const along = mix(p.negate(), lenPx.add(p), corner.y)
      const targetPx = startPx.add(dir.mul(along)).add(perp.mul(corner.x.mul(p)))

      // Back to clip space at the nearer endpoint's depth/w.
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

      // Arc length → pixels along this segment.
      const distStart = vDist.x
      const distEnd = vDist.y
      const pxPerUnit = lenPx.div(max(distEnd.sub(distStart), 1e-7))
      const uFront = drawn.sub(distStart).mul(pxPerUnit).toVar()
      // Front lies before this segment: the previous segment owns the
      // cap (its forward pad covers it) — draw nothing here.
      uFront.lessThan(0.0).discard()

      // Erase front: segments fully consumed draw nothing; the segment
      // holding it starts its capsule there — a round retreating tail.
      const uTail = erased.sub(distStart).mul(pxPerUnit).toVar()
      uTail.greaterThan(lenPx).discard()

      // Capsule over the visible window [max(0, erase front),
      // min(segment end, draw front)]: round caps at both ends, a
      // round pen tip at the draw front, a round tail at the erase
      // front. (While the mesh is visible the window is non-inverted;
      // the max() guard only shields the degenerate hidden case.)
      const uBegin = max(uTail, 0.0)
      const uEnd = max(min(lenPx, uFront), uBegin)
      const d = length(vec2(u.sub(clamp(u, uBegin, uEnd)), v))

      const hw = halfWidth()
      const coverage = smoothstep(hw.sub(AA_PX), hw.add(AA_PX), d).oneMinus()
      const a = coverage.mul(fade)
      // Premultiplied on black — max-blended (see module header).
      return vec4(vec3(tint).mul(a), a)
    })()
  }
}

/** The one ribbon material every stroke shares (module header: ONE
 *  material, per-mesh values). Lazy so importing this module stays
 *  side-effect free. */
let shared: RibbonMaterial | undefined
export const sharedRibbonMaterial = (): RibbonMaterial => (shared ??= new RibbonMaterial())

/**
 * A stroke mesh whose polyline can be rewritten per frame — the one
 * mechanism behind every stroke: static primitives (rewritten only
 * when their shape params change) and view-dependent strokes (the
 * cylinder's silhouette generators, rewritten every frame).
 *
 * Update cost: an unchanged segment count writes the interleaved
 * buffers in place (8 floats/segment) and re-uploads; a changed count
 * allocates fresh buffers. Never frustum-culled (no bounding volume
 * upkeep on the fast path).
 */
export class RibbonStroke {
  readonly mesh: THREE.Mesh
  readonly material: RibbonMaterial
  readonly geometry: THREE.InstancedBufferGeometry
  totalLength = 0
  /**
   * Target sample count for a polyline — how finely it is resampled
   * before anything measures it, or DRAWS it, in SCREEN space.
   *
   * 128 is not tuned to a frame: it is where the piecewise-linear
   * measurement of a projected line stops moving. Doubling it to 256
   * changes S01's measured y-axis screen length by under 0.05px, i.e.
   * below the AA floor, while 16 is visibly short on the steepest
   * recession in the corpus.
   */
  static readonly SUBDIVISION = 128
  /**
   * The polyline as last set, in the mesh's local space, ALREADY
   * subdivided (`resample`) — one array, used both for the instance
   * buffers and by every screen-space measurement.
   *
   * The subdivision has to reach the GEOMETRY, not just the measurement,
   * for the same reason the measurement needed it: the fragment stage
   * converts arc length to pixels with `pxPerUnit = lenPx / (distEnd -
   * distStart)`, i.e. LINEARLY within a segment. That identity holds
   * only where the segment's foreshortening is uniform. On a two-point
   * Line that recedes — S08's axis arms run world x = -500 → 2100 with
   * the far end at the vanishing point — it is off by the whole
   * perspective: the host correctly placed the pen at world x ≈ +8 (the
   * origin, where the reference's four arrowheads sit at f0608) and the
   * shader painted ink only 19.5% of the way along the SCREEN chord,
   * because 508/2600 of the arc length was read as 508/2600 of the
   * pixels. Splitting the segment makes each piece's foreshortening
   * locally uniform and the same linear identity locally true.
   */
  private points: THREE.Vector3[] = []
  /**
   * Segments the instance buffers can currently hold.
   *
   * The buffers are allocated by CAPACITY, not by the exact segment
   * count, and only `instanceCount` varies frame to frame. That is not
   * an optimization: a polyline whose length changes every frame — the
   * cylinder–plane section sweeping through its own cases, which goes
   * 0 → 97 → 21 → 57 points as the cut turns — silently stopped
   * rendering when each new count replaced the geometry's attributes,
   * because the WebGPU backend binds a pipeline to the attribute
   * objects it first saw. Keeping the same buffer objects for the
   * mesh's whole life keeps that binding valid.
   */
  private capacity = 0

  /** (Re)allocate the instance buffers to hold `segments` segments. */
  private allocate(segments: number): void {
    this.capacity = Math.max(1, segments)
    const posBuf = new THREE.InstancedInterleavedBuffer(new Float32Array(this.capacity * 6), 6, 1)
    this.geometry.setAttribute("instanceStart", new THREE.InterleavedBufferAttribute(posBuf, 3, 0))
    this.geometry.setAttribute("instanceEnd", new THREE.InterleavedBufferAttribute(posBuf, 3, 3))
    const distBuf = new THREE.InstancedInterleavedBuffer(new Float32Array(this.capacity * 2), 2, 1)
    this.geometry.setAttribute(
      "instanceDistanceStart",
      new THREE.InterleavedBufferAttribute(distBuf, 1, 0),
    )
    this.geometry.setAttribute(
      "instanceDistanceEnd",
      new THREE.InterleavedBufferAttribute(distBuf, 1, 1),
    )
  }

  constructor(widthPx: number) {
    this.material = sharedRibbonMaterial()
    this.geometry = new THREE.InstancedBufferGeometry()
    // The unit quad: x = side, y = end flag; expanded entirely in-shader.
    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3),
    )
    this.geometry.setIndex([0, 2, 1, 2, 3, 1])
    // The instance attributes exist from birth, even for a stroke whose
    // polyline is still empty. A geometry that reaches the WebGPU
    // backend without them is compiled into a pipeline that has no
    // instance bindings, and attributes added afterwards are never seen —
    // which is exactly how a derived curve that starts empty stayed
    // invisible for its whole life (Scene03's section, verified).
    this.allocate(1)
    this.geometry.instanceCount = 0
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.frustumCulled = false
    // Invisible until the first style() — and never rendered before
    // setPoints() has populated the instance buffers.
    this.mesh.visible = false
    const ud = this.mesh.userData
    ud[RIBBON_KEYS.widthPx] = widthPx
    ud[RIBBON_KEYS.drawn] = 0
    ud[RIBBON_KEYS.erased] = 0
    ud[RIBBON_KEYS.tint] = new THREE.Color(1, 1, 1)
    ud[RIBBON_KEYS.fade] = 1
  }

  /** Draw front as arc length — this stroke's own styled value. */
  get drawnLength(): number {
    return this.mesh.userData[RIBBON_KEYS.drawn] as number
  }

  /** Erase front as arc length — this stroke's own styled value. */
  get erasedLength(): number {
    return this.mesh.userData[RIBBON_KEYS.erased] as number
  }

  setPoints(pts: readonly THREE.Vector3[]): void {
    this.points = resamplePolyline(
      pts,
      RibbonStroke.SUBDIVISION,
      (x, y, z) => new THREE.Vector3(x, y, z),
    )
    const packed = packSegments(this.points)
    if (packed.count < 1) {
      // A stroke whose polyline is DERIVED can legitimately become empty
      // and non-empty again over t — Scene03's section curve is empty
      // whenever the cutting plane misses the cylinder. Emptying the
      // instance buffer is what makes that frame draw nothing, instead
      // of leaving the last computed curve hanging in the air.
      this.geometry.instanceCount = 0
      this.totalLength = 0
      return
    }
    this.totalLength = packed.totalLength

    // Grow only — a shrink just draws fewer instances. Round up to a
    // power of two so a curve that breathes in size reallocates a handful
    // of times at most, not once per frame.
    if (packed.count > this.capacity) this.allocate(1 << Math.ceil(Math.log2(packed.count)))
    const start = this.geometry.getAttribute("instanceStart") as THREE.InterleavedBufferAttribute
    ;(start.data.array as Float32Array).set(packed.positions)
    start.data.needsUpdate = true
    const dist = this.geometry.getAttribute(
      "instanceDistanceStart",
    ) as THREE.InterleavedBufferAttribute
    ;(dist.data.array as Float32Array).set(packed.distances)
    dist.data.needsUpdate = true
    this.geometry.instanceCount = packed.count
  }

  /**
   * The polyline in the mesh's LOCAL space — the same subdivided array
   * the instance buffers were packed from, so a screen-space
   * measurement and the ink it is measuring can never disagree.
   */
  worldPoints(): readonly THREE.Vector3[] {
    return this.points
  }

  /** Sync visibility/draw fraction/erase fraction/style from the owning holon. */
  style(
    fraction: number,
    opacity: number,
    tint: Color,
    widthPx: number,
    erasedFraction = 0,
  ): void {
    const ud = this.mesh.userData
    ud[RIBBON_KEYS.drawn] = fraction * this.totalLength
    ud[RIBBON_KEYS.erased] = erasedFraction * this.totalLength
    this.mesh.visible = fraction > erasedFraction && opacity > 0
    ud[RIBBON_KEYS.fade] = opacity
    ;(ud[RIBBON_KEYS.tint] as THREE.Color).setRGB(tint.r, tint.g, tint.b)
    ud[RIBBON_KEYS.widthPx] = widthPx
  }
}
