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
import { numericField, wantsSlider, type NumericFieldHandle } from "./numeric"

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

// --- Row construction (EDITOR-V4 "Numeric editing") -------------------------
//
// The panel's rows moved here from main.ts when the slider-first row became
// a C4D numeric field: the row now has real behaviour (drag, type, revert)
// and belongs next to the rules that decide what a row IS, rather than in
// the editor's boot sequence. main.ts keeps what only it can own — where a
// value GOES (the live param write and the setOverride commit) — and passes
// it in as two callbacks.

/** What a built row exposes back to the panel's per-frame sync. */
export interface BuiltRow {
  el: HTMLDivElement
  param: Param<ParamValue>
  field?: NumericFieldHandle
  slider?: HTMLInputElement
  val?: HTMLElement
  swatch?: HTMLElement
}

export interface RowHooks {
  /** The value moved (drag/type): write it live and mark divergence. */
  onInput: (param: Param<ParamValue>, name: string, value: number) => void
  /** The gesture ended: commit it to code, if this row is committable. */
  onCommit: (param: Param<ParamValue>, name: string, value: number) => void
  /** Whether this holon's construction site is anchored — i.e. committable. */
  committable: boolean
  signal: AbortSignal
}

/**
 * One inspector row.
 *
 * The control is chosen by what the param MEANS, not by its type:
 *
 *   bound        no control at all, and the panel says "bound"
 *   color        a swatch
 *   completion   slider + field — the range is the meaning, and the
 *   bipolar      exact number still has to be typeable
 *   everything   the numeric field alone; a slider over [-600, 600]
 *   else numeric was never able to say 250.0, which is the whole point
 *   bool         a checkbox-flavoured toggle, read-only for now
 */
export const buildParamRow = (name: string, param: Param<ParamValue>, hooks: RowHooks): BuiltRow => {
  const el = document.createElement("div")
  el.className = "param"
  const label = document.createElement("label")
  label.textContent = name
  label.title = `${name} · ${param.kind}`
  el.appendChild(label)

  if (param.isBound) {
    // PARAMETERS rule: a bound param is read-only, and the panel says so.
    el.classList.add("bound")
    const bind = document.createElement("div")
    bind.className = "bind"
    bind.textContent = "bound"
    bind.title = "follows a derived binding — animate its source"
    el.appendChild(bind)
    const val = document.createElement("div")
    val.className = "val"
    val.textContent = formatValue(param.value)
    el.appendChild(val)
    return { el, param, val }
  }

  if (isColor(param.value)) {
    const swatch = document.createElement("div")
    swatch.className = "swatch"
    el.appendChild(swatch)
    return { el, param, swatch }
  }

  if (typeof param.value === "number") {
    if (!hooks.committable) {
      el.classList.add("liveonly")
      el.title = "live only — not written to code"
    }
    const slider = wantsSlider(param) ? document.createElement("input") : undefined
    const field = numericField(param, {
      signal: hooks.signal,
      onInput: (value) => {
        if (slider) slider.value = String(value)
        hooks.onInput(param, name, value)
      },
      onCommit: (value) => hooks.onCommit(param, name, value),
    })

    if (slider) {
      slider.type = "range"
      const [min, max, step] = sliderRange(param)
      slider.min = String(min)
      slider.max = String(max)
      slider.step = String(step)
      slider.value = String(param.value)
      slider.addEventListener(
        "input",
        () => {
          const value = Number(slider.value)
          field.set(value)
          hooks.onInput(param, name, value)
        },
        { signal: hooks.signal },
      )
      slider.addEventListener(
        "change",
        () => hooks.onCommit(param, name, Number(slider.value)),
        { signal: hooks.signal },
      )
      el.classList.add("ranged")
      el.appendChild(slider)
    }
    el.appendChild(field.el)
    return { el, param, field, slider }
  }

  // Booleans and anything else: shown, read, not yet editable.
  el.appendChild(document.createElement("span"))
  const val = document.createElement("div")
  val.className = "val"
  val.textContent = formatValue(param.value)
  el.appendChild(val)
  return { el, param, val }
}
