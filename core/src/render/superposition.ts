/**
 * Superposition — how uncertainty LOOKS (certainty.ts, drawn).
 *
 * "Potentiality vs actuality… a quantum-mechanical, Heisenberg-uncertainty
 * blur… many possible microstates behind one macrostate" (David,
 * 2026-10-13). A ghost is not merely faint: it is a thing seen in several
 * places at once. So an uncertain leaf is drawn with a small cloud of
 * ECHOES — copies of its own stroke or fill, each displaced by a few pixels
 * along a slowly orbiting, breathing offset, a little wider and much
 * fainter than the original, drawn with a GAUSSIAN cross-section (the soft
 * ribbon material) rather than a crisp edge. Ribbons composite by MAX, so
 * the echoes never pile into a brighter line: they merge into one soft band
 * that shimmers. Fills (a particle) become a faint probability cloud flickering
 * between candidate positions.
 *
 * Everything scales with 1 − c. As certainty rises the echoes draw in onto
 * the line and fade — the blur crystallising — and at c = 1 they are hidden
 * outright: actuality is exactly the crisp stroke, the same pixels as a
 * holon that never declared certainty. A holon with no certainty anywhere
 * above it never gets a Superposition at all.
 *
 * The motion is a pure function of (scene t, seed): deterministic frames,
 * scrubbable backwards. Offsets are stated in PIXELS (converted through the
 * frame's own projection), so the blur reads the same at any scene scale.
 *
 * The echoes are render/echo.ts's soft echoes — the same primitive the
 * golden glow of attention (render/glow.ts) is drawn with.
 */

import * as THREE from "three/webgpu"
import type { Color } from "../constants"
import type { Readable } from "../params"
import type { RibbonStroke } from "./ribbon"
import { FillShape } from "./fill"
import { inkOf, placeEcho, shownOf, softEcho, styleEcho } from "./echo"

/** Echoes per uncertain leaf — enough for a cloud, few enough to be free. */
export const ECHOES = 6
/** How far, in pixels, the echoes of pure conjecture wander from the line. */
export const BLUR_PX = 5
/** How far a conjectured FILL (a particle) wanders — a wider cloud. */
export const CLOUD_PX = 7

/**
 * Echo k's displacement in pixels at time t, for spread `px`: an orbit at
 * its own angular speed whose radius breathes between half and full spread.
 * Pure.
 */
export const echoOffset = (k: number, seed: number, t: number, px: number): { x: number; y: number } => {
  const phase = seed * 2.399 + (2 * Math.PI * k) / ECHOES
  const w = 0.9 + 0.37 * k
  const a = phase + w * t * (k % 2 === 0 ? 1 : -1)
  const r = px * (0.55 + 0.45 * Math.sin(1.3 * t + phase * 1.7))
  return { x: Math.cos(a) * r, y: Math.sin(a) * r }
}

/** Echo k's breathing alpha factor at time t, in [0.45, 1]. Pure. */
export const echoBreath = (k: number, seed: number, t: number): number =>
  0.725 + 0.275 * Math.sin(1.9 * t + seed * 3.1 + k * 1.7)

/** A geometry's bounding-box centre, cached per geometry object (a fill replaces it on change). */
const CENTRES = new WeakMap<THREE.BufferGeometry, THREE.Vector3>()
const centreOf = (geometry: THREE.BufferGeometry): THREE.Vector3 => {
  let c = CENTRES.get(geometry)
  if (!c) {
    geometry.computeBoundingBox()
    c = geometry.boundingBox ? geometry.boundingBox.getCenter(new THREE.Vector3()) : new THREE.Vector3()
    CENTRES.set(geometry, c)
  }
  return c
}
const grow = new THREE.Matrix4()
const shift = new THREE.Matrix4()

/** The echoes of one uncertain STROKE. */
export class RibbonSuperposition {
  /**
   * Made the first frame the line is actually uncertain (c < 1), not at
   * mount: a scene full of certain things that merely COULD be doubted
   * (every Grain of a FlowMap) costs no meshes at all.
   */
  private readonly echoes: RibbonStroke[] = []
  private points: readonly THREE.Vector3[] = []
  /** Called with each echo mesh as it is made (a clip adopting it). */
  onEcho?: (mesh: THREE.Mesh) => void
  private shown = false

  constructor(
    private readonly main: RibbonStroke,
    private readonly certainty: Readable<number>,
    private readonly seed: number,
    private readonly group: THREE.Object3D,
  ) {}

  setPoints(pts: readonly THREE.Vector3[]): void {
    this.points = pts
    this.loops = undefined
    for (const e of this.echoes) e.setPoints(pts)
  }

  /** Many polylines as one cloud (parts/polylines.ts). */
  setLoops(loops: readonly (readonly THREE.Vector3[])[]): void {
    this.loops = loops
    for (const e of this.echoes) e.setLoops(loops)
  }
  private loops: readonly (readonly THREE.Vector3[])[] | undefined

  private make(): void {
    // A gaussian cross-section: the echoes overlap into one soft band.
    for (let k = 0; k < ECHOES; k++) {
      const echo = softEcho(inkOf(this.main).widthPx, this.main.mesh.renderOrder, this.group)
      if (this.loops) echo.setLoops(this.loops)
      else echo.setPoints(this.points)
      this.echoes.push(echo)
      this.onEcho?.(echo.mesh)
    }
  }

