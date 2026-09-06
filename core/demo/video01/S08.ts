/**
 * S08.ts — A DreamWeaving
 *
 * video-01 "Dialectical Thinking" (2021), Scene 08 — the synthesis.
 *
 * Scene 01's stage, revisited with ONE creature. The blue eye draws itself
 * where the circler stood. Both grid walls come on at once now — blue and
 * red interpenetrating, no longer taking turns — and on the empty middle
 * the circle and the rectangle simply fade in together. The creature swings
 * a quarter turn to the other wall and RECOLORS, becoming the rectangler:
 * the same seeing, differently placed. Then the walls sweep away and the
 * cylinder itself fades in while the creature makes TWO complete orbits
 * around it, whitening in the first quarter of the turn, the two flat
 * projections dissolving beneath it. What is left is one white eye and one
 * cylinder — a seeing that has been everywhere, and a thing that no longer
 * needs a wall to be seen on.
 *
 * Source (refs/video-01-source-2022/dialectical_thinking.py:370-406):
 *
 *   cylinder  = Cylinder(p=PI/2)
 *   circle    = Circle(radius=50, color=BLUE)
 *   rectangle = Rectangle(b=PI/2, height=100, width=200, color=RED)
 *   creature  = Group(Eye(scale=0.3, x=300, h=PI, color=BLUE))
 *   plane_circler    = Axes(b=PI,   mode="xz", draw_grid=True, draw_ticks=False,
 *                           grid_color=BLUE, x/z_grid_line_distance=100,
 *                           grid_line_length=5000,
 *                           x_start=-500, x_end=2100, z_start=-2000, z_end=400)
 *   plane_rectangler = Axes(b=PI/2, … same, grid_color=RED)
 *
 *   wait()
 *   play(Create(creature))                                            # 1
 *   play(Create(planes), FadeIn(rectangle, circle, rel_start_point=1/2), 3)
 *   play(Transform(creature, b=-PI/2), 2)
 *   play(ChangeColor(creature, color=RED), 2)
 *   play(UnCreate(planes), 2)
 *   play(FadeIn(cylinder), Transform(creature, b=4*PI),
 *        FadeOut(circle, rectangle, rel_end_point=2/3),
 *        ChangeColor(creature, color=WHITE, rel_end_point=1/4), 7)
 *   play(FadeOut(cylinder), UnCreate(creature), 2)
 *
 * 1+1+3+2+2+2+7+2 = 20s.
 *
 * ## The axis dictionary
 *
 * pydeation is a TOP-VIEW system: content in the XZ_c4d plane, camera
 * looking down -Y_c4d. DreamTalk's scene plane is XY with +z toward the
 * viewer, so the fixed mapping (CameraCal.ts, verified on f0080) is
 *
 *     (X, Y, Z)c4d -> (x, z, y)        (h, p, b)c4d -> (b, p, h)
 *
 * The creature's ORBIT is the one thing this scene adds to that reading,
 * and it settles the rotation half independently: the source turns the
 * creature GROUP by C4D `b`, which the dictionary sends to our `h` — a
 * rotation about screen-up, sweeping the eye through the xz plane. Under
 * the "default" rig a circle of radius 300 in xz projects to an ellipse
 * spanning screen x 240…1040, y 245…563; a circle in xy would project to
 * x 413…978, y −41…719 and leave the frame top and bottom. The reference
 * eye tracks the FORMER to within a few pixels at every frame of the orbit
 * (measured centroids f0647–f0682), so `b`c4d IS our `h`. Nothing is fitted.
 *
 * ## What this scene forced into the framework: honest segments
 *
 * The draw and erase of the two grid walls used to be the one thing here
 * that would not reproduce, and it was read as a direction problem — the
 * grid seeming to draw downward and erase upward, which one polyline
 * order cannot do. It was not a direction problem. The ribbon converts
 * arc length to pixels LINEARLY inside a segment (`pxPerUnit = lenPx /
 * (distEnd - distStart)`, render/ribbon.ts), and a two-point Line that
 * recedes to a vanishing point breaks that identity by the whole depth
 * range. At f0608 the host put the pen at world x ~ +8 — the origin,
 * exactly where the reference's four arrowheads sit — while the shader
 * painted ink only 19.5% along the screen chord, so the near end looked
 * like a stub growing the wrong way.
 *
 * The fix is `resamplePolyline` (render/ribbon-math.ts), applied in
 * `setPoints` so the SUBDIVISION that screen-space measurement already
 * relied on now reaches the geometry too: each piece's foreshortening is
 * locally uniform, so the linear identity is locally true. One array now
 * serves both the instance buffers and every screen-space reading, which
 * is why they can no longer disagree. It took f0603/f0608/f0613 (the
 * draw) and f0643 (the erase) from FAIL to PASS with nothing added here.
 *
 * ## …and two more, both read off the pydeation source
 *
 * **The domino's ease is stated against the whole span.** The grid draw
 * still ran short of the reference — f0608 has 18 grid lines carrying
 * ink at y=150 where we put 14, each of ours drawn further. That is the
 * signature of an ease that is too brisk at the start, and the source
 * says why. `CObject.animate` builds every child `Animation` with
 * `rel_run_time = (0, 1)`, so `rel_duration` is 1 (animation.py:10-20).
 * `rescale_run_time` then squeezes `rel_run_time` into the Domino's
 * window and LEAVES `rel_duration` at 1 (animation.py:29-44). And
 * `play()` feeds `run_time * rel_duration` — still the whole 3s — into
 * `smoothing * run_time` for the keyframe tangents (scene.py:990,
 * 785-786). So a grid line owning 0.3 of the span carries a tangent
 * 0.83 of its own window, clamped at 1 by `smoothingFor`: many lines
 * visibly started and creeping, which is exactly the reference. Fixed
 * in `cascade`/`consume` (parts/index.ts) by using `restage` instead of
 * a bare window. It took f0603 FAIL→PASS and lifted the whole grid
 * draw and erase (f0608 0.914→0.973, f0643 0.913→1.000).
 *
 * **UnCreate did not recurse; Create did.** The scene ended with the
 * eye's iris still filled through its last three frames (f0689-f0691).
 * `UnCreate`'s fallback flattened the tree with `walk()` and stamped
 * `creation.to(0)` on every descendant, so a Group holding an Eye lost
 * UnCreateEye entirely. pydeation dispatches per class at every level —
 * `Animator.flatten_input` stops at a CustomObject and the class
 * animator takes over (animator.py:31-58, 742-772) — and `Create`
 * already recursed that way. Made symmetric in verbs.ts; the scene's
 * last 11 frames went to coverage 1.000/1.000.
 *
 * ## What is left, and why it is not fitted
 *
 * One frame of eighteen fails at step 5 (f0653, 0.893/0.902), and two of
 * eighty-nine at step 1 (f0653, f0644). Both are pure timing residue of
 * about 20ms, at the two instants where 20ms costs the most pixels: the
 * fastest point of the orbit, and the steepest point of the grid erase.
 *
 * The orbit is not mis-modelled. Unprojecting the reference eye centroid
 * through the rig gives its true world angle each frame, and fitting a
 * C4D auto-tangent ease to that curve over three free parameters lands
 * on start 129.35s, duration 7.03s, smoothing 0.24 — against this
 * scene's 129.4 / 7.00 / 0.25. The source's own numbers ARE the fit.
 *
 * And the 20ms cannot be taken out globally: the erase wants START_OFFSET
 * 0.02s later (f0644's both-coverages window is t = 8.32, ours is 8.30),
 * while the orbit's second revolution wants it 0.01s earlier. Moving it
 * to -2.09 was measured: 89% at step 1, against -2.11's 98%, with f0649
 * collapsing to 0.699. The two ends of a 20s scene disagree by less than
 * one fifth of a reference frame interval, which is what a 5fps sampling
 * of a 30fps original cannot resolve. -2.11 stays.
 *
 * The remaining coverage_ours gap is the encode floor, not fat strokes:
 * on the settled grid (f0630) our ink is 10% more pixels above the
 * threshold but MEASURES THINNER in linear light (median 1.84px against
 * the reference's 1.97px) — the YouTube encode's soft falloff crossing
 * the threshold over more pixels while carrying the same area. Widths
 * are honest; see palette.ts.
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { Create, UnCreate, FadeIn, FadeOut } from "../../src/verbs"
import { PI } from "../../src/constants"
import { Circle, Group, Rectangle } from "../../src/parts/index"
import { Axes } from "../../vocabulary/Axes/Axes"
import { Cylinder } from "../../vocabulary/Cylinder/Cylinder"
import { Eye } from "../../vocabulary/Eye/Eye"
import { BLUE, RED, WHITE, STROKE_MAIN } from "./palette"

/**
 * The measured scene-start offset.
 *
 * The gauntlet maps localT = videoSec - 120.5, but this scene's own t = 0
 * sits over two seconds earlier. Frames5 pins both ends of the 20s
 * timeline: f0596 (video 119.2s) is black and f0597 (119.4s) carries the
 * first 45 lit pixels — the creature beginning to draw — while f0691
 * (138.2s) carries 111 and f0692 (138.4s) is black again. The source's
 * leading wait() is 1s, so t = 0 lands at ≈118.3s and the last play ends
 * at ≈138.3s: exactly 20s, exactly the source's own run_times, with no
 * rescaling anywhere.
 *
 * 118.3 - 120.5 = -2.2, and the interior checks agree with that reading
 * of the boundaries: Create(creature) ends at 120.3 (the eye's lit count
 * plateaus over f0599–f0601 and the grids' first strokes appear at f0602),
 * the grids finish at 123.3 (the count plateaus f0615–f0637), the quarter
 * turn ends at 125.3 (the eye stops at screen x 314…385 in f0627 and
 * holds), and the orbit ends at 136.3 (the eye stops at x 300…392 in f0682
 * and holds through f0685).
 *
 * -2.11 rather than -2.2: swept against the scored frames in 0.02s steps,
 * -2.11 sits at the centre of the plateau where the whole 7s orbit passes
 * (nine consecutive frames, f0648–f0688, coverage 0.90…1.00), which is the
 * span with the most independent geometry to get right. The ~90ms is
 * within the frame quantisation of a 5fps reference read at both ends of a
 * 20s scene, and the alternative — rescaling a play() — would falsify the
 * source. Carried as a negative leading wait so every play() below reads
 * verbatim; the timeline holds pre-first-segment values, so nothing is lit
 * before the creature draws.
 */
