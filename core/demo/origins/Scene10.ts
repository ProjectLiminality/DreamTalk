/**
 * Scene10.ts — A DreamWeaving
 *
 * "The Origins of Project Liminality" (2024), Scene 10 — big tech, and
 * what it is all pulling on.
 *
 * Four brand marks stand at the arms of a cross — Apple and Amazon in
 * blue to left and right, Google and Microsoft in red below and above —
 * each drawn as an outline and then flooded solid. Four arrows reach in
 * from them to a point at the centre that has nothing in it. Then the
 * camera lifts and swings around the whole arrangement, the flat cross
 * opens into three dimensions, the invisible thing at the centre rises,
 * and a cylinder is drawn where the four tensions meet: the shape they
 * were making all along, seen only once you stop looking at it head on.
 *
 * Source (refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py:939-986):
 *
 *   CONFIG = camera_perspective "front", camera_position (0, 0), zoom 1
 *   apple     = AppleLogo(scale=1/4, x=-150, color=BLUE)
 *   amazon    = AmazonLogo(scale=1/4, x=150,  color=BLUE)
 *   google    = GoogleLogo(scale=1/4, z=-150, color=RED)
 *   microsoft = MicrosoftLogo(scale=1/4, z=150, color=RED)
 *   big_tech  = Group(apple, amazon, google, microsoft)
 *   anchor    = CObject()
 *   tension_* = Connection(<logo>, (±30, 0, 0)|(0, 0, ±30), anchor, offset_start=0.25)
 *   tension   = Group(anchor, tension_apple, …)
 *   cylinder  = Cylinder(y=125, scale=1/2)
 *   self.audio(…, offset=405)
 *   self.play(Create(big_tech), run_time=3)
 *   self.play(Create(tension), run_time=1)
 *   self.play(Transform(self.camera_group, p=PI/3, h=PI/4, rel_end_point=2/3),
 *             Transform(self.camera, z=25, y=-300,        rel_end_point=2/3),
 *             Transform(anchor, y=80,                     rel_start_point=1/3),
 *             Create(cylinder,                            rel_start_point=2/3), run_time=4)
 *   self.wait(3)
 *   self.play(UnCreate(cylinder, big_tech), Erase(tension), run_time=3)
 *
 *
 * ══ THE RIG ═══════════════════════════════════════════════════════════
 *
 * This is the scene the campaign was saving the camera for, and the one
 * that forces the 2021 two-level rig to be understood rather than
 * approximated. The finding is that core's Observer already expresses it
 * exactly, and dream.ts is unchanged. Here is the derivation.
 *
 * WHAT THE RIG IS (refs/pydeation-legacy/scene/scene.py:1053-1088,
 * camera/camera.py:65-77):
 *
 *   self.camera = ThreeDCamera(zoom, x, z)
 *       position (x, 1000/zoom, z)     — note the standoff is on +Y
 *       rotation VECTOR_Y = -PI/2      — and VECTOR_Y in a C4D rotation
 *                                        vector is P, the PITCH, not H
 *                                        (object.py:35-40 names the
 *                                        descIds: rot_h is VECTOR_X,
 *                                        rot_p is VECTOR_Y, rot_b is
 *                                        VECTOR_Z)
 *   self.camera_group = Group(self.camera, p=…, b_frozen=…, z_frozen=…)
 *
 * So the camera hangs directly ABOVE the origin at +Y and is pitched a
 * quarter turn to look straight DOWN. The scene is built in the world
 * XZ plane — which is why every 2021 scene lays its objects out in x and
 * z — and "camera_perspective front" (p = 0, b_frozen = 0) is the plan
 * view of that plane. World +z then reads as screen UP, which is the
 * whole content of the "pydeation's z is our y" rule the earlier scenes
 * state: it is a re-expression of the plan view, valid exactly as long
 * as the camera stays in it.
 *
 * The two levels are therefore two different gestures:
 *
 *   Transform(self.camera, …)        moves the camera WITHIN the rig
 *     y   the standoff along the view axis        → Observer `radius`
 *     x   lateral truck in the view plane         → Observer `x`
 *     z   vertical pedestal in the view plane     → Observer `y`
 *     p   a pitch at the camera itself            → (never used; below)
 *
 *   Transform(self.camera_group, …)  ORBITS the whole rig about the origin
 *     p   rig pitch                               ↘ together, a rotation
 *     h   rig heading                             ↗ of the camera BASIS
 *
 * The first three of those are one-to-one and need no comment. The
 * fourth and the orbit are the interesting cases.
 *
 * `p` ON THE CAMERA IS NEVER A ROTATION. It appears twice in this video
 * — Scene08_1:845 and Scene08_2:906 — and both are `p=-PI/2` under
 * `relative=False`, which is the camera's own RESTING pitch. pydeation's
 * transform filters out any channel whose absolute input equals the
 * current value (object.py:390-392, `filter_descIds` against
 * `default_values = curr_values`), so both calls animate nothing on that
 * channel: they are the author writing the full absolute pose and
 * including the part that does not change. No scene in the video ever
 * pitches the camera away from its rest orientation, so this channel
 * costs the Observer nothing.
 *
 * THE ORBIT IS A ROLL AS WELL AS A TURN, and that is the one thing a
 * naive mapping gets wrong. Composing the rig's rotation
 * (Ry(h)·Rx(-p), then the camera's own Rx(+PI/2)) and reading the
 * resulting eye and up vectors in core's basis gives, for this scene's
 * endpoint (p = PI/3, h = PI/4, camera y = 700, z = 25):
 *
 *   eye   (-419.8, -419.8, 371.7)      radius 700.45
 *   up    ( 0.354,  0.354, 0.866)      — NOT (0, 1, 0)
 *
 * A `lookAt` with world-up, which is what syncCamera does, cannot make
 * that pose on its own: the rig has rolled the horizon by a third of a
 * turn. But the Observer has `tilt` for exactly this, and solving for it
 * closes the gap completely —
 *
 *   phi = -0.2693·PI   theta = -0.2046·PI   tilt = +0.3447·PI
 *   residual on the up vector: 0.0007
 *
 * — so `phi`/`theta`/`tilt`/`radius` span the two-level rig's pose group
 * with nothing left over. THE OBSERVER NEEDS NO NEW CHANNEL. That is
 * the deliverable this chapter was asked for, and the answer is that the
 * capability was already there; it needed deriving, not building.
 *
 * VERIFIED AGAINST THE FILM, not just against algebra. Projecting the
 * four logos through the reconstructed rig with the 36mm lens:
 *
 *   at rest (f_01750, t=350.0)      predicted        measured
 *     apple                         (448, 360)       (450, 360)
 *     amazon                        (832, 360)       (830, 360)
 *     google                        (640, 552)       (640, 552)
 *     microsoft                     (640, 168)       (640, 168)
 *
 *   at the end of the move (f_01770, t=354.0)
 *     apple                         (468, 315)       (455, 315)
 *     microsoft                     (812, 315)       (810, 315)
 *     google                        (417, 524)       (415, 530)
 *     amazon                        (863, 524)       (855, 530)
 *     cylinder centre               (640, 193)       (640, 190)
 *
 * The rest fit is 2.8 px across four marks and the end fit 18 px across
 * five objects, against reference positions read off a 720p JPEG by eye
 * (±10 px). Two independent poses, one rig, no fitted parameters.
 *
 * WHY THE MOVE IS A `sequence` AND NOT FOUR `.to()` CALLS. The source
 * interpolates its OWN two angles linearly; phi/theta/tilt are a
 * nonlinear function of those, and driving them straight to the endpoint
 * would trace a different arc through the same two poses. Sampled along
 * the source's parameter, they go
 *
 *   u      0     0.25    0.50    0.75    1.00
 *   phi    0    -0.022  -0.144  -0.382  -0.846   (rad)
 *   theta  0    -0.169  -0.401  -0.574  -0.643
 *   tilt   0    +0.133  +0.357  +0.638  +1.083
 *
 * — phi accelerating throughout while theta saturates and turns back a
 * little at the end. So the waypoints below are the true path, sampled
 * at 24 steps of the source's own interpolation, and handed to
 * `Param.sequence`. The residual infidelity is that `sequence` eases
 * each little segment rather than the whole (timeline.ts:202, 232), so
 * the speed wobbles within a segment; at 24 samples over a 2.67 s move
 * that is bounded by ~110 ms of local time distortion along a path whose
 * points are exact, and it is invisible at 5 fps. The alternative — a
 * rig-orbit channel in dream.ts — buys that last wobble at the price of
 * a new concept in the Observer, and the S04 gate exists precisely to
 * discourage paying it.
 *
 *
 * ══ THE CONSTRUCTIONS ══════════════════════════════════════════════════
 *
 * THE FOUR LOGOS. `AppleLogo` and its three siblings are
 * `SVG(<name>)` (vector_graphics.py:203-229) — and crucially WITHOUT
 * `line_only=True`, which is the flag Scene00's David passes. That
 * matters twice over:
 *
 *   1. A plain SVG goes through the SplineObject branch with
 *      `clipping="inside"` (vector_graphics.py:73-77), i.e. it gets a
 *      fill surface. `Create` on anything whose base class is `SVG`
 *      dispatches `DrawThenFillCompletely`, not `Draw`
 *      (animator.py:951-953). That is why the marks in the film are
 *      solid and not outlines, and the reference shows the flood
 *      arriving as a step: total ink jumps 5131 → 16642 between
 *      f_01738 and f_01739 while the draw is still finishing.
 *   2. The Amazon mark has a HOLE — the counter of the "a". Its four
 *      subpaths carry signed areas -3998, -741, -21929, +2294, and that
 *      last one is nested inside the third with the opposite winding.
 *      Filling it as a fan per closed loop would flood the counter
 *      solid; the even-odd interior (render/fill.ts `setPolygons`,
 *      geometry/evenodd.ts) is what makes it a letter. The other three
 *      marks are unions of disjoint loops — Apple is body plus leaf,
 *      Microsoft four separate squares, Google a single path — and fill
 *      correctly either way.
 *
 * `scale=1/4` is stated as the scale it is; the drawings keep their own
 * geometry, as Scene07_1's head does.
 *
 * THE ANCHOR IS EMPTY AND THAT IS THE POINT. `anchor = CObject()` is a
 * bare null at the origin — nothing draws there. The four tensions all
 * point INTO it, so for the first four seconds the scene shows four
 * corporations pulling hard on a thing that is not visible. It is only
 * when the anchor lifts (`Transform(anchor, y=80)`, out of the plane,
 * beginning a third of the way through the move) that the arrows bow and
 * the cylinder is drawn where they converge. A `Null` here, and the
 * Connections track it live because `Connection.refresh` reads its
 * anchors' world positions every frame (parts/curves.ts:487-495) —
 * so the bowing is free and is not animated separately.
 *
 * The tension endpoints are the same tuple-to-null conversion Scene08
 * uses (mograph.py:97-113), at ±30 from each logo's own centre — the
 * source writes them as `(-30, 0, 0)` etc. and they are WORLD points,
 * so they sit just inside the origin side of each mark. Only
 * `offset_start=0.25` is given; `offset_end` keeps its 0.1 default,
 * which is the small gap the arrowheads leave short of the centre.
 *
 * THE CYLINDER'S AXIS IS +Z, NOT +Y. `Cylinder(y=125, scale=1/2)`
 * carries no rotation, so its pose is entirely the primitive's own axis
 * — and pydeation sets `PRIM_AXIS = 4` on every Cylinder it makes
 * (object.py:869), which is C4D's +Z, not the default +Y. In core's
 * basis C4D's +Z is our +y, and core's Cylinder already runs along local
 * +y, so the source's cylinder needs NO rotation here either. The frame
 * settles it: projected through the end pose, a +y cylinder puts its
 * caps at (572, 120) and (715, 175) — the shallow lower-left to
 * upper-right diagonal f_01770 shows — while the +z alternative would
 * stand it bolt upright with both caps on x = 640, which the frame
 * refutes outright. Its centre, C4D (0, 125, 0), is core (0, 0, 125):
 * 125 units out of the picture plane, toward the viewer.
 *
 *
 * ══ THE TIMELINE ══════════════════════════════════════════════════════
 *
 * The source declares `offset=405`. The scene runs 345.8 to 360.0 in the
 * published video — 59 seconds AHEAD of its cue, because Scene08_1 and
 * Scene08_2 were cut from the film entirely (see Scene08.ts). As with
 * Scene07_1 and Scene08, the re-cut is a pure translation: nothing
 * inside the scene is re-timed.
 *
 * Measured off frames5, against the source's own cumulative times:
 *
 *   video  beat                                    source localT
 *   346.0  first ink — Create(big_tech) begins             0.0
 *   347.8  the fill floods (ink 5131 → 16642)             ~2.5
 *   348.8  draw complete, ink plateaus                     3.0
 *   349.8  the four tensions are in                        4.0
 *   353.8  the move ends; cylinder complete                8.0
 *   356.8  the hold ends                                  11.0
 *   359.8  gone                                           14.0
 *
 * Six landmarks at the declared intervals from t0 = 345.8, so nothing
 * inside the scene is fitted and START_OFFSET stays 0.
 */

