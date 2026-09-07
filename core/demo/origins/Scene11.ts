/**
 * Scene11.ts — A DreamWeaving
 *
 * "The Origins of Project Liminality" (2024), Scene 11 — the return.
 *
 * Scene01's graph, five and a half minutes later, entered already drawn.
 * The two triads take their colours; the nodes flood solid and the three
 * surviving edge groups fade up; and then — the whole point of the video
 * in one two-second beat — THE EIGHTEEN EDGES THAT WERE DELETED COME
 * BACK. Every relationship that crossed the divide, and that Scene01
 * un-drew to make its split, is simply re-created. The split is healed;
 * the colours stay. Then it all fades and the film goes to its logo.
 *
 * Source (refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py:988-1069).
 * The construction is Scene01's, verbatim — the same seven circles, the
 * same 42 edges, the same four hand-picked index lists — and lives in
 * ./KinshipGraph.ts, which is where that identity is documented. What
 * this file owns is the eleven-line play.
 *
 *   CONFIG = camera_perspective "front", camera_zoom 1
 *   self.audio(…, offset=419)
 *   self.add(relationships, relatives)
 *   self.play(ChangeColor(relationships_left,  relatives_left,  color=BLUE),
 *             ChangeColor(relationships_right, relatives_right, color=RED))
 *   self.play(Fill(relatives, solid=True),
 *             FadeIn(relationships_right, relationships_left,
 *                    relationships_middle), run_time=4)
 *   self.wait(2)
 *   self.play(Create(relationships_remaining), run_time=2)
 *   self.wait()
 *   self.play(FadeOut(relationships), UnFill(relatives))
 *   self.wait()
 *
 * Twelve seconds as written.
 *
 *
 * A CORRECTION TO THE VOCABULARY REPORT'S §0 TABLE
 *
 * The report lists Scene11 at `offset=405` and calls 419 "(end)". The
 * source says otherwise: the audio call at pitch.py:973 belongs to
 * **Scene10** (`class Scene10` opens at :939) and carries offset 405,
 * and the call at :1055 is **Scene11**'s (`class Scene11` opens at :988)
 * with offset 419. There is no "(end)" scene. So Scene11's cue is 419,
 * and 429.7 − 419 = 10.7s of narration remains after it — which matches
 * a 12s scene running past the end of the track, and matches the video.
 *
 *
 * WHERE IT SITS IN THE PUBLISHED VIDEO, AND WHAT WAS RE-CUT
 *
 * Measured on refs/pitch/origins/frames5 (32×18 grayscale mean, plus a
 * full-resolution count of pixels above the scorer's 32/255 threshold):
 *
 *   video     mean     lit     reading
 *   360.0-360.8  0.000      0   the black gap before the scene
 *   361.0        0.0017   145   first ink
 *   361.2        0.0044  8690   the graph arrives, ALREADY COLOURED
 *   361.6        0.0089 26269   fill under way
 *   363.8        0.0193 27000+  fill complete, edges up — and it HOLDS
 *   367.2        0.0198 29656   the eighteen begin to return
 *   368.8        0.0293 40154   all 42 edges present — the healed graph
 *   370.2        0.0289 40011   the fade begins
 *   371.0        0.000      0   gone
 *
 * So the scene occupies video 361.0–371.0 — TEN seconds, against the
 * source's twelve. Laid against the source's own beats (localT from
 * 361.0):
 *
 *   beat                    source     measured
 *   ChangeColor              0 → 1      absent — arrives coloured
 *   Fill + FadeIn            1 → 5      0.6 → 2.8
 *   hold                     5 → 7      2.8 → 6.2
 *   Create(remaining)        7 → 9      6.2 → 7.8
 *   hold                     9 → 10     7.8 → 9.2
 *   FadeOut + UnFill        10 → 11     9.2 → 10.0
 *
 * The back half is uniformly about 0.9s early and otherwise the source's
 * own pace (a 1.6s return against a written 2s, a 0.8s fade against 1s).
 * The FRONT is where the two seconds went: the editor trimmed the
 * `ChangeColor` beat entirely and shortened the flood, so the scene
 * opens on a graph that is already blue and red.
 *
 * PLAN.md's standing policy settles which to reproduce: "from Scene06 vs
 * source choreography (published video is a re-cut)". Scene11 is deep in
 * the re-cut half, so the SOURCE's twelve seconds are what this file
 * states — verbatim, including the ChangeColor beat the edit dropped —
 * and the scoring compares APPEARANCE against the frames rather than
 * demanding a frame-exact fit that the published edit makes impossible.
 * The one concession to the edit is START_OFFSET, which aligns the beat
 * the two agree on best (see below).
 *
 *
 * FRAMING (front, zoom 1) — identical to Scene01, and confirmed again
 * here: on f_01845 the left node's centre reads x = 385 against a
 * predicted 640 − 200·1.28 = 384, and the upper nodes at y = 138 / 582
 * against a predicted 360 ∓ 173.21·1.28 = 138 / 582.
 */

