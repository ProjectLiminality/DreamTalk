/**
 * FigureBustDemo.ts — A DreamWeaving
 *
 * THE person in its two forms: the whole body draws, holds, and its arch
 * rises into the head-and-shoulders bust every person of the InterBrain film
 * is (form 0 → 1); the bust holds, and goes back to the body.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { WHITE } from "../../src/constants"
import { Figure } from "../../vocabulary/Figure/Figure"

export class FigureBustDemoDream extends Dream {
  person = new Figure({ height: 360, tint: WHITE })

  unfold() {
    this.play(Create(this.person), 2)
    this.wait(1)
    this.play(this.person.form.to(1), 2)
    this.wait(1.5)
    this.play(this.person.form.to(0), 2)
    this.wait(1)
  }
}

if (import.meta.main) render(FigureBustDemoDream)
