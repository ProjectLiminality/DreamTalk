/**
 * Scene01.ts — A DreamWeaving
 *
 * "The Origins of Project Liminality" (2024), Scene 01 — the thesis.
 *
 * Fifty-eight seconds, and the argument of the whole video is made in
 * them. Seven circles draw themselves and flood white; forty-two lines
 * connect every one of them to every other. Then a dotted line falls
 * down the middle of the frame, eighteen of those lines — every single
 * one that CROSSED the middle — quietly un-draw, and what is left takes
 * sides: three circles and their edges go blue, three go red, and the
 * one in the centre wobbles between the two camps four times before
 * giving up and sitting still.
 *
 * Nine seconds of that. Then the graph itself dissolves, and the six
 * outer circles MORPH — the left three into one blue circle, the right
 * three into one red rectangle. Two arrows of tension appear between
 * them; the pair converges; a cylinder is born above where they meet.
 * The whole tableau slides left and two eyes open beside it, turn to
 * face each other, whiten, and cast their lines of sight before
 * everything is taken away.
 *
 * Source (refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py:23-169).
 * The graph construction is shared with Scene11 and lives in
 * ./KinshipGraph.ts — the source states it twice, identically, and the
 * two scenes are the same figure split and then healed.
 *
 * The play, verbatim from pitch.py:116-166:
 *
 *   self.play(DrawThenFillCompletely(relatives), run_time=2)
 *   self.play(Create(relationships), run_time=2)
 *   self.play(Create(separator), UnCreate(relationships_remaining),
 *             ChangeColor(relationships_left, relatives_left, color=BLUE),
 *             ChangeColor(relationships_right, relatives_right, color=RED),
 *             run_time=4)
 *   self.play(Transform(relatives_middle, x=50,  relative=False))   ×
 *   self.play(Transform(relatives_middle, x=-50, relative=False))   × four
 *   self.play(Transform(relatives_middle, relative=False))
 *   self.wait(9)
 *   self.play(FadeOut(relationships, relatives_middle), UnFill(relatives_middle))
 *   self.play(FadeOut(separator),
 *             Morph(relatives_left.children[0], circle),
 *             Morph(relatives_left.children[1], circle),
 *             Morph(relatives_left.children[2], circle),
 *             Morph(relatives_right.children[0], rectangle),
 *             Morph(relatives_right.children[1], rectangle),
 *             Morph(relatives_right.children[2], rectangle),
 *             run_time=4)
 *   self.play(Create(tension, rel_start_point=1/2),
 *             Fill(rectangle, circle, transparency=1), run_time=6)
 *   self.wait(3)
 *   self.play(Transform(rectangle, circle, z=-100, scale=1/2),
 *             Transform(rectangle, x=-75), Transform(circle, x=75), run_time=3)
 *   self.play(Create(cylinder), run_time=3)
 *   self.play(Transform(shapes, x=-250))
 *   self.play(Create(eye_left, eye_right), run_time=2)
 *   self.wait(1)
 *   self.play(Transform(view_left, h=PI/2, x=-50),
 *             Transform(view_right, h=-PI/2, x=50),
 *             ChangeColor(eye_left, eye_right, color=WHITE), run_time=2)
 *   self.play(Create(sight_left, sight_right), run_time=2)
 *   self.wait(2)
 *   self.play(UnCreate(eye_left, eye_right), Erase(sight_left, sight_right), run_time=1)
 *   self.play(Transform(shapes, relative=False), run_time=2)
 *   self.wait(2)
 *   self.play(UnCreate(shapes))
 *
 * Summed, that is exactly 58 seconds — the scene's declared span
 * (offset 13 to Scene02's offset 71). Nothing is fitted but the head.
 *
 *
 * THE SIX MORPHS — WHAT THE REFERENCE PROVES ABOUT CORRESPONDENCE
 *
 * This is the chapter's reason for existing, and the reference settles
 * a question the code alone could not.
 *
 * pydeation's Morph hands the whole correspondence problem to a C4D
 * MoGraph Cloner in Blend mode over two uniformly-resampled MoSplines
 * (animator.py:581-632, derived in full in src/geometry/morph.ts). That
 * predicts an INDEX-WISE lerp between two arc-length resamplings, with
 * no rotation search — which in turn predicts that a circle becoming a
 * rectangle should pass through shapes that are visibly SKEWED, because
 * the circle's start point and the rectangle's do not line up.
 *
 * f_00190 (video 38.0s, localT 25.0, u = 0.5) is that prediction
 * photographed. The three red shapes halfway through are not upright
 * proto-rectangles; they are leaning quadrilaterals with bowed sides,
 * each rotated a little differently from the others. A morph that
 * searched for the best alignment would have produced three identical
 * upright shapes. The naive rule is not a simplification of what
 * pydeation did — it IS what pydeation did, and the frames show it.
 *
 * f_00196 (u = 0.8) confirms the other half: the three blue circles have
 * nearly converged on the single destination circle and read as ONE
 * lumpy blob with three overlapping lobes — three independent morphs
 * arriving at the same place, not one shape being moved. That is what
 * six separate MorphShapes look like, and it is why the ability takes a
 * staged shape per pair rather than one per group.
 *
 *
 * MORPH IS NOT A CORE VERB — THIS SCENE IS THE PROOF
 *
 * `Morph` is imported from `core/vocabulary/Morph/`, not from
 * `core/src/verbs.ts`, which does not mention it. It is the framework's
 * first PLUGGABLE ABILITY: a DreamNode whose contribution is a
 * capability rather than a shape, and which grafts `.morphTo()` onto
 * every Stroke in the process when it is imported. This scene uses the
 * free-function spelling because the source's grammar is a list of
 * animators handed to `play()` and a reproduction should read like what
 * it reproduces; `this.graph.nodes[1]!.morphTo(this.circle)`
 * is the same ability in its method spelling — it stages the morpher for
 * you and hands it back, which suits a scene declaring one morph in one
 * place rather than six up front.
 *
 * Delete the import and this file stops compiling — which is the honest
 * signal that the ability is genuinely separable, and the reason the
 * pattern is worth having.
 *
 *
 * FRAMING (front, zoom 1 — the source coordinates ARE the pixels)
 *
 * CONFIG sets only `camera_perspective: "front"`, so zoom stays 1: the
 * camera sits 1000 units out and the 36mm rig's f = 1280px scales the
 * origin plane by 1.28 px per world unit. Checked against f_00160, the
 * signature frame:
 *
 *   left node   x = −200 → 640 − 256 = 384    measured 385
 *   right node  x = +200 → 640 + 256 = 896    measured 895
 *   upper nodes z = ±173.21 → 360 ∓ 221.7 = 138 / 582   measured 138 / 582
 *   node radius 20 → 25.6px                   measured ~26 to the ink edge
 *
 * and against f_00230, after the morph:
 *
 *   circle     r = 50 at x = −200 → r 64px at cx 384    measured 64 / 384
 *   rectangle  100×200 at x = +200 → 128×256 at cx 896  measured 128 / 896
 *
 * Nothing here is fitted except START_OFFSET.
 */

