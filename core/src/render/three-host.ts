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
import { orthoHalfHeight, type Dream } from "../dream"
import { Holon } from "../holon"
import {
  Arc,
  Circle,
  Cylinder,
  Ellipse,
  Line,
  Polygon,
  Rectangle,
  Square,
  Stroke,
  rectanglePolyline,
  rephasePolyline,
  type Vec3Like,
} from "../parts/index"
import type { Color } from "../constants"
import { RibbonStroke } from "./ribbon"
import { FillShape, ellipsePolygon } from "./fill"
import { generatorPoint, silhouetteAngles } from "./silhouette"

const STROKE_SEGMENTS = 128

interface StrokeBinding {
  holon: Stroke
  ribbon: RibbonStroke
  /** Shape-param signature for the geometry-regen dirty-check. */
  shapeKey: number[]
}

/** A filled flat shape (Ellipse with filled=true): creation = fill-in. */
interface FillBinding {
  holon: Ellipse
  fill: FillShape
  shapeKey: number[]
}

/**
 * An arrowhead riding a Line endpoint — a small filled triangle sized
 * from the stroke width (the S&T end-cap look, ~5×w long by ~4.4×w
 * wide, calibrated against refs/video-01/frame_084.png). It fades in
 * as the draw front arrives at its endpoint and out as the erase
 * front consumes it.
 */
interface ArrowBinding {
  holon: Line
  fill: FillShape
  atStart: boolean
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

const basePolyline = (holon: Stroke): THREE.Vector3[] | undefined => {
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
  if (holon instanceof Rectangle) {
    return rectanglePolyline(holon.width.value, holon.height.value, holon.rounding.value).map(
      (p) => new THREE.Vector3(p.x, p.y, p.z),
    )
  }
  if (holon instanceof Ellipse) {
    if (holon.filled.value) return undefined // rendered by its FillShape
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= STROKE_SEGMENTS; i++) {
      const a = (i / STROKE_SEGMENTS) * Math.PI * 2
      pts.push(
        new THREE.Vector3(Math.cos(a) * holon.radiusX.value, Math.sin(a) * holon.radiusY.value, 0),
      )
    }
    return pts
  }
  if (holon instanceof Line) {
    if (holon.points.length < 2) return undefined
    return holon.points.map((p) => new THREE.Vector3(p.x, p.y, p.z))
  }
  return undefined
}

/**
 * The stroke's outline as the pen actually walks it: the primitive's own
 * geometry, re-phased to its `drawStart` and wound to its `drawReversed`
 * (parts/index.ts: rephasePolyline). Open strokes pass through untouched.
 */
const polyline = (holon: Stroke): THREE.Vector3[] | undefined => {
  const pts = basePolyline(holon)
  if (!pts) return undefined
  const phase = holon.drawStart.value
  const reversed = holon.drawReversed.value
  if (phase === 0 && !reversed) return pts
  return rephasePolyline(pts, phase, reversed).map((p) => new THREE.Vector3(p.x, p.y, p.z))
}

/**
 * The arrowhead triangle for one Line endpoint, in the line's local
 * space, pointing outward along the end segment.
 *
 * Sketch & Toon's arrow line-end is a cap of "7 x 5" in the same pixel
 * units the thickness is stated in, i.e. a triangle 5*T/2 long and
 * 7*T/2 across for a stroke of thickness T, sitting with its BASE on the
 * line's endpoint and its tip beyond it — the line stops where the head
 * begins. refs/video-01/frames5/f0428 measures exactly that: the S04
 * gradient's axis runs to x = 960 (world +250) and the head occupies
 * 960..972 with an 18px base, against the 12.9px / 17.9px those
 * factors predict at the 1.28 px-per-unit of that scene's camera.
 *
 * Sized in WORLD units at that same 1.28 px/unit, since the polygon is
 * world geometry and has no camera here; a true screen-space cap is
 * still future work, and off-canonical distances will read a little
 * large or small.
 */
const ARROW_PX_PER_UNIT = 1.28
/** S&T cap length, in stroke widths: 5/2 pixel units per width. */
const ARROW_LENGTH_FACTOR = 2.5 / ARROW_PX_PER_UNIT
/** S&T cap half-width, in stroke widths: 7/2 pixel units across. */
const ARROW_HALF_WIDTH_FACTOR = 1.75 / ARROW_PX_PER_UNIT

