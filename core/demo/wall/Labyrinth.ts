/**
 * Labyrinth.ts — A DreamWeaving
 *
 * The Labyrinth standing alone: the circular maze face of the TheWall
 * holarchy (TheWall.png minus the MolochEye and the eight red spirals,
 * which belong to other holons), drawn from the citadel outward over
 * four seconds and held.
 *
 * ## Framing (the wall report's verification mapping)
 *
 * The default Observer (front view, radius 1500, the framework's
 * 53.13°-vertical lens) projects the z = 0 plane at 720/1500 = 0.48 px
 * per world unit on a 720p frame. TheWall.png (1080×1080) shows the
 * maze rim at ≈ 89% of the frame height; radius 650 lands ours at
 * 624/720 = 87%, with the citadel at the PNG's ≈ 0.25 rim ratio.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { Labyrinth } from "../../vocabulary/Labyrinth/Labyrinth"

export class LabyrinthDream extends Dream {
  maze = new Labyrinth({ stroke: 2 })

  unfold() {
    this.play(Create(this.maze), 4)
    this.wait(2)
  }
}

if (import.meta.main) render(LabyrinthDream)
