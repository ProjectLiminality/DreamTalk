/**
 * Scene05.ts — A DreamWeaving
 *
 * "The Origins of Project Liminality" (2024), Scene 05 — the mark and
 * its name.
 *
 * The blue circle arrives whole out of the dark; a white Λ draws itself
 * up from the circle's rim to a point; and as the point closes, a red
 * circle is born there and swells down into place. The title writes
 * itself on underneath, letter by letter, while the mark is still
 * finishing. Four seconds of construction, four of stillness, and the
 * name is taken away again — leaving the mark alone, which is how
 * Scene06 inherits it.
 *
 * Source (refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py:315-337):
 *
 *   CONFIG = camera_perspective "front", camera_zoom 3/4
 *   logo = Logo(z=50, scale=0.6)
 *   name = self.text(Text("Project Liminality", z=-160, height=50))
 *   self.audio(…, offset=142)
 *   self.add(logo)
 *   self.wait(2)
 *   self.play(Create(logo, rel_end_point=3/4),
 *             Write(name, rel_start_point=2/3),
 *             run_time=4)
 *   self.wait(4)
 *   self.play(UnCreate(name))
 *   self.wait(1)
 *
 * `Create(logo)` dispatches pydeation's `CreateLogo`
 * (animator.py:774-806), not a generic draw — the fade / draw / bloom
 * choreography lives in core/vocabulary/Logo/Logo.ts, where it is
 * derived and verified. This scene only stages it.
 *
 *
 * THE TWO WINDOWS INSIDE THE FOUR SECONDS
 *
 * One `play` span carries both animations at different reaches:
 * `rel_end_point=3/4` finishes the logo at 3s, `rel_start_point=2/3`
 * starts the title at 2.667s. They overlap by a third of a second — the
 * name begins while the red circle is still settling — and that overlap
 * is the scene's whole gesture, the mark handing off to the word.
 *
 * Both windows go on straight (the plain tuple), not through restage():
 * pydeation applies them as `AnimationGroup((animation, (a, b)))`, which
 * rescales the animation's own keyframe times into the sub-window, so
 * the ease scales with the window. That is exactly what a tuple does
 * here. (S05 of video-01 needed restage() for its Axes because a
 * COMPOSITE animator assembles at full span and rescales afterwards;
 * CreateLogo is such a composite, but its sub-windows are already
 * explicit fractions, so rescaling them once is the same operation
 * either way.)
 *
 *
 * FRAMING (zoom 3/4, front — the source coordinates ARE the pixels)
 *
 * A perspective ThreeDScene realizes zoom purely as camera distance
 * (dream.ts distanceForZoom: 1000/zoom), so zoom 3/4 puts the camera
 * 1333.33 units out. With the 36mm rig's f = 1290 px at 1280 wide, the
 * origin plane scales by 1290/1333.33 = 0.9675 px per world unit.
 *
 * pydeation's out-of-plane y is our z and its z is our y, so the
 * source's `z=50` is a 50-unit lift and `z=-160` a 160-unit drop.
 * Predicted against refs/pitch/origins/frames5/f_00760 (t=152s):
 *
 *   main circle   r 200·0.6·0.9675 = 116.1 px, centre y 311.6
 *                 measured r 117, cy 312
 *   small circle  r 122·0.6·0.9675 =  70.8 px, centre y 269.8
 *                 measured r  72, cy 271
 *   title         baseline y = 360 + 160·0.9675 = 514.8
 *                 measured ink box y[479, 524] — cap height above,
 *                 the "j"/"y" descenders below, baseline ≈ 513
 *
 * Nothing here is fitted except START_OFFSET.
 *
 *
 * THE TIMELINE, MEASURED
 *
 * The source's offset=142 is the audio cue, not the first frame: the
 * video's black gap runs 142.2–146.6s (report §0) and the scene's own
 * `wait(2)` sits inside it. Read off frames5 at 1-frame resolution
 * (blue-pixel count and mean luminance; white ink split into the logo
 * region y<450 and the title region y>=450):
 *
 *   f_00724  144.8  blue appears (9 px — the fade's first frame)
 *   f_00727  145.4  blue at full count 3206, brightness plateaus
 *   f_00730  146.0  first white leg ink, y[398,403] — the feet
 *   f_00733  146.6  legs reach y=261
 *   f_00734  146.8  red appears, r=52 px, centre y 268.5
 *   f_00736  147.2  first title ink (81 px)
 *   f_00738  147.6  red settled r=72, centre y=271; legs at y[201,403]
 *   f_00742  148.4  title complete (4796 px), and holds
 *   f_00764  152.8  title begins to leave
 *   f_00768  153.6  title gone
 *
 * The logo's fade begins at 144.8 and the whole `Create` ends at ~147.7,
 * which is 3s — the source's `rel_end_point=3/4` of 4s — so the play
 * starts at 144.75 and, behind the `wait(2)`, scene t=0 sits at 142.75.
 * The gauntlet maps localT = videoSec − 142, so the leading offset is
 * +0.75s. Every landmark then follows without another free number: the
 * legs' window (0.4, 0.7) of a 3s effect predicts first ink at 145.95
 * (measured 146.0) and the apex at 146.85 (measured 146.8); the bloom's
 * (0.7, 1) predicts the red circle's first frame at 146.85 (measured
 * 146.8) and its settle at 147.75 (measured 147.6).
 *
 * The title's own span is likewise a consequence: 2/3 into the 4s play
 * is 147.42 (first ink measured 147.2, and Write's first letter needs a
 * moment of its domino window before it lights a pixel), running to
 * 148.75 (complete measured 148.4 — the last letters' fills finish
 * inside the encode's tolerance).
 */