/**
 * Walk a polyline to `progress` of its arc length, returning the point
 * there and the unit direction of travel at it.
 */
const walkTo = (
  points: readonly Vec3Like[],
  progress: number,
): { tip: THREE.Vector3; dir: THREE.Vector3 } | undefined => {
  const vec = (p: Vec3Like) => new THREE.Vector3(p.x, p.y, p.z)
  const seg: number[] = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const d = vec(points[i + 1]!).sub(vec(points[i]!)).length()
    seg.push(d)
    total += d
  }
  if (total <= 0) return undefined
  let target = progress * total
  let i = 0
  while (i < seg.length - 1 && target > seg[i]!) {
    target -= seg[i]!
    i++
  }
  const a = vec(points[i]!)
  const b = vec(points[i + 1]!)
  const delta = b.clone().sub(a)
  if (delta.lengthSq() <= 1e-12) return undefined
  const u = seg[i]! > 0 ? Math.min(1, target / seg[i]!) : 0
  return { tip: a.clone().addScaledVector(delta, u), dir: delta.normalize() }
}
const arrowPolygon = (
  points: readonly Vec3Like[],
  atStart: boolean,
  widthPx: number,
  progress = 1,
): Vec3Like[] | undefined => {
  if (points.length < 2) return undefined
  const ordered = atStart ? [...points].reverse() : points
  // The head rides the PEN, not the endpoint: Sketch & Toon draws a
  // line-end cap on the stroke's current end, so while a line draws on,
  // its arrow travels with the front and only settles when the front
  // arrives. refs/video-01/frames5 f0419-f0427 track the S04 gradient's
  // head across x = 326, 377, 466, 577, 694, 805, 897, 952, 960 as the
  // line advances — always at the tip, never parked at the destination.
  const walked = walkTo(ordered, Math.min(1, Math.max(0, progress)))
  if (!walked) return undefined
  const { tip, dir } = walked
  const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1))
  if (side.lengthSq() < 1e-12) side.crossVectors(dir, new THREE.Vector3(0, 1, 0))
  side.normalize()
  // The endpoint is the BASE of the head; the apex sits beyond it.
  const length = widthPx * ARROW_LENGTH_FACTOR
  const halfWidth = widthPx * ARROW_HALF_WIDTH_FACTOR
  const apex = tip.clone().addScaledVector(dir, length)
  const a = tip.clone().addScaledVector(side, halfWidth)
  const b = tip.clone().addScaledVector(side, -halfWidth)
  return [
    { x: apex.x, y: apex.y, z: apex.z },
    { x: a.x, y: a.y, z: a.z },
    { x: b.x, y: b.y, z: b.z },
  ]
}

/** The params whose change requires re-sampling the polyline. */
const shapeKey = (holon: Stroke): number[] => {
  const phase = [holon.drawStart.value, holon.drawReversed.value ? 1 : 0]
  if (holon instanceof Circle) return [holon.radius.value, ...phase]
  if (holon instanceof Square) return [holon.size.value, ...phase]
  if (holon instanceof Polygon) return [holon.radius.value, holon.sides.value, ...phase]
  if (holon instanceof Arc)
    return [holon.radius.value, holon.startAngle.value, holon.endAngle.value]
  if (holon instanceof Rectangle)
    return [holon.width.value, holon.height.value, holon.rounding.value, ...phase]
  if (holon instanceof Ellipse) return [holon.radiusX.value, holon.radiusY.value, ...phase]
  if (holon instanceof Line) return holon.points.flatMap((p) => [p.x, p.y, p.z])
  return []
}

/** Arrow geometry depends on the endpoints and the stroke width. */
const arrowKey = (holon: Line): number[] => [...shapeKey(holon), holon.stroke.value]

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

const keysEqual = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i])

