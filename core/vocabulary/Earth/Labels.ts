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

import { Euler, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three/webgpu"
import { Circle, Null } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { derive, paramEpoch } from "../../src/params"
// A cycle with Earth.ts, safe: these are only called once both modules have loaded.
import { chainAt, lod as lodOf, worldMatrixOf as worldMatrix, type Earth } from "./Earth"
import { latLonToUnit } from "../../src/geometry/sphere"
import { ARIMO } from "../../src/geometry/fonts/arimo"

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
  /**
   * A local point on the 1280 × 720 reference frame, or undefined behind
   * the camera / for an orthographic eye (where labels skip decluttering).
   */
  toScreen(x: number, y: number, z: number): [number, number] | undefined
  /** Bumped whenever the camera or the Earth moved — a cheap memo key. */
  version(): number
}

/** How far above the ground a label floats, as a fraction of the radius. */
const LIFT = 0.003
/** The sight-line elevation (sine) over which a label fades in from the horizon. */
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
  const key: number[] = []
  let hpb: [number, number, number] = [0, 0, 0]
  let eye = { x: 0, y: 0, z: 1500 }
  let tanHalf = Math.tan(((53.13 * Math.PI) / 180) / 2)
  let ortho = false
  let orthoUnits = 1
  let version = 0
  const world = new Matrix4()
  const scratch = new Vector3()

  let seenEpoch = Number.NaN
  const refresh = (): void => {
    const epoch = paramEpoch()
    if (epoch === seenEpoch) return
    seenEpoch = epoch
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
    at(chainAt(earth, at))
    if (key.length !== i) {
      key.length = i
      moved = true
    }
    if (!moved) return
    version++

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
    cam.fov = ((o ? o.fov.value : (53.13 * Math.PI) / 180) * 180) / Math.PI
    cam.aspect = 16 / 9
    cam.near = 1
    cam.far = 100000
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    world.copy(worldMatrix(earth))

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
    toScreen: (x, y, z) => {
      refresh()
      if (ortho) return undefined
      const v = scratch.set(x, y, z).applyMatrix4(world).project(cam)
      if (!(v.z < 1)) return undefined
      return [((v.x + 1) / 2) * 1280, ((1 - v.y) / 2) * 720]
    },
    version: () => {
      refresh()
      return version
    },
    facing: (x, y, z) => {
      refresh()
      // The elevation of the sight line at the label: the ground normal
      // against the direction to the eye — 1 looking straight down, 0 at
      // the horizon, below 0 behind it, whatever the altitude.
      const n = Math.hypot(x, y, z) || 1
      if (ortho) {
        const d = Math.hypot(eye.x, eye.y, eye.z) || 1
        return smooth((x * eye.x + y * eye.y + z * eye.z) / (n * d) / HORIZON_FADE)
      }
      const vx = eye.x - x
      const vy = eye.y - y
      const vz = eye.z - z
      const v = Math.hypot(vx, vy, vz) || 1
      return smooth((x * vx + y * vy + z * vz) / (n * v) / HORIZON_FADE)
    },
  }
}

const smooth = (t: number): number => {
  const u = Math.max(0, Math.min(1, t))
  return u * u * (3 - 2 * u)
}

/** One registered label, as the declutter pass sees it. */
interface Placed {
  x: number
  y: number
  z: number
  /** Presence before collision: labelOpacity × LOD × horizon. */
  base: () => number
  /** Box in label units (× pixel size): left, right, top, bottom around the anchor. */
  box: [number, number, number, number]
  /** Lower draws first and wins. */
  priority: number
  scale: number
}

/**
 * DECLUTTER. Names that would overprint each other yield to the stronger
 * one — greedy placement in a FIXED priority order (rank, then capitals,
 * then population; countries before the cities inside them), so which
 * name wins never depends on the camera, only on the map.
 *
 * And it is continuous, which is what keeps it still while the camera
 * moves. A label is not in or out: its opacity falls with how much of
 * its (padded) screen box is already covered by the labels placed before
 * it, each weighted by its own opacity. Overlap changes continuously as
 * the eye moves, so names cross-fade where a hard in/out would flicker
 * at the boundary. That is the hysteresis a game would keep as state,
 * achieved without any — the layout is a pure function of the frame, so
 * scrubbing backwards shows exactly what playing forwards showed.
 */
export class LabelLayout {
  private readonly items: Placed[] = []
  private order: number[] = []
  private result = new Float64Array(0)
  private key = new Float64Array(5).fill(Number.NaN)

  constructor(
    private readonly earth: Earth,
    private readonly board: Billboard,
  ) {}

  add(item: Placed): number {
    this.items.push(item)
    this.order = this.items.map((_, i) => i).sort((a, b) => this.items[a]!.priority - this.items[b]!.priority)
    this.result = new Float64Array(this.items.length)
    this.key.fill(Number.NaN)
    return this.items.length - 1
  }

  /** The final opacity of label `i` this frame. */
  opacity(i: number): number {
    this.layout()
    return this.result[i]!
  }

