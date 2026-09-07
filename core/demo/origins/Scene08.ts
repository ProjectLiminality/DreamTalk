/**
 * Scene08.ts — A DreamWeaving
 *
 * "The Origins of Project Liminality" (2024), Scene 08 — what the thing
 * is for.
 *
 * The mark has just been given its name (Scene05) and its own long look
 * (Scene09, which the re-cut moves after this). Here it is made small
 * and put at the bottom of the frame, and four applications reach up out
 * of it in narration order — peer-to-peer education, de-escalating the
 * culture war, sense-making, incubating ideas. Each is an arrow and a
 * two-line label, drawn as the narrator names it, with long holds
 * between so the voice can do the work. Then all four labels are taken
 * away, the arrows fade, and the mark is un-drawn alone.
 *
 * Source (refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py:697-750):
 *
 *   CONFIG = camera_perspective "front", camera_zoom 1
 *   logo = Logo(z=-150, scale=1/4)
 *   p2p_education  = self.text(Text("p2p education\nsystem", z=50,  x=-300, height=20))
 *   link1 = Connection(logo, (-300, 0, 50),  offset_start=0.2, offset_end=0.2)
 *   sense_making   = self.text(Text("sense-making\nplatform", z=150, x=-100, height=20))
 *   link2 = Connection(logo, (-100, 0, 150), offset_start=0.2, offset_end=0.2)
 *   culture_war    = self.text(Text("de-escalate\nculture war", z=50,  x=300, height=20))
 *   link3 = Connection(logo, (300, 0, 50),   offset_start=0.2, offset_end=0.2)
 *   idea_incubator = self.text(Text("idea\nincubator", z=150, x=100, height=20))
 *   link4 = Connection(logo, (100, 0, 150),  offset_start=0.2, offset_end=0.2)
 *   frame = Rectangle(height=70, width=160, z=45, x=-300)
 *   self.audio(…, offset=303)
 *   self.add(logo, link1, link2, link3, link4, frame)
 *   self.play(Create(logo), run_time=2)
 *   self.play(Create(p2p_education, link1), run_time=1)
 *   self.wait(4)
 *   self.play(Create(culture_war, link3), run_time=1)
 *   self.wait(2)
 *   self.play(Create(sense_making, link2), run_time=1)
 *   self.wait(4)
 *   self.play(Create(idea_incubator, link4), run_time=1)
 *   self.wait(3)
 *   self.play(UnCreate(idea_incubator, culture_war, sense_making, p2p_education),
 *             FadeOut(link1, link2, link3, link4, rel_end_point=2/3), run_time=4)
 *   self.wait(2)
 *   self.play(UnCreate(logo), run_time=3)
 *
 *
 * THE RECTANGLE THAT ISN'T THERE
 *
 * The source declares `frame = Rectangle(height=70, width=160, z=45,
 * x=-300)` and adds it to the scene — a box that would sit exactly
 * around the "p2p education system" label. It is NOT in the video.
 *
 * It never draws, and that is not a re-cut casualty: pydeation's objects
 * are born with `show=False, completion=0` (object.py:90) and become
 * visible only when an animator drives them. `frame` is added and never
 * played, so it stays at completion 0 for the whole scene. Checked
 * against the reference at the moments it would be most visible — the
 * label's own beat (f_01480, t=296.0), the four-label tableau (f_01545,
 * t=309.0) — there is no box, and the white ink counts hold flat across
 * the label's arrival at exactly the value four text lines and one arrow
 * account for.
 *
 * So it is reproduced by NOT being reproduced. It is declared here as a
 * comment rather than as a dead holon, because a Rectangle with no verb
 * pointed at it would be a silent invitation for a later reader to
 * "fix" the scene by drawing it. This note is the fix.
 *
 *
 * THE ORDER IS NOT THE READING ORDER
 *
 * The four labels are constructed in the source in the order
 * p2p / sense-making / culture-war / idea-incubator, but PLAYED in the
 * order p2p / culture-war / sense-making / idea-incubator — the two
 * middle ones swap. That is the narration's order, not the layout's,
 * and the video confirms it: at f_01515 (t=303.0) "p2p education
 * system" and "de-escalate culture war" both stand complete while
 * "sense-making platform" is caught mid-write, showing only "sens" with
 * its arrow half-drawn. The playing order is what this file follows;
 * the declaration order is preserved in the field order below so the
 * two can be read against each other.
 *
 * The layout is a fan, and reads outward from the mark at bottom centre:
 *
 *              sense-making        idea
 *                platform        incubator     (z=150 → our y=150)
 *   p2p education                      de-escalate
 *      system                          culture war  (z=50 → our y=50)
 *                     ◯ Logo                     (z=-150 → our y=-150)
 *
 * with x = −300 / −100 / +100 / +300. pydeation's out-of-plane y is our
 * z and its z is our y (the convention S09/Scene05 state and this scene
 * inherits), so every source `z` here is a height in our XY plane and
 * the `(x, 0, z)` endpoint tuples become `(x, z)` points at z = 0.
 *
 *
 * THE CONNECTION ENDPOINTS ARE WORLD NULLS
 *
 * `Connection(logo, (-300, 0, 50))` — a tuple endpoint is converted by
 * pydeation into `CObject(x=x, y=y, z=z)`, a null at those WORLD
 * coordinates with no parent (mograph.py:97-113). It is not relative to
 * the logo, and it is not `local=True` (which Scene01's sight-lines DO
 * pass and this scene does not). So each spoke runs from the mark's
 * centre to a fixed point in the frame, and core states that as a
 * `Null` at the same place.
 *
 * `offset_end` is likewise a trim, not a position: the loader passes
 * `stroke_offset_end = 1 - offset_end`, so pydeation's `offset_end=0.2`
 * means "stop a fifth short of the target". Core's `offsetEnd` already
 * carries that sense (`trimByArcLength(pts, offsetStart, offsetEnd)`
 * in parts/curves.ts), so both 0.2s go straight across. The visible
 * result is the gap the reference shows at both ends of every arrow —
 * clear of the logo's rim at one end, short of the text at the other.
 *
 *
 * THE TIMELINE — A PURE TRANSLATION, LIKE Scene07_1's
 *
 * The source declares `offset=303`. The scene does not start there: it
 * runs 292.8 to 320.6 in the published video, ten seconds AHEAD of its
 * audio cue — the same displacement, to within a tenth of a second,
 * that O-7 measured for Scene07_1 (−10.3). The re-cut is a translation
 * here too, and nothing inside the scene is re-timed.
 *
 * Measured off frames5 at 5fps (total ink, and white ink separated from
 * the logo's blue and red), against the source's own cumulative times:
 *
 *   video  beat                                  source localT
 *   293.2  blue appears — Create(logo) begins            0.0
 *   293.8  the red small circle blooms                   1.5
 *   295.8  white plateaus: logo done, label 1 done       3.0
 *   300.8  label 2 "de-escalate culture war" complete    8.0
 *   303.8  label 3 "sense-making platform" complete     11.0
 *   308.8  label 4 "idea incubator" complete            16.0
 *   320.6  black                                        28.0
 *
 * Six landmarks at the declared intervals — 292.8 + 3, + 8, + 11, + 16,
 * + 28 lands on 295.8, 300.8, 303.8, 308.8, 320.8 against measured
 * 295.8, 300.8, 303.8, 308.8, 320.6. Nothing inside the scene is
 * fitted, so START_OFFSET stays 0 and the whole correction lives in the
 * gauntlet's t0, exactly as Scene07_1's does.
 *
 *
 * WHERE Scene08_1 AND Scene08_2 WENT
 *
 * They are not in the video. The source has three more scenes between
 * this one and Scene09 — Scene08_1 (the lattice flythrough, offset 326)
 * and Scene08_2 (this scene's tableau re-entered mid-flight, offset
 * 369) — and neither survives the edit. Every segment from 292.6s to
 * the end of the video is accounted for by content:
 *
 *   292.8–320.6  Scene08   (this scene)
 *   323.2–345.8  Scene09   (the slow logo — O-3's t0 320.85)
 *   345.8–360.0  Scene10   (big tech — Scene10.ts)
 *   361.2–371.0  Scene11   (the healed graph)
 *   372.2–end    the closing title
 *
 * with no window left for either. That is where the missing ~52s
 * between the 429.7s narration and the 377.9s video went, and it is why
 * the vocabulary report's 10.6s black gap at 315–325.4 looks like "the
 * scene most disturbed by the re-cut": the gap is this scene's tail
 * plus the cut itself.
 *
 * The consequence for reproduction is that Scene08_2 has no reference
 * frames and cannot be scored. It is therefore NOT built — a scene
 * whose only possible verification is "it matches the source text" adds
 * a file and no evidence. Its construction is this scene's, re-entered
 * with the camera pushed in at zoom 100 and pulled back to 1000 over
 * two plays; the rig mapping that would express it is derived in
 * Scene10.ts, where there IS footage to check it against.
 *
 *
 * THE SCORES — AND THE ONE DEFECT, WHICH IS NOT THIS SCENE'S
 *
 * At 1s steps across the whole scene: **11/28 PASS, mean coverage 0.964
 * (ref) / 0.910 (ours)**. Densely across the label beats (299.6-304.2 at
 * 0.2s): 16/24, mean 0.960 / 0.899.
 *
 * Those aggregates are held down by a single defect, and it is in the
 * text renderer rather than in anything this scene states. Split the
 * scene by whether text is on screen and it separates completely:
 *
 *   316.0-320.0, no text on screen     **11/11 PASS, mean cov_ref
 *                                      1.0000**, cov_ours 0.9981
 *   293.0-295.6, the logo building     13/14 PASS, mean 0.963 / 0.985
 *   any frame with a two-line label    cov_ours pinned at 0.89-0.91
 *
 * Every frame without text is exact — the logo, all four spokes, their
 * 0.2 trims, the arrowheads, the fade windows and the un-draw. Every
 * frame with text loses the same ~10% of OUR ink, and the composites
 * say why: **the second line of each label is left-aligned to the first
 * instead of being centred under it.**
 *
 * Measured at f_01545 (t=309.0), our render against the reference:
 *
 *   label            line   ours cx   ref cx   ours x0   ref x0
 *   idea/incubator     1      739.0    768.0      713      745
 *                      2      767.5    768.0      713      716
 *   p2p ed./system     1      255.5    256.0      174      177
 *                      2      216.0    256.0      174      217
 *
 * In both, the LONGER line is centred to within half a pixel and the
 * SHORTER line starts at the longer one's left edge. "de-escalate /
 * culture war", whose two lines are nearly the same width, is barely
 * affected; "idea / incubator", the most unequal pair, is worst. The
 * block as a whole is centred correctly — only the lines within it are
 * not.
 *
 * The cause is in render/text.ts: `layoutText` passes
 * `layout: { align: "center" }` to three-text, but three-text's
 * paragraph alignment centres lines within a `width`, and no width is
 * given — so with no measure to centre against, the lines stack at a
 * common left origin, and the block-level re-centring that follows
 * (`geometry.translate(-(box.min.x + box.max.x) / 2, 0, 0)`) then
 * centres the whole stack rather than fixing the lines. Single-line
 * text, which is every scene before this one, is unaffected, which is
 * why the corpus has not met this until now.
 *
 * It is not fixed here: render/** is outside this chapter's lane. The
 * scores above are reported with the defect in rather than around it.
 */