  /** The ink this cloud echoes, and its own meshes (a clip applies to both). */
  get source(): THREE.Mesh {
    return this.main.mesh
  }
  meshes(): THREE.Mesh[] {
    return this.echoes.map((e) => e.mesh)
  }

  /**
   * Restyle the echoes from the main stroke as this frame left it; `upp` is
   * scene units per pixel at the stroke, asked for only when there is a
   * cloud to place.
   */
  sync(t: number, upp: () => number): void {
    // The ink first: a hidden stroke's cloud is hidden whatever its certainty (and that reading may be a derivation).
    const shown = shownOf(this.main)
    const c = shown.opacity <= 0 ? 1 : this.certainty.value
    const u = 1 - (c <= 0 ? 0 : c >= 1 ? 1 : c)
    // Made the first frame the line is uncertain, SHOWN OR NOT — so a line
    // that is doubted from the start has its cloud before it first appears
    // and the host can build it in the background (prewarm), instead of in
    // the frame it does.
    if (u > 0 && this.echoes.length === 0) this.make()
    if (u <= 0 || shown.opacity <= 0) {
      if (this.shown) for (const echo of this.echoes) echo.mesh.visible = false
      this.shown = false
      return
    }
    this.shown = true
    const { tint, widthPx } = inkOf(this.main)
    const unit = upp()
    for (let k = 0; k < this.echoes.length; k++) {
      const echo = this.echoes[k]!
      const o = echoOffset(k, this.seed, t, BLUR_PX * u)
      placeEcho(echo.mesh, o.x * unit, o.y * unit)
      styleEcho(echo, shown, { alpha: u * 0.5 * echoBreath(k, this.seed, t), tint, widthPx: widthPx * (1.5 + 3.5 * u) })
    }
  }
}

/** The echoes of one uncertain FILL — a particle's probability cloud. */
export class FillSuperposition {
  /**
   * Made at once, hidden — unlike a stroke's. A fill that is doubted (a
   * particle) usually becomes uncertain in the very frame it appears, so a
   * lazy cloud would be six new render objects in a frame that shows them
   * (valueflow: ~20 ms as particles enter). Fills are few; made at mount
   * they are built by the host's prewarm, behind the first frame.
   */
  private readonly echoes: FillShape[] = []
  /** Called with each echo mesh as it is made (a clip adopting it). */
  onEcho?: (mesh: THREE.Mesh) => void
  private shown = false

  constructor(
    private readonly certainty: Readable<number>,
    private readonly seed: number,
    private readonly main: FillShape,
    private readonly group: THREE.Object3D,
    /** The main fill's opacity and tint this frame (the host's own reading). */
    private readonly look: () => { opacity: number; tint: Color },
  ) {
    this.make()
  }

  private make(): void {
    for (let k = 0; k < ECHOES; k++) {
      const echo = new FillShape(this.main.mesh.renderOrder)
      // Its source's shape from birth: a mesh that first renders with the
      // geometry it will keep is built once, not rebuilt on first show.
      echo.mesh.geometry = this.main.mesh.geometry
      echo.mesh.matrixAutoUpdate = false
      this.group.add(echo.mesh)
      this.echoes.push(echo)
      this.onEcho?.(echo.mesh)
    }
  }

  /** The ink this cloud echoes, and its own meshes (a clip applies to both). */
  get source(): THREE.Mesh {
    return this.main.mesh
  }
  meshes(): THREE.Mesh[] {
    return this.echoes.map((e) => e.mesh)
  }

  sync(t: number, upp: () => number): void {
    const { opacity, tint } = this.look()
    const c = opacity <= 0 ? 1 : this.certainty.value
    const u = 1 - (c <= 0 ? 0 : c >= 1 ? 1 : c)
    if (u <= 0 || opacity <= 0) {
      if (this.shown) for (const echo of this.echoes) echo.mesh.visible = false
      this.shown = false
      return
    }
    this.shown = true
    const unit = upp()
    for (let k = 0; k < this.echoes.length; k++) {
      const echo = this.echoes[k]!
      // Share the main fill's geometry — whatever it last became.
      echo.mesh.geometry = this.main.mesh.geometry
      const o = echoOffset(k, this.seed, t, CLOUD_PX * u)
      // Each candidate position a little larger than the particle: a halo —
      // grown about the fill's OWN centre, on the fill's own local matrix,
      // so a shape that sits off its group's origin (a truck's body in a
      // lens) swells in place instead of sliding away as it grows.
      const centre = centreOf(echo.mesh.geometry)
      const swell = 1 + 0.9 * u
      grow.makeTranslation(centre.x, centre.y, centre.z)
        .multiply(shift.makeScale(swell, swell, swell))
        .multiply(shift.makeTranslation(-centre.x, -centre.y, -centre.z))
      echo.mesh.matrix.multiplyMatrices(this.main.mesh.matrix, grow)
      placeEcho(echo.mesh, o.x * unit, o.y * unit, echo.mesh.matrix)
      echo.style(opacity * u * 0.24 * echoBreath(k, this.seed, t), tint)
    }
  }
}
