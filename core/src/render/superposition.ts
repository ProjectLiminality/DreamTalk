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
 */

import * as THREE from "three/webgpu"
import type { Color } from "../constants"
import type { Readable } from "../params"
import { RIBBON_KEYS, RibbonStroke, sharedSoftRibbonMaterial } from "./ribbon"
import { FillShape } from "./fill"

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

const place = (mesh: THREE.Object3D, dx: number, dy: number): void => {
  mesh.position.set(dx, dy, 0)
  mesh.updateMatrix()
  if (mesh.parent) mesh.matrixWorld.multiplyMatrices(mesh.parent.matrixWorld, mesh.matrix)
}

/** The echoes of one uncertain STROKE. */
export class RibbonSuperposition {
  private readonly echoes: RibbonStroke[] = []

  constructor(
    private readonly main: RibbonStroke,
    private readonly certainty: Readable<number>,
    private readonly seed: number,
    group: THREE.Object3D,
  ) {
    for (let k = 0; k < ECHOES; k++) {
      const echo = new RibbonStroke(main.mesh.userData[RIBBON_KEYS.widthPx] as number)
      echo.mesh.renderOrder = main.mesh.renderOrder
      // A gaussian cross-section: the echoes overlap into one soft band.
      echo.mesh.material = sharedSoftRibbonMaterial()
      echo.mesh.matrixAutoUpdate = false
      group.add(echo.mesh)
      this.echoes.push(echo)
    }
  }

  setPoints(pts: readonly THREE.Vector3[]): void {
    for (const e of this.echoes) e.setPoints(pts)
  }

  /**
   * Restyle the echoes from the main stroke as this frame left it; `upp` is
   * scene units per pixel at the stroke.
   */
  sync(t: number, upp: number): void {
    const c = this.certainty.value
    const u = 1 - (c <= 0 ? 0 : c >= 1 ? 1 : c)
    const ud = this.main.mesh.userData
    const total = this.main.totalLength || 1
    const fraction = (ud[RIBBON_KEYS.drawn] as number) / total
    const erased = (ud[RIBBON_KEYS.erased] as number) / total
    const opacity = this.main.mesh.visible ? (ud[RIBBON_KEYS.fade] as number) : 0
    const tint = ud[RIBBON_KEYS.tint] as Color
    const widthPx = ud[RIBBON_KEYS.widthPx] as number
    for (let k = 0; k < this.echoes.length; k++) {
      const echo = this.echoes[k]!
      if (u <= 0 || opacity <= 0) {
        echo.mesh.visible = false
        continue
      }
      const o = echoOffset(k, this.seed, t, BLUR_PX * u)
      place(echo.mesh, o.x * upp, o.y * upp)
      echo.style(fraction, opacity * u * 0.5 * echoBreath(k, this.seed, t), tint, widthPx * (1.5 + 3.5 * u), erased)
    }
  }
}

/** The echoes of one uncertain FILL — a particle's probability cloud. */
export class FillSuperposition {
  private readonly echoes: FillShape[] = []

  constructor(
    private readonly certainty: Readable<number>,
    private readonly seed: number,
    private readonly main: FillShape,
    group: THREE.Object3D,
    /** The main fill's opacity and tint this frame (the host's own reading). */
    private readonly look: () => { opacity: number; tint: Color },
  ) {
    for (let k = 0; k < ECHOES; k++) {
      const echo = new FillShape(main.mesh.renderOrder)
      echo.mesh.matrixAutoUpdate = false
      group.add(echo.mesh)
      this.echoes.push(echo)
    }
  }

  sync(t: number, upp: number): void {
    const { opacity, tint } = this.look()
    const c = this.certainty.value
    const u = 1 - (c <= 0 ? 0 : c >= 1 ? 1 : c)
    for (let k = 0; k < this.echoes.length; k++) {
      const echo = this.echoes[k]!
      if (u <= 0 || opacity <= 0) {
        echo.mesh.visible = false
        continue
      }
      // Share the main fill's geometry — whatever it last became.
      echo.mesh.geometry = this.main.mesh.geometry
      const o = echoOffset(k, this.seed, t, CLOUD_PX * u)
      // Each candidate position a little larger than the particle: a halo.
      echo.mesh.scale.setScalar(1 + 0.9 * u)
      place(echo.mesh, o.x * upp, o.y * upp)
      echo.style(opacity * u * 0.24 * echoBreath(k, this.seed, t), tint)
    }
  }
}
