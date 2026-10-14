/**
 * GrainDemo.ts — the material symbols, and the grain of knowledge.
 *
 * `?scene=materials` — the shelf: Pallet (sacks, octabin), FilmReel,
 * Pouch, SheetStack, in a three-quarter view that turns, so their lines
 * are seen to be 3D.
 *
 * `?scene=grain` — the grain of knowledge (vocabulary/Grain): see below.
 */

import { Create, Dream, render, together, type Anim } from "../src/index"
import { BLUE, GREEN, RED, WHITE, rgb, type Color } from "../src/constants"
import { derive } from "../src/params"
import { Text } from "../src/parts/text"
import type { Overrides } from "../src/holon"
import { Group, Line } from "../src/parts/index"
import type { SolidDrawing } from "../src/parts/soliddrawing"
import { Factory } from "../vocabulary/Earth/Factory"
import { FlowMap, MOCK_FLOWMAP } from "../vocabulary/FlowMap/FlowMap"
import { Grain, RUNG } from "../vocabulary/Grain/Grain"
import { Stream } from "../vocabulary/Stream/Stream"
import { Pallet } from "../vocabulary/Pallet/Pallet"
import { FilmReel } from "../vocabulary/FilmReel/FilmReel"
import { Pouch } from "../vocabulary/Pouch/Pouch"
import { SheetStack } from "../vocabulary/SheetStack/SheetStack"
import { Coin } from "../vocabulary/Coin/Coin"
import { Carton } from "../vocabulary/Carton/Carton"
import { Sack } from "../vocabulary/Sack/Sack"
import { LabelRoll } from "../vocabulary/LabelRoll/LabelRoll"
import { Drum } from "../vocabulary/Drum/Drum"

const PHI = 0.55
const THETA = 0.42

export class MaterialsDream extends Dream {
  sacks = new Pallet({ observer: this.observer, x: -560 })
  bin = new Pallet({ observer: this.observer, x: -290, load: "octabin" })
  reel = new FilmReel({ observer: this.observer, x: -10 })
  pouch = new Pouch({ observer: this.observer, x: 250 })
  sheets = new SheetStack({ observer: this.observer, x: 500 })

  unfold() {
    this.set(...this.observer.orbit({ phi: PHI, theta: THETA }), ...this.observer.dolly(1050))
    for (const h of [this.sacks, this.bin, this.reel, this.pouch, this.sheets]) this.stage(h)
    this.wait(1)
    this.play(together(...this.observer.orbit({ phi: -0.5, theta: 0.3 })), 4)
    this.play(together(...this.observer.orbit({ phi: PHI, theta: THETA })), 4)
    this.wait(1)
  }
}


/**
 * `?scene=grain` — the grain of knowledge, climbed.
 *
 * A value chain in flexible packaging, generic: raw material comes in,
 * is extruded into film, the film is converted into pouches that go out.
 * Three flows, two plants. At first all we know is kilograms moving —
 * neutral dots. Then the categories (colours). Then the types — pallets,
 * reels, pouches — but GHOSTED: that picture is painted from mock data.
 * The data arrives, flow by flow, and each collapses to solid. Then the
 * exact items are named, and the whole picture goes back down to dots.
 */
export class GrainDream extends Dream {
  // The chain on the ground plane (y = 0), read left to right.
  ground = [
    [-1050, -390],
    [-270, 270],
    [390, 1050],
  ].map(([a, b]) => new Line({ points: [{ x: a!, y: 0, z: 0 }, { x: b!, y: 0, z: 0 }], tint: rgb(90, 90, 90), stroke: 1.5, arrowEnd: true }))
  plants = [-330, 330].map((x) => new Factory({ x, size: 120, z: 0 }))

  flows = FLOWS.map(
    (f, k) =>
      new Stream({
        path: [{ x: f.from, y: 0, z: 0 }, { x: f.to, y: 0, z: 0 }],
        count: 5,
        spacing: 200,
        speed: 46,
        time: k * 1.3,
        symbol: (o, j) =>
          new Grain({
            ...o,
            observer: this.observer,
            stand: true,
            radius: 9,
            size: f.size,
            category: f.category,
            symbol: f.symbol,
            label: f.items[j % f.items.length]!.label,
            item: f.items[j % f.items.length]!.symbol,
            typeKnown: 0.25,
            itemKnown: 0.25,
          }),
      }),
  )

