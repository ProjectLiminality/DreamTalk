/**
 * Scene03.ts — A DreamWeaving
 *
 * "The Origins of Project Liminality" (2024), Scene 03 — the global
 * system.
 *
 * Four gears draw themselves inside a circle, each carrying the icon of
 * what it governs: a factory, a banknote, a stethoscope, the scales of
 * justice. They mesh. Then, over eight slow seconds, the whole thing
 * turns from white to blue — the one gesture in the scene, and the
 * reason it exists: the system stops being a diagram and becomes a
 * thing with a temperature. It holds, un-draws over eleven seconds
 * leaving only the circle that contained it, and the circle fades.
 *
 * Source (refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py:233-254):
 *
 *   class Scene03(TwoDScene):
 *       global_system = System(scale=3/4, y=1)
 *       circle = Circle()
 *       self.audio(…, offset=96)
 *       self.add(global_system, circle)
 *       self.play(Create(global_system, circle), run_time=3)
 *       self.wait()
 *       self.play(Fill(global_system, transparency=1),
 *                 ChangeColor(global_system, circle, color=BLUE),
 *                 run_time=8)
 *       self.wait(2)
 *       self.play(UnDraw(global_system), run_time=11)
 *       self.wait(3)
 *       self.play(FadeOut(circle))
 *
 * Twenty-two lines, and the composite it stages lives in
 * core/vocabulary/System/System.ts where the four gears' layout is
 * derived from the source's own twelve numbers.
 *
 *
 * THE GEARS ARE SOLID, AND `Create` IS NOT A DRAW
 *
 * The single most important fact about this scene is invisible in its
 * own source line. `self.play(Create(global_system, circle))` looks like
 * a plain draw-on; it is not. pydeation's `Create` is a DISPATCHER that
 * switches on the object's class name, and `System` has its own case:
 *
 *   elif cobject.__class__.__name__ == "System":
 *       system_creation = DrawThenFillCompletely(cobject, **params)
 *          — refs/pydeation-legacy/animation/animator.py:948-950 and
 *            970-972 (the group branch and the bare branch, identically)
 *
 * — the same dispatch table that sends an Eye to `CreateEye` and a Logo
 * to `CreateLogo`. So the gears DRAW and then FLOOD SOLID, over the
 * (0, 0.6) / (0.5, 1) windows verbs.ts already carries. (The line below
 * it does the same for any bare `SVG` subclass, which is why the four
 * icons flood too.) The `circle` in the same call is a plain primitive
 * and falls through to `Draw`, so it never fills — which is why the
 * large regions inside it stay black all scene.
 *
 * The reference is unambiguous once you cut ACROSS a tooth instead of
 * along one. A radial cut down through the lower-right gear's teeth
 * (x=715, y 500-540), one frame per column, `#` = luma>120:
 *
 *   f_00486  97.2  ....###+................................  the root line only
 *   f_00488  97.6  ....###+......................+###......  both boundaries — hollow
 *   f_00490  98.0  ....###++++++++++++++++++++++++###......  the gap FILLING
 *   f_00492  98.4  ....##############################......  solid
 *
 * A hollow outline for the first two thirds of the span and a solid band
 * by the end: `DrawThenFillCompletely`, exactly on its own windows. An
 * ordinary `Create` cannot produce the f_00490 row.
 *
 *
 * AND THE `Fill(transparency=1)` IS AN UNFILL
 *
 * Which settles the other half. `Fill(global_system, transparency=1)`
 * reads like a fill and is the opposite: pydeation's `Fill` drives the
 * filler material's TRANSPARENCY, and 1 is fully transparent, so the
 * call drains the solid the `Create` just laid down. Core's `Fill`
 * inverts to opacity (verbs.ts), so `transparency: 1` is `fillOpacity
 * → 0` — the same drain, arrived at by the same arithmetic, and
 * `UnFill` by another name.
 *
 * The same radial cut across the eight-second play, `+` = luma>32:
 *
 *   f_00528 105.6  ....+############################+......  still solid
 *   f_00530 106.0  ....+###++++++++++++++++++++++###+......  draining
 *   f_00538 107.6  ....+#+++++++++++++++++++++++++##+......  nearly out
 *   f_00540 108.0  ....+#++......................++#+......  two strokes again
 *
 * So the eight seconds do two things at once — the gears empty back to
 * line drawings while everything turns blue — and the scene's shape is
 * fill, then unfill, which is why it can be written with a verb called
 * `Fill` in both places. Reproducing it required reading the reference
 * rather than the line.
 *
 *
 * FRAMING (TwoDScene — orthographic, zoom 1)
 *
 * A `TwoDScene` is an orthographic camera at zoom 1
 * (refs/pydeation-legacy/scene/scene.py:1035-1052), which frames 1023
 * world units of width (dream.ts ZOOM_REFERENCE_WIDTH) — 1.251222 px
 * per world unit at 1280 wide, the same projection Scene00 uses and
 * verifies.
 *
 * `Circle()` is C4D's default radius 200, which the source never
 * overrides. `System(scale=3/4, y=1)`: the 3/4 reaches every group, and
 * pydeation's out-of-plane y is our z, so `y=1` is a one-unit shift in
 * DEPTH — invisible under an orthographic camera, and not a vertical
 * offset. It is carried as `z` so the source's line stays legible; it
 * moves nothing.
 *
 * Predicted from the derivation alone, against
 * refs/pitch/origins/frames5/f_00505 (t=101, the finished white
 * drawing) — every number below is System's twelve source numbers times
 * the six measured asset heights times 1.251222, with nothing fitted:
 *
 *   enclosing circle   r 250.2 px            measured 253.0 / 252.5
 *                                            (to the OUTER ink edge of a
 *                                            4.57px stroke: +2.3px, and
 *                                            the same signature Scene02's
 *                                            header records)
 *
 *   gear cluster bbox  x[471.1, 808.9]       measured x[471, 809]
 *                      y[186.8, 533.3]       measured y[188, 533]
 *
 *   icon (w × h, centre)          predicted            measured
 *   factory     economy    93.8 × 62.3 @ (564.9, 280.2)   94 × 62 @ (565.0, 280.0)
 *   justice     law        93.8 × 82.0 @ (715.1, 439.8)   94 × 83 @ (715.0, 439.5)
 *   cash        finance    56.3 × 23.1 @ (705.7, 299.0)   57 × 24 @ (705.5, 299.0)
 *   stethoscope healthcare 56.3 × 56.4 @ (574.3, 421.0)   56 × 57 @ (574.0, 420.5)
 *
 * Sixteen predicted numbers, sixteen within a pixel. That agreement is
 * what makes the derivation — and not any measurement — the source of
 * truth for this scene, and it is also the proof that the six recovered
 * SVGs are the drawings that were actually rendered.
 *
 *
 * THE TIMELINE, MEASURED
 *
 * offset=96 is the audio cue; the video's black gap runs 95.0-96.6s
 * (report §0). Read off frames5 at 1-frame resolution — lit-pixel count
 * at the scorer's own luma-32 threshold, and the colour of the circle's
 * top rim, which is ink in every frame of the scene and never moves:
 *
 *   f_00482  96.4   229 px — black, the cut
 *   f_00483  96.6   the first ink of the draw
 *   f_00486  97.2   8910 px — gear rims, icons and circle ALL partial
 *   f_00490  98.0   44382
 *   f_00495  99.0   49842, and flat from here
 *   f_00505 101.0   50320 white, rim (244, 252, 252) — the hold
 *   f_00508 101.6   the recolour's first measurable step
 *   f_00520 104.0   rim (176, 225, 224) — halfway
 *   f_00542 108.4   rim (52.8, 172.2, 184.3), and flat from here
 *   f_00560 112.0   the report's key frame: blue, held
 *   f_00562 112.4   ink starts falling — the un-draw
 *   f_00608 121.6   13070 px and flat: the System is gone, circle alone
 *   f_00624 124.8   the circle fades out
 *
 * Two things in that table are worth more than the offset they help
 * fit. First, the recolour's measurable movement spans 101.6-108.4 —
 * 6.8s inside a `run_time=8`, which is what a smoothed span looks like
 * when both its ends move below the encode's resolution; it is NOT
 * evidence for a shorter play. Second, f_00608-f_00622 sit at a dead-flat
 * 13070 px, and 13070 is the circle by itself: the un-draw takes the
 * System and leaves the circle standing, exactly as `UnDraw(global_system)`
 * — which never mentions the circle — says it should. A scene that
 * un-drew the group would go to zero there.
 *
 * The 11s un-draw finishes at ~121.6 and the source then waits 3 before
 * fading, which would put the fade at 124.6; the reference's fade begins
 * at 124.8. That is the source's own arithmetic landing within a frame,
 * with nothing fitted but START_OFFSET.
 *
 * The un-draw is the cleanest check available, because it is long and
 * monotone: the reference's System ink leaves from t=110.6 to t=121.5,
 * which is ELEVEN SECONDS against `run_time=11`, and 110.6 − 96 = 14.6
 * is 3 + 1 + 8 + 2 + START_OFFSET. The scene's timing is the source's,
 * unadjusted.
 *
 *
 * WHAT STILL DIFFERS — THE FILL IGNORES THE HOLE
 *
 * Scored at 1s over the whole scene: **8/29 PASS, mean coverage
 * ref 0.944 / ours 0.819** (docs/reports/origins/o5-scene03-summary.json).
 * The failures are not scattered; they fall in two bands, and the larger
 * one is a single rendering limitation with a precise shape.
 *
 * `render/three-host.ts`'s `washGeometry` grew a closed-`Line` case
 * during this chapter (added by the concurrent O-6 work for Scene01's
 * morphs), so a Sketch's closed subpaths now DO wash — which is what
 * makes the gear's tooth band correct. But the fan it strikes is from
 * the loop's centroid, correct for a CONVEX loop and stated as such at
 * its definition. A gear is neither convex nor simply connected: it is
 * an ANNULUS with a toothed rim, drawn as two separate closed subpaths
 * (rim and inner circle), and nothing tells the renderer the second is
 * a hole in the first. So both fill as discs and the gear floods to its
 * centre, where the reference leaves a black disc carrying the icon.
 *
 * Measured on f_00505 (the white hold): our ink more than 3px from any
 * reference ink is 20,206 px = 24.6% of what we draw, and **88.6% of it
 * lies inside the four gears' inner discs** — the hole, exactly. In the
 * other direction the reference is now 98.9% explained by us, up from
 * 78% before the wash existed. The scene traded a recall problem for a
 * precision problem of almost the same size, which is what filling an
 * annulus as a disc must do.
 *
 * The bands:
 *
 *   t=3-12    the gears are solid on both sides but ours has no hole
 *             cov_ref 0.99, cov_ours 0.76 (t=12 is the drain's last
 *             frame: the reference is already empty, we are not quite)
 *   t=13-16   the fill has drained on BOTH sides — outline against
 *             outline, no wash anywhere — and every frame PASSES at
 *             0.97/0.95, chamfer 0.86/0.28px
 *   t=17-24   mid-un-draw, cov_ref ~0.96 / cov_ours ~0.78: the residual
 *             is the pen's shape, not the fill
 *
 * That t=12-16 band is the proof the geometry is right, and it is worth
 * more than the pass count: it is the only window in the scene where
 * the two renderers draw the same KIND of picture, and there they agree
 * to a third of a pixel. 96.9% of the reference mask's own BOUNDARY is
 * covered by our strokes at every hold — every line is where it should
 * be, and only the paint between them is wrong.
 *
 * The fix is not in this chapter's lane. Filling a gear correctly needs
 * even-odd (or nonzero) winding across a Sketch's subpaths TOGETHER,
 * rather than a fan per closed loop — `FillShape.setPolygon` would take
 * a triangulation of the whole drawing, not of one subpath at a time.
 * Reported rather than attempted, since `core/src/render/` is shared and
 * the O-6 morph work depends on the current behaviour.
 */

