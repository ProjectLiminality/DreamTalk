/**
 * Ch2ArmsRace.ts — the InterBrain film, chapter 2: "The Ancient Arms Race"
 * (video 333–638 s; docs/reports/interbrain-vocabulary.md §2).
 *
 * Beats at VIDEO seconds (frames5, transcript word times; score.ts makes
 * them local). Only layout and timing here — every symbol is a holon:
 *
 *  336–342.5  title card                                               film.ts
 *  342–353    recap: the oscillation in the red field                  Dialectic, Field
 *  354–371    the arms race curve again                                Plot, Icons (Ch1's builder)
 *  370–402    war as engineering: the asymmetry in agency               Mind, Conflict, Icons
 *  402–447    the three realms: Engineering → structures → spheres     FragmentedEarth, Spheres
 *  447–455    an integrated whole (the S-arc)                          Divide, Spheres
 *  455–476    the noosphere as the lens                                Spheres (noosphere.lens)
 *  476–518    order of influence, ladder of leverage, the War Machine climbs   Spheres, HyperAgent(icon)
 *  518–536    the asymmetry again → divide and conquer                  Mind, Conflict, HyperAgent
 *  536–585    generations of warfare: breadth × depth, narrative warfare   Icons, FragmentedEarth, Noosphere
 *  585–612    the nuke vs the psy-war                                  FragmentedEarth, Noosphere, Icons, the cycle
 *  612–635    the vicious cycle, turning                                Mind, Conflict, FoldableCube, field lines
 */

import { render } from "../../src/index"
import { Create } from "../../src/verbs"
import { eased } from "../../src/anim"
import { Circle, Group, Line, Rectangle } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { BLUE, PI, RED, WHITE, rgb, type Color } from "../../src/constants"
import { Layer } from "../../vocabulary/Figure/Figure"
import { Field } from "../../vocabulary/Field/Field"
import { Dialectic } from "../../vocabulary/Attractor/Dialectic"
import { Mind } from "../../vocabulary/Mind/Mind"
import { Conflict } from "../../vocabulary/Conflict/Conflict"
import { FragmentedEarth, fieldLine } from "../../vocabulary/FragmentedEarth/FragmentedEarth"
import { Spheres } from "../../vocabulary/Spheres/Spheres"
import { Divide, FILM_TURN } from "../../vocabulary/Divide/Divide"
import { HyperAgent } from "../../vocabulary/HyperAgent/HyperAgent"
import { Noosphere } from "../../vocabulary/Noosphere/Noosphere"
import { FoldableCube } from "../../vocabulary/FoldableCube/FoldableCube"
import { icon, type IconName } from "../../vocabulary/Icons/Icons"
import { SERIF } from "./film"
import { ChapterDream, px } from "./score"
import { armsRacePlot, ARMS_RACE } from "./Ch1ThirdAttractor"

const RED_LINE: Color = rgb(220, 70, 70)

/** Text in the film's serif at (x, y) px, em `size` px. */
const label = (content: string, x: number, y: number, size: number, tint: Color = WHITE): Text =>
  new Text({ content, font: SERIF, size: px(size), tint, x: px(x), y: px(y), lineHeight: 1.15 })

/** A white arrow → from (x0, y) to (x1, y), px. */
const arrow = (x0: number, x1: number, y: number, stroke = 4): Line =>
  new Line({ points: [{ x: px(x0), y: px(y), z: 0 }, { x: px(x1), y: px(y), z: 0 }], arrowEnd: true, tint: WHITE, stroke })

/**
 * The vicious cycle (f3091, f3106): two domesticated minds ⚡ on a ring, two
 * narrative boxes on it between them, the ring's arrows turning, red field
 * lines spiralling out — "weaponising the noosphere burns the collective
 * sanity". A composition of Mind, Conflict and the boxed narrative (a white
 * FoldableCube in a blue ring, as Tribe boxes its heads); the spiral is
 * FragmentedEarth's field-line. Sizes are f3106's px, scaled by `k`.
 */