import { Dream, render } from "../../src/index"
import { Create, UnCreate, FadeOut } from "../../src/verbs"
import { Text } from "../../src/parts/text"
import { Null } from "../../src/parts/primitives"
import { Connection } from "../../src/parts/curves"
import { Logo } from "../../vocabulary/Logo/Logo"
import { together, restage } from "../../src/anim"
import { STROKE_MAIN } from "../video01/palette"

/**
 * Zero, and not fitted — the same finding as Scene07_1's.
 *
 * The six landmarks tabulated in the header land on the source's own
 * cumulative times to within the 0.2s the 5fps sampling grid can
 * resolve, so there is no sub-second lead-in to fit. The correction
 * this scene needs is the SCENE START, which the re-cut moved 10.2s
 * ahead of `offset=303` to 292.8, and that lives in the gauntlet's t0.
 * The constant is kept here at 0 to say so out loud rather than by
 * being absent.
 */
const START_OFFSET = 0

/** `height=20` on all four labels — the 2021 font size. */
const LABEL_SIZE = 20

/**
 * `Connection(logo, …, offset_start=0.2, offset_end=0.2)` on all four.
 * Both ends are trimmed by a fifth, which is the gap the reference
 * shows between each arrow and the two things it joins.
 */
const SPOKE_TRIM = 0.2