import { Dream, render } from "../../src/index"
import { Circle } from "../../src/parts/primitives"
import { ChangeColor, Create, FadeOut, Fill, UnDraw } from "../../src/verbs"
import { together } from "../../src/anim"
import { System } from "../../vocabulary/System/System"
import { BLUE, WHITE } from "../../src/constants"
import { PIXEL_UNITS_BASE_HEIGHT } from "../video01/palette"

/**
 * The 2021 thickness every object in this scene carries: `PRIM_THICKNESS`
 * for the Circle and `VG_THICKNESS` for the six drawings, both 5
 * (refs/pydeation-legacy/constants.py:49-51). Neither is overridden here
 * — Scene03 states no thickness at all — so ONE number covers the scene.
 */
const THICKNESS = 5

/**
 * Sketch & Toon's distance-based thickness attenuation, EVALUATED FOR AN
 * ORTHOGRAPHIC CAMERA — and this is the one number in the scene that
 * differs from the video01 palette's, for a reason worth stating.
 *
 * Every pydeation stroke carries the attenuation
 * (`OUTLINEMAT_THICKNESS_DISTANCE = True`, `_STRENGTH = 0.6`,
 * `_RANGE = 1` i.e. camera — object.py:207-209), so a stroke's rendered
 * width depends on how far the camera is. demo/video01/palette.ts models
 * it as the constant 0.6 it behaves like AT VIDEO-01'S DISTANCES, and
 * says so. Scene03 is a `TwoDScene` — an ORTHOGRAPHIC camera, which has
 * no such distance — so that constant does not transfer, and the
 * reference says so plainly. Measuring the same quantity (ink area over
 * peak, in LINEAR light, on an isolated stroke — palette.ts's own ruler)
 * across three scenes of this one video:
 *
 *   scene  camera                     circle stroke   implied factor
 *   S05    perspective, zoom 3/4      2.629 px        0.511
 *   S09    perspective, zoom 1        3.171 px        0.617
 *   S03    ORTHOGRAPHIC (TwoDScene)   4.566 px        0.888
 *
 * against a nominal 5 × 720/700 = 5.143 px. The two perspective scenes
 * bracket palette.ts's 0.6 and move the RIGHT WAY with distance — the
 * further camera gives the thinner line — which is the control that says
 * this is the attenuation and not a measurement artefact. The
 * orthographic scene sits well outside that bracket, in the direction of
 * LESS attenuation, which is what a camera at no distance must do.
 *
 * So 0.888 is read off this scene's own reference rather than fitted to
 * its verdict, and it is deliberately NOT pushed back into palette.ts:
 * that file's 0.6 is correct for what it documents, and the honest fix
 * for both is to port S&T's actual distance ramp rather than to carry a
 * second constant there. Until someone does, a TwoDScene states its own.
 *
 * Measured on refs/pitch/origins/frames5/f_00505 over the enclosing
 * circle's left and right rims (61 rows each): 4.566 / 4.575 px.
 */
