/**
 * Puppeteer — the hand that works the strings: manipulation "requiring
 * neither their awareness nor consent" (11:44). In the InterBrain film it
 * hangs above the manipulated lens (f3541, f4561 — many of them), and at
 * the corners of the divide-and-conquer triangles, holding the minds
 * below by strings to their heads (f3676, f3781, f4351).
 *
 * The film's drawing is a line sketch (an SVG asset, not a Keynote icon —
 * none of the PL02 deck's icons is a hand): a fist seen from the front,
 * fingers curled down, the thumb standing up in the middle, five strings
 * falling from the fingertips, the knuckle and the thumb. There is NO
 * cross bar in the film — the strings leave the fingers directly — so
 * this holon has none (translate, never invent).
 *
 * TRACED off f_03541 (the clearest, largest instance: 113 px wide) at
 * stroke centrelines, and smoothed through Catmull-Rom; the anchors below
 * are the frame's own pixels so the trace can be re-checked against it.
 * The holon's unit is the hand's width W = 113 px (`size`); its origin is
 * the GRIP G = (638, 187) px — the bottom of the hand, centred, where the
 * strings hang from. A frame point (x, y) maps to ((x − 638)/W, (187 − y)/W)
 * in units of `size`, y up.
 *
 * `opaque` gives the hand a black silhouette under its ink (as Figure's
 * bust has): what is attached before it — a triangle's edge running behind
 * the fist (f4351) — is hidden by the hand.
 */

import { Group, Line, Null, Shape, type Vec3Like } from "../../src/parts/primitives"
import { catmullRom } from "../../src/parts/curves"
import { color, completion, integer, length } from "../../src/params"
import { BLACK, WHITE } from "../../src/constants"
import { type Anim, restage, together } from "../../src/anim"
import { Create } from "../../src/verbs"

/** The trace's frame (f_03541, 1280×720): the hand's width and its grip. */
export const TRACE = { width: 113, gx: 638, gy: 187 } as const

type Px = readonly (readonly [number, number])[]

/** The hand's outline, closed (first = last), clockwise from the left fingertip. */
const SILHOUETTE: Px = [
  [600, 187], [590, 183], [583, 174], [581, 164], [584, 152], [591, 140], [599, 129], [603, 117],
  [606, 108], [613, 103], [625, 102], [635, 104], // the curled fingers' top
  [636, 96], [640, 88], [648, 84.5], [656, 87], [661, 95], // the thumb's tip
  [667, 106], [676, 118], [685, 127], [688, 138], [691, 148], [696, 157], // the back of the hand
  [690, 163], [683, 168], [683, 177], [678, 185], [669, 186], [663, 180], [662, 172], // the right fingertip
  [650, 174], [638, 174], [630, 170], // the palm's lower edge
  [627, 178], [620, 185], [610, 187], [600, 187], // the left fingertip
]

/** The drawing inside the outline: the thumb, its nail, the curled index and its knuckle, the creases, the fingertips. */
const INNER: readonly Px[] = [
  // The thumb: down its left side, round its pad, up its right.
  [[635, 104], [636, 118], [637, 128], [641, 134], [648, 135.5], [655, 131], [657, 122], [657, 108], [656, 100]],
  // The thumbnail, and the crease above it.
  [[641, 121.5], [646, 124], [651.5, 121.5]],
  [[644, 110], [650, 111.5]],
  // The curled index finger, down to its knuckle…
  [[629, 116], [622, 120], [619, 126], [625, 134], [630, 142]],
  // …and the knuckle's loop.
  [[620, 147], [624, 142], [630, 143], [632.5, 149], [628, 155], [622, 154], [620, 147]],
  // The creases of the curled fingers.
  [[603, 127], [606, 138], [613, 147], [620, 157], [627, 168], [630, 170]],
  [[604, 148], [608, 158], [613, 167], [620, 176]],
  // The left fingertip's pad.
  [[606, 179], [611, 174.5], [617, 177], [618.5, 183]],
  // The right fingertip's pad.
  [[665, 174], [671, 170], [678, 172], [680.5, 179], [676, 184]],
  // Two creases on the back of the hand.
  [[657, 151], [664, 152], [668, 156]],
  [[672, 144], [673, 151], [679, 155]],
]

