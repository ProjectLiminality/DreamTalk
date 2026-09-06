/**
 * S03.ts — A DreamWeaving
 *
 * video-01 "Dialectical Thinking" (2021), Scene 03 — the two become one.
 *
 * Thesis and antithesis flicker at each other, alternating like a
 * gestalt figure that will not hold both readings at once. Then they
 * both stay, walk into each other, and go purple where they overlap.
 * They separate, keep their colours — and a second pair arrives that
 * has already given up the distinction: a squared circle and a rounded
 * rectangle, meeting in the one shape that is neither. Finally the
 * synthesis is shown as what it always was: a cylinder, and a plane
 * sweeping through it whose section is the circle, the rectangle, and
 * every ellipse in between.
 *
 * Source (refs/video-01-source-2022/dialectical_thinking.py:189-256):
 *
 *   camera_perspective "front", camera_position (0,0), camera_zoom 3/2
 *
 *   circle            = Circle(color=BLUE, radius=50, x=-150)
 *   cornered_circle   = Rectangle(color=BLUE, width=100, height=100, rounding=1, x=-200)
 *   rectangle         = Rectangle(color=RED, width=100, height=200, x=150)
 *   rounded_rectangle = Rectangle(color=RED, width=100, height=200, x=200)
 *   intersection_plane    = Plane(b=PI/2, b_frozen=PI/4, scale=2, x=1)
 *   intersection_cylinder = Cylinder(x=150, intersects_with=[intersection_plane])
 *
 *   wait(2); flipflop(pause=1/3, n=2)
 *   play(FadeIn(circle, rectangle))
 *   play(Transform(circle, rectangle, relative=False),
 *        ChangeColor(circle, rectangle, color=PURPLE), run_time=2)
 *   wait(2)
 *   play(Transform(circle, x=-200), Transform(rectangle, x=200),
 *        ChangeColor(circle, color=BLUE), ChangeColor(rectangle, color=RED), run_time=3)
 *   wait(2)
 *   play(FadeIn(rounded_rectangle, cornered_circle),
 *        Transform(rounded_rectangle, cornered_circle, relative=False),
 *        ChangeParams(rounded_rectangle, cornered_circle, height=150, width=100, rounding=1/2),
 *        ChangeColor(rounded_rectangle, cornered_circle, color=PURPLE), run_time=2)
 *   play(FadeOut(circle, rectangle, rel_end_point=1/2),
 *        Transform(rounded_rectangle, cornered_circle, x=-150),
 *        Show(intersection_plane),
 *        FadeIn(intersection_cylinder, rel_start_point=1/2), run_time=2)
 *   play(Transform(intersection_plane, h=2*PI, x=200), run_time=3)
 *   play(FadeOut(intersection_cylinder, rounded_rectangle, cornered_circle))
 *
 * pydeation works in the XZ plane under a top-view camera; DreamTalk's
 * scene plane is XY, so every source `z` becomes our `y` (the mapping
 * CameraCal.ts establishes and S04 follows).
 *
 * Two readings of the source that the frames confirm and the vocabulary
 * report does not spell out:
 *
 *  - `Transform(a, b, relative=False)` with NO further parameters is not
 *    "move a to b": pydeation's Animator takes every cobject as a target
 *    and `relative=False` means the (defaulted) x/y/z/h/p/b are ABSOLUTE
 *    (object.py:340-394). So both shapes go to the ORIGIN. That is the
 *    merge at 63.7–65.7s and, later, the two rounded shapes meeting at
 *    72.8–74.7s.
 *  - `Transform(circle, x=-200)` is relative, and by then the circle is
 *    at the origin — so it lands at -200, not at -350.
 */

import { Dream, render, together } from "../../src/index"
import { PI } from "../../src/constants"
import { Circle, Rectangle } from "../../src/parts/index"
import { Cylinder } from "../../vocabulary/Cylinder/Cylinder"
import { SectionCurve, SectionPlane } from "../../src/parts/curves"
import { FadeIn, FadeOut } from "../../src/verbs"
import { BLUE, PURPLE, RED, WHITE, STROKE_MAIN } from "./palette"