const THICKNESS_DISTANCE_ORTHO = 0.888

/** The scene's one stroke width, in rendered pixels at 720p. */
const STROKE_SYSTEM = (THICKNESS * (720 / PIXEL_UNITS_BASE_HEIGHT)) * THICKNESS_DISTANCE_ORTHO

/**
 * The head between the audio cue (offset=96, which the scorer takes as
 * localT 0) and the scene's first frame — the ONE fitted number here,
 * carried as a leading wait so every run_time and wait below stays
 * verbatim from the source.
 *
 * Taken from the UN-DRAW rather than from a sweep, which is unusual for
 * this campaign and is the right call here. The draw cannot fit it: our
 * mid-draw picture differs from the reference's in KIND for its last
 * half (the reference fills, we do not), so sweeping the draw trades
 * cov_ref against cov_ours monotonically and shows no optimum — every
 * offset is "better" on one and worse on the other. The un-draw has no
 * such confound: it is eleven seconds of monotone retraction with no
 * fill on either side, and its endpoints are sharp.
 *
 * The reference's System ink leaves from t=110.6 to t=121.5 (measured
 * as lit pixels above the circle's own flat 10,085px plateau, at
 * 1-frame resolution). The source puts the un-draw's start at
 * 3 + 1 + 8 + 2 = 14s of scene time, so
 *
 *   START_OFFSET = 110.6 − 96 − 14 = 0.6
 *
 * and the same number then predicts the scene's other end without being
 * given it: the 11s un-draw closes at 121.6 (reference: 121.5), the
 * `wait(3)` runs to 124.6, and the reference's fade begins at 124.8 —
 * one frame. Nothing else in the scene is fitted.
 */
