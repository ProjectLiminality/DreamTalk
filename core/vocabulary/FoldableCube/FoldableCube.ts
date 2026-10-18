/**
 * FoldableCube — the narrative container of the TheWall holarchy: five
 * square faces, an open top, and one Bipolar degree of freedom.
 *
 * Ported from the C4D original (TheWall/DreamTalk/objects/
 * custom_objects.py:1452 — FoldableCube): the bottom face is static in
 * the cube's local x–z plane; the four side faces hang on pivot Groups
 * sitting ON the bottom face's edges (±size/2), each wall offset half a
 * size outward from its hinge. The hinge angle is fold · PI/2:
 *
 *   fold = 1   walls upright (+y) — the OPEN cup, its top missing
 *              ("the illusion is incomplete but the trapped mind
 *              doesn't see it")
 *   fold = 0   walls flat — the unfolded cross
 *   fold = −1  walls folded through to −y — wrapped around the far
 *              side, enclosing whatever the cube was pressed against
 *
 * Verified against the reference render (MindVirus.mp4): at fold 1 the
 * wireframe reads as a complete cube (each wall's top edge supplies one
 * side of the "top" square); at fold ≈ 0.1 the walls flare into the
 * open flower of the jellyfish pulse (f007/f013 of the 5fps extraction).
 *
 * Note the sign convention relative to the source: the original's
 * generator rotates FrontPivot by (0, +angle, 0) in C4D HPB, whose
 * pitch turns +z toward +y. Our host's `p` is a right-handed rotation
 * about x (+z toward −y), so the same physical hinge motion spells with
 * the OPPOSITE sign here — the front pivot follows −fold · PI/2. The
 * geometry, not the spelling, is what the test pins: adjacent wall
 * corners meet exactly at fold = ±1.
 *
 * TAPER — the cube's depth, for the InterBrain film (`taper`, 0..1,
 * default 1). The film's cubes (the Narrative, f5686/f5821; the cage on
 * a domesticated mind, f7021; the boxed web, f5221) are drawn in strong
 * one-point perspective: seen front-on, the back square is 0.72 of the
 * front. A true cube seen from the framework's far camera (1500 units)
 * shows ≈ 0.9–0.94 and reads as a doubled square. `taper` is the BOTTOM
 * face's edge as a fraction of the rim's: below 1 the cup is a right
 * square frustum — the shape a box takes after a one-point projection
 * along its axis, so seen front-on (rim toward the camera) it IS the
 * drawing's perspective cube, and seen from elsewhere it is an honest 3D
 * solid. The depth stays `size`; each wall becomes a trapezoid (hinge
 * edge taper·size, free edge size, in-plane height the slant
 * √(size² + ((1−taper)·size/2)²)) and the hinge's full swing becomes
 * `hingeAngle(1, taper)` = atan2(1, (1−taper)/2), so the walls still lean
 * together and their corners still MEET at fold ±1 (the cup closes, the
 * wrap closes) and lie flat at fold 0 (a cross of trapezoids). At
 * taper 1 every number reduces to the cube above: the walls' polylines
 * are `rectanglePolyline(size, size)` point for point, the hinge swing
 * is PI/2 exactly — no existing scene moves.
 *
 * DEPTH (`depth`, 0..1, default 1) — the cup's depth as a fraction of
 * `size`. A film cube is a 2D drawing: each has its OWN vanishing point
 * at its own centre, so an off-centre cube in the film is still seen
 * dead front-on. A deep solid off-centre is seen from the side by our
 * one camera (the parallax shifts its back square by x·depth/distance).
 * A shallow frustum — a relief — removes that: as depth → 0 the walls
 * lie almost in the rim's plane, filling the band between the rim and
 * the taper·size bottom, and the back/front ratio is the taper itself,
 * wherever the cube sits. The hinge law becomes
 * atan2(depth, (1 − taper)/2), the slant √((depth·size)² +
 * ((1−taper)·size/2)²); corners still meet at fold ±1.
 *
 * The C4D original offers `filled=True` (black face fills so the cube
 * occludes what it wraps). The host currently fills only Ellipses
 * (render/fill.ts — the sanctioned iris/pupil entry), so face fills are
 * NOT implemented here; on the black ground the difference is invisible
 * until the cube must occlude another symbol. When that day comes the
 * render diff is: extend FillShape to accept a Rectangle (its polyline
 * is already convex — the same fan triangulation the ellipse uses).
 */

import { derive, bipolar, color, completion, length } from "../../src/params"
import { Group, Line, Rectangle, Stroke, derivePoints, rectanglePolyline, type Vec3Like } from "../../src/parts/primitives"
import { BLUE, PI } from "../../src/constants"
import { axis, type StateSpace } from "../../src/automaton"

export class FoldableCube extends Stroke {
  /** A sovereign symbol — cast in the editor, a button in the game loop. */
  static sovereign = true
  /** Edge length of every face (the original's 100×100×100). */
  size = length(100)
  /** −1 wrapped … 0 flat … +1 open cup. */
  fold = bipolar(0)
  /** The bottom face's edge as a fraction of the rim's: 1 a true cube; below
   *  1 a frustum — the film's one-point-perspective cube seen front-on. */
  taper = completion(1)
  /** The cup's depth as a fraction of `size`: 1 a cube (or a frustum as deep
   *  as it is wide); toward 0 a relief — the perspective DRAWING of a cube,
   *  which reads front-on wherever it sits on the screen (see header). */
  depth = completion(1)

