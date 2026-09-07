/**
 * Scene09.ts — A DreamWeaving
 *
 * "The Origins of Project Liminality" (2024), Scene 09 — the mark, alone
 * and slow.
 *
 * The simplest scene in the video and the one that makes the mark
 * sovereign. No title, no camera move, no second object: the Project
 * Liminality logo at full size, drawing itself over eighteen seconds,
 * holding, and fading. Where Scene05 gave the mark a name, this gives it
 * time — long enough that the construction stops reading as an
 * animation and starts reading as a thing being built.
 *
 * Source (refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py:918-929):
 *
 *   CONFIG = camera_perspective "front", camera_position (0, 0), zoom 1
 *   logo = Logo()
 *   self.audio(…, offset=369)
 *   self.add(logo)
 *   self.play(Create(logo), run_time=18)
 *   self.wait(6)
 *   self.play(FadeOut(logo))
 *
 * That is the whole scene. `Logo()` takes every default — radius 200,
 * no offset, no scale — so this is the mark at its intrinsic size, and
 * `Create` dispatches pydeation's `CreateLogo` (animator.py:774-806),
 * whose fade / draw / bloom choreography is derived and verified in
 * core/vocabulary/Logo/Logo.ts.
 *
 *
 * WHAT THE RE-CUT ACTUALLY DID — AND DIDN'T
 *
 * The origins report (§0) places Scene09 at source-audio offsets
 * 369–380 and marks it as belonging to the video's re-cut second half,
 * where the published 377.9s video no longer tracks the 429.7s
 * narration. That is right about the OFFSETS and needs one correction
 * about the SCENE: the 18-second draw was not shortened. It plays at
 * full source length; the editor only moved where it sits.
 *
 * In the published video the scene runs from a black cut at f_01603
 * (320.6s) to black again at f_01729 (345.8s) — about 25 seconds, which
 * is 18 of drawing plus the source's own `wait(6)` and the fade. Held
 * against the source's `run_time=18`, the choreography's landmarks fit
 * a scene start of t0 = 321.3s with an rms of 0.30s (a free-span fit
 * lands on T = 17.7–18.7 depending on which landmarks are included —
 * the source's 18 sits inside that, so there is nothing to prefer over
 * it). Landmarks read off refs/pitch/origins/frames5, all at 1-frame
 * resolution:
 *
 *   window       frac   predicted   measured   frame
 *   fade starts   0.00     321.30     321.20    f_01606  first blue ink
 *   legs start    0.40     328.50     328.60    f_01643  first white ink
 *   apex          0.70     333.90     333.60    f_01668  legs meet, y=249
 *   bloom starts  0.70     333.90     334.40    f_01672  first red, r=76.5
 *   settled       1.00     339.30     339.20    f_01696  r=158, cy=268
 *
 * Every landmark inside half a second of the source's own timing at a
 * 0.2s frame pitch. So this file plays the source verbatim, and the
 * scoring below compares APPEARANCE at matched completion points rather
 * than assuming the video's clock — the report's fidelity rule for the
 * re-cut half, applied to a scene that turns out not to have been
 * re-timed at all.
 *
 *
 * THE CHOREOGRAPHY, VISIBLE
 *
 * At eighteen seconds each phase is long enough to watch, and the
 * reference shows all three cleanly — which is why this scene, not
 * Scene05, is where the Logo's animator was verified:
 *
 *  - The blue circle FADES. Its pixel count jumps to nearly full on the
 *    fade's first frames and only its brightness climbs (f_01606-f_01628:
 *    count 0 → 6517 → 7724 while mean luminance runs 70 → 91 → 100).
 *    A drawn circle would show a growing arc; there is never a partial
 *    one.
 *  - The legs GROW UPWARD. Their ink's bottom edge is pinned at y=565
 *    from the first frame while the top climbs 565 → 543 → 445 → 249
 *    (f_01643 → f_01668). That is `Spline([foot, focal])` drawn from its
 *    first point, i.e. core's default pen direction, unreversed.
 *  - The red circle BLOOMS OUT OF THE APEX. Radius 76.5 → 158 px while
 *    its centre DESCENDS 259.5 → 268 (f_01672 → f_01696) — the source's
 *    three simultaneous (0.7, 1) animations: opacity, radius 0 → 122,
 *    and z from focal_height down to small_circle_center_height.
 *
 *
 * FRAMING (zoom 1, front)
 *
 * Distance 1000/zoom = 1000, so with the 36mm rig's f = 1290 px at 1280
 * wide the origin plane scales by exactly 1.29 px per world unit — the
 * cleanest projection in either video, and the reason this scene is the
 * Logo's calibration target. Predicted against f_01700, measured:
 *
 *   main circle  r 258.0 px      measured 258   (x[382, 898])
 *   small circle r 157.4, cy 267.1  measured 158, 268
 *   leg feet     x 488.4 / 791.6, y 568.7  measured 490 / 790, 566
 *   apex         x 640, y 249.8   measured 640, 249
 *
 * Nothing is fitted. The mark's own derivation, projected, IS the
 * reference frame.
 */

import { Dream, render } from "../../src/index"
import { Create, FadeOut } from "../../src/verbs"
import { Logo } from "../../vocabulary/Logo/Logo"
import { STROKE_MAIN } from "../video01/palette"

export class Scene09Dream extends Dream {
  // Logo() — every default. The mark at its intrinsic size, centred.
  logo = new Logo({ stroke: STROKE_MAIN })

  unfold() {
    // CONFIG camera_perspective "front", camera_position (0, 0), zoom 1.
    // The position is the rig's default and the zoom is 1, so `look`
    // alone states the whole camera: nothing to pan, nothing to scale.
    this.observer.look("front")

    this.play(Create(this.logo), 18)
    this.wait(6)
    // `FadeOut(logo)` — the opacity verb, NOT UnCreateLogo. The source
    // chose the plain fade here, so the mark leaves whole rather than
    // through its own reversed construction.
    this.play(FadeOut(this.logo), 1)
  }
}

if (import.meta.main) render(Scene09Dream)
