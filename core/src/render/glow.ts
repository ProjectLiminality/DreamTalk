/**
 * Glow, drawn (src/glow.ts) — attention's golden halo, made of soft echoes
 * (render/echo.ts), the same primitive that draws uncertainty.
 *
 * A halo is two still, HOLLOW echoes in GOLD around a piece of ink:
 *
 *  - the RIM, a few pixels of warm light hugging the ink's edge;
 *  - the AURA, a wide faint gaussian that carries it into the dark.
 *
 * Hollow: the soft profile starts at the ink's own edge (the line's half
 * width), so the ink keeps its colour and the light is around it, never
 * on it — being looked at does not change a thing. Both widths are stated
 * in screen pixels, so a glow reads the same at any scale and any camera;
 * the echoes are ribbons on the ink's own polyline, so they turn, recede
 * and hide behind solids exactly as the ink does.
 *
 * A stroke is echoed directly (its points, its draw-on and erase fronts).
 * A FILL — a disc, an arrowhead, a land mass, a letter — is echoed along
 * its boundary (geometry/boundary.ts); a flat fill's halo is one-sided,
 * lit only outside its edge.
 *
 * Ink is composited by MAX, so light laid across a coloured line would
 * tint it (blue ∨ gold = lavender). So the light SINKS a little behind
 * its ink (a fraction of its depth — pixels unmoved), and each glowing
 * piece of ink also writes a MASK of itself into depth only, exactly where
 * it inks. The halo is then hidden wherever the selection's own ink is —
 * its own line, a neighbour's, a letter's stem under the next letter's
 * aura — and behind its own solid faces (a factory's body).
 *
 * Halos are made lazily, the first time a piece of ink is attended to,
 * and live in their own layer (`ThreeHost.attend`). A scene nobody looks
 * at never makes one.
 */

import * as THREE from "three/webgpu"
import { GOLD } from "../constants"
import { boundaryLoops, isFlat, orientLoops } from "../geometry/boundary"
import { RIBBON_KEYS, RibbonStroke, sharedMaskRibbonMaterial } from "./ribbon"
import { inkOf, isClosed, placeEcho, setTips, shownOf, softEcho, styleEcho } from "./echo"

/** How far the rim's light reaches beyond the ink (CSS px). */
export const RIM_PX = 4
/** How far the aura's light reaches beyond the ink (CSS px). */
export const AURA_PX = 14
const RIM_ALPHA = 0.85
const AURA_ALPHA = 0.55
/**
 * How far behind its ink a halo sinks, as a fraction of its depth: enough
 * to fall behind its holon's own solid faces (a factory's body), so the
 * light rises around a solid's silhouette and never across it.
 */
const SINK = 0.03
/**
 * Where masks and light composite: after all the ink, so a mask hides
 * nothing but light (no line behind a glowing one is lost), and the light
 * lies over the scene like the attention it is.
 */
const MASK_ORDER = 1e6
const LIGHT_ORDER = MASK_ORDER + 1
/**
 * The aura's tint: GOLD squared — light that has travelled further keeps
 * its warmth and loses its white, so the dim edge of the halo stays amber
 * instead of going khaki on black.
 */
const AURA = { r: GOLD.r * GOLD.r, g: GOLD.g * GOLD.g, b: GOLD.b * GOLD.b }

/** A fill's depth-only mask material (see the module header). */
let maskFill: THREE.MeshBasicNodeMaterial | undefined
const maskFillMaterial = (): THREE.MeshBasicNodeMaterial => {
  if (!maskFill) {
    maskFill = new THREE.MeshBasicNodeMaterial()
    maskFill.transparent = true
    maskFill.colorWrite = false
    maskFill.depthWrite = true
    maskFill.side = THREE.DoubleSide
  }
  return maskFill
}

/**
 * How much of its light a piece of ink of this opacity gets: none when it
 * is gone, full long before it is — a faint ghost that is selected must
 * still read as selected.
 */
export const presence = (opacity: number): number => (opacity <= 0 ? 0 : Math.min(1, 2.5 * opacity))

/** The halo around one STROKE — its two echoes on the stroke's own polyline. */
export class StrokeHalo {
  private readonly rim: RibbonStroke
  private readonly aura: RibbonStroke
  private readonly mask: RibbonStroke
  private points: readonly THREE.Vector3[] | undefined
  private closed = false

  constructor(private readonly main: RibbonStroke, layer: THREE.Object3D) {
    this.rim = softEcho(1, LIGHT_ORDER, layer)
    this.aura = softEcho(1, LIGHT_ORDER, layer)
    this.mask = new RibbonStroke(1)
    this.mask.mesh.renderOrder = MASK_ORDER
    this.mask.mesh.material = sharedMaskRibbonMaterial()
    this.mask.mesh.matrixAutoUpdate = false
    layer.add(this.mask.mesh)
  }

  /** `amount` in [0, 1] — 0 hides it. */
  sync(amount: number): void {
    const pts = this.main.worldPoints()
    if (pts !== this.points) {
      this.points = pts
      this.rim.setPoints(pts)
      this.aura.setPoints(pts)
      this.mask.setPoints(pts)
      this.closed = isClosed(pts)
    }
    const shown = shownOf(this.main)
    if (amount <= 0 || shown.opacity <= 0) {
      this.hide()
      return
    }
    // Every frame's own transform: a stroke on a moving holon carries its light.
    placeEcho(this.rim.mesh, 0, 0, this.main.mesh.matrixWorld)
    placeEcho(this.aura.mesh, 0, 0, this.main.mesh.matrixWorld)
    placeEcho(this.mask.mesh, 0, 0, this.main.mesh.matrixWorld)
    setTips(this.rim, this.closed, shown)
    setTips(this.aura, this.closed, shown)
    const inner = inkOf(this.main).widthPx / 2
    this.mask.style(shown.fraction, 1, GOLD, inner * 2, shown.erased)
    // The light keeps its own strength; only the ink's window is its source's.
    const lit = { ...shown, opacity: presence(shown.opacity) }
    styleEcho(this.rim, lit, { alpha: amount * RIM_ALPHA, tint: GOLD, widthPx: 2 * (inner + RIM_PX), innerPx: inner, sink: SINK })
    styleEcho(this.aura, lit, { alpha: amount * AURA_ALPHA, tint: AURA, widthPx: 2 * (inner + AURA_PX), innerPx: inner, sink: SINK })
  }

