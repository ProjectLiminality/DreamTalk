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

  enter(surface: LevelSurface, holon: Holon, name = nodeNameOf(holon)): Saved {
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
  state(): { depth: number; path: string[]; t?: number; playing?: boolean; song?: string }
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
}

const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000))

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
  const track = (canvas: HTMLCanvasElement, signal: AbortSignal) =>
    canvas.addEventListener("pointermove", (e) => (pointer = { x: e.clientX, y: e.clientY }), { signal })
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

  const mountInner = async (wm: WatchMe, under: HTMLCanvasElement): Promise<Inner> => {
    const ac = new AbortController()
    opts.signal.addEventListener("abort", () => ac.abort())
    const canvas = document.createElement("canvas")
    canvas.className = "nestlevel"
    canvas.width = under.width
    canvas.height = under.height
    // Laid exactly over the level beneath — same box, same buffer size.
    const r = under.getBoundingClientRect()
    canvas.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:${30 + inners.length};background:#000;opacity:0;transition:transform ${TRANSITION}s cubic-bezier(.4,0,.2,1), opacity ${TRANSITION}s ease;`
    document.body.appendChild(canvas)
    const dream = new wm.Dream()
    const host = await ThreeHost.mount(dream, canvas)
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
      if (ac.signal.aborted) return
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
    if (wm.startAt) {
      inner.t = Math.min(dream.duration, wm.startAt)
      inner.anchor = performance.now() - inner.t * 1000
    }
    await host.renderFrame(dream.duration)
    if (wm.framed) await frameLevel(dream, host)
    await host.renderFrame(inner.t)
    requestAnimationFrame(frame)
    return inner
  }

  /** Open a level for a symbol: its WatchMe, or its state space (a lattice). */
  const open = async (symbol: Holon, wm: WatchMe, name?: string): Promise<boolean> => {
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
      // …while its own world grows out of the box it occupied.
      const inner = await mountInner(wm, under)
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
    if (symbol) return open(symbol, statesOf(opts.scenes, symbol), `${nodeNameOf(symbol)} ◇`)
    const inner = inners[inners.length - 1]
    if (!inner) return Promise.resolve(false)
    const name = inner.dream.constructor.name.replace(/Dream$/, "")
    const wm: WatchMe = {
      Dream: songLatticeDream(inner.dream.constructor as DreamClass, name),
      alone: false,
      framed: true,
      startAt: inner.game.on ? inner.game.heldAt : inner.t,
    }
    return open(inner.dream.roots[0]!, wm, `${name} ◇`)
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
      inner.ac.abort()
      inner.canvas.remove()
      inner.host.dispose()
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
      }
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
        for (const h of r.walk()) if (symbolAt(h) === h && nodeNameOf(h) === base && area(h) > (best ? area(best) : 0)) best = h
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
