/**
 * CREATOR MODE — the golden dot (docs/transmissions/2026-09-20-creator-mode.md).
 *
 *   "from anywhere, always, one key flips game mode → creator mode."
 *
 * Game mode plays WITHIN the rules: the cursor is the avatar and a click
 * fires. Creator mode plays WITH them: the cursor's agency is released as a
 * glowing golden dot, whatever it hovers is rimmed in gold, and a click
 * SELECTS the holon instead of firing it. Leaving, the glow concentrates
 * back into the avatar — the dot collapses where it stands and the arrow
 * is there again.
 *
 * One mechanism, two hosts. The demo player (`/demo/?scene=…`) and the
 * editor viewport both mount this over their stage canvas; it needs only
 * "what holon is under this point?" and "where is that holon on screen?",
 * which three-host already answers (pick / boundsOf). The editor already
 * selects on click, so there this module is the FEEL only (dot + gold rims)
 * and the editor's own selection store stays the one source of truth; the
 * demo player has no selection at all, so there it owns the click too.
 *
 * THE KEY. ⌘-Space was the transmission's guess, but it is macOS Spotlight,
 * and ⌥-Space is claimed by Raycast/Alfred/ChatGPT on many Macs. The lone
 * backquote (the key under Esc) is free in both pages and in every browser,
 * and it is the Quake console's key — the oldest "drop out of the game into
 * the engine" gesture there is. One constant; change it here.
 *
 * WHY A RIM AND NOT A RE-TINT. The DreamSong (demo/creatormode) lays a gold
 * halo OVER the element rather than re-colouring it: being looked at does
 * not change a thing, so the light has to be something additional. The rim
 * is drawn on a 2D overlay from boundsOf — no shader, no material, and
 * nothing in the Dream, so a capture can never carry it.
 */

import type { Holon } from "../src/holon"

/** The toggle — the key under Esc, unmodified. */
export const CREATOR_KEY = { code: "Backquote", label: "`" } as const

/** The gold — GoldenDot.ts's rgb(255,199,84), as CSS. */
export const GOLD_CSS = "rgb(255, 199, 84)"
const GOLD_RGBA = (a: number) => `rgba(255, 199, 84, ${a})`

/** Is this keydown the creator toggle? (Unmodified, so ⌘` window-cycling is untouched.) */
export const isCreatorToggle = (e: Pick<KeyboardEvent, "code" | "metaKey" | "ctrlKey" | "altKey">): boolean =>
  e.code === CREATOR_KEY.code && !e.metaKey && !e.ctrlKey && !e.altKey

/** A screen box in the canvas's drawing-buffer pixels — what boundsOf returns. */
export interface PixelBox {
  min: { x: number; y: number }
  max: { x: number; y: number }
}

/**
 * Drawing-buffer pixels → client (CSS) pixels. The stage is rendered at a
 * fixed buffer size and stretched to its CSS box, so the rim has to be
 * carried through the same stretch the pixels were.
 */
export const bufferToClient = (
  box: PixelBox,
  rect: { left: number; top: number; width: number; height: number },
  buffer: { width: number; height: number },
): { x: number; y: number; w: number; h: number } => {
  const sx = rect.width / (buffer.width || 1)
  const sy = rect.height / (buffer.height || 1)
  return {
    x: rect.left + box.min.x * sx,
    y: rect.top + box.min.y * sy,
    w: (box.max.x - box.min.x) * sx,
    h: (box.max.y - box.min.y) * sy,
  }
}

/**
 * A selection path as one URL-safe token — how the player hands the
 * editor "this holon": `root-i-j~ClassName` (`0~Calculator` for a root).
 * Same shape as selection.ts's SelectionPath, so the editor resolves it
 * with the rehydrate it already has.
 */
export const encodePath = (p: { root: number; indices: number[]; className: string }): string =>
  `${[p.root, ...p.indices].join("-")}~${p.className}`

export const decodePath = (
  token: string,
): { root: number; indices: number[]; className: string } | undefined => {
  const m = /^(\d+(?:-\d+)*)~(\w+)$/.exec(token)
  if (!m) return undefined
  const [root, ...indices] = m[1]!.split("-").map(Number)
  return { root: root!, indices, className: m[2]! }
}

export interface CreatorHost {
  canvas: HTMLCanvasElement
  pick(clientX: number, clientY: number): Holon | undefined
  boundsOf(holon: Holon): PixelBox | undefined
}

