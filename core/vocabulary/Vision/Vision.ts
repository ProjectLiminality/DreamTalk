/**
 * Vision — the red mark: an S-curve with a dot riding its upper bowl and a
 * square sitting in its lower one.
 *
 * NAME. The InterBrain film names it (2026-10-18): it is "Vision" — "an
 * organic vision that reveals itself through inspiration" (narration
 * 18:54), set against Narrative's blue cube (f5686 "Narrative → Vision"),
 * the seed of "vision gardening". It sits in heads (f5716, f7021), in its
 * own red ring with a white light at its heart (f5776 → f5821), and in the
 * liminal eye's iris where the domesticated eye holds its cube (f12691;
 * MolochEye `iris`). Popped out of Regenaissance/, where it was born as
 * `SMark` (that file now only re-exports this one).
 *
 * Before the film: its real name was not found. The vault shows the mark in two places —
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
 * at a fixed weight (VISION_PEN) inside the band: where the band is wider it
 * vanishes into it, and where the mark is drawn so small that the true band
 * would thin below a pixel the pen holds the S at that weight — the honest
 * minimum, since the S IS one stroke, two semicircles drawn tip to tip.
 * Create runs that pen tip to tip, then floods the band; the dot and square
 * bloom last.
  *
 * THE FILM'S LOOKS, as params (measured off the 1280×720 frames):
 *
 *   weight the S band's width in units of R. Regenaissance's mark is the
 *          heavy 0.08·R; the film draws it lighter — 0.05·R in the liminal
 *          eye (f12691: a 7 px vertical run across the 45° crossing at
 *          R ≈ 100 px), ≈ 0.035·R in the ringed Vision (f5821, R ≈ 150 px).
 *          FILM_BAND is the eye's.
 *   ring   0..1, the red ring drawn on around the mark (f5686, f5821). Its
 *          centreline radius is RING_RATIO·R = 1.047·R (f5821: ring 157 px,
 *          the S's crossings of the vertical axis at ±0.537·R give
 *          R = 150 px). `ringTint` RED, `ringStroke` its pen in screen px.
 *   light  0..1, the white light at the mark's heart, inside the ring
 *          (f5776: a white core to ≈ 0.07 ring radii, half-bright at ≈ 0.2,
 *          gone by ≈ 0.75; the mark is then drawn over it, f5821). Two
 *          discs of the host's radial-light fill (Stroke.fillFalloff) — a
 *          tight core and a wide faint halo (LIGHT_LAYERS) — laid UNDER the mark: fills
 *          composite in attach order, so the band, dot and square cover it.
 *   presence  inherited fade of the whole (certainty.ts presence), so a
 *          whole can fade the mark in without touching the opacities its
 *          own Create animates (MolochEye's iris does exactly that).
 */

import { Circle, Line, Null, Shape, type Vec3Like } from "../../src/parts/primitives"
import { color, completion, length, scalar } from "../../src/params"
import { type Color, RED, WHITE, rgb } from "../../src/constants"
import { type Anim, restage, together } from "../../src/anim"
import { presence } from "../../src/certainty"

/** The mark's red, sampled from the Regenaissance reference. */
export const MARK_RED: Color = rgb(237, 110, 87)

/** The proportions, in units of the mark's radius (see header). */
export const VISION = {
  offset: 0.38,
  dot: 0.15,
  square: 0.25,
  band: 0.08,
} as const

/** The film's band (the liminal eye, f12691), in units of R. */
export const FILM_BAND = 0.05

/** The ring's centreline radius, in units of R (f5821: 157 / 150 px). */
export const RING_RATIO = 1.047

/** The pen's weight on the centreline: the S's thinnest, in screen px (Stroke). */
export const VISION_PEN = 1.5

/**
 * The light's two discs, in units of R: [disc radius, falloff radius,
 * opacity], in attach order. The core first, opaque: white at the heart,
 * black by its rim — the ground's own black, so it leaves no edge. Then
 * the wide halo OVER it at partial opacity: the two mix, a·halo + (1−a)·core,
 * which is continuous everywhere (outside the core both read the ground).
 */
