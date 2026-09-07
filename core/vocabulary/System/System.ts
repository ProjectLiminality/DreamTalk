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
 * THERE IS NO CHOREOGRAPHY HERE
 *
 * Unlike the Logo, `System` has NO dedicated animator in pydeation — no
 * `CreateSystem` exists, so `Create(system)` falls through to the
 * generic path and every spline in the composite draws on together, each
 * over the full span (animator.py's flatten). Core's `Create` default
 * does exactly that (verbs.ts: deep-parallel recursion), so this class
 * defines no `createAnim` and that ABSENCE is the port.
 *
 * The reference confirms it frame for frame. At f_00486 (t=97.2, a
 * third into the 3s draw) the four gear rims, the four icons and the
 * enclosing circle are ALL partially drawn — no group waits for
 * another, and the icons run ahead of the gear teeth only because a
 * Sketch spends its span across its own subpaths by arc length and an
 * icon has less of it. A staggered composite could not produce that
 * frame.
 */

import { color } from "../../src/params"
import { Group, Stroke } from "../../src/parts/primitives"
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

const ASSET_DATA: Record<string, SketchData> = {
  justice,
  factory,
  cash,
  stethoscope,
  gearBig,
  gearSmall,
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
  iconData: SketchData = justice
  iconHeight = ASSET_HEIGHT.justice
  gearData: SketchData = gearBig
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
