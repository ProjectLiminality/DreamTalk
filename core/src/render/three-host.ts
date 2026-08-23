/**
 * The vanilla-Three WebGPU host — the first adapter over the host
 * contract (mount / renderFrame(t) / dispose). The framework owns t;
 * whoever mounts this requests frames.
 *
 * Stroke rendering (PLAN Ch 4): every stroke — Circle/Square/Polygon/
 * Arc and the cylinder's caps + silhouette generators — renders
 * through the TSL ribbon pipeline (render/ribbon.ts): instanced
 * segment quads expanded to constant SCREEN-PIXEL width (the 2021
 * Sketch & Toon look), analytic capsule-SDF anti-aliasing, round
 * caps/joins, and arc-length draw-on with an AA'd round pen tip.
 * The Line2/dash era is gone; its hard-won lesson lives on in
 * ribbon.ts (animated material values must be TSL uniform nodes —
 * NodeMaterialObserver never watches plain props).
 *
 * Param-driven geometry regen: static stroke polylines are rebuilt
 * when their shape params change (editor sliders) via a cheap
 * per-frame dirty-check — a few floats compared per stroke in sync();
 * a rebuild costs one O(segments) repack + buffer upload. Stroke
 * width/tint/opacity/creation are uniforms and cost nothing to
 * animate.
 */

import * as THREE from "three/webgpu"
import type { Dream } from "../dream"
import { Holon } from "../holon"
import { Arc, Circle, Cylinder, Polygon, Square, Stroke } from "../parts/index"
import type { Color } from "../constants"
import { RibbonStroke } from "./ribbon"
import { generatorPoint, silhouetteAngles } from "./silhouette"

const STROKE_SEGMENTS = 128

interface StrokeBinding {
  holon: Stroke
  ribbon: RibbonStroke
  /** Shape-param signature for the geometry-regen dirty-check. */
  shapeKey: number[]
}

interface GroupBinding {
  holon: Holon
  group: THREE.Group
}

/**
 * A cylinder as four strokes: two cap circles (full circles, no
 * hidden-line removal — the 2021 look) and two mantle silhouette
 * generators recomputed analytically each frame from the camera position
 * in cylinder-local space (render/silhouette.ts).
 */
interface CylinderBinding {
  holon: Cylinder
  group: THREE.Group
  topCap: RibbonStroke
  bottomCap: RibbonStroke
  lineA: RibbonStroke
  lineB: RibbonStroke
  /** Cap geometry cache key — regenerate only when radius/height change. */
  capRadius: number
  capHeight: number
}

const capPolyline = (radius: number, y: number): THREE.Vector3[] => {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= STROKE_SEGMENTS; i++) {
    const a = (i / STROKE_SEGMENTS) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius))
  }
  return pts
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

/** The params whose change requires re-sampling the polyline. */
const shapeKey = (holon: Stroke): number[] => {
  if (holon instanceof Circle) return [holon.radius.value]
  if (holon instanceof Square) return [holon.size.value]
  if (holon instanceof Polygon) return [holon.radius.value, holon.sides.value]
  if (holon instanceof Arc)
    return [holon.radius.value, holon.startAngle.value, holon.endAngle.value]
  return []
}

const keysEqual = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i])

export class ThreeHost {
  readonly renderer: THREE.WebGPURenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly dream: Dream
  private readonly groups: GroupBinding[] = []
  private readonly strokes: StrokeBinding[] = []
  private readonly cylinders: CylinderBinding[] = []

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

    if (holon instanceof Cylinder) {
      const width = holon.stroke.value
      const r = holon.radius.value
      const h = holon.height.value
      const binding: CylinderBinding = {
        holon,
        group,
        topCap: new RibbonStroke(width),
        bottomCap: new RibbonStroke(width),
        lineA: new RibbonStroke(width),
        lineB: new RibbonStroke(width),
        capRadius: r,
        capHeight: h,
      }
      binding.topCap.setPoints(capPolyline(r, h / 2))
      binding.bottomCap.setPoints(capPolyline(r, -h / 2))
      group.add(binding.topCap.mesh, binding.bottomCap.mesh, binding.lineA.mesh, binding.lineB.mesh)
      this.cylinders.push(binding)
    } else if (holon instanceof Stroke) {
      const pts = polyline(holon)
      if (pts) {
        const ribbon = new RibbonStroke(holon.stroke.value)
        ribbon.setPoints(pts)
        group.add(ribbon.mesh)
        this.strokes.push({ holon, ribbon, shapeKey: shapeKey(holon) })
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
    for (const binding of this.strokes) {
      const { holon, ribbon } = binding
      const key = shapeKey(holon)
      if (!keysEqual(key, binding.shapeKey)) {
        binding.shapeKey = key
        const pts = polyline(holon)
        if (pts) ribbon.setPoints(pts)
      }
      const tint: Color = holon.tint.value
      ribbon.style(holon.creation.value, holon.opacity.value, tint, holon.stroke.value)
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

    // View-dependent strokes need finished world matrices AND the final
    // camera position for this frame — so they come last.
    if (this.cylinders.length > 0) {
      this.scene.updateMatrixWorld(true)
      for (const binding of this.cylinders) this.syncCylinder(binding)
    }
  }

  private syncCylinder(binding: CylinderBinding): void {
    const { holon, group, topCap, bottomCap, lineA, lineB } = binding
    const radius = holon.radius.value
    const height = holon.height.value

    if (radius !== binding.capRadius || height !== binding.capHeight) {
      topCap.setPoints(capPolyline(radius, height / 2))
      bottomCap.setPoints(capPolyline(radius, -height / 2))
      binding.capRadius = radius
      binding.capHeight = height
    }

    // The silhouette generators, from the camera in cylinder-local space.
    const camLocal = group.worldToLocal(this.camera.position.clone())
    const angles = silhouetteAngles(camLocal.x, camLocal.z, radius)
    if (angles) {
      const set = (line: RibbonStroke, theta: number) => {
        const lo = generatorPoint(theta, radius, -height / 2)
        const hi = generatorPoint(theta, radius, height / 2)
        line.setPoints([new THREE.Vector3(...lo), new THREE.Vector3(...hi)])
      }
      set(lineA, angles.thetaA)
      set(lineB, angles.thetaB)
    }

    // Draw-on: the four strokes run sequentially within the holon's one
    // creation param, windows proportioned by arc length (S&T "single"
    // stroke method): top cap → bottom cap → generator A → generator B.
    const cap = 2 * Math.PI * radius
    const total = 2 * cap + 2 * height
    const bounds = [0, cap / total, (2 * cap) / total, (2 * cap + height) / total, 1]
    const creation = holon.creation.value
    const opacity = holon.opacity.value
    const tint: Color = holon.tint.value
    const width = holon.stroke.value
    const window = (a: number, b: number) =>
      Math.min(1, Math.max(0, (creation - a) / (b - a)))
    topCap.style(window(bounds[0]!, bounds[1]!), opacity, tint, width)
    bottomCap.style(window(bounds[1]!, bounds[2]!), opacity, tint, width)
    const mantleVisible = angles !== undefined
    lineA.style(mantleVisible ? window(bounds[2]!, bounds[3]!) : 0, opacity, tint, width)
    lineB.style(mantleVisible ? window(bounds[3]!, bounds[4]!) : 0, opacity, tint, width)
  }

  dispose(): void {
    this.renderer.dispose()
  }
}
