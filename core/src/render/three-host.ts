/**
 * The vanilla-Three WebGPU host — the first adapter over the host
 * contract (mount / renderFrame(t) / dispose). The framework owns t;
 * whoever mounts this requests frames.
 *
 * v0 scope (PLAN Ch 2 smoke): holon transforms → THREE.Group hierarchy;
 * Circle/Square/Polygon → wide-line polylines (Line2NodeMaterial);
 * creation → segment-wise draw-on via geometry.instanceCount;
 * opacity/tint live-bound. The TSL ribbon stroke replaces this in Ch 4.
 */

import * as THREE from "three/webgpu"
import { Line2 } from "three/addons/lines/webgpu/Line2.js"
import { LineGeometry } from "three/addons/lines/LineGeometry.js"
import type { Dream } from "../dream"
import { Holon } from "../holon"
import { Circle, Polygon, Square } from "../parts/index"
import type { Color } from "../constants"

const STROKE_SEGMENTS = 128

interface StrokeBinding {
  holon: Holon
  line: Line2
  material: THREE.Line2NodeMaterial
  totalSegments: number
  tint: () => Color
}

interface GroupBinding {
  holon: Holon
  group: THREE.Group
}

const polyline = (holon: Holon): THREE.Vector3[] | undefined => {
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
  return undefined
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

    const pts = polyline(holon)
    if (pts) {
      const geometry = new LineGeometry()
      geometry.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]))
      const material = new THREE.Line2NodeMaterial({
        color: 0xffffff,
        linewidth: 3,
        worldUnits: false,
        transparent: true,
      })
      const line = new Line2(geometry, material)
      group.add(line)
      const tintParam = (holon as Circle).tint
      this.strokes.push({
        holon,
        line,
        material,
        totalSegments: pts.length - 1,
        tint: () => tintParam.value,
      })
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
    for (const { holon, line, material, totalSegments, tint } of this.strokes) {
      const drawn = Math.round(holon.creation.value * totalSegments)
      const geo = line.geometry as THREE.InstancedBufferGeometry
      geo.instanceCount = drawn
      line.visible = drawn > 0 && holon.opacity.value > 0
      material.opacity = holon.opacity.value
      const c = tint()
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
