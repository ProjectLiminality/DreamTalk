/**
 * The inspector — the selected holon's properties, and nothing else.
 *
 * This is the promotion protocol's natural home (PARAMETERS.md ch. 5,
 * surface 3): "the panel shows exactly the declared params of each holon
 * plus the standard params the timeline animates. Nothing else. Bound
 * params render read-only with their source visible."
 *
 * Mechanically that reads:
 *
 *  - DECLARED = every param the holon's own class chain adds on top of
 *    the base Holon. Declaration IS registration (holon.ts), so the set
 *    is simply `holon.params` minus the nine standard fields — a
 *    Circle contributes radius/tint/stroke/erasure/drawStart/
 *    drawReversed, an Axes its extents and grid switches.
 *  - ANIMATED = a standard param that appears in this Dream's timeline
 *    (`timeline.params`). A cylinder whose `p` the scene turns shows p;
 *    the same cylinder's untouched `h` does not.
 *  - Everything else stays hidden. TASTE's "no parameter dumps" as a
 *    mechanical rule rather than a matter of taste in each case.
 *
 * Grouping follows the same distinction rather than inventing one:
 * Transform (the standard set the timeline touches), then the holon's own
 * params, then Appearance (tint/stroke/opacity — the shared face of every
 * Stroke, which reads better next to itself than buried among geometry).
 */

import type { Holon } from "../src/holon"
import type { Param, ParamValue } from "../src/params"
import { isColor } from "../src/constants"
import { classNameOf } from "./classname"

/** The nine every holon carries by TASTE law, plus scene t implicitly. */
export const STANDARD_PARAMS = new Set([
  "x",
  "y",
  "z",
  "h",
  "p",
  "b",
  "scale",
  "creation",
  "opacity",
])

/** Transform-flavoured standard params, grouped together in the panel. */
const TRANSFORM_PARAMS = ["x", "y", "z", "h", "p", "b", "scale"]

/** Params about how a stroke LOOKS rather than what shape it is. */
const APPEARANCE_PARAMS = ["tint", "gridTint", "stroke", "opacity", "creation", "erasure"]

export interface ParamEntry {
  name: string
  param: Param<ParamValue>
  /** Why the panel is showing it — drives the read-only/annotation styling. */
  reason: "declared" | "animated"
}

export interface ParamGroup {
  title: string
  entries: ParamEntry[]
}

/**
 * What the inspector shows for a holon, already grouped.
 * `animated` is the Dream's timeline param list.
 */
export const inspectorGroups = (
  holon: Holon,
  animated: readonly Param<ParamValue>[],
): ParamGroup[] => {
  const isAnimated = (p: Param<ParamValue>) => animated.includes(p)
  const shown: ParamEntry[] = []
  for (const [name, param] of holon.params) {
    const declared = !STANDARD_PARAMS.has(name)
    if (declared) shown.push({ name, param, reason: "declared" })
    else if (isAnimated(param)) shown.push({ name, param, reason: "animated" })
  }

  const take = (names: readonly string[]): ParamEntry[] => {
    const picked: ParamEntry[] = []
    for (const name of names) {
      const index = shown.findIndex((e) => e.name === name)
      if (index >= 0) picked.push(...shown.splice(index, 1))
    }
    return picked
  }

  const transform = take(TRANSFORM_PARAMS)
  const appearance = take(APPEARANCE_PARAMS)
  // What is left is the holon's own geometry/behaviour vocabulary.
  const own = shown

  const groups: ParamGroup[] = []
  if (transform.length) groups.push({ title: "Transform", entries: transform })
  if (own.length) groups.push({ title: classNameOf(holon), entries: own })
  if (appearance.length) groups.push({ title: "Appearance", entries: appearance })
  return groups
}

/** Slider bounds per semantic kind — honest ranges, per PARAMETERS rule 4. */
export const sliderRange = (p: Param<ParamValue>): [number, number, number] => {
  if (p.kind === "bipolar") return [-1, 1, 0.01]
  if (p.kind === "completion") return [0, 1, 0.01]
  if (p.kind === "angle") return [-Math.PI, Math.PI, 0.01]
  if (p.kind === "length") return [0, 600, 1]
  if (p.kind === "integer") return [0, 24, 1]
  return [-600, 600, 1]
}

/** A short, honest rendering of a param's current value. */
export const formatValue = (v: ParamValue): string => {
  if (isColor(v)) return ""
  if (typeof v === "boolean") return v ? "true" : "false"
  return Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2)
}
