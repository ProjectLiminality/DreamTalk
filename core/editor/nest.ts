/**
 * Nesting — pause a DreamSong, unpack a symbol on screen into its own song
 * or state space, explore it, and come back to the exact paused moment
 * (docs/VISION-HYPEROBJECT.md: "READMEs become nested DreamSongs,
 * subspaces of the machine: pause the explaining song, unpack e.g. the
 * CoherenceBeacon, go as deep as you like, then return and continue the
 * choreography").
 *
 * ONE STATE MACHINE, A STACK. Level 0 is the song being watched; unpacking
 * pushes a level, coming back pops one, as deep as you like. Entering and
 * leaving are transitions of that machine, and they read as "inside of":
 * the outer view glides INTO the symbol (it is framed, then passed
 * through), while the symbol's own song grows out of the box the symbol
 * occupied on screen. Coming back plays it in reverse — the inner world
 * shrinks back into the symbol, the outer view glides back out.
 *
 * FRAME-EXACT RETURN, BY CONSTRUCTION. The outer level is never disposed,
 * re-timed or re-posed: it is HELD (its own pause), the inner level is a
 * second host on a canvas laid over it, and coming back restores exactly
 * the view delta it had (`view.delta`, a value, not a re-framing) and
 * resumes whatever it was doing. Nothing in the outer song moved.
 *
 * WHAT A SYMBOL UNPACKS INTO — its WatchMe: the registered scene that
 * explains it, found by name (`<Class>WatchMeDream`, `<Class>Dream`,
 * `<Class>DemoDream`, or a registry key equal to the class name), else
 * the symbol itself framed alone, its state space walkable (aloneDream).
 * Each inner level runs the player's GameLoop: Space holds the world and
 * makes it walkable (orbit, axes), Space again plays on; Enter unpacks the
 * symbol under the pointer one level deeper; Esc comes back.
 */

import type { DreamClass } from "../src/dream"
import type { Holon } from "../src/holon"
import type { Param, ParamValue } from "../src/params"
import type { ViewDelta, ViewLayer } from "../src/view"
import { ThreeHost } from "../src/render/three-host"
import { GameLoop } from "../demo/game"
import { inkQueries } from "../demo/spark"
import { aloneDream, isSovereign, nodeNameOf } from "./dreamnodes"
import { Dream } from "../src/dream"
import { gatherStateSpace, type StateSpace } from "../src/automaton"
import { machinesOf } from "../src/lattice"
import { together } from "../src/anim"
import { Create } from "../src/verbs"
import { StateLattice } from "../vocabulary/StateLattice/StateLattice"

// --- What a symbol unpacks into ----------------------------------------------------

export interface WatchMe {
  Dream: DreamClass
  /** The registry key, when the WatchMe is a registered scene. */
  key?: string
  /** True when no scene explains it: the symbol is framed alone (beside its lattice, when it has states). */
  alone: boolean
  /** A level drawn for the occasion (a lattice): framed to its content once mounted. */
  framed?: boolean
  /** Where its song should start (a lattice following a song from the moment it was opened). */
  startAt?: number
}

/** The scene one symbol stands in beside its machine (LatticeDemo's pattern), nodes walkable. */
export const latticeDream = (Ctor: new () => Holon, name: string): DreamClass | undefined => {
  if (gatherStateSpace([new Ctor()]).axes.length === 0) return undefined
  const Beside = class extends Dream {
    symbol = new Ctor()
    lattice = new StateLattice({ machine: machinesOf(gatherStateSpace([this.symbol])), playhead: "live" })
    override stateSpace(): StateSpace {
      // The nodes are buttons: each walks the symbol to that state.
      return { axes: this.lattice.axes() }
    }
    unfold() {
      this.stage(this.symbol)
      this.stage(this.lattice)
      this.play(together(Create(this.symbol), Create(this.lattice)), 1.5)
    }
  }
  Object.defineProperty(Beside, "name", { value: `${name}LatticeDream` })
  return Beside
}

/**
 * A song's machine, its song line lit — the WatchMe's path through the
 * state space it explains, the lit node following the song from `from`.
 */
export const songLatticeDream = (Song: DreamClass, name: string): DreamClass => {
  const Through = class extends Dream {
    song = new Song()
    built = this.song.build()
    lattice = new StateLattice({
      machine: machinesOf(gatherStateSpace(this.song.roots, this.song.stateSpace())),
      song: () => this.built,
      playhead: "song",
    })
    unfold() {
      this.stage(this.lattice)
      this.set(this.lattice.time.to(0))
      this.play(together(Create(this.lattice), this.lattice.time.by(1, { easing: "linear" })), 1)
      this.play(this.lattice.time.to(this.built.duration, { easing: "linear" }), Math.max(0.1, this.built.duration - 1))
    }
  }
  Object.defineProperty(Through, "name", { value: `${name}SongLatticeDream` })
  return Through
}

