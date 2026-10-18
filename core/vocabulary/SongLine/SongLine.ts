/**
 * SongLine — a DreamNode's chain of provenance: every conversation that
 * carried it, clipped, stacked above it.
 *
 * THE CONCEPT (InterBrain film, 33:21–33:43): "each dream node will track
 * its journey through the interbrain, at every step clipping the part of
 * the conversation where the knowledge was transmitted. The resulting
 * chain of provenance we might refer to as a song line." The film shows
 * the node travelling through the liminal web, a clip dropped at every
 * hop (f10036–f10086); the clips then straighten into one column above
 * the node, each joined to the next by an arrow, the last arrow into the
 * node (f10096–f10186, labelled "SongLine").
 *
 * THE CLIP (f10141 at 1:1): a rounded white box holding a campfire
 * conversation gone digital — two heads in profile facing each other, each
 * in a lobe of a red infinity loop, and where the loop crosses, a small
 * dark-red circle with the Vision in it, white. Composed: the heads are
 * `Figure` (the bust side-on, as SandTalk seats them), the mark is
 * `Vision`; the box and the loop are this holon's own line work. The node
 * is `DreamNode` (its default face: a DreamTalk symbol).
 *
 * MEASURED on f10141 (1280×720), in units of S — the node's ring radius
 * (80 px), which is `size`:
 *
 *   BOX        159 × 76 px → 1.99 × 0.95 S, corners rounded ≈ 10 px
 *   PITCH      the boxes 102 px apart → 1.275 S
 *   LAST       the lowest box's centre 164 px above the node's → 2.05 S
 *   LOOP       139 × 54 px → half-width 0.869 S, half-height 0.338 S
 *   HEAD       ≈ 29 px tall, 40 px either side of the box's centre
 *   MARK       the crossing's circle, 12.5 px radius → 0.156 S
 *
 * STATE: `grow` (0..1) — the clips arrive one by one, oldest (top) first,
 * each with the arrow that carries it down toward the node.
 */

import { Circle, Line, Null, Rectangle, type Vec3Like } from "../../src/parts/primitives"
import { color, completion, derive, integer, length } from "../../src/params"
import { BLACK, RED, TAU, WHITE, seen } from "../../src/constants"
import { clamp01 } from "../../src/math"
import { restage, together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { axis, type StateSpace } from "../../src/automaton"
import type { Holon, Overrides } from "../../src/holon"
import { presence } from "../../src/certainty"
import { DreamNode } from "../DreamNode/DreamNode"
import { Figure } from "../Figure/Figure"
import { FILM_BAND, RING_RATIO, Vision } from "../Vision/Vision"

/** The construction, in units of S = `size` (see header). */
export const SONGLINE = {
  boxW: 159 / 80,
  boxH: 76 / 80,
  rounding: 10 / 38,
  pitch: 102 / 80,
  last: 164 / 80,
  loopX: 69.5 / 80,
  loopY: 27 / 80,
  head: 29 / 80,
  headX: 40 / 80,
  mark: 12.5 / 80,
} as const

/** The mark's circle, sampled off f10141 (a dark red, not the loop's RED). */
const MARK_RING = seen(120, 40, 45)

/**
 * The infinity loop: a lemniscate of Bernoulli, half-width `a`, stretched
 * to half-height `b`, closed, starting at the crossing.
 */
export const lemniscate = (a: number, b: number, samples = 96): Vec3Like[] => {
  // Bernoulli's own half-height is a/(2√2); stretch it to b.
  const k = b / (a / (2 * Math.SQRT2))
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = (i / samples) * TAU + TAU / 4
    const d = 1 + Math.sin(t) ** 2
    return { x: (a * Math.cos(t)) / d, y: (k * a * Math.sin(t) * Math.cos(t)) / d, z: 0 }
  })
}

/** One clipped conversation (a part of SongLine, laid in units of S). */
export class Clip extends Null {
  there = presence(1)
  size = length(167)
  tint = color(WHITE)
  loopTint = color(RED)
  stroke = length(2.2)

  box!: Rectangle
  loop!: Line
  heads: Figure[] = []
  mark!: Vision

