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
 * The gauntlet maps localT = videoSec - 98.5, and the SOURCE fixes the
 * whole span: wait, then 2 + 3 + 1 + 5 + 3 = 14s of drawing, every
 * run_time verbatim. Two frame-accurate facts in refs/video-01/frames5
 * then pin the offset from both ends, and they agree:
 *
 *   FIRST INK   f0493 (98.6s) is black; f0494 (98.8s) lights 22 pixels.
 *               So the Create begins in (98.6, 98.8] -> offset in (0.1, 0.3].
 *   LAST INK    f0563 (112.6s) still holds 2464 pixels; f0564 (112.8s) is
 *               black. So 98.5 + offset + 14 lands in (112.6, 112.8]
 *               -> offset in (0.1, 0.3] again.
 *
 * Two independent readings, fourteen seconds apart, giving the same
 * quarter-second window: the source's timings are exact and only the
 * phase was ever in question. 0.3 sits at the window's edge and is what
 * the interior beats prefer — the red section fades in over source t
 * 6->7, i.e. video 104.8->105.8, and f0520 (104.0s) is where red first
 * appears at low opacity.
 *
 * A LATER offset was tried and is ruled out, which is worth recording
 * because the cylinder's own draw appears to ask for one. Total lit
 * pixels over the 2s Create (f0494-f0504: 22 267 787 1437 2141 3389 4645
 * 6429 8401 9929 10524 against a settled 10524) fit best at offset 0.51.
 * But lit pixels are not proportional to drawn arc: the two mantle
 * generators are 37% of the contour's screen length and lay down ink at
 * a far higher pixel-per-arc rate than a cap arc seen near its
 * silhouette, and they are the LAST pieces the pen reaches — so the ink
 * curve is back-loaded relative to the pen. Scored, offset 0.5 broke
 * both ends at once (f0498 coverage 0.15, and the scene still lit at
 * f0568 where the reference is black). The frame-boundary readings
 * above are hard; the ink fit is soft. The hard ones win.
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

  // KNOWN GAP (2026-08-24, adjudicated): the cylinder's Create draws its
  // near cap's two arcs in an order the framework does not yet derive
  // from the pose, and S06 is the scene that pays for it. The five-stroke
  // structure is settled — two generators cut each cap, the NEAR cap's
  // arcs are strokes in their own right, the FAR cap stays one closed
  // loop, and "near" is camera-relative (render/three-host.ts) — but
  // WHICH near arc goes first was measured differently by two scenes:
  //
  //   Scene 01 (p=0.4 b=0.1, near-upright)  the AWAY-facing arc first
  //   Scene 06 (p=PI/2, lying in view)      the CAMERA-facing arc first
  //
  // Both readings were re-derived independently and both are correct for
  // their own pose, so the missing rule is pose-dependent — the leading
  // hypothesis is S&T's contour-edge chaining (CONNECTIIONZ=3,
  // JOIN_ANGLE_LIMIT=PI, CLOSECONNECTION=True, object.py:203-205) joining
  // edges BEFORE stroke_order sequences whole strokes, since stroke_order
  // maps to OUTLINEMAT_ANIMATE_STROKES and cannot decide which arc
  // becomes the first stroke. The ruling keeps Scene 01's version, so
  // this scene renders the wrong arc for the ~1.5s its near cap is drawn
  // alone. Scored at --step 1 over the Create, the cost is explicit:
  //
  //   Scene 01's rule  mean cov_ref 0.559  worst frame 0.017, chamfer 13.7px
  //   Scene 06's rule  mean cov_ref 0.960  cov_ref = 1.000 from f0496 on
  //
  // Under Scene 06's own rule every reference pixel is covered and the
  // only residual is a pen ~0.3s ahead; under Scene 01's the two arcs sit
  // on opposite sides of the same ellipse. At --step 5 this costs exactly
  // one frame (f0498), which is why the scene still scores 12/13. Do NOT
  // "fix" it here — it belongs in render/three-host.ts once the chaining
  // rule is derived, and a scene-local override would encode nothing.

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
