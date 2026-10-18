/**
 * DigitalCampfire — two InterBrains, each in the red ring of its own
 * world, the rings overlapping into a shared space; in the middle of it two
 * people sit at a symbol, as they once sat at a fire.
 *
 * THE CONCEPT (InterBrain film, 31:31–31:54, 32:43–32:59). "We do so by
 * meeting our fellow dreamers around the campfire. Just like we did in
 * ancient times, we use symbols to enhance our communication" — and "with
 * the addition of the digital campfire, i.e. video calls, conversations
 * and thus relationships can now reach around the globe". The film draws
 * it twice in chapter 6 (1888–1925, f9451–f9601; 1955–1980, f9811/f9826),
 * which is why it is a holon and not a scene.
 *
 * COMPOSED, NEVER REDRAWN. The faces are `InterBrain`; the gathering is
 * `SandTalk` (its own ring the faint outer one, its fire banked: here the
 * SYMBOL is the hearth — `hearth` brings the physical fire back); each
 * InterBrain's dark bloom can hold a `DreamGarden` instead of its Logo
 * (`gardens`, f9541), so a node can fly from one garden to the other
 * (DreamGarden.crossPollinate). Its own marks are only the two shells (the
 * vesica) and the two loops round the heads that meet at the symbol.
 *
 * MEASURED on f9451 (1280×720), in units of U — a shell's half-width
 * (371.5 px), which is `size`. The origin is between the shells' centres.
 *
 *   SHELL_ASPECT  half-height over half-width: 189 / 371.5
 *   SHELL_GAP     the centres' distance: 354 px → 0.953·U (the vesica)
 *   CRYSTAL       the InterBrain's half-height: 120 px → 0.323·U
 *   CRYSTAL_Y     its centre 93 px above its shell's → 0.25·U
 *
 * and on f9541 — the same picture zoomed 2.4× about the shells' middle —
 * the gathering, in units of S = SandTalk's half-width (240 px there,
 * centred on the shells' middle → TALK = 100 / 371.5 of U):
 *
 *   LOOP_X        a loop's centre, 123 px out → 0.512·S
 *   LOOP          its half-width 87.5 px → 0.365·S, half-height 44 → 0.183·S
 *   SYMBOL        the symbol's ring, 40 px → 0.167·S; seen in the sand, 21.5 / 40
 *   GARDEN        a garden fills its InterBrain's Logo ring (0.92 of it)
 */