import { Dream, render } from "../../src/index"
import { Circle, DottedLine, Group, Rectangle } from "../../src/parts/primitives"
import { Connection } from "../../src/parts/curves"
import { Cylinder } from "../../vocabulary/Cylinder/Cylinder"
import { Eye } from "../../vocabulary/Eye/Eye"
// THE ABILITY IMPORT. This one line is what makes the six morphs below
// possible: `core/src` contains no Morph verb, and every Stroke in this
// scene gains `.morphTo()` because this module was taken in. See
// vocabulary/Morph/README.md — it is the first pluggable ability, and
// this scene is its proof in anger.
import { Morph, MorphShape } from "../../vocabulary/Morph/Morph"
import {
  ChangeColor,
  Create,
  DrawThenFillCompletely,
  Erase,
  FadeOut,
  Fill,
  UnCreate,
  UnFill,
} from "../../src/verbs"
import { together } from "../../src/anim"
import { BLUE, PI, RED, WHITE } from "../../src/constants"
import { STROKE_MAIN } from "../video01/palette"
import { kinshipGraph } from "./KinshipGraph"

/**
 * The head between the audio cue (offset=13, which the scorer takes as
 * localT 0) and the scene's first frame — the ONE fitted number, carried
 * as a leading wait so every run_time and wait below stays verbatim.
 *
 * Fitted by sweeping the alignment and scoring every frame of the
 * opening construction (f_00067-f_00100, the draw and the flood), rather
 * than by reading one landmark:
 *
 *   offset    0.00   0.05   0.10   0.15   0.20   0.30   0.40   0.60
 *   PASS     12/17  14/17  15/17  15/17  15/17  14/17  12/17  11/17
 *   covRef   .9761  .9703  .9633  .9475  .9200  .8824  .8652  .8536
 *
 * A plateau from 0.10 to 0.20, whose PASS count peaks first at 0.10 and
 * whose coverage is still climbing there. The two curves pull in
 * opposite directions — covRef rewards a LATE reproduction (less of our
 * ink outside the reference's) and PASS rewards agreement — and 0.10 is
 * where they meet.
 *
 * The landmarks agree independently. `DrawThenFillCompletely` over 2s
 * closes the outlines at 0.6 of the span, i.e. localT 1.2, and the
 * reference's lit-pixel count reaches its outline plateau of 17368 at
 * video 14.4 — putting localT 0 at 13.2, an offset of 0.2. The flood
 * completes at localT 2.0 and the reference's luminance plateaus at
 * video 15.0, putting localT 0 at 13.0. The sweep sits between the two,
 * as it should: the first is a threshold crossing and reads late.
 */
