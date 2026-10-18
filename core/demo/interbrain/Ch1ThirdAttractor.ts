/**
 * Ch1ThirdAttractor.ts — the InterBrain film, chapter 1: "In Search of the
 * Third Attractor" (video 0–333 s; docs/reports/interbrain-vocabulary.md §2).
 *
 * Every beat is stated at the VIDEO second it was measured on (frames5 at
 * 5 fps, f_N at (N−1)/5, and the transcript's word times); score.ts turns
 * that into the chapter's local time. The scene only lays out and times —
 * every symbol is a vocabulary holon:
 *
 *    0–11    the domesticated eye opens from a slit, its red swarm      MolochEye, Field(swarm)
 *   12–17.5  title card                                                  film.ts
 *   18–26    the eye again; we fall through its iris                     MolochEye
 *   26–35    the fragmented Earth; we fall onto Africa                   FragmentedEarth
 *   35–58    two tribes, each in its narrative box, each with its value; the bolt between
 *                                                                        Figure busts on a disc in a FoldableCube, Conflict
 *   58–115   freedom ⚡ order; the attacks; Chaos, Oppression; the red field   Dialectic, Field
 *  116–127   freedom × eye = Chaos, order × eye = Oppression              Attractor, MolochEye, Text
 *  128–167   the endless oscillation in the red field                     Dialectic, Field
 *  169–188   the arms race on an exponential curve                        Plot, Icons
 *  188–198   the equations, exp(…)                                        (as 116)
 *  200–259   the faster oscillation; two timelines collapse; the middle path   Dialectic, Attractor, Field
 *  260–310   the third axis: the cylinder and the liminal eye; the ball rises  Dialectic
 *  310–330   the field turns from red to cyan around the cylinder        Field, Dialectic
 *
 * Camera: the two falls (through the iris, onto Africa) scale the symbol
 * rather than dolly the observer, because each is followed at once by a
 * flat tableau at the default framing (a dolly would have to cut back).
 */

import { render } from "../../src/index"
import { Create, FadeIn } from "../../src/verbs"
import { eased, together } from "../../src/anim"
import { Circle, Ellipse, Rectangle } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { BLUE, PI, RED, WHITE, rgb } from "../../src/constants"
import { glow } from "../../src/glow"
import { Layer, Figure } from "../../vocabulary/Figure/Figure"
import { MolochEye } from "../../vocabulary/MolochEye/MolochEye"
import { Field } from "../../vocabulary/Field/Field"
import { FragmentedEarth } from "../../vocabulary/FragmentedEarth/FragmentedEarth"
import { FoldableCube } from "../../vocabulary/FoldableCube/FoldableCube"
import { Conflict } from "../../vocabulary/Conflict/Conflict"
import { Dialectic } from "../../vocabulary/Attractor/Dialectic"
import { Attractor } from "../../vocabulary/Attractor/Attractor"
import { Plot } from "../../vocabulary/Plot/Plot"
import { icon, type IconName } from "../../vocabulary/Icons/Icons"
import { SERIF, SERIF_ITALIC } from "./film"
import { ChapterDream, PX, px } from "./score"

/** A layer that glows (src/glow.ts) — the values' golden light. */
class Glowing extends Layer {
  glow = glow(1)
}

/** A value: the warm dot in its golden glow (Dialectic's ball, f251). */
export const value = (x: number, y: number, r = 7.6): Glowing =>
  new Glowing({ x: px(x), y: px(y), members: [new Circle({ radius: px(r), tint: rgb(255, 246, 220), fillOpacity: 1, stroke: 0 })] })

/**
 * A tribe in its narrative box (f251): a crowd of busts standing on a blue
 * disc inside the blue cube, seen through its open side. `w` is the box's
 * front, px.
 */
