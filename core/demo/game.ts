/**
 * THE GAME LOOP — the player's free mode (docs/LOOPS.md loop 2; the
 * visual automaton of src/automaton.ts).
 *
 *   cutscene  — the song plays its one authored path (the default);
 *   game      — Space: the world holds at this t and becomes walkable.
 *               Every axis the scene's holons declare (Holon.stateSpace())
 *               is live: hover an element that owns one and it is quietly
 *               bracketed with what it would do; click (or its key) fires
 *               it. Fire again mid-flight and it turns around smoothly.
 *               Clocks (a FlowMap's particles) keep running.
 *   Space again — the walked state releases into the song over a beat
 *               (no pop) and the cutscene carries on from where it stood.
 *
 * `?play=free` opens straight into the game loop, at `?t=` or else at the
 * song's last pose (where everything has been built).
 *
 * THE AFFORDANCE. Creator mode owns gold: a rounded rim, a glowing dot,
 * "select". The game's is quieter and of another kind — four hairline
 * corner ticks in white (a viewfinder: "this can be acted on") and a
 * one-line caption naming the move (`grain → sorted`), with the ordinary
 * pointer. A fire brightens the ticks for a moment. Like creator's rims it
 * is a 2D overlay from boundsOf: nothing in the Dream, never in a capture.
 *
 * THE HUD. Bottom-left, above the readout, in the readout's own grey: one
 * row per axis walkable from here (the adjacent possible), its key, its
 * positions with the current one lit. Rows are clickable. `h` hides it;
 * `?hud=0` starts hidden.
 *
 * THE LAYER. The automaton writes ABOVE the timeline as the host's
 * `beforeSync` — the same seam the editor's live overrides use — so the
 * Dream, the gauntlet and every export see only the pure timeline.
 */

import type { Holon } from "../src/holon"
import type { Param, ParamValue } from "../src/params"
import { Automaton, gatherStateSpace, type Axis } from "../src/automaton"
import { lerpParamValue, smooth } from "../src/transitions"
import { bufferToClient, type PixelBox } from "../editor/creator"

export interface GameHost {
  canvas: HTMLCanvasElement
  pick(clientX: number, clientY: number): Holon | undefined
  boundsOf(holon: Holon): PixelBox | undefined
  /** Install (or clear) the per-frame write after the timeline's apply. */
  setBeforeSync(fn: (() => void) | undefined): void
}

export interface GameOpts {
  roots: readonly Holon[]
  /** The params the song's timeline animates (they snap back on their own). */
  animated: ReadonlySet<Param<ParamValue>>
  /** Is another mode (creator, explorer) holding the pointer right now? */
  suspended: () => boolean
  hud: boolean
  signal: AbortSignal
}

/** How long the walked state takes to hand back to the song (s). */
const RELEASE = 0.6
/** Breathing room between a handle's ink and its ticks (CSS px). */
const PAD = 8
const TICK = 10
const HOVER_STEP = 4
const CLICK_SLOP = 4
const FLASH_MS = 320
const AUTO_KEYS = "1234567890"

const STYLE = `
.dt-game-hud { position: fixed; left: 12px; bottom: 30px; color: #555; font: 12px monospace; line-height: 18px; user-select: none; z-index: 40; }
.dt-game-hud div { cursor: pointer; white-space: nowrap; }
.dt-game-hud div:hover { color: #888; }
.dt-game-hud b { font-weight: normal; color: #bbb; }
.dt-game-hud i { font-style: normal; color: #444; display: inline-block; width: 1.6em; }
.dt-game-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 45; }
`

