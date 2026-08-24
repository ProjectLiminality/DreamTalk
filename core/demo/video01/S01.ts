/**
 * S01.ts — A DreamWeaving
 *
 * video-01 "Dialectical Thinking" (2021), Scene 01 — the thesis statement
 * of the whole video.
 *
 * A cylinder is born tilted and turns until its axis points away from us.
 * Two creatures draw themselves on either side of it — the blue one in the
 * plane, the red one hovering above it — and each in turn gets its own
 * WORLD: a grid wall standing perpendicular to the other's, on which its
 * own projection of the cylinder appears. Blue sees a circle. Red sees a
 * rectangle. Neither is wrong; neither is the cylinder.
 *
 * Source (refs/video-01-source-2022/dialectical_thinking.py:6-51):
 *
 *   cylinder  = Cylinder(h=0.1, p=0.4)
 *   circle    = Circle(radius=50, color=BLUE)
 *   rectangle = Rectangle(b=PI/2, height=100, width=200, color=RED)
 *   circler   = Eye(scale=0.3, x=300, h=PI, color=BLUE)
 *   rectangler= Eye(scale=0.3, y=300, b=PI/2, color=RED)
 *   plane_circler    = Axes(b=PI,   mode="xz", draw_grid=True, draw_ticks=False,
 *                           grid_color=BLUE, x/z_grid_line_distance=100,
 *                           grid_line_length=5000,
 *                           x_start=-500, x_end=2100, z_start=-2000, z_end=400)
 *   plane_rectangler = Axes(b=PI/2, … same, grid_color=RED)
 *
 *   play(Create(cylinder), 3)
 *   play(Transform(cylinder, relative=False, p=PI/2), 3)
 *   play(Create(circler, rectangler), 5)
 *   wait()
 *   play(Create(plane_circler), 3)
 *   play(FadeIn(circle), 2)
 *   play(UnCreate(plane_circler), 2)
 *   play(Create(plane_rectangler), 3)
 *   play(FadeIn(rectangle), 2)
 *   play(UnCreate(plane_rectangler), FadeOut(cylinder))
 *   play(FadeOut(circle, rectangle), UnCreate(circler, rectangler))
 *
 * 3+3+5+1+3+2+2+3+2+1+1 = 26s, and the reference agrees to the frame:
 * f0030 (video 6.0s) is the first lit frame and f0160 (32.0s) is the first
 * black one, so this scene's local t IS videoSec - 6 with no offset at all.
 * (S04 needed a negative lead; S01 does not — its first play starts on the
 * scene boundary because the source has no leading wait().)
 *
 * ## The axis dictionary
 *
 * pydeation is a TOP-VIEW system: its content lives in the XZ_c4d plane and
 * the camera looks down -Y_c4d. DreamTalk's scene plane is XY with +z toward
 * the viewer, so the fixed mapping is
 *
 *     (X, Y, Z)c4d -> (x, z, y)        (h, p, b)c4d -> (b, p, h)
 *
 * — exactly the dictionary CameraCal.ts established and verified against
 * f0080 to ~2px on four independent landmarks, with the rotation half
 * read back in three's 'ZXY' Euler order (test/hpb.test.ts). Every number
 * below is the source's own, put through it. Nothing is fitted.
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { Create, UnCreate, FadeIn, FadeOut } from "../../src/verbs"
import { PI } from "../../src/constants"
import { Axes, Circle, Cylinder, Eye, Rectangle } from "../../src/parts/index"
import { BLUE, RED, WHITE, STROKE_MAIN } from "./palette"

/**
 * The cylinder's two poses, converted from the source's C4D HPB.
 *
 * C4D composes HPB as M = R_H·R_P·R_B about its own (left-handed) axes.
 * Conjugated by the axis dictionary above and read back in three's 'ZXY'
 * order — which is what render/three-host.ts applies, and what
 * test/hpb.test.ts pins — the two reflections and the two handedness
 * flips cancel exactly, and the conversion collapses to the dictionary
 * itself with no residue:
 *
 *   source (h=0.1, p=0.4)   ->  ours (b=0.1, p=0.4,    h=0)
 *   source (h=0.1, p=PI/2)  ->  ours (b=0.1, p=PI/2,   h=0)
 *
 * That the exact conversion is the identity on the names is worth stating
 * because it is NOT true term by term — it is true only for the whole
 * composition, and only in ZXY. Under three's default XYZ order the same
 * numbers lean the cylinder visibly the wrong way.
 *
 * The reference decides it, four ways, on f0045 (t=3s, the tilt held at
 * the end of the Transform's first frame): the silhouette's topmost point
 * measures (626, 216), bottommost (662, 498), leftmost (529, 278),
 * rightmost (741, 440); the pose above predicts (628, 217), (661, 496),
 * (531, 278), (739, 439) — every one within 2px.
 *
 * C4D keyframes p alone and b holds at 0.1 throughout, so a single
 * animated param carries the whole turn, exactly as the source wrote it.
 */
