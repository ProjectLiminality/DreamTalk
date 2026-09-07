/**
 * Scene12.ts — A DreamWeaving
 *
 * "The Origins of Project Liminality" (2024), the CLOSING TITLE — the
 * mark and its name, one last time, and the frame the video ends on.
 *
 * The last 5.8 seconds of the published video have no scene in
 * pitch.py. The source's final class is Scene11 (the kinship graph
 * healed), and after `self.finish()` there is nothing. But the video
 * does not end on Scene11's fade: it goes black for 0.8s and then the
 * Project Liminality logo builds itself one more time, the title writes
 * on beneath it, and the film holds there until the last frame.
 *
 * That closing card is NOT a raster asset and it is not a Keynote
 * slide. It is a pydeation render — the same two objects and the same
 * animator as Scene05, at a different camera zoom — which is why it is
 * reproduced here rather than noted and skipped. Measured, it is
 * Scene05's play verbatim.
 *
 *
 * THE MEASUREMENT — SAME CHOREOGRAPHY, ONE CAMERA DIFFERENCE
 *
 * Against refs/pitch/origins/frames5, per-colour masks with a strict
 * white (min channel > 0.35, spread < 0.18, so the ring's antialiased
 * edge does not count as leg ink), the two cards' landmarks:
 *
 *   beat            Scene05    rel   closing    rel
 *   blue first ink   145.0     0.00    372.2    0.00
 *   legs first ink   145.8     0.80    373.4    1.20
 *   legs complete    146.6     1.60    374.2    2.00
 *   red first ink    146.8     1.80    374.4    2.20
 *   red settled      147.6     2.60    375.0    2.80
 *   title first ink  147.2     2.20    374.8    2.60
 *   title complete   148.4     3.40    376.0    3.80
 *
 * Every relative beat is +0.40 except the blue onset, which is +0.00 —
 * a constant shift, not a stretch. So the play is the same length; only
 * the blue circle's fade crosses the encode's threshold 0.4s EARLIER
 * here. That is the expected direction for a BIGGER circle: this card's
 * main circle is 153 px against Scene05's 117.5, so more of its
 * perimeter clears the JPEG threshold at the same opacity. Anchoring on
 * the six beats that are not the fade puts the play at video 372.05,
 * and all six then land within one 5fps frame:
 *
 *   beat            predicted   measured
 *   legs first ink    373.40     373.40
 *   legs complete     374.20     374.20
 *   red first ink     374.40     374.40
 *   red settled       375.20     375.00   (one frame)
 *   title first ink   374.80     374.80
 *   title complete    376.00     376.00
 *
 * Nothing is fitted: the play's start is the only number, and it is
 * over-determined by six landmarks rather than read off one.
 *
 *
 * THE CAMERA IS THE WHOLE DIFFERENCE
 *
 * Scene05 renders at `camera_zoom 3/4`. This card renders at zoom 1,
 * and that single change accounts for every geometric difference
 * between them. Both frames measured, the ratio is uniform:
 *
 *   quantity                 Scene05    closing    ratio
 *   main circle radius        117.5      153.0     1.302
 *   small circle radius        72.5       94.5     1.303
 *   title width               359        469       1.306
 *   mark centre offset y      -48        -62.5     1.302
 *   title baseline offset y   141.5      184       1.300
 *
 * A uniform 1.302 across radii, widths AND distances from the frame
 * centre is a camera move, not an object scale — an object scaled about
 * its own origin would grow the mark without pushing the title further
 * down the frame. The nominal ratio is 4/3 (zoom 3/4 → 1); the measured
 * 1.302 is 2.4% short, which is the stroke's own width being counted
 * into every bounding box at both zooms (a constant additive term
 * shrinks a ratio). Radius 200 at scale 0.6 projects to 156.7 px at
 * zoom 1 against 153 measured — 3.7 px, and the mark's stroke is 4 px
 * wide, so the ring's measured span is its centreline minus about a
 * stroke. The construction is Scene05's, unchanged.
 *
 *
 * WHAT IT DOES NOT DO
 *
 * Scene05 ends `UnCreate(name)` — the title un-writes and the mark is
 * left alone for Scene06 to inherit. This card does neither. It builds
 * and it HOLDS: from 376.0 the frame is pixel-identical to the last
 * frame of the video at 377.888, ink counts flat at 21,441 across every
 * one of the final ten reference frames. The film ends on the mark.
 *
 * So the play here is Scene05's first three statements — the lead, the
 * 4s composite create, and then a hold to the end of the video instead
 * of a teardown.
 *
 *
 * THE LEAD-IN IS THE SONG'S, NOT THE CARD'S (2026-09-07, assembly)
 *
 * Standalone, this scene took Scene05's own `wait(2)` as its lead and
 * therefore sat at t0 = video 370.05. In the song that is 1.15s too
 * early: Scene11's last clip — `FadeOut(relationships) + UnFill` — ends
 * at ITS local 11.0, i.e. video 371.2, and a cut at 370.05 would take
 * the film off the healed graph mid-fade. The frames say the fade
 * completes: the reference is black at 371.0-372.0 and the closing
 * card's blue first ink is at 372.2 (measured above).
 *
 * Both readings are satisfied at once because this card's lead-in is
 * DEAD AIR — nothing is staged before the create, so every frame of it
 * is black, exactly the black gap the reference shows. So the fix is to
 * move the cut later and shorten the lead by the same amount: t0 =
 * 371.2 (where Scene11 actually finishes) with LEAD_IN = 0.85. The
 * play still begins at 372.05, which is where the six landmarks put it,
 * and the trailing hold is untouched at 1.838. Nothing about the card
 * moves; only where the song cuts to it.
 *
 * The scene's span is then 377.888 − 371.2 = 6.688s, and the song's
 * spans still sum to the video's own 377.888s exactly.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { Text, Write } from "../../src/parts/text"
import { Logo } from "../../vocabulary/Logo/Logo"
import { together } from "../../src/anim"
import { STROKE_MAIN } from "../video01/palette"

/**
 * The head between this card's t0 in the song (video 371.2, where
 * Scene11's fade actually ends) and the start of its play at video
 * 372.05, which is where the six landmarks put it.
 *
 * Scene05 states a `wait(2)` before its create and this card was first
 * written with the same one, putting its t0 at 370.05 — inside
 * Scene11's fade. The head is dead air either way (nothing is staged
 * until `Create` runs), so it is the free parameter that absorbs the
 * difference: 0.85 here holds the play where it is measured while
 * letting the previous chapter finish. See the header.
 */
