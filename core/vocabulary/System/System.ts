/**
 * System — the global system, as four interlocking gears.
 *
 * Law, economy, finance, healthcare: four institutions drawn as gears
 * that MESH, each bearing the icon of what it governs. The symbol's
 * whole argument is in the meshing — these are not four machines but one
 * machine, and no tooth turns alone. It is the only composite in the
 * 2024 pitch built entirely out of imported drawings.
 *
 * Source (refs/pydeation-legacy/object/custom_objects.py:400-426), the
 * pitch's own `System(CustomObject)`, ported DERIVATION-first. Verbatim:
 *
 *   law        = Group(Justice(scale=0.5, color=color),
 *                      GearBig(color=gear_color),
 *                      scale=0.5, x=80,  z=-85, group_name="law")
 *   economy    = Group(Factory(scale=0.5, color=color),
 *                      GearBig(color=gear_color),
 *                      scale=0.5, x=-80, z=85,  group_name="economy")
 *   finance    = Group(Cash(scale=0.5, color=color),
 *                      GearSmall(b=PI/12, color=gear_color),
 *                      scale=0.3, x=70,  z=65,  group_name="finance")
 *   healthcare = Group(Stethoscope(scale=0.5, color=color),
 *                      GearSmall(b=-PI/12, color=gear_color),
 *                      scale=0.3, x=-70, z=-65, group_name="healthcare")
 *
 * That is the ENTIRE class — a constructor, four Groups, no methods, no
 * animator. Everything below is those twelve numbers and nothing else.
 *
 * pydeation builds in the XZ plane and its out-of-plane y is our z; a
 * front view maps its z straight to our y, so each `z=` above is our
 * `y=` and the four groups sit on the two diagonals:
 *
 *   economy (-80, +85)  ·  finance    (+70, +65)      upper-left, upper-right
 *   healthcare(-70,-65) ·  law        (+80, -85)      lower-left, lower-right
 *
 * The two BIG gears take the long diagonal (±80, ±85) and the two SMALL
 * ones the short (±70, ±65), which is what lets four gears of two sizes
 * mesh in a ring: the big pair reaches past the small pair's centres and
 * the small pair fills the gap the big pair leaves. Nothing chooses
 * those offsets but the meshing, and the meshing is why they are the
 * numbers they are.
 *
 *
 * THE TWO SCALES, AND WHAT THEY SCALE
 *
 * Each group carries a scale (0.5 for the big pair, 0.3 for the small),
 * and each ICON carries a second, inner scale=0.5 on top of it. So an
 * icon renders at groupScale × 0.5 of its native size while its gear
 * renders at groupScale × 1 — the icon is HALF the gear, always, in
 * every group. One decision, stated once per group and once per icon.
 *
 * `scale` in pydeation is C4D's plain object scale on the asset's own
 * imported units, and the SVG loader does no resizing whatever — it
 * loads the file, re-centres the axis, and stops
 * (vector_graphics.py:31-77). So the thing being scaled is each
 * drawing's NATIVE size, and reproducing the symbol means knowing those
 * six sizes rather than choosing a height per icon. They are measured
 * once, off the generated asset data, as ASSET_HEIGHT below: our
 * importer keeps the SVG's own units (svg2ts.ts, `height: null`), which
 * is why david's 651.044 in Scene00 is the same number C4D saw.
 *
 * All six drawings share a 400-unit-wide export canvas — an artist's
 * template, not a coincidence — so it is the HEIGHTS that differ, from
 * cash's 163.782 (a banknote, wide and flat) to stethoscope's 400.532.
 * That is the whole reason the icons look correctly varied inside
 * identical gears: they are sized by their own aspect, not fitted.
 *
 *
 * THE SMALL GEARS' ±π/12, AND WHY IT IS VERBATIM AND INVISIBLE
 *
 * `GearSmall(b=PI/12)` and `GearSmall(b=-PI/12)` are the source's only
 * rotations. gear_small carries SIXTEEN teeth, so its tooth pitch is
 * 2π/16 = π/8 = 22.5°, and π/12 = 15° is neither a whole pitch nor a
 * half one — it is a real, if small, phase adjustment, the designer
 * nudging two gears into mesh by eye. The two are given OPPOSITE signs,
 * which is what meshing gears do.
 *
 * It is carried verbatim and NOT verified against the reference,
 * deliberately. A 16-tooth wheel at the small groups' rendered radius
 * (56px) spans 22px of arc per tooth, so a Fourier phase fit on
 * f_00505's JPEG resolves the tip angle to roughly ±5° — a third of the
 * rotation being tested. Measured that way the two small gears come out
 * at +5.1° and −4.8° about the asset's own phase: the right SIGNS and
 * the right SYMMETRY, at a third the magnitude, which is exactly what a
 * measurement with that error bar looks like and is not evidence
 * against 15°. The source states the number; the frame cannot resolve
 * it; the source wins. (The big gears, which the source does NOT
 * rotate, measure 0.2° and 13.6° against a 13.85° pitch — i.e. 0° and
 * one whole pitch, both indistinguishable from unrotated, which is the
 * control that says the method works at the larger radius.)
 *
 *
 * THE COLOURS ARE TWO, AND THEY DEFAULT TO ONE
 *
 * The source takes `color` and `gear_color`, and `if gear_color is None:
 * gear_color = color` — icons and gears are separately tintable but move
 * together unless told otherwise. Scene03 never separates them. Kept as
 * two params for the same reason the source kept them.
 *
 *
 * THE CHOREOGRAPHY: `Create` ON A System FLOODS IT SOLID
 *
 * `System` is one of the six classes pydeation's `Create` dispatches on
 * by name, alongside Eye, Logo, Axes and CustomText:
 *
 *   elif cobject.__class__.__name__ == "System":
 *       system_creation = DrawThenFillCompletely(cobject, **params)
 *          — animator.py:948-950 (inside a Group) and 970-972 (bare)
 *
 * So `Create(system)` is NOT a draw-on: the gears and icons draw over
 * (0, 0.6) of the span and their interiors flood SOLID over (0.5, 1),
 * the two overlapping by a tenth — `DrawThenFillCompletely`
 * (animator.py:498-514), which core carries verb-for-verb in
 * src/verbs.ts. A gear ends the span as a solid toothed ring, not an
 * outline of one.
 *
 * That is easy to miss and expensive to miss, because the scene that
 * stages it says only `Create(global_system, circle)` — the flood is in
 * the dispatch table, not at the call site. The reference settles it: a
 * radial cut ACROSS the teeth of the lower-right gear (Scene03.ts's
 * header carries the frame-by-frame profiles) is a hollow pair of lines
 * at f_00488 and a solid 30px band by f_00492, with the gap visibly
 * filling in between. No draw-on produces that.
 *
 * The class-name dispatch is exactly what core's `Create` already does
 * with `createAnim()` (verbs.ts's header: "a holon that owns a
 * choreography creates by it"), so the port is one method — and it is
 * the one thing in this file that is not the constructor.
 *
 * Note what is NOT overridden: `unCreateAnim`. pydeation's `UnDraw` is
 * not a dispatcher — Scene03 calls it directly and it retracts the draw
 * front on everything it reaches — so the un-draw is the generic one,
 * and the absence here is as deliberate as the presence above.
 *
 * Across the four groups nothing is staggered — at f_00486 all four
 * gears and all four icons are partially drawn, no group waiting on
 * another. WITHIN a drawing the subpaths are sequential, shortest
 * first; see `shortestFirst` below, which is where that order is
 * derived and defended.
 */

