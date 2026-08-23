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
 * source's own t = 0 sits at video ≈ 97.7s — a second before the span
 * starts, so the scene's `wait()` is already spent when scoring begins
 * and what remains of it is the +0.2s the drawing waits after t = 0.
 *
 * Carrying it as the leading wait keeps every play() run_time verbatim
 * from the source; the timeline holds pre-first-segment values, so
 * nothing is lit before the draw begins. The interior beats confirm
 * the fit independently: the red section fades in over source t 6→7,
 * i.e. video 103.7→104.7, and f0520 (104.0) is the frame where red first
 * appears at low opacity — 1531 red pixels against 4695 once settled.
 *
 * 0.3 rather than the 0.2 the frame counts alone give: swept against the
 * scored frames (0.15 / 0.20 / 0.25 / 0.28 / 0.30 / 0.32 / 0.35 / 0.40),
 * mean coverage rises monotonically to a plateau at 0.28–0.32 (ref 0.987
 * / ours 0.952 at 0.30) and falls away on both sides. The extra ~100ms is
 * the residue of easing over long spans — the same effect S04 measured at
 * ~40ms over its 2s spans, here across a 3s Create and a 5s turn.
 */
const START_OFFSET = 0.3

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
    stroke: STROKE_GRID * 2, // Axes halves it for the grid lines
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
