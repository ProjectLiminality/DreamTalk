/**
 * S05.ts — A DreamWeaving
 *
 * video-01 "Dialectical Thinking" (2021), Scene 05 — the two projections.
 *
 * A corner of axes opens like a V at the centre; a blue circle stands off
 * to the right and a red rectangle leans away to the left, drawn in the
 * two orthogonal planes the axes name. Then the white cylinder fades in
 * between them and the picture resolves: the circle and the rectangle
 * were never two things — they are the SAME solid, seen along its two
 * axes. Thesis and antithesis as one body's two shadows. Everything
 * leaves the way it came.
 *
 * Source (refs/video-01-source-2022/dialectical_thinking.py:285-319):
 *
 *   CONFIG = camera_perspective "default", camera_position (0, 50), zoom 1
 *   circle    = Circle(color=BLUE, radius=50, y=-300)
 *   rectangle = Rectangle(color=RED, h=PI/2, p=PI/2, width=100, height=200, x=-300)
 *   cylinder  = Cylinder(p=PI/2)
 *   orthogonal_axes = Axes(mode="xy", x_start=0, x_end=300,
 *                          y_start=0, y_end=300, b=PI, draw_ticks=False)
 *   wait(2)
 *   play(Create(orthogonal_axes, smoothing_right=0, rel_end_point=1/2),
 *        Create(circle, rectangle, smoothing_left=0, rel_start_point=1/3), run_time=2)
 *   wait(3)
 *   play(FadeIn(cylinder))
 *   wait()
 *   play(FadeOut(cylinder),
 *        UnCreate(orthogonal_axes, rel_end_point=1/2, smoothing_right=0),
 *        UnCreate(circle, rectangle, rel_start_point=1/3, smoothing_left=0))
 *
 * The axis dictionary is the fixed one CameraCal.ts establishes:
 * (X, Y, Z)c4d → (x, z, y) and (h, p, b)c4d → (b, p, h). So the source's
 * out-of-plane `y=-300` is our z, its `x=-300` stays x, its mode "xy"
 * is our "xz", and its `b=PI` is our h.
 *
 * Nothing below is fitted except START_OFFSET, which is a single
 * measured constant (see its own note, including the one residual this
 * scene does NOT model). With the calibrated
 * camera the source coordinates ARE the reference pixels: the axes
 * vertex predicts (640.0, 418.0) against a measured (639, 418), and the
 * rectangle's four corners predict (319.8, 298.7) (496.5, 250.2)
 * (500.7, 344.4) (330.3, 401.9) against a measured (322, 296) (498, 250)
 * (503, 345) (328, 402).
 */

import { Dream, render } from "../../src/index"
import { PI } from "../../src/constants"
import { eased, restage, together } from "../../src/anim"
import { Create, UnCreate, FadeIn, FadeOut } from "../../src/verbs"
import { Circle, Rectangle } from "../../src/parts/index"
import { Axes } from "../../vocabulary/Axes/Axes"
import { Cylinder } from "../../vocabulary/Cylinder/Cylinder"
import { BLUE, RED, STROKE_MAIN } from "./palette"

/**
 * The measured scene-start offset — the head the gauntlet's span start
 * cuts off, carried as a negative leading wait so every play() run_time
 * and every wait() below stays verbatim from the source.
 *
 * The gauntlet maps localT = videoSec - 89, and the drawing demonstrably
 * begins just before video 89.8 (frames5 f0448 carries 0 lit pixels,
 * f0449 carries 256). Reading the axes' drawn fraction straight off the
 * reference — the arms' reach from the vertex at f0449-f0452 gives
 * .012 .069 .209 .423 of the 300-unit arm — and fitting the 1s window
 * with the ease the source asks for lands the play at video 89.770,
 * i.e. a scene t=0 at 87.770.
 *
 * RE-MEASURED after the stroke-width fix (commit c0a9cc6). The original
 * -1.23 was swept against composites rendered with strokes ~1.76x too
 * fat, which bloated every partial-draw frame and biased the sweep late.
 * Three independent routes now agree on ~-1.255:
 *
 *   1. The cylinder's FadeIn ramp, isolated to the pixels the cylinder
 *      alone lights (lit in f0482 AND dark in f0470 — 4889 px) and
 *      measured in LINEAR light: alpha .025 .275 .606 .848 .976 .997 at
 *      video 94.8-95.8. Fitting the source's 1s run_time with the
 *      default 0.25 ease puts the play at 94.717, i.e. scene t=0 at
 *      87.717 (-1.283).
 *   2. The same fit run jointly over FadeIn and FadeOut with the gap
 *      between them pinned to the source's wait(1): t=0 at 87.748
 *      (-1.252).
 *   3. The gauntlet itself at step 1: -1.26/-1.27/-1.28 all score 40/40,
 *      where -1.25 scores 39/40, -1.24 scores 38/40 and -1.23 scores
 *      39/40. A three-sample-wide plateau at 5fps, not a knife edge.
 *
 * -1.26 is the plateau's leading edge and carries the best mean coverage
 * (ref 0.9997 / ours 0.9996).
 *
 * NOT modelled, and left honest: the reference holds the cylinder at
 * full opacity for ~2.19s between the two fade starts where the source
 * demands exactly 2.0s, and each fade fits a duration nearer 0.85s than
 * the source's 1.0s. No single-parameter reading of the pydeation source
 * explains that — FadeIn/FadeOut drive S&T's
 * OUTLINEMAT_ANIMATE_STROKE_SPEED_COMPLETE in sketch_mode="opacity"
 * (animator.py:399-439), whose completion -> opacity transfer we model as
 * linear. Fitting a per-fade start and duration would close the gap with
 * four free parameters that encode nothing about the 2021 system, so the
 * residual is left visible here instead. It costs nothing at the pass
 * bar: every frame passes with the linear model.
 */