import { Dream, render } from "../../src/index"
import { Create, UnCreate, Erase } from "../../src/verbs"
import { Null } from "../../src/parts/primitives"
import { Connection } from "../../src/parts/curves"
import { Sketch } from "../../vocabulary/Sketch/Sketch"
import { Cylinder } from "../../vocabulary/Cylinder/Cylinder"
import {
  appleLogo,
  amazonLogo,
  googleLogo,
  microsoftLogo,
} from "../../vocabulary/Sketch/assets/index"
import { together } from "../../src/anim"
import { BLUE, RED, WHITE, STROKE_MAIN } from "../video01/palette"

/**
 * Zero, and not fitted — the six landmarks above land on the source's
 * own cumulative times. The scene's whole correction is its START,
 * which the re-cut moved 59.2s ahead of `offset=405` to 345.8, and that
 * lives in the gauntlet's t0.
 */
const START_OFFSET = 0

/** `scale=1/4` on all four marks. */
const LOGO_SCALE = 1 / 4

/**
 * The rig's true path, sampled at 24 equal steps of the SOURCE's own
 * linear interpolation of (camera_group p: 0→PI/3, h: 0→PI/4) and
 * (camera y: 1000→700, z: 0→25), then read out as Observer coordinates.
 * Derived in the header; the endpoint is the pose verified against
 * f_01770 to 18 px across five objects.
 *
 * These are radians and world units. They are not hand-tuned: they are
 * the output of composing the rig and solving for (phi, theta, tilt,
 * radius) at each step.
 */