import { Dream, render } from "../../src/index"
import { Create, UnCreate } from "../../src/verbs"
import { Text, Write } from "../../src/parts/text"
import { Logo } from "../../vocabulary/Logo/Logo"
import { together } from "../../src/anim"
import { STROKE_MAIN } from "../video01/palette"

/**
 * The measured head between the audio cue (offset=142, which the
 * gauntlet takes as localT 0) and the scene's actual first frame.
 *
 * Fitted once, off the blue circle's fade: it first lights at f_00724
 * (144.8s) and the whole `Create(logo, rel_end_point=3/4)` completes at
 * ~147.7s, a 3-second effect, so the play begins at 144.75 and t=0 —
 * two seconds of `wait` earlier — at 142.75. Carried as a leading wait
 * so that every run_time and wait below stays verbatim from the source.
 */
const START_OFFSET = 0.75

export class Scene05Dream extends Dream {
  // Logo(z=50, scale=0.6). pydeation's z is our y: the mark rides 50
  // units above centre, leaving room for the name beneath it.
  logo = new Logo({ y: 50, scale: 0.6, stroke: STROKE_MAIN })
  // Text("Project Liminality", z=-160, height=50) — `height` is the 2021
  // font size, and core's Text anchors on the baseline exactly as C4D's
  // centred text spline does, so the source's z lands with no vertical
  // correction.
  name = new Text({ content: "Project Liminality", y: -160, size: 50 })

  unfold() {
    // CONFIG camera_perspective "front", camera_zoom 3/4 — the camera on
    // +z looking back at the origin, distance 1000/zoom.
    this.observer.look("front")
    this.set(this.observer.zoom.to(3 / 4))

    this.wait(START_OFFSET)
    this.wait(2)
    // One 4s span; the logo reaches 3/4 of it and the name starts at 2/3.
    this.play(
      together(
        [Create(this.logo), 0, 3 / 4],
        [Write(this.name), 2 / 3, 1],
      ),
      4,
    )
    this.wait(4)
    // The source's own verb. UnCreate on a Text dispatches its
    // unCreateAnim, which IS UnWrite — the same forward domino running a
    // second time to take the letters away, first letter out first
    // (Text.erasure), not `creation` reversed.
    this.play(UnCreate(this.name), 1)
    this.wait(1)
  }
}

if (import.meta.main) render(Scene05Dream)