const START_OFFSET = -1.26

export class S05Dream extends Dream {
  // Circle(color=BLUE, radius=50, y=-300) — pydeation's out-of-plane y is
  // our z, so the circle stands 300 units toward the camera's right in the
  // 3/4 view, where it reads as an upright ellipse.
  //
  // The pen starts at 45 degrees and runs clockwise, exactly as in S04:
  // measured off the reference by the covered arc's fixed end (screen
  // angle 46 degrees at f0453-f0458, with the drawn arc growing BACKWARDS
  // from it: 331 → 270 → 205 → 140 → 92 → 54). drawStart locates the
  // point along the outline's own winding; drawReversed turns the pen
  // around at it.
  circle = new Circle({
    radius: 50,
    tint: BLUE,
    z: -300,
    drawStart: 1 / 8,
    drawReversed: true,
    stroke: STROKE_MAIN,
  })
  // Rectangle(color=RED, h=PI/2, p=PI/2, width=100, height=200, x=-300).
  //
  // The legacy h is our b and its p is our p, but C4D composes HPB and we
  // compose the same triple in three's 'ZXY' order — the net orientation
  // is the cyclic permutation that sends the rectangle's own width axis
  // to our +y and its height axis to our +z, i.e. h=PI/2, p=PI/2 here.
  // It stands as a 100-tall, 200-deep plane facing along x, which is the
  // parallelogram the reference shows leaning away to the left.
  //
  // Same clockwise winding as the circle, starting at the TOP-RIGHT
  // corner: f0453 is a bare right edge drawn downward, f0454 adds the
  // bottom edge running left, f0456 reaches the left edge. That corner is
  // local (w, -h) = 50 of the way along the outline's 600-unit perimeter,
  // and the reference walks the outline BACKWARDS from it.
  rectangle = new Rectangle({
    width: 100,
    height: 200,
    tint: RED,
    x: -300,
    h: PI / 2,
    p: PI / 2,
    drawStart: 1 / 12,
    drawReversed: true,
    stroke: STROKE_MAIN,
  })
  // Cylinder(p=PI/2) — C4D's Ocylinder defaults, r=50 and h=200, which
  // the source never overrides because they ARE the circle's radius and
  // the rectangle's extents. The pitch lays it down between the two.
  cylinder = new Cylinder({ radius: 50, height: 200, p: PI / 2, stroke: STROKE_MAIN })
  // Axes(mode="xy", x_start=0, x_end=300, y_start=0, y_end=300, b=PI,
  // draw_ticks=False) — two arrowed arms from the origin. pydeation's
  // "xy" is our "xz" (its out-of-plane y is our z) and its b is our h: a
  // half-turn about screen-up, which is what points both arrows AWAY
  // from the vertex to left and right rather than into the scene.
  axes = new Axes({
    mode: "xz",
    xStart: 0,
    xEnd: 300,
    zStart: 0,
    zEnd: 300,
    h: PI,
    drawTicks: false,
    drawGrid: false,
    arrowEnd: true,
    stroke: STROKE_MAIN,
  })

  unfold() {
    // CONFIG camera_perspective "default" — the 3/4 orbit, the 1000-unit
    // distance and the 36mm lens, all carried by look(). camera_position
    // (0, 50) is a pan: pydeation's second coordinate is c4d Z, our y.
    // It is what puts the origin at (640, 418) instead of frame centre.
    this.observer.look("default")
    this.set(...this.observer.pan({ y: 50 }))
    this.wait(START_OFFSET)
    this.wait(2)
    // One 2s span, two staggered halves. The axes take its first half and
    // the shapes its last two thirds, so the second construction is well
    // under way before the first finishes — the source's
    // rel_end_point=1/2 and rel_start_point=1/3.
    //
    // The easings are the source's smoothing_right=0 / smoothing_left=0,
    // which flatten the arriving and departing tangent respectively so
    // the two halves butt cleanly instead of each easing to a stop
    // mid-span.
    //
    // The two windows are applied DIFFERENTLY, and it shows. An Axes is a
    // composite animator: it assembles its choreography at full span and
    // rescales it afterwards, so its ease keeps full-span tangents —
    // restage(). A circle or a rectangle takes rel_start_point straight
    // into its own Animation, so its ease scales with the window — the
    // plain tuple. See Track.smoothingWindow in anim.ts; measured, the
    // axes fit a normalized smoothing of 0.5 where the shapes keep 0.25.
    this.play(
      together(
        restage(eased("easeIn", Create(this.axes)), 0, 1 / 2),
        [eased("easeOut", Create(this.circle), Create(this.rectangle)), 1 / 3, 1],
      ),
      2,
    )
    this.wait(3)
    this.play(FadeIn(this.cylinder), 1)
    this.wait(1)
    this.play(
      together(
        FadeOut(this.cylinder),
        restage(eased("easeIn", UnCreate(this.axes)), 0, 1 / 2),
        [eased("easeOut", UnCreate(this.circle), UnCreate(this.rectangle)), 1 / 3, 1],
      ),
      1,
    )
    this.wait(2)
  }
}

if (import.meta.main) render(S05Dream)
