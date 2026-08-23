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
 * LESSON (ribbon.ts, still law): every animated material value is a
 * TSL uniform node, never a plain material property.
 *
 * TODO(host wiring) — three-host.ts is owned elsewhere; the integrator
 * adds exactly these three lines:
 *   import { attachText, type TextBinding } from "./text"   // + Text from "../parts/text"
 *   private readonly texts: TextBinding[] = []
 *   // in attach():  if (holon instanceof Text) this.texts.push(attachText(holon, group))
 *   // in sync():    for (const b of this.texts) b.sync()
 */

import * as THREE from "three/webgpu"
import { uniform } from "three/tsl"
import * as TSLTyped from "three/tsl"
import { Text as ThreeText } from "three-text"
import type { Color } from "../constants"
import { Text, writeWindows, DRAW_WINDOW, FILL_WINDOW } from "../parts/text"

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
/** Position across the glyph's own width, for the left-to-right wipe. */
const vGlyphU = varyingProperty("float", "dtGlyphU")

export class TextGlyphMaterial extends THREE.NodeMaterial {
  /** The write front — the owning holon's `creation` (0 → 1). */
  readonly progress = uniform(1)
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
      // draw (the glyph wipes on left to right) then fill (it settles to
      // full strength). Re-derives parts/text.ts writePhases() in-shader
      // — the tests pin the CPU side, and the two must agree.
      const win = vec2(vWindow)
      const p = clamp(
        this.progress.sub(win.x).div(max(win.y.sub(win.x), 1e-6)),
        0.0,
        1.0,
      ).toVar()
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

      // The wipe: the letter reveals left to right across its own quad
      // (the 2021 "left_right" stroke order per letter). It sweeps past
      // both edges so drawP 0/1 are fully off/on.
      const u = float(vGlyphU)
      const wipeX = mix(float(-0.05), float(1.05), drawP)
      const wipe = smoothstep(wipeX.sub(0.06), wipeX.add(0.06), u).oneMinus()

      // Draw phase reveals the letter at partial strength; the fill
      // phase brings it to solid — the 2021 DrawThenFillCompletely read.
      const strength = mix(float(0.55), float(1.0), fillP)
      const a = wipe.mul(strength).mul(this.fade)
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
 *   • `glyphU`      — its position across its own glyph's width, so the
 *                     wipe runs left to right within each letter.
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

  // How many distinct glyphs, and each glyph's x-extent (for the wipe).
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
 * One Text holon's live rendering. Layout is asynchronous (three-text
 * loads HarfBuzz and the font on first use): the mesh appears when the
 * first layout lands, and `ready` resolves after it — harnesses await
 * this before capturing, which is what makes frames deterministic.
 * Content/size/font changes re-layout in the background, keeping the
 * previous glyphs on screen until the new ones land.
 */
export interface TextBinding {
  readonly holon: Text
  /** Sync uniforms/visibility from the holon — call once per frame. */
  sync(): void
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
  let currentKey = ""
  let layoutToken = 0
  let disposed = false

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
        // three-text lays the block out from its own origin; centre it
        // so the holon's transform places it like the 2021 centered
        // text spline.
        geometry.computeBoundingBox()
        const box = geometry.boundingBox
        if (box) {
          geometry.translate(
            -(box.min.x + box.max.x) / 2,
            -(box.min.y + box.max.y) / 2,
            0,
          )
        }
        if (!mesh || !material) {
          material = new TextGlyphMaterial()
          mesh = new THREE.Mesh(geometry, material)
          mesh.frustumCulled = false
          mesh.visible = false
          group.add(mesh)
        } else {
          mesh.geometry = geometry
        }
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
    sync(): void {
      if (layoutKey(holon) !== currentKey) void relayout()
      if (!mesh || !material) return
      material.progress.value = holon.creation.value
      material.fade.value = holon.opacity.value
      const tint: Color = holon.tint.value
      material.tint.value.setRGB(tint.r, tint.g, tint.b)
      mesh.visible = holon.opacity.value > 0 && holon.creation.value > 0
    },
    dispose(): void {
      disposed = true
      layoutToken++
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
