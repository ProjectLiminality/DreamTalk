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
 *
 * And it COMMENTS — the one thing the player does write, because a note
 * changes no source. Claude-artifact style: select anything, at any t,
 * and leave a note (typed, or dictated through the mic) under its params.
 * The note is anchored to the holon's stable path + class, its field name,
 * and the t, and lands beside the scene's DreamWeaving as git-tracked data
 * (scripts/comments.ts), where `bun scripts/comments.ts --open` hands it to
 * an agent with the file:line that makes that holon. With nothing selected
 * the panel lists the scene's notes; each one's time is the way back to
 * it, and each can be resolved in place. The block itself is the editor's
 * (editor/comments.ts) — one comment mode, two hosts.
 */

import type { Dream } from "../src/index"
import type { Holon } from "../src/holon"
import type { Param, ParamValue } from "../src/params"
import { isColor, type Color } from "../src/constants"
import { inspectorGroups, formatValue } from "../editor/inspector"
import { classNameOf } from "../editor/classname"
import { rootIdentityOf } from "../editor/outline"
import { pathOf, resolvePath, type SelectionPath } from "../editor/selection"
import { holonAnchor, mountComments, type Comment } from "../editor/comments"
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
#dt-creator-panel .commentsec { margin-top: 14px; padding-top: 10px; border-top: 1px solid #222; }
#dt-creator-panel .commentsec h2 { margin: 0 0 6px; color: #666; font-size: 10px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; }
#dt-creator-panel .commentlist { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
#dt-creator-panel .empty { color: #555; font-size: 11px; font-style: italic; }
#dt-creator-panel .comment { border-left: 2px solid ${GOLD_CSS}; background: #141414; border-radius: 0 4px 4px 0; padding: 5px 8px; }
#dt-creator-panel .comment.resolved { border-left-color: #333; opacity: .5; }
#dt-creator-panel .cmeta { display: flex; align-items: baseline; color: #666; font-size: 10px; font-variant-numeric: tabular-nums; margin-bottom: 2px; }
#dt-creator-panel .cwhen { color: #888; text-decoration: none; cursor: pointer; }
#dt-creator-panel a.cwhen:hover { color: ${GOLD_CSS}; }
#dt-creator-panel .cresolve { margin-left: auto; background: none; border: none; padding: 0; color: #777; font-size: 10px; cursor: pointer; }
#dt-creator-panel .cresolve:hover { color: ${GOLD_CSS}; }
#dt-creator-panel .cbody { color: #e6e6e6; white-space: pre-wrap; overflow-wrap: anywhere; }
#dt-creator-panel .composer { display: grid; grid-template-columns: 28px 1fr auto; gap: 6px; align-items: end; }
#dt-creator-panel .micbtn { width: 28px; height: 28px; border-radius: 50%; border: 1px solid #333; background: #141414; color: #ccc; cursor: pointer; padding: 0; font-size: 12px; }
#dt-creator-panel .micbtn.recording { border-color: #e66; color: #e66; }
#dt-creator-panel .commentinput { resize: none; overflow: hidden; min-height: 28px; width: 100%; box-sizing: border-box;
  background: #141414; color: #fff; border: 1px solid #333; border-radius: 6px; padding: 6px 8px; font: 12px/1.4 -apple-system, system-ui, sans-serif; }
#dt-creator-panel .commentinput:focus { outline: none; border-color: ${GOLD_CSS}; }
#dt-creator-panel .attachbtn { height: 28px; border-radius: 6px; border: 1px solid #333; background: #141414; color: #ccc; cursor: pointer; font-size: 11px; padding: 0 10px; }
#dt-creator-panel .attachbtn:hover:not(:disabled) { border-color: ${GOLD_CSS}; color: ${GOLD_CSS}; }
#dt-creator-panel .attachbtn:disabled { opacity: .4; cursor: default; }
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
  /** Go to a note: its t on screen, its holon selected. */
  seekTo(comment: Comment): void
}

/** The panel's comment mode — what it needs beyond reading. */
export interface PanelComments {
  /** Stand the held song at t (a note's own moment). */
  seek(t: number): void
  /** The scene's notes changed — loaded, attached, resolved. */
  onChange?(all: readonly Comment[]): void
  /** The selection's screen bounds, in drawing-buffer pixels. */
  bounds?(holon: Holon): { minX: number; minY: number; maxX: number; maxY: number } | undefined
  signal: AbortSignal
}

export const mountCreatorPanel = (
  dream: Dream,
  sceneKey: string,
  now: () => number,
  select: (holon: Holon) => void,
  /**
   * Where the editor can open this holon, when the page is not simply
   * `sceneKey` — an entered DreamNode (demo/explorer.ts). The editor
   * opens registered scenes, so it is told which one, and what to select.
   */
  addressOf?: (holon: Holon) => { scene: string; sel?: SelectionPath; t: number },
  /** Comment mode; absent, the panel only reads. */
  comments?: PanelComments,
): CreatorPanel => {
  const style = document.createElement("style")
  style.textContent = STYLE
  document.head.append(style)
  const el = document.createElement("div")
  el.id = "dt-creator-panel"
  document.body.append(el)

  const header = `<div class="mode">creator mode</div><div class="hint">${CREATOR_KEY.label} or esc returns to the game</div>`

  // What is selected is re-drawn on every select; the comment block below
  // it is mounted once, so a half-typed note survives a re-render.
  const body = document.createElement("div")
  el.append(body)
  let selected: Holon | null = null
  const seekTo = (c: Comment) => {
    comments?.seek(c.t)
    const holon = c.path ? resolvePath(dream.roots, c.path) : null
    if (holon) select(holon)
  }
  const notes = comments
    ? mountComments(
        el,
        {
          scene: sceneKey,
          path: () => (selected ? (pathOf(dream.roots, selected) ?? null) : null),
          label: () => (selected ? nameOf(dream, selected) : sceneKey),
          anchor: () => (selected ? holonAnchor(dream, selected) : {}),
          currentT: now,
          bounds: () => (selected ? comments.bounds?.(selected) : undefined),
          listAll: true,
          seek: seekTo,
          onChange: comments.onChange,
        },
        comments.signal,
      )
    : undefined

  const render = (holon: Holon | null) => {
    selected = holon
    notes?.refresh()
    body.innerHTML = header
    if (!holon) {
      body.insertAdjacentHTML("beforeend", `<div class="crumbs">hover to see what is there · click to select it</div>`)
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
    if (chain.length) body.append(crumbs)

    const name = document.createElement("div")
    name.className = "name"
    name.innerHTML = `${nameOf(dream, holon)} <span class="cls">${classNameOf(holon)}</span>`
    body.append(name)

    const timeline = dream.build()
    for (const group of inspectorGroups(holon, timeline.params as Param<ParamValue>[])) {
      const h = document.createElement("h4")
      h.textContent = group.title
      body.append(h)
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
        body.append(row)
      }
    }

    const address = addressOf?.(holon) ?? { scene: sceneKey, sel: pathOf(dream.roots, holon), t: now() }
    if (address.sel) {
      const q = new URLSearchParams({
        scene: address.scene,
        t: address.t.toFixed(2),
        sel: encodePath(address.sel),
        creator: "1",
      })
      const open = document.createElement("a")
      open.className = "open"
      open.href = `/?${q.toString()}`
      open.textContent = "open in editor ↗"
      body.append(open)
    }
  }

  render(null)
  return {
    show: (on) => el.classList.toggle("on", on),
    render,
    seekTo,
  }
}
