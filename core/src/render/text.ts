/**
 * The TSL glyph pipeline — `three-text` 0.6.5 glyph geometry rendered
 * through our own TSL node material.
 *
 * WHY NOT TROIKA (the TASTE-preferred option (a), attempted first and
 * abandoned under the three-strikes rule — 2026-08-23):
 * troika's layout core is indeed renderer-agnostic, and a TSL material
 * decoding its SDF atlas WORKS for glyphs already resident in the
 * atlas. What does not work is the atlas TEXTURE under WebGPU. troika
 * rasterizes glyph SDFs onto a hidden **WebGL** canvas and hands it
 * over as a THREE.Texture; the glyphs rasterized in the most recent
 * batch are never visible to a WebGPU sampler. Reproduced exactly:
 * with three texts on screen, the glyphs unique to the last one
 * ("y" alone, then "y", "q", "z" together) rendered permanently blank
 * while `readPixels` on troika's own canvas showed them present.
 * Four independent fixes all failed, and all failed identically:
 *   1. `sdfTexture.needsUpdate = true` every frame, hundreds of frames;
 *   2. a 2D-canvas mirror blitted from troika's canvas via drawImage
 *      (the blit itself came back empty — getImageData all zeros);
 *   3. a brand-new, never-uploaded THREE.Texture around the same
 *      canvas after every layout;
 *   4. preloading every glyph up front, plus a settle delay and a
 *      no-new-glyph layout to push the real glyphs out of the last
 *      batch.
 * The failure follows the atlas INDEX, never the character — always
 * exactly the highest-index (most recently rasterized) glyphs.
 * ANALYSIS.md's recorded fallback (b) is therefore in force.
 *
 * WHAT THREE-TEXT GIVES US instead: real triangulated glyph geometry
 * (HarfBuzz shaping + contour triangulation) and NO atlas at all — so
 * the entire class of texture-upload failure disappears. It also fits
 * the rest of the renderer better than an SDF ever did: our fills are
 * already triangulated (fill.ts), and `perGlyphAttributes` hands us a
 * per-vertex `glyphIndex`, which is exactly the hook the Write domino
 * needs.
 *
 * AA and the stroke family: with real geometry there is no distance
 * field to smoothstep, so coverage comes from the renderer's MSAA
 * (the host already builds its WebGPURenderer with `antialias: true`)
 * rather than the ribbon's analytic ±1px band. Glyph edges and stroke
 * edges therefore reach the same visual weight by different routes —
 * verified side by side in demo/text-harness (glyph stems and ribbon
 * rules of equal width read as one family). The one honest difference
 * from ribbon.ts is recorded here rather than hidden.
 *
 * Write choreography (parts/text.ts): each vertex carries its glyph's
 * static domino window, derived on the CPU from `glyphIndex`; ONE
 * `progress` uniform (the holon's `creation`) drives the per-letter
 * cascade entirely in-shader — a handful of uniforms per frame.
 *
 * A LETTER IS TWO THINGS, not one (S07, 2026-08-23). The 2021 pipeline
 * wraps every letter as a Spline with `thickness = 5` and
 * `clipping = "inside"` (scene/scene.py:462-463), then runs
 * DrawThenFillCompletely over it: the pen TRACES the letterform first
 * and the solid arrives after. So this module renders each Text twice
 * over —
 *   • the SOLID, this file's glyph mesh, whose alpha is the fill phase;
 *   • the TRACE, one RibbonStroke per boundary loop per glyph, recovered
 *     from the triangulation by parts/outline.ts and inset by half a
 *     stroke so the inside-clipping is honoured, whose drawn fraction is
 *     the draw phase.
 * The first attempt stood a left-to-right WIPE of the solid in for the
 * trace, and it read wrong wherever a letter was mid-draw: the reference
 * shows the whole letterform, thinly (f0577's `t` is a hook of outline,
 * f0591's `a` a bare ring), while a wipe shows the left of it, solidly.
 * Real strokes moved coverage_ref on those frames from 0.53 to 0.98.
 *
 * LESSON (ribbon.ts, still law): every animated material value is a
 * TSL uniform node, never a plain material property.
 */

