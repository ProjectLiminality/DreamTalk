/**
 * Scene00.ts — A DreamWeaving
 *
 * "The Origins of Project Liminality" (2024), Scene 00 — the line
 * portrait, the video's first thirteen seconds and its signature image.
 *
 * A face draws itself out of the dark, holds for nine seconds while the
 * narration opens, and is wiped away. One object, three verbs, and the
 * whole thing rests on a single idea: the pen moves at ONE SPEED. Not
 * one duration per stroke — one speed, for the entire drawing. That is
 * what makes it read as a hand drawing rather than an animation playing.
 *
 * Source (refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py:5-19):
 *
 *   picture = David(scale=2 / 3, thickness=2 / 3)
 *   self.add(picture)
 *   self.play(DrawSteady(picture, draw_speed=10000,
 *                        stroke_order="long_short"), run_time=3)
 *   self.wait(9)
 *   self.play(Erase(picture))
 *
 * `David` is `SVG("david", line_only=True)`
 * (refs/pydeation-legacy/object/vector_graphics.py:196) — a hand-traced
 * drawing of 37 pen strokes, recovered to refs/pitch/svg-assets/ and
 * flattened to polylines by core/scripts/svg2ts.ts.
 *
 *
 * THE 13 SECONDS, AND WHY THE DRAW IS 2.1s AND NOT 3
 *
 * The source says `run_time=3` and the video shows a 2.1-second draw.
 * Both are true, and the discrepancy is the whole lesson of the verb.
 * `DrawSteady` puts C4D's Sketch & Toon into `sketch_speed="pixels"`
 * mode, where `draw_speed` fixes the pen's rate and the drawing takes
 * however long its own arc length requires; `run_time` is only the outer
 * span the effect sits inside, and any remainder is a hold. The arc here
 * needs 2.111s at 10000 px/s (core/src/steady.ts derives the number), so
 * the 3-second span carries 2.111s of drawing and 0.889s of stillness.
 *
 * Measured off refs/pitch/origins/frames5 — lit-pixel count per frame,
 * as a fraction of the finished drawing:
 *
 *   t     0.2   0.4   0.6   0.8   1.0   1.2   1.4   1.6   1.8   2.0   2.2   2.4
 *   frac  .020  .127  .226  .334  .440  .533  .619  .716  .809  .890  .973  1.000
 *
 * Dead linear — a least-squares fit gives a 2.095s draw beginning at
 * t=0.117, against the predicted 2.111s. A `Create` would carry C4D's
 * default ease and bow this curve visibly at both ends; there is no bow.
 * The absence of easing is not a simplification here, it is the
 * measurement.
 *
 * That fixes the rest of the timeline by arithmetic, and the reference
 * confirms each landmark:
 *
 *   0.00 – 0.12   the leading beat before the pen touches down
 *   0.12 – 2.23   the draw, linear (f_00012 at t=2.4 is the first frame
 *                 at full ink, and every frame to f_00061 matches it)
 *   2.23 – 3.12   the tail of the run_time=3 span, held
 *   3.12 – 12.12  `wait(9)`
 *   12.12 – 13.12 `Erase`, run_time=1, C4D-smooth
 *
 * The erase is the one eased move in the scene, and the frames say so:
 * remaining fractions .997 (t=12.2) .888 .663 .386 .124 .000 (t=13.2),
 * whose deltas rise and then fall — .109 .225 .278 .262 .124 — the
 * S-curve of a default-smoothed span, not a linear wipe. Black at
 * f_00066 (t=13.2) is the cut to Scene01, which the source's own
 * `offset=13` predicts.
 *
 *
 * FRAMING
 *
 * A `TwoDScene` is an orthographic camera at zoom 1, which frames 1023
 * world units of width (dream.ts: ZOOM_REFERENCE_WIDTH) across the
 * render — 1.25122 px per world unit at 1280 wide. `scale=2/3` is C4D's
 * plain object scale on the SVG's native units, so the portrait's
 * 651.044-unit source height becomes 434.03 world units.
 *
 * That prediction is exact against the reference. Projected, the drawing
 * should span 543.1 x 464.5 px centred in frame — bbox x[407.7, 872.3]
 * y[88.5, 631.5]. f_00060 measures x[407, 873] y[88, 632]: within a
 * pixel on all four edges, the excess being the stroke straddling the
 * bounding box. The source aspect (0.85541) and the measured aspect
 * (0.85662) agree to 0.14%, which is what confirms the recovered asset
 * is the drawing that was actually rendered.
 *
 * `thickness=2/3` is two thirds of pydeation's VG_THICKNESS = 5
 * (refs/pydeation-legacy/constants.py:49) — 10/3 S&T pixel units. The
 * reference's own lines measure a modal 3px wide at the scorer's
 * threshold, and `stroke` is already in rendered pixels here, so 2 sits
 * inside that. It is deliberately NOT fitted: swept over 1.5/2/2.5 the
 * full-span verdict is 11/13 at every value and mean coverage moves in
 * the fourth decimal, so there is nothing to fit and the source's own
 * ratio is the honest number to carry.
 *
 *
 * WHAT STILL DIFFERS
 *
 * Two frames of the scored span fail, both mid-transition, and the
 * cause is the same in each: C4D's pen is one GLOBAL front over the
 * whole drawing, while ours is a front per stroke.
 *
 *  - t=1.2 (mid-draw). The total ink is right — measured lit-pixel
 *    fractions track the linear model to ~1% all the way down the draw —
 *    but it is distributed differently. At t=0.8 the reference already
 *    has ink in the shoulders while the top of the head is unfinished;
 *    strict longest-first sequencing cannot be in two places at once.
 *    The order itself is not in doubt: scoring all five of pydeation's
 *    stroke orders by ink-distribution similarity, `long_short` wins or
 *    ties at every sampled frame (0.997 / 0.816 / 0.742 / 0.824 / 0.922
 *    / 0.952 against short_long's 0.000 / 0.015 / 0.590 / 0.648 / 0.874
 *    / 0.938), and at t=0.2 the lit region sits exactly on the longest
 *    stroke's first 400px.
 *
 *    The residue is that S&T's stroke CONNECTION re-cuts the subpaths
 *    into its own stroke set BEFORE ordering them, and the flattened
 *    asset cannot see those cuts. The composite at t=1.2 shows it
 *    plainly (docs/reports/origins/o2-f_00006-composite.png): we draw
 *    the hair, the reference draws the jaw and shoulders. Our longest
 *    subpath is one 7811-unit hair scribble — but a scribble is exactly
 *    what stroke connection breaks apart, which would demote it out of
 *    first place. Re-splitting the subpaths at direction reversals
 *    sharper than 90 degrees turns 37 strokes into 313, drops the
 *    longest to 522 units, and lifts the late-draw similarity from
 *    0.824/0.922 to 0.939/0.969 — the right diagnosis. It is not
 *    applied here because it costs the early frames as much as it wins
 *    the later ones (mean 0.851 to 0.867), so the split ANGLE would be
 *    a fitted parameter standing in for a C4D behaviour we can read
 *    directly. Recovering S&T's real connection rule is the honest fix,
 *    and it belongs to whoever ports stroke connection, not to a magic
 *    number here.
 *
 *  - t=12.6-13.0 (mid-erase), for the mirror-image reason. Per-stroke
 *    erasure — what `Erase` does — is nonetheless the best of the three
 *    candidates measured (0.950 / 0.889 / 0.736 / 0.665 against a
 *    steady long_short front's 0.896 / 0.737 / 0.616 / 0.467 and a
 *    reverse-order front's 0.928 / 0.813 / 0.804 / 0.267), so it stays.
 *
 * Everything either side of those transitions is exact: the finished
 * portrait and the whole nine-second hold score coverage 1.000/0.996 at
 * a chamfer of 0.37px, which is the encode floor.
 */