const LEAD_IN = 0.85

export class Scene12Dream extends Dream {
  // Logo(z=50, scale=0.6) — Scene05's mark, unchanged. The card differs
  // only in the camera, so the object parameters are copied verbatim
  // rather than re-derived from this card's own (larger) pixels.
  logo = new Logo({ y: 50, scale: 0.6, stroke: STROKE_MAIN })
  // Text("Project Liminality", z=-160, height=50) — likewise verbatim.
  name = new Text({ content: "Project Liminality", y: -160, size: 50 })

  unfold() {
    // CONFIG camera_perspective "front", camera_zoom 1 — the ONE
    // difference from Scene05, and the whole of the 1.302 scale ratio
    // measured in the header. `look` states the rest; zoom 1 is the
    // rig's default, so there is nothing to set.
    this.observer.look("front")

    this.wait(LEAD_IN)
    // Scene05's play, statement for statement: one 4s span carrying the
    // logo to 3/4 of it and opening the title at 2/3.
    this.play(
      together(
        [Create(this.logo), 0, 3 / 4],
        [Write(this.name), 2 / 3, 1],
      ),
      4,
    )
    // And then it holds. No UnCreate — the video ends here, on the
    // finished card, 1.838s after the title's last letter lands.
    this.wait(1.838)
  }
}

if (import.meta.main) render(Scene12Dream)
