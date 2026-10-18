/**
 * Ch4GoingUpstream — chapter 4 of the InterBrain film, "Going Upstream"
 * (video 971–1395 s; docs/reports/interbrain-vocabulary.md §2, §8).
 *
 * A composition: it lays out, labels and times the vocabulary's holons and
 * draws nothing of its own. Beats are measured off frames5 (motion segments
 * of f4856–f6976) and the narration; `beat(T, …)` takes VIDEO seconds.
 *
 *   972–977    title card
 *   977–1019   the war machine on the ladder of the three spheres (f4901,
 *              f5096); the hands round it (placeholder); the oscillation in
 *              the red field (f4960); the war machine (f5024)
 *   1024–1098  the narrative-engineered noosphere ringed by narratives ⚡
 *              (f5131, f5148); the boxed web (f5193 …); the oscillation again
 *   1098–1112  Narrative Engineering → ? (f5500, f5525)
 *   1110–1170  Engineering │ Gardening (f5564); Narrative → Vision (f5655,
 *              f5680); the two spheres (f5720); Narrative Engineering │
 *              Vision Gardening (f5760 … f5834); the S-arc (f5849)
 *   1174–1210  SandTalk; the symbol drawn; Seed │ Soil (f5889 … f6052)
 *   1214–1287  the tribe, resonance; freedom of speech × [tribe] → order;
 *              tribes of tribes (f6086 … f6434)
 *   1289–1331  Ancient → Book → Radio tower → Modern; the book, the tower in
 *              the red burst; freedom of speech × [broadcast] ⚡ order
 *              (f6464 … f6658)
 *   1339–1395  the modern web at scale, the infection; Spirit │ Scale and the
 *              S-arc between (f6703 … f6963)
 *
 * Residual placeholders: the SVG sketch of the hands round the noosphere
 * (f4928, 982–990: the war-machine icon alone), the ziggurat being built and
 * the seed of light growing into a tree (f5581–f5641), the travelling glow
 * through the boxed web (1044–1078), the dotted rings round the tribes of
 * tribes (f6300), the ancient tribes' middle under the modern one (f6703).
 */

