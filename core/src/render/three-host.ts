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
import { Text } from "../parts/text"
import { RibbonStroke } from "./ribbon"
import { FillShape, ellipsePolygon } from "./fill"
import { attachText, type TextBinding } from "./text"
import { capArc, capPolylineFrom, generatorPoint, silhouetteAngles } from "./silhouette"
import { screenArcRemap, type ProjectedPoint } from "./screen-arc"

const STROKE_SEGMENTS = 128

/**
 * C4D's Ocylinder rotation-segment default — the number of edges each cap
 * of the 2021 cylinder's contour polygon actually has. It is the unit the
 * draw-on is proportioned in (see syncCylinder).
 */
const CYLINDER_ROTATION_SEGMENTS = 64

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
  /** The Line's own group — the frame the cap polygon is stated in. */
  group: THREE.Group
  /**
   * The ribbon binding of the very line this cap belongs to. The head
   * rides the PEN, and the pen's position is the screen-arc
   * reparametrisation of `creation` (screen-arc.ts), not `creation`
   * itself — so the cap has to ask the same question the stroke asks,
   * of the same binding, or it drifts off the front exactly where the
   * two parametrisations disagree most: a line most of whose world
   * length lies off-frame. Undefined only if the line never got a
   * ribbon (an empty polyline at mount).
   */
  stroke?: StrokeBinding
}

interface GroupBinding {
  holon: Holon
  group: THREE.Group
}

/**
 * A cylinder as FIVE strokes — the contour graph S&T actually walks.
 *
 * Two mantle silhouette generators, recomputed analytically each frame
 * from the camera position in cylinder-local space (render/silhouette.ts),
 * and two cap circles that the generators cut. The cut is what makes five
 * rather than four: the generators land ON the caps, so on the contour
 * graph each cap is two edges, and S&T's stroke connection then decides
 * which of those edges chain into one stroke and which stand alone.
 *
 * Which cap splits is CAMERA-RELATIVE, not local-axis-relative — see the
 * derivation on syncCylinder. The nearer cap is the one whose two arcs
 * are strokes in their own right; the farther cap survives as one closed
 * loop.
 */
interface CylinderBinding {
  holon: Cylinder
  group: THREE.Group
  /** The FAR cap, whole: one closed loop starting on generator A. */
  farCap: RibbonStroke
  /** The NEAR cap's camera-facing arc — the first ink of the whole draw. */
  nearFront: RibbonStroke
  /** The NEAR cap's away-facing arc — the pen returns for it near the end. */
  nearBack: RibbonStroke
  lineA: RibbonStroke
  lineB: RibbonStroke
  /** Cap geometry cache key — the caps' seams ride the silhouette, so the
   *  generator azimuths are part of the key, not only the size. Sign of
   *  the near cap's local y is in it too: a cylinder that turns past
   *  edge-on swaps which cap is near, and the seams follow. */
  capRadius: number
  capHeight: number
  thetaA: number
  thetaB: number
  nearY: number
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
 * Sketch & Toon states the cap in its OWN fields, not as a multiple of
 * the rendered line:
 *
 *   sketch_mat[c4d.OUTLINEMAT_ENDCAP_WIDTH]  = 7
 *   sketch_mat[c4d.OUTLINEMAT_ENDCAP_HEIGHT] = 5
 *      — refs/pydeation-legacy/object/object.py:215-218
 *
 * Those 7 and 5 are the same PIXEL UNITS the thickness is stated in
 * (scene.py's PIXELUNITS_BASEH = 700), and they are HALF-extents, so the
 * drawn cap is 2*7 pixel units across and 2*5 pixel units long. That is
 * `arrowSize` — one pixel unit in rendered pixels, frameHeight / 700 —
 * times the two factors below.
 *
 * They live in a field of their own, which is the whole point: the cap
 * does NOT carry `OUTLINEMAT_THICKNESS_DISTANCE`'s 0.6 attenuation. That
 * strength multiplies the THICKNESS field alone, so when the palette
 * finally applied it (c0a9cc6) every arrowhead in the reproduction
 * shrank by 0.6 along with the lines — while the reference's did not.
 *
 * Measured on refs/video-01/frames5/f0428, where S04's gradient axis
 * runs dead horizontal and the head is unforeshortened (linear light,
 * area/peak per column): shaft 2.90px, head base 14.95px at x = 961
 * tapering linearly to zero at x = 971.6 — a clean triangle 10.9px long
 * and 14.95px across. This mapping predicts 2*5*720/700 = 10.29 and
 * 2*7*720/700 = 14.40; both readings sit ~0.5px high, which is one AA
 * skirt on each measured extent. The old mapping (2.5 and 1.75 STROKE
 * widths) fitted the same numbers only while the stroke was still
 * unattenuated at 5.14px — a coincidence of 5/2 and 7/2, and the reason
 * it survived so long.
 *
 * The cap is a SCREEN-SPACE object, exactly like the stroke width: S&T
 * draws it at a constant pixel size however far away the line runs. So
 * the polygon is world geometry sized per frame from the projected scale
 * at the pen (`syncArrow`), not from a fixed px-per-unit constant. Scene
 * 05 is what forced this: its axes recede to 0.85 px/world-unit, where a
 * cap sized for S04's 1.28 read barely wider than the line.
 */
/** S&T cap length, in pixel units: 2 * ENDCAP_HEIGHT. */
const ARROW_LENGTH_FACTOR = 10
/** S&T cap half-width, in pixel units: ENDCAP_WIDTH (the half-extent). */
const ARROW_HALF_WIDTH_FACTOR = 7

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
  /** One S&T pixel unit in rendered pixels — `Line.arrowSize`. */
  unitPx: number,
  progress = 1,
  /** Local units per screen pixel ALONG the line — 1 keeps the cap in units. */
  unitsPerPixel = 1,
  /**
   * The view direction in the line's own local frame. The head must fan
   * out perpendicular to the line ON SCREEN, which is the direction
   * `dir × view` — for a line running away from the camera any other
   * choice foreshortens the head into the stroke, which is exactly how
   * S05's z-arm lost its arrowhead. Omitted, the head falls back to the
   * flat-scene assumption (perpendicular in the local xy plane).
   */
  viewLocal?: THREE.Vector3,
  /** Local units per screen pixel ACROSS it; defaults to the along reading. */
  unitsPerPixelAcross = unitsPerPixel,
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
  const side = new THREE.Vector3()
  if (viewLocal) side.crossVectors(dir, viewLocal)
  if (side.lengthSq() < 1e-12) side.crossVectors(dir, new THREE.Vector3(0, 0, 1))
  if (side.lengthSq() < 1e-12) side.crossVectors(dir, new THREE.Vector3(0, 1, 0))
  side.normalize()
  // The endpoint is the BASE of the head; the apex sits beyond it.
  const length = unitPx * ARROW_LENGTH_FACTOR * unitsPerPixel
  const halfWidth = unitPx * ARROW_HALF_WIDTH_FACTOR * unitsPerPixelAcross
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
const arrowKey = (holon: Line): number[] => [...shapeKey(holon), holon.arrowSize.value]

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
  /**
   * Text holons — glyph geometry, the Write domino's uniforms, and the
   * traced contours the draw phase strokes (render/text.ts). The group
   * is kept alongside because the contours' inset is stated in screen
   * pixels and has to be converted at this frame's projection.
   */
  private readonly texts: { binding: TextBinding; group: THREE.Object3D }[] = []
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
    // Glyph layout is asynchronous (three-text loads HarfBuzz and the
    // font on first use), so a host carrying Text is not frame-ready the
    // moment it mounts. Awaiting every binding here is what makes a
    // screenshot at an arbitrary t deterministic — without it the first
    // frames a harness captures are silently textless.
    await Promise.all(host.texts.map((t) => t.binding.ready))
    return host
  }

