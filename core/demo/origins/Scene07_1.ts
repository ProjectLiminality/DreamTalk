/**
 * Scene07_1.ts — A DreamWeaving
 *
 * "The Origins of Project Liminality" (2024), Scene 07_1 — the idea
 * chain, at the scale of one mind.
 *
 * A profile head draws itself on the left and a red triangle appears
 * beside it. The head walks right across the frame until it stands under
 * the triangle, and it turns red — the mind has taken the idea's colour.
 * Then it turns blue and drops, the triangle flies up and away to the
 * far left, and the chain begins: the triangle leaves a copy of itself
 * and becomes a diamond; the diamond leaves a copy and becomes a
 * pentagon; a hexagon; and finally a circle. Five shapes in a row above
 * a blue head, each one rounder than the last — the same "more sides →
 * circle" convergence Scene06 stages with repositories, told here about
 * a single thinker.
 *
 * Source (refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py:626-694):
 *
 *   person = Head(x=-200, color=WHITE, scale=1/2, thickness=VG_THICKNESS*2)
 *   idea1 = NGon(n=3, x=200, radius=25, color=RED, scale=3/2)
 *   idea2 = NGon(n=4, z=100, x=-150, radius=25, color=RED, scale=3/2)
 *   idea3 = NGon(n=5, z=100, x=0,    radius=25, color=RED, scale=3/2)
 *   idea4 = NGon(n=6, z=100, x=150,  radius=25, color=RED, scale=3/2)
 *   idea5 = Circle(   z=100, x=300,  radius=25, color=RED, scale=3/2)
 *   self.audio(…, offset=291)
 *   self.add(person, idea_evolution)
 *   self.play(Draw(person), Create(idea1), run_time=1)
 *   self.play(Transform(person, x=201),
 *             Transform(idea1, scale=3/2, relative=False), run_time=2)
 *   self.play(ChangeColor(person, color=RED))
 *   self.wait(1)
 *   self.play(Transform(idea1, z=100, x=-300),
 *             ChangeColor(person, color=BLUE),
 *             Transform(person, y=-115), run_time=2)
 *   self.play(Morph(idea1, idea2, copy=True, smoothing_right=0))
 *   self.play(Morph(idea2, idea3, copy=True, smoothing=0))
 *   self.play(Morph(idea3, idea4, copy=True, smoothing=0))
 *   self.play(Morph(idea4, idea5, copy=True, smoothing_left=0))
 *   self.play(FadeOut(idea_evolution, person))
 *
 * Summed, twelve seconds — and the reference agrees with all twelve to
 * the frame. See THE TIMELINE below.
 *
 *
 * WHAT THIS SCENE SETTLED ABOUT NGon (and why `Polygon.phase` exists)
 *
 * Core already had a `Polygon` with `radius` and `sides`, which is
 * exactly pydeation's `NGon(n=…, radius=…)` — that class sets
 * `PRIM_NSIDE_SIDES` and `PRIM_NSIDE_RADIUS` on a C4D NGon spline and
 * touches nothing else (object.py:960-975). So no new primitive was
 * needed. What WAS wrong was the orientation: core generated its
 * vertices from angle π/2 (a vertex on top), a default that dates to
 * the host's first commit and had never been checked, because until now
 * no scene in the repo had ever constructed a Polygon.
 *
 * The chain is what checks it, and it is unambiguous. On
 * refs/pitch/origins/frames5/f_01460 all five shapes stand finished
 * side by side and every one of them reads as phase ZERO — a vertex on
 * the +x axis: the triangle points RIGHT, the square is a DIAMOND
 * rather than an axis-aligned box, the pentagon has a lone vertex at its
 * right edge, the hexagon is flat-topped. The triangle measures it
 * outright: a regular n=3 spans 1.5R × √3·R at phase 0 and the
 * transpose at π/2, and its ink box on that frame is 76 × 86 px against
 * a chain circle 100 px across (R = 50). Phase 0 predicts 75 × 86.6;
 * phase π/2 predicts 100 × 75, which is not the same shape.
 *
 * So `Polygon` gained a `phase` param defaulting to 0 — see its header
 * in parts/primitives.ts for the full derivation. This scene needs no
 * rotation anywhere; it just builds n-gons and they come out right.
 *
 *
 * FRAMING (front, zoom 1 — the source coordinates ARE the pixels)
 *
 * CONFIG sets only `camera_perspective: "front"`, so zoom stays 1: the
 * camera sits 1000 units out and the 36mm rig's f = 1280 px scales the
 * origin plane by 1.28 px per world unit — the same rig Scene01 uses.
 * Checked against f_01460, the chain complete:
 *
 *   idea centres  x = −300 −150 0 150 300 → 256 448 640 832 1024 px
 *                 measured 256 448 640 832 1024 — every one exact
 *                 (the triangle's and pentagon's BBOX centres are not
 *                 their centres, so those two are read off the right
 *                 vertex, which is at +R by construction)
 *   idea size     radius 25 · scale 3/2 · 1.28 = 48 px
 *                 the circle measures 100 px across, i.e. r = 50 to the
 *                 outside of a ~2 px stroke
 *   idea height   z = 100 → y = 360 − 128 = 232      measured 232
 *   head height   400 · 1/2 · 1.28 = 256 px          measured 256
 *   head aspect   the asset's own 0.836              measured 214/256
 *   head drop     y = −115 → cy 360 + 147 = 507      measured 507
 *
 * Nothing here is fitted except START_OFFSET.
 *
 *
 * THE TIMELINE — AND THE ONE PLACE THE RE-CUT SHOWS
 *
 * The source declares `offset=291`. The scene does NOT start there in
 * the published video: it starts at 280.8 and ends at 292.8, which is
 * where the next black gap falls. The editor pulled it 10.2 seconds
 * EARLIER than its audio cue — the re-cut the vocabulary report predicts
 * "from Scene06 on", caught here as a pure translation.
 *
 * A translation is all it is. Every beat inside the scene plays at its
 * declared length, and the agreement is not approximate — it is zero.
 * Measured off frames5 (ink counts, per-colour masks, and the head's
 * bounding box, at 5 fps = 0.2 s resolution):
 *
 *   video  beat                                    source localT
 *   280.8  head draws, triangle creates                     0.0
 *   281.8  head begins its slide right                      1.0
 *   283.8  slide ends; head recolours RED                   3.0
 *   284.8  the one-second hold begins                       4.0
 *   285.8  head → BLUE and drops; triangle flies left       5.0
 *   287.8  morph 1  (triangle → diamond)                    7.0
 *   288.8  morph 2  (diamond → pentagon)                    8.0
 *   289.8  morph 3  (pentagon → hexagon)                    9.0
 *   290.8  morph 4  (hexagon → circle)                     10.0
 *   291.8  everything fades                                11.0
 *   292.8  black                                           12.0
 *
 * Ten landmarks, ten exact hits at START_OFFSET = 0. That is why the
 * offset here is not fitted at all, unlike every other scene in this
 * campaign: the scene's own first frame IS its localT 0, and the whole
 * correction is in `t0` — the gauntlet is run at 280.8, not 291.
 *
 *
 * THE FOUR MORPHS, AND `copy: true`
 *
 * Each step is `Morph(ideaN, ideaN+1, copy=True)`. `copy` is the whole
 * reason the chain accumulates instead of walking: without it the morph
 * takes its source away as it departs (Scene01's case, and the
 * default), and the frame would hold one shape moving right and
 * gaining sides. With it the source STAYS, so each step leaves its
 * predecessor standing and the row grows left to right — which is what
 * f_01445 catches mid-flight, three shapes standing while a fourth is
 * still a lopsided overlap of two.
 *
 * The `smoothing` arguments are the ease shape and core carries them as
 * `Easing`: `smoothing_right=0` is `easeIn` and `smoothing_left=0` is
 * `easeOut` (anim.ts states the mapping and pydeation's own tangent
 * meaning). `smoothing=0` — BOTH tangents zeroed — is `linear`. So the
 * chain eases in at its start, runs linear through the middle two, and
 * eases out at its end: four one-second steps that read as ONE
 * four-second gesture rather than four separate ones. Getting that
 * wrong is audible as a stutter at each seam, which is presumably why
 * the 2021 scene bothered to say it.
 *
 * The morphers are declared as fields and animated by the verb, the
 * spelling Scene01 uses for its six. Here the chain reads better in the
 * METHOD spelling as well, and both are exercised: the first step is
 * `this.idea1.morphTo(this.idea2, …)` because that step is a sentence
 * with a subject — the triangle becomes a diamond — and the remaining
 * three are the verb form because they are a LIST, and a list of
 * animators handed to `play()` is what the source is.
 */

