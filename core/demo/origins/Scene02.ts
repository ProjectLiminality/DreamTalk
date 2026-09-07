/**
 * Scene02.ts — A DreamWeaving
 *
 * "The Origins of Project Liminality" (2024), Scene 02 — the pie that
 * comes apart.
 *
 * A white disc draws itself as three ring segments and floods solid.
 * Then the three pieces slide apart — a little at first, opening seams
 * where they touched — and then fly out to the edges of the frame while
 * arrows reach after them from the abandoned centre and each piece takes
 * on a colour of its own. Green, blue, red, held apart for six seconds,
 * and then drained and undrawn.
 *
 * Source (refs/PydeationProjects/pitch/InterfaceGuy/pitch/pitch.py:170-232):
 *
 *   CONFIG = camera_perspective "front", camera_zoom 3/4
 *   offset = 50
 *   anchor1..3 = CObject(x=offset)
 *   segment1..3 = Arc(mode="ring", angle=2*PI/3, symmetrical=True)
 *   slice1 = Group(segment1, anchor1, h=PI/2)
 *   slice2 = Group(segment2, anchor2, h=2*PI/3 + PI/2)
 *   slice3 = Group(segment3, anchor3, h=4*PI/3 + PI/2)
 *   pie = Group(slice1, slice2, slice3)
 *   vector1..3 = Connection((0,0,0), anchorN, unpack_group=False)
 *   force = Group(vector1, vector2, vector3)
 *   self.audio(…, offset=71)
 *   self.add(pie, force)
 *   self.play(DrawThenFillCompletely(pie), run_time=2)
 *   self.wait(1)
 *   self.play(Transform(segmentN, x=20, parts=False,
 *                       smoothing_left=0, smoothing_right=0), run_time=5)
 *   self.play(Create(force),
 *             Transform(segmentN, anchorN, x=100),
 *             ChangeColor(segment1, color=GREEN),
 *             ChangeColor(segment2, color=BLUE),
 *             ChangeColor(segment3, color=RED),
 *             run_time=6)
 *   self.wait(6)
 *   self.play(UnFillThenUnDraw(pie), Erase(force), run_time=5)
 *
 *
 * THE CONSTRUCTION — WHY A GROUP PER SLICE
 *
 * Each segment is a 120-degree ring sector, `symmetrical=True`, so it
 * straddles its own zero rather than trailing it (parts/primitives.ts:
 * AnnularSector). Three of them at headings 90, 210 and 330 degrees
 * therefore tile a full disc with no gaps.
 *
 * The GROUP is what makes the scene work. A segment moved in world x
 * would slide all three the same way; moved inside its own turned group
 * it slides along that group's local +x, which is RADIALLY OUTWARD from
 * the disc's centre — one gesture written once, three directions. The
 * anchor rides in the same frame at local x=50, so the arrows that later
 * chase the pieces are aimed by the same rotation and need no angles of
 * their own.
 *
 * pydeation's `h` is our `b`: the 2021 primitives are built in the XZ
 * plane and a heading turns them about C4D's Y, which is the axis out of
 * that plane — an IN-plane rotation. Ours are built in XY, where the
 * in-plane turn is the bank (the same reading demo/video01/S02.ts made:
 * "the legacy heading is our bank"). The sign is not flipped, and the
 * reference says so directly: on f_00648, with the colours already
 * applied, the three coloured centroids sit at 90, -149 and -30 degrees
 * against source headings of 90, 210 and 330 — the same three angles,
 * unmirrored.
 *
 *
 * FRAMING (zoom 3/4, front — measured)
 *
 * A perspective ThreeDScene realizes zoom as camera distance
 * (dream.ts distanceForZoom: 1000/zoom), so 3/4 puts the camera 1333.33
 * units out and the 36mm rig's f = 1280px scales the origin plane by
 * 1280/1333.33 = 0.96 px per world unit.
 *
 * The ring's own two radii are C4D's defaults — pydeation sets
 * `radius=200` (object.py:773) and never touches the inner radius, which
 * the Arc primitive defaults to 100. f_00380, the assembled white disc,
 * measures an outer radius of 200.5px and a hole of 101.5px. Against a
 * 0.96 scale those predict 192 and 96, which is 4% under; the reference
 * is 200/101.5, i.e. essentially 1.00 px/unit.
 *
 * The 4% is the stroke and the encode: the disc is measured to its OUTER
 * ink edge (a ~2px line, half of it outside the nominal radius) and JPEG
 * bloom on a hard white-on-black edge adds another pixel or so. 192 + 1
 * (half stroke) + bloom lands within the measurement's own error, and
 * the HOLE measures the same way in the opposite direction (96 nominal,
 * ink narrowing it, 101.5 read) — so the two disagree with the model in
 * OPPOSITE directions, which is what an ink-width artefact does and what
 * a wrong camera scale cannot. Nothing here is fitted.
 *
 *
 * THE TIMELINE
 *
 * offset=71 is the audio cue; the video's black gap runs 70.6-71.4s
 * (report §0). Scene time is then verbatim from the source: 2s of
 * draw-and-flood, a 1s hold, 5s of the first parting, 6s of the flight
 * out, 6s held, 5s to close — 25 seconds, ending exactly where Scene03's
 * offset=96 begins.
 */

