/**
 * Where a hand's spark stands in the scene (demo/handplay.ts): the Leap is
 * spatial, so the pinch point is a point in SPACE — under the hand's screen
 * point, at a depth the hand sets: its box's depth spans a cube around the
 * focus, as deep as the view is tall there (0 the focus plane, −1 nearer
 * the eye, +1 beyond). Read from the host's live camera, so it follows every
 * orbit, pan and dolly.
 */

import * as THREE from "three/webgpu"
import type { ThreeHost } from "../src/render/three-host"
import type { Spark } from "./game"

/** The spark's reach for a pick, in the view's half-heights at the focus. */
const REACH = 0.12

export interface SparkPlace {
  spark: Spark
  /** How large it looks against the same thing at the focus (perspective; 1 orthographic). */
  scale: number
}

export const sparkSpace = (host: ThreeHost) => {
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const forward = new THREE.Vector3()
  const focus = new THREE.Vector3()
  return (clientX: number, clientY: number, depth: number): SparkPlace | undefined => {
    const cam = host.camera
    const rect = host.renderer.domElement.getBoundingClientRect()
    if (!rect.width || !rect.height) return undefined
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, 1 - ((clientY - rect.top) / rect.height) * 2)
    ray.setFromCamera(ndc, cam)
    const o = ray.ray.origin
    const d = ray.ray.direction
    cam.getWorldDirection(forward)
    const obs = host.dream.observer
    focus.set(obs.x.value, obs.y.value, obs.z.value)
    // How far ahead the focus plane is, and the view's half-height there.
    const ahead = focus.sub(o).dot(forward)
    const persp = cam instanceof THREE.PerspectiveCamera
    const half = persp ? ahead * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) : (cam.top - cam.bottom) / 2 / (cam.zoom || 1)
    // Never through the eye: the nearest the spark comes is a tenth of the way.
    const at = Math.max(ahead * 0.1, ahead + depth * half)
    const t = at / Math.max(d.dot(forward), 1e-6)
    const p = { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t }
    return { spark: { p, eye: { x: o.x, y: o.y, z: o.z }, radius: REACH * half }, scale: persp ? ahead / at : 1 }
  }
}