const RIG_PHI = [
  0.0, -0.00139, -0.00558, -0.01258, -0.02242, -0.03515, -0.05082, -0.06949,
  -0.09124, -0.11614, -0.14425, -0.17563, -0.21034, -0.2484, -0.28979,
  -0.33447, -0.38232, -0.43318, -0.48683, -0.54295, -0.60119, -0.6611,
  -0.72224, -0.78409, -0.84619,
]
const RIG_THETA = [
  0.0, -0.04256, -0.08495, -0.12703, -0.16868, -0.20973, -0.25004, -0.28944,
  -0.32779, -0.36489, -0.40057, -0.43464, -0.46691, -0.49715, -0.52517,
  -0.55075, -0.57369, -0.59377, -0.61083, -0.62469, -0.63521, -0.64231,
  -0.64593, -0.64605, -0.64271,
]
const RIG_TILT = [
  0.0, 0.03275, 0.06569, 0.09897, 0.1328, 0.16732, 0.20274, 0.23921, 0.2769,
  0.31597, 0.35658, 0.39885, 0.44289, 0.48878, 0.53655, 0.5862, 0.63764,
  0.69076, 0.74532, 0.80106, 0.8576, 0.91455, 0.97142, 1.02773, 1.08298,
]
const RIG_RADIUS = [
  1000.0, 987.5, 975.0, 962.51, 950.01, 937.51, 925.02, 912.53, 900.04,
  887.55, 875.06, 862.58, 850.09, 837.61, 825.13, 812.65, 800.17, 787.7,
  775.23, 762.76, 750.29, 737.82, 725.36, 712.9, 700.45,
]