import { Ellipse, Group, Line, Null, type Vec3Like } from "../../src/parts/primitives"
import { color, completion, integer, length, scalar } from "../../src/params"
import { RED, TAU, rgb } from "../../src/constants"
import { restage, together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import type { Holon } from "../../src/holon"
import { presence } from "../../src/certainty"
import { InterBrain, CRYSTAL as IB } from "../InterBrain/InterBrain"
import { SandTalk } from "../SandTalk/SandTalk"
import { Vision } from "../Vision/Vision"
import { DreamGarden } from "../DreamGarden/DreamGarden"
import { reachOf } from "../DreamNode/DreamNode"

/** The construction (see header): shells in units of U, the gathering in S. */
export const CAMPFIRE = {
  shellAspect: 189 / 371.5,
  shellGap: 354 / 371.5,
  crystal: 120 / 371.5,
  crystalY: 93 / 371.5,
  talk: 100 / 371.5,
  loopX: 123 / 240,
  loopW: 87.5 / 240,
  loopH: 44 / 240,
  symbol: 40 / 240,
  symbolAspect: 21.5 / 40,
  garden: 0.92,
} as const

/** A part that fades as one (presence inherits). */
class Veil extends Group {
  there = presence(1)
}

/**
 * A loop round one head: an ellipse open where it meets the symbol, so the
 * symbol sits in the gap (f9541). `side` −1 left, +1 right; units of S.
 */
export const loopPoints = (S: number, side: -1 | 1, gap: number, n = 96): Vec3Like[] => {
  const cx = side * CAMPFIRE.loopX * S
  const rx = CAMPFIRE.loopW * S
  const ry = CAMPFIRE.loopH * S
  // The inner side faces the middle: angle π for the right loop, 0 for the left.
  const inner = side > 0 ? Math.PI : 0
  const pts: Vec3Like[] = []
  for (let k = 0; k <= n; k++) {
    const a = inner + gap + ((TAU - 2 * gap) * k) / n
    pts.push({ x: cx + rx * Math.cos(a), y: ry * Math.sin(a), z: 0 })
  }
  return pts
}

export class DigitalCampfire extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** U — a shell's half-width; every other measure derives from it. */
  size = length(371.5 / 0.48)
  /** 0 the two worlds apart … 1 overlapping into the shared space (f9451). */
  overlap = completion(1)
  /** The gathering in the middle: 0 not yet … 1 sat down (f9481). */
  talk = completion(1)
  /** 0 each InterBrain shows its Logo … 1 its dark bloom holds its garden (f9541). */
  gardens = completion(0)
  /** 0 the symbol is the hearth (digital) … 1 the physical fire burns. */
  hearth = completion(0)
  /** How much of the loops' ellipse is left open for the symbol (radians each side). */
  loopGap = scalar(0.42)
  shellTint = color(RED)
  shellStroke = length(3)
  /** The shells recede when the view moves in to the gathering (f9541: dim). */
  shellOpacity = completion(1)
  /** SandTalk's own ring, faint here: the ground the gathering stands on. */
  groundTint = color(rgb(0x8a, 0x2a, 0x2a))
  stroke = length(2.2)
  /** How many nodes each garden holds, and room for what it will receive (construction). */
  leftCount = integer(5)
  rightCount = integer(6)
  gardenRoom = integer(1)

  /** What lies at the heart of the gathering: undefined the Vision (f9541), or any symbol. */
  symbol?: Holon | null = undefined

  shells: Ellipse[] = []
  crystals: InterBrain[] = []
  gardenL!: DreamGarden
  gardenR!: DreamGarden
  sandTalk!: SandTalk
  loops: Line[] = []
  heart?: Holon
  gathering!: Veil

  /** A shell's centre x at the current overlap: apart (2.1·U) → the vesica. */
  private shellX(side: -1 | 1): number {
    const U = this.size.value
    const gap = 2.1 + (CAMPFIRE.shellGap - 2.1) * this.overlap.value
    return (side * gap * U) / 2
  }

  protected override compose(): void {
    const U = this.size.value
    const S = CAMPFIRE.talk * U
    const H = CAMPFIRE.crystal * U

    // The shells first: everything else stands in front of them.
    for (const side of [-1, 1] as const) {
      this.shells.push(
        this.add(
          new Ellipse({
            radiusX: U,
            radiusY: U * CAMPFIRE.shellAspect,
            x: this.overlap.map(() => this.shellX(side)),
            tint: this.shellTint,
            stroke: this.shellStroke,
            opacity: this.shellOpacity,
          }),
        ),
      )
    }

    // The gathering: SandTalk with its ring faint and its fire banked, the
    // loops round the heads, the symbol at the heart.
    const sandTalk = new SandTalk({ size: S, symbol: null, ringTint: this.groundTint, stroke: this.stroke })
    void sandTalk.parts
    // Banked: folded away (its black wash then hides nothing) and its ink
    // faded, so not even a pen's dot is left. SandTalk has no hearth param
    // of its own yet; this is the one place its anatomy is reached into.
    const fire = sandTalk.fire
    void fire.parts
    const fireScale = fire.scale.value
    fire.scale.follow(this.hearth.map((h) => fireScale * h))
    for (const ink of [fire.logs, fire.flame]) ink.opacity.follow(this.hearth.map((h) => h))
    this.sandTalk = sandTalk
    this.loops = ([-1, 1] as const).map(
      (side) =>
        new Line({
          points: loopPoints(S, side, this.loopGap.value),
          tint: this.shellTint,
          stroke: this.stroke,
        }),
    )
    const heart = this.symbol === undefined ? new Vision({ radius: 100, ring: 1 }) : this.symbol
    const members: Holon[] = [sandTalk, ...this.loops]
    if (heart) {
      heart.scale.value = (CAMPFIRE.symbol * S) / reachOf(heart)
      this.heart = heart
      members.push(new Group({ p: -Math.acos(CAMPFIRE.symbolAspect), members: [heart] }))
    }
    this.gathering = this.add(new Veil({ members }))
    this.gathering.there.follow(this.talk.map((t) => t))

    // The two InterBrains, each over its shell, its bloom holding a garden.
    const gardenFor = (side: -1 | 1, count: number) => {
      const g = new DreamGarden({
        radius: CAMPFIRE.garden * IB.logo * H,
        count,
        seed: side > 0 ? 3 : 2,
        room: this.gardenRoom.value,
        ringOpacity: 0,
        nodeStroke: 1.4,
      })
      return g
    }
    this.gardenL = gardenFor(-1, this.leftCount.value)
    this.gardenR = gardenFor(1, this.rightCount.value)
    for (const side of [-1, 1] as const) {
      const ib = this.add(
        new InterBrain({
          radius: H,
          logoStroke: 2,
          // Opaque, as the film's are: the shells pass behind them.
          facetOpacity: 1,
          x: this.overlap.map(() => this.shellX(side)),
          y: CAMPFIRE.crystalY * U,
        }),
      )
      void ib.parts
      const logoScale = ib.logo.scale.value
      ib.logo.scale.follow(this.gardens.map((g) => logoScale * (1 - g)))
      this.crystals.push(ib)
      const garden = side < 0 ? this.gardenL : this.gardenR
      const bed = this.add(
        new Veil({
          x: this.overlap.map(() => this.shellX(side)),
          y: (CAMPFIRE.crystalY - IB.logoDrop * CAMPFIRE.crystal) * U,
          members: [garden],
        }),
      )
      bed.there.follow(this.gardens.map((g) => g))
    }
  }

  /** The shells draw, the InterBrains come up in them, the two sit down at
   *  the symbol, the gardens open in the blooms. */
  override createAnim(): Anim {
    void this.parts
    const items: [Anim, number, number][] = [
      ...this.shells.map((s) => [s.creation.sequence(0, 1), 0, 0.35] as [Anim, number, number]),
      ...this.crystals.map((c, i) => [Create(c), 0.1 + 0.05 * i, 0.55 + 0.05 * i] as [Anim, number, number]),
      [Create(this.sandTalk), 0.5, 0.85],
      ...this.loops.map((l) => [l.creation.sequence(0, 1), 0.55, 0.85] as [Anim, number, number]),
    ]
    if (this.heart) items.push([Create(this.heart), 0.75, 1])
    if (this.gardens.value > 0) {
      items.push([Create(this.gardenL), 0.7, 1], [Create(this.gardenR), 0.7, 1])
    }
    return together(...items.map(([a, s, e]) => restage(a, s, e)))
  }
}
