/**
 * Noosphere — "our superstructure of stories … the lens through which we
 * collectively perceive" (InterBrain film, 7:30–7:41). ONE holon, the film's
 * every look of it a state:
 *
 *   LATTICE             a white geodesic wireframe, near bright, far dim
 *                       (f2056, f2236); a light at its heart when it acts as
 *                       the lens (f2311)                     bloom 0 (+ lens)
 *   NARRATIVE-ENGINEERED a dim blue sphere of nodes joined by straight links,
 *                       a narrative (a small square) in every node
 *                       (f4906, f5146, f5536)
 *                                                            bloom 1, garden 0
 *   VISION-GARDENED     the same sphere red, its links bent into the
 *                       flower of life's petals, a seed in every node (f5716
 *                       right, f5851; the healing trickling down, f12451)
 *                                                            bloom 1, garden 1
 *   WHOLE DISK          the red flower-of-life disk — the third attractor's
 *                       medium (f7231, f11851); bolts striking at it (f7246)
 *                                                            flat 1, fragment ≈ 0.2
 *   FRAGMENTED VORTEX   cut along six radii → hexagon → six triangles drift
 *                       apart, turn blue and lattice, bolts between them, red
 *                       spiral field lines (f7441, f7456, f7471, f10606)
 *                                                            flat 1, fragment 1
 *   INTERBRAIN SPHERE   the red flower-of-life sphere with an InterBrain in
 *                       every node — "a collective knowledge garden" (39:27;
 *                       f11896, f11941, f12796)              bloom 1, garden 1, interbrain 1
 *
 * THE AXES are the transitions the film animates, each one 0..1 number so it
 * scrubs and the automaton walks it:
 *   `fragment`   disk ↔ vortex (f7246 → f7471, and back, f11806 → f11851)
 *   `flat`       sphere ↔ disk (the disk becomes the InterBrain sphere,
 *                f11851 → f11896)
 *   `interbrain` the InterBrains appearing in the nodes (f11866 → f11896)
 *   `garden`     narrative-engineered → vision-gardened: blue → red, and
 *                every straight link bends into two petals (f5716's arrow;
 *                f12451 blue → red)
 *   `bloom`      lattice → flower sphere (the film cuts between them; the
 *                axis lets them morph — one sphere, two drawings of it)
 *   `lens`       the light at the lattice's heart (f2311)
 * An enum would cut; these blend, and any mix is a picture.
 *
 * CONSTRUCTION (geodesic.ts): a class-I geodesic icosphere at `frequency`
 * ν; the lattice is its edges as chords (the film's limb is a polygon); the
 * flower is, per face and corner, the 60° arc about that corner across the
 * far edge — circles about every node through its neighbours, the flower of
 * life laid on the sphere. The flat disk is the planar flower of life
 * (circles of spacing s on a triangular lattice, as src/geometry/flower.ts's
 * hexPack packs them), spacing s = hex·R/N so the hexagon's corners and the
 * six triangles' edges lie on the lattice, and the triangles' blue lattice
 * (f7471) is that same lattice with the circles straightened away.
 *
 * MEASURED (1280×720 frames):
 *   f11941  sphere r 193 px; the centre node's six neighbours ≈ 96 px out
 *           → 30° → ν = 2; node ring 0.255 of the spacing.
 *   f5716   sphere r 186 px; nodes ≈ 32 px apart near the centre → 9.8° → ν = 7;
 *           node ring ≈ 0.28 of the spacing.
 *   f2236   lattice r 124 px, faceted limb; front and back both drawn.
 *   f7246   disk r 198 px; flower cells ≈ 12.5 px → R/s ≈ 16; bolts 0.2 R
 *           long, centred ≈ 1.38 R out on the six cuts, striking inward.
 *   f7441   hexagon circumradius 185 px = 0.934 R; the disk's ghost stays.
 *   f7471   triangle centroids ≈ 180 px out (0.97 hex R, from 0.58);
 *           bolts in the gaps ≈ 0.83 R out.
 *
 * NOT HERE: the six puppeteer fists at the vortex's centre (f7456, f7471)
 * belong to the Puppeteer holon; the boxed heads round f5146 to Mind.
 */