export class Scene08Dream extends Dream {
  // Logo(z=-150, scale=1/4) — the mark made small and set low, leaving
  // the upper two thirds of the frame for what it is for. pydeation's
  // z is our y, so z=-150 is 150 units DOWN.
  logo = new Logo({ y: -150, scale: 1 / 4, stroke: STROKE_MAIN })

  // The four labels, in the source's DECLARATION order (the playing
  // order is the narration's and differs — see the header). Text is
  // centred on its anchor in both, and `\n` splits the two lines.
  p2pEducation = new Text({
    content: "p2p education\nsystem",
    x: -300,
    y: 50,
    size: LABEL_SIZE,
  })
  senseMaking = new Text({
    content: "sense-making\nplatform",
    x: -100,
    y: 150,
    size: LABEL_SIZE,
  })
  cultureWar = new Text({
    content: "de-escalate\nculture war",
    x: 300,
    y: 50,
    size: LABEL_SIZE,
  })
  ideaIncubator = new Text({
    content: "idea\nincubator",
    x: 100,
    y: 150,
    size: LABEL_SIZE,
  })

  // The four tuple endpoints, as the nulls pydeation makes of them.
  // World positions, not logo-relative: `(x, 0, z)` → our `(x, z)`.
  target1 = new Null({ x: -300, y: 50 })
  target2 = new Null({ x: -100, y: 150 })
  target3 = new Null({ x: 300, y: 50 })
  target4 = new Null({ x: 100, y: 150 })

