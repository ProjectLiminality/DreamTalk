/**
 * S10.ts — A DreamWeaving
 *
 * video-01 "Dialectical Thinking" (2021), Scene 10 — the summary.
 *
 * The whole argument at half scale, drawn as one diagram: thesis on the
 * left, antithesis on the right, and two bezier arrows that leave the
 * shapes, bend toward each other, and merge into a single trunk rising
 * to the synthesis above. The cylinder fades in at the trunk's head and
 * the words "dialectical thinking" write themselves underneath. Then the
 * words leave, and the diagram is what remains.
 *
 * Source (refs/video-01-source-2022/dialectical_thinking.py:446-485):
 *
 *   CONFIG: camera_perspective "front", camera_position (0,0), zoom 5/4
 *   circle    = Circle(color=BLUE, radius=50, x=-100, z=-50, scale=1/2)
 *   rectangle = Rectangle(color=RED, width=100, height=200,
 *                         x=100, z=-50, scale=1/2)
 *   cylinder  = Cylinder(h=-PI/2, z=100, p=-PI/4, scale=1/2)
 *   arrow_rectangle = Connection(rectangle, (20,0,-50), (0,0,-30),
 *                                cylinder, offset_start=0.15, offset_end=0.2)
 *   arrow_cricle    = Connection(circle, (-20,0,-50), (0,0,-30),
 *                                cylinder, offset_start=0.15, offset_end=0.2)
 *   dialectical_thinking = Text("dialectical thinking", height=30, z=-150)
 *   wait(1/2)
 *   play(Create(rectangle, circle))
 *   play(Create(arrows))
 *   play(FadeIn(cylinder))
 *   play(Create(dialectical_thinking))
 *   wait()
 *   play(UnCreate(dialectical_thinking))
 *
 * pydeation works in the XZ plane under a top-view camera; DreamTalk's
 * scene plane is XY, so the fixed axis dictionary of CameraCal.ts
 * applies throughout: (X, Y, Z)c4d -> (x, z, y) for positions and
 * (h, p, b)c4d -> (b, p, h) for rotations. Every source `z` becomes our
 * `y`; the cylinder's source `h=-PI/2` becomes our `b=-PI/2`, its `p`
 * carries over unchanged, and the waypoints' `(20, 0, -50)` becomes our
 * `(20, -50, 0)`.
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { Create, FadeIn, UnCreate } from "../../src/verbs"
import { Circle, Rectangle } from "../../src/parts/index"
import { Cylinder } from "../../vocabulary/Cylinder/Cylinder"
import { Connection } from "../../src/parts/curves"
import { Text } from "../../src/parts/text"
import { PI } from "../../src/constants"
import { BLUE, RED, WHITE, STROKE_MAIN } from "./palette"

/**
 * The measured scene-start offset.
 *
 * The gauntlet maps localT = videoSec - 150.5, but the source's leading
 * `wait(1/2)` ends where the drawing actually begins, and the drawing
 * demonstrably begins just before video 150.5: frames5 f0752 (150.4s)
 * carries 0 lit pixels and f0753 (150.6s) already carries 261 — a
 * quarter of the first second's worth. Running the frame counts forward,
 * the two shapes settle between f0757 (151.4s) and f0758 (151.6s), the
 * arrows between f0762 and f0763, the cylinder's fade between f0763 and
 * f0765, and the text between f0771 and f0772 — four one-second spans
 * whose boundaries land at video 151.5, 152.5, 153.5, 154.5.
 *
 * So the scene's own t = 0 sits half a second before the span the
 * gauntlet scores. Carrying that as a negative leading wait keeps the
 * source's `wait(1/2)` and every `play()` run_time verbatim; the
 * timeline holds pre-first-segment values, so nothing is lit before the
 * first pen touches down.
 */
const START_OFFSET = -0.53

/**
 * The distance for this scene's zoom of 5/4.
 *
 * pydeation expresses zoom PURELY as camera distance (camera.py:70-77,
 * `pos_y = 1000 / zoom`) — the focal length never changes — so a zoom of
 * 5/4 is a dolly to 800 units and nothing else. That is not a
 * scene-local correction of the rig: observer.look("front") already
 * carries the 2021 azimuth, elevation and 36mm lens, and this line only
 * spends the one degree of freedom the source itself spends.
 *
 * The reference confirms the resulting 1280/800 = 1.600 px/world-unit
 * four independent ways on f0773: the circle's centre at screen x 479.5
 * for world x = -100 (predicted 480.0), the rectangle's at 799.6 for
 * +100 (800.0), the circle's 84px diameter for 50 world units (80px plus
 * the stroke), and the rectangle's 85x164px for 50x100 (80x160 plus it).
 */
