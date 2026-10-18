/**
 * DreamSongDemo — DreamTalk symbols woven into a DreamSong, and the song
 * compressed back into one symbol (InterBrain film 35:28–36:42).
 *
 *   1. DreamTalk ↔ DreamSong (f10921): three symbols, each in its own small
 *      node, beside the song that weaves them.
 *   2. DreamWeaving (f10951): the open S (vocabulary/Divide, the film's arc
 *      at +45°) from the DreamTalk cluster in the lower lobe up to the
 *      DreamSong in the upper — a scene composition, not a holon: the arc
 *      IS Divide and the two ends are DreamNodes and a DreamSong.
 *   3. The song alone (f10906), compressed into its single DreamTalk
 *      symbol, the Logo (f10981–f10996), and unfolded again.
 *   4. The founding holon as a DreamSong (f11311): circle × square =
 *      cylinder inside a DreamNode — then the incoherent sum (f11401):
 *      circle + square = a muddied square.
 *
 * Framing: 0.48 px per unit at 720p, so a frame point (px, py) is
 * ((px − 640)/0.48, (360 − py)/0.48).
 */

import { Dream, render } from "../../src/index"
import { Rectangle } from "../../src/parts/primitives"
import { together } from "../../src/anim"
import { Create, UnCreate } from "../../src/verbs"
import { Text } from "../../src/parts/text"
import { BLUE, RED, WHITE, seen, type Color } from "../../src/constants"
import { Divide, FILM_TURN } from "../../vocabulary/Divide/Divide"
import { DreamSongSymbol } from "../../vocabulary/DreamSongSymbol/DreamSongSymbol"
import { DreamNode } from "../../vocabulary/DreamNode/DreamNode"
import { DreamTalkSymbol } from "../../vocabulary/DreamTalkSymbol/DreamTalkSymbol"
import { InterBrainGem } from "../../vocabulary/InterBrain/InterBrainGem"
import { Vision } from "../../vocabulary/Vision/Vision"
import { Cylinder } from "../../vocabulary/Cylinder/Cylinder"
import { Circle } from "../../../holons/Circle/Circle"
import { Square } from "../../../holons/Square/Square"

const PX = 0.48
/** The muddied square of f11401, sampled off the frame (the film's pink, not PURPLE). */
const MUDDIED = seen(220, 106, 166)
const ux = (px: number) => (px - 640) / PX
const uy = (py: number) => (360 - py) / PX
const label = (content: string, px: number, py: number, size: number, tint: Color = WHITE) =>
  new Text({ content, size, tint, x: ux(px), y: uy(py) })

/** f10921 → f10951: the three DreamTalk nodes, frame px. */
const TALK_AT = [
  [220, 226],
  [432, 260],
  [346, 420],
] as const
const TALK_WOVEN = [
  [464, 443],
  [573, 443],
  [519, 541],
] as const

export class DreamSongDemoDream extends Dream {
  talks = [
    new InterBrainGem({ radius: 200, logoStroke: 2 }),
    new DreamTalkSymbol({ radius: 100 }),
    new Vision({ radius: 100 }),
  ].map(
    (face, i) =>
      new DreamNode({ radius: 64 / PX, ringStroke: 2.5, face, x: ux(TALK_AT[i]![0]), y: uy(TALK_AT[i]![1]) }),
  )
  song = new DreamSongSymbol({ radius: 234 / PX, x: ux(832), y: uy(326) })
  talkLabel = label("DreamTalk", 336, 640, 72, BLUE)
  songLabel = label("DreamSong", 832, 640, 72, RED)
  /** f10996: compressed, the song is labelled a DreamTalk again. */
  compressedLabel = label("DreamTalk", 640, 640, 72)
  weave = new Divide({ radius: 310 / PX, turn: FILM_TURN, stroke: 5 })
  weaveLabel = label("DreamWeaving", 640, 362, 80)