/**
 * Zero, and measured rather than assumed: f0030 (video 6.0s) carries the
 * scene's first 22 lit pixels and f0160 (32.0s) its first black frame, so
 * localT IS videoSec - 6. Swept anyway (-0.15 / -0.06 / 0 / +0.06 / +0.15)
 * against the scored frames; 0 wins on both pass count and mean coverage.
 * Unlike S04 this scene has no leading wait() to absorb.
 */
const START_OFFSET = 0

const TILT_P = 0.4
const TILT_B = 0.1

export class S01Dream extends Dream {
  // Cylinder(h=0.1, p=0.4) — C4D's Ocylinder defaults r=50, h=200, which
  // the source never overrides because they are chosen to match the circle
  // (r=50) and the rectangle (100x200) exactly: the two projections ARE
  // the cylinder's two silhouettes.
  cylinder = new Cylinder({
    radius: 50,
    height: 200,
    p: TILT_P,
    b: TILT_B,
    stroke: STROKE_MAIN,
  })

  // Circle(radius=50, color=BLUE) — the circler's projection, at the
  // origin in the scene plane, seen obliquely as a standing ellipse
  // through the cylinder's mantle (f0115).
  circle = new Circle({ radius: 50, tint: BLUE, stroke: STROKE_MAIN })

  // Rectangle(b=PI/2, height=100, width=200, color=RED) — the
  // rectangler's projection. The legacy bank about Z_c4d is our h: a
  // quarter-turn about screen-up stands the rectangle in the zy wall, so
  // its 200 of width runs along the cylinder's axis and its 100 of height
  // spans the diameter. That is the wireframe hugging the mantle in f0150.
  rectangle = new Rectangle({
    width: 200,
    height: 100,
    tint: RED,
    h: PI / 2,
    stroke: STROKE_MAIN,
  })

  // Eye(scale=0.3, x=300, h=PI, color=BLUE) — "circler", in the scene
  // plane at screen right, gazing back at the origin (legacy h about the
  // top-view vertical is our b).
  circler = new Eye({ scale: 0.3, x: 300, b: PI, tint: BLUE, stroke: STROKE_MAIN })

  // Eye(scale=0.3, y=300, b=PI/2, color=RED) — "rectangler". Its source
  // y is OUT of pydeation's ground plane: the creature hovers above the
  // plane at our z=300 and looks down along -z. Under the 45-degree orbit
  // that lands it at screen left, mirroring the circler (f0080).
  rectangler = new Eye({ scale: 0.3, z: 300, h: PI / 2, tint: RED, stroke: STROKE_MAIN })

  // Axes(b=PI, mode="xz", …) — the circler's world. Its grid lives in
  // pydeation's ground plane (our xy) and its z extents are our y; the
  // legacy bank is our h, so a half-turn about screen-up swings the long
  // x arm to our -x and the lattice recedes LEFT (f0105).
  planeCircler = new Axes({
    mode: "xy",
    h: PI,
    drawGrid: true,
    drawTicks: false,
    gridTint: BLUE,
    tint: WHITE,
    gridSpacing: 100,
    gridLineLength: 5000,
    xStart: -500,
    xEnd: 2100,
    yStart: -2000,
    yEnd: 400,
    // Axes(thickness=5) is the pydeation default the source never overrides
    // (custom_objects.py:186), and Axes derives grid_thickness = thickness/2
    // (:221-222) — so this is STROKE_MAIN, and the grid falls out at
    // strokePx(2.5, 720) = 1.54px. Measured on f0100/f0105 (perpendicular
    // area/peak in linear light, near-vertical runs only): 1.60px median,
    // p25 1.44 — while STROKE_GRID*2 put it at 1.85px, a fifth too fat.
    stroke: STROKE_MAIN,
  })

  // Axes(b=PI/2, …) — the rectangler's world, a quarter-turn instead of a
  // half: the lattice stands up in the zy wall, perpendicular to the
  // circler's, and recedes to the upper right (f0140).
  planeRectangler = new Axes({
    mode: "xy",
    h: PI / 2,
    drawGrid: true,
    drawTicks: false,
    gridTint: RED,
    tint: WHITE,
    gridSpacing: 100,
    gridLineLength: 5000,
    xStart: -500,
    xEnd: 2100,
    yStart: -2000,
    yEnd: 400,
    stroke: STROKE_MAIN,
  })

