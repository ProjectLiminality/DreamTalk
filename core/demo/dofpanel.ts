/**
 * dofpanel.ts — the player's SETTINGS: a scene's degrees of freedom, each
 * on or off (src/dof.ts). `,` opens and closes it, as does the small
 * button in the top right corner (a page in an iframe has no keys until it
 * is clicked, and a viewer may not know the key).
 *
 * It lists what the scene offers — its walkable axes, grouped by the holon
 * that owns them (the scene's own first), the levels its symbols unpack
 * into, its presenter slots — each a row that toggles. A group's name folds
 * it (a long one starts folded); its count toggles the whole group. A change applies at once: the game loop rebinds
 * its keys, handles stop answering, the minimap is drawn again, a level
 * refuses, a slot is silent. "reset" goes back to the scene's preset.
 *
 * The toggles are overrides of the preset (Dream.preset), kept per scene in
 * localStorage and in the URL as `&dof=` — a link opens with them; a link's
 * `dof` wins over what this browser kept. Closed by default, so presenter
 * mode shows nothing of it unless it is opened.
 */

import { DofMask, decodeDof, encodeDof, type Dof, type DofPreset } from "../src/dof"

export const DOF_KEY = ","
const PARAM = "dof"

const storageKey = (sceneKey: string) => `dt:dof:${sceneKey}`

/** A URL whose query keeps `:` and `,` as they are (legal there), so `&dof=-axis:grain,slot:3` reads as written. */
export const readableUrl = (u: URL): URL => {
  u.search = u.search.replace(/%3A/gi, ":").replace(/%2C/gi, ",")
  return u
}

/** The scene's mask as this page opens: its preset, under the link's toggles, else this browser's. */
export const loadMask = (sceneKey: string, preset: DofPreset): DofMask => {
  const q = new URLSearchParams(location.search)
  let code = q.get(PARAM)
  if (code === null) {
    try {
      code = localStorage.getItem(storageKey(sceneKey))
    } catch {
      code = null
    }
  }
  return new DofMask(preset, decodeDof(code))
}

/** Keep the viewer's toggles: in this browser, and in the URL (without a history entry). */
const persist = (sceneKey: string, mask: DofMask): void => {
  const code = encodeDof(mask.overrides())
  try {
    if (code) localStorage.setItem(storageKey(sceneKey), code)
    else localStorage.removeItem(storageKey(sceneKey))
  } catch {}
  try {
    const u = new URL(location.href)
    if (code) u.searchParams.set(PARAM, code)
    else u.searchParams.delete(PARAM)
    history.replaceState(history.state, "", readableUrl(u))
  } catch {}
}

const STYLE = `
.dt-dof { position: fixed; top: 12px; right: 12px; width: 260px; max-height: calc(100vh - 24px); overflow-y: auto;
  background: #000e; border: 1px solid #222; border-radius: 4px; color: #888; font: 12px monospace; line-height: 20px;
  padding: 8px 0; z-index: 70; user-select: none; cursor: default; scrollbar-width: thin; scrollbar-color: #333 transparent; }
.dt-dof .dt-dof-head { display: flex; justify-content: space-between; padding: 0 12px 6px; color: #bbb; }
.dt-dof .dt-dof-head span { color: #555; cursor: pointer; }
.dt-dof .dt-dof-head span:hover { color: #bbb; }
.dt-dof .dt-dof-group { display: flex; justify-content: space-between; padding: 6px 12px 0; color: #555; }
.dt-dof .dt-dof-group span { cursor: pointer; }
.dt-dof .dt-dof-group span:hover { color: #bbb; }
.dt-dof .dt-dof-row { display: flex; align-items: center; gap: 8px; padding: 0 12px 0 20px; cursor: pointer; white-space: nowrap; }
.dt-dof .dt-dof-row:hover { background: #111; }
.dt-dof .dt-dof-row i { flex: none; width: 7px; height: 7px; border-radius: 50%; border: 1px solid #bbb; background: #bbb; }
.dt-dof .dt-dof-row.off { color: #444; }
.dt-dof .dt-dof-row.off i { background: none; border-color: #444; }
.dt-dof .dt-dof-row b { font-weight: normal; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.dt-dof .dt-dof-row em { font-style: normal; color: #444; }
.dt-dof .dt-dof-empty { padding: 0 12px; color: #444; }
body.dt-presenter .dt-dof { cursor: default; }
.dt-dof-btn { position: fixed; top: 12px; right: 12px; z-index: 70; width: 28px; height: 28px; padding: 0;
  background: none; border: 1px solid #222; border-radius: 4px; color: #444; font: 16px/26px monospace; cursor: pointer; }
.dt-dof-btn:hover { color: #bbb; border-color: #444; }
`