export class ThreeHost {
  readonly renderer: THREE.WebGPURenderer
  readonly scene: THREE.Scene
  /** The active camera — whichever projection the observer currently asks for. */
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  private readonly perspCamera: THREE.PerspectiveCamera
  private readonly orthoCamera: THREE.OrthographicCamera
  readonly dream: Dream
  private readonly groups: GroupBinding[] = []
  private readonly strokes: StrokeBinding[] = []
  private readonly cylinders: CylinderBinding[] = []
  private readonly fills: FillBinding[] = []
  private readonly arrows: ArrowBinding[] = []
  /** Fills stack over strokes and over earlier fills — see fill.ts. */
  private nextFillOrder = 1

  private constructor(dream: Dream, canvas: HTMLCanvasElement) {
    this.dream = dream
    this.renderer = new THREE.WebGPURenderer({ canvas, antialias: true })
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000000)
    this.perspCamera = new THREE.PerspectiveCamera(53.13, 16 / 9, 1, 100000)
    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100000, 100000)
    this.camera = this.perspCamera
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
    } else if (holon instanceof Ellipse && holon.filled.value) {
      const fill = new FillShape(this.nextFillOrder++)
      fill.setPolygon(ellipsePolygon(holon.radiusX.value, holon.radiusY.value))
      group.add(fill.mesh)
      this.fills.push({ holon, fill, shapeKey: shapeKey(holon) })
    } else if (holon instanceof Stroke) {
      const pts = polyline(holon)
      if (pts) {
        const ribbon = new RibbonStroke(holon.stroke.value)
        ribbon.setPoints(pts)
        group.add(ribbon.mesh)
        this.strokes.push({ holon, ribbon, shapeKey: shapeKey(holon) })
      }
      if (holon instanceof Line) {
        for (const atStart of [false, true]) {
          if (!(atStart ? holon.arrowStart : holon.arrowEnd).value) continue
          const polygon = arrowPolygon(holon.points, atStart, holon.stroke.value)
          if (!polygon) continue
          const fill = new FillShape(this.nextFillOrder++)
          fill.setPolygon(polygon)
          group.add(fill.mesh)
          this.arrows.push({ holon, fill, atStart, shapeKey: arrowKey(holon) })
        }
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
      ribbon.style(
        holon.creation.value,
        holon.opacity.value,
        tint,
        holon.stroke.value,
        holon.erasure.value,
      )
    }
    for (const binding of this.fills) {
      const { holon, fill } = binding
      const key = shapeKey(holon)
      if (!keysEqual(key, binding.shapeKey)) {
        binding.shapeKey = key
        fill.setPolygon(ellipsePolygon(holon.radiusX.value, holon.radiusY.value))
      }
      // Fill semantics: creation IS the fill-in, composed with fade.
      fill.style(holon.creation.value * holon.opacity.value, holon.tint.value)
    }
    for (const binding of this.arrows) {
      const { holon, fill, atStart } = binding
      const key = arrowKey(holon)
      // The head rides the pen: it sits at whatever fraction of the line
      // is currently drawn, so it travels with the draw front and, as the
      // erase front eats the tail, keeps station at the surviving end.
      // Its position changes every frame, so the shapeKey cache cannot
      // gate the rebuild — only the visibility can.
      const creation = holon.creation.value
      const erasure = holon.erasure.value
      // Only the DRAW front carries the head. The erase front does not:
      // f0430/f0432/f0434 keep the S04 gradient's head parked at its
      // destination (cols 960-967) while the tail retreats behind it —
      // the head belongs to the stroke's end, and erasing eats the start.
      const progress = atStart ? 0 : creation
      const present = atStart
        ? clamp01(creation / 0.02) * (1 - clamp01(erasure / 0.02))
        : clamp01(creation / 0.02) * (1 - clamp01((erasure - 0.92) / 0.08))
      if (present > 0) {
        binding.shapeKey = key
        const polygon = arrowPolygon(holon.points, atStart, holon.stroke.value, progress)
        if (polygon) fill.setPolygon(polygon)
      }
      fill.style(present * holon.opacity.value, holon.tint.value)
    }
    this.syncCamera()

    // View-dependent strokes need finished world matrices AND the final
    // camera position for this frame — so they come last.
    if (this.cylinders.length > 0) {
      this.scene.updateMatrixWorld(true)
      for (const binding of this.cylinders) this.syncCylinder(binding)
    }
  }

  /**
   * The 2021 projection, rebuilt from pydeation's rig (see dream.ts for the
   * derivation and citations). The camera orbits the focus point (observer
   * x, y) at `radius`: `phi` azimuth about +Y, `theta` elevation, and at
   * phi = theta = 0 it sits on -Z looking toward +Z — the convention of the
   * modern C4D rig (objects/camera_objects.py:217-221). `tilt` then rolls
   * it about its own view axis, which is what a FROZEN bank does: it turns
   * the picture, it does not orbit the camera.
   *
   * Perspective zoom is realized as distance (radius / zoom), never as
   * focal length; orthographic zoom is the CAMERA_ZOOM framing ratio.
   */
  private syncCamera(): void {
    const obs = this.dream.observer
    const phi = obs.phi.value
    const theta = obs.theta.value
    const zoom = obs.zoom.value
    const ortho = obs.orthographic.value
    // Pan: the observer's x/y slide the focus point across the view plane,
    // which is what pydeation's camera_position (x, z in its top-view world)
    // does. z stays 0, as it always has.
    const focus = new THREE.Vector3(obs.x.value, obs.y.value, 0)

    // Orthographic framing is set by zoom alone, so the distance only has to
    // clear the geometry; perspective framing IS the distance.
    const r = ortho ? obs.radius.value : obs.radius.value / (zoom || 1)
    // The framework's long-standing spherical convention — unchanged, so
    // existing scenes orbit exactly as they did.
    const offset = new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(theta),
      r * Math.cos(phi) * Math.cos(theta),
    )

    const camera = this.selectCamera(ortho)
    camera.position.copy(focus).add(offset)
    camera.up.set(0, 1, 0)
    camera.lookAt(focus)
    // Roll about the view axis (applied after lookAt, in camera space).
    if (obs.tilt.value !== 0) camera.rotateZ(obs.tilt.value)

    const aspect = this.aspect()
    if (camera instanceof THREE.OrthographicCamera) {
      const halfH = orthoHalfHeight(zoom || 1, aspect)
      const halfW = halfH * aspect
      camera.left = -halfW
      camera.right = halfW
      camera.top = halfH
      camera.bottom = -halfH
      camera.zoom = 1
    } else {
      camera.aspect = aspect
      // The observer states fov the way three.js does: vertically.
      camera.fov = THREE.MathUtils.radToDeg(obs.fov.value)
      camera.zoom = 1
    }
    camera.updateProjectionMatrix()
  }

  /** Scenes are composed for 16:9 and letterboxed, never re-framed. */
  private aspect(): number {
    return 16 / 9
  }

  /** Swap the active camera when the observer's projection mode changes. */
  private selectCamera(ortho: boolean): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    this.camera = ortho ? this.orthoCamera : this.perspCamera
    return this.camera
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
    // The erase front consumes them through the same partition.
    const cap = 2 * Math.PI * radius
    const total = 2 * cap + 2 * height
    const bounds = [0, cap / total, (2 * cap) / total, (2 * cap + height) / total, 1]
    const creation = holon.creation.value
    const erasure = holon.erasure.value
    const opacity = holon.opacity.value
    const tint: Color = holon.tint.value
    const width = holon.stroke.value
    const window = (v: number, a: number, b: number) =>
      Math.min(1, Math.max(0, (v - a) / (b - a)))
    const sub = (line: RibbonStroke, drawn: number, a: number, b: number) =>
      line.style(drawn, opacity, tint, width, window(erasure, a, b))
    sub(topCap, window(creation, bounds[0]!, bounds[1]!), bounds[0]!, bounds[1]!)
    sub(bottomCap, window(creation, bounds[1]!, bounds[2]!), bounds[1]!, bounds[2]!)
    const mantleVisible = angles !== undefined
    sub(lineA, mantleVisible ? window(creation, bounds[2]!, bounds[3]!) : 0, bounds[2]!, bounds[3]!)
    sub(lineB, mantleVisible ? window(creation, bounds[3]!, bounds[4]!) : 0, bounds[3]!, bounds[4]!)
  }

  dispose(): void {
    this.renderer.dispose()
  }
}