const START_OFFSET = 0.6

export class Scene03Dream extends Dream {
  // System(scale=3/4, y=1). pydeation's y is our z — a depth shift,
  // invisible under an orthographic camera. Carried so the source's
  // line reads straight across.
  system = new System({ scale: 3 / 4, z: 1, tint: WHITE, gearTint: WHITE, stroke: STROKE_SYSTEM })
  // Circle() — C4D's default radius 200, which the source never states
  // and therefore relies on.
  circle = new Circle({ radius: 200, tint: WHITE, stroke: STROKE_SYSTEM })

  unfold() {
    // TwoDScene: orthographic, camera_zoom 1 (scene.py:1035-1052).
    this.set(
      this.observer.orthographic.to(true),
      this.observer.zoom.to(1),
      this.observer.baseHeight.to(700),
    )

    this.wait(START_OFFSET)

    // Create(global_system, circle), 3s. `System` has no dedicated
    // animator in pydeation, so this is the generic parallel draw and
    // every spline in the composite advances together — which is what
    // f_00486 shows (System.ts's header, "THERE IS NO CHOREOGRAPHY").
    this.play(together(Create(this.system), Create(this.circle)), 3)
    // self.wait() — pydeation's bare wait is 1s.
    this.wait(1)

    // Fill(global_system, transparency=1) + ChangeColor(…, BLUE), 8s.
    // The Fill is a no-op and is kept as one; see the header.
    this.play(
      together(
        Fill(this.system, { transparency: 1 }),
        ChangeColor(this.system, BLUE),
        ChangeColor(this.circle, BLUE),
      ),
      8,
    )
    this.wait(2)

    // UnDraw(global_system), 11s — the System only. The circle is not
    // named and stays, which the reference's flat 13070px plateau
    // across f_00608-f_00622 confirms.
    this.play(UnDraw(this.system), 11)
    this.wait(3)

    // FadeOut(circle) — pydeation's default run_time is 1s.
    this.play(FadeOut(this.circle), 1)
  }
}

if (import.meta.main) render(Scene03Dream)
