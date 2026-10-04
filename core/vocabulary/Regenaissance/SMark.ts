/**
 * SMark — the red mark in the Regenaissance vesica: an S-curve with a dot
 * riding its upper bowl and a square sitting in its lower one.
 *
 * NAME. Its real name was not found. The vault shows the mark in two places —
 * the Regenaissance DreamTalk (WelcomeToTheRegenaissance.png, inside the
 * eye) and DreamTalkVocabulary/MetaphysicalSymbiosis (inside a head, under
 * the words "Guidance" and "Service") — and neither DreamNode names it. So it
 * is named for what it is, neutrally, until David says otherwise.
 *
 * MEASURED, off WelcomeToTheRegenaissance.png (1080², the mark at 3× zoom):
 * the white ring around it has radius R ≈ 100 px, centre (540, 540). In
 * units of R (holon frame, y up, u = the 45° up-right diagonal):
 *
 *   dot centre      D = +0.38·R along u     (568, 513 px → +27, +27)
 *   square centre   Q = −0.38·R along u     (514.5, 567 px → −26, −27)
 *   dot radius      0.15·R                   (≈ 15 px)
 *   square side     0.25·R, axis-aligned     (25 × 24 px)
 *   S band width    0.08·R                   (≈ 8 px)
 *   S tips          ±0.76·R along u          ((593, 489), (485, 593) px)
 *   colour          rgb(237, 110, 87)
 *
 * The S is TWO SEMICIRCLES, point-symmetric about the centre — the
 * construction the numbers leave no room to doubt: the upper bowl is the
 * circle about D of radius |D| (its centreline tops out at 479 px, 34 above
 * D; its left side at 531, 37 left of D), the lower bowl the circle about Q
 * of the same radius, and the two kiss tangentially AT THE CENTRE. The dot
 * sits at its bowl's centre and so does the square: each mark is the eye of
 * its half, the yin-yang's two dots made one round and one square. The upper
 * bowl runs from the tip (45°) counter-clockwise over the top to the centre
 * (225°); the lower from the centre (45° about Q) clockwise under the bottom
 * to the tip (−135°). The tips are cut radially, as the reference's are.
 *
 * The S is a solid BAND (a filled outline), not a pixel-width stroke: the
 * mark is a shape of its own proportions, so its weight must scale with it.
 * Its outline carries no pen of its own — a stroke along the band's edges
 * adds a constant screen weight to both sides, which at a few pixels tall
 * doubled the band and swelled the S into a blob. The PEN runs the band's
 * CENTRELINE instead (sCentreline: the same two semicircles, radius 0.38·R),
 * at a fixed weight (SMARK_PEN) inside the band: where the band is wider it
 * vanishes into it, and where the mark is drawn so small that the true band
 * would thin below a pixel the pen holds the S at that weight — the honest
 * minimum, since the S IS one stroke, two semicircles drawn tip to tip.
 * Create runs that pen tip to tip, then floods the band; the dot and square
 * bloom last.
 */

import { Circle, Line, Null, Stroke, type Vec3Like } from "../../src/parts/primitives"
import { color, length } from "../../src/params"
import { type Color, rgb } from "../../src/constants"
import { type Anim, restage, together } from "../../src/anim"

/** The mark's red, sampled from the reference. */
export const MARK_RED: Color = rgb(237, 110, 87)

/** The proportions, in units of the mark's radius (see header). */
export const SMARK = {
  offset: 0.38,
  dot: 0.15,
  square: 0.25,
  band: 0.08,
} as const

/** The S band's closed outline, radius `R`, holon frame (y up). */
/** The pen's weight on the centreline: the S's thinnest, in screen px (Stroke). */
export const SMARK_PEN = 1.5

/** The S's centreline, tip → centre → tip: two semicircles of radius
 *  0.38·R about ±D, kissing at the centre. Holon frame (y up). */
export const sCentreline = (R: number, samples = 40): Vec3Like[] => {
  const k = SMARK.offset * R
  const c = k * Math.SQRT1_2
  const q = Math.PI / 4
  const out: Vec3Like[] = []
  // Upper bowl CCW about D from the tip to the centre, lower bowl CW about Q on to the other tip.
  for (let i = 0; i <= samples; i++) {
    const a = q + (Math.PI * i) / samples
    out.push({ x: c + k * Math.cos(a), y: c + k * Math.sin(a), z: 0 })
  }
  for (let i = 1; i <= samples; i++) {
    const a = q - (Math.PI * i) / samples
    out.push({ x: -c + k * Math.cos(a), y: -c + k * Math.sin(a), z: 0 })
  }
  return out
}

