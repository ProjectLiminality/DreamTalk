/**
 * EgoLens — the ego as a lens between the light and the land.
 *
 * The ego is the king of the psyche: subservient to the light above,
 * serving the other psychic functions below. Its three relationships to
 * the light are ONE number, `relation`, walked as one axis:
 *
 *   −1  AWAY   the lens turns from the light: it turns right over, its
 *              face (the red ring where the light enters) down to the dark
 *              and its back (blue) up to the star. The rays end on its back,
 *              nothing passes, its shadow lies cold on the dimmed land and
 *              the flower droops and shrivels (cold, blue).
 *    0  ICON   right relationship: the light refracts through the lens and
 *              spreads over the land below; the flower opens toward it.
 *   +1  DEEP   it looks too deep into the light and takes itself for the
 *              Self: the lens becomes the eye whose section it is — first
 *              the clear eye, then burning: the flaming, lidless eye of the
 *              watchtower (RingEye's eye), rising toward the star, the rays
 *              drawn into it and hoarded. Nothing reaches the land; the
 *              flower closes.
 *
 * REAL 3D, one vertical line and one horizontal plane: the star on the
 * axis above, the lens on the axis between, the land a horizontal disc
 * below with the lotus at its centre. Y is up; the symbol's origin is the
 * centre of its height (`size`, star to land).
 *
 * THE LENS IS THE EYE'S SECTION. Its body is the 3-4-5 lens of MolochEye
 * turned about the vertical: each meridian is exactly the eye's almond
 * (rim radius 2h, faces of radius 2.5h — LENS_RADIUS_RATIO), so seen
 * edge-on the ego-lens IS the outline of the eye it can become, and the
 * cyclops is drawn at the lens's own h.
 *
 * THE LOTUS: two rings of eight petals (the outer offset by half a step),
 * each a cupped petal in real 3D. `bloom` (−1 shrivelled … 0 bud … 1
 * open) follows `relation`: open with the light, a closed bud without it,
 * drooping and curled under when the ego turns away.
 */

import { Circle, Line, Null, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import type { Observer } from "../../src/dream"
import { liveView, localView, viewOf, type View } from "../../src/geometry/frames"
import { Param, derive, length } from "../../src/params"
import { restage, together, type Anim } from "../../src/anim"
import { axis, type StateSpace } from "../../src/automaton"
import { Create } from "../../src/verbs"
import { BLUE, RED, TAU, WHITE, type Color } from "../../src/constants"
import { clamp01, lerp } from "../../src/math"
import { ease } from "../../src/timeline"
import { Layer } from "../Figure/Figure"
import { LENS_RADIUS_RATIO } from "../MolochEye/MolochEye"
import { WatchEye } from "../RingEye/RingEye"

/** The construction, in units of `size` (star to land). */
export const EGOLENS = {
  /** The star's height above the symbol's centre, the lens's, the land's. */
  star: 0.5,
  lens: 0.12,
  land: -0.5,
  /** h, the lens half-thickness (its rim is 2h: the eye's almond). */
  h: 0.075,
  /** Where the rays cross the lens, × its rim radius. */
  aperture: 0.72,
  /** The ring the light spreads to on the land, and the land's rim. */
  pool: 0.42,
  ground: 0.62,
  /** The star's long rays (the six axes) and short ones (the eight diagonals). */
  starLong: 0.11,
  starShort: 0.05,
  /** The lotus: petal length (inner, outer ring) and base radius. */
  petalIn: 0.15,
  petalOut: 0.18,
  petalBase: 0.014,
  /** How far the cyclops rises toward the star, × the lens–star gap. */
  rise: 0.3,
} as const

/** Rays through the lens, and petals per ring — eightfold / twelvefold symmetry. */
const RAYS = 12
const PETALS = 8
/** The lens's meridians (every 45°) and the samples along an arc. */
const MERIDIANS = 4
const ARC = 32
/** How far the lens turns when it turns away: right over, its face (toward the star) turned down to the dark. */
const AWAY_BANK = Math.PI

const smooth = (u: number) => ease("smooth", clamp01(u))
const mix = (a: Color, b: Color, u: number): Color => ({ r: lerp(a.r, b.r, u), g: lerp(a.g, b.g, u), b: lerp(a.b, b.b, u) })
const add = (a: Vec3Like, b: Vec3Like, k = 1): Vec3Like => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k })

