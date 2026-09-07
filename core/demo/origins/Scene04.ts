/**
 * Scene04.ts — A DreamWeaving
 *
 * "The Origins of Project Liminality" (2024), Scene 04 — the pie again,
 * coloured, and running backwards.
 *
 * Scene02's disc, rebuilt with its colours already in it and its pieces
 * already flung apart. Three coloured ring segments draw themselves out
 * near the edges of the frame and flood solid; arrows reach in toward
 * the empty centre; and then the pieces COLLAPSE back to where they came
 * from while everything fades. Where Scene02 was centrifugal — a whole
 * coming apart under pressure — this is the same gesture reversed, and
 * the video puts them twenty-five seconds apart so the rhyme lands.
 *
 * Source (refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py:249-300):
 *
 *   CONFIG = camera_perspective "front", camera_zoom 3/4
 *   offset = 170
 *   anchor1..3 = CObject(x=offset)
 *   segment1 = Arc(mode="ring", x=120, angle=2*PI/3, symmetrical=True, color=GREEN)
 *   segment2 = … color=BLUE
 *   segment3 = … color=RED
 *   slice1 = Group(segment1, anchor1, h=PI/2)
 *   slice2 = Group(segment2, anchor2, h=2*PI/3 + PI/2)
 *   slice3 = Group(segment3, anchor3, h=4*PI/3 + PI/2)
 *   pie = Group(slice1, slice2, slice3)
 *   vector1..3 = Connection((0,0,0), anchorN, unpack_group=False, reverse=True)
 *   force = Group(vector1, vector2, vector3)
 *   self.audio(…, offset=125)
 *   self.add(pie, force)
 *   self.wait(2)
 *   self.play(DrawThenFillCompletely(pie), run_time=3)
 *   self.wait(2)
 *   self.play(Create(force), run_time=4)
 *   self.play(Transform(segmentN, anchorN, x=0, relative=False),
 *             FadeOut(force, rel_start_point=2/3),
 *             FadeOut(pie),
 *             UnFill(pie),
 *             run_time=3)
 *   self.play(UnFillThenUnDraw(pie), run_time=3)
 *
 *
 * THE SAME CONSTRUCTION, THREE PARAMETERS LATER
 *
 * Scene02 and Scene04 are the same pie. The `Slice` holon, the three
 * headings, the ring's two radii and the reading that pydeation's `h` is
 * our `b` are all derived in Scene02.ts and imported here; what this
 * scene changes is exactly what the source changes:
 *
 *   the segments start at x=120     — already flung, not yet flying
 *   the anchors sit at x=170        — further out than Scene02's 50
 *   the colours are baked in        — no ChangeColor anywhere
 *   the vectors are reverse=True    — arrowheads pointing INWARD
 *
 * `reverse=True` reverses the traced spline's direction
 * (refs/pydeation-legacy/object/mograph.py:99-116, passed through to the
 * Tracer), which moves the arrowhead from the anchor end to the origin
 * end. Core's `Connection` puts its head at the TARGET, so the reversal
 * is spelled by swapping the two endpoints: `Connection(anchor, origin)`
 * draws the same curve with the head at the centre. Confirmed on
 * f_00660, where all three heads sit inboard, pointing at the origin.
 *
 *
 * THE COLLAPSE — AND THE TWO VERBS THE REFERENCE DOES NOT SHOW
 *
 * The third play is the scene, and it names four things:
 *
 *   Transform(…, x=0, relative=False)   the pieces come home. `relative`
 *                                       is FALSE here — an absolute
 *                                       destination, not an offset, so
 *                                       this is `.to(0)` where Scene02's
 *                                       partings were `.by(…)`.
 *   FadeOut(force, rel_start_point=2/3) the arrows only start fading at
 *                                       the two-second mark, so they are
 *                                       still visible for most of the
 *                                       collapse they are supposedly
 *                                       causing.
 *   FadeOut(pie)                        }  named in the source,
 *   UnFill(pie)                         }  ABSENT from the render.
 *
 * The last two are dropped here, and that is a reading of the reference,
 * not a liberty. If the pie faded and drained across this span it would
 * arrive home invisible; instead refs/pitch/origins/frames5 shows it
 * arriving home FULLY LIT and holding that way for nearly two seconds:
 *
 *   t (video−125)   12.2    13.0    13.8    14.6    15.4    16.2
 *   lit px         93247   92180   89873   87577   87577   87577
 *   total luma     13.52M  13.15M  13.02M  12.80M  12.80M  12.80M
 *
 * A `FadeOut` over 11.35–14.35 would drive that curve to zero by 14.6.
 * It plateaus instead, and the drain does not begin until 16.3 — where
 * the FOURTH play's `UnFillThenUnDraw` puts it. Scoring both readings
 * settles it: with the two verbs in, f_00694 through f_00704 all FAIL
 * (cov_ref 0.17 and below — we are dark where the reference is solid);
 * with them out, all six PASS at a chamfer of 0.04px.
 *
 * The likely mechanism is a real bug in the 2021 grammar rather than
 * anything about these verbs. `Animator.flatten_input`'s inner recursion
 * is declared `flatten_recursion(*cobjects, transform_group_object=False,
 * flattened_cobjects=[])` (animator.py:34) — a MUTABLE DEFAULT ARGUMENT,
 * which in Python is created once per function definition and shared by
 * every call for the life of the process. By the fourth play of the
 * fourth scene that list has accumulated every object ever flattened, so
 * what a late animator actually targets is not what it was handed. The
 * exact consequence is not worth reconstructing; the reference is the
 * authority, and the reference is unambiguous.
 *
 *
 * THE FOURTH PLAY IS NOT IN THE VIDEO EITHER — IT IS A CUT
 *
 * The source's last play is `UnFillThenUnDraw(pie), run_time=3`, which
 * from 14.35 would drain the wash over (0, 0.6) and retract the outline
 * over (0.5, 1). The reference does neither. Measured over the closing
 * two seconds (lit = pixels above the scorer's own 32/255 threshold,
 * luma = total frame luminance, both on frames5):
 *
 *   t      15.8    16.0    16.2    16.4    16.6    16.8    17.0    17.2    17.4
 *   lit   88064   88064   88064   88060   87995   87874   87673   87050       0
 *   luma  1.000   1.000   1.000   0.982   0.927   0.812   0.628   0.368   0.052
 *
 * The lit-pixel count does not move — 88064 to 87050 across the whole
 * decay, a 1% drift that is the encode alone — while the luminance falls
 * to nothing. NO GEOMETRY LEAVES. An UnFill would empty the wash and
 * leave the outline, dropping `lit` by the ~80k pixels of interior; an
 * UnDraw would retract the outline, dropping it the rest of the way.
 * Neither happens: every pixel that was lit at 15.8 is still lit at 17.2,
 * only dimmer. That is a FADE OF THE WHOLE IMAGE, and at 17.4 it is
 * simply gone — the shot is CUT.
 *
 * So this scene ends on the published edit's cross-fade, not on the
 * script's verb, and PLAN.md's standing policy for the campaign settles
 * which one this reproduction owes: "first half frame-exact vs frames5;
 * from Scene06 vs source choreography (published video is a re-cut)."
 * Scene04 is in the first half. The video is the authority here, and the
 * video holds the reassembled disc until 16.3 and then fades it out over
 * 16.3-17.45.
 *
 * The hold is therefore extended to meet 16.3 and the close is spelled
 * as what it measurably is — `FadeOut` of everything, over the 1.15s the
 * curve above takes to reach zero. `UnFillThenUnDraw` is dropped for the
 * same reason `FadeOut(pie)` and `UnFill(pie)` were dropped from the
 * third play: it is named in the source and absent from the render.
 */

