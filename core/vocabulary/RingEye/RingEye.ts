/**
 * RingEye — the eye seen through the ring: the true eye and its parody,
 * framed by the same circle.
 *
 * THE IMAGE (Tolkien). The One Ring binds free will and folds everything
 * into one system; its maker is the flaming, lidless eye on the tower, and
 * in a sense that eye looks out through the ring. But in the book one
 * figure takes the ring without craving, plays with it and looks through
 * it — and through the ring a clear, blue, innocent eye flashes. So the
 * same ring frames either eye. The burning one is the parody of the true
 * one: the eye that has gathered the world INTO itself, against the eye
 * that holds the world as a reflection and so becomes conscious of itself.
 *
 * One number, `gaze` 0..1, walked as one axis:
 *
 *   0  WATCHTOWER  lidless: no lids, only the almond rimmed with fire, a
 *                  crown of flames rising over it where the lid would be;
 *                  the iris wide, kissing both corners, a slit for a pupil;
 *                  the eye standing on its tower; the ring's metal hot.
 *   1  CLEAR       the lids (the almond and the upper lid's crease, white),
 *                  a clear blue iris, the pupil round and holding the world
 *                  (a small globe: the near halves of its equator and a
 *                  meridian) with a catchlight beside it; no tower; the
 *                  ring plain gold.
 *
 * Between, the fire goes out first, the slit dilates into the round pupil,
 * and the lids and the world arrive. Colour note: in this vocabulary red is
 * the real and blue the counterfeit; here the image itself makes the clear
 * eye blue and the false one burn, and the image is kept.
 *
 * REAL 3D. The ring is a torus (torusMesh, about +Y), drawn by its smooth
 * contours with hidden lines removed (SolidDrawing). `turn` stands it up:
 * 0 lying in the horizontal plane, 1 upright facing +z (the default; the
 * symbol's Create turns it toward the viewer). The eye stands BEHIND the
 * ring's plane (RINGEYE.depth), inside its opening, and turns to whoever
 * looks (a heading on the outer layer, a pitch on the inner, so it never
 * rolls) — whichever eye it is, it looks at you through the ring. The
 * tower stands at the eye's depth, its top just under the fire, its foot
 * far below on a ground disc: a frustum, a second SolidDrawing holding the
 * torus as an occluder only, so the ring hides the tower where it passes
 * behind it and, turned, the tower is seen to stand beyond the ring.
 *
 * THE EYE'S CONSTRUCTION is MolochEye's: the lens half-height h is the unit,
 * the lids the 3-4-5 arcs (radius LENS_RADIUS_RATIO·h, centres ∓(R − h)),
 * the glaring iris r = h kissing the apexes.
 */

