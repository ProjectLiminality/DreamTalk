/**
 * Holon actions in the editor (src/actions.ts) — the inspector's Actions
 * group, and a minimal menu on a long press over the viewport.
 *
 * Every sovereign symbol (a DreamNode: its own repo) carries two built-ins:
 *   open DreamNode — its defining file in the code view (where its skills live);
 *   dive in        — it becomes the scene: one layer down the holarchy
 *                    (`?path=` — the Dream Explorer's own addressing), and
 *                    "up" climbs back.
 * then whatever it declares itself (`actions()`).
 *
 * The long press is the pointer's "pinch and hold": 550 ms still over a
 * holon opens the menu at the pointer; a click on an entry runs it, a
 * click anywhere else (or Esc) closes it. Hands (pinch-hold) call
 * `menuAt(x, y)` the same way.
 */

import type { ActionContext, HolonAction } from "../src/actions"
import type { Holon } from "../src/holon"
import { isSovereign, nodeNameOf } from "./dreamnodes"

export interface ActionsOpts {
  canvas: HTMLCanvasElement
  pick(clientX: number, clientY: number): Holon | undefined
  /** The scene's registry key and its path below it (`?path=`). */
  sceneKey: string
  path: readonly string[]
  /** Show a repo-relative file in the code view. */
  showSource(file: string): void
  /** Is something else holding the pointer (a drag, a move)? */
  busy(): boolean
  /** Unpack a symbol in place — its own song, then back (editor/nest.ts). */
  unpack?(holon: Holon): void
  note(text: string): void
  signal: AbortSignal
}

/** The nearest sovereign holon at-or-above a hit (the DreamNode that was touched). */
export const sovereignAt = (hit: Holon | undefined): Holon | undefined => {
  for (let h: Holon | null | undefined = hit; h; h = h.parent) if (isSovereign(h)) return h
  return undefined
}

/** The URL one layer down (dive) or up (climb) the holarchy from here. */
export const placeUrl = (search: string, sceneKey: string, path: readonly string[]): string => {
  const q = new URLSearchParams(search)
  q.set("scene", sceneKey)
  if (path.length) q.set("path", path.join("/"))
  else q.delete("path")
  for (const k of ["sel", "t", "session"]) q.delete(k)
  return `?${q}`
}

/** Everything a holon offers: its own actions after the DreamNode built-ins. */
export const actionsOf = (holon: Holon, opts: Pick<ActionsOpts, "sceneKey" | "path" | "unpack">): HolonAction[] => {
  const out: HolonAction[] = []
  if (isSovereign(holon)) {
    const name = nodeNameOf(holon)
    // Unpack: its own song (or state space) right here, and back to this moment.
    if (opts.unpack) {
      const unpack = opts.unpack
      out.push({ id: "unpack", label: `unpack ${name}`, run: () => unpack(holon) })
    }
    out.push({
      id: "open",
      label: `open ${name}'s DreamNode`,
      async run(ctx) {
        const res = await fetch(`/api/where?name=${encodeURIComponent(name)}`).catch(() => undefined)
        const file = res?.ok ? ((await res.json()) as { file?: string }).file : undefined
        if (file) ctx.showSource(file)
        else ctx.note(`no file declares ${name}`)
      },
    })
    if (opts.path[opts.path.length - 1] !== name)
      out.push({ id: "dive", label: `dive into ${name}`, run: (ctx) => ctx.dive() })
  }
  for (const a of holon.actions() ?? []) out.push(a)
  return out
}

export interface Actions {
  /** The actions of the holon under a point (its nearest sovereign, or itself). */
  at(clientX: number, clientY: number): { holon: Holon; actions: HolonAction[] } | undefined
  /** Open the menu at a point (long press, pinch-hold). True when there was something to show. */
  menuAt(clientX: number, clientY: number): boolean
  closeMenu(): boolean
  run(holon: Holon, id: string): Promise<boolean>
  /** "Up" one layer, when the scene is a node below another. */
  up(): boolean
  /** The inspector's Actions group for a holon. */
  inspect(parent: HTMLElement, holon: Holon): void
}

const HOLD_MS = 550
const HOLD_SLOP = 6