  private layout(): void {
    const e = this.earth
    const k = [this.board.version(), e.detail.value, e.labelOpacity.value, e.labelSize.value, e.labelBias.value]
    if (k.every((v, j) => v === this.key[j])) return
    k.forEach((v, j) => (this.key[j] = v))
    const size = e.labelSize.value
    const placed: { l: number; r: number; t: number; b: number; w: number }[] = []
    for (const i of this.order) {
      const it = this.items[i]!
      const base = it.base()
      if (base <= 0.002) {
        this.result[i] = 0
        continue
      }
      const s = this.board.toScreen(it.x, it.y, it.z)
      if (!s) {
        this.result[i] = base
        continue
      }
      const px = size * it.scale
      const l = s[0] + it.box[0] * px - PAD
      const r = s[0] + it.box[1] * px + PAD
      const t = s[1] - it.box[2] * px - PAD
      const b = s[1] - it.box[3] * px + PAD
      const area = (r - l) * (b - t)
      let covered = 0
      for (const q of placed) {
        const ix = Math.min(r, q.r) - Math.max(l, q.l)
        const iy = Math.min(b, q.b) - Math.max(t, q.t)
        if (ix > 0 && iy > 0) covered = Math.max(covered, ((ix * iy) / area) * q.w)
      }
      const o = base * (1 - smooth(covered / YIELD))
      this.result[i] = o
      if (o > 0.002) placed.push({ l, r, t, b, w: o / Math.max(base, 1e-9) })
    }
  }
}

/** Country names are set in open capitals: extra advance per glyph, in ems. */
const COUNTRY_TRACKING = 0.14

/**
 * A label's width in ems, MEASURED: the glyph advances of the face the
 * renderer sets it in (an unset Text font is Arimo alone — render/text.ts
 * DEFAULT_FONT_URL — and src/geometry/fonts/arimo.ts is that face as data),
 * plus the tracking each glyph carries. Kerning, which the shaper may add,
 * is left out: it moves a name by a fraction of a letter, well inside the
 * boxes' padding. A glyph outside the baked set counts as a space.
 */
export const textWidth = (text: string, tracking = 0): number => {
  const em = ARIMO.unitsPerEm
  const space = ARIMO.glyphs[32]?.[0] ?? em * 0.28
  let w = 0
  let n = 0
  for (const ch of text) {
    w += ARIMO.glyphs[ch.codePointAt(0)!]?.[0] ?? space
    n++
  }
  return w / em + Math.max(0, n - 1) * tracking
}

/** Breathing room round every label box, screen pixels. */
const PAD = 3
/** A label is gone once this fraction of its box is covered by stronger ones. */
const YIELD = 0.12

/**
 * Build one label: anchored at (lat, lon), facing the camera, sized in
 * pixels, fading by rank, toward the horizon, and under stronger names.
 */
export const makeLabel = (
  earth: Earth,
  board: Billboard,
  layout: LabelLayout,
  spec: {
    lat: number
    lon: number
    text: string
    rank: number
    kind: "country" | "city"
    capital?: boolean
    population?: number
  },
): Label => {
  const R = earth.radius.value
  const u = latLonToUnit(spec.lat, spec.lon)
  const k = R * (1 + LIFT)
  const ax = u.x * k
  const ay = u.y * k
  const az = u.z * k
  const city = spec.kind === "city"
  const scale = city ? 0.85 : 1
  // The text's real width, in ems, from the face the renderer draws it in.
  const tracking = city ? 0 : COUNTRY_TRACKING
  const width = textWidth(spec.text, tracking)
  const index = layout.add({
    x: ax,
    y: ay,
    z: az,
    base: () =>
      earth.labelOpacity.value *
      lodOf(spec.rank, earth.detail.value + earth.labelBias.value) *
      board.facing(ax, ay, az),
    box: city ? [-0.3, 0.55 + width, 0.55, -0.55] : [-width / 2, width / 2, 0.55, -0.55],
    priority:
      spec.rank / 2 -
      (city ? 0 : 0.75) -
      (spec.capital ? 0.5 : 0) -
      (spec.population ? Math.log10(1 + spec.population) * 0.05 : 0),
    scale,
  })
  const presence = derive(() => layout.opacity(index))
  const anchor = new Null({ x: ax, y: ay, z: az })
  anchor.h.follow(derive(() => board.hpb()[0]))
  anchor.p.follow(derive(() => board.hpb()[1]))
  anchor.b.follow(derive(() => board.hpb()[2]))
  anchor.scale.follow(derive(() => board.unitsPerPx(ax, ay, az) * earth.labelSize.value * scale))
  const add = <T extends import("../../src/holon").Holon>(h: T): T =>
    (anchor as unknown as { add(h: T): T }).add(h)
  add(
    new Text({
      content: spec.text,
      size: 1,
      tint: earth.labelTint,
      stroke: 0,
      composite: "overlay",
      tracking,
      align: city ? "left" : "center",
      x: city ? 0.55 : 0,
      y: -0.35,
      opacity: presence,
    }),
  )
  if (city) add(new Circle({ radius: 0.18, stroke: 0, fillOpacity: 1, tint: earth.labelTint, opacity: presence }))
  return anchor
}