import { color } from "../../src/params"
import { restage, together, type Anim } from "../../src/anim"
import { Stroke } from "../../src/parts/primitives"
import { Sketch } from "../Sketch/Sketch"
import {
  cash,
  factory,
  gearBig,
  gearSmall,
  justice,
  stethoscope,
} from "../Sketch/assets/index"
import type { SketchData } from "../Sketch/data"
import { PI, WHITE } from "../../src/constants"

/**
 * Each drawing's own height, in its own imported units — the thing
 * `scale` scales, and the only measured numbers in this file.
 *
 * Read off the generated asset modules (the bounding box of every
 * subpath), which carry the SVG's units untouched. They are stated here
 * rather than computed at construction so the derivation is inspectable
 * and a regenerated asset that changed size would fail a test instead of
 * silently resizing the symbol.
 */
export const ASSET_HEIGHT = {
  gearBig: 398.264,
  gearSmall: 400.031,
  justice: 349.594,
  factory: 265.75,
  cash: 163.782,
  stethoscope: 400.532,
} as const

/** The inner scale every icon carries (`Justice(scale=0.5)`, ×4). */
export const ICON_SCALE = 0.5

/** The small gears' phase nudge — the source's only rotation. */
export const GEAR_SMALL_BANK = PI / 12

/**
 * The four groups, exactly as the source's constructor states them:
 * which drawings, at what group scale, at which offset, with what bank
 * on the gear. pydeation's `z` is our `y` (see the header).
 *
 * Exported so the tests can pin the layout against the source rather
 * than against this file's own output.
 */