export const mountActions = (opts: ActionsOpts): Actions => {
  const { canvas, signal } = opts
  const menu = document.createElement("div")
  menu.className = "actionmenu"
  menu.style.display = "none"
  document.body.appendChild(menu)
  signal.addEventListener("abort", () => menu.remove())

  const contextFor = (holon: Holon): ActionContext => ({
    holon,
    note: opts.note,
    showSource: opts.showSource,
    open: (url) => window.open(url, "_blank", "noopener"),
    dive: () => {
      const name = nodeNameOf(holon)
      location.search = placeUrl(location.search, opts.sceneKey, [...opts.path, name])
    },
  })

  const run = async (holon: Holon, id: string): Promise<boolean> => {
    const a = actionsOf(holon, opts).find((x) => x.id === id)
    if (!a) return false
    await a.run(contextFor(holon))
    return true
  }

  const at = (x: number, y: number) => {
    const hit = opts.pick(x, y)
    for (let h: Holon | null | undefined = hit; h; h = h.parent) {
      const actions = actionsOf(h, opts)
      if (actions.length) return { holon: h, actions }
    }
    return undefined
  }

  const closeMenu = (): boolean => {
    if (menu.style.display === "none") return false
    menu.style.display = "none"
    return true
  }

  const menuAt = (x: number, y: number): boolean => {
    const found = at(x, y)
    if (!found) return false
    menu.innerHTML = ""
    const title = document.createElement("div")
    title.className = "actiontitle"
    title.textContent = nodeNameOf(found.holon)
    menu.appendChild(title)
    for (const a of found.actions) {
      const item = document.createElement("div")
      item.className = "actionitem"
      item.textContent = a.label
      item.addEventListener("pointerdown", (e) => {
        e.stopPropagation()
        closeMenu()
        void a.run(contextFor(found.holon))
      })
      menu.appendChild(item)
    }
    menu.style.left = `${Math.min(x + 8, window.innerWidth - 220)}px`
    menu.style.top = `${Math.min(y + 8, window.innerHeight - 30 * (found.actions.length + 1))}px`
    menu.style.display = ""
    return true
  }

  // The long press: still for HOLD_MS over a holon → the menu, and the
  // release that ends the press is swallowed (no click, no fire, no select).
  let press: { x: number; y: number; timer: ReturnType<typeof setTimeout>; held: boolean } | null = null
  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (closeMenu()) {
        e.stopImmediatePropagation()
        return
      }
      if (e.button !== 0) return
      const id = e.pointerId
      press = {
        x: e.clientX,
        y: e.clientY,
        held: false,
        timer: setTimeout(() => {
          if (!press || opts.busy()) return
          press.held = menuAt(press.x, press.y)
          // The press became a hold: whatever it began elsewhere (a flight) lets go.
          if (press.held) canvas.dispatchEvent(new PointerEvent("pointercancel", { pointerId: id }))
        }, HOLD_MS),
      }
    },
    { signal, capture: true },
  )
  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (press && !press.held && Math.hypot(e.clientX - press.x, e.clientY - press.y) > HOLD_SLOP) {
        clearTimeout(press.timer)
        press = null
      }
    },
    { signal, capture: true },
  )
  canvas.addEventListener(
    "pointerup",
    (e) => {
      if (!press) return
      clearTimeout(press.timer)
      if (press.held) e.stopImmediatePropagation()
      press = null
    },
    { signal, capture: true },
  )
  document.addEventListener("pointerdown", (e) => {
    if (!menu.contains(e.target as Node) && e.target !== canvas) closeMenu()
  }, { signal })

  return {
    at,
    menuAt,
    closeMenu,
    run,
    up() {
      if (opts.path.length === 0) return false
      location.search = placeUrl(location.search, opts.sceneKey, opts.path.slice(0, -1))
      return true
    },
    inspect(parent, holon) {
      const actions = actionsOf(holon, opts)
      if (!actions.length) return
      const box = document.createElement("div")
      box.className = "group actionsgroup"
      const h = document.createElement("h3")
      h.textContent = "Actions"
      box.appendChild(h)
      for (const a of actions) {
        const item = document.createElement("div")
        item.className = "actionrow"
        item.textContent = a.label
        item.addEventListener("click", () => void a.run(contextFor(holon)))
        box.appendChild(item)
      }
      parent.appendChild(box)
    },
  }
}
