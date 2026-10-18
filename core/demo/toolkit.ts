/**
 * toolkit.ts — three demo pieces for any hyperobject, in the player and the
 * editor alike:
 *
 * LINKS TO ANY STATE. The whole state — t, song or free play, every fire
 * walked (the automaton's journal, replayed at its own clocks: no second
 * state model), the view, the nest stack — rides in the URL as `&state=…`
 * and is restored exactly on load. A move (a fire, free play on or off, a
 * level opened or closed) is a history entry, so back and forward walk it;
 * time and the view only update the current entry. ⇧1–9 saves the state to
 * a slot (per scene, in localStorage), 1–9 recalls it — outside free play,
 * where the digits are the axes' own keys; ⌥1–9 recalls anywhere.
 *
 * MINIMAP (`y`). The scene's machine as a small StateLattice in a corner
 * (factored as the lattice factors it): the current state glowing, the path
 * walked this session as a gold thread. Drawn only when the state changes.
 *
 * PRESENTER (`q`, `&presenter=1`). Every piece of dev chrome hidden — the
 * HUD, readouts, notes, panels, the hover ticks and captions — for a clean
 * picture; `q` again brings it back. The URL keeps it, so a demo link opens clean.
 *
 * The keys are in RESERVED_KEYS (src/automaton.ts).
 */

import { Dream, type DreamSlot } from "../src/dream"
import { together } from "../src/anim"
import { Create } from "../src/verbs"
import { gatherStateSpace, type Fired, type StateSpace } from "../src/automaton"
import { machinesOf, currentNode } from "../src/lattice"
import { Polylines, deriveLoops } from "../src/parts/polylines"
import { ThreeHost } from "../src/render/three-host"
import { GOLD } from "../src/constants"
import type { Holon } from "../src/holon"
import type { Param } from "../src/params"
import type { ViewDelta, ViewLayer } from "../src/view"
import { StateLattice } from "../vocabulary/StateLattice/StateLattice"
import type { GameLoop } from "./game"
import type { Nest } from "../editor/nest"

export const PRESENTER_KEY = "q"
export const MINIMAP_KEY = "y"
/** ⇧1–9 on a US layout: the slot-saving keys, as an axis would see them. */
export const SHIFTED_DIGITS = ["!", "@", "#", "$", "%", "^", "&", "*", "("]

/** What the toolkit needs of the page that hosts it. */
export interface ToolkitHost {
  sceneKey: string
  game: GameLoop
  view(): ViewLayer | undefined
  nest?: Nest
  /** The song's t on screen (free play: where it is held). */
  t(): number
  /** Put the song at t, playing or held in free play (game.enter(t)). */
  seek(t: number, free: boolean): Promise<void>
  /** The scene's holons and its own state space: the minimap's machine. */
  roots: readonly Holon[]
  space?: StateSpace
  /** The scene's own presenter slots (Dream.slots): slot k is [k − 1], unless the viewer saved one. */
  slots?: readonly DreamSlot[]
  signal: AbortSignal
}

/** A scene slot as a link state: the song moment, held in free play unless told otherwise, with its levels. */
export const sceneSlotState = (s: DreamSlot): LinkState => ({
  t: s.t,
  ...(s.free === false ? {} : { f: { c: 0, j: [] } }),
  ...(s.nest?.length ? { n: [...s.nest] } : {}),
})

/** A state, as a link holds it. */
export interface LinkState {
  /** Song t. */
  t: number
  /** In free play: its clock, and the fires walked as [clock, axis index, position index]. */
  f?: { c: number; j: [number, number, number][] }
  /** The view's offset from the song's camera. */
  v?: number[]
  /** The nest stack, by level name (Nest.path). */
  n?: string[]
}

const VIEW_KEYS = ["phi", "theta", "tilt", "dolly", "x", "y", "z"] as const
const r3 = (x: number) => Math.round(x * 1000) / 1000

export const encodeState = (s: LinkState): string =>
  btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

export const decodeState = (code: string | null): LinkState | undefined => {
  if (!code) return undefined
  try {
    const s = JSON.parse(decodeURIComponent(escape(atob(code.replace(/-/g, "+").replace(/_/g, "/"))))) as LinkState
    return typeof s.t === "number" ? s : undefined
  } catch {
    return undefined
  }
}