export const viciousCycle = (k = 1): { whole: Layer; spiral: Group } => {
  const u = (v: number) => px(v * k)
  const R = 98
  const minds = [-143, 143].map((x) => new Mind({ size: u(R), x: u(x), y: u(-28), stroke: 2.4 * Math.max(k, 0.6) }))
  const bolt = new Conflict({ size: u(70), y: u(0) })
  const boxes = [160, -183].map((y) => {
    const edge = u(40)
    return new Group({
      y: u(y),
      members: [
        new Circle({ radius: u(35), tint: BLUE, stroke: 3.2 * Math.max(k, 0.6) }),
        new FoldableCube({ size: edge, fold: 1, p: PI / 2, z: -edge, tint: WHITE, stroke: 2.2 * Math.max(k, 0.6) }),
      ],
    })
  })
  // The ring's two arrows, over the top leftward and under the bottom rightward.
  const ring = (a0: number, a1: number): Line => {
    const pts = []
    for (let i = 0; i <= 32; i++) {
      const a = a0 + ((a1 - a0) * i) / 32
      pts.push({ x: u(172 * Math.cos(a)), y: u(-12 + 172 * Math.sin(a)), z: 0 })
    }
    return new Line({ points: pts, arrowEnd: true, tint: WHITE, stroke: 2.4 * Math.max(k, 0.6) })
  }
  const arrows = [ring(0.62, PI - 0.62), ring(PI + 0.62, 2 * PI - 0.62)]
  const spiral = new Group({
    members: Array.from({ length: 8 }, (_, i) => new Line({ points: fieldLine((i * 2 * PI) / 8, u(150), u(330), 1.1), tint: RED_LINE, stroke: 2.2 * Math.max(k, 0.6), opacity: 0.85 })),
  })
  return { whole: new Layer({ members: [spiral, ...arrows, ...boxes, ...minds, bolt] }), spiral }
}

export class Ch2ArmsRaceDream extends ChapterDream {
  protected readonly chapterIndex = 1

  protected beats(): void {
    this.recap()
    this.armsRace()
    this.asymmetry()
    this.realms()
    this.ladder()
    this.divideAndConquer()
    this.generations()
    this.psyWar()
    this.cycle()
  }

  /** 342–354: "we have said, the story of fragmentation is a story of warfare" — the oscillation (f1741). */
  private recap(): void {
    const d = new Dialectic({ size: px(56), span: 4.9, labels: 0, swing: 1, trace: 1, p: -0.8 })
    const field = new Field({ opacity: 0.45, seed: 3 })
    const scene = this.tableau(field, d)
    this.show(scene, 342, 354, 1.8, 1.4)
    this.setAt(342, Create(d))
    this.clock(field.time, 342, 354, 0, 1)
    this.clock(d.phase, 342, 354, 0.4, 1.5)
  }

  /** 354–371: the arms race (f1801). */
  private armsRace(): void {
    const race = armsRacePlot()
    const scene = this.tableau(race.plot, ...race.icons)
    this.show(scene, 353.4, 371, 0.6, 1.4)
    this.at(353.4, 1.2, Create(race.plot))
    this.at(355.2, 7, eased("linear", race.plot.reveal.to(1)))
    race.icons.forEach((ic, i) => this.at(355.2 + 7 * ARMS_RACE[i]![1] - 0.2, 0.7, Create(ic)))
  }

  // -------------------------------------------------------------------
  /** The two minds and the bolt, with the weapons that swell the one (f1861, f1966, f2611). */
  private minds = (() => {
    const left = new Mind({ size: px(128), x: px(-200), y: px(-31) })
    const right = new Mind({ size: px(128), x: px(200), y: px(-31) })
    const bolt = new Conflict({ size: px(100) })
    const weapons: [IconName, number, number, number][] = [
      ["tank", -420, 72, 80],
      ["satellite", -96, 80, 64],
      ["pistol", -252, -180, 76],
    ]
    const arms = new Layer({ members: weapons.map(([n, x, y, s]) => icon(n, { size: px(s), tint: BLUE, x: px(x), y: px(y) })) })
    return { left, right, bolt, arms, scene: new Layer({ members: [left, right, bolt, arms] }) }
  })()

