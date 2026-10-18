/**
 * Ch6IntroducingInterBrain — chapter 6 of the InterBrain film,
 * "Introducing the InterBrain" (video 1593–2070 s;
 * docs/reports/interbrain-vocabulary.md §2 Ch 6).
 *
 * Local t = video t − 1593; layouts in frame px (1280 × 720, origin the
 * centre, y up) at the default eye's 0.48 px per unit, measured off frames5.
 *
 *   1596    the title card
 *   1603    the person ⇅ the second brain, recap (f8011); 1609 the
 *           worldview ↔ the vortex (f8046)
 *   1619    Personal → Collective: three liminal minds ⇅ the InterBrain in
 *           its overlapping red rings (f8146, f8221); "Management" (f8236)
 *   1653    the Vault: knowledge managed (f8281, f8326)
 *   1671    Ancient → book → radio tower → Modern (f8386)
 *   1689    … Collective Knowledge Gardening (f8491)
 *   1701    second brain → InterBrain; the document → "?" (f8506, f8551)
 *   1717    Sand Talk (f8656)
 *   1741    Digital SandTalk → DreamTalk (f8716, f8761)
 *   1763    the GitRepo ring; film / book / music / game round it; DreamNode
 *           (f8836, f8986, f9076)
 *   1819    seed → vision inside the node; the commit chain (f9126, f9171)
 *   1841    the InterBrain's own node; Dreamer and Dream (f9206, f9271)
 *   1865    the DreamGarden (f9406)
 *   1885    the InterBrain; the digital campfire, cross-pollination (f9451, f9541)
 *   1923    the garden → the liminal web's tour (f9646 … f9721)
 *   1955    Ancient → Modern again; the conversation round a node (f9826);
 *           the campfire (f9846)
 *   1975    the Earth, calls round the globe (f9886, f9916)
 *   1989    two InterBrains → the InterBrain lattice (f9966, f9991)
 *   2005    a node's journey; the SongLine (f10036, f10141)
 *   2041    the lattice; a tribe of it resonates (f10306, f10321)
 *
 * Third-party marks: the second brain is the neutral `notes` face
 * (vocabulary/Icons, §6), the InterBrain is our own face (vocabulary/InterBrain).
 *
 * Residuals: the Jesus portrait at the liminal web's last stop (the tour
 * ends on David's, LiminalWeb's own tour); the S-divide with book and
 * campfire (f9806, 2 s) is left black; the C4D-shaded campfire crystals are
 * the flat InterBrain; the lattice's edges are Tribe's bands with their
 * campfires, not the film's infinity loops; the bloom of red particles at
 * 2055 is not drawn; the commit chain is four SongLine clips.
 */

import { render } from "../../src/index"
import { together } from "../../src/anim"
import { Group, Line } from "../../src/parts/primitives"
import { BLUE, RED, WHITE } from "../../src/constants"
import { Layer } from "../../vocabulary/Figure/Figure"
import { Create } from "../../src/verbs"
import { CHAPTERS, titleCard } from "./film"
import { ChapterDream, PX, arrow, label, layer, notes, pkm, u, vortex } from "./Ch5FixingTheLens"
import { LENS, SOURCE, Worldview } from "../../vocabulary/Worldview/Worldview"
import { Mind } from "../../vocabulary/Mind/Mind"
import { InterBrainGem } from "../../vocabulary/InterBrain/InterBrainGem"
import { DreamNode } from "../../vocabulary/DreamNode/DreamNode"
import { Vault } from "../../vocabulary/Vault/Vault"
import { Tribe } from "../../vocabulary/Tribe/Tribe"
import { Book } from "../../vocabulary/Book/Book"
import { RadioTower } from "../../vocabulary/RadioTower/RadioTower"
import { icon } from "../../vocabulary/Icons/Icons"
import { SandTalk } from "../../vocabulary/SandTalk/SandTalk"
import { DreamTalkSymbol } from "../../vocabulary/DreamTalkSymbol/DreamTalkSymbol"
import { DreamGarden } from "../../vocabulary/DreamGarden/DreamGarden"
import { DigitalCampfire } from "../../vocabulary/DigitalCampfire/DigitalCampfire"
import { LiminalWeb } from "../../vocabulary/LiminalWeb/LiminalWeb"
import { Clip, SongLine } from "../../vocabulary/SongLine/SongLine"
import { Earth, Place } from "../../vocabulary/Earth/Earth"
import { Connection } from "../../vocabulary/Earth/Connection"
import { Resonance } from "../../vocabulary/Resonance/Resonance"
import { Square } from "../../../holons/Square/Square"

