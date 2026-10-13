/**
 * Labels — names written on the Earth the way a good map writes them:
 * small, quiet, always facing the reader, always the same size on screen,
 * and only once the eye is close enough for them to mean something.
 *
 *   - FACING: every label takes the CAMERA's own rotation (carried into the
 *     Earth's frame), so its text lies in the image plane, upright, however
 *     the eye is tilted or the planet turned. One rotation serves every
 *     label, worked out once per frame.
 *   - SIZE: a label's scale is its distance to the eye times the pixel
 *     footprint at that distance, so `labelSize` is a size in screen
 *     pixels (on the 720-line reference) at any zoom.
 *   - WHEN: each name carries Natural Earth's own rank — min_label for a
 *     country, min_zoom for a city — and fades in with the Earth's
 *     `detail` exactly as islands do.
 *   - WHERE: anchored a hair above the ground at Natural Earth's label
 *     point, hidden by the horizon disc like everything else, and faded out
 *     as it nears the horizon so a name is never cut in half by it.
 *
 * Country names are set in capitals with open tracking; cities in sentence
 * case beside a small dot. Both in `labelTint`, a light grey that reads on
 * the black sea and on dimmed land without competing with the coast.
 */

import { Euler, PerspectiveCamera, Quaternion, Vector3 } from "three/webgpu"
import { Circle, Null } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { derive } from "../../src/params"
// A cycle with Earth.ts, safe: these are only called once both modules have loaded.
import { lod as lodOf, worldMatrixOf as worldMatrix, type Earth } from "./Earth"
import { latLonToUnit } from "../../src/geometry/sphere"

/** A label: a Null at the anchor carrying its text (and a city's dot). */
export type Label = Null

/** The per-frame quantities every label shares. */
export interface Billboard {
  /** h, p, b that turn a label to face the camera, in the Earth's frame. */
  hpb(): [number, number, number]
  /** Earth-local units per screen pixel at a local point. */
  unitsPerPx(x: number, y: number, z: number): number
  /** 0 behind the horizon, rising to 1 a little in front of it. */
  facing(x: number, y: number, z: number): number
}

/** How far above the ground a label floats, as a fraction of the radius. */
const LIFT = 0.003
/** The band in front of the horizon over which a label fades in (cosine units). */
const HORIZON_FADE = 0.25

/**
 * The shared camera-facing frame for an Earth's labels, recomputed only
 * when the observer or the Earth has moved (key compared in place).
 */
