/**
 * Ch5FixingTheLens — chapter 5 of the InterBrain film, "Fixing The Lens"
 * (video 1395–1593 s; docs/reports/interbrain-vocabulary.md §2 Ch 5).
 *
 * Local t = video t − 1395. Every beat is measured off frames5 (5 fps,
 * f_N at (N − 1)/5) and the transcript; the layouts are read off the
 * frames in px (1280 × 720, origin the frame's centre, y up) and put in
 * units at the default eye's 0.48 px per unit.
 *
 *   1397.5  the title card
 *   1403    domesticated → liminal: the two eyes over the two minds (f7021)
 *   1419    the manipulated lens: fragmented world, the eye in the prism,
 *           the puppeteer's strings, the smeared spectrum (f7096)
 *   1437    the collective of liminal minds round the liminal eye (f7186)
 *   1441    it condenses into the red flower-of-life disk (f7231)
 *   1447    bolts; the disk is cut into six (f7246)
 *   1455    pan down: the cylinder over the S badge (f7291); the bolt
 *   1463    the cylinder breaks into freedom (red ball) ⚡ order (blue
 *           cube), the narrative badges under both (f7366)
 *   1481    pan back up: the cut disk → hexagon → the fragmented vortex,
 *           the fists at its heart (f7441, f7471)
 *   1497    the worldview ↔ the vortex (f7501)
 *   1509    the worldview alone: fragmented, the strings cut, then the eye
 *           looks AT the lens (f7561, f7606), the light back (f7666)
 *   1541    the digital twin: the notes into the lens, then in the world's
 *           place (f7706, f7726) — the neutral `notes` face, §6
 *   1555    the person ⇅ the second brain, "Personal Knowledge Management"
 *           (f7801, f7846)
 *   1573    the boxed web of minds becomes a web of second brains (f7876, f7891)
 *   1581    the worldview ↔ the vortex again (f7921), out to black
 *
 * Residuals: the scissors that cut the strings (f7561, not a holon); the
 * C4D glass cylinder, red ball and ice cube are their symbolic layer
 * (Cylinder; a filled Circle and Square).
 */

import { Dream, render } from "../../src/index"
import type { Anim } from "../../src/anim"
import { together } from "../../src/anim"
import type { Holon } from "../../src/holon"
import { Circle, Group, Line, Square } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { BLUE, RED, WHITE, type Color } from "../../src/constants"
import { CHAPTERS, SERIF, titleCard, type FilmChapter } from "./film"
import { Layer } from "../../vocabulary/Figure/Figure"
import { MolochEye } from "../../vocabulary/MolochEye/MolochEye"
import { Mind } from "../../vocabulary/Mind/Mind"
import { LENS, SOURCE, Worldview, WV } from "../../vocabulary/Worldview/Worldview"
import { HyperAgent } from "../../vocabulary/HyperAgent/HyperAgent"
import { CUT, HEX, Noosphere } from "../../vocabulary/Noosphere/Noosphere"
import { Conflict } from "../../vocabulary/Conflict/Conflict"
import { Cylinder } from "../../vocabulary/Cylinder/Cylinder"
import { Vision } from "../../vocabulary/Vision/Vision"
import { DreamNode } from "../../vocabulary/DreamNode/DreamNode"
import { Puppeteer } from "../../vocabulary/Puppeteer/Puppeteer"
import { Tribe } from "../../vocabulary/Tribe/Tribe"
import { icon } from "../../vocabulary/Icons/Icons"

/** px per unit at the default eye (720p). */
export const PX = 0.48
/** Frame px (from the centre, y up) → units. */
export const u = (px: number): number => px / PX

/** A label in the film's serif, placed in frame px; size is the font's px. */
export const label = (content: string, x: number, y: number, sizePx: number, tint: Color = WHITE, align: "center" | "left" = "center"): Text =>
  new Text({ content, font: SERIF, size: u(sizePx) * TEXT_FIT, tint, x: u(x), y: u(y), align })

/** An arrow in frame px. */
export const arrow = (x0: number, y0: number, x1: number, y1: number, both = false, stroke = 2.4): Line =>
  new Line({ points: [{ x: u(x0), y: u(y0), z: 0 }, { x: u(x1), y: u(y1), z: 0 }], arrowEnd: true, arrowStart: both, arrowSize: 2.4, stroke, tint: WHITE })

