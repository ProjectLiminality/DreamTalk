/**
 * EarthView — the camera as a traveller over the Earth: where it looks
 * (lat, lon) and how far it has descended (zoom), instead of raw orbit
 * angles and a distance.
 *
 * WHY A RIG AND NOT JUST `observer.radius.to(…)`
 *
 * Flying from the whole planet down to Europe is a zoom over a factor of
 * four to a hundred. Animated as a DISTANCE, the eye crawls for most of
 * the move and then crashes into the ground — every halving of altitude
 * is a doubling of the picture, so a straight line in distance is a
 * curve in what you see. `zoom` is the log2 of magnification (each +1 is
 * twice as close to the ground), so animating it at an even pace descends
 * at an even pace for the eye — the way a map zooms. lat/lon move with it,
 * and the target stays centred because the camera always looks AT the
 * ground point it frames.
 *
 * `tilt` leans the eye off straight-down toward the south, looking north
 * — Google Earth's tilt. At 0 it is a map; at ~40 a building shows its
 * walls and the horizon curves into the top of the frame.
 *
 * HOW IT DRIVES THE OBSERVER
 *
 * `followEarth(observer, earth, view)` binds the observer's focus to the
 * framed ground point and its phi/theta/radius to the direction and
 * distance back to the eye — the observer's own spherical convention is
 * the Earth's lat/lon frame (geometry/sphere.ts), so straight down on an
 * unturned Earth is phi = lon, theta = lat. A turned Earth (its h/p/b) is
 * accounted for, so the camera keeps looking at Paris while the planet
 * spins under it. It also tells the Earth where the eye is (`seenFrom`),
 * which is what hides the far side exactly. Once bound, the observer is
 * the view's; animate the view.
 *
 * `zoom = 0` frames the WHOLE Earth with its disc filling `fill` of the
 * frame height. `FrameRegion(view, { lat, lon, span })` flies to a region
 * whose half-extent on the ground is `span` degrees — Europe is roughly
 * { lat: 50, lon: 12, span: 20 }.
 */

import { Euler, Vector3 } from "three/webgpu"
import { Null } from "../../src/parts/primitives"
import { completion, derive, scalar, type AnimOpts } from "../../src/params"
import { together, type Anim } from "../../src/anim"
import type { Observer } from "../../src/dream"
import { latLonToUnit, type Vec3 } from "../../src/geometry/sphere"
import type { Earth } from "./Earth"

export class EarthView extends Null {
  /** The latitude the camera looks down on, degrees. */
  lat = scalar(0)
  /** The longitude the camera looks down on, degrees. */
  lon = scalar(0)
  /** log2 magnification over the whole-Earth framing: 0 = the planet, +1 = twice as close to the ground. */
  zoom = scalar(0)
  /** The fraction of the frame height the whole Earth fills at zoom 0. */
  fill = completion(0.8)
  /**
   * How far the camera leans off straight-down, degrees, looking north —
   * Google Earth's tilt. 0 is the map view; 45 shows buildings as the 3D
   * things they are and lets the horizon curve into the frame.
   */
  tilt = scalar(0)
}

/** Camera distance from the Earth's centre for a view, given the vertical fov. */
export const viewDistance = (radius: number, zoom: number, fill: number, fov: number): number => {
  // At zoom 0 the disc's angular radius α fills `fill` of the half-frame:
  // tan α = fill · tan(fov/2), and a sphere of radius R subtends α from
  // distance R / sin α.
  const alpha = Math.atan(fill * Math.tan(fov / 2))
  const altitude0 = radius / Math.sin(alpha) - radius
  return radius + altitude0 * Math.pow(2, -zoom)
}

/**
 * The zoom that frames a region of half-extent `span` degrees (measured
 * on the ground from its centre) to the frame's half-height, seen straight
 * down from above its centre.
 */
export const zoomForSpan = (radius: number, span: number, fill: number, fov: number): number => {
  const s = (span * Math.PI) / 180
  // The ground point s away from the target subtends fov/2 from distance
  // d along the normal: tan(fov/2) = R sin s / (d − R cos s).
  const d = radius * Math.cos(s) + (radius * Math.sin(s)) / Math.tan(fov / 2)
  const alpha = Math.atan(fill * Math.tan(fov / 2))
  const altitude0 = radius / Math.sin(alpha) - radius
  return Math.log2(altitude0 / Math.max(1e-9, d - radius))
}

const euler = new Euler()

