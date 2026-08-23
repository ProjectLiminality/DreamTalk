/**
 * S07.ts — A DreamWeaving
 *
 * video-01 "Dialectical Thinking" (2021), Scene 07 — the word.
 *
 * Between the cylinder turning through its plane (S06) and the eye that
 * comes back to orbit it (S08), the video stops making pictures for
 * three seconds and says the thing outright. One word writes itself onto
 * black letter by letter, stands for a second, and unwrites the same
 * way: trans-perspectival. Not a symbol of the idea — the name of it.
 *
 * Source (refs/video-01-source-2022/dialectical_thinking.py:355-368):
 *
 *   class Scene07(TwoDScene):      # no CONFIG: position (0,0), zoom 1
 *       text = self.text(Text("trans-perspectival"))
 *       wait(5 / 2)
 *       play(Write(text))          # run_time defaults to 1
 *       wait()                     # 1
 *       play(UnWrite(text))        # 1
 *
 * `Text` defaults to height 50 (object.py:876) and pydeation's scene
 * text pipeline wraps every letter as its own spline with
 * `clipping = "inside"`, which is what Write's per-letter domino runs
 * over. In DreamTalk that cascade is two params — `creation` and
 * `erasure` — and the domino lives in the glyph shader plus the traced
 * contours beside it (parts/text.ts, parts/outline.ts, render/text.ts).
 * Write is `creation` 0 → 1; UnWrite is NOT that reversed but a second
 * forward front, `erasure` 0 → 1, because pydeation's UnWrite is its own
 * Domino over the same letter order — and the reference erases
 * "trans-perspectival" from its FIRST letter (f0588 has lost the `t`
 * while `rspectival` still stands).
 *
 * This is the only scene in the video the framework renders through the
 * orthographic camera. It is also, in the end, the scene that showed
 * that camera to be right: no dolly, no fudge, `orthographic = true` at
 * the framework's own zoom of 1, and "trans-perspectival" at size 50
 * lands on f0583's columns 395-884 and rows 315-373 — the reference's
 * own extents, to the pixel horizontally and to one pixel vertically.
 */

import { Dream, render } from "../../src/index"
import { Text, Write, UnWrite } from "../../src/parts/text"
import { WHITE, STROKE_MAIN } from "./palette"

/**
 * The measured scene-start offset, in the gauntlet's localT = videoSec −
 * 114.5 frame.
 *
 * The ledger's 114.5 boundary is a division of the audio sums, not a
 * measured cut — nothing is lit anywhere between video 113.0 and 115.3,
 * so the boundary was never observable there. The animation itself is.
 * Decoding the source mkv to 30fps and anchoring the sequence on
 * frames5/f0578 (video 115.6, 1829 lit pixels — the one frame both
 * samplings agree on exactly), the first lit pixel arrives at 115.367
 * and the last leaves at 118.333: a 3.0s span, exactly the source's
 * 1 + 1 + 1. So the write begins at video 115.35 and the scene's own
 * t = 0, the head of its `wait(5/2)`, sits at 112.85.
 *
 * 112.85 − 114.5 = −1.65: the scene starts well BEFORE the span the
 * gauntlet scores, so the leading wait is negative and the source's
 * run_times stay verbatim. Nothing is lit at a negative t (the timeline
 * holds pre-first-segment values), which is exactly the black the
 * reference shows there.
 *
 * The measurement is worth stating precisely because the whole
 * per-letter cascade rides on it: with T0 = 115.35 the eighteen letters'
 * ink onsets in the reference land within 0.015 of the domino windows
 * writeWindows(18) deals, and their solid-ink completions within 0.03 of
 * those windows' draw ends. Nothing about the choreography needed
 * fitting — a seek-inaccurate first decode had put T0 at 115.42 and made
 * the same cascade look 0.07s late everywhere, and correcting the
 * DECODE, not the timing, is what brought it into line.
 *
 * −1.67 rather than the −1.65 the frame counts give: swept at 0.01s
 * across the whole span at step 1 (−1.65 / −1.66 / −1.67 / −1.68 /
 * −1.69 → 12 / 13 / 13 / 12 / 12 of 15 frames passing, mean coverage_ref
 * 0.927 / 0.949 / 0.961 / 0.972 / 0.967), −1.67 and −1.68 are the two
 * candidates and only −1.67 carries every scored frame. The 20ms is
 * inside the ±1/60s a 30fps decode can resolve, so this is the
 * measurement refined, not overridden.
 */
const START_OFFSET = -1.67

export class S07Dream extends Dream {
  // Text("trans-perspectival") — height 50, centered on the origin
  // (PRIM_TEXT_ALIGN = 1), white, TEXT_THICKNESS 5 — which the traced
  // contours render at, in the same pixel-unit mapping every other
  // video-01 stroke uses (palette.ts).
  word = new Text({ content: "trans-perspectival", size: 50, tint: WHITE, stroke: STROKE_MAIN })

  unfold() {
    // TwoDScene: C4D's parallel TOP view at camera_zoom 1 — the observer
    // looking straight at the scene plane, orthographic (camera.py:53-62).
    this.observer.orthographic.value = true
    this.observer.orthographic.defaultValue = true
    this.wait(START_OFFSET)
    this.wait(5 / 2)
    this.play(Write(this.word), 1)
    this.wait(1)
    this.play(UnWrite(this.word), 1)
  }
}

if (import.meta.main) render(S07Dream)