export const boxedTribe = (x: number, w = 375): Layer => {
  const edge = px(w) * 0.8
  const crowd: Figure[] = []
  // Three rows of busts on the disc (f251: 7 · 8 · 6, the front row lowest).
  const rows = [[7, 0.115, -0.02], [8, 0.045, 0.0], [6, -0.03, 0.02]] as const
  for (const [n, dy, dx] of rows) {
    for (let i = 0; i < n; i++) {
      const u = (i - (n - 1) / 2) / 3.6
      crowd.push(new Figure({ height: px(w) * 0.14, form: 1, opaque: 1, tint: rgb(200, 200, 200), stroke: 1.2, x: px(w) * (u * 0.33 + dx), y: px(w) * (dy - 0.14) }))
    }
  }
  const disc = new Ellipse({ radiusX: px(w) * 0.4, radiusY: px(w) * 0.08, y: -px(w) * 0.17, tint: BLUE, stroke: 2.4 })
  const cube = new FoldableCube({ size: edge, fold: 1, p: PI / 2, z: -edge, tint: BLUE, stroke: 4.5 })
  return new Layer({ x: px(x), members: [cube, disc, ...crowd] })
}

/** Text in the film's serif, centred at (x, y) px. */
const label = (content: string, x: number, y: number, size: number, tint = WHITE, italic = false): Text =>
  new Text({ content, font: italic ? SERIF_ITALIC : SERIF, size: px(size), tint, x: px(x), y: px(y) })

/** The arms race's weapons (f931): icon, where on the curve (x), size px. */
export const ARMS_RACE: readonly [IconName, number, number][] = [
  ["pistol", 0.07, 64],
  ["tank", 0.2, 76],
  ["radioTower", 0.36, 52],
  ["bomb", 0.56, 60],
  ["satellite", 0.74, 76],
  ["laptop", 0.9, 72],
]

/**
 * The arms race (f931, again f1801): technology amplifying conflict on an
 * exponential curve "about to go vertical" (3:06), its weapons riding it.
 * Box measured on f931: x −400…438, y −242…184 px.
 */
export const armsRacePlot = (): { plot: Plot; icons: ReturnType<typeof icon>[] } => {
  const k = 4.5
  const plot = new Plot({
    fn: (x: number) => (Math.exp(k * x) - 1) / (Math.exp(k * 0.91) - 1),
    domain: [0, 1],
    range: [0, 1],
    width: px(838),
    height: px(426),
    x: px(19),
    y: px(-29),
    curveTint: BLUE,
    axisTint: rgb(150, 150, 160),
    stroke: 2.4,
  })
  const icons = ARMS_RACE.map(([name, u, s]) => {
    const p = plot.at(u, plot.fn(u))
    return icon(name, { size: px(s), tint: BLUE, x: p.x + plot.x.value - px(6), y: p.y + plot.y.value + px(s * 0.62) })
  })
  return { plot, icons }
}

export class Ch1ThirdAttractorDream extends ChapterDream {
  protected readonly chapterIndex = 0

  protected beats(): void {
    this.opening()
    this.tribes()
    this.dialectic()
    this.equations()
    this.oscillation()
    this.armsRace()
    this.timelines()
    this.thirdAxis()
  }

  // ---------------------------------------------------------------------
  /** 0–35: the domesticated eye, its swarm, the fall through the iris onto the fragmented Earth. */
  private opening(): void {
    // f101: lens half-height 104 px.
    const eye = new MolochEye({ height: px(104), stroke: 3, p: 1.5 })
    const swarm = new Field({ mode: "swarm", radius: px(150), reach: px(70), stroke: 1.6, sharp: 0.6 })
    const first = this.tableau(eye, swarm)
    this.setAt(0, first.presence.to(1))
    // The pupil cube is first (f8 at 1.4 s), the lids by 2.2 s; the slit opens to 5.0 s.
    this.at(1.2, 1.2, Create(eye))
    this.at(1.8, 3.2, eye.p.to(0, { easing: "easeOut" }))
    this.at(5.2, 1.5, Create(swarm))
    this.clock(swarm.time, 5.2, 10.5, 0, 1)
    this.at(8.2, 1.8, swarm.dissolve.to(1))
    this.at(10.1, 0.8, first.presence.to(0))

    // 18.2: the eye returns; 22.8–25.6 we fall through its iris (f116 → f131).
    const eye2 = new MolochEye({ height: px(104), stroke: 3 })
    const second = this.tableau(eye2)
    this.show(second, 18.2, 26, 0.8, 0.6)
    this.setAt(18.2, Create(eye2))
    this.at(22.8, 1.6, eased("easeIn", eye2.scale.to(3.4)))
    this.at(24.4, 1.2, eased("linear", eye2.scale.to(14)))

    // 26–31: the fragmented Earth arrives from the black (f141 ring 126 px, f156 198 px).
    const world = new FragmentedEarth({ radius: px(198), globe: 0.59, limb: 1, boltLength: 0.155, boltTint: rgb(140, 140, 140), spin: 0.35, scale: 0.15, x: px(1e5) })
    const earth = this.tableau(world)
    this.show(earth, 25.8, 37.2, 0.8, 1.6)
    // The globe's land and sea are solids that ignore a layer's presence, so
    // the world stands far off-frame whenever it is not in the shot.
    this.setAt(25.8, world.x.to(0))
    this.at(25.8, 5.2, eased("easeOut", world.scale.to(1)))
    // 32–35.6: onto Africa — the band falls away past the frame, the globe fills it, then dims.
    this.at(32, 3.6, eased("easeIn", world.scale.to(4.2)))
    this.setAt(37.3, world.x.to(px(1e5)))
  }