import { Circle, Group, Line, Null, Shape, derivePoints, type Vec3Like } from "../../src/parts/primitives"
import { Polylines, deriveLoops } from "../../src/parts/polylines"
import { angle, color, completion, derive, integer, length } from "../../src/params"
import { BLUE, RED, TAU, WHITE, rgb, type Color } from "../../src/constants"
import { presence } from "../../src/certainty"
import { eased, restage, together, type Anim } from "../../src/anim"
import { axis, toggle, type StateSpace } from "../../src/automaton"
import type { Overrides } from "../../src/holon"
import { Conflict } from "../Conflict/Conflict"
import { InterBrain } from "../InterBrain/InterBrain"
import {
  flowerArcs,
  geodesic,
  latticeLoops,
  meanEdgeAngle,
  nearRuns,
  nodeGlyphs,
  nodeRings,
  orient,
  sectorFlower,
  sectorRim,
  sectorTriangle,
  spiralArc,
  triangleGrid,
  type P2,
} from "./geodesic"

/** The construction's numbers (see header, MEASURED). */
export const NOOSPHERE = {
  /** A node's ring, as a share of the node spacing (f11941 0.255, f5716 0.28). */
  node: 0.32,
  /** The narrative's square / the seed's circle in a node, as a share of the ring. */
  glyph: 0.5,
  /** The hexagon's circumradius / the disk's (f7441). */
  hex: 0.934,
  /** Lattice steps along a triangle's side (disk R / s ≈ 16, f7246). */
  steps: 15,
  /** The cut lines' and the bolts' reach in the whole disk (f7246). */
  cutReach: 1.5,
  boltOut: 1.38,
  /** The bolts in the vortex's gaps (f7471). */
  boltIn: 0.83,
  boltSize: 0.2,
  /** …and grows to this in the vortex (f7471: ≈ 80 px). */
  boltGrown: 0.4,
  /** How far a triangle's centroid travels, in hex radii (0.58 → 0.97, f7471). */
  drift: 0.39,
} as const

/** The fragment axis's phases: cut [0, CUT], round → hexagon [CUT, HEX],
 *  drift apart and turn blue [HEX, 1]. */
/** The finest geodesic that is given InterBrain faces (see compose). */
export const MAX_FACES_NU = 3

export const CUT = 0.2
export const HEX = 0.45

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const phase = (v: number, a: number, b: number) => clamp01((v - a) / (b - a))
const smooth = (u: number) => u * u * (3 - 2 * u)
const mix = (a: Color, b: Color, u: number): Color => ({
  r: a.r + (b.r - a.r) * u,
  g: a.g + (b.g - a.g) * u,
  b: a.b + (b.b - a.b) * u,
})
const P3 = (p: P2): Vec3Like => ({ x: p.x, y: p.y, z: 0 })

/** A Group that fades all it holds: its presence cascades down the tree. */
class Layer extends Group {
  there = presence(1)
}