  protected override compose(): void {
    const S = this.size.value
    this.box = this.add(
      new Rectangle({
        width: SONGLINE.boxW * S,
        height: SONGLINE.boxH * S,
        rounding: SONGLINE.rounding,
        tint: this.tint,
        stroke: this.stroke,
      }),
    )
    this.loop = this.add(
      new Line({ tint: this.loopTint, stroke: derive(() => this.stroke.value * 1.6), points: lemniscate(SONGLINE.loopX * S, SONGLINE.loopY * S) }),
    )
    this.heads = ([-1, 1] as const).map((side) =>
      this.add(
        new Figure({
          height: SONGLINE.head * S,
          form: derive(() => 1),
          profile: derive(() => -side),
          opaque: 1,
          tint: this.tint,
          stroke: derive(() => this.stroke.value * 0.6),
          x: side * SONGLINE.headX * S,
        }),
      ),
    )
    // The crossing hides behind the mark's dark disc.
    this.add(new Circle({ radius: SONGLINE.mark * S, tint: BLACK, fillOpacity: 1, stroke: 0 }))
    this.mark = this.add(
      new Vision({
        radius: (SONGLINE.mark * S) / RING_RATIO,
        weight: FILM_BAND,
        tint: this.tint,
        ring: 1,
        ringTint: MARK_RING,
        ringStroke: 1.4,
      }),
    )
  }

  override createAnim(): Anim {
    void this.parts
    return together(
      restage(this.box.creation.sequence(0, 1), 0, 0.5) as Anim,
      restage(this.loop.creation.sequence(0, 1), 0.2, 0.8) as Anim,
      ...this.heads.map((h) => restage(Create(h), 0.4, 0.9) as Anim),
      restage(Create(this.mark), 0.6, 1) as Anim,
    )
  }
}

export class SongLine extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** S — the node's ring radius (f10141: 80 px at 720p → 167 units). */
  size = length(167)
  /** How many clips — the hops the node has travelled. */
  count = integer(3)
  /** 0 none … 1 every clip in place (oldest first). */
  grow = completion(1)
  tint = color(WHITE)
  loopTint = color(RED)
  stroke = length(2.2)

  /** What the node holds (undefined: DreamNode's default dream face). */
  face?: Holon | null = undefined

  node!: DreamNode
  clips: Clip[] = []
  arrows: Line[] = []

  constructor(overrides: Overrides = {}) {
    super(overrides)
  }

  /** How far it reaches from the node's centre: the top of the column. */
  get reach(): number {
    const n = Math.max(1, Math.round(this.count.value))
    return (SONGLINE.last + (n - 1) * SONGLINE.pitch + SONGLINE.boxH / 2) * this.size.value
  }

  /** Clip k's centre height above the node (k = 0 the oldest, at the top). */
  clipY(k: number): number {
    const n = Math.max(1, Math.round(this.count.value))
    return (SONGLINE.last + (n - 1 - k) * SONGLINE.pitch) * this.size.value
  }

  protected override compose(): void {
    const S = this.size.value
    const n = Math.max(1, Math.round(this.count.value))
    this.node = this.add(new DreamNode({ radius: S, ...(this.face !== undefined ? { face: this.face } : {}) }))

    const shown = (k: number) => clamp01(this.grow.value * n - k)
    for (let k = 0; k < n; k++) {
      const clip = this.add(
        new Clip({ size: S, tint: this.tint, loopTint: this.loopTint, stroke: this.stroke, y: this.clipY(k) }),
      )
      clip.there.follow(this.grow.map(() => shown(k)))
      this.clips.push(clip)
      // The arrow down from this clip to the next one, or into the node.
      const top = this.clipY(k) - (SONGLINE.boxH / 2) * S
      const bottom = k < n - 1 ? this.clipY(k + 1) + (SONGLINE.boxH / 2) * S : S
      const arrow = this.add(
        new Line({
          tint: this.tint,
          stroke: derive(() => this.stroke.value * 0.6),
          arrowEnd: true,
          points: [
            { x: 0, y: top, z: 0 },
            { x: 0, y: bottom, z: 0 },
          ],
        }),
      )
      arrow.creation.follow(this.grow.map(() => clamp01((shown(k) - 0.5) * 2)))
      this.arrows.push(arrow)
    }
  }

  /** The node comes up; then the clips arrive along `grow`. */
  override createAnim(): Anim {
    void this.parts
    const to = this.grow.isBound ? [] : [restage(this.grow.sequence(0, this.grow.value), 0.35, 1) as Anim]
    return together(
      restage(Create(this.node), 0, 0.4) as Anim,
      ...this.clips.map((c, k, all) => restage(Create(c), 0.35 + (0.65 * k) / all.length, 0.35 + (0.65 * (k + 1)) / all.length) as Anim),
      ...to,
    )
  }

  /** Walkable: the chain grows. */
  override stateSpace(): StateSpace | undefined {
    if (this.grow.isBound) return undefined
    return { axes: [axis("grow", this, { bare: { grow: 0 }, chained: { grow: 1 } })] }
  }
}
