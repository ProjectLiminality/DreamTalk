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

import { Vector3 } from "three/webgpu"
import type { Holon } from "../../src/holon"
import { toWorld } from "../../src/geometry/frames"
import { Null } from "../../src/parts/primitives"
import { completion, derive, paramEpoch, scalar, type AnimOpts } from "../../src/params"
import { chain, together, type Anim } from "../../src/anim"
import type { Observer } from "../../src/dream"
import { latLonToUnit } from "../../src/geometry/sphere"
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
  // The Earth's world scale and frame, through every whole above it (frames.ts).
  let scale = 1
  for (let h: Holon | undefined = earth; h; h = h.parent) scale *= h.scale.value
  const radius = earth.radius.value * Math.abs(scale)
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
  const R = earth.radius.value
  const c = toWorld(earth, { x: 0, y: 0, z: 0 })
  const f = toWorld(earth, { x: up.x * R, y: up.y * R, z: up.z * R })
  const d = toWorld(earth, local)
  const focus = new Vector3(f.x, f.y, f.z)
  const dir = new Vector3(d.x - c.x, d.y - c.y, d.z - c.z).normalize()
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
  let seenEpoch = Number.NaN
  const now = () => {
    // Same frame, same params: answer without re-reading the inputs.
    const epoch = paramEpoch()
    if (epoch === seenEpoch) return pose
    seenEpoch = epoch
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

/** Where to look: a ground point, and optionally how close and how leaned. */
export interface FocusTarget {
  lat: number
  lon: number
  /** log2 magnification (EarthView.zoom); or give `span` and it is solved. */
  zoom?: number
  /** Half-extent on the ground to frame, degrees — used when `zoom` is not given. */
  span?: number
  /** Lean off straight-down, degrees. Left as it is when not given. */
  tilt?: number
}

const resolveZoom = (
  view: EarthView,
  target: FocusTarget,
  frame?: { earth: Earth; observer: Observer },
): number | undefined => {
  if (target.zoom !== undefined) return target.zoom
  if (target.span === undefined) return undefined
  if (!frame) throw new Error("Focus: a `span` needs { earth, observer } to solve the zoom")
  return Math.max(
    0,
    zoomForSpan(frame.earth.radius.value * frame.earth.scale.value, target.span, view.fill.value, frame.observer.fov.value),
  )
}

/**
 * Look at a place: lat/lon (and zoom, tilt when given) all move together
 * over the clip. The plain verb — any place, any time; play it for as long
 * as the move should take.
 *
 *     this.play(Focus(view, { lat: 48.2, lon: 16.4, zoom: 3, tilt: 35 }), 3)
 *
 * Longitudes are animated as numbers: to cross the antimeridian the short
 * way, give the target as e.g. 190 rather than −170.
 */
export const Focus = (
  view: EarthView,
  target: FocusTarget,
  frame?: { earth: Earth; observer: Observer },
  opts: AnimOpts = {},
): Anim => {
  const zoom = resolveZoom(view, target, frame)
  return together(
    view.lat.to(target.lat, opts),
    view.lon.to(target.lon, opts),
    ...(zoom !== undefined ? [view.zoom.to(zoom, opts)] : []),
    ...(target.tilt !== undefined ? [view.tilt.to(target.tilt, opts)] : []),
  )
}

/**
 * Fly to a place the way a traveller would: rise, cross, descend. The
 * ground point glides over the whole clip while the zoom first pulls back
 * `pullBack` levels below the target's and then comes down onto it, and
 * any tilt eases off for the crossing and returns on arrival — the
 * zoom-out-pan-zoom-in path that keeps a long hop legible instead of
 * smearing the planet past at street level.
 *
 * The pull-back is stated relative to the TARGET (never read from where
 * the view happens to be at build time), so the verb is a pure function
 * of what it is given and composes anywhere in a timeline.
 */
export const FlyTo = (
  view: EarthView,
  target: FocusTarget & { pullBack?: number },
  frame?: { earth: Earth; observer: Observer },
): Anim => {
  const zoom = resolveZoom(view, target, frame) ?? 0
  const high = Math.max(0, zoom - (target.pullBack ?? 1.5))
  return together(
    view.lat.to(target.lat),
    view.lon.to(target.lon),
    chain(view.zoom.to(high, { easing: "easeIn" }), view.zoom.to(zoom, { easing: "easeOut" })),
    ...(target.tilt !== undefined
      ? [chain(view.tilt.to(0, { easing: "easeIn" }), view.tilt.to(target.tilt, { easing: "easeOut" }))]
      : []),
  )
}
