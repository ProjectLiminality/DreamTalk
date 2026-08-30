/**
 * TheWall — MindViruses self-assemble into a wall.
 *
 * Ported from TheWall/TheWall.py (the Python-in-C4D original; line
 * citations refer to it). Each creature flies its own cubic Bezier from
 * a shared spawn point to its own slot along a footprint, pulsing like
 * a jellyfish, and folds shut into a brick when it arrives. ONE
 * parameter drives the whole thing: `growth`, a wave sweeping the
 * footprint, staggered row by row.
 *
 * ## What this holon owns that the original could not
 *
 * The original was a MoGraph Cloner of Python generators. A generator
 * cannot see its siblings, so TheWall's generator computed the packing
 * and smuggled it to the per-clone journeys through a hidden spline
 * named "PackingLUT" (:975-1000), while the clones found the wall by
 * name (`doc.SearchObject`, :1194) and read its parameters out of
 * userdata by string. All of that blackboard machinery dies here: the
 * packing is a pure function (geometry/packing.ts), its result is a
 * field on this holon, and every creature is an ordinary part.
 *
 * The per-clone completion pipeline, by contrast, was ALREADY pure
 * f(growth, index) — the study's "best code in the stack" — and ports
 * verbatim into geometry/journey.ts. This file is only the wiring: for
 * each slot, bind that creature's transform params to journeyState() of
 * its own completion.
 *
 * ## The driving seam
 *
 * A MindVirus keeps its position, heading, fold and scale as ordinary
 * Params, and only installs its OWN bindings when it is given a
 * `journey` (parts/mindvirus.ts compose()). Left without one, every
 * param is free, so the wall binds them here with derive() — the same
 * mechanism the creature uses on itself, no hook needed and no edit to
 * mindvirus.ts. A creature belongs to one spelling of motion at a
 * time: free-swimming, self-journeying, or wall-driven.
 *
 * ## Cables
 *
 * `cables = true` gives every creature its XPBD tether back to the
 * spawn anchor (:1404-1560) — 21 particles under gravity and drag,
 * draping over its own folding cube. In the reference render these
 * white filaments ARE the image (92-99.6% of the lit ink), so the
 * choreography above is only half the scene without them.
 *
 * They are history-dependent, which is why they must be baked
 * (ONTOLOGY "Baking, corrected"): `unfoldCables()` runs every
 * simulation once, at build time, and after that each cable is a table
 * of samples read by clock — pure, scrub-safe, gauntlet-safe. The wall
 * calls it from `compose()`, so a scene that sets `cables` before its
 * first evaluation pays the simulation once and never again.
 *
 * The tip of each tether is that creature's own journey, sampled at the
 * bake's frame times — which requires knowing how `growth` moves in
 * time. The wall cannot guess that, so `growthAt` is the seam: a scene
 * that animates growth non-linearly states its own mapping. The default
 * is the reference's linear 0 → 1 over `duration`.
 */

import { Holon } from "../holon"
import { bool, derive, integer, length, scalar, type Readable } from "../params"
import { BLUE, type Color } from "../constants"
import { MindVirus, headingFor } from "./mindvirus"
import {
  buildJourney,
  completionOf,
  journeyState,
  type JourneyPath,
  type JourneyState,
  type Vec3,
} from "../geometry/journey"
import {
  circleFootprint,
  packSlots,
  rowHeight,
  type Footprint,
  type Packing,
  type Slot,
} from "../geometry/packing"
import { CABLE_SLACK } from "../geometry/xpbd"
import { rotHPB } from "./curves"
import type { TetherTip } from "./cable"

/**
 * Rows lag each other by this many bricks — the diagonal growth wave
 * of the reference render (TheLabyrinth.py:512, row_lag=1.66; the
 * generator reads it as bricks-per-row, TheWall.py:1283-1284).
 */
export const WALL_ROW_LAG = 1.66

/** Vertical spacing of rows: the cube's own edge (:1084 row_height). */
export const WALL_ROW_HEIGHT = 100

/** The brick's footprint on the ground — the same edge (:1085). */
export const WALL_BRICK_SIZE = 100

/** One creature's fixed place in the wall — computed once, sampled per frame. */
interface Placement {
  slot: Slot
  journey: JourneyPath
  virus: MindVirus
}

export class TheWall extends Holon {
  /** ONTOLOGY.md: a sovereign symbol — its own DreamNode. */
  static sovereign = true

  /**
   * THE parameter. 0 = nothing built, 1 = the wall complete. The wave
   * sweeps the footprint; rows trail each other by `rowLag` (:1283-1290).
   */
  growth = scalar(0)