  /** Walkable (src/automaton.ts): wrapped · flat · open cup — the fold's three named poses. */
  override stateSpace(): StateSpace | undefined {
    if (this.fold.isBound) return undefined
    return {
      axes: [axis("fold", this, { flat: { fold: 0 }, cup: { fold: 1 }, wrapped: { fold: -1 } }, { duration: 1.6, handles: [this] })],
    }
  }
  override tint = color(BLUE)

  /** The static bottom face, lying in the local x–z plane. */
  bottom = new Rectangle({
    width: derive(() => this.size.value * this.taper.value),
    height: derive(() => this.size.value * this.taper.value),
    p: PI / 2,
    tint: this.tint,
    stroke: this.stroke,
  })

  // The four hinges: a pivot on each bottom edge, its wall a member
  // offset half a slant outward so the hinge line IS the shared edge.
  // Rotating the pivot swings the wall; the wall never moves in its own
  // frame — exactly the original's construction. (Group, not a raw
  // field, because the wall must be a part of the PIVOT — a field here
  // would register it as the cube's own part and the hinge would turn
  // without it.) Each wall's outward axis in its own (pre-pitch) frame:
  // the pitch takes local +y to the cube's +z.
  frontPivot = this.hinge("z", 1, { x: 0, y: 1 }, () => -this.foldAngle)
  backPivot = this.hinge("z", -1, { x: 0, y: -1 }, () => this.foldAngle, "p")
  rightPivot = this.hinge("x", 1, { x: 1, y: 0 }, () => this.foldAngle, "b")
  leftPivot = this.hinge("x", -1, { x: -1, y: 0 }, () => -this.foldAngle, "b")

  private get foldAngle(): number {
    return hingeAngle(this.fold.value, this.taper.value, this.depth.value)
  }

  /** A wall's in-plane height: the frustum's slant (= size at taper 1). */
  private get slant(): number {
    return wallSlant(this.size.value, this.taper.value, this.depth.value)
  }

  private hinge(
    along: "x" | "z",
    sign: 1 | -1,
    out: { x: number; y: number },
    angle: () => number,
    axis: "p" | "b" = "p",
  ): Group {
    const wall = new Line({ p: PI / 2, tint: this.tint, stroke: this.stroke, [along]: derive(() => (sign * this.slant) / 2) })
    derivePoints(
      wall,
      () => [this.size.value, this.taper.value, this.depth.value],
      () => wallPolyline(this.size.value, this.taper.value, out, this.depth.value),
    )
    return new Group({
      [along]: derive(() => (sign * this.size.value * this.taper.value) / 2),
      [axis]: derive(angle),
      members: [wall],
    })
  }

  /** The four walls, front/back/right/left — members of their pivots. */
  get walls(): readonly Line[] {
    return [this.frontPivot, this.backPivot, this.rightPivot, this.leftPivot].map(
      (pivot) => pivot.members[0] as Line,
    )
  }
}

/** The hinge law, stated once for tests and composers: pivot angle for a
 *  given fold (and taper — the frustum's walls swing short of upright, by
 *  the lean that makes their slant edges meet). PI/2 at fold 1, taper 1.
 *  The sign pattern per face is the class's own business. */
export const hingeAngle = (fold: number, taper = 1, depth = 1): number => fold * Math.atan2(depth, (1 - taper) / 2)

/** A wall's in-plane height for a cup of depth depth·size and the given taper. */
export const wallSlant = (size: number, taper = 1, depth = 1): number => Math.hypot(depth * size, ((1 - taper) * size) / 2)

/**
 * One wall's closed outline in its own frame: the square's
 * `rectanglePolyline` (same start, same winding) with its hinge edge
 * shrunk to taper·size and its height stretched to the slant. `out` is
 * the wall's outward axis in that frame. At taper 1 it IS the square.
 */
export const wallPolyline = (size: number, taper: number, out: { x: number; y: number }, depth = 1): Vec3Like[] => {
  const h = size / 2
  const L = wallSlant(size, taper, depth)
  return rectanglePolyline(size, size, 0).map((p) => {
    const o = p.x * out.x + p.y * out.y
    const a = p.x * out.y - p.y * out.x
    const t = (o + h) / size
    if (taper === 1 && depth === 1) return { x: p.x, y: p.y, z: 0 }
    const o2 = -L / 2 + t * L
    const a2 = a * (taper + (1 - taper) * t)
    return { x: o2 * out.x + a2 * out.y, y: o2 * out.y - a2 * out.x, z: 0 }
  })
}

/**
 * The taper that makes a front-on cup of edge `size` (and depth
 * depth·size), its rim `distance` from the camera, SHOW a back/front ratio of `apparent` — the camera's own
 * foreshortening d / (d + size) (MolochEye's perspectiveK) supplies the
 * rest (d / (d + depth·size)). Clamped to a true cube.
 */
export const taperFor = (apparent: number, size: number, distance: number, depth = 1): number =>
  Math.min(1, (apparent * (distance + depth * size)) / distance)
