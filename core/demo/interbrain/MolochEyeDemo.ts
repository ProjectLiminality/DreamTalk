/**
 * MolochEyeDemo.ts — A DreamWeaving
 *
 * The eye, domesticated and liminal (f31 → f12661 → f12691): the
 * MolochEye draws itself with the blue cube in its iris, then the cube
 * leaves and the red Vision mark arrives in its place (`iris` 0 → 1),
 * holds, and the cube returns (1 → 0).
 *
 * Framing: f12691's iris ring is 102 px at 720p; drawn here at h = 150 px
 * (÷ 0.48 px per unit, the default eye), the white pen the face's own
 * 0.0246·h.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { LENS_STROKE_RATIO, MolochEye } from "../../vocabulary/MolochEye/MolochEye"

const PX = 720 / 1500
const H_PX = 150

export class MolochEyeDemoDream extends Dream {
  eye = new MolochEye({ height: H_PX / PX, stroke: LENS_STROKE_RATIO * H_PX })

  unfold() {
    this.play(Create(this.eye), 3)
    this.wait(1)
    this.play(this.eye.iris.to(1), 2.5)
    this.wait(1.5)
    this.play(this.eye.iris.to(0), 2.5)
    this.wait(1)
  }
}

if (import.meta.main) render(MolochEyeDemoDream)
