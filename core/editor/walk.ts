/**
 * The walk — the visual automaton inside the paused editor
 * (docs/reports/editor-automaton.md).
 *
 * The editor is itself a visual state machine whose one sub-machine is the
 * scene: the playhead `t` is the axis the song walks; the axes the scene's
 * holons declare (Holon.stateSpace()) are the others. Paused, in game mode
 * (creator off — the golden dot is the editing lens), the editor is the
 * player's game loop: the same GameLoop (demo/game.ts) — hover ticks, the
 * HUD, clicks and keys fire axes, a fire mid-flight turns around smoothly.
 *
 * ONE LIVE LAYER. The player writes the automaton straight into the params;
 * the editor routes it through its own live layer instead (Overrides,
 * EDITOR-V4) — so a walked pose IS a pose, with everything a pose already
 * has: the inspector reads it (rows go "diverged"), Escape discards it,
 * play snaps it back (time is truth), and ⌘K / the chip captures it into
 * the DreamWeaving as a `this.play(…)` at the playhead (checkpoint.ts) —
 * free walk becomes authored transition by the existing op. Nothing here
 * writes a file and nothing in the Dream ever knows.
 *
 * THE GROUND. The automaton holds the world as it stood when it entered.
 * Whenever that world changes under it — the playhead moves, or the live
 * layer loses a value the walk wrote (Escape, a capture, an inspector
 * revert) — it re-enters from what is on screen. At rest that loses
 * nothing (no velocity to carry); mid-flight it is the honest stop.
 *
 * CLOCKS stay still: a paused editor is a held world. (The player's free
 * play runs them; here a running clock would read as an unauthored pose.)
 */

import type { Holon } from "../src/holon"
import type { Param, ParamValue } from "../src/params"
import { isColor } from "../src/constants"
import { GameLoop } from "../demo/game"
import type { Overrides } from "./overrides"
import { bufferToClient, type PixelBox } from "./creator"

export interface WalkOpts {
  canvas: HTMLCanvasElement
  pick(clientX: number, clientY: number): Holon | undefined
  boundsOf(holon: Holon): PixelBox | undefined
  roots: readonly Holon[]
  overrides: Overrides
  /** Is the transport playing? (The walk lives only in a held frame.) */
  isPlaying: () => boolean
  /** Is something else holding the pointer — creator mode, a drag? */
  suspended: () => boolean
  currentT: () => number
  /** Pause the transport — a fire from the inspector while playing. */
  pause: () => void
  hud: boolean
  signal: AbortSignal
}

/** One axis as the inspector's State group shows it. */
export interface WalkAxisView {
  id: string
  label: string
  key?: string
  position: string
  positions: string[]
  enabled: boolean
  progress: number
}

/**
 * The player releases the walked state into the song itself; here the
 * live layer owns every release (play clears it, Escape discards it), so
 * GameLoop is told every param is the song's — its release writes nothing.
 */
const EVERY_PARAM = { has: () => true } as unknown as ReadonlySet<Param<ParamValue>>

const same = (a: ParamValue | undefined, b: ParamValue | undefined): boolean => {
  if (a === b) return true
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-9
  if (a !== undefined && b !== undefined && isColor(a) && isColor(b))
    return a.r === b.r && a.g === b.g && a.b === b.b
  return false
}

export class EditorWalk {
  readonly game: GameLoop
  readonly #opts: WalkOpts
  readonly #clocks: Set<Param<ParamValue>>
  /** What the walk last wrote into the live layer, per param. */
  readonly #written = new Map<Param<ParamValue>, ParamValue>()
  /** Params whose override the walk itself created (it may also remove them). */
  readonly #owned = new Set<Param<ParamValue>>()
  #enteredAt: number | undefined
  #ungrounded = false
  #writing = false
  #moving = false
  /** Journal length at the last step — a fire since then must be written. */
  #fired = 0
  #panel: HTMLElement | undefined
  #panelAxes: ReadonlySet<string> | undefined
  #panelKey = ""