const CH = CHAPTERS[5]!

/** An InterBrain in a red ring, `r` px, at (x, y) px. */
const brainNode = (r: number, x = 0, y = 0, kind: "dream" | "dreamer" = "dreamer") =>
  new DreamNode({ radius: u(r), ringStroke: 2.5, kind, face: new InterBrainGem({ radius: 200, logoStroke: 2 }), x: u(x), y: u(y) })

/** Ancient → book → radio tower → Modern (f8386). */
const timeline = () =>
  layer(
    new Tribe({ size: u(90), rings: 1, modern: 0, stroke: 1.8, x: u(-420) }),
    arrow(-262, 0, 256, 0, false, 2),
    new Line({ points: [{ x: u(-104), y: u(-8), z: 0 }, { x: u(-104), y: u(8), z: 0 }], stroke: 1.5 }),
    new Line({ points: [{ x: u(104), y: u(-8), z: 0 }, { x: u(104), y: u(8), z: 0 }], stroke: 1.5 }),
    new Book({ size: u(72), x: u(-104), y: u(-50) }),
    new RadioTower({ size: u(60), x: u(104), y: u(-50) }),
    new Tribe({ size: u(90), rings: 1, modern: 1, stroke: 1.8, x: u(432) }),
    label("Ancient", -420, -148, 15),
    label("Modern", 432, -148, 15),
  )

export class Ch6IntroducingInterBrainDream extends ChapterDream {
  chapter = CH

  // 1603: Personal Knowledge Management, then Collective (f8011 … f8236).
  p = pkm(0)
  pkmG = new Group({ members: [...this.p.all, this.p.personal, this.p.knowledge, this.p.management, this.p.second] })
  pkmL = layer(this.pkmG)
  busts = [-110, 0, 110].map((dx) => new Mind({ size: u(190), liminal: 1, framed: 0, x: u(240 + dx), y: u(80) }))
  collective = layer(label("Collective", 240, 272, 26, RED), arrow(-124, 0, -20, 0, false, 3), ...this.busts)
  brains = [-90, 90, 0].map((dx) => brainNode(80, 240 + dx, -196))
  shared = layer(
    ...[-110, 0, 110].flatMap((dx) => [arrow(240 + dx - 14, -10, 240 + dx - 14, -112), arrow(240 + dx + 14, -112, 240 + dx + 14, -10)]),
    ...this.brains,
    label("InterBrain", 240, -302, 13),
  )
  gardening = layer(label("Knowledge", 240 - 148, 230, 26, WHITE, "left"), label("Gardening", 240 + 12, 230, 26, RED, "left"))

  // 1609: the worldview ↔ the vortex, recalled (f8046).
  wv = new Worldview({ globes: [], source: SOURCE.earth, lens: LENS.lattice, distortion: 1, strings: 1, x: u(-330), y: u(-15), scale: 0.45 })
  vx = vortex(u(196), 1.05)
  recall = layer(this.wv, arrow(-58, 0, 58, 0, true, 3), new Group({ x: u(340), scale: 0.68, members: [this.vx.whole] }))

  // 1653: the Vault (f8326).
  vault = new Vault({ grow: 1 })
  vaultG = new Group({ members: [this.vault] })
  vaultL = layer(this.vaultG)

  // 1671 / 1955: Ancient → Modern.
  era = timeline()
  era2 = timeline()

  // 1701: second brain → InterBrain; the document → "?" (f8506, f8551).
  brain2 = layer(notes(216, -290, 20))
  doc = layer(new Square({ size: u(216), tint: BLUE, stroke: 2, x: u(-290), y: u(20) }), icon("document", { size: u(150), tint: BLUE, stroke: 2, x: u(-290), y: u(20) }))
  ibRing = new DreamNode({ radius: u(120), ringStroke: 2.5, kind: "dreamer", face: null, x: u(280), y: u(20) })
  ibFace = layer(new InterBrainGem({ radius: u(100), logoStroke: 2, x: u(280), y: u(20) }))
  question = layer(label("?", 280, -10, 90))
  unit = layer(arrow(-30, 20, 25, 20, false, 3), this.ibRing, label("Second Brain", -290, -130, 13), label("InterBrain", 280, -130, 13))

