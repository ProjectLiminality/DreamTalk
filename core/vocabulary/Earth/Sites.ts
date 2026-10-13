/**
 * Sites — the built world that stands on the Earth: a Factory (a
 * sawtooth-roofed hall), a Headquarters (a tower on a podium), and the
 * plain data a scene hands over to place them.
 *
 * Both are PRISMS: a 2D profile drawn in the XY plane, extruded along z.
 * A prism's ink is its two profile loops and one rib per profile vertex
 * joining them — exactly the edges a line drawing of the solid has — and
 * its body is a black solid `Surface` that writes depth, so the edges on
 * its far side vanish behind its own near faces (true hidden lines, from
 * the GPU, at any angle the camera takes) and the land behind it is
 * covered. Everything is built standing on y = 0 with +y up, which is what
 * a `Place` (Earth.ts) turns into "out of the ground".
 *
 * The two symbols are deliberately few lines. A sawtooth roof is the
 * oldest pictogram of a factory — north-light glazing on every tooth —
 * and a tall tower with floor lines over a wide podium is unmistakably an
 * office. The colour IS the meaning on a map, so `tint` is the param that
 * matters; the proportions are set once here.
 *
 * Living here, beside the Earth, because the Earth scene is their only
 * use so far; they pop out into their own DreamNodes the day a second
 * scene stands one up.
 */

import { ShapeUtils, Vector2 } from "three/webgpu"
import type { Holon, Overrides } from "../../src/holon"
import { Line, Null, type Vec3Like } from "../../src/parts/primitives"
import { Surface } from "../../src/parts/surface"
import { color, length } from "../../src/params"
import { BLUE, RED, WHITE, rgb } from "../../src/constants"
import type { Color } from "../../src/constants"
import { BALL_INSET, Place } from "./Earth"

type P2 = readonly [number, number]

/**
 * A prism's line drawing and solid body: `profile` (XY, open ring, any
 * winding, may be concave) extruded from z = −depth/2 to +depth/2.
 */
const prism = (
  owner: Null,
  profile: readonly P2[],
  depth: number,
  ink: { tint: Color | unknown; stroke: unknown; body: unknown },
  offset: Vec3Like = { x: 0, y: 0, z: 0 },
): void => {
  const add = <T extends Holon>(h: T): T => (owner as unknown as { add(h: T): T }).add(h)
  const z0 = -depth / 2 + offset.z
  const z1 = depth / 2 + offset.z
  const at = ([x, y]: P2, z: number): Vec3Like => ({ x: x + offset.x, y: y + offset.y, z })

  // The body first, so its depth is in place before any ink composites.
  // It is INSET a little toward its centre: an edge drawn exactly on a
  // face would fight that face for depth, and a ribbon's quad carries its
  // line's depth across its whole width — so the faces sit just behind the
  // edges that bound them, and still far in front of the edges behind.
  const body = add(new Surface({ solid: true, tint: ink.body }))
  const n = profile.length
  const xs = profile.map((p) => p[0])
  const ys = profile.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2 + offset.x
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2 + offset.y
  const cz = offset.z
  const k = 1 - BODY_INSET
  const positions: number[] = []
  for (const z of [z0, z1]) for (const p of profile) {
    const q = at(p, z)
    positions.push(cx + (q.x - cx) * k, cy + (q.y - cy) * k, cz + (q.z - cz) * k)
  }
  const indices: number[] = []
  const caps = ShapeUtils.triangulateShape(profile.map(([x, y]) => new Vector2(x, y)), [])
  for (const [a, b, c] of caps) indices.push(a!, b!, c!, a! + n, b! + n, c! + n)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    indices.push(i, j, j + n, i, j + n, i + n)
  }
  body.positions = new Float32Array(positions)
  body.indices = new Uint32Array(indices)

  const style = { tint: ink.tint, stroke: ink.stroke }
  for (const z of [z1, z0]) {
    add(new Line({ ...style, points: [...profile.map((p) => at(p, z)), at(profile[0]!, z)] }))
  }
  for (const p of profile) add(new Line({ ...style, points: [at(p, z1), at(p, z0)] }))
}

/** How far a body shrinks toward its centre behind its own edges (see `prism`). */
const BODY_INSET = 0.03

/** The black of a building's body — the page, so a building is its edges. */
const BODY = rgb(0, 0, 0)