export class GameLoop {
  readonly automaton: Automaton
  #on = false
  /** Wall-clock origin of the automaton's clock (ms); undefined = manual clock. */
  #origin: number | undefined = 0
  #heldAt = 0
  #pausedAt: number | undefined
  #release: { from: number; clock: number } | undefined
  #hovered: { handle: Holon; axis: Axis } | null = null
  #flash = 0
  #probe: { x: number; y: number } | null = null
  #press: { x: number; y: number } | null = null
  #hudShown: boolean
  readonly #keys = new Map<string, Axis>()
  readonly #handleOf = new Map<Holon, Axis[]>()
  readonly #host: GameHost
  readonly #opts: GameOpts
  readonly #hud: HTMLDivElement
  readonly #overlay: HTMLCanvasElement

  constructor(host: GameHost, opts: GameOpts) {
    this.#host = host
    this.#opts = opts
    this.#hudShown = opts.hud
    this.automaton = new Automaton(gatherStateSpace(opts.roots))
    // Declared keys first; then the free digits, in declaration order.
    for (const a of this.automaton.axes) if (a.key && !this.#keys.has(a.key)) this.#keys.set(a.key, a)
    const free = [...AUTO_KEYS].filter((k) => !this.#keys.has(k))
    for (const a of this.automaton.axes) {
      const key = a.key ? undefined : free.shift()
      if (key) this.#keys.set(key, a)
    }
    if (!document.getElementById("dt-game-style")) {
      const style = document.createElement("style")
      style.id = "dt-game-style"
      style.textContent = STYLE
      document.head.append(style)
    }
    this.#hud = document.createElement("div")
    this.#hud.className = "dt-game-hud"
    this.#hud.style.display = "none"
    this.#overlay = document.createElement("canvas")
    this.#overlay.className = "dt-game-overlay"
    document.body.append(this.#overlay, this.#hud)
    opts.signal.addEventListener("abort", () => {
      this.#hud.remove()
      this.#overlay.remove()
    })
    this.#hud.addEventListener("click", (e) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>("[data-axis]")?.dataset.axis
      if (id) this.fire(id)
    })

    const listen = { signal: opts.signal }
    const canvas = host.canvas
    canvas.addEventListener(
      "pointermove",
      (e) => {
        if (!this.#live()) return
        if (this.#probe && Math.hypot(e.clientX - this.#probe.x, e.clientY - this.#probe.y) < HOVER_STEP) return
        this.#probe = { x: e.clientX, y: e.clientY }
        this.hoverAt(e.clientX, e.clientY)
      },
      listen,
    )
    canvas.addEventListener("pointerleave", () => this.#setHovered(null), listen)
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (this.#live() && e.button === 0) this.#press = { x: e.clientX, y: e.clientY }
      },
      listen,
    )
    canvas.addEventListener(
      "pointerup",
      (e) => {
        const press = this.#press
        this.#press = null
        if (!this.#live() || !press) return
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP) return
        this.clickAt(e.clientX, e.clientY)
      },
      listen,
    )
  }

  get on(): boolean {
    return this.#on
  }

  /** Is anything walkable in this scene at all? */
  get walkable(): boolean {
    return this.automaton.axes.length > 0
  }

  /** The held song time the world stands at. */
  get heldAt(): number {
    return this.#heldAt
  }

  /** Is the walked state still handing back to the song? */
  get releasing(): boolean {
    return this.#release !== undefined
  }

  #live(): boolean {
    return this.#on && !this.#opts.suspended()
  }

  /**
   * Enter at song time `t`. The caller has just rendered t, so every
   * param stands at the timeline's pose — that pose is where we start.
   */
  enter(t: number, now = performance.now()): void {
    this.#release = undefined
    this.#on = true
    this.#heldAt = t
    this.#origin = now
    this.#pausedAt = undefined
    this.automaton.enter()
    this.#host.setBeforeSync(() => this.#write())
    this.#indexHandles()
    this.#renderHud()
  }

  /** Leave: the walked state releases into the song over RELEASE seconds. */
  leave(now = performance.now()): void {
    if (!this.#on) return
    this.#on = false
    this.#setHovered(null)
    this.#release = { from: now, clock: this.automaton.clock }
    this.#renderHud()
  }

  /** Advance the wall clock (a no-op on a manual clock). Call once per frame. */
  tick(now = performance.now()): void {
    if (this.#on && this.#origin !== undefined && this.#pausedAt === undefined) this.automaton.clock = (now - this.#origin) / 1000
    if (this.#release && (now - this.#release.from) / 1000 >= RELEASE) this.#finishRelease()
    this.#paint(now)
  }

  /** Hold the clock (creator mode froze the world) — resumed without a jump. Idempotent. */
  hold(held: boolean, now = performance.now()): void {
    if (this.#origin === undefined) return
    if (held) this.#pausedAt ??= now
    else if (this.#pausedAt !== undefined) {
      this.#origin += now - this.#pausedAt
      this.#pausedAt = undefined
    }
  }

  /** Headless: drive the clock by hand from here on. */
  at(clock: number): void {
    this.#origin = undefined
    this.automaton.clock = clock
  }

  fire(id: string, position?: string): void {
    if (!this.#on) return
    const a = this.automaton.axis(id)
    if (!this.automaton.enabled(a.id)) return
    this.automaton.fire(a.id, position)
    this.#flash = performance.now()
    this.#renderHud()
  }

  /** A key in game mode: true when it fired something. */
  key(e: Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey">): boolean {
    if (!this.#on || e.metaKey || e.ctrlKey || e.altKey) return false
    if (e.code === "KeyH") {
      this.#hudShown = !this.#hudShown
      this.#renderHud()
      return true
    }
    const a = this.#keys.get(e.key)
    if (!a || !this.automaton.enabled(a.id)) return false
    this.fire(a.id)
    return true
  }

  /** The axes as the HUD shows them — and the harness reads. */
  state(): { id: string; key?: string; position: string; positions: string[]; enabled: boolean; progress: number }[] {
    const keyOf = new Map([...this.#keys].map(([k, a]) => [a.id, k]))
    return this.automaton.axes.map((a) => ({
      id: a.id,
      key: keyOf.get(a.id),
      position: this.automaton.position(a.id),
      positions: a.positions.map((p) => p.name),
      enabled: this.automaton.enabled(a.id),
      progress: this.automaton.progress(a.id),
    }))
  }

  /** Hover as if the pointer stood here; returns the axis it would fire. */
  hoverAt(clientX: number, clientY: number): string | undefined {
    if (!this.#live()) return undefined
    this.#setHovered(this.#ownerAt(clientX, clientY))
    return this.#hovered?.axis.id
  }

  /** Click as if here: fires the owning axis, if any. */
  clickAt(clientX: number, clientY: number): string | undefined {
    const hit = this.#ownerAt(clientX, clientY)
    if (!hit) return undefined
    this.fire(hit.axis.id)
    this.#setHovered(hit)
    return hit.axis.id
  }

  // --- internals -----------------------------------------------------------

  #indexHandles(): void {
    this.#handleOf.clear()
    for (const a of this.automaton.axes) {
      for (const h of a.handles()) {
        const list = this.#handleOf.get(h) ?? []
        list.push(a)
        this.#handleOf.set(h, list)
      }
    }
  }

  /** Walk up from the picked holon to the nearest handle with a walkable axis. */
  #ownerAt(clientX: number, clientY: number): { handle: Holon; axis: Axis } | null {
    let node = this.#host.pick(clientX, clientY)
    while (node) {
      const axes = this.#handleOf.get(node)
      const a = axes?.find((x) => this.automaton.enabled(x.id))
      if (a) return { handle: node, axis: a }
      node = node.parent
    }
    return null
  }

  #setHovered(h: { handle: Holon; axis: Axis } | null): void {
    if (h?.handle === this.#hovered?.handle && h?.axis === this.#hovered?.axis) return
    this.#hovered = h
    this.#host.canvas.style.cursor = h ? "pointer" : ""
  }

  /** The live layer: after the timeline's apply, before the host syncs. */
  #write(): void {
    if (this.#on) {
      this.automaton.apply()
      return
    }
    const r = this.#release
    if (!r) return
    const k = smooth(Math.min(1, (performance.now() - r.from) / 1000 / RELEASE))
    for (const p of this.automaton.params) {
      if (p.isBound) continue
      const walked = this.automaton.valueAt(p, r.clock)
      // The song's value: fresh from apply() if it animates p, else what p held at entry.
      const song = this.#opts.animated.has(p) ? p.value : this.automaton.entryValue(p)
      if (walked === undefined || song === undefined) continue
      try {
        p.value = lerpParamValue(walked, song, k)
      } catch {
        p.value = k < 1 ? walked : song
      }
    }
  }

  #finishRelease(): void {
    this.#release = undefined
    this.#host.setBeforeSync(undefined)
    // A param the song never animates has nothing to rewrite it: put it back.
    for (const p of this.automaton.params) {
      if (this.#opts.animated.has(p) || p.isBound) continue
      const v = this.automaton.entryValue(p)
      if (v !== undefined) p.value = v
    }
  }

  #renderHud(): void {
    if (!this.#on || !this.#hudShown || !this.walkable) {
      this.#hud.style.display = "none"
      return
    }
    this.#hud.style.display = ""
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
    this.#hud.innerHTML = this.state()
      .filter((s) => s.enabled)
      .map((s) => {
        const a = this.automaton.axis(s.id)
        const pos = s.positions.map((p) => (p === s.position ? `<b>${esc(p)}</b>` : esc(p))).join(" · ")
        return `<div data-axis="${esc(s.id)}"><i>${esc(s.key ?? "")}</i>${esc(a.label)}  ${pos}</div>`
      })
      .join("")
  }

  #hudKey = ""

  #paint(now: number): void {
    // The adjacent possible moves with the picture: refresh the HUD when it changes.
    if (this.#on) {
      const key = this.state()
        .map((s) => `${s.enabled ? 1 : 0}${s.position}`)
        .join()
      if (key !== this.#hudKey) {
        this.#hudKey = key
        this.#renderHud()
      }
    }
    const o = this.#overlay
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(window.innerWidth * dpr)
    const h = Math.round(window.innerHeight * dpr)
    if (o.width !== w || o.height !== h) {
      o.width = w
      o.height = h
    }
    const ctx = o.getContext("2d")
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const hov = this.#hovered
    if (!hov || !this.#live()) return
    const box = this.#host.boundsOf(hov.handle)
    if (!box) return
    ctx.scale(dpr, dpr)
    const canvas = this.#host.canvas
    const r = bufferToClient(box, canvas.getBoundingClientRect(), canvas)
    const x0 = r.x - PAD
    const y0 = r.y - PAD
    const x1 = r.x + r.w + PAD
    const y1 = r.y + r.h + PAD
    const f = Math.max(0, 1 - (now - this.#flash) / FLASH_MS)
    const t = Math.min(TICK, (x1 - x0) / 3, (y1 - y0) / 3)
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.42 + 0.5 * f})`
    ctx.lineWidth = 1.25 + f
    ctx.beginPath()
    for (const [cx, cy, sx, sy] of [
      [x0, y0, 1, 1],
      [x1, y0, -1, 1],
      [x0, y1, 1, -1],
      [x1, y1, -1, -1],
    ] as const) {
      ctx.moveTo(cx + sx * t, cy)
      ctx.lineTo(cx, cy)
      ctx.lineTo(cx, cy + sy * t)
    }
    ctx.stroke()
    ctx.fillStyle = "rgba(136, 136, 136, 0.9)"
    ctx.font = "11px monospace"
    const a = this.automaton
    const going = a.progress(hov.axis.id) < 1
    const caption = going
      ? `${hov.axis.label} → ${a.position(hov.axis.id)}`
      : `${hov.axis.label} → ${a.next(hov.axis.id)}`
    ctx.fillText(caption, x0, y1 + 15)
  }
}
