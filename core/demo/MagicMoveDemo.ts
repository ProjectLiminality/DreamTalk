/**
 * MagicMoveDemo.ts — A DreamSong
 *
 * The cross-scene Magic Move, shown rather than argued (ONTOLOGY.md
 * "Magic Move: one operator, self-similar across levels", point 2).
 *
 * Three deliberately plain chapters, so that what moves is the
 * TRANSITION and not the scenes. Each chapter names its roots, and the
 * names are the whole argument:
 *
 *   chapter   circle              other root   what the boundary must do
 *   ONE       left,  small, BLUE    square     —
 *   TWO       right, large, RED     —          circle glides, grows,
 *                                               retints; square builds out
 *   THREE     up,    small, GREEN   eye        circle glides again,
 *                                               eye builds in
 *
 * The circle's size travels through `scale`, not `radius`: the glide
 * interpolates the standard transform (x/y/z/h/p/b/scale) plus the
 * stroke face (tint, stroke), which is what a Magic Move is entitled to
 * move. `radius` is the circle's SHAPE — changing it between chapters
 * would be a morph, and morphs are the later chapter of this work
 * (ONTOLOGY: "later by shape for true morphs"). Stating size as scale
 * keeps one radius across all three, so the roots really are the same
 * circle seen from three moments rather than three different circles.
 *
 * `circle` is the same field name in all three, so the identity pass
 * matches it across both boundaries and it GLIDES — one continuous
 * object crossing a cut, which is the trick Keynote is famous for.
 * `square` exists only in ONE and `eye` only in THREE: nothing matches
 * them, so they build out and in on the window's 40% ramps. The camera
 * dollies between three different distances, and because the observer
 * always matches itself it glides too — the viewer travels rather than
 * being teleported.
 *
 * Each chapter also holds still on either side of its boundary, so a
 * frame grabbed at a window's MIDPOINT is unambiguous: everything moving
 * there is the transition's doing.
 */

import { Dream, render } from "../src/index"
import { DreamSong } from "../src/song"
import { magicMove } from "../src/transitions"
import { Circle, Square } from "../src/parts/primitives"
import { Eye } from "../vocabulary/Eye/Eye"
import { BLUE, RED, GREEN } from "../src/constants"

/** The overlap every boundary here opens. */
export const WINDOW = 1.5

/** Blue circle at the left, with a square beside it that will not survive. */
export class MagicMoveOne extends Dream {
  circle = new Circle({ x: -420, y: 0, radius: 130, scale: 1, tint: BLUE })
  square = new Square({ x: 260, y: 0, size: 200, tint: BLUE })

  unfold() {
    this.set(...this.observer.dolly(1500))
    this.stage(this.circle)
    this.stage(this.square)
    this.wait(3)
  }
}

/** The circle alone, moved right and retinted red — nothing else on stage. */
export class MagicMoveTwo extends Dream {
  circle = new Circle({ x: 420, y: -140, radius: 130, scale: 1.9, tint: RED })

  unfold() {
    this.set(...this.observer.dolly(1900))
    this.stage(this.circle)
    this.wait(3)
  }
}

/** The circle up and green, with an Eye arriving that was never here before. */
export class MagicMoveThree extends Dream {
  circle = new Circle({ x: -80, y: 300, radius: 130, scale: 0.7, tint: GREEN })
  eye = new Eye({ scale: 1.4, x: -160, y: -220 })

  unfold() {
    this.set(...this.observer.dolly(1200))
    this.stage(this.circle)
    this.stage(this.eye)
    this.wait(3)
  }
}

/**
 * The song. A boundary is upgraded by one word — `magicMove(WINDOW)`
 * where a bare entry would have cut — which is the authoring seam the
 * editor will eventually write into: same list, same spelling, one
 * token changed.
 */
export class MagicMoveDemoDream extends DreamSong {
  constructor() {
    super([
      MagicMoveOne,
      [MagicMoveTwo, magicMove(WINDOW)],
      [MagicMoveThree, magicMove(WINDOW)],
    ])
  }
}

if (import.meta.main) render(MagicMoveDemoDream)
