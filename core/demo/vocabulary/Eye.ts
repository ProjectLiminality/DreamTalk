/**
 * Eye.ts — A DreamWeaving
 *
 * The Eye standing alone — the video-01 creature at full size: the pen
 * runs the upper lid in to the apex and back out along the lower, the
 * eyeball arc spans the fan, the iris fills, the pupil is already
 * there. Created, held, and un-created (it loses its look before it
 * loses its shape).
 */

import { Dream, render } from "../../src/index"
import { Create, UnCreate } from "../../src/verbs"
import { Eye } from "../../vocabulary/Eye/Eye"

export class EyeDream extends Dream {
  /** Gaze along +x; the fan spans x 0…230·scale, so shift to center it. */
  eye = new Eye({ scale: 2, x: -230 })

  unfold() {
    this.play(Create(this.eye), 2.5)
    this.wait(2)
    this.play(UnCreate(this.eye), 2)
    this.wait(0.5)
  }
}

if (import.meta.main) render(EyeDream)