/**
 * Where a hidden tableau waits. Presence fades a tableau, but the host's
 * flat fills (Earth's land, opaque icon bodies) read the leaf's own opacity
 * rather than the inherited presence, so a faded tableau is also moved
 * out of frame (residual reported; render/three-host.ts is not ours).
 */
export const PARKED = 40000

/** Text size vs the font px measured on the frames (fitted on f7856). */
const TEXT_FIT = 1.25

/** One tableau: a whole that fades as one (presence inherits). */
export const layer = (...members: Holon[]): Layer => new Layer({ members })

/**
 * A chapter's score written in its own local seconds: `at(t)` puts the
 * cursor at t, `play(t, anim, d)` plays there, so beats measured off the
 * frames are stated as they were measured, in any order.
 */
export abstract class ChapterDream extends Dream {
  abstract chapter: FilmChapter
  #now = 0
  /** Local seconds of video time T. */
  t(T: number): number {
    return T - this.chapter.start
  }
  at(T: number): void {
    const t = this.t(T)
    this.wait(t - this.#now)
    this.#now = t
  }
  /** Play `anim` from video time T for d seconds. */
  run(T: number, anim: Anim, d = 1): void {
    this.at(T)
    this.play(anim, d)
    this.#now += d
  }
  /** Fade a tableau in / out from video time T. */
  show(l: Layer, T: number, d = 1): void {
    this.at(T)
    this.set(l.x.sequence(PARKED, 0))
    this.run(T, l.presence.sequence(0, 1), d)
  }
  hide(l: Layer, T: number, d = 1): void {
    this.run(T, l.presence.to(0), d)
    this.set(l.x.to(PARKED))
  }
  /** Close the chapter at its measured length. */
  end(): void {
    this.at(this.chapter.end)
  }
}

// ─── shared builders (chapter 6 opens on the same pictures) ────────────

/** The notes face (§6: the neutral second brain), `size` px across, at (x, y) px. */
export const notes = (size: number, x = 0, y = 0): Group =>
  new Group({ x: u(x), y: u(y), scale: u(size) / 100, members: [icon("notes", { size: 100, tint: BLUE, stroke: 2, opaque: 1 })] })

/**
 * The person ⇅ the second brain, "Personal Knowledge Management" (f7856),
 * centred on x (frame px). Parts exposed so a chapter can recolour words.
 */
export const pkm = (x = 0) => {
  const mind = new Mind({ size: u(190), liminal: 0, framed: 0, x: u(x), y: u(100) })
  const brain = notes(150, x, -196)
  const arrows = [arrow(x - 14, -10, x - 14, -112), arrow(x + 14, -112, x + 14, -10)]
  const personal = label("Personal", x, 274, 26)
  const knowledge = label("Knowledge", x - 166, 230, 26, WHITE, "left")
  const management = label("Management", x - 6, 230, 26, WHITE, "left")
  const second = label("Second Brain", x, -302, 13)
  return { mind, brain, arrows, personal, knowledge, management, second, all: [mind, brain, ...arrows] }
}

/** The world through its manipulated lens, small, ↔ the fragmented vortex (f7501). */
export const vortex = (radius: number, scale = 1): { noos: Noosphere; fists: Puppeteer[]; whole: Group } => {
  const noos = new Noosphere({ radius, flat: 1, fragment: 1 })
  const fists = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3 + Math.PI / 6
    const r = radius * 0.2
    return new Puppeteer({ size: radius * 0.3, strings: 0, x: r * Math.cos(a), y: r * Math.sin(a), b: a + Math.PI / 2 })
  })
  return { noos, fists, whole: new Group({ scale, members: [noos, ...fists] }) }
}

const CH = CHAPTERS[4]!

export class Ch5FixingTheLensDream extends ChapterDream {
  chapter = CH

  // 1403: domesticated → liminal (f7021).
  eyeD = new MolochEye({ height: u(50), iris: 0, x: u(-266), y: u(210) })
  eyeL = new MolochEye({ height: u(50), iris: 1, x: u(200), y: u(210) })
  mindD = new Mind({ size: u(126), liminal: 0, x: u(-266), y: u(-96) })
  mindL = new Mind({ size: u(126), liminal: 1, x: u(200), y: u(-96) })
  turn = layer(this.eyeD, this.eyeL, this.mindD, arrow(-76, -96, 8, -96), this.mindL)

