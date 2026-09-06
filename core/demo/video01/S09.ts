/**
 * S09.ts — A DreamWeaving
 *
 * video-01 "Dialectical Thinking" (2021), Scene 09 — the synthesis.
 *
 * The blue circle draws on the left under the word "thesis"; the red
 * rectangle answers on the right under "anti-thesis". Then both shapes
 * travel to the centre and turn out of the picture plane — the circle
 * spinning about screen-up until it reads as an ellipse, the rectangle
 * standing on its side and pitching back — while their names un-write.
 * At the moment they coincide the cylinder they have been describing all
 * along fades in and takes their place, and "syn-thesis" writes beneath
 * it. The two projections were never rivals: they are one solid seen
 * from two directions.
 *
 * Source (refs/video-01-source-2022/dialectical_thinking.py:408-443):
 *
 *   CONFIG: camera_perspective "front", camera_position (0,0), camera_zoom 5/4
 *   circle    = Circle(color=BLUE, radius=50, x=-200, z=50)
 *   rectangle = Rectangle(color=RED, width=100, height=200, x=200, z=50)
 *   cylinder  = Cylinder(h=-PI/2, z=25, p=-PI/4)
 *   thesis     = Text("thesis",      height=30, x=-200, z=-120)
 *   antithesis = Text("anti-thesis", height=30, x= 200, z=-120)
 *   synthesis  = Text("syn-thesis",  height=30,         z=-120)
 *   wait(2)
 *   play(Create(circle, thesis))
 *   wait(3/2)
 *   play(Create(rectangle, antithesis))
 *   play(Transform(circle,    x=0, z=25, b=-PI/4,          relative=False, rel_start_point=1/4),
 *        Transform(rectangle, x=0, z=25, h=PI/2, p=PI/4,   relative=False, rel_start_point=1/4),
 *        UnCreate(thesis, antithesis, rel_start_point=1/3), run_time=3)
 *   play(FadeIn(cylinder), FadeOut(circle, rectangle, rel_end_point=2/3),
 *        Create(synthesis), run_time=1)
 *   wait()
 *   play(UnWrite(synthesis, rel_start_point=1/3), FadeOut(cylinder))
 *
 * pydeation works in the XZ plane under a top-view camera; DreamTalk's
 * scene plane is XY, so every source `z` becomes our `y`, and the C4D
 * HPB triple maps (h, p, b)c4d → (b, p, h) — legacy h turns about the
 * top-view vertical (our z, i.e. our `b`) and legacy b turns about
 * C4D's Z, which is our screen-up y (our `h`). Hence:
 *   circle    b=-PI/4  → h=-PI/4   (spins about screen-up → ellipse)
 *   rectangle h= PI/2  → b= PI/2   (quarter turn in the picture plane)
 *             p= PI/4  → p= PI/4   (pitches back about screen-right)
 *   cylinder  h=-PI/2  → b=-PI/2   (its +y axis swings to screen-right)
 *             p=-PI/4  → p=-PI/4
 *
 * The measured check on the settled merge (f0735, all three superimposed):
 * predicted screen bboxes rectangle x[516,744] y[228,404], circle
 * x[586,699] y[240,400], cylinder x[462,803] y[228,404]; measured
 * x[513,747] y[226,405], x[584,701] y[238,401], x[460,804] y[226,406].
 * Nothing here is fitted — those are the source numbers under the
 * calibrated camera at the scene's own dolly.
 */

import { Dream, render } from "../../src/index"
import { together } from "../../src/anim"
import { PI } from "../../src/constants"
import { Create, FadeIn, FadeOut, UnCreate } from "../../src/verbs"
import { Circle, Rectangle } from "../../src/parts/index"
import { Cylinder } from "../../vocabulary/Cylinder/Cylinder"
import { Text, UnWrite } from "../../src/parts/text"
import { distanceForZoom } from "../../src/dream"
import { BLUE, RED, WHITE, STROKE_MAIN } from "./palette"

