/**
 * SandTalk — two people at a campfire, in the circle of their conversation,
 * a symbol drawn in the sand between them.
 *
 * THE CONCEPT (InterBrain film, 19:38–19:55): "we would meet around the
 * campfire to freely exchange our knowledge … using the spoken word
 * accompanied by drawing symbols in the sand, an ancient practice the
 * aborigines referred to as sand talk" — "the symbols as the seeds and the
 * free-flowing conversation itself as the soil". The sand symbol is the
 * SEED, the red ring of conversation the SOIL (those labels are the scene's
 * text, not this holon's). Its digital extension is DreamTalk (29:08), and
 * the film's "digital campfire" (f9451, f9541) is a composition of two
 * InterBrains whose rings overlap — which is why the ring is addressable and
 * reshapeable here (`ringWidth`, `ringAspect`, `ringX`): a composer can
 * stretch it to be the shared ellipse.
 *
 * COMPOSED, NEVER REDRAWN. The people are `Figure` — THE person — as the
 * bust turned side-on (`form` 1, `profile` ±1, black under its ink), each
 * with the `Vision` in the brow, turned away with the head as the film draws
 * it (f8656: the S, its dot and its square, foreshortened); the hearth is
 * `Fire`. Only the ring and the default sand glyph are this holon's own.
 *
 * THE SAND SLOT. `symbol` holds whatever is drawn in the sand: undefined is
 * the default seed glyph (PL02 slide 7, f5941/f5986: a triangle's apex in two
 * circles, the inner tangent at the back), null is bare sand, any holon is
 * fitted to the slot by its reach (DreamNode's `reachOf`) — Vision at f9541.
 * The slot lies IN the sand: a flat symbol is tilted back into the ground
 * plane (`p`), so a circle reads as the ellipse the film draws.
 *
 * MEASURED off f8656 (1280×720), in units of S — the ring's half-width
 * (425 px), which is `size`. The origin is the ring's centre.
 *
 *   RING_ASPECT   half-height over half-width: 139 / 425
 *   HEAD          the profile's height: 181 px wide → 216.5 tall → 0.509·S
 *   HEAD_X        the crown, 240 px either side of the axis → 0.565·S
 *   HEAD_Y        the head's middle, 91.7 px above the ring's centre → 0.216·S
 *   FIRE          flame tip to the logs' underside, 224 px → 0.527·S
 *   FIRE_Y        its middle, 90 px above → 0.212·S
 *   SAND_Y        the glyph's centre, 73 px below → −0.172·S
 *   SAND_R        the glyph's reach in its plane (slide 7: 94.1 of the
 *                 ring's 513.3) → 0.183·S
 *   SAND_ASPECT   the glyph seen in the sand (slide 7: 34.5 / 94.1)
 *   VISION        the mark in the brow (f8656): 69 px in front of the crown,
 *                 42 px below it, 24 px half-height — in units of the head
 */