export const billboard = (earth: Earth): Billboard => {
  const cam = new PerspectiveCamera()
  const qEarth = new Quaternion()
  const pos = new Vector3()
  const scl = new Vector3()
  const euler = new Euler()
  const own = [earth.x, earth.y, earth.z, earth.h, earth.p, earth.b, earth.scale, earth.radius]
  const key = new Float64Array(own.length + 10).fill(Number.NaN)
  let hpb: [number, number, number] = [0, 0, 0]
  let eye = { x: 0, y: 0, z: 1500 }
  let tanHalf = Math.tan(((53.13 * Math.PI) / 180) / 2)
  let ortho = false
  let orthoUnits = 1

  const refresh = (): void => {
    let i = 0
    let moved = false
    const at = (v: number) => {
      if (key[i] !== v) {
        key[i] = v
        moved = true
      }
      i++
    }
    const o = earth.seer
    if (o) {
      at(o.x.value); at(o.y.value); at(o.z.value); at(o.phi.value); at(o.theta.value)
      at(o.radius.value); at(o.zoom.value); at(o.fov.value); at(o.tilt.value); at(o.orthographic.value ? 1 : 0)
    }
    for (const p of own) at(p.value)
    if (!moved) return

    // The camera exactly as the host places it (three-host syncCamera).
    const phi = o ? o.phi.value : 0
    const theta = o ? o.theta.value : 0
    const r = o ? (o.orthographic.value ? o.radius.value : o.radius.value / (o.zoom.value || 1)) : 1500
    const focus = new Vector3(o ? o.x.value : 0, o ? o.y.value : 0, o ? o.z.value : 0)
    cam.position.set(
      focus.x + r * Math.sin(phi) * Math.cos(theta),
      focus.y + r * Math.sin(theta),
      focus.z + r * Math.cos(phi) * Math.cos(theta),
    )
    cam.up.set(0, 1, 0)
    cam.lookAt(focus)
    if (o && o.tilt.value !== 0) cam.rotateZ(o.tilt.value)
    cam.updateMatrixWorld()

    // Into the Earth's frame: q_label = q_earth⁻¹ · q_camera.
    worldMatrix(earth).decompose(pos, qEarth, scl)
    const q = qEarth.clone().invert().multiply(cam.quaternion)
    euler.setFromQuaternion(q, "ZXY")
    hpb = [euler.y, euler.x, euler.z]

    const local = earth.localEye()
    if (local) eye = local.point
    ortho = local?.orthographic ?? false
    tanHalf = Math.tan((o ? o.fov.value : (53.13 * Math.PI) / 180) / 2)
    // Orthographic: the frame's half-height is fixed by the observer's zoom (dream.ts).
    orthoUnits = ortho && o ? 1023 / (2 * (o.zoom.value || 1) * (16 / 9)) / 360 / (earth.scale.value || 1) : 1
  }

  return {
    hpb: () => {
      refresh()
      return hpb
    },
    unitsPerPx: (x, y, z) => {
      refresh()
      if (ortho) return orthoUnits
      return (Math.hypot(eye.x - x, eye.y - y, eye.z - z) * tanHalf) / 360
    },
    facing: (x, y, z) => {
      refresh()
      const R = earth.radius.value
      const d = Math.hypot(eye.x, eye.y, eye.z)
      if (ortho) {
        const m = (x * eye.x + y * eye.y + z * eye.z) / (R * d)
        return smooth(m / HORIZON_FADE)
      }
      const m = (x * eye.x + y * eye.y + z * eye.z - R * R) / (R * d)
      return smooth(m / HORIZON_FADE)
    },
  }
}

const smooth = (t: number): number => {
  const u = Math.max(0, Math.min(1, t))
  return u * u * (3 - 2 * u)
}

/**
 * Build one label: anchored at (lat, lon), facing the camera, sized in
 * pixels, fading by rank and toward the horizon.
 */
export const makeLabel = (
  earth: Earth,
  board: Billboard,
  spec: { lat: number; lon: number; text: string; rank: number; kind: "country" | "city" },
): Label => {
  const R = earth.radius.value
  const u = latLonToUnit(spec.lat, spec.lon)
  const k = R * (1 + LIFT)
  const ax = u.x * k
  const ay = u.y * k
  const az = u.z * k
  const city = spec.kind === "city"
  const presence = derive(
    () =>
      earth.labelOpacity.value *
      lodOf(spec.rank, earth.detail.value + earth.labelBias.value) *
      board.facing(ax, ay, az),
  )
  const anchor = new Null({ x: ax, y: ay, z: az })
  anchor.h.follow(derive(() => board.hpb()[0]))
  anchor.p.follow(derive(() => board.hpb()[1]))
  anchor.b.follow(derive(() => board.hpb()[2]))
  anchor.scale.follow(
    derive(() => board.unitsPerPx(ax, ay, az) * earth.labelSize.value * (city ? 0.85 : 1)),
  )
  const add = <T extends import("../../src/holon").Holon>(h: T): T =>
    (anchor as unknown as { add(h: T): T }).add(h)
  add(
    new Text({
      content: spec.text,
      size: 1,
      tint: earth.labelTint,
      stroke: 0,
      composite: "overlay",
      tracking: city ? 0 : 0.14,
      align: city ? "left" : "center",
      x: city ? 0.55 : 0,
      y: city ? -0.35 : -0.35,
      opacity: presence,
    }),
  )
  if (city) add(new Circle({ radius: 0.18, stroke: 0, fillOpacity: 1, tint: earth.labelTint, opacity: presence }))
  return anchor
}

