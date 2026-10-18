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
 * THE VIEW. In the game loop the viewer may always look around (src/view.ts,
 * the same layer the editor flies when paused): drag orbits, shift- or
 * right-drag pans, the wheel (or a trackpad pinch) dollies; on glass, one
 * finger orbits, two pinch (dolly) and drag (pan), a double-tap frames; double-click frames what
 * is under the pointer (without firing it — see DOUBLE_MS), `f` frames the hovered handle, `r` glides home.
 * A drag never fires; a click that did not travel does — so transitions
 * keep firing from any angle, and picking reads the effective camera.
 * Leaving, the view glides back to the song's camera with the walked state.
 *
 * THE LAYER. The automaton writes ABOVE the timeline as the host's
 * `beforeSync` — the same seam the editor's live overrides use — so the
 * Dream, the gauntlet and every export see only the pure timeline.
 */

import type { Holon } from "../src/holon"
import type { Param, ParamValue } from "../src/params"
import { Automaton, RESERVED_KEYS, gatherStateSpace, type Axis, type StateSpace } from "../src/automaton"
import { lerpParamValue, smooth } from "../src/transitions"
import { HOVER, SELECTED } from "../src/glow"
import { beginOverlay, clientBox, makeOverlay, type PixelBox } from "../editor/overlay"
import { ViewLayer, keepOutsOf } from "../src/view"
import { touchCamera } from "../editor/touchcamera"
import type { Observer } from "../src/dream"

export interface GameHost {
  canvas: HTMLCanvasElement
  pick(clientX: number, clientY: number): Holon | undefined
  boundsOf(holon: Holon): PixelBox | undefined
  /** World-space ink bounds — when given, framing is exact from any view (ThreeHost.worldBoundsOf). */
  worldBoundsOf?(holon: Holon): { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } | undefined
  /**
   * Exact 3D queries on the visible ink (ThreeHost.pickNear / pickRay): the
   * nearest accepted ink to a point, the first along a ray. With them a
   * spark points at strokes, not boxes; without, at the handles' boxes.
   */
  pickNear?(point: Vec, radius: number, opts: { accept?: (h: Holon) => boolean }): { holon: Holon; distance: number } | undefined
  pickRay?(origin: Vec, direction: Vec, opts: { maxDistance?: number; accept?: (h: Holon) => boolean }): { holon: Holon; t: number } | undefined
  /** Many holons' world ink boxes in one sweep (ThreeHost.worldBoundsOfEach) — what a spark points among. */
  worldBoundsOfEach?(holons: Iterable<Holon>): Map<Holon, Box>
  /** Install (or clear) the per-frame write after the timeline's apply. */
  setBeforeSync(fn: (() => void) | undefined): void
  /**
   * Lay attention's golden glow (src/glow.ts) on a handle — the host's
   * `attend`. With it, the handle glows (faint on hover, a breath to full
   * on a fire) and the corner ticks are not drawn; the caption stays.
   */
  attend?(channel: "game", holon: Holon | null, amount: number): void
}

type Vec = { x: number; y: number; z: number }
type Box = { min: Vec; max: Vec }

/** A spatial pointer — a hand's spark standing in the scene (demo/handplay.ts). */
export interface Spark {
  /** Where it stands, world units. */
  p: Vec
  /** The eye it is seen from. */
  eye: Vec
  /** How near (world units) counts as at it. */
  radius: number
}

/** How long a handle's ink box is trusted (ms) — the ink moves as states ease. */
const BOX_MS = 150

/** Distance from a point to a box (0 inside). */
const boxDistance = (p: Vec, b: Box): number =>
  Math.hypot(
    Math.max(b.min.x - p.x, 0, p.x - b.max.x),
    Math.max(b.min.y - p.y, 0, p.y - b.max.y),
    Math.max(b.min.z - p.z, 0, p.z - b.max.z),
  )

const volume = (b: Box): number => (b.max.x - b.min.x) * (b.max.y - b.min.y) * (b.max.z - b.min.z)