import { Dream, render } from "../../src/index"
import { Circle, Group, Polygon } from "../../src/parts/primitives"
import { Sketch } from "../../vocabulary/Sketch/Sketch"
import { headSide } from "../../vocabulary/Sketch/assets/head_side"
// THE ABILITY IMPORT — core/src has no Morph verb, and the four steps
// of the chain below exist because this module was taken in. Scene01 is
// its first consumer; this is its second, and the first to use `copy`.
import { Morph, MorphShape } from "../../vocabulary/Morph/Morph"
import { ChangeColor, Create, Draw, FadeOut } from "../../src/verbs"
import { eased, together } from "../../src/anim"
import { BLUE, RED, WHITE } from "../../src/constants"
import { STROKE_MAIN } from "../video01/palette"

/**
 * The head between the scene's first frame and its localT 0 — and for
 * this scene alone it is ZERO, and not fitted.
 *
 * Every other Origins chapter fits a sub-second lead-in by sweeping,
 * because an eased draw spends part of its window under the encode's
 * threshold and the audio cue is not the first frame. Here the ten
 * landmarks tabulated in the header land on the declared times exactly
 * — 280.8, 281.8, 283.8, 284.8, 285.8, 287.8, 288.8, 289.8, 290.8,
 * 291.8 against 0, 1, 3, 4, 5, 7, 8, 9, 10, 11 — so there is nothing to
 * fit. The correction this scene needs is not a lead-in at all; it is
 * the SCENE START, which the re-cut moved 10.2 s ahead of the source's
 * `offset=291` to 280.8. That lives in the gauntlet's `t0`, not here,
 * and the constant is kept at 0 to say so out loud.
 */