import { Dream, render } from "../../src/index"
import { ChangeColor, Create, FadeIn, FadeOut, Fill, UnCreate, UnFill } from "../../src/verbs"
import { together } from "../../src/anim"
import { BLUE, RED } from "../../src/constants"
import { kinshipGraph } from "./KinshipGraph"

/**
 * The head between the audio cue (offset=419, which the scorer takes as
 * localT 0) and the scene's first frame.
 *
 * Unlike the first-half scenes this one cannot be swept to a frame-exact
 * fit, because the published edit removed a beat the source states (see
 * the header). It is set to 0 — the source's own first frame IS the
 * scene's first frame — and the scoring aligns the reproduction's localT
 * against the video by the beat the two share: the return of the
 * eighteen edges, which the source puts at 7.0 and the video at 6.2.
 * That 0.8s difference is the edit, not an offset, and burying it in a
 * fitted head would misreport a cut as a lag.
 */
const START_OFFSET = 0

export class Scene11Dream extends Dream {
  private graph = kinshipGraph()

  relatives = this.graph.relatives
  relativesLeft = this.graph.relativesLeft
  relativesRight = this.graph.relativesRight
  relationships = this.graph.relationships
  relationshipsLeft = this.graph.relationshipsLeft
  relationshipsRight = this.graph.relationshipsRight
  relationshipsMiddle = this.graph.relationshipsMiddle
  relationshipsRemaining = this.graph.relationshipsRemaining

  unfold() {
    // CONFIG camera_perspective "front", camera_zoom 1.
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))

    this.stage(this.relatives)
    this.stage(this.relationships)

    // "entered already-drawn" — the source `add`s the graph with no
    // Create, so every stroke is complete at t=0. What is NOT yet true:
    // the nodes are unfilled, the three surviving edge groups are dark,
    // and the eighteen crossing edges are absent, waiting to be made.
    this.set(
      UnFill(this.relatives),
      FadeOut(this.relationshipsLeft),
      FadeOut(this.relationshipsRight),
      FadeOut(this.relationshipsMiddle),
      // The eighteen crossing edges start UNDRAWN — they are what
      // Scene01 took away, and `Create(relationships_remaining)` at
      // localT 7 is the film putting them back.
      UnCreate(this.relationshipsRemaining),
    )

    this.wait(START_OFFSET)

    // The two triads take their sides. One second, the default run_time.
    this.play(
      together(
        ChangeColor(this.relationshipsLeft, BLUE),
        ChangeColor(this.relativesLeft, BLUE),
        ChangeColor(this.relationshipsRight, RED),
        ChangeColor(this.relativesRight, RED),
      ),
      1,
    )
    // The nodes flood solid while the surviving edges come up out of the
    // dark. Four seconds.
    this.play(
      together(
        Fill(this.relatives, { solid: true }),
        FadeIn(this.relationshipsRight),
        FadeIn(this.relationshipsLeft),
        FadeIn(this.relationshipsMiddle),
      ),
      4,
    )
    this.wait(2)
    // THE HEALING: the eighteen edges that crossed the divide, drawn
    // back on. Two seconds, and the argument of the film is finished.
    this.play(Create(this.relationshipsRemaining), 2)
    this.wait(1)
    this.play(together(FadeOut(this.relationships), UnFill(this.relatives)), 1)
    this.wait(1)
  }
}

if (import.meta.main) render(Scene11Dream)