/** Where the ray o + t·d (t ≥ 0) is inside a box, or undefined if it misses. */
const rayBox = (o: Vec, d: Vec, b: Box): [number, number] | undefined => {
  let near = 0
  let far = Infinity
  for (const k of ["x", "y", "z"] as const) {
    if (Math.abs(d[k]) < 1e-12) {
      if (o[k] < b.min[k] || o[k] > b.max[k]) return undefined
      continue
    }
    let t0 = (b.min[k] - o[k]) / d[k]
    let t1 = (b.max[k] - o[k]) / d[k]
    if (t0 > t1) [t0, t1] = [t1, t0]
    near = Math.max(near, t0)
    far = Math.min(far, t1)
    if (near > far) return undefined
  }
  return [near, far]
}

export interface GameOpts {
  roots: readonly Holon[]
  /** The scene's own axes (Dream.stateSpace()) — walked first, beside the holons'. */
  space?: StateSpace
  /**
   * The scene's observer — the game loop's own viewer camera biases its
   * readings. Absent (the editor, which flies its own ViewLayer): no orbit here.
   */
  observer?: Observer
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
/**
 * A second click this soon and this near is a DOUBLE-click: it frames, and
 * whatever the first click fired is taken back — so a double-click frames
 * without firing, while a single click still fires at once (no waiting to
 * see whether a second one comes). The take-back is a fire to the previous
 * position mid-ease, ~0.1 of the way in: a barely visible swing and home.
 */
const DOUBLE_MS = 300
/** A fingertip lands less precisely than a cursor: a double-TAP may wander further. */
const DOUBLE_PX = 6
const DOUBLE_TAP_PX = 16
const AUTO_KEYS = "1234567890"

const STYLE = `
.dt-game-hud { position: fixed; left: 12px; bottom: 30px; color: #555; font: 12px monospace; line-height: 18px; user-select: none; z-index: 40; }
.dt-game-hud div { cursor: pointer; white-space: nowrap; }
.dt-game-hud div:hover { color: #888; }
.dt-game-hud b { font-weight: normal; color: #bbb; }
.dt-game-hud .dt-game-focus { color: #888; cursor: default; margin-bottom: 4px; }
.dt-game-hud i { font-style: normal; color: #444; display: inline-block; width: 1.6em; }
`

export class GameLoop {
  readonly automaton: Automaton
  /** The viewer's camera — orbit / pan / dolly over the song's (absent without an observer). */
  readonly view: ViewLayer | undefined
  #installed = false
  #drag: { x: number; y: number; pan: boolean; moved: boolean; id: number } | null = null
  #lastClick: { x: number; y: number; at: number; fired?: { axis: string; from: string } } | null = null
  #lastPointerTouch = false
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
  /** Key → the axes on it, one per holon group (a gallery repeats digits; focus picks). */
  readonly #keys = new Map<string, Axis[]>()
  readonly #keyOf = new Map<Axis, string>()
  /** The walkable holons, in declaration order — arrows move between them. */
  readonly #owners: Holon[] = []
  /** The holon in focus (its axes alone are live on keys and the HUD), or null: all. */
  #focus: Holon | null = null
  readonly #handleOf = new Map<Holon, Axis[]>()
  #spark: Spark | null = null
  #boxes: { at: number; list: { handle: Holon; box: Box }[] } | undefined
  readonly #host: GameHost
  readonly #opts: GameOpts
  readonly #hud: HTMLDivElement
  readonly #overlay: HTMLCanvasElement