export const GROUPS = [
  { name: "law", icon: "justice", gear: "gearBig", scale: 0.5, x: 80, y: -85, bank: 0 },
  { name: "economy", icon: "factory", gear: "gearBig", scale: 0.5, x: -80, y: 85, bank: 0 },
  {
    name: "finance",
    icon: "cash",
    gear: "gearSmall",
    scale: 0.3,
    x: 70,
    y: 65,
    bank: GEAR_SMALL_BANK,
  },
  {
    name: "healthcare",
    icon: "stethoscope",
    gear: "gearSmall",
    scale: 0.3,
    x: -70,
    y: -65,
    bank: -GEAR_SMALL_BANK,
  },
] as const

/**
 * Re-emit a drawing's subpaths SHORTEST-FIRST — pydeation's
 * `stroke_order="short_long"` (object.py:228), realized as data because
 * a Sketch draws its subpaths in the order it is given them
 * (Sketch.ts's `sweep`, which spends the span across them in sequence).
 *
 * This is the one ordering fact the reference states and the source
 * does not, so it is worth the paragraph. pydeation's `SVG` never names
 * a stroke order, which leaves `CObject.__init__`'s default of
 * `"bottom_top"` (object.py:90) — and `bottom_top` is NOT what the
 * video shows. For a gear (two subpaths: the toothed rim, arc length
 * 1600, and the inner circle, 867) the three candidate orders predict:
 *
 *   bottom_top  → rim, then circle   (rim's lowest point is lower)
 *   long_short  → rim, then circle
 *   short_long  → CIRCLE, then rim
 *
 * and the reference draws the CIRCLE first, unambiguously. Measured on
 * the lower-right gear as percent-complete per frame, inner circle
 * against tooth band:
 *
 *   f_00485  97.0   circle  46%   teeth   0%
 *   f_00486  97.2   circle  75%   teeth   0%
 *   f_00487  97.4   circle  80%   teeth  17%
 *   f_00489  97.8   circle  81%   teeth  47%
 *   f_00490  98.0   circle  94%   teeth  96%
 *
 * The teeth do not begin until the circle is four fifths done. Two of
 * the three candidate orders are refuted by that table and the third is
 * `short_long`, which is therefore what this carries.
 *
 * The un-draw is the same fact seen from the other side, and it is the
 * check that the ordering is real rather than fitted to the draw: a
 * Sketch retracts its subpaths in REVERSE (Sketch.ts windows the
 * retract as [1-to, 1-from]), so shortest-first ordering necessarily
 * takes the TEETH away first — and the reference's mid-un-draw frame
 * shows exactly that, gear rims gone with the inner circles and icons
 * still standing. One ordering, predicting both ends of the scene.
 *
 * Why C4D's `bottom_top` behaves as `short_long` here is not recovered.
 * The SVG arrives rotated (`p_frozen=-PI/2`) and Sketch & Toon re-cuts
 * imported paths into its own stroke set before ordering them (the
 * mechanism Scene00's header documents), so "bottom" is being taken in
 * a frame or on a stroke set this port cannot see. What can be read
 * directly is the ORDER, and it is read rather than guessed.
 *
 * THIS IS THE CAMPAIGN'S RECURRING BLOCKER, AND HERE IT IS SOLVABLE.
 * Scene00 met it as stroke connection ("we draw the hair, the reference
 * draws the jaw"); Scene04 met it as an AnnularSector's four sub-strokes
 * drawn one at a time "in a per-slice order no screen-space sort
 * predicts", and stopped after three rounds of probes (commit 13eeb2a,
 * "the bottom_top law — third sighting"). All three are the same fact:
 * S&T's pen is SERIAL over a multi-stroke object, and `bottom_top` does
 * not describe the order it picks.
 *
 * What is new here is that this object admits a clean answer. A gear has
 * exactly TWO strokes of very different length, so the three candidate
 * orders make three DIFFERENT predictions instead of the near-ties a
 * four-stroke sector produces — and the reference separates them by 80
 * percentage points, not by a few. That the same ordering then predicts
 * the un-draw, which was not used to choose it, is the check that it is
 * a law and not a fit. It is offered as one datum toward the general
 * rule rather than as the rule: `short_long` is what these six drawings
 * are drawn in, and whether that generalises past two-stroke objects is
 * exactly what Scene04's sectors could not settle.
 */