  // 1419: the manipulated lens (f7096).
  wvA = new Worldview({ globes: [], source: SOURCE.fragmented, lens: LENS.noosphere, lensFace: new MolochEye({ height: 70, iris: 0, y: -60 }), distortion: 1, strings: 1, y: u(-10) })
  manipulated = layer(this.wvA)

  // 1437: the collective of liminal minds (f7186) condensing into the disk.
  love = new HyperAgent({ size: u(140) / 0.178, depth: 2, love: 1, y: u(-10) })
  collective = layer(this.love)
  disk = new Noosphere({ radius: u(196), flat: 1, fragment: 0 })
  diskG = new Group({ members: [this.disk] })
  diskL = layer(this.diskG)

  // 1455: the cylinder, the S badge; 1463: freedom ⚡ order (f7291, f7366).
  cylinder = new Cylinder({ radius: u(62), height: u(150), b: Math.PI / 2, h: 0.5, p: 0.25, y: u(30), tint: WHITE, stroke: 2 })
  sBadge = new Vision({ radius: u(56), ring: 1, y: u(-160) })
  cylL = layer(this.cylinder, this.sBadge)
  bolt = new Conflict({ size: u(48), y: u(110) })
  boltL = layer(this.bolt)
  ball = new Circle({ radius: u(86), tint: RED, stroke: 2, fillOpacity: 0.75, y: u(30) })
  cube = new Square({ size: u(190), tint: BLUE, stroke: 2, fillOpacity: 0.7, y: u(30) })
  ballL = layer(this.ball)
  cubeL = layer(this.cube)
  badges = layer(
    ...[-250, 240].map((x) => new DreamNode({ radius: u(50), ringStroke: 2, face: new Square({ size: 100, tint: WHITE, stroke: 2 }), x: u(x), y: u(-180) })),
  )
  partial = new Group({ members: [this.cylL, this.boltL, this.ballL, this.cubeL, this.badges] })

  // 1489: the fragmented vortex (f7471), and its small self (f7501).
  vx = vortex(u(196), 1.05)
  vortexL = layer(this.vx.whole)
  swap = layer(arrow(-58, 0, 58, 0, true, 3))

  // 1497–1590: the worldview that is fixed (f7501 small, f7546 … f7726).
  wvC = new Worldview({ globes: [], source: SOURCE.earth, lens: LENS.lattice, distortion: 1, strings: 1, sourceFace: new Group({}) })
  wvCG = new Group({ x: u(-330), y: u(-15), scale: 0.45, members: [this.wvC] })
  fixing = layer(this.wvCG)
  /** The digital twin: the notes, flying from the lens to the world's place. */
  twin = new Group({ scale: 1.6, members: [icon("notes", { size: 100, tint: BLUE, stroke: 2, opaque: 1 })] })
  twinG = new Group({ y: -40, members: [this.twin] })
  twinL = layer(this.twinG)

  // 1555: Personal Knowledge Management (f7856).
  p = pkm(0)
  pkmL = layer(...this.p.all)
  pkmLabel = layer(this.p.personal, this.p.knowledge, this.p.management)
  secondL = layer(this.p.second)

  // 1573: the boxed web → a web of second brains (f7876, f7891).
  web = new Tribe({ size: u(160), modern: 1, boxed: 0, rings: 1, stroke: 2 })
  webNotes = [[0, 0], [160, 0], [80, 139], [-80, 139], [-160, 0], [-80, -139], [80, -139]].map(([x, y]) => layer(notes(66, x, y)))
  webL = layer(this.web, ...this.webNotes)