  /** 370–402: "warfare itself can be viewed as an engineering problem … maximize the asymmetry in agency" (6:01–6:17). */
  private asymmetry(): void {
    const m = this.minds
    this.show(m.scene, 369.6, 401.6, 1.4, 1)
    this.setAt(369.6, m.arms.presence.to(0))
    // 6:12 "maximize the asymmetry in agency": one grows, the other shrinks; the bolt turns on the weak.
    this.at(379.2, 1.4, m.left.x.to(px(-240)), m.right.scale.to(70 / 128), m.right.x.to(px(232)), m.right.y.to(px(-24)), m.bolt.direction.to(0), m.bolt.size.to(px(140)), m.bolt.x.to(px(20)))
    // 6:24 "Technology acting as leverage amplifies": the weapons gather round the strong.
    this.at(385, 1.2, m.arms.presence.to(1))
    this.at(390.6, 1.6, m.left.scale.to(195 / 128), m.left.x.to(px(-272)), m.left.y.to(px(-32)), m.bolt.size.to(px(200)))
  }

  // -------------------------------------------------------------------
  /** 402–476: the three realms of engineering (f2056 → f2236), the S of the whole (f2251), the lens (f2311). */
  private spheres = new Spheres({ labels: 0, icons: 0, arrows: 0, x: px(1e5) })

  private realms(): void {
    // 402: the Earth alone, "Engineering" beneath it (f2016).
    const earth = new FragmentedEarth({ radius: px(125 / 0.62), globe: 0.62, decoration: 0, limb: 1, x: px(1e5) })
    const engineering = label("Engineering", 0, -221, 13)
    const first = this.tableau(earth, engineering)
    this.show(first, 401.6, 409.6, 1.6, 1.2)
    this.setAt(401.6, earth.x.to(0))
    this.at(405.2, 1, engineering.opacity.sequence(0, 1))
    // The globe is a solid that ignores presence: off-frame when not in shot.
    this.setAt(409.7, earth.x.to(px(1e5)))

    const s = this.spheres
    const row = this.tableau(s)
    this.show(row, 408.2, 518.4, 1.6, 0.8)
    // Its globe is a solid that ignores presence: off-frame outside its shot.
    this.setAt(408.2, s.x.to(0))
    this.setAt(518.5, s.x.to(px(1e5)))
    // 6:44 "Physical … social … narrative engineering" (412–418): the first naming.
    this.at(411.4, 1.4, s.labels.to(1))
    // 7:00 "infrastructure … social structure … superstructure" (422–430), the icon rows in turn.
    this.at(421, 10, eased("linear", s.labels.to(2), s.icons.to(1)))
    // 7:18 "biosphere, social sphere and noosphere" (440–444).
    this.at(439.2, 1.2, s.icons.to(0), s.labels.to(2.2))
    this.at(440.8, 3, s.labels.to(3))
    // 7:23.8 "Together, they form an integrated whole" (448–454): the realms on the S.
    const divide = new Divide({ radius: px(190), turn: FILM_TURN, stroke: 2.4 })
    const whole = this.tableau(divide)
    this.show(whole, 447.2, 454.8, 1, 1)
    this.at(446.6, 1.6, s.labels.to(0), s.scale.to(0.38), s.b.to(PI / 4))
    this.at(454, 1.6, s.scale.to(1), s.b.to(0))
    // 7:30 "The noosphere … is like the lens through which we collectively perceive" (455–475).
    void s.parts // composed, so its noosphere can be reached
    this.at(456, 1.6, s.noosphere.lens.to(1))
    this.at(466, 2, s.noosphere.lens.to(0))
  }