/** A holon's WatchMe: its own level (Holon.unpack), else the scene that explains its class, else the symbol alone. */
export const watchMeOf = (scenes: Record<string, DreamClass>, holon: Holon): WatchMe => {
  const name = nodeNameOf(holon)
  // Its own level, from its own data (Holon.unpack), before its class's.
  const own = holon.unpack()
  if (own) return { Dream: own, alone: false }
  const entries = Object.entries(scenes)
  for (const suffix of ["WatchMeDream", "Dream", "DemoDream"]) {
    const hit = entries.find(([, Ctor]) => Ctor.name === `${name}${suffix}`)
    if (hit) return { Dream: hit[1], key: hit[0], alone: false }
  }
  const byKey = entries.find(([key]) => key === name.toLowerCase())
  if (byKey) return { Dream: byKey[1], key: byKey[0], alone: false }
  // No song of its own: the symbol beside its state lattice (if it has states).
  const Ctor = holon.constructor as new () => Holon
  const beside = latticeDream(Ctor, name)
  return beside ? { Dream: beside, alone: true, framed: true } : { Dream: aloneDream(Ctor, name), alone: true }
}

/** A symbol's state space ON DEMAND: its WatchMe's machine with the song line lit, else its own lattice. */
export const statesOf = (scenes: Record<string, DreamClass>, holon: Holon): WatchMe => {
  const wm = watchMeOf(scenes, holon)
  if (wm.alone) return wm
  return { Dream: songLatticeDream(wm.Dream, nodeNameOf(holon)), alone: false, framed: true, key: wm.key && `${wm.key} ◇` }
}

/**
 * A level's name in the nest path (and so in a link): the class of the level
 * a holon unpacks into when it names its own (Holon.unpack — one site of a
 * map, by its data), else the symbol's node name. So a link reopens THAT
 * site, not whichever part of the same class is largest on screen.
 */
export const levelNameOf = (holon: Holon): string => holon.unpack()?.name || nodeNameOf(holon)

/** The symbol touched: the nearest at-or-above a hit that is sovereign or has its own level (Holon.unpack). */
export const symbolAt = (hit: Holon | undefined): Holon | undefined => {
  for (let h: Holon | null | undefined = hit; h; h = h.parent) if (isSovereign(h) || h.unpack() !== undefined) return h
  return undefined
}

// --- The stack ---------------------------------------------------------------------

/** What a level needs of whoever shows it. */
export interface LevelSurface {
  canvas: HTMLCanvasElement
  pick(clientX: number, clientY: number): Holon | undefined
  /** The symbol's box on the canvas, in client px. */
  clientBoxOf(holon: Holon): { x: number; y: number; w: number; h: number } | undefined
  /** World ink bounds — where the view glides into. */
  worldBoundsOf(holon: Holon): { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } | undefined
  /** The level's viewer camera (src/view.ts). */
  view(): ViewLayer | undefined
  /** Hold the level still; the returned resume puts it back as it was. */
  hold(): () => void
  /** The level's holons — where a level is found again by name (a link to a state). */
  roots?(): readonly Holon[]
}

/** What an unpack remembered, so coming back is exact. */
export interface Saved {
  holon: Holon
  name: string
  box?: { x: number; y: number; w: number; h: number }
  delta?: ViewDelta
  resume: () => void
}

/**
 * The pure half of the machine (testable without a browser): what entering
 * saves and what leaving restores. `enter` holds the level and remembers
 * its view; `leave` puts the view delta back exactly and resumes.
 */
export class NestStack {
  readonly #saved: Saved[] = []

  get depth(): number {
    return this.#saved.length
  }

  get top(): Saved | undefined {
    return this.#saved[this.#saved.length - 1]
  }

  /** Where the song's own view stood before the first level opened. */
  get outerDelta(): ViewDelta | undefined {
    return this.#saved[0]?.delta
  }

  /** The names from the song down to here (a breadcrumb). */
  get path(): string[] {
    return this.#saved.map((s) => s.name)
  }

  enter(surface: LevelSurface, holon: Holon, name = levelNameOf(holon)): Saved {
    const view = surface.view()
    const saved: Saved = {
      holon,
      name,
      box: surface.clientBoxOf(holon),
      delta: view ? { ...view.delta } : undefined,
      resume: surface.hold(),
    }
    this.#saved.push(saved)
    return saved
  }

  /** Pop a level: the view comes back to exactly where it stood, then the level resumes. */
  leave(surface: LevelSurface, opts: { glide?: number; now?: number } = {}): Saved | undefined {
    const saved = this.#saved.pop()
    if (!saved) return undefined
    const view = surface.view()
    if (view && saved.delta) {
      if (opts.glide) view.glideTo({ ...saved.delta }, opts.now ?? performance.now(), opts.glide)
      else view.delta = { ...saved.delta }
    }
    return saved
  }
}

