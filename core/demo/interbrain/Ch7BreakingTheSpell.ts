/**
 * Ch7BreakingTheSpell — chapter 7 of the InterBrain film, "Breaking the
 * Spell" (video 2070–2446 s; docs/reports/interbrain-vocabulary.md §2, §8).
 *
 * A composition: it lays out, labels and times vocabulary holons and draws
 * nothing of its own. Beats are in VIDEO seconds (score.ts `at`), measured
 * off frames5 (2 s contact sheets of f10351–f12231) and the narration:
 *
 *   2075–2081  title card
 *   2084–2104  ancient tribe → book / radio tower → modern web (f10431, f10441)
 *   2105–2120  the InterBrain tribe tilted in 3D, the broadcast mesh above (f10531)
 *   2119–2128  the vortex heals to the hexagon (f10611, f10631)
 *   2128–2146  circle and square → the cylinder, a tower on it (f10651–f10721)
 *   2144–2176  DreamNode import: the holarchy, its higher order, back (f10761, f10831, f10861)
 *   2177–2203  DreamSong; DreamTalk ↔ DreamSong; DreamWeaving; compressed to the Logo
 *              (f10906, f10921, f10951, f10961, f10981)
 *   2203–2212  the emergent holarchy round the Logo (f11026)
 *   2212–2222  DreamWeaving ── broadcast (f11071)
 *   2222–2253  resonance through the liminal web (f11131, f11151, f11171, f11201, f11241)
 *   2253–2264  circle × square = cylinder inside a DreamNode (f11281, f11291, f11311)
 *   2265–2276  the cylinder node in the dim InterBrain lattice; its tribe resonates (f11341–f11371)
 *   2276–2288  circle + square = a muddied square; it sinks in a red swarm (f11381–f11431)
 *   2288–2300  the Coherence Beacon (f11451–f11491)
 *   2301–2313  freedom of speech × [beacon] → order (f11511, f11541)
 *   2314–2336  the red field, the oscillation, the third axis, the cyan starburst (f11581–f11671)
 *   2336–2356  the hyperspace tunnel of DreamNodes (f11701–f11771)
 *   2356–2362  the healed lens (f11791, f11801)
 *   2362–2390  vortex → hexagon → disk → the InterBrain sphere (f11811–f11941)
 *   2390–2431  narratives come, are swarmed, enter and are transmuted into visions (f11951–f12141)
 *   2431–2446  the drawing hands draw the sphere (f12161–f12221)
 *
 * Residual placeholders: the Escher drawing hands (2431–2446; the sphere
 * they draw is kept alone), the "liminal eyes" node face (Vision stands in,
 * as in DreamSong), the 3D tribe's crystals stand as InterBrain faces over a
 * flat-drawn Tribe of minds; the C4D ball and cube are the founding circle
 * and square, filled.
 */

import { render, type Holon } from "../../src/index"
import { together, type Anim } from "../../src/anim"
import { Create, UnCreate } from "../../src/verbs"
import { Text } from "../../src/parts/text"
import { Group, Line, Rectangle } from "../../src/parts/primitives"
import { BLUE, RED, WHITE, seen, type Color } from "../../src/constants"
import { Layer } from "../../vocabulary/Figure/Figure"
import { Tribe, latticeNodes, nodePosition } from "../../vocabulary/Tribe/Tribe"
import { Book } from "../../vocabulary/Book/Book"
import { RadioTower } from "../../vocabulary/RadioTower/RadioTower"
import { InterBrain } from "../../vocabulary/InterBrain/InterBrain"
import { Noosphere, HEX } from "../../vocabulary/Noosphere/Noosphere"
import { Cylinder } from "../../vocabulary/Cylinder/Cylinder"
import { DreamNode, ImportLines } from "../../vocabulary/DreamNode/DreamNode"
import { DreamTalkSymbol } from "../../vocabulary/DreamTalkSymbol/DreamTalkSymbol"
import { Vision } from "../../vocabulary/Vision/Vision"
import { DreamSong } from "../../vocabulary/DreamSong/DreamSong"
import { Divide, FILM_TURN } from "../../vocabulary/Divide/Divide"
import { Logo } from "../../vocabulary/Logo/Logo"
import { DREAMER_FACES } from "../../vocabulary/DreamGarden/DreamGarden"
import { icon } from "../../vocabulary/Icons/Icons"
import { Resonance } from "../../vocabulary/Resonance/Resonance"
import { Field } from "../../vocabulary/Field/Field"
import { CoherenceBeacon, BEACON } from "../../vocabulary/CoherenceBeacon/CoherenceBeacon"
import { Conflict } from "../../vocabulary/Conflict/Conflict"
import { Dialectic } from "../../vocabulary/Attractor/Dialectic"
import { Worldview, LENS, SOURCE } from "../../vocabulary/Worldview/Worldview"
import { Circle } from "../../../holons/Circle/Circle"
import { Square } from "../../../holons/Square/Square"
import { SERIF, SERIF_ITALIC } from "./film"
import { ChapterDream, PX } from "./score"

/** Frame pixels (1280×720, origin top-left) → scene units. */
export const X = (px: number): number => (px - 640) / PX
export const Y = (py: number): number => (360 - py) / PX
export const R = (px: number): number => px / PX

/** The muddied square of f11401 (DreamSongDemo's sample). */
const MUDDIED = seen(220, 106, 166)

export const label = (content: string, px: number, py: number, size = 60, tint: Color = WHITE, font = SERIF): Text =>
  new Text({ content, size, tint, font, x: X(px), y: Y(py) })

