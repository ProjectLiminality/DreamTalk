/**
 * The soft echo — one primitive under two looks.
 *
 * An ECHO is a copy of a piece of ink drawn with the soft (gaussian)
 * ribbon material instead of the crisp one: the same polyline, the same
 * draw-on and erase fronts, the same visibility, but its own offset,
 * alpha, tint, width and hollow core. Ribbons composite by MAX, so echoes
 * never pile into a brighter line; they merge into one soft band.
 *
 *  - Uncertainty (render/superposition.ts) draws a small orbiting cloud
 *    of echoes in the ink's own colour — the quantum blur.
 *  - Attention (render/glow.ts) draws two still, hollow echoes in GOLD
 *    around the ink — the glow of being selected.
 *
 * Echoes are made only for ink that asks for them, so a scene with
 * neither renders exactly the bytes it always did.
 */

import * as THREE from "three/webgpu"
import type { Color } from "../constants"
import { RIBBON_KEYS, RibbonStroke, sharedSoftRibbonMaterial } from "./ribbon"

/**
 * A fresh soft ribbon under `parent`, composited at `renderOrder`. Its
 * matrix is placed by hand (`placeEcho`) because echoes are synced after
 * the host has settled the frame's world matrices.
 */
export const softEcho = (widthPx: number, renderOrder: number, parent: THREE.Object3D): RibbonStroke => {
  const echo = new RibbonStroke(widthPx)
  echo.mesh.renderOrder = renderOrder
  echo.mesh.material = sharedSoftRibbonMaterial()
  echo.mesh.matrixAutoUpdate = false
  parent.add(echo.mesh)
  return echo
}

/**
 * Put an echo `dx, dy` scene units off its source (whose own local matrix
 * is `base`, identity if omitted) and settle its world matrix now.
 */
export const placeEcho = (mesh: THREE.Object3D, dx: number, dy: number, base?: THREE.Matrix4): void => {
  if (base) mesh.matrix.copy(base)
  else mesh.matrix.identity()
  if (dx !== 0 || dy !== 0) {
    mesh.matrix.elements[12] += dx
    mesh.matrix.elements[13] += dy
  }
  if (mesh.parent) mesh.matrixWorld.multiplyMatrices(mesh.parent.matrixWorld, mesh.matrix)
  else mesh.matrixWorld.copy(mesh.matrix)
}

/** How an echo looks this frame — everything that is not its source's. */
export interface EchoLook {
  /** Multiplies the source's own fade. */
  alpha: number
  tint: Color
  widthPx: number
  /** The hollow core in CSS px: 0 = a full gaussian, else a halo around a line that wide. */
  innerPx?: number
  /** Pushed this fraction of its depth away from the eye, behind its holon's solids (ribbon.ts). */
  sink?: number
}

/** What a source stroke shows this frame: its draw window and fade (0 when hidden). */
export const shownOf = (main: RibbonStroke): { fraction: number; erased: number; opacity: number } => {
  const ud = main.mesh.userData
  const total = main.totalLength || 1
  return {
    fraction: (ud[RIBBON_KEYS.drawn] as number) / total,
    erased: (ud[RIBBON_KEYS.erased] as number) / total,
    opacity: main.mesh.visible ? (ud[RIBBON_KEYS.fade] as number) : 0,
  }
}

/** A source's own width and tint as this frame styled them. */
export const inkOf = (main: RibbonStroke): { widthPx: number; tint: Color } => ({
  widthPx: main.mesh.userData[RIBBON_KEYS.widthPx] as number,
  tint: main.mesh.userData[RIBBON_KEYS.tint] as Color,
})

/** Style an echo after `shown` (a source's draw window and fade), in `look`. */
export const styleEcho = (
  echo: RibbonStroke,
  shown: { fraction: number; erased: number; opacity: number },
  look: EchoLook,
): void => {
  echo.style(shown.fraction, shown.opacity * look.alpha, look.tint, look.widthPx, shown.erased, look.innerPx ?? 0)
  echo.mesh.userData[RIBBON_KEYS.sink] = look.sink ?? 0
}

/** Is this polyline a closed loop (its last point back on its first)? */
export const isClosed = (pts: readonly THREE.Vector3[]): boolean =>
  pts.length > 2 && pts[0]!.distanceToSquared(pts[pts.length - 1]!) <= 1e-12 * (1 + pts[0]!.lengthSq())

/**
 * Tell a hollow echo where its polyline truly ends, so its halo rounds
 * there and nowhere else (ribbon.ts, the soft profile). A closed loop
 * drawn whole has no tips; one still drawing (or erasing) has its seam.
 */
export const setTips = (echo: RibbonStroke, closed: boolean, shown: { fraction: number; erased: number }): void => {
  const tips = echo.mesh.userData[RIBBON_KEYS.tips] as THREE.Vector2
  if (closed && shown.fraction >= 1 && shown.erased <= 0) tips.set(-1, 1e30)
  else tips.set(0, echo.totalLength * (1 - 1e-5))
}