/** The state on screen now. */
export const captureState = (host: ToolkitHost): LinkState => {
  const g = host.game
  const s: LinkState = { t: r3(g.on ? g.heldAt : host.t()) }
  if (g.on) {
    const axes = g.automaton.axes
    const j: [number, number, number][] = []
    for (const f of g.automaton.journal) {
      const i = axes.findIndex((a) => a.id === f.axis)
      const p = i < 0 ? -1 : axes[i]!.positions.findIndex((q) => q.name === f.position)
      if (p >= 0) j.push([r3(f.clock), i, p])
    }
    s.f = { c: r3(g.automaton.clock), j }
    // Under an open level the song's view has glided into the symbol: keep where it stood.
    const d = host.nest?.depth ? host.nest.outerDelta : host.view()?.delta
    if (d && VIEW_KEYS.some((k) => Math.abs(d[k]) > 1e-6)) s.v = VIEW_KEYS.map((k) => r3(d[k]))
  }
  if (host.nest?.depth) s.n = host.nest.path
  return s
}

/** Put a state back: the song at t, the walk replayed, the view, the nest reopened. */
export const restoreState = async (host: ToolkitHost, s: LinkState): Promise<void> => {
  const nest = host.nest
  while (nest && nest.depth > 0) if (!(await nest.back())) break
  await host.seek(s.t, !!s.f)
  const g = host.game
  if (s.f && g.on) {
    const axes = g.automaton.axes
    const fired: Fired[] = []
    for (const [clock, i, p] of s.f.j) {
      const a = axes[i]
      const pos = a?.positions[p]
      if (a && pos) fired.push({ clock, axis: a.id, position: pos.name })
    }
    g.replay(fired, s.f.c)
    const view = host.view()
    if (view && s.v) {
      const d = { ...view.delta } as ViewDelta
      VIEW_KEYS.forEach((k, i) => (d[k] = s.v![i] ?? 0))
      view.delta = d
    }
  }
  for (const name of s.n ?? []) if (!nest || !(await nest.openByName(name))) break
}

// --- The minimap ---------------------------------------------------------------------

interface Minimap {
  show(on: boolean): void
  readonly on: boolean
  /** The state may have moved: redraw if it did. */
  update(): void
}

const mountMinimap = (host: ToolkitHost): Minimap => {
  let on = false
  let mounted: Promise<{ canvas: HTMLCanvasElement; three: ThreeHost; lattice: StateLattice; segs: { x: number; y: number; z: number }[][]; last: number[] } | undefined> | undefined
  let seen = ""
  const mount = () =>
    (mounted ??= (async () => {
      const space = gatherStateSpace(host.roots, host.space)
      if (!space.axes.length) return undefined
      // One block on a 16:9 grid (not a block per machine, left to right): it fits a corner.
      const top = machinesOf(space)
      const machine = top.parts.length > 1 ? { ...top, parts: [top] } : top
      const lattice = new StateLattice({ machine, playhead: "live", labels: false, blockAspect: 16 / 9 })
      const thread = new Polylines({ tint: GOLD, stroke: 2.2 })
      const segs: { x: number; y: number; z: number }[][] = []
      deriveLoops(thread, () => [segs.length], () => segs)
      const MinimapDream = class extends Dream {
        unfold() {
          this.stage(lattice)
          this.stage(thread)
          this.play(together(Create(lattice), Create(thread)), 0.01)
        }
      }
      const dream = new MinimapDream()
      const canvas = document.createElement("canvas")
      canvas.width = 480
      canvas.height = 270
      canvas.dataset.dtChrome = "minimap"
      canvas.style.cssText =
        "position:fixed;right:12px;bottom:12px;width:240px;height:135px;z-index:44;pointer-events:none;border:1px solid #222;border-radius:4px;background:#000;opacity:.92"
      document.body.append(canvas)
      const three = await ThreeHost.mount(dream, canvas)
      host.signal.addEventListener("abort", () => {
        canvas.remove()
        three.dispose()
      })
      await three.renderFrame(1)
      // Framed to the whole lattice, in its own camera.
      const b = three.worldBoundsOf(lattice)
      if (b) {
        const o = dream.observer
        const set = (p: Param<number>, v: number) => (p.value = p.defaultValue = v)
        set(o.x, (b.min.x + b.max.x) / 2)
        set(o.y, (b.min.y + b.max.y) / 2)
        const R = Math.max((b.max.x - b.min.x) / (16 / 9), b.max.y - b.min.y) / 2
        set(o.radius, (R / (0.85 * Math.tan(o.fov.value / 2))) * (o.zoom.value || 1))
      }
      const last = lattice.drawn.map((d) => currentNode(d.factor))
      return { canvas, three, lattice, segs, last }
    })())
  const update = async () => {
    if (!on) return
    const m = await mount()
    if (!m) return
    const key = host.game.on ? host.game.state().map((s) => s.position).join() + host.game.automaton.journal.length : `song ${Math.round(host.t() * 4)}`
    if (key === seen) return
    seen = key
    // The path walked: a segment wherever a factor's node moved.
    m.lattice.drawn.forEach((d, i) => {
      const n = currentNode(d.factor)
      if (n !== m.last[i]) {
        m.segs.push([d.places[m.last[i]!]!, d.places[n]!])
        m.last[i] = n
      }
    })
    await m.three.renderFrame(1)
  }
  return {
    get on() {
      return on
    },
    show(v) {
      on = v
      seen = ""
      void mount().then((m) => {
        if (m) m.canvas.style.display = on ? "" : "none"
        void update()
      })
    },
    update: () => void update(),
  }
}