/** A cylinder born of the founding circle and square (Cylinder.of), lying as the film draws it. */
export const foundingCylinder = (over: Record<string, unknown> = {}): Cylinder =>
  Cylinder.of(new Square({ size: 100 }), new Circle({ radius: 50 }), {
    tint: WHITE,
    stroke: 2.2,
    b: Math.PI / 2,
    p: -0.5,
    ...over,
  })

/** The hyperspace tunnel's chain (f11701, f13151): DreamNodes, a cylinder in every other, receding to the vanishing point, rings turned to the axis. */
export const tunnelChain = (group: Group, n = 18): DreamNode[] => {
  const chain: DreamNode[] = []
  for (let i = 0; i < n; i++) {
    const node = new DreamNode({
      radius: R(80),
      ringStroke: 2.5,
      dreamTint: i % 4 === 2 ? RED : BLUE,
      face: i % 2 === 0 ? foundingCylinder({ stroke: 2 }) : null,
      x: X(980) - i * 140,
      y: Y(440) + i * 18,
      z: -i * 320,
      h: -0.75,
    })
    chain.push(node)
    group.attach(node)
  }
  return chain
}

/**
 * The shot grammar on top of score.ts: a tableau (Layer) dissolves in and
 * out, and is folded to scale 0 while off stage (an un-created Earth still
 * occludes with its sea, DreamNodeDemo).
 */
export abstract class ShotDream extends ChapterDream {
  protected shot(layer: Layer, t0: number, t1: number, fi = 1, fo = 1, peak = 1): void {
    this.at(t0 - 0.02, 0.01, layer.scale.sequence(0, layer.scale.value))
    this.at(t0, fi, layer.presence.sequence(0, peak))
    this.at(t1 - fo, fo, layer.presence.to(0))
    this.at(t1 + 0.01, 0.01, layer.scale.to(0))
  }

  protected layer(...members: Holon[]): Layer {
    return new Layer({ members })
  }

  /** Fade a holon and every descendant whose opacity is its own (bound ones follow their whole). */
  protected fade(h: Holon, v: number): Anim {
    return together(...[...h.walk()].filter((x) => !x.opacity.isBound).map((x) => x.opacity.to(v)))
  }

  /** Bring a member up at t (it holds undrawn till then). */
  protected draw(t: number, dur: number, ...hs: Holon[]): void {
    this.at(t, dur, ...hs.map((h) => Create(h)))
  }
}

/** The holarchy of f10761: a parent importing three sources (bottom, upper right, upper left). */
const holarchy = (faces: (() => Holon)[], parentPx = 126, sourcePx = 102, outPx = 288, at: Record<string, number> = {}) => {
  const children = faces.map((f) => new DreamNode({ face: f(), ringStroke: 2 }))
  const parent = new DreamNode({ radius: R(parentPx), ringStroke: 3, face: null, children })
  const sources = faces.map((f, i) => {
    const a = -Math.PI / 2 + (i / faces.length) * 2 * Math.PI
    return new DreamNode({ radius: R(sourcePx), ringStroke: 3, x: Math.cos(a) * R(outPx), y: Math.sin(a) * R(outPx), face: f() })
  })
  const group = new Layer({ members: [], ...at })
  const lines = sources.map((s, i) => new ImportLines({ between: [s, children[i]!], frame: () => group, stroke: 1.6 }))
  for (const h of [...lines, parent, ...sources]) group.attach(h)
  return { group, parent, sources, lines, children }
}

const ib = () => new InterBrain({ radius: 200, logoStroke: 2 })
const dt = () => new DreamTalkSymbol({ radius: 100 })
const vision = () => new Vision({ radius: 100, tint: RED })
const SONG_FACES = [vision, dt, ib]

export class Ch7BreakingTheSpellDream extends ShotDream {
  protected readonly chapterIndex = 6

  // A. Ancient → Modern (f10431, f10441).
  ancient = new Tribe({ size: R(90), rings: 1, stroke: 1.4, x: X(334), y: Y(360) })
  modern = new Tribe({ size: R(92), rings: 1, modern: 1, stroke: 1.4, x: X(946), y: Y(360) })
  arrow = new Line({ points: [{ x: X(510), y: Y(358), z: 0 }, { x: X(770), y: Y(358), z: 0 }], arrowEnd: true, stroke: 2 })
  tick = new Line({ points: [{ x: 0, y: Y(350), z: 0 }, { x: 0, y: Y(366), z: 0 }], stroke: 1.5 })
  book = new Book({ size: R(48), x: X(532), y: Y(412) })
  tower = new RadioTower({ size: R(58), x: X(744), y: Y(412) })
  towerBox = new Rectangle({ width: R(52), height: R(64), tint: RED, stroke: 2, x: 0, y: Y(412) })
  timeline = this.layer(this.ancient, this.modern, this.arrow, this.tick, this.book, this.tower, this.towerBox)

  // B. The InterBrain tribe in 3D, the broadcast mesh above (f10531).
  tilted = new Tribe({ size: R(248), rings: 1, stroke: 2, p: -1.15 })
  crystals: InterBrain[] = []
  masts: RadioTower[] = []
  mesh: Line[] = []
  tribe3d: Layer

  // C. The vortex healing to the hexagon (f10611, f10631).
  vortex = new Noosphere({ radius: R(201), frequency: 2, bloom: 1, garden: 1, flat: 1, fragment: 1 })
  vortexShot = this.layer(this.vortex)

  // D. Circle and square → the cylinder (f10651–f10721).
  circle = new Circle({ radius: R(85), tint: RED, stroke: 2.4, x: X(388), y: Y(412) })
  square = new Square({ size: R(165), tint: BLUE, stroke: 2.4, x: X(880), y: Y(412), h: 0.45 })
  cyl = foundingCylinder({ scale: 3, y: Y(372) })
  cylTower = new RadioTower({ size: R(60), y: Y(292), broadcast: 0 })
  founding = this.layer(this.circle, this.square, this.cyl, this.cylTower)