export class Noosphere extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The sphere's (and the disk's) radius — the symbol's one size. */
  radius = length(400)
  /** The geodesic frequency ν (f11941: 2; f5716: 7; f2236: 4). Lines read it
   *  live; the InterBrain faces are built for the ν the holon composes with. */
  frequency = integer(3)
  /** The sphere's turn about its pole, and the pole's lean. Animate `spin`. */
  spin = angle(0.35)
  pitch = angle(0.32)
  /** The vortex's turn about the centre (f7441 → f7471). */
  swirl = angle(0)

  // --- the states ---------------------------------------------------------
  /** 0 the geodesic lattice, 1 the flower-of-life sphere. */
  bloom = completion(0)
  /** 0 narrative-engineered (blue), 1 vision-gardened (red). */
  garden = completion(0)
  /** 0 the sphere, 1 the flat disk. */
  flat = completion(0)
  /** 0 the whole disk … 1 the fragmented vortex (phases CUT, HEX). */
  fragment = completion(0)
  /** An InterBrain in every node. */
  interbrain = completion(0)
  /** The light at the lattice's heart (the noosphere as lens, f2311). */
  lens = completion(0)

  // --- the look -------------------------------------------------------------
  latticeTint = color(WHITE)
  latticeStroke = length(0.6)
  /** The lattice's far face. */
  backOpacity = completion(0.35)
  narrativeTint = color(BLUE)
  /** The narrative-engineered sphere is dim (f5716: its brightest ≈ 0.4 of the red's,
   *  and the host blends in linear light — 0.2 here reads as 0.4 on screen). */
  narrativeOpacity = completion(0.2)
  visionTint = color(RED)
  flowerStroke = length(0.6)
  lensTint = color(rgb(255, 236, 190))
  /** The disk's ink and wash (f7246), the vortex's (f7471). */
  diskTint = color(RED)
  diskFill = completion(0.06)
  shardTint = color(BLUE)
  shardFill = completion(0.06)
  cutTint = color(BLUE)
  diskStroke = length(0.8)
  /** The disk's flower ink: dense, so faint (f7246's interior reads dark red). */
  diskInk = completion(0.45)
  /** The links' share of the nodes' brightness (f5716: the rings glow, the links less). */
  linkOpacity = completion(0.6)

  whole!: Layer
  sphere!: Layer
  disk!: Layer
  latticeNear!: Polylines
  latticeFar!: Polylines
  flower!: Polylines
  rings!: Polylines
  narratives!: Polylines
  seeds!: Polylines
  rim!: Circle
  glow!: Circle
  faces!: Group
  slots: Layer[] = []
  ghost!: Circle
  cuts!: Polylines
  shards: Group[] = []
  spirals!: Polylines
  bolts!: Conflict

  constructor(overrides: Overrides = {}) {
    super(overrides)
  }

  /** The node spacing (radians) at the current frequency. */
  get spacing(): number {
    return meanEdgeAngle(geodesic(this.frequency.value))
  }

  protected override compose(): void {
    const R = () => this.radius.value
    const nu = () => Math.max(1, Math.round(this.frequency.value))
    const cr = () => this.creation.value
    const turn = () => [this.spin.value, this.pitch.value] as const

    // ===================================================================
    // THE SPHERE
    // ===================================================================
    // The whole is present once Create begins (washes and the lens's light
    // have no pen, so they fade in with the first quarter of it).
    this.whole = this.add(new Layer())
    this.whole.there.follow(this.creation.map((c) => clamp01(c * 4)))
    this.sphere = this.whole.attach(new Layer())
    this.sphere.there.follow(this.flat.map((f) => 1 - f))
    const sphereAdd = <T extends Null>(h: T) => (this.sphere.attach(h), h)

    // The lens's light (f2311): a lit disc, white-gold at the heart.
    this.glow = sphereAdd(
      new Circle({
        radius: derive(() => R() * 0.45),
        tint: this.lensTint,
        stroke: 0,
        fillOpacity: derive(() => this.lens.value * 0.85),
        fillFalloff: 1,
        opacity: derive(() => (this.lens.value > 0 ? 1 : 0)),
      }),
    )

    // Draw-on: Create reveals the sphere top to bottom (a line shows once
    // its highest point is above the falling front).
    const revealed = (loops: Vec3Like[][]) => {
      const c = cr()
      if (c >= 1) return loops
      const front = R() * (1 - 2.2 * c)
      return loops.filter((l) => Math.max(...l.map((p) => p.y)) > front)
    }

    const lattice = () => {
      const [s, p] = turn()
      return latticeLoops(geodesic(nu()), R(), s, p)
    }
    let latticeMemo: { key: string; v: ReturnType<typeof lattice> } | undefined
    const latticeNow = () => {
      const key = `${nu()},${R()},${turn().join(",")}`
      if (latticeMemo?.key !== key) latticeMemo = { key, v: lattice() }
      return latticeMemo.v
    }
    const latticeKey = () => [nu(), R(), this.spin.value, this.pitch.value, cr()]
    this.latticeNear = sphereAdd(
      new Polylines({
        tint: this.latticeTint,
        stroke: this.latticeStroke,
        opacity: derive(() => 1 - this.bloom.value),
      }),
    )
    deriveLoops(this.latticeNear, latticeKey, () => revealed(latticeNow().near))
    this.latticeFar = sphereAdd(
      new Polylines({
        tint: this.latticeTint,
        stroke: this.latticeStroke,
        opacity: derive(() => (1 - this.bloom.value) * this.backOpacity.value),
      }),
    )
    deriveLoops(this.latticeFar, latticeKey, () => revealed(latticeNow().far))

    // The flower sphere: tint and brightness run narrative → vision.
    const flowerTint = derive(() => mix(this.narrativeTint.value, this.visionTint.value, this.garden.value))
    const flowerOpacity = () => this.bloom.value * (this.narrativeOpacity.value + (1 - this.narrativeOpacity.value) * this.garden.value)
    const rho = () => NOOSPHERE.node * meanEdgeAngle(geodesic(nu()))
    const sphereKey = () => [nu(), R(), this.spin.value, this.pitch.value, cr()]
    // The links bend with `garden` (straight → petals), in 48 steps so a
    // transition reuses what it has computed.
    const bendStep = () => Math.round(this.garden.value * 48)
    const unitArcs = new Map<string, ReturnType<typeof flowerArcs>>()
    const arcsOf = (n: number) => {
      const key = `${n},${bendStep()}`
      let a = unitArcs.get(key)
      if (!a) {
        if (unitArcs.size > 100) unitArcs.clear()
        unitArcs.set(key, (a = flowerArcs(geodesic(n), NOOSPHERE.node * meanEdgeAngle(geodesic(n)), bendStep() / 48)))
      }
      return a
    }
    // A coarse sphere is drawn bigger, so its pen is heavier (f11941 vs f5716).
    const flowerPen = derive(() => this.flowerStroke.value * (7 / nu()))
    this.flower = sphereAdd(
      new Polylines({ tint: flowerTint, stroke: flowerPen, opacity: derive(() => flowerOpacity() * (1 - (1 - this.linkOpacity.value) * this.garden.value)) }),
    )
    deriveLoops(this.flower, () => [...sphereKey(), bendStep()], () => revealed(nearRuns(arcsOf(nu()), R(), ...turn())))
    this.rings = sphereAdd(new Polylines({ tint: flowerTint, stroke: flowerPen, opacity: derive(flowerOpacity) }))
    deriveLoops(this.rings, sphereKey, () => revealed(nearRuns(nodeRings(geodesic(nu()), rho()), R(), ...turn())))
    // What each node holds: a narrative (the blue cube's face, a square) or
    // a seed (a small circle) — gone where an InterBrain takes the node.
    const held = (u: () => number) => derive(() => flowerOpacity() * u() * (1 - this.interbrain.value) * 0.8)
    this.narratives = sphereAdd(new Polylines({ tint: flowerTint, stroke: 1, opacity: held(() => 1 - this.garden.value) }))
    deriveLoops(this.narratives, sphereKey, () =>
      revealed(nearRuns(nodeGlyphs(geodesic(nu()), rho() * NOOSPHERE.glyph * 1.2, 4), R(), ...turn())),
    )
    this.seeds = sphereAdd(new Polylines({ tint: flowerTint, stroke: 1, opacity: held(() => this.garden.value) }))
    deriveLoops(this.seeds, sphereKey, () =>
      revealed(nearRuns(nodeGlyphs(geodesic(nu()), rho() * NOOSPHERE.glyph, 16), R(), ...turn())),
    )

    // The limb: the InterBrain sphere is ringed (f11941).
    this.rim = sphereAdd(
      new Circle({ radius: this.radius, tint: this.visionTint, stroke: 2, opacity: derive(() => this.interbrain.value * this.bloom.value) }),
    )

    // The InterBrains, one per node, fitted inside its ring and foreshortened
    // with it; a node's InterBrain shows on the near face only.
    // A node too small to hold one gets none: the InterBrain sphere is
    // coarse (ν 2, f11941); past MAX_FACES_NU a ring is a few pixels.
    const g0 = geodesic(nu())
    this.faces = sphereAdd(new Group())
    this.slots = (nu() <= MAX_FACES_NU ? g0.vertices : []).map((v) => {
      const ib = new InterBrain({ radius: 100, bloomRings: 3, logoStroke: 1.4, stroke: 1 })
      const slot = new Layer({ members: [ib] })
      const at = () => orient(v, this.spin.value, this.pitch.value)
      slot.x.follow(this.spin.map(() => at()[0] * R()))
      slot.y.follow(this.spin.map(() => at()[1] * R()))
      // Ring radius on the page ≈ R·sin(ρ); the crystal fills 0.8 of it.
      slot.scale.follow(this.spin.map(() => (0.8 * R() * Math.sin(rho()) * (0.35 + 0.65 * Math.max(0, at()[2]))) / 100))
      slot.there.follow(
        this.interbrain.map((k) => {
          const z = at()[2]
          return k * this.bloom.value * clamp01(z / 0.15)
        }),
      )
      this.faces.attach(slot)
      return slot
    })

    // ===================================================================
    // THE DISK
    // ===================================================================
    this.disk = this.whole.attach(new Layer())
    this.disk.there.follow(this.flat)
    this.disk.b.follow(this.swirl)
    const diskAdd = <T extends Null>(h: T) => (this.disk.attach(h), h)
    const F = () => this.fragment.value
    const cut = () => smooth(phase(F(), 0, CUT))
    const round = () => smooth(phase(F(), CUT, HEX))
    const apart = () => smooth(phase(F(), HEX, 1))
    const blue = () => smooth(phase(F(), HEX + 0.1, 1))
    const s = () => (NOOSPHERE.hex * R()) / NOOSPHERE.steps

    // The disk's ghost, left behind by the hexagon (f7441).
    this.ghost = diskAdd(
      new Circle({ radius: this.radius, tint: this.diskTint, stroke: 1.2, opacity: derive(() => 0.25 * round() * (1 - apart())) }),
    )

    // The six cuts, drawn out from the centre to the bolts (f7246).
    this.cuts = diskAdd(
      new Polylines({ tint: this.cutTint, stroke: 1.6, opacity: derive(() => (cut() > 0 ? 1 - apart() : 0)) }),
    )
    deriveLoops(this.cuts, () => [R(), cut()], () =>
      Array.from({ length: 6 }, (_, k) => {
        const a = (k * TAU) / 6
        const r = R() * NOOSPHERE.cutReach * cut()
        return [P3({ x: 0, y: 0 }), P3({ x: r * Math.cos(a), y: r * Math.sin(a) })]
      }),
    )

    // The six shards: each its sector's flower, wash, rim and sides; they
    // drift apart along their centroid's direction.
    const flowerMemo = new Map<string, P2[][]>()
    const shardFlower = (k: number): P2[][] => {
      const u = Math.round(round() * 40) / 40 // the morph in 40 steps: reuse
      const key = `${k},${R()},${u}`
      let f = flowerMemo.get(key)
      if (!f) {
        if (flowerMemo.size > 240) flowerMemo.clear()
        flowerMemo.set(key, (f = sectorFlower(k, R(), s(), u, NOOSPHERE.hex)))
      }
      return f
    }
    for (let k = 0; k < 6; k++) {
      const shard = new Group()
      const mid = ((k + 0.5) * TAU) / 6
      const travel = () => apart() * NOOSPHERE.drift * NOOSPHERE.hex * R()
      shard.x.follow(this.fragment.map(() => Math.cos(mid) * travel()))
      shard.y.follow(this.fragment.map(() => Math.sin(mid) * travel()))
      const outline = () => {
        const rim = sectorRim(k, R(), round(), NOOSPHERE.hex)
        return [P3({ x: 0, y: 0 }), ...rim.map(P3), P3({ x: 0, y: 0 })]
      }
      const fillLine = new Line({})
      derivePoints(fillLine, () => [R(), round()], outline)
      shard.attach(
        new Shape({
          tint: derive(() => mix(this.diskTint.value, this.shardTint.value, blue())),
          fillOpacity: derive(() => this.diskFill.value + (this.shardFill.value - this.diskFill.value) * blue()),
          outlines: [fillLine],
        }),
      )
      const fl = new Polylines({
        tint: this.diskTint,
        stroke: this.diskStroke,
        opacity: derive(() => this.diskInk.value * (1 - blue())),
      })
      // Create grows the flower from the centre out.
      deriveLoops(fl, () => [R(), Math.round(round() * 40), cr()], () => {
        const reach = cr() >= 1 ? Infinity : cr() * R() * 1.05
        return shardFlower(k)
          .filter((run) => cr() >= 1 || Math.hypot(run[0]!.x, run[0]!.y) <= reach)
          .map((run) => run.map(P3))
      })
      shard.attach(fl)
      const grid = new Polylines({ tint: derive(() => mix(this.shardTint.value, WHITE, 0.3)), stroke: 0.8, opacity: derive(() => blue() * 0.4) })
      deriveLoops(grid, () => [R()], () => triangleGrid(sectorTriangle(k, NOOSPHERE.hex * R()), NOOSPHERE.steps).map((l) => l.map(P3)))
      shard.attach(grid)
      const rim = new Line({
        tint: derive(() => mix(this.diskTint.value, WHITE, round())),
        stroke: 1.6,
      })
      derivePoints(rim, () => [R(), round()], () => sectorRim(k, R(), round(), NOOSPHERE.hex).map(P3))
      shard.attach(rim)
      const sides = new Line({ tint: derive(() => mix(WHITE, BLUE, 0.3)), stroke: 1.4, opacity: derive(() => apart()) })
      derivePoints(sides, () => [R()], () => {
        const [c, a, b] = sectorTriangle(k, NOOSPHERE.hex * R())
        return [P3(a), P3(c), P3(b)]
      })
      shard.attach(sides)
      this.shards.push(diskAdd(shard))
    }

    // The vortex's red field lines (f7471): eight arcs sweeping outward.
    this.spirals = diskAdd(
      new Polylines({ tint: this.diskTint, stroke: 1.3, opacity: derive(() => apart() * 0.7) }),
    )
    deriveLoops(this.spirals, () => [R()], () =>
      Array.from({ length: 8 }, (_, i) => spiralArc((i / 8) * TAU, R() * 0.75, R() * 1.65, TAU * 0.2).map(P3)),
    )

    // The bolts: striking at the disk from the cuts' ends (f7246), then in
    // the gaps between the shards (f7471).
    this.bolts = diskAdd(
      new Conflict({
        count: 6,
        direction: TAU / 2,
        size: derive(() => R() * (NOOSPHERE.boltSize + (NOOSPHERE.boltGrown - NOOSPHERE.boltSize) * apart())),
        radius: derive(() => R() * (NOOSPHERE.boltOut + (NOOSPHERE.boltIn - NOOSPHERE.boltOut) * apart())),
        fillOpacity: derive(() => cut()),
      }),
    )
  }

  /** The sphere draws on from the top (the lattice, the flower); the disk
   *  grows its flower from the centre out. */
  override createAnim(): Anim {
    void this.parts
    return together(
      eased("smooth", this.creation.sequence(0, 1)),
      restage(this.rim.creation.sequence(0, 1), 0.5, 1),
    )
  }

  override unCreateAnim(): Anim {
    return this.creation.to(0)
  }

  /** Walkable (src/automaton.ts): the six transitions. */
  override stateSpace(): StateSpace | undefined {
    void this.parts
    const handles = [this]
    const axes = [
      toggle("bloom", this.bloom, { off: ["lattice", 0], on: ["flower", 1], handles }),
      toggle("garden", this.garden, { off: ["narrative-engineered", 0], on: ["vision-gardened", 1], duration: 2, handles }),
      toggle("flat", this.flat, { off: ["sphere", 0], on: ["disk", 1], duration: 1.5, handles }),
      axis("fragment", this, { whole: { fragment: 0 }, struck: { fragment: CUT }, hexagon: { fragment: HEX }, vortex: { fragment: 1 } }, { duration: 2, handles }),
      toggle("interbrain", this.interbrain, { off: ["noosphere", 0], on: ["interbrain", 1], duration: 1.5, handles }),
      toggle("lens", this.lens, { off: ["dark", 0], on: ["lit", 1], handles }),
    ].filter((a) => a.params().every((p) => !p.isBound))
    return { axes, clocks: [this.spin] }
  }
}