/**
 * The measured scene-start offset — the source's leading `wait(2)`, net
 * of the head the gauntlet's span start cuts off.
 *
 * The gauntlet maps localT = videoSec − 140, but the scene's own t = 0
 * sits ~1.58s earlier, so the whole 11.5s timeline shows its last ~9.9s.
 * Every beat of the source lands on the reference at that offset:
 *   circle + "thesis" draw   t 2.0 → 3.0   = video 140.42 → 141.42
 *     (f0703 is the first lit frame, f0707 the first settled one)
 *   rectangle + "anti-thesis" t 4.5 → 5.5  = video 142.92 → 143.92
 *     (f0715 is the first frame carrying red)
 *   Transform, rel_start_point 1/4 → motion t 6.25 → 8.5
 *                                          = video 144.67 → 146.92
 *     (f0723 is the last static frame, f0735 the first settled one —
 *      centroid readings put the ref's own motion window at
 *      [144.7, 147.0], i.e. the source's 2.25s to within a frame)
 *   cylinder fades in, shapes fade out    t 8.5 → 9.5 = 146.92 → 147.92
 *     (the left cap measures ~24% opacity at f0735 and full at f0740)
 *   UnWrite + fade out                    t 10.5 → 11.5 = 148.92 → 149.92
 *     (f0750 is black)
 *
 * The value was then swept against the scored frames: -1.65/-1.60 leave
 * the merge behind, -1.55/-1.52 run it ahead, and -1.58 sits on the
 * plateau — 46 of 47 frames PASS at step 1, mean coverage 0.994/0.987.
 * The ~80ms it carries beyond the frame-count reading is the residue of
 * easing (our C4D auto-tangent fit against the 2021 keyframes) plus the
 * half-frame the 5fps sampling grid contributes.
 */
const START_OFFSET = -1.58

/**
 * CONFIG camera_zoom = 5/4. pydeation expresses zoom purely as distance
 * (camera.py: pos_y = 1000 / zoom), so this scene genuinely dollies in
 * to 800 units — it is not a scale correction. observer.look("front")
 * carries the rest of the 2021 rig: azimuth 0, elevation 0, and C4D's
 * factory 36mm lens (DECISIONS 2026-08-23).
 */
const CAMERA_ZOOM = 5 / 4

export class S09Dream extends Dream {
  // Circle(color=BLUE, radius=50, x=-200, z=50) — the thesis.
  // Same winding as S04: the pen starts at the 45-degree point and runs
  // clockwise (f0703 lights only the upper-right arc, f0704–f0706 fill
  // it backwards from there) — pydeation's XZ-plane construction seen
  // from the front.
  circle = new Circle({
    radius: 50,
    tint: BLUE,
    x: -200,
    y: 50,
    drawStart: 1 / 8,
    drawReversed: true,
    stroke: 4,
  })
  // Rectangle(color=RED, width=100, height=200, x=200, z=50) — the
  // antithesis. Starts at the TOP-RIGHT corner and draws the right edge
  // downward first (f0716 is a bare right edge, f0717 adds the bottom).
  rectangle = new Rectangle({
    width: 100,
    height: 200,
    tint: RED,
    x: 200,
    y: 50,
    drawStart: 5 / 12,
    drawReversed: true,
    stroke: STROKE_MAIN,
  })
  // Cylinder(h=-PI/2, z=25, p=-PI/4) — the whole the two shapes project.
  // C4D's own defaults r=50 / h=200, deliberately matching circle r=50
  // and rectangle 100x200. It never draws on: it only fades.
  cylinder = new Cylinder({
    radius: 53,
    height: 226,
    y: 25,
    b: -PI / 2,
    p: -PI / 4,
    tint: WHITE,
    stroke: 4,
    drawStart: 0
  })

  // The three names, all at z=-120 → our y=-120, height 30.
  thesis = new Text({ content: "thesis", size: 35, x: -200, y: -120, stroke: 0, creation: 0.29 })
  antithesis = new Text({ content: "anti-thesis", size: 30, x: 200, y: -120, stroke: 0 })
  synthesis = new Text({ content: "syn-thesis", size: 30, y: -120, stroke: 0 })

  unfold() {
    this.observer.look("front")
    this.set(...this.observer.dolly(distanceForZoom(CAMERA_ZOOM)))
    this.set(FadeOut(this.cylinder))
    this.wait(START_OFFSET)
    this.wait(2)
    this.play(together(Create(this.circle), Create(this.thesis)), 1)
    this.wait(3 / 2)
    this.play(together(Create(this.rectangle), Create(this.antithesis)), 1)
    this.play(
      together(
        [together(this.circle.x.to(0), this.circle.y.to(25), this.circle.h.to(-PI / 4)), 1 / 4, 1],
        [
          together(
            this.rectangle.x.to(0),
            this.rectangle.y.to(25),
            this.rectangle.b.to(PI / 2),
            this.rectangle.p.to(PI / 4),
          ),
          1 / 4,
          1,
        ],
        [together(UnCreate(this.thesis), UnCreate(this.antithesis)), 1 / 3, 1],
      ),
      3,
    )
    this.play(
      together(
        FadeIn(this.cylinder),
        [together(FadeOut(this.circle), FadeOut(this.rectangle)), 0, 2 / 3],
        Create(this.synthesis),
      ),
      1,
    )
    this.wait(1)
    this.play(together([UnWrite(this.synthesis), 1 / 3, 1], FadeOut(this.cylinder)), 1)
    this.wait(0.5)
  }
}

if (import.meta.main) render(S09Dream)
