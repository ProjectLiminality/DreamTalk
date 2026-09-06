import { length } from "../../src/params"
import { Stroke } from "../../src/parts/primitives"

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
}