  unfold() {
    this.observer.look("default")
    this.wait(START_OFFSET)
    this.play(Create(this.cylinder), 3)
    this.play(this.cylinder.p.to(PI / 2), 3)
    this.play(together(Create(this.circler), Create(this.rectangler)), 5)
    this.wait(1)
    this.play(Create(this.planeCircler), 3)
    this.play(FadeIn(this.circle), 2)
    this.play(UnCreate(this.planeCircler), 2)
    this.play(Create(this.planeRectangler), 3)
    this.play(FadeIn(this.rectangle), 2)
    this.play(together(UnCreate(this.planeRectangler), FadeOut(this.cylinder)), 1)
    this.play(
      together(
        FadeOut(this.circle),
        FadeOut(this.rectangle),
        UnCreate(this.circler),
        UnCreate(this.rectangler),
      ),
      1,
    )
  }
}

if (import.meta.main) render(S01Dream)

/**
 * ## What still misses, and why (honest ledger, 23/25 at step 5)
 *
 * Mean coverage ref 0.982 / ours 0.969. Twenty-three of twenty-five
 * frames pass; the two that do not are both inside the cylinder's 3s
 * Create, and both are the SAME unsolved question.
 *
 * ### What the stroke-width fix resolved (no scene change needed)
 *
 * Three of the four defects this scene carried were not scene bugs at
 * all — they were the ~1.76x stroke over-width that palette.ts carried
 * for ten scenes (S&T's 0.6 distance attenuation, object.py:207-209).
 * With honest widths and nothing else changed, this scene went 19/25 ->
 * 23/25:
 *
 *   - the grid domino phase at t=13/14 and t=20/21 now passes on all
 *     four frames. dominoWindows and rel_duration 0.3 are unchanged
 *     pydeation; the earlier failures were fat strokes, not bad timing.
 *   - the axis draw-front lag at every grid Create start is gone.
 *   - the "grid extent" 36-vs-30 vertical-line gap is gone, as the
 *     evaluator predicted: it was fat strokes merging adjacent far-horizon
 *     lines under threshold.
 *   - the Axes stroke is STROKE_MAIN unmodified, per the source's
 *     thickness=5 and its grid_thickness = thickness/2. No scene-local
 *     multiplier anywhere in this file.
 *
 * ### What remains: the cylinder's draw partition (t=1s, t=2s)
 *
 * The CONSTRUCTION is now right, and that is real progress: the
 * cylinder's contour is five strokes, not four, because the two
 * silhouette generators land ON the caps and cut one of them in two
 * (render/three-host.ts, render/silhouette.ts). Splitting it recovered
 * the shape at t=2s — before the split we drew the second cap as one
 * closed loop and the reference plainly does not.
 *
 * What is NOT solved is how S&T proportions ONE draw parameter across
 * those five strokes. Read off this scene's own new-ink deltas
 * (refs/video-01/frames5 f0030-f0045), the eased `creation` at each
 * stroke boundary is about
 *
 *     0.41, 0.52, 0.60, 0.72
 *
 * i.e. share vector ~[0.41, 0.11, 0.08, 0.12, 0.28]. Three principled
 * quantities were tried against those four numbers:
 *
 *     contour edge count (cap 64, generator 1)   L1 error 0.298
 *     screen arc length  (render/screen-arc.ts)  L1 error 0.313
 *     world arc length                           L1 error 0.314
 *
 * None is close, and they fail differently: edge count runs the
 * generators far too fast (1/130 of the span against the reference's
 * ~0.12), screen and world arc run the first cap too fast. Reproducing
 * the observed vector needs five free shares fitted to four measured
 * boundaries, which would buy these two frames while encoding nothing
 * that transfers to any other shot. Refused, on TASTE's terms: an
 * honest 23/25 beats a fitted 25/25.
 *
 * Two negative results worth keeping, both measured on this scene:
 *
 *   - Screen-arc PARTITIONING between the strokes is worse than edge
 *     count, not better, even though screen arc is demonstrably the
 *     right rule WITHIN a stroke (screen-arc.ts, 30x error reduction on
 *     this scene's own axes). Scene mean coverage_ours 0.985 -> 0.965.
 *     S&T appears to meter screen pixels along a stroke but hand whole
 *     contour edges to the stroke sequence.
 *   - An ink-per-frame argument seems to favour screen-arc metering
 *     within the cylinder's strokes, but new-ink PIXEL COUNT is not
 *     proportional to screen arc on a curving stroke — successive
 *     frames' ribbons overlap by an amount that varies with curvature —
 *     so that measurement cannot decide the question, and the scored
 *     frames put the two within 0.0004 of each other.
 */