  private attach(holon: Holon, parent: THREE.Object3D): void {
    const group = new THREE.Group()
    parent.add(group)
    this.groups.push({ holon, group })

    if (holon instanceof Text) {
      this.texts.push({ binding: attachText(holon, group), group })
    } else if (holon instanceof Cylinder) {
      const width = holon.stroke.value
      const r = holon.radius.value
      const h = holon.height.value
      const binding: CylinderBinding = {
        holon,
        group,
        farCap: new RibbonStroke(width),
        nearBack: new RibbonStroke(width),
        nearFront: new RibbonStroke(width),
        lineA: new RibbonStroke(width),
        lineB: new RibbonStroke(width),
        capRadius: r,
        capHeight: h,
        // NaN so the first sync always rebuilds the seams from the live camera.
        thetaA: NaN,
        thetaB: NaN,
        nearY: NaN,
      }
      group.add(
        binding.farCap.mesh,
        binding.nearBack.mesh,
        binding.nearFront.mesh,
        binding.lineA.mesh,
        binding.lineB.mesh,
      )
      this.cylinders.push(binding)
    } else if (holon instanceof Ellipse && holon.filled.value) {
      const fill = new FillShape(this.nextFillOrder++)
      fill.setPolygon(ellipsePolygon(holon.radiusX.value, holon.radiusY.value))
      group.add(fill.mesh)
      this.fills.push({ holon, fill, shapeKey: shapeKey(holon) })
    } else if (holon instanceof Stroke) {
      let strokeBinding: StrokeBinding | undefined
      const pts = polyline(holon)
      // A Line's polyline may be DERIVED (parts/curves.ts) and therefore
      // empty at mount and non-empty later — Scene03's section curve
      // starts with the cutting plane clear of the cylinder. Binding it
      // anyway (and letting sync() fill it in) is what lets such a stroke
      // ever appear; a shape holon with no polyline is a real absence.
      if (pts || holon instanceof Line) {
        const ribbon = new RibbonStroke(holon.stroke.value)
        // Attach order IS composite order: a stroke attached after a fill
        // draws over it (MolochEye's pupil over its black iris disk).
        // Stroke-vs-stroke order is a no-op under MAX blending.
        ribbon.mesh.renderOrder = this.nextFillOrder++
        ribbon.setPoints(pts ?? [])
        group.add(ribbon.mesh)
        strokeBinding = { holon, ribbon, shapeKey: shapeKey(holon) }
        this.strokes.push(strokeBinding)
      }
      if (holon instanceof Line) {
        for (const atStart of [false, true]) {
          if (!(atStart ? holon.arrowStart : holon.arrowEnd).value) continue
          const polygon = arrowPolygon(holon.points, atStart, holon.arrowSize.value)
          if (!polygon) continue
          const fill = new FillShape(this.nextFillOrder++)
          fill.setPolygon(polygon)
          group.add(fill.mesh)
          this.arrows.push({
            holon,
            fill,
            atStart,
            shapeKey: arrowKey(holon),
            group,
            stroke: strokeBinding,
          })
        }
      }
    }

    for (const part of holon.parts) this.attach(part, group)
  }

  /**
   * A hook between sampling and syncing, for a host that wants to overlay
   * something on top of the timeline's values (the editor's live layer —
   * see editor/overrides.ts). Left undefined, the frame path is exactly
   * what it always was: sample t, sync, render. The demo page and the
   * gauntlet never set it, so they always see the pure timeline.
   */
  beforeSync?: () => void

  /** Deterministic: sample the timeline at t, sync the scene, render. */
  async renderFrame(t: number): Promise<void> {
    this.dream.applyAt(t)
    this.beforeSync?.()
    this.sync()
    await this.renderer.render(this.scene, this.camera)
  }

