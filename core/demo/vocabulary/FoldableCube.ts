/**
 * FoldableCube.ts — A DreamWeaving
 *
 * The trap standing alone, seen from a three-quarter orbit so the
 * wireframe reads as a body: drawn at fold 1 (the open cup whose
 * missing top the trapped mind doesn't see), flared open to the
 * jellyfish bell, snapped shut, then folded through to −1 — wrapped
 * around whatever it was pressed against — and back.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { FoldableCube } from "../../vocabulary/FoldableCube/FoldableCube"
import { PI } from "../../src/constants"

export class FoldableCubeDream extends Dream {
  cube = new FoldableCube({ size: 220, fold: 1 })

  unfold() {
    this.set(
      ...this.observer.orbit({ phi: PI / 5, theta: PI / 7 }),
      ...this.observer.dolly(900),
    )
    this.play(Create(this.cube), 2)
    this.wait(0.4)
    this.play(this.cube.fold.to(0.1), 1) // the bell flares open
    this.play(this.cube.fold.to(1), 0.6) // and snaps shut
    this.wait(0.4)
    this.play(this.cube.fold.to(-1), 1.6) // folded through: the wrap
    this.wait(0.5)
    this.play(this.cube.fold.to(1), 1.6)
    this.wait(1)
  }
}

if (import.meta.main) render(FoldableCubeDream)