// --- The machine, mounted ------------------------------------------------------------

export interface NestOpts {
  /** Level 0 — the song being watched (the player's or the editor's). */
  outer: LevelSurface
  scenes: Record<string, DreamClass>
  note(text: string): void
  /** The outer's pointer / key handlers are suspended while a level is open. */
  onDepth?(depth: number): void
  signal: AbortSignal
}

export interface Nest {
  readonly depth: number
  readonly path: string[]
  /** Unpack a symbol of the TOP level (the outer song when nothing is open). */
  unpack(holon: Holon): Promise<boolean>
  /** Unpack the symbol under a point of the top level. */
  unpackAt(clientX: number, clientY: number): Promise<boolean>
  /** Unpack the symbol under the pointer (the Enter key). */
  unpackHovered(): Promise<boolean>
  /**
   * Open a state space (⇧Enter): a symbol's — its WatchMe's machine with the
   * song line lit, else its own lattice — or, with none, the machine of the
   * song being watched in the open level, from this moment.
   */
  states(holon?: Holon): Promise<boolean>
  /** ⇧Enter: the state space of the symbol under the pointer, else of the open level's song. */
  statesHovered(): Promise<boolean>
  /** Come back one level. Resolves when the transition has landed. */
  back(): Promise<boolean>
  /** The top level's state (headless): its t, whether it plays, its song. */
  state(): { depth: number; path: string[]; t?: number; playing?: boolean; song?: string; kept?: number }
  /**
   * The open level on top — what hands aim at while one is open (undefined at
   * depth 0: the song beneath is theirs). `dreamtalk:nest` on window says when it changes.
   */
  top(): NestTop | undefined
  /**
   * Open the next level by its path name (Nest.path's spelling): the largest
   * on-screen symbol of that name in the top level, "<name> ◇" its state
   * space — how a link to a state opens its nest again.
   */
  openByName(name: string): Promise<boolean>
  /** Build a symbol's level in the background, so opening it only reveals it (a rested pointer or spark does this itself). */
  prewarm(holon: Holon, states?: boolean): void
  /** The same, by level name (Nest.path's spelling) — a scene's slot about to be recalled. */
  prewarmByName(name: string): void
  /** The song's view as it stood before the first level opened (it glides back there on return). */
  readonly outerDelta: ViewDelta | undefined
}

/** The open level on top: its game loop, canvas and host. */
export interface NestTop {
  game: GameLoop
  canvas: HTMLCanvasElement
  host: ThreeHost
  depth: number
}

/** Fired on window when the top level changes (a level opened or closed); detail: the new depth. */
export const NEST_EVENT = "dreamtalk:nest"
const announce = (depth: number) => window.dispatchEvent(new CustomEvent(NEST_EVENT, { detail: { depth } }))

/** How long entering and leaving take, seconds. */
export const TRANSITION = 0.8

interface Inner {
  dream: Dream
  host: ThreeHost
  canvas: HTMLCanvasElement
  game: GameLoop
  surface: LevelSurface
  ac: AbortController
  t: number
  playing: boolean
  anchor: number
  key?: string
  /** What it was opened as — a revisited level starts its WatchMe again from here. */
  wm: WatchMe
  /** What opened it, under which kind — the key it is kept by once closed. */
  symbol?: Holon
  kind?: string
  /** Start its frame loop (it stops itself when parked). */
  loop?: () => void
  /** Its clock and frames run (on the stack); a prepared or kept level stands still, hidden. */
  running: boolean
}