  // ---------------------------------------------------------------------
  /** 35–58: the competing tribes, each protecting a value (f251). */
  private tribes(): void {
    const left = boxedTribe(-301)
    const right = boxedTribe(300)
    const valueL = value(-300, 55)
    const valueR = value(300, 17)
    const bolt = new Conflict({ size: px(40) })
    const boxes = this.tableau(left, right)
    const values = this.tableau(valueL, valueR, bolt)
    this.show(boxes, 35.4, 58, 1.6, 2.2)
    this.setAt(35.4, values.presence.to(1))
    // "each tribe is seeking to protect a set of values" (47.5): the lights come up.
    this.at(47.6, 0.8, FadeIn(valueL))
    this.at(49.4, 0.8, FadeIn(valueR))
    // "against other tribes they perceive as threatening" (51.4): the bolt.
    this.at(53.6, 0.5, Create(bolt))
    // 56–58: the values gather to the dialectic's poles, the bolt grows to it (f291 → f296).
    this.at(56, 2, valueL.x.to(px(-295)), valueL.y.to(0), valueR.x.to(px(295)), valueR.y.to(0), bolt.size.to(px(163)))
    this.at(59, 0.8, values.presence.to(0))
  }

  // ---------------------------------------------------------------------
  /** 58–115: freedom ⚡ order (f346), the attacks (f391–f456), Chaos and Oppression (f496–f541), the red field. */
  private dialectic(): void {
    const d = new Dialectic({ size: px(84.5) })
    const field = new Field({ opacity: 0 })
    const scene = this.tableau(field, d)
    this.setAt(58.8, scene.presence.to(1))
    this.at(58.8, 2, Create(d))
    this.at(58.8, 0.4, d.conflict.to(1))
    // "freedom becomes an attack on order, while order becomes an attack on freedom" (73.7–90).
    this.at(75.4, 1.2, d.armed.to(1), d.attack.to(1))
    this.at(81, 1, d.attack.to(-1))
    this.at(85, 1, d.attack.to(1))
    this.at(89, 1, d.attack.to(-1))
    this.at(91.4, 1.6, d.armed.to(0), d.attack.to(0))
    // "Both sides are right" — first Chaos alone (96), back; then Oppression (103); then both (107).
    this.at(95.6, 1.4, d.chaos.to(1), d.attack.to(1))
    this.at(99.8, 1.6, d.chaos.to(0))
    this.at(102.8, 1.4, d.oppression.to(1))
    this.at(106.6, 1.4, d.chaos.to(1), d.conflict.to(0))
    // 109.5–115: the red field of fragmentation (f556).
    this.at(109.2, 1, field.opacity.to(0.55))
    this.clock(field.time, 109.2, 116, 0, 1)
    this.at(114.6, 1.2, scene.presence.to(0))
  }

