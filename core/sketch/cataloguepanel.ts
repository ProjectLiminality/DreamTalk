/**
 * cataloguepanel.ts — the whiteboard's IMPORT panel: the whole visual
 * vocabulary (catalogue.ts) as a searchable shelf of pictures.
 *
 * "The same way a programmer imports modules and packages, you import
 * visual vocabulary into your scene, and you invoke it by drawing." Each
 * tile is the symbol itself, rendered small by the page's own renderer
 * (lazily, as it scrolls into view), with its name and one line about it.
 *
 *  - CLICK a tile — import it into this board, or un-import it: what the
 *    recognizer and the voice may answer with (board.ts `vocabulary`).
 *  - DRAG a tile onto the page — place it there at a comfortable size,
 *    invoked without drawing (and imported, if it was not).
 *  - Type to search names and descriptions; Enter imports the first match.
 *
 * Both are commands the page makes undoable (main.ts). A Mac-side
 * affordance: the tablet mirrors what gets placed, never the panel.
 */

import { catalogue, type CatalogueItem } from "./catalogue"

export interface CataloguePanelHost {
  /** The board's imported ids, as they are now. */
  imported(): string[]
  /** Import or un-import one symbol (one undo step). */
  toggle(id: string): void
  /** Place a symbol at a client point, if it is over the page (one undo step). */
  place(id: string, clientX: number, clientY: number): boolean
  /** Is this client point over the page? */
  overPage(clientX: number, clientY: number): boolean
  /** The symbol rendered small into a 2D canvas of this css size, or undefined. */
  renderThumb(item: CatalogueItem, cssW: number, cssH: number): Promise<HTMLCanvasElement | undefined>
  /** Shown in the status line. */
  flash(msg: string): void
  /** The panel opened or closed. */
  opened(open: boolean): void
}

export interface CataloguePanel {
  readonly isOpen: boolean
  open(): void
  close(): void
  toggle(): void
  /** The imports changed elsewhere (undo, redo, a load): re-mark the tiles. */
  refresh(): void
}

const THUMB_W = 160
const THUMB_H = 112

/** A tile's one line: the blurb, else the first sentence of what it says
 *  of itself, its own name dropped from the front ("Globe — the world…"). */
const lineOf = (item: CatalogueItem): string => {
  const e = item.entry
  if (e.blurb) return e.blurb
  let d = e.description.replace(new RegExp(`^(The\\s+)?${e.name}\\s+[—–-]\\s+`), "")
  d = d[0] ? d[0].toUpperCase() + d.slice(1) : d
  // One thought: up to the first full stop, colon, semicolon or dash.
  const end = d.search(/[.:;](\s|$)| [—–] /)
  return end > 0 ? `${d.slice(0, end).trimEnd()}.` : d
}