const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000))
/** A breath: the rest of a mount waits for the next frame, so no one frame carries all of it. */
const breath = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
/** Idle time, or soon (no requestIdleCallback): where prewarming and teardown run, never in a transition frame. */
const whenIdle = (fn: () => void) => {
  const idle = (window as { requestIdleCallback?: (fn: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  if (idle) idle(fn, { timeout: 1500 })
  else setTimeout(fn, 50)
}
/** How long a pointer rests on a symbol before its level is built in the background, ms. */
const PREWARM_REST_MS = 150
/** Levels kept built while not open — the last closed, the last hovered (an LRU, like a song's keep). */
const KEEP_LEVELS = 2
/** The longest a level's background compile is waited for before it is drawn anyway, s. */
const WARM_WAIT_S = 1.5
/** The longest an open waits for a level still being prepared before it builds its own, s. */
const OPEN_WAIT_S = 3

/**
 * Levels built but not open, most recent first (editor/nest.ts). Past `size`
 * the oldest unpinned one is let go (a slot's level is pinned: a hover never
 * evicts it); a taken one leaves the cache. `take` waits at most `waitMs` for
 * a level still being prepared — one that lands later is let go.
 */
export class LevelCache<T> {
  readonly #entries: { holon: Holon; kind: string; ready: Promise<T | undefined>; pinned: boolean }[] = []
  constructor(
    readonly size: number,
    readonly release: (level: T) => void,
  ) {}
  /** Levels held now. */
  get count(): number {
    return this.#entries.length
  }
  has(holon: Holon, kind: string): boolean {
    return this.#entries.some((e) => e.holon === holon && e.kind === kind)
  }
  keep(holon: Holon, kind: string, ready: Promise<T | undefined>, pinned = false): void {
    this.#entries.unshift({ holon, kind, ready, pinned })
    while (this.#entries.length > this.size) {
      let k = -1
      for (let i = this.#entries.length - 1; i >= 0; i--) if (!this.#entries[i]!.pinned) { k = i; break }
      const [old] = this.#entries.splice(k < 0 ? this.#entries.length - 1 : k, 1)
      void old!.ready.then((level) => level !== undefined && this.release(level))
    }
  }
  async take(holon: Holon, kind: string, waitMs: number): Promise<T | undefined> {
    const k = this.#entries.findIndex((e) => e.holon === holon && e.kind === kind)
    if (k < 0) return undefined
    const [e] = this.#entries.splice(k, 1)
    let late = false
    const got = await Promise.race([e!.ready, new Promise<undefined>((r) => setTimeout(() => ((late = true), r(undefined)), waitMs))])
    if (got === undefined && late) void e!.ready.then((level) => level !== undefined && this.release(level))
    return got
  }
  clear(): void {
    for (const e of this.#entries.splice(0)) void e.ready.then((level) => level !== undefined && this.release(level))
  }
}

/**
 * The machine is also on the page as `window.__dtNest` — the named actions a
 * hand gesture binds to (demo/handplay.ts): `unpackHovered()` (or
 * `unpack(holon)`), `statesHovered()` (or `states(holon)`) and `back()`.
 */
export const mountNest = (opts: NestOpts): Nest => {
  const stack = new NestStack()
  const inners: Inner[] = []
  let busy = false
  /** Esc pressed while a level was still opening: honoured the moment it has. */
  let pendingBack: (() => void) | undefined
  let pointer: { x: number; y: number } | undefined

  const top = (): LevelSurface => inners[inners.length - 1]?.surface ?? opts.outer
  // A pointer that rests on a symbol builds its level in the background (prewarm).
  let rest = 0
  const track = (canvas: HTMLCanvasElement, signal: AbortSignal) =>
    canvas.addEventListener(
      "pointermove",
      (e) => {
        pointer = { x: e.clientX, y: e.clientY }
        clearTimeout(rest)
        rest = window.setTimeout(() => {
          if (busy || !pointer || top().canvas !== canvas) return
          const h = symbolAt(top().pick(pointer.x, pointer.y))
          if (h && hasOwnLevel(h)) prewarm(h)
        }, PREWARM_REST_MS)
      },
      { signal },
    )
  track(opts.outer.canvas, opts.signal)

  /** A box (client px) as the transform that lays the full canvas onto it. */
  const onto = (canvas: HTMLCanvasElement, box?: { x: number; y: number; w: number; h: number }): string => {
    const r = canvas.getBoundingClientRect()
    if (!box || r.width <= 0) return "scale(0.05)"
    const s = Math.max(0.02, Math.max(box.w / r.width, box.h / r.height))
    const dx = box.x + box.w / 2 - (r.left + r.width / 2)
    const dy = box.y + box.h / 2 - (r.top + r.height / 2)
    return `translate(${dx}px, ${dy}px) scale(${s})`
  }

  /**
   * Build a level, hidden: its scene constructed, mounted, framed, drawn
   * once at its start (the visible pipelines compile then) and its hidden
   * ones compiled in the background (host.warmed). Each step takes its own
   * frame — on a hover in idle time, or across the glide of an open that
   * found nothing prepared. startInner then only reveals it.
   */
  const prepareInner = async (wm: WatchMe, under: HTMLCanvasElement): Promise<Inner> => {
    const ac = new AbortController()
    opts.signal.addEventListener("abort", () => ac.abort())
    const canvas = document.createElement("canvas")
    canvas.className = "nestlevel"
    canvas.width = under.width
    canvas.height = under.height
    // Laid exactly over the level beneath — same box, same buffer size.
    const r = under.getBoundingClientRect()
    canvas.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:${30 + inners.length};background:#000;opacity:0;visibility:hidden;pointer-events:none;transition:transform ${TRANSITION}s cubic-bezier(.4,0,.2,1), opacity ${TRANSITION}s ease;`
    document.body.appendChild(canvas)
    const dream = new wm.Dream()
    await breath()
    const host = await ThreeHost.mount(dream, canvas)
    await breath()
    const pickAt = (x: number, y: number) => {
      const b = canvas.getBoundingClientRect()
      if (b.width <= 0) return undefined
      return host.pick(((x - b.left) / b.width) * 2 - 1, -(((y - b.top) / b.height) * 2 - 1))
    }
    const game = new GameLoop(
      {
        canvas,
        pick: pickAt,
        boundsOf: (h) => host.boundsOf(h),
        worldBoundsOf: (h) => host.worldBoundsOf(h),
        setBeforeSync: (fn) => (host.beforeSync = fn),
        attend: (c, h, a) => void host.attend(c, h, a),
        // A hand's spark points at the ink itself, as in the scene beneath.
        worldBoundsOfEach: (hs) => host.worldBoundsOfEach(hs),
        ...inkQueries(host),
      },
      {
        roots: dream.roots,
        space: dream.stateSpace(),
        observer: dream.observer,
        animated: new Set(dream.build().params as Param<ParamValue>[]),
        suspended: () => busy || inners[inners.length - 1]?.canvas !== canvas,
        hud: true,
        signal: ac.signal,
      },
    )
    const inner: Inner = {
      dream,
      host,
      canvas,
      game,
      ac,
      t: 0,
      playing: true,
      anchor: performance.now(),
      key: wm.key,
      wm,
      running: false,
      surface: {
        canvas,
        roots: () => dream.roots,
        pick: pickAt,
        clientBoxOf: (h) => clientBox(host, canvas, h),
        worldBoundsOf: (h) => host.worldBoundsOf(h),
        view: () => game.view,
        hold: () => {
          const was = inner.playing && !game.on
          if (!game.on) {
            inner.playing = false
            game.enter(inner.t)
          }
          game.covered = true
          return () => {
            game.covered = false
            if (!was) return
            game.leave()
            inner.anchor = performance.now() - game.heldAt * 1000
            inner.playing = true
          }
        },
      },
    }
    track(canvas, ac.signal)
    // Its own clock: the WatchMe plays through once, then holds its last pose
    // walkable (free play) — explore it, its nodes or handles are buttons.
    const frame = async (now: number) => {
      if (ac.signal.aborted || !inner.running) return
      game.tick(now)
      if (game.on) await host.renderFrame(game.heldAt)
      else {
        if (inner.playing) {
          inner.t = Math.min(dream.duration, (now - inner.anchor) / 1000)
          if (inner.t >= dream.duration) {
            inner.playing = false
            game.enter(inner.t)
          }
        }
        await host.renderFrame(inner.t)
      }
      requestAnimationFrame(frame)
    }
    inner.loop = () => requestAnimationFrame(frame)
    // Its pipelines compile in the background first (yielding between
    // objects), so its first drawn frames build nothing in one go.
    // Bounded: a compile that never settles must not hold the level back.
    await Promise.race([host.warmed, sleep(WARM_WAIT_S)])
    await host.renderFrame(dream.duration)
    if (wm.framed) await frameLevel(dream, host)
    await breath()
    await host.renderFrame(wm.startAt ? Math.min(dream.duration, wm.startAt) : 0)
    return inner
  }

  /** Reveal a prepared (or kept) level on top of `under`: its WatchMe from its start, its clock running. */
  const startInner = (inner: Inner, under: HTMLCanvasElement): void => {
    const { canvas, game, dream, wm } = inner
    const r = under.getBoundingClientRect()
    Object.assign(canvas.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, zIndex: String(30 + inners.length), visibility: "visible", pointerEvents: "" })
    // A level visited before starts over, as a fresh one would.
    if (game.on) game.leave()
    inner.t = wm.startAt ? Math.min(dream.duration, wm.startAt) : 0
    inner.playing = true
    inner.anchor = performance.now() - inner.t * 1000
    inner.running = true
    game.covered = false
    inner.loop?.()
  }

  /** Stop a level and hide it, built — kept for a return (or a hover that comes to nothing). */
  const parkInner = (inner: Inner): void => {
    inner.running = false
    inner.game.covered = true
    Object.assign(inner.canvas.style, { visibility: "hidden", pointerEvents: "none" })
  }

  const disposeInner = (inner: Inner): void => {
    inner.running = false
    inner.ac.abort()
    inner.canvas.remove()
    inner.host.dispose()
  }

  // Levels built but not open: prepared on a hover or for a slot, or closed a moment ago.
  const kept = new LevelCache<Inner>(KEEP_LEVELS, (inner) => whenIdle(() => disposeInner(inner)))
  opts.signal.addEventListener("abort", () => kept.clear())
  /** One level builds at a time: hosts compiling side by side stalled each other's compileAsync. */
  let building: Promise<unknown> = Promise.resolve()
  /** Worth building on a hover: a level of its own (Holon.unpack) or a scene that explains it — not a symbol shown alone. */
  const hasOwnLevel = (h: Holon): boolean => {
    if (h.unpack() !== undefined) return true
    try {
      return !watchMeOf(opts.scenes, h).alone
    } catch {
      return false
    }
  }
  /** What a symbol opens as, kept apart: its WatchMe, or its state space. */
  const kindOf = (wm: WatchMe, states: boolean) => (states ? `states:${wm.Dream.name}` : "unpack")

  /** Build a symbol's level in the background (a rested pointer, a slot about to be recalled), so opening it only reveals it. */
  const prewarm = (holon: Holon, states = false, pinned = false): void => {
    const symbol = symbolAt(holon) ?? holon
    let wm: WatchMe
    try {
      wm = states ? statesOf(opts.scenes, symbol) : watchMeOf(opts.scenes, symbol)
    } catch {
      return // a symbol that cannot stand alone (a StateLattice without its machine): nothing to warm
    }
    const kind = kindOf(wm, states)
    if (kept.has(symbol, kind) || stack.top?.holon === symbol) return
    const under = top().canvas
    const ready: Promise<Inner | undefined> = building
      .then(() => new Promise<void>((idle) => whenIdle(idle)))
      .then(() => prepareInner(wm, under))
      .then((inner) => (parkInner(inner), inner))
      .catch(() => undefined)
    building = ready
    kept.keep(symbol, kind, ready, pinned)
  }

  /** Open a level for a symbol: its WatchMe, or its state space (a lattice). */
  const open = async (symbol: Holon, wm: WatchMe, name?: string, states = false): Promise<boolean> => {
    if (busy) return false
    const surface = top()
    const under = surface.canvas
    busy = true
    try {
      const saved = stack.enter(surface, symbol, name)
      opts.onDepth?.(stack.depth)
      opts.note(`↓ ${saved.name}${wm.alone || wm.framed ? " — its state space" : ""} · esc comes back`)
      // "Inside of": the view glides into the symbol and past it…
      const view = surface.view()
      const b = surface.worldBoundsOf(symbol)
      if (view && b) {
        const c = { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 }
        const R = Math.hypot(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) / 2
        // frameSphere glides at its own pace: take its target, glide there at ours.
        const from = { ...view.delta }
        const now = performance.now()
        view.frameSphere(c, Math.max(R * 0.15, 1e-3), now)
        view.step(Number.POSITIVE_INFINITY)
        const into = { ...view.delta }
        view.delta = from
        view.glideTo(into, now, TRANSITION)
      }
      // …while its own world grows out of the box it occupied — built already
      // when it was hovered or closed a moment ago, else built across the glide.
      const kind = kindOf(wm, states)
      // A prepared one that has not come within OPEN_WAIT_S is not waited for (it is let go when it lands).
      const inner = (await kept.take(symbol, kind, OPEN_WAIT_S * 1000)) ?? (await prepareInner(wm, under))
      // The moment it starts from is this open's (a song's lattice from where you were).
      inner.wm = { ...inner.wm, startAt: wm.startAt }
      inner.kind = kind
      inner.symbol = symbol
      startInner(inner, under)
      inner.canvas.style.transition = "none"
      inner.canvas.style.transform = onto(inner.canvas, saved.box)
      void inner.canvas.offsetWidth
      inner.canvas.style.transition = `transform ${TRANSITION}s cubic-bezier(.4,0,.2,1), opacity ${TRANSITION}s ease`
      inner.canvas.style.transform = "none"
      inner.canvas.style.opacity = "1"
      inners.push(inner)
      opts.onDepth?.(stack.depth)
      announce(stack.depth)
      await sleep(TRANSITION)
      return true
    } finally {
      busy = false
      const queued = pendingBack
      pendingBack = undefined
      queued?.()
    }
  }

  const unpack = (holon: Holon): Promise<boolean> => {
    const symbol = symbolAt(holon) ?? holon
    return open(symbol, watchMeOf(opts.scenes, symbol))
  }

  /**
   * The state space ON DEMAND: a symbol's (its WatchMe's machine with the
   * song line lit, else its own lattice) — or, given none inside a level,
   * the machine of the song being watched there, from this very moment.
   */
  const states = (holon?: Holon): Promise<boolean> => {
    const symbol = holon && (symbolAt(holon) ?? holon)
    if (symbol) return open(symbol, statesOf(opts.scenes, symbol), `${nodeNameOf(symbol)} ◇`, true)
    const inner = inners[inners.length - 1]
    if (!inner) return Promise.resolve(false)
    const name = inner.dream.constructor.name.replace(/Dream$/, "")
    const wm: WatchMe = {
      Dream: songLatticeDream(inner.dream.constructor as DreamClass, name),
      alone: false,
      framed: true,
      startAt: inner.game.on ? inner.game.heldAt : inner.t,
    }
    return open(inner.dream.roots[0]!, wm, `${name} ◇`, true)
  }

  const back = async (): Promise<boolean> => {
    // Still opening (the WatchMe mounts, the view glides in): come back as soon as it has.
    if (busy && stack.depth > 0) return new Promise((done) => (pendingBack = () => void back().then(done)))
    const inner = inners[inners.length - 1]
    if (busy || !inner) return false
    busy = true
    try {
      const saved = stack.top!
      // The inner world shrinks back into the symbol; the outer view glides out to where it stood.
      inner.canvas.style.transform = onto(inner.canvas, saved.box)
      inner.canvas.style.opacity = "0"
      const below = inners[inners.length - 2]?.surface ?? opts.outer
      stack.leave(below, { glide: TRANSITION })
      await sleep(TRANSITION + 0.05)
      inners.pop()
      // Kept built, hidden: Esc and coming back in cost nothing; torn down in idle time when evicted.
      parkInner(inner)
      kept.keep(inner.symbol!, inner.kind!, Promise.resolve(inner))
      // The glide has landed: the delta is the saved value exactly.
      const view = below.view()
      if (view && saved.delta) view.delta = { ...saved.delta }
      saved.resume()
      opts.onDepth?.(stack.depth)
      announce(stack.depth)
      opts.note(stack.depth ? `↑ ${stack.top!.name}` : "↑ back in the song")
      return true
    } finally {
      busy = false
    }
  }

  // Keys while a level is open: Space holds/plays it, Enter unpacks deeper, Esc
  // comes back — and nothing reaches the level beneath.
  document.addEventListener(
    "keydown",
    (e) => {
      const inner = inners[inners.length - 1]
      if (!inner) {
        // A level is still opening (its song mounting): Esc already means "back".
        if (stack.depth > 0 && e.code === "Escape") {
          e.stopImmediatePropagation()
          e.preventDefault()
          void back()
        }
        return
      }
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (typing) return
      // ⌥1–9 recalls a presenter slot (demo/toolkit.ts) from any depth: the page's, not the level's.
      if (e.altKey && /^Digit[1-9]$/.test(e.code)) return
      e.stopImmediatePropagation()
      if (e.code === "Escape") {
        e.preventDefault()
        void back()
      } else if (e.code === "Space") {
        e.preventDefault()
        if (inner.game.on) {
          inner.game.leave()
          inner.anchor = performance.now() - inner.game.heldAt * 1000
          inner.playing = true
        } else {
          inner.playing = false
          inner.game.enter(inner.t)
        }
      } else if (e.key === "Enter" && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // ⇧Enter: the state space — of the symbol under the pointer, else of this song, from now.
        e.preventDefault()
        void states(pointer ? symbolAt(top().pick(pointer.x, pointer.y)) : undefined)
      } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.altKey && pointer) {
        e.preventDefault()
        void unpackAt(pointer.x, pointer.y)
      } else inner.game.key(e)
    },
    { signal: opts.signal, capture: true },
  )

  const unpackAt = async (x: number, y: number): Promise<boolean> => {
    const hit = symbolAt(top().pick(x, y))
    if (!hit) return false
    return unpack(hit)
  }

  const nest: Nest = {
    get depth() {
      return stack.depth
    },
    get path() {
      return stack.path
    },
    get outerDelta() {
      return stack.outerDelta
    },
    unpack,
    unpackAt,
    unpackHovered: () => (pointer ? unpackAt(pointer.x, pointer.y) : Promise.resolve(false)),
    states,
    statesHovered: () => states(pointer ? symbolAt(top().pick(pointer.x, pointer.y)) : undefined),
    back,
    state() {
      const inner = inners[inners.length - 1]
      return {
        depth: stack.depth,
        path: stack.path,
        t: inner ? (inner.game.on ? inner.game.heldAt : inner.t) : undefined,
        playing: inner ? inner.playing && !inner.game.on : undefined,
        song: inner?.key ?? inner?.dream.constructor.name,
        kept: kept.count,
      }
    },
    prewarm,
    prewarmByName(name) {
      const lattice = name.endsWith(" ◇")
      const base = lattice ? name.slice(0, -2) : name
      for (const r of top().roots?.() ?? [])
        for (const h of r.walk())
          if (symbolAt(h) === h && levelNameOf(h) === base) return prewarm(h, lattice, true)
    },
    openByName(name) {
      const lattice = name.endsWith(" ◇")
      const base = lattice ? name.slice(0, -2) : name
      const surface = top()
      const area = (h: Holon) => {
        const b = surface.clientBoxOf(h)
        return b ? b.w * b.h : 0
      }
      let best: Holon | undefined
      for (const r of surface.roots?.() ?? [])
        for (const h of r.walk()) if (symbolAt(h) === h && levelNameOf(h) === base && area(h) > (best ? area(best) : 0)) best = h
      if (best) return lattice ? states(best) : unpack(best)
      // "<song> ◇" with no symbol of that name: the open level's own song, through its lattice.
      return lattice && inners.length ? states() : Promise.resolve(false)
    },
    top() {
      const inner = inners[inners.length - 1]
      return inner && { game: inner.game, canvas: inner.canvas, host: inner.host, depth: inners.length }
    },
  }
  ;(window as unknown as { __dtNest?: Nest }).__dtNest = nest
  opts.signal.addEventListener("abort", () => {
    const w = window as unknown as { __dtNest?: Nest }
    if (w.__dtNest === nest) w.__dtNest = undefined
  })
  return nest
}

type Box = { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }
const union = (boxes: (Box | undefined)[]): Box | undefined =>
  boxes.reduce<Box | undefined>((u, b) => {
    if (!b) return u
    if (!u) return { min: { ...b.min }, max: { ...b.max } }
    return {
      min: { x: Math.min(u.min.x, b.min.x), y: Math.min(u.min.y, b.min.y), z: Math.min(u.min.z, b.min.z) },
      max: { x: Math.max(u.max.x, b.max.x), y: Math.max(u.max.y, b.max.y), z: Math.max(u.max.z, b.max.z) },
    }
  }, undefined)

/**
 * A level drawn for the occasion: a symbol and its lattice side by side —
 * the lattice sized to the symbol, set just right of it — and the view
 * framing both. (Measured at the level's last pose, where everything is drawn.)
 */
const frameLevel = async (dream: Dream, host: ThreeHost): Promise<void> => {
  const d = dream as unknown as { symbol?: Holon; lattice?: Holon }
  if (d.symbol && d.lattice) {
    const sb = host.worldBoundsOf(d.symbol)
    const lb = host.worldBoundsOf(d.lattice)
    if (sb && lb) {
      const sh = Math.max(sb.max.y - sb.min.y, sb.max.x - sb.min.x, 1)
      const lh = Math.max(lb.max.y - lb.min.y, lb.max.x - lb.min.x, 1)
      const k = (1.2 * sh) / lh
      const L = d.lattice as unknown as { scale: Param<number>; x: Param<number>; y: Param<number> }
      L.scale.value = L.scale.value * k
      // Its left edge a symbol's width to the right of the symbol, centres level.
      const lcx = (lb.min.x + lb.max.x) / 2
      const lcy = (lb.min.y + lb.max.y) / 2
      L.x.value = L.x.value + (sb.max.x + 0.35 * sh + ((lb.max.x - lb.min.x) * k) / 2 - lcx)
      L.y.value = L.y.value + ((sb.min.y + sb.max.y) / 2 - lcy)
      await host.renderFrame(dream.duration)
    }
  }
  // Framed in the level's own camera, not the viewer's layer: it holds while
  // the level plays (the view layer writes only in free play), and `r` comes home to it.
  const all = union(dream.roots.map((r) => host.worldBoundsOf(r)))
  const o = dream.observer
  if (!all || o.orthographic.value) return
  const set = (p: Param<number>, v: number) => (p.value = p.defaultValue = v)
  set(o.x, (all.min.x + all.max.x) / 2)
  set(o.y, (all.min.y + all.max.y) / 2)
  set(o.z, (all.min.z + all.max.z) / 2)
  // Fit the box's face to the 16:9 frame at the view layer's fill.
  const R = Math.max((all.max.x - all.min.x) / (16 / 9), all.max.y - all.min.y, (all.max.z - all.min.z) / 2) / 2
  set(o.radius, (R / (0.6 * Math.tan(o.fov.value / 2))) * (o.zoom.value || 1))
  await host.renderFrame(dream.duration)
}

/** A holon's box on a canvas in client px (host.boundsOf is drawing-buffer px). */
export const clientBox = (
  host: ThreeHost,
  canvas: HTMLCanvasElement,
  holon: Holon,
): { x: number; y: number; w: number; h: number } | undefined => {
  const b = host.boundsOf(holon)
  if (!b) return undefined
  const r = canvas.getBoundingClientRect()
  const sx = r.width / (canvas.width || 1)
  const sy = r.height / (canvas.height || 1)
  return { x: r.left + b.min.x * sx, y: r.top + b.min.y * sy, w: (b.max.x - b.min.x) * sx, h: (b.max.y - b.min.y) * sy }
}