/** Piecewise-linear through (−1, a) (0, b) (1, c). */
const tri = (v: number, a: number, b: number, c: number) => (v < 0 ? lerp(b, a, -v) : lerp(b, c, v))

/**
 * One petal's closed outline, in the symbol's frame. The midline leaves the
 * base at `tilt` from the vertical, leaning out along the bearing `phi`, and
 * bends by `curl` (radians over its length; negative curls the tip inward);
 * the width runs pointed at both ends, widest a little below the middle; the
 * blade is cupped toward the flower's heart.
 */
export const petalOutline = (
  centre: Vec3Like,
  phi: number,
  base: number,
  len: number,
  width: number,
  tilt: number,
  curl: number,
  cup: number,
): Vec3Like[] => {
  const N = 14
  const radial = { x: Math.cos(phi), y: 0, z: Math.sin(phi) }
  const side = { x: -Math.sin(phi), y: 0, z: Math.cos(phi) }
  const dir = (a: number) => ({ x: radial.x * Math.sin(a), y: Math.cos(a), z: radial.z * Math.sin(a) })
  // The inward normal of the blade at angle a: the midline's tangent turned
  // a quarter toward the axis, in the radial–vertical plane.
  const inward = (a: number) => ({ x: -radial.x * Math.cos(a), y: Math.sin(a), z: -radial.z * Math.cos(a) })
  const mid: { p: Vec3Like; a: number }[] = []
  let p = add(centre, radial, base)
  for (let i = 0; i <= N; i++) {
    const s = i / N
    const a = tilt + curl * s
    mid.push({ p, a })
    p = add(p, dir(a + curl / (2 * N)), len / N)
  }
  const edge = (sign: number) =>
    mid.map(({ p, a }, i) => {
      const s = i / N
      const w = width * Math.sin(Math.PI * Math.pow(s, 0.8)) * sign
      return add(add(p, side, w), inward(a), cup * Math.abs(w))
    })
  return [...edge(1), ...edge(-1).reverse().slice(1)]
}