  private sync(): void {
    for (const { holon, group } of this.groups) {
      group.position.set(holon.x.value, holon.y.value, holon.z.value)
      // h/p/b ARE C4D's HPB triple, so they must compose the way C4D
      // composes them: M = R_H · R_P · R_B in C4D's axes, which under the
      // fixed axis dictionary (X, Y, Z)c4d → (x, z, y) reads as
      // Rz(b) · Rx(p) · Ry(h) in ours — three's 'ZXY' Euler order, not
      // its 'XYZ' default. Single-axis poses are unaffected (which is why
      // this went unnoticed until S09 turned a rectangle about two axes
      // at once: the wrong order put its corners 43px off the reference).
      group.rotation.set(holon.p.value, holon.h.value, holon.b.value, "ZXY")
      const s = holon.scale.value
      group.scale.set(s, s, s)
    }
    for (const binding of this.strokes) {
      const { holon, ribbon } = binding
      const key = shapeKey(holon)
      if (!keysEqual(key, binding.shapeKey)) {
        binding.shapeKey = key
        // `undefined` from a Line means its derived polyline has emptied
        // out this frame — pass it through so the ribbon empties too.
        const pts = polyline(holon)
        if (pts || holon instanceof Line) ribbon.setPoints(pts ?? [])
      }
      const tint: Color = holon.tint.value
      ribbon.style(
        this.screenArc(binding, holon.creation.value),
        holon.opacity.value,
        tint,
        holon.stroke.value,
        this.screenArc(binding, holon.erasure.value),
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
    this.syncCamera()

    // View-dependent geometry needs finished world matrices AND the final
    // camera for this frame — so it comes last. Arrowheads are among it:
    // an S&T end cap is a constant number of PIXELS, so its world size is
    // a reading of the projection at the pen.
    if (this.cylinders.length > 0 || this.arrows.length > 0 || this.texts.length > 0) {
      this.scene.updateMatrixWorld(true)
      for (const binding of this.cylinders) this.syncCylinder(binding)
      for (const binding of this.arrows) this.syncArrow(binding)
      // Text belongs here too: a letter's traced contour is inset by half
      // a stroke, and a stroke is a count of PIXELS, so how far to pull
      // the contour in is a reading of this frame's projection.
      for (const { binding, group } of this.texts) {
        binding.sync(1 / this.unitsPerPixelAt(group, new THREE.Vector3()))
      }
    }
  }

  /**
   * One arrowhead, sized in screen pixels and parked at the pen.
   *
   * The cap polygon lives in the Line's local space, so its pixel size is
   * whatever the projection makes of it there; `unitsPerPixel` inverts
   * that reading — local units per screen pixel at the head's own
   * position — so the same S&T factors give the same rendered cap
   * whatever the depth or the holon's scale.
   */
  private syncArrow(binding: ArrowBinding): void {
    const { holon, fill, atStart, group } = binding
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
    // The pen's position along the line is the SCREEN-arc
    // reparametrisation of `creation` — the same reading the ribbon
    // takes (screenArc / render/screen-arc.ts). Walking the raw fraction
    // here put the cap wherever world arc length says, which is a
    // different place entirely on a line most of whose world length
    // falls off-frame: S01's y-axis runs world y = -2000 → +400 and
    // starts a thousand pixels below the viewport, so at the first frame
    // of its Create the reference draws its cap at screen y ≈ 712 (the
    // bottom edge — the first visible point) while world arc put ours
    // off-screen entirely. refs/video-01/frames5 f0090-f0094 track that
    // cap up the frame at y = 712, 700, 646, 590, 509.
    const drawn = binding.stroke ? this.screenArc(binding.stroke, creation) : creation
    const progress = atStart ? 0 : drawn
    const present = atStart
      ? clamp01(creation / 0.02) * (1 - clamp01(erasure / 0.02))
      : clamp01(creation / 0.02) * (1 - clamp01((erasure - 0.92) / 0.08))
    if (present > 0) {
      binding.shapeKey = arrowKey(holon)
      const walked = walkTo(atStart ? [...holon.points].reverse() : holon.points, progress)
      // The cap is a screen-space triangle, so its two axes are measured
      // separately: its length runs ALONG the line (foreshortened when
      // the line recedes) and its width across the line as seen.
      const viewLocal = this.viewDirectionIn(group)
      const along = walked ? this.unitsPerPixelAt(group, walked.tip, walked.dir) : 1
      const side = walked
        ? new THREE.Vector3().crossVectors(walked.dir, viewLocal)
        : new THREE.Vector3()
      const across = walked ? this.unitsPerPixelAt(group, walked.tip, side) : 1
      const polygon = arrowPolygon(
        holon.points,
        atStart,
        holon.arrowSize.value,
        progress,
        along,
        viewLocal,
        across,
      )
      if (polygon) fill.setPolygon(polygon)
    }
    fill.style(present * holon.opacity.value, holon.tint.value)
  }

  /** The camera's view direction expressed in a group's local frame. */
  private viewDirectionIn(group: THREE.Object3D): THREE.Vector3 {
    const forward = this.camera.getWorldDirection(new THREE.Vector3())
    const inverse = new THREE.Matrix3().setFromMatrix4(group.matrixWorld).invert()
    return forward.applyMatrix3(inverse).normalize()
  }

  /**
   * Local units per rendered pixel at a point in a group's local space —
   * the inverse of the projection's magnification there. Measured, not
   * derived: step one local unit sideways in screen space and read how
   * far the projected point moved. That covers perspective foreshortening,
   * orthographic framing and any holon scaling on the way down, with one
   * expression and no special cases.
   */
  private unitsPerPixelAt(
    group: THREE.Object3D,
    localPoint: THREE.Vector3,
    /**
     * The LOCAL direction to measure along. Omitted, the reading is taken
     * across the view axis — the isotropic answer, right for anything
     * facing the camera. A direction that recedes from the camera
     * projects SHORTER, and geometry laid along it (an arrowhead on an
     * axis running into the screen) needs that foreshortening in its
     * reading or it renders a fraction of its intended pixel size.
     */
    localDir?: THREE.Vector3,
  ): number {
    const width = this.renderer.domElement.width || 1280
    const height = this.renderer.domElement.height || 720
    const world = localPoint.clone().applyMatrix4(group.matrixWorld)
    const basis = new THREE.Matrix3().setFromMatrix4(group.matrixWorld)
    const sideWorld = new THREE.Vector3()
    if (localDir && localDir.lengthSq() > 1e-12) {
      sideWorld.copy(localDir).applyMatrix3(basis)
    }
    if (sideWorld.lengthSq() < 1e-12) {
      // A step whose world direction is perpendicular to the view — the
      // isotropic reading, with no degenerate head-on case.
      const forward = this.camera.getWorldDirection(new THREE.Vector3())
      sideWorld.crossVectors(forward, new THREE.Vector3(0, 1, 0))
      if (sideWorld.lengthSq() < 1e-12) sideWorld.set(1, 0, 0)
    }
    sideWorld.normalize()
    const a = world.clone().project(this.camera)
    const b = world.clone().add(sideWorld).project(this.camera)
    // NDC spans 2 units across each viewport axis.
    const pixels = Math.hypot((b.x - a.x) * (width / 2), (b.y - a.y) * (height / 2))
    if (!Number.isFinite(pixels) || pixels <= 1e-9) return 1
    // …and back into the group's local units, which the world step is
    // not stated in when the holon carries a scale.
    const scale = new THREE.Vector3().setFromMatrixScale(group.matrixWorld).x || 1
    return 1 / (pixels * scale)
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
    const { holon, group, farCap, nearBack, nearFront, lineA, lineB } = binding
    const radius = holon.radius.value
    const height = holon.height.value

    // The silhouette generators, from the camera in cylinder-local space.
    const camLocal = group.worldToLocal(this.camera.position.clone())
    const angles = silhouetteAngles(camLocal.x, camLocal.z, radius)

    // WHICH CAP IS NEAR is what orders the whole draw, and the camera
    // decides it: `camLocal.y` is the camera's height along the
    // cylinder's own axis, so the cap at +h/2 is the nearer one exactly
    // when camLocal.y > 0. Nothing about local "top" and "bottom"
    // survives the cylinder turning — and in Scene 06 it turns a full
    // revolution — so the roles are stated against the camera and
    // recomputed whenever it moves.
    const nearY = camLocal.y >= 0 ? height / 2 : -height / 2
    const farY = -nearY

    const thetaA = angles?.thetaA ?? 0
    const thetaB = angles?.thetaB ?? Math.PI
    if (
      radius !== binding.capRadius ||
      height !== binding.capHeight ||
      thetaA !== binding.thetaA ||
      thetaB !== binding.thetaB ||
      nearY !== binding.nearY
    ) {
      const v3 = (p: [number, number, number]) => new THREE.Vector3(...p)

      // THE PEN PATH, measured — not fitted — off Scene 06's own 2s
      // cylinder Create, which is the cleanest instance in the whole
      // reference: a STATIC cylinder (nothing else is moving), at a pose
      // the calibrated camera reproduces to the pixel, drawn alone on
      // black over eleven frames (frames5 f0494-f0504).
      //
      // Method: project the cylinder's two cap circles under the solved
      // camera, walk each at 0.5-degree steps, and ask of every frame
      // which steps are lit. Indices run from thetaA (0) with INCREASING
      // theta; thetaB lands at index 330 of 720. The result, per frame:
      //
      //   frame   near cap lit          far cap lit
      //   f0494   [321..332]   n=12     —
      //   f0495   [264..332]   n=69     —
      //   f0496   [185..332]   n=148    —
      //   f0497   [ 93..332]   n=240    —
      //   f0498   n=338  (0..330 whole) n=70   from index 0, increasing
      //   f0499   n=338  FROZEN         n=338
      //   f0500   n=338  FROZEN         n=634
      //   f0501   n=338  FROZEN         n=721  (closed)
      //   f0502   n=655                 n=721
      //   f0503   n=721  (closed)       n=721
      //
      // and, sampling the two generators along their length,
      //
      //   generator B fills from its FAR end toward the near cap
      //               (f0500 -> f0502)
      //   generator A fills from its NEAR end toward the far cap
      //               (f0503 -> f0504)
      //
      // Read as a pen that is put down five times, that is:
      //
      //   1. near cap, thetaB -> thetaA DECREASING  (the camera-facing
      //      arc, 165 degrees here) — the first ink of the scene
      //   2. far cap, thetaA all the way round INCREASING (one closed
      //      loop; it is never interrupted)
      //   3. generator B, far end -> near end
      //   4. near cap, thetaB -> thetaA INCREASING (the away-facing arc,
      //      the complement, 195 degrees here)
      //   5. generator A, near end -> far end
      //
      // WHY THE NEAR CAP SPLITS AND THE FAR CAP DOES NOT is S&T's own
      // stroke connection, and it follows from the source rather than
      // from the frames. pydeation sets CONNECTIIONZ = 3 (match in
      // world), JOIN_ANGLE_LIMIT = PI and CLOSECONNECTION = True
      // (refs/pydeation-legacy/object/object.py:203-205), so contour
      // edges that touch are joined into longer strokes, preferring the
      // smallest turn. At a silhouette junction the generator meets the
      // cap TANGENTIALLY on screen — that is what a silhouette is — so
      // measured at this pose the turn to the generator is 0.5 degrees
      // against 1.0 degrees for the cap's own continuation: the join
      // takes the generator, and it takes it on ONE side only, which is
      // the side the cap's contour is already heading. On the far cap
      // both junctions choose the SAME arc, so its other arc is left
      // joined to it and the loop survives whole; on the near cap they
      // choose opposite arcs and the loop is cut in two. The asymmetry
      // is the two caps' opposite orientation with respect to the
      // camera, which is why this is stated camera-relatively.
      //
      // The `stroke_order` that then sequences the five is pydeation's
      // own default, "bottom_top" (object.py:90) — S&T mode 3.
      // WHICH of the near cap's two arcs the pen takes first is settled
      // by Scene 01, whose Create is the only one in the reference where
      // the near cap is drawn alone for five clear frames (f0031-f0035,
      // nothing else lit). It takes the AWAY-facing arc first.
      //
      // Projecting this cylinder's top cap under the solved camera —
      // pose p=0.4 b=0.1, held fixed through the whole Create — the two
      // arcs land on opposite sides of the ellipse:
      //
      //   thetaA -> thetaB (camera-facing)   screen y 251 -> 307  (LOWER)
      //   thetaB -> thetaA the other way     screen y 297 -> 240  (UPPER)
      //
      // and the reference's ink starts at (531,277) and runs to (641,217)
      // by f0035 — the UPPER side, i.e. the away-facing arc. Drawing the
      // camera-facing arc first puts our ink on the far side of the same
      // ellipse from the reference's: coverage_ref 0.83 -> 0.047 on
      // f0035, and scene mean 0.9826/0.9888 -> 0.9433/0.9503.
      //
      // (Scene 06's f0494-f0497 were read the other way round. Both
      // scenes agree the near cap SPLITS and the far cap does not; they
      // are only being read differently about which half comes first,
      // and Scene 01 is the cleaner read of the two because its near cap
      // is the only thing on screen while it is drawn.)
      //
      // KNOWN OPEN CONFLICT — the two readings are BOTH measurements, and
      // they disagree because the POSES disagree. Scene 06's cylinder is
      // p=PI/2 (lying along the depth axis); Scene 01's is p=0.4 b=0.1
      // (nearly upright). Scene 06's read is at least as clean as Scene
      // 01's — its cylinder is static, alone on black for eleven frames
      // (f0494-f0504), and the calibrated camera reproduces its pose to
      // the pixel — and it says the CAMERA-FACING arc goes first: walking
      // both cap circles at 0.5-degree steps, the near cap lights indices
      // 332->0 over f0494-f0498 (decreasing theta, the short arc through
      // the camera azimuth), FREEZES at 338 through f0501 while the far
      // cap runs 70->721, then jumps to 655 (f0502) and 721 (f0503).
      //
      // Scored on Scene 06 at step 1 (68 frames), the two choices trade
      // the SAME pass rate for very different quality:
      //
      //   away-facing first (this code) 61/68, mean cov ref 0.930
      //   camera-facing first           61/68, mean cov ref 0.9999
      //
      // — i.e. with Scene 06's own reading every reference pixel is
      // reproduced on every frame of the scene, and its seven failures
      // are purely the pen running ahead (coverage_ours 0.53-0.81 on
      // f0495-f0501), whereas this code's seven failures are the arc
      // drawn on the wrong side of the ellipse (coverage_ref 0.02-0.15).
      //
      // Neither reading is wrong about its own scene, so the rule that
      // separates them has NOT been found. pydeation's stroke_order
      // default "bottom_top" (object.py:90) was tested as that rule by
      // every screen-y key available — bottom-most point, centre, start
      // point — and none reproduces either observed sequence, let alone
      // both. The likely place it hides is one level earlier, in how
      // CONNECTIIONZ=3 / JOIN_ANGLE_LIMIT=PI / CLOSECONNECTION=True
      // (object.py:203-205) chain the six contour edges into strokes
      // BEFORE stroke_order sequences them: at a silhouette junction the
      // generator meets the cap tangentially on screen (measured 0.5
      // degrees of turn against the cap's own 1.0), so the join prefers
      // the generator, and which arc that orphans depends on the pose.
      // Deriving that properly is the fix; fitting a pose-dependent
      // switch to two scenes would encode nothing and is refused.
      const nearSweep = thetaB - thetaA
      nearFront.setPoints(
        capArc(radius, nearY, thetaB, Math.PI * 2 - nearSweep, CYLINDER_ROTATION_SEGMENTS).map(v3),
      )
      // nearFront ends on thetaA (it went the long way from thetaB), so
      // nearBack is the SHORT way back: thetaA -> thetaB, the
      // camera-facing arc. The two still meet at both generators.
      nearBack.setPoints(
        capArc(radius, nearY, thetaA, nearSweep, CYLINDER_ROTATION_SEGMENTS).map(v3),
      )
      farCap.setPoints(capPolylineFrom(radius, farY, thetaA, false).map(v3))
      binding.capRadius = radius
      binding.capHeight = height
      binding.thetaA = thetaA
      binding.thetaB = thetaB
      binding.nearY = nearY
    }

    if (angles) {
      // Generator B runs FAR -> NEAR; generator A runs NEAR -> FAR. Both
      // directions are read off the reference (see the pen path above).
      const set = (line: RibbonStroke, theta: number, fromNear: boolean) => {
        const nearEnd = new THREE.Vector3(...generatorPoint(theta, radius, nearY))
        const farEnd = new THREE.Vector3(...generatorPoint(theta, radius, farY))
        line.setPoints(fromNear ? [nearEnd, farEnd] : [farEnd, nearEnd])
      }
      set(lineA, angles.thetaA, true)
      set(lineB, angles.thetaB, false)
    }

    // Draw-on: the five strokes run sequentially inside the holon's one
    // `creation`, in the pen order above:
    //
    //   near FRONT arc -> far cap -> generator B -> near BACK arc -> generator A
    //
    // The erase front consumes them through the same partition.
    //
    // PROPORTIONING. pydeation animates with stroke_method "single" and
    // sketch_speed "completion" (object.py:423, 198-199), which is S&T
    // metering one pen across the strokes by LENGTH. The generators are
    // the only place a rule can be got wrong, since the cap arcs are
    // fixed multiples of one another, and the reference settles it
    // arithmetically rather than by fitting: with the pen's speed known
    // from the far cap (0.371 and 0.411 of a full cap circle over the
    // eased-creation intervals f0498-99 and f0499-500, i.e. 2.85 and
    // 3.09 circles per unit of creation) and from generator B over its
    // own interval (0.761 of the generator over f0500-501, 5.84
    // generators per unit), one generator is 2.97/5.84 = 0.51 cap
    // circles. The cylinder's own geometry says 2r/(2*pi*r) = 0.318 in
    // WORLD length and, at this pose, 0.50 in SCREEN length. Screen
    // length it is — and that is the same rule screen-arc.ts derived for
    // metering WITHIN a stroke, now simply applied BETWEEN them too, so
    // the cylinder stops being the one primitive with two rules.
    const mantleVisible = angles !== undefined
    const w = [
      this.screenLength(nearFront),
      this.screenLength(farCap),
      mantleVisible ? this.screenLength(lineB) : 0,
      this.screenLength(nearBack),
      mantleVisible ? this.screenLength(lineA) : 0,
    ]
    const totalW = w.reduce((a, b) => a + b, 0) || 1
    const bounds = [0]
    let acc = 0
    for (const x of w) {
      acc += x / totalW
      bounds.push(acc)
    }
    bounds[bounds.length - 1] = 1

    const creation = holon.creation.value
    const erasure = holon.erasure.value
    const opacity = holon.opacity.value
    const tint: Color = holon.tint.value
    const width = holon.stroke.value
    const window = (v: number, a: number, b: number) =>
      b <= a ? (v >= b ? 1 : 0) : Math.min(1, Math.max(0, (v - a) / (b - a)))
    // WITHIN a stroke the pen advances by SCREEN pixels, exactly as
    // render/screen-arc.ts derived for every other stroke — the cylinder
    // is not an exception, and the reference says so on this very draw.
    // Through the near cap's own phase the new ink per frame, divided by
    // the eased creation the frame advanced, is flat:
    //
    //     f0495  dCreation 0.056  new ink 245px
    //     f0496            0.075          520
    //     f0497            0.103          650
    //
    // A pen metering WORLD arc would vary by the ellipse's
    // foreshortening — nearly 2:1 between its wide top and its squashed
    // near side — and would not hold flat like that.
    const sub = (line: RibbonStroke, i: number) => {
      const a = bounds[i]!
      const b = bounds[i + 1]!
      const drawn = window(creation, a, b)
      const measured = drawn > 0 && drawn < 1 ? this.measureScreenArc(line) : undefined
      const world = measured
        ? Math.max(0, Math.min(1, measured.remap.worldAt(drawn) / measured.totalWorld))
        : drawn
      line.style(world, opacity, tint, width, window(erasure, a, b))
    }
    sub(nearFront, 0)
    sub(farCap, 1)
    if (mantleVisible) sub(lineB, 2)
    else lineB.style(0, opacity, tint, width, 0)
    sub(nearBack, 3)
    if (mantleVisible) sub(lineA, 4)
    else lineA.style(0, opacity, tint, width, 0)
  }

  // --- Picking (EDITOR-V3 decision 1: "what holon is under this pixel?") ---
  //
  // The host already knows the answer and nobody else can: a DreamTalk
  // stroke has NO pickable geometry in the ordinary sense. Its mesh is a
  // unit quad expanded to a constant SCREEN-PIXEL ribbon entirely inside
  // the vertex shader (ribbon.ts), so a THREE.Raycaster against it
  // reports either nothing or a 2-unit square at the origin. Picking is
  // therefore done where the ink actually is: in screen space, against
  // the very segment buffers the shader reads, at this frame's
  // projection — the same arithmetic the fragment stage does, on the CPU.
  //
  // That is not a workaround, it is the accurate answer: a hit means the
  // cursor is within `stroke/2 + PICK_SLOP` pixels of drawn ink, which is
  // exactly what the eye sees. Thin strokes (video-01 runs 1.4-2.9px) get
  // the slop as a fat, forgiving target without the *deep* choice below
  // ever becoming imprecise.

  /** Extra pixels of forgiveness around a stroke's own half-width. */
  private static readonly PICK_SLOP = 7

  /**
   * The holon under a viewport point, or undefined over empty space.
   *
   * `ndcX`/`ndcY` are normalized device coordinates (-1..1, y up) — what
   * a click on the canvas converts to. Only ink that is actually visible
   * at the current t can be hit: invisible meshes, un-drawn spans and
   * erased spans are all skipped, so clicking where a stroke *will be*
   * selects nothing, which is what direct manipulation means.
   *
   * Ties break toward the DEEPEST holon (a part over its whole) and then
   * toward the closest ink, so clicking an Eye's pupil selects the pupil
   * and clicking one grid line of an Axes selects that Line.
   */
  pick(ndcX: number, ndcY: number): Holon | undefined {
    const width = this.renderer.domElement.width || 1280
    const height = this.renderer.domElement.height || 720
    const px = ((ndcX + 1) / 2) * width
    const py = ((1 - ndcY) / 2) * height
    this.scene.updateMatrixWorld(true)

    let best: { holon: Holon; depth: number; distance: number } | undefined
    const consider = (holon: Holon, distance: number, tolerance: number) => {
      if (distance > tolerance) return
      const depth = this.depthOf(holon)
      // Deeper wins outright; at equal depth, nearer ink wins.
      if (best && (best.depth > depth || (best.depth === depth && best.distance <= distance))) return
      best = { holon, depth, distance }
    }

    for (const binding of this.strokes) {
      consider(
        binding.holon,
        this.ribbonDistance(binding.ribbon, px, py, width, height),
        binding.holon.stroke.value / 2 + ThreeHost.PICK_SLOP,
      )
    }
    for (const binding of this.cylinders) {
      const tolerance = binding.holon.stroke.value / 2 + ThreeHost.PICK_SLOP
      for (const ribbon of [binding.farCap, binding.nearBack, binding.nearFront, binding.lineA, binding.lineB]) {
        consider(binding.holon, this.ribbonDistance(ribbon, px, py, width, height), tolerance)
      }
    }
    // Fills are real triangles, so they pick as areas: inside = distance 0.
    for (const binding of this.fills) {
      consider(binding.holon, this.fillDistance(binding.fill, px, py, width, height), 0)
    }
    for (const binding of this.arrows) {
      consider(binding.holon, this.fillDistance(binding.fill, px, py, width, height), 0)
    }
    for (const { binding, group } of this.texts) {
      consider(binding.holon, this.groupScreenDistance(group, px, py, width, height), 0)
    }
    return best?.holon
  }

  /**
   * A holon's screen-space bounding box, in pixels, as a Box3 whose z is
   * unused — what a selection affordance is drawn from. Covers the holon
   * and everything below it, so selecting a whole frames all its parts.
   * Undefined when nothing of it is currently on screen.
   */
  boundsOf(holon: Holon): THREE.Box3 | undefined {
    this.scene.updateMatrixWorld(true)
    const width = this.renderer.domElement.width || 1280
    const height = this.renderer.domElement.height || 720
    const wanted = new Set<Holon>()
    for (const h of holon.walk()) wanted.add(h)

    const box = new THREE.Box3()
    box.makeEmpty()
    const point = new THREE.Vector3()
    const add = (world: THREE.Vector3) => {
      point.copy(world).project(this.camera)
      box.expandByPoint(
        new THREE.Vector3(((point.x + 1) / 2) * width, ((1 - point.y) / 2) * height, 0),
      )
    }
    const addRibbon = (ribbon: RibbonStroke, object: THREE.Object3D) => {
      for (const world of this.ribbonWorldPoints(ribbon, object)) add(world)
    }

    for (const binding of this.strokes) {
      if (wanted.has(binding.holon)) addRibbon(binding.ribbon, binding.ribbon.mesh)
    }
    for (const binding of this.cylinders) {
      if (!wanted.has(binding.holon)) continue
      for (const ribbon of [binding.farCap, binding.nearBack, binding.nearFront, binding.lineA, binding.lineB]) {
        addRibbon(ribbon, ribbon.mesh)
      }
    }
    for (const binding of [...this.fills, ...this.arrows]) {
      if (!wanted.has(binding.holon)) continue
      for (const world of this.meshWorldPoints(binding.fill.mesh)) add(world)
    }
    for (const { binding, group } of this.texts) {
      if (!wanted.has(binding.holon)) continue
      for (const world of this.meshWorldPoints(group)) add(world)
    }
    // A holon with no ink of its own (a Null, a Group, an empty whole) is
    // still selectable — fall back to its origin so the affordance has
    // somewhere to sit.
    if (box.isEmpty()) {
      const found = this.groups.find((g) => g.holon === holon)
      if (!found) return undefined
      add(new THREE.Vector3().setFromMatrixPosition(found.group.matrixWorld))
    }
    return box
  }

  /** Depth in the part tree — how many wholes a holon sits inside. */
  private depthOf(holon: Holon): number {
    let depth = 0
    let node: Holon | undefined = holon.parent
    while (node) {
      depth++
      node = node.parent
    }
    return depth
  }

  /**
   * Pixel distance from (px, py) to a ribbon's currently VISIBLE ink.
   *
   * Reads the packed instance buffers directly — the shader's own view of
   * the polyline — and honours the [erased, drawn] arc-length window, so
   * a half-drawn stroke is only pickable where the pen has been.
   */
  private ribbonDistance(
    ribbon: RibbonStroke,
    px: number,
    py: number,
    width: number,
    height: number,
  ): number {
    if (!ribbon.mesh.visible) return Infinity
    const count = ribbon.geometry.instanceCount
    if (count < 1) return Infinity
    const start = ribbon.geometry.getAttribute("instanceStart") as
      | THREE.InterleavedBufferAttribute
      | undefined
    const dist = ribbon.geometry.getAttribute("instanceDistanceStart") as
      | THREE.InterleavedBufferAttribute
      | undefined
    if (!start || !dist) return Infinity
    const positions = start.data.array as Float32Array
    const distances = dist.data.array as Float32Array
    const drawn = ribbon.material.drawn.value
    const erased = ribbon.material.erased.value

    const matrix = ribbon.mesh.matrixWorld
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    let best = Infinity
    for (let i = 0; i < count; i++) {
      // Skip segments entirely outside the visible arc-length window.
      const d0 = distances[i * 2]!
      const d1 = distances[i * 2 + 1]!
      if (d0 >= drawn || d1 <= erased) continue
      a.set(positions[i * 6]!, positions[i * 6 + 1]!, positions[i * 6 + 2]!).applyMatrix4(matrix)
      b.set(positions[i * 6 + 3]!, positions[i * 6 + 4]!, positions[i * 6 + 5]!).applyMatrix4(matrix)
      // Clip the segment to the drawn window so the pen tip is honest.
      const span = d1 - d0
      if (span > 1e-9) {
        const from = Math.max(0, Math.min(1, (erased - d0) / span))
        const to = Math.max(0, Math.min(1, (drawn - d0) / span))
        if (to <= from) continue
        const delta = b.clone().sub(a)
        b.copy(a).addScaledVector(delta, to)
        a.addScaledVector(delta, from)
      }
      const pa = this.toScreen(a, width, height)
      const pb = this.toScreen(b, width, height)
      if (!pa || !pb) continue
      const d = segmentDistance2D(px, py, pa.x, pa.y, pb.x, pb.y)
      if (d < best) best = d
    }
    return best
  }

  /** 0 inside a visible fill's triangles, Infinity outside. */
  private fillDistance(
    fill: FillShape,
    px: number,
    py: number,
    width: number,
    height: number,
  ): number {
    if (!fill.mesh.visible) return Infinity
    const geometry = fill.mesh.geometry
    const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined
    const index = geometry.getIndex()
    if (!position || !index) return Infinity
    const matrix = fill.mesh.matrixWorld
    const v = new THREE.Vector3()
    const project = (vertex: number): { x: number; y: number } | undefined => {
      v.fromBufferAttribute(position, vertex).applyMatrix4(matrix)
      return this.toScreen(v, width, height)
    }
    for (let i = 0; i < index.count; i += 3) {
      const p0 = project(index.getX(i))
      const p1 = project(index.getX(i + 1))
      const p2 = project(index.getX(i + 2))
      if (!p0 || !p1 || !p2) continue
      if (pointInTriangle2D(px, py, p0, p1, p2)) return 0
    }
    return Infinity
  }

  /** 0 inside any visible mesh under an object (text glyph quads). */
  private groupScreenDistance(
    object: THREE.Object3D,
    px: number,
    py: number,
    width: number,
    height: number,
  ): number {
    let hit = Infinity
    object.traverse((child) => {
      if (hit === 0) return
      if (!(child instanceof THREE.Mesh) || !child.visible) return
      const position = child.geometry.getAttribute("position") as THREE.BufferAttribute | undefined
      if (!position) return
      // Glyph quads are small and numerous; their screen AABB is the
      // honest, cheap answer for "did the cursor land on this text".
      const box = new THREE.Box2()
      const v = new THREE.Vector3()
      for (let i = 0; i < position.count; i++) {
        v.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld)
        const screen = this.toScreen(v, width, height)
        if (screen) box.expandByPoint(new THREE.Vector2(screen.x, screen.y))
      }
      if (!box.isEmpty() && box.containsPoint(new THREE.Vector2(px, py))) hit = 0
    })
    return hit
  }

  /** World-space points of a ribbon's current segment buffers. */
  private ribbonWorldPoints(ribbon: RibbonStroke, object: THREE.Object3D): THREE.Vector3[] {
    const count = ribbon.geometry.instanceCount
    const start = ribbon.geometry.getAttribute("instanceStart") as
      | THREE.InterleavedBufferAttribute
      | undefined
    if (count < 1 || !start) return []
    const positions = start.data.array as Float32Array
    const out: THREE.Vector3[] = []
    for (let i = 0; i < count; i++) {
      out.push(
        new THREE.Vector3(positions[i * 6]!, positions[i * 6 + 1]!, positions[i * 6 + 2]!)
          .applyMatrix4(object.matrixWorld),
      )
      out.push(
        new THREE.Vector3(positions[i * 6 + 3]!, positions[i * 6 + 4]!, positions[i * 6 + 5]!)
          .applyMatrix4(object.matrixWorld),
      )
    }
    return out
  }

  /** World-space vertices of every mesh under an object. */
  private meshWorldPoints(object: THREE.Object3D): THREE.Vector3[] {
    const out: THREE.Vector3[] = []
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.visible) return
      const position = child.geometry.getAttribute("position") as THREE.BufferAttribute | undefined
      if (!position) return
      for (let i = 0; i < position.count; i++) {
        out.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld))
      }
    })
    return out
  }

  /**
   * Creation/erasure fraction → the WORLD-arc fraction the ribbon wants,
   * under Sketch & Toon's actual draw model: the pen advances by SCREEN
   * pixels of VISIBLE stroke (render/screen-arc.ts carries the derivation
   * and the reference measurement).
   *
   * Why the host and not the shader: the map depends on this frame's
   * projection of this stroke, is different for every stroke, and is
   * needed as a scalar, not per-fragment. That is CPU work by TASTE's
   * own split rule ("work that decides what elements exist runs on CPU";
   * here, where the pen IS). The ribbon keeps its world-arc uniforms
   * untouched, so nothing about the stroke pipeline changes — only the
   * number handed to it.
   *
   * Cost: one projection pass per stroke per frame over
   * SCREEN_ARC_SAMPLES points. A straight Line needs the subdivision
   * because screen position is NOT affine in world position under
   * perspective — the whole effect being reproduced is that
   * non-affinity — so two endpoints would measure a chord and miss it.
   */
  private screenArc(binding: StrokeBinding, fraction: number): number {
    if (fraction <= 0) return 0
    if (fraction >= 1) return 1
    const measured = this.measureScreenArc(binding.ribbon)
    if (!measured) return fraction
    return Math.max(0, Math.min(1, measured.remap.worldAt(fraction) / measured.totalWorld))
  }

  /**
   * One ribbon's screen-arc measurement for this frame: how long its
   * visible ink is in pixels, and the fraction→world map along it.
   *
   * Factored out of screenArc() because the cylinder needs the LENGTH on
   * its own — to weigh its five contour strokes against each other —
   * before it needs the map within any one of them.
   */
  private measureScreenArc(
    ribbon: RibbonStroke,
  ): { remap: ReturnType<typeof screenArcRemap>; totalWorld: number } | undefined {
    const pts = ribbon.worldPoints()
    if (pts.length < 2) return undefined
    const width = this.renderer.domElement.width || 1280
    const height = this.renderer.domElement.height || 720
    const matrix = ribbon.mesh.matrixWorld
    const projected: ProjectedPoint[] = []
    const v = new THREE.Vector3()
    let world = 0
    let previous: THREE.Vector3 | undefined
    for (const local of pts) {
      v.copy(local).applyMatrix4(matrix)
      if (previous) world += v.distanceTo(previous)
      const screen = this.toScreen(v, width, height)
      projected.push({
        x: screen?.x ?? 0,
        y: screen?.y ?? 0,
        world,
        onCamera: screen !== undefined,
      })
      previous = v.clone()
    }
    if (world <= 0) return undefined
    const remap = screenArcRemap(projected, world, { width, height })
    // A stroke with no visible ink has no screen parametrisation; the
    // remap already falls back to the identity, so this is the cheap
    // early out.
    if (remap.screenLength <= 0) return undefined
    return { remap, totalWorld: world }
  }

  /**
   * One ribbon's ink length in SCREEN pixels at this frame, 0 when it
   * has none — the weight the cylinder proportions its five contour
   * strokes by (see syncCylinder). Same measurement as screenArc()'s,
   * asked for the total rather than the map.
   */
  private screenLength(ribbon: RibbonStroke): number {
    return this.measureScreenArc(ribbon)?.remap.screenLength ?? 0
  }

  /** World point → device pixels (y down), or undefined behind the camera. */
  private toScreen(
    world: THREE.Vector3,
    width: number,
    height: number,
  ): { x: number; y: number } | undefined {
    const ndc = world.clone().project(this.camera)
    if (!Number.isFinite(ndc.x) || !Number.isFinite(ndc.y)) return undefined
    if (this.camera instanceof THREE.PerspectiveCamera && ndc.z > 1) return undefined
    return { x: ((ndc.x + 1) / 2) * width, y: ((1 - ndc.y) / 2) * height }
  }

  dispose(): void {
    for (const { binding } of this.texts) binding.dispose()
    this.texts.length = 0
    this.renderer.dispose()
  }
}

/** Pixel distance from a point to a 2D segment. */
const segmentDistance2D = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number => {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  const u = lenSq > 1e-12 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq)) : 0
  return Math.hypot(px - (ax + dx * u), py - (ay + dy * u))
}

/** Whether a 2D point lies inside a triangle (any winding). */
const pointInTriangle2D = (
  px: number,
  py: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): boolean => {
  const cross = (ox: number, oy: number, ux: number, uy: number, vx: number, vy: number) =>
    (ux - ox) * (vy - oy) - (uy - oy) * (vx - ox)
  const d1 = cross(a.x, a.y, b.x, b.y, px, py)
  const d2 = cross(b.x, b.y, c.x, c.y, px, py)
  const d3 = cross(c.x, c.y, a.x, a.y, px, py)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}