const START_OFFSET = 0

/**
 * `thickness=VG_THICKNESS*2`. pydeation's vector-graphics thickness is
 * the SVG default and the head asks for twice it — the profile is the
 * heaviest line in the scene, and on f_01418 it measures ~3 px against
 * the polygons' ~2. STROKE_MAIN is the campaign's 2 px; the head takes
 * 3/2 of it, which is that ratio.
 */
const HEAD_STROKE = STROKE_MAIN * (3 / 2)

/** `radius=25, scale=3/2` — every shape in the chain, at 37.5 units. */
const IDEA_RADIUS = 25
const IDEA_SCALE = 3 / 2

export class Scene07_1Dream extends Dream {
  // Head(x=-200, color=WHITE, scale=1/2, thickness=VG_THICKNESS*2). The
  // 2021 `Head` is SVG("head") — the R25 asset folder the loader names
  // no longer exists, and of the two survivors in the recovered R26 set
  // (report §4) this scene's own frames pick `head_side`: f_01410 shows
  // a right-facing PROFILE, and the asset's aspect (0.836) is the ink
  // box's (214/256) to three places.
  //
  // Sketch's `height` is the drawing's size in world units, so
  // `scale=1/2` on a 400-unit default is stated as the scale it is —
  // the head's own geometry stays the asset's.
  person = new Sketch({
    data: headSide,
    x: -200,
    tint: WHITE,
    scale: 1 / 2,
    stroke: HEAD_STROKE,
  })

  // The five ideas. `NGon(n=…)` IS core's `Polygon(sides=…)`, and the
  // last of them is a Circle — the chain's destination is not a polygon
  // with many sides but the limit itself, which is the point being made.
  //
  // Note where they START: idea1 alone is at x=200 with no z, beside the
  // head at eye level. The other four are already standing at their
  // final places (z=100, x=−150/0/150/300) from the first frame,
  // invisible, because a morph's destination is born finished and merely
  // shown (vocabulary/Morph: `show_destination_splines`). idea1 is
  // carried up to x=−300 to join them by the transform at localT 5.
  idea1 = new Polygon({
    sides: 3,
    radius: IDEA_RADIUS,
    x: 200,
    tint: RED,
    scale: IDEA_SCALE,
    stroke: STROKE_MAIN,
  })
  idea2 = new Polygon({
    sides: 4,
    radius: IDEA_RADIUS,
    x: -150,
    y: 100,
    tint: RED,
    scale: IDEA_SCALE,
    stroke: STROKE_MAIN,
  })
  idea3 = new Polygon({
    sides: 5,
    radius: IDEA_RADIUS,
    x: 0,
    y: 100,
    tint: RED,
    scale: IDEA_SCALE,
    stroke: STROKE_MAIN,
  })
  idea4 = new Polygon({
    sides: 6,
    radius: IDEA_RADIUS,
    x: 150,
    y: 100,
    tint: RED,
    scale: IDEA_SCALE,
    stroke: STROKE_MAIN,
  })
  idea5 = new Circle({
    radius: IDEA_RADIUS,
    x: 300,
    y: 100,
    tint: RED,
    scale: IDEA_SCALE,
    stroke: STROKE_MAIN,
  })

  ideaEvolution = new Group({
    members: [this.idea1, this.idea2, this.idea3, this.idea4, this.idea5],
  })