/** A local direction on an Earth turned by its own h/p/b, into world space. */
const turned = (earth: Earth, v: Vec3): Vector3 => {
  // The host's convention (three-host: rotation.set(p, h, b, "ZXY")).
  euler.set(earth.p.value, earth.h.value, earth.b.value, "ZXY")
  return new Vector3(v.x, v.y, v.z).applyEuler(euler)
}

/**
 * Where the camera is for a view: the point it looks at (on the ground at
 * lat/lon, world space), and the direction from there back to the eye
 * (the ground normal leaned `tilt` toward the south, so the eye looks
 * north), and its distance.
 */
export const viewPose = (
  earth: Earth,
  view: EarthView,
  fov: number,
): { focus: Vector3; dir: Vector3; distance: number } => {
  const radius = earth.radius.value * earth.scale.value
  const lat = view.lat.value
  const lon = view.lon.value
  const up = latLonToUnit(lat, lon)
  const lam = (lon * Math.PI) / 180
  const east = { x: Math.cos(lam), y: 0, z: -Math.sin(lam) }
  // east × up = south
  const south = {
    x: east.y * up.z - east.z * up.y,
    y: east.z * up.x - east.x * up.z,
    z: east.x * up.y - east.y * up.x,
  }
  const t = (view.tilt.value * Math.PI) / 180
  const local = {
    x: up.x * Math.cos(t) + south.x * Math.sin(t),
    y: up.y * Math.cos(t) + south.y * Math.sin(t),
    z: up.z * Math.cos(t) + south.z * Math.sin(t),
  }
  const centre = new Vector3(earth.x.value, earth.y.value, earth.z.value)
  const focus = turned(earth, up).multiplyScalar(radius).add(centre)
  const dir = turned(earth, local).normalize()
  const distance = viewDistance(radius, view.zoom.value, view.fill.value, fov) - radius
  return { focus, dir, distance }
}

/**
 * Bind the observer to fly the view over the Earth (see the module note).
 * With `detail`, the Earth's LOD also follows the descent: `detail` at
 * zoom 0, one map level more for every zoom step.
 */
export const followEarth = (
  observer: Observer,
  earth: Earth,
  view: EarthView,
  opts: { detail?: number } = {},
): void => {
  // One pose per frame, shared by the six readings (they are read in a
  // burst — by the host's camera sync, and by every shoreline asking the
  // Earth its screen scale). Keyed on every input that moves it, compared
  // in place: no allocation on the hot path.
  const inputs = [
    view.lat, view.lon, view.zoom, view.tilt, view.fill,
    earth.x, earth.y, earth.z, earth.h, earth.p, earth.b, earth.scale, earth.radius, observer.fov,
  ]
  const key = new Float64Array(inputs.length).fill(Number.NaN)
  let pose = viewPose(earth, view, observer.fov.value)
  const now = () => {
    let moved = false
    for (let i = 0; i < inputs.length; i++) {
      const v = inputs[i]!.value
      if (key[i] !== v) {
        key[i] = v
        moved = true
      }
    }
    if (moved) pose = viewPose(earth, view, observer.fov.value)
    return pose
  }
  earth.seenFrom(observer)
  observer.x.follow(derive(() => now().focus.x))
  observer.y.follow(derive(() => now().focus.y))
  observer.z.follow(derive(() => now().focus.z))
  observer.phi.follow(derive(() => Math.atan2(now().dir.x, now().dir.z)))
  observer.theta.follow(derive(() => Math.asin(Math.max(-1, Math.min(1, now().dir.y)))))
  observer.radius.follow(derive(() => now().distance * (observer.zoom.value || 1)))
  const base = opts.detail
  if (base !== undefined) earth.detail.follow(derive(() => base + Math.max(0, view.zoom.value)))
}

/**
 * Fly the view to frame a region: centre (lat, lon), half-extent `span`
 * degrees on the ground. The Earth and observer supply the radius and lens
 * the framing is solved for.
 */
export const FrameRegion = (
  view: EarthView,
  region: { lat: number; lon: number; span: number },
  frame: { earth: Earth; observer: Observer },
  opts: AnimOpts = {},
): Anim => {
  const zoom = zoomForSpan(
    frame.earth.radius.value * frame.earth.scale.value,
    region.span,
    view.fill.value,
    frame.observer.fov.value,
  )
  return together(
    view.lat.to(region.lat, opts),
    view.lon.to(region.lon, opts),
    view.zoom.to(Math.max(0, zoom), opts),
  )
}
