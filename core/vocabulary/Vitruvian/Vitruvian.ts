/**
 * Vitruvian — Da Vinci's man inside his circle and square, drawn by Fourier
 * epicycles.
 *
 * SOURCE. The Liminal Consulting Web3 video (~93–106s) traced the Vitruvian
 * Man with a 3Blue1Brown epicycle chain inside a RED circumscribing circle and
 * a BLUE square (docs/reports/web3-recon.md, set-piece B). The standalone
 * scene (`?scene=vitruvian`, demo/web3/VitruvianMan.ts) and the song's shot
 * 12 (Shot12Vitruvian.ts) each built it from the same parts; it is one
 * symbol, so it is one holon (docs/TASTE.md, "One symbol, one
 * implementation").
 *
 * DERIVED FROM THE PIXELS: the figure is `VITRUVIAN_PATH` (./path.ts — a
 * TRACE of refs/web3/frames6/vitruv_00051.png, method in its header), and
 * the circle and square were measured from that frame under the same scale:
 * the red circle radius ~314 centred ~53 above the figure (Da Vinci's navel
 * circle), the blue square side ~524 centred on it. Both are centred on
 * x = 0 exactly (the frame's ~9px offsets are noise; the figure is
 * symmetric).
 *
 * WHAT IT IS MADE OF (attach order is composite order): `circle`, `square`,
 * then — if `figureTerms` > 0 — `figure`, the finished outline held at
 * `turn` 1 with no machinery, and last `pen`, the epicycle machine whose
 * `turn` runs 0 → 1 to draw the man. They are the same series, so the pen
 * and the figure can never disagree.
 *
 * CHOSEN: `penTerms` 130 — a handful of big circles carry the pose and the
 * tail smooths fingers and feet, while the machine still reads as a chain of
 * circles, not a solid disc. `startAt` rolls where the closed path begins
 * (a Fourier series is periodic: the start changes only the phase, never the
 * curve) — 0 is the bottom centre heading left, as shot 12's pen goes;
 * START_AT_HEAD (355, the crown) makes the pen finish on the head.
 */

import { Circle, Null, Square } from "../../src/parts/primitives"
import { completion, length } from "../../src/params"
import { BLUE, RED } from "../../src/constants"
import type { Overrides } from "../../src/holon"
import { FourierTrace } from "../Fourier/Fourier"
import { VITRUVIAN_PATH } from "./path"

/** The crown — the topmost point of the trace (see `startAt`). */
export const START_AT_HEAD = 355

/** Da Vinci's circle + square, measured from the frame (see header). */
export const CIRCLE_R = 314
export const CIRCLE_Y = 53
export const SQUARE_SIZE = 524
export const SQUARE_Y = 2

const roll = <T,>(pts: readonly T[], at: number): T[] => [...pts.slice(at), ...pts.slice(0, at)]

export class Vitruvian extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The circle's and square's pen, and how present each is. */
  frameStroke = length(3)
  circleOpacity = completion(1)
  squareOpacity = completion(1)
  /** The figure's pen (the held outline and the pen's ink). */
  figureStroke = length(3)

  /** Epicycles in the drawing machine — construction-time. */
  penTerms = 130
  /** Terms of the held, finished figure; 0 (the default) holds none — construction-time. */
  figureTerms = 0
  /** Index the closed path starts at (0 = bottom centre; START_AT_HEAD = the crown) — construction-time. */
  startAt = 0

  circle: Circle
  square: Square
  figure?: FourierTrace
  pen: FourierTrace

  constructor(overrides: Overrides = {}) {
    super(overrides)
    const path = roll(VITRUVIAN_PATH, this.startAt)
    this.circle = this.add(new Circle({ radius: CIRCLE_R, y: CIRCLE_Y, tint: RED, stroke: this.frameStroke, opacity: this.circleOpacity }))
    this.square = this.add(new Square({ size: SQUARE_SIZE, y: SQUARE_Y, tint: BLUE, stroke: this.frameStroke, opacity: this.squareOpacity }))
    if (this.figureTerms > 0) {
      this.figure = this.add(
        new FourierTrace({ path, terms: this.figureTerms, stroke: this.figureStroke, turn: 1, showMachine: false }),
      )
    }
    this.pen = this.add(new FourierTrace({ path, terms: this.penTerms, stroke: this.figureStroke }))
  }
}
