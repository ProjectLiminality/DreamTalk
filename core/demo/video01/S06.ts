/**
 * S06.ts — A DreamWeaving
 *
 * video-01 "Dialectical Thinking" (2021), Scene 06 — the turning.
 *
 * A white cylinder lies on an endless blue floor. A red curve appears on
 * it: the cut a fixed, invisible plane makes through its body, a
 * rectangle running its whole length. Then the cylinder TURNS — one full
 * revolution — while its own outline fades away, and all that is left is
 * the cut, morphing rectangle → ellipse → circle → ellipse → rectangle
 * and back again. The section never changes; only our angle on it does.
 * That is the whole argument of the video in one object.
 *
 * Source (refs/video-01-source-2022/dialectical_thinking.py:322-353):
 *
 *   intersection_plane    = Plane(z=1, p=PI/2, show=True)
 *   intersection_cylinder = Cylinder(color=RED, p=PI/2,
 *                                    intersects_with=[intersection_plane],
 *                                    contour=False, scale=2)
 *   cylinder = Cylinder(p=PI/2, scale=2)
 *   grid     = Axes(mode="xz", x=-5000, y=5000, x_start=0, x_end=4000,
 *                   z_start=0, z_end=4000, grid_line_length=100000,
 *                   scale=5/2, p=-PI/2, draw_ticks=False, draw_grid=True,
 *                   grid_color=BLUE)
 *   wait()
 *   play(Create(cylinder), run_time=2)
 *   play(Create(grid), run_time=3)
 *   play(FadeIn(intersection_cylinder))
 *   play(Transform(cylinder, intersection_cylinder, p=2*PI),
 *        FadeOut(cylinder), run_time=5)
 *   play(FadeOut(intersection_cylinder), UnCreate(grid), run_time=3)
 *
 * The fixed axis dictionary (X, Y, Z)c4d → (x, z, y) carries every number
 * over: the grid's legacy y=5000 is our z=5000, its legacy z extents are
 * our y extents, and legacy P stays our p (both name the rotation about X).
 * pydeation's "xz" ground plane is our "xy" — the Axes holon maps that,
 * exactly as CameraCal's Scene-01 walls do.
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { Create, UnCreate, FadeIn, FadeOut } from "../../src/verbs"
import { Axes, Cylinder } from "../../src/parts/index"
import { SectionCurve } from "../../src/parts/curves"
import { PI, TAU } from "../../src/constants"
import { BLUE, RED, STROKE_GRID, STROKE_MAIN } from "./palette"

/**
 * The measured scene-start offset.
 *
 * The gauntlet maps localT = videoSec - 98.5. The first lit pixel of the
 * cylinder arrives in frames5 f0494 (video 98.8s; f0493 is black) and the
 * last in f0563 (112.6s; f0564 is black) — 14.0s of drawing, exactly the
 * source's 2 + 3 + 1 + 5 + 3 with the leading `wait()` cut off. So the
 * source's own t = 0 sits at video ~98s — half a second before the span
 * starts, so the scene's `wait()` is already spent when scoring begins
 * and what remains of it is the wait the drawing takes after t = 0.
 *
 * Carrying it as the leading wait keeps every play() run_time verbatim
 * from the source; the timeline holds pre-first-segment values, so
 * nothing is lit before the draw begins.
 *
 * THE NUMBER, measured. Total lit pixels in a frame is the cleanest
 * possible reading of "how much ink is down" — it needs no decomposition
 * into strokes and no assumption about which stroke is which. Over the
 * cylinder's 2s Create, alone on black (frames5 f0494-f0504), it runs
 *
 *   22  267  787  1437  2141  3389  4645  6429  8401  9929  10524
 *
 * against a settled 10524. Fitting the ONE free parameter — this offset —
 * with the span held at the source's own 2s and the ease at pydeation's
 * own smoothing 0.25, the sum-squared error is
 *
 *   offset 0.30 -> 0.137     offset 0.40 -> 0.049
 *   offset 0.50 -> 0.018     (minimum at 0.506)
 *
 * so 0.5 it is, and the old 0.3 was absorbing the draw-order error that
 * render/three-host.ts's syncCylinder has since fixed: with the five
 * contour strokes in the wrong sequence, an early offset was the only way
 * to get the right amount of ink onto the right frames.
 *
 * The residual at 0.5 is the measure's own bias, not a missing parameter:
 * lit pixels saturate where the pen retraces near a cap/generator
 * junction, so late frames read slightly fuller than their arc length.
 * Sweeping the smoothing (0.0 through 0.35) moves the fitted offset by
 * less than 0.03 while never reaching zero error — a sign the residual is
 * in the ruler, not in the easing, so the source's 0.25 stands.
 */