  // E. The holarchy (f10761) and its higher order (f10831).
  hol = holarchy(SONG_FACES, 126, 102, 288, { y: Y(305) })
  hol2Centre = new DreamNode({ radius: R(70), ringStroke: 2.5, face: dt(), y: Y(412) })
  hol2Comps = [
    [640, 212],
    [432, 512],
    [848, 512],
  ].map(
    ([x, y], k) =>
      new DreamNode({
        radius: R(96),
        ringStroke: 2.5,
        face: null,
        x: X(x!),
        y: Y(y!),
        children: [
          [() => icon("filmStrip", { size: 120 }), () => icon("musicNote", { size: 120 }), () => icon("gameController", { size: 120 })],
          SONG_FACES,
          [() => icon("book", { size: 120 }), () => new Logo({ radius: 90 }), () => icon("atom", { size: 120 })],
        ][k]!.map((f) => new DreamNode({ face: f(), ringStroke: 1.6 })),
      }),
  )
  hol2: Layer

  // F. The DreamSong (f10906 … f10981).
  song = new DreamSong({ radius: R(233), y: Y(336) })
  songLabel = label("DreamSong", 640, 644, 60)
  talks = SONG_FACES.map((f, i) => new DreamNode({ radius: R(64), ringStroke: 2.5, face: f(), x: X([346, 432, 220][i]!), y: Y([420, 260, 226][i]!) }))
  talkLabel = label("DreamTalk", 336, 640, 60, BLUE)
  weave = new Divide({ radius: R(310), turn: FILM_TURN, stroke: 5 })
  weaveLabel = label("DreamWeaving", 640, 362, 64)
  compressedLabel = label("DreamTalk", 640, 640, 60)
  songShot: Layer

  // G. The emergent holarchy round the Logo (f11026).
  holLogo: Layer

  // H. DreamWeaving ── broadcast (f11071).
  wv = new Divide({ radius: R(188), turn: FILM_TURN, stroke: 3, outer: 1, x: X(360), y: Y(356) })
  wvSong = new DreamSong({ radius: R(35), x: X(424), y: Y(286) })
  wvTalks = SONG_FACES.map((f, i) => new DreamNode({ radius: R(19), ringStroke: 1.5, face: f(), x: X([253, 320, 287][i]!), y: Y([406, 406, 466][i]!) }))
  wvTowerRing = new Circle({ radius: R(188), tint: WHITE, stroke: 3, x: X(924), y: Y(356) })
  wvTower = new RadioTower({ size: R(120), x: X(924), y: Y(356) })
  wvLink = new Line({ points: [{ x: X(548), y: Y(356), z: 0 }, { x: X(736), y: Y(356), z: 0 }], stroke: 3 })
  weaveTower = this.layer(this.wv, this.wvSong, ...this.wvTalks, this.wvTowerRing, this.wvTower, this.wvLink,
    label("DreamSong", 424, 330, 22, RED), label("DreamWeaving", 360, 360, 22), label("DreamTalk", 287, 438, 22, BLUE))

  // I. Resonance through the liminal web (f11131 … f11241).
  holR = holarchy(SONG_FACES, 126, 102, 288, { scale: 104 / 126, x: X(645), y: Y(258) })
  peers: DreamNode[] = []
  burst = new Field({ mode: "burst", wholeness: 1, radius: R(104), reach: R(140), stroke: 1.5, count: 2500, focusX: X(645), focusY: Y(258) })
  rings: Resonance[] = []
  webR: Layer
  centreR = holarchy(SONG_FACES, 112, 1, 0, { y: Y(352) }).parent
  peers6: DreamNode[] = []
  rings6: Resonance[] = []
  web6: Layer

  // J. circle × square = cylinder in a DreamNode (f11281, f11311).
  whole = new DreamNode({ radius: R(168), ringStroke: 3, face: null })
  srcC = new DreamNode({ radius: R(140), ringStroke: 3, x: X(272), face: new Circle({ radius: 100, tint: RED, stroke: 2.5 }), faceFill: 0.69 })
  srcS = new DreamNode({ radius: R(140), ringStroke: 3, x: X(1008), face: new Square({ size: 200, tint: BLUE, stroke: 2.5 }), faceFill: 0.53 })
  cNode = new DreamNode({ radius: R(48), ringStroke: 2.5, x: X(560), faceFill: 0.69, face: new Circle({ radius: 100, tint: RED, stroke: 2.5 }) })
  sNode = new DreamNode({ radius: R(48), ringStroke: 2.5, x: X(720), faceFill: 0.53, face: new Square({ size: 200, tint: BLUE, stroke: 2.5 }) })
  times = label("×", 574, 360, 90)
  equals = label("=", 744, 360, 90)
  plus = label("+", 574, 360, 90)
  sumCyl = foundingCylinder({ x: X(812), scale: 0.9 })
  muddied = new Rectangle({ width: R(72), height: R(72), rounding: 0.35, tint: MUDDIED, stroke: 2.5, x: X(804) })
  equation: Layer
  importC!: ImportLines
  importS!: ImportLines

  // K. The dim InterBrain lattice; the cylinder's tribe (f11341–f11431).
  lattice: Layer
  latticeNodes: DreamNode[] = []
  cylNodes: DreamNode[] = []
  latticeRing = new Resonance({ radius: R(300), amount: 1 })
  muddyNode = new DreamNode({ radius: R(32), ringStroke: 2, face: new Rectangle({ width: 150, height: 150, rounding: 0.35, tint: MUDDIED, stroke: 2.5 }) })
  muddySwarm = new Field({ mode: "swarm", radius: R(34), reach: R(26), stroke: 1.4, count: 900 })

