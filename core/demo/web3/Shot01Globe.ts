/**
 * Shot01Globe — shot 1 of the Liminal Consulting Web3 video (0–4.5s): the
 * world, alone, before the argument begins — and the first moment of its
 * division.
 *
 * Measured off the final render at 30fps, 1280w (2026-10-04):
 *
 *   0–3.3s   the globe fades up out of black: its land's screen brightness
 *            climbs 0 → 1 between 0.25 and 3.3s (LAND below — not a smooth
 *            ease, so it is stated as the measured keys);
 *   ~0.8s–   a SEAM — a thin warm meridian — stands near the right limb and
 *            sweeps in to the centre by ~4.85s (SEAM, degrees from the
 *            central meridian); the slice of globe beyond it is FROSTED, a
 *            faint white veil over the far half that is about to become the
 *            second globe;
 *   3.0s–    the globe shrinks (258.5px → the yin-yang's globes, YinYang.ts
 *            states the whole curve) and its limb is pushed outward as a
 *            separate ring — the yin-yang's outer circle.
 *
 * The next chapter (YinYang, from 4.0, crossfaded) carries the same three
 * curves on, so the two pictures agree under the crossfade. The C4D
 * terminator light of the earlier reading turned out to be this seam and
 * veil, which need no lights.
 *
 * Measured: limb radius ~260px at 1280w ≈ 203 scene units at this camera.
 * The face is chosen by `spin`: the centre longitude is −spin, so −1.95 rad
 * (≈112°E) puts India left of centre and Australia lower right, as in f_00003.
 */

import { Dream } from "../../src/index"
import { together } from "../../src/anim"
import { Circle, Line, Null, Stroke } from "../../src/parts/primitives"
import { Globe } from "../../vocabulary/Globe/Globe"
import { projectLatLon } from "../../src/geometry/globe"
import { rgb, type Color } from "../../src/constants"
import { c4dEaseWith } from "../../src/timeline"

/** The shot's length, and pixels per scene unit at its camera. */
const SPAN = 4.5
const PX = 1.28

/** Land screen brightness (0–1) at song time — measured keys. */
const LAND: readonly (readonly [number, number])[] = [
  [0.25, 0], [0.4, 0.13], [0.6, 0.2], [0.8, 0.27], [1.0, 0.35], [1.2, 0.455],
  [1.4, 0.56], [1.6, 0.65], [1.8, 0.74], [2.0, 0.82], [2.2, 0.875], [2.4, 0.914],
  [2.7, 0.953], [2.9, 0.98], [3.1, 0.996], [3.3, 1],
]
/** The seam's longitude from the central meridian (degrees) — measured keys. */
const SEAM: readonly (readonly [number, number])[] = [
  [0.8, 47], [1.0, 44], [1.8, 39], [2.0, 37], [2.5, 31], [3.0, 25], [3.5, 17.5],
  [4.0, 11.5], [4.5, 5.5],
]
const SEAM_TINT = rgb(226, 206, 174)
/** The veil's opacity: it lifts the far half's black sea to ~0.21 on screen. */
const FROST = 0.036

/** Piecewise-linear read of measured keys, held at both ends. */
const keyed = (keys: readonly (readonly [number, number])[], t: number): number => {
  if (t <= keys[0]![0]) return keys[0]![1]
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i]!
    if (t <= t1) {
      const [t0, v0] = keys[i - 1]!
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0)
    }
  }
  return keys[keys.length - 1]![1]
}

/** The screen value a tint must carry to show `v` (the host encodes linear). */
const decode = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const grey = (v: number): Color => {
  const c = decode(v)
  return { r: c, g: c, b: c }
}

/** The globe's radius and the outer ring's, in pixels — YinYang's curves. */
const globePx = (t: number) => 258.5 - 223.5 * c4dEaseWith((t - 3) / 2.95, 0.35, 0.35)
const ringPx = (t: number) => 259 + 21 * c4dEaseWith((t - 3) / 3, 0.25, 0.25)

