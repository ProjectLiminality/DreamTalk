/**
 * Ch3ViciousCycle — chapter 3 of the InterBrain film, "The Vicious Cycle"
 * (video 638–971 s; docs/reports/interbrain-vocabulary.md §2, §8).
 *
 * A composition: it lays out, labels and times the vocabulary's holons and
 * draws nothing of its own. Every beat below is measured off frames5 (the
 * motion segments of f3191–f4856, each named by its key frame) and the
 * narration's line times; `at(T)` takes VIDEO seconds, so a beat reads as
 * the film's clock.
 *
 * The beats:
 *   641–646.5  title card
 *   649–652    the world and the eye (f3256)
 *   657–665    the direct path, crossed out, a "?" (f3301, f3331)
 *   669–679    the prism between; the world in the lens; the feedback loop
 *              (f3358, f3376, f3391)
 *   689–697    the noosphere as the lens, and back (f3461, f3490)
 *   699–702    the manipulated lens: fragmented world, narrative cube,
 *              smeared spectrum, the puppeteer (f3512)
 *   710–721    the hand and the mind in the prism's triangle; two minds ⚡
 *              (f3564, f3591, f3609)
 *   728–774    divide and conquer, unit by unit (f3657 … f3872)
 *   782–815    the eye in the lens; boxed tribes ⚡ (f3935, f3987 … f4076)
 *   818–862    the war machine with the spirit of fragmentation; Power
 *              (f4116, f4164, f4226, f4315)
 *   895–937    multipolar: many hands pull the lens apart; the red field
 *              and the oscillation between (f4489 … f4685)
 *   949–969    one hand drilling deeper; Chaos ⚡ censorship; the boxed
 *              head on strings (f4771, f4783, f4816)
 *
 * Residual placeholders (black, beat kept): the SVG sketch of two hands
 * holding a frame (f3814 760.6–767.4, f4173 833–841) and holding the
 * noosphere (f4579, the noosphere is shown alone); the eye turning into a
 * circle of people (f3461) and into a head (f3552); the dotted vertical
 * divider (f3410); the crowd's disc in the cages; the news-anchor collage
 * inside the boxed head (f4831).
 */