export interface DofPanelHost {
  sceneKey: string
  mask: DofMask
  /** What the scene offers now (a lazy song's axes come and go): listed afresh on every open. */
  dofs(): Dof[]
  /** An axis's key, for its row (the game loop's binding), if it has one. */
  keyOf?(axisId: string): string | undefined
  signal: AbortSignal
}

export interface DofPanel {
  readonly open: boolean
  toggle(on?: boolean): void
  /** Handle a key; true when it was ours. */
  key(e: KeyboardEvent): boolean
}

export const mountDofPanel = (host: DofPanelHost): DofPanel => {
  if (!document.getElementById("dt-dof-style")) {
    const style = document.createElement("style")
    style.id = "dt-dof-style"
    style.textContent = STYLE
    document.head.append(style)
  }
  const el = document.createElement("div")
  el.className = "dt-dof"
  el.style.display = "none"
  document.body.append(el)
  const btn = document.createElement("button")
  btn.className = "dt-dof-btn"
  btn.title = `settings (${DOF_KEY})`
  btn.textContent = "⚙"
  btn.addEventListener("click", () => toggle(true), { signal: host.signal })
  document.body.append(btn)
  let open = false
  let listed: Dof[] = []
  /** Folded groups, by name — in a long list, a long group starts folded. */
  const folded = new Map<string, boolean>()
  const foldedAtFirst = (g: string): boolean => listed.length > 24 && listed.filter((d) => d.group === g).length > 8
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

  const render = () => {
    if (!open) return
    const m = host.mask
    const groups = new Map<string, Dof[]>()
    for (const d of listed) groups.set(d.group, [...(groups.get(d.group) ?? []), d])
    const changed = Object.keys(m.overrides()).length > 0
    let html = `<div class="dt-dof-head">degrees of freedom${changed ? `<span data-reset>reset</span>` : ""}</div>`
    if (!listed.length) html += `<div class="dt-dof-empty">nothing to switch</div>`
    for (const [g, ds] of groups) {
      const n = ds.filter((d) => m.on(d.id)).length
      const fold = folded.get(g) ?? foldedAtFirst(g)
      html +=
        `<div class="dt-dof-group"><span data-fold="${esc(g)}">${fold ? "▸" : "▾"} ${esc(g)}</span>` +
        `<span data-all="${esc(g)}" title="all on / off">${n}/${ds.length}</span></div>`
      if (fold) continue
      for (const d of ds) {
        const key = d.kind === "axis" ? host.keyOf?.(d.id.slice(5)) : undefined
        html +=
          `<div class="dt-dof-row${m.on(d.id) ? "" : " off"}" data-dof="${esc(d.id)}" title="${esc(d.id)}">` +
          `<i></i><b>${esc(d.label)}</b>${key ? `<em>${esc(key)}</em>` : ""}</div>`
      }
    }
    el.innerHTML = html
  }

  el.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement
      const m = host.mask
      if (t.closest("[data-reset]")) return m.reset()
      const id = t.closest<HTMLElement>("[data-dof]")?.dataset.dof
      if (id) return m.set(id, !m.on(id))
      const f = t.closest<HTMLElement>("[data-fold]")?.dataset.fold
      if (f !== undefined) {
        folded.set(f, !(folded.get(f) ?? foldedAtFirst(f)))
        return render()
      }
      const g = t.closest<HTMLElement>("[data-all]")?.dataset.all
      if (g === undefined) return
      // A group's count: all off if any is on, else all on.
      const ds = listed.filter((d) => d.group === g)
      const to = !ds.some((d) => m.on(d.id))
      m.setAll(ds.map((d) => d.id), to)
    },
    { signal: host.signal },
  )
  // Every change — here, or from a test or a hand — is kept and shown.
  const off = host.mask.subscribe(() => {
    persist(host.sceneKey, host.mask)
    render()
  })
  host.signal.addEventListener("abort", () => {
    off()
    el.remove()
    btn.remove()
  })

  const toggle = (on = !open) => {
    open = on
    el.style.display = on ? "" : "none"
    btn.style.display = on ? "none" : ""
    if (on) listed = host.dofs()
    render()
  }

  return {
    get open() {
      return open
    },
    toggle,
    key(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return false
      // The key, or the key where it lies (a layout whose `,` needs a modifier).
      if (e.key === DOF_KEY || (e.code === "Comma" && !e.shiftKey)) {
        e.preventDefault()
        toggle()
        return true
      }
      if (open && e.code === "Escape") {
        toggle(false)
        return true
      }
      return false
    },
  }
}
