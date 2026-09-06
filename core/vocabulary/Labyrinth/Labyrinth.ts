/**
 * The Labyrinth — the outermost symbol of the TheWall holarchy: a
 * circular maze grown outward from a closed citadel circle, its rim
 * open to the world and its core unreachable (TheWall/TheLabyrinth.py;
 * the maze math itself lives in geometry/labyrinth.ts).
 *
 * TheWall.png — actually this symbol's face (wall-stack-study §Layers)
 * — draws the maze in flat BLUE lines on black, the citadel circle in
 * the same blue, the MolochEye at the center and eight red spiral arcs
 * over it. The eye and the spirals belong to other holons; the
 * Labyrinth is the maze and its citadel.
 *
 * Like Axes, this is a symbolic holon: the CPU decides what exists,
 * compose() runs once, so radius/citadelRadius/cellSize/seed are
 * construction-time. The citadel Circle's radius stays BOUND (the one
 * part whose shape is a live parameter); the chains are Lines whose
 * points are settled data.
 */

import { color, integer, length } from "../../src/params"
import { restage, together, type Anim, type Windowed } from "../../src/anim"
import { Circle, Line, Stroke, dominoWindows } from "../../src/parts/primitives"
import { BLUE } from "../../src/constants"
import { generateLabyrinth, type LabyrinthResult } from "../../src/geometry/labyrinth"

/**
 * Create choreography: the citadel circle draws first — the maze is a
 * gift that grows FROM the citadel — and the wall chains radiate
 * outward (generateLabyrinth orders them by innermost radius) as a
 * domino cascade filling the rest of the span, overlapping the
 * citadel's tail the way Axes' ticks overlap its axes.
 */
const CITADEL_WINDOW = 0.25
const CHAINS_START = 0.15

export class Labyrinth extends Stroke {
  /** ONTOLOGY.md: a sovereign symbol (pre-pop-out) — cast, not asset. */
  static sovereign = true

  /** Outermost wall radius — the open rim. */
  radius = length(650)
  /** The closed inner circle the maze grows from. */
  citadelRadius = length(165)
  /** Ring thickness ≈ cell scale (geometry/labyrinth.ts ringLayout). */
  /** 40 reproduces TheWall.png's measured 12 rings (ring pitch 26.5px,
   *  maze annulus 108.5→428px — see labyrinth-sidebyside-cell40.png). */
  cellSize = length(40)
  /** Maze seed — same seed, same labyrinth (the 2021 default, :49). */
  seed = integer(42)
  override tint = color(BLUE)

  chains: Line[] = []
  citadel!: Circle
  /** The generated maze, kept for introspection and tests. */
  maze!: LabyrinthResult

  protected override compose(): void {
    this.maze = generateLabyrinth({
      radius: this.radius.value,
      citadelRadius: this.citadelRadius.value,
      targetCellSize: this.cellSize.value,
      seed: this.seed.value,
    })
    this.citadel = this.add(
      new Circle({ radius: this.citadelRadius, tint: this.tint, stroke: this.stroke }),
    )
    for (const chain of this.maze.chains) {
      this.chains.push(
        this.add(
          new Line({
            points: chain.map((p) => ({ x: p.x, y: p.y, z: 0 })),
            tint: this.tint,
            stroke: this.stroke,
          }),
        ),
      )
    }
  }

  override createAnim(): Anim {
    void this.parts // ensure compose() has generated the maze
    const windows = dominoWindows(this.chains.length)
    const span = 1 - CHAINS_START
    const items: Windowed[] = [
      [this.citadel.creation.sequence(0, 1), 0, CITADEL_WINDOW],
      ...this.chains.map(
        (line, i): Windowed =>
          restage(
            line.creation.sequence(0, 1),
            CHAINS_START + windows[i]![0] * span,
            CHAINS_START + windows[i]![1] * span,
          ),
      ),
    ]
    return together(...items)
  }
}