import { Dream, render } from "../../src/index"
import { Holon } from "../../src/holon"
import { AnnularSector, Group, Null } from "../../src/parts/primitives"
import { Connection } from "../../src/parts/curves"
import {
  ChangeColor,
  Create,
  DrawThenFillCompletely,
  Erase,
  UnFillThenUnDraw,
} from "../../src/verbs"
import { eased, together } from "../../src/anim"
import { BLUE, GREEN, PI, RED, WHITE } from "../../src/constants"
import { STROKE_MAIN } from "../video01/palette"

/**
 * The head between the audio cue (offset=71, which the scorer takes as
 * localT 0) and the scene's first frame — the ONE fitted number, carried
 * as a leading wait so every run_time and wait below stays verbatim.
 *
 * Fitted by sweeping, not by reading a first-ink landmark: an eased draw
 * spends part of its window below the encode's threshold before it
 * lights a pixel, so every landmark reads late and a fit from one puts
 * the scene behind (the lesson Scene05's header records at length).
 *
 * The sweep here is over CURVES rather than over the overlay's verdict,
 * because the overlay thresholds luminance at 32/255 and this scene's
 * whole middle act is a wash crossing that threshold: at the flood's
 * midpoint a 12-luma difference between two otherwise identical frames
 * flips a whole region in or out of the line mask, and the verdict
 * swings on it. So the fit is a least-squares match of two measured
 * curves against the reference's — lit-pixel count during the draw, and
 * mean luminance inside the ring band (r ∈ [115, 185] px) during the
 * flood — over f_00357 to f_00365:
 *
 *   offset   0.16    0.20    0.24    0.28    0.32    0.36    0.40
 *   sse      .0387   .0078   .0042   .0033   .0058   .0109   .0192
 *
 * A clean minimum at 0.28 with a basin from 0.24 to 0.30. With it the
 * play runs video 71.28-73.28: the outline closes at 72.48 (reference:
 * complete at f_00362, 72.4) and the flood runs 72.28-73.28 (reference:
 * ring interior 46, 145, 226, 253 across f_00362-f_00365).
 */
const START_OFFSET = 0.28

/**
 * One slice of the pie: the ring segment and the anchor its force vector
 * will aim at, in a frame turned to the slice's own heading — the
 * source's `Group(segmentN, anchorN, h=…)`, whose turn is load-bearing
 * (see the header).
 *
 * A plain Holon with two declared fields, NOT core's `Group`. The two
 * spell the same structure, but `Group` exists for holons built
 * elsewhere and handed over, and its `members` are adopted THROUGH the
 * same path a declared field takes — so listing a declared field in
 * `members` registers it twice, and every deep verb then stamps two
 * identical tracks on each param. That is not merely wasteful: the
 * Timeline resolves a param's tracks chronologically, and two segments
 * sharing a start collapse to a step. It cost the flood of this scene
 * its whole 1s ease before the duplication was found.
 */
export class Slice extends Holon {
  /**
   * Where the segment and the anchor start along the slice's own +x, and
   * what colour the segment is — the three things Scene04 states
   * differently for the same construction (segment at 120 rather than 0,
   * anchor at 170 rather than 50, a colour baked in rather than animated
   * on). Plain config fields, not params: they are read once, at
   * construction, exactly as the source's constructor arguments are.
   */
  segmentX = 0
  anchorX = 50
  segmentTint = WHITE

