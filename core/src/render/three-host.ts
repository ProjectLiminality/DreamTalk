/**
 * The vanilla-Three WebGPU host — the first adapter over the host
 * contract (mount / renderFrame(t) / dispose). The framework owns t;
 * whoever mounts this requests frames.
 *
 * Stroke rendering (PLAN Ch 4 groundwork): Circle/Square/Polygon/Arc →
 * wide-line polylines (Line2NodeMaterial, screen-px width from the
 * holon's `stroke` param — the 2021 Sketch & Toon look is constant
 * pixel width regardless of depth, see parts/index.ts).
 *
 * Draw-on technique — DASHED, not instanceCount. Verified against
 * three 0.185.1 sources: Line2NodeMaterial with `dashed: true` reads
 * the `instanceDistanceStart/End` attributes (written by
 * LineSegments2.computeLineDistances(), webgpu variant included) and
 * discards fragments where `lineDistance mod (dashSize + gapSize) >
 * dashSize`. With gapSize > totalLength there is exactly one dash
 * starting at arc length 0, so animating the dash length = creation ×
 * totalLength is a CONTINUOUS arc-length draw-on — sub-segment smooth,
 * unlike the old geometry.instanceCount route which popped whole
 * segments. Two dash-mode tradeoffs (both acceptable at 2–3px):
 * round endcaps are discarded (butt caps), and the dash front edge is
 * a hard discard (no AA across the cut) — a crisp perpendicular wipe,
 * which is exactly what a draw-on tip should look like.
 *
 * GOTCHA (cost a debugging session): the dash length must be driven
 * through a per-material TSL uniform (`material.dashSizeNode`), NOT the
 * plain `material.dashSize` property. NodeMaterialObserver's
 * refreshUniforms list does not monitor the dash properties, and all
 * identically-configured stroke materials share one observer (one
 * cacheKey), so a stroke whose transform is static never re-uploads a
 * changed `dashSize` — it renders frozen at its first visible frame.
 * Setting any node property flips the observer's `hasNode`, forcing a
 * refresh every frame, and gives each material its own uniform besides.
 *
 * The full TSL ribbon (caps/joins control, variable width) remains Ch 4.
 */

import * as THREE from "three/webgpu"
import { uniform } from "three/tsl"
import { Line2 } from "three/addons/lines/webgpu/Line2.js"
import { LineGeometry } from "three/addons/lines/LineGeometry.js"
import type { Dream } from "../dream"
import { Holon } from "../holon"
import { Arc, Circle, Polygon, Square, Stroke } from "../parts/index"
import type { Color } from "../constants"

const STROKE_SEGMENTS = 128

interface StrokeBinding {
  holon: Stroke
  line: Line2
  material: THREE.Line2NodeMaterial
  totalLength: number
  /** The per-material dash-length uniform: drawn arc length in local units. */
  drawn: { value: number }
}

interface GroupBinding {
  holon: Holon
  group: THREE.Group
}

const polyline = (holon: Stroke): THREE.Vector3[] | undefined => {
  if (holon instanceof Circle) {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= STROKE_SEGMENTS; i++) {
      const a = (i / STROKE_SEGMENTS) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * holon.radius.value, Math.sin(a) * holon.radius.value, 0))
    }
    return pts
  }
  if (holon instanceof Square) {
    const s = holon.size.value / 2
    return [
      new THREE.Vector3(-s, -s, 0),
      new THREE.Vector3(s, -s, 0),
      new THREE.Vector3(s, s, 0),
      new THREE.Vector3(-s, s, 0),
      new THREE.Vector3(-s, -s, 0),
    ]
  }
  if (holon instanceof Polygon) {
    const pts: THREE.Vector3[] = []
    const n = holon.sides.value
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 2
      pts.push(new THREE.Vector3(Math.cos(a) * holon.radius.value, Math.sin(a) * holon.radius.value, 0))
    }
    return pts
  }
  if (holon instanceof Arc) {
    const pts: THREE.Vector3[] = []
    const a0 = holon.startAngle.value
    const a1 = holon.endAngle.value
    for (let i = 0; i <= STROKE_SEGMENTS; i++) {
      const a = a0 + (i / STROKE_SEGMENTS) * (a1 - a0)
      pts.push(new THREE.Vector3(Math.cos(a) * holon.radius.value, Math.sin(a) * holon.radius.value, 0))
    }
    return pts
  }
  return undefined
}