export const sBandOutline = (R: number, samples = 40): Vec3Like[] => {
  const k = SMARK.offset * R
  const w = (SMARK.band * R) / 2
  const c = Math.SQRT1_2
  const D = { x: k * c, y: k * c }
  const Q = { x: -k * c, y: -k * c }
  const arc = (o: { x: number; y: number }, rad: number, a0: number, a1: number): Vec3Like[] => {
    const out: Vec3Like[] = []
    for (let i = 0; i <= samples; i++) {
      const a = a0 + ((a1 - a0) * i) / samples
      out.push({ x: o.x + rad * Math.cos(a), y: o.y + rad * Math.sin(a), z: 0 })
    }
    return out
  }
  const q = Math.PI / 4
  // Walk the band's one side tip → centre → tip, then the other side back.
  // Upper bowl (CCW about D): its left side is the INNER edge (k − w); the
  // lower bowl runs CW about Q, so its left side is the OUTER edge (k + w).
  // The two meet continuously at the centre, where the bowls are tangent.
  const sideA = [...arc(D, k - w, q, q + Math.PI), ...arc(Q, k + w, q, q - Math.PI).slice(1)]
  const sideB = [...arc(Q, k - w, q - Math.PI, q), ...arc(D, k + w, q + Math.PI, q).slice(1)]
  const loop = [...sideA, ...sideB]
  loop.push({ ...loop[0]! })
  return loop
}

export class SMark extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The mark's radius: the circle it is drawn to fill (the white ring in
   *  the Regenaissance eye). Every proportion is a fraction of it. */
  radius = length(100)

  /** One red for all three parts — the mark is single-coloured. */
  tint = color(MARK_RED)

  band!: Stroke
  /** The pen along the S's centreline (sCentreline), SMARK_PEN wide. */
  spine!: Line
  dot!: Circle
  square!: Line

  protected override compose(): void {
    const R = this.radius.value
    const k = SMARK.offset * R * Math.SQRT1_2
    // The band is a DRAWING — a Stroke whose child is one closed Line —
    // because that is the wash the host triangulates properly (a concave
    // loop; a lone Line's wash is a centroid fan, right only for convex
    // shapes). The square is convex, so its own Line's fan is exact. The
    // outline is the wash's edge only — never inked (even a stroke-0 line
    // draws a hairline); the pen is the spine.
    this.band = this.add(new Stroke({ tint: this.tint, stroke: 0, fillOpacity: 1 }))
    ;(this.band as unknown as { add(h: Line): Line }).add(
      new Line({ points: sBandOutline(R), tint: this.tint, stroke: 0, opacity: 0 }),
    )
    this.spine = this.add(new Line({ points: sCentreline(R), tint: this.tint, stroke: SMARK_PEN }))
    this.dot = this.add(
      new Circle({ x: k, y: k, radius: SMARK.dot * R, tint: this.tint, stroke: 0, fillOpacity: 1 }),
    )
    const a = (SMARK.square * R) / 2
    this.square = this.add(
      new Line({
        points: [
          { x: -k - a, y: -k - a, z: 0 },
          { x: -k + a, y: -k - a, z: 0 },
          { x: -k + a, y: -k + a, z: 0 },
          { x: -k - a, y: -k + a, z: 0 },
          { x: -k - a, y: -k - a, z: 0 },
        ],
        tint: this.tint,
        stroke: 0,
        fillOpacity: 1,
      }),
    )
  }

  /** The pen runs the S tip to tip, the band floods, then the dot and the
   *  square — the two eyes — open together. */
  override createAnim(): Anim {
    void this.parts // compose() is lazy: the parts exist once it has run
    return together(
      restage(this.spine.creation.sequence(0, 1), 0, 0.6),
      restage(this.band.fillOpacity.sequence(0, 1), 0.45, 0.8),
      restage(this.dot.opacity.sequence(0, 1), 0.7, 1),
      restage(this.square.opacity.sequence(0, 1), 0.7, 1),
    )
  }
}