const START_OFFSET = 0.5

/** The 2021 rig's own distance — Scene 06's CONFIG is camera_zoom 1. */
const DEFAULT_DISTANCE = 1000

/** Cylinder(scale=2): r=50 h=200 at twice size, the whole scene's yardstick. */
const CYLINDER_SCALE = 2

export class S06Dream extends Dream {
  // Axes(mode="xz", x=-5000, y=5000, x_start=0, x_end=4000, z_start=0,
  // z_end=4000, grid_line_length=100000, scale=5/2, p=-PI/2,
  // draw_grid=True, grid_color=BLUE) — the endless floor.
  //
  // p=-PI/2 lays the lattice down out of our XY plane into the ground
  // plane; at scale 5/2 its 30-unit default spacing reads 75 world units
  // and its 0→4000 extents reach 10000 across, so the horizon is the
  // camera's, not the grid's. The white axis arms are in there too (the
  // source leaves arrow_end at its default), but the grid's own origin
  // sits 5000 units out on both arms — off frame, and the arms run away
  // from the camera, which is why the reference shows blue lattice and
  // no white cross.
  grid = new Axes({
    mode: "xy",
    x: -5000,
    z: 5000,
    p: -PI / 2,
    scale: 5 / 2,
    xStart: 0,
    xEnd: 4000,
    yStart: 0,
    yEnd: 4000,
    gridSpacing: 30,
    gridLineLength: 100000,
    drawGrid: true,
    drawTicks: false,
    gridTint: BLUE,
    // The source's own thickness, unmodified. Axes takes ONE thickness —
    // pydeation's default PRIM_THICKNESS = 5 (constants.py:51), which the
    // source's Axes(...) call leaves alone — and derives the grid lines
    // from it as `grid_thickness = thickness / 2`
    // (refs/pydeation-legacy/object/custom_objects.py:221-222), i.e. 2.5
    // units, so 2.5 * 720/700 * 0.6 = 1.54px of ink. The holon halves it
    // the same way, so handing it STROKE_MAIN reproduces the source line
    // for line. (It previously read STROKE_GRID * 2, which asks for 3
    // units of grid: STROKE_GRID is the palette's name for a thickness
    // video-01 uses elsewhere, not for what an Axes derives.)
    stroke: STROKE_MAIN,
  })

  // Cylinder(p=PI/2, scale=2) — the body. p=PI/2 pitches its +y axis to
  // +z: it lies along the depth axis, which the 45-degree default view
  // reads as the classic two-ellipses-and-two-generators wireframe
  // running from screen lower-left to upper-right (f0504).
  cylinder = new Cylinder({
    p: PI / 2,
    scale: CYLINDER_SCALE,
    stroke: STROKE_MAIN,
  })

  // Cylinder(color=RED, p=PI/2, intersects_with=[intersection_plane],
  // contour=False, scale=2) — contour=False means the body is NOT drawn;
  // only the section curve is. In DreamTalk that object is not a Cylinder
  // with its outline suppressed but the curve itself: a SectionCurve at
  // the cylinder's pose and dimensions.
  //
  // Plane(z=1, p=PI/2): C4D's plane primitive lies in XZ with normal +Y,
  // i.e. our +z, and p=PI/2 turns that normal to our -y — a HORIZONTAL
  // cutting plane one unit above the origin, standing still while the
  // cylinder turns through it. planeFrame "parent" states exactly that:
  // tilt PI, spin 0 is the parent-space normal (0, -1, 0), and the offset
  // is the plane's signed distance from the cylinder's centre in the
  // holon's own units — one world unit at scale 2 is half a local one.
  //
  // Everything else follows from the pose: the section is a rectangle
  // while the axis lies in the plane, a circle when the axis stands
  // normal to it, an ellipse in between. One animated parameter, five
  // shapes.
  section = new SectionCurve({
    p: PI / 2,
    scale: CYLINDER_SCALE,
    radius: 50,
    height: 200,
    planeFrame: "parent",
    tilt: PI,
    spin: 0,
    offset: -1 / CYLINDER_SCALE,
    tint: RED,
    stroke: STROKE_MAIN,
  })

  unfold() {
    this.observer.look("default")
    this.set(...this.observer.dolly(DEFAULT_DISTANCE))
    this.wait(START_OFFSET)
    this.play(Create(this.cylinder), 2)
    this.play(Create(this.grid), 3)
    this.play(FadeIn(this.section), 1)
    this.play(
      together(this.cylinder.p.by(TAU), this.section.p.by(TAU), FadeOut(this.cylinder)),
      5,
    )
    this.play(together(FadeOut(this.section), UnCreate(this.grid)), 3)
    this.wait(1)
  }
}

if (import.meta.main) render(S06Dream)
