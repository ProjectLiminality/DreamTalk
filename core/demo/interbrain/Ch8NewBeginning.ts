/**
 * Ch8NewBeginning — chapter 8 of the InterBrain film, "A New Beginning"
 * (video 2446–2835 s; docs/reports/interbrain-vocabulary.md §2, §8).
 *
 * A composition: it lays out, labels and times vocabulary holons and draws
 * nothing of its own. Beats in VIDEO seconds (score.ts `at`), measured off
 * frames5 (2 s contact sheets of f12231–f14171) and the narration:
 *
 *   2448–2454.5 title card
 *   2455–2466   the InterBrain sphere ↓ "Ending Narrative Warfare" (f12291, f12301)
 *   2465–2471   the view travels down to the Vault (f12331, f12346)
 *   2471–2477   the second brain (the neutral `notes` face) → the InterBrain in its ring (f12361, f12376)
 *   2477–2484   the paradigm shift: the sphere, large, among the stars (f12391–f12411)
 *   2484–2502   the ladder of leverage; the healing trickles down (f12431–f12501)
 *   2502–2523   the applications round the sphere (f12521–f12611)
 *   2523–2530   the war machine; the view moves into its eye (f12621–f12641)
 *   2530–2537   the domesticated eye in its red swarm; it dissolves (f12651–f12681)
 *   2537–2548   the liminal eye, the cyan burst (f12691–f12731)
 *   2547–2563   the red flower disk → the InterBrain sphere (f12741–f12811)
 *   2563–2570   the pyramid flashes; into the eye again (f12821–f12841)
 *   2570–2593   the sphere; the medium changes: cyan burst, the red flower field (f12851–f12951)
 *   2591–2600   the liminal eye in the burst (f12961–f12991)
 *   2599–2623   the war machine → the hyper-agent of love (f13001–f13111)
 *   2623–2640   the hyperspace tunnel (f13131–f13191)
 *   2639–2651   the sphere close and whole (f13201–f13251)
 *   2651–2662   the radiant Earth, DreamTalk (f13271–f13301)
 *   2664–2820   live footage — black placeholder; the picture-in-picture circle
 *               (2711.5–2736.5, f13561–f13681) holds a LiminalWeb walking its tour
 *   2820–2835   the Logo, "Project Liminality" (f14101–f14161)
 *
 * Residuals: the footage itself; the blue triangle grid before the flower
 * field (2574–2578) is not drawn; the war machine at 2602–2608 keeps its
 * domesticated eye until the love walk (the film has already set the
 * liminal one in it); the second brain's app mark is the neutral `notes`
 * face (§6 default 4).
 */

import { render } from "../../src/index"
import { together } from "../../src/anim"
import { Create, UnCreate } from "../../src/verbs"
import { Text } from "../../src/parts/text"
import { Ellipse, Group, Line } from "../../src/parts/primitives"
import { BLACK, RED, WHITE, rgb } from "../../src/constants"
import { Layer } from "../../vocabulary/Figure/Figure"
import { Noosphere } from "../../vocabulary/Noosphere/Noosphere"
import { Vault } from "../../vocabulary/Vault/Vault"
import { icon } from "../../vocabulary/Icons/Icons"
import { InterBrain } from "../../vocabulary/InterBrain/InterBrain"
import { DreamNode } from "../../vocabulary/DreamNode/DreamNode"
import { Spheres } from "../../vocabulary/Spheres/Spheres"
import { HyperAgent } from "../../vocabulary/HyperAgent/HyperAgent"
import { MolochEye, LENS_STROKE_RATIO, LENS_RADIUS_RATIO } from "../../vocabulary/MolochEye/MolochEye"
import { Field } from "../../vocabulary/Field/Field"
import { DreamTalkSymbol } from "../../vocabulary/DreamTalkSymbol/DreamTalkSymbol"
import { LiminalWeb } from "../../vocabulary/LiminalWeb/LiminalWeb"
import { Logo } from "../../vocabulary/Logo/Logo"
import { Circle } from "../../src/parts/primitives"
import { SERIF } from "./film"
import { R, ShotDream, X, Y, label, tunnelChain } from "./Ch7BreakingTheSpell"