  // The ladder, at the bottom left of the screen: the rung we stand on is
  // white. Laid out in a frame that faces the camera (x right, y up on
  // screen, scene units), as are the flows' titles.
  ladder = ["mass", "category", "type", "item"].map(
    (word, r) =>
      new Text({
        content: word,
        size: 30,
        align: "left",
        x: -880,
        y: -330 - r * 44,
        tint: derive((): Color => {
          const g = this.grains()[0]?.grain.value ?? 0
          const on = Math.max(0, 1 - Math.abs(g - r))
          return mixColor(DIM, WHITE, on)
        }),
      }),
  )
  titles = FLOWS.map((f) => {
    // A ground point's place on screen: its components along the screen's right and up.
    const x = (f.from + f.to) / 2
    return new Text({ content: f.title, size: 26, tint: DIM, x: x * Math.cos(PHI_G) - 150, y: -x * Math.sin(PHI_G) * Math.sin(THETA_G) - 120 })
  })
  screen = new Group({
    members: [new Group({ members: [...this.ladder, ...this.titles], p: derive(() => -this.observer.theta.value) })],
    h: derive(() => this.observer.phi.value),
  })

  /** Every particle (reading `parts` composes a Stream, which is when it makes them). */
  private grains(): Grain[] {
    return this.flows.flatMap((s) => (s.parts, s.dots as Grain[]))
  }

  /** A beat: `dt` seconds in which every flow keeps running. */
  private beat(dt: number, ...anims: Anim[]): void {
    this.play(together(...this.flows.map((s) => s.time.by(dt, { easing: "linear" })), ...anims), dt)
  }

  unfold() {
    // Orthographic: every particle sees the camera the same way, so each
    // symbol's hidden-line drawing and its morph plan are computed once,
    // not again every frame as it travels. ~1900 units of picture width, the chain on the diagonal.
    const o = this.observer
    o.orthographic.value = o.orthographic.defaultValue = true
    o.zoom.value = o.zoom.defaultValue = 1023 / 1900
    this.set(...o.orbit({ phi: PHI_G, theta: THETA_G }))
    for (const p of this.plants) this.stage(p)
    for (const s of this.flows) this.stage(s)
    const g = this.grains()
    const byFlow = this.flows.map((s) => s.dots as Grain[]) // composed by grains() above
    this.stage(this.screen)
    this.beat(1.6, ...this.ground.map((l) => Create(l)))
    this.beat(2.4)
    // Categories: kilograms become kinds.
    this.beat(2.2, ...g.map((x) => x.grain.to(RUNG.category)))
    this.beat(1.6)
    // Types — painted from mock data, so ghosted.
    this.beat(3, ...g.map((x) => x.grain.to(RUNG.type)))
    this.beat(2.4)
    // The data arrives, flow by flow: each picture collapses to solid.
    for (const flow of byFlow) this.beat(1.4, ...flow.map((x) => x.typeKnown.to(1)))
    this.beat(1.6)
    // The exact items, named — again a guess first, then the data.
    this.beat(2.4, ...g.map((x) => x.grain.to(RUNG.item)))
    this.beat(1.2)
    this.beat(1.4, ...g.map((x) => x.itemKnown.to(1)))
    this.beat(3)
    // And back down: the essence was the dot all along.
    this.beat(3.2, ...g.map((x) => x.grain.to(RUNG.mass)))
    this.beat(1.5)
  }
}

const PHI_G = 0.8
const THETA_G = 0.52
const DIM = rgb(24, 24, 24)
const mixColor = (a: Color, b: Color, u: number): Color => ({ r: a.r + (b.r - a.r) * u, g: a.g + (b.g - a.g) * u, b: a.b + (b.b - a.b) * u })

const FLOWS: {
  title: string
  from: number
  to: number
  category: Color
  size: number
  symbol: (o: Overrides) => SolidDrawing
  /** The exact items, in particle order (cycled): a name, and the symbol their data makes. */
  items: { label: string; symbol: (o: Overrides) => SolidDrawing }[]
}[] = [
  // (Pouches turn their face to the camera's azimuth.)
  {
    title: "raw material",
    from: -980,
    to: -450,
    category: RED,
    size: 92,
    symbol: (o) => new Pallet(o),
    items: [
      { label: "PE granulate · 1 t", symbol: (o) => new Pallet({ ...o, load: "octabin" }) },
      { label: "PP granulate · 750 kg", symbol: (o) => new Pallet(o) },
      { label: "PE granulate · 1 t", symbol: (o) => new Pallet({ ...o, load: "octabin" }) },
    ],
  },
  {
    title: "film",
    from: -210,
    to: 210,
    category: BLUE,
    size: 84,
    symbol: (o) => new FilmReel(o),
    items: [
      { label: "BOPP film · 2,400 m", symbol: (o) => new FilmReel({ ...o, width: 120, diameter: 230 }) },
      { label: "PE film · 3,000 m", symbol: (o) => new FilmReel({ ...o, width: 210, diameter: 170 }) },
      { label: "CPP film · 1,800 m", symbol: (o) => new FilmReel({ ...o, width: 160, diameter: 200 }) },
    ],
  },
  {
    title: "products",
    from: 450,
    to: 1030,
    category: GREEN,
    size: 90,
    symbol: (o) => new Pouch({ ...o, h: PHI_G }),
    items: [
      { label: "stand-up pouch · 5,000 pcs", symbol: (o) => new Pouch({ ...o, width: 96, height: 150, h: PHI_G }) },
      { label: "sheets · 1,200 m²", symbol: (o) => new SheetStack(o) },
      { label: "zip pouch · 2,000 pcs", symbol: (o) => new Pouch({ ...o, width: 132, height: 200, h: PHI_G }) },
    ],
  },
]