  /** 476–518: the order of influence, the ladder of leverage, and the War Machine climbing it (f2416–f2596). */
  private ladder(): void {
    const s = this.spheres
    this.at(475.6, 1.6, s.stack.to(1))
    // 7:53.8 "a clear order of influence" (478) — 8:02.3 "a ladder of leverage" (486).
    this.at(477.6, 2.4, s.arrows.to(0.5))
    this.at(485.6, 2.4, s.arrows.to(1))
    // 8:20.4 "the war machine inevitably will move up the ladder of leverage" (496).
    const machine = new HyperAgent({ size: px(240), depth: 0, power: 0, x: px(-400), y: px(-31) })
    const name = label("War Machine", -400, -168, 18)
    const named = new Layer({ members: [name] })
    const wm = this.tableau(machine, named)
    this.show(wm, 495.4, 518.4, 1.4, 0.8)
    // 503–505: it shrinks to the ladder's foot, its name gone.
    this.at(502.6, 1.6, machine.scale.to(64 / 240), machine.x.to(px(-238)), machine.y.to(px(-288)), named.presence.to(0))
    // "Starting with mere physical engineering, moving towards social engineering and finally … narrative engineering" (8:26–8:32).
    const physical = label("Physical Engineering", 330, -290, 24, BLUE)
    const social = label("Social Engineering", 330, -112, 24)
    const narrative = label("Narrative Engineering", 330, 172, 24, RED)
    const words = this.tableau(physical, social, narrative)
    this.setAt(508.6, words.presence.to(1))
    this.at(508.6, 1, physical.opacity.sequence(0, 1))
    this.at(508.2, 1.4, machine.y.to(px(-200)))
    this.at(510.2, 1.4, social.opacity.sequence(0, 1), machine.y.to(px(-40)))
    this.at(512.4, 1.4, narrative.opacity.sequence(0, 1), machine.y.to(px(120)))
    this.at(509.6, 5, s.fragmented.to(1))
    this.at(517.2, 1.2, words.presence.to(0))
  }

  /** 518–536: the asymmetry once more, then "the divided and conquered" — the divide-and-conquer unit (f2641, f2671). */
  private divideAndConquer(): void {
    const m = this.minds
    this.show(m.scene, 518.6, 527.6, 1, 0.8)
    // 523.6: the weapons go; the two minds equal again, the bolt between them points down.
    this.at(522.8, 1, m.arms.presence.to(0))
    this.at(524.2, 1.6, m.left.scale.to(1), m.left.x.to(px(-192)), m.left.y.to(px(-31)), m.right.scale.to(1), m.right.x.to(px(192)), m.right.y.to(px(-31)), m.bolt.size.to(px(100)), m.bolt.x.to(0), m.bolt.direction.to(-PI / 2))
    const unit = new HyperAgent({ size: px(512), depth: 1, apex: 0, power: 0, build: 0 })
    const scene = this.tableau(unit)
    this.show(scene, 527, 536, 0.6, 1)
    this.at(527, 0.6, Create(unit))
    this.at(527, 4, unit.build.to(1))
  }

  /** 536–585: the generations of warfare on breadth × depth (f2746, f2836). */
  private generations(): void {
    const ax = (pts: [number, number][]) =>
      new Line({ points: pts.map(([x, y]) => ({ x: px(x), y: px(y), z: 0 })), arrowEnd: true, tint: BLUE, stroke: 2.4 })
    const breadth = ax([[-333, 270], [415, 270]])
    const depth = ax([[-333, 270], [-333, -244]])
    const words = [label("Breadth", 460, 264, 16), label("Depth", -333, -276, 16)]
    // The three realms down the side: the struck Earth, the boxed social sphere, the dim engineered noosphere.
    const bio = new FragmentedEarth({ radius: px(48), globe: 0.62, limb: 1, boltLength: 0.155, boltTint: rgb(140, 140, 140), x: px(1e5), y: px(210) })
    const socialBox = new Rectangle({ width: px(84), height: px(84), tint: BLUE, stroke: 2.4, x: px(-425), y: px(15) })
    const noo = new Noosphere({ radius: px(48), bloom: 1, garden: 0, x: px(-425), y: px(-175) })
    const column = this.tableau(bio, socialBox, noo, breadth, depth, ...words)
    this.show(column, 535.8, 585.6, 1.2, 1.4)
    this.setAt(535.8, bio.x.to(px(-425)))
    this.setAt(585.7, bio.x.to(px(1e5)))
    // The four generations' bands, each a diagonal with its weapons.
    const bands: [[number, number], [number, number], [IconName, number, number, number][]][] = [
      [[-165, 270], [-333, 72], [["pistol", -205, 210, 95], ["flag", -212, 15, 100], ["radioTower", -213, -175, 90]]],
      [[15, 270], [-333, -125], [["tank", -28, 205, 90], ["medals", -28, 20, 105], ["phone", -79, -160, 85], ["laptop", 5, -175, 130]]],
      [[195, 270], [-240, -228], [["bomb", 135, 205, 75], ["compass", 147, 25, 105]]],
      [[370, 270], [-58, -223], [["satellite", 308, 202, 85]]],
    ]
    const ordinal = [label("4th", -244, -252, 15), label("5th", -63, -252, 15)]
    const bandLayers = bands.map(([a, b, ics]) => {
      const line = new Line({ points: [a, b].map(([x, y]) => ({ x: px(x), y: px(y), z: 0 })), tint: BLUE, stroke: 2.2 })
      return new Layer({ members: [line, ...ics.map(([n, x, y, s]) => icon(n, { size: px(s), tint: BLUE, opaque: 1, x: px(x), y: px(y) }))] })
    })
    const chart = this.tableau(...bandLayers, ...ordinal)
    this.show(chart, 544.6, 585.6, 0.4, 1.4)
    bandLayers.forEach((l, i) => this.at(544.6 + 1.6 * i, 1.4, l.presence.sequence(0, 1)))
    // The War Machine from the origin (540) down the narrative band to its place (f2836).
    const machine = new HyperAgent({ size: px(100), depth: 0, power: 0, x: px(-333), y: px(270), scale: 0.64 })
    const wm = this.tableau(machine)
    this.show(wm, 539.4, 585.6, 1, 1.4)
    this.at(545, 5, machine.x.to(px(212)), machine.y.to(px(-40)), machine.scale.to(1))
    // 9:21 "the fifth generation of warfare, also known as psychological or narrative warfare".
    const psy = label("Psychological\nWarfare", 422, -43, 30)
    const nar = label("Narrative\nWarfare", 422, -43, 30)
    const names = this.tableau(psy, nar)
    this.show(names, 562.4, 585.6, 2, 1.4)
    this.setAt(562.4, nar.opacity.to(0))
    this.at(565.6, 1.6, psy.opacity.to(0), nar.opacity.sequence(0, 1))
  }