import * as THREE from "three/webgpu"
import { uniform } from "three/tsl"
import * as TSLTyped from "three/tsl"
import { Text as ThreeText } from "three-text"
import type { Color } from "../constants"
import { Text, writeWindows, writePhases, DRAW_WINDOW, FILL_WINDOW } from "../parts/text"
import { boundaryLoops, closeLoop, insetLoop } from "../parts/outline"
import type { Vec3Like } from "../parts/index"
import { RibbonStroke } from "./ribbon"

/**
 * Same escape hatch as ribbon.ts: @types/three's TSL typings lag the
 * runtime; the node graph is verified when the shader builds. One local
 * `any`; the material's public uniforms stay fully typed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TSL = TSLTyped as any
const {
  Fn,
  attribute,
  cameraProjectionMatrix,
  clamp,
  float,
  max,
  min,
  mix,
  modelViewMatrix,
  positionGeometry,
  smoothstep,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL

/**
 * The bundled default font: Arimo Regular (Apache 2.0) — metric-
 * compatible with Arial, i.e. the Helvetica-class look of the C4D
 * default in video-01. Committed at this repo path and served by
 * scripts/serve.ts; override per-holon via `Text.font`. The font
 * question stays open in the vocabulary report's Risks (#3) — swapping
 * the file or this URL retunes every Text at once.
 */
export const DEFAULT_FONT_URL = "/core/demo/fonts/Arimo-Regular.ttf"

/**
 * three-text shapes text with HarfBuzz compiled to WASM, and the binary
 * has to be reachable before the first layout. It is vendored into the
 * repo (from the `harfbuzzjs` dependency) and served by scripts/serve.ts
 * — never fetched from a CDN, for the same reason the font is not:
 * network dependency and non-determinism.
 *
 * Call `configureTextEngine({ harfBuzzUrl })` before mounting if a host
 * serves it from elsewhere.
 */
export const DEFAULT_HARFBUZZ_URL = "/core/demo/wasm/hb.wasm"

/**
 * The projection scale a Text assumes when nobody tells it one: the
 * 2021 rig's 1.28 screen pixels per world unit (dream.ts — C4D's factory
 * 36mm lens at its 1000-unit distance, which is what every video-01
 * scene is framed on). Only the contour inset reads it.
 */
export const DEFAULT_PIXELS_PER_UNIT = 1.28


let harfBuzzUrl = DEFAULT_HARFBUZZ_URL
let harfBuzzConfigured = false

/** Point the text engine at a different HarfBuzz WASM build. */
export const configureTextEngine = (opts: { harfBuzzUrl?: string }): void => {
  if (opts.harfBuzzUrl !== undefined && opts.harfBuzzUrl !== harfBuzzUrl) {
    harfBuzzUrl = opts.harfBuzzUrl
    harfBuzzConfigured = false
  }
}

/** Idempotent: three-text keeps one global HarfBuzz instance. */
const ensureHarfBuzz = (): void => {
  if (harfBuzzConfigured) return
  ThreeText.setHarfBuzzPath(harfBuzzUrl)
  harfBuzzConfigured = true
}

/** Per-vertex varyings — the glyph's own place in the cascade. */
const vWindow = varyingProperty("vec2", "dtGlyphWindow")
/**
 * Position across the glyph's own width, 0 at its left edge and 1 at
 * its right. The solid no longer wipes (the trace does the drawing), so
 * nothing reads this today; it is kept because it is the natural hook
 * for any per-letter effect that wants a direction, and because
 * addWriteAttributes fills it for free from data it already walks.
 */
const vGlyphU = varyingProperty("float", "dtGlyphU")