  // 1717: Sand Talk (f8656), its radiant sand symbol arriving last.
  sand = new DreamTalkSymbol({ globe: 0.001, resolution: 0.25, landOpacity: 0, bloomOpacity: 0, latticeOpacity: 0, ringTint: WHITE, ringOpacity: 0, rayOpacity: 0 })
  sandTalk = new SandTalk({ size: u(424), symbol: this.sand, y: u(10) })
  sandL = layer(this.sandTalk)
  sandLabel = layer(label("Sand Talk", 0, -244, 30))

  // 1741: Digital SandTalk → DreamTalk → GitRepo → DreamNode (f8761, f8986).
  dts = new DreamTalkSymbol({ resolution: 0.5 })
  node = new DreamNode({ radius: u(214), face: this.dts, y: u(50), scale: 1.21 })
  nodeL = layer(this.node)
  digital = layer(label("Digital SandTalk", 0, -230, 30))
  dreamtalk = layer(label("DreamTalk", 0, -230, 30))
  gitrepo = layer(label("GitRepo", 0, -230, 30))
  dreamnode = layer(label("DreamNode", 0, -230, 30))
  media = (
    [
      ["filmStrip", -350, 210],
      ["book", 320, 220],
      ["musicNote", -340, -110],
      ["gameController", 316, -130],
    ] as const
  ).map(([name, x, y]) => ({ g: new Group({ y: u(50), members: [icon(name, { size: u(96), tint: WHITE, stroke: 2 })] }), x, y }))
  mediaL = layer(...this.media.map((m) => m.g))

  // 1831: the commit chain inside a node (f9171).
  chain = new Group({
    x: u(900),
    members: [
      new DreamNode({ radius: u(234), ringStroke: 2.5, face: null }),
      ...[-135, -45, 45, 135].map((x) => new Clip({ size: u(30), x: u(x) })),
    ],
  })
  chainL = layer(this.chain)

  // 1841: the InterBrain's own node; Dreamer and Dream (f9206, f9271).
  ibNode = brainNode(233, 0, 0, "dream")
  ibNodeL = layer(this.ibNode)
  dreamer = layer(new DreamNode({ radius: u(164), ringStroke: 2.5, kind: "dreamer", x: u(-246) }))
  dreamLabel = layer(label("Dream", 210, -224, 16))
  dreamerLabel = layer(label("Dreamer", -246, -224, 16))

  // 1865: the DreamGarden (f9406); 1885: the InterBrain that holds it.
  garden = new DreamGarden({})
  gardenL = layer(this.garden)
  gardenLabel = layer(label("DreamGarden", 0, -306, 16))
  holder = brainNode(260)
  holderL = layer(this.holder)

  // 1887: the digital campfire (f9451, f9541).
  fire = new DigitalCampfire({ overlap: 0, talk: 0 })
  fireG = new Group({ y: -38 / PX, members: [this.fire] })
  fireL = layer(this.fireG)

  // 1923: the garden again; the liminal web's tour (f9646 … f9721).
  garden2 = new DreamGarden({ scale: 1.18 })
  garden2L = layer(this.garden2)
  web = new LiminalWeb({ focus: 0 })
  webL = layer(this.web)

  // 1963: the conversation round a node (f9826).
  talk = new Clip({ size: u(190) })
  talkL = layer(this.talk)

  // 1975: the Earth, calls round the globe (f9886, f9916).
  places = [
    [48, 11], [40, -74], [-23, -46], [35, 139], [-33, 151], [28, 77], [6, 3], [55, 37], [19, -99], [-34, 18], [1, 103], [64, -21],
  ].map(([lat, lon]) => new Place({ lat, lon }))
  calls = [
    [0, 1], [0, 3], [1, 2], [3, 4], [5, 6], [6, 9], [7, 0], [8, 1], [10, 4], [11, 0], [2, 9], [5, 10], [7, 3], [8, 2],
  ].map(([a, b]) => new Connection({ ends: [this.places[a!]!, this.places[b!]!], tint: WHITE, stroke: 1.2 }))
  earth = new Earth({ radius: u(250), landOpacity: 0, places: [...this.places, ...this.calls] })
  earthL = layer(this.earth)