  // ---------------------------------------------------------------------
  /**
   * The equations (f601, f976): freedom × [the domesticated eye] = Chaos;
   * order × [eye] = Oppression — once at 116–127, again at 188–198 with
   * exp(…) round the product and the pathologies grown.
   */
  private equations(): void {
    /** One equation set at a layout (x of each term, px; the pole's R). */
    const build = (L: { word: number; times: number; eye: number; equals: number; pole: number; R: number; em: number; exp?: [number, number] }) =>
      [
        { y: 104, word: "freedom", tint: RED, kind: "chaos" as const },
        { y: -192, word: "order", tint: BLUE, kind: "oppression" as const },
      ].map((r) => {
        const word = label(r.word, L.word, r.y - 14, L.em, r.tint, true)
        const times = label("×", L.times, r.y - 14, L.em)
        const eye = new MolochEye({ height: px(40), stroke: 2.4, x: px(L.eye), y: px(r.y) })
        const equals = label("=", L.equals, r.y - 14, L.em)
        const pole = new Attractor({ kind: r.kind, pathology: 1, size: px(L.R), x: px(L.pole), y: px(r.y), stroke: 2.2 })
        const exp = L.exp ? [label("exp(", L.exp[0], r.y - 14, L.em, WHITE, true), label(")", L.exp[1], r.y - 14, L.em, WHITE, true)] : []
        return { word, product: new Layer({ members: [times, eye, equals, ...exp] }), pole }
      })
    // 116–127 (1:57.7 "Freedom times fragmentation equals chaos"), f601.
    const first = build({ word: -250, times: -144, eye: -32, equals: 90, pole: 218, R: 40, em: 50 })
    const one = this.tableau(...first.flatMap((p) => [p.word, p.product, p.pole]))
    this.show(one, 115.8, 127, 1, 1)
    this.at(117.8, 1.2, first[0]!.product.presence.sequence(0, 1))
    this.at(121.4, 1.2, first[1]!.product.presence.sequence(0, 1))
    // 188–198 (f976): again, then exp( … ) — "happening on an exponential curve" — and the pathologies grow.
    const again = build({ word: -215, times: -118, eye: 0, equals: 140, pole: 300, R: 40, em: 40, exp: [-322, 98] })
    const two = this.tableau(...again.flatMap((p) => [p.word, p.product, p.pole]))
    this.show(two, 188, 197.6, 1.4, 1)
    this.setAt(188, ...again.map((p) => p.product.presence.to(1)))
    this.at(193, 1.4, ...again.map((p) => p.pole.scale.to(83 / 40)))
  }

  // ---------------------------------------------------------------------
  /** 128–167: the endless oscillation between the two attractors in the red field (f660–f781). */
  private oscillation(): void {
    const d = new Dialectic({ size: px(56), span: 4.9, chaos: 1, oppression: 1 })
    const field = new Field({ opacity: 0.45 })
    const scene = this.tableau(field, d)
    this.show(scene, 126.6, 167.4, 1.4, 2)
    this.setAt(126.6, Create(d))
    this.clock(field.time, 126.6, 167.4, 0, 1)
    // 2:09.9 "The closer we come to chaos…": the ball and its pulls.
    this.at(129.6, 1.2, d.swing.to(1))
    this.clock(d.phase, 129.6, 167.4, 0, 1.25)
    // 142: the poles bare; 146–148.5: the plane tilts back and the ball writes its sine.
    this.at(141.4, 1.2, d.chaos.to(0), d.oppression.to(0), d.labels.to(0))
    this.at(145.6, 2.6, d.trace.to(1), d.p.to(-0.8))
  }

  // ---------------------------------------------------------------------
  /** 169–188: the arms race on an exponential curve, its weapons climbing it (f931). */
  private armsRace(): void {
    const race = armsRacePlot()
    const scene = this.tableau(race.plot, ...race.icons)
    this.show(scene, 169, 189.4, 0.6, 1.6)
    this.at(169, 1.6, Create(race.plot))
    // The curve climbs 176.2–186.2; each weapon is drawn as the curve reaches it.
    this.at(176.2, 10, eased("linear", race.plot.reveal.to(1)))
    race.icons.forEach((ic, i) => this.at(176.2 + 10 * ARMS_RACE[i]![1] - 0.2, 0.8, Create(ic)))
  }

