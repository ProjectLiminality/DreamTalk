/**
 * MolochEye.ts — A DreamWeaving
 *
 * The MolochEye standing alone: the sovereign face of the innermost
 * TheWall holon, drawn from nothing over three seconds and held.
 *
 * ## Framing (the wall report's verification mapping)
 *
 * The default Observer (front view, radius 1500, the framework's 53.13°
 * vertical lens) projects the z = 0 plane at 720/1500 = 0.48 px per
 * world unit on a 720p frame. The canonical PNG measures h = 819px at
 * 3316x1660; scaled into the frame at h = 300px, the lens tips land at
 * 640 ± 600 and the apexes at 360 ± 300 — so height = 300/0.48 = 625
 * world units, and the white stroke is the face's own 0.0246h = 7.38px.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { LENS_STROKE_RATIO, MolochEye } from "../../vocabulary/MolochEye/MolochEye"

/** Lens half-height on screen, px at 720p. */
const H_PX = 300
/** Default observer: 720p across a 53.13°-vertical frustum at 1500. */
const PX_PER_UNIT = 720 / 1500

export class MolochEyeDream extends Dream {
  eye = new MolochEye({
    height: H_PX / PX_PER_UNIT,
    stroke: LENS_STROKE_RATIO * H_PX,
  })

  unfold() {
    this.play(Create(this.eye), 3)
    this.wait(2)
  }
}

if (import.meta.main) render(MolochEyeDream)
