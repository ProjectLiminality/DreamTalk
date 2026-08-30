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
 * OFF here. In the original every creature trails an XPBD tether back
 * to the spawn anchor (:1404-1560) — 21 particles with gravity, drag
 * and collision against the cube faces. That is history-dependent, so
 * per DECISIONS 2026-08-29 it is the baking case and belongs to a later
 * pass; `cables` exists as the seam and must stay false until then.
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
   * The tether cables back to the spawn anchor. OFF: the XPBD chain is
   * history-dependent and awaits the baking pass (see the header).
   */
  cables = bool(false)

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
