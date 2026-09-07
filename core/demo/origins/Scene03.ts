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
 * THE FILL THAT FILLS NOTHING
 *
 * `Fill(global_system, transparency=1)` is a NO-OP, and reproducing it
 * faithfully means reproducing that. pydeation's `Fill` drives the
 * filler material's transparency, and 1 is fully transparent — the verb
 * is being asked to wash the interior to invisible, which is where it
 * already is. Core's `Fill` inverts to opacity (verbs.ts: 1 − 0.93 is
 * the default wash), so `transparency: 1` becomes `fillOpacity → 0` and
 * the call animates a param nothing renders.
 *
 * It would be easy to read the source's intent as "flood the gears" and
 * quietly pass `solid: true`. The reference forbids it. A horizontal
 * luminance profile through the big lower-right gear at f_00505 — the
 * frame where the drawing is complete and still white, the brightest
 * the scene ever is — reads ink, then EXACTLY ZERO between the strokes,
 * for every gap:
 *
 *   … 251 251 245 251 193 | 0 4 0 6 5 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 …
 *
 * and the two large empty regions inside the enclosing circle (above
 * and below the gear cluster) measure 0.0 mean at every sampled frame
 * from t=100 to t=114, across the ChangeColor and into the un-draw.
 * There is no wash in this scene at any moment. The call is kept — it
 * is in the source, it costs one track, and deleting it would hide a
 * real fact about how the 2021 grammar was used — but it is kept as
 * what it is.
 *
 * So the eight-second play has exactly one visible half: the recolour.
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
 *                                            3.09px stroke: +1.5px, and
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
 */

import { Dream, render } from "../../src/index"
import { Circle } from "../../src/parts/primitives"
import { ChangeColor, Create, FadeOut, Fill, UnDraw } from "../../src/verbs"
import { together } from "../../src/anim"
import { System } from "../../vocabulary/System/System"
import { BLUE, WHITE } from "../../src/constants"
import { STROKE_MAIN } from "../video01/palette"

/**
 * The head between the audio cue (offset=96, which the scorer takes as
 * localT 0) and the scene's first frame — the ONE fitted number here,
 * carried as a leading wait so every run_time and wait below stays
 * verbatim from the source.
 *
 * Fitted by sweeping the alignment and scoring the draw (f_00483-f_00495,
 * where the ink is changing fastest and the offset is therefore most
 * observable), not by reading a first-ink landmark — an eased draw
 * spends part of its window below the encode's threshold before it
 * lights a pixel, so every landmark reads late (the lesson Scene00's
 * and Scene05's headers both record).
 *
 * See docs/reports/origins/o5-sweep.json for the sweep this is taken
 * from.
 */
const START_OFFSET = 0.6

export class Scene03Dream extends Dream {
  // System(scale=3/4, y=1). pydeation's y is our z — a depth shift,
  // invisible under an orthographic camera. Carried so the source's
  // line reads straight across.
  system = new System({ scale: 3 / 4, z: 1, tint: WHITE, gearTint: WHITE, stroke: STROKE_MAIN })
  // Circle() — C4D's default radius 200, which the source never states
  // and therefore relies on.
  circle = new Circle({ radius: 200, tint: WHITE, stroke: STROKE_MAIN })

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