export class Scene10Dream extends Dream {
  // The four marks. pydeation's z is our y, so google (z=-150) is BELOW
  // and microsoft (z=150) ABOVE — which is what the reference shows.
  apple = new Sketch({
    data: appleLogo,
    x: -150,
    tint: BLUE,
    scale: LOGO_SCALE,
    stroke: STROKE_MAIN,
  })
  amazon = new Sketch({
    data: amazonLogo,
    x: 150,
    tint: BLUE,
    scale: LOGO_SCALE,
    stroke: STROKE_MAIN,
  })
  google = new Sketch({
    data: googleLogo,
    y: -150,
    tint: RED,
    scale: LOGO_SCALE,
    stroke: STROKE_MAIN,
  })
  microsoft = new Sketch({
    data: microsoftLogo,
    y: 150,
    tint: RED,
    scale: LOGO_SCALE,
    stroke: STROKE_MAIN,
  })

  // `anchor = CObject()` — an empty null at the origin. Nothing is drawn
  // there; the four arrows point at a thing that is not visible until it
  // lifts out of the plane and the cylinder is drawn around it.
  anchor = new Null()

  // The tension endpoints on each mark: the source's `(±30, 0, 0)` and
  // `(0, 0, ±30)` world tuples, in our basis.
  fromApple = new Null({ x: -30 })
  fromAmazon = new Null({ x: 30 })
  fromGoogle = new Null({ y: -30 })
  fromMicrosoft = new Null({ y: 30 })

