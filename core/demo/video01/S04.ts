/**
 * S04.ts — A DreamWeaving
 *
 * video-01 "Dialectical Thinking" (2021), Scene 04 — the gradient.
 *
 * Thesis and antithesis stand apart, and between them a single arrowed
 * axis: not a shape but a DIRECTION. The blue circle and the red
 * rectangle draw on together, the white gradient draws beneath them, and
 * then all three leave — the gradient swept away from its own beginning
 * while the two shapes retract into where they came from.
 *
 * Source (refs/video-01-source-2022/dialectical_thinking.py:259-282):
 *
 *   circle    = Circle(color=BLUE, radius=50, z=50, x=-250)
 *   rectangle = Rectangle(color=RED, width=100, height=200, z=50, x=250)
 *   gradient  = Axes(mode="x", length_x=500, z=-100)
 *   wait()
 *   play(Create(circle, rectangle), run_time=2)
 *   play(Create(gradient), run_time=2)
 *   play(UnCreate(gradient, rel_end_point=3/4),
 *        UnCreate(circle, rectangle, rel_start_point=1/2), run_time=2)
 *
 * pydeation works in the XZ plane under a top-view camera; DreamTalk's
 * scene plane is XY, so every source `z` becomes our `y` (the same
 * mapping CameraCal.ts establishes for Scene 01).
 *
 * The `gradient` Axes takes pydeation's defaults, which the source never
 * overrides: draw_ticks=True (tick_distance 30, tick_length 10) and
 * arrow_end=True. length_x=500 gives extents -250 → +250, so 15 ticks at
 * -210 … +210 — exactly what refs/video-01/frames5/f0428.png shows.
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { Create, UnCreate } from "../../src/verbs"
import { Axes, Circle, Rectangle } from "../../src/parts/index"
import { BLUE, RED, STROKE_MAIN } from "./palette"

/**
 * The measured scene-start offset — the source's leading `wait()`, net of
 * the head the gauntlet's span start cuts off.
 *
 * The gauntlet maps localT = videoSec - 82, but the drawing demonstrably
 * begins just before video 81.8s (frames5 f0408 carries 0 lit pixels,
 * f0409 carries 88) and ends just before 87.8s (f0438 carries 300, f0439
 * carries 0) — a 6.0s animation, exactly the source's 2 + 2 + 2. So the
 * source's `wait()` of 1s ends around video 81.7s, i.e. at a NEGATIVE
 * localT, and the scene's own t = 0 sits over a second before the span
 * the gauntlet scores. Carrying that as a negative leading wait keeps
 * every play() run_time verbatim from the source; the timeline holds
 * pre-first-segment values, so nothing is lit before the draw begins.
 *
 * -0.29 rather than the -0.25 the frame counts alone suggest: swept
 * against the scored frames (-0.15 / -0.20 / -0.28 / -0.30 / -0.32 /
 * -0.35), everything from -0.28 to -0.35 passes and -0.29 sits in the
 * middle of that plateau. The extra ~40ms is the residue of easing: our
 * smoothstep is C4D's spline tangents at a smoothing of 1/3, while the
 * 2021 keyframes use 0.25, which runs a little ahead of smoothstep
 * through the first half of every span.
 */
const START_OFFSET = -0.29

/**
 * The front-view dolly.
 *
 * observer.look("front") carries the whole 2021 rig — azimuth 0,
 * elevation 0, the 45mm lens — and CameraCal.ts settles those against
 * Scene 01. Its 1000-unit distance, though, projects this scene's flat
 * XY geometry 25% too large: the reference's tick spacing is 38.4px for
 * a 30-unit pitch (1.280 px/unit), its circle centres land at x 319.5
 * and 960.0 for world x = ∓250, and its rectangle measures 132 x 260px
 * for 100 x 200 units — four independent readings all on 1.28, against
 * the rig's 1.60. pydeation expresses zoom purely as distance
 * (camera.py: pos_y = 1000 / zoom), so the honest correction is a dolly,
 * not a lens change: 1000 * 1.60 / 1.28 = 1250 puts all four back on
 * the reference. Left as a scene-local number rather than a change to
 * PERSPECTIVES, since only a flat scene measures the projection this
 * cleanly and Scene 01's calibration is not mine to move.
 */
const FRONT_DISTANCE = 1250

export class S04Dream extends Dream {
  // Circle(color=BLUE, radius=50, z=50, x=-250) — the thesis.
  //
  // The pen starts at the 45-degree point and runs clockwise: measured
  // straight off the reference (f0409 lights only 39-45 degrees; f0411,
  // f0413, f0415, f0417 fill the circle backwards from there), and it is
  // the same clockwise reading the rectangle gives, i.e. pydeation's
  // XZ-plane winding seen from the front. drawStart locates the point
  // along the outline's own winding (45 of 360), drawReversed turns the
  // pen around at it.
  circle = new Circle({
    radius: 50,
    tint: BLUE,
    x: -250,
    y: 50,
    drawStart: 1 / 8,
    drawReversed: true,
    stroke: STROKE_MAIN,
  })
  // Rectangle(color=RED, width=100, height=200, z=50, x=250) — the antithesis.
  //
  // Same winding, starting at the TOP-RIGHT corner: the reference draws
  // the right edge downward first (f0411 is a bare right edge), then the
  // bottom, then the left, then the top. The top-right corner sits 250
  // units along the outline's own 600-unit perimeter, and the reversal
  // sends the pen down the right edge from there.
  rectangle = new Rectangle({
    width: 100,
    height: 200,
    tint: RED,
    x: 250,
    y: 50,
    drawStart: 5 / 12,
    drawReversed: true,
    stroke: STROKE_MAIN,
  })
  // Axes(mode="x", length_x=500, z=-100) — the gradient, ticks and arrow
  // both at their pydeation defaults.
  gradient = new Axes({
    mode: "x",
    xStart: -250,
    xEnd: 250,
    y: -100,
    gridSpacing: 30,
    drawTicks: true,
    drawGrid: false,
    arrowEnd: true,
    stroke: STROKE_MAIN,
  })

  unfold() {
    this.observer.look("front")
    this.set(...this.observer.dolly(FRONT_DISTANCE))
    this.wait(START_OFFSET)
    this.play(together(Create(this.circle), Create(this.rectangle)), 2)
    this.play(Create(this.gradient), 2)
    this.play(
      together(
        [UnCreate(this.gradient), 0, 3 / 4],
        [together(UnCreate(this.circle), UnCreate(this.rectangle)), 1 / 2, 1],
      ),
      2,
    )
    this.wait(1)
  }
}

if (import.meta.main) render(S04Dream)