/** Give a Line points recomputed (and its geomVersion bumped) when `key` moves. */
const derive = (line: Line, key: () => number, compute: () => { x: number; y: number; z: number }[]) => {
  let at: number | undefined
  let memo: { x: number; y: number; z: number }[] = []
  Object.defineProperty(line, "points", {
    configurable: true,
    enumerable: true,
    get() {
      const k = key()
      if (k !== at) {
        at = k
        memo = compute()
        line.geomVersion++
      }
      return memo
    },
    set(_v) {},
  })
}

export class Shot01GlobeDream extends Dream {
  /** The shot's clock, 0 → 1 over its 4.5s: every reading below is a pure
   *  function of it (so it scrubs both ways). */
  clock = new Null({ creation: 0 })

  globe = new Globe({
    radius: 203,
    continents: "fill",
    land: rgb(0, 0, 0),
    limbStroke: 1.5,
    limbTint: rgb(0, 0, 0),
    // Black, so the ocean disc's hairline edge does not show before the fade.
    oceanTint: rgb(0, 0, 0),
    tilt: 0.12,
    spin: -1.95,
  })

  seam = new Line({ tint: SEAM_TINT, stroke: 2 })
  frost = new Stroke({ tint: rgb(255, 255, 255), stroke: 0, fillOpacity: 0 })
  ring = new Circle({ radius: 203, tint: rgb(240, 240, 240), stroke: 1.5, opacity: 0 })

  constructor() {
    super()
    const t = () => this.clock.creation.value * SPAN
    const c = this.clock.creation
    const r = () => globePx(t()) / PX
    const land = () => keyed(LAND, t())

    this.globe.radius.follow(c.map(() => r()))
    this.globe.land.follow(c.map(() => grey(land())))
    this.globe.limbTint.follow(c.map(() => grey(land() * 0.94)))

    // The seam: the meridian SEAM° from the centre, its near half.
    const seamPoints = () => {
      const theta = keyed(SEAM, t())
      const pts: { x: number; y: number; z: number }[] = []
      for (let lat = 90; lat >= -90; lat -= 5) {
        const p = projectLatLon(theta, lat, r(), 0, this.globe.tilt.value)
        if (p.z >= 0) pts.push({ x: p.x, y: p.y, z: 0 })
      }
      return pts
    }
    derive(this.seam, t, seamPoints)
    this.seam.opacity.follow(c.map(() => land()))

    // The veil: from the seam round the right limb, a closed outline.
    const veil = new Line({ tint: rgb(255, 255, 255), stroke: 0, opacity: 0 })
    derive(veil, t, () => {
      const seam = seamPoints()
      if (seam.length < 2) return []
      const top = seam[0]!
      const bottom = seam[seam.length - 1]!
      const a0 = Math.atan2(bottom.y, bottom.x)
      const a1 = Math.atan2(top.y, top.x)
      const arc: { x: number; y: number; z: number }[] = []
      for (let i = 1; i < 32; i++) {
        const a = a0 + ((a1 - a0) * i) / 32
        arc.push({ x: Math.cos(a) * r(), y: Math.sin(a) * r(), z: 0 })
      }
      return [...seam, ...arc, top]
    })
    ;(this.frost as unknown as { add(h: Line): Line }).add(veil)
    this.frost.fillOpacity.follow(c.map(() => FROST * land()))

    // The outer ring: the limb, pushed outward from 3.0s.
    this.ring.radius.follow(c.map(() => ringPx(Math.max(t(), 3)) / PX))
    this.ring.opacity.follow(c.map(() => (t() >= 3 ? 1 : 0)))
  }

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.stage(this.globe)
    this.stage(this.frost)
    this.stage(this.seam)
    this.stage(this.ring)

    // The whole shot turns a little — the globe is never still.
    this.play(
      together(
        this.clock.creation.to(1, { easing: "linear" }),
        this.globe.spin.to(-1.8, { easing: "linear" }),
      ),
      SPAN,
    )
  }
}
