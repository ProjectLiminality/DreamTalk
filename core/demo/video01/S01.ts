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
import { BLUE, RED, WHITE, STROKE_GRID, STROKE_MAIN } from "./palette"

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
    stroke: STROKE_GRID * 2, // Axes halves it again for the grid lines
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
    stroke: STROKE_GRID * 2,
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
 * ## What still misses, and why (honest ledger, 19/25 at step 5)
 *
 * Mean coverage ref 0.973 / ours 0.971. Six frames sit under the bar, in
 * two families, and both are FRAMEWORK questions, not scene ones:
 *
 * **t=1s and t=2s — the cylinder's draw partition.** Direction and seam
 * are now exact (the caps start on the silhouette generators and sweep
 * the near half first — see capPolylineFrom, measured off f0031-f0038),
 * and the chained order is the reference's. What is not solved is how
 * Sketch & Toon divides ONE draw parameter across the contour: by world
 * arc length our cap ran ~3x too fast, and proportioning by contour EDGE
 * COUNT (64 per cap, 1 per generator — now the host's model) fixed most
 * of it, lifting mean coverage_ours from 0.957 to 0.971. The residue is
 * that the reference SPLITS the bottom cap at the far generator: f0039
 * shows the near half drawn, then the left generator, and only in f0042
 * the far half. Reproducing that needs six strokes with view-dependent
 * bounds, and fitting their five shares against these frames drops the
 * error 40x (SSE 0.14 -> 0.003) at the cost of five numbers that mean
 * nothing outside this shot. Not worth it; left as a framework question.
 *
 * **t=13/14 and t=20/21 — the grid domino's phase.** Both grids fail at
 * the same two moments of their own 3s Create, symmetrically, at
 * coverage_ref 0.885-0.950 — just under the bar, never far from it. The
 * domino algebra is already a verbatim port (animator.py:61-104, incl.
 * the approximate end-rescale), and pydeation's own rel_duration is 0.3.
 * Sweeping it does not fix the shape: 0.2 saves t=13/20 and loses
 * t=14/21, 0.38-0.45 does the exact reverse, and every value plateaus at
 * 21/25 — the two families trade against each other. A fitted duration
 * would buy one frame by substituting a number for the source's own, so
 * 0.3 stays.
 *
 * One unexplained observation, recorded for whoever takes this further:
 * at the very first frame of the first grid Create (video 12.0) the
 * reference already renders the y-axis ARROWHEAD at screen (640, 706),
 * i.e. a draw front some 70% of the way along a line whose own draw has
 * just begun. Neither world-arc-length nor screen-arc-length
 * parametrisation puts the front there at t=0. Whatever explains it
 * probably also explains why our axis lines run visibly behind the
 * reference's through the whole cascade — forcing the axes' window from
 * the source's (0, 0.8) down to 0.5 buys a frame here and costs coverage
 * on S04, so the source's value stays.
 */