  // 4. The founding holon in a DreamNode (f11311, f11401).
  whole = new DreamNode({ radius: 234 / PX, face: null })
  circleNode = new DreamNode({
    radius: 64 / PX,
    ringStroke: 2.5,
    faceFill: 0.69,
    x: ux(490),
    face: new Circle({ radius: 100, tint: RED, stroke: 2.5 }),
  })
  squareNode = new DreamNode({
    radius: 64 / PX,
    ringStroke: 2.5,
    faceFill: 0.53,
    x: ux(660),
    face: new Square({ size: 200, tint: BLUE, stroke: 2.5 }),
  })
  times = label("×", 574, 360, 110)
  equals = label("=", 744, 360, 110)
  plus = label("+", 574, 360, 110)
  cylinder!: Cylinder
  muddied = new Rectangle({ width: 72 / PX, height: 72 / PX, rounding: 0.35, tint: MUDDIED, stroke: 2.5, x: ux(804) })

  constructor() {
    super()
    // The cylinder IS the circle and the square's intersection (Cylinder.of),
    // lying on its side as the film draws it (f11311).
    const c = new Circle({ radius: 50 })
    const s = new Square({ size: 100 })
    this.cylinder = Cylinder.of(s, c, { tint: WHITE, stroke: 2.5, x: ux(812), b: Math.PI / 2, p: -0.5, scale: 0.9 })
  }

  unfold() {
    const [a, b, c] = this.talks

    // 1. DreamTalk ↔ DreamSong (f10921).
    this.play(together(...this.talks.map((t) => Create(t)), Create(this.talkLabel)), 2)
    this.play(together(Create(this.song), Create(this.songLabel)), 3)
    this.wait(1.5)

    // 2. DreamWeaving (f10951): the song shrinks into the upper lobe, the
    //    symbols gather in the lower, the arc draws between them.
    this.play(
      together(
        this.song.radius.to(58 / PX),
        this.song.x.to(ux(745)),
        this.song.y.to(uy(245)),
        this.songLabel.x.to(ux(745)),
        this.songLabel.y.to(uy(249)),
        this.talkLabel.x.to(ux(519)),
        this.talkLabel.y.to(uy(491)),
        ...this.talks.flatMap((t, i) => [
          t.x.to(ux(TALK_WOVEN[i]![0])),
          t.y.to(uy(TALK_WOVEN[i]![1])),
          t.radius.to(31 / PX),
        ]),
      ),
      2,
    )
    this.play(together(Create(this.weave), Create(this.weaveLabel)), 2)
    this.wait(2)

    // 3. The song alone (f10906), compressed into its one symbol (f10996).
    this.play(
      together(
        UnCreate(this.weave),
        UnCreate(this.weaveLabel),
        UnCreate(this.talkLabel),
        UnCreate(a!),
        UnCreate(b!),
        UnCreate(c!),
      ),
      1.2,
    )
    // An un-created face still leaves its surfaces (the Earth's sea, the
    // crystal's facets): fold the nodes away outright.
    this.play(together(...this.talks.map((t) => t.scale.to(0))), 0.01)
    this.play(
      together(
        this.song.radius.to(233 / PX),
        this.song.x.to(0),
        this.song.y.to(uy(332)),
        this.songLabel.x.to(0),
        this.songLabel.y.to(uy(640)),
      ),
      2,
    )
    this.wait(1.5)
    this.play(together(this.song.stateAxis("compress").to("symbol"), UnCreate(this.songLabel), Create(this.compressedLabel)), 2)
    this.wait(1.5)
    this.play(together(this.song.stateAxis("compress").to("song"), UnCreate(this.compressedLabel), Create(this.songLabel)), 2)
    this.wait(1)
    this.play(together(UnCreate(this.song), UnCreate(this.songLabel)), 1.2)
    this.play(this.song.scale.to(0), 0.01)

    // 4. circle × square = cylinder (f11311) … circle + square = a muddied square (f11401).
    this.play(Create(this.whole), 1.5)
    this.play(together(Create(this.circleNode), Create(this.squareNode)), 1.5)
    this.play(together(Create(this.times), Create(this.equals)), 0.8)
    this.play(Create(this.cylinder), 2)
    this.wait(2)
    this.play(together(UnCreate(this.times), UnCreate(this.cylinder)), 1)
    this.play(together(Create(this.plus), Create(this.muddied)), 1.5)
    this.wait(2)
  }
}


if (import.meta.main) render(DreamSongDemoDream)