  constructor(opts: WalkOpts) {
    this.#opts = opts
    this.game = new GameLoop(
      { canvas: opts.canvas, pick: opts.pick, boundsOf: opts.boundsOf, setBeforeSync: () => {} },
      {
        roots: opts.roots,
        animated: EVERY_PARAM,
        suspended: () => opts.isPlaying() || opts.suspended(),
        hud: opts.hud,
        signal: opts.signal,
      },
    )
    this.#clocks = new Set((this.game.automaton.space.clocks ?? []) as Param<ParamValue>[])
    const unsubscribe = opts.overrides.subscribe((o) => {
      if (this.#writing) return
      for (const [p, v] of this.#written) {
        if (!same(o.get(p), v)) {
          this.#ungrounded = true
          return
        }
      }
    })
    opts.signal.addEventListener("abort", unsubscribe)
  }

  /** Does the scene declare anything walkable? */
  get walkable(): boolean {
    return this.game.walkable
  }

  /** Seconds the longest transition fired since entry takes — a capture's clip length. */
  get seconds(): number | undefined {
    const a = this.game.automaton
    let d: number | undefined
    for (const f of a.journal) d = Math.max(d ?? 0, a.axis(f.axis).duration)
    return d
  }

  /** The axis an element under this point would fire (game mode, paused), if any. */
  owns(clientX: number, clientY: number): string | undefined {
    if (!this.walkable || this.#opts.isPlaying() || this.#opts.suspended()) return undefined
    this.#ground(performance.now())
    return this.game.hoverAt(clientX, clientY)
  }

  /** A key aimed at the walk: true when it fired (or toggled the HUD). */
  key(e: KeyboardEvent): boolean {
    if (!this.walkable || this.#opts.isPlaying() || this.#opts.suspended()) return false
    this.#ground(performance.now())
    return this.game.key(e)
  }

  /** Fire an axis (toward `position`, default the next) — pauses first if playing. */
  fire(id: string, position?: string): void {
    if (!this.walkable) return
    if (this.#opts.isPlaying()) this.#opts.pause()
    this.#ground(performance.now())
    this.game.fire(id, position)
    this.#refreshPanel()
  }

  /**
   * Where to click to fire an axis (headless driving): a point on one of
   * its handles' ink that a click would fire it from, client px.
   */
  handlePoint(id: string): { x: number; y: number } | undefined {
    const { canvas, boundsOf } = this.#opts
    const N = 12
    for (const h of this.game.automaton.axis(id).handles()) {
      const box = boundsOf(h)
      if (!box) continue
      const r = bufferToClient(box, canvas.getBoundingClientRect(), canvas)
      for (let i = 0; i <= N * N; i++) {
        // Centre first, then a grid over the box (a flow's centre is off its curve).
        const [u, v] = i === 0 ? [0.5, 0.5] : [((i - 1) % N + 0.5) / N, (Math.floor((i - 1) / N) + 0.5) / N]
        const p = { x: r.x + r.w * u, y: r.y + r.h * v }
        if (this.owns(p.x, p.y) === id) return p
      }
    }
    return undefined
  }

  /** The axes, as the inspector and the headless harness read them. */
  axes(): WalkAxisView[] {
    const a = this.game.automaton
    return this.game.state().map((s) => ({ ...s, label: a.axis(s.id).label }))
  }

  /**
   * One frame of the walk, from the editor's loop. Returns true when it
   * changed the live layer — the loop then draws the held frame again.
   */
  step(now: number): boolean {
    const { game } = this
    if (!this.walkable) return false
    if (this.#opts.isPlaying()) {
      if (game.on) {
        game.leave(now)
        this.#written.clear()
        this.#owned.clear()
        this.#moving = false
        this.#refreshPanel()
      }
      game.tick(now)
      return false
    }
    this.#ground(now)
    game.tick(now)
    const a = game.automaton
    const moving = a.axes.some((x) => a.progress(x.id) < 1)
    // Write after a fire, while anything moves, and once more as it lands.
    const write = moving || this.#moving || a.journal.length !== this.#fired
    this.#moving = moving
    this.#fired = a.journal.length
    if (write) this.#write()
    this.#refreshPanel()
    return write
  }

  /**
   * The inspector's State group: one row per axis (or only those of the
   * selected holon's state space), the current position lit, every
   * position clickable. Rebuilt into `parent` on each inspector render.
   */
  inspect(parent: HTMLElement, holon: Holon | null): void {
    this.#panel = undefined
    if (!this.walkable) return
    let ids: Set<string> | undefined
    if (holon) {
      let owner: Holon | null | undefined = holon
      while (owner && !owner.stateSpace()) owner = owner.parent
      const own = owner?.stateSpace()
      if (!own) return
      ids = new Set(own.axes.map((x) => x.id))
    }
    const box = document.createElement("div")
    box.className = "group walkstate"
    const title = document.createElement("h3")
    title.textContent = "State"
    box.appendChild(title)
    const rows = document.createElement("div")
    box.appendChild(rows)
    rows.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-pos]")
      const row = el?.closest<HTMLElement>("[data-axis]")
      if (el && row?.dataset.axis) this.fire(row.dataset.axis, el.dataset.pos)
    })
    parent.appendChild(box)
    this.#panel = rows
    this.#panelAxes = ids
    this.#panelKey = ""
    this.#refreshPanel()
  }

  // --- internals -----------------------------------------------------------

  /** (Re-)enter from the world on screen when it moved under the walk. */
  #ground(now: number): void {
    const { game } = this
    const t = this.#opts.currentT()
    if (game.on && !this.#ungrounded && this.#enteredAt === t) return
    game.enter(t, now)
    this.#enteredAt = t
    this.#ungrounded = false
    this.#written.clear()
    this.#owned.clear()
    this.#moving = false
    this.#fired = 0
  }

  /** The automaton's display → the live layer (never the clocks). */
  #write(): void {
    const { overrides } = this.#opts
    const a = this.game.automaton
    this.#writing = true
    try {
      for (const p of a.params) {
        if (this.#clocks.has(p) || p.isBound) continue
        const v = a.valueAt(p)
        if (v === undefined) continue
        const home = same(v, a.entryValue(p))
        if (!this.#written.has(p) && home) continue
        if (home && this.#owned.has(p) && a.progress(this.#axisOf(p) ?? "") >= 1) {
          // Walked back to where it entered: the pose evaporates.
          overrides.delete(p)
          this.#written.delete(p)
          this.#owned.delete(p)
          continue
        }
        if (!overrides.has(p)) this.#owned.add(p)
        overrides.set(p, v)
        this.#written.set(p, overrides.get(p)!)
      }
    } finally {
      this.#writing = false
    }
  }

  #axisOf(p: Param<ParamValue>): string | undefined {
    return this.game.automaton.axes.find((x) => x.params().includes(p))?.id
  }

  #refreshPanel(): void {
    const panel = this.#panel
    if (!panel) return
    const views = this.axes().filter((v) => !this.#panelAxes || this.#panelAxes.has(v.id))
    const key = views.map((v) => `${v.position}${v.enabled ? 1 : 0}${v.progress < 1 ? "~" : ""}`).join()
    if (key === this.#panelKey) return
    this.#panelKey = key
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
    panel.innerHTML = views
      .map((v) => {
        const pos = v.positions
          .map((p) => `<span data-pos="${esc(p)}"${p === v.position ? ' class="at"' : ""}>${esc(p)}</span>`)
          .join("")
        const cls = `walkrow${v.enabled ? "" : " off"}${v.progress < 1 ? " going" : ""}`
        return `<div class="${cls}" data-axis="${esc(v.id)}"><label>${esc(v.label)}</label><i>${esc(v.key ?? "")}</i><div>${pos}</div></div>`
      })
      .join("")
  }
}
