/**
 * Save as state — authoring the state space from the editor
 * (docs/reports/editor-automaton.md, "transcends but includes").
 *
 * Pose anything (inspector, drag, the walk), then name the pose: it
 * becomes a position on one of the SCENE's own axes, written into the
 * DreamWeaving's `stateSpace()` by the saveState op (scripts/ops.ts) —
 * `poses("look", { rest: [[this.map.grain, 0]], busy: [[this.map.grain, 1]] })`.
 * The reload then shows it as one more clickable axis: a designer makes
 * states without writing code, and the code is exactly what they would
 * have written. The scene, not the holon, is the home — vocabulary stays
 * sovereign; a symbol's own states are its author's to declare.
 */

import type { Dream } from "../src/dream"
import type { Holon } from "../src/holon"
import type { Overrides } from "./overrides"
import { holonPathOf } from "./checkpoint"

export interface PoseParam {
  path: string
  value: number | boolean
  base: number | boolean
}

const round = (kind: string, v: number): number =>
  kind === "angle" ? Math.round(v * 1e4) / 1e4 : Math.round(v * 1e2) / 1e2

/**
 * The live layer's pose as a state: every overridden number/boolean the
 * scene can address, with its posed value and its base (the timeline's at
 * t, or what the override displaced for a param time never touches);
 * params that do not differ from their base are not part of the pose.
 */
export const poseParams = (dream: Dream, overrides: Overrides, t: number): PoseParam[] => {
  const timeline = dream.build()
  const out: PoseParam[] = []
  for (const { param, value, displaced } of overrides.entries()) {
    if (typeof value !== "number" && typeof value !== "boolean") continue
    const owner = param.owner as Holon | undefined
    const path = owner && param.name ? holonPathOf(dream, owner) : undefined
    if (!path) continue
    const base = overrides.animates(param) ? timeline.valueAt(param, t) : displaced
    if (typeof base !== typeof value) continue
    const v = typeof value === "number" ? round(param.kind, value) : value
    const b = typeof base === "number" ? round(param.kind, base) : (base as boolean)
    if (v === b) continue
    out.push({ path: `this.${path}.${param.name}`, value: v, base: b })
  }
  return out
}

export interface SaveStateOpts {
  /** The pose that would be saved now (empty: the row hides). */
  pose(): PoseParam[]
  /** The scene's own axes — offered as names to add to. */
  axes(): string[]
  save(axis: string, position: string, pose: PoseParam[]): void
}

/**
 * The row: `save pose as [axis] [position] ↵`, shown only while a pose
 * exists. Mounted into the inspector beside the State group.
 */
export const mountSaveState = (parent: HTMLElement, opts: SaveStateOpts): { refresh(): void } => {
  const row = document.createElement("div")
  row.className = "savestate"
  const label = document.createElement("label")
  label.textContent = "save pose as"
  const axis = document.createElement("input")
  axis.placeholder = "axis"
  axis.setAttribute("list", "savestate-axes")
  const list = document.createElement("datalist")
  list.id = "savestate-axes"
  const position = document.createElement("input")
  position.placeholder = "state"
  row.append(label, axis, position, list)
  parent.appendChild(row)

  const submit = () => {
    const a = axis.value.trim()
    const p = position.value.trim()
    const pose = opts.pose()
    if (!a || !p || pose.length === 0) return
    opts.save(a, p, pose)
    row.classList.add("sent")
    position.value = ""
  }
  for (const input of [axis, position])
    input.addEventListener("keydown", (e) => {
      e.stopPropagation()
      if (e.key === "Enter") submit()
    })

  const refresh = () => {
    const n = opts.pose().length
    row.style.display = n ? "" : "none"
    row.title = `${n} param${n === 1 ? "" : "s"} posed — becomes a clickable state of this scene`
    const names = opts.axes()
    if (list.childElementCount !== names.length) {
      list.textContent = ""
      for (const name of names) list.appendChild(Object.assign(document.createElement("option"), { value: name }))
    }
  }
  // Next frame, not now: an inspector render can run during the editor's
  // boot, before the transport it asks about exists.
  row.style.display = "none"
  requestAnimationFrame(refresh)
  return { refresh }
}
