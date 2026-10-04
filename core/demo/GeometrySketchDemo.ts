/**
 * GeometrySketchDemo.ts — A DreamWeaving
 *
 * The GeometrySketch ability at work (ONTOLOGY.md 2026-09-16): five
 * shapes, each handed to the same sketcher. The square gets its four
 * right-angle squares, the triangle and pentagon their arcs, the concave
 * outline an arc that sweeps INSIDE its notch corner, and the circle —
 * having no angle — nothing. Then the square tilts out of the screen and
 * the pentagon grows: the marks follow, because they are read off the
 * shapes, not placed beside them.
 */

import { Dream, render } from "../src/index"
import { Create, together } from "../src/index"
import { BLUE, PI } from "../src/constants"
import { Circle, Line, Polygon, Square } from "../src/parts/index"
import "../vocabulary/GeometrySketch/GeometrySketch"
import { GeometrySketch } from "../vocabulary/GeometrySketch/GeometrySketch"

const notch = [
  { x: -70, y: -70, z: 0 },
  { x: 70, y: -70, z: 0 },
  { x: 70, y: 0, z: 0 },
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 70, z: 0 },
  { x: -70, y: 70, z: 0 },
  { x: -70, y: -70, z: 0 },
]

export class GeometrySketchDemoDream extends Dream {
  square = new Square({ size: 160, x: -480 })
  triangle = new Polygon({ sides: 3, radius: 95, x: -240, y: -10 })
  pentagon = new Polygon({ sides: 5, radius: 85, x: 0 })
  custom = new Line({ points: notch, x: 240 })
  circle = new Circle({ radius: 80, x: 480 })

  squareMarks = new GeometrySketch(this.square, { tint: BLUE })
  triangleMarks = new GeometrySketch(this.triangle, { tint: BLUE })
  pentagonMarks = new GeometrySketch(this.pentagon, { tint: BLUE })
  customMarks = new GeometrySketch(this.custom, { tint: BLUE })
  circleMarks = new GeometrySketch(this.circle, { tint: BLUE })

  unfold() {
    this.set(...this.observer.dolly(1250))
    this.play(
      together(
        Create(this.square),
        Create(this.triangle),
        Create(this.pentagon),
        Create(this.custom),
        Create(this.circle),
      ),
      2,
    )
    this.play(
      together(
        Create(this.squareMarks),
        Create(this.triangleMarks),
        Create(this.pentagonMarks),
        Create(this.customMarks),
        Create(this.circleMarks),
      ),
      1.5,
    )
    this.wait(0.5)
    this.play(together(this.square.p.to(PI / 3), this.pentagon.radius.to(110)), 2.5)
    this.wait(1)
  }
}

if (import.meta.main) render(GeometrySketchDemoDream)