const START_OFFSET = 0.1

/**
 * The separator's dash rhythm. Sketch & Toon's "dotted" preset is stated
 * in the same pixel units the thickness is (parts/primitives.ts:
 * DottedLine), and at this camera's 1.28 px/unit the reference's rhythm
 * on f_00160 — a ~10px dash on a ~10px gap down the full height of the
 * frame — reads as 8 world units each.
 */
const SEPARATOR_DASH = 8
const SEPARATOR_GAP = 8

export class Scene01Dream extends Dream {
  private graph = kinshipGraph()

  // The seven circles and their four groupings, and the 42 edges and
  // theirs — declared as fields so the editor outline can name them.
  relatives = this.graph.relatives
  relativesLeft = this.graph.relativesLeft
  relativesRight = this.graph.relativesRight
  relativesMiddle = this.graph.relativesMiddle
  relationships = this.graph.relationships
  relationshipsLeft = this.graph.relationshipsLeft
  relationshipsRight = this.graph.relationshipsRight
  relationshipsRemaining = this.graph.relationshipsRemaining

  // Rectangle(width=100, height=200, x=200, color=RED, solid=True) and
  // Circle(radius=50, x=-200, color=BLUE, solid=True). `solid=True` is a
  // fill state, not a construction flag: the shapes arrive already
  // flooded, which is why the morph's destination is opaque.
  rectangle = new Rectangle({
    width: 100,
    height: 200,
    x: 200,
    tint: RED,
    fillOpacity: 1,
    stroke: STROKE_MAIN,
  })
  circle = new Circle({ radius: 50, x: -200, tint: BLUE, fillOpacity: 1, stroke: STROKE_MAIN })
  // Cylinder(h=-PI/2, z=100, p=-PI/4, scale=1/2): the source's z is our
  // y, its h our b, its p our x-tilt — the same reading video-01's
  // scenes make of this exact object.
  cylinder = new Cylinder({ b: -PI / 2, y: 100, p: -PI / 4, scale: 1 / 2, stroke: STROKE_MAIN })
  // Spline([(0,0,400), (0,0,-400)], thickness=5, line_style="dotted") —
  // the source's z is our y, so this is a vertical line 800 units tall.
  separator = new DottedLine({
    points: [
      { x: 0, y: 400, z: 0 },
      { x: 0, y: -400, z: 0 },
    ],
    dash: SEPARATOR_DASH,
    gap: SEPARATOR_GAP,
    stroke: 5 * (STROKE_MAIN / 5),
  })