import { Ellipse, Line, Null, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { SolidDrawing, type SolidDrawingOptions } from "../../src/parts/soliddrawing"
import type { Solid } from "../../src/geometry/hiddenline"
import { coneMesh, torusMesh, type Mesh } from "../../src/geometry/meshes"
import { localView, viewOf } from "../../src/geometry/frames"
import type { Observer } from "../../src/dream"
import type { Overrides } from "../../src/holon"
import { completion, derive, length, type Readable } from "../../src/params"
import { restage, together, type Anim } from "../../src/anim"
import { toggle, type StateSpace } from "../../src/automaton"
import { Create } from "../../src/verbs"
import { BLACK, BLUE, GOLD, RED, WHITE, type Color } from "../../src/constants"
import { clamp01, lerp } from "../../src/math"
import { ease } from "../../src/timeline"
import { Layer } from "../Figure/Figure"
import { LENS_RADIUS_RATIO } from "../MolochEye/MolochEye"

/** The construction, in units of R = `radius` (the ring, to its tube's centre). */
export const RINGEYE = {
  /** The tube's radius: the ring's opening is 1 − tube. */
  tube: 0.13,
  /** h, the eye's lens half-height (its almond is 4h wide). */
  h: 0.32,
  /** How far behind the ring's plane the eye stands. */
  depth: 0.32,
  /** The iris, × h: glaring (kissing the corners) · clear. */
  irisWatch: 1,
  irisClear: 0.86,
  /** The pupil, × h: the slit's half-width and half-height · the round pupil's radius. */
  slitW: 0.13,
  slitH: 0.9,
  pupil: 0.5,
  /** The tower, × R: it stands behind the ring at the eye's depth — its top just under the
   *  eye's fire, its foot far below the ring — and its radii at the foot and the top. */
  top: 0.5,
  foot: 2.35,
  towerBase: 0.26,
  towerTop: 0.1,
  /** The ground disc round the tower's foot. */
  ground: 0.62,
} as const

/** Flames per lid arc (+1: they stand at equal angles strictly inside it). */
const FLAMES = 8
/** The lid arcs' half-span (the 3-4-5). */
const HALF_SPAN = Math.asin(4 / 5)
/** Samples round a closed curve. */
const ROUND = 64

const smooth = (u: number) => ease("smooth", clamp01(u))
const mix = (a: Color, b: Color, u: number): Color => ({ r: lerp(a.r, b.r, u), g: lerp(a.g, b.g, u), b: lerp(a.b, b.b, u) })
/** The fire's own colours: the hot metal, and the glaring iris (between the flame and the gold). */
const HOT = mix(GOLD, RED, 0.8)
const GLARE = mix(RED, GOLD, 0.55)

/** How much fire (1 at the watchtower, gone by 0.6) and how much calm (from 0.4, whole at clear). */
export const fireAt = (g: number): number => 1 - smooth(g / 0.6)
export const calmAt = (g: number): number => smooth((g - 0.4) / 0.6)

/**
 * The pupil's outline at `g`, in the eye's plane, unit h: a slit (pointed
 * top and bottom, x ∝ |cos t|^e with e > 1) dilating into the round pupil
 * (e = 1, half-width = half-height).
 */
export const pupilOutline = (g: number, h: number): Vec3Like[] => {
  const s = smooth(g)
  const w = lerp(RINGEYE.slitW, RINGEYE.pupil, s) * h
  const v = lerp(RINGEYE.slitH, RINGEYE.pupil, s) * h
  const e = lerp(1.7, 1, s)
  const pts: Vec3Like[] = []
  for (let k = 0; k <= ROUND; k++) {
    const t = (k / ROUND) * 2 * Math.PI
    const c = Math.cos(t)
    pts.push({ x: w * Math.sign(c) * Math.pow(Math.abs(c), e), y: v * Math.sin(t), z: 0 })
  }
  return pts
}

/**
 * One flame, a closed teardrop in the eye's plane: its round foot at `root`,
 * its point `len` away along the unit direction `n`, the axis bending upward
 * (fire rises) by `bend`·len at the point; `width` its greatest half-width.
 */
export const flameOutline = (root: Vec3Like, n: { x: number; y: number }, len: number, width: number, bend: number): Vec3Like[] => {
  const N = 16
  const axisAt = (s: number) => ({ x: root.x + n.x * len * s, y: root.y + n.y * len * s + bend * len * s * s })
  const edge = (sign: number) =>
    Array.from({ length: N + 1 }, (_, i) => {
      const s = i / N
      const d = { x: n.x, y: n.y + 2 * bend * s }
      const l = Math.hypot(d.x, d.y) || 1
      // Round at the foot (steep from zero), widest a third of the way, pointed at the tip.
      const w = width * Math.sin(Math.PI * Math.pow(s, 0.6)) * sign
      const m = axisAt(s)
      return { x: m.x - (d.y / l) * w, y: m.y + (d.x / l) * w, z: 0 }
    })
  return [...edge(1), ...edge(-1).reverse().slice(1)]
}

/** The ring's torus, about +Y (memoised per proportions: a mesh is data). */
const TORI = new Map<string, Mesh>()
const torus = (R: number, r: number): Mesh => {
  const key = `${R}|${r}`
  let m = TORI.get(key)
  if (!m) TORI.set(key, (m = torusMesh(R, r, 72, 24)))
  return m
}

/** The ring itself: its torus, black-filled, by its visible contours. */
class Band extends SolidDrawing {
  private band!: { owner: RingEye }
  constructor(owner: RingEye, overrides: Overrides & SolidDrawingOptions) {
    super({ lineSlots: 96, ...overrides })
    this.band = { owner }
  }
  solids(): Solid[] {
    const m = this.band.owner.torus()
    return [{ kind: "mesh", positions: m.positions, triangles: m.triangles, fill: BLACK }]
  }
}

/** The tower the eye stands on, behind the ring: a frustum, the ring's torus hiding it where it passes behind. */
class Tower extends SolidDrawing {
  private tower!: { owner: RingEye }
  constructor(owner: RingEye, overrides: Overrides & SolidDrawingOptions) {
    super({ lineSlots: 48, ...overrides })
    this.tower = { owner }
  }
  solids(): Solid[] {
    const o = this.tower.owner
    const R = o.radius.value
    const top = -RINGEYE.top * R
    const foot = -RINGEYE.foot * R
    const z = -RINGEYE.depth * R
    const key = `${R}`
    let m = o.towerMemo.get(key)
    if (!m) {
      const cone = coneMesh(RINGEYE.towerBase * R, RINGEYE.towerTop * R, top - foot, 32)
      const mid = (top + foot) / 2
      m = { positions: cone.positions.map((p) => ({ x: p.x, y: p.y + mid, z: p.z + z })), triangles: cone.triangles }
      o.towerMemo.clear()
      o.towerMemo.set(key, m)
    }
    const out: Solid[] = [{ kind: "mesh", positions: m.positions, triangles: m.triangles, fill: BLACK, crease: 0.5 }]
    // The ring as it stands (upright only when `turn` is 1): an occluder.
    if (o.turn.value > 0.999) {
      const t = o.uprightTorus()
      out.push({ kind: "mesh", positions: t.positions, triangles: t.triangles, fill: BLACK, lines: false })
    }
    return out
  }
}

export class RingEye extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** R, the ring's radius (to the tube's centre) — the symbol's one size. */
  radius = length(120)
  /** 0 the watchtower's eye (burning, lidless) … 1 the clear eye. The walkable axis. */
  gaze = completion(0)
  /** 0 the ring lying in the horizontal plane … 1 upright, facing +z (Create turns it up). */
  turn = completion(1)
  /** The pen, screen px. */
  stroke = length(2.4)

  ringFrame!: Null
  band!: Band
  towerLayer!: Layer
  tower!: Tower
  ground!: Ellipse
  eyeLayer!: Layer
  lidTop!: Line
  lidBottom!: Line
  crease!: Line
  iris!: Line
  pupil!: Line
  world!: Layer
  equator!: Line
  meridian!: Line
  catchlight!: Ellipse
  flames: Line[] = []

  /** @internal the tower's frustum, per R. */
  towerMemo = new Map<string, Mesh>()
  private seen!: { observer?: Observer; upright?: { key: number; mesh: Mesh } }

  constructor(overrides: Overrides & { observer?: Observer } = {}) {
    const { observer, ...rest } = overrides
    super(rest)
    this.seen = { observer }
  }

  /** How much fire, how much calm — the readings a whole that weaves this can follow. */
  fire(): number {
    return fireAt(this.gaze.value)
  }
  calm(): number {
    return calmAt(this.gaze.value)
  }

  /** The ring's torus in its own frame (about +Y, lying). */
  torus(): Mesh {
    return torus(this.radius.value, RINGEYE.tube * this.radius.value)
  }
  /** The torus upright in the symbol's frame (facing +z) — the tower's occluder. */
  uprightTorus(): Mesh {
    const R = this.radius.value
    const s = this.seen.upright
    if (s && s.key === R) return s.mesh
    const m = this.torus()
    // p = π/2 about x: (x, y, z) → (x, −z, y).
    const mesh = { positions: m.positions.map((p) => ({ x: p.x, y: -p.z, z: p.y })), triangles: m.triangles }
    this.seen.upright = { key: R, mesh }
    return mesh
  }

  private localEye(): Vec3Like {
    const v = localView(this, this.seen.observer ? viewOf(this.seen.observer) : { eye: { x: 0, y: 0, z: 1500 } })
    if ("eye" in v) return v.eye
    return { x: v.toward.x * 1e6, y: v.toward.y * 1e6, z: v.toward.z * 1e6 }
  }

  /** Walkable: the watchtower's eye ↔ the clear eye. */
  override stateSpace(): StateSpace | undefined {
    if (this.gaze.isBound) return undefined
    return {
      axes: [toggle("gaze", this.gaze, { off: ["watchtower", 0], on: ["clear", 1], duration: 2.6, handles: [this] })],
    }
  }

  protected override compose(): void {
    const observer = this.seen.observer
    const R = () => this.radius.value
    const h = () => RINGEYE.h * R()
    const g = () => this.gaze.value
    const s = () => smooth(g())
    const key = () => [g(), R()]
    const stroke = this.stroke
    const thin = derive(() => this.stroke.value * 0.6)
    const tint = (f: () => Color): Readable<Color> => derive(f)

    // THE RING: the torus lies about +Y; `turn` stands it up about x.
    this.ringFrame = this.add(new Null({ p: derive(() => this.turn.value * (Math.PI / 2)) }))
    this.band = this.ringFrame.attach(
      new Band(this, { observer, tint: tint(() => mix(HOT, GOLD, s())), stroke }),
    )

    // THE TOWER under it, and the ground round its foot: the watchtower's.
    this.towerLayer = this.add(new Layer())
    this.towerLayer.presence.follow(derive(() => this.fire()))
    this.tower = this.towerLayer.attach(new Tower(this, { observer, tint: tint(() => mix(WHITE, HOT, 0.35)), stroke: thin }))
    this.ground = this.towerLayer.attach(
      new Ellipse({
        radiusX: derive(() => RINGEYE.ground * R()),
        radiusY: derive(() => RINGEYE.ground * R()),
        y: derive(() => -RINGEYE.foot * R()),
        z: derive(() => -RINGEYE.depth * R()),
        p: Math.PI / 2,
        tint: WHITE,
        stroke: thin,
        opacity: 0.45,
      }),
    )

    // THE EYE: behind the ring's plane, turned to whoever looks, upright.
    this.eyeLayer = this.add(new Layer({ z: derive(() => -RINGEYE.depth * R()) }))
    const toEye = () => {
      const e = this.localEye()
      return { x: e.x, y: e.y, z: e.z + RINGEYE.depth * R() }
    }
    this.eyeLayer.h.follow(derive(() => Math.atan2(toEye().x, toEye().z)))
    const eye = this.eyeLayer.attach(new Null())
    eye.p.follow(derive(() => {
      const d = toEye()
      return -Math.atan2(d.y, Math.hypot(d.x, d.z))
    }))

    // The almond (MolochEye's 3-4-5 lens): fire's rim at the watchtower, the lids at clear.
    const lidTint = tint(() => mix(HOT, WHITE, s()))
    const arc = (sign: number, lift = 0, span = 1): Vec3Like[] => {
      const H = h()
      const c = -sign * (LENS_RADIUS_RATIO - 1) * H + lift * H
      const pts: Vec3Like[] = []
      for (let k = 0; k <= ROUND; k++) {
        const a = sign * (Math.PI / 2) + (-1 + (2 * k) / ROUND) * HALF_SPAN * span
        pts.push({ x: LENS_RADIUS_RATIO * H * Math.cos(a), y: c + LENS_RADIUS_RATIO * H * Math.sin(a), z: 0 })
      }
      return pts
    }
    this.lidTop = eye.attach(new Line({ tint: lidTint, stroke }))
    derivePoints(this.lidTop, () => [R()], () => arc(1))
    this.lidBottom = eye.attach(new Line({ tint: lidTint, stroke }))
    derivePoints(this.lidBottom, () => [R()], () => arc(-1))
    // The upper lid's crease: the lid itself, lifted — there only where there are lids.
    this.crease = eye.attach(new Line({ tint: WHITE, stroke: thin, opacity: derive(() => this.calm()) }))
    derivePoints(this.crease, () => [R()], () => arc(1, 0.3, 0.72))

    // The iris: glaring, kissing the corners · clear and blue.
    this.iris = eye.attach(new Line({ tint: tint(() => mix(GLARE, BLUE, s())), stroke }))
    derivePoints(this.iris, key, () => {
      const r = lerp(RINGEYE.irisWatch, RINGEYE.irisClear, s()) * h()
      return Array.from({ length: ROUND + 1 }, (_, k) => {
        const a = Math.PI / 2 + (k / ROUND) * 2 * Math.PI
        return { x: r * Math.cos(a), y: r * Math.sin(a), z: 0 }
      })
    })
    // The pupil: the slit dilating into the round pupil.
    this.pupil = eye.attach(new Line({ tint: tint(() => mix(RED, WHITE, s())), stroke }))
    derivePoints(this.pupil, key, () => pupilOutline(g(), h()))

    // THE WORLD in the clear pupil: a small globe, its limb the pupil itself —
    // the near halves of its equator (tipped toward the eye) and of a meridian.
    this.world = eye.attach(new Layer())
    this.world.presence.follow(derive(() => this.calm()))
    const globe = (tilt: number, turnY: number, meridian: boolean): Vec3Like[] => {
      // Inside the pupil as it opens: its half-width until it is round.
      const r = lerp(RINGEYE.slitW, RINGEYE.pupil, s()) * h() * 0.98
      const pts: Vec3Like[] = []
      for (let k = 0; k <= ROUND / 2; k++) {
        const a = (k / (ROUND / 2)) * Math.PI
        // A great circle: the equator in the x–z plane, a meridian in the y–z plane; the near half (z ≥ 0).
        let p = meridian ? { x: 0, y: r * Math.cos(a), z: r * Math.sin(a) } : { x: r * Math.cos(a), y: 0, z: r * Math.sin(a) }
        p = { x: p.x, y: p.y * Math.cos(tilt) + p.z * Math.sin(tilt), z: -p.y * Math.sin(tilt) + p.z * Math.cos(tilt) }
        p = { x: p.x * Math.cos(turnY) + p.z * Math.sin(turnY), y: p.y, z: -p.x * Math.sin(turnY) + p.z * Math.cos(turnY) }
        pts.push(p)
      }
      return pts
    }
    this.equator = this.world.attach(new Line({ tint: BLUE, stroke: thin }))
    derivePoints(this.equator, key, () => globe(-0.42, 0, false))
    this.meridian = this.world.attach(new Line({ tint: BLUE, stroke: thin }))
    derivePoints(this.meridian, key, () => globe(-0.42, 0.55, true))
    this.catchlight = this.world.attach(
      new Ellipse({
        x: derive(() => -0.5 * h()),
        y: derive(() => 0.42 * h()),
        radiusX: derive(() => 0.085 * h()),
        radiusY: derive(() => 0.085 * h()),
        filled: true,
        tint: WHITE,
      }),
    )

    // THE FIRE: a crown of flames over the lidless almond — rising, tallest
    // over its apex, long and short in turn — and one out of each corner,
    // leaning up; mirror-symmetric. Where the lid would be, fire.
    const flame = (place: () => { root: Vec3Like; n: { x: number; y: number } }, len: number, width: number, bend: number) => {
      const line = eye.attach(new Line({ tint: RED, stroke: thin }))
      derivePoints(line, key, () => {
        const f = this.fire()
        if (f < 1e-3) return []
        const { root, n } = place()
        return flameOutline(root, n, len * h() * f, width * h() * (0.4 + 0.6 * f), bend)
      })
      this.flames.push(line)
    }
    const onLid = (a: number) => () => {
      const H = h()
      const n = { x: Math.cos(a), y: Math.sin(a) }
      const cy = -(LENS_RADIUS_RATIO - 1) * H
      const r = (LENS_RADIUS_RATIO + 0.14) * H
      return { root: { x: n.x * r, y: cy + n.y * r, z: 0 }, n }
    }
    for (let k = 1; k < FLAMES; k++) {
      const t = -1 + (2 * k) / FLAMES
      const a = Math.PI / 2 + t * HALF_SPAN
      flame(onLid(a), (0.42 + 0.5 * Math.cos((t * Math.PI) / 2)) * (k % 2 === 0 ? 1 : 0.7), 0.15, 0.35)
    }
    for (const side of [1, -1]) flame(() => ({ root: { x: side * 2.14 * h(), y: 0, z: 0 }, n: { x: side, y: 0 } }), 0.38, 0.12, 0.5)
  }

  /**
   * The ring is drawn lying and turns up toward the viewer; then the eye
   * is seen through it — the almond, the iris, the pupil, and whichever it
   * holds: the fire round it and the tower under it, or the world in it.
   */
  override createAnim(): Anim {
    void this.parts
    return together(
      restage(Create(this.band), 0, 0.3),
      [this.turn.sequence(0, 1), 0.1, 0.5],
      restage(Create(this.towerLayer), 0.45, 0.7),
      restage(Create(this.lidTop), 0.45, 0.7),
      restage(Create(this.lidBottom), 0.5, 0.75),
      restage(Create(this.iris), 0.6, 0.8),
      restage(Create(this.pupil), 0.7, 0.85),
      restage(Create(this.crease), 0.72, 0.88),
      restage(Create(this.world), 0.8, 1),
      ...this.flames.map((l, i) => restage(Create(l), 0.72 + 0.006 * i, 0.86 + 0.006 * i)),
    )
  }
}
