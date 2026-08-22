/**
 * StrokeCalibration.ts — A DreamWeaving
 *
 * The Chapter-4 calibration page: circle, square, and arc held at draw
 * fractions 0.25 / 0.5 / 0.75 / 1.0 (columns), white strokes on black,
 * plus one continuously drawing circle at the bottom — screenshot it at
 * two nearby t values to verify sub-segment (arc-length-continuous)
 * draw-on progression.
 */

import { Dream, render } from "../src/index"
import { Create } from "../src/index"
import { PI } from "../src/constants"
import { Arc, Circle, Square } from "../src/parts/index"

const FRACTIONS = [0.25, 0.5, 0.75, 1.0]
const COLUMN_X = [-900, -300, 300, 900]

export class StrokeCalibrationDream extends Dream {
  drawing = new Circle({ radius: 130, y: -520 })

  unfold() {
    FRACTIONS.forEach((creation, i) => {
      const x = COLUMN_X[i]!
      this.stage(new Circle({ radius: 100, x, y: 480, creation }))
      this.stage(new Square({ size: 200, x, y: 160, creation }))
      this.stage(new Arc({ radius: 100, startAngle: PI / 2, endAngle: 2 * PI, x, y: -180, creation }))
    })
    this.play(Create(this.drawing), 10)
  }
}

if (import.meta.main) render(StrokeCalibrationDream)