/**
 * The scene's own t = 0 against the gauntlet's localT = videoSec - 58.
 *
 * Measured, not guessed. Two of the scene's motions are long, smooth and
 * pixel-legible, so every frame of them is an independent reading of when
 * its clip began: invert the C4D ease on the circle's screen x and read
 * the implied start time off each frame.
 *
 *   the merge      (circle -150 -> 0 over 2s): f0319-f0327 all give 63.678
 *   the separation (circle 0 -> -200 over 3s): f0340-f0352 all give 67.683
 *   the rounding   (pair +/-200 -> 0 over 2s): f0369-f0370     give 72.698
 *
 * Nine, thirteen and two readings, each set spread to +/-0.006s. The
 * merge begins at scene t = START_OFFSET + 2.6 (the flip-flop) + 1 (the
 * FadeIn), so the offset is that first reading minus 58 minus 3.6 —
 * carried here in exactly that form so the number stays a measurement.
 *
 * It is 63.683 rather than 63.678 because the three readings are NOT
 * perfectly 2/2/3 apart: the reference drifts +0.005s by the separation
 * and +0.015s by the rounding, half a frame of the 30fps render it came
 * out of. Swept against the whole scene at step 1, 63.683 is the single
 * offset that best splits that drift (97/101 frames; 63.678 gives 88,
 * 63.693 gives 91). Per-clip offsets would buy the last four frames and
 * would be fitting the encode, not the source, so they stay out.
 */
const START_OFFSET = 63.683 - 58 - 3.6

/**
 * camera_zoom = 3/2. pydeation realizes zoom purely as camera distance
 * (camera.py: pos_y = 1000 / zoom), never as focal length — so the rig
 * is the same 36mm lens observer.look("front") carries, dollied in to
 * 666.67 units. That predicts 1.92 px per world unit at the scene plane,
 * which is what the reference measures: the rectangle 100 units wide
 * spans f0301 x[830,1027] (192px + stroke), the circle of radius 50 at
 * x=-150 spans f0303 x[254,451], and the final rounded pair at x=-150
 * measures 197 x 292px for 100 x 150 units.
 */
const FRONT_DISTANCE = 1000 / (3 / 2)

/** The 2021 flip-flop's beat: a 0.1s crossfade, then a third of a second held. */
const FLIP = 0.1
const PAUSE = 1 / 3

export class S03Dream extends Dream {
  // Circle(color=BLUE, radius=50, x=-150) — the thesis.
  circle = new Circle({ radius: 50, tint: BLUE, x: -150, opacity: 0, stroke: STROKE_MAIN })

  // Rectangle(color=RED, width=100, height=200, x=150) — the antithesis.
  rectangle = new Rectangle({
    width: 100,
    height: 200,
    tint: RED,
    x: 150,
    opacity: 0,
    stroke: STROKE_MAIN,
  })

  // Rectangle(color=BLUE, width=100, height=100, rounding=1, x=-200) —
  // the "cornered circle": a square rounded all the way, which is
  // literally a circle of radius 50. It will lose its roundness down to
  // 1/2 as the rectangle beside it gains it.
  corneredCircle = new Rectangle({
    width: 100,
    height: 100,
    rounding: 1,
    tint: BLUE,
    x: -200,
    opacity: 0,
    stroke: STROKE_MAIN,
  })

  // Rectangle(color=RED, width=100, height=200, x=200) — the rectangle
  // that will round. Both meet at width 100, height 150, rounding 1/2.
  roundedRectangle = new Rectangle({
    width: 100,
    height: 200,
    tint: RED,
    x: 200,
    opacity: 0,
    stroke: STROKE_MAIN,
  })

  // Plane(b=PI/2, b_frozen=PI/4, scale=2, x=1) — the invisible cutter.
  // Nothing of it renders; it exists to be swept through the cylinder.
  plane = new SectionPlane({ b: PI / 2, frozenB: PI / 4, x: 1 })

  // Cylinder(x=150, intersects_with=[intersection_plane]) — C4D's own
  // defaults, r=50 h=200 on the +Z axis (our +y), which is exactly the
  // circle's radius and the rectangle's proportions. The synthesis.
  cylinder = new Cylinder({
    radius: 50,
    height: 200,
    tint: WHITE,
    x: 150,
    opacity: 0,
    stroke: STROKE_MAIN,
  })