  // Each tension runs from a point beside its mark to the anchor, with a
  // quarter trimmed off the mark end and the default tenth off the
  // anchor end. They track the anchor as it lifts.
  tensionApple = new Connection(this.fromApple, this.anchor, {
    offsetStart: 0.25,
    stroke: STROKE_MAIN,
  })
  tensionAmazon = new Connection(this.fromAmazon, this.anchor, {
    offsetStart: 0.25,
    stroke: STROKE_MAIN,
  })
  tensionGoogle = new Connection(this.fromGoogle, this.anchor, {
    offsetStart: 0.25,
    stroke: STROKE_MAIN,
  })
  tensionMicrosoft = new Connection(this.fromMicrosoft, this.anchor, {
    offsetStart: 0.25,
    stroke: STROKE_MAIN,
  })

  // Cylinder(y=125, scale=1/2). PRIM_AXIS=4 is C4D's +Z, which is our
  // +y — core's own default axis — so no rotation. C4D's y=125 is 125
  // units out of the picture plane: our z.
  cylinder = new Cylinder({
    z: 125,
    scale: 1 / 2,
    tint: WHITE,
    stroke: STROKE_MAIN,
  })

  unfold() {
    // CONFIG camera_perspective "front", camera_position (0,0), zoom 1.
    this.observer.look("front")

    this.wait(START_OFFSET)
    // Create on an SVG subclass is DrawThenFillCompletely — the marks
    // draw as outlines and flood solid. Group order is the source's.
    this.play(
      together(
        Create(this.apple),
        Create(this.amazon),
        Create(this.google),
        Create(this.microsoft),
      ),
      3,
    )
    this.play(
      together(
        Create(this.tensionApple),
        Create(this.tensionAmazon),
        Create(this.tensionGoogle),
        Create(this.tensionMicrosoft),
      ),
      1,
    )
    // The move. Four things on one 4s span at three different reaches:
    // the rig swings and dollies over the first two thirds, the anchor
    // lifts over the last two thirds, and the cylinder draws in the
    // final third. The rig's four channels are one gesture and share
    // the same window.
    this.play(
      together(
        [this.observer.phi.sequence(...RIG_PHI), 0, 2 / 3],
        [this.observer.theta.sequence(...RIG_THETA), 0, 2 / 3],
        [this.observer.tilt.sequence(...RIG_TILT), 0, 2 / 3],
        [this.observer.radius.sequence(...RIG_RADIUS), 0, 2 / 3],
        [this.anchor.z.to(80), 1 / 3, 1],
        [Create(this.cylinder), 2 / 3, 1],
      ),
      4,
    )
    this.wait(3)
    // `Erase` on the tensions, not UnCreate: the arrows are consumed
    // from their start, while the marks and the cylinder un-draw.
    this.play(
      together(
        UnCreate(this.cylinder),
        UnCreate(this.apple),
        UnCreate(this.amazon),
        UnCreate(this.google),
        UnCreate(this.microsoft),
        Erase(this.tensionApple),
        Erase(this.tensionAmazon),
        Erase(this.tensionGoogle),
        Erase(this.tensionMicrosoft),
      ),
      3,
    )
  }
}

if (import.meta.main) render(Scene10Dream)