  /** Rows stacked in +y. */
  rowCount = integer(4)
  /** Vertical spacing between rows. */
  rowHeight = length(WALL_ROW_HEIGHT)
  /** Brick edge — sets both the packing spacing and the cube size. */
  brickSize = length(WALL_BRICK_SIZE)
  /** Bricks of lag per row (:1283). */
  rowLag = scalar(WALL_ROW_LAG)

  /**
   * The tether cables back to the spawn anchor. When true, `compose()`
   * bakes one XPBD simulation per creature (see the header).
   */
  cables = bool(false)
  /** growth = 1 seals the wall (the IDEAL); benchmark scenes pass false
   *  to reproduce the 2025/26 wave that leaves the last 15% in flight
   *  (FIDELITY-LEDGER #1). */
  sealAtOne = bool(true)

  /** Scene seconds the cable bake must cover — the scene's own span. */
  cableDuration = scalar(500 / 30)
  /** Simulation and sample rate of the bake. The source steps at 30
   *  (:1476); lowering it trades fidelity for build time, and any such
   *  choice belongs in the scene, stated out loud. */
  cableFps = scalar(30)
  /** Rest length = distance travelled × this (:1473). */
  cableSlack = scalar(CABLE_SLACK)
  /** Stroke width of a tether at its tip (:1104 cable_width 2). */
  cableWidth = scalar(2)

  /**
   * How `growth` moves in time — the bake's one non-geometric input.
   * Default: the reference's linear ramp 0 → 1 across `cableDuration`
   * (TheLabyrinth.py:497-521).
   */
  growthAt: (time: number) => number = (time) =>
    Math.min(Math.max(time / this.cableDuration.value, 0), 1)

  /** Where every creature is born (:1200 spawn_pos). */
  spawn: Vec3 = { x: 0, y: 0, z: 0 }
  /**
   * The departure vector — direction AND magnitude, so a longer vector
   * exaggerates the outward flourish (:1136-1140). The flower scene
   * launches straight up, (0, 500, 0) (:1580).
   */
  spawnDirection?: Vec3 = { x: 0, y: 500, z: 0 }

  /** The curve the wall is built along. Defaults to the Labyrinth's circle. */
  footprint: Footprint = circleFootprint(1000)

  /** The creature colour — MindVirus tints its own eye and cube. */
  tint: Color = BLUE

  private placements: Placement[] = []
  private packing?: Packing

  /** The packed layout — slot count, positions, normals. */
  get layout(): Packing {
    this.parts // force compose
    if (!this.packing) throw new Error("TheWall: layout unavailable before compose")
    return this.packing
  }

  /** Bricks per row, decided by the packing (:970-972). */
  get rowLength(): number {
    return this.layout.rowLength
  }

  /** Creatures in the wall = rowLength × rowCount. */
  get virusCount(): number {
    return this.layout.slots.length
  }

  protected override compose(): void {
    const rowCount = this.rowCount.value
    const brickSize = this.brickSize.value
    const spacing = this.rowHeight.value

    const packing = packSlots(this.footprint, { brickSize, rowCount })
    this.packing = packing

    for (const slot of packing.slots) {
      // The slot in world space: the footprint gives x/z, the row gives y.
      const slotPos: Vec3 = {
        x: slot.position.x,
        y: rowHeight(slot.row, rowCount, spacing),
        z: slot.position.z,
      }
      const journey = buildJourney({
        spawn: this.spawn,
        slot: slotPos,
        spawnDir: this.spawnDirection,
        // The footprint normal lies in the ground plane (:1268).
        slotNormal: { x: slot.normal.x, y: 0, z: slot.normal.z },
      })

      const virus = this.add(new MindVirus())
      virus.cube.size.defaultValue = brickSize
      virus.cube.size.value = brickSize
      // With cables off, a creature's Cable is inert (it renders empty
      // polylines until someone installs a source) — but its ring pool
      // is still 64 Line holons, three quarters of everything the wall
      // builds. Emptying the pool before the cable composes is the one
      // knob that makes a wall of hundreds tractable at all; see the
      // perf note in docs/reports/wall/thewall-port.md. When the tether
      // agent turns cables on, it restores the pool here.
      if (!this.cables.value) virus.cable.maxRings = 0
      this.placements.push({ slot, journey, virus })
      this.drive(virus, slot, journey)
    }

    if (this.cables.value) this.unfoldCables()
  }