const START_OFFSET = -2.11

export class S08Dream extends Dream {
  // Cylinder(p=PI/2) — C4D's Ocylinder defaults r=50, h=200, which the
  // source never overrides: they are chosen so the two projections ARE the
  // cylinder's two silhouettes. p=PI/2 pitches its +y axis into the screen,
  // giving the classic two-ellipses-plus-two-lines wireframe. Predicted
  // screen bbox under the rig x[499.6, 771.5] y[268.8, 462.1]; the settled
  // reference (f0673) measures x[498, 773] y[267, 464].
  cylinder = new Cylinder({ radius: 50, height: 200, p: PI / 2, stroke: STROKE_MAIN })

  // Circle(radius=50, color=BLUE) — the circler's projection, at the origin
  // in the scene plane, seen obliquely as a standing ellipse.
  circle = new Circle({ radius: 50, tint: BLUE, stroke: STROKE_MAIN })

  // Rectangle(b=PI/2, height=100, width=200, color=RED) — the rectangler's
  // projection. The legacy bank about Z_c4d is our h: a quarter-turn about
  // screen-up stands the rectangle in the zy wall, so its 200 of width runs
  // along the cylinder's axis and its 100 of height spans the diameter.
  rectangle = new Rectangle({
    width: 200,
    height: 100,
    tint: RED,
    h: PI / 2,
    stroke: STROKE_MAIN,
  })