/**
 * A factory hall: `teeth` north-light roof teeth over a long low hall.
 * `size` is the hall's length (x); the rest follows from it.
 */
export class Factory extends Null {
  static sovereign = true
  tint = color(WHITE)
  stroke = length(1.6)
  body = color(BODY)
  size = length(8)

  protected override compose(): void {
    const w = this.size.value
    const h = w * 0.3
    const tooth = w * 0.22
    const teeth = 3
    const profile: P2[] = [[w / 2, 0], [w / 2, h]]
    // Right to left: each tooth rises vertically (the glazing) and slopes
    // back down to the next.
    for (let i = teeth; i > 0; i--) {
      const x = -w / 2 + (w * i) / teeth
      const xNext = -w / 2 + (w * (i - 1)) / teeth
      profile.push([x, h + tooth], [xNext, h])
    }
    profile.push([-w / 2, 0])
    // Drop the duplicated corner the loop produced (the last tooth lands on
    // the left wall's top, which is already the next point down).
    prism(this, dedupe(profile), w * 0.6, { tint: this.tint, stroke: this.stroke, body: this.body })
  }
}

/**
 * Headquarters: a tower with floor lines on a wide podium. `size` is the
 * podium's width (x).
 */
export class Headquarters extends Null {
  static sovereign = true
  tint = color(WHITE)
  stroke = length(1.6)
  body = color(BODY)
  size = length(9)
  floors = length(6)

  protected override compose(): void {
    const w = this.size.value
    const ink = { tint: this.tint, stroke: this.stroke, body: this.body }
    const podiumH = w * 0.22
    const towerW = w * 0.42
    const towerH = w * 1.15
    prism(this, rect(w, podiumH), w * 0.7, ink)
    prism(this, rect(towerW, towerH), towerW, ink, { x: 0, y: podiumH, z: 0 })
    // Floor lines round the tower: a ring at each floor, on the faces.
    const n = Math.max(0, Math.round(this.floors.value))
    const t = towerW / 2
    for (let f = 1; f < n; f++) {
      const y = podiumH + (towerH * f) / n
      const ring: Vec3Like[] = [
        { x: -t, y, z: t },
        { x: t, y, z: t },
        { x: t, y, z: -t },
        { x: -t, y, z: -t },
        { x: -t, y, z: t },
      ]
      ;(this as unknown as { add(h: Line): Line }).add(new Line({ tint: this.tint, stroke: this.stroke.times(0.6), points: ring }))
    }
  }
}

const rect = (w: number, h: number): P2[] => [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]]

const dedupe = (ring: P2[]): P2[] =>
  ring.filter((p, i) => {
    const q = ring[(i + 1) % ring.length]!
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9
  })

/** One site as plain data — what a real dataset swaps in for the mock. */
export interface SiteData {
  name: string
  lat: number
  lon: number
  kind: "hq" | "red" | "blue"
}

/** The two production kinds' colours, and the headquarters'. */
export const SITE_TINTS: Record<SiteData["kind"], Color> = { hq: WHITE, red: RED, blue: BLUE }

/**
 * Turn site data into Places carrying their symbols. With `sunk`, each
 * starts wholly underground — below the Earth's ground ball, which hides
 * it — so a scene raises it by animating `altitude` to 0. Headquarters get
 * the tower, production sites the hall. `radius` is the Earth's (the
 * ground's depth is a fraction of it).
 */
export const sitePlaces = (
  sites: readonly SiteData[],
  opts: {
    scale?: number
    sunk?: boolean
    radius?: number
    tints?: Partial<Record<SiteData["kind"], Color>>
  } = {},
): Place[] => {
  const ground = BALL_INSET * (opts.radius ?? 400)
  const k = opts.scale ?? 1
  return sites.map((s) => {
    const tint = opts.tints?.[s.kind] ?? SITE_TINTS[s.kind]
    const symbol =
      s.kind === "hq"
        ? new Headquarters({ tint, size: 9 * k })
        : new Factory({ tint, size: 8 * k })
    const height = s.kind === "hq" ? 9 * k * 1.4 : 8 * k * 0.6
    return new Place({
      lat: s.lat,
      lon: s.lon,
      altitude: opts.sunk ? -(height + ground * 1.25) : 0,
      members: [symbol],
    })
  })
}