const shortestFirst = (data: SketchData): SketchData => {
  const withLength = data.subpaths.map((sp, i) => {
    let length = 0
    for (let k = 2; k + 1 < sp.length; k += 2) {
      length += Math.hypot(sp[k]! - sp[k - 2]!, sp[k + 1]! - sp[k - 1]!)
    }
    return { sp, closed: data.closed[i] ?? 0, length, i }
  })
  // Ties keep document order, so the result is stable and a drawing
  // whose strokes are all one length is untouched.
  withLength.sort((a, b) => a.length - b.length || a.i - b.i)
  return {
    ...data,
    subpaths: withLength.map((e) => e.sp),
    closed: withLength.map((e) => e.closed),
  }
}

const ASSET_DATA: Record<string, SketchData> = {
  justice: shortestFirst(justice),
  factory: shortestFirst(factory),
  cash: shortestFirst(cash),
  stethoscope: shortestFirst(stethoscope),
  gearBig: shortestFirst(gearBig),
  gearSmall: shortestFirst(gearSmall),
}

/**
 * One institution: a gear with its icon riding at the gear's own centre.
 *
 * The source's `Group(icon, gear, scale=…, x=…, z=…)` — a turned,
 * offset frame holding two drawings, both at the frame's origin. The
 * group's `scale` reaches both; the icon's own 0.5 is on top of it.
 *
 * A declared-field Holon rather than core's `Group`, for the reason
 * Scene02's `Slice` records: `Group.members` adopts through the SAME
 * path a declared field takes, so a field also listed in `members` is
 * registered twice and every deep verb stamps two identical tracks on
 * each param.
 */
export class Gearing extends Stroke {
  /** Which drawings, and at what native heights — construction data. */
  iconData: SketchData = ASSET_DATA.justice!
  iconHeight = ASSET_HEIGHT.justice
  gearData: SketchData = ASSET_DATA.gearBig!
  gearHeight = ASSET_HEIGHT.gearBig
  /** The gear's own bank — the source's `b=±PI/12` on the small pair. */
  gearBank = 0

  /** The icon's colour (`color`) and the gear's (`gear_color`). */
  override tint = color(WHITE)
  gearTint = color(WHITE)

  icon = new Sketch({ data: this.iconData, tint: this.tint, stroke: this.stroke })
  gear = new Sketch({ data: this.gearData, tint: this.gearTint, stroke: this.stroke })

