/**
 * Regenaissance — the noosphere stacked over the biosphere, the eye where
 * they overlap, and the whole held in one ring.
 *
 * SOURCE: the Regenaissance DreamNode (vault /Regenaissance, read-only):
 * `.udd` names its DreamTalk WelcomeToTheRegenaissance.gif; the stills are
 * WelcomeToTheRegenaissance.png (1080², the composition measured below),
 * RegennaissanceSymbol.png (the gold frame alone) and Regennaissance.png.
 * Its Keynote carries a "Noosphere" asset, and the top globe is the same
 * lattice sphere as DreamTalkVocabulary/NoosphereAndBiosphere — so the two
 * globes are the noosphere (mind, lattice) and the biosphere (Earth).
 *
 * WHAT IS THE SYMBOL AND WHAT IS ORNAMENT. The reference is a gold
 * filigree frame — crown, rosettes, vines, a pendant — around a geometric
 * core. The filigree is raster art and is left out (DreamTalk canon: the
 * symbol is mathematical truth, not a trace). What remains:
 *
 *   - the OUTER RING;
 *   - two equal circles stacked on the vertical axis, overlapping in a
 *     VESICA (the eye) — the top one holds the lattice globe, the bottom
 *     one the Earth;
 *   - in the vesica, a white ring holding the red SMark (./SMark.ts);
 *   - the VERTICAL AXIS through both centres, which passes BEHIND the eye.
 *
 * MEASURED off WelcomeToTheRegenaissance.png (px, 1080²; fits by least
 * squares on masked pixels):
 *
 *   outer ring       centre (539, 531), radius 390 (rms < 4 px — a true
 *                    circle, not the frame's oval) → the unit, R.
 *   globe circles    lattice edge r ≈ 218; vesica rims r ≈ 213–237;
 *                    vesica 432 → 660 tall, tips at x ≈ 350 / 730.
 *                    → r ≈ 215 = 0.56·R; centre separation ≈ 203 = 0.94·r.
 *   S-mark ring      centre (540, 540), radius 100–101 = 0.46·r.
 *   eye centre       (540, 540–546); the ring's centre sits 9 px (0.02·R)
 *                    higher — read as concentric.
 *   Earth            Africa/Europe face; the Mediterranean at ≈ 0.41·r
 *                    below the bottom centre and South Africa near the limb
 *                    → a pole lean of ≈ 1.05 rad and spin ≈ −0.37 rad.
 *   colours          gold rgb(141, 102, 48) median (lifted for a hairline),
 *                    lattice and land white, mark rgb(237, 110, 87).
 *
 * The separation is taken as exactly r — the VESICA PISCIS, each circle
 * through the other's centre. The measured 0.94·r is within the rims'
 * thickness of it (the rims are 6–10 px bands), and the vesica piscis is
 * what the figure is: the eye of two equal worlds. With d = r the vesica is
 * r tall and √3·r wide, and the whole stack spans ±1.5·r.
 *
 * LAYERS (attach order is composite order — three-host): the lattice is
 * CLIPPED analytically to the top circle outside the bottom one (strokes
 * MAX-blend and cannot be covered), the axis is two segments that stop at
 * the eye; the Earth's land is FILL, so a black vesica fill attached after
 * it covers the part of the biosphere the eye overlaps — fill over fill.
 */

import { Circle, Group, Line, Null, type Vec3Like } from "../../src/parts/primitives"
import { bool, color, completion, length, scalar, angle } from "../../src/params"
import { BLACK, type Color, WHITE, rgb } from "../../src/constants"
import { type Anim, restage, together } from "../../src/anim"
import { Globe } from "../Globe/Globe"
import { GREAT_CIRCLE_NORMALS, greatCircleHalves, outsideDisc } from "./lattice"
import { MARK_RED, SMark } from "./SMark"

/** The frame's gold, lifted from the measured median for a thin line. */
export const REGEN_GOLD: Color = rgb(196, 150, 72)

/** The proportions, in units of the outer ring's radius R (see header). */
export const REGEN = {
  /** Globe circle radius r / R. */
  globe: 0.56,
  /** S-mark ring radius / r. */
  mark: 0.46,
} as const

/** Lattice runs per great-circle half: the vesica cuts a half into ≤ 2. */
const RUN_SLOTS = 2