  // L. The Coherence Beacon (f11451–f11541).
  beacon = new CoherenceBeacon({ size: R(33), y: Y(223), reach: 0, tower: new RadioTower({ size: R(BEACON.tower * 33), solid: 0 }) })
  beaconTitle = label("Coherence Beacon", 640, 640, 46)
  beaconShot = this.layer(this.beacon, this.beaconTitle)
  incoherent = new CoherenceBeacon({ size: R(33), y: Y(380) + 9.1 * R(33), coherence: 0, reach: 0 })
  freedom = label("freedom", 330, 382, 56, RED, SERIF_ITALIC)
  ofSpeech = label("of speech", 470, 382, 56)
  timesF = label("×", 572, 382, 56)
  boltF = new Conflict({ size: R(60), direction: 0, x: X(790), y: Y(380) })
  arrowF = new Line({ points: [{ x: X(742), y: Y(382), z: 0 }, { x: X(845), y: Y(382), z: 0 }], arrowEnd: true, stroke: 3 })
  order = label("order", 950, 382, 56, BLUE, SERIF_ITALIC)
  equationF = this.layer(this.incoherent, this.freedom, this.ofSpeech, this.timesF, this.boltF, this.arrowF, this.order)

  // M. The red field, the oscillation, the third axis, the starburst (f11581–f11671).
  field = new Field({ opacity: 0.85 })
  dialectic = new Dialectic({ size: R(24.5), span: 5.05, labels: 0, swing: 1, trace: 1, y: Y(516) })
  axisShot = this.layer(this.field, this.dialectic)

  // N. The hyperspace tunnel (f11701–f11771).
  warp = new Field({ wholeness: 1, opacity: 0.6, density: 0.5 })
  chain: DreamNode[] = []
  chainGroup = new Group({})
  tunnel = this.layer(this.warp, this.chainGroup)

  // O. The healed lens (f11791).
  lens = new Worldview({ source: SOURCE.radiant, lens: LENS.flower })
  lensShot = this.layer(this.lens)

  // P. The noosphere heals; the InterBrain sphere; narratives transmuted (f11811–f12141).
  medium = new Noosphere({ radius: R(198), frequency: 2, bloom: 1, garden: 1, flat: 1, fragment: 1 })
  narratives: DreamNode[] = []
  narrSwarm: Field
  inner = new Vision({ radius: R(40), tint: RED, ring: 1, light: 1, x: R(40), z: R(200) })
  visions: Vision[] = []
  sphereBurst = new Field({ mode: "burst", wholeness: 1, radius: R(150), reach: R(200), stroke: 1.5, count: 3500 })
  dreamers: DreamNode[] = []
  dense = new Noosphere({ radius: R(224), frequency: 7, bloom: 1, garden: 1 })
  mediumShot: Layer