/** Where the five strings leave the hand (frame px): the left fingertip (two), the knuckle, the thumb, the right fingertip. */
export const STRING_ANCHORS: Px = [
  [610, 187],
  [617, 185],
  [629, 155],
  [645, 135.5],
  [667, 186],
]

/** A frame point in units of the hand's width, about the grip, y up. */
const unit = ([x, y]: readonly [number, number]): Vec3Like => ({
  x: (x - TRACE.gx) / TRACE.width,
  y: (TRACE.gy - y) / TRACE.width,
  z: 0,
})

/** A traced path, smoothed, in units of the hand's width. */
const smooth = (px: Px, samples = 6): Vec3Like[] => catmullRom(px.map(unit), samples)

/** The hand's outline in units of `size` (closed). Exposed for tests and composers. */
export const handOutline = (): Vec3Like[] => smooth(SILHOUETTE)

/**
 * Where string `i` of `n` leaves the hand, in units of `size`: the film's
 * five anchors for n = 5; otherwise spread evenly across them by
 * interpolating along the anchors in order.
 */
export const stringAnchor = (i: number, n: number): Vec3Like => {
  const a = STRING_ANCHORS.map(unit)
  if (n === a.length) return a[i]!
  const t = n === 1 ? (a.length - 1) / 2 : (i * (a.length - 1)) / (n - 1)
  const k = Math.min(a.length - 2, Math.floor(t))
  const u = t - k
  return { x: a[k]!.x + (a[k + 1]!.x - a[k]!.x) * u, y: a[k]!.y + (a[k + 1]!.y - a[k]!.y) * u, z: 0 }
}

export class Puppeteer extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** W — the hand's width; the whole drawing is in units of it. */
  size = length(235)
  /** How far the strings hang below the grip (the origin). */
  length = length(300)
  /** How many strings (the film's hand holds five). */
  strings = integer(5)
  tint = color(WHITE)
  /** Pen width in screen px — the film's sketch line is fine. */
  stroke = length(2.2)
  /** 0 ink only … 1 a black silhouette hides what lies behind the hand. */
  opaque = completion(1)

  silhouette!: Shape
  hand!: Group
  /** The strings that hang behind the hand, and those that run over it. */
  back!: Group
  front!: Group

  protected override compose(): void {
    const W = this.size.value
    const scaled = (pts: Vec3Like[]) => pts.map((p) => ({ x: p.x * W, y: p.y * W, z: 0 }))
    const outline = scaled(handOutline())

    // A string that leaves the hand's edge hangs behind it; one that leaves
    // from inside the outline (the knuckle's, the thumb's) runs IN FRONT of
    // the hand, over the palm (f3541).
    const n = Math.max(0, Math.round(this.strings.value))
    const strings = Array.from({ length: n }, (_, i) => {
      const a = stringAnchor(i, n)
      const line = new Line({
        points: [
          { x: a.x * W, y: a.y * W, z: 0 },
          { x: a.x * W, y: -this.length.value, z: 0 },
        ],
        tint: this.tint,
        stroke: this.stroke,
      })
      return { line, front: a.y > 0.05 }
    })

    this.back = this.add(new Group({ members: strings.filter((s) => !s.front).map((s) => s.line) }))
    this.silhouette = this.add(
      new Shape({ tint: BLACK, fillOpacity: this.opaque.map((o) => o), outlines: [new Line({ points: outline })] }),
    )
    this.hand = this.add(
      new Group({
        members: [outline, ...INNER.map((p) => scaled(smooth(p)))].map(
          (points) => new Line({ points, tint: this.tint, stroke: this.stroke }),
        ),
      }),
    )
    this.front = this.add(new Group({ members: strings.filter((s) => s.front).map((s) => s.line) }))
  }

  /** The hand draws, then the strings drop from it. */
  override createAnim(): Anim {
    void this.parts // compose() is lazy: the parts exist once it has run
    return together(
      restage(Create(this.silhouette), 0, 0.5),
      restage(Create(this.hand), 0, 0.6),
      restage(Create(this.back), 0.45, 1),
      restage(Create(this.front), 0.45, 1),
    )
  }
}