  // 1989: the InterBrain lattice (f9966, f9991) — a tribe of InterBrains.
  latticeFaces: InterBrainGem[] = []
  lattice = new Tribe({
    size: u(260),
    rings: 5,
    stroke: 2.4,
    face: (r: number) => {
      const ib = new InterBrainGem({ radius: r * 0.7, logoStroke: 1.5, bloomRings: 4 })
      this.latticeFaces.push(ib)
      return ib
    },
  })
  /** The seven that come first (f9966). */
  seven = new Tribe({ size: u(260), rings: 1, stroke: 2.4, face: (r: number) => new InterBrainGem({ radius: r * 0.7, logoStroke: 1.5, bloomRings: 4 }) })
  sevenL = layer(this.seven)
  latticeL = layer(this.lattice)
  lit = new Tribe({ size: u(126), rings: 2, stroke: 1.6, face: (r: number) => new InterBrainGem({ radius: r * 0.7, logoStroke: 1.5, bloomRings: 4 }) })
  litL = new Layer({ z: 2, members: [this.lit] })
  resonance = new Resonance({ radius: 2 * 126 + 30, amount: 1, reach: 0.3, z: 3 })
  resL = layer(this.resonance)

  // 2005: a node's journey, the SongLine (f10036, f10141).
  hopper = new DreamNode({ radius: u(18), ringStroke: 2, face: new DreamTalkSymbol({ resolution: 0.25 }), x: u(-193), y: u(117) })
  hopL = layer(this.hopper, ...[[-136, 117], [-66, 107], [-26, 52]].map(([x, y]) => new Clip({ size: u(14), x: u(x!), y: u(y!) })))
  songline = new SongLine({ size: u(80), count: 3, grow: 0, y: u(-140) })
  songL = layer(this.songline, label("SongLine", 0, -280, 16))