const arcLength = (pts: THREE.Vector3[]): number => {
  let sum = 0
  for (let i = 1; i < pts.length; i++) sum += pts[i]!.distanceTo(pts[i - 1]!)
  return sum
}

export class ThreeHost {
  readonly renderer: THREE.WebGPURenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly dream: Dream
  private readonly groups: GroupBinding[] = []
  private readonly strokes: StrokeBinding[] = []

  private constructor(dream: Dream, canvas: HTMLCanvasElement) {
    this.dream = dream
    this.renderer = new THREE.WebGPURenderer({ canvas, antialias: true })
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000000)
    this.camera = new THREE.PerspectiveCamera(53.13, 16 / 9, 1, 100000)
  }

  static async mount(dream: Dream, canvas: HTMLCanvasElement): Promise<ThreeHost> {
    const host = new ThreeHost(dream, canvas)
    await host.renderer.init()
    host.renderer.setSize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height, false)
    dream.build()
    for (const root of dream.roots) host.attach(root, host.scene)
    return host
  }

  private attach(holon: Holon, parent: THREE.Object3D): void {
    const group = new THREE.Group()
    parent.add(group)
    this.groups.push({ holon, group })

    if (holon instanceof Stroke) {
      const pts = polyline(holon)
      if (pts) {
        const geometry = new LineGeometry()
        geometry.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]))
        const totalLength = arcLength(pts)
        const material = new THREE.Line2NodeMaterial({
          color: 0xffffff,
          linewidth: holon.stroke.value,
          worldUnits: false,
          transparent: true,
          dashed: true,
        })
        // One dash covering [0, drawn]; gap longer than the whole
        // stroke so no second dash ever appears. Distances are in the
        // geometry's local units (pre-transform), so draw-on fraction is
        // independent of holon scale.
        const drawn = uniform(totalLength)
        material.dashSizeNode = drawn
        material.gapSize = totalLength * 2
        material.scale = 1
        const line = new Line2(geometry, material)
        line.computeLineDistances()
        group.add(line)
        this.strokes.push({ holon, line, material, totalLength, drawn })
      }
    }

    for (const part of holon.parts) this.attach(part, group)
  }

  /** Deterministic: sample the timeline at t, sync the scene, render. */
  async renderFrame(t: number): Promise<void> {
    this.dream.applyAt(t)
    this.sync()
    await this.renderer.render(this.scene, this.camera)
  }

  private sync(): void {
    for (const { holon, group } of this.groups) {
      group.position.set(holon.x.value, holon.y.value, holon.z.value)
      group.rotation.set(holon.p.value, holon.h.value, holon.b.value)
      const s = holon.scale.value
      group.scale.set(s, s, s)
    }
    for (const { holon, line, material, totalLength, drawn } of this.strokes) {
      const creation = holon.creation.value
      drawn.value = creation * totalLength
      line.visible = creation > 0 && holon.opacity.value > 0
      material.opacity = holon.opacity.value
      const c: Color = holon.tint.value
      material.color.setRGB(c.r, c.g, c.b)
    }
    const obs = this.dream.observer
    const r = obs.radius.value
    const phi = obs.phi.value
    const theta = obs.theta.value
    this.camera.position.set(
      r * Math.sin(phi) * Math.cos(theta) + obs.x.value,
      r * Math.sin(theta) + obs.y.value,
      r * Math.cos(phi) * Math.cos(theta),
    )
    this.camera.lookAt(obs.x.value, obs.y.value, 0)
    this.camera.zoom = obs.zoom.value
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    this.renderer.dispose()
  }
}