  segment = new AnnularSector({
    // Arc(mode="ring", angle=2*PI/3, symmetrical=True): the sweep
    // straddles the slice's heading, ±60 degrees.
    startAngle: -PI / 3,
    endAngle: PI / 3,
    stroke: STROKE_MAIN,
  })
  // CObject(x=offset) — invisible, pure transform; the arrow's target.
  anchor = new Null()

  protected override compose(): void {
    this.segment.x.defaultValue = this.segmentX
    this.segment.x.value = this.segmentX
    this.segment.tint.defaultValue = this.segmentTint
    this.segment.tint.value = this.segmentTint
    this.anchor.x.defaultValue = this.anchorX
    this.anchor.x.value = this.anchorX
  }
}

/**
 * The three headings the source gives its slices — `h=PI/2`,
 * `2*PI/3 + PI/2`, `4*PI/3 + PI/2` — as our bank. Stated once because
 * Scene04 rebuilds the same pie (see Scene04.ts).
 */
export const SLICE_HEADINGS = [PI / 2, (2 * PI) / 3 + PI / 2, (4 * PI) / 3 + PI / 2] as const

export class Scene02Dream extends Dream {
  slice1 = new Slice({ b: SLICE_HEADINGS[0] })
  slice2 = new Slice({ b: SLICE_HEADINGS[1] })
  slice3 = new Slice({ b: SLICE_HEADINGS[2] })
  pie = new Group({ members: [this.slice1, this.slice2, this.slice3] })

  // Connection((0,0,0), anchorN) — from the world origin out to each
  // anchor, arrowhead at the anchor end. The origin is a bare Null
  // standing for the source's (0,0,0) tuple, which pydeation itself
  // converts to a CObject (mograph.py:104-109).
  private origin = new Null()
  vector1 = new Connection(this.origin, this.slice1.anchor, { tint: WHITE, stroke: STROKE_MAIN })
  vector2 = new Connection(this.origin, this.slice2.anchor, { tint: WHITE, stroke: STROKE_MAIN })
  vector3 = new Connection(this.origin, this.slice3.anchor, { tint: WHITE, stroke: STROKE_MAIN })
  force = new Group({ members: [this.vector1, this.vector2, this.vector3] })

  unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(3 / 4))
    this.stage(this.origin)

    this.wait(START_OFFSET)

    // DrawThenFillCompletely(pie), 2s — the outline closes at 1.2s and
    // the white floods in from 1.0s to 2.0s (verbs.ts, animator.py:498).
    this.play(DrawThenFillCompletely(this.pie), 2)
    this.wait(1)

    // Transform(segmentN, x=20, parts=False, smoothing_left=0,
    // smoothing_right=0) — the seams open. Both tangents zeroed is a
    // LINEAR move: the pieces part at a constant rate for five seconds
    // and stop dead, which is why the parting reads as pressure rather
    // than as an ease.
    this.play(
      eased(
        "linear",
        this.slice1.segment.x.by(20),
        this.slice2.segment.x.by(20),
        this.slice3.segment.x.by(20),
      ),
      5,
    )

    // Create(force) + Transform(segmentN, anchorN, x=100) + three
    // ChangeColors, all over one 6s span. The source passes TWO objects
    // to each Transform — the segment AND its anchor — so the arrow's
    // target flies out with the piece it is chasing and the vector grows
    // rather than merely rotating.
    this.play(
      together(
        Create(this.force),
        this.slice1.segment.x.by(100),
        this.slice1.anchor.x.by(100),
        this.slice2.segment.x.by(100),
        this.slice2.anchor.x.by(100),
        this.slice3.segment.x.by(100),
        this.slice3.anchor.x.by(100),
        ChangeColor(this.slice1.segment, GREEN),
        ChangeColor(this.slice2.segment, BLUE),
        ChangeColor(this.slice3.segment, RED),
      ),
      6,
    )
    this.wait(6)

    // UnFillThenUnDraw(pie) + Erase(force), 5s. The pie drains to a line
    // drawing over the first 3s and retracts over the last 2.5; the
    // arrows sweep away front-to-back rather than retracting, which is
    // the source's own asymmetry (Erase, not UnDraw).
    this.play(together(UnFillThenUnDraw(this.pie), Erase(this.force)), 5)
  }
}

if (import.meta.main) render(Scene02Dream)
