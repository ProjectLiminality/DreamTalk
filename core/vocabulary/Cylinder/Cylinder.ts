import { derive, length } from "../../src/params"
import { Circle, Rectangle, Square, Stroke } from "../../src/parts/primitives"
import type { Overrides } from "../../src/holon"
import { squareCircleCylinder } from "../../src/geometry/sdf"

/**
 * A cylinder along local +Y — the star of the 2021 vocabulary. Defaults
 * radius 50 × height 200 per the source (C4D's own defaults, deliberately
 * matching circle r=50 and rectangle 100×200 in video-01).
 *
 * Its wireframe is entirely view-dependent: the host renders the two cap
 * circles (always full circles — no hidden-line removal, per the 2021
 * look) plus the two mantle silhouette generators computed analytically
 * per frame from the camera position (render/silhouette.ts). Draw-on runs
 * the four strokes sequentially, arc-length-proportioned, like Sketch &
 * Toon's "single" stroke method: top cap → bottom cap → the two lines.
 */
export class Cylinder extends Stroke {
  /** ONTOLOGY.md: a sovereign symbol (pre-pop-out) — cast, not asset. */
  static sovereign = true
  radius = length(50)
  height = length(200)

  /**
   * The cylinder a square (or rectangle) and a circle are both partial
   * views of — their intersection (geometry/sdf.ts): the profile pushed
   * back through depth, the circle pushed up through height. Its radius
   * and height are DERIVED readings of the parts, not copies, so the
   * cylinder follows whatever they become: grow the circle, or swap the
   * rectangle for a square, and it is still exactly their intersection
   * (ONTOLOGY.md 2026-09-16, "the test of elegance"). To change it,
   * change them.
   *
   * The intersection is a cylinder only while the profile spans the
   * circle (width ≥ 2·radius); a narrower profile would shave flats off
   * the mantle, which no cylinder draws — `squareCircleCylinder(...).exact`
   * says which side of that line a pair is on.
   */
  static of(profile: Square | Rectangle, circle: Circle, overrides: Overrides = {}): Cylinder {
    const width = () => (profile instanceof Square ? profile.size.value : profile.width.value)
    const height = () => (profile instanceof Square ? profile.size.value : profile.height.value)
    const shape = () => squareCircleCylinder(width(), height(), circle.radius.value)
    return new Cylinder({
      ...overrides,
      radius: derive(() => shape().radius),
      height: derive(() => shape().height),
    })
  }
}