  /** 585–612: "A nuclear blast … can easily be traced back to its source. The psi-war equivalent …" (9:51–10:09; f2986, f3041). */
  private psyWar(): void {
    const world = new FragmentedEarth({ radius: px(95), globe: 0.62, limb: 1, boltLength: 0.155, boltTint: rgb(140, 140, 140), x: px(1e5), y: px(150) })
    const noo = new Noosphere({ radius: px(115), bloom: 1, garden: 0, x: px(-435), y: px(-155) })
    const realms = this.tableau(world, noo)
    this.show(realms, 585.2, 612, 2, 2)
    this.setAt(585.2, world.x.to(px(-435)))
    this.setAt(612.1, world.x.to(px(1e5)))
    const bomb = icon("bomb", { size: px(160), tint: BLUE, x: px(-120), y: px(150) })
    const cloud = icon("mushroomCloud", { size: px(280), tint: BLUE, x: px(360), y: px(150) })
    const devices = [icon("phone", { size: px(130), tint: BLUE, x: px(-222), y: px(-152) }), icon("laptop", { size: px(240), tint: BLUE, opaque: 1, x: px(-100), y: px(-165) })]
    const a1 = arrow(50, 150, 150)
    const a2 = arrow(50, 150, -155)
    const small = viciousCycle(0.48)
    small.whole.x.value = px(360)
    small.whole.y.value = px(-155)
    const nuke = this.tableau(bomb, a1, cloud)
    const psy = this.tableau(...devices, a2, small.whole)
    this.show(nuke, 590.6, 612, 1, 2)
    this.at(590.6, 1, Create(bomb))
    this.at(593.4, 0.8, Create(a1))
    this.at(594.6, 1.2, Create(cloud))
    this.show(psy, 597.2, 612, 1, 2)
    this.at(597.2, 1, ...devices.map((d) => Create(d)))
    this.at(599.6, 0.8, Create(a2))
    this.at(601.6, 1.2, small.whole.presence.sequence(0, 1))
    this.clock(small.spiral.b, 601.6, 612, 0, -0.25)
  }

  /** 612–635: the vicious cycle, turning (f3091, f3106). */
  private cycle(): void {
    const big = viciousCycle(1)
    const scene = this.tableau(big.whole)
    this.show(scene, 612.2, 635, 1, 1.4)
    this.clock(big.spiral.b, 612.2, 635, 0, -0.25)
  }
}

if (import.meta.main) render(Ch2ArmsRaceDream)
