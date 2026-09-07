/**
 * Sketch.ts — A DreamWeaving
 *
 * "The Origins of Project Liminality" (2024), Scene 00 — the line
 * portrait, the video's first thirteen seconds and its signature image.
 *
 * Source (refs/pydeation-legacy/object/vector_graphics.py:196):
 *
 *   class David(SVG):
 *       def __init__(self, **params):
 *           super().__init__("david", line_only=True, **params)
 *
 * — a hand-traced Pixelmator drawing, 37 pen strokes in one `<path>`,
 * loaded as splines and drawn on. The asset lived in the C4D preferences
 * folder outside version control and was recovered to
 * refs/pitch/svg-assets/ (docs/reports/origins-vocabulary.md §4); it is
 * flattened to polylines by core/scripts/svg2ts.ts and imported here as
 * data, because the framework runs in a browser and cannot read files.
 *
 * PACING IS NOT YET RIGHT, deliberately. The 2024 scene uses
 * `DrawSteady` — one pen at constant ARC-LENGTH speed across the whole
 * drawing, with `stroke_order="long_short"` deciding which stroke it
 * visits next (chapter O-2). What this scene has is the honest v1:
 * per-subpath windows in document order, sized by each stroke's share of
 * the total arc length. The pen's SPEED is therefore already constant
 * between strokes; only the ORDER (document, not longest-first) and the
 * ease at each seam still differ. The GEOMETRY, which is what O-1 is
 * gated on, is final — compare against
 * refs/pitch/origins/frames5/f_00060.jpg, the finished portrait at t=12.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { Sketch } from "../../vocabulary/Sketch/Sketch"
import { david } from "../../vocabulary/Sketch/assets/david"
import { WHITE } from "../../src/constants"

export class SketchDream extends Dream {
  /**
   * The portrait fills a little under 4/5 of the frame height in the
   * reference (f_00060: the drawing spans roughly y 90…640 of 720), so
   * 550 world units against the 700-unit reference frame the observer's
   * dolly is stated in.
   */
  david = new Sketch({ data: david, height: 550, tint: WHITE, stroke: 2 })

  unfold() {
    this.set(...this.observer.dolly(700))
    this.play(Create(this.david), 4)
    this.wait(2)
  }
}

if (import.meta.main) render(SketchDream)