import { Dream, render, type Holon } from "../../src/index"
import { together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { Text } from "../../src/parts/text"
import { Circle, Line } from "../../src/parts/primitives"
import { BLACK, BLUE, PI, RED, WHITE, rgb } from "../../src/constants"
import { Layer } from "../../vocabulary/Figure/Figure"
import { HyperAgent } from "../../vocabulary/HyperAgent/HyperAgent"
import { Spheres } from "../../vocabulary/Spheres/Spheres"
import { Field } from "../../vocabulary/Field/Field"
import { Dialectic } from "../../vocabulary/Attractor/Dialectic"
import { Noosphere } from "../../vocabulary/Noosphere/Noosphere"
import { FoldableCube } from "../../vocabulary/FoldableCube/FoldableCube"
import { Conflict } from "../../vocabulary/Conflict/Conflict"
import { Tribe } from "../../vocabulary/Tribe/Tribe"
import { Divide, FILM_TURN } from "../../vocabulary/Divide/Divide"
import { Vision } from "../../vocabulary/Vision/Vision"
import { SandTalk, SeedGlyph } from "../../vocabulary/SandTalk/SandTalk"
import "../../vocabulary/Resonance/Resonance" // grafts .resonate() onto every outlined stroke
import type { Resonance } from "../../vocabulary/Resonance/Resonance"
import { Book } from "../../vocabulary/Book/Book"
import { RadioTower } from "../../vocabulary/RadioTower/RadioTower"
import { CHAPTERS, SERIF, SERIF_ITALIC, titleCard } from "./film"
import { fadeLayer, primeLayers, TITLE_SIZE } from "./Ch3ViciousCycle"

const CH = CHAPTERS[3]!
const PX = 720 / 1500
const X = (px: number): number => (px - 640) / PX
const Y = (py: number): number => (360 - py) / PX

const layer = (...members: Holon[]): Layer => new Layer({ presence: 0, members })

/** A label on the film's serif: `em` its em in frame pixels, centred at (cx, cy) px. */
const label = (content: string, cx: number, cy: number, em: number, tint = WHITE, italic = false): Text =>
  new Text({ content, font: italic ? SERIF_ITALIC : SERIF, size: (em < 40 ? 1.3 * em : em) / PX, tint, x: X(cx), y: Y(cy), lineHeight: 1.2 })

/** An arrow → from px x0 to x1 at row y (white unless told). */
const arrow = (x0: number, x1: number, y: number, tint = WHITE, stroke = 3): Line =>
  new Line({ points: [{ x: X(x0), y: Y(y), z: 0 }, { x: X(x1), y: Y(y), z: 0 }], arrowEnd: true, arrowSize: 2.4, tint, stroke })

/**
 * The narrative as the film draws it standalone: a white cube in a blue ring
 * (f5148, f5655, f5807) — the same pair Tribe claps over a head (Tribe's box:
 * a black disc, FoldableCube at fold 1 open toward us, a blue Circle).
 */
const narrative = (r: number, cx: number, cy: number, stroke = 2.4): Layer => {
  const cube = 1.25 * r
  return new Layer({
    x: cx,
    y: cy,
    members: [
      new Circle({ radius: r, tint: BLACK, stroke: 0, fillOpacity: 1 }),
      new FoldableCube({ size: cube, fold: 1, p: PI / 2, z: -cube, tint: WHITE, stroke }),
      new Circle({ radius: r, tint: BLUE, stroke: stroke + 0.6 }),
    ],
  })
}

export class Ch4GoingUpstreamDream extends Dream {
  private now = 0

  // ── the war machine on the ladder (f4901, f5096)
  warIcon = new HyperAgent({ size: 245 / PX, depth: 0, power: 0, x: X(240) })
  ladder = new Layer({
    presence: 0,
    members: [
      this.warIcon,
      label("War Machine", 240, 528, 26),
      new Line({ points: [{ x: X(404), y: Y(643), z: 0 }, { x: X(404), y: Y(138), z: 0 }], arrowEnd: true, tint: BLUE, stroke: 2 }),
      new Spheres({ stack: 1, fragmented: 1, labels: 0, arrows: 0, y: 50 }),
      label("Narrative Engineering", 961, 191, 24, RED),
      label("Social Engineering", 961, 472, 24),
      label("Physical Engineering", 961, 648, 24, BLUE),
    ],
  })
  // f4928: the hands round the noosphere with the eye — the sketch is a residual
  heldIcon = layer(new HyperAgent({ size: 70 / PX, depth: 0, power: 0, x: X(634) }))

  // ── the oscillation in the red field (f4960)
  field = new Field({ opacity: 0.3 })
  dialectic = new Dialectic({ size: 50 / PX, span: 5.2, labels: 0, swing: 1, trace: 1, p: -0.5, y: Y(355) })
  red = layer(this.field, this.dialectic)

  // ── the war machine (f5024)
  war = layer(new HyperAgent({ size: 693 / PX, depth: 3, apex: 1, power: 0 }))

  // ── the narrative-engineered noosphere ringed by narratives ⚡ (f5131, f5148)
  nooC = layer(new Noosphere({ radius: 181 / PX, frequency: 7, bloom: 1, garden: 0, y: Y(358) }))
  ring6 = layer(
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (i * PI) / 3
      return narrative(51 / PX, (276 / PX) * Math.cos(a), Y(358) + (276 / PX) * Math.sin(a))
    }),
    new Conflict({ count: 6, radius: 262 / PX, size: 80 / PX, phase: PI / 6, y: Y(358) }),
  )

  // ── the boxed web (f5193)
  web = layer(new Tribe({ size: 274 / PX, modern: 1, boxed: 1 }))

  // ── Narrative Engineering → ? (f5500, f5525)
  nooN = new Noosphere({ radius: 180 / PX, frequency: 7, bloom: 1, garden: 0 })
  nooNL = new Layer({ presence: 0, x: X(635), y: Y(333), members: [this.nooN, new Text({ content: "Narrative Engineering", font: SERIF, size: 26 / PX, y: Y(597) - Y(333) })] })
  query = layer(arrow(668, 760, 332, WHITE, 4), label("?", 900, 345, 200))

  // ── Engineering │ Gardening (f5564)
  divide = new Divide({ radius: 760 / PX, turn: FILM_TURN, stroke: 7, fieldA: "grid", fieldB: "flower", fieldReach: 0.92 })
  divideL = layer(this.divide, label("Engineering", 308, 160, 43), label("Gardening", 965, 558, 43))

  // ── Narrative → Vision (f5655, f5680)
  narr = layer(narrative(92 / PX, X(396), Y(360)), label("Narrative", 396, 584, 30))
  toVision = layer(
    arrow(592, 690, 360, WHITE, 4),
    new Vision({ radius: 74 / PX, ring: 1, light: 1, x: X(884), y: Y(360) }),
    label("Vision", 884, 584, 30),
  )

  // ── Narrative Engineering → Vision Gardening (f5720)
  spheres2 = layer(
    new Noosphere({ radius: 185 / PX, frequency: 7, bloom: 1, garden: 0, x: X(348), y: Y(333) }),
    arrow(592, 690, 332, WHITE, 4),
    new Noosphere({ radius: 186 / PX, frequency: 7, bloom: 1, garden: 1, x: X(932), y: Y(333) }),
    label("Narrative Engineering", 348, 597, 20),
    label("Vision Gardening", 932, 597, 20),
  )

  // ── Narrative Engineering │ Vision Gardening (f5760 → f5834)
  divide2 = new Divide({ radius: 760 / PX, turn: FILM_TURN, stroke: 7, fieldA: "grid", fieldB: "flower", fieldReach: 0.92 })
  divide2L = layer(
    this.divide2,
    narrative(171 / PX, X(309), Y(459), 3),
    label("Narrative\nEngineering", 309, 160, 43),
    label("Vision\nGardening", 966, 557, 43),
  )
  vision2 = new Vision({ radius: 128 / PX, ring: 1, light: 0, tint: WHITE, ringStroke: 3, x: X(966), y: Y(272) })
  vision2L = layer(this.vision2)

  // ── the S-arc: one sphere into the other (f5849)
  arc = new Divide({ radius: 310 / PX, turn: FILM_TURN, stroke: 5, arrow: 1 })
  arcL = layer(
    this.arc,
    new Noosphere({ radius: 80 / PX, frequency: 7, bloom: 1, garden: 0, x: X(539), y: Y(472) }),
    new Noosphere({ radius: 80 / PX, frequency: 7, bloom: 1, garden: 1, x: X(744), y: Y(248) }),
    label("Narrative Engineering", 309, 475, 20),
    label("Vision Gardening", 958, 258, 20),
  )

  // ── SandTalk; Seed │ Soil (f5889 → f6052)
  sand = new SeedGlyph({ radius: 100 })
  talk = new SandTalk({ size: 217 / PX, vision: 0, symbol: this.sand })
  talkL = layer(this.talk)
  talkName = layer(label("SandTalk", 640, 510, 25))
  seed = layer(new SeedGlyph({ radius: 84 / PX, x: X(334), y: Y(365), p: -1.1 }), label("Seed", 334, 470, 25), label("Soil", 902, 470, 25))

  // ── the tribe, its resonance (f6086 → f6128)
  tribe = new Tribe({ size: 263 / PX })
  tribeL = layer(this.tribe)
  ripples: Resonance[] = (void this.tribe.parts,
  this.tribe.minds.map((m) => (void m.parts, m.frame.resonate({ amount: 0, rings: 2, dash: 180, reach: 1.6 }).resonance)))
  ripplesL = layer(...this.ripples)

  // ── freedom of speech × [ … ] → order (f6157, f6184, f6616, f6658)
  equation = layer(
    label("freedom", 289, 365, 23, RED, true),
    label("of speech", 422, 365, 23),
    label("×", 524, 365, 20),
    label("order", 980, 365, 23, BLUE, true),
  )
  swarm = new Field({ mode: "swarm", radius: 40 / PX, reach: 14 / PX, focusX: X(694), focusY: Y(365), count: 160, stroke: 1.4, opacity: 0.8 })
  emergent = layer(this.swarm, new Circle({ radius: 98 / PX, x: X(694), y: Y(365), tint: rgb(150, 210, 215), stroke: 1, opacity: 0.5 }), arrow(852, 908, 365, WHITE, 3))

  // ── tribes of tribes (f6300)
  tribes = layer(new Tribe({ size: 87 / PX, depth: 1, stroke: 1.1 }))

  // ── Ancient → Book → Radio tower → Modern (f6464)
  timeline = layer(
    new Tribe({ size: 91 / PX, stroke: 1.2, x: X(220), y: Y(370) }),
    label("Ancient", 220, 516, 18),
    arrow(384, 896, 372, WHITE, 2),
    new Line({ points: [{ x: X(532), y: Y(364), z: 0 }, { x: X(532), y: Y(380), z: 0 }], tint: WHITE, stroke: 2 }),
    new Line({ points: [{ x: X(742), y: Y(364), z: 0 }, { x: X(742), y: Y(380), z: 0 }], tint: WHITE, stroke: 2 }),
    new Book({ size: 45 / PX, x: X(532), y: Y(415) }),
    new RadioTower({ size: 45 / PX, x: X(742), y: Y(415) }),
    new Tribe({ size: 92 / PX, modern: 1, stroke: 1.2, x: X(1072), y: Y(370) }),
    label("Modern", 1072, 516, 18),
  )

  // ── the book, the tower, the burst (f6533 → f6606)
  book = new Book({ size: 93 / PX })
  tower = new RadioTower({ size: 70 / PX, y: Y(235) - Y(360) })
  towerL = new Layer({ presence: 0, members: [this.tower] })
  media = new Layer({ presence: 0, members: [this.book, this.towerL] })
  bookSwarm = new Field({ mode: "swarm", radius: 42 / PX, reach: 14 / PX, count: 140, stroke: 1.6 })
  bookSwarmL = layer(this.bookSwarm)
  burst = new Field({ mode: "swarm", radius: 62 / PX, reach: 35 / PX, count: 320, stroke: 2.2 })
  burstL = layer(this.burst)
  bolt = layer(new Conflict({ size: 117 / PX, direction: 0, x: X(804), y: Y(365) }))

  // ── the modern medium at scale; the infection (f6703 → f6883)
  tribesMix = layer(
    new Tribe({ size: 87 / PX, depth: 1, stroke: 1.1 }),
    new Tribe({ size: 55 / PX, modern: 1, stroke: 1.2 }),
    new Conflict({ count: 6, radius: 130 / PX, size: 22 / PX, phase: PI / 6 }),
  )
  bigWeb = layer(new Tribe({ size: 106 / PX, rings: 3, modern: 1, stroke: 1.3 }))
  infection = new Field({ mode: "swarm", radius: 190 / PX, reach: 45 / PX, count: 900, stroke: 1.6, opacity: 0.85 })
  infectionL = layer(this.infection)
  scale = new Layer({ presence: 0, members: [new Tribe({ size: 92 / PX, modern: 1, stroke: 1.3 })] })
  spirit = new Layer({ presence: 0, x: X(370), members: [new Tribe({ size: 158 / PX, stroke: 1.8 })] })
  spiritName = layer(label("Spirit", 370, 597, 22, rgb(170, 170, 170)))
  scaleName = layer(label("Scale", 912, 597, 22))
  synthesis = new Divide({ radius: 155 / PX, turn: FILM_TURN, stroke: 3, arrow: 1 })

  private at(t: number): void {
    const l = t - CH.start
    this.wait(l - this.now)
    this.now = l
  }

  private beat(t: number, dur: number, ...anims: Anim[]): void {
    this.at(t)
    this.play(together(...anims), dur)
    this.now += dur
  }

  /** A clock running linearly from t for dur (time params that must keep flowing). */
  private clock(t: number, dur: number, ...anims: Anim[]): void {
    this.beat(t, dur, ...anims)
  }

  private show = (...ls: Layer[]): Anim => together(...ls.map((l) => fadeLayer(l, 1)))
  private hide = (...ls: Layer[]): Anim => together(...ls.map((l) => fadeLayer(l, 0)))

  unfold() {
    primeLayers(this)
    titleCard(this, { ...CH, card: [972.4, 977] }, TITLE_SIZE)

    // ── The story starts and ends in the noosphere: the war machine on the ladder (16:17–16:24)
    this.beat(977.4, 2.4, this.show(this.ladder))
    this.beat(981.8, 2, this.hide(this.ladder), this.show(this.heldIcon))
    // ── … a third attractor … this vicious cycle (16:30–16:41)
    this.beat(990, 1.5, this.hide(this.heldIcon), this.show(this.red))
    const d = this.dialectic
    this.clock(990, 12, d.phase.by(12 * 1.6, { easing: "linear" }), this.field.time.by(12, { easing: "linear" }))
    // ── A machine of unimaginable resources (16:41–16:56)
    this.beat(1001.4, 1, this.hide(this.red))
    this.beat(1001.4, 3, this.show(this.war))
    this.beat(1016.8, 2, this.hide(this.war), this.show(this.ladder))
    // ── The substrate of engineered narratives (17:04–17:09)
    this.beat(1023.8, 2, this.hide(this.ladder), this.show(this.nooC))
    this.beat(1026.6, 2.6, this.show(this.ring6))
    // ── The medium: our contemporary communication media (17:17–17:58)
    this.beat(1037.4, 2.4, this.hide(this.nooC, this.ring6), this.show(this.web))
    this.beat(1058.6, 1.4, this.hide(this.web), this.show(this.red))
    this.clock(1058.6, 10.4, d.phase.by(10.4 * 1.6, { easing: "linear" }), this.field.time.by(10.4, { easing: "linear" }))
    this.beat(1068.6, 1.4, this.hide(this.red), this.show(this.web))

    // ── The antithesis: Narrative Engineering → ? (18:18–18:25)
    this.beat(1098.4, 1.2, this.hide(this.web), this.show(this.nooNL))
    this.beat(1102.6, 2, this.nooNL.x.to(X(418)), this.show(this.query))
    // ── Engineering │ Gardening (18:30–18:47)
    this.beat(1110.4, 2, this.hide(this.nooNL, this.query), this.show(this.divideL))
    // ── Narrative → Vision (18:48–18:56)
    this.beat(1128.8, 1.8, this.hide(this.divideL), this.show(this.narr))
    this.beat(1131.2, 2.4, this.show(this.toVision))
    // ── Narrative Engineering → Vision Gardening (18:57–19:04)
    this.beat(1137.2, 2.4, this.hide(this.narr, this.toVision), this.show(this.spheres2))
    // ── Mimetic seeds in a mental soil (19:07–19:23)
    this.beat(1147, 2.4, this.hide(this.spheres2), this.show(this.divide2L))
    this.beat(1153, 1.8, this.show(this.vision2L), this.vision2.light.to(1))
    this.at(1153)
    this.play(Create(this.vision2), 9)
    this.now += 9
    // ── Back in time: the S-arc (19:27–19:29)
    this.beat(1167.4, 2, this.hide(this.divide2L, this.vision2L), this.show(this.arcL))

    // ── SandTalk (19:34–20:10)
    this.set(...[...this.sand.walk()].map((h) => h.creation.to(0)))
    this.beat(1174.4, 3, this.hide(this.arcL), this.show(this.talkL))
    this.at(1186)
    this.play(Create(this.sand), 4)
    this.now += 4
    this.beat(1192.6, 0.8, this.show(this.talkName))
    this.beat(1196.6, 2, this.hide(this.talkName), this.talkL.x.to(X(902)), this.talkL.scale.to(0.77), ...[...this.sand.walk()].map((h) => h.opacity.to(0)), this.show(this.seed))
    this.beat(1206.8, 2.2, this.talkL.x.to(0), this.talkL.scale.to(1), ...[...this.sand.walk()].map((h) => h.opacity.to(1)), this.hide(this.seed))

    // ── The tribe; inspiring visions travel faster and further (20:15–20:25)
    this.beat(1214.6, 2.2, this.hide(this.talkL), this.show(this.tribeL))
    this.set(this.ripplesL.presence.to(1))
    this.at(1214.6)
    this.play(together(...this.ripples.map((r) => r.time.by(16, { easing: "linear" }))), 16)
    this.now += 16
    this.beat(1220, 2.5, ...this.ripples.map((r) => r.amount.to(0.7)))
    this.beat(1226, 3, ...this.ripples.map((r) => r.amount.to(0)))
    // ── Freedom of speech → an emergent order (20:30–20:42)
    this.beat(1230, 1, this.hide(this.tribeL, this.ripplesL), this.show(this.equation))
    this.beat(1232.4, 4, this.show(this.emergent))
    this.clock(1232.4, 10, this.swarm.time.by(10, { easing: "linear" }))
    this.beat(1240.8, 1.8, this.hide(this.equation, this.emergent), this.show(this.tribeL))
    // ── Tribes of tribes; the Dunbar number (20:54–21:26)
    this.beat(1254.4, 5.2, this.tribeL.scale.to(87 / 263), this.hide(this.tribeL), this.show(this.tribes))
    this.beat(1283.2, 3.2, this.hide(this.tribes), this.show(this.tribeL), this.tribeL.scale.to(1))

    // ── The written word and broadcast (21:29–21:46)
    this.beat(1289.2, 3.2, this.hide(this.tribeL), this.show(this.timeline))
    this.beat(1304.2, 1, this.hide(this.timeline))
    this.beat(1304.2, 2, this.show(this.media, this.bookSwarmL))
    this.clock(1304.2, 9, this.bookSwarm.time.by(9, { easing: "linear" }), this.bookSwarm.dissolve.to(1))
    this.beat(1313.4, 0.5, this.hide(this.bookSwarmL))
    this.beat(1314.2, 1, this.show(this.towerL))
    // the tower lands on the book in a red burst (f6586, f6596)
    this.beat(1315.6, 0.8, this.tower.y.to(Y(300) - Y(360)), this.show(this.burstL))
    this.clock(1315.6, 6, this.burst.time.by(6, { easing: "linear" }), this.burst.dissolve.to(1))
    this.beat(1321, 0.6, this.hide(this.burstL))
    // ── Reach regulated by access (22:01–22:12)
    this.set(this.swarm.dissolve.to(0))
    this.beat(1321.6, 1.4, this.media.x.to(X(658)), this.media.y.to(Y(215)), this.media.scale.to(0.55), this.show(this.equation, this.emergent))
    this.clock(1321.6, 9, this.swarm.time.by(9, { easing: "linear" }))
    this.beat(1327.4, 2, this.media.x.to(X(637)), this.media.y.to(Y(365) - 10), this.hide(this.emergent))
    this.beat(1330.4, 0.8, this.show(this.bolt))

    // ── The artificial medium scales: the apex predator (22:19–22:26)
    this.beat(1339, 1.2, this.hide(this.media, this.equation, this.bolt), this.show(this.tribesMix))
    this.beat(1340.8, 1.5, this.hide(this.tribesMix), this.show(this.bigWeb))
    // ── Mind viruses go viral (22:41–22:53)
    this.beat(1361, 2, this.show(this.infectionL))
    this.clock(1361, 13, this.infection.time.by(13, { easing: "linear" }))
    this.beat(1371.6, 2.4, this.hide(this.infectionL))
    this.beat(1367.8, 8.4, this.bigWeb.scale.to(0.35))
    this.beat(1374.4, 1.8, this.hide(this.bigWeb), this.show(this.scale))
    // ── A synthesis of the modern with the ancient: Spirit │ Scale (22:57–23:12)
    this.beat(1376.8, 3.4, this.scale.x.to(X(912)), this.scale.scale.to(159 / 92), this.show(this.spirit, this.spiritName))
    this.beat(1384, 0.8, this.show(this.scaleName))
    this.beat(
      1388.4,
      2.2,
      this.hide(this.spiritName, this.scaleName),
      this.scale.x.to(X(537)),
      this.scale.y.to(Y(465)),
      this.scale.scale.to(65 / 92),
      this.spirit.x.to(X(740)),
      this.spirit.y.to(Y(256)),
      this.spirit.scale.to(63 / 158),
    )
    this.at(1391.4)
    this.play(Create(this.synthesis), 1.2)
    this.now += 1.2

    this.at(CH.end)
  }
}

if (import.meta.main) render(Ch4GoingUpstreamDream)