// --- Presenter mode ------------------------------------------------------------------

/** Dev chrome, in the player and the editor: hidden in presenter mode. */
const PRESENTER_CSS = `
body.dt-presenter #readout, body.dt-presenter .dt-game-hud, body.dt-presenter .dt-game-overlay,
body.dt-presenter #dt-game-overlay, body.dt-presenter .dt-hui, body.dt-presenter #dt-explorer,
body.dt-presenter [data-dt-chrome]:not([data-dt-chrome="minimap"]), body.dt-presenter .dt-toast,
body.dt-presenter #left, body.dt-presenter #cast, body.dt-presenter #panel, body.dt-presenter #codeview,
body.dt-presenter #timeline, body.dt-presenter #ptransport, body.dt-presenter #namechip,
body.dt-presenter #drophint, body.dt-presenter #marquee { display: none !important; }
body.dt-presenter #app { grid-template-columns: 0 1fr 0 0 !important; grid-template-rows: 1fr 0 !important; }
body.dt-presenter #viewport { padding: 0 !important; }
body.dt-presenter, body.dt-presenter canvas { cursor: none; }
.dt-toast { position: fixed; left: 50%; bottom: 48px; transform: translateX(-50%); color: #bbb; background: #111d;
  font: 13px monospace; padding: 6px 12px; border-radius: 4px; z-index: 60; pointer-events: none; transition: opacity .4s; }
`

// --- Mounted ------------------------------------------------------------------------

export interface Toolkit {
  /** Handle a key; true when it was ours. Call before the game loop's own keys. */
  key(e: KeyboardEvent): boolean
  /** Call once per drawn frame (cheap: compares a key). */
  tick(now: number): void
  readonly presenter: boolean
  setPresenter(on: boolean): void
  readonly minimap: boolean
  setMinimap(on: boolean): void
  capture(): LinkState
  restore(s: LinkState): Promise<void>
  save(slot: number): void
  recall(slot: number): Promise<boolean>
}