import { Circle, Ellipse, Group, Line, Null, type Vec3Like } from "../../src/parts/primitives"
import { color, completion, derive, length, scalar } from "../../src/params"
import { RED, WHITE } from "../../src/constants"
import type { Holon } from "../../src/holon"
import { restage, together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { Figure } from "../Figure/Figure"
import { Fire } from "../Fire/Fire"
import { FILM_BAND, Vision } from "../Vision/Vision"
import { reachOf } from "../DreamNode/DreamNode"

/** The construction, in units of S = `size` (see header). */
export const SANDTALK = {
  ringAspect: 139 / 425,
  head: 0.509,
  headX: 0.565,
  headY: 0.216,
  fire: 0.527,
  fireY: 0.212,
  sandY: -0.172,
  sandR: 94.1 / 513.3,
  sandAspect: 34.5 / 94.1,
  /** These three in units of the head's height. */
  visionX: 69 / 216.5,
  visionY: 0.5 - 42 / 216.5,
  visionR: 24 / 216.5,
} as const

/**
 * The seed glyph's construction in its own plane, units of its outer
 * radius (PL02 slide 7, read through SAND_ASPECT): the inner circle
 * internally tangent at the back, two strokes from an apex down to the
 * outer circle.
 */
export const SEED = {
  inner: 61.1 / 94.1,
  apex: 19 / 34.5,
  /** The feet: where the strokes meet the outer circle, off straight down. */
  footAngle: Math.atan2(55.2 / 94.1, 28.1 / 34.5),
} as const

/** The default sand symbol: a triangle's apex in two circles (f5986). */
export class SeedGlyph extends Null {
  radius = length(100)
  tint = color(WHITE)
  stroke = length(2.2)

  get reach(): number {
    return this.radius.value
  }

  protected override compose(): void {
    const R = this.radius.value
    this.add(new Circle({ radius: R, tint: this.tint, stroke: this.stroke }))
    const ri = SEED.inner * R
    this.add(new Circle({ radius: ri, y: R - ri, tint: this.tint, stroke: this.stroke }))
    const apex: Vec3Like = { x: 0, y: SEED.apex * R, z: 0 }
    for (const side of [-1, 1]) {
      const a = -Math.PI / 2 + side * SEED.footAngle
      this.add(new Line({ points: [apex, { x: R * Math.cos(a), y: R * Math.sin(a), z: 0 }], tint: this.tint, stroke: this.stroke }))
    }
  }
}

export class SandTalk extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** S — the ring's half-width; every other measure derives from it. */
  size = length(400)
  /** The ring (the circle of conversation, the soil). */
  ringTint = color(RED)
  /** The ring's half-width as a share of S (stretch it to be a shared ellipse). */
  ringWidth = scalar(1)
  /** Its half-height over its half-width. */
  ringAspect = scalar(SANDTALK.ringAspect)
  /** Its centre's offset along x, in units of S. */
  ringX = scalar(0)
  /** The people's ink. */
  tint = color(WHITE)
  /** Pen width in screen px — the film's fine line. */
  stroke = length(2.2)
  /** 0 the people bare … 1 the Vision lit in each brow. */
  vision = completion(1)

  /** What is drawn in the sand: undefined the seed glyph, null nothing, or any symbol. */
  symbol?: Holon | null = undefined

  ring!: Ellipse
  fire!: Fire
  left!: Figure
  right!: Figure
  visions!: Vision[]
  /** The ground the symbol lies in (tilted into the sand). */
  sand!: Group
  glyph?: Holon

  /** How far it reaches from its centre — the ring's half-width. */
  get reach(): number {
    return this.size.value * this.ringWidth.value
  }

  protected override compose(): void {
    const S = this.size.value
    const stroke = this.stroke

    // The ring first: the fire and the heads stand in front of it.
    this.ring = this.add(
      new Ellipse({
        radiusX: derive(() => S * this.ringWidth.value),
        radiusY: derive(() => S * this.ringWidth.value * this.ringAspect.value),
        x: derive(() => S * this.ringX.value),
        tint: this.ringTint,
        stroke,
      }),
    )

    // The sand, then what is drawn in it.
    const glyph = this.symbol === undefined ? new SeedGlyph({ radius: 100, stroke }) : this.symbol
    if (glyph) {
      glyph.scale.value = (SANDTALK.sandR * S) / reachOf(glyph)
      this.glyph = glyph
    }
    this.sand = this.add(
      new Group({ y: SANDTALK.sandY * S, p: -Math.acos(SANDTALK.sandAspect), members: glyph ? [glyph] : [] }),
    )

    this.fire = this.add(new Fire({ size: SANDTALK.fire * S, y: SANDTALK.fireY * S, stroke }))

    const hh = SANDTALK.head * S
    const person = (side: -1 | 1) =>
      this.add(
        new Figure({
          height: hh,
          form: derive(() => 1),
          profile: derive(() => -side),
          opaque: 1,
          tint: this.tint,
          stroke,
          x: side * SANDTALK.headX * S,
          y: SANDTALK.headY * S,
        }),
      )
    this.left = person(-1)
    this.right = person(1)

    // The Vision in each brow, turned away with the head (f8656).
    this.visions = ([-1, 1] as const).map((side) =>
      this.add(
        new Vision({
          radius: SANDTALK.visionR * hh,
          weight: FILM_BAND,
          ring: 1,
          ringStroke: 1.5,
          x: side * (SANDTALK.headX * S - SANDTALK.visionX * hh),
          y: SANDTALK.headY * S + SANDTALK.visionY * hh,
          h: side * 0.8,
          b: side * 0.35,
          presence: derive(() => this.vision.value),
        }),
      ),
    )
  }

  /** The ring draws, the fire is lit, the two sit down at it, and the
   *  symbol is drawn in the sand last. */
  override createAnim(): Anim {
    void this.parts
    const items = [
      restage(this.ring.creation.sequence(0, 1), 0, 0.4),
      restage(Create(this.fire), 0.15, 0.5),
      restage(Create(this.left), 0.3, 0.65),
      restage(Create(this.right), 0.35, 0.7),
      ...this.visions.map((v) => restage(Create(v), 0.6, 0.8)),
    ]
    if (this.glyph) items.push(restage(Create(this.glyph), 0.7, 1))
    return together(...items)
  }
}