  unfold() {
    titleCard(this, CH)

    // domesticated → liminal
    this.show(this.turn, 1402.3, 1)
    this.hide(this.turn, 1416.3, 1.4)

    // the manipulated lens
    this.show(this.manipulated, 1417.6, 1.4)
    this.hide(this.manipulated, 1435.2, 1.8)

    // the collective of liminal minds → the disk
    this.show(this.collective, 1435.8, 1.6)
    this.show(this.diskL, 1439.6, 1.6)
    this.hide(this.collective, 1442.6, 2)
    this.run(1441.6, this.diskG.scale.to(1.7), 3.2)
    this.run(1445, this.diskG.scale.to(1), 2)
    this.run(1446.4, this.disk.fragment.to(CUT), 2.4)

    // pan down to the partial truths
    this.set(this.partial.y.to(u(-720)))
    this.run(1454, together(this.diskG.y.to(u(720)), this.partial.y.to(0)), 3)
    this.show(this.cylL, 1454, 0.1)
    this.show(this.boltL, 1460.2, 0.8)
    this.hide(this.cylL, 1462.4, 1.6)
    this.show(this.ballL, 1462.6, 1.6)
    this.show(this.cubeL, 1462.6, 1.6)
    this.run(1462.6, together(this.ball.x.to(u(-250)), this.cube.x.to(u(240)), this.bolt.y.to(u(30)), this.bolt.scale.to(1.3)), 3)
    this.show(this.badges, 1464, 2)

    // pan back up: cut → hexagon → vortex
    this.run(1480.6, together(this.partial.y.to(u(-720)), this.diskG.y.to(0)), 4)
    this.run(1486.4, this.disk.fragment.to(HEX), 2)
    this.hide(this.diskL, 1489.4, 1)
    this.show(this.vortexL, 1488.8, 1.2)

    // the worldview ↔ the vortex
    this.run(1495.8, together(this.vx.whole.x.to(u(340)), this.vx.whole.scale.to(0.68)), 2)
    this.show(this.fixing, 1496.8, 1.6)
    this.show(this.swap, 1500, 1)

    // the worldview alone, fixed
    this.hide(this.swap, 1507, 1)
    this.hide(this.vortexL, 1507, 1.6)
    this.run(1507, together(this.wvCG.x.to(0), this.wvCG.y.to(0), this.wvCG.scale.to(1)), 2)
    this.run(1509.4, this.wvC.source.to(SOURCE.fragmented), 1.6)
    this.run(1514, this.wvC.strings.to(0), 2.4)
    this.run(1517, together(this.wvC.source.to(SOURCE.earth), this.wvC.reverse.to(1)), 2)
    this.run(1531.4, this.wvC.reverse.to(0), 1.6)

    // the digital twin
    this.show(this.twinL, 1540, 1)
    this.run(1541.8, together(this.twinG.x.to(WV.source.x), this.twinG.y.to(WV.source.y), this.twin.scale.to(4.58)), 1.8)
    this.at(1543.6)
    this.set(this.wvC.source.to(SOURCE.face))

    // Personal Knowledge Management
    this.hide(this.fixing, 1553.4, 2)
    this.run(1553.6, together(this.twinG.x.to(0), this.twinG.y.to(u(-196)), this.twin.scale.to(u(150) / 100)), 3)
    this.show(this.pkmL, 1555, 2)
    this.hide(this.twinL, 1557, 0.1)
    this.show(this.pkmLabel, 1564, 1)
    this.show(this.secondL, 1568, 1.4)

    // the web of second brains
    for (const l of [this.pkmL, this.pkmLabel, this.secondL]) this.hide(l, 1572, 1.6)
    this.set(...this.webNotes.slice(1).map((l) => l.presence.to(0)))
    this.show(this.webL, 1572.6, 1.8)
    this.webNotes.slice(1).forEach((l) => this.show(l, 1575.6, 1.4))

    // the worldview ↔ the vortex again
    this.hide(this.webL, 1579.4, 1.4)
    this.run(1579, together(this.wvCG.x.to(u(-330)), this.wvCG.y.to(u(-15)), this.wvCG.scale.to(0.45)), 0.1)
    this.run(1579, together(this.wvC.source.to(SOURCE.earth), this.wvC.strings.to(1)), 0.1)
    this.show(this.fixing, 1579.8, 1.4)
    this.show(this.vortexL, 1579.8, 1.4)
    this.show(this.swap, 1579.8, 1.4)
    for (const l of [this.fixing, this.vortexL, this.swap]) this.hide(l, 1589, 2)

    this.end()
  }
}


if (import.meta.main) render(Ch5FixingTheLensDream)