  // The cut itself — a sibling of the cylinder at the same place, bound
  // to the same size, and told to take its plane from the plane object.
  // In the 2021 scene the section is a mode of the cylinder object, so
  // it fades on the same beats; here that is said by playing the same
  // verbs on both rather than by sharing an opacity param (a bound
  // param cannot be animated — the whole owns it, and the cylinder is
  // not the section's whole).
  section = new SectionCurve({
    radius: this.cylinder.radius,
    height: this.cylinder.height,
    tint: WHITE,
    x: 150,
    opacity: 0,
    stroke: STROKE_MAIN,
  }).cutBy(this.plane)

  /**
   * The flip-flop's two behaviours — the swap in each direction. Each is
   * a 0.1s crossfade, short enough that the reference catches it
   * mid-way on f0305, f0307 and f0314 and never anywhere else.
   */
  toCircle() {
    return together(FadeOut(this.rectangle), FadeIn(this.circle))
  }

  toRectangle() {
    return together(FadeIn(this.rectangle), FadeOut(this.circle))
  }

  /**
   * The rounding morph — the source's one `ChangeParams` over both
   * shapes at once: `height=150, width=100, rounding=1/2`. Width is
   * already 100 on both and is stated anyway, exactly as the source
   * states it; the shape that changes is the roundness, from a square
   * rounded to a circle and a rectangle not rounded at all, meeting at
   * the one profile that is neither.
   */
  becomeRounded(shape: Rectangle) {
    return together(shape.height.to(150), shape.width.to(100), shape.rounding.to(1 / 2))
  }

  unfold() {
    this.observer.look("front")
    this.set(...this.observer.dolly(FRONT_DISTANCE))
    this.wait(START_OFFSET)
    this.play(FadeIn(this.rectangle), FLIP)
    this.wait(PAUSE)
    this.play(this.toCircle(), FLIP)
    this.wait(PAUSE)
    this.play(this.toRectangle(), FLIP)
    this.wait(PAUSE)
    this.play(this.toCircle(), FLIP)
    this.wait(PAUSE)
    this.play(this.toRectangle(), FLIP)
    this.wait(PAUSE)
    this.play(FadeOut(this.rectangle), FLIP)
    this.wait(PAUSE)
    this.play(together(FadeIn(this.circle), FadeIn(this.rectangle)), 1)
    this.play(
      together(
        this.circle.x.to(0),
        this.rectangle.x.to(0),
        this.circle.tint.to(PURPLE),
        this.rectangle.tint.to(PURPLE),
      ),
      2,
    )
    this.wait(2)
    this.play(
      together(
        this.circle.x.by(-200),
        this.rectangle.x.by(200),
        this.circle.tint.to(BLUE),
        this.rectangle.tint.to(RED),
      ),
      3,
    )
    this.wait(2)
    this.play(
      together(
        FadeIn(this.roundedRectangle),
        FadeIn(this.corneredCircle),
        this.roundedRectangle.x.to(0),
        this.corneredCircle.x.to(0),
        this.becomeRounded(this.roundedRectangle),
        this.becomeRounded(this.corneredCircle),
        this.roundedRectangle.tint.to(PURPLE),
        this.corneredCircle.tint.to(PURPLE),
      ),
      2,
    )
    this.play(
      together(
        [together(FadeOut(this.circle), FadeOut(this.rectangle)), 0, 1 / 2],
        this.roundedRectangle.x.by(-150),
        this.corneredCircle.x.by(-150),
        [together(FadeIn(this.cylinder), FadeIn(this.section)), 1 / 2, 1],
      ),
      2,
    )
    this.play(together(this.plane.h.by(2 * PI), this.plane.x.by(200)), 3)
    this.play(
      together(
        FadeOut(this.cylinder),
        FadeOut(this.section),
        FadeOut(this.roundedRectangle),
        FadeOut(this.corneredCircle),
      ),
      1,
    )
  }
}

if (import.meta.main) render(S03Dream)