export interface CreatorOpts {
  /** The demo player owns its click; the editor's own handler selects. */
  clickSelects: boolean
  onToggle?: (on: boolean) => void
  onSelect?: (holon: Holon | null) => void
  signal: AbortSignal
}

/** How far the pointer travels before the hover re-picks (CSS px). */
const HOVER_STEP = 4
/** A press that travels further than this is not a click (CSS px). */
const CLICK_SLOP = 4
/** How long the dot takes to bloom and to collapse (ms) — the CSS transition. */
const BLOOM_MS = 380
/** Breathing room between a holon's ink and its rim (CSS px). */
const RIM_PAD = 9

const STYLE = `
.dt-dot { position: fixed; left: 0; top: 0; width: 0; height: 0; pointer-events: none; z-index: 60; display: none; }
.dt-dot.shown { display: block; }
.dt-dot > div { position: absolute; left: 0; top: 0; transform: scale(0); transition: transform ${BLOOM_MS}ms cubic-bezier(.2,.8,.2,1); }
.dt-dot.on > div { transform: scale(1); }
.dt-dot i { position: absolute; border-radius: 50%; transform: translate(-50%, -50%); }
.dt-dot .core { width: 12px; height: 12px; background: ${GOLD_CSS}; box-shadow: 0 0 10px ${GOLD_RGBA(0.9)}; }
.dt-dot .halo { width: 24px; height: 24px; border: 1.5px solid ${GOLD_RGBA(0.8)}; background: ${GOLD_RGBA(0.18)}; animation: dt-breathe 3.2s ease-in-out infinite; }
.dt-dot .aura { width: 40px; height: 40px; border: 1px solid ${GOLD_RGBA(0.4)}; background: ${GOLD_RGBA(0.08)}; animation: dt-breathe 3.2s ease-in-out infinite .4s; }
@keyframes dt-breathe { 0%, 100% { opacity: 1 } 50% { opacity: .55 } }
.dt-rims { position: fixed; inset: 0; pointer-events: none; z-index: 55; }
canvas.dt-creator { cursor: none !important; }
`

export class CreatorMode {
  #on = false
  #hovered: Holon | null = null
  #selected: Holon | null = null
  readonly #host: CreatorHost
  readonly #opts: CreatorOpts
  readonly #dot: HTMLDivElement
  readonly #rims: HTMLCanvasElement
  #probe: { x: number; y: number } | null = null
  #press: { x: number; y: number } | null = null
  #raf = 0
  #hideTimer: ReturnType<typeof setTimeout> | undefined