const FRONT_DISTANCE = 800

export class S10Dream extends Dream {
  // Circle(color=BLUE, radius=50, x=-100, z=-50, scale=1/2) — the thesis.
  //
  // Same winding as S04's: the pen starts at the 45-degree point and runs
  // clockwise, which is pydeation's XZ-plane construction seen from the
  // front. f0754 shows exactly the S04 signature — a bare arc from the
  // upper right running down the circle's right side.
  circle = new Circle({
    radius: 50,
    tint: BLUE,
    x: -100,
    y: -50,
    scale: 1 / 2,
    drawStart: 1 / 8,
    drawReversed: true,
    stroke: STROKE_MAIN,
  })
  // Rectangle(color=RED, width=100, height=200, x=100, z=-50, scale=1/2)
  // — the antithesis. Again S04's winding: the top-right corner sits 250
  // units along the outline's own 600-unit perimeter and the reversal
  // sends the pen DOWN the right edge from there, which is the bare
  // vertical stroke f0754 shows.
  rectangle = new Rectangle({
    width: 100,
    height: 200,
    tint: RED,
    x: 100,
    y: -50,
    scale: 1 / 2,
    drawStart: 5 / 12,
    drawReversed: true,
    stroke: STROKE_MAIN,
  })
  // Cylinder(h=-PI/2, z=100, p=-PI/4, scale=1/2) — the synthesis, held
  // above the trunk in the oblique pose S09 leaves it in.
  //
  // Under the axis dictionary the C4D heading becomes our b and the pitch
  // carries over, sending the cylinder's axis to our (-1, 0, 1)/sqrt(2):
  // horizontal on screen, leaning half out of the plane toward the
  // camera on its left end. Perspective then does the rest — the near
  // (left) cap renders larger and higher, the far one smaller and lower,
  // which is the whole of the reference's apparent downward tilt.
  // Predicted screen bbox at FRONT_DISTANCE: x[553, 723] y[150, 245];
  // measured on f0773: x[551, 725] y[148, 245].
  cylinder = new Cylinder({
    radius: 50,
    height: 200,
    y: 100,
    b: -PI / 2,
    p: -PI / 4,
    scale: 1 / 2,
    tint: WHITE,
    stroke: STROKE_MAIN,
  })
  // The two Connections. Each traces a bezier from its shape through two
  // waypoints into the cylinder, trimmed to 15%..80% of its own arc
  // length so it starts clear of the shape and stops short of the
  // synthesis. The second waypoint (0, -30, 0) is SHARED, so the two
  // curves fuse from there upward: one trunk, one visible arrowhead.
  arrowRectangle = new Connection(this.rectangle, this.cylinder, {
    via: [
      { x: 20, y: -50, z: 0 },
      { x: 0, y: -30, z: 0 },
    ],
    offsetStart: 0.15,
    offsetEnd: 0.2,
    tint: WHITE,
    stroke: STROKE_MAIN,
  })
  arrowCircle = new Connection(this.circle, this.cylinder, {
    via: [
      { x: -20, y: -50, z: 0 },
      { x: 0, y: -30, z: 0 },
    ],
    offsetStart: 0.15,
    offsetEnd: 0.2,
    tint: WHITE,
    stroke: STROKE_MAIN,
  })
  // Text("dialectical thinking", height=30, z=-150) — the naming.
  caption = new Text({
    content: "dialectical thinking",
    size: 30,
    y: -150,
    tint: WHITE,
    stroke: 0,
  })

  unfold() {
    this.observer.look("front")
    this.set(...this.observer.dolly(FRONT_DISTANCE))
    this.wait(START_OFFSET)
    this.wait(1 / 2)
    this.play(together(Create(this.rectangle), Create(this.circle)), 1)
    this.play(together(Create(this.arrowRectangle), Create(this.arrowCircle)), 1)
    this.play(FadeIn(this.cylinder), 1)
    this.play(Create(this.caption), 1)
    this.wait(1)
    this.play(UnCreate(this.caption), 1)
  }
}

if (import.meta.main) render(S10Dream)