/** The MolochEye's lens outline at half-height h (FieldDemo's construction), for the swarm. */
const lensOutline = (h: number, steps = 48) => {
  const Rl = LENS_RADIUS_RATIO * h
  const c = Rl - h
  const half = Math.asin(2 / LENS_RADIUS_RATIO)
  const pts: { x: number; y: number; z: number }[] = []
  for (let k = 0; k <= steps; k++) {
    const a = Math.PI / 2 + half - (2 * half * k) / steps
    pts.push({ x: Rl * Math.cos(a), y: -c + Rl * Math.sin(a), z: 0 })
  }
  for (let k = 1; k <= steps; k++) {
    const a = -Math.PI / 2 + half - (2 * half * k) / steps
    pts.push({ x: Rl * Math.cos(a), y: c + Rl * Math.sin(a), z: 0 })
  }
  return pts
}

const EYE_H = 110
const sphere = (px: number, over: Record<string, unknown> = {}) =>
  new Noosphere({ radius: R(px), frequency: 2, bloom: 1, garden: 1, interbrain: 1, ...over })

export class Ch8NewBeginningDream extends ShotDream {
  protected readonly chapterIndex = 7

  // A. The sphere → Ending Narrative Warfare; down to the Vault.
  s1 = sphere(164, { y: Y(330) })
  endArrow = new Line({ points: [{ x: 0, y: Y(416), z: 0 }, { x: 0, y: Y(544), z: 0 }], arrowEnd: true, stroke: 2 })
  endLabel = new Text({ content: "Ending Narrative\nWarfare", font: SERIF, size: 70, lineHeight: 1.2, tint: WHITE, y: Y(602) })
  vault = new Vault({ y: -R(720) })
  pan = new Layer({ members: [this.s1, this.endArrow, this.endLabel, this.vault] })

  // B. Second brain → InterBrain → the sphere among the stars.
  notes = icon("notes", { size: R(300) })
  ibNode = new DreamNode({ radius: R(140), dreamTint: RED, faceFill: 122 / 134, face: new InterBrain({ radius: 300 }) })
  brains = this.layer(this.notes, this.ibNode)
  stars = new Field({ density: 0.35, wholeness: 0.5, opacity: 0.6 })
  bigSphere = sphere(288)
  shift = this.layer(this.stars, this.bigSphere)

  // C. The ladder of leverage (f12431–f12501).
  spheres = new Spheres({ stack: 1, fragmented: 1, arrows: 0, scale: 0.86 })
  ladder = this.layer(this.spheres)

  // D. The applications (f12586).
  s2 = sphere(164)
  apps = (
    [
      ["Podcasting", 640, 64, 2506.4],
      ["Investigative\nJournalism", 398, 160, 2507.2],
      ["P2P Education", 882, 162, 2508],
      ["Community\nEngine", 342, 362, 2508.8],
      ["Decentralised\nIndustry", 948, 362, 2509.6],
      ["Open\nScience", 400, 540, 2510.4],
      ["Content\nCreation", 884, 540, 2511.2],
    ] as const
  ).map(([content, x, y, t]) => ({ text: new Text({ content, font: SERIF, size: 70, lineHeight: 1.2, tint: WHITE, x: X(x), y: Y(y) }), t }))
  appEnd = new Text({ content: "Ending Narrative\nWarfare", font: SERIF, size: 70, lineHeight: 1.2, tint: WHITE, y: Y(628) })
  applications = this.layer(this.s2, this.appEnd, ...this.apps.map((a) => a.text))

  // E. The war machine and its eye.
  war = new HyperAgent({ size: R(690), depth: 3, power: 0, y: Y(362) })
  warShot = this.layer(this.war)
  eye = new MolochEye({ height: R(EYE_H), stroke: LENS_STROKE_RATIO * EYE_H, y: Y(352) })
  swarm = new Field({ mode: "swarm", shape: [lensOutline(R(EYE_H)).map((p) => ({ ...p, y: p.y + Y(352) }))], reach: R(58), stroke: 1.6 })
  eyeShot = this.layer(this.eye, this.swarm)
  liminal = new MolochEye({ height: R(EYE_H), stroke: LENS_STROKE_RATIO * EYE_H, iris: 1, y: Y(352) })
  eyeBurst = new Field({ mode: "burst", wholeness: 1, radius: R(130), reach: R(250), stroke: 1.5, count: 4000, focusY: Y(352) })
  liminalShot = this.layer(this.eyeBurst, this.liminal)