  constructor() {
    super()
    // B: the tribe's seven nodes, a crystal standing on each, a mast above, the mesh between the masts.
    const tilt = 1.15
    const nodes = latticeNodes(1).map((n) => nodePosition(n, R(248)))
    for (const { x, y } of nodes) {
      const wy = y * Math.cos(tilt)
      const wz = -y * Math.sin(tilt)
      this.crystals.push(new InterBrain({ radius: R(30), logoStroke: 1.5, x, y: wy + R(14), z: wz }))
      this.masts.push(new RadioTower({ size: R(24), x, y: wy + R(62), z: wz }))
    }
    const at = (i: number) => ({ x: this.masts[i]!.x.value, y: this.masts[i]!.y.value + R(12), z: this.masts[i]!.z.value })
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[i]!.x - nodes[j]!.x, nodes[i]!.y - nodes[j]!.y)
        if (d < R(248) * 1.1) this.mesh.push(new Line({ points: [at(i), at(j)], tint: BLUE, stroke: 1.6 }))
      }
    this.tribe3d = new Layer({ members: [this.tilted, ...this.mesh, ...this.crystals, ...this.masts], x: X(614), y: Y(390) })
    void this.incoherent.parts

    this.hol2 = this.layer(
      this.hol2Centre,
      ...this.hol2Comps,
      ...this.hol2Comps.map((c) => new ImportLines({ between: [c, this.hol2Centre], stroke: 1.6 })),
    )
    // ImportLines read in the root frame by default; inside a Layer at the origin that is the same frame.

    // F: the talks of f10921, and the song.
    this.songShot = this.layer(this.song, this.songLabel, ...this.talks, this.talkLabel, this.weave, this.weaveLabel, this.compressedLabel)

    // G: the Logo's holarchy (f11026).
    {
      const centre = new DreamNode({ radius: R(64), ringStroke: 3, face: new Logo({ radius: 200 }), x: X(636), y: Y(340) })
      const seconds = [
        [ib, 500, 276],
        [dt, 780, 276],
        [vision, 636, 480],
      ] as const
      const outerFaces: (() => Holon)[] = [
        () => icon("filmStrip", { size: 120 }),
        () => icon("musicNote", { size: 120 }),
        () => icon("gameController", { size: 120 }),
        () => icon("book", { size: 120 }),
        () => icon("compass", { size: 120 }),
        () => icon("radioTower", { size: 120 }),
        () => icon("laptop", { size: 120 }),
        () => new Vision({ radius: 100, tint: RED, ring: 1 }),
        () => icon("atom", { size: 120 }),
      ]
      const outer = [
        [[524, 64], [372, 200], [344, 390]],
        [[750, 64], [910, 200], [932, 390]],
        [[456, 564], [636, 620], [824, 564]],
      ]
      const g = new Layer({ members: [] })
      const nodesG: DreamNode[] = [centre]
      const linesG: ImportLines[] = []
      seconds.forEach(([f, x, y], k) => {
        const s = new DreamNode({ radius: R(52), ringStroke: 2.5, face: f(), x: X(x), y: Y(y) })
        nodesG.push(s)
        linesG.push(new ImportLines({ between: [s, centre], frame: () => g, stroke: 1.4 }))
        outer[k]!.forEach(([ox, oy], j) => {
          const o = new DreamNode({ radius: R(54), ringStroke: 2, face: outerFaces[k * 3 + j]!(), x: X(ox!), y: Y(oy!) })
          nodesG.push(o)
          linesG.push(new ImportLines({ between: [o, s], frame: () => g, stroke: 1.4 }))
        })
      })
      for (const h of [...linesG, ...nodesG]) g.attach(h)
      this.holLogo = g
    }

    // I: the web of f11131 — the holarchy at 0.825, three peers round each source.
    const peerAt = [
      [284, 100], [538, 100], [410, 306],
      [742, 100], [996, 100], [870, 306],
      [518, 448], [760, 448], [640, 656],
    ]
    this.peers = peerAt.map(([x, y], i) => new DreamNode({ kind: "dreamer", face: DREAMER_FACES[i % 4]!(), radius: R(36), ringStroke: 2, x: X(x!), y: Y(y!) }))
    const srcAt = [
      [640, 520, 90],
      [870, 170, 90],
      [410, 170, 90],
      [645, 258, 104],
    ]
    this.rings = srcAt.map(([x, y, r]) => new Resonance({ radius: R(r!), x: X(x!), y: Y(y!), amount: 0 }))
    this.webR = this.layer(this.holR.group, ...this.peers, this.burst, ...this.rings)

    this.peers6 = [0, 1, 2, 3, 4, 5].map((k) => {
      const a = (k * Math.PI) / 3
      return new DreamNode({ kind: "dreamer", face: DREAMER_FACES[k % 4]!(), radius: R(36), ringStroke: 2, x: Math.cos(a) * R(176), y: Y(352) + Math.sin(a) * R(176) })
    })
    this.rings6 = this.peers6.map((p) => new Resonance({ radius: R(36), x: p.x.value, y: p.y.value, amount: 0 }))
    this.web6 = this.layer(this.centreR, ...this.peers6, ...this.rings6)

    // J
    const eq = new Layer({ members: [] })
    this.importC = new ImportLines({ between: [this.srcC, this.cNode], frame: () => eq, stroke: 1.6 })
    this.importS = new ImportLines({ between: [this.srcS, this.sNode], frame: () => eq, stroke: 1.6 })
    for (const h of [this.importC, this.importS, this.whole, this.srcC, this.srcS, this.cNode, this.sNode, this.times, this.equals, this.plus, this.sumCyl, this.muddied])
      eq.attach(h)
    this.equation = eq

    // K: the lattice of InterBrains (127 px apart, f11341), a cylinder node at its heart.
    const s = R(127)
    for (let row = -3; row <= 3; row++)
      for (let col = -6; col <= 6; col++) {
        const x = (col + (row % 2 ? 0.5 : 0)) * s
        const y = row * s * Math.sin(Math.PI / 3)
        if (Math.abs(x) > R(700)) continue
        const d = Math.hypot(x, y) / s
        if (d < 0.1) continue
        this.latticeNodes.push(new DreamNode({ radius: R(30), ringStroke: 1.4, dreamTint: RED, face: new InterBrain({ radius: 100, logoStroke: 1 }), x, y }))
        if (d < 2.1) this.cylNodes.push(new DreamNode({ radius: R(30), ringStroke: 2, face: foundingCylinder({ stroke: 1.6 }), x, y }))
      }
    this.cylNodes.unshift(new DreamNode({ radius: R(30), ringStroke: 2, face: foundingCylinder({ stroke: 1.6 }) }))
    this.lattice = this.layer(...this.latticeNodes)

    // N
    this.chain = tunnelChain(this.chainGroup)

    // P: narratives (blue nodes holding the narrative's square), visions, dreamers.
    const hex = (r: number, k: number) => ({ x: Math.cos((k * Math.PI) / 3 + Math.PI / 6) * R(r), y: Math.sin((k * Math.PI) / 3 + Math.PI / 6) * R(r) })
    this.narratives = [0, 1, 2, 3, 4, 5].map((k) => new DreamNode({ radius: R(26), ringStroke: 2, faceFill: 0.6, face: new Square({ size: 200, tint: WHITE, stroke: 2.5 }), ...hex(270, k) }))
    this.narrSwarm = new Field({
      mode: "swarm",
      reach: R(22),
      stroke: 1.4,
      count: 1400,
      shape: this.narratives.map((n) => Array.from({ length: 25 }, (_, j) => ({ x: n.x.value + Math.cos((j / 24) * 2 * Math.PI) * R(30), y: n.y.value + Math.sin((j / 24) * 2 * Math.PI) * R(30), z: 0 }))),
    })
    this.visions = [0, 1, 2, 3, 4, 5].map((k) => new Vision({ radius: R(40), tint: RED, ring: 1, light: 1, ...hex(170, k) }))
    this.dreamers = [0, 1, 2, 3, 4, 5].map((k) => new DreamNode({ kind: "dreamer", face: DREAMER_FACES[k % 4]!(), radius: R(26), ringStroke: 2, ...hex(290, k) }))
    this.mediumShot = this.layer(this.sphereBurst, this.medium, this.dense, ...this.narratives, this.narrSwarm, this.inner, ...this.visions, ...this.dreamers)
  }

  protected beats(): void {
    this.ancientToModern()
    this.tribeIn3D()
    this.foundingCylinderBeat()
    this.importBeat()
    this.songBeat()
    this.webBeat()
    this.equationBeat()
    this.latticeBeat()
    this.beaconBeat()
    this.axisBeat()
    this.tunnelBeat()
    this.sphereBeat()
  }

  private ancientToModern(): void {
    this.shot(this.timeline, 2084, 2104.5, 1.2, 1)
    this.at(2086.5, 1, this.fade(this.book, 0))
    this.at(2087, 1.2, this.tower.x.to(0))
    this.at(2097.4, 0.6, Create(this.towerBox))
    this.at(2099.4, 0.6, UnCreate(this.towerBox))
  }

  private tribeIn3D(): void {
    this.shot(this.tribe3d, 2104.5, 2120.5, 1.5, 1.5)
    this.shot(this.vortexShot, 2119.5, 2129, 1.2, 1.2)
    this.at(2119.5, 4, this.vortex.swirl.to(0.8))
    this.at(2123, 3, this.vortex.fragment.to(HEX), this.vortex.swirl.to(0))
  }

  private foundingCylinderBeat(): void {
    const { circle, square, cyl, cylTower } = this
    this.shot(this.founding, 2127.5, 2146, 1.5, 1.2)
    this.at(2130.5, 1.5, circle.fillOpacity.to(0.55), square.fillOpacity.to(0.45))
    this.at(2136.5, 2, circle.x.to(X(612)), square.x.to(X(668)), circle.y.to(Y(380)), square.y.to(Y(380)))
    this.at(2138.5, 1.5, this.fade(circle, 0), this.fade(square, 0), Create(cyl))
    this.at(2127.4, 0.01, cylTower.scale.sequence(0, 0))
    this.at(2139.4, 0.01, cylTower.scale.to(1))
    this.at(2139.5, 1, Create(cylTower))
    this.at(2140.5, 1.6, cylTower.broadcast.to(1))
    this.at(2143, 1, this.fade(cylTower, 0))
  }

  private importBeat(): void {
    const { group, parent, sources, lines } = this.hol
    this.shot(group, 2144.5, 2165.5, 0.5, 0.8)
    this.at(2144.5, 2.5, ...sources.map((s) => Create(s)))
    this.at(2148.5, 2.5, Create(parent))
    this.at(2150.5, 1.5, ...lines.map((l) => Create(l)))
    this.shot(this.hol2, 2165.3, 2171.6, 1, 0.8)
    // Back to the first holarchy, then down to its one node (f10861 → f10881).
    const back = holarchy(SONG_FACES, 126, 102, 288, { y: Y(305) })
    this.shot(back.group, 2171.4, 2178.4, 0.8, 1)
    this.at(2173, 1.2, ...back.sources.map((s) => this.fade(s, 0)), ...back.lines.map((l) => this.fade(l, 0)))
    this.at(2174.2, 1.8, back.parent.radius.to(R(180)), back.group.y.to(Y(344)))
  }

  private songBeat(): void {
    const { song, songLabel, talks, talkLabel, weave, weaveLabel, compressedLabel } = this
    const [a, b, c] = talks
    this.shot(this.songShot, 2177.4, 2203.2, 1, 1)
    this.at(2177.4, 1.6, Create(song))
    this.at(2179.5, 1, Create(songLabel))
    // DreamTalk ↔ DreamSong (f10921).
    this.at(2182.4, 1.6, song.x.to(X(832)), song.y.to(Y(326)), songLabel.x.to(X(832)), songLabel.y.to(Y(640)), songLabel.tint.to(RED))
    this.at(2183, 1.5, ...talks.map((t) => Create(t)), Create(talkLabel))
    // DreamWeaving (f10951).
    const WOVEN = [[519, 541], [573, 443], [464, 443]] as const
    this.at(
      2187,
      1.8,
      song.radius.to(R(58)),
      song.x.to(X(745)),
      song.y.to(Y(245)),
      songLabel.x.to(X(745)),
      songLabel.y.to(Y(249)),
      talkLabel.x.to(X(519)),
      talkLabel.y.to(Y(491)),
      ...talks.flatMap((t, i) => [t.x.to(X(WOVEN[i]![0])), t.y.to(Y(WOVEN[i]![1])), t.radius.to(R(31))]),
    )
    this.at(2188.8, 1.4, Create(weave), Create(weaveLabel))
    // The song alone (f10961), compressed into the Logo (f10981).
    this.at(2190.8, 1, UnCreate(weave), UnCreate(weaveLabel), UnCreate(talkLabel), UnCreate(a!), UnCreate(b!), UnCreate(c!))
    this.at(2191.85, 0.01, ...talks.map((t) => t.scale.to(0)))
    this.at(2191, 1.5, song.radius.to(R(192)), song.x.to(0), song.y.to(Y(312)), songLabel.x.to(0), songLabel.y.to(Y(548)), songLabel.tint.to(WHITE))
    this.at(2193.2, 2.4, this.song.stateAxis("compress").to("symbol"), song.radius.to(R(240)), song.y.to(Y(320)), UnCreate(songLabel), Create(compressedLabel))
  }

  private webBeat(): void {
    // G. The emergent holarchy round the Logo.
    this.shot(this.holLogo, 2203.2, 2211.8, 1, 0.8)
    // H. DreamWeaving ── broadcast.
    this.shot(this.weaveTower, 2211.6, 2221.6, 1, 0.8)
    // I. Resonance through the web.
    const { group, parent, sources, lines } = this.holR
    this.shot(this.webR, 2221.4, 2238.8, 1, 0.8)
    this.at(2221.3, 0.01, group.scale.sequence(0.6, 0.6), group.y.sequence(Y(330), Y(330)))
    this.at(2222.8, 1.6, ...sources.map((s) => Create(s)), ...lines.map((l) => Create(l)))
    this.at(2224.2, 1.6, group.scale.to(104 / 126), group.y.to(Y(258)))
    this.at(2225.2, 1.4, ...this.peers.map((p) => Create(p)))
    this.at(2229, 1, Create(this.burst))
    this.clock(this.burst.time, 2229, 2233, 0, 1)
    this.at(2231.5, 1, this.fade(this.burst, 0))
    this.at(2230.8, 1, ...this.rings.map((r) => r.amount.to(1)))
    for (const r of this.rings) this.clock(r.time, 2230.8, 2238, 0, 1)
    this.at(2236, 2, ...this.rings.map((r) => r.amount.to(0)))
    void parent
    this.shot(this.web6, 2239, 2253, 1, 1)
    this.at(2242, 1, ...this.rings6.map((r) => r.amount.to(1)))
    for (const r of this.rings6) this.clock(r.time, 2242, 2251, 0, 1)
    this.at(2246, 1.5, ...this.rings6.map((r) => r.reach.to(4)))
    this.at(2249.5, 1.5, ...this.rings6.map((r) => r.amount.to(0)))
  }

  private equationBeat(): void {
    const { whole, srcC, srcS, cNode, sNode, times, equals, plus, sumCyl, muddied, importC, importS } = this
    this.shot(this.equation, 2253.4, 2263.8, 0.8, 0.8)
    this.shot(this.equation, 2275.6, 2281.4, 0.6, 0.8)
    this.at(2256.3, 1.2, this.fade(srcC, 0), this.fade(srcS, 0), this.fade(importC, 0), this.fade(importS, 0))
    this.at(2256.5, 1.5, whole.radius.to(R(234)), cNode.x.to(X(490)), sNode.x.to(X(660)), cNode.radius.to(R(64)), sNode.radius.to(R(64)))
    this.at(2259.4, 0.8, Create(times), Create(equals))
    this.at(2260, 2, Create(sumCyl))
    // f11381 → f11401: the cylinder goes, + and the muddied square.
    this.at(2276.8, 0.8, UnCreate(times), UnCreate(sumCyl))
    this.at(2277.2, 0.8, Create(plus))
    this.at(2278.6, 1.2, Create(muddied))
  }

  private latticeBeat(): void {
    const { lattice, cylNodes, latticeRing } = this
    const tribe = this.layer(...cylNodes, latticeRing)
    this.shot(lattice, 2264.8, 2275.6, 1.2, 0.8, 0.3)
    this.at(2264.6, 0.01, ...this.latticeNodes.map((n) => this.fade(n, 0.3)))
    this.shot(tribe, 2264.8, 2275.6, 1.2, 0.8)
    this.at(2268.4, 1.2, ...cylNodes.slice(1, 7).map((n) => Create(n)))
    this.at(2270.6, 1.4, ...cylNodes.slice(7).map((n) => Create(n)))
    this.at(2271, 1, latticeRing.amount.sequence(0, 1))
    this.clock(latticeRing.time, 2271, 2275.6, 0, 1)
    // The incoherent node sinks into the dim lattice in its swarm (f11411–f11431).
    const sinking = this.layer(this.muddyNode, this.muddySwarm)
    this.shot(sinking, 2281.4, 2288.6, 0.6, 0.6)
    this.shot(lattice, 2281.4, 2287.6, 0.8, 1, 0.3)
    this.at(2283, 1.2, Create(this.muddySwarm))
    this.clock(this.muddySwarm.time, 2283, 2289, 0, 1)
  }

  private beaconBeat(): void {
    const b = this.beacon
    this.shot(this.beaconShot, 2288.3, 2313.6, 0.8, 1.2)
    this.clock(b.time, 2288.3, 2313.6, 0, 1)
    this.at(2288.3, 2.6, Create(b))
    this.at(2292, 4, b.reach.to(1))
    this.at(2297, 1, Create(this.beaconTitle))
    this.at(2299, 1.4, b.noise.to(0), UnCreate(this.beaconTitle))
    // freedom of speech × … (f11511 → f11541): the incoherent first, then the beacon takes its place.
    this.shot(this.equationF, 2301.4, 2313.6, 0.8, 1.2)
    this.at(2301.3, 0.01, this.fade(this.incoherent.node, 0), this.fade(this.incoherent.link, 0), this.fade(this.incoherent.burst, 0))
    this.clock(this.incoherent.time, 2301.4, 2306, 0, 1)
    this.at(2304.6, 1, this.fade(this.incoherent, 0), this.fade(this.boltF, 0))
    this.at(2304.6, 1.4, b.y.to(Y(380)), b.reach.to(0.25))
    this.at(2306.6, 0.8, Create(this.arrowF))
  }

  private axisBeat(): void {
    const d = this.dialectic
    this.shot(this.axisShot, 2314.6, 2336.4, 1, 1.4)
    this.at(2314.5, 0.01, this.field.opacity.sequence(0, 0))
    this.clock(d.phase, 2314.6, 2336.4, 0, 1.6)
    this.clock(this.field.time, 2314.6, 2336.4, 0, 1)
    this.at(2316.5, 2, this.field.opacity.to(0.85), d.p.to(-0.8))
    this.at(2322.5, 1.5, d.p.to(0), d.trace.to(0))
    this.at(2323.5, 3, d.third.to(1), d.y.to(Y(300)))
    this.at(2324, 4, this.field.wholeness.to(1, { easing: "linear" }))
  }

  private tunnelBeat(): void {
    this.shot(this.tunnel, 2335.2, 2356.4, 1.2, 1.2)
    this.clock(this.warp.time, 2335.2, 2356.4, 0, 1)
    this.at(2335.2, 21.2, this.chainGroup.z.sequence(150, 950), this.chainGroup.x.sequence(250, -150))
  }

  private sphereBeat(): void {
    const { medium, dense, narratives, narrSwarm, inner, visions, dreamers, sphereBurst } = this
    this.shot(this.lensShot, 2355.6, 2361.6, 1, 0.8)
    this.shot(this.mediumShot, 2361.2, 2445.5, 1, 1.5)
    this.at(2361.1, 2, medium.swirl.to(0.5))
    this.at(2362.6, 2.4, medium.fragment.to(HEX), medium.swirl.to(0))
    this.at(2367.5, 2.5, medium.fragment.to(0))
    this.at(2374.5, 2, medium.flat.to(0), medium.radius.to(R(193)))
    this.at(2376, 2, medium.interbrain.to(1))
    this.clock(medium.spin, 2374.5, 2412, 0.35, 0.05)
    // The narratives come (f11951), are swarmed (f11961), enter and turn (f11981).
    this.at(2389, 1.2, ...narratives.map((n) => Create(n)))
    this.at(2391, 1, Create(narrSwarm))
    this.clock(narrSwarm.time, 2391, 2430, 0, 1)
    this.at(2393, 1.6, ...narratives.map((n) => n.scale.to(0.55)), ...narratives.map((n) => n.x.to(n.x.value * 0.45)), ...narratives.map((n) => n.y.to(n.y.value * 0.45)), narrSwarm.dissolve.to(1))
    this.at(2394.6, 0.8, ...narratives.map((n) => this.fade(n, 0)))
    this.at(2395.2, 1, Create(inner))
    this.at(2400, 2, medium.radius.to(R(120)), this.fade(inner, 0))
    this.at(2401, 1, Create(sphereBurst), sphereBurst.radius.to(R(120)))
    this.clock(sphereBurst.time, 2401, 2431, 0, 1)
    this.at(2401.4, 1, ...visions.map((v) => Create(v)))
    this.at(2402.4, 1.6, ...visions.flatMap((v) => [v.x.to(v.x.value * 1.7), v.y.to(v.y.value * 1.7)]))
    this.at(2404.6, 1, ...visions.map((v) => this.fade(v, 0)), medium.radius.to(R(80)), sphereBurst.radius.to(R(80)), sphereBurst.reach.to(R(130)))
    this.at(2407, 1, ...dreamers.map((n) => Create(n)))
    this.at(2408.8, 1.6, ...dreamers.flatMap((n) => [n.x.to(n.x.value * 0.3), n.y.to(n.y.value * 0.3), n.scale.to(0.5)]), sphereBurst.opacity.to(0.3))
    this.at(2410.4, 1, ...dreamers.map((n) => this.fade(n, 0)), medium.radius.to(R(48)), sphereBurst.opacity.to(0))
    // The dense sphere (f12071): the garden grown fine.
    this.at(2412.4, 0.01, this.fade(medium, 0))
    this.at(2412.4, 1.6, Create(dense), dense.radius.sequence(R(48), R(224)))
    this.clock(dense.spin, 2412.4, 2445.5, 0.35, 0.04)
    // The narratives again (f12091 → f12111 → f12131).
    const again = narratives.map((n) => n.scale.to(1))
    this.at(2416.2, 0.01, ...again, ...narratives.map((n, k) => n.x.to(Math.cos((k * Math.PI) / 3 + Math.PI / 6) * R(290))), ...narratives.map((n, k) => n.y.to(Math.sin((k * Math.PI) / 3 + Math.PI / 6) * R(290))), narrSwarm.dissolve.to(0))
    this.at(2416.4, 1.2, ...narratives.map((n) => this.fade(n, 1)), ...narratives.map((n) => n.creation.to(1)))
    this.at(2421, 1.4, ...narratives.flatMap((n) => [n.x.to(n.x.value * 0.2), n.y.to(n.y.value * 0.2), n.scale.to(0.5)]), narrSwarm.dissolve.to(1))
    this.at(2422.4, 0.8, ...narratives.map((n) => this.fade(n, 0)))
    this.at(2421, 0.01, this.fade(inner, 1))
    this.at(2423.4, 1, sphereBurst.opacity.to(1), sphereBurst.radius.to(R(224)), sphereBurst.reach.to(R(220)))
    this.at(2423.4, 0.01, ...visions.map((v, k) => v.x.to(Math.cos((k * Math.PI) / 3 + Math.PI / 6) * R(110))), ...visions.map((v, k) => v.y.to(Math.sin((k * Math.PI) / 3 + Math.PI / 6) * R(110))))
    this.at(2423.4, 0.8, ...visions.map((v) => this.fade(v, 1)), this.fade(inner, 0))
    this.at(2424.2, 2, ...visions.flatMap((v, k) => [v.x.to(Math.cos((k * Math.PI) / 3 + Math.PI / 6) * R(290)), v.y.to(Math.sin((k * Math.PI) / 3 + Math.PI / 6) * R(290))]))
    // The drawing hands (placeholder): the sphere darkens, small, and is drawn red again.
    this.at(2430, 1.5, ...visions.map((v) => this.fade(v, 0)), sphereBurst.opacity.to(0), dense.radius.to(R(125)), this.fade(dense, 0.35))
    this.at(2436, 4, this.fade(dense, 1))
  }
}

if (import.meta.main) render(Ch7BreakingTheSpellDream)