  // The two tension arrows, aimed inward from each shape toward the
  // origin. `Connection(circle, (-20,0,0), (0,0,0), …)` traces THROUGH a
  // waypoint 20 units to the shape's left, so the arrow leaves the
  // circle heading outward-then-inward — the little curl the reference
  // shows on f_00230.
  private origin = new Group({})
  arrowCircle = new Connection(this.circle, this.origin, {
    via: [{ x: -20, y: 0, z: 0 }],
    offsetStart: 1 / 4,
    offsetEnd: 0.1,
    z: -1,
    stroke: STROKE_MAIN,
  })
  arrowRectangle = new Connection(this.rectangle, this.origin, {
    via: [{ x: 20, y: 0, z: 0 }],
    offsetStart: 1 / 4,
    offsetEnd: 0.1,
    z: -1,
    stroke: STROKE_MAIN,
  })
  tension = new Group({ members: [this.arrowCircle, this.arrowRectangle] })

  shapes = new Group({
    members: [this.rectangle, this.circle, this.cylinder, this.separator, this.tension],
  })

  // Eye(color=BLUE, scale=1/3, x=-175) and its red twin at h=PI. The
  // sight lines are Connections to fixed world points, which core states
  // as a Group at that position.
  eyeLeft = new Eye({ tint: BLUE, scale: 1 / 3, x: -175, stroke: STROKE_MAIN })
  eyeRight = new Eye({ tint: RED, scale: 1 / 3, x: 175, b: PI, stroke: STROKE_MAIN })
  private sightTargetLeftLow = new Group({ x: 200, y: -125 })
  private sightTargetLeftHigh = new Group({ x: 200, y: 125 })
  private sightTargetRightLow = new Group({ x: -200, y: -125 })
  private sightTargetRightHigh = new Group({ x: -200, y: 125 })
  sightLeft = new Group({
    members: [
      new Connection(this.eyeLeft, this.sightTargetLeftLow, {
        offsetStart: 0.2,
        z: -1,
        stroke: STROKE_MAIN,
      }),
      new Connection(this.eyeLeft, this.sightTargetLeftHigh, {
        offsetStart: 0.2,
        z: -1,
        stroke: STROKE_MAIN,
      }),
    ],
  })
  sightRight = new Group({
    members: [
      new Connection(this.eyeRight, this.sightTargetRightLow, {
        offsetStart: 0.2,
        z: -1,
        stroke: STROKE_MAIN,
      }),
      new Connection(this.eyeRight, this.sightTargetRightHigh, {
        offsetStart: 0.2,
        z: -1,
        stroke: STROKE_MAIN,
      }),
    ],
  })
  viewLeft = new Group({ members: [this.eyeLeft, this.sightLeft] })
  viewRight = new Group({ members: [this.eyeRight, this.sightRight] })
  eyes = new Group({ members: [this.viewLeft, this.viewRight], x: 250 })

  /**
   * The FIRST morph, stated in the method spelling — the living proof
   * that the graft is real. `.morphTo()` builds the morpher and returns
   * it with its Anim; the scene declares both as fields, which is the
   * whole contract (the method never inserts geometry itself). The other
   * five below use the verb spelling on morphers declared the long way.
   * Both are canon and both are the same code.
   */
  firstMorph = this.graph.nodes.length
    ? this.graph.nodes[1]!.morphTo(this.circle)
    : undefined