export const installCataloguePanel = (host: CataloguePanelHost): CataloguePanel => {
  const root = document.getElementById("catalogue") as HTMLDivElement
  root.innerHTML = `
    <div class="cat-head">
      <div class="cat-title"><b>Vocabulary</b><span class="cat-count"></span></div>
      <button class="cat-close" title="Close (Esc)">×</button>
    </div>
    <label class="cat-search"><span>⌕</span><input type="search" placeholder="Search symbols" spellcheck="false" autocomplete="off" /></label>
    <div class="cat-scroll"><div class="cat-body"></div><div class="cat-empty">Nothing on the shelf by that name.</div></div>
    <div class="cat-foot">Click to import into this board · drag onto the page to place</div>`
  const input = root.querySelector("input") as HTMLInputElement
  const body = root.querySelector(".cat-body") as HTMLDivElement
  const scroller = root.querySelector(".cat-scroll") as HTMLDivElement
  const countEl = root.querySelector(".cat-count") as HTMLSpanElement
  const emptyEl = root.querySelector(".cat-empty") as HTMLDivElement

  let items: CatalogueItem[] | undefined
  const tiles = new Map<string, HTMLDivElement>()
  const sections: { el: HTMLElement; ids: string[] }[] = []
  let isOpen = false

  // -- thumbnails: rendered one at a time as tiles come into view ----------
  const rendered = new Set<string>()
  const queue: CatalogueItem[] = []
  let rendering = false
  const pump = async () => {
    if (rendering) return
    rendering = true
    while (queue.length) {
      const item = queue.shift()!
      const tile = tiles.get(item.entry.id)
      if (!tile || rendered.has(item.entry.id)) continue
      rendered.add(item.entry.id)
      const canvas = await host.renderThumb(item, THUMB_W, THUMB_H).catch(() => undefined)
      const well = tile.querySelector(".cat-well") as HTMLDivElement
      if (canvas) {
        canvas.className = "cat-thumb"
        well.replaceChildren(canvas)
      } else {
        well.innerHTML = `<span class="cat-mono"></span>`
        well.querySelector(".cat-mono")!.textContent = item.entry.name.slice(0, 1)
      }
      well.classList.add("ready")
    }
    rendering = false
  }
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const id = (e.target as HTMLElement).dataset.id!
        const item = items?.find((i) => i.entry.id === id)
        if (item && !rendered.has(id) && !queue.includes(item)) queue.push(item)
        seen.unobserve(e.target)
      }
      void pump()
    },
    { root: scroller, rootMargin: "120px" },
  )

  // -- the shelf --------------------------------------------------------------
  const build = () => {
    items = catalogue()
    body.textContent = ""
    const groups: [string, CatalogueItem[]][] = [
      ["Shapes", items.filter((i) => i.kind === "shape")],
      ["Symbols", items.filter((i) => i.kind === "symbol")],
    ]
    for (const [label, list] of groups) {
      const h = document.createElement("div")
      h.className = "cat-section"
      h.textContent = label
      const grid = document.createElement("div")
      grid.className = "cat-grid"
      for (const item of list) grid.appendChild(tileFor(item))
      body.append(h, grid)
      sections.push({ el: h, ids: list.map((i) => i.entry.id) })
      sections.push({ el: grid, ids: list.map((i) => i.entry.id) })
    }
    for (const t of tiles.values()) seen.observe(t)
    refresh()
  }

  const tileFor = (item: CatalogueItem): HTMLDivElement => {
    const el = document.createElement("div")
    el.className = "cat-tile"
    el.dataset.id = item.entry.id
    el.innerHTML = `<div class="cat-well"></div><div class="cat-mark" title="Imported">✓</div><div class="cat-name"></div><div class="cat-line"></div>`
    el.querySelector(".cat-name")!.textContent = item.entry.name
    el.querySelector(".cat-line")!.textContent = lineOf(item)
    el.title = `${item.entry.name} — ${item.entry.description}`
    el.addEventListener("pointerdown", (e) => startPress(e, item, el))
    tiles.set(item.entry.id, el)
    return el
  }

  // -- click to import, drag to place ----------------------------------------
  const startPress = (e: PointerEvent, item: CatalogueItem, el: HTMLDivElement) => {
    if (e.button !== 0) return
    e.preventDefault()
    const x0 = e.clientX
    const y0 = e.clientY
    let ghost: HTMLDivElement | undefined
    const move = (m: PointerEvent) => {
      if (!ghost && Math.hypot(m.clientX - x0, m.clientY - y0) > 5) {
        ghost = document.createElement("div")
        ghost.className = "cat-ghost"
        const thumb = el.querySelector("canvas") as HTMLCanvasElement | null
        if (thumb) {
          const img = document.createElement("img")
          img.src = thumb.toDataURL()
          ghost.appendChild(img)
        }
        const name = document.createElement("span")
        name.textContent = item.entry.name
        ghost.appendChild(name)
        document.body.appendChild(ghost)
        root.classList.add("dragging")
        el.classList.add("lifted")
      }
      if (ghost) {
        ghost.style.left = `${m.clientX}px`
        ghost.style.top = `${m.clientY}px`
        ghost.classList.toggle("over", host.overPage(m.clientX, m.clientY))
      }
    }
    const up = (u: PointerEvent) => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
      if (ghost) {
        ghost.remove()
        root.classList.remove("dragging")
        el.classList.remove("lifted")
        if (u.type === "pointerup" && !host.place(item.entry.id, u.clientX, u.clientY)) host.flash("drop it on the page to place it")
      } else if (u.type === "pointerup") host.toggle(item.entry.id)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
  }

  // -- search -------------------------------------------------------------------
  const matches = (item: CatalogueItem, q: string): boolean => {
    if (!q) return true
    const hay = `${item.entry.name} ${item.entry.id} ${item.entry.blurb ?? ""} ${item.entry.description}`.toLowerCase()
    return q.split(/\s+/).every((w) => hay.includes(w))
  }
  /** Name matches first: "cyl" is the Cylinder before anything that mentions one. */
  const visible = (): CatalogueItem[] => {
    const q = input.value.trim().toLowerCase()
    const hits = (items ?? []).filter((i) => matches(i, q))
    return q ? [...hits].sort((a, b) => Number(!a.entry.name.toLowerCase().includes(q)) - Number(!b.entry.name.toLowerCase().includes(q))) : hits
  }
  const filter = () => {
    const shown = new Set(visible().map((i) => i.entry.id))
    for (const [id, t] of tiles) t.hidden = !shown.has(id)
    for (const s of sections) s.el.hidden = !s.ids.some((id) => shown.has(id))
    emptyEl.hidden = shown.size > 0
    // Tiles revealed by a search may never have scrolled into view.
    for (const [id, t] of tiles) if (shown.has(id) && !rendered.has(id)) seen.observe(t)
  }
  input.addEventListener("input", filter)
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault()
      if (input.value) {
        input.value = ""
        filter()
      } else close()
    } else if (e.key === "Enter") {
      e.preventDefault()
      const first = visible()[0]
      if (first && input.value.trim()) host.toggle(first.entry.id)
    }
    e.stopPropagation()
  })

  const refresh = () => {
    if (!items) return
    const imported = new Set(host.imported())
    for (const [id, t] of tiles) t.classList.toggle("imported", imported.has(id))
    const n = items.filter((i) => imported.has(i.entry.id)).length
    countEl.textContent = `${n} of ${items.length} imported`
  }

  const open = () => {
    if (!items) build()
    isOpen = true
    root.classList.add("open")
    host.opened(true)
    refresh()
    filter()
    setTimeout(() => input.focus(), 30)
  }
  const close = () => {
    isOpen = false
    root.classList.remove("open")
    host.opened(false)
    input.blur()
  }
  root.querySelector(".cat-close")!.addEventListener("click", close)

  return {
    get isOpen() {
      return isOpen
    },
    open,
    close,
    toggle: () => (isOpen ? close() : open()),
    refresh,
  }
}