  constructor(host: CreatorHost, opts: CreatorOpts) {
    this.#host = host
    this.#opts = opts
    if (!document.getElementById("dt-creator-style")) {
      const style = document.createElement("style")
      style.id = "dt-creator-style"
      style.textContent = STYLE
      document.head.append(style)
    }
    this.#dot = document.createElement("div")
    this.#dot.className = "dt-dot"
    this.#dot.innerHTML = `<div><i class="aura"></i><i class="halo"></i><i class="core"></i></div>`
    this.#rims = document.createElement("canvas")
    this.#rims.className = "dt-rims"
    document.body.append(this.#rims, this.#dot)
    opts.signal.addEventListener("abort", () => {
      cancelAnimationFrame(this.#raf)
      this.#dot.remove()
      this.#rims.remove()
      host.canvas.classList.remove("dt-creator")
    })

    const listen = { signal: opts.signal }
    const canvas = host.canvas
    // The dot rides the pointer always (so it blooms where the arrow IS),
    // but is only shown over the stage — panels keep the ordinary cursor.
    window.addEventListener("pointermove", (e) => this.#follow(e.clientX, e.clientY), listen)
    canvas.addEventListener("pointerenter", () => this.#dot.classList.toggle("shown", this.#on), listen)
    canvas.addEventListener(
      "pointerleave",
      () => {
        if (!this.#on) return
        this.#dot.classList.remove("shown")
        this.#probe = null
        this.#setHovered(null)
      },
      listen,
    )
    canvas.addEventListener(
      "pointermove",
      (e) => {
        if (!this.#on) return
        if (this.#probe && Math.hypot(e.clientX - this.#probe.x, e.clientY - this.#probe.y) < HOVER_STEP) return
        this.#probe = { x: e.clientX, y: e.clientY }
        this.#setHovered(host.pick(e.clientX, e.clientY) ?? null)
      },
      listen,
    )
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (this.#on && e.button === 0) this.#press = { x: e.clientX, y: e.clientY }
      },
      listen,
    )
    canvas.addEventListener(
      "pointerup",
      (e) => {
        const press = this.#press
        this.#press = null
        if (!this.#on || !press || !this.#opts.clickSelects) return
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP) return
        // Select, don't fire. Empty space lets go.
        const hit = host.pick(e.clientX, e.clientY) ?? null
        this.select(hit)
        this.#opts.onSelect?.(hit)
      },
      listen,
    )
  }

  get on(): boolean {
    return this.#on
  }
  get hovered(): Holon | null {
    return this.#hovered
  }
  get selected(): Holon | null {
    return this.#selected
  }

  /** Flip (or set) the mode. Returns the new state. */
  toggle(on = !this.#on): boolean {
    if (on === this.#on) return on
    this.#on = on
    const canvas = this.#host.canvas
    if (this.#hideTimer !== undefined) clearTimeout(this.#hideTimer)
    if (on) {
      // The arrow becomes the dot: hidden and bloomed in the same frame.
      canvas.classList.add("dt-creator")
      this.#dot.classList.add("shown")
      requestAnimationFrame(() => this.#dot.classList.add("on"))
      this.#probe = null
      this.#loop()
    } else {
      // The glow concentrates back into the avatar: the dot collapses where
      // it stands, and only then is the arrow given back.
      this.#dot.classList.remove("on")
      this.#setHovered(null)
      this.#hideTimer = setTimeout(() => {
        this.#dot.classList.remove("shown")
        canvas.classList.remove("dt-creator")
      }, BLOOM_MS)
    }
    this.#paint()
    this.#opts.onToggle?.(on)
    return on
  }

  /** The persistent rim — a fired button flashes and releases; a selected one stays lit. */
  select(holon: Holon | null): void {
    this.#selected = holon
    this.#paint()
  }

  /** Headless driving: hover as if the pointer stood at this client point. */
  hoverAt(clientX: number, clientY: number): Holon | null {
    this.#follow(clientX, clientY)
    this.#dot.classList.toggle("shown", this.#on)
    this.#setHovered(this.#on ? (this.#host.pick(clientX, clientY) ?? null) : null)
    return this.#hovered
  }

  #follow(x: number, y: number): void {
    this.#dot.style.transform = `translate(${x}px, ${y}px)`
  }

  #setHovered(holon: Holon | null): void {
    if (holon === this.#hovered) return
    this.#hovered = holon
    this.#paint()
  }

  /** While on, rims track whatever the scene does (the editor may be playing). */
  #loop(): void {
    cancelAnimationFrame(this.#raf)
    const tick = () => {
      if (!this.#on) return
      this.#paint()
      this.#raf = requestAnimationFrame(tick)
    }
    this.#raf = requestAnimationFrame(tick)
  }

  #paint(): void {
    const rims = this.#rims
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(window.innerWidth * dpr)
    const h = Math.round(window.innerHeight * dpr)
    if (rims.width !== w || rims.height !== h) {
      rims.width = w
      rims.height = h
    }
    const ctx = rims.getContext("2d")
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, h)
    if (!this.#on) return
    ctx.scale(dpr, dpr)
    const canvas = this.#host.canvas
    const rect = canvas.getBoundingClientRect()
    const rim = (holon: Holon, selected: boolean) => {
      const box = this.#host.boundsOf(holon)
      if (!box) return
      const r = bufferToClient(box, rect, canvas)
      const x = r.x - RIM_PAD
      const y = r.y - RIM_PAD
      const bw = r.w + RIM_PAD * 2
      const bh = r.h + RIM_PAD * 2
      const radius = Math.min(14, bw / 2, bh / 2)
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(x, y, bw, bh, radius)
      ctx.shadowColor = GOLD_RGBA(selected ? 0.95 : 0.8)
      ctx.shadowBlur = selected ? 22 : 14
      if (selected) {
        ctx.fillStyle = GOLD_RGBA(0.07)
        ctx.fill()
      }
      ctx.strokeStyle = GOLD_RGBA(selected ? 1 : 0.85)
      ctx.lineWidth = selected ? 3 : 1.75
      ctx.stroke()
      ctx.restore()
    }
    if (this.#hovered && this.#hovered !== this.#selected) rim(this.#hovered, false)
    if (this.#selected) rim(this.#selected, true)
  }
}