export const LIGHT_LAYERS: readonly (readonly [number, number, number])[] = [
  [0.3, 0.3, 1], // the core
  [0.65, 0.65, 0.15], // the halo
]
// Fitted to f5776's profile (linear light, R = 150 px): 0.73 at 0.11·R,
// 0.27 at 0.21·R, 0.08 at 0.32·R, 0.025 at 0.43·R; this pair gives 0.73,
// 0.29, 0.08, 0.04.

/** The S's centreline, tip → centre → tip: two semicircles of radius
 *  0.38·R about ±D, kissing at the centre. Holon frame (y up). */
export const sCentreline = (R: number, samples = 40): Vec3Like[] => {
  const k = VISION.offset * R
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

/** The S band's closed outline, radius `R`, band width `band`·R, holon frame (y up). */
export const sBandOutline = (R: number, samples = 40, band: number = VISION.band): Vec3Like[] => {
  const k = VISION.offset * R
  const w = (band * R) / 2
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

/** A closed circle outline of radius r, for a Shape (a bare Circle draws a
 *  hairline rim even at stroke 0 — Shot01Globe's glows). */
const disc = (r: number, samples = 64): Vec3Like[] =>
  Array.from({ length: samples + 1 }, (_, i) => {
    const a = (i / samples) * Math.PI * 2
    return { x: r * Math.cos(a), y: r * Math.sin(a), z: 0 }
  })

export class Vision extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The mark's radius: the circle it is drawn to fill (the white ring in
   *  the Regenaissance eye, the iris ring in the liminal eye). Every
   *  proportion is a fraction of it. */
  radius = length(100)

  /** One colour for the S, the dot and the square — the mark is single-coloured. */
  tint = color(MARK_RED)

  /** The S band's width, in units of R (Regenaissance 0.08; the film FILM_BAND). */
  weight = scalar(VISION.band)

  /** The red ring around it, drawn on 0 → 1 (f5686, f5821). */
  ring = completion(0)
  ringTint = color(RED)
  /** The ring's pen, screen px. */
  ringStroke = length(2)

  /** The white light at its heart, 0 → 1 (f5776). */
  light = completion(0)
  lightTint = color(WHITE)

  /** The whole's inherited fade (certainty.ts) — leaves Create's opacities free. */
  presence = presence(1)

  halo!: Shape
  core!: Shape
  ringCircle!: Circle
  band!: Shape
  /** The pen along the S's centreline (sCentreline), VISION_PEN wide. */
  spine!: Line
  dot!: Circle
  square!: Line

  protected override compose(): void {
    const R = this.radius.value
    const k = VISION.offset * R * Math.SQRT1_2
    // The light first: fills composite in attach order, so the mark covers it.
    const [core, halo] = LIGHT_LAYERS.map(
      ([r, f, peak]) =>
        new Shape({
          tint: this.lightTint,
          fillOpacity: this.light.map((l) => l * peak!),
          fillFalloff: 1,
          fillFalloffRadius: f! * R,
          outlines: [new Line({ points: disc(r! * R), tint: this.lightTint })],
        }),
    )
    this.core = this.add(core!)
    this.halo = this.add(halo!)
    this.ringCircle = this.add(
      new Circle({
        radius: RING_RATIO * R,
        tint: this.ringTint,
        stroke: this.ringStroke,
        drawStart: 0.25,
        creation: this.ring,
      }),
    )
    // The band is a Shape: a concave loop needs the even-odd wash (a lone
    // Line's wash is a centroid fan, right only for convex shapes). The
    // square is convex, so its own Line's fan is exact. The pen is the spine.
    this.band = this.add(
      new Shape({
        tint: this.tint,
        outlines: [new Line({ points: sBandOutline(R, 40, this.weight.value), tint: this.tint })],
      }),
    )
    this.spine = this.add(new Line({ points: sCentreline(R), tint: this.tint, stroke: VISION_PEN }))
    this.dot = this.add(
      new Circle({ x: k, y: k, radius: VISION.dot * R, tint: this.tint, stroke: 0, fillOpacity: 1 }),
    )
    const a = (VISION.square * R) / 2
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
   *  square — the two eyes — open together. (The ring and the light are
   *  their own params: a scene draws them with `ring.to(1)`, `light.to(1)`.) */
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