export class TextGlyphMaterial extends THREE.NodeMaterial {
  /** The write front — the owning holon's `creation` (0 → 1). */
  readonly progress = uniform(1)
  /**
   * The UN-write front — the owning holon's `erasure` (0 → 1).
   *
   * UnWrite is NOT the time-reverse of Write. pydeation runs it as its
   * own Domino over the SAME letter order (animator.py: UnWrite =
   * Domino(UnFillThenUnDraw)), so the reference erases "anti-thesis"
   * left to right, first letter first — running `creation` backwards
   * would eat it right to left instead (verified against f0727-f0733).
   * A second front through the same windows is what keeps the cascade
   * pointing the same way while each letter's own phases run backwards.
   */
  readonly erasure = uniform(0)
  /** Fade opacity, orthogonal to creation. */
  readonly fade = uniform(1)
  /** Glyph color (same working-space semantics as the ribbon tint). */
  readonly tint = uniform(new THREE.Color(1, 1, 1))

  constructor() {
    super()
    this.transparent = true
    this.depthWrite = false
    // Glyph contours are triangulated without a winding guarantee
    // across holes and counters — never cull.
    this.side = THREE.DoubleSide
    // Max blending — the strokes' honest union operator (ribbon.ts).
    // Overlapping glyph triangles stay idempotent at partial strength.
    this.blending = THREE.CustomBlending
    this.blendEquation = THREE.MaxEquation
    this.blendSrc = THREE.OneFactor
    this.blendDst = THREE.OneFactor
    this.blendEquationAlpha = THREE.MaxEquation
    this.blendSrcAlpha = THREE.OneFactor
    this.blendDstAlpha = THREE.OneFactor

    this.vertexNode = Fn(() => {
      vWindow.assign(vec2(attribute("glyphWindow")))
      vGlyphU.assign(float(attribute("glyphU")))
      return cameraProjectionMatrix.mul(modelViewMatrix.mul(vec4(positionGeometry, 1.0)))
    })()

    this.fragmentNode = Fn(() => {
      // This letter's place under the write front: its domino window →
      // draw (the traced contour, which is real stroke geometry — see
      // the module header) then fill (this mesh). Re-derives
      // parts/text.ts writePhases() in-shader — the tests pin the CPU
      // side, and the two must agree.
      const win = vec2(vWindow)
      const span = max(win.y.sub(win.x), 1e-6)
      // TWO fronts through the SAME windows, in the same direction: the
      // write front raises this letter's phase through draw-then-fill,
      // and the un-write front — a second forward domino, not a reversed
      // one — lowers it back down through fill-then-draw. min() is the
      // composition: a letter is as written as the write front has made
      // it and as un-written as the erase front has since taken back,
      // which is exactly UnFillThenUnDraw over the original letter order
      // (see Text.erasure). Re-derives parts/text.ts writePhases()
      // in-shader — the tests pin the CPU side, and the two must agree.
      const pWrite = clamp(this.progress.sub(win.x).div(span), 0.0, 1.0)
      const pErase = clamp(this.erasure.sub(win.x).div(span), 0.0, 1.0)
      const p = min(pWrite, pErase.oneMinus()).toVar()
      const drawP = clamp(
        p.sub(DRAW_WINDOW[0]).div(DRAW_WINDOW[1] - DRAW_WINDOW[0]),
        0.0,
        1.0,
      )
      const fillP = clamp(
        p.sub(FILL_WINDOW[0]).div(FILL_WINDOW[1] - FILL_WINDOW[0]),
        0.0,
        1.0,
      )

      // This mesh is the letter's SOLID only. The draw phase — the pen
      // tracing the letterform — is real stroke geometry now (the
      // contour ribbons this binding builds from the triangulation's
      // boundary, parts/outline.ts), because that is what the reference
      // shows: at refs/video-01/frames5/f0577 the first `t` is a hook of
      // outline with nothing filled in, and at f0591 the last `a` is a
      // bare ring. A left-to-right wipe of the solid stood in for that
      // and cost ~18 points of coverage on exactly the frames where a
      // letter is mid-draw; a wipe reveals the left of a letter while
      // the reference has drawn the whole of it, thinly.
      //
      // So the solid does one thing: fade in over the fill phase, at
      // full strength, everywhere at once. `drawP` still matters here —
      // it gates the fade to zero before the outline has closed, which
      // costs nothing while FILL_WINDOW starts after DRAW_WINDOW ends
      // but keeps the two honest if that ever changes.
      const a = fillP.mul(smoothstep(0.0, 0.001, drawP)).mul(this.fade)
      // Premultiplied on black — max-blended (see module header).
      return vec4(vec3(this.tint).mul(a), a)
    })()
  }
}

