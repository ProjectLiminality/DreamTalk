/**
 * The player's creator panel — what the golden dot has selected, said
 * calmly in one corner.
 *
 * The demo player has no inspector, no ops, no daemon link that writes:
 * it is the presentation, and that is worth keeping. So the panel here
 * READS (the holon's name, where it lives, and the same param set the
 * editor's inspector would show — inspectorGroups, not a second rule) and
 * hands the editing to the editor: "open in editor ↗" lands on the same
 * scene, the same t, the same holon selected, still in creator mode. There
 * a change is a setOverride op written into the DreamWeaving — tracked in
 * git, which is where the transmission says a change belongs.
 */

import type { Dream } from "../src/index"
import type { Holon } from "../src/holon"
import type { Param, ParamValue } from "../src/params"
import { isColor, type Color } from "../src/constants"
import { inspectorGroups, formatValue } from "../editor/inspector"
import { classNameOf } from "../editor/classname"
import { rootIdentityOf } from "../editor/outline"
import { pathOf } from "../editor/selection"
import { CREATOR_KEY, GOLD_CSS, encodePath } from "../editor/creator"

const STYLE = `
#dt-creator-panel { position: fixed; top: 16px; right: 16px; width: 248px; max-height: calc(100vh - 32px); overflow: auto;
  background: rgba(10,10,10,.92); border: 1px solid #262626; border-radius: 10px; padding: 12px 14px;
  color: #ddd; font: 12px/1.45 -apple-system, system-ui, sans-serif; z-index: 70;
  opacity: 0; transform: translateY(-4px); transition: opacity .3s, transform .3s; pointer-events: none; }
#dt-creator-panel.on { opacity: 1; transform: none; pointer-events: auto; }
#dt-creator-panel .mode { color: ${GOLD_CSS}; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
#dt-creator-panel .hint { color: #666; font-size: 11px; margin-top: 2px; }
#dt-creator-panel .crumbs { margin-top: 10px; color: #777; font-size: 11px; }
#dt-creator-panel .crumbs a { color: #999; cursor: pointer; text-decoration: none; }
#dt-creator-panel .crumbs a:hover { color: ${GOLD_CSS}; }
#dt-creator-panel .name { color: #fff; font-size: 15px; margin-top: 2px; }
#dt-creator-panel .cls { color: #777; }
#dt-creator-panel h4 { margin: 10px 0 3px; color: #666; font-size: 10px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; }
#dt-creator-panel .row { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
#dt-creator-panel .row span:first-child { color: #999; }
#dt-creator-panel .row span:last-child { color: #eee; font-variant-numeric: tabular-nums; }
#dt-creator-panel .sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; vertical-align: -1px; border: 1px solid #333; }
#dt-creator-panel .open { display: block; margin-top: 12px; color: ${GOLD_CSS}; text-decoration: none; }
#dt-creator-panel .open:hover { text-decoration: underline; }
`

const css = (c: Color) => `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`

/**
 * What a holon is called in its DreamWeaving — its field name, else its
 * class. The field can sit on any ancestor, not just the parent: a
 * Calculator's `opGlyph` is a field of the Calculator but a member (part)
 * of its `all` Group, so the nearest whole that NAMES it is what counts.
 */
const nameOf = (dream: object, holon: Holon): string => {
  for (let n: Holon | null = holon.parent; n; n = n.parent) {
    for (const [key, value] of Object.entries(n)) if (value === holon) return key
  }
  return rootIdentityOf(dream, holon) ?? classNameOf(holon)
}

export interface CreatorPanel {
  show(on: boolean): void
  render(holon: Holon | null): void
}

export const mountCreatorPanel = (
  dream: Dream,
  sceneKey: string,
  now: () => number,
  select: (holon: Holon) => void,
): CreatorPanel => {
  const style = document.createElement("style")
  style.textContent = STYLE
  document.head.append(style)
  const el = document.createElement("div")
  el.id = "dt-creator-panel"
  document.body.append(el)

  const header = `<div class="mode">creator mode</div><div class="hint">${CREATOR_KEY.label} or esc returns to the game</div>`

  const render = (holon: Holon | null) => {
    el.innerHTML = header
    if (!holon) {
      el.insertAdjacentHTML("beforeend", `<div class="crumbs">hover to see what is there · click to select it</div>`)
      return
    }
    // Where it lives: the chain of wholes, each one selectable — the dot
    // picks the deepest ink, and this is the way up.
    const chain: Holon[] = []
    for (let n: Holon | null = holon.parent; n; n = n.parent) chain.unshift(n)
    const crumbs = document.createElement("div")
    crumbs.className = "crumbs"
    chain.forEach((h, i) => {
      const a = document.createElement("a")
      a.textContent = nameOf(dream, h)
      a.addEventListener("click", () => select(h))
      crumbs.append(a)
      if (i < chain.length - 1) crumbs.append(" › ")
    })
    if (chain.length) el.append(crumbs)

    const name = document.createElement("div")
    name.className = "name"
    name.innerHTML = `${nameOf(dream, holon)} <span class="cls">${classNameOf(holon)}</span>`
    el.append(name)

    const timeline = dream.build()
    for (const group of inspectorGroups(holon, timeline.params as Param<ParamValue>[])) {
      const h = document.createElement("h4")
      h.textContent = group.title
      el.append(h)
      for (const { name: pname, param } of group.entries) {
        const row = document.createElement("div")
        row.className = "row"
        const v = param.value
        const label = document.createElement("span")
        label.textContent = pname
        const value = document.createElement("span")
        // A string param says arbitrary text — set it as text, never markup.
        if (isColor(v)) value.innerHTML = `<span class="sw" style="background:${css(v)}"></span>`
        else value.textContent = formatValue(v)
        row.append(label, value)
        el.append(row)
      }
    }

    const path = pathOf(dream.roots, holon)
    if (path) {
      const q = new URLSearchParams({ scene: sceneKey, t: now().toFixed(2), sel: encodePath(path), creator: "1" })
      const open = document.createElement("a")
      open.className = "open"
      open.href = `/?${q.toString()}`
      open.textContent = "open in editor ↗"
      el.append(open)
    }
  }

  render(null)
  return {
    show: (on) => el.classList.toggle("on", on),
    render,
  }
}