  /**
   * Bake every creature's tether. This is the whole of Chapter 6 in
   * practice: N simulations run ONCE here, at build time, each frozen
   * into samples (bake.ts). Nothing below is ever touched again during
   * playback — a frame reads tables.
   *
   * The clock: the wall's `growth` is what the scene animates, so the
   * bake needs `growthAt(time)` to know where each creature is at each
   * simulated frame. Everything else is the pure journey pipeline the
   * wall already owns, evaluated at that growth.
   */
  private unfoldCables(): void {
    const duration = this.cableDuration.value
    const fps = this.cableFps.value
    const brickSize = this.brickSize.value
    const started = performance.now()
    let bytes = 0

    for (const { slot, journey, virus } of this.placements) {
      // The tether's rings are off (the wall's cables are plain
      // tapered ribbons) — so the ring pool stays empty even with
      // cables on, and a creature keeps costing 25 holons.
      virus.cable.maxRings = 0
      virus.cable.rings.value = false
      virus.cable.width.value = this.cableWidth.value
      virus.cable.clock.follow(derive(() => this.cableClock()))

      virus.cable.tether(
        this.spawn,
        (time) => this.tipAt(time, slot, journey),
        {
          duration,
          bakeFps: fps,
          slack: this.cableSlack.value,
          anchorDir: this.spawnDirection,
          cubeSize: brickSize,
        },
      )
      bytes += virus.cable.bakedBytes
    }

    this.cableBakeMs = performance.now() - started
    this.cableBakeBytes = bytes
  }

  /** How long the last cable bake took, ms — the perf number a bake owes. */
  cableBakeMs = 0
  /** Bytes of baked samples the cables hold. */
  cableBakeBytes = 0

  /**
   * Scene time as the baked cables read it — the inverse of `growthAt`,
   * found by bisection so that a scene may state any monotone growth
   * ramp it likes and still scrub correctly. (For the default linear
   * ramp this is exact.)
   */
  private cableClock(): number {
    const target = this.growth.value
    const duration = this.cableDuration.value
    let lo = 0
    let hi = duration
    if (this.growthAt(hi) <= target) return hi
    if (this.growthAt(lo) >= target) return lo
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (this.growthAt(mid) < target) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }

  /** One creature's pose at a simulated instant — everything the tether
   *  needs about its moving end (:1470-1515). */
  private tipAt(time: number, slot: Slot, journey: JourneyPath): TetherTip {
    const growth = this.growthAt(time)
    const completion = completionOf(
      growth,
      { splineT: slot.t, row: slot.row },
      {
        rowCount: this.rowCount.value,
        rowLength: this.packing?.rowLength ?? 1,
        rowLag: this.rowLag.value,
        sealAtOne: this.sealAtOne.value,
      },
    )
    const s = journeyState(completion, journey)
    const { h, p } = headingFor(s.heading)
    return {
      position: s.position,
      // The cable enters the creature along −(flight tangent) (:1480);
      // `heading` is already that vector.
      direction: s.heading,
      // The creature's own frame: its local axes in world space, the
      // normalized virus matrix of :1495-1499.
      frame: {
        vx: rotHPB({ x: 1, y: 0, z: 0 }, p, h, 0) as Vec3,
        vy: rotHPB({ x: 0, y: 1, z: 0 }, p, h, 0) as Vec3,
        vz: rotHPB({ x: 0, y: 0, z: 1 }, p, h, 0) as Vec3,
      },
      fold: s.fold,
      scale: s.scale,
      completion,
      // Distance travelled along the flight path (:1472).
      travelled: s.splineS * journey.lut.totalLength,
    }
  }

  /** This creature's completion right now — the growth wave at its slot. */
  private completionAt(slot: Slot): number {
    return completionOf(
      this.growth.value,
      { splineT: slot.t, row: slot.row },
      {
        rowCount: this.rowCount.value,
        rowLength: this.packing?.rowLength ?? 1,
        rowLag: this.rowLag.value,
        sealAtOne: this.sealAtOne.value,
      },
    )
  }

  /**
   * Bind one creature's whole transform to the pure pipeline. Each
   * param derives from the same cached state, so a frame evaluates the
   * pipeline once per creature rather than once per param.
   */
  private drive(virus: MindVirus, slot: Slot, journey: JourneyPath): void {
    let cachedGrowth = NaN
    let cached: JourneyState | undefined
    const state = (): JourneyState => {
      const growth = this.growth.value
      if (growth !== cachedGrowth || cached === undefined) {
        cachedGrowth = growth
        cached = journeyState(this.completionAt(slot), journey)
      }
      return cached
    }
    const read = <T>(fn: (s: JourneyState) => T): Readable<T & number> =>
      derive(() => fn(state()) as T & number)

    virus.x.follow(read((s) => s.position.x))
    virus.y.follow(read((s) => s.position.y))
    virus.z.follow(read((s) => s.position.z))
    virus.h.follow(read((s) => headingFor(s.heading).h))
    virus.p.follow(read((s) => headingFor(s.heading).p))
    virus.fold.follow(read((s) => s.fold))
    virus.scale.follow(read((s) => s.scale))
  }

  /** The slot layout, for scenes that want to draw or inspect it. */
  get slots(): readonly Slot[] {
    return this.layout.slots
  }
}