import { Dream, render } from "../../src/index"
import { Group, Null } from "../../src/parts/primitives"
import { Connection } from "../../src/parts/curves"
import { Create, DrawThenFillCompletely, FadeOut } from "../../src/verbs"
import { together } from "../../src/anim"
import { BLUE, GREEN, RED, WHITE } from "../../src/constants"
import { STROKE_MAIN } from "../video01/palette"
import { SLICE_HEADINGS, Slice } from "./Scene02"

/**
 * The head between the audio cue (offset=125) and the scene's first
 * frame. Fitted by sweeping the same two curves Scene02's offset was
 * fitted against — lit-pixel count through the draw, total luminance
 * through the flood — over f_00638 to f_00650, each half fitted on its
 * own so the two can be seen to agree:
 *
 *   offset          0.10   0.20   0.24   0.30   0.35   0.40   0.50
 *   draw   sse      .118   .076   .065   .041   .026   .018   .006
 *   flood  sse      .026   .011   .006   .002   .003   .008   .022
 *
 * The draw half keeps improving past where the flood half turns, which
 * is the first-ink bias in the open: the draw curve is a count of pixels
 * ABOVE a threshold, so it registers late by a frame or so and asks for
 * a later start than the truth. The flood half has no such bias — it is
 * a mean over a region that is already lit — so its minimum at 0.30 is
 * the better estimate, and 0.35 is taken as the midpoint of the two.
 * Scored head to head across fifteen frames, 0.35 and 0.45 both give
 * 11/15 PASS and 0.35 has the better mean coverage (0.889 vs 0.865).
 *
 * The source's own `wait(2)` sits inside the video's 3.4-second black
 * gap at 124.8-128.0s (report §0), so this offset is on top of that
 * wait, not instead of it.
 *
 * ONE DIVERGENCE THIS OFFSET CANNOT FIX. The reference holds the
 * reassembled disc until t=16.3 and fades it over 16.3-17.5; the
 * source's script puts that fade at 14.35-17.35. No single offset
 * reconciles them, because the video's hold is about a second longer
 * than the script's — this is the published re-cut, the same editing
 * the report documents from Scene06 on, reaching one scene earlier than
 * expected. The scene is left at the source's timing (the last two
 * frames, f_00708 and f_00710, fail for it) rather than fitted to the
 * cut, because the source is what this chapter reproduces.
 */