  hide(): void {
    this.rim.mesh.visible = false
    this.aura.mesh.visible = false
    this.mask.mesh.visible = false
  }

  /** Its meshes — a clip on its stroke applies to them too. */
  meshes(): THREE.Mesh[] {
    return [this.rim.mesh, this.aura.mesh, this.mask.mesh]
  }
}

/**
 * Boundary loops per geometry object — a fill's shape changes by replacing
 * it. A FLAT fill's loops are oriented fill-on-the-left (orientLoops), so
 * its halo can be one-sided; a curved one's are not, and it is two-sided.
 */
interface Outline {
  loops: THREE.Vector3[][]
  flat: boolean
}
const OUTLINES = new WeakMap<THREE.BufferGeometry, Outline>()
const outlineOf = (geometry: THREE.BufferGeometry): Outline => {
  let outline = OUTLINES.get(geometry)
  if (!outline) {
    const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined
    const index = geometry.getIndex()
    const flat = !!position && isFlat(position.array)
    const loops = position ? boundaryLoops(position.array, index?.array) : []
    outline = {
      loops: (flat ? orientLoops(loops) : loops).map((loop) => loop.map((p) => new THREE.Vector3(p.x, p.y, p.z))),
      flat,
    }
    OUTLINES.set(geometry, outline)
  }
  return outline
}

const o = new THREE.Vector3()
const ex = new THREE.Vector3()
const ey = new THREE.Vector3()
/**
 * Which side of a flat fill's left-handed outline is OUTSIDE on screen:
 * the sign the soft shader's v takes there (screen y runs down). Read from
 * the projected local axes, so a fill seen from behind, or mirrored, still
 * keeps its light outside.
 */
const outsideSign = (matrixWorld: THREE.Matrix4, camera: THREE.Camera): number => {
  o.setFromMatrixPosition(matrixWorld).project(camera)
  ex.set(1, 0, 0).applyMatrix4(matrixWorld).project(camera).sub(o)
  ey.set(0, 1, 0).applyMatrix4(matrixWorld).project(camera).sub(o)
  // Local CCW stays CCW on screen (NDC, y up) ⇒ the fill is at v > 0, outside at v < 0.
  return ex.x * ey.y - ex.y * ey.x >= 0 ? -1 : 1
}

/** The halo around one FILL mesh — its two echoes along the mesh's boundary. */
export class FillHalo {
  private readonly rim: RibbonStroke
  private readonly aura: RibbonStroke
  private readonly mask: THREE.Mesh
  private geometry: THREE.BufferGeometry | undefined
  private flat = false

  constructor(private readonly mesh: THREE.Mesh, layer: THREE.Object3D) {
    this.rim = softEcho(1, LIGHT_ORDER, layer)
    this.aura = softEcho(1, LIGHT_ORDER, layer)
    this.mask = new THREE.Mesh(mesh.geometry, maskFillMaterial())
    this.mask.renderOrder = MASK_ORDER
    this.mask.matrixAutoUpdate = false
    this.mask.frustumCulled = false
    layer.add(this.mask)
  }

  /** `amount` in [0, 1]; `opacity` is the fill's own showing this frame. */
  sync(amount: number, opacity: number, camera: THREE.Camera): void {
    if (this.mesh.geometry !== this.geometry) {
      this.geometry = this.mesh.geometry
      const { loops, flat } = outlineOf(this.geometry)
      this.flat = flat
      this.rim.setLoops(loops)
      this.aura.setLoops(loops)
      this.mask.geometry = this.geometry
    }
    const a = this.mesh.visible ? amount * presence(opacity) : 0
    if (a <= 0) {
      this.hide()
      return
    }
    placeEcho(this.rim.mesh, 0, 0, this.mesh.matrixWorld)
    placeEcho(this.aura.mesh, 0, 0, this.mesh.matrixWorld)
    placeEcho(this.mask, 0, 0, this.mesh.matrixWorld)
    this.mask.visible = true
    // A flat fill's light falls only outside it — so it never tints a
    // translucent or max-blended fill (a letter) from beneath.
    const side = this.flat ? outsideSign(this.mesh.matrixWorld, camera) : 0
    this.rim.mesh.userData[RIBBON_KEYS.side] = side
    this.aura.mesh.userData[RIBBON_KEYS.side] = side
    const shown = { fraction: 1, erased: 0, opacity: 1 }
        styleEcho(this.rim, shown, { alpha: a * RIM_ALPHA, tint: GOLD, widthPx: 2 * RIM_PX, innerPx: 0, sink: SINK })
    styleEcho(this.aura, shown, { alpha: a * AURA_ALPHA, tint: AURA, widthPx: 2 * AURA_PX, innerPx: 0, sink: SINK })
  }

  hide(): void {
    this.rim.mesh.visible = false
    this.aura.mesh.visible = false
    this.mask.visible = false
  }

  /** Its meshes — a clip on its fill applies to them too. */
  meshes(): THREE.Mesh[] {
    return [this.rim.mesh, this.aura.mesh, this.mask]
  }
}