import { Dream, render } from "../../src/index"
import { DrawSteady, steadyDuration } from "../../src/steady"
import { Erase } from "../../src/verbs"
import { Sketch } from "../../vocabulary/Sketch/Sketch"
import { david } from "../../vocabulary/Sketch/assets/david"
import { WHITE } from "../../src/constants"

/** The SVG asset's own height, in its own units — the thing `scale` scales. */
const DAVID_SOURCE_HEIGHT = 651.044

/** pydeation's VG_THICKNESS (constants.py:49), the SVG stroke default. */
const VG_THICKNESS = 5

/**
 * The reference render width, which is the unit `draw_speed` is counted
 * in (`sketch_speed="pixels"`). Stated here rather than read from the
 * canvas because the scene's TIMING must not change with the window.
 */
const FRAME_WIDTH = 1280

/** TwoDScene at camera_zoom = 1 frames 1023 world units of width. */
const ORTHO_FRAME_WIDTH = 1023

/**
 * The leading beat before the pen touches down, fitted off the frames
 * (0.117s; see the header). Small, but it is the difference between the
 * draw landing on the reference frames and running a frame ahead of them
 * for its whole length.
 */
const START_OFFSET = 0.117

export class Scene00Dream extends Dream {
  david = new Sketch({
    data: david,
    height: (DAVID_SOURCE_HEIGHT * 2) / 3,
    tint: WHITE,
    stroke: 2,
  })

  unfold() {
    this.set(
      this.observer.orthographic.to(true),
      this.observer.zoom.to(1),
      this.observer.baseHeight.to(700),
    )

    // The source's own numbers, converted through the scene's own
    // projection — the draw's length is a consequence of the pen's
    // speed, never a hand-tuned run_time.
    const draw = steadyDuration(this.david, {
      speed: 10000,
      pxPerUnit: FRAME_WIDTH / ORTHO_FRAME_WIDTH,
      order: "long_short",
    })

    this.wait(START_OFFSET)
    this.play(DrawSteady(this.david, { order: "long_short" }), draw)
    // The remainder of the source's run_time=3 span, held.
    this.wait(3 - draw)
    this.wait(9)
    this.play(Erase(this.david), 1)
  }
}

if (import.meta.main) render(Scene00Dream)
