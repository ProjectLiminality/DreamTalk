/**
 * Clip, drawn (src/clip.ts) — the per-fragment half: how much of a pixel
 * lies inside the clip's ellipse on screen.
 *
 * The host projects each clip's disc every frame and writes the ellipse
 * (centre and two semi-axes, device pixels, y down — screenCoordinate's
 * convention) into every clipped mesh's userData. Clipped meshes draw with
 * a VARIANT of their material that multiplies by this coverage (or, for an
 * opaque or depth-only material, discards outside it). Unclipped meshes
 * keep their own materials — not a node of theirs changes.
 */

import * as THREE from "three/webgpu"
import * as TSLTyped from "three/tsl"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { userData, screenCoordinate, vec2, float, min, clamp, length, abs } = TSLTyped as any

/** The per-mesh slots: the ellipse's centre and semi-axes, device px. */
export const CLIP_KEYS = { c: "dtClipC", u: "dtClipU", v: "dtClipV" } as const

/** Give a mesh its clip slots (outside everything until the host writes them). */
export const initClipSlots = (mesh: THREE.Object3D): void => {
  mesh.userData[CLIP_KEYS.c] ??= new THREE.Vector2(-1e9, -1e9)
  mesh.userData[CLIP_KEYS.u] ??= new THREE.Vector2(1, 0)
  mesh.userData[CLIP_KEYS.v] ??= new THREE.Vector2(0, 1)
}

/** The fragment's coverage inside the clip: 1 inside, 0 outside, a 1px ramp at the rim (src/clip.ts clipCoverage). */
export const clipCoverageNode = () => {
  const c = userData(CLIP_KEYS.c, "vec2")
  const u = userData(CLIP_KEYS.u, "vec2")
  const v = userData(CLIP_KEYS.v, "vec2")
  const d = screenCoordinate.xy.sub(c)
  const det = u.x.mul(v.y).sub(u.y.mul(v.x))
  // An edge-on disc is a window of no area: nothing shows through it.
  const flat = abs(det).lessThan(1e-6)
  const safe = flat.select(float(1), det)
  const a = d.x.mul(v.y).sub(d.y.mul(v.x)).div(safe)
  const b = u.x.mul(d.y).sub(u.y.mul(d.x)).div(safe)
  const r = length(vec2(a, b))
  const px = min(length(u), length(v))
  return flat.select(float(0), clamp(float(1).sub(r).mul(px).add(0.5), 0.0, 1.0))
}

const CLIPPED = new WeakMap<THREE.Material, THREE.Material>()

/**
 * The clipped twin of a mesh material (built by node, never by fragment
 * shader): a transparent one fades by the coverage, an opaque or
 * depth-only one discards outside it. One twin per material.
 */
export const clippedMaterial = (base: THREE.Material): THREE.Material => {
  let twin = CLIPPED.get(base)
  if (!twin) {
    const m = (base as THREE.NodeMaterial).clone() as THREE.NodeMaterial
    const cover = clipCoverageNode()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fragment = (base as THREE.NodeMaterial).fragmentNode as any
    if (fragment) {
      // A material that writes its own (premultiplied) output — a Text's
      // glyphs: scale the whole output. Its uniforms are node objects the
      // twin shares, so its owner's per-frame writes still reach it.
      m.fragmentNode = fragment.mul(cover)
    } else if (m.transparent && m.colorWrite !== false) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const own = (base as THREE.NodeMaterial).opacityNode as any
      m.opacityNode = own ? own.mul(cover) : cover
    } else {
      m.maskNode = cover.greaterThan(0.5)
    }
    twin = m
    CLIPPED.set(base, twin)
  }
  return twin
}

/**
 * The meshes under `root` not yet adopted by a clip — what a late arrival
 * (a Text's glyph mesh, laid out asynchronously, or its rebuilt contours)
 * looks like to the host, which adopts them on the next frame.
 */
export const unclippedMeshes = (root: THREE.Object3D, adopted: ReadonlyMap<THREE.Object3D, unknown>): THREE.Mesh[] => {
  const out: THREE.Mesh[] = []
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && !adopted.has(child)) out.push(child)
  })
  return out
}