if (import.meta.main) render(GrainDream)

/**
 * `?scene=materials-faces` — each material symbol alone, one per second,
 * in the same three-quarter view: what the READMEs' face images are cut from.
 */
export class MaterialsFacesDream extends Dream {
  symbols = [
    new Pallet({ observer: this.observer }),
    new FilmReel({ observer: this.observer, x: 1000 }),
    new Pouch({ observer: this.observer, x: 2000 }),
    new SheetStack({ observer: this.observer, x: 3000 }),
    new Coin({ observer: this.observer, x: 4000, count: 3, scale: 1.6 }),
    new Carton({ observer: this.observer, x: 5000 }),
    new Sack({ observer: this.observer, x: 6000 }),
    new LabelRoll({ observer: this.observer, x: 7000 }),
    new Drum({ observer: this.observer, x: 8000 }),
  ]

  unfold() {
    this.set(...this.observer.orbit({ phi: PHI, theta: THETA }), ...this.observer.dolly(700))
    for (const s of this.symbols) this.stage(s)
    // The camera visits each in turn (an orthographic-free pan: the focus moves).
    this.symbols.forEach((s, i) => {
      if (i > 0) this.play(this.observer.x.to(s.x.value), 0.001)
      this.wait(0.999)
    })
  }
}

/**
 * `?scene=flowmap-grain` — the grain of knowledge on the FlowMap: the mock
 * organisation's three stages carry pallets, reels and pouches. Staged
 * into the value-chain stack, each stage's dots become their material
 * (`stage(id).rung` 1 → 2); the raw-material inflow, conjecture in the
 * data, stays ghosted until its data arrives.
 */
export class FlowMapGrainDream extends Dream {
  /** Perspective camera instead of orthographic (the realtime benchmark: `flowmap-grain-persp`). */
  protected perspective = false
  map = new FlowMap({
    radius: 300,
    // Materials are bigger than dots: sparser, so each reads as one thing.
    spacing: this.spacing(),
    seenBy: () => this.observer,
    data: {
      ...MOCK_FLOWMAP,
      // Pallets in, reels between, pouches out. The middle stage's white
      // would hide a reel's lines in its own fill, so it takes green here.
      stages: MOCK_FLOWMAP.stages.map((s, i) => ({ ...s, symbol: (["pallet", "reel", "pouch"] as const)[i], ...(i === 1 ? { tint: GREEN } : {}) })),
    },
  })

  protected spacing(): number {
    return 130
  }

  private flowing(dt: number, ...anims: Anim[]): void {
    this.play(together(this.map.time.by(dt, { easing: "linear" }), ...anims), dt)
  }

  unfold() {
    const m = this.map
    const o = this.observer
    if (this.perspective) {
      o.radius.value = o.radius.defaultValue = 1900
      o.phi.value = o.phi.defaultValue = 0.25
      o.theta.value = o.theta.defaultValue = 0.15
    } else {
      o.orthographic.value = o.orthographic.defaultValue = true
      o.zoom.value = o.zoom.defaultValue = 1023 / (1300 * (16 / 9))
    }
    this.stage(m)
    void m.parts // composed: its stages exist
    this.set(m.grain.to(1), m.expand.to(1), ...["raw", "semi", "finished"].map((id) => m.stage(id).shown.to(1)))
    this.flowing(2.5)
    for (const id of ["raw", "semi", "finished"]) this.flowing(2.2, m.stage(id).rung.to(2))
    this.flowing(2.5)
    this.flowing(2.5, m.stage("raw").certainty.to(1))
    this.flowing(2.5)
    this.flowing(2.5, ...["raw", "semi", "finished"].map((id) => m.stage(id).rung.to(1)))
    this.flowing(1)
  }
}

/**
 * `?scene=flowmap-grain-persp` — the same climb under a PERSPECTIVE camera
 * and twice as many particles (~300 material symbols): the realtime
 * benchmark for Grain — every particle sees the camera from its own angle.
 */
export class FlowMapGrainPerspDream extends FlowMapGrainDream {
  protected override perspective = true
  protected override spacing(): number {
    return 75
  }
}