  // F. The red flower disk → the InterBrain sphere.
  medium = sphere(90, { flat: 1, interbrain: 0, diskInk: 0.25 })
  dust = new Field({ mode: "swarm", radius: R(150), reach: R(120), stroke: 1.2, opacity: 0.5, wholeness: 0.5 })
  mediumShot = this.layer(this.dust, this.medium)

  // G. The medium changes (f12871–f12951).
  s3 = sphere(160)
  flowerField = new Noosphere({ radius: R(1930), frequency: 2, flat: 1, bloom: 1, garden: 1, diskFill: 0, diskInk: 0.8, diskStroke: 1.6 })
  fieldBurst = new Field({ mode: "burst", wholeness: 1, radius: R(160), reach: R(700), stroke: 1.2, count: 2500, opacity: 0.7 })
  changeShot = this.layer(this.flowerField, this.fieldBurst, this.s3)
  eye2 = new MolochEye({ height: R(EYE_H), stroke: LENS_STROKE_RATIO * EYE_H, iris: 1 })
  eye2Burst = new Field({ mode: "burst", wholeness: 1, radius: R(130), reach: R(250), stroke: 1.5, count: 4000 })
  eye2Shot = this.layer(this.eye2Burst, this.eye2)

  // H. War machine → hyper-agent of love.
  agent = new HyperAgent({ size: R(700), depth: 3, power: 0, y: Y(348) })
  loveShot = this.layer(this.agent)

  // I. The tunnel again, the sphere close and whole, the radiant Earth.
  warp = new Field({ wholeness: 1, opacity: 0.6, density: 0.5 })
  chainGroup = new Group({})
  tunnel = this.layer(this.warp, this.chainGroup)
  dense = new Noosphere({ radius: R(560), frequency: 7, bloom: 1, garden: 1, y: Y(700) })
  denseShot = this.layer(this.dense)
  earth = new DreamTalkSymbol({ radius: R(250) })
  earthShot = this.layer(this.earth)

  // J. The picture-in-picture over the footage's placeholder.
  pipDisk = new Ellipse({ radiusX: R(210), radiusY: R(210), filled: true, tint: BLACK, x: X(272), y: Y(210) })
  pipRim = new Circle({ radius: R(210), stroke: 1.2, tint: rgb(70, 70, 70), x: X(272), y: Y(210) })
  web = new LiminalWeb({ radius: R(70), x: X(272), y: Y(210) })
  pip = this.layer(this.pipDisk, this.pipRim, this.web)

  // K. The end card.
  logo = new Logo({ radius: R(152), y: Y(288) })
  name = new Text({ content: "Project Liminality", font: SERIF, size: 170, tint: WHITE, y: Y(560) })
  endCard = this.layer(this.logo, this.name)

  constructor() {
    super()
    tunnelChain(this.chainGroup)
  }