  // Group(Eye(scale=0.3, x=300, h=PI, color=BLUE), group_name="creature").
  //
  // The Group is not decoration here — it is the mechanism. pydeation's
  // Transform moves the GROUP object by default (transform_group_object),
  // and the group's pivot sits at the world origin while the eye sits at
  // x=300 inside it, so `Transform(creature, b=…)` orbits the eye around
  // the scene rather than spinning it in place. A Group holding the Eye is
  // exactly that: turn the group, the eye swings.
  //
  // The eye's own source h=PI (about the top-view vertical) is our b: the
  // gaze mirrors to -x, so it looks back at the origin — and keeps looking
  // at it all the way round, because the whole frame turns with the group.
  eye = new Eye({ scale: 0.3, x: 300, b: PI, tint: BLUE, stroke: STROKE_MAIN })
  creature = new Group({ members: [this.eye] })

  // Axes(b=PI, mode="xz", …) — the circler's world. Its grid lives in
  // pydeation's ground plane (our xy) and its z extents are our y; the
  // legacy bank is our h, so a half-turn about screen-up swings the long x
  // arm to our -x and the lattice recedes LEFT.
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
    // (:221-222) — so this is STROKE_MAIN and the grid falls out at
    // strokePx(2.5, 720) = 1.54px, not the 1.85px STROKE_GRID*2 gives. Same
    // reading, same measurement, as S01's identical pair of Axes.
    stroke: STROKE_MAIN,
  })

  // Axes(b=PI/2, …) — the rectangler's world, a quarter-turn instead of a
  // half: the lattice stands up in the zy wall, perpendicular to the
  // circler's, receding to the upper right. In this scene the two are on
  // screen at once, and their crossing is the whole point.
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
    // The three shapes are added to the document at t=0 but are not lit
    // until their FadeIns; pydeation's objects arrive at opacity 0 and its
    // FadeIn is what raises them. Set BEFORE the leading wait so the
    // instant sits at the timeline's true start — a set() placed after a
    // negative wait would land AHEAD of the scored frames and leave the
    // defaults (opacity 1) showing through everything before it.
    this.wait(START_OFFSET)
    this.set(FadeOut(this.cylinder), FadeOut(this.circle), FadeOut(this.rectangle))
    this.wait(1)
    this.play(Create(this.creature), 1)
    this.play(
      together(
        Create(this.planeCircler),
        Create(this.planeRectangler),
        [together(FadeIn(this.rectangle), FadeIn(this.circle)), 1 / 2, 1],
      ),
      3,
    )
    this.play(this.creature.h.by(-PI / 2), 2)
    this.play(this.eye.tint.to(RED), 2)
    this.play(together(UnCreate(this.planeCircler), UnCreate(this.planeRectangler)), 2)
    this.play(
      together(
        FadeIn(this.cylinder),
        this.creature.h.by(4 * PI),
        [together(FadeOut(this.circle), FadeOut(this.rectangle)), 0, 2 / 3],
        [this.eye.tint.to(WHITE), 0, 1 / 4],
      ),
      7,
    )
    this.play(together(FadeOut(this.cylinder), UnCreate(this.creature)), 2)
  }
}

if (import.meta.main) render(S08Dream)