export class Regenaissance extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The outer ring's radius — the whole symbol's size; everything else is
   *  a fraction of it. */
  radius = length(390)

  /** The noosphere's turn about its pole, radians — animate to spin it. */
  latticeSpin = scalar(0.3)
  /** The lattice's pole lean (fixed framing, like Globe's tilt). */
  latticePitch = angle(0.45)
  /** The Earth's turn; the reference's face (Africa/Europe) is the default. */
  earthSpin = scalar(-0.37)
  /** The Earth's pole lean toward the viewer — Europe high on the disc. */
  earthTilt = angle(1.05)

  /** Rings and axis. */
  ringTint = color(REGEN_GOLD)
  ringStroke = length(3)
  /** The lattice: near face full, far face at `backOpacity`. */
  latticeTint = color(WHITE)
  latticeStroke = length(1.4)
  backOpacity = completion(0.4)
  landTint = color(WHITE)

  /** The mark in the eye — its presence and colour. */
  mark = bool(true)
  markTint = color(MARK_RED)
  /** The white ring the mark sits in. */
  eyeTint = color(WHITE)

  outer!: Circle
  topCircle!: Circle
  bottomCircle!: Circle
  axis!: Group
  lattice!: Group
  earth!: Globe
  vesica!: Line
  eyeRing!: Circle
  sMark?: SMark

  get r(): number {
    return REGEN.globe * this.radius.value
  }

  protected override compose(): void {
    const R = this.radius.value
    const r = this.r
    const h = r / 2 // each globe's centre, above/below the eye

    // --- the biosphere: land fill first, so the eye can cover it ----------
    this.earth = this.add(
      new Globe({
        y: -h,
        radius: r,
        land: this.landTint,
        spin: this.earthSpin,
        tilt: this.earthTilt,
      }),
    )

    // --- the eye's black: the vesica, filled, over the land ---------------
    this.vesica = this.add(
      new Line({ points: vesicaOutline(r), tint: BLACK, stroke: 0, fillOpacity: 1 }),
    )

    // --- the noosphere: 15 great circles, clipped out of the eye ----------
    const runs: Line[] = []
    for (let k = 0; k < GREAT_CIRCLE_NORMALS.length; k++) {
      for (const side of ["front", "back"] as const) {
        for (let s = 0; s < RUN_SLOTS; s++) {
          const line = new Line({
            tint: this.latticeTint,
            stroke: this.latticeStroke,
            ...(side === "back" ? { opacity: this.backOpacity } : {}),
          })
          deriveRun(line, this, () => {
            const halves = greatCircleHalves(k, r, this.latticeSpin.value, this.latticePitch.value)
            const run = outsideDisc(halves[side], 0, -r, r)[s]
            return run ? run.map((p) => ({ x: p.x, y: p.y + h, z: 0 })) : []
          })
          runs.push(line)
        }
      }
    }
    this.lattice = this.add(new Group({ members: runs }))

    // --- the axis: centre line, stopping at the eye -----------------------
    const seg = (y0: number, y1: number) =>
      new Line({
        points: [
          { x: 0, y: y0, z: 0 },
          { x: 0, y: y1, z: 0 },
        ],
        tint: this.ringTint,
        stroke: this.ringStroke,
      })
    this.axis = this.add(new Group({ members: [seg(1.5 * r, h), seg(-1.5 * r, -h)] }))

    // --- the rings ---------------------------------------------------------
    const ring = (y: number, radius: number) =>
      new Circle({ y, radius, tint: this.ringTint, stroke: this.ringStroke, drawStart: 0.25 })
    this.topCircle = this.add(ring(h, r))
    this.bottomCircle = this.add(ring(-h, r))
    this.outer = this.add(ring(0, R))

    // --- the eye: white ring, red mark ------------------------------------
    const m = REGEN.mark * r
    this.eyeRing = this.add(new Circle({ radius: m, tint: this.eyeTint, stroke: this.ringStroke }))
    if (this.mark.value) this.sMark = this.add(new SMark({ radius: m, tint: this.markTint }))
  }

  /**
   * The ring closes first (the whole is held before anything appears in
   * it), then the two worlds' circles and the axis, then the worlds
   * themselves — the lattice draws on while the land floods — and last the
   * eye opens and the mark writes itself in it.
   */
  override createAnim(): Anim {
    void this.parts // compose() is lazy: the parts exist once it has run
    const parts: Parameters<typeof together> = [
      restage(this.outer.creation.sequence(0, 1), 0, 0.3),
      restage(this.topCircle.creation.sequence(0, 1), 0.15, 0.45),
      restage(this.bottomCircle.creation.sequence(0, 1), 0.15, 0.45),
      restage(together(...this.axis.parts.map((p) => p.creation.sequence(0, 1))), 0.25, 0.45),
      restage(together(...this.lattice.parts.map((p) => p.creation.sequence(0, 1))), 0.35, 0.75),
      restage(this.earth.landOpacity.sequence(0, 1), 0.4, 0.75),
      restage(this.eyeRing.creation.sequence(0, 1), 0.65, 0.85),
    ]
    if (this.sMark) parts.push(restage(this.sMark.createAnim(), 0.75, 1))
    return together(...parts)
  }
}

/** The vesica of two radius-r circles whose centres are ±r/2 on the axis:
 *  the top circle's lower arc and the bottom circle's upper arc, closed. */
export const vesicaOutline = (r: number, samples = 48): Vec3Like[] => {
  const h = r / 2
  // Each arc spans ±60° about its downward / upward direction (the tips
  // sit at (±√3·r/2, 0)).
  const pts: Vec3Like[] = []
  for (let i = 0; i <= samples; i++) {
    const a = -Math.PI / 2 - Math.PI / 3 + ((2 * Math.PI) / 3) * (i / samples)
    pts.push({ x: r * Math.cos(a), y: h + r * Math.sin(a), z: 0 })
  }
  for (let i = 1; i <= samples; i++) {
    const a = Math.PI / 2 - Math.PI / 3 + ((2 * Math.PI) / 3) * (i / samples)
    pts.push({ x: r * Math.cos(a), y: -h + r * Math.sin(a), z: 0 })
  }
  return pts
}

/**
 * Give a lattice Line derived `points`, recomputed when the noosphere turns
 * (latticeSpin / latticePitch / radius) — the Globe.deriveRing pattern: the
 * memo keys on the source scalars and bumps geomVersion on every recompute.
 */
const deriveRun = (line: Line, holon: Regenaissance, compute: () => Vec3Like[]): void => {
  let key: readonly number[] | undefined
  let memo: Vec3Like[] = []
  Object.defineProperty(line, "points", {
    configurable: true,
    enumerable: true,
    get() {
      const next = [holon.latticeSpin.value, holon.latticePitch.value, holon.radius.value]
      if (!key || next.some((v, i) => v !== key![i])) {
        key = next
        memo = compute()
        line.geomVersion++
      }
      return memo
    },
    set(_v) {},
  })
}