/**
 * Attach the per-glyph Write data to a three-text geometry.
 *
 * three-text gives every vertex a `glyphIndex` (which letter it belongs
 * to) when `perGlyphAttributes` is on. From that we derive, per vertex:
 *   • `glyphWindow` — that letter's domino window (the cascade timing),
 *   • `glyphU`      — its position across its own glyph's width, left
 *                     edge to right (see vGlyphU).
 * Both are static for the life of the geometry: the whole animation is
 * the single `progress` uniform moving through them.
 *
 * Returns the glyph count the cascade was dealt for.
 */
export const addWriteAttributes = (geometry: THREE.BufferGeometry): number => {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute
  const count = position.count
  const windows = new Float32Array(count * 2)
  const us = new Float32Array(count)
  const indexAttr = geometry.getAttribute("glyphIndex") as
    | THREE.BufferAttribute
    | undefined

  if (!indexAttr) {
    // No per-glyph data (should not happen with perGlyphAttributes on):
    // the whole block writes as one letter rather than failing.
    const single = writeWindows(1)[0] ?? [0, 1]
    for (let i = 0; i < count; i++) {
      windows[i * 2] = single[0]
      windows[i * 2 + 1] = single[1]
      us[i] = 0.5
    }
    geometry.setAttribute("glyphWindow", new THREE.BufferAttribute(windows, 2))
    geometry.setAttribute("glyphU", new THREE.BufferAttribute(us, 1))
    return 1
  }

  // How many distinct glyphs, and each glyph's x-extent (for glyphU).
  let glyphCount = 0
  for (let i = 0; i < count; i++) {
    const g = indexAttr.getX(i)
    if (g + 1 > glyphCount) glyphCount = g + 1
  }
  const minX = new Float32Array(glyphCount).fill(Infinity)
  const maxX = new Float32Array(glyphCount).fill(-Infinity)
  for (let i = 0; i < count; i++) {
    const g = indexAttr.getX(i)
    const x = position.getX(i)
    if (x < minX[g]!) minX[g] = x
    if (x > maxX[g]!) maxX[g] = x
  }

  const glyphWindows = writeWindows(glyphCount)
  for (let i = 0; i < count; i++) {
    const g = indexAttr.getX(i)
    const w = glyphWindows[g] ?? [0, 1]
    windows[i * 2] = w[0]
    windows[i * 2 + 1] = w[1]
    const span = maxX[g]! - minX[g]!
    us[i] = span > 1e-6 ? (position.getX(i) - minX[g]!) / span : 0.5
  }
  geometry.setAttribute("glyphWindow", new THREE.BufferAttribute(windows, 2))
  geometry.setAttribute("glyphU", new THREE.BufferAttribute(us, 1))
  return glyphCount
}

/**
 * One glyph's traced outline: the boundary loops of its own triangles,
 * as ribbon strokes, plus where each loop sits in the letter's own
 * draw phase.
 *
 * The 2021 pen draws a letter contour by contour ("stroke_method
 * single"), so the loops share the letter's draw phase in sequence,
 * proportioned by arc length — a big silhouette takes most of the
 * phase and a small counter the rest, which is what the reference
 * shows for `a`, `e`, `p`.
 */
interface GlyphOutline {
  /** The letter's domino window within `creation` / `erasure`. */
  window: [number, number]
  loops: {
    ribbon: RibbonStroke
    /** This loop's slice of the letter's draw phase, by arc length. */
    from: number
    to: number
  }[]
}