  constructor(host: GameHost, opts: GameOpts) {
    this.#host = host
    this.#opts = opts
    this.#hudShown = opts.hud
    this.automaton = new Automaton(gatherStateSpace(opts.roots, opts.space))
    this.view = opts.observer ? new ViewLayer(opts.observer) : undefined
    if (this.view) this.view.keepOuts = keepOutsOf(opts.roots)
    // Keys per holon: its declared keys first, then the free digits, in
    // declaration order — so every symbol in a gallery has its own 1, 2, 3.
    for (const a of this.automaton.axes) if (a.owner && !this.#owners.includes(a.owner)) this.#owners.push(a.owner)
    const groups = new Map<Holon | undefined, Axis[]>()
    for (const a of this.automaton.axes) groups.set(a.owner, [...(groups.get(a.owner) ?? []), a])
    for (const axes of groups.values()) {
      const taken = new Set<string>()
      for (const a of axes) {
        if (!a.key) continue
        if (RESERVED_KEYS.includes(a.key)) {
          // Never silently: the author asked for a key the player keeps.
          console.warn(
            `[dreamtalk] axis '${a.id}' (${a.owner?.constructor.name ?? "scene"}) declares the reserved key '${a.key}' ` +
              `— it gets a digit instead. Reserved: ${RESERVED_KEYS.map((k) => JSON.stringify(k)).join(" ")} (src/automaton.ts).`,
          )
          continue
        }
        if (!taken.has(a.key)) this.#bind(a.key, a, taken)
      }
      const free = [...AUTO_KEYS].filter((k) => !taken.has(k))
      for (const a of axes) {
        const key = this.#keyOf.has(a) ? undefined : free.shift()
        if (key) this.#bind(key, a, taken)
      }
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
    this.#overlay = makeOverlay("dt-game-overlay", 45)
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
        const d = this.#drag
        if (d && this.view) {
          const dx = e.clientX - d.x
          const dy = e.clientY - d.y
          if (!d.moved && Math.hypot(dx, dy) <= CLICK_SLOP) return
          if (!d.moved) {
            d.moved = true
            this.#setHovered(null)
            canvas.style.cursor = "grabbing"
            try {
              canvas.setPointerCapture(d.id)
            } catch {}
          }
          d.x = e.clientX
          d.y = e.clientY
          const box = canvas.getBoundingClientRect()
          if (d.pan || e.shiftKey) this.view.pan(dx, dy, box.height)
          else this.view.orbit(dx, dy, box.width)
          return
        }
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
        if (!this.#live() || e.button > 2) return
        this.#lastPointerTouch = e.pointerType === "touch"
        if (e.button === 0) this.#press = { x: e.clientX, y: e.clientY }
        this.#drag = { x: e.clientX, y: e.clientY, pan: e.button !== 0 || e.shiftKey, moved: false, id: e.pointerId }
      },
      listen,
    )
    canvas.addEventListener("contextmenu", (e) => this.#on && this.view && e.preventDefault(), listen)
    canvas.addEventListener(
      "wheel",
      (e) => {
        if (!this.#live() || !this.view) return
        e.preventDefault()
        // A pinch arrives as ctrl+wheel with small deltas: amplify it to feel like a notch.
        this.view?.dolly(e.ctrlKey ? e.deltaY * 6 : e.deltaY)
      },
      { ...listen, passive: false },
    )
    // Two fingers pinch and pan (editor/touchcamera.ts — the editor shares
    // it); its events never reach the handlers here. A double-tap is a
    // double-click to `click()`, which frames without firing.
    touchCamera(canvas, {
      live: () => this.#live(),
      view: () => this.view,
      onPinchStart: () => {
        this.#press = null
        this.#drag = null
      },
      signal: opts.signal,
    })
    canvas.addEventListener(
      "pointercancel",
      () => {
        this.#press = null
        this.#drag = null
      },
      listen,
    )
    canvas.addEventListener(
      "pointerup",
      (e) => {
        const press = this.#press
        this.#press = null
        const drag = this.#drag
        this.#drag = null
        if (drag?.moved) {
          canvas.style.cursor = ""
          try {
            canvas.releasePointerCapture(drag.id)
          } catch {}
          return
        }
        if (!this.#live() || !press) return
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP) return
        this.click(e.clientX, e.clientY)
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
    // Touch belongs to the game while it is on: no page scroll or browser
    // zoom. Set before any gesture — a browser decides a touch's fate at
    // its first contact, so setting it then is already too late.
    this.#host.canvas.style.touchAction = "none"
    this.#origin = now
    this.#pausedAt = undefined
    this.automaton.enter()
    this.#host.setBeforeSync(() => this.#write())
    this.#installed = true
    this.#indexHandles()
    this.#renderHud()
  }

  /** Leave: the walked state releases into the song over RELEASE seconds. */
  leave(now = performance.now()): void {
    if (!this.#on) return
    this.#on = false
    this.#setHovered(null)
    this.#release = { from: now, clock: this.automaton.clock }
    this.#drag = null
    this.#host.canvas.style.touchAction = ""
    this.view?.reset(now, RELEASE)
    this.#renderHud()
  }

  /** Advance the wall clock (a no-op on a manual clock). Call once per frame. */
  tick(now = performance.now()): void {
    if (this.#on && this.#origin !== undefined && this.#pausedAt === undefined) this.automaton.clock = (now - this.#origin) / 1000
    if (this.#release && (now - this.#release.from) / 1000 >= RELEASE) this.#finishRelease()
    this.view?.step(now)
    if (this.#installed && !this.#on && !this.#release && !this.view?.active) {
      this.view?.release()
      this.#host.setBeforeSync(undefined)
      this.#installed = false
    }
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

  /**
   * Headless: drive the clock by hand from here on. A hand-driven clock
   * also lands any view glide (they run on wall time, which a headless
   * page barely advances), so a capture shows where the view is going.
   */
  at(clock: number): void {
    this.#origin = undefined
    this.automaton.clock = clock
    this.view?.step(Number.POSITIVE_INFINITY)
  }

  #bind(key: string, a: Axis, taken: Set<string>): void {
    taken.add(key)
    this.#keyOf.set(a, key)
    this.#keys.set(key, [...(this.#keys.get(key) ?? []), a])
  }

  /** Walkable now, and in focus (keys and the HUD; a click reaches any handle). */
  #live_(a: Axis): boolean {
    // An owner-less axis is the scene's own: always in focus.
    return this.automaton.enabled(a.id) && (!this.#focus || !a.owner || a.owner === this.#focus)
  }

  /** The holon in focus, or null when every holon's axes are live. */
  get focus(): Holon | null {
    return this.#focus
  }

  /**
   * Focus a walkable holon (null: all) and glide to frame it — the arrows
   * walk the scene's symbols one by one, a gallery's way of being visited.
   */
  setFocus(holon: Holon | null, frame = true): void {
    this.#focus = holon
    if (frame) this.frame(holon)
    this.#renderHud()
  }

  /** Step the focus by ±1 through the walkable holons (wrapping). */
  step(by: number): void {
    const n = this.#owners.length
    if (n < 2) return
    const i = this.#focus ? this.#owners.indexOf(this.#focus) : by > 0 ? -1 : 0
    this.setFocus(this.#owners[(((i + by) % n) + n) % n]!)
  }

  fire(id: string, position?: string): void {
    if (!this.#on) return
    const a = this.automaton.axis(id)
    if (!this.automaton.enabled(a.id)) return
    // Acting on a holon brings it into focus (when the scene is being walked one by one).
    if (this.#focus && a.owner && a.owner !== this.#focus) this.setFocus(a.owner, false)
    this.automaton.fire(a.id, position)
    this.#flash = performance.now()
    this.#renderHud()
  }

  /** Glide to frame the holon under this point (empty space: home). */
  frameAt(clientX: number, clientY: number): void {
    const hit = this.#ownerAt(clientX, clientY)?.handle ?? this.#host.pick(clientX, clientY)
    this.frame(hit ?? null)
  }

  /** Glide to frame a holon; null glides back to the song's camera. */
  frame(holon: Holon | null, now = performance.now()): void {
    const world = holon && this.view ? this.#host.worldBoundsOf?.(holon) : undefined
    if (world && this.view) {
      const c = { x: (world.min.x + world.max.x) / 2, y: (world.min.y + world.max.y) / 2, z: (world.min.z + world.max.z) / 2 }
      const r = Math.hypot(world.max.x - world.min.x, world.max.y - world.min.y, world.max.z - world.min.z) / 2
      return this.view.frameSphere(c, r, now)
    }
    const box = holon ? this.#host.boundsOf(holon) : undefined
    if (!box || !this.view) return this.view?.reset(now)
    const c = this.#host.canvas
    this.view?.frameBox({ minX: box.min.x, minY: box.min.y, maxX: box.max.x, maxY: box.max.y }, { width: c.width, height: c.height }, now)
  }

  /** A key in game mode: true when it did something. */
  key(e: Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey">): boolean {
    if (!this.#on || e.metaKey || e.ctrlKey || e.altKey) return false
    if (e.code === "KeyH") {
      this.#hudShown = !this.#hudShown
      this.#renderHud()
      return true
    }
    // The view keys are reserved: an axis cannot take them.
    if (!this.view && (e.code === "KeyR" || e.code === "KeyF")) return false
    if (e.code === "KeyR") {
      this.view?.reset(performance.now())
      return true
    }
    if (e.code === "KeyF") {
      this.frame(this.#hovered?.handle ?? null)
      return true
    }
    if ((e.code === "ArrowRight" || e.code === "ArrowLeft") && this.#owners.length >= 2) {
      this.step(e.code === "ArrowRight" ? 1 : -1)
      return true
    }
    if (e.code === "Escape" && this.#focus) {
      this.setFocus(null)
      return true
    }
    const a = this.#keys.get(e.key)?.find((x) => this.#live_(x))
    if (!a) return false
    this.fire(a.id)
    return true
  }

  /** The axes as the HUD shows them — and the harness reads. */
  state(): { id: string; key?: string; position: string; positions: string[]; enabled: boolean; progress: number; owner?: string }[] {
    return this.automaton.axes.map((a) => ({
      id: a.id,
      key: this.#keyOf.get(a),
      position: this.automaton.position(a.id),
      positions: a.positions.map((p) => p.name),
      enabled: this.#live_(a),
      progress: this.automaton.progress(a.id),
      owner: a.owner?.constructor.name,
    }))
  }

  /** Hover as if the pointer stood here; returns the axis it would fire. */
  hoverAt(clientX: number, clientY: number): string | undefined {
    if (!this.#live()) return undefined
    this.#setHovered(this.#ownerAt(clientX, clientY))
    return this.#hovered?.axis.id
  }

  /**
   * One released click, as the pointer gives it — single or the tail of a
   * double (see DOUBLE_MS). A host routing its own pointer (the editor's
   * walk) calls this, not clickAt, so double-click means the same there.
   */
  click(clientX: number, clientY: number, now = performance.now()): void {
    const last = this.#lastClick
    const near = this.#lastPointerTouch ? DOUBLE_TAP_PX : DOUBLE_PX
    if (last && now - last.at < DOUBLE_MS && Math.hypot(clientX - last.x, clientY - last.y) < near) {
      this.#lastClick = null
      if (last.fired) this.automaton.fire(last.fired.axis, last.fired.from)
      if (this.view) this.frameAt(clientX, clientY)
      this.#renderHud()
      return
    }
    const hit = this.#ownerAt(clientX, clientY)
    const from = hit ? this.automaton.position(hit.axis.id) : undefined
    const fired = this.clickAt(clientX, clientY)
    this.#lastClick = { x: clientX, y: clientY, at: now, fired: fired && from !== undefined ? { axis: fired, from } : undefined }
  }

  /** Headless: a double-click here, as the pointer would give it. */
  doubleClickAt(clientX: number, clientY: number, now = performance.now()): void {
    this.click(clientX, clientY, now)
    this.click(clientX, clientY, now + 150)
  }

  /** The walkable axis whose handle is under this client point, if any (a hand's pinch asks). */
  axisAt(clientX: number, clientY: number): string | undefined {
    if (!this.#live()) return undefined
    return this.#ownerAt(clientX, clientY)?.axis.id
  }

  /** Where an axis stands as a continuous index into its positions, and how many there are. */
  axisIndex(id: string): { i: number; n: number } {
    const a = this.automaton.axis(id)
    return { i: Math.max(0, a.positions.findIndex((p) => p.name === this.automaton.position(id))), n: a.positions.length }
  }

  /** Hold an axis at continuous point u (a hand dragging its handle; Automaton.scrub). */
  scrubAxis(id: string, u: number): void {
    if (!this.#on) return
    this.automaton.scrub(id, u)
    this.#renderHud()
  }

  /** Let a scrubbed axis go: it eases on to its nearest position. */
  settleAxis(id: string): void {
    if (!this.#on) return
    this.automaton.settle(id)
    this.#flash = performance.now()
    this.#renderHud()
  }

  /** Click as if here: fires the owning axis, if any. */
  clickAt(clientX: number, clientY: number): string | undefined {
    const hit = this.#ownerAt(clientX, clientY)
    if (!hit) return undefined
    // A handle that stands for one position goes there (AxisOpts.at); else the next.
    this.fire(hit.axis.id, hit.axis.at?.(hit.handle))
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

  /**
   * Point in SPACE instead of on the screen: while a spark is set, all that
   * asks "what is here" — hover, click, a press's axis, framing — asks the
   * spark: the handle whose ink it is in, or nearest within its radius;
   * else the first the eye's ray through it meets. null: the screen again.
   */
  get spark(): Spark | null {
    return this.#spark
  }
  set spark(s: Spark | null) {
    this.#spark = s
  }

  /** How hidden the spark is behind ink: 0 in front of every handle … 1 behind one. */
  sparkHidden(): number {
    const s = this.#spark
    if (!s) return 0
    const d = { x: s.p.x - s.eye.x, y: s.p.y - s.eye.y, z: s.p.z - s.eye.z }
    if (this.#host.pickRay) {
      // Any visible ink between the eye and the spark hides it — stroke-exact.
      // Ink the spark is touching (within half its reach) does not.
      const len = Math.hypot(d.x, d.y, d.z)
      return this.#host.pickRay(s.eye, d, { maxDistance: Math.max(0, len - s.radius / 2) }) ? 1 : 0
    }
    let hidden = 0
    for (const { box } of this.#handleBoxes()) {
      const hit = rayBox(s.eye, d, box)
      // The ray reaches the spark at t = 1: how far through the box it has gone by then.
      if (hit && hit[0] < 1) hidden = Math.max(hidden, Math.min(1, (1 - hit[0]) / Math.max(hit[1] - hit[0], 1e-9)))
    }
    return hidden
  }

  /** Every handle's world ink box, refreshed every BOX_MS. */
  #handleBoxes(): { handle: Holon; box: Box }[] {
    const now = performance.now()
    if (this.#boxes && now - this.#boxes.at < BOX_MS) return this.#boxes.list
    const list: { handle: Holon; box: Box }[] = []
    const handles = this.#handleOf.keys()
    if (this.#host.worldBoundsOfEach) {
      for (const [handle, box] of this.#host.worldBoundsOfEach(handles)) list.push({ handle, box })
    } else {
      for (const handle of handles) {
        const box = this.#host.worldBoundsOf?.(handle)
        if (box) list.push({ handle, box })
      }
    }
    this.#boxes = { at: now, list }
    return list
  }

  /** The walkable handle the spark is at: inside (the smallest), else nearest within reach, else first on the eye's ray. */
  #ownerNear(s: Spark): { handle: Holon; axis: Axis } | null {
    const host = this.#host
    if (host.pickNear) {
      // On the ink itself: the nearest stroke that belongs to a walkable
      // handle (others are no candidates), else the first one on the eye's
      // ray through the spark.
      const accept = (h: Holon) => this.#handleUp(h) !== null
      const dir = { x: s.p.x - s.eye.x, y: s.p.y - s.eye.y, z: s.p.z - s.eye.z }
      const hit = host.pickNear(s.p, s.radius, { accept })?.holon ?? host.pickRay?.(s.eye, dir, { accept })?.holon
      return hit ? this.#handleUp(hit) : null
    }
    const walkable = (h: Holon) => this.#handleOf.get(h)?.find((x) => this.automaton.enabled(x.id))
    let best: { handle: Holon; axis: Axis; d: number; v: number } | undefined
    for (const { handle, box } of this.#handleBoxes()) {
      const axis = walkable(handle)
      if (!axis) continue
      const d = boxDistance(s.p, box)
      if (d > s.radius) continue
      const v = volume(box)
      if (!best || d < best.d || (d === best.d && v < best.v)) best = { handle, axis, d, v }
    }
    if (best) return best
    const dir = { x: s.p.x - s.eye.x, y: s.p.y - s.eye.y, z: s.p.z - s.eye.z }
    // On the ray: the first box it enters — and of the boxes it is in by
    // then's end, the smallest (a part over its whole, as the mouse picks).
    const hits: { handle: Holon; axis: Axis; t0: number; t1: number; v: number }[] = []
    for (const { handle, box } of this.#handleBoxes()) {
      const axis = walkable(handle)
      const hit = axis && rayBox(s.eye, dir, box)
      if (axis && hit) hits.push({ handle, axis, t0: hit[0], t1: hit[1], v: volume(box) })
    }
    if (!hits.length) return null
    let first = hits[0]!
    for (const h of hits) if (h.t0 < first.t0) first = h
    let pick = first
    for (const h of hits) if (h.t0 <= first.t1 && h.v < pick.v) pick = h
    return pick
  }

  /** Walk up from the picked holon to the nearest handle with a walkable axis. */
  #ownerAt(clientX: number, clientY: number): { handle: Holon; axis: Axis } | null {
    if (this.#spark) return this.#ownerNear(this.#spark)
    return this.#handleUp(this.#host.pick(clientX, clientY))
  }

  /** From a holon up to the nearest handle with a walkable axis, if any. */
  #handleUp(from: Holon | undefined): { handle: Holon; axis: Axis } | null {
    let node = from
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
    this.view?.apply()
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
    const f = this.#focus
    const head =
      this.#owners.length >= 2
        ? `<div class="dt-game-focus">‹ ${esc(f ? f.constructor.name : "all")} ›  <i>←→</i></div>`
        : ""
    // Seeing many symbols at once, the HUD names the walk, not every axis:
    // visit one (←→) and its axes appear.
    if (!f && this.#owners.length >= 4) {
      this.#hud.innerHTML = head
      return
    }
    this.#hud.innerHTML = head + this.state()
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
    const ctx = beginOverlay(this.#overlay)
    const hov = this.#hovered
    const shown = !!ctx && !!hov && this.#live()
    const f = Math.max(0, 1 - (now - this.#flash) / FLASH_MS)
    // The handle's glow: HOVER at rest, swelling to full on a fire and back.
    this.#host.attend?.("game", shown ? hov!.handle : null, HOVER + (SELECTED - HOVER) * f)
    if (!ctx || !hov || !shown) return
    const r = clientBox(this.#host.canvas, this.#host.boundsOf(hov.handle))
    if (!r) return
    const x0 = r.x - PAD
    const y0 = r.y - PAD
    const x1 = r.x + r.w + PAD
    const y1 = r.y + r.h + PAD
    const t = Math.min(TICK, (x1 - x0) / 3, (y1 - y0) / 3)
    // Ticks only where the host cannot glow — the glow is the one look of attention.
    if (!this.#host.attend) {
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
    }
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