export const mountToolkit = (host: ToolkitHost): Toolkit => {
  if (!document.getElementById("dt-toolkit-style")) {
    const style = document.createElement("style")
    style.id = "dt-toolkit-style"
    style.textContent = PRESENTER_CSS
    document.head.append(style)
  }
  const toastEl = document.createElement("div")
  toastEl.className = "dt-toast"
  toastEl.style.opacity = "0"
  document.body.append(toastEl)
  let toastTimer = 0
  const toast = (text: string) => {
    toastEl.textContent = text
    toastEl.style.opacity = "1"
    clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => (toastEl.style.opacity = "0"), 1400)
  }

  const minimap = mountMinimap(host)
  let presenter = false
  const setPresenter = (on: boolean) => {
    presenter = on
    document.body.classList.toggle("dt-presenter", on)
    window.dispatchEvent(new Event("resize"))
  }

  // --- The URL: a move pushes, time and the view replace.
  let restoring = false
  let lastMove = ""
  let lastCode = ""
  let lastWrite = 0
  const moveKey = (s: LinkState) => JSON.stringify([!!s.f, s.f?.j.length ?? 0, s.n ?? []])
  const write = (push: boolean) => {
    const s = captureState(host)
    const code = encodeState(s)
    lastMove = moveKey(s)
    if (code === lastCode) return
    lastCode = code
    const u = new URL(location.href)
    u.searchParams.set("state", code)
    // ?t= too: a page that reads only t (the editor's hold on a deep link) opens at the moment.
    u.searchParams.set("t", String(s.t))
    if (presenter) u.searchParams.set("presenter", "1")
    else u.searchParams.delete("presenter")
    if (minimap.on) u.searchParams.set("minimap", "1")
    else u.searchParams.delete("minimap")
    if (push) history.pushState({ dt: code }, "", u)
    else history.replaceState({ dt: code }, "", u)
  }
  const restore = async (s: LinkState) => {
    restoring = true
    try {
      await restoreState(host, s)
    } finally {
      restoring = false
      lastMove = moveKey(captureState(host))
      lastCode = encodeState(captureState(host))
    }
  }
  window.addEventListener(
    "popstate",
    () => {
      const s = decodeState(new URL(location.href).searchParams.get("state"))
      if (s) void restore(s)
    },
    { signal: host.signal },
  )

  // --- Slots.
  const slotsKey = `dt:views:${host.sceneKey}`
  const readSlots = (): Record<string, string> => {
    try {
      return JSON.parse(localStorage.getItem(slotsKey) ?? "{}") as Record<string, string>
    } catch {
      return {}
    }
  }
  const save = (slot: number) => {
    const slots = readSlots()
    slots[slot] = encodeState(captureState(host))
    try {
      localStorage.setItem(slotsKey, JSON.stringify(slots))
      toast(`⇧${slot} saved`)
    } catch {
      toast(`⇧${slot}: storage unavailable`)
    }
  }
  const recall = async (slot: number) => {
    // The viewer's own save first; else the scene's slot (Dream.slots), by name.
    const own = decodeState(readSlots()[slot] ?? null)
    const scene = own ? undefined : host.slots?.[slot - 1]
    const s = own ?? (scene && sceneSlotState(scene))
    if (!s) {
      toast(`${slot}: empty — ⇧${slot} saves`)
      return false
    }
    toast(scene ? `${slot} · ${scene.name}` : `${slot} ↺`)
    await restore(s)
    write(true)
    return true
  }

  // The scene's slots that open a level (Dream.slots nest): built in the
  // background once the page has settled, so recalling one only reveals it.
  const warmSlots = window.setTimeout(() => {
    for (const s of host.slots ?? []) if (s.nest?.[0]) host.nest?.prewarmByName(s.nest[0])
  }, 2500)
  host.signal.addEventListener("abort", () => clearTimeout(warmSlots))

  const q = new URLSearchParams(location.search)
  if (q.get("presenter") === "1") setPresenter(true)
  if (q.get("minimap") === "1") minimap.show(true)
  // Restored on the first frame, once the page has finished its own boot (its autoplay, its settle).
  let initial = decodeState(q.get("state"))
  if (!initial) lastMove = moveKey(captureState(host))

  return {
    key(e) {
      if (e.metaKey || e.ctrlKey) return false
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return false
      const digit = /^Digit([1-9])$/.exec(e.code)?.[1]
      if (digit && e.shiftKey && !e.altKey) {
        e.preventDefault()
        save(Number(digit))
        return true
      }
      if (digit && !e.shiftKey && (e.altKey || !host.game.on)) {
        e.preventDefault()
        void recall(Number(digit))
        return true
      }
      if (e.altKey || e.shiftKey) return false
      if (e.key === PRESENTER_KEY) {
        setPresenter(!presenter)
        write(false)
        return true
      }
      if (e.key === MINIMAP_KEY) {
        minimap.show(!minimap.on)
        toast(minimap.on ? "minimap" : "minimap off")
        write(false)
        return true
      }
      return false
    },
    tick(now) {
      if (initial) {
        void restore(initial)
        initial = undefined
      }
      if (restoring) return
      minimap.update()
      const s = captureState(host)
      const move = moveKey(s)
      if (move !== lastMove) {
        write(true)
        lastWrite = now
      } else if (now - lastWrite > 1000) {
        write(false)
        lastWrite = now
      }
    },
    get presenter() {
      return presenter
    },
    setPresenter,
    get minimap() {
      return minimap.on
    },
    setMinimap: (on) => minimap.show(on),
    capture: () => captureState(host),
    restore,
    save,
    recall,
  }
}