  // The spokes. Source → target is logo → label, so the arrowhead
  // (Connection's default `arrow_end=True`) lands at the label end,
  // which is where the reference puts every one of them.
  link1 = new Connection(this.logo, this.target1, {
    offsetStart: SPOKE_TRIM,
    offsetEnd: SPOKE_TRIM,
    stroke: STROKE_MAIN,
  })
  link2 = new Connection(this.logo, this.target2, {
    offsetStart: SPOKE_TRIM,
    offsetEnd: SPOKE_TRIM,
    stroke: STROKE_MAIN,
  })
  link3 = new Connection(this.logo, this.target3, {
    offsetStart: SPOKE_TRIM,
    offsetEnd: SPOKE_TRIM,
    stroke: STROKE_MAIN,
  })
  link4 = new Connection(this.logo, this.target4, {
    offsetStart: SPOKE_TRIM,
    offsetEnd: SPOKE_TRIM,
    stroke: STROKE_MAIN,
  })

  // `frame = Rectangle(height=70, width=160, z=45, x=-300)` is declared
  // in the source and never played, so it never becomes visible. It is
  // deliberately absent here; see "THE RECTANGLE THAT ISN'T THERE".

  unfold() {
    // CONFIG camera_perspective "front", camera_zoom 1 — the camera on
    // +z looking back at the origin at the rig's own 1000 units. No
    // camera move in this scene; the two that have one are Scene10
    // (the rig orbit) and the cut Scene08_1/08_2.
    this.observer.look("front")

    this.wait(START_OFFSET)
    this.play(Create(this.logo), 2)
    this.play(together(Create(this.p2pEducation), Create(this.link1)), 1)
    this.wait(4)
    this.play(together(Create(this.cultureWar), Create(this.link3)), 1)
    this.wait(2)
    this.play(together(Create(this.senseMaking), Create(this.link2)), 1)
    this.wait(4)
    this.play(together(Create(this.ideaIncubator), Create(this.link4)), 1)
    this.wait(3)
    // The labels un-write over the full 4s while the arrows fade out in
    // the first two thirds of it — `rel_end_point=2/3`, so the spokes
    // are gone before the last letters are. The source's commented-out
    // `Erase`/`Hide` alternatives are left where they are: FadeOut is
    // what it shipped with.
    this.play(
      together(
        UnCreate(this.ideaIncubator),
        UnCreate(this.cultureWar),
        UnCreate(this.senseMaking),
        UnCreate(this.p2pEducation),
        restage(FadeOut(this.link1), 0, 2 / 3),
        restage(FadeOut(this.link2), 0, 2 / 3),
        restage(FadeOut(this.link3), 0, 2 / 3),
        restage(FadeOut(this.link4), 0, 2 / 3),
      ),
      4,
    )
    this.wait(2)
    this.play(UnCreate(this.logo), 3)
  }
}

if (import.meta.main) render(Scene08Dream)