  protected beats(): void {
    // A
    this.shot(this.pan, 2455, 2471.5, 1.8, 1)
    this.clock(this.s1.spin, 2455, 2467, 0.35, 0.05)
    this.at(2458.6, 1.2, this.s1.y.to(Y(220)))
    this.at(2458.4, 0.8, Create(this.endArrow))
    this.at(2458.6, 1, Create(this.endLabel))
    this.at(2464.6, 2.4, this.pan.y.to(R(720)))
    this.at(2465.4, 2.2, Create(this.vault))
    // B
    this.shot(this.brains, 2471, 2476.6, 0.8, 1)
    this.at(2470.9, 0.01, this.ibNode.scale.sequence(0, 0))
    this.at(2472.6, 0.8, this.fade(this.notes, 0), this.ibNode.scale.to(1))
    this.shot(this.shift, 2476.4, 2485.4, 1.2, 1)
    this.clock(this.stars.time, 2476.4, 2485.4, 0, 0.3)
    this.clock(this.bigSphere.spin, 2476.4, 2485.4, 0.35, 0.05)
    this.at(2479, 1.5, this.bigSphere.radius.to(R(220)))
    this.at(2483, 2, this.bigSphere.radius.to(R(68)), this.bigSphere.y.to(Y(208)), this.stars.opacity.to(0))
    // C
    this.shot(this.ladder, 2484.6, 2502, 1.2, 1)
    this.at(2486, 5, this.spheres.arrows.to(1))
    this.at(2491.5, 8, this.spheres.healed.to(1))
    // D
    this.shot(this.applications, 2502, 2524, 1.4, 1.2)
    this.at(2501.9, 0.01, this.s2.y.sequence(Y(70), Y(70)), this.s2.radius.sequence(R(30), R(30)))
    this.at(2502.4, 1.8, this.s2.y.to(Y(364)), this.s2.radius.to(R(164)))
    this.clock(this.s2.spin, 2502, 2524, 0.35, 0.05)
    this.at(2504, 1, Create(this.appEnd))
    for (const a of this.apps) this.at(a.t, 0.9, Create(a.text))
    // E
    this.shot(this.warShot, 2522.6, 2530.2, 1, 0.8)
    this.at(2524.6, 4, this.war.scale.to(2.2), this.war.y.to(-487))
    this.shot(this.eyeShot, 2529.4, 2536.2, 0.8, 1.2)
    this.clock(this.swarm.time, 2529.4, 2536.2, 0, 1)
    this.at(2532.5, 3, this.swarm.dissolve.to(1))
    this.shot(this.liminalShot, 2537, 2547.4, 1, 1.8)
    this.at(2538.6, 1.5, Create(this.eyeBurst))
    this.clock(this.eyeBurst.time, 2537, 2548.6, 0, 1)
    // F
    this.shot(this.mediumShot, 2545.4, 2563, 1.8, 0.8)
    this.clock(this.dust.time, 2546.6, 2563, 0, 1)
    this.at(2551.5, 2, this.dust.dissolve.to(1))
    this.at(2552, 4, this.medium.flat.to(0), this.medium.radius.to(R(250)))
    this.at(2553.5, 2.5, this.medium.interbrain.to(1))
    this.clock(this.medium.spin, 2552, 2563, 0.35, 0.05)
    this.shot(this.warShot, 2563.2, 2570, 1.5, 0.6)
    this.at(2563.1, 0.01, this.war.scale.to(1), this.war.y.to(Y(362)))
    this.at(2566, 3.4, this.war.scale.to(2.2), this.war.y.to(-487))
    // G
    this.shot(this.changeShot, 2569.6, 2593.6, 0.8, 1.4)
    this.clock(this.s3.spin, 2569.6, 2593.6, 0.35, 0.05)
    this.at(2577, 2, Create(this.fieldBurst))
    this.clock(this.fieldBurst.time, 2577, 2593.6, 0, 1)
    this.at(2578, 3, Create(this.flowerField))
    this.at(2590.6, 1.5, this.fade(this.s3, 0))
    this.shot(this.eye2Shot, 2591, 2601.4, 1.5, 1.4)
    this.clock(this.eye2Burst.time, 2591, 2601.4, 0, 1)
    // H
    this.shot(this.loveShot, 2599.4, 2623.6, 1.4, 1.6)
    this.at(2599.3, 0.01, this.agent.scale.sequence(2.2, 2.2), this.agent.y.sequence(-460, -460))
    this.at(2599.6, 3, this.agent.scale.to(1), this.agent.y.to(Y(348)))
    this.at(2608, 10, this.agent.love.to(1))
    this.at(2618, 3, this.agent.y.to(Y(360)))
    // I
    this.shot(this.tunnel, 2622.6, 2640.4, 1.4, 1)
    this.clock(this.warp.time, 2622.6, 2640.4, 0, 1)
    this.at(2622.6, 17.8, this.chainGroup.z.sequence(150, 900), this.chainGroup.x.sequence(250, -150))
    this.shot(this.denseShot, 2639.6, 2651, 0.8, 1.6)
    this.clock(this.dense.spin, 2639.6, 2651, 0.35, 0.06)
    this.at(2642.2, 2.6, this.dense.radius.to(R(280)), this.dense.y.to(Y(360)))
    this.at(2645, 4, this.dense.radius.to(R(230)))
    this.shot(this.earthShot, 2650.6, 2662, 1.6, 1.6)
    this.clock(this.earth.spin, 2650.6, 2662, 0, 0.05)
    // J: the footage is a black placeholder; its picture-in-picture circle.
    this.shot(this.pip, 2711.5, 2736.6, 0.6, 0.6)
    this.at(2715, 20, this.web.focus.to(3))
    // K
    this.shot(this.endCard, 2819.8, 2832.6, 0.2, 2.6)
    this.at(2820, 3, Create(this.logo))
    this.at(2823.2, 1.8, Create(this.name))
    void together
    void UnCreate
  }
}

if (import.meta.main) render(Ch8NewBeginningDream)