  /**
   * The FIRST link of the chain, in the method spelling — the triangle
   * becoming a diamond, stated as the sentence it is. `.morphTo()`
   * builds the morpher and hands it back with its Anim; the scene
   * declares both, which is the contract (the method never inserts
   * geometry into the graph itself).
   */
  firstLink = this.idea1.morphTo(this.idea2, { copy: true })

  /**
   * The remaining three, the long way — one morpher per pair, exactly as
   * pydeation builds one helper Cloner per `Morph` call. These read as a
   * list because that is what they are, and the verb form below animates
   * them as one.
   */
  link2 = new MorphShape(this.idea2, this.idea3, { opacity: 0 })
  link3 = new MorphShape(this.idea3, this.idea4, { opacity: 0 })
  link4 = new MorphShape(this.idea4, this.idea5, { opacity: 0 })

  unfold() {
    // CONFIG camera_perspective "front"; zoom is left at 1.
    this.observer.look("front")

    // Everything the source `add`s is staged, morphers included.
    this.stage(this.firstLink.shape)
    this.stage(this.link2)
    this.stage(this.link3)
    this.stage(this.link4)
    this.stage(this.person)
    this.stage(this.ideaEvolution)

    // The head and idea1 are drawn on by the first play; the other four
    // ideas are morph DESTINATIONS, so they are born with complete
    // outlines and held out of the frame by opacity alone — never drawn
    // and never un-drawn, stepping in whole at the instant the morpher
    // standing in for them leaves. Scene01 states the same thing at more
    // length; the difference here is that the sources stay too (`copy`),
    // so nothing is ever taken away until the closing fade.
    this.set(
      Create(this.person),
      Create(this.idea1),
      this.idea2.creation.to(1),
      this.idea3.creation.to(1),
      this.idea4.creation.to(1),
      this.idea5.creation.to(1),
      FadeOut(this.idea2),
      FadeOut(this.idea3),
      FadeOut(this.idea4),
      FadeOut(this.idea5),
    )
    this.set(this.person.creation.to(0), this.idea1.creation.to(0))

    this.wait(START_OFFSET)

    // Draw(person), Create(idea1) — the head's profile sweeps on while
    // the triangle draws beside it. One second for both.
    this.play(together(Draw(this.person), Create(this.idea1)), 1)
    // Transform(person, x=201) — RELATIVE, pydeation's default, so the
    // head travels 201 units right from x=−200 and lands at +1, which is
    // where f_01418 measures it (world cx −1.6). Not "to x=201", which
    // would have put it off under the triangle's old place.
    //
    // Transform(idea1, scale=3/2, relative=False) is an absolute scale
    // to the value it already carries — a no-op the source states
    // anyway, and the frames confirm the triangle does not change size.
    this.play(
      together(this.person.x.by(201), this.idea1.scale.to(IDEA_SCALE)),
      2,
    )
    // The mind takes the idea's colour.
    this.play(ChangeColor(this.person, RED), 1)
    this.wait(1)
    // And then it does not keep it: blue, and down. Meanwhile the
    // triangle leaves eye level for the top-left, where the chain will
    // run. Both of the triangle's numbers are RELATIVE — from (200, 0)
    // by (−300, +100) to (−100, 100)… which is NOT where f_01460 shows
    // it. The frames put it at world x = −300, and the other four ideas
    // are declared at absolute x = −150/0/150/300, a row of five at 150
    // apart that only closes if the first sits at −300. So this one
    // reads as absolute, and the `z=100, x=-300` in the source is the
    // destination rather than the delta.
    //
    // The head's `y=-115` is relative and lands at −115 from 0, which is
    // the same number either way — f_01460 measures −114.8.
    this.play(
      together(
        this.idea1.x.to(-300),
        this.idea1.y.to(100),
        ChangeColor(this.person, BLUE),
        this.person.y.by(-115),
      ),
      2,
    )
    // THE CHAIN. Four one-second morphs, each leaving its source
    // standing, and the four easings are the source's own smoothing
    // arguments (see the header): easeIn, linear, linear, easeOut — one
    // gesture in four steps rather than four gestures.
    this.play(eased("easeIn", this.firstLink.anim), 1)
    this.play(eased("linear", Morph(this.link2, this.idea2, this.idea3, { copy: true })), 1)
    this.play(eased("linear", Morph(this.link3, this.idea3, this.idea4, { copy: true })), 1)
    this.play(eased("easeOut", Morph(this.link4, this.idea4, this.idea5, { copy: true })), 1)
    // FadeOut(idea_evolution, person) — the row and the head together.
    this.play(together(FadeOut(this.ideaEvolution), FadeOut(this.person)), 1)
  }
}

if (import.meta.main) render(Scene07_1Dream)