  unfold() {
    titleCard(this, CH)
    const P = this.p
    void this.node.parts
    void this.fire.parts
    const there = this.fire.gardenL.crossPollinate(1, this.fire.gardenR, () => this.fireG)
    const back = this.fire.gardenR.crossPollinate(2, this.fire.gardenL, () => this.fireG)
    this.fireG.attach(there)
    this.fireG.attach(back)

    // recap
    this.show(this.pkmL, 1602.4, 1.2)
    this.hide(this.pkmL, 1607.2, 1)
    this.show(this.recall, 1607.6, 1.2)
    this.hide(this.recall, 1614.8, 1)
    this.show(this.pkmL, 1615.6, 1.2)

    // Personal → Collective
    this.run(1619, P.personal.tint.to(BLUE), 1.4)
    this.run(1621, this.pkmG.x.to(u(-330)), 2)
    this.show(this.collective, 1624, 2)
    this.show(this.shared, 1633.4, 1.8)
    this.run(1645, P.management.tint.to(BLUE), 1.4)
    for (const l of [this.pkmL, this.collective, this.shared]) this.hide(l, 1651, 1.6)

    // the Vault
    this.show(this.vaultL, 1652.4, 0.1)
    this.run(1652.4, Create(this.vault), 4.6)
    this.run(1667.4, this.vaultG.y.to(u(-260)), 2.2)
    this.hide(this.vaultL, 1668, 1.6)

    // Ancient → Modern
    this.show(this.era, 1669.6, 1.4)
    this.hide(this.era, 1686.6, 1.6)

    // … Collective Knowledge Gardening
    for (const l of [this.pkmL, this.collective, this.shared]) this.show(l, 1688, 1.6)
    this.show(this.gardening, 1693, 1.5)
    for (const l of [this.pkmL, this.collective, this.shared, this.gardening]) this.hide(l, 1697.2, 1.8)

    // the new fundamental unit
    this.show(this.brain2, 1699.4, 1.4)
    this.show(this.unit, 1699.4, 1.4)
    this.show(this.ibFace, 1699.4, 1.4)
    this.hide(this.brain2, 1703.2, 1.6)
    this.show(this.doc, 1703.2, 1.6)
    this.hide(this.ibFace, 1705.2, 1.4)
    this.show(this.question, 1705.6, 1.4)
    for (const l of [this.doc, this.unit, this.question]) this.hide(l, 1715, 1.6)

    // Sand Talk
    this.show(this.sandL, 1715.2, 0.1)
    this.run(1715.4, Create(this.sandTalk), 2.6)
    this.run(1725, together(this.sand.ringOpacity.sequence(0, 1), this.sand.rayOpacity.sequence(0, 0.85)), 2)
    this.show(this.sandLabel, 1726, 1.2)
    this.hide(this.sandL, 1738.6, 2)
    this.hide(this.sandLabel, 1738.6, 2)

    // Digital SandTalk → DreamTalk → GitRepo → DreamNode
    this.show(this.nodeL, 1739.4, 2)
    this.show(this.digital, 1740, 1.5)
    this.hide(this.digital, 1750.4, 1)
    this.show(this.dreamtalk, 1751, 1.4)
    this.hide(this.dreamtalk, 1757, 1.6)
    this.run(1757, this.node.scale.to(1), 3)
    this.run(1761.8, Create(this.node.ring), 3)
    this.show(this.gitrepo, 1774, 1)
    this.show(this.mediaL, 1793, 0.6)
    for (const m of this.media) this.run(1793, together(m.g.x.to(u(m.x)), m.g.y.to(u(m.y))), 2)
    for (const m of this.media) this.run(1811, together(m.g.x.to(0), m.g.y.to(u(50))), 2)
    this.hide(this.mediaL, 1812.4, 0.6)
    this.hide(this.gitrepo, 1811.8, 1)
    this.show(this.dreamnode, 1813, 1.4)
    this.hide(this.dreamnode, 1817.4, 1.6)

    // from humble seed to mighty vision
    const d = this.dts
    this.run(1819, together(d.landOpacity.to(0.3), d.bloomOpacity.to(0), d.rayOpacity.to(0), d.latticeOpacity.to(0)), 2)
    this.run(1825, d.latticeOpacity.to(0.55), 2)
    this.run(1827, together(d.landOpacity.to(1), d.bloomOpacity.to(1), d.rayOpacity.to(0.85)), 2)
    this.run(1829.4, this.node.x.to(u(-900)), 2.6)
    this.show(this.chainL, 1829.4, 0.1)
    this.run(1829.4, this.chain.x.to(0), 2.6)
    this.hide(this.nodeL, 1832, 0.1)
    this.hide(this.chainL, 1838, 1.6)

    // the InterBrain's own node; Dreamer and Dream
    this.show(this.ibNodeL, 1839, 2)
    this.run(1846.8, together(this.ibNode.x.to(u(210)), this.ibNode.scale.to(164 / 233)), 2.4)
    this.show(this.dreamer, 1847.4, 2)
    this.show(this.dreamLabel, 1852.4, 1)
    this.show(this.dreamerLabel, 1856.4, 1)
    for (const l of [this.ibNodeL, this.dreamer, this.dreamLabel, this.dreamerLabel]) this.hide(l, 1863, 1.6)

    // the DreamGarden, and the InterBrain that holds it
    this.show(this.gardenL, 1863.4, 2)
    this.show(this.gardenLabel, 1878.4, 1)
    this.hide(this.gardenLabel, 1881.6, 1)
    this.run(1882, this.garden.h.to(Math.PI / 2, { easing: "easeIn" }), 1.6)
    this.hide(this.gardenL, 1883.5, 0.1)
    this.set(this.holder.h.to(-Math.PI / 2))
    this.show(this.holderL, 1883.6, 0.1)
    this.run(1883.6, this.holder.h.to(0, { easing: "easeOut" }), 1.6)

    // the digital campfire
    this.hide(this.holderL, 1886, 1.2)
    this.show(this.fireL, 1886, 0.1)
    this.run(1886, Create(this.fire), 2.4)
    this.run(1888, this.fire.overlap.to(1), 2)
    this.run(1892.4, this.fire.talk.to(1), 2)
    this.run(1895, together(this.fireG.scale.to(2.4), this.fireG.y.to(-128 / PX), this.fire.gardens.to(1), this.fire.shellOpacity.to(0.4)), 2.6)
    this.run(1905, Create(there), 3)
    this.run(1908.4, Create(back), 3)
    this.hide(this.fireL, 1921, 1.6)

    // the garden → the liminal web
    this.show(this.garden2L, 1921.4, 1.6)
    this.hide(this.garden2L, 1927, 1.4)
    this.show(this.webL, 1927.4, 1.6)
    this.run(1931, this.web.focus.to(1), 2)
    this.run(1936, this.web.focus.to(2), 3)
    this.run(1940, this.web.focus.to(3), 3)
    this.hide(this.webL, 1953, 1.6)

    // Ancient → Modern; the conversation round a node; the campfire
    this.show(this.era2, 1953.8, 1.4)
    this.hide(this.era2, 1958, 1.6)
    this.show(this.talkL, 1961, 1.6)
    this.hide(this.talkL, 1965, 1.4)
    this.show(this.fireL, 1965.4, 1.6)
    this.hide(this.fireL, 1973.4, 1.6)

    // the Earth, calls round the globe
    this.show(this.earthL, 1974.6, 1.4)
    this.run(1974.6, this.earth.h.by(-1.4, { easing: "linear" }), 13)
    this.run(1977, this.earth.landOpacity.to(1), 3)
    this.run(1979.6, together(...this.calls.map((c) => Create(c))), 4)
    this.run(1986, this.earthL.y.to(u(720)), 2)
    this.hide(this.earthL, 1987, 1)

    // the campfire again, shrinking into two InterBrains → the lattice
    this.at(1980)
    this.set(this.fireG.scale.to(1), this.fireG.y.to(-38 / PX), this.fire.gardens.to(0), this.fire.shellOpacity.to(1), this.fire.talk.to(0.4))
    this.set(this.fireL.y.to(u(-720)))
    this.show(this.fireL, 1986, 0.1)
    this.run(1986, this.fireL.y.to(0), 2)
    this.run(1989, together(this.fireG.scale.to(0.32), this.fireG.y.to(u(250))), 2)
    this.hide(this.fireL, 1990.6, 1.4)
    this.show(this.sevenL, 1991, 0.1)
    this.run(1991, Create(this.seven), 2.4)
    this.show(this.latticeL, 1994.2, 1.2)
    this.hide(this.sevenL, 1995.4, 0.1)
    this.run(1994, this.lattice.scale.to(126 / 260), 5)
    // the lattice recedes (f10006): its lines by presence, its crystals by their own wash
    void this.lattice.parts
    const dim = (k: number) => together(this.latticeL.presence.to(k), ...this.latticeFaces.flatMap((f) => [f.facetOpacity.to(0.7 * k), f.edgeOpacity.to(k)]))
    this.run(2003, dim(0.4), 2)

    // a node's journey; the SongLine
    this.show(this.hopL, 2005, 1)
    this.run(2007, together(this.hopper.x.to(u(-80))), 1.6)
    this.run(2009.4, together(this.hopper.x.to(u(-53)), this.hopper.y.to(u(97))), 1.6)
    this.run(2012, together(this.hopper.x.to(0), this.hopper.y.to(u(5))), 1.6)
    this.run(2014.4, together(this.hopper.x.to(u(113)), this.hopper.y.to(u(3))), 1.6)
    this.hide(this.latticeL, 2016.4, 1.6)
    this.hide(this.hopL, 2017.4, 1.2)
    this.show(this.songL, 2017.6, 1.2)
    this.run(2017.8, this.songline.grow.to(1), 2)
    this.hide(this.songL, 2039, 1.4)

    // the lattice; a tribe of it resonates
    this.at(2039.6)
    this.set(this.latticeL.x.to(0))
    this.run(2039.6, dim(0.4), 1.6)
    this.show(this.litL, 2059.4, 2.4)
    this.show(this.resL, 2061, 1)
    this.run(2061, this.resonance.time.by(9, { easing: "linear" }), 9)
    for (const l of [this.latticeL, this.litL, this.resL]) this.hide(l, 2068.4, 1.6)

    this.end()
  }
}

if (import.meta.main) render(Ch6IntroducingInterBrainDream)