  // The remaining five morphers — one per (source node, destination
  // shape) pair, exactly as pydeation builds one helper Cloner per Morph
  // call. Three left nodes converge on the circle, three right on the
  // rectangle; `firstMorph` above is the sixth, and the first of them.
  morphs = this.graph.nodes.length
    ? [
        new MorphShape(this.graph.nodes[2]!, this.circle, { opacity: 0 }),
        new MorphShape(this.graph.nodes[6]!, this.circle, { opacity: 0 }),
        new MorphShape(this.graph.nodes[3]!, this.rectangle, { opacity: 0 }),
        new MorphShape(this.graph.nodes[4]!, this.rectangle, { opacity: 0 }),
        new MorphShape(this.graph.nodes[5]!, this.rectangle, { opacity: 0 }),
      ]
    : []

  unfold() {
    // CONFIG camera_perspective "front"; zoom is left at 1.
    this.observer.look("front")

    // Everything the source `add`s is staged; the shapes and eyes are
    // present from the first frame but undrawn, exactly as `self.add`
    // means in pydeation.
    if (this.firstMorph) this.stage(this.firstMorph.shape)
    for (const morph of this.morphs) this.stage(morph)
    this.stage(this.shapes)
    this.stage(this.eyes)
    this.set(
      // The tableau the first half of the scene never shows.
      Create(this.relatives),
      UnCreate(this.shapes),
      UnCreate(this.eyes),
    )
    // THE MORPH DESTINATIONS ARE BORN FINISHED, AND HIDDEN.
    //
    // pydeation's `Morph` reaches into the destination and sets it to a
    // completed state before the animation runs at all — outline
    // `completion=1`, and if it was declared `solid=True` its filler
    // forced opaque (animator.py:608-613,
    // `set_initial_params_sketch_material` / `_filler_material`). The
    // destination is then merely SHOWN at 0.99. It is never drawn and
    // never filled: it steps into the frame already whole, at the moment
    // the morpher that has been standing in for it leaves.
    //
    // So `UnCreate(shapes)` above must not reach these two. Their
    // outlines are complete and their interiors flooded from the first
    // frame — `solid=True` on both — and OPACITY alone is what keeps
    // them out of the first twenty-seven seconds.
    this.set(
      this.circle.creation.to(1),
      this.rectangle.creation.to(1),
      this.circle.fillOpacity.to(1),
      this.rectangle.fillOpacity.to(1),
      FadeOut(this.circle),
      FadeOut(this.rectangle),
    )

    this.wait(START_OFFSET)

    // DrawThenFillCompletely(relatives) — the seven discs draw and flood.
    this.play(DrawThenFillCompletely(this.relatives), 2)
    // Create(relationships) — all 42 edges.
    this.play(Create(this.relationships), 2)
    // The split: the separator falls, the eighteen crossing edges leave,
    // and the two halves take their colours. One four-second span.
    this.play(
      together(
        Create(this.separator),
        UnCreate(this.relationshipsRemaining),
        ChangeColor(this.relationshipsLeft, BLUE),
        ChangeColor(this.relativesLeft, BLUE),
        ChangeColor(this.relationshipsRight, RED),
        ChangeColor(this.relativesRight, RED),
      ),
      4,
    )
    // The mediator wobbles: four one-second moves, then home. Each is a
    // `relative=False` transform, i.e. an absolute x.
    for (const x of [50, -50, 50, -50, 0]) {
      this.play(this.relativesMiddle.x.to(x), 1)
    }
    this.wait(9)
    // The graph dissolves — the edges and the centre fade, the centre's
    // fill drains with them.
    this.play(
      together(
        FadeOut(this.relationships),
        FadeOut(this.relativesMiddle),
        UnFill(this.relativesMiddle),
      ),
      1,
    )
    // Hand each morpher the surfaces its source is WEARING RIGHT NOW,
    // one instant before it departs.
    //
    // pydeation does this at construction, because a 2021 node's colour
    // and fill are construction flags and are true from the moment the
    // object exists. Ours are twenty-three seconds of timeline: every
    // node is built white and hollow, floods solid under
    // `DrawThenFillCompletely` at localT 0, and takes its side under
    // `ChangeColor` at 4. So the state the morph must leave from is not
    // readable at build time, and it is stated here instead — solid, and
    // the colour of the half the node belongs to. Without this the six
    // morphs depart from white-and-hollow and cross the frame as pale
    // translucent ghosts; f_00190 shows them saturated and solid.
    // `firstMorph` is a left-side morpher (node 1 → the circle), so it
    // takes BLUE alongside the two other left ones.
    this.set(
      ...(this.firstMorph
        ? [this.firstMorph.shape.tint.to(BLUE), this.firstMorph.shape.fillOpacity.to(1)]
        : []),
      ...this.morphs.flatMap((morph, i) => [
        morph.tint.to(i < 2 ? BLUE : RED),
        morph.fillOpacity.to(1),
      ]),
    )
    // THE SIX MORPHS, simultaneous, over four seconds, with the
    // separator fading across the same span.
    this.play(
      together(
        FadeOut(this.separator),
        // The method spelling's Anim, built with its morpher back where
        // the field is declared — the same Anim the five verb calls
        // below produce, reached the other way round.
        ...(this.firstMorph ? [this.firstMorph.anim] : []),
        Morph(this.morphs[0]!, this.graph.nodes[2]!, this.circle),
        Morph(this.morphs[1]!, this.graph.nodes[6]!, this.circle),
        Morph(this.morphs[2]!, this.graph.nodes[3]!, this.rectangle),
        Morph(this.morphs[3]!, this.graph.nodes[4]!, this.rectangle),
        Morph(this.morphs[4]!, this.graph.nodes[5]!, this.rectangle),
      ),
      4,
    )
    // `Create(tension, rel_start_point=1/2)` — the arrows occupy the
    // SECOND HALF of a six-second span while the two shapes flood over
    // the whole of it. The plain tuple, not restage(): the source states
    // the window on a plain animator, where it reaches the Animation's
    // own constructor and the ease scales with it (anim.ts:
    // Track.smoothingWindow).
    //
    // `transparency=1` DRAINS them. The shapes arrive from the morph
    // already solid (the morph's destinations are `solid=True`), and
    // this play empties them to bare outlines — which reads backwards
    // from the verb's name until you check the frames. Sampling the
    // rectangle's interior on frames5 (mean of the RGB box x∈[860,930],
    // y∈[300,420], where 142 is fully flooded and 0 is empty):
    //
    //   localT  26.4   27.6   28.8   30.0   31.2   32.4   33.0
    //   mean     142    142    138    123     91     30      0
    //
    // Flooded through the morph, empty by the end of this span. So
    // `Fill(…, transparency=1)` is the source spelling a drain, and
    // core's `Fill` — which reads transparency in the source's own units
    // and animates 1 − it — lands the same 0.
    //
    // ONE DIVERGENCE THIS FILE DOES NOT CHASE. Normalizing both drains
    // to their own flooded value and sampling the same box in each:
    //
    //   localT   26.4   27.6   28.8   30.0   31.2   32.4   33.0
    //   ref      1.000  0.999  0.969  0.860  0.640  0.211  0.000
    //   ours     1.000  0.981  0.883  0.731  0.522  0.208  0.000
    //
    // Both reach zero at 33.0, but the reference HOLDS — flat to within
    // a thousandth until 28.8 — and then falls steeply, while ours
    // declines from the moment the play opens. Grid-fitted over ease,
    // start and span, the reference is an `easeIn` ramp beginning at
    // localT 29.1 over 4s (mean squared error 0.00095); ours against its
    // own declared window (27.1, 6s, smooth) sits at 0.021, twenty times
    // worse, which is the divergence rather than a bad fit on our side.
    //
    // So the published render holds the shapes solid about two seconds
    // longer than the script asks and then empties them faster. That is
    // the same class of re-timing Scene04 documents at its close,
    // reaching one scene earlier than the report's "from Scene06"
    // boundary predicted. The source's window is kept, because this
    // chapter reproduces the script and a fitted window would encode the
    // editor's decision as if it were the author's.
    //
    // (This comparison only became measurable once `washGeometry` grew
    // its Rectangle branch — before that our rectangle animated
    // `fillOpacity` and rendered no interior at all, so the curve above
    // could not be read off our own frames.)
    this.play(
      together(
        [Create(this.tension), 1 / 2, 1],
        Fill(this.rectangle, { transparency: 1 }),
        Fill(this.circle, { transparency: 1 }),
      ),
      6,
    )
    this.wait(3)
    // THE CONVERGENCE — and every number in it is RELATIVE.
    //
    // pydeation's `Transform` defaults to `relative=True`; the scene
    // says `relative=False` explicitly where it wants an absolute
    // (which is why the centre node's four wobbles above are `.to()`
    // and these are not). So `Transform(rectangle, circle, z=-100,
    // scale=1/2)` drops BOTH by 100 and halves both, and the two x
    // moves that follow bring each 75 units TOWARD the other rather
    // than teleporting them to ±75.
    //
    // The reference is unambiguous. On f_00270 (localT 41.0, the move
    // complete) the circle reads at screen cx 480 and the rectangle at
    // 800, which at 1.28 px/unit is world −125 and +125 — the starting
    // ∓200 closed by 75 on each side. Absolute ±75 would have put them
    // at 544 and 736, and would also have SWAPPED them, the rectangle
    // crossing to the left. It does not; the composite of the first
    // attempt showed exactly that crossing, and the reference showed
    // the two shapes still on their own sides.
    this.play(
      together(
        this.rectangle.y.by(-100),
        this.rectangle.scale.to(1 / 2),
        this.circle.y.by(-100),
        this.circle.scale.to(1 / 2),
        this.rectangle.x.by(-75),
        this.circle.x.by(75),
      ),
      3,
    )
    this.play(Create(this.cylinder), 3)
    // Also relative: the whole tableau slides 250 to the left, which on
    // f_00280 takes the circle from screen 480 to 160 (world −125 to
    // −375). It does not go TO x = −250.
    this.play(this.shapes.x.by(-250), 1)
    this.play(together(Create(this.eyeLeft), Create(this.eyeRight)), 2)
    this.wait(1)
    // The two views turn to face each other and whiten. The headings
    // are absolute in effect (both views start at 0) but the x nudges
    // are relative — ∓50 toward each other, which f_00304 shows as the
    // two eyes closing from screen 797/1123 to 868/1051.
    this.play(
      together(
        this.viewLeft.b.to(PI / 2),
        this.viewLeft.x.by(-50),
        this.viewRight.b.to(-PI / 2),
        this.viewRight.x.by(50),
        ChangeColor(this.eyeLeft, WHITE),
        ChangeColor(this.eyeRight, WHITE),
      ),
      2,
    )
    this.play(together(Create(this.sightLeft), Create(this.sightRight)), 2)
    this.wait(2)
    this.play(
      together(
        UnCreate(this.eyeLeft),
        UnCreate(this.eyeRight),
        Erase(this.sightLeft),
        Erase(this.sightRight),
      ),
      1,
    )
    this.play(this.shapes.x.to(0), 2)
    this.wait(2)
    this.play(UnCreate(this.shapes), 1)
  }
}

if (import.meta.main) render(Scene01Dream)