/** Arc length of a closed ring (its points, first not repeated). */
const loopLength = (loop: readonly Vec3Like[]): number => {
  let total = 0
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!
    const b = loop[(i + 1) % loop.length]!
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
  }
  return total
}

/**
 * Build the contour strokes for a laid-out text geometry: one stroke
 * per boundary loop per glyph, in glyph order.
 *
 * The triangle→glyph map comes from the `glyphIndex` attribute the
 * layout already carries (all three corners of a triangle belong to one
 * glyph), and the per-glyph filter is what keeps neighbouring letters
 * from welding into one another's loops.
 */
const buildOutlines = (
  geometry: THREE.BufferGeometry,
  strokePx: number,
  pixelsPerUnit: number,
): GlyphOutline[] => {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute
  const glyphIndex = geometry.getAttribute("glyphIndex") as THREE.BufferAttribute | undefined
  const index = geometry.getIndex()
  if (!glyphIndex || !index) return []

  const positions = position.array as ArrayLike<number>
  const indices = index.array as ArrayLike<number>
  let glyphCount = 0
  for (let i = 0; i < glyphIndex.count; i++) {
    const g = glyphIndex.getX(i)
    if (g + 1 > glyphCount) glyphCount = g + 1
  }
  if (glyphCount === 0) return []

  const windows = writeWindows(glyphCount)
  const outlines: GlyphOutline[] = []
  for (let g = 0; g < glyphCount; g++) {
    // Clipping "inside": pull each contour in by half the pen so the
    // ribbon's outer edge lands back on the letterform's own boundary
    // (parts/outline.ts insetLoop). Adding the ribbon's own ±1px
    // antialiasing shoulder on top of that was tried and measured
    // WORSE on the settled frames (coverage_ours 0.9872 -> 0.9853): the
    // shoulder is soft and half of it falls under the reference's own
    // encode blur, so pulling the hard edge a further pixel in only
    // thins the stems.
    const inset = strokePx / 2 / Math.max(pixelsPerUnit, 1e-6)
    const loops = boundaryLoops(
      positions,
      indices,
      (t) => glyphIndex.getX(indices[t * 3]!) === g,
    ).map((loop) => insetLoop(loop, inset))
    // NOTE (open): where along its contour the 2021 pen STARTED is not
    // recoverable here. C4D began each stroke at its spline's first
    // point — the font's own contour start — and three-text hands over
    // triangles, not contours, so the point is gone by the time we see
    // the geometry. The boundary walk starts wherever the adjacency map
    // hands it a vertex instead. A "start at the topmost point" rule was
    // tried against the reference (parts/outline.ts startAtTop, kept for
    // whoever picks this up) and MEASURED WORSE on the scored frames: it
    // fixed the `a` of f0591 (0.79 -> 0.89 coverage_ref) and broke the
    // `s` of f0578, which the reference draws from its top RIGHT
    // (0.98 -> 0.91). It is a guess either way, so the guess is not
    // taken. The real fix is glyph contours from the shaper.
    const lengths = loops.map(loopLength)
    const total = lengths.reduce((a, b) => a + b, 0)
    let walked = 0
    const built: GlyphOutline["loops"] = []
    for (let i = 0; i < loops.length; i++) {
      const ribbon = new RibbonStroke(strokePx)
      ribbon.setPoints(closeLoop(loops[i]!).map((p) => new THREE.Vector3(p.x, p.y, p.z)))
      const from = total > 0 ? walked / total : 0
      walked += lengths[i]!
      built.push({ ribbon, from, to: total > 0 ? walked / total : 1 })
    }
    outlines.push({ window: windows[g] ?? [0, 1], loops: built })
  }
  return outlines
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * Drive one text's outline strokes from the two fronts — the CPU mirror
 * of TextGlyphMaterial's fragment stage, computing the very same
 * numbers through parts/text.ts's own writePhases().
 *
 * Per glyph: the composed progress min(write, 1 − erase) yields this
 * letter's `draw` phase; its loops then split that one number in
 * sequence, by arc length, so the pen finishes the silhouette before it
 * starts the counter — one contour at a time, which is what
 * stroke_method "single" means, and what the reference shows for `a`,
 * `e` and `p`.
 */
const syncOutlines = (outlines: readonly GlyphOutline[], holon: Text): void => {
  const creation = holon.creation.value
  const erasure = holon.erasure.value
  const opacity = holon.opacity.value
  const tint = holon.tint.value
  const width = holon.stroke.value
  for (const { window, loops } of outlines) {
    const span = Math.max(window[1] - window[0], 1e-6)
    const pWrite = clamp01((creation - window[0]) / span)
    const pErase = clamp01((erasure - window[0]) / span)
    const { draw } = writePhases(Math.min(pWrite, 1 - pErase))
    for (const { ribbon, from, to } of loops) {
      const local = to > from ? clamp01((draw - from) / (to - from)) : draw > from ? 1 : 0
      ribbon.style(local, opacity, tint, width)
    }
  }
}

/**
 * One Text holon's live rendering. Layout is asynchronous (three-text
 * loads HarfBuzz and the font on first use): the mesh appears when the
 * first layout lands, and `ready` resolves after it — harnesses await
 * this before capturing, which is what makes frames deterministic.
 * Content/size/font changes re-layout in the background, keeping the
 * previous glyphs on screen until the new ones land.
 */
export interface TextBinding {
  readonly holon: Text
  /**
   * Sync uniforms/visibility from the holon — call once per frame.
   *
   * `pixelsPerUnit` is the frame's projection scale at the text plane.
   * The traced contours need it because their stroke width is stated in
   * SCREEN pixels (like every ribbon) while the inset that keeps them
   * inside the letterform is WORLD geometry: half a stroke of pixels is
   * `stroke / 2 / pixelsPerUnit` units. The host measures it from the
   * live camera; a caller with no camera may leave it out and get the
   * 2021 rig's own 1.28, which is what every video-01 scene renders at.
   */
  sync(pixelsPerUnit?: number): void
  dispose(): void
  /** Resolves once the first layout has been mounted. */
  readonly ready: Promise<void>
}

const layoutKey = (holon: Text): string =>
  `${holon.content} ${holon.font ?? ""} ${holon.size.value}`

/** three-text's handle: the geometry plus its own disposal. */
interface TextHandle {
  geometry: THREE.BufferGeometry
  dispose(): void
}

const layoutText = async (
  content: string,
  font: string,
  size: number,
): Promise<TextHandle> => {
  ensureHarfBuzz()
  return (await ThreeText.create({
    text: content,
    font,
    size,
    // Flat text: no extrusion, so the glyphs live in the XY plane like
    // every other holon's geometry.
    depth: 0,
    // The hook the Write domino runs on.
    perGlyphAttributes: true,
    // Overlapping contours would otherwise double up under max
    // blending while the letter is at partial strength.
    removeOverlaps: true,
    layout: { align: "center" },
  })) as unknown as TextHandle
}

/**
 * Mount a Text holon into a host group. The host owns the group's
 * transform (the standard params); this binding owns the glyph geometry
 * and the material's uniforms.
 */
export const attachText = (holon: Text, group: THREE.Object3D): TextBinding => {
  let mesh: THREE.Mesh | undefined
  let material: TextGlyphMaterial | undefined
  let handle: TextHandle | undefined
  let outlines: GlyphOutline[] = []
  let insetScale = DEFAULT_PIXELS_PER_UNIT
  let currentKey = ""
  let layoutToken = 0
  let disposed = false

  const dropOutlines = () => {
    for (const outline of outlines) {
      for (const { ribbon } of outline.loops) {
        group.remove(ribbon.mesh)
        // The material is the SHARED ribbon material (ribbon.ts) — only
        // this stroke's geometry may die with it.
        ribbon.geometry.dispose()
      }
    }
    outlines = []
  }

  /** (Re)trace the contours of the mounted layout at the current inset. */
  const rebuildOutlines = () => {
    if (!mesh) return
    dropOutlines()
    outlines = buildOutlines(mesh.geometry, holon.stroke.value, insetScale)
    for (const outline of outlines) {
      for (const { ribbon } of outline.loops) group.add(ribbon.mesh)
    }
  }

  const relayout = (): Promise<void> => {
    currentKey = layoutKey(holon)
    const token = ++layoutToken
    return layoutText(holon.content, holon.font ?? DEFAULT_FONT_URL, holon.size.value)
      .then((next) => {
        // Superseded mid-flight, or the binding went away.
        if (token !== layoutToken || disposed) {
          next.dispose()
          return
        }
        const geometry = next.geometry
        addWriteAttributes(geometry)
        // three-text lays the block out from its own origin: x already
        // centred by `layout.align`, y on the BASELINE. Both are what
        // the 2021 C4D text spline does (PRIM_TEXT_ALIGN = 1 centres
        // horizontally and leaves the baseline on the object's own
        // origin), so the holon's transform places the block exactly as
        // pydeation placed it — the ink of "trans-perspectival" at size
        // 50 lands on refs/video-01/frames5/f0583's rows 315-373 to
        // within a pixel with NO vertical correction at all.
        //
        // Only the horizontal centring is re-derived here, from the ink
        // bounding box rather than from the advance widths: a trailing
        // space or a glyph with side bearing wider than its ink would
        // otherwise shift the block off the axis the reference centres
        // it on. The vertical is deliberately left alone — centring the
        // ink box instead sits the word ~12 units low, because a
        // descender is shorter than an ascender and the ink box knows
        // nothing about the baseline.
        geometry.computeBoundingBox()
        const box = geometry.boundingBox
        if (box) geometry.translate(-(box.min.x + box.max.x) / 2, 0, 0)
        if (!mesh || !material) {
          material = new TextGlyphMaterial()
          mesh = new THREE.Mesh(geometry, material)
          mesh.frustumCulled = false
          mesh.visible = false
          group.add(mesh)
        } else {
          mesh.geometry = geometry
        }
        // The traced outlines, rebuilt for this layout. They are added
        // AFTER the solid so a fully written letter reads as one shape
        // rather than an outline sitting on top of its own fill.
        rebuildOutlines()
        handle?.dispose()
        handle = next
      })
      .catch((err: unknown) => {
        // A missing font or an unshapeable string must not kill the
        // frame loop — the holon simply stays invisible.
        console.error("[dreamtalk] text layout failed:", err)
      })
  }

  const ready = relayout()

  return {
    holon,
    ready,
    sync(pixelsPerUnit = DEFAULT_PIXELS_PER_UNIT): void {
      if (layoutKey(holon) !== currentKey) void relayout()
      // The inset depends on the projection, so a camera move (or a
      // resize) rebuilds the contours — a few hundred points repacked,
      // and only when the number actually changes.
      if (mesh && Math.abs(pixelsPerUnit - insetScale) > 1e-4) {
        insetScale = pixelsPerUnit
        rebuildOutlines()
      }
      if (!mesh || !material) return
      material.progress.value = holon.creation.value
      material.erasure.value = holon.erasure.value
      material.fade.value = holon.opacity.value
      const tint: Color = holon.tint.value
      material.tint.value.setRGB(tint.r, tint.g, tint.b)
      mesh.visible =
        holon.opacity.value > 0 && holon.creation.value > 0 && holon.erasure.value < 1
      syncOutlines(outlines, holon)
    },
    dispose(): void {
      disposed = true
      layoutToken++
      dropOutlines()
      if (mesh) {
        group.remove(mesh)
        mesh = undefined
      }
      handle?.dispose()
      handle = undefined
      material?.dispose()
      material = undefined
    },
  }
}
