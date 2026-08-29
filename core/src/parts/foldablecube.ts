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
 * The C4D original offers `filled=True` (black face fills so the cube
 * occludes what it wraps). The host currently fills only Ellipses
 * (render/fill.ts — the sanctioned iris/pupil entry), so face fills are
 * NOT implemented here; on the black ground the difference is invisible
 * until the cube must occlude another symbol. When that day comes the
 * render diff is: extend FillShape to accept a Rectangle (its polyline
 * is already convex — the same fan triangulation the ellipse uses).
 */

import { derive, bipolar, color, length } from "../params"
import { Group, Rectangle, Stroke } from "./index"
import { BLUE, PI } from "../constants"

export class FoldableCube extends Stroke {
  /** Edge length of every face (the original's 100×100×100). */
  size = length(100)
  /** −1 wrapped … 0 flat … +1 open cup. */
  fold = bipolar(0)
  override tint = color(BLUE)

  /** The static bottom face, lying in the local x–z plane. */
  bottom = new Rectangle({
    width: this.size,
    height: this.size,
    p: PI / 2,
    tint: this.tint,
    stroke: this.stroke,
  })

  // The four hinges: a pivot on each bottom edge, its wall a member
  // rectangle offset half a size outward so the hinge line IS the
  // shared edge. Rotating the pivot swings the wall; the wall never
  // moves in its own frame — exactly the original's construction.
  // (Group, not a raw field, because the wall must be a part of the
  // PIVOT — a field here would register it as the cube's own part and
  // the hinge would turn without it.)
  frontPivot = this.hinge({ z: this.size.times(0.5) }, () => -this.foldAngle)
  backPivot = this.hinge({ z: this.size.times(-0.5) }, () => this.foldAngle, "p")
  rightPivot = this.hinge({ x: this.size.times(0.5) }, () => this.foldAngle, "b")
  leftPivot = this.hinge({ x: this.size.times(-0.5) }, () => -this.foldAngle, "b")

  private get foldAngle(): number {
    return (this.fold.value * PI) / 2
  }

  private hinge(
    offset: Record<string, unknown>,
    angle: () => number,
    axis: "p" | "b" = "p",
  ): Group {
    return new Group({
      ...offset,
      [axis]: derive(angle),
      members: [
        new Rectangle({
          width: this.size,
          height: this.size,
          p: PI / 2,
          tint: this.tint,
          stroke: this.stroke,
          ...offset,
        }),
      ],
    })
  }

  /** The four walls, front/back/right/left — members of their pivots. */
  get walls(): readonly Rectangle[] {
    return [this.frontPivot, this.backPivot, this.rightPivot, this.leftPivot].map(
      (pivot) => pivot.members[0] as Rectangle,
    )
  }
}

/** The hinge law, stated once for tests and composers: pivot angle for a
 *  given fold. The sign pattern per face is the class's own business. */
export const hingeAngle = (fold: number): number => (fold * PI) / 2