import { Dream, render, type Holon } from "../../src/index"
import { together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { Text } from "../../src/parts/text"
import { Square } from "../../src/parts/primitives"
import { Surface } from "../../src/parts/surface"
import { BLUE, PI, WHITE } from "../../src/constants"
import { Layer, Figure } from "../../vocabulary/Figure/Figure"
import { Worldview, LENS, SOURCE } from "../../vocabulary/Worldview/Worldview"
import { Puppeteer } from "../../vocabulary/Puppeteer/Puppeteer"
import { Mind } from "../../vocabulary/Mind/Mind"
import { Conflict } from "../../vocabulary/Conflict/Conflict"
import { HyperAgent } from "../../vocabulary/HyperAgent/HyperAgent"
import { MolochEye } from "../../vocabulary/MolochEye/MolochEye"
import { FoldableCube } from "../../vocabulary/FoldableCube/FoldableCube"
import { Noosphere } from "../../vocabulary/Noosphere/Noosphere"
import { Field } from "../../vocabulary/Field/Field"
import { Attractor } from "../../vocabulary/Attractor/Attractor"
import { Dialectic } from "../../vocabulary/Attractor/Dialectic"
import { CHAPTERS, SERIF_ITALIC, titleCard } from "./film"

const CH = CHAPTERS[2]!
/** The default eye: 0.48 px per unit. Frame pixels → world. */
const PX = 720 / 1500
const X = (px: number): number => (px - 640) / PX
const Y = (py: number): number => (360 - py) / PX

/** A tableau: holons that come and go together (presence multiplies down). */
const layer = (...members: Holon[]): Layer => new Layer({ presence: 0, members })
/** One holon under its own presence (a deep FadeIn would fight the holon's own bound opacities). */
const wrap = (h: Holon, presence = 1): Layer => new Layer({ presence, members: [h] })

/**
 * The host draws a Surface's fill (the globe's ball) by its OWN opacity,
 * not the presence it sits under (render/three-host.ts, surfaces: every
 * other stroke and fill reads the seen opacity). Until that is one line
 * there, a tableau's fade carries its surfaces' opacity with it.
 */
const SURFACE_OPACITY = new WeakMap<Surface, number>()
const surfacesOf = (h: Holon): Surface[] =>
  [...h.walk()].filter((x): x is Surface => x instanceof Surface && !x.opacity.isBound)
export const fadeLayer = (l: Layer, to: number): Anim =>
  together(
    l.presence.to(to),
    ...surfacesOf(l).map((s) => {
      if (!SURFACE_OPACITY.has(s)) SURFACE_OPACITY.set(s, s.opacity.value)
      return s.opacity.to(to * SURFACE_OPACITY.get(s)!)
    }),
  )
/** At t 0, every hidden tableau's surfaces go dark with it. */
export const primeLayers = (dream: Dream): void => {
  const hidden = Object.values(dream).filter((v): v is Layer => v instanceof Layer && v.presence.value === 0)
  dream.set(...hidden.map((l) => fadeLayer(l, 0)))
}

/** A mind's frame side → its size R (Mind: triangle side = √3·1.15·R). */
const mindR = (sidePx: number): number => sidePx / PX / (Math.sqrt(3) * 1.15)

/** A crowd of busts in rows (f4013: the people inside the cage). */
const crowd = (cx: number, cy: number): Figure[] => {
  const out: Figure[] = []
  for (let row = 2; row >= 0; row--)
    for (let i = 0; i < 7; i++)
      out.push(
        new Figure({
          form: 1,
          opaque: 1,
          tint: WHITE,
          stroke: 1.2,
          height: 40 / PX,
          x: cx + (i - 3 + (row % 2) * 0.5) * (30 / PX),
          y: cy + row * (12 / PX),
        }),
      )
  return out
}

export class Ch3ViciousCycleDream extends Dream {
  /** The local cursor, mirrored so beats can be placed on the video clock. */
  private now = 0

  // ── the lens (f3256 → f3512)
  view = new Worldview({ globes: ["lens"], light: 0, prism: 0 })
  lensA = layer(this.view)

  // ── the hand and the mind in the prism's triangle (f3564 → f3609)
  hand = new Puppeteer({ size: 235, length: 320, x: -4, y: 360 })
  mind = new Mind({ size: mindR(245), framed: 1, y: -73.6 + 0.07 * mindR(245) })
  mind2 = new Mind({ size: mindR(255), framed: 1, x: X(842), y: -244 + 167 + 0.07 * mindR(255) })
  bolt2 = new Conflict({ size: 121 / PX, x: 0, y: Y(330) })
  handW = wrap(this.hand)
  mind2W = wrap(this.mind2, 0)
  bolt2W = wrap(this.bolt2, 0)
  pair = layer(this.handW, this.mind, this.mind2W, this.bolt2W)

  // ── divide and conquer (f3657 → f3872)
  unit = new HyperAgent({ size: 511 / PX, depth: 1, apex: 0, power: 0, build: 0 })
  unitW = wrap(this.unit, 0)
  unitL = new HyperAgent({ size: 348 / PX, depth: 1, apex: 0, power: 0, x: X(374) })
  unitR = new HyperAgent({ size: 348 / PX, depth: 1, apex: 0, power: 0, x: X(894) })
  unitBolt = new Conflict({ size: 142 / PX, x: X(634), y: Y(298) })
  units = layer(this.unitL, this.unitR, this.unitBolt)
  level2 = new HyperAgent({ size: 697 / PX, depth: 2, apex: 0, power: 0, build: 0 })
  level2W = wrap(this.level2, 0)
  level2L = new HyperAgent({ size: 428 / PX, depth: 2, apex: 0, power: 0, x: X(376), y: Y(360) })
  level2R = new HyperAgent({ size: 428 / PX, depth: 2, apex: 0, power: 0, x: X(904), y: Y(360) })
  level2Bolt = new Conflict({ size: 121 / PX, x: X(640), y: Y(320) })
  levels = layer(this.level2L, this.level2R, this.level2Bolt)

  // ── the eye in the lens (f3935, f4076)
  eyeInLens = new MolochEye({ height: 60, stroke: 2.2, y: -73 })
  view2 = new Worldview({ globes: [], source: SOURCE.fragmented, lens: LENS.noosphere, lensFace: this.eyeInLens, distortion: 1, strings: 1 })
  lensB = layer(this.view2)

  // ── boxed tribes ⚡ (f3987 → f4038)
  cageL = new FoldableCube({ size: 376 / PX, fold: 1, p: PI / 2, z: -376 / PX, x: X(339), tint: BLUE, stroke: 3 })
  cageR = new FoldableCube({ size: 376 / PX, fold: 1, p: PI / 2, z: -376 / PX, x: X(940), tint: BLUE, stroke: 3 })
  crowdL = layer(...crowd(X(339), Y(425)))
  crowdR = layer(...crowd(X(940), Y(425)))
  cageBolt = new Conflict({ size: 80 / PX, x: 0, y: Y(345) })
  cageBoltW = wrap(this.cageBolt, 0)
  cages = layer(this.cageL, this.cageR, this.crowdL, this.crowdR, this.cageBoltW)

  // ── the war machine (f4116 → f4315)
  war = new HyperAgent({ size: 693 / PX, depth: 3, apex: 1, power: 0, build: 0 })
  warL = layer(this.war)
  spirit = new MolochEye({ height: 95, stroke: 2.6, x: X(644) })
  spiritL = layer(this.spirit)

  // ── multipolar (f4489 → f4771)
  view3 = new Worldview({ globes: [], source: SOURCE.fragmented, lens: LENS.lattice, distortion: 1, strings: 1, pullers: 1 })
  lensC = layer(this.view3)
  held = new Noosphere({ radius: 62 / PX, frequency: 4, y: Y(410) })
  heldL = layer(this.held)

  // ── the oscillation in the red field (f4636)
  field = new Field({ opacity: 0.3 })
  dialectic = new Dialectic({ size: 48 / PX, span: 4.9, labels: 0, swing: 1, trace: 1, p: -0.5, y: -40 })
  red = layer(this.field, this.dialectic)

  // ── Chaos ⚡ censorship (f4783)
  chaos = new Attractor({ kind: "chaos", size: 80 / PX, pathology: 1, x: X(344) })
  censorBolt = new Conflict({ size: 162 / PX, direction: PI, x: X(640), y: Y(360) })
  censor = new Square({ size: 173 / PX, x: X(934), y: Y(360), tint: BLUE, stroke: 2.3 })
  censorWord = new Text({ content: "censorship", font: SERIF_ITALIC, size: 30 / PX, tint: BLUE, x: X(934), y: Y(360) })
  dilemma = layer(this.chaos, this.censorBolt, this.censor, this.censorWord)

  // ── the boxed head on strings (f4816)
  head = new Mind({ size: 1100, framed: 0, y: Y(520) })
  headHand = new Puppeteer({ size: 235, length: 240 / PX, x: 0, y: Y(40) })
  boxed = layer(this.head, this.headHand)

  /** Move the cursor to VIDEO time t. */
  private at(t: number): this {
    const l = t - CH.start
    this.wait(l - this.now)
    this.now = l
    return this
  }

  /** Play `anims` together from video time t for dur seconds. */
  private beat(t: number, dur: number, ...anims: Anim[]): void {
    this.at(t)
    this.play(together(...anims), dur)
    this.now += dur
  }

  private show = (l: Layer): Anim => fadeLayer(l, 1)
  private hide = (l: Layer): Anim => fadeLayer(l, 0)

  unfold() {
    primeLayers(this)
    titleCard(this, CH)

    // ── The world and the eye; the direct path, crossed out (10:49–11:05)
    const v = this.view
    this.beat(649, 0.1, this.show(this.lensA))
    this.beat(649.1, 2.9, Create(v))
    this.beat(657.4, 3, v.direct.to(1))
    this.beat(660.4, 1, v.crossed.to(1))
    this.beat(664, 1, v.light.to(1))
    // ── The prism between: the worldview (11:09–11:23)
    this.beat(669.2, 1.2, v.direct.to(0), v.crossed.to(0), v.light.to(0))
    this.beat(670.4, 0.8, v.prism.to(1))
    this.beat(672.2, 1.2, v.light.to(1), v.lens.to(LENS.earth))
    this.beat(675.6, 4.2, v.loop.to(1))
    // ── The noosphere as the lens, and back (11:29–11:37)
    this.beat(689.4, 2.4, v.lens.to(LENS.noosphere))
    this.beat(694.8, 2.8, v.lens.to(LENS.empty), v.loop.to(0))
    // ── Engineering distortions into the lens (11:39–11:42)
    this.beat(699.4, 0.6, v.lens.to(LENS.cube))
    this.beat(700, 2, v.source.to(SOURCE.fragmented), v.strings.to(1), v.distortion.to(1))

    // ── The hand and the mind (11:50–12:01)
    this.beat(710.6, 1.8, this.hide(this.lensA), this.show(this.pair))
    this.beat(716.8, 1, this.handW.presence.to(0))
    this.beat(
      719,
      2.4,
      this.mind.x.to(X(436)),
      this.mind.y.to(-244 + 167 + 0.07 * mindR(255)),
      this.mind2W.presence.to(1),
      this.bolt2W.presence.to(1),
    )

    // ── Divide and conquer (12:08–12:54)
    // the build (HyperAgent's `build`): the minds and the bolt, the head
    // mind; then, a beat later, the hands take hold (f3657 → f3667)
    this.beat(728, 1, this.hide(this.pair))
    this.beat(728, 3, this.unitW.presence.to(1), this.unit.build.to(0.79))
    this.beat(732.4, 0.6, this.unit.build.to(1))
    this.beat(735.4, 1.4, this.unitW.presence.to(0), this.show(this.units))
    this.beat(747, 1, this.hide(this.units))
    this.beat(747, 5, this.level2W.presence.to(1), this.level2.build.to(0.866))
    this.beat(753.2, 0.6, this.level2.build.to(1))
    // the hands holding the frame (f3814): residual — the pyramid steps aside
    this.beat(760.6, 1.8, this.level2W.presence.to(0))
    this.beat(767.4, 1, this.level2W.presence.to(1))
    this.beat(769, 2, this.level2W.presence.to(0), this.show(this.levels))

    // ── The primal distortion: the eye in the lens; boxed tribes (13:02–13:35)
    this.beat(782.4, 2.2, this.hide(this.levels), this.show(this.lensB))
    this.beat(793.8, 1, this.hide(this.lensB))
    this.beat(794, 3, this.show(this.cages), Create(this.cageL), Create(this.cageR))
    this.beat(801.2, 1, this.crowdL.presence.to(1), this.crowdR.presence.to(1))
    this.beat(805.6, 0.6, this.cageBoltW.presence.to(1))
    this.beat(812.8, 2, this.hide(this.cages), this.show(this.lensB))

    // ── The spirit of fragmentation above the apex (13:38–14:04)
    this.beat(817.8, 1, this.hide(this.lensB), this.show(this.warL))
    this.beat(817.8, 5, this.war.build.to(0.9))
    this.beat(824.2, 0.6, this.war.build.to(1))
    this.beat(830.4, 2, this.hide(this.warL), this.show(this.spiritL))
    // the hands holding the eye (f4173): residual
    this.beat(841, 2, this.hide(this.spiritL), this.show(this.warL))
    // ── The War Machine; Power (14:21)
    this.beat(861.2, 1.4, this.war.power.to(1))

    // ── Multipolar: the sanity of the population pulled apart (14:55–15:02)
    this.beat(894.8, 2.6, this.hide(this.warL), this.show(this.lensC))
    this.beat(899.2, 2, this.view3.pullers.to(3))
    // the hands holding the noosphere (f4579): the noosphere alone
    this.beat(913.2, 2.2, this.hide(this.lensC), this.show(this.heldL))
    this.set(this.view3.pullers.to(1))

    // ── The freedom-order dilemma again: the oscillation in the red field (15:22–15:33)
    const d = this.dialectic
    this.beat(922.4, 1.5, this.hide(this.heldL), this.show(this.red))
    this.at(922.4)
    this.play(together(d.phase.by(11.2 * 1.6, { easing: "linear" }), this.field.time.by(12, { easing: "linear" })), 12)
    this.now += 12
    this.beat(933, 1.4, this.hide(this.red), this.show(this.lensC))
    this.beat(934.4, 2.2, this.view3.pullers.to(3))
    // ── Drilling deeper into the minds (15:49)
    this.beat(949.2, 4.6, this.view3.pullers.to(1))
    // ── Controlling the narrative through censorship (15:55)
    this.beat(954.4, 1.8, this.hide(this.lensC), this.show(this.dilemma))
    // ── The boxed head on strings; the news collage (residual) (16:00–16:09)
    this.beat(959.6, 2, this.hide(this.dilemma), this.show(this.boxed))
    this.beat(967.4, 1.8, this.hide(this.boxed))

    this.at(CH.end)
  }
}

if (import.meta.main) render(Ch3ViciousCycleDream)