  protected override compose(): void {
    // `height` is the ONE thing that cannot come through the constructor
    // options: it is the asset's native height times the icon's inner
    // scale, and both halves are per-instance construction data. The
    // group's own `scale` multiplies it afterwards, as C4D's does.
    this.icon.data = this.iconData
    this.icon.height.defaultValue = this.iconHeight * ICON_SCALE
    this.icon.height.value = this.iconHeight * ICON_SCALE
    this.gear.data = this.gearData
    this.gear.height.defaultValue = this.gearHeight
    this.gear.height.value = this.gearHeight
    this.gear.b.defaultValue = this.gearBank
    this.gear.b.value = this.gearBank
  }
}

export class System extends Stroke {
  /** ONTOLOGY.md: a sovereign symbol — the global system, not a prop. */
  static sovereign = true

  /** The icons' colour — the source's `color`. */
  override tint = color(WHITE)
  /**
   * The gears' colour — the source's `gear_color`, which defaults to
   * `color` (`if gear_color is None: gear_color = color`). Separately
   * tintable, and Scene03 never separates them.
   */
  gearTint = color(WHITE)

  law = this.gearing("law")
  economy = this.gearing("economy")
  finance = this.gearing("finance")
  healthcare = this.gearing("healthcare")

  /**
   * `Create(system)` → `DrawThenFillCompletely(system)`
   * (animator.py:948-950): the outline draws over (0, 0.6) of the span
   * and the interior floods SOLID over (0.5, 1), the two overlapping by
   * a tenth so the flood begins while the pen is still closing.
   *
   * Spelled out of anim.ts primitives rather than by calling core's
   * `DrawThenFillCompletely(this)`, and that is not a style choice: the
   * verb is `Draw` + `Fill`, `Draw` IS `Create`, and `Create` consults
   * `createAnim()` — so delegating to it here would recurse forever.
   * The Logo has the same shape for the same reason. What is carried
   * across is the two windows and their `restage`, which is where the
   * verb's actual content lives (verbs.ts:198: pydeation states an
   * ease's tangents against the WHOLE play span, so a composite's
   * sub-windows must rescale rather than re-ease).
   *
   * The DRAW half delegates to each Sketch's own `createAnim`, which is
   * not a detail: a Sketch sequences its subpaths across its span by arc
   * length (Sketch.ts's `sweep`), so a gear's inner circle and its teeth
   * are drawn one after the other rather than together. Reaching past
   * that with `walk()` and stamping `creation` on the eight Sketches'
   * Line parts would draw every subpath of every drawing in parallel —
   * a different picture at every mid-draw frame, and one the reference
   * contradicts (`shortestFirst`'s frame table above). The FILL half
   * does walk, because `fillOpacity` lives on every Stroke and has no
   * choreography of its own.
   */
  override createAnim(): Anim {
    const sketches = [this.law, this.economy, this.finance, this.healthcare].flatMap((g) => [
      g.gear,
      g.icon,
    ])
    const strokes = [...this.walk()].filter((h): h is Stroke => h instanceof Stroke)
    return together(
      restage(together(...sketches.map((s) => s.createAnim())), 0, 0.6),
      // `solid: true` is pydeation's transparency=0 — opaque, not the
      // 0.07 default wash (object.py:475-477, and what the verb passes).
      restage(together(...strokes.map((s) => s.fillOpacity.to(1))), 0.5, 1),
    )
  }

  /** Build one group from its GROUPS entry — the source's constructor. */
  private gearing(name: string): Gearing {
    const g = GROUPS.find((entry) => entry.name === name)!
    return new Gearing({
      iconData: ASSET_DATA[g.icon]!,
      iconHeight: ASSET_HEIGHT[g.icon as keyof typeof ASSET_HEIGHT],
      gearData: ASSET_DATA[g.gear]!,
      gearHeight: ASSET_HEIGHT[g.gear as keyof typeof ASSET_HEIGHT],
      gearBank: g.bank,
      scale: g.scale,
      x: g.x,
      y: g.y,
      tint: this.tint,
      gearTint: this.gearTint,
      stroke: this.stroke,
    })
  }
}