export class EgoLens extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The whole height, star to land — the symbol's one size. */
  size = length(900)
  /** −1 turned away … 0 the icon (right relationship) … 1 too deep (the cyclops). */
  relation = new Param<number>("scalar", 0, -1, 1)
  /** The pen, in screen px. */
  stroke = length(2.2)

  star!: Null
  axisAbove!: Line
  axisBelow!: Line
  raysIn: Line[] = []
  raysOut: Line[] = []
  lens!: Layer
  meridians: Line[] = []
  rim!: Line
  /** The lens's face (the ring where the light enters, turned to the star) and its back. */
  face!: Line
  back!: Line
  eyeLayer!: Layer
  eye!: WatchEye
  land!: Circle
  pool!: Circle
  petals: Line[] = []
  pod!: Circle

  /** The eye the symbol is seen from (`seenFrom`), else the live camera. */
  view?: () => View
  seenFrom(observer: Observer): void {
    this.view = () => viewOf(observer)
  }
  private localEye(): Vec3Like {
    const v = localView(this, this.view?.() ?? liveView() ?? { eye: { x: 0, y: 0, z: 1500 } })
    if ("eye" in v) return v.eye
    return { x: v.toward.x * 1e6, y: v.toward.y * 1e6, z: v.toward.z * 1e6 }
  }

  private eyeKey(): number[] {
    const e = this.localEye()
    return [Math.round(e.x), Math.round(e.y), Math.round(e.z)]
  }

  /** How far the symbol reaches from its centre: half its height. */
  get reach(): number {
    return this.size.value / 2
  }

  /** How far turned away (0..1), how far too deep (0..1), how much light reaches the land. */
  away(): number {
    return smooth(-this.relation.value)
  }
  deep(): number {
    return smooth(this.relation.value)
  }
  lit(): number {
    return clamp01(1 - this.away() - this.deep())
  }
  /** The flower's state: −1 shrivelled, 0 bud, 1 open. */
  bloom(): number {
    return this.lit() - this.away()
  }

  protected override compose(): void {
    const U = () => this.size.value
    const r = () => this.relation.value
    const h = () => EGOLENS.h * U()
    const starY = () => EGOLENS.star * U()
    const lensY = () => EGOLENS.lens * U()
    const landY = () => EGOLENS.land * U()
    const key = () => [r(), U()]
    const stroke = this.stroke
    const thin = derive(() => this.stroke.value * 0.6)

    // The lens body, in its own frame (centre at the origin, axis vertical),
    // then banked away by `away` about the depth axis.
    const R = () => h() * LENS_RADIUS_RATIO // the faces' radius, 2.5h
    const rimR = () => 2 * h()
    const bank = () => this.away() * AWAY_BANK
    const placeLens = (q: Vec3Like): Vec3Like => {
      const b = bank()
      return { x: q.x * Math.cos(b) - q.y * Math.sin(b), y: lensY() + q.x * Math.sin(b) + q.y * Math.cos(b), z: q.z }
    }
    /** A point on the upper (+1) or lower (−1) face at distance ρ from the axis, bearing φ, lens frame. */
    const face = (sign: number, rho: number, phi: number): Vec3Like => ({
      x: rho * Math.cos(phi),
      y: sign * (Math.sqrt(Math.max(0, R() * R() - rho * rho)) - (R() - h())),
      z: rho * Math.sin(phi),
    })
    /**
     * Where a ray from the star toward the world point `target` first meets
     * the lens body (the meet of the two face balls, wherever the lens is
     * turned) — or `target` itself if it misses.
     */
    const firstHit = (target: Vec3Like): Vec3Like => {
      const b = bank()
      const unbank = (q: Vec3Like): Vec3Like => {
        const y = q.y - lensY()
        return { x: q.x * Math.cos(b) + y * Math.sin(b), y: -q.x * Math.sin(b) + y * Math.cos(b), z: q.z }
      }
      const o = unbank({ x: 0, y: starY(), z: 0 })
      const t = unbank(target)
      const d = { x: t.x - o.x, y: t.y - o.y, z: t.z - o.z }
      let enter = -Infinity
      let exit = Infinity
      for (const cy of [-(R() - h()), R() - h()]) {
        const m = { x: o.x, y: o.y - cy, z: o.z }
        const A = d.x * d.x + d.y * d.y + d.z * d.z
        const B = 2 * (m.x * d.x + m.y * d.y + m.z * d.z)
        const C = m.x * m.x + m.y * m.y + m.z * m.z - R() * R()
        const disc = B * B - 4 * A * C
        if (disc < 0) return target
        const q = Math.sqrt(disc)
        enter = Math.max(enter, (-B - q) / (2 * A))
        exit = Math.min(exit, (-B + q) / (2 * A))
      }
      if (enter > exit) return target
      return placeLens({ x: o.x + d.x * enter, y: o.y + d.y * enter, z: o.z + d.z * enter })
    }
    const lensTint = derive(() => mix(mix(WHITE, BLUE, this.away()), RED, this.deep()))

    // THE STAR: fourteen rays in three dimensions — the six axes long, the
    // eight cube diagonals short — a starburst from every side.
    // Deep, the eye usurps it: the star dims and shrinks.
    this.star = this.add(new Null({ y: derive(starY), scale: derive(() => 1 - 0.4 * this.deep()) }))
    const dirs: [number, number, number, number][] = []
    for (const [x, y, z] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) dirs.push([x, y, z, EGOLENS.starLong])
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) dirs.push([sx, sy, sz, EGOLENS.starShort / Math.sqrt(3)])
    for (const [x, y, z, k] of dirs) {
      const ray = this.star.attach(new Line({ tint: RED, stroke }))
      derivePoints(ray, () => [U()], () => [{ x: 0, y: 0, z: 0 }, { x: x * k * U(), y: y * k * U(), z: z * k * U() }])
    }

    // THE LAND: a horizontal disc, quiet; the pool of light on it (red, a
    // wash and its ring) is there while light reaches it. Turned away, the
    // lens's shadow lies there instead: the ring cold, the land dimmed.
    this.land = this.add(
      new Circle({ radius: derive(() => EGOLENS.ground * U()), y: derive(landY), p: Math.PI / 2, tint: WHITE, stroke: thin, opacity: derive(() => 0.45 - 0.2 * this.away()) }),
    )
    this.pool = this.add(
      new Circle({
        radius: derive(() => EGOLENS.pool * U()),
        y: derive(landY),
        p: Math.PI / 2,
        tint: derive(() => mix(RED, BLUE, smooth((this.away() - 0.5) / 0.5))),
        stroke: thin,
        opacity: derive(() => this.lit() + 0.5 * this.away()),
      }),
    )
    // A faint wash (the host blends in linear light: a little reads as a glow), drawn with the ring, there while lit.
    this.pool.fillOpacity.follow(derive(() => 0.03 * this.pool.creation.value * this.lit()))

    // THE VERTICAL: the axis ray from the star to the lens, and on from the
    // lens to the flower while the light passes.
    this.axisAbove = this.add(new Line({ tint: RED, stroke }))
    derivePoints(this.axisAbove, key, () => {
      const top = firstHit({ x: 0, y: lensY(), z: 0 })
      const end = { x: lerp(top.x, 0, this.deep()), y: lerp(top.y, this.eyeY(), this.deep()), z: 0 }
      return [{ x: 0, y: starY(), z: 0 }, end]
    })
    this.axisBelow = this.add(new Line({ tint: RED, stroke }))
    derivePoints(this.axisBelow, key, () => {
      const bottom = placeLens(face(-1, 0, 0))
      const to = { x: 0, y: landY(), z: 0 }
      return this.lit() < 1e-3 ? [] : [bottom, add(bottom, add(to, bottom, -1), this.lit())]
    })

    // THE RAYS: from the star to the lens's upper face; out of its lower face
    // spreading to the pool's ring. Away, they end on its back; deep, they are
    // drawn into the eye.
    for (let i = 0; i < RAYS; i++) {
      const phi = (i / RAYS) * TAU
      const rho = () => EGOLENS.aperture * rimR()
      const rin = this.add(new Line({ tint: RED, stroke: thin }))
      derivePoints(rin, key, () => {
        // Aimed at the aperture ring, narrowed while the lens turns over
        // (edge-on halfway): away, the light ends on its back.
        const edge = Math.abs(Math.sin(bank()))
        const hit = firstHit({
          x: rho() * Math.cos(phi) * lerp(1, 0.2, edge),
          y: lensY(),
          z: rho() * Math.sin(phi),
        })
        const d = this.deep()
        const end = { x: lerp(hit.x, 0, d), y: lerp(hit.y, this.eyeY(), d), z: lerp(hit.z, 0, d) }
        return [{ x: 0, y: starY(), z: 0 }, end]
      })
      this.raysIn.push(rin)
      const rout = this.add(new Line({ tint: RED, stroke: thin }))
      derivePoints(rout, key, () => {
        const from = placeLens(face(-1, rho(), phi))
        const to = { x: EGOLENS.pool * U() * Math.cos(phi), y: landY(), z: EGOLENS.pool * U() * Math.sin(phi) }
        return this.lit() < 1e-3 ? [] : [from, add(from, add(to, from, -1), this.lit())]
      })
      this.raysOut.push(rout)
    }

    // THE LENS: its rim and four meridians — each the eye's almond.
    this.lens = this.add(new Layer())
    this.lens.presence.follow(derive(() => 1 - smooth((r() - 0.25) / 0.5)))
    this.rim = this.lens.attach(new Line({ tint: lensTint, stroke }))
    derivePoints(this.rim, key, () => {
      const pts: Vec3Like[] = []
      for (let k = 0; k <= 4 * ARC; k++) pts.push(placeLens(face(1, rimR(), (k / (4 * ARC)) * TAU)))
      return pts
    })
    for (let m = 0; m < MERIDIANS; m++) {
      const phi = (m / MERIDIANS) * Math.PI
      const line = this.lens.attach(new Line({ tint: lensTint, stroke: thin }))
      derivePoints(line, key, () => {
        const pts: Vec3Like[] = []
        // Over the top from one rim point to the opposite, and back underneath.
        for (let k = 0; k <= 2 * ARC; k++) {
          const s = -1 + k / ARC
          pts.push(placeLens(face(1, rimR() * Math.abs(s), s < 0 ? phi + Math.PI : phi)))
        }
        for (let k = 1; k <= 2 * ARC; k++) {
          const s = 1 - k / ARC
          pts.push(placeLens(face(-1, rimR() * Math.abs(s), s < 0 ? phi + Math.PI : phi)))
        }
        return pts
      })
      this.meridians.push(line)
    }
    // ITS FACE AND ITS BACK: the ring where the light enters, on the face
    // turned to the star (red), and its twin on the other face (blue, the
    // back, there only as it turns away). Each bright while it faces the
    // eye, faint when it is the far side — so the turn over reads.
    const facing = (sign: number) => {
      const b = bank()
      const n = { x: -Math.sin(b) * sign, y: Math.cos(b) * sign, z: 0 }
      const e = this.localEye()
      const d = { x: e.x, y: e.y - lensY(), z: e.z }
      const l = Math.hypot(d.x, d.y, d.z) || 1
      return smooth(0.5 + (4 * (n.x * d.x + n.y * d.y + n.z * d.z)) / l)
    }
    const faceRing = (sign: number, tint: Color, shown: () => number) => {
      const seen = () => shown() * lerp(0.22, 1, facing(sign))
      const line = this.lens.attach(new Line({ tint, stroke, opacity: derive(seen), fillOpacity: derive(() => 0.12 * seen()) }))
      derivePoints(line, () => [...key(), ...this.eyeKey()], () => {
        const pts: Vec3Like[] = []
        for (let k = 0; k <= 4 * ARC; k++) pts.push(placeLens(face(sign, EGOLENS.aperture * rimR(), (k / (4 * ARC)) * TAU)))
        return pts
      })
      return line
    }
    this.face = faceRing(1, RED, () => 1 - 0.5 * this.away())
    this.back = faceRing(-1, BLUE, () => this.away())

    // THE CYCLOPS: the lens becomes the eye whose section it is (RingEye's
    // eye, at the lens's own h), standing on the axis and turned to whoever
    // looks (upright: a heading on the outer layer, a pitch on the inner, so
    // it never rolls). It opens as the clear eye — the lens's outline is its
    // lids — and, going deeper, burns: the lids give way to fire, the iris
    // glares, the pupil narrows to a slit. The flaming, lidless eye of the
    // watchtower, risen toward the star and swollen, every ray drawn into it.
    this.eyeLayer = this.add(new Layer({ y: derive(() => this.eyeY()) }))
    this.eyeLayer.presence.follow(derive(() => smooth((r() - 0.3) / 0.45)))
    this.eyeLayer.scale.follow(derive(() => 0.85 + 0.35 * this.deep()))
    const toEye = () => {
      const e = this.localEye()
      return { x: e.x, y: e.y - this.eyeY(), z: e.z }
    }
    this.eyeLayer.h.follow(derive(() => Math.atan2(toEye().x, toEye().z)))
    const upright = this.eyeLayer.attach(new Null())
    upright.p.follow(derive(() => {
      const d = toEye()
      return -Math.atan2(d.y, Math.hypot(d.x, d.z))
    }))
    this.eye = upright.attach(new WatchEye({ unit: derive(h), gaze: derive(() => 1 - smooth((r() - 0.45) / 0.5)), stroke }))

    // THE LOTUS at the centre of the land.
    const centre = () => ({ x: 0, y: landY(), z: 0 })
    const bloomTint = derive(() => {
      const b = this.bloom()
      return b >= 0 ? mix(WHITE, RED, b) : mix(WHITE, BLUE, -b)
    })
    for (const ring of [0, 1]) {
      for (let i = 0; i < PETALS; i++) {
        const phi = ((i + ring / 2) / PETALS) * TAU
        const petal = this.add(new Line({ tint: bloomTint, stroke: ring === 0 ? stroke : thin }))
        derivePoints(petal, key, () => {
          const b = this.bloom()
          const len = (ring === 0 ? EGOLENS.petalIn : EGOLENS.petalOut) * U() * tri(b, 0.72, 0.92, 1)
          const width = len * tri(b, 0.2, 0.26, 0.34)
          // Tilt from the vertical: drooping · a closed bud · open, inner ring then outer.
          const tilt = ring === 0 ? tri(b, 1.75, 0.12, 0.62) : tri(b, 2.2, 0.22, 1.12)
          const curl = tri(b, 1.1, -0.45, -0.38)
          return petalOutline(centre(), phi, EGOLENS.petalBase * U() * (1 + ring), len, width, tilt, curl, 0.35)
        })
        this.petals.push(petal)
      }
    }
    this.pod = this.add(
      new Circle({ radius: derive(() => EGOLENS.petalBase * U() * 1.2), y: derive(() => landY() + 0.01 * U()), p: Math.PI / 2, tint: bloomTint, stroke: thin }),
    )
  }

  /** The cyclops's height: the lens's, risen toward the star as it goes deep. */
  eyeY(): number {
    const U = this.size.value
    return EGOLENS.lens * U + this.deep() * EGOLENS.rise * (EGOLENS.star - EGOLENS.lens) * U
  }

  /**
   * The star shines, its light comes down the axis and through the lens,
   * the land receives it and the lotus opens.
   */
  override createAnim(): Anim {
    void this.parts
    return together(
      restage(Create(this.star), 0, 0.25),
      restage(Create(this.land), 0.05, 0.35),
      restage(Create(this.axisAbove), 0.15, 0.4),
      restage(Create(this.lens), 0.2, 0.6),
      restage(Create(this.eyeLayer), 0.2, 0.6),
      ...this.raysIn.map((l) => restage(Create(l), 0.35, 0.6)),
      restage(Create(this.axisBelow), 0.55, 0.75),
      ...this.raysOut.map((l) => restage(Create(l), 0.55, 0.8)),
      restage(Create(this.pool), 0.7, 0.9),
      restage(Create(this.pod), 0.7, 0.8),
      ...this.petals.map((l, i) => restage(Create(l), 0.72 + (i % PETALS) * 0.02, 0.88 + (i % PETALS) * 0.015)),
    )
  }

  /** Walkable: click the symbol (or its digit) — away · icon · deep. */
  override stateSpace(): StateSpace | undefined {
    if (this.relation.isBound) return undefined
    return {
      axes: [
        axis(
          "relation",
          this,
          { away: { relation: -1 }, icon: { relation: 0 }, deep: { relation: 1 } },
          { label: "the ego's relation to the light", duration: 2.4, escape: "icon", handles: [this] },
        ),
      ],
    }
  }
}