  // ---------------------------------------------------------------------
  /** 200–259: the faster oscillation, the two timelines collapsing, the dim middle path (f1036, f1171). */
  private timelines(): void {
    const d = new Dialectic({ size: px(56), span: 4.9, labels: 0, swing: 1, trace: 1, p: -0.8 })
    const twin = new Dialectic({ size: px(56), span: 4.9, labels: 0, swing: 1, trace: 1, p: -0.8, x: px(320), scale: 0.5 })
    const field = new Field({ opacity: 0.45 })
    const scene = this.tableau(field, d)
    const twinScene = this.tableau(twin)
    this.show(scene, 199.2, 214.6, 1, 1)
    this.setAt(199.2, Create(d), Create(twin))
    this.clock(field.time, 199.2, 260, 0, 1)
    this.clock(d.phase, 199.2, 214.6, 0, 2.2)
    this.clock(twin.phase, 208.6, 217, 1.3, 2.6)
    // 3:26.4 "a depressing decision between two highly undesirable timelines": split.
    this.at(208.6, 1.4, d.scale.to(0.5), d.x.to(px(-320)))
    this.show(twinScene, 208.6, 216.6, 1.2, 1)
    // 214 the left collapses into Chaos, 216 the right into Oppression (f1066–f1081).
    const chaos = new Attractor({ kind: "chaos", pathology: 1, size: px(45), x: px(-320), stroke: 2.2 })
    const oppression = new Attractor({ kind: "oppression", pathology: 1, size: px(45), x: px(320), stroke: 2.2 })
    const poles = this.tableau(chaos, oppression)
    this.setAt(213.2, poles.presence.to(1))
    this.at(213.2, 1.2, chaos.presence.sequence(0, 1))
    this.at(215.4, 1.2, oppression.presence.sequence(0, 1))
    this.at(258.4, 1.2, poles.presence.to(0))
    // The field returns (221), the middle path between them (226–249).
    const field2 = new Field({ opacity: 0.45, seed: 7 })
    const fieldScene = this.tableau(field2)
    this.show(fieldScene, 220.6, 259.6, 1.4, 1.2)
    this.clock(field2.time, 220.6, 259.6, 0, 1)
    const middle = new Rectangle({ width: px(56), height: px(56), rounding: 0.35, tint: rgb(120, 46, 96), stroke: 2, fillOpacity: 0 })
    const mid = this.tableau(middle)
    this.show(mid, 225.4, 249.4, 1.2, 1.2)
  }

  // ---------------------------------------------------------------------
  /** 260–330: the third axis (f1306 → f1530) and the turn to wholeness (f1561 → f1621). */
  private thirdAxis(): void {
    const d = new Dialectic({ size: px(55), span: 5.05, labels: 0 })
    const field = new Field({ opacity: 0 })
    const scene = this.tableau(field, d)
    this.show(scene, 259.6, 329.4, 0.8, 2)
    this.setAt(259.6, Create(d), d.gaze.to(1))
    // 4:12 "we need to widen our perspective": the ball on the line, its pulls (262–272).
    this.at(261.6, 1, d.swing.to(1))
    this.clock(d.phase, 261.6, 271.6, 0, 0.6)
    this.at(271.6, 1, d.phase.to(2 * PI))
    // 4:29.4 "an orthogonal degree of freedom": the eye of wholeness above, the cylinder, the cross.
    this.at(273.2, 2.4, d.y.to(px(-186)), d.third.to(0.3))
    // 4:55.9 "moving collectively towards the third attractor": the arrow, the ball rises.
    this.at(297.6, 2.2, d.third.to(0.5))
    this.at(300.6, 6, d.third.to(1))
    // 5:09 the field returns, the diagram recedes; 316–320 red → white → cyan.
    this.at(309.2, 2, field.opacity.to(0.6))
    this.clock(field.time, 309.2, 329.4, 0, 1)
    this.at(309.6, 4, d.size.to(px(14)), d.y.to(px(-40)), d.p.to(-0.9))
    this.at(315.6, 2.4, field.wholeness.to(0.5))
    this.at(318, 2.4, eased("linear", field.wholeness.to(1)))
    this.at(317, 5, d.size.to(px(26)), d.y.to(px(-160)), d.p.to(-0.3))
  }
}

if (import.meta.main) render(Ch1ThirdAttractorDream)