const START_OFFSET = 0.35

export class Scene04Dream extends Dream {
  // The same three slices as Scene02, at the same three headings. What
  // differs: the segment starts already flung to x=120, the anchor sits
  // at 170 rather than 50, and the colour is stated at construction
  // instead of animated in later.
  slice1 = new Slice({ b: SLICE_HEADINGS[0], segmentX: 120, anchorX: 170, segmentTint: GREEN })
  slice2 = new Slice({ b: SLICE_HEADINGS[1], segmentX: 120, anchorX: 170, segmentTint: BLUE })
  slice3 = new Slice({ b: SLICE_HEADINGS[2], segmentX: 120, anchorX: 170, segmentTint: RED })
  pie = new Group({ members: [this.slice1, this.slice2, this.slice3] })

  private origin = new Null()
  // Connection(…, reverse=True): the head at the ORIGIN, not the anchor.
  // Core's Connection heads its target, so the endpoints are swapped.
  vector1 = new Connection(this.slice1.anchor, this.origin, { tint: WHITE, stroke: STROKE_MAIN })
  vector2 = new Connection(this.slice2.anchor, this.origin, { tint: WHITE, stroke: STROKE_MAIN })
  vector3 = new Connection(this.slice3.anchor, this.origin, { tint: WHITE, stroke: STROKE_MAIN })
  force = new Group({ members: [this.vector1, this.vector2, this.vector3] })


  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(3 / 4))
    this.stage(this.origin)

    this.wait(START_OFFSET)
    this.wait(2)
    this.play(DrawThenFillCompletely(this.pie), 3)
    this.wait(2)
    this.play(Create(this.force), 4)
    // The collapse. `relative=False` makes the destination absolute, so
    // these are `.to(0)` — the pieces and their anchors return to the
    // slice's own origin, which is the disc's centre.
    this.play(
      together(
        this.slice1.segment.x.to(0),
        this.slice1.anchor.x.to(0),
        this.slice2.segment.x.to(0),
        this.slice2.anchor.x.to(0),
        this.slice3.segment.x.to(0),
        this.slice3.anchor.x.to(0),
        [FadeOut(this.force), 2 / 3, 1],
      ),
      3,
    )
    // The published cut (see the header). The disc arrives home at 14.35
    // and the reference holds it, fully lit and unmoving, until 16.3 —
    // then the whole image fades to black over 1.15s with no geometry
    // leaving. Not the source's UnFillThenUnDraw: that verb is named in
    // the script and absent from the render.
    this.wait(16.3 - 14.35)
    this.play(together(FadeOut(this.pie), FadeOut(this.force)), 1.15)
  }
}

if (import.meta.main) render(Scene04Dream)
